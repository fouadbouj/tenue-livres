/* Questionnaires de service en ligne (portail client) : définition des formulaires, rendu, validation et sommaire pour le cabinet.
   Utilisé par portail.html (le client remplit) et centre.html (le cabinet envoie le lien et lit les réponses). */
(()=>{
const OUI=['Oui','Non'],MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const f=(k,l,t='text',o={})=>({k,l,t,...o}),doc=(k,l,o={})=>({k,l,t:'doc',...o}),S=(t,c,o={})=>({t,c,...o});
const oui=k=>R=>R[k]==='Oui';

const Q={
 incorporation:{nom:'Constitution d’une société (incorporation)',intro:'Pour procéder à la constitution de votre société, nous avons besoin de quelques renseignements sur la société, ses administrateurs et ses actionnaires, et de quelques pièces.',
  s:[S('La société',[f('nom1','Nom souhaité — premier choix','text',{req:1,show:R=>!R.numerotee}),f('nom2','Deuxième choix','text',{show:R=>!R.numerotee}),f('nom3','Troisième choix','text',{show:R=>!R.numerotee}),
     f('numerotee','Je préfère une société à numéro (ex. 9999-9999 Québec inc.)','check'),
     f('juridiction','Constitution','radio',{opts:['Au Québec','Au fédéral','Je ne sais pas, conseillez-moi'],req:1}),
     f('activites','Description des activités de l’entreprise','textarea',{req:1}),
     f('siege','Adresse du siège social (numéro, rue, ville, code postal)','text',{req:1}),f('postale','Adresse postale, si elle est différente','text'),
     f('tel','Téléphone de l’entreprise','tel'),f('courriel','Courriel de l’entreprise','email'),f('debut','Date prévue du début des activités','date'),
     f('fin_exercice','Fin d’exercice souhaitée','select',{opts:['Conseillez-moi',...MOIS.map(m=>'Fin '+m.toLowerCase())]})]),
   S('Les administrateurs',[f('admins','','rep',{min:1,add:'Ajouter un administrateur',sub:[f('nom','Nom complet','text',{req:1}),f('adresse','Adresse résidentielle','text',{req:1}),f('ddn','Date de naissance','date'),f('tel','Téléphone','tel'),f('courriel','Courriel','email'),
      f('fonction','Fonction','select',{opts:['Président(e)','Vice-président(e)','Secrétaire','Trésorier(ère)','Administrateur(trice) seulement']}),f('resident','Résident(e) du Canada','select',{opts:OUI})]})],{note:'Les personnes qui dirigent la société. Ajoutez-en une par personne.'}),
   S('Les actionnaires',[f('actionnaires','','rep',{min:1,add:'Ajouter un actionnaire',sub:[f('nom','Nom complet ou nom de la société actionnaire','text',{req:1}),f('adresse','Adresse','text'),f('part','Pourcentage ou nombre d’actions','text',{req:1}),f('mise','Montant investi au départ','money')]}),
     f('categories','Souhaitez-vous des catégories d’actions distinctes (par exemple pour verser des dividendes différents ou pour une fiducie familiale)?','radio',{opts:['Oui','Non','Conseillez-moi']}),
     f('convention','Existe-t-il une convention entre actionnaires?','radio',{opts:['Oui','Non','Pas encore']})]),
   S('Démarrage',[f('ventes','Ventes annuelles prévues','money'),f('employes','Aurez-vous des employés?','radio',{opts:OUI}),f('employes_nb','Combien, et à partir de quand?','text',{show:oui('employes')}),
     f('banque','Institution financière pour le compte de la société','text'),f('permis','Votre activité exige-t-elle un permis ou une licence (RBQ, alcool, transport, etc.)?','radio',{opts:OUI})]),
   S('Pièces à déposer',[doc('identite','Pièce d’identité avec photo de chaque administrateur et actionnaire',{req:1}),doc('d_convention','Convention entre actionnaires',{show:oui('convention')}),doc('d_permis','Permis ou licences',{show:oui('permis')})])]},

 nouveau:{nom:'Ouverture de dossier — nouveau client (entreprise)',intro:'Bienvenue chez Boujrad CPA Inc.! Pour ouvrir votre dossier et prendre la relève de votre comptabilité, nous avons besoin de quelques renseignements et des documents de votre entreprise.',
  s:[S('L’entreprise',[f('nom_legal','Nom légal de l’entreprise','text',{req:1}),f('forme','Forme juridique','select',{opts:['Société par actions','Entreprise individuelle','Société de personnes','OBNL','Autre'],req:1}),
     f('neq','NEQ','text'),f('no_entreprise','Numéro d’entreprise fédéral (9 chiffres)','text'),f('no_tps','Numéro de TPS','text'),f('no_tvq','Numéro de TVQ','text'),
     f('adresse','Adresse de l’entreprise','text',{req:1}),f('contact','Personne-ressource','text',{req:1}),f('tel','Téléphone','tel',{req:1}),f('courriel','Courriel','email',{req:1}),
     f('fin_exercice','Date de fin d’exercice','select',{opts:MOIS.map(m=>'Fin '+m.toLowerCase()),req:1}),f('frequence','Fréquence des déclarations de TPS/TVQ','select',{opts:['Mensuelle','Trimestrielle','Annuelle','Pas inscrite']}),
     f('employeur','Avez-vous des employés (paie)?','radio',{opts:OUI}),f('logiciel','Logiciel comptable actuel','select',{opts:['Aucun','Sage 50','QuickBooks','Acomba','Excel','Autre']})]),
   S('Votre ancien comptable',[f('ancien','Nom et cabinet','text'),f('ancien_coord','Téléphone ou courriel','text')],{note:'Nous communiquerons avec lui pour le transfert du dossier, avec votre accord.'}),
   S('Pièces à déposer',[doc('statuts','Statuts constitutifs et modifications',{show:R=>/actions/.test(R.forme||'')}),doc('registre','Registre des actionnaires et des administrateurs, procès-verbaux récents',{show:R=>/actions/.test(R.forme||'')}),
     doc('etats','États financiers et déclarations de revenus des deux derniers exercices',{req:1}),doc('avis','Avis de cotisation correspondants'),doc('taxes','Dernières déclarations de TPS/TVQ'),doc('das','Sommaire des remises de retenues à la source',{show:oui('employeur')}),
     doc('balance','Balance de vérification ou sauvegarde du logiciel comptable'),doc('releves','Relevés bancaires et de cartes de crédit depuis la fin du dernier exercice',{req:1}),doc('prets','Relevés des prêts et marges de crédit'),doc('contrats','Contrats de location et de financement en cours'),
     doc('identite','Pièce d’identité avec photo des administrateurs')])]},

 finexercice:{nom:'Fin d’exercice — états financiers et déclarations T2/CO-17',intro:'Votre exercice se termine. Pour préparer vos états financiers et vos déclarations de revenus de la société (T2 et CO-17), nous avons besoin de quelques renseignements et documents.',
  s:[S('L’exercice',[f('date_fin','Date de fin de l’exercice','date',{req:1}),f('changements','Y a-t-il eu un changement d’actionnaires ou d’administrateurs?','radio',{opts:OUI,req:1}),f('changements_detail','Lesquels?','textarea',{show:oui('changements')})]),
   S('Pendant l’exercice',[f('immos','Avez-vous acheté de l’équipement, un véhicule, un ordinateur ou fait des améliorations locatives?','radio',{opts:OUI,req:1}),
     f('financement','Avez-vous signé un contrat de location ou de financement?','radio',{opts:OUI}),
     f('remuneration','Salaires et dividendes versés aux actionnaires (montant et nom)','textarea'),
     f('perso','Avez-vous payé des dépenses de l’entreprise personnellement?','radio',{opts:OUI}),
     f('vehicule','Utilisez-vous un véhicule pour l’entreprise?','radio',{opts:OUI}),f('km_total','Kilométrage total de l’année','number',{show:oui('vehicule')}),f('km_affaires','Kilométrage pour l’entreprise','number',{show:oui('vehicule')}),
     f('domicile','Avez-vous un bureau à domicile?','radio',{opts:OUI}),f('sup_bureau','Superficie du bureau (pi²)','number',{show:oui('domicile')}),f('sup_maison','Superficie de la maison (pi²)','number',{show:oui('domicile')}),
     f('inventaire','Avez-vous un inventaire à la fin de l’exercice?','radio',{opts:OUI})]),
   S('Pièces à déposer',[doc('releves','Relevés bancaires et de cartes de crédit jusqu’à la fin de l’exercice (et le relevé du mois suivant)',{req:1}),doc('prets','Relevés des prêts et marges de crédit au dernier jour de l’exercice'),
     doc('clients','Liste des comptes clients impayés à la fin de l’exercice'),doc('fournisseurs','Liste des comptes fournisseurs impayés à la fin de l’exercice'),doc('d_inventaire','Inventaire au dernier jour (quantités et coût)',{show:oui('inventaire')}),
     doc('d_immos','Factures d’achat des immobilisations',{show:oui('immos')}),doc('d_financement','Contrats de location ou de financement',{show:oui('financement')}),doc('d_perso','Factures des dépenses payées personnellement',{show:oui('perso')}),
     doc('d_domicile','Dépenses de la maison (électricité, chauffage, assurances, taxes, intérêts hypothécaires ou loyer)',{show:oui('domicile')}),doc('corresp','Correspondance reçue de Revenu Québec ou de l’ARC')])]},

 autonome:{nom:'Démarrage — travailleur autonome',intro:'Pour bien démarrer votre entreprise individuelle, nous avons besoin de quelques renseignements.',
  s:[S('Votre entreprise',[f('activite','Description de l’activité','textarea',{req:1}),f('debut','Date de début','date',{req:1}),f('nom_ent','Nom de l’entreprise, s’il est différent de votre nom','text'),
     f('revenus','Revenus annuels prévus','money',{req:1}),f('adresse','Adresse d’affaires','text'),f('tel','Téléphone','tel'),f('courriel','Courriel','email')],{note:'L’inscription à la TPS et à la TVQ est obligatoire au-delà de 30 000 $ de ventes par année.'}),
   S('Pour bien déduire vos dépenses',[f('vehicule','Utiliserez-vous un véhicule pour l’entreprise?','radio',{opts:OUI}),f('domicile','Travaillerez-vous à partir de la maison?','radio',{opts:OUI}),
     f('sup_bureau','Superficie du bureau (pi²)','number',{show:oui('domicile')}),f('sup_maison','Superficie de la maison (pi²)','number',{show:oui('domicile')}),f('compte','Avez-vous un compte bancaire distinct pour l’entreprise?','radio',{opts:OUI})]),
   S('Pièces à déposer',[doc('identite','Pièce d’identité avec photo',{req:1}),doc('avis','Dernier avis de cotisation (fédéral et Québec)'),doc('equipement','Factures des équipements achetés pour démarrer')])]},

 tpstvq:{nom:'Inscription aux fichiers de la TPS et de la TVQ',intro:'Pour inscrire votre entreprise aux fichiers de la TPS et de la TVQ, nous avons besoin de quelques renseignements.',
  s:[S('Renseignements',[f('nom_legal','Nom légal de l’entreprise (ou votre nom, pour une entreprise individuelle)','text',{req:1}),f('neq','NEQ','text'),f('adresse','Adresse de l’entreprise','text',{req:1}),
     f('activite','Description de l’activité','textarea',{req:1}),f('premiere','Date de la première vente taxable','date',{req:1}),f('ventes','Ventes annuelles prévues','money',{req:1}),
     f('frequence','Fréquence de déclaration souhaitée','select',{opts:['Conseillez-moi','Mensuelle','Trimestrielle','Annuelle']}),
     f('autorise','Nom et titre de la personne autorisée','text',{req:1}),f('tel','Téléphone de la personne autorisée','tel',{req:1})])]},

 paie:{nom:'Mise en place de la paie',intro:'Pour mettre en place la paie, nous avons besoin de quelques renseignements sur l’entreprise et sur chaque employé.',
  s:[S('L’employeur',[f('premiere','Date de la première paie','date',{req:1}),f('frequence','Fréquence de paie','select',{opts:['Hebdomadaire','Aux deux semaines','Deux fois par mois','Mensuelle'],req:1}),
     f('mode','Mode de paiement des employés','radio',{opts:['Dépôt direct','Chèque'],req:1}),f('cnesst','Taux de cotisation CNESST (si vous l’avez)','text')]),
   S('Les employés',[f('employes','','rep',{min:1,add:'Ajouter un employé',sub:[f('nom','Nom complet','text',{req:1}),f('adresse','Adresse','text',{req:1}),f('ddn','Date de naissance','date',{req:1}),f('nas','NAS','nas',{req:1}),
      f('embauche','Date d’embauche','date',{req:1}),f('poste','Poste','text'),f('salaire','Salaire (taux horaire ou annuel)','text',{req:1}),f('horaire','Heures par semaine','text')]})],{note:'Votre portail est sécurisé : c’est le bon endroit pour transmettre les NAS (jamais par courriel).'}),
   S('Pièces à déposer',[doc('td1','Formulaires TD1 et TP-1015.3 remplis et signés par chaque employé',{req:1}),doc('specimens','Spécimens de chèque des employés (dépôt direct)',{show:R=>R.mode==='Dépôt direct'})])]},

 locatif:{nom:'Immeuble locatif — revenus de location',intro:'Pour déclarer les revenus de votre immeuble locatif, nous avons besoin de quelques renseignements et documents.',
  s:[S('L’immeuble',[f('annee','Année d’imposition','number',{req:1}),f('adresse','Adresse de l’immeuble','text',{req:1}),f('premiere','Est-ce la première année que nous déclarons cet immeuble?','radio',{opts:OUI,req:1}),
     f('achat_date','Date d’achat','date',{show:oui('premiere')}),f('achat_prix','Prix payé','money',{show:oui('premiere')}),
     f('part','Votre part de propriété (%)','number',{req:1}),f('logements','Nombre de logements','number',{req:1}),f('occupe','Occupez-vous une partie de l’immeuble?','radio',{opts:OUI}),f('occupe_detail','Quelle partie (logement, % de la superficie)?','text',{show:oui('occupe')})]),
   S('Revenus',[f('loyers','Loyers perçus pour l’année (total)','money',{req:1}),f('loyers_detail','Détail par logement (facultatif)','textarea')]),
   S('Dépenses de l’année',[f('taxes','Taxes municipales et scolaires','money'),f('assurances','Assurances','money'),f('interets','Intérêts hypothécaires','money'),f('energie','Électricité et chauffage','money'),
     f('entretien','Entretien, déneigement, conciergerie','money'),f('reparations','Réparations','money'),f('gestion','Frais de gestion et de publicité','money'),f('renovations','Y a-t-il eu des rénovations majeures?','radio',{opts:OUI})]),
   S('Pièces à déposer',[doc('d_interets','Relevé des intérêts hypothécaires de l’année',{req:1}),doc('d_taxes','Comptes de taxes municipales et scolaires'),doc('d_factures','Factures de réparations et d’entretien'),
     doc('d_renovations','Factures des rénovations majeures',{show:oui('renovations')}),doc('d_achat','Acte d’achat et état de répartition du notaire',{show:oui('premiere')}),doc('d_baux','Liste des locataires au 31 décembre ou baux')])]},

 verification:{nom:'Demande de renseignements ou vérification (ARC ou Revenu Québec)',intro:'Vous avez reçu une demande de Revenu Québec ou de l’Agence du revenu du Canada. Pour y répondre en votre nom, transmettez-nous la lettre et les documents demandés.',
  s:[S('La demande',[f('organisme','Organisme','radio',{opts:['Revenu Québec','Agence du revenu du Canada','Les deux'],req:1}),f('limite','Date limite indiquée dans la lettre','date',{req:1}),
     f('agent','Nom et coordonnées de l’agent, s’il y en a','text'),f('resume','Ce qui est demandé, en vos mots (facultatif)','textarea')],{note:'Si l’agent vous contacte directement, dites-lui que Boujrad CPA Inc. vous représente. Évitez de lui fournir des documents sans nous en parler.'}),
   S('Pièces à déposer',[doc('lettre','La lettre ou l’avis reçu (toutes les pages)',{req:1}),doc('demandes','Les documents demandés dans la lettre')])]},

 dissolution:{nom:'Fermeture ou dissolution d’une société',intro:'Pour fermer votre société correctement et produire les déclarations finales, nous avons besoin de quelques renseignements.',
  s:[S('La fermeture',[f('cessation','Date de cessation des activités','date',{req:1}),f('actifs','Ce qu’il advient des actifs (vendus ou remis aux actionnaires) et à quelle valeur','textarea',{req:1}),
     f('dettes','Soldes des prêts et liste des créanciers à payer','textarea'),f('paie','Des paies ont-elles été versées cette année?','radio',{opts:OUI,req:1})]),
   S('Les actionnaires',[f('actionnaires','','rep',{min:1,add:'Ajouter un actionnaire',sub:[f('nom','Nom complet','text',{req:1}),f('adresse','Adresse à jour','text',{req:1}),f('courriel','Courriel','email')]})]),
   S('Pièces à déposer',[doc('releves','Derniers relevés bancaires, jusqu’à la fermeture du compte',{req:1}),doc('prets','Relevés des prêts'),doc('d_paie','Registre des dernières paies',{show:oui('paie')})])],
  fin:'Nous fermerons ensuite les comptes de TPS/TVQ et de retenues à la source, puis préparerons les déclarations finales et la demande de dissolution.'},

 disposition:{nom:'Vente d’un immeuble ou de placements (gain en capital)',intro:'Pour calculer correctement le gain ou la perte sur la vente de votre bien, nous avons besoin de quelques renseignements et documents.',
  s:[S('Le bien vendu',[f('type','Type de bien','radio',{opts:['Immeuble locatif','Résidence','Chalet ou terrain','Actions ou fonds','Cryptomonnaies','Autre'],req:1}),f('description','Description ou adresse','text',{req:1}),
     f('date_vente','Date de vente','date',{req:1}),f('prix_vente','Prix de vente','money',{req:1}),f('frais_vente','Frais de vente (courtier, notaire, etc.)','money'),
     f('date_achat','Date d’achat','date'),f('prix_achat','Prix d’achat initial','money'),f('ameliorations','Coût des rénovations ou améliorations majeures','money',{show:R=>/Immeuble|Résidence|Chalet/.test(R.type||'')}),
     f('residence','A-t-il été votre résidence principale?','radio',{opts:['Oui, toutes les années','Oui, certaines années','Non'],show:R=>/Résidence|Chalet/.test(R.type||'')}),
     f('annees','Pour quelles années?','text',{show:R=>R.residence==='Oui, certaines années'})]),
   S('Pièces à déposer',[doc('d_vente','Acte de vente ou confirmation de la transaction',{req:1}),doc('d_achat','Acte d’achat ou relevé du coût d’origine'),doc('d_reno','Factures des rénovations',{show:R=>/Immeuble|Résidence|Chalet/.test(R.type||'')}),
     doc('d_feuillets','Feuillets T5008, relevés 18 et relevés de courtage',{show:R=>/Actions|Crypto/.test(R.type||'')})])]},

 req:{nom:'Mise à jour annuelle au Registraire des entreprises',intro:'Nous préparons la déclaration de mise à jour annuelle de votre entreprise au Registraire des entreprises. Confirmez ou corrigez les renseignements de l’an dernier.',
  s:[S('Vos renseignements',[f('aucun','Aucun changement depuis l’an dernier','radio',{opts:['Aucun changement','Il y a des changements'],req:1}),
     f('siege','Nouvelle adresse du siège social','text',{show:R=>R.aucun==='Il y a des changements'}),f('admins','Changements d’administrateurs ou de dirigeants (nom, adresse, fonction)','textarea',{show:R=>R.aucun==='Il y a des changements'}),
     f('actionnaires','Changements dans les trois principaux actionnaires','textarea',{show:R=>R.aucun==='Il y a des changements'}),f('activites','Changement d’activités','textarea',{show:R=>R.aucun==='Il y a des changements'}),
     f('salaries','Nombre de salariés au Québec','number',{req:1})])]}
};
// Section commune à la fin de chaque questionnaire
const FIN=S('Pour terminer',[doc('autres','Autres documents utiles (facultatif)'),f('commentaires','Questions ou précisions pour le cabinet','textarea'),
  f('consent','J’autorise Boujrad CPA Inc. à recueillir, utiliser et conserver ces renseignements et documents uniquement pour réaliser ce mandat, et je confirme avoir l’autorisation des personnes nommées.','check',{req:1})]);
const sections=id=>Q[id]?[...Q[id].s,FIN]:[];
const vis=(x,R)=>!x.show||x.show(R);
const vide=v=>v==null||v===''||v===false||(Array.isArray(v)&&!v.length);
const nasOk=v=>{const d=String(v||'').replace(/\D/g,'');if(d.length!==9)return false;let s=0;for(let i=0;i<9;i++){let n=+d[i];if(i%2){n*=2;if(n>9)n-=9}s+=n}return s%10===0};
const money=v=>v===''||v==null||isNaN(+v)?String(v??''):new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(+v);

/* ---------- rendu du formulaire (portail) ---------- */
function input(x,v,attr,esc){const req=x.req?' req':'';
  if(x.t==='select')return `<label class="f"><b class="${req}">${esc(x.l)}</b><select ${attr}><option value=""></option>${x.opts.map(o=>`<option${v===o?' selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
  if(x.t==='radio')return `<fieldset style="border:0;padding:0;margin:0;grid-column:1/-1"><legend style="font-size:14px;margin-bottom:4px"><b class="${req}">${esc(x.l)}</b></legend><div class="row" style="gap:6px 22px">${x.opts.map(o=>`<label class="opt"><input type="radio" name="r_${attr.replace(/\W/g,'')}" ${attr} value="${esc(o)}"${v===o?' checked':''}> ${esc(o)}</label>`).join('')}</div></fieldset>`;
  if(x.t==='check')return `<label class="opt" style="grid-column:1/-1"><input type="checkbox" ${attr}${v?' checked':''}> <span${x.req?' class="req"':''}>${esc(x.l)}</span></label>`;
  if(x.t==='textarea')return `<label class="f" style="grid-column:1/-1"><b class="${req}">${esc(x.l)}</b><textarea ${attr}>${esc(v??'')}</textarea></label>`;
  const ty=x.t==='money'||x.t==='number'?'number" step="any" inputmode="decimal':x.t==='nas'?'text" inputmode="numeric" placeholder="123 456 789':x.t;
  return `<label class="f"><b class="${req}">${esc(x.l)}${x.t==='money'?' ($)':''}</b><input type="${ty}" ${attr} value="${esc(v??'')}"></label>`}
function formHtml(id,R,F,esc){return sections(id).map(sec=>{const c=sec.c.filter(x=>vis(x,R));if(!c.length)return'';
  return `<h3>${esc(sec.t)}</h3>${sec.note?`<p class="sub" style="margin:0 0 8px;font-size:14px">${esc(sec.note)}</p>`:''}<div class="grid">${c.map(x=>{
    if(x.t==='rep'){const L=R[x.k]||[];return `<div style="grid-column:1/-1">${L.map((it,i)=>`<div class="rep"><div class="row" style="justify-content:space-between"><strong>${i+1}.</strong>${L.length>(x.min||0)?`<button type="button" class="sm danger" data-qdel="${x.k}|${i}">Retirer</button>`:''}</div><div class="grid">${x.sub.map(s=>input(s,it[s.k],`data-qr="${x.k}" data-i="${i}" data-qk="${s.k}"`,esc)).join('')}</div></div>`).join('')}<button type="button" class="sm" data-qadd="${x.k}">+ ${esc(x.add||'Ajouter')}</button></div>`}
    if(x.t==='doc'){const L=F.filter(y=>y.doc===x.k);return `<div class="rep" style="grid-column:1/-1"><div class="row" style="justify-content:space-between;align-items:center"><b class="${x.req?'req':''}">${esc(x.l)}</b><label class="sm" style="cursor:pointer;border:1px solid var(--line);border-radius:8px;padding:6px 12px;background:#fff">Déposer un fichier<input type="file" multiple data-qfile="${x.k}" hidden accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.csv,.xlsx,.xls,.doc,.docx,.zip"></label></div>
      ${L.length?`<ul style="margin:8px 0 0">${L.map(y=>`<li>${esc(y.nom)} <button type="button" class="sm" data-qrm="${esc(y.path)}" style="padding:2px 8px">Retirer</button></li>`).join('')}</ul>`:'<p class="sub" style="margin:6px 0 0;font-size:13px">Aucun fichier.</p>'}</div>`}
    return input(x,R[x.k],`data-q="${x.k}"`,esc)}).join('')}</div>`}).join('')}

/* ---------- validation ---------- */
function erreurs(id,R,F){const E=[];sections(id).forEach(sec=>sec.c.forEach(x=>{if(!vis(x,R))return;
  if(x.t==='rep'){const L=R[x.k]||[];if(L.length<(x.min||0))E.push(`${sec.t} : ajoutez au moins ${x.min===1?'une personne':x.min}.`);
    L.forEach((it,i)=>x.sub.forEach(s=>{if(s.req&&vide(it[s.k]))E.push(`${sec.t} ${i+1} : « ${s.l} » est requis.`);if(s.t==='nas'&&it[s.k]&&!nasOk(it[s.k]))E.push(`${sec.t} ${i+1} : le NAS n’est pas valide.`)}));return}
  if(x.t==='doc'){if(x.req&&!F.some(y=>y.doc===x.k))E.push(`Déposez : ${x.l}.`);return}
  if(x.req&&vide(R[x.k]))E.push(x.t==='check'?'Le consentement est requis.':`${sec.t} : « ${x.l} » est requis.`)}));return E}

/* ---------- sommaire pour le cabinet ---------- */
function val(x,v){if(vide(v))return'';if(x.t==='check')return'Oui';if(x.t==='money')return money(v);if(x.t==='date')return new Date(v+'T12:00').toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'});return String(v)}
function resumeHtml(id,R,F,esc){return sections(id).map(sec=>{const rows=sec.c.filter(x=>vis(x,R)).map(x=>{
    if(x.t==='rep')return(R[x.k]||[]).map((it,i)=>`<tr><th style="width:38%;vertical-align:top">${i+1}.</th><td>${x.sub.map(s=>val(s,it[s.k])?`${esc(s.l)} : <strong>${esc(val(s,it[s.k]))}</strong>`:'').filter(Boolean).join('<br>')}</td></tr>`).join('');
    if(x.t==='doc'){const L=F.filter(y=>y.doc===x.k);if(!L.length&&!x.req)return'';return `<tr><th style="width:38%;vertical-align:top">${esc(x.l)}</th><td>${L.map(y=>`<button class="sm" data-file="${esc(y.path)}" style="margin:2px">${esc(y.nom)}</button>`).join('')||'<span class="pill r">Non déposé</span>'}</td></tr>`}
    const v=val(x,R[x.k]);if(!v)return'';return `<tr><th style="width:38%;vertical-align:top;font-weight:500">${esc(x.l||'')}</th><td style="white-space:pre-wrap"><strong>${esc(v)}</strong></td></tr>`}).join('');
  return rows?`<h3>${esc(sec.t)}</h3><table class="qres"><tbody>${rows}</tbody></table>`:''}).join('')}

/* ---------- courriel au client ---------- */
function courriel(id,c,lien){const q=Q[id];return `Bonjour${c?.contact?' '+c.contact:''},

${q.intro}

Pour nous les transmettre en toute sécurité, remplissez le questionnaire en ligne et déposez les pièces demandées dans votre portail client :

${lien}

Le questionnaire porte sur :
${q.s.map(s=>'• '+s.t).join('\n')}

Connectez-vous à votre portail client, ou créez votre compte avec votre adresse courriel si ce n’est pas déjà fait. Vos réponses sont enregistrées au fur et à mesure : vous pouvez commencer maintenant et terminer plus tard.
${q.fin?`\n${q.fin}\n`:''}
N’hésitez pas à nous écrire si vous avez des questions.

Cordialement,

Boujrad CPA Inc.`}

/* ---------- fiche client à partir des réponses ---------- */
function fiche(id,R){const mi=MOIS.findIndex(m=>(R.fin_exercice||'').toLowerCase()==='fin '+m.toLowerCase()),fe=mi<0?'':String(mi+1).padStart(2,'0')+'-'+String(new Date(Date.UTC(2025,mi+1,0)).getUTCDate()).padStart(2,'0');const nom=R.nom_legal||(R.numerotee?'':R.nom1)||R.nom_ent||'';
  return{nom:nom||'Nouvelle société (à confirmer)',courriel:R.courriel||null,telephone:R.tel||null,adresse:R.siege||R.adresse||null,neq:R.neq||null,no_entreprise:R.no_entreprise||null,no_tps:R.no_tps||null,no_tvq:R.no_tvq||null,
    contact:R.contact||(R.admins||[])[0]?.nom||null,type:'entreprise',forme:id==='autonome'?'Entreprise individuelle':R.forme&&R.forme!=='Autre'?R.forme:'Société par actions',employeur:R.employeur==='Oui'||R.employes==='Oui',
    ...(fe?{fin_exercice:fe}:{}),...(/Mensuelle|Trimestrielle|Annuelle/.test(R.frequence||'')?{frequence:R.frequence.toLowerCase()}:{})}}

window.QUEST={liste:Q,sections,formHtml,erreurs,resumeHtml,courriel,fiche,nasOk};
})();
