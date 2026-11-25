# Tenue de livres du cabinet : installer la version site web

Ce dossier contient le même logiciel que l'application dans Claude, mais pour l'héberger vous-mêmes :
- votre adresse web, par exemple `https://livres.votrecabinet.ca` ;
- votre propre connexion (courriel + mot de passe) pour chaque membre de l'équipe ;
- votre base de données, hébergée au Canada ;
- votre propre clé d'API Anthropic pour l'IA.

Temps d'installation : environ 45 minutes, sans programmer. Vous allez seulement copier-coller.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `public/index.html`, `public/app.js` | Le logiciel (écrans et calculs) |
| `public/cloud.js` | Connexion, base de données, IA, téléchargements, dictée |
| `public/config.js` | **Seul fichier à modifier** : l'adresse et la clé publique de votre base |
| `supabase/schema.sql` | Création de la base de données, de la sécurité et de l'historique des modifications |
| `supabase/functions/tl-ai/index.ts` | Fonction serveur qui appelle l'IA. La clé d'API reste sur le serveur, jamais dans le navigateur. |
| `build.py` | Pour reconstruire `app.js` quand le logiciel est mis à jour |

---

## Vous avez déjà un projet Supabase ?

Vous pouvez l'utiliser. Tout ce que crée ce logiciel est préfixé **`tl_`** (tables `tl_docs`, `tl_membres`, `tl_invitations`, `tl_docs_historique`, fonction `tl-ai`, déclencheur `tl_on_auth_user_created`) : rien ne touche à votre autre application.

À savoir dans ce cas :
- **Région :** les données des clients seront dans la région de ce projet. Pour la Loi 25, vérifiez qu'elle est au Canada (Project Settings > General).
- **Comptes :** les utilisateurs sont partagés entre les deux applications. Un utilisateur de votre autre application ne voit **aucune** donnée comptable tant qu'il n'est pas invité dans `tl_invitations` ou membre dans `tl_membres`.
- **Courriels de connexion :** l'« URL du site » dans Authentication > URL Configuration est celle de votre autre application. Ajoutez seulement l'adresse du site comptable dans **Redirect URLs**, sans changer le reste.
- **Clé Anthropic :** si votre autre application a déjà un secret `ANTHROPIC_API_KEY`, la fonction `tl-ai` l'utilisera aussi. Pour séparer les coûts, créez une clé distincte et utilisez un projet séparé.
- **Sauvegardes et accès administrateur** sont communs aux deux applications. Pour des données de clients d'un cabinet, **un projet séparé reste l'option la plus propre** (le plan gratuit permet 2 projets).

Dans ce cas, passez l'étape 1 et commencez à l'étape 2 dans votre projet existant.

## Étape 1 : créer la base de données (Supabase)

1. Allez sur **supabase.com**, puis « Start your project ». Créez un compte.
2. Cliquez sur **New project** :
   - **Name** : par exemple `tenue-livres` ;
   - **Database password** : générez-en un et gardez-le en lieu sûr ;
   - **Region** : **Canada (Central)**, pour garder les données au Canada (Loi 25).
3. Attendez environ 2 minutes que le projet soit prêt.

## Étape 2 : créer les tables et la sécurité

1. Dans Supabase, menu de gauche : **SQL Editor**, puis **New query**.
2. Ouvrez `supabase/schema.sql`, copiez **tout** son contenu, collez-le et cliquez sur **Run**. Vous devez voir « Success ».
3. Nouvelle requête : déclarez-vous administrateur, avec **votre** courriel :
   ```sql
   insert into public.tl_invitations (email, role) values ('vous@votrecabinet.ca', 'admin');
   ```
   Cliquez sur **Run**.

## Étape 3 : obtenir une clé d'API Anthropic

