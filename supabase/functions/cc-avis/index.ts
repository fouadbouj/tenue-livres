// Fonction serveur « cc-avis » : avis par courriel liés aux documents publiés dans le portail client (espace Entreprise).
// - { action: "publication", publication_id } (membre du cabinet) : avise le client qu'un document ou un paiement l'attend.
// - { action: "paiement", publication_id } (client connecté au portail) : avise le cabinet (NOTIF_CABINET) qu'un client a payé.
// - { action: "signature", publication_id } (client) : avise le cabinet qu'un contrat de services a été signé.
// - { action: "rappels" } avec l'en-tête x-cron-secret : rappel 5 jours avant la date limite aux clients qui n'ont pas confirmé leur paiement.
// Secrets : MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, COURRIEL_EXPEDITEUR (ou RESEND_API_KEY), CRON_SECRET ; facultatifs : NOTIF_CABINET, COURRIEL_EXPEDITEUR, COURRIEL_REPONSE, SITE_URL.
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

// ---- Envoi de courriel : Microsoft 365 (boîte Outlook du cabinet) ou, à défaut, Resend ----
// Microsoft 365 : secrets MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET et COURRIEL_EXPEDITEUR (ex. admin@boujradcpa.com).
// Le courriel part de cette boîte et apparaît dans ses Éléments envoyés. Resend : secret RESEND_API_KEY.
// Corps HTML propre (paragraphes, liens) + signature du cabinet avec le logo
function corpsHtml(text: string) {
  const site = Deno.env.get("SITE_URL") || "https://app.boujradcpa.com";
  const e = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const lignes = text.replace(/\r/g, "").trim().split("\n");
  if ((lignes[lignes.length - 1] || "").trim() === "Boujrad CPA Inc.") { lignes.pop(); while (lignes.length && !lignes[lignes.length - 1].trim()) lignes.pop(); }
  const paras = lignes.join("\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px">${e(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1f3d6e">$1</a>').replace(/\n/g, "<br>")}</p>`).join("");
  const nom = Deno.env.get("SIGNATURE_NOM") || "Administration";
  const tel = Deno.env.get("SIGNATURE_TEL");
  const mail = (Deno.env.get("COURRIEL_EXPEDITEUR") || "admin@boujradcpa.com").replace(/^.*<|>.*$/g, "").trim();
  const sig = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:2px solid #c99d45;padding-top:14px"><tr>
    <td style="padding:14px 16px 0 0;vertical-align:top"><img src="${site}/logo-courriel.png" width="96" height="38" alt="bCPA." style="display:block;border:0"></td>
    <td style="padding:12px 0 0 16px;border-left:1px solid #d5deeb;vertical-align:top;font-size:13px;line-height:1.5;color:#41506a">
      <strong style="color:#0b1626;font-size:14px">${e(nom)}</strong><br><strong style="color:#0b1626">Boujrad CPA Inc.</strong><br>220-672, boulevard des Laurentides<br>Laval (Québec) H7G 2V9<br>
      ${tel ? e(tel) + "<br>" : ""}<a href="mailto:${e(mail)}" style="color:#1f3d6e">${e(mail)}</a> · <a href="https://boujradcpa.com" style="color:#1f3d6e">boujradcpa.com</a></td></tr></table>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0b1626;max-width:640px">${paras}${sig}</div>`;
}

let jetonMS: { v: string; exp: number } | null = null;
async function envoyerCourriel(o: { to: string[]; subject: string; text: string; replyTo?: string | null }) {
  const html = corpsHtml(o.text);
  const exp = (Deno.env.get("COURRIEL_EXPEDITEUR") || "admin@boujradcpa.com").trim();
  const adresse = (exp.match(/<([^>]+)>/)?.[1] || exp).trim();
  const tenant = Deno.env.get("MS_TENANT_ID"), id = Deno.env.get("MS_CLIENT_ID"), secret = Deno.env.get("MS_CLIENT_SECRET");
  if (tenant && id && secret) {
    if (!jetonMS || jetonMS.exp < Date.now() + 60000) {
      const t = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: id, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
      });
      const j = await t.json();
      if (!t.ok) throw new Error("Microsoft (connexion) : " + (j.error_description || j.error || t.status).toString().slice(0, 200));
      jetonMS = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    }
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(adresse)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${jetonMS.v}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: o.subject.slice(0, 250), body: { contentType: "HTML", content: html },
          toRecipients: o.to.map((a) => ({ emailAddress: { address: a } })),
          ...(o.replyTo ? { replyTo: [{ emailAddress: { address: o.replyTo } }] } : {}),
        },
        saveToSentItems: true,
      }),
    });
    if (!r.ok) throw new Error("Microsoft (envoi) : " + (await r.text()).slice(0, 250));
    return;
  }
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("service de courriel non configuré (secrets MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET)");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: exp.includes("<") ? exp : `Boujrad CPA Inc. <${adresse}>`, to: o.to, subject: o.subject.slice(0, 250), text: o.text, html, ...(o.replyTo ? { reply_to: o.replyTo } : {}) }),
  });
  if (!r.ok) throw new Error("Resend : " + (await r.text()).slice(0, 200));
}
const courriel = (to: string[], subject: string, text: string) => envoyerCourriel({ to, subject, text, replyTo: Deno.env.get("COURRIEL_REPONSE") });

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
  if (p.contrat_id) return {
    sujet: `Votre contrat de services avec Boujrad CPA Inc. est prêt à signer`,
    texte: `Bonjour${cli.contact ? " " + cli.contact : ""},

Votre contrat de services professionnels avec Boujrad CPA Inc. est prêt.

Pour le lire et le signer électroniquement, connectez-vous à votre portail client :
${site}/portail.html
(onglet « Entreprise », section « À payer et documents du cabinet », bouton « Lire et signer le contrat »)

Si vous avez des questions avant de signer, écrivez-nous dans la section « Messages » du portail.

Merci de votre confiance!

Boujrad CPA Inc.`,
  };
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

    if (body.action === "signature") {
      const { data: acc } = await admin.from("cc_acces").select("id").eq("client_id", p.client_id).eq("user_id", user.id).maybeSingle();
      if (!acc || !p.contrat_id) return json({ error: "non autorisé" }, 403);
      const { data: k } = await admin.from("cc_contrats").select("*").eq("id", p.contrat_id).maybeSingle();
      const notif = Deno.env.get("NOTIF_CABINET");
      if (notif && k?.statut === "signé") {
        const site = Deno.env.get("SITE_URL") || "https://app.boujradcpa.com";
        await courriel([notif], `Contrat signé : ${p.cc_clients.nom} (${k.numero || ""})`,
          `${p.cc_clients.nom} a signé électroniquement le contrat de services ${k.numero || ""}.\n\nSignataire : ${k.signe_nom}${k.signe_titre ? ", " + k.signe_titre : ""}\nDate : ${new Date(k.signe_le).toLocaleString("fr-CA", { timeZone: "America/Toronto" })}\nCompte du portail : ${user.email}\n\nDossier : ${site}/centre.html`);
      }
      // Confirmation écrite de l'accord de DPA au payeur (Règle H1)
      const { data: acc2 } = await admin.from("cc_dpa_accords").select("*").eq("contrat_id", p.contrat_id).eq("statut", "actif").maybeSingle();
      if (acc2) {
        const to = await destinataires(admin, p.cc_clients);
        const ttc = Math.round(acc2.montant * 1.14975 * 100) / 100;
        if (to.length) await courriel(to, `Confirmation de votre accord de débits préautorisés — Boujrad CPA Inc.`,
          `Bonjour${p.cc_clients.contact ? " " + p.cc_clients.contact : ""},

Nous confirmons votre contrat de services ${k?.numero || ""} et votre accord de débits préautorisés (DPA ${acc2.categorie === "personnel" ? "personnel" : "d'entreprise"}) :

- Titulaire du compte : ${acc2.titulaire}
- Institution ${acc2.institution}, transit ${acc2.transit}, compte se terminant par ${String(acc2.compte).slice(-3)}
- Montant : ${money(ttc)} par mois (${money(+acc2.montant)} plus TPS et TVQ), le ${acc2.jour} de chaque mois (ou le jour ouvrable suivant)
- Premier débit : ${longue(acc2.debut)}${acc2.renonce_preavis ? "\n- Vous avez renoncé au délai de 10 jours avant le premier débit." : ""}

Une facture est déposée dans votre portail client avant chaque débit. Vous pouvez modifier ou révoquer cet accord en tout temps sur préavis écrit de 10 jours. Vous avez certains droits de recours si un débit n'est pas conforme à l'accord, par exemple le droit d'en obtenir le remboursement. Pour plus d'information sur vos droits, communiquez avec votre institution financière ou consultez www.paiements.ca.

Une copie du contrat et de l'accord est disponible en tout temps dans votre portail client.

Boujrad CPA Inc.`);
      }
      return json({ ok: true });
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
