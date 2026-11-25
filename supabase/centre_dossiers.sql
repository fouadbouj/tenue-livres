-- =====================================================================
-- Centre clients — dossiers clients complets, contrats de services, tâches et journal
-- À exécuter dans Supabase > SQL Editor APRÈS portail_centre.sql et portail_entreprise.sql.
-- Peut être réexécuté sans risque.
-- =====================================================================

-- Fiche client complète (cc_clients reste la table des clients : entreprises et particuliers)
alter table public.cc_clients add column if not exists type         text not null default 'entreprise'; -- entreprise | particulier
alter table public.cc_clients add column if not exists statut       text not null default 'actif';      -- prospect | actif | inactif
alter table public.cc_clients add column if not exists forme        text;   -- société par actions, entreprise individuelle, société de personnes, OBNL…
alter table public.cc_clients add column if not exists telephone    text;
alter table public.cc_clients add column if not exists adresse      text;
alter table public.cc_clients add column if not exists ville        text;
alter table public.cc_clients add column if not exists province     text default 'QC';
alter table public.cc_clients add column if not exists code_postal  text;
alter table public.cc_clients add column if not exists neq          text;   -- numéro d'entreprise du Québec
alter table public.cc_clients add column if not exists no_entreprise text;  -- numéro d'entreprise fédéral (NE, 9 chiffres)
alter table public.cc_clients add column if not exists no_tps       text;
alter table public.cc_clients add column if not exists no_tvq       text;
alter table public.cc_clients add column if not exists tps_tvq      boolean not null default true; -- inscrit aux taxes (déclenche les demandes de documents si « actif »)
alter table public.cc_clients add column if not exists employeur    boolean not null default false;
alter table public.cc_clients add column if not exists groupe       text;   -- regroupe les sociétés d'un même actionnaire ou d'une même famille
alter table public.cc_clients add column if not exists responsable  text;
alter table public.cc_clients add column if not exists ouverture    date default current_date;
alter table public.cc_clients add column if not exists langue       text default 'fr';
alter table public.cc_clients add column if not exists contacts     jsonb not null default '[]'::jsonb; -- [{nom, role, courriel, telephone}]
alter table public.cc_clients add column if not exists checklist    jsonb not null default '{}'::jsonb; -- ouverture de dossier
alter table public.cc_clients add column if not exists updated_at   timestamptz default now();

-- Contrats de services (convention de services professionnels)
create table if not exists public.cc_contrats (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.cc_clients(id) on delete cascade,
  numero     text,
  statut     text not null default 'brouillon' check (statut in ('brouillon','envoyé','signé','annulé')),
  donnees    jsonb not null default '{}'::jsonb,  -- réponses au questionnaire, services et tarifs
  html       text,                                -- texte du contrat figé à l'envoi
  envoye_le  timestamptz,
  signe_le   timestamptz,
  signe_nom  text,
  signe_titre text,
  signe_par  uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cc_publications add column if not exists contrat_id uuid references public.cc_contrats(id) on delete cascade;

-- Tâches de suivi (par client ou générales)
create table if not exists public.cc_taches (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.cc_clients(id) on delete cascade,
  titre       text not null,
  details     text,
  echeance    date,
  responsable text,
  priorite    text not null default 'normale' check (priorite in ('basse','normale','haute')),
  statut      text not null default 'à faire' check (statut in ('à faire','fait')),
  fait_le     timestamptz,
  created_at  timestamptz not null default now()
);

-- Journal du dossier (appels, rencontres, notes)
create table if not exists public.cc_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.cc_clients(id) on delete cascade,
  type       text not null default 'note', -- note | appel | rencontre | courriel
  texte      text not null,
  auteur     text,
  created_at timestamptz not null default now()
);

alter table public.cc_contrats enable row level security;
alter table public.cc_taches   enable row level security;
alter table public.cc_notes    enable row level security;

drop policy if exists cc_ctr_cabinet on public.cc_contrats;
drop policy if exists cc_ctr_client  on public.cc_contrats;
create policy cc_ctr_cabinet on public.cc_contrats for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_ctr_client  on public.cc_contrats for select using (statut in ('envoyé','signé') and client_id in (select public.pc_mes_entreprises()));

drop policy if exists cc_tache_cabinet on public.cc_taches;
create policy cc_tache_cabinet on public.cc_taches for all using (public.tl_est_membre()) with check (public.tl_est_membre());
drop policy if exists cc_note_cabinet on public.cc_notes;
create policy cc_note_cabinet on public.cc_notes for all using (public.tl_est_membre()) with check (public.tl_est_membre());

-- Le client signe électroniquement un contrat envoyé dans son portail
create or replace function public.pc_signer_contrat(p_id uuid, p_nom text, p_titre text) returns void
  language plpgsql security definer set search_path = public as
$$ begin
  if coalesce(trim(p_nom),'') = '' then raise exception 'nom requis'; end if;
  update public.cc_contrats set statut = 'signé', signe_le = now(), signe_nom = trim(p_nom), signe_titre = nullif(trim(p_titre),''), signe_par = auth.uid(), updated_at = now()
   where id = p_id and statut = 'envoyé' and client_id in (select public.pc_mes_entreprises());
  if not found then raise exception 'contrat introuvable ou déjà signé'; end if;
  update public.cc_publications set vu_le = coalesce(vu_le, now()), paye_vu = false where contrat_id = p_id;
end $$;

-- Échéancier du cabinet
alter table public.cc_clients add column if not exists spcc_dpe boolean not null default true; -- SPCC admissible à la DPE : solde fédéral à 3 mois (Québec : toujours 2 mois)
create table if not exists public.cc_echeances (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.cc_clients(id) on delete cascade,
  cle       text not null,           -- ex. tps:2026-09-30, t2:2026-12-31, soldeqc:2026-12-31
  fait_le   timestamptz not null default now(),
  par       text,
  note      text,
  unique (client_id, cle)
);
alter table public.cc_echeances enable row level security;
drop policy if exists cc_ech_cabinet on public.cc_echeances;
create policy cc_ech_cabinet on public.cc_echeances for all using (public.tl_est_membre()) with check (public.tl_est_membre());
