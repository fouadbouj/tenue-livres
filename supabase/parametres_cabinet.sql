-- Paramètres du cabinet (Intranet › Paramètres) : seuls les administrateurs (CPA) peuvent modifier l'identité du cabinet.
-- Les autres paramètres (facturation, modèles, etc.) restent modifiables par tous les membres.
drop policy if exists cc_par_cabinet on public.cc_parametres;
create policy cc_par_cabinet on public.cc_parametres for all
  using (public.tl_est_membre())
  with check (public.tl_est_membre() and (cle <> 'cabinet' or public.tl_est_admin()));
