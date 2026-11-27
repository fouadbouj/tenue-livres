-- Droits appliqués par la base de données (et pas seulement à l'écran) :
-- les dossiers de mission de compilation ne peuvent être créés, modifiés ou supprimés que par un CPA (rôle admin).
-- Tous les membres continuent de tout lire et de travailler normalement dans le reste des dossiers.
-- À exécuter une fois dans l'éditeur SQL de Supabase (sans danger si relancé).
drop policy if exists tl_docs_ajouter   on public.tl_docs;
drop policy if exists tl_docs_modifier  on public.tl_docs;
drop policy if exists tl_docs_supprimer on public.tl_docs;
create policy tl_docs_ajouter on public.tl_docs for insert
  with check (public.tl_est_membre() and (coll not like 'clients/%/missions' or public.tl_est_admin()));
create policy tl_docs_modifier on public.tl_docs for update
  using (public.tl_est_membre() and (coll not like 'clients/%/missions' or public.tl_est_admin()))
  with check (public.tl_est_membre() and (coll not like 'clients/%/missions' or public.tl_est_admin()));
create policy tl_docs_supprimer on public.tl_docs for delete
  using (public.tl_est_membre() and (coll not like 'clients/%/missions' or public.tl_est_admin()));
