-- Documents à faire signer par le client (ex. procuration MR-69) : publication avec signature électronique dans le portail.
-- À exécuter une fois dans l'éditeur SQL de Supabase (sans danger si relancé).
alter table public.cc_publications add column if not exists signature_requise boolean not null default false;
alter table public.cc_publications add column if not exists signe_le      timestamptz;
alter table public.cc_publications add column if not exists signe_nom     text;
alter table public.cc_publications add column if not exists signe_titre   text;
alter table public.cc_publications add column if not exists signe_fichier jsonb;
alter table public.cc_publications add column if not exists signe_vu      boolean not null default true;

create or replace function public.pc_signer_document(p_id uuid, p_nom text, p_titre text, p_fichier jsonb) returns void
  language plpgsql security definer set search_path = public as
$$ begin
  if coalesce(trim(p_nom),'') = '' then raise exception 'nom requis'; end if;
  update public.cc_publications
     set signe_le = now(), signe_nom = trim(p_nom), signe_titre = nullif(trim(coalesce(p_titre,'')),''), signe_fichier = p_fichier,
         signe_vu = false, vu_le = coalesce(vu_le, now())
   where id = p_id and signature_requise and signe_le is null and client_id in (select public.pc_mes_entreprises());
  if not found then raise exception 'document introuvable ou déjà signé'; end if;
end $$;
grant execute on function public.pc_signer_document(uuid, text, text, jsonb) to authenticated;
