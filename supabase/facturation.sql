-- =====================================================================
-- Centre clients — facturation mensuelle et débits préautorisés (DPA, Desjardins)
-- À exécuter dans Supabase > SQL Editor APRÈS centre_dossiers.sql. Peut être réexécuté sans risque.
-- =====================================================================

-- Paramètres du cabinet (numéros de taxes, numéro d'organisme Desjardins…) : lecture et écriture par le cabinet seulement
create table if not exists public.cc_parametres (
  cle    text primary key,
  valeur jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Accord de DPA du payeur (Règle H1 de Paiements Canada). Contient des renseignements bancaires : cabinet seulement.
create table if not exists public.cc_dpa_accords (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.cc_clients(id) on delete cascade,
  contrat_id  uuid references public.cc_contrats(id) on delete set null,
  statut      text not null default 'actif' check (statut in ('actif','suspendu','annulé')),
  categorie   text not null default 'entreprise' check (categorie in ('entreprise','personnel')),
  titulaire   text not null,
  institution text not null check (institution ~ '^[0-9]{3}$'),
  transit     text not null check (transit ~ '^[0-9]{5}$'),
  compte      text not null check (compte ~ '^[0-9-]{5,12}$'),
  montant     numeric(12,2) not null check (montant > 0),   -- avant taxes, par mois
  jour        int not null default 1 check (jour between 1 and 28),
  debut       date not null,
  renonce_preavis boolean not null default false,
  signe_le    timestamptz,
  signe_nom   text,
  signe_par   uuid,
  source      text not null default 'portail',               -- portail | papier
  specimen    jsonb,                                          -- chèque annulé (chemin du fichier)
  annule_le   timestamptz,
  note        text,
  created_at  timestamptz not null default now()
);

-- Factures
create sequence if not exists public.cc_facture_seq;
create table if not exists public.cc_factures (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.cc_clients(id) on delete restrict,
  numero      text unique,
  date        date not null default current_date,
  periode     text,                     -- ex. 2027-01 pour une facture mensuelle
  lignes      jsonb not null default '[]'::jsonb,  -- [{description, montant}]
  sous_total  numeric(12,2) not null default 0,
  tps         numeric(12,2) not null default 0,
  tvq         numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,
  mode        text not null default 'dpa' check (mode in ('dpa','autre')),
  statut      text not null default 'à prélever' check (statut in ('à prélever','transmise','payée','rejetée','à payer','annulée')),
  echeance    date,
  lot_id      uuid,
  emetteur    jsonb not null default '{}'::jsonb,  -- nom, adresse, numéros de TPS et de TVQ au moment de la facture
  paye_le     date,
  note        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists cc_factures_mois on public.cc_factures (client_id, periode) where mode = 'dpa' and statut <> 'annulée';
create or replace function public.cc_facture_numero() returns trigger language plpgsql as
$$ begin if new.numero is null then new.numero := 'F-' || to_char(new.date,'YYYY') || '-' || lpad(nextval('public.cc_facture_seq')::text, 5, '0'); end if; return new; end $$;
drop trigger if exists cc_facture_numero on public.cc_factures;
create trigger cc_facture_numero before insert on public.cc_factures for each row execute function public.cc_facture_numero();

-- Lots de prélèvements (un fichier Desjardins par lot)
create sequence if not exists public.cc_dpa_fichier_seq minvalue 1 maxvalue 9999 cycle;
create table if not exists public.cc_lots_dpa (
  id             uuid primary key default gen_random_uuid(),
  numero_fichier int not null default nextval('public.cc_dpa_fichier_seq'),
  date_prelevement date not null,
  nb             int not null default 0,
  total          numeric(12,2) not null default 0,
  statut         text not null default 'généré' check (statut in ('généré','transmis','traité','annulé')),
  contenu        text,
  created_at     timestamptz not null default now()
);

alter table public.cc_parametres  enable row level security;
alter table public.cc_dpa_accords enable row level security;
alter table public.cc_factures    enable row level security;
alter table public.cc_lots_dpa    enable row level security;
drop policy if exists cc_par_cabinet on public.cc_parametres;
drop policy if exists cc_dpa_cabinet on public.cc_dpa_accords;
drop policy if exists cc_fac_cabinet on public.cc_factures;
drop policy if exists cc_fac_client  on public.cc_factures;
drop policy if exists cc_lot_cabinet on public.cc_lots_dpa;
create policy cc_par_cabinet on public.cc_parametres  for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_dpa_cabinet on public.cc_dpa_accords for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_fac_cabinet on public.cc_factures    for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_fac_client  on public.cc_factures    for select using (statut <> 'annulée' and client_id in (select public.pc_mes_entreprises()));
create policy cc_lot_cabinet on public.cc_lots_dpa    for all using (public.tl_est_membre()) with check (public.tl_est_membre());

-- Le client signe l'accord de DPA dans son portail (avec le contrat). Les renseignements bancaires ne sont jamais relus par le client.
create or replace function public.pc_signer_dpa(p_contrat uuid, p_titulaire text, p_institution text, p_transit text, p_compte text,
  p_renonce boolean, p_nom text, p_specimen jsonb) returns void
  language plpgsql security definer set search_path = public as
$$ declare k record; d jsonb; begin
  select * into k from public.cc_contrats where id = p_contrat and client_id in (select public.pc_mes_entreprises());
  if k.id is null then raise exception 'contrat introuvable'; end if;
  d := k.donnees;
  update public.cc_dpa_accords set statut = 'annulé', annule_le = now(), note = 'Remplacé par un nouvel accord' where client_id = k.client_id and statut = 'actif';
  insert into public.cc_dpa_accords (client_id, contrat_id, categorie, titulaire, institution, transit, compte, montant, jour, debut, renonce_preavis, signe_le, signe_nom, signe_par, specimen)
  values (k.client_id, k.id, (select case when type = 'particulier' then 'personnel' else 'entreprise' end from public.cc_clients where id = k.client_id),
    trim(p_titulaire), p_institution, p_transit, replace(trim(p_compte),' ',''), (d->>'dpaMontant')::numeric, coalesce((d->>'dpaJour')::int,1),
    coalesce((d->>'dpaDebut')::date, current_date), coalesce(p_renonce,false), now(), trim(p_nom), auth.uid(), p_specimen);
end $$;

-- Ce que le client peut voir de son accord (sans le numéro de compte complet)
create or replace function public.pc_mon_dpa(p_client uuid) returns table (statut text, montant numeric, jour int, debut date, signe_le timestamptz, institution text, compte_fin text)
  language sql stable security definer set search_path = public as
$$ select statut, montant, jour, debut, signe_le, institution, right(compte, 3) from public.cc_dpa_accords
   where client_id = p_client and client_id in (select public.pc_mes_entreprises()) order by created_at desc limit 1 $$;
