// Fonction serveur « taux » : taux de change quotidiens USD → CAD de la Banque du Canada (série FXUSDCAD, API Valet).
// Réservée aux membres connectés du cabinet. Corps : { de: "AAAA-MM-JJ", a: "AAAA-MM-JJ" } → { taux: { "AAAA-MM-JJ": 1.3912, … } }
import { createClient } from "npm:@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "non connecté" }, 401);
    const { data: membre } = await sb.from("tl_membres").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!membre) return json({ error: "réservé à l’équipe du cabinet" }, 403);
    const { de, a } = await req.json().catch(() => ({}));
    if (!DATE.test(de ?? "") || !DATE.test(a ?? "") || de > a) return json({ error: "dates invalides" }, 400);
    const r = await fetch(`https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${de}&end_date=${a}`);
    if (!r.ok) return json({ error: `Banque du Canada : ${r.status}` }, 502);
    const j = await r.json();
    const taux: Record<string, number> = {};
    for (const o of j.observations ?? []) { const v = +(o?.FXUSDCAD?.v ?? NaN); if (o?.d && v > 0) taux[o.d] = v; }
    return json({ taux, source: "Banque du Canada, FXUSDCAD" });
  } catch (e) { return json({ error: String(e) }, 500); }
});
