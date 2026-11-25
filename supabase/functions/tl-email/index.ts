// Fonction serveur « tl-email » : envoie un courriel au client depuis l'intranet.
// Vérifie que l'utilisateur est membre du cabinet, puis envoie par Resend (https://resend.com)
// avec la clé gardée dans les secrets Supabase (RESEND_API_KEY). Jamais dans le navigateur.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

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

    const { to, subject, text } = await req.json();
    if (typeof to !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "adresse invalide" }, 400);
    if (!subject || !text) return json({ error: "objet ou message vide" }, 400);
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "service de courriel non configuré (RESEND_API_KEY)" }, 500);

    const from = Deno.env.get("COURRIEL_EXPEDITEUR") || "Boujrad CPA Inc. <comptabilite@boujradcpa.com>";
    const replyTo = Deno.env.get("COURRIEL_REPONSE") || user.email;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [to], subject: String(subject).slice(0, 200), reply_to: replyTo,
        text: String(text).slice(0, 50000),
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(String(text).slice(0, 50000))}</div>`,
      }),
    });
    if (!r.ok) return json({ error: "Resend : " + (await r.text()).slice(0, 300) }, 502);
    return json({ ok: true, id: (await r.json()).id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
