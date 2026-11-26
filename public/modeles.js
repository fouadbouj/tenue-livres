/* Demandes types : courriels préformatés par service (renseignements et documents à obtenir du client) */
(()=>{
const M=[
 {id:'incorporation',nom:'Constitution d’une société (incorporation)',sujet:'Constitution de votre société — renseignements et documents requis',
  intro:'Pour procéder à la constitution de votre société, nous avons besoin des renseignements et documents suivants.',
  sections:[['La société',['Trois noms possibles, par ordre de préférence (ou indiquez si vous préférez une société à numéro)','Constitution au Québec ou au fédéral, si vous avez une préférence (sinon, nous vous conseillerons)','Une description des activités de l’entreprise','L’adresse du siège social (et l’adresse postale, si elle est différente)','Le numéro de téléphone et l’adresse courriel de l’entreprise','La date prévue du début des activités','La date de fin d’exercice souhaitée, si vous en avez une']],
   ['Les administrateurs (pour chacun)',['Nom complet','Adresse résidentielle','Date de naissance','Téléphone et courriel','Fonction souhaitée (président, secrétaire, etc.)']],
   ['Les actionnaires (pour chacun)',['Nom complet ou nom de la société actionnaire','Adresse','Nombre ou pourcentage d’actions détenues','Montant investi au départ']],
   ['Inscriptions et démarrage',['Ventes annuelles prévues (pour l’inscription aux fichiers de la TPS et de la TVQ)','Aurez-vous des employés? Si oui, combien et à partir de quand','Votre institution financière pour l’ouverture du compte de la société']],
   ['Documents',['Une pièce d’identité avec photo de chaque administrateur et actionnaire','La convention entre actionnaires, s’il en existe une','Les permis ou licences requis pour l’activité, s’il y a lieu']]]},
 {id:'nouveau',nom:'Ouverture de dossier — nouveau client (entreprise)',sujet:'Ouverture de votre dossier — documents requis',
  intro:'Bienvenue chez Boujrad CPA Inc.! Pour ouvrir votre dossier et prendre la relève de votre comptabilité, nous avons besoin des documents suivants.',
  sections:[['Documents de la société',['Statuts constitutifs et modifications','Registre des actionnaires et des administrateurs, procès-verbaux récents','NEQ, numéro d’entreprise et numéros de TPS, de TVQ et de retenues à la source']],
   ['Historique',['États financiers et déclarations de revenus (T2 et CO-17) des deux derniers exercices','Les avis de cotisation correspondants','Les dernières déclarations de TPS/TVQ et le sommaire des remises de retenues à la source','La balance de vérification ou une sauvegarde du logiciel comptable actuel (Sage, QuickBooks, etc.)']],
   ['Depuis la fin du dernier exercice',['Relevés bancaires et de cartes de crédit','Relevés des prêts et marges de crédit','Contrats de location et de financement en cours']],
   ['Autres',['Les coordonnées de votre ancien comptable, pour le transfert du dossier','Une pièce d’identité avec photo des administrateurs']]],
  fin:'Nous vous ferons parvenir séparément les procurations à signer pour Revenu Québec et l’Agence du revenu du Canada.'},
 {id:'finexercice',nom:'Fin d’exercice — états financiers et déclarations T2/CO-17',sujet:'Fin d’exercice — documents pour vos états financiers et vos déclarations',
  intro:'Votre exercice se termine. Pour préparer vos états financiers et vos déclarations de revenus de la société (T2 et CO-17), nous avons besoin des documents suivants.',
  sections:[['Banque et financement',['Relevés bancaires et de cartes de crédit jusqu’à la fin de l’exercice (et le relevé du mois suivant)','Relevés des prêts et marges de crédit au dernier jour de l’exercice']],
   ['À la fin de l’exercice',['La liste des comptes clients impayés','La liste des comptes fournisseurs impayés','L’inventaire au dernier jour (quantités et coût), s’il y a lieu']],
   ['Pendant l’exercice',['Les factures d’achat d’immobilisations (équipement, véhicule, ordinateur, améliorations locatives)','Les contrats de location ou de financement signés','Les salaires et dividendes versés aux actionnaires','Les dépenses d’entreprise payées personnellement (avec les factures)','Pour un véhicule : le kilométrage total et le kilométrage d’affaires','Pour un bureau à domicile : la superficie du bureau et de la maison, et les dépenses de la maison']],
   ['Autres',['Tout changement d’actionnaires ou d’administrateurs','Toute correspondance reçue de Revenu Québec ou de l’Agence du revenu du Canada']]]},
 {id:'autonome',nom:'Démarrage — travailleur autonome',sujet:'Démarrage de votre entreprise — renseignements requis',
  intro:'Pour bien démarrer votre entreprise individuelle, nous avons besoin des renseignements suivants.',
  sections:[['Votre entreprise',['Une description de l’activité et la date de début','Le nom de l’entreprise, s’il est différent de votre nom (immatriculation au Registraire des entreprises)','Vos revenus annuels prévus (l’inscription à la TPS et à la TVQ est obligatoire au-delà de 30 000 $ par année)','L’adresse et le téléphone d’affaires']],
   ['Pour bien déduire vos dépenses',['Utiliserez-vous un véhicule pour l’entreprise?','Travaillerez-vous à partir de la maison? Si oui, la superficie du bureau et celle de la maison','La liste des équipements achetés pour démarrer (avec les factures)','Avez-vous ouvert un compte bancaire distinct pour l’entreprise?']],
   ['Documents',['Une pièce d’identité avec photo','Votre dernier avis de cotisation (fédéral et Québec)']]]},
 {id:'tpstvq',nom:'Inscription aux fichiers de la TPS et de la TVQ',sujet:'Inscription à la TPS et à la TVQ — renseignements requis',
  intro:'Pour inscrire votre entreprise aux fichiers de la TPS et de la TVQ, nous avons besoin des renseignements suivants.',
  sections:[['Renseignements',['Nom légal de l’entreprise et NEQ (ou votre nom, pour une entreprise individuelle)','Adresse de l’entreprise','Description de l’activité','Date de la première vente taxable','Ventes annuelles prévues','Fréquence de déclaration souhaitée (mensuelle, trimestrielle ou annuelle), si vous avez une préférence','Nom, titre et téléphone de la personne autorisée']]]},
 {id:'paie',nom:'Mise en place de la paie (employeur ou nouvel employé)',sujet:'Paie — renseignements requis',
  intro:'Pour mettre en place la paie, nous avons besoin des renseignements suivants.',
  sections:[['L’employeur',['Nombre d’employés et date de la première paie','Fréquence de paie souhaitée (hebdomadaire, aux deux semaines, mensuelle)','Mode de paiement des employés (dépôt direct ou chèque)','Taux de cotisation CNESST, si vous l’avez déjà']],
   ['Pour chaque employé',['Nom complet, adresse et date de naissance','Date d’embauche et poste','Salaire (taux horaire ou annuel) et horaire de travail','Les formulaires TD1 et TP-1015.3 remplis et signés','Un spécimen de chèque pour le dépôt direct']]],
  fin:'Pour votre sécurité, ne nous envoyez pas de numéros d’assurance sociale par courriel : déposez-les dans votre portail client.'},
 {id:'locatif',nom:'Immeuble locatif — revenus de location',sujet:'Revenus de location — documents requis',
  intro:'Pour déclarer les revenus de votre immeuble locatif, nous avons besoin des renseignements et documents suivants.',
  sections:[['L’immeuble',['Adresse, date d’achat et prix payé (pour une première déclaration)','Votre part de propriété et le nombre de logements','La partie que vous occupez vous-même, s’il y a lieu']],
   ['Revenus',['Les loyers perçus pour l’année, par logement','La liste des locataires au 31 décembre (pour les relevés 31)']],
   ['Dépenses',['Taxes municipales et scolaires','Assurances','Relevé des intérêts hypothécaires de l’année','Électricité, chauffage, déneigement, entretien','Réparations (avec les factures) et frais de gestion','Factures des rénovations majeures']]]},
 {id:'verification',nom:'Demande de renseignements ou vérification (ARC ou Revenu Québec)',sujet:'Demande de l’administration fiscale — documents requis',
  intro:'Vous avez reçu une demande de Revenu Québec ou de l’Agence du revenu du Canada. Pour y répondre en votre nom, nous avons besoin des éléments suivants.',
  sections:[['À nous transmettre rapidement',['Une copie complète de la lettre ou de l’avis (toutes les pages)','La date limite indiquée','Tous les documents demandés dans la lettre']]],
  fin:'Si l’agent vous contacte directement, dites-lui que Boujrad CPA Inc. vous représente et transmettez-nous ses coordonnées. Évitez de lui fournir des documents sans nous en parler.'},
 {id:'dissolution',nom:'Fermeture ou dissolution d’une société',sujet:'Fermeture de votre société — renseignements requis',
  intro:'Pour fermer votre société correctement et produire les déclarations finales, nous avons besoin des renseignements suivants.',
  sections:[['Renseignements',['La date de cessation des activités','Ce qu’il advient des actifs (vendus, distribués aux actionnaires) et à quelle valeur','Les soldes des prêts et la liste des créanciers à payer','Les derniers relevés bancaires jusqu’à la fermeture du compte','Les dernières paies versées, s’il y a lieu','Les coordonnées à jour de chaque actionnaire']]],
  fin:'Nous fermerons ensuite les comptes de TPS/TVQ et de retenues à la source, et préparerons les déclarations finales et la demande de dissolution.'},
 {id:'disposition',nom:'Vente d’un immeuble ou de placements (gain en capital)',sujet:'Vente d’un bien — documents requis',
  intro:'Pour calculer correctement le gain ou la perte sur la vente de votre bien, nous avons besoin des documents suivants.',
  sections:[['La vente',['Date de vente et prix de vente','Frais de vente (commission du courtier, notaire, etc.)']],
   ['L’achat',['Date et prix d’achat initial','Coût des rénovations ou améliorations majeures (avec les factures)','Pour une maison : l’a-t-elle été votre résidence principale, et pour quelles années?']],
   ['Placements',['Les feuillets T5008 et relevés 18 reçus','Les relevés de courtage de l’année']]]},
 {id:'req',nom:'Mise à jour annuelle au Registraire des entreprises',sujet:'Mise à jour annuelle au Registraire des entreprises — confirmation requise',
  intro:'Nous préparons la déclaration de mise à jour annuelle de votre entreprise au Registraire des entreprises. Merci de nous confirmer ou corriger les renseignements suivants.',
  sections:[['À confirmer',['L’adresse du siège social','Les administrateurs et dirigeants (nom et adresse)','Les trois principaux actionnaires','Les activités principales de l’entreprise','Le nombre de salariés au Québec']]]},
 {id:'allocations',nom:'Allocations pour enfants (Allocation famille et allocation canadienne pour enfants)',sujet:'Allocations pour enfants — documents requis',
  intro:'Pour demander les allocations pour vos enfants auprès de Retraite Québec et de l’Agence du revenu du Canada, nous avons besoin des renseignements et documents suivants.',
  sections:[['Renseignements',['La raison de la demande (naissance, arrivée au Canada, adoption, changement de garde) et sa date','Nom, date de naissance, NAS et statut au Canada des deux parents','Nom, date et lieu de naissance de chaque enfant']],
   ['Documents',['Preuve de naissance de chaque enfant','Preuve de statut au Canada (résidence permanente, permis, etc.), s’il y a lieu','Deux preuves de résidence au Québec, si vous arrivez au Québec','Jugement ou entente de garde, s’il y a lieu','Spécimen de chèque pour le dépôt direct']]]},
 {id:'succession',nom:'Succession — déclarations d’une personne décédée',sujet:'Succession — renseignements et documents requis',
  intro:'Toutes nos condoléances. Pour préparer les déclarations finales de la personne décédée, nous avons besoin des renseignements et documents suivants.',
  sections:[['Documents',['Certificat ou acte de décès','Testament et recherche testamentaire','Coordonnées du liquidateur','Feuillets et relevés de l’année du décès','Relevés bancaires, de placements, REER, FERR et CELI à la date du décès','Actes et évaluations des immeubles, s’il y a lieu','Dernier avis de cotisation']]]},
 {id:'handicap',nom:'Crédit d’impôt pour personnes handicapées',sujet:'Crédit pour personnes handicapées — renseignements requis',
  intro:'Pour demander le crédit d’impôt pour personnes handicapées, nous avons besoin des renseignements suivants.',
  sections:[['Renseignements et documents',['Nom, date de naissance et NAS de la personne visée','La nature de la déficience et depuis quand','Le nom du professionnel de la santé qui remplira les attestations (T2201 et TP-752.0.14)','Les reçus de frais de soins, s’il y a lieu']]]},
 {id:'retraite',nom:'Demandes de pensions de retraite (RRQ, Sécurité de la vieillesse, SRG)',sujet:'Demande de pensions de retraite — renseignements requis',
  intro:'Pour demander vos prestations de retraite auprès de Retraite Québec et de Service Canada, nous avons besoin des renseignements suivants.',
  sections:[['Renseignements',['Les prestations voulues et la date souhaitée du début des versements','Votre NAS, date et lieu de naissance, état civil et les renseignements de votre conjoint','Les pays où vous avez vécu ou travaillé après 18 ans, s’il y a lieu','Les enfants nés après 1958 dont vous vous êtes occupé(e)']],
   ['Documents',['Un spécimen de chèque pour le dépôt direct','Une preuve de citoyenneté ou de statut, si vous êtes né(e) hors du Canada','Toute lettre reçue de Service Canada ou de Retraite Québec']]]},
 {id:'particulier',nom:'Déclaration de revenus des particuliers',sujet:'Vos déclarations de revenus — documents à transmettre',
  intro:'C’est le moment de préparer vos déclarations de revenus. Le plus simple est de passer par votre portail client : un formulaire vous guide et la liste des documents s’adapte à votre situation.',
  sections:[['Dans votre portail client, onglet « Impôts personnels »',['Répondez au formulaire (ou confirmez les changements depuis l’an dernier)','Déposez tous vos feuillets et relevés en une seule fois : T4/RL-1, T5/RL-3, frais médicaux, dons, frais de garde, REER, relevé 31, etc.']]],
  fin:'Si vous faites votre déclaration avec votre conjoint, vous pouvez déposer les documents de la famille ensemble.'},
];
function texte(m,c){const site=(window.CONFIG?.APP_URL||'https://app.boujradcpa.com');
  return `Bonjour${c?.contact?' '+c.contact:''},

${m.intro}

${m.sections.map(([t,L])=>`${t}\n${L.map(x=>'• '+x).join('\n')}`).join('\n\n')}
${m.fin?`\n${m.fin}\n`:''}
Vous pouvez nous transmettre ces renseignements et documents en répondant à ce courriel ou en les déposant dans votre portail client : ${site}/portail.html

N’hésitez pas à nous écrire si vous avez des questions.

Cordialement,

Boujrad CPA Inc.`}
window.MODELES={liste:M,texte};
})();
