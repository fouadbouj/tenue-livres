-- =====================================================================
-- Portail client — espace Entreprise
-- À exécuter dans Supabase > SQL Editor APRÈS portail_centre.sql.
-- Un client du portail voit une entreprise seulement après avoir entré le code
-- d'invitation que le cabinet lui a remis (Centre clients > client > Accès au portail).
-- =====================================================================

create table if not exists public.cc_acces (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.cc_clients(id) on delete cascade,
  courriel  text,
  code      text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  user_id   uuid references auth.users(id) on delete set null,
  joint_le  timestamptz,
  created_at timestamptz not null default now()
);
-- Documents publiés par le cabinet (déclaration de taxes, avis de paiement, états financiers…)
create table if not exists public.cc_publications (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.cc_clients(id) on delete cascade,
  titre       text not null,
  type        text not null default 'Déclaration TPS/TVQ',
  periode     text,
  montant     numeric(12,2),
  echeance    date,
  code_paiement text,
  instructions text,
  fichiers    jsonb not null default '[]'::jsonb,
  vu_le       timestamptz,
  paye_le     timestamptz,
  created_at  timestamptz not null default now()
);
-- Messages entre le client et le cabinet (avec pièces jointes)
create table if not exists public.cc_messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.cc_clients(id) on delete cascade,
  auteur     text not null check (auteur in ('client','cabinet')),
  user_id    uuid default auth.uid(),
  texte      text not null default '',
  fichiers   jsonb not null default '[]'::jsonb,
  lu         boolean not null default false,
  created_at timestamptz not null default now()
);

-- Avis et suivi des paiements (ajout du 25 novembre 2026 : peut être réexécuté sans risque)
alter table public.cc_publications add column if not exists organisme   text not null default 'Revenu Québec'; -- Revenu Québec, ARC ou Aucun paiement
alter table public.cc_publications add column if not exists periode_fin date;        -- fin de la période (sert à regrouper le suivi des paiements)
alter table public.cc_publications add column if not exists avise_le    timestamptz; -- courriel envoyé au client
alter table public.cc_publications add column if not exists rappel_le   timestamptz; -- rappel avant la date limite
alter table public.cc_publications add column if not exists paye_vu     boolean not null default false; -- le cabinet a vu la confirmation de paiement

-- Entreprises auxquelles l'utilisateur connecté a accès
create or replace function public.pc_mes_entreprises() returns setof uuid
  language sql stable security definer set search_path = public as
$$ select client_id from public.cc_acces where user_id = auth.uid() $$;

-- Lier son compte à une entreprise avec le code d'invitation
create or replace function public.pc_rejoindre(p_code text) returns text
  language plpgsql security definer set search_path = public as
$$ declare v uuid; n text; begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  update public.cc_acces set user_id = auth.uid(), joint_le = now()
   where code = upper(trim(p_code)) and (user_id is null or user_id = auth.uid()) returning client_id into v;
  if v is null then raise exception 'code invalide ou déjà utilisé'; end if;
  select nom into n from public.cc_clients where id = v; return n; end $$;

-- Le client marque une demande de documents comme déposée
create or replace function public.pc_depot_fini(p_demande uuid, p_fichiers jsonb) returns void
  language plpgsql security definer set search_path = public as
$$ declare d record; begin
  select * into d from public.cc_demandes where id = p_demande and client_id in (select public.pc_mes_entreprises());
  if d.id is null then raise exception 'demande introuvable'; end if;
  update public.cc_demandes set fichiers = fichiers || coalesce(p_fichiers,'[]'::jsonb), statut = 'reçue', recu_le = now() where id = d.id; end $$;

-- Le client indique qu'il a vu ou payé un document du cabinet
create or replace function public.pc_publication(p_id uuid, p_action text) returns void
  language plpgsql security definer set search_path = public as
$$ begin
  if p_action = 'vu' then update public.cc_publications set vu_le = coalesce(vu_le, now()) where id = p_id and client_id in (select public.pc_mes_entreprises());
  elsif p_action = 'payé' then update public.cc_publications set paye_le = now(), paye_vu = false, vu_le = coalesce(vu_le, now()) where id = p_id and client_id in (select public.pc_mes_entreprises());
  elsif p_action = 'non payé' then update public.cc_publications set paye_le = null, paye_vu = false where id = p_id and client_id in (select public.pc_mes_entreprises());
  end if; end $$;

alter table public.cc_acces        enable row level security;
alter table public.cc_publications enable row level security;
alter table public.cc_messages     enable row level security;

drop policy if exists cc_acc_cabinet on public.cc_acces;
drop policy if exists cc_acc_moi on public.cc_acces;
create policy cc_acc_cabinet on public.cc_acces for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_acc_moi     on public.cc_acces for select using (user_id = auth.uid());

drop policy if exists cc_pub_cabinet on public.cc_publications;
drop policy if exists cc_pub_client on public.cc_publications;
create policy cc_pub_cabinet on public.cc_publications for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_pub_client  on public.cc_publications for select using (client_id in (select public.pc_mes_entreprises()));

drop policy if exists cc_msg_cabinet on public.cc_messages;
drop policy if exists cc_msg_lire on public.cc_messages;
drop policy if exists cc_msg_ecrire on public.cc_messages;
create policy cc_msg_cabinet on public.cc_messages for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_msg_lire    on public.cc_messages for select using (client_id in (select public.pc_mes_entreprises()));
create policy cc_msg_ecrire  on public.cc_messages for insert with check (client_id in (select public.pc_mes_entreprises()) and auteur = 'client' and user_id = auth.uid());

-- Le client voit son entreprise et ses demandes de documents
drop policy if exists cc_cli_client on public.cc_clients;
drop policy if exists cc_dem_client on public.cc_demandes;
create policy cc_cli_client on public.cc_clients  for select using (id in (select public.pc_mes_entreprises()));
create policy cc_dem_client on public.cc_demandes for select using (client_id in (select public.pc_mes_entreprises()));

-- Stockage : le client dépose et lit dans c/<son entreprise>/ (y compris c/<entreprise>/cabinet/ pour les documents publiés)
drop policy if exists doc_ent_ajout on storage.objects;
drop policy if exists doc_ent_lire on storage.objects;
create policy doc_ent_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'c'
              and (storage.foldername(name))[2] in (select x::text from public.pc_mes_entreprises() x)
              and (storage.foldername(name))[3] <> 'cabinet');
create policy doc_ent_lire on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'c'
         and (storage.foldername(name))[2] in (select x::text from public.pc_mes_entreprises() x));

-- Rappel automatique aux clients qui n'ont pas confirmé leur paiement (5 jours avant la date limite), chaque matin.
-- À exécuter une fois pg_cron et pg_net activés (remplacer <PROJET> et <CRON_SECRET>) :
-- select cron.schedule('cc-avis-rappels', '0 13 * * *', $$
--   select net.http_post(url := 'https://<PROJET>.supabase.co/functions/v1/cc-avis',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb, body := '{"action":"rappels"}'::jsonb) $$);