1. Allez sur **console.anthropic.com** et créez un compte pour le cabinet.
2. Dans **Billing**, ajoutez un moyen de paiement et un peu de crédit. Pour commencer, 20 $ US suffisent largement.
3. Dans **API Keys**, cliquez sur **Create Key**, nommez-la `tenue-livres`, puis **copiez la clé**. Elle commence par `sk-ant-` et ne s'affiche qu'une fois.
4. Conseil : dans **Limits**, fixez une limite de dépenses mensuelle.

## Étape 4 : installer la fonction IA

1. Dans Supabase, menu de gauche : **Edge Functions**, puis **Deploy a new function** et **Via Editor**.
2. Nom de la fonction : **`tl-ai`** (exactement).
3. Effacez le code d'exemple, puis copiez-collez **tout** le code ci-dessous (il doit finir par `});`). Cliquez sur **Deploy function**.

```ts
// Fonction serveur « tl-ai » : reçoit une demande de l'application, vérifie que l'utilisateur
// est membre du cabinet, puis appelle l'API d'Anthropic avec la clé gardée sur le serveur.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODELES: Record<string, string> = {
  quick: "claude-haiku-5-5",
  default: "claude-sonnet-5-5",
  complex: "claude-opus-5-5",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "non connecté" }, 401);
    const { data: membre } = await sb.from("tl_membres").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!membre) return json({ error: "non autorisé" }, 403);

    const { prompt, images = [], tier = "default" } = await req.json();
    if (!prompt || typeof prompt !== "string") return json({ error: "demande vide" }, 400);
    const content: unknown[] = images.slice(0, 5).map((i: { media_type: string; data: string }) => ({
      type: "image", source: { type: "base64", media_type: i.media_type, data: i.data },
    }));
    content.push({ type: "text", text: prompt.slice(0, 200000) });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("MODELE_" + tier.toUpperCase()) || MODELES[tier] || MODELES.default,
        max_tokens: 16000,
        messages: [{ role: "user", content }],
      }),
    });
    if (r.status === 429) return json({ error: "limite atteinte" }, 429);
    if (!r.ok) return json({ error: "API Anthropic : " + (await r.text()).slice(0, 300) }, 502);
    const out = await r.json();
    const text = (out.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return json({ text, truncated: out.stop_reason === "max_tokens" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```
4. Toujours dans Edge Functions : onglet **Secrets**, puis **Add new secret** :
   - Name : `ANTHROPIC_API_KEY`
   - Value : la clé copiée à l'étape 3

   Enregistrez.

## Étape 5 : configurer le site

1. Dans Supabase : **Project Settings**, puis **API**. Copiez :
   - **Project URL** (`https://xxxxx.supabase.co`) ;
   - la clé **anon public**.
2. Ouvrez `public/config.js` avec le Bloc-notes et remplacez les deux valeurs :
   ```js
   SUPABASE_URL: 'https://xxxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   NOM_CABINET: 'Nom de votre cabinet'
   ```
   La clé « anon public » peut être visible dans le site : la sécurité est faite par la base, qui refuse tout à qui n'est pas membre. **Ne mettez jamais la clé Anthropic dans ce fichier.**

## Étape 6 : mettre le site en ligne (Netlify, gratuit)

1. Allez sur **netlify.com** et créez un compte.
2. **Add new site**, puis **Deploy manually**.
3. Glissez-déposez **le dossier `public`** au complet dans la zone.
4. Netlify vous donne une adresse, par exemple `https://tenue-livres-123.netlify.app`. Dans **Site configuration**, puis **Change site name**, vous pouvez la renommer. Dans **Domain management**, vous pouvez brancher votre propre domaine.
5. De retour dans Supabase : **Authentication**, puis **URL Configuration** :
   - **Site URL** : l'adresse Netlify ou votre domaine ;
   - **Redirect URLs** : ajoutez la même adresse.

## Étape 7 : première connexion

