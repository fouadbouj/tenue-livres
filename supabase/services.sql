-- =====================================================================
-- Demandes de service : questionnaire en ligne dans le portail client
-- (constitution de société, fin d'exercice, paie, etc.)
-- À exécuter dans Supabase > SQL Editor APRÈS portail_entreprise.sql.
-- Peut être réexécuté sans risque.
-- =====================================================================

create table if not exists public.cc_services (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.cc_clients(id) on delete set null,   -- vide pour un futur client
  service    text not null,                                              -- incorporation, finexercice, paie…
  titre      text not null,
  courriel   text,
  contact    text,
  jeton      text not null unique default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  user_id    uuid references auth.users(id) on delete set null,          -- compte du portail qui remplit le questionnaire
  statut     text not null default 'envoyée' check (statut in ('envoyée','en cours','reçue','traitée','annulée')),
  reponses   jsonb not null default '{}'::jsonb,
  fichiers   jsonb not null default '[]'::jsonb,
  vu         boolean not null default false,                             -- le cabinet a ouvert les réponses
  ouvert_le  timestamptz,
  recu_le    timestamptz,
  traite_le  timestamptz,
  relance_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cc_services_user on public.cc_services(user_id);

alter table public.cc_services enable row level security;
drop policy if exists cc_svc_cabinet on public.cc_services;
drop policy if exists cc_svc_client on public.cc_services;
create policy cc_svc_cabinet on public.cc_services for all using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy cc_svc_client  on public.cc_services for select using (user_id = auth.uid());
-- Le client n'écrit jamais directement dans la table : il passe par les deux fonctions ci-dessous.

-- Le client ouvre le lien reçu par courriel : le questionnaire est rattaché à son compte du portail.
create or replace function public.pc_service_ouvrir(p_jeton text) returns uuid
  language plpgsql security definer set search_path = public as
$$ declare v uuid; begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  update public.cc_services
     set user_id = auth.uid(), ouvert_le = coalesce(ouvert_le, now()),
         statut = case when statut = 'envoyée' then 'en cours' else statut end
   where jeton = trim(p_jeton) and statut <> 'annulée' and (user_id is null or user_id = auth.uid())
  returning id into v;
  if v is null then raise exception 'lien invalide ou déjà utilisé par un autre compte'; end if;
  return v; end $$;

-- Le client enregistre ses réponses (brouillon) ou envoie le questionnaire au cabinet.
create or replace function public.pc_service_enregistrer(p_id uuid, p_reponses jsonb, p_fichiers jsonb, p_envoyer boolean) returns void
  language plpgsql security definer set search_path = public as
$$ begin
  update public.cc_services
     set reponses = coalesce(p_reponses, reponses), fichiers = coalesce(p_fichiers, fichiers),
         statut = case when p_envoyer then 'reçue' else 'en cours' end,
         recu_le = case when p_envoyer then now() else recu_le end,
         vu = case when p_envoyer then false else vu end, updated_at = now()
   where id = p_id and user_id = auth.uid() and statut in ('envoyée','en cours');
  if not found then raise exception 'questionnaire introuvable ou déjà envoyé'; end if; end $$;

-- Stockage : les pièces vont dans s/<id du questionnaire>/…  (le cabinet y a déjà accès par doc_cabinet)
drop policy if exists doc_svc_ajout on storage.objects;
drop policy if exists doc_svc_lire on storage.objects;
drop policy if exists doc_svc_suppr on storage.objects;
create policy doc_svc_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 's'
              and (storage.foldername(name))[2] in (select id::text from public.cc_services where user_id = auth.uid() and statut in ('envoyée','en cours')));
create policy doc_svc_lire on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 's'
         and (storage.foldername(name))[2] in (select id::text from public.cc_services where user_id = auth.uid()));
create policy doc_svc_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 's'
         and (storage.foldername(name))[2] in (select id::text from public.cc_services where user_id = auth.uid() and statut in ('envoyée','en cours')));
