// Fonction serveur « guide » : guides d'utilisation réservés à l'équipe du cabinet (membres connectés seulement).
// Le contenu reste sur le serveur : il n'est jamais publié sur le site ni dans les fichiers publics de l'application.
import { createClient } from "npm:@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const S = (id: string, titre: string, corps: string) => `<section id="${id}"><h2>${titre}</h2>${corps}</section>`;
const ETAPES = (L: string[]) => `<ol class="et">${L.map((x) => `<li>${x}</li>`).join("")}</ol>`;
const TRUC = (t: string) => `<div class="truc">${t}</div>`;

const COMPTA = [
  S("demarrer", "1. Démarrer un dossier", ETAPES([
    "<b>Créer le dossier</b> : liste des dossiers › nom du client › <em>Créer le dossier</em>. Choisissez le type d’entreprise : le plan comptable de base se construit avec les comptes du secteur et les codes IGRF déjà associés (ou versez le plan exporté de Sage).",
    "<b>Décrire l’entreprise</b> : Réglages › Paramètres › description (activités, employés, véhicules…), inscrit ou non à la TPS/TVQ, employeur ou non. L’IA s’en sert pour classer et pour signaler les anomalies.",
    "<b>Exercice</b> : Réglages › Paramètres › début et fin d’exercice.",
    "<b>Soldes d’ouverture</b> : Écritures › Soldes d’ouverture (versez la balance de vérification de fin d’année précédente, ou « soldes à zéro » pour un nouveau client).",
    "L’<b>Accueil</b> du dossier liste ce qui reste à mettre en place (✕ pour masquer un point qui ne s’applique pas).",
  ])),
  S("boite", "Nouveau dossier : la Boîte de dépôt", ETAPES([
    "Accueil › <b>Boîte de dépôt</b> : déposez tout le paquet du client d’un coup (un ZIP ou les fichiers en vrac). Les dossiers __MACOSX et .DS_Store sont ignorés.",
    "Chaque document est reconnu : relevés de banque et de cartes (rattachés au compte par les 4 derniers chiffres, devise détectée), rapport PayPal, exports CSV, états financiers de l’an dernier (balance de vérification), commandes de la boutique, rapports Elavon/AMEX, courriels.",
    "Le tableau propose une action par ligne : Verser, Soldes d’ouverture, ou Garder pour référence. Les lignes en jaune demandent votre attention. Les comptes manquants sont proposés (ex. « Banque RBC USD 6664 », en US$).",
    "Un même compte en PDF et en CSV : seuls les PDF sont versés (ils donnent aussi les soldes pour la conciliation).",
    "« Appliquer » : exercice (si absent), comptes créés, soldes d’ouverture lus dans la balance de l’an dernier (IA, débits = crédits), relevés versés, puis virements entre les comptes appariés. Vérifiez ensuite la Conciliation : elle signale aussi un solde d’ouverture qui ne concorde pas avec le relevé.",
  ])),
  S("methode", "Méthode de comptabilisation et comptes en dollars US", ETAPES([
    "Réglages › Paramètres › <b>Méthode de comptabilisation</b> : caisse (dépôts = revenus, sorties = dépenses), factures appariées aux paiements, ou ventes dans « Transactions à déposer ». Par défaut : caisse tant qu’aucune facture de vente n’est versée. La méthode et les notes « Comment on tient ce dossier » s’affichent à l’Accueil et guident l’IA.",
    "<b>Comptes en US$</b> : la devise se choisit dans Paramètres (elle est aussi détectée sur les relevés « Fonds en USD », les cartes « en dollars US » et les exports avec une colonne USD). Les relevés se concilient en US$; le grand livre convertit chaque transaction en $ CA au taux quotidien de la Banque du Canada.",
    "<b>Virements entre vos comptes</b> (paiement de la Visa, opération de change CAD↔USD, PayPal → banque) : les deux côtés sont appariés et comptés une seule fois. Entre devises, c’est le montant réel en $ CA qui est retenu.",
    "<b>Fin d’exercice</b> : Écritures › Régularisations › la réévaluation de chaque compte en US$ au taux de clôture est calculée et proposée (gain ou perte de change).",
  ])),
  S("releves", "2. Verser les relevés", ETAPES([
    "Transactions › choisissez seulement le <b>compte</b> (banque ou carte), puis déposez un ou plusieurs relevés (PDF, CSV ou Excel). Le mois affiché n’a pas d’importance.",
    "Le logiciel lit le relevé (directement, ou par l’IA en relais) et vérifie que <b>solde d’ouverture + transactions = solde de clôture</b>. Le rapport par fichier indique : lues, ajoutées, doublons ignorés, mises de côté.",
    "<b>Doublons</b> : reverser un relevé, ou le même en CSV, n’ajoute rien. Deux relevés consécutifs qui partagent une date de coupure ne se dédoublonnent pas entre eux.",
    "<b>Relevés qui chevauchent la fin d’exercice</b> (ex. 8 sept. au 8 oct., fin le 30 sept.) : la partie hors exercice est mise de côté et entrera toute seule dans l’exercice suivant; la conciliation est coupée à la fin d’exercice.",
    "<b>Comptes liés</b> (Réglages › Comptes liés) : versez les relevés du compte personnel ou de la holding pour apparier automatiquement les virements entre comptes.",
    "Dates protégées (exercice fermé ou date de verrouillage) : les transactions sont refusées et le rapport l’indique.",
  ]) + TRUC("Un relevé PDF numérisé ou mal formé passe par l’IA : vérifiez alors la ligne « soldes concordants » du rapport, et la conciliation.")),
  S("classer", "3. Classer", ETAPES([
    "Onglet <b>À classer</b> : choisissez le compte dans la liste; c’est enregistré tout de suite. Le message propose de <b>retenir une règle</b> pour les prochaines (seulement pour ce qui se répète toujours pareil).",
    "<b>Suggérées par l’IA</b> : vérifiez, puis « Accepter les suggestions » (elles deviennent des règles).",
    "<b>Classement en lot</b> : cochez plusieurs transactions, choisissez le compte et les taxes.",
    "<b>Compte transitoire</b> : une transaction qu’on y laisse volontairement est classée, mais apparaît comme « à régulariser » dans l’Accueil et en rouge dans le bilan.",
    "<b>Points à vérifier</b> : chaque point peut être marqué « ✓ Vérifié » (retenu pour le dossier) ou désactivé (🔕) pour ce type de point.",
    "<b>Mois révisé</b> : « ✓ Marquer ce mois révisé » une fois le mois revu. Toute modification ensuite demande une confirmation et retire la révision.",
  ])),
  S("pieces", "4. Factures et pièces jointes", ETAPES([
    "<b>Factures</b> : déposez les factures d’achat ou de vente en PDF : l’IA lit fournisseur, numéro, date, taxes et total. Le paiement à la banque est apparié automatiquement.",
    "<b>Pièces jointes</b> : dans la fiche d’une transaction (clic dans le grand livre) ou dans une écriture, « Joindre » une facture ou un reçu; un 📎 apparaît sur la transaction.",
  ])),
  S("ecritures", "5. Écritures et régularisations de fin d’exercice", ETAPES([
    "Écritures › <b>Nouvelle écriture</b> (type « Ajustement de fin d’exercice (AJE) » au besoin). Elle doit balancer.",
    "<b>Proposer les régularisations</b> : l’IA passe le dossier en revue (prêts capital et intérêts, amortissement, payés d’avance, frais courus, revenus à recevoir, taxes, salaires, impôts, transitoire) à partir des soldes et des relevés d’après la fin d’exercice. Pour chaque proposition : Accepter, Modifier ou Rejeter. La liste « À obtenir du client » indique les pièces manquantes.",
    "Les régularisations acceptées sont retenues et reproposées l’an prochain.",
  ])),
  S("concil", "6. Conciliation bancaire", ETAPES([
    "Conciliation › choisissez le compte : chaque relevé versé apparaît avec ses soldes. « Concilié » = solde d’ouverture + transactions des livres = solde de clôture.",
    "« Ne balance pas » : le bouton « Trouver l’écart » compare le relevé et les livres et pointe la transaction manquante ou en trop.",
    "Le solde aux livres à la fin du dernier relevé est comparé au relevé (vérifiez les soldes d’ouverture en cas d’écart).",
  ])),
  S("rapports", "7. Rapports", ETAPES([
    "Bilan, état des résultats (avec comparatifs de 1 à 3 ans), <b>résultats par mois</b>, balance de vérification, grand livre, journal, TPS/TVQ, DAS, clients et fournisseurs, IGRF.",
    "Dans le grand livre, <b>cliquez sur une transaction</b> : une fiche s’ouvre à droite pour corriger le compte ou les taxes, ajouter une note ou une pièce jointe, sans quitter le rapport (écriture : modifier les comptes; facture : ouvrir la fiche).",
    "<b>Envoyer au client</b> : le rapport affiché part en PDF, avec un courriel prérempli et la signature du cabinet.",
    "<b>IGRF</b> : les codes s’associent automatiquement à l’ouverture (plan type, puis l’IA; codes de l’IA en jaune à vérifier). « Exporter pour la T2 (CSV) », puis dans TaxCycle : Data › Import GIFI. Encore mieux : « Importer les IGRF de la T2 de l’an dernier ».",
  ])),
  S("exercices", "8. Exercices et mission de compilation", ETAPES([
    "Réglages › Paramètres › Exercices : <b>Fermer l’exercice</b> quand la T2 est produite (les soldes de clôture deviennent les soldes d’ouverture du suivant). À l’ajout d’un nouvel exercice, le logiciel propose de fermer le précédent.",
    "Un exercice fermé ou protégé se <b>rouvre</b> ou se <b>déverrouille</b> avec une simple confirmation; « Reverrouiller » le protège de nouveau. Tout est noté dans l’historique.",
    "<b>Date de verrouillage</b> : aucune modification avant une date donnée.",
    "<b>Mission de compilation</b> (NCSC 4200) : réservée au CPA. Le technicien peut la consulter et télécharger les PDF.",
  ])),
  S("assistant", "9. L’assistant ✦", `<p>Bouton ✦ en bas à droite. Il voit l’écran où vous êtes. Exemples : « Passe une écriture de 10 000 $ dans l’encaisse en contrepartie des fournisseurs au 31 décembre », « Mets tous les dépôts directs du transitoire dans les ventes », « Enlève les taxes sur toutes les XACTE », « Apparie le virement de 1 000 $ avec le compte personnel ». Il vous montre toujours le changement avant de l’appliquer (Confirmer / Annuler). Mode voix : 🎤.</p>`),
  S("archive", "10. Archive, piste de vérification et sauvegarde", ETAPES([
    "<b>Archive et export</b> : un ZIP du dossier avec tous les rapports en PDF, le grand livre en CSV, la piste de vérification et les pièces jointes.",
    "<b>Piste de vérification</b> (Réglages › Paramètres) : qui a changé quoi, quand, avant → après. Filtre et export CSV.",
    "La <b>sauvegarde officielle</b> de tout le cabinet se fait dans Gestion du cabinet › Sauvegarde (rappel mensuel).",
  ])),
  S("routine", "11. Routine mensuelle conseillée", ETAPES([
    "Verser les relevés du mois (banque, cartes, comptes liés).",
    "Classer « À classer », vérifier les suggestions de l’IA, retenir les règles utiles.",
    "Traiter les points à vérifier; demander les détails au client au besoin (bouton « Demander les détails au client »).",
    "Concilier, puis marquer le mois révisé.",
    "Préparer la TPS/TVQ et les DAS à partir des rapports.",
  ])),
].join("");

