// Fonction serveur « cc-depot » : dépôt sécurisé de documents par lien (Centre clients), sans compte.
// Le client reçoit un lien avec un jeton secret; la fonction vérifie le jeton, donne une URL de téléversement
// signée et à usage unique, puis marque la demande comme reçue. Les fichiers vont dans le stockage privé « documents ».
// À déployer SANS vérification JWT (le client n'est pas connecté) : Edge Functions > cc-depot > Enforce JWT verification = off.
// Secret facultatif : NOTIF_CABINET (courriel du cabinet à avertir) avec RESEND_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const EXT = /\.(pdf|jpe?g|png|heic|heif|webp|csv|xlsx?|docx?|txt|ofx|qbo|zip)$/i;
const MAX = 25 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, jeton, nom, taille, fichiers } = await req.json();
    if (typeof jeton !== "string" || !/^[0-9a-f]{32,128}$/.test(jeton)) return json({ error: "lien invalide" }, 400);
    const { data: d } = await admin.from("cc_demandes").select("id, client_id, periode, debut, fin, echeance, statut, fichiers, cc_clients(nom, documents)").eq("jeton", jeton).maybeSingle();
    if (!d || d.statut === "annulée") return json({ error: "lien invalide ou expiré" }, 404);

    if (action === "info") {
      return json({ client: d.cc_clients?.nom, debut: d.debut, fin: d.fin, echeance: d.echeance, statut: d.statut, documents: d.cc_clients?.documents, nb: (d.fichiers || []).length });
    }
    if (action === "url") {
      if (typeof nom !== "string" || !EXT.test(nom)) return json({ error: "type de fichier non accepté" }, 400);
      if (!(taille > 0 && taille <= MAX)) return json({ error: "fichier trop gros (25 Mo au maximum)" }, 400);
      const sur = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `c/${d.client_id}/${d.id}/${Date.now()}-${sur}`;
      const { data, error } = await admin.storage.from("documents").createSignedUploadUrl(path);
      if (error) return json({ error: error.message }, 500);
      return json({ path, token: data.token });
    }
    if (action === "fini") {
      const L = (Array.isArray(fichiers) ? fichiers : []).filter((f: { path: string }) => typeof f?.path === "string" && f.path.startsWith(`c/${d.client_id}/${d.id}/`))
        .map((f: { path: string; nom: string; taille: number }) => ({ path: f.path, nom: String(f.nom || "").slice(0, 200), taille: +f.taille || 0, le: new Date().toISOString() }));
      if (!L.length) return json({ error: "aucun fichier" }, 400);
      await admin.from("cc_demandes").update({ fichiers: [...(d.fichiers || []), ...L], statut: "reçue", recu_le: new Date().toISOString() }).eq("id", d.id);
      const key = Deno.env.get("RESEND_API_KEY"), to = Deno.env.get("NOTIF_CABINET");
      if (key && to) {
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: Deno.env.get("COURRIEL_EXPEDITEUR") || "Boujrad CPA Inc. <comptabilite@boujradcpa.com>", to: [to],
            subject: `Documents reçus : ${d.cc_clients?.nom} (${d.debut} au ${d.fin})`, text: `${L.length} document(s) déposé(s) dans le Centre clients.` }),
        }).catch(() => {});
      }
      return json({ ok: true, nb: L.length });
    }
    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
