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

## Portail client et Centre clients
- `public/portail.html` : les clients créent leur compte, remplissent le formulaire (nouveau ou existant) et déposent leurs documents d'impôt.
- `public/centre.html` : l'équipe gère les clients TPS/TVQ, les rappels automatiques et les documents reçus, et consulte les dossiers du portail.
- Les rappels TPS/TVQ envoient vers le portail client (connexion obligatoire) ; la bonne période s'ouvre directement. Si l'entreprise n'a encore aucun compte lié, le courriel contient un code d'invitation.

Installation (une fois) :
1. Supabase → SQL Editor : exécuter `supabase/portail_centre.sql`, puis `supabase/portail_entreprise.sql`.
2. Edge Functions : créer `cc-rappels` et `cc-avis` (avis au client quand le cabinet publie un document à payer, avis au cabinet quand le client confirme son paiement, rappel 5 jours avant la date limite) avec le code des dossiers correspondants.
3. Secrets des fonctions : `RESEND_API_KEY`, `CRON_SECRET` (une phrase secrète au choix), facultatif `NOTIF_CABINET` (courriel du cabinet averti à chaque dépôt), `SITE_URL` = `https://app.boujradcpa.com`.
4. Database → Extensions : activer `pg_cron` et `pg_net`, puis exécuter la commande `cron.schedule` en bas de `portail_centre.sql` (avec l'adresse du projet et le secret).
5. Authentication → Sign In / Providers → Email : réactiver « Confirm email » est recommandé pour le portail (les clients confirment leur courriel).

### Rappel de paiement automatique
Après pg_cron et pg_net, exécuter la commande `cron.schedule('cc-avis-rappels', …)` qui se trouve en commentaire à la fin de `supabase/portail_entreprise.sql`. Les avis au cabinet partent vers `NOTIF_CABINET` s'il est défini ; sinon, la notification apparaît seulement dans l'onglet Paiements du Centre clients.
