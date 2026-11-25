// Fonction serveur « cc-avis » : avis par courriel liés aux documents publiés dans le portail client (espace Entreprise).
// - { action: "publication", publication_id } (membre du cabinet) : avise le client qu'un document ou un paiement l'attend.
// - { action: "paiement", publication_id } (client connecté au portail) : avise le cabinet (NOTIF_CABINET) qu'un client a payé.
// - { action: "rappels" } avec l'en-tête x-cron-secret : rappel 5 jours avant la date limite aux clients qui n'ont pas confirmé leur paiement.
// Secrets : RESEND_API_KEY, CRON_SECRET ; facultatifs : NOTIF_CABINET, COURRIEL_EXPEDITEUR, COURRIEL_REPONSE, SITE_URL.
// Le courriel au client ne contient ni le montant ni le code de paiement : le client les obtient dans son portail.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const longue = (d: string) => new Date(d.slice(0, 10) + "T12:00:00Z").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const money = (v: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(v);
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function courriel(to: string[], subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("service de courriel non configuré (RESEND_API_KEY)");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("COURRIEL_EXPEDITEUR") || "Boujrad CPA Inc. <comptabilite@boujradcpa.com>",
      to, subject, text,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;white-space:pre-wrap">${esc(text)}</div>`,
      ...(Deno.env.get("COURRIEL_REPONSE") ? { reply_to: Deno.env.get("COURRIEL_REPONSE") } : {}),
    }),
  });
  if (!r.ok) throw new Error("Resend : " + (await r.text()).slice(0, 200));
}

// Adresses du client : courriel de la fiche + personnes ayant un accès au portail
async function destinataires(admin: SupabaseClient, cli: { id: string; courriel: string | null }) {
  const set = new Set<string>();
  if (cli.courriel) set.add(cli.courriel.trim().toLowerCase());
  const { data: acc } = await admin.from("cc_acces").select("courriel,user_id").eq("client_id", cli.id);
  for (const a of acc || []) {
    if (a.courriel) set.add(a.courriel.trim().toLowerCase());
    if (a.user_id) { const { data } = await admin.auth.admin.getUserById(a.user_id); if (data?.user?.email) set.add(data.user.email.toLowerCase()); }
  }
  return [...set].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

// deno-lint-ignore no-explicit-any
function message(p: any, cli: any, rappel: boolean) {
  const site = Deno.env.get("SITE_URL") || "https://app.boujradcpa.com";
  const paie = p.montant > 0 && p.organisme !== "Aucun paiement";
  const quoi = p.titre + (p.periode ? ` (${p.periode})` : "");
  const sujet = paie
    ? `${rappel ? "Rappel : " : ""}${p.titre} — paiement à faire${p.echeance ? " avant le " + longue(p.echeance) : ""}`
    : `Nouveau document dans votre portail client : ${p.titre}`;
  const texte = `Bonjour${cli.contact ? " " + cli.contact : ""},

${paie
  ? `${rappel ? "Petit rappel : nous n'avons pas encore reçu votre confirmation de paiement. " : ""}Vous avez un paiement à faire pour ${cli.nom} : ${quoi}${p.echeance ? `, à payer au plus tard le ${longue(p.echeance)}` : ""}.

Connectez-vous à votre portail client pour obtenir le montant et le code de paiement :
${site}/portail.html
(onglet « Entreprise », section « À payer et documents du cabinet »)

Une fois le paiement fait, cliquez sur « J'ai fait le paiement » dans le portail pour nous en informer.${p.instructions ? `

${p.instructions}` : ""}

Le paiement se fait directement au gouvernement (${p.organisme}), et non à Boujrad CPA Inc.`
  : `Un nouveau document est disponible pour ${cli.nom} : ${quoi}.

Consultez-le dans votre portail client :
${site}/portail.html
(onglet « Entreprise »)`}

Pour toute question, écrivez-nous dans la section « Messages » du portail.

Merci!

Boujrad CPA Inc.`;
  return { sujet, texte };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    // Rappels automatiques (pg_cron)
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      if (cron !== Deno.env.get("CRON_SECRET")) return json({ error: "secret invalide" }, 401);
      const auj = new Date(), dans5 = new Date(auj.getTime() + 5 * 864e5);
      const { data: L } = await admin.from("cc_publications").select("*, cc_clients(*)")
        .gt("montant", 0).is("paye_le", null).is("rappel_le", null).neq("organisme", "Aucun paiement")
        .gte("echeance", auj.toISOString().slice(0, 10)).lte("echeance", dans5.toISOString().slice(0, 10));
      let n = 0;
      for (const p of L || []) {
        const to = await destinataires(admin, p.cc_clients);
        if (!to.length) continue;
        const m = message(p, p.cc_clients, true);
        try { await courriel(to, m.sujet, m.texte); await admin.from("cc_publications").update({ rappel_le: new Date().toISOString() }).eq("id", p.id); n++; } catch (_) { /* on réessaiera demain */ }
      }
      return json({ rappels: n });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "non connecté" }, 401);
    const { data: p } = await admin.from("cc_publications").select("*, cc_clients(*)").eq("id", body.publication_id).maybeSingle();
    if (!p) return json({ error: "document introuvable" }, 404);

    if (body.action === "publication") {
      const { data: membre } = await admin.from("tl_membres").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!membre) return json({ error: "non autorisé" }, 403);
      const to = await destinataires(admin, p.cc_clients);
      if (!to.length) return json({ error: "aucun courriel pour ce client (ajoutez-en un dans sa fiche ou dans Accès au portail)" }, 400);
      const m = message(p, p.cc_clients, false);
      await courriel(to, m.sujet, m.texte);
      await admin.from("cc_publications").update({ avise_le: new Date().toISOString() }).eq("id", p.id);
      return json({ ok: true, envoye_a: to });
    }

    if (body.action === "paiement") {
      const { data: acc } = await admin.from("cc_acces").select("id").eq("client_id", p.client_id).eq("user_id", user.id).maybeSingle();
      if (!acc) return json({ error: "non autorisé" }, 403);
      if (!p.paye_le) return json({ ok: true });
      const notif = Deno.env.get("NOTIF_CABINET");
      if (notif) {
        const site = Deno.env.get("SITE_URL") || "https://app.boujradcpa.com";
        await courriel([notif], `Paiement confirmé : ${p.cc_clients.nom} — ${p.titre}`,
          `${p.cc_clients.nom} indique avoir fait le paiement suivant :\n\n${p.titre}${p.periode ? ` (${p.periode})` : ""}\nMontant : ${p.montant != null ? money(+p.montant) : "—"}\nDate limite : ${p.echeance ? longue(p.echeance) : "—"}\nConfirmé par : ${user.email}\n\nSuivi des paiements : ${site}/centre.html#paiements`);
      }
      return json({ ok: true });
    }
    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
