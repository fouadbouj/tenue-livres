-- =====================================================================
-- Portail client (impôts personnels) et Centre clients (rappels TPS/TVQ)
-- À exécuter UNE fois dans Supabase > SQL Editor (après schema.sql).
-- =====================================================================

-- ---------- Portail client ----------
-- Dossier permanent du client (renseignements repris d'une année à l'autre)
create table if not exists public.pc_dossiers (
  user_id    uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  courriel   text,
  profil     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- Une soumission par année d'imposition (formulaire + documents)
create table if not exists public.pc_soumissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  annee       int  not null,
  type        text not null check (type in ('nouveau','existant')),
  formulaire  jsonb not null default '{}'::jsonb,
  fichiers    jsonb not null default '[]'::jsonb,
  statut      text not null default 'brouillon' check (statut in ('brouillon','reçue','en traitement','terminée')),
  note_cabinet text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, annee)
);

alter table public.pc_dossiers    enable row level security;
alter table public.pc_soumissions enable row level security;

drop policy if exists pc_dos_client on public.pc_dossiers;
drop policy if exists pc_dos_cabinet on public.pc_dossiers;
create policy pc_dos_client  on public.pc_dossiers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pc_dos_cabinet on public.pc_dossiers for select using (public.tl_est_membre());

drop policy if exists pc_sou_lire on public.pc_soumissions;
drop policy if exists pc_sou_creer on public.pc_soumissions;
drop policy if exists pc_sou_client_maj on public.pc_soumissions;
drop policy if exists pc_sou_cabinet on public.pc_soumissions;
create policy pc_sou_lire  on public.pc_soumissions for select using (user_id = auth.uid() or public.tl_est_membre());
create policy pc_sou_creer on public.pc_soumissions for insert with check (user_id = auth.uid() and statut in ('brouillon','reçue'));
-- le client peut modifier sa soumission tant qu'elle est en brouillon, puis l'envoyer (reçue)
create policy pc_sou_client_maj on public.pc_soumissions for update
  using (user_id = auth.uid() and statut = 'brouillon') with check (user_id = auth.uid() and statut in ('brouillon','reçue'));
create policy pc_sou_cabinet on public.pc_soumissions for update using (public.tl_est_membre()) with check (public.tl_est_membre());

-- ---------- Centre clients ----------
create table if not exists public.cc_clients (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  contact     text,
  courriel    text,
  frequence   text not null default 'trimestrielle' check (frequence in ('mensuelle','trimestrielle','annuelle')),
  fin_exercice text not null default '12-31',          -- mm-jj : fin d'exercice (cale les trimestres et l'année)
  depuis      date not null default current_date,       -- première période à suivre
  documents   text not null default 'Relevés bancaires et de cartes de crédit, factures de ventes et factures d''achats de la période.',
  actif       boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);
create table if not exists public.cc_demandes (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.cc_clients(id) on delete cascade,
  periode       text not null,                     -- ex. 2026-T3, 2026-10, 2026
  debut         date not null,
  fin           date not null,
  echeance      date,                              -- date limite de production TPS/TVQ
  jeton         text not null unique default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  statut        text not null default 'à envoyer' check (statut in ('à envoyer','envoyée','reçue','apportée au bureau','annulée')),
  rappels       int not null default 0,
  dernier_rappel timestamptz,
  recu_le       timestamptz,
  fichiers      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  unique (client_id, periode)
);
alter table public.cc_clients  enable row level security;
alter table public.cc_demandes enable row level security;
drop policy if exists cc_cli_cabinet on public.cc_clients;
drop policy if exists cc_dem_cabinet on public.cc_demandes;
create policy cc_cli_cabinet on public.cc_clients  for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_dem_cabinet on public.cc_demandes for all using (public.tl_est_membre()) with check (public.tl_est_membre());
-- Les clients qui déposent par lien ne touchent jamais ces tables : la fonction cc-depot vérifie le jeton.

-- ---------- Stockage des documents (privé) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents','documents', false, 26214400)          -- 25 Mo par fichier
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Chemins :  p/<user_id>/<année>/<fichier>   (portail client)
--            c/<client_id>/<demande_id>/<fichier>  (Centre clients, déposé par la fonction cc-depot)
drop policy if exists doc_client_ajout on storage.objects;
drop policy if exists doc_client_lire on storage.objects;
drop policy if exists doc_client_suppr on storage.objects;
drop policy if exists doc_cabinet on storage.objects;
create policy doc_client_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'p' and (storage.foldername(name))[2] = auth.uid()::text);
create policy doc_client_lire on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'p' and (storage.foldername(name))[2] = auth.uid()::text);
create policy doc_client_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'p' and (storage.foldername(name))[2] = auth.uid()::text
         and exists (select 1 from public.pc_soumissions s where s.user_id = auth.uid() and s.annee::text = (storage.foldername(name))[3] and s.statut = 'brouillon'));
create policy doc_cabinet on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.tl_est_membre()) with check (bucket_id = 'documents' and public.tl_est_membre());

-- ---------- Rappels automatiques (tous les jours à 9 h, heure de Montréal ≈ 13 h UTC) ----------
-- 1) Database > Extensions : activez pg_cron et pg_net.
-- 2) Remplacez VOTRE-PROJET et VOTRE-SECRET (le même secret que CRON_SECRET dans les secrets des fonctions), puis exécutez :
-- select cron.schedule('cc-rappels', '0 13 * * *', $$
--   select net.http_post(
--     url := 'https://VOTRE-PROJET.supabase.co/functions/v1/cc-rappels',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','VOTRE-SECRET'),
--     body := '{"auto":true}'::jsonb);
-- $$);
