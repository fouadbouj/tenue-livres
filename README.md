# Intranet Boujrad CPA Inc.

- `src/index.html` : le logiciel (source unique)
- `build.py` : génère `public/index.html` et `public/app.js` → `python3 build.py src/index.html`
- `public/` : ce que Netlify publie (`config.js` = URL Supabase + clé publique seulement)
- `supabase/` : schéma SQL et fonction IA (la clé Anthropic reste dans les secrets Supabase, jamais ici)

## Envoi de courriels aux clients (facultatif)
La fonction `supabase/functions/tl-email` envoie les demandes de précisions par Resend.
1. Créer un compte sur resend.com, ajouter le domaine `boujradcpa.com` (enregistrements DNS fournis par Resend).
2. Supabase → Edge Functions → créer `tl-email` avec le code du fichier.
3. Supabase → Edge Functions → Secrets : `RESEND_API_KEY` (clé Resend) et, au besoin, `COURRIEL_EXPEDITEUR` (ex. `Boujrad CPA Inc. <comptabilite@boujradcpa.com>`).
Sans cette fonction, le bouton « Ouvrir dans ma messagerie » prépare le courriel dans Outlook ou Gmail.
