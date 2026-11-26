// Fonction serveur « cc-paiement » : page de paiement des factures (payer.html) et paiement par carte avec Stripe.
// - { action: "info", jeton } (public) : résumé de la facture et modes de paiement offerts.
// - { action: "carte", jeton } (public) : crée une session de paiement Stripe Checkout et renvoie son adresse.
// - Webhook Stripe (en-tête stripe-signature) : checkout.session.completed → facture « payée » + avis au cabinet.
// Secrets : SUPABASE_SERVICE_ROLE_KEY (fourni), SITE_URL ; pour la carte : STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET ;
// pour l'avis au cabinet : NOTIF_CABINET et les secrets d'envoi de courriel (MS_* ou RESEND_API_KEY).
// Déployée avec --no-verify-jwt : la page de paiement est publique et Stripe n'envoie pas de jeton Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
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
  const lien = (t: string) => e(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1f3d6e">$1</a>');
  const paras = lignes.join("\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const L = p.split("\n"), puces = L.filter((l) => /^[•\-] /.test(l.trim()));
    if (puces.length && puces.length >= L.length - 1) {
      const titre = L.length > puces.length ? L[0].trim() : "";
      const t = titre ? `<p style="margin:0 0 4px;font-weight:700;color:#0b1626">${lien(titre)}</p>` : "";
      return `${t}<ul style="margin:0 0 14px;padding-left:22px">${puces.map((l) => `<li style="margin:0 0 3px">${lien(l.trim().slice(2))}</li>`).join("")}</ul>`;
    }
    return `<p style="margin:0 0 14px">${lien(p).replace(/\n/g, "<br>")}</p>`;
  }).join("");
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

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const site = () => (Deno.env.get("SITE_URL") || "https://app.boujradcpa.com").replace(/\/$/, "");

async function facture(jeton: string) {
  if (!/^[a-f0-9]{32,80}$/.test(String(jeton || ""))) return null;
  const { data } = await admin().from("cc_factures").select("*, cc_clients(nom, courriel, adresse, ville, province, code_postal, contact)").eq("jeton", jeton).maybeSingle();
  return data;
}

// Vérification de la signature Stripe (en-tête t=…,v1=…) : HMAC-SHA256 de « t.corps » avec le secret du webhook
async function signatureOk(corps: string, entete: string, secret: string) {
  const parts = Object.fromEntries(entete.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t, v1s = entete.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1s.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${corps}`)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1s.some((v) => v.length === hex.length && [...v].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sigStripe = req.headers.get("stripe-signature");
    if (sigStripe) {
      const corps = await req.text();
      const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
      if (!secret || !(await signatureOk(corps, sigStripe, secret))) return json({ error: "signature invalide" }, 400);
      const ev = JSON.parse(corps);
      if (ev.type === "checkout.session.completed" && ev.data?.object?.payment_status === "paid") {
        const s = ev.data.object, id = s.metadata?.facture_id;
        if (id) {
          const auj = new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
          const { data: f } = await admin().from("cc_factures").update({ statut: "payée", paye_le: auj, paye_par: "carte", stripe_session: s.id })
            .eq("id", id).in("statut", ["à payer", "rejetée"]).select("numero, total, cc_clients(nom)").maybeSingle();
          const notif = Deno.env.get("NOTIF_CABINET");
          if (f && notif) await envoyerCourriel({ to: [notif], subject: `Paiement par carte reçu : facture ${f.numero}`,
            text: `${(f as any).cc_clients?.nom || "Un client"} a payé la facture ${f.numero} (${money(+f.total)}) par carte de crédit.\n\nLa facture est marquée comme payée dans Gestion du cabinet.` }).catch(() => {});
        }
      }
      return json({ received: true });
    }

    const { action, jeton } = await req.json();
    const f = await facture(jeton);
    if (!f || f.statut === "annulée") return json({ error: "Facture introuvable." }, 404);
    const { data: par } = await admin().from("cc_parametres").select("valeur").eq("cle", "facturation").maybeSingle();
    const P = (par?.valeur || {}) as Record<string, string>;
    const carte = !!Deno.env.get("STRIPE_SECRET_KEY") && P.carte === "oui";

    if (action === "info") {
      return json({ numero: f.numero, date: f.date, echeance: f.echeance, lignes: f.lignes, sous_total: f.sous_total, tps: f.tps, tvq: f.tvq, total: f.total, statut: f.statut,
        paye_le: f.paye_le, note: f.note, emetteur: f.emetteur, client: f.cc_clients, interac: P.interac || "", interacNote: P.interacNote || "", carte });
    }
    if (action === "carte") {
      if (!carte) return json({ error: "Le paiement par carte n'est pas offert." }, 400);
      if (f.statut !== "à payer" && f.statut !== "rejetée") return json({ error: "Cette facture n'est pas à payer." }, 400);
      const b = new URLSearchParams({
        mode: "payment", locale: "fr-CA",
        "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "cad",
        "line_items[0][price_data][unit_amount]": String(Math.round(+f.total * 100)),
        "line_items[0][price_data][product_data][name]": `Facture ${f.numero} — Boujrad CPA Inc.`,
        "metadata[facture_id]": f.id, "payment_intent_data[metadata][facture_id]": f.id, "payment_intent_data[description]": `Facture ${f.numero}`,
        success_url: `${site()}/payer.html?f=${jeton}&ok=1`, cancel_url: `${site()}/payer.html?f=${jeton}`,
      });
      if (f.cc_clients?.courriel) b.set("customer_email", f.cc_clients.courriel);
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: b });
      const out = await r.json();
      if (!r.ok) return json({ error: "Stripe : " + (out?.error?.message || r.status) }, 502);
      await admin().from("cc_factures").update({ stripe_session: out.id }).eq("id", f.id);
      return json({ url: out.url });
    }
    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
