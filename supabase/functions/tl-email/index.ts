// Fonction serveur « tl-email » : envoie un courriel au client depuis l'intranet.
// Vérifie que l'utilisateur est membre du cabinet, puis envoie depuis la boîte Microsoft 365 du cabinet
// (secrets MS_* dans Supabase, jamais dans le navigateur).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
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
      ${tel ? e(tel) + "<br>" : ""}<a href="mailto:${e(mail)}" style="color:#1f3d6e">${e(mail)}</a> · <a href="https://www.boujradcpa.com" style="color:#1f3d6e">www.boujradcpa.com</a></td></tr></table>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0b1626;max-width:640px">${paras}${sig}</div>`;
}

let jetonMS: { v: string; exp: number } | null = null;
type PJ = { filename: string; contentType: string; content: string };
async function envoyerCourriel(o: { to: string[]; subject: string; text: string; replyTo?: string | null; attachments?: PJ[] }) {
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
          ...(o.attachments?.length ? { attachments: o.attachments.map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.filename, contentType: a.contentType, contentBytes: a.content })) } : {}),
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
    body: JSON.stringify({ from: exp.includes("<") ? exp : `Boujrad CPA Inc. <${adresse}>`, to: o.to, subject: o.subject.slice(0, 250), text: o.text, html, ...(o.replyTo ? { reply_to: o.replyTo } : {}), ...(o.attachments?.length ? { attachments: o.attachments.map((a) => ({ filename: a.filename, content: a.content })) } : {}) }),
  });
  if (!r.ok) throw new Error("Resend : " + (await r.text()).slice(0, 200));
}

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

    const { to, subject, text, attachments } = await req.json();
    const pj: PJ[] = Array.isArray(attachments) ? attachments.slice(0, 5).filter((a) => a && typeof a.content === "string" && /\.(pdf|xlsx|csv)$/i.test(String(a.filename || ""))).map((a) => ({ filename: String(a.filename).slice(0, 120), contentType: String(a.contentType || "application/octet-stream"), content: a.content })) : [];
    if (pj.reduce((s, a) => s + a.content.length, 0) > 3_500_000) return json({ error: "pièces jointes trop volumineuses (3 Mo au maximum)" }, 400);
    if (typeof to !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "adresse invalide" }, 400);
    if (!subject || !text) return json({ error: "objet ou message vide" }, 400);
    const replyTo = Deno.env.get("COURRIEL_REPONSE") || user.email;
    await envoyerCourriel({ to: [to], subject: String(subject).slice(0, 200), text: String(text).slice(0, 50000), replyTo, attachments: pj });
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