1. Ouvrez votre site.
2. Entrez **le courriel déclaré administrateur à l'étape 2** et choisissez un mot de passe d'au moins 8 caractères, puis cliquez sur **« Première connexion : créer mon mot de passe »**.
3. Si Supabase envoie un courriel de confirmation, ouvrez-le, puis revenez vous connecter.
   Pour vous en passer : Supabase, puis Authentication, puis Providers, puis Email, et décochez « Confirm email ».
4. Vous arrivez au répertoire des dossiers.

## Étape 8 : transférer vos dossiers depuis Claude

1. Dans l'application dans Claude, sur la page des dossiers, section **Sauvegarde et transfert** : cliquez sur **Exporter tous les dossiers**. Un fichier `.json` est téléchargé.
2. Sur votre site, même section : **Importer un fichier de sauvegarde**, puis choisissez ce fichier.
3. Tous les dossiers, règles, périodes, écritures et factures sont transférés.

## Étape 9 : inviter l'équipe

Pour chaque collègue, dans Supabase, SQL Editor :
```sql
insert into public.tl_invitations (email) values ('collegue@votrecabinet.ca');
```
Le collègue ouvre le site, entre son courriel et un mot de passe, puis clique sur « Première connexion ». Il a accès tout de suite.
Toute personne qui n'est pas invitée voit seulement « Accès en attente », sans aucune donnée.

Pour retirer l'accès d'une personne :
```sql
delete from public.tl_membres where email = 'ancien@votrecabinet.ca';
```

---

## Coûts à prévoir

| Service | Coût |
|---|---|
| Netlify (site) | Gratuit |
| Supabase (base de données) | Gratuit pour commencer. Le plan Pro, à environ 25 $ US par mois, ajoute des sauvegardes quotidiennes et évite la mise en pause des projets inactifs. **Recommandé dès qu'il y a de vrais dossiers.** |
| API Anthropic (IA) | À l'usage : quelques sous à quelques dollars par dossier et par mois, selon le nombre de transactions et de factures. Fixez une limite mensuelle dans la console. |

## Sécurité, sauvegardes et responsabilités

- **Accès :** seuls les membres invités lisent ou modifient les données. Cette règle est appliquée par la base elle-même, pas seulement par l'écran.
- **Historique :** chaque modification ou suppression d'un document est conservée dans la table `tl_docs_historique` (ancienne valeur, auteur, date). Un administrateur peut la consulter dans Supabase.
- **Sauvegardes :** activez le plan Pro de Supabase, et faites aussi régulièrement un **Exporter tous les dossiers** que vous gardez sur votre serveur.
- **Loi 25 :** les données sont hébergées au Canada (région Canada Central). Les textes envoyés à l'IA (descriptions de transactions, factures) passent par l'API d'Anthropic. Consultez ses conditions de conservation des données et indiquez-le dans votre politique de confidentialité.
- **La clé d'API Anthropic** reste dans les secrets Supabase. Si elle est compromise, supprimez-la dans la console Anthropic et créez-en une nouvelle.

## Mettre à jour le logiciel

Quand le logiciel est amélioré (nouveau `index.html` de l'application Claude) :
```bash
python3 build.py chemin/vers/index.html
```
Puis glissez de nouveau le dossier `public` dans Netlify, sous **Deploys**. `config.js` et `cloud.js` ne changent pas.

## Ce qui diffère de la version Claude

- **Connexion :** courriel et mot de passe de votre cabinet, au lieu des comptes Claude.
- **Dictée au micro :** utilise la reconnaissance vocale de Chrome ou Edge.
- **IA :** utilise votre clé d'API. Modèles par défaut : `claude-sonnet-5-5` pour le classement et la lecture des factures, `claude-opus-5-5` pour la revue complète et les codes IGRF. Pour en changer, ajoutez les secrets `MODELE_DEFAULT`, `MODELE_COMPLEX` ou `MODELE_QUICK` dans Supabase.
- **Photos de factures :** formats JPG, PNG, WEBP et GIF. Les photos HEIC d'iPhone doivent être converties ; le plus simple est de régler l'appareil sur « Le plus compatible ».
