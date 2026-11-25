// Fonction serveur « cc-rappels » : rappels automatiques du Centre clients (TPS/TVQ).
// - { sommaire: true } : envoie au cabinet (NOTIF_CABINET) la liste des échéances du mois (cron le 1er du mois).
// - Appel automatique quotidien (pg_cron) avec l'en-tête x-cron-secret = CRON_SECRET :
//   crée les demandes des périodes terminées et envoie le premier courriel, puis un rappel aux 7 jours (3 rappels au plus).
// - Appel manuel depuis l'intranet (membre connecté) : { demande_id } envoie le courriel tout de suite.
// Secrets requis : MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, COURRIEL_EXPEDITEUR (ou RESEND_API_KEY), CRON_SECRET. Facultatifs : COURRIEL_EXPEDITEUR, COURRIEL_REPONSE, SITE_URL.
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

// Accès au portail : si personne de l'entreprise n'a encore de compte lié, on joint un code d'invitation (créé au besoin)
// deno-lint-ignore no-explicit-any
async function codeInvitation(admin: any, c: Client): Promise<string | null> {
  const { data: acc } = await admin.from("cc_acces").select("*").eq("client_id", c.id);
  if ((acc || []).some((a: { user_id: string | null }) => a.user_id)) return null;
  const libre = (acc || []).find((a: { user_id: string | null; courriel: string | null }) => !a.user_id && (a.courriel || "").toLowerCase() === (c.courriel || "").toLowerCase()) || (acc || []).find((a: { user_id: string | null }) => !a.user_id);
  if (libre) return libre.code;
  const { data: n } = await admin.from("cc_acces").insert({ client_id: c.id, courriel: c.courriel }).select("code").single();
  return n?.code || null;
}

// deno-lint-ignore no-explicit-any
async function envoyer(admin: any, c: Client, d: { id: string; periode: string; debut: string; fin: string; echeance: string | null; rappels: number }) {
  const site = Deno.env.get("SITE_URL") || "https://app.boujradcpa.com";
  const code = await codeInvitation(admin, c);
  const lien = `${site}/portail.html?depot=${d.id}${code ? `&invite=${code}` : ""}`;
  const rappel = d.rappels > 0 ? "Rappel : " : "";
  const sujet = `${rappel}documents pour vos déclarations de TPS/TVQ — période du ${longue(d.debut)} au ${longue(d.fin)}`;
  const texte = `Bonjour${c.contact ? " " + c.contact : ""},

${d.rappels > 0 ? "Nous n'avons pas encore reçu vos documents. " : ""}Afin de préparer les déclarations de TPS et de TVQ de ${c.nom} pour la période du ${longue(d.debut)} au ${longue(d.fin)}${d.echeance ? ` (date limite de production : ${longue(d.echeance)})` : ""}, merci de nous transmettre :

${c.documents}

Déposez-les en toute sécurité dans votre portail client (la bonne période s'ouvre directement) :
${lien}
${code ? `
Première visite? Créez votre compte avec cette adresse courriel, puis entrez votre code d'invitation : ${code}
(Le code est déjà inscrit si vous passez par le lien ci-dessus.)
` : `
Connectez-vous avec votre compte habituel.
`}

Vous pouvez aussi les déposer à notre bureau : 220-672, boulevard des Laurentides, Laval (Québec) H7G 2V9.

Merci!

Boujrad CPA Inc.`;
  await envoyerCourriel({ to: [c.courriel!], subject: sujet, text: texte, replyTo: Deno.env.get("COURRIEL_REPONSE") });
}


