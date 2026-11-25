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
