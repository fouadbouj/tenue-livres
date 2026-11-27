-- Identifiants du cabinet comme représentant (ARC / Revenu Québec), affichés aux clients connectés dans le portail.
-- À exécuter une fois dans l'éditeur SQL de Supabase (sans danger si relancé).
drop policy if exists cc_par_rep_lire on public.cc_parametres;
create policy cc_par_rep_lire on public.cc_parametres for select to authenticated using (cle = 'representant');