const GESTION = [
  S("config", "1. Configuration du cabinet (⚙)", `<p>Onglet ⚙ : les informations obligatoires (taxes et courriel du cabinet, Interac, numéro d’entreprise pour l’ARC, courriel d’essai, première sauvegarde) et facultatives (DPA Desjardins, équipe). Une bannière s’affiche tant que l’obligatoire n’est pas fait.</p>`),
  S("clients", "2. Clients", ETAPES([
    "<b>+ Nouveau client</b> : les champs obligatoires sont vérifiés (nom, personne-ressource, courriel; pour une société : forme, NEQ, numéro d’entreprise, fin d’exercice, adresse; numéros de taxes si inscrit). « Fiche incomplète » dans la liste indique ce qui manque.",
    "Statut : prospect, actif, inactif. <b>Groupe</b> : regroupez les sociétés d’un même propriétaire (une fiche par société).",
    "La <b>description de l’entreprise</b> sert aussi à l’IA dans la comptabilité.",
  ])),
  S("nouveau", "3. Nouveau client : la trousse d’accueil", ETAPES([
    "À la création, la fiche s’ouvre sur l’onglet <b>Trousse d’accueil</b> : accès au portail, questionnaire d’ouverture et pièces, contrat, autorisation ARC, procuration MR-69, identité et conflits.",
    "<b>Préparez d’abord</b> : le contrat (onglet Contrat de services) et la procuration MR-69 (produite dans Mon dossier pour les représentants professionnels de Revenu Québec, PDF joint dans la trousse).",
    "<b>ARC</b> : dans Représenter un client (compte du cabinet), soumettez la demande d’autorisation pour le client — niveau 2, aucune date de fin, accès en ligne, numéro d’entreprise au complet pour une société, option « le client confirmera dans Mon dossier » — puis cliquez « Demande soumise ».",
    "<b>Envoyer la trousse d’accueil</b> : un seul courriel au client avec ses étapes, dans l’ordre (vous le voyez avant l’envoi). Une tâche de suivi est créée dans 7 jours; ensuite, « Relancer le client » ne renvoie que les étapes restantes.",
    "Quand le client a confirmé à l’ARC, cliquez « Le client a confirmé ». Le contrat et le MR-69 passent à « Signé » tout seuls.",
  ])),
  S("envoyer", "4. Envoyer au client", `<p>Bouton <b>Envoyer au client ▾</b> en haut de la fiche :</p>${ETAPES([
    "<b>Trousse d’accueil</b> (nouveau client).",
    "<b>Demande de documents ou questionnaire</b> : modèles de demandes (modifiables et enregistrables) et questionnaires en ligne (incorporation, fin d’exercice, TPS/TVQ, paie, allocations, retraite, succession…). Le client répond dans son portail; vous êtes avisé à la réception (onglet Demandes).",
    "<b>Document à publier ou à faire signer</b> : déclaration avec montant, date limite et code de paiement; avis; états financiers; ou document à signer (cochez « Demander la signature du client »). Le PDF signé revient dans la fiche, avec un avis.",
    "<b>Demande de représentant (ARC)</b> : courriel qui demande au client de confirmer notre demande d’autorisation.",
  ])}`),
  S("demandes", "5. Demandes, Documents et Impôts perso", ETAPES([
    "<b>Demandes</b> : questionnaires envoyés et reçus. À la réception : consultez les réponses et les pièces, créez la fiche client à partir des réponses au besoin, puis « Traité ».",
    "<b>Documents</b> : demandes de documents de TPS/TVQ et autres dépôts des clients.",
    "<b>Impôts perso</b> : les dossiers T1/TP-1 envoyés par les particuliers dans le portail, avec leurs documents.",
  ])),
  S("echeances", "6. Échéancier et tâches", ETAPES([
    "<b>Échéancier</b> : toutes les échéances du mois (TPS/TVQ, DAS, T2/CO-17, acomptes…), en retard en rouge; « Fait » quand c’est produit. Sommaire du mois par courriel ou à imprimer.",
    "<b>Tâches</b> : tâches et suivis (créés aussi automatiquement après un envoi). Le journal de la fiche garde la trace des courriels et des notes.",
  ])),
  S("facturation", "7. Facturation et paiements", ETAPES([
    "<b>Prélèvements du mois</b> (clients en DPA) : 1. créer les factures du mois, 2. générer le fichier Desjardins à transmettre dans AccèsD Affaires.",
    "<b>Factures</b> : nouvelle facture (ou par l’assistant : « Facture Gestion Tremblay 75 $ plus taxes et envoie-la »). Le client reçoit le PDF et un lien de paiement (Interac, carte si offerte).",
    "<b>Comptes clients</b> : soldes et retards. <b>Paiements</b> : les confirmations de paiement des clients (taxes et impôts payés au gouvernement).",
    "<b>Paramètres</b> : numéros de taxes, Interac, Desjardins, identifiants de représentant.",
  ])),
  S("assistant", "8. L’assistant ✦ (votre secrétaire)", `<p>Exemples : « Envoie un courriel à Gestion Tremblay pour qu’il nous envoie ses relevés de septembre », « Crée une tâche de suivi pour demain », « Marque la TPS de Resto XYZ comme faite », « Facture tel client 150 $ plus taxes ». Les courriels partent avec la signature du cabinet. Il vous montre toujours le changement ou le courriel avant de l’envoyer.</p>`),
  S("sauvegarde", "9. Sauvegarde", `<p>Onglet <b>Sauvegarde</b> : un seul fichier ZIP protégé par mot de passe, avec tout le cabinet (clients, contrats, factures, impôts, comptabilité de chaque dossier en Excel, piste de vérification, pièces jointes) et les fichiers de restauration. À faire chaque mois (un rappel s’affiche) et à garder sur une clé USB ou un disque externe. Gardez le mot de passe en lieu sûr.</p>`),
  S("droits", "10. Droits de l’équipe", `<p>Les techniciens travaillent de façon autonome partout. Le CPA (administrateur) a en plus la mission de compilation et la gestion des utilisateurs (Comptabilité › Réglages › Paramètres › Utilisateurs du cabinet).</p>`),
].join("");

const GUIDES: Record<string, { titre: string; html: string }> = {
  compta: { titre: "Guide de la Comptabilité", html: COMPTA },
  gestion: { titre: "Guide de la Gestion du cabinet", html: GESTION },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "non connecté" }, 401);
    const { data: membre } = await sb.from("tl_membres").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!membre) return json({ error: "réservé à l’équipe du cabinet" }, 403);
    const { nom } = await req.json().catch(() => ({ nom: "" }));
    const g = GUIDES[nom];
    if (!g) return json({ error: "guide inconnu" }, 404);
    return json({ titre: g.titre, html: g.html });
  } catch (e) { return json({ error: String(e) }, 500); }
});
