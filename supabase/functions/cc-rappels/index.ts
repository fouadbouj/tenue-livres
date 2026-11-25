// Fonction serveur « cc-rappels » : rappels automatiques du Centre clients (TPS/TVQ).
// - Appel automatique quotidien (pg_cron) avec l'en-tête x-cron-secret = CRON_SECRET :
//   crée les demandes des périodes terminées et envoie le premier courriel, puis un rappel aux 7 jours (3 rappels au plus).
// - Appel manuel depuis l'intranet (membre connecté) : { demande_id } envoie le courriel tout de suite.
// Secrets requis : RESEND_API_KEY, CRON_SECRET. Facultatifs : COURRIEL_EXPEDITEUR, COURRIEL_REPONSE, SITE_URL.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const finMois = (y: number, m: number) => new Date(Date.UTC(y, m, 0)); // m : 1-12
const longue = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type Client = { id: string; nom: string; contact: string | null; courriel: string | null; frequence: string; fin_exercice: string; depuis: string; documents: string; actif: boolean };
type Periode = { periode: string; debut: string; fin: string; echeance: string };

// Périodes terminées d'un client, de « depuis » jusqu'à aujourd'hui
export function periodes(c: Client, aujourdhui: Date): Periode[] {
  const M = +c.fin_exercice.slice(0, 2) || 12, out: Periode[] = [];
  const pas = c.frequence === "mensuelle" ? 1 : c.frequence === "trimestrielle" ? 3 : 12;
  const dep = new Date(c.depuis + "T00:00:00Z");
  for (let y = dep.getUTCFullYear() - 1; y <= aujourdhui.getUTCFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      if (pas > 1 && ((m - M) % pas + pas) % pas !== 0) continue;
      const fin = finMois(y, m);
      if (fin >= aujourdhui || fin < dep) continue;
      const deb = new Date(Date.UTC(y, m - pas, 1));
      const ech = pas === 12 ? finMois(y, m + 3) : finMois(y, m + 1);
      const lettre = pas === 1 ? "M" : pas === 3 ? "T" : "A";
      out.push({ periode: `${lettre}-${iso(fin)}`, debut: iso(deb), fin: iso(fin), echeance: iso(ech) });
    }
  }
  return out;
}

async function envoyer(c: Client, d: { periode: string; debut: string; fin: string; echeance: string | null; jeton: string; rappels: number }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY manquante");
  const site = Deno.env.get("SITE_URL") || "https://app.boujradcpa.com";
  const lien = `${site}/depot.html?j=${d.jeton}`;
  const rappel = d.rappels > 0 ? "Rappel : " : "";
  const sujet = `${rappel}documents pour vos déclarations de TPS/TVQ — période du ${longue(d.debut)} au ${longue(d.fin)}`;
  const texte = `Bonjour${c.contact ? " " + c.contact : ""},

${d.rappels > 0 ? "Nous n'avons pas encore reçu vos documents. " : ""}Afin de préparer les déclarations de TPS et de TVQ de ${c.nom} pour la période du ${longue(d.debut)} au ${longue(d.fin)}${d.echeance ? ` (date limite de production : ${longue(d.echeance)})` : ""}, merci de nous transmettre :

${c.documents}

Téléversez-les en toute sécurité ici :
${lien}

Vous pouvez aussi les déposer à notre bureau : 220-672, boulevard des Laurentides, Laval (Québec) H7G 2V9.

Merci!

Boujrad CPA Inc.`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("COURRIEL_EXPEDITEUR") || "Boujrad CPA Inc. <comptabilite@boujradcpa.com>",
      to: [c.courriel], subject: sujet, text: texte,
      ...(Deno.env.get("COURRIEL_REPONSE") ? { reply_to: Deno.env.get("COURRIEL_REPONSE") } : {}),
    }),
  });
  if (!r.ok) throw new Error("Resend : " + (await r.text()).slice(0, 200));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      if (cron !== Deno.env.get("CRON_SECRET")) return json({ error: "secret invalide" }, 401);
    } else {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return json({ error: "non connecté" }, 401);
      const { data: m } = await sb.from("tl_membres").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!m) return json({ error: "non autorisé" }, 403);
    }

    // Envoi manuel d'une demande précise
    if (body.demande_id) {
      const { data: d } = await admin.from("cc_demandes").select("*, cc_clients(*)").eq("id", body.demande_id).single();
      if (!d) return json({ error: "demande introuvable" }, 404);
      if (!d.cc_clients?.courriel) return json({ error: "le client n'a pas de courriel" }, 400);
      await envoyer(d.cc_clients, d);
      await admin.from("cc_demandes").update({ statut: d.statut === "à envoyer" ? "envoyée" : d.statut, rappels: d.rappels + 1, dernier_rappel: new Date().toISOString() }).eq("id", d.id);
      return json({ ok: true });
    }

    // Tournée automatique
    const auj = new Date();
    const { data: clients } = await admin.from("cc_clients").select("*").eq("actif", true);
    let crees = 0, envoyes = 0;
    const erreurs: string[] = [];
    for (const c of (clients || []) as Client[]) {
      const recentes = periodes(c, auj).filter((p) => (auj.getTime() - new Date(p.fin).getTime()) / 864e5 <= 120);
      for (const p of recentes) {
        const { error } = await admin.from("cc_demandes").insert({ client_id: c.id, ...p }).select().maybeSingle();
        if (!error) crees++;
      }
      if (!c.courriel) continue;
      const { data: dem } = await admin.from("cc_demandes").select("*").eq("client_id", c.id).in("statut", ["à envoyer", "envoyée"]);
      for (const d of dem || []) {
        const jours = d.dernier_rappel ? (auj.getTime() - new Date(d.dernier_rappel).getTime()) / 864e5 : 999;
        if (d.statut === "envoyée" && (jours < 7 || d.rappels >= 4)) continue;
        try {
          await envoyer(c, d);
          await admin.from("cc_demandes").update({ statut: "envoyée", rappels: d.rappels + 1, dernier_rappel: auj.toISOString() }).eq("id", d.id);
          envoyes++;
        } catch (e) { erreurs.push(`${c.nom} : ${String(e)}`); }
      }
    }
    return json({ ok: true, crees, envoyes, erreurs });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
