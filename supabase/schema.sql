-- =====================================================================
--  Tenue de livres du cabinet (tables préfixées « tl_ » : sans conflit avec une autre application
--  dans le même projet Supabase) : base de données (Supabase / Postgres)
--  À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- =====================================================================

-- 1. Membres du cabinet (qui a le droit d'entrer)
create table if not exists public.tl_membres (
  user_id    uuid primary key references auth.users on delete cascade,
  email      text not null,
  role       text not null default 'membre' check (role in ('admin','membre')),
  created_at timestamptz not null default now()
);

-- 2. Invitations : un courriel invité devient membre à sa première connexion
create table if not exists public.tl_invitations (
  email      text primary key,
  role       text not null default 'membre' check (role in ('admin','membre')),
  created_at timestamptz not null default now()
);

-- 3. Tous les documents du logiciel (dossiers clients, périodes, écritures, factures)
create table if not exists public.tl_docs (
  coll       text not null,             -- ex. « clients » ou « clients/<id>/periodes »
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (coll, id)
);

-- 4. Historique : chaque modification ou suppression est conservée (piste de vérification)
create table if not exists public.tl_docs_historique (
  hist_id    bigserial primary key,
  coll       text not null,
  id         text not null,
  action     text not null,
  ancien     jsonb,
  par        uuid,
  le         timestamptz not null default now()
);

create or replace function public.tl_est_membre() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tl_membres where user_id = auth.uid())
$$;
create or replace function public.tl_est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tl_membres where user_id = auth.uid() and role = 'admin')
$$;

-- Nouvel utilisateur invité => membre automatiquement
create or replace function public.tl_accueillir_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.tl_membres (user_id, email, role)
  select new.id, new.email, i.role from public.tl_invitations i where lower(i.email) = lower(new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists tl_on_auth_user_created on auth.users;
create trigger tl_on_auth_user_created after insert on auth.users
  for each row execute function public.tl_accueillir_invite();

-- Historique automatique
create or replace function public.tl_historiser() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.tl_docs_historique (coll, id, action, ancien, par)
  values (old.coll, old.id, tg_op, old.data, auth.uid());
  return coalesce(new, old);
end $$;
drop trigger if exists tl_docs_hist on public.tl_docs;
create trigger tl_docs_hist before update or delete on public.tl_docs
  for each row execute function public.tl_historiser();

-- Sécurité : seuls les membres lisent et écrivent
alter table public.tl_docs enable row level security;
alter table public.tl_membres enable row level security;
alter table public.tl_invitations enable row level security;
alter table public.tl_docs_historique enable row level security;

drop policy if exists tl_docs_lire on public.tl_docs;
drop policy if exists tl_docs_ajouter on public.tl_docs;
drop policy if exists tl_docs_modifier on public.tl_docs;
drop policy if exists tl_docs_supprimer on public.tl_docs;
create policy tl_docs_lire      on public.tl_docs for select using (public.tl_est_membre());
create policy tl_docs_ajouter   on public.tl_docs for insert with check (public.tl_est_membre());
create policy tl_docs_modifier  on public.tl_docs for update using (public.tl_est_membre()) with check (public.tl_est_membre());
create policy tl_docs_supprimer on public.tl_docs for delete using (public.tl_est_membre());

drop policy if exists tl_membres_lire on public.tl_membres;
drop policy if exists tl_membres_admin on public.tl_membres;
create policy tl_membres_lire  on public.tl_membres for select using (public.tl_est_membre());
create policy tl_membres_admin on public.tl_membres for all using (public.tl_est_admin()) with check (public.tl_est_admin());

drop policy if exists tl_invit_admin on public.tl_invitations;
create policy tl_invit_admin on public.tl_invitations for all using (public.tl_est_admin()) with check (public.tl_est_admin());

drop policy if exists tl_hist_admin on public.tl_docs_historique;
create policy tl_hist_admin on public.tl_docs_historique for select using (public.tl_est_admin());

-- Mises à jour en direct entre collègues
do $$ begin
  alter publication supabase_realtime add table public.tl_docs;
exception when duplicate_object then null; end $$;

-- =====================================================================
--  5. PREMIER ADMINISTRATEUR : remplacez le courriel puis exécutez.
--     (À faire AVANT de créer votre compte sur le site.)
-- =====================================================================
-- insert into public.tl_invitations (email, role) values ('vous@votrecabinet.ca', 'admin');

--  Inviter un collègue plus tard :
-- insert into public.tl_invitations (email) values ('collegue@votrecabinet.ca');