// ---- Sommaire mensuel des échéances du cabinet (même calcul que l'onglet Échéancier du Centre clients) ----
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const court = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function plusMois(fe: string, n: number) {
  const [y, m, d] = fe.split("-").map(Number), fin = finMois(y, m).getUTCDate() === d;
  return fin ? ymd(finMois(y, m + n)) : ymd(new Date(Date.UTC(y, m - 1 + n, Math.min(d, finMois(y, m + n).getUTCDate()))));
}
type Ob = { cle: string; type: string; titre: string; date: string; info: string; client_id: string };
// deno-lint-ignore no-explicit-any
function obligations(c: any, y1: number, y2: number): Ob[] {
  const out: Ob[] = [], st = c.statut || "actif";
  if (st !== "actif") return out;
  const add = (cle: string, type: string, titre: string, date: string, info: string) => out.push({ cle, type, titre, date, info, client_id: c.id });
  const mmdd = c.fin_exercice || "12-31", societe = c.type !== "particulier" && !/individuelle|personnes|Particulier/.test(c.forme || "");
  for (let y = y1 - 1; y <= y2; y++) {
    if (c.type !== "particulier") {
      const fe = `${y}-${mmdd}`;
      if (c.tps_tvq !== false) {
        const M = +mmdd.slice(0, 2), pas = c.frequence === "mensuelle" ? 1 : c.frequence === "trimestrielle" ? 3 : 12;
        for (let m = 1; m <= 12; m++) {
          if (pas > 1 && ((m - M) % pas + pas) % pas !== 0) continue;
          const fin = ymd(finMois(y, m));
          add("tps:" + fin, "TPS/TVQ", "Déclaration et paiement de TPS/TVQ", ymd(pas === 12 ? finMois(y, m + 3) : finMois(y, m + 1)), `période se terminant le ${court(fin)}`);
        }
      }
      if (societe) {
        add("soldeqc:" + fe, "Impôt", "Solde d'impôt — Québec", plusMois(fe, 2), `exercice terminé le ${court(fe)}`);
        add("soldefed:" + fe, "Impôt", "Solde d'impôt — fédéral", plusMois(fe, c.spcc_dpe ? 3 : 2), `exercice terminé le ${court(fe)}`);
        add("t2:" + fe, "T2/CO-17", "Production T2 et CO-17", plusMois(fe, 6), `exercice terminé le ${court(fe)}`);
      } else add("t1ind:" + y, "T1/TP-1", "Production T1 et TP-1 (travailleur autonome)", `${y + 1}-06-15`, `année ${y}`);
    } else add("t1:" + y, "T1/TP-1", "Déclarations T1 et TP-1 et paiement", `${y + 1}-04-30`, `année ${y}`);
    if (c.employeur) {
      for (let m = 1; m <= 12; m++) add(`das:${y}-${String(m).padStart(2, "0")}`, "DAS", "Remise des DAS", `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-15`, `paies du mois ${m}/${y}`);
      add("t4:" + y, "Relevés", "T4 et RL-1", ymd(finMois(y + 1, 2)), `année ${y}`);
      add("cnesst:" + y, "Relevés", "Déclaration des salaires CNESST", `${y + 1}-03-15`, `année ${y}`);
    }
  }
  const dep = c.depuis || c.ouverture;
  return out.filter((o) => !dep || o.date >= dep);
}
// deno-lint-ignore no-explicit-any
async function sommaire(admin: any) {
  const notif = Deno.env.get("NOTIF_CABINET");
  if (!notif) return { sommaire: "NOTIF_CABINET non défini" };
  const auj = new Date(), y = auj.getUTCFullYear(), m = auj.getUTCMonth() + 1;
  const deb = ymd(new Date(Date.UTC(y, m - 1, 1))), fin = ymd(finMois(y, m)), depuis6 = ymd(new Date(Date.UTC(y, m - 7, 1)));
  const [{ data: cli }, { data: ech }, { data: pub }] = await Promise.all([
    admin.from("cc_clients").select("*"), admin.from("cc_echeances").select("client_id,cle"), admin.from("cc_publications").select("client_id,periode_fin,paye_le,montant"),
  ]);
  const fait = (o: Ob) => (ech || []).some((e: { client_id: string; cle: string }) => e.client_id === o.client_id && e.cle === o.cle) ||
    (o.type === "TPS/TVQ" && (pub || []).some((p: { client_id: string; periode_fin: string; paye_le: string; montant: number }) => p.client_id === o.client_id && p.periode_fin === o.cle.slice(4) && p.paye_le));
  // deno-lint-ignore no-explicit-any
  const nom = (id: string) => (cli || []).find((c: any) => c.id === id)?.nom || "?";
  const tout = (cli || []).flatMap((c: unknown) => obligations(c, y - 1, y + 1));
  const mois = tout.filter((o) => o.date >= deb && o.date <= fin).sort((a, b) => a.date.localeCompare(b.date));
  const retard = tout.filter((o) => o.date < deb && o.date >= depuis6 && !fait(o)).sort((a, b) => a.date.localeCompare(b.date));
  // deno-lint-ignore no-explicit-any
  const fins = (cli || []).filter((c: any) => c.type !== "particulier" && (c.statut || "actif") === "actif" && +String(c.fin_exercice).slice(0, 2) === m);
  const ligne = (o: Ob) => `- ${court(o.date)} · ${nom(o.client_id)} · ${o.titre} (${o.info})${fait(o) ? " — fait" : ""}`;
  const nomMois = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" });
  const parType = [...new Set(mois.map((o) => o.type))].map((t) => `${t} : ${mois.filter((o) => o.type === t).length}`).join(" · ");
  const site = Deno.env.get("SITE_URL") || "https://app.boujradcpa.com";
  const texte = `Échéances de ${nomMois}

${mois.length} échéance(s) ce mois-ci${parType ? " (" + parType + ")" : ""}.
${retard.length ? `\nEN RETARD (mois précédents, non marquées comme faites) : ${retard.length}\n${retard.map(ligne).join("\n")}\n` : ""}
CE MOIS-CI
${mois.map(ligne).join("\n") || "Aucune échéance."}
${fins.length ? `\nFINS D'EXERCICE CE MOIS-CI (prévoir les documents de fin d'année)\n${fins.map((c: { nom: string; fin_exercice: string }) => `- ${c.nom} (${c.fin_exercice})`).join("\n")}\n` : ""}
Rappel : solde d'impôt à 2 mois au Québec; au fédéral, 3 mois pour une SPCC qui a droit à la DPE, sinon 2 mois; T2 et CO-17 à 6 mois. Une échéance qui tombe un jour non ouvrable est reportée au jour ouvrable suivant.

Échéancier complet et suivi : ${site}/centre.html`;
  await envoyerCourriel({ to: [notif], subject: `Échéances de ${nomMois} — ${mois.length} à traiter${retard.length ? `, ${retard.length} en retard` : ""}`, text: texte });
  return { sommaire: mois.length, retard: retard.length };
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
      await envoyer(admin, d.cc_clients, d);
      await admin.from("cc_demandes").update({ statut: d.statut === "à envoyer" ? "envoyée" : d.statut, rappels: d.rappels + 1, dernier_rappel: new Date().toISOString() }).eq("id", d.id);
      return json({ ok: true });
    }

    // Sommaire mensuel des échéances (cron du 1er du mois, ou bouton du Centre clients)
    if (body.sommaire) return json({ ok: true, ...(await sommaire(admin)) });

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
          await envoyer(admin, c, d);
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
