{
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const money=new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'});
const fmt=c=>money.format(c/100);
const AMBIG=/\b(INTERAC|VIREMENT|VIR|DEPOT|DEP|TRANSFERT|TRANSFER|E-TRANSFER|ETRANSFER|RETRAIT|GAB|DAB|ATM|CHEQUE|CHQ|PAIEMENT|PMT|PAIE|TRF|TFR)\b/;
const MOISN=['janv.','févr.','mars','avr.','mai','juin','juill.','août','sept.','oct.','nov.','déc.'];
const moisLbl=m=>{const[y,mm]=String(m||'').split('-');return mm?`${MOISN[+mm-1]} ${y}`:'—'};

/* Catégories : retrouvent le bon compte dans n'importe quel plan */
const isTr=t=>t.st==='transit'||(!!C&&!!C.tr&&t.acct===C.tr);
/* À classer « maintenant » : recalculé avec les règles actuelles (le chiffre enregistré avec la période peut dater d’avant une règle). */
/* « À classer » = jamais classée (st transit). Une transaction mise volontairement au compte transitoire est classée, mais reste « à régulariser ». */
const aCl=t=>t.st==='transit';
const enTr=t=>t.st!=='transit'&&!!C&&!!C.tr&&t.acct===C.tr;
const todoNow=p=>{if(!Array.isArray(p.tx))return +p.todo||0;const L=p.tx.map(t=>{const c={...t};try{classify(c)}catch(e){}return c});p.trn=L.filter(enTr).length;return p.todo=L.filter(aCl).length};
const CAT={carb:/CARBURANT|ESSENCE|\bGAZ\b|FUEL|COMBUSTIBLE|VEHICULE/,elec:/ELECTRICITE|HYDRO|ENERGIE|CHAUFFAGE|SERVICES PUBLICS/,tel:/TELECOM|TELEPHON|INTERNET|CELLULAIRE|COMMUNICATION/,fb:/FRAIS BANC|FRAIS DE BANQUE|FRAIS DE SERVICE|BANK/,int:/INTERET|FRAIS FINANCIERS/,rep:/REPAS|REPRESENTATION|DIVERTISSEMENT/,log:/LOGICIEL|ABONNEMENT|INFORMATIQUE/,four:/FOURNITURE|PAPETERIE|FRAIS DE BUREAU/,ass:/ASSURANCE/,imm:/IMMATRICUL|PERMIS|LICENCE/,veh:/ENTRETIEN.*VEHICULE|VEHICULE|DEPENSES? (DE |D')?(VEHICULE|AUTOMOBILE)|FRAIS DE VEHICULE|AUTOMOBILE/,pub:/PUBLICITE|MARKETING|PROMOTION/};
const BASE=[["PETRO-CANADA","carb",1],["PETRO CANADA","carb",1],["ESSO","carb",1],["SHELL","carb",1],["ULTRAMAR","carb",1],["COUCHE-TARD","carb",1],["CREVIER","carb",1],["IRVING","carb",1],["HYDRO-QUEBEC","elec",1],["HYDRO QUEBEC","elec",1],["ENERGIR","elec",1],["VIDEOTRON","tel",1],["BELL CANADA","tel",1],["BELL MOBILITE","tel",1],["ROGERS","tel",1],["FIDO","tel",1],["TELUS","tel",1],["KOODO","tel",1],["FRAIS MENSUELS","fb",0],["FRAIS DE SERVICE","fb",0],["FRAIS BANCAIRES","fb",0],["FRAIS D'UTILISATION","fb",0],["INTERETS","int",0],["TIM HORTONS","rep",1],["MCDONALD","rep",1],["STARBUCKS","rep",1],["UBER EATS","rep",1],["ADOBE","log",1],["MICROSOFT","log",1],["GOOGLE","log",1],["INTUIT","log",1],["ZOOM","log",1],["BUREAU EN GROS","four",1],["STAPLES","four",1],["INTACT","ass",0],["DESJARDINS ASSURANCES","ass",0],["LA CAPITALE","ass",0],["BELAIR","ass",0],["SAAQ","imm",0],["CANADIAN TIRE","veh",1],["FACEBK","pub",1],["META ADS","pub",1]].map(([p,c,t])=>({p:norm(p),c,t:!!t}));
const DEF_PLAN=`1000 ACTIF
1010 Petite caisse
1040 Compte transitoire
1055 Compte d'épargne
1060 Compte courant
1065 Compte courant (2e compte)
1067 Compte bancaire en devises US
1100 Placements temporaires
1200 Comptes clients
1205 Provision pour créances douteuses
1210 Autres débiteurs
1215 Subventions et crédits d'impôt à recevoir
1220 Avances à des sociétés liées
1225 Avances à l'actionnaire
1230 Prêts consentis
1250 Impôts sur le revenu à recevoir
1300 Stocks
1320 Frais payés d'avance
1325 Dépôts et garanties
1500 Placements à long terme
1510 Placements dans des sociétés liées
1700 Matériel et équipement
1705 Amortissement cumulé - matériel et équipement
1710 Mobilier et agencements
1715 Amortissement cumulé - mobilier et agencements
1720 Matériel informatique
1725 Amortissement cumulé - matériel informatique
1730 Matériel roulant
1735 Amortissement cumulé - matériel roulant
1740 Améliorations locatives
1745 Amortissement cumulé - améliorations locatives
1750 Bâtiment
1755 Amortissement cumulé - bâtiment
1760 Terrain
1800 Logiciels
1805 Amortissement cumulé - logiciels
1850 Achalandage
1860 Frais de constitution
2000 PASSIF
2050 Marge de crédit
2100 Comptes fournisseurs
2110 Charges à payer
2120 Salaires à payer
2125 Vacances à payer
2130 DAS à payer (retenues à la source)
2140 Carte de crédit Visa
2145 Carte de crédit Mastercard
2150 Carte de crédit American Express
2160 Impôts sur le revenu à payer
2170 Dividendes à payer
2180 Revenus reportés et acomptes de clients
2190 Intérêts courus
2310 TPS perçue
2315 TPS payée (CTI)
2320 TVQ perçue
2325 TVQ payée (RTI)
2330 TPS à remettre (solde net)
2335 TVQ à remettre (solde net)
2400 Tranche de la dette échéant à moins d'un an
2600 Emprunt bancaire à long terme
2610 Emprunt hypothécaire
2620 Obligations locatives
2640 Avances de l'actionnaire
2650 Avances de sociétés liées
3000 CAPITAUX PROPRES
3100 Capital-actions
3200 Surplus d'apport
3500 Bénéfices non répartis
3600 Dividendes
4000 PRODUITS
4010 Ventes
4020 Revenus de services
4030 Revenus d'honoraires
4050 Revenus de location
4080 Escomptes et retours sur ventes
4400 Revenus d'intérêts
4410 Revenus de dividendes
4420 Subventions
4450 Gain (perte) sur disposition d'actifs
4460 Revenus divers
5000 COÛT DES VENTES
5010 Achats de marchandises
5020 Variation des stocks
5030 Sous-traitance
5040 Fret et transport sur achats
5050 Matériaux et fournitures directes
5100 Salaires et traitements
5110 Charges sociales de l'employeur
5120 Avantages sociaux
6000 FRAIS D'EXPLOITATION
6010 Publicité et promotion
6020 Assurances
6030 Frais bancaires
6040 Intérêts et frais financiers
6050 Intérêts sur la dette à long terme
6060 Honoraires comptables et juridiques
6065 Honoraires de consultants
6070 Frais de bureau
6075 Fournitures de bureau
6080 Logiciels et abonnements
6090 Télécommunications
6100 Électricité et chauffage
6110 Loyer
6120 Entretien et réparations
6130 Carburant
6140 Entretien de véhicule
6150 Immatriculation et permis
6160 Location de véhicule
6170 Repas et représentation
6180 Déplacements et voyages
6190 Formation et congrès
6200 Cotisations professionnelles
6210 Taxes et permis d'affaires
6220 Taxes foncières
6230 Créances irrécouvrables
6240 Dons
6250 Frais de poste et de livraison
6260 Fournitures d'exploitation
6270 Frais de carte de crédit et de paiement
6280 Pertes de change
6300 Amortissement des immobilisations
6310 Amendes et pénalités
6320 Frais divers
9000 IMPÔTS
9010 Impôts sur le revenu`;

let db=null,sampleFn=null,downloads=null,local=false;
let SEL=new Set(),idFilter=null,PREV=[],AIITEMS=[];let CLIENTS=[],C=null,PLAN=[],OPTS='',P=null,filter='todo',tab='home',parsed=null,toastT=null,seq=0;
const LOCAL={clients:{},periodes:{}};

/* ---------- plan comptable ---------- */
function parsePlanText(s){return String(s||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/^(\S+)\s+(.*)$/);return m?[m[1],m[2]]:[l,'']})}
function setPlan(){PLAN=parsePlanText(C.plan);OPTS=PLAN.map(([n,t])=>`<option value="${esc(n)}">${esc(n+' '+t)}</option>`).join('')}
const accName=a=>{const p=PLAN.find(x=>x[0]===a);return p?p[1]:'(hors plan)'};
const optsSel=v=>{let o='<option value="__new">+ Nouveau compte…</option>'+OPTS.replace(`value="${esc(v)}"`,`value="${esc(v)}" selected`);if(v&&!PLAN.some(p=>p[0]===v))o+=`<option selected value="${esc(v)}">${esc(v)} (hors plan)</option>`;return o};
const newAccts=()=>C&&Array.isArray(C.sage)?PLAN.filter(p=>!C.sage.includes(p[0])):[];
function usedNew(){if(!P)return[];const nw=new Map(newAccts());const used=new Set();P.tx.forEach(t=>lines(t).forEach(([a])=>{if(nw.has(a))used.add(a)}));return [...used].sort().map(a=>[a,nw.get(a)])}
const isHeader=(n,t)=>/^(TOTAL|NET\b|SOUS-TOTAL)/.test(norm(t))||(/^\d{4}$/.test(n)&&+n%1000===0);
const bnrAcc=()=>findAcc(/NON REPARTIS|NON DISTRIBUES/)||findAcc(/BENEFICES REPORTES/)||findAcc(/^SURPLUS(?!.*APPORT)/)||'3560';
const findAcc=(re,exp)=>{const L=PLAN.filter(([n,t])=>re.test(norm(t))&&!isHeader(n,t));return (exp?L.find(([n])=>/^[5-9]/.test(n)):L[0])?.[0]||''};
function detectSpecial(c){const pl=parsePlanText(c.plan),f=re=>pl.find(([,t])=>re.test(norm(t)))?.[0]||'';
  return {tr:f(/TRANSITOIRE|D'ATTENTE|EN SUSPENS|SUSPENSE|A CLASSER/)||c.tr||'',tpsA:f(/\bCTI\b/)||f(/TPS.*(\bPAYEES?\b|RECUP|A RECEVOIR)/)||c.tpsA||'',tvqA:f(/\bRTI\b/)||f(/TVQ.*(\bPAYEES?\b|RECUP|A RECEVOIR)/)||c.tvqA||'',tpsV:f(/TPS.*(PERCUE|A PAYER|FACTUREE)/)||c.tpsV||'',tvqV:f(/TVQ.*(PERCUE|A PAYER|FACTUREE)/)||c.tvqV||''}}
const banqueDef=()=>{const SA=srcAccounts();return(SA.find(([n,t])=>/COMPTE COURANT|COURANT|CHEQUE/.test(norm(t)))||SA.find(([n,t])=>/BANQUE|ENCAISSE/.test(norm(t)))||SA[0]||[''])[0]};
const srcAccounts=()=>{const s=PLAN.filter(([n,t])=>/^[12]/.test(n)&&/BANQUE|BANCAIRE|ENCAISSE|COURANT|CHEQUE|CAISSE|EPARGNE|CARTE|VISA|MASTERCARD|AMEX|MARGE|PAYPAL|STRIPE|SQUARE|WISE/.test(norm(t)));return s.length?s:(PLAN.filter(([n])=>/^[12]/.test(n)).length?PLAN.filter(([n])=>/^[12]/.test(n)):PLAN)};
/* ---------- devises : comptes en dollars US ----------
   Les transactions d'un compte en USD gardent leur montant d'origine (conciliation, doublons et relevés restent en US$);
   le grand livre les convertit en $ CA au taux quotidien de la Banque du Canada, ou au montant réel d'un virement apparié (t.cad). */
const devOf=a=>(C&&C.dev&&C.dev[a])||(C&&/\bUSD\b|DEVISES? US|DOLLARS? US|\bUS\$/.test(norm(accName(a)))?'USD':'CAD');
const comptesUSD=()=>C?srcAccounts().map(p=>p[0]).concat(Object.keys(C.dev||{})).filter((a,i,L)=>L.indexOf(a)===i&&devOf(a)==='USD'):[];
function tauxDe(d){const T=C?.taux||{};if(T[d])return T[d];let k=null;for(const x in T)if(x<=d&&(!k||x>k))k=x;return k&&dd(k,d)<=10?T[k]:null}
async function tauxAssurer(de,a){if(!C||!de||!a)return;const auj=new Date().toISOString().slice(0,10);if(a>auj)a=auj;if(de>a)return;const c=C.tauxCouv;if(c&&c.de<=de&&c.a>=a)return;
  const D=addDays(c&&c.de<de?c.de:de,-10),A=c&&c.a>a?c.a:a;let r=null;
  try{if(window.tlTaux){const{data,error}=await window.tlTaux(D,A);if(!error&&data?.taux&&Object.keys(data.taux).length)r=data.taux}}catch(e){}
  if(!r)try{const j=await(await fetch(`https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${D}&end_date=${A}`)).json();r={};(j.observations||[]).forEach(o=>{if(o.FXUSDCAD?.v)r[o.d]=+o.FXUSDCAD.v})}catch(e){}
  if(r&&Object.keys(r).length){C.taux={...(C.taux||{}),...r};C.tauxCouv={de:D,a:A};saveClient()}}
const fxAcc=()=>findAcc(/\bCHANGE\b/)||'';
function fxAccAssurer(){let a=fxAcc();if(a)return a;const pris=new Set(PLAN.map(p=>p[0]));a=['4950','4900','4990','4800','7950'].find(n=>!pris.has(n))||'4951';addAccount(a,'Gain (perte) de change');return a}
/* méthode de comptabilisation : choisie dans Paramètres; sinon comptabilité de caisse tant qu'aucune facture de vente n'est versée */
const METH={caisse:'Comptabilité de caisse : ce qui entre à la banque est un revenu (ou un apport, un prêt, un virement), ce qui sort est une dépense (ou un remboursement, un retrait de l’actionnaire). Pas de comptes clients ni fournisseurs.',factures:'Factures appariées aux paiements : les ventes et les achats sont inscrits par facture; chaque dépôt ou paiement est apparié à sa facture (comptes clients et fournisseurs).',adeposer:'Ventes dans « Transactions à déposer » : les factures de vente sont portées au débit de ce compte; chaque dépôt en banque vient le réduire, sans appariement client par client. Le solde = ventes pas encore encaissées.'};
const methodeEff=()=>C?.methode||((INV||[]).some(i=>i.type!=='achat')?'factures':'caisse');
const adepAcc=()=>findAcc(/A DEPOSER/)||'';
function adepAssurer(){let a=adepAcc();if(a)return a;const pris=new Set(PLAN.map(p=>p[0]));a=['1080','1085','1090','1095','1150'].find(n=>!pris.has(n))||'1099';addAccount(a,'Transactions à déposer');return a}
/* ---------- virements entre les comptes de l'entreprise (banques, cartes, PayPal; en CAD ou en USD) ----------
   Les deux côtés sont appariés : un seul est compté au grand livre, l'autre est marqué « déjà compté ». Entre devises, c'est le côté en $ CA
   qui est compté : le compte en US$ reçoit ainsi le coût réel de l'opération de change. */
const VIR=/VIREMENT|TRANSFER|TRANSFERT|\bTFR\b|\bCHANGE\b|\bFX\b|PAIEMENT.{0,20}(VISA|CARTE|MASTERCARD|AMEX)|PAYMENT.{0,14}(THANK|RECEIVED|MERCI)|PAIEMENT MERCI|PAYPAL|WITHDRAWAL|RETRAIT|CONVERSION/;
async function pairInterne(){if(!C)return 0;const L=await iaPeriodes();if(new Set(L.map(p=>p.src)).size<2)return 0;
  L.forEach(p=>{if(P&&!P.multi&&P.mois===p.mois&&P.src===p.src)p.tx=P.tx});
  const ud=L.filter(p=>devOf(p.src)==='USD').flatMap(p=>(p.tx||[]).map(t=>t.date)).sort();if(ud.length)await tauxAssurer(ud[0],ud[ud.length-1]);
  const est=(t,src)=>devOf(src)==='USD'?(tauxDe(t.date)?t.amt*tauxDe(t.date):null):t.amt;
  const pool=[];L.forEach(p=>(p.tx||[]).forEach(t=>{if(t.pair||t.st==='manuel'||t.st==='facture'||lk(t.date))return;pool.push({p,t,src:p.src,c:est(t,p.src),k:VIR.test(norm(t.desc))})}));
  pool.sort((a,b)=>a.t.date.localeCompare(b.t.date));const ch=new Set();let n=0;
  for(const a of pool){if(a.t.pair||a.t.amt>=0||a.c==null)continue;
    const C_=pool.filter(b=>!b.t.pair&&b.src!==a.src&&b.t.amt>0&&b.c!=null&&dd(a.t.date,b.t.date)<=4&&(a.k||b.k)&&(devOf(a.src)===devOf(b.src)?b.t.amt===-a.t.amt:Math.abs(a.c+b.c)<=Math.abs(a.c)*0.04));
    if(!C_.length)continue;const meme=x=>devOf(x.src)===devOf(a.src)?0:1;const b=C_.sort((x,y)=>meme(x)-meme(y)||dd(a.t.date,x.t.date)-dd(a.t.date,y.t.date)||Math.abs(a.c+x.c)-Math.abs(a.c+y.c))[0];
    const keep=devOf(a.src)!==devOf(b.src)&&devOf(a.src)==='USD'?b:a,mir=keep===a?b:a,id='v'+Date.now().toString(36)+n;
    Object.assign(keep.t,{acct:mir.src,tax:false,st:'apparie',unk:false,pair:id,why:`Virement entre vos comptes : ${mir.src} ${accName(mir.src)}, ${mir.t.date}`});
    Object.assign(mir.t,{acct:keep.src,tax:false,st:'apparie',unk:false,pair:id,mirror:true,why:`Déjà compté avec ${keep.src} ${accName(keep.src)} (${keep.t.date}) : virement entre vos comptes`});
    ch.add(a.p);ch.add(b.p);n++}
  for(const p of ch){p.updated=new Date().toISOString();p.todo=(p.tx||[]).filter(t=>isTr(t)&&!t.mirror).length;if(P&&!P.multi&&P.mois===p.mois&&P.src===p.src){savePerNow();continue}
    if(local)LOCAL.periodes[C.id+'/'+p.mois+'_'+p.src]=p;else await db.collection('clients').doc(C.id).collection('periodes').doc(p.mois+'_'+p.src).set(p)}
  if(n){LED=null;audit('Virements appariés',`${n} virement(s) entre les comptes de l’entreprise`)}return n}
let pairT=null;function pairPlus(){clearTimeout(pairT);pairT=setTimeout(async()=>{try{const n=await pairInterne();if(n){msg(`${$('msg').textContent} ${n} virement(s) entre vos comptes apparié(s) : comptés une seule fois.`.trim());if(P)P.multi?openRange():render()}}catch(e){console.warn(e)}},1200)}

/* ---------- classement ---------- */
const baseResolved=()=>BASE.map(r=>({...r,a:findAcc(CAT[r.c],true)}));
function classify(t,src){
  if(lk(t.date))return;if(t.pair)return;
  if(t.st==='manuel'||t.st==='suggere'||t.st==='facture')return;
  const n=norm(t.desc);
  const r=[...(C.rules||[])].sort((a,b)=>spec(b.p)-spec(a.p)||(b.d||'').localeCompare(a.d||'')||b.p.length-a.p.length).find(r=>r.p&&has(n,r.p)&&(!r.d||t.date>=r.d)&&(!r.s||r.s==='les deux'||(r.s==='sortie'?t.amt<0:t.amt>0)));
  if(t.st==='apparie'){if(r&&r.a!==C.tr&&spec(r.p)>0)Object.assign(t,{acct:r.a,tax:r.t,st:'auto',why:'Règle du client : '+r.p,unk:false});return}
  if(r){Object.assign(t,{acct:r.a,tax:r.t,st:'auto',why:'Règle du client : '+r.p,unk:false});return}
  const b=baseResolved().filter(r=>r.a).sort((a,b)=>b.p.length-a.p.length).find(r=>n.includes(r.p));
  if(b){Object.assign(t,{acct:b.a,tax:b.t,st:'auto',why:'Règle de base : '+b.p,unk:false});return}
  if(t.amt>0&&C.methode==='adeposer'&&adepAcc()&&!/^2/.test(String(src||P?.src||''))&&!VIR.test(n)&&!/GOUV|REVENU QUEBEC|\bRQ\b|\bARC\b|\bCRA\b|RECEIVER GENERAL|RECEVEUR GENERAL|\bTPS\b|\bTVQ\b|\bGST\b|INTERET|INTEREST|\bPRET\b|LOAN|CONTREPASSE|REVERSAL|REMBOURSEMENT|REFUND/.test(n)){Object.assign(t,{acct:adepAcc(),tax:false,st:'auto',why:'Méthode du dossier : dépôt porté en réduction des transactions à déposer',unk:false});return}
  t.acct=C.tr;t.tax=false;t.st='transit';
  if(AMBIG.test(n)){t.why='Sans détail : à réviser';t.unk=false}else{t.why='Fournisseur inconnu';t.unk=true}
}
const GENW=/^(PAIEMENT|PAIEMENTS|PMT|DIVERS|DIV|VIREMENT|VIR|ENVOYE|RECU|DEPOT|RETRAIT|PAR|BANQUE|EN|DE|DU|LA|LE|DIRECT|INTERAC|FRAIS|POUR|TRANSFERT|CREDIT|DEBIT|ACHAT|SANS|CONTACT)$/;
const spec=p=>p.split(' ').filter(w=>!GENW.test(w)).join('').replace(/[^A-Z0-9]/g,'').length;
const has=(n,p)=>{if(n.includes(p))return true;const w=p.split(' ');if(w.some(x=>x.length<2)){const c=p.replace(/[^A-Z0-9]/g,'');return c.length>=3&&n.replace(/[^A-Z0-9]/g,'').includes(c)}return w.every(x=>n.includes(x))};
const reclass=()=>{if(P)P.tx.forEach(classify)};
const keyOf=d=>{const n=norm(d).replace(/[#*]/g,' ').replace(/\b\d[\d-]*\b/g,' ').replace(/\s+/g,' ').trim();if(AMBIG.test(n))return n;const STOP=/^(DE|DU|DES|LA|LE|LES|ET|D|L|THE|OF|INC|LTEE|LTD)$/;return n.split(' ').filter(w=>w.length>1&&!STOP.test(w)).slice(0,2).join(' ')||n};

/* ---------- base de données ---------- */
const cleanClient=c=>({nom:c.nom,plan:c.plan,tr:c.tr,tpsA:c.tpsA,tvqA:c.tvqA,tpsV:c.tpsV,tvqV:c.tvqV,dfmt:c.dfmt||'yy',notes:c.notes||'',desc:c.desc||'',profil:c.profil||null,ign:c.ign||{},sansAct:c.sansAct||[],chkOff:c.chkOff||[],sage50:!!c.sage50,ajeMemo:c.ajeMemo||[],lk2:!!c.lk2,lkAvant:c.lkAvant||'',lkLog:c.lkLog||[],gifiIa:c.gifiIa||{},immoOk:c.immoOk||{},verifTx:c.verifTx||{},attente:c.attente||[],attenteSt:c.attenteSt||[],rules:c.rules||[],gifi:c.gifi||{},cf:c.cf||'',cc:c.cc||'',stmts:(c.stmts||[]).slice(-600),exDeb:c.exDeb||'',exFin:c.exFin||'',ouv:c.ouv||null,ex:c.ex||[],exCur:c.exCur||'',emp:c.emp||[],paie:c.paie||{},email:c.email||'',demandes:c.demandes||[],links:(c.links||[]).map(l=>({id:l.id,nom:l.nom,acct:l.acct,tx:(l.tx||[]).slice(-4000)})),chat:(c.chat||[]).slice(-20),sage:Array.isArray(c.sage)?c.sage:null,src:c.src||'',last:c.last||'',deleted:!!c.deleted,updated:new Date().toISOString()});
let cWriting=Promise.resolve();
function saveClient(){LED=null;audClient();const data=cleanClient(C);setSave('Enregistrement…');
  if(local){LOCAL.clients[C.id]=data;setSave('Enregistré (session seulement)');renderList();return}
  cWriting=cWriting.then(()=>db.collection('clients').doc(C.id).set(data)).then(()=>setSave('Enregistré')).catch(e=>setSave(e.code==='quota_exceeded'?'Base pleine : enregistrement impossible':'Erreur d’enregistrement',true))}
let pTimer=null,pWriting=Promise.resolve();
function flushMulti(p=P){p.parts.forEach(part=>{const tx=p.tx.filter(t=>t._m===part.mois);if(!tx.length&&!part.exists)return;part.exists=true;savePerFlush({...part,tx,chk:P.chk})});
  const last=p.parts.filter(x=>x.exists).map(x=>x.mois).sort().pop();if(last&&(C.last||'')<last){C.last=last;saveClient()}
  pWriting.then(()=>setSave(local?'Enregistré (session seulement)':'Enregistré'))}
/* ---------- piste de vérification : qui a changé quoi, quand, avant → après ---------- */
let AUDQ=[],AUDT=null;
function audit(quoi,detail){if(!C)return;const e={le:new Date().toISOString(),qui:(document.getElementById('whoE')?.textContent||'').trim(),quoi,detail:String(detail||'').slice(0,400)};AUDQ.push([C.id,e]);clearTimeout(AUDT);AUDT=setTimeout(audFlush,800)}
async function audFlush(){const q=AUDQ;AUDQ=[];for(const[cid,e]of q){try{if(local){LOCAL.audit=LOCAL.audit||{};LOCAL.audit[cid+'/'+e.le+Math.random()]=e}else await db.collection('clients').doc(cid).collection('audit').doc(e.le.replace(/[^0-9]/g,'')+Math.random().toString(36).slice(2,6)).set(e)}catch(x){}}}
const txTxt=t=>`${t.date} « ${String(t.desc).slice(0,50)} » ${fmt(t.amt)}`;
let AUDSNAP=null;
function audClient(){if(!C)return;const snap={rules:(C.rules||[]).map(r=>`« ${r.p} » → ${r.a}${r.t?' (taxable)':''}${r.d?' depuis '+r.d:''}`),plan:PLAN.map(p=>p.join(' ')),gifi:{...(C.gifi||{})},id:C.id};
  if(AUDSNAP&&AUDSNAP.id===C.id){const a=new Set(AUDSNAP.rules),b=new Set(snap.rules);snap.rules.filter(x=>!a.has(x)).forEach(x=>audit('Règle ajoutée',x));AUDSNAP.rules.filter(x=>!b.has(x)).forEach(x=>audit('Règle retirée',x));
    const pa=new Set(AUDSNAP.plan),pb=new Set(snap.plan);snap.plan.filter(x=>!pa.has(x)).forEach(x=>audit('Compte ajouté ou renommé',x));AUDSNAP.plan.filter(x=>!pb.has(x)).forEach(x=>audit('Compte retiré ou renommé',x));
    const ch=Object.keys({...AUDSNAP.gifi,...snap.gifi}).filter(k=>AUDSNAP.gifi[k]!==snap.gifi[k]);if(ch.length)audit('Codes IGRF modifiés',ch.slice(0,15).map(k=>`${k} : ${AUDSNAP.gifi[k]||'—'} → ${snap.gifi[k]||'—'}`).join(' · ')+(ch.length>15?` … (${ch.length})`:''))}
  AUDSNAP=snap}
async function audLire(){if(local)return Object.entries(LOCAL.audit||{}).filter(([k])=>k.startsWith(C.id+'/')).map(([,v])=>v);const q=await db.collection('clients').doc(C.id).collection('audit').get();return q.docs.map(d=>d.data())}
async function renderAudit(){const box=$('audList');if(!box||!C)return;box.innerHTML='<tr><td colspan="4" class="empty">Chargement…</td></tr>';await audFlush();
  let L=[];try{L=await audLire()}catch(e){box.innerHTML='<tr><td colspan="4" class="empty">Lecture impossible.</td></tr>';return}
  L.sort((a,b)=>b.le.localeCompare(a.le));AUDL=L;const q=norm($('audQ').value);const V=q?L.filter(e=>norm(e.quoi+' '+e.detail+' '+e.qui).includes(q)):L;
  box.innerHTML=V.length?V.slice(0,400).map(e=>`<tr><td class="d" style="white-space:nowrap">${esc(new Date(e.le).toLocaleString('fr-CA',{dateStyle:'short',timeStyle:'short'}))}</td><td>${esc(e.qui||'')}</td><td><strong>${esc(e.quoi)}</strong></td><td>${esc(e.detail||'')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Aucune modification enregistrée pour l’instant.</td></tr>';
  $('audN').textContent=`${V.length} modification(s)${V.length>400?' · 400 plus récentes affichées':''}`}
let AUDL=[];
/* ---------- droits : CPA (administrateur) et technicien (membre) ---------- */
const estCPA=()=>!window.tlRole||window.tlRole==='admin';
/* ---------- pièces jointes (factures, reçus…) sur les transactions et les écritures ---------- */
const pjNom=f=>String(f.name||'piece').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-100);
async function pjEnvoyer(files,say){if(!window.tlFichiers)throw new Error('pièces jointes indisponibles dans cette vue');const out=[];
  for(const f of files){if(f.size>20*1024*1024){say&&say(`${f.name} : plus de 20 Mo, ignoré.`);continue}say&&say(`Envoi de ${f.name}…`);
    const c=`tl/${C.id}/${Date.now()}-${Math.random().toString(36).slice(2,6)}-${pjNom(f)}`;await window.tlFichiers.envoyer(c,f);out.push({n:f.name.slice(0,120),c,t:f.size,le:new Date().toISOString()})}return out}
async function pjOuvrir(c){try{const u=await window.tlFichiers.lien(c);window.open(u,'_blank','noopener')}catch(e){alert('Ouverture impossible : '+e.message)}}
const pjListe=(L,del)=>(L||[]).length?`<ul style="margin:4px 0 8px 18px;padding:0">${L.map((p,k)=>`<li><a href="#" data-pjo="${esc(p.c)}">📎 ${esc(p.n)}</a>${del?` <button type="button" class="sm" data-pjx="${k}" title="Retirer">✕</button>`:''}</li>`).join('')}</ul>`:'<p class="note" style="margin:4px 0 8px">Aucune pièce jointe.</p>';
document.addEventListener('click',e=>{const a=e.target.closest('[data-pjo]');if(a){e.preventDefault();pjOuvrir(a.dataset.pjo)}});
/* met à jour une transaction d'une période (ouverte ou enregistrée) */
async function majTx(mois,src,i,fn){if(P&&!P.multi&&P.mois===mois&&P.src===src){fn(P.tx[i]);savePer();render();return}
  let doc;if(local)doc=LOCAL.periodes[C.id+'/'+mois+'_'+src];else{const q=await db.collection('clients').doc(C.id).collection('periodes').doc(mois+'_'+src).get();doc=q.exists?q.data():null}
  if(!doc||!doc.tx[i])throw new Error('transaction introuvable');fn(doc.tx[i]);doc.updated=new Date().toISOString();
  if(local)LOCAL.periodes[C.id+'/'+mois+'_'+src]=doc;else await db.collection('clients').doc(C.id).collection('periodes').doc(mois+'_'+src).set(doc)}
/* ---------- révision du mois : un mois révisé reste tel quel; le modifier demande une confirmation et retire la révision ---------- */
const revTxt=r=>`Révisé le ${new Date(r.le).toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'})}${r.par?' par '+r.par:''}`;
function revUI(){const b=$('pRev');if(!b)return;const ok=P&&!P.multi&&P.tx.length;b.hidden=!ok;$('pRevI').textContent='';if(!ok)return;
  if(P.revise){b.textContent='Retirer la révision';$('pRevI').innerHTML=`<span class="pill ok">✓ ${esc(revTxt(P.revise))}</span>`}else b.textContent='✓ Marquer ce mois révisé'}
function revOk(){if(!P||P.multi||!P.revise)return true;if(!confirm(`${moisLbl(P.mois)} (${P.src}) : ${revTxt(P.revise)}.\n\nModifier quand même? Le mois devra être révisé de nouveau.`))return false;
  audit('Modification d’un mois révisé',`${moisLbl(P.mois)} · ${P.src} (${revTxt(P.revise)}) : révision retirée`);P.revise=null;revUI();savePer();return true}
function savePer(){if(!P)return;LED=null;clearTimeout(pTimer);setSave('Modifications en attente…');pTimer=setTimeout(()=>{
  pTimer=null;enforceLock(P);if(P.multi){flushMulti();return}
  const snap={mois:P.mois,src:P.src,statut:P.statut||'en cours',exported:P.exported||'',chk:P.chk||{},verif:P.verif||{},...(P.revise?{revise:P.revise}:{}),tx:P.tx.map(t=>({date:t.date,desc:t.desc,amt:t.amt,acct:t.acct,tax:!!t.tax,st:t.st,why:t.why||'',unk:!!t.unk,inv:t.inv||'',...(t.rel?{rel:t.rel}:{}),...(t.pj?.length?{pj:t.pj}:{})})),n:P.tx.length,todo:P.tx.filter(aCl).length,updated:new Date().toISOString()};
  const pid=P.mois+'_'+P.src;
  if(local){LOCAL.periodes[C.id+'/'+pid]=snap;setSave('Enregistré (session seulement)');if((C.last||'')<P.mois){C.last=P.mois;saveClient()}return}
  pWriting=pWriting.then(()=>db.collection('clients').doc(C.id).collection('periodes').doc(pid).set(snap)).then(()=>{setSave('Enregistré');if((C.last||'')<P.mois){C.last=P.mois;saveClient()}}).catch(e=>setSave(e.code==='quota_exceeded'?'Base pleine : enregistrement impossible':'Erreur d’enregistrement',true));
},900)}
const setSave=(t,err)=>{$('saveState').textContent=t;$('saveState').style.color=err?'var(--claret)':''};

/* ---------- liste des clients ---------- */
function renderList(){
  if(local)CLIENTS=Object.entries(LOCAL.clients).map(([id,d])=>({id,...d}));
  try{if(PENDING&&!C&&CLIENTS.some(x=>x.id===PENDING.c)){const p=PENDING;PENDING=null;setTimeout(async()=>{NAVQ=true;try{await openClient(p.c);setTab(p.t);await navRest(p)}finally{NAVQ=false}try{history.replaceState(null,'',hashOf())}catch(e){}},0)}}catch(e){}
  const q=norm($('cq').value);const L=CLIENTS.filter(c=>!c.deleted&&(!q||norm(c.nom).includes(q))).sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
  $('clist').innerHTML=L.length?L.map(c=>`<tr class="click" data-id="${esc(c.id)}"><td><strong>${esc(c.nom)}</strong></td><td>${parsePlanText(c.plan).length} comptes</td><td>${(c.rules||[]).length}</td><td>${esc(moisLbl(c.last))}</td><td><button class="sm">Ouvrir</button></td></tr>`).join('')
    :`<tr><td colspan="5" class="empty">${CLIENTS.length?'Aucun client ne correspond.':'Aucun dossier pour l’instant. Créez le premier client ci-dessus.'}</td></tr>`;
}
$('cq').oninput=renderList;
$('clist').onclick=e=>{const tr=e.target.closest('tr[data-id]');if(tr)openClient(tr.dataset.id)};
$('newForm').onsubmit=e=>{e.preventDefault();const nom=$('newName').value.trim();if(!nom)return;pdOuvrir(nom)};

/* ---------- plan comptable type : base + modules par secteur, IGRF préassocié ---------- */
const DEF_GIFI={1010:'1001',1040:'1007',1055:'1002',1060:'1002',1065:'1002',1067:'1003',1100:'1180',1200:'1062',1205:'1063',1210:'1060',1215:'1483',1220:'1400',1225:'1301',1230:'1240',1250:'1483',1300:'1121',1320:'1484',1325:'1480',1500:'2300',1510:'2240',1700:'1740',1705:'1741',1710:'1787',1715:'1788',1720:'1774',1725:'1775',1730:'1742',1735:'1743',1740:'1918',1745:'1919',1750:'1680',1755:'1681',1760:'1600',1800:'1774',1805:'1775',1850:'2012',1860:'2018',
 2050:'2701',2100:'2621',2110:'2620',2120:'2624',2125:'2624',2130:'2627',2140:'2707',2145:'2707',2150:'2707',2160:'2680',2170:'2962',2180:'2770',2190:'2629',2310:'2680',2315:'2680',2320:'2680',2325:'2680',2330:'2680',2335:'2680',2400:'2920',2600:'3143',2610:'3141',2620:'3321',2640:'3261',2650:'3300',3100:'3500',3200:'3541',3500:'3600',3600:'3700',
 4010:'8000',4020:'8000',4030:'8000',4050:'8141',4080:'8000',4400:'8090',4410:'8096',4420:'8242',4450:'8210',4460:'8230',5010:'8320',5030:'8360',5040:'8457',5050:'8320',5100:'9060',5110:'8622',5120:'8620',
 6010:'8521',6020:'8690',6030:'8715',6040:'8710',6050:'8714',6060:'8860',6065:'8863',6070:'8810',6075:'8811',6080:'9150',6090:'9225',6100:'9220',6110:'8911',6120:'8960',6130:'9224',6140:'8962',6150:'9281',6160:'8915',6170:'8523',6180:'9200',6190:'8876',6200:'8761',6210:'8760',6220:'9180',6230:'8590',6240:'8522',6250:'9275',6260:'9130',6270:'8716',6280:'8231',6300:'8670',6310:'9270',6320:'9270',9010:'9990'};
const SECTEURS={
 general:{nom:'Général (tout type d’entreprise)',c:[]},
 professionnel:{nom:'Professionnels : ingénieurs, architectes, consultants, avocats',c:[['1260','Travaux en cours','1125'],['4035','Débours refacturés aux clients','8000'],['6025','Assurance responsabilité professionnelle','8690'],['6085','Logiciels techniques et licences (CAO, etc.)','9150'],['6205','Cotisations à l’ordre professionnel','8761']]},
 sante:{nom:'Santé : clinique, dentiste, physiothérapie',c:[['4031','Honoraires de soins','8000'],['4032','Ventes de produits','8000'],['5051','Fournitures médicales et cliniques','8320'],['6025','Assurance responsabilité professionnelle','8690'],['6086','Logiciel de gestion de clinique','9150'],['6205','Cotisations à l’ordre professionnel','8761']]},
 construction:{nom:'Construction et rénovation',c:[['1265','Retenues de garantie à recevoir','1068'],['1268','Travaux en cours','1125'],['1765','Équipement lourd','1746'],['1766','Amortissement cumulé - équipement lourd','1747'],['2115','Retenues de garantie à payer','2623'],['2185','Facturation progressive excédentaire','2770'],['4060','Revenus de contrats','8000'],['5055','Location d’équipement de chantier','8451'],['5060','Petits outils','9131'],['5115','Cotisations CCQ et avantages','8622'],['6026','Assurance chantier et cautionnement','8690'],['6215','Licence RBQ et permis','8764']]},
 restaurant:{nom:'Restauration et bar',c:[['2122','Pourboires à remettre','2624'],['4011','Ventes de nourriture','8000'],['4012','Ventes de boissons alcoolisées','8000'],['4013','Ventes par plateformes de livraison','8000'],['5011','Coût des aliments','8320'],['5012','Coût des boissons','8320'],['5013','Emballages et contenants','8320'],['6121','Entretien de l’équipement de cuisine','8964'],['6216','Permis d’alcool et permis du MAPAQ','8764'],['6261','Uniformes et buanderie','9134'],['6275','Commissions des plateformes de livraison','9273']]},
 immeubles:{nom:'Immeubles locatifs',c:[['2186','Dépôts des locataires','2961'],['4051','Loyers résidentiels','8141'],['4052','Loyers commerciaux','8141'],['4053','Stationnement et buanderie','8141'],['6051','Intérêts hypothécaires','8713'],['6122','Déneigement et entretien du terrain','9010'],['6123','Conciergerie','9010'],['6221','Taxes municipales','9180'],['6222','Taxes scolaires','9180'],['6225','Frais de gestion immobilière','8871']]},
 detail:{nom:'Commerce de détail et commerce en ligne',c:[['4015','Ventes en ligne','8000'],['5015','Droits de douane et courtage','8457'],['5025','Pertes et vols de stock','8458'],['6011','Publicité en ligne','8521'],['6271','Frais de plateforme de commerce électronique','9273']]},
 transport:{nom:'Transport et camionnage',c:[['1731','Camions et remorques','1742'],['1736','Amortissement cumulé - camions et remorques','1743'],['4040','Revenus de transport','8000'],['5061','Carburant des camions','9224'],['5062','Péages et pesées','9274'],['6027','Assurance camions et cargaison','8690'],['6141','Pneus et réparations des camions','8962'],['6151','Permis IFTA, IRP et immatriculation','9281']]},
 holding:{nom:'Société de portefeuille (holding)',c:[['1221','Avances aux filiales','2243'],['1511','Actions de filiales','2242'],['4411','Dividendes de filiales','8096'],['4412','Frais de gestion facturés aux filiales','8239'],['4451','Gains en capital','8211'],['6066','Frais de gestion de placements','8869']]},
 services:{nom:'Services : entretien, esthétique, coiffure, formation',c:[['4021','Ventes de produits','8000'],['5016','Produits utilisés pour les services','8320'],['6012','Commissions de plateformes de réservation','9273']]},
 autonome:{nom:'Travailleur autonome (entreprise individuelle)',ind:1,c:[['6105','Bureau à domicile','8810']]}};
function planType(type,{tx,emp,ind},extras=[]){const S=SECTEURS[type]||SECTEURS.general,indiv=ind||S.ind;const L=DEF_PLAN.split('\n').map(l=>{const m=l.match(/^(\S+)\s+(.*)$/);return m?[m[1],m[2]]:null}).filter(Boolean);
  const out=L.filter(([n])=>!(indiv&&['1225','2160','2170','2640','3100','3200','3500','3600','9000','9010'].includes(n)));
  const G={};out.forEach(([n])=>{if(DEF_GIFI[n])G[n]=DEF_GIFI[n]});
  if(indiv){out.push(['3110','Mise de fonds du propriétaire'],['3120','Retraits du propriétaire'],['3130','Capital du propriétaire'])}
  [...S.c,...extras].forEach(([n,nm,g])=>{if(out.some(x=>x[0]===n))return;out.push([n,nm]);if(g&&!indiv)G[n]=g});
  if(indiv)Object.keys(G).forEach(k=>delete G[k]);
  out.sort((a,b)=>a[0].localeCompare(b[0],'fr',{numeric:true}));return{plan:out.map(p=>p.join(' ')).join('\n'),gifi:G}}
let FICHE=null,PDX=[];
function iaProfil(){const d=C?.desc||FICHE?.description||'';const f=FICHE||{};const parts=[];if(d)parts.push('Description : '+d);
  if(C?.profil?.type&&SECTEURS[C.profil.type])parts.push('Secteur : '+SECTEURS[C.profil.type].nom);
  const tx=C?.profil?.tx??f.tps_tvq,emp=C?.profil?.emp??f.employeur;if(tx!=null)parts.push('Inscrite TPS/TVQ : '+(tx?'oui':'non'));if(emp!=null)parts.push('Employeur (paie, DAS) : '+(emp?'oui':'non'));if(f.forme)parts.push('Forme : '+f.forme);
  if(C)parts.push('Méthode de comptabilisation : '+METH[methodeEff()]);if(comptesUSD().length)parts.push('Comptes en dollars US : '+comptesUSD().map(a=>a+' '+accName(a)).join(', '));
  return parts.length?'Profil de l’entreprise — '+parts.join(' · '):''}
async function chargerFiche(){FICHE=null;chargerFiche.fait=false;try{if(window.tlFiche&&C)FICHE=await window.tlFiche(C.nom)}catch(e){}chargerFiche.fait=true;if(C&&tab==='set')renderSettings();if(C&&tab==='home')renderHome().catch(()=>{})}
function pdOuvrir(nom){$('pdNom').textContent=nom;$('pdType').innerHTML=Object.entries(SECTEURS).map(([k,v])=>`<option value="${k}">${esc(v.nom)}</option>`).join('');$('pdDesc').value='';$('pdOut').innerHTML='';$('pdMsg').textContent='';PDX=[];
  $('pdAi').disabled=!sampleFn;$('pdTx').checked=true;$('pdEmp').checked=false;$('pdInd').checked=false;
  if(window.tlFiche)window.tlFiche(nom).then(f=>{if(!f)return;if(f.description)$('pdDesc').value=f.description;if(f.tps_tvq!=null)$('pdTx').checked=!!f.tps_tvq;if(f.employeur!=null)$('pdEmp').checked=!!f.employeur;if(/individuelle/i.test(f.forme||''))$('pdInd').checked=true;$('pdMsg').textContent='Renseignements repris de la fiche du client dans Gestion du cabinet.'}).catch(()=>{});
  pdApercu();const d=$('pdDlg');try{d.showModal()}catch(e){d.setAttribute('open','')}}
function pdApercu(){const t=$('pdType').value,S=SECTEURS[t];const r=planType(t,{tx:$('pdTx').checked,emp:$('pdEmp').checked,ind:$('pdInd').checked},PDX.filter(x=>x.on).map(x=>[x.n,x.nm,x.g]));
  const nb=r.plan.split('\n').length;$('pdOut').innerHTML=`<p class="note" style="margin:0 0 6px">${nb} comptes au plan${S.c.length?` dont ${S.c.length} propres au secteur`:''}${PDX.length?` · ${PDX.filter(x=>x.on).length} proposé(s) par l’IA`:''}.</p>`+
    (S.c.length?`<p style="margin:4px 0"><strong>Comptes du secteur :</strong> ${S.c.map(c=>esc(c[0]+' '+c[1])).join(' · ')}</p>`:'')+
    (PDX.length?`<p style="margin:8px 0 4px"><strong>Proposés par l’IA</strong> (décochez ceux que vous ne voulez pas) :</p>${PDX.map((x,i)=>`<label class="opt" style="display:flex;gap:6px"><input type="checkbox" data-pdx="${i}"${x.on?' checked':''}> ${esc(x.n+' '+x.nm)}${x.g?` <small class="note">IGRF ${esc(x.g)}</small>`:''}${x.pq?` <small class="note">— ${esc(x.pq)}</small>`:''}</label>`).join('')}`:'')}
async function pdAi(){const desc=$('pdDesc').value.trim();if(!desc){$('pdMsg').textContent='Décrivez d’abord l’entreprise.';return}$('pdAi').disabled=true;$('pdMsg').textContent='L’IA analyse la description…';
  try{const base=planType($('pdType').value,{tx:$('pdTx').checked,emp:$('pdEmp').checked,ind:$('pdInd').checked}).plan;
    const r=await sampleFn.json(`Tu es CPA au Québec. On crée le plan comptable d'un nouveau client de tenue de livres.
Description de l'entreprise : ${desc}
Secteurs offerts (id : nom) : ${Object.entries(SECTEURS).map(([k,v])=>k+' : '+v.nom).join(' ; ')}
Plan actuel (avec le secteur choisi) :
${base}

1) Choisis le secteur le plus approprié (id).
2) Propose au plus 10 comptes supplémentaires vraiment utiles pour CETTE entreprise et absents du plan, avec un numéro libre qui respecte les plages (1xxx actif, 2xxx passif, 3xxx avoir, 4xxx revenus, 5xxx coût des ventes, 6xxx dépenses) et le code IGRF de l'ARC le plus précis (liste officielle ci-dessous; jamais un code de total).
3) Indique aussi si l'entreprise semble avoir des employés et être inscrite à la TPS/TVQ (true, false ou null si on ne sait pas).
Codes IGRF :
${igrfListe()}

Réponds uniquement en JSON : {"secteur":"professionnel","employes":true,"tpstvq":true,"comptes":[{"numero":"6087","nom":"...","igrf":"9150","pourquoi":"..."}]}`,{modelTier:'default'});
    if(r?.secteur&&SECTEURS[r.secteur])$('pdType').value=r.secteur;if(typeof r?.employes==='boolean')$('pdEmp').checked=r.employes;if(typeof r?.tpstvq==='boolean')$('pdTx').checked=r.tpstvq;
    const cur=planType($('pdType').value,{tx:$('pdTx').checked,emp:$('pdEmp').checked,ind:$('pdInd').checked}).plan.split('\n').map(l=>l.split(' ')[0]);
    PDX=(Array.isArray(r?.comptes)?r.comptes:[]).filter(c=>/^[1-6]\d{3}$/.test(String(c.numero))&&!cur.includes(String(c.numero))&&c.nom).slice(0,10).map(c=>({n:String(c.numero),nm:String(c.nom).slice(0,60),g:igrfOk(String(c.igrf||''))?String(c.igrf):'',pq:String(c.pourquoi||'').slice(0,100),on:true}));
    $('pdMsg').textContent=`Secteur suggéré : ${SECTEURS[$('pdType').value].nom}. ${PDX.length} compte(s) proposé(s).`;pdApercu()}
  catch(e){$('pdMsg').textContent='L’IA n’a pas pu répondre.'}$('pdAi').disabled=!sampleFn}
function pdCreer(sage){const nom=$('pdNom').textContent;const d=$('pdDlg');d.close?d.close():d.removeAttribute('open');
  const id=local?'c'+Date.now():db.collection('clients').doc().id;const prof={type:$('pdType').value,tx:$('pdTx').checked,emp:$('pdEmp').checked,ind:$('pdInd').checked};
  const r=sage?{plan:DEF_PLAN,gifi:{}}:planType(prof.type,prof,PDX.filter(x=>x.on).map(x=>[x.n,x.nm,x.g]));
  C={id,nom,plan:r.plan,gifi:r.gifi,desc:$('pdDesc').value.trim(),profil:prof,rules:[],dfmt:'yy',notes:'',last:''};Object.assign(C,detectSpecial(C));C.src=banqueDef()||'1060';
  setPlan();C.src=banqueDef();saveClient();$('newName').value='';
  if(!local)CLIENTS.push({id,...cleanClient(C)});openClient(id,!!sage)}
$('pdType').onchange=()=>{PDX=[];pdApercu()};['pdTx','pdEmp','pdInd'].forEach(k=>$(k).onchange=pdApercu);
$('pdOut').addEventListener('change',e=>{const i=e.target.dataset.pdx;if(i!=null){PDX[+i].on=e.target.checked;pdApercu()}});
$('pdAi').onclick=pdAi;$('pdGo').onclick=()=>pdCreer(false);$('pdSage').onclick=()=>pdCreer(true);$('pdX').onclick=()=>{const d=$('pdDlg');d.close?d.close():d.removeAttribute('open')};


/* ---------- ouverture d'un dossier ---------- */
async function openClient(id,isNew){
  const c=CLIENTS.find(x=>x.id===id)||(local&&LOCAL.clients[id]&&{id,...LOCAL.clients[id]});if(!c)return;
  C=JSON.parse(JSON.stringify(c));C.id=id;setPlan();migrateEx();fillExSel();useEx(C.exCur,true);MIS=null;
  $('vList').hidden=true;$('vClient').hidden=false;window.scrollTo(0,0);
  $('cName').textContent=C.nom;$('cSub').textContent=`${PLAN.length} comptes au plan · ${(C.rules||[]).length} règles apprises · transitoire ${C.tr||'non défini'}`;
  FICHE=null;AUDSNAP=null;audClient();if(C.sage50===undefined)C.sage50=false;sageUI();chargerFiche();fillSelects();renderRules();renderSettings();renderChat();$('planTxt').value=C.plan;await loadInv();$('planMsg').textContent='';
  const now=new Date(),pm=new Date(now.getFullYear(),now.getMonth()-1,1);
  $('pMois').value=C.last||`${pm.getFullYear()}-${String(pm.getMonth()+1).padStart(2,'0')}`;
  {const e=curEx();if(e&&($('pMois').value<e.deb.slice(0,7)||$('pMois').value>e.fin.slice(0,7)))$('pMois').value=e.fin.slice(0,7)<$('pMois').value?e.fin.slice(0,7):e.deb.slice(0,7)}
  $('pSrc').value=C.src||$('pSrc').value;
  setTab(isNew?'plan':'home');
  if(isNew)$('planMsg').textContent='Nouveau dossier : versez le plan comptable du client pour commencer.';
  mode='m';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode==='m'));$('lMois').hidden=false;$('lFrom').hidden=$('lTo').hidden=true;$('pClear').hidden=false;$('pOpen').textContent='Ouvrir la période';$('rFrom').value=$('rTo').value='';
  await openPeriod();
}
$('back').onclick=()=>{if(P)savePerNow();C=null;P=null;$('vClient').hidden=true;$('vList').hidden=false;renderList();navPush()};

/* ---------- Assistant IA (bouton flottant) : comptabilité ---------- */
const IAC=new Map();
const iaMt=c=>(c/100).toFixed(2);
async function iaPeriodes(){if(local)return Object.entries(LOCAL.periodes).filter(([k])=>k.startsWith(C.id+'/')).map(([,v])=>v);const q=await db.collection('clients').doc(C.id).collection('periodes').get();return q.docs.map(d=>d.data())}
async function iaTx(){/* toutes les transactions reclassables : relevés (période + rang) et lignes d'écritures */
  const out=[];(await iaPeriodes()).forEach(p=>{const src=(P&&P.mois===p.mois&&P.src===p.src)?P:p;(src.tx||[]).forEach((x,i)=>{const t={...x};classify(t);
    out.push({ref:`R:${p.mois}_${p.src}:${i}`,kind:'rel',pid:p.mois+'_'+p.src,i,date:t.date,desc:t.desc,m:t.amt,a:t.acct,tax:!!t.tax,tr:isTr(t),src:p.src})})});
  (await loadJe()).forEach(j=>(j.lines||[]).forEach((l,k)=>out.push({ref:`J:${j.id}:${k}`,kind:'je',id:j.id,k,date:j.date,desc:(j.ref?j.ref+' — ':'')+(j.desc||''),m:(l.d||0)-(l.c||0),a:l.a,tr:!!C.tr&&l.a===C.tr,src:'écriture'})));
  out.forEach(x=>IAC.set(x.ref,x));return out}
const iaLigne=x=>`${x.ref} | ${x.date} | ${x.desc} | ${iaMt(x.m)} | ${x.a} ${accName(x.a)}${x.kind==='rel'?(x.m<0?' | sortie':' | entrée')+(x.tax?' | taxable':''):' | ligne d’écriture (montant + = débit)'}${lk(x.date)?' | EXERCICE FERMÉ':''}`;
const iaCompteOk=a=>PLAN.some(([n,t])=>n===String(a)&&!isHeader(n,t));
const iaCompteErr=a=>{const p=PLAN.find(x=>x[0]===String(a));return !p?`Le compte ${a} n’existe pas au plan.`:isHeader(p[0],p[1])?`${a} ${p[1]} est un compte de titre ou de total : choisissez un compte de détail.`:null};
async function iaContexte(){
  if(!C)return `Aucun dossier client n'est ouvert. Dossiers (id ; nom) :\n${CLIENTS.map(c=>c.id+' ; '+c.nom).join('\n')}`;
  if(!LED)LED=await loadLedger();const[d,f]=exRange(),auj=new Date().toLocaleDateString('fr-CA'),fin=f&&f<auj?f:auj;
  const B=balances(LED,null,fin),I=balances(LED,d,fin);const sol=[...B].filter(([a,c])=>c&&+String(a)[0]<4).concat([...I].filter(([a,c])=>c&&+String(a)[0]>=4)).sort((x,y)=>x[0].localeCompare(y[0]));
  const T=(await iaTx()).filter(x=>x.tr&&!lk(x.date));
  const ecran=tab==='rep'?` Rapport affiché : ${({bs:'bilan',is:'état des résultats',tb:'balance de vérification',gl:'grand livre',jr:'journal général',tx:'TPS/TVQ',gifi:'IGRF'})[REP]||REP} du ${$('repFrom').value||'?'} au ${$('repTo').value||'?'}${REP==='gl'&&$('repAcc').value?' pour le compte '+$('repAcc').value+' '+accName($('repAcc').value):''}.`:'';
  return `Dossier ouvert : ${C.nom}. ${iaProfil()}${C.notes?' Notes du cabinet : '+C.notes:''}
Exercice du ${d||'?'} au ${f||'?'}. Onglet affiché : ${tab}.${ecran} (L'utilisateur navigue pendant qu'il vous parle : « ce compte », « ce rapport » renvoient à ce qui est affiché.) Compte transitoire : ${C.tr||'non défini'}.
${P?`Période ouverte à l'écran : ${P.mois} (${P.src}).`:''}
Plan comptable (numéro nom) :
${PLAN.filter(([n,t])=>!isHeader(n,t)).map(p=>p.join(' ')).join('\n')}

Soldes au ${fin} (débit +, crédit −; résultats depuis le début de l'exercice) :
${sol.map(([a,c])=>`${a} ${accName(a)} : ${iaMt(c)}`).join('\n')||'aucun'}

Transactions au compte transitoire (${T.length}) — ref | date | description | montant | compte actuel | sens :
${T.slice(0,120).map(iaLigne).join('\n')}${T.length>120?`\n… et ${T.length-120} autres (utilisez l'outil chercher)`:''}
Règles de classement du dossier : ${(C.rules||[]).length}.
${(C.links||[]).length?`Comptes liés (relevés d'autres comptes versés pour apparier les virements entre comptes) :\n${C.links.map(l=>`- ${l.nom} → compte ${l.acct} ${accName(l.acct)} ; ${(l.tx||[]).length} transaction(s)${(l.tx||[]).length?' : '+(l.tx||[]).slice(-60).map(([d,a,ds])=>`${d} ${iaMt(a)}${ds?' '+String(ds).slice(0,30):''}`).join(' · '):''}`).join('\n')}`:'Aucun compte lié.'}`}
async function iaChercher(o){const n=o.texte?norm(o.texte):'',L=(await iaTx()).filter(x=>(!o.compte||x.a===String(o.compte))&&(!n||norm(x.desc).includes(n))&&(!o.du||x.date>=o.du)&&(!o.au||x.date<=o.au)&&(!o.transitoire||x.tr)&&(o.montant==null||Math.abs(Math.abs(x.m)-Math.round(Math.abs(+o.montant)*100))<=1));
  return `Recherche ${JSON.stringify(o)} : ${L.length} résultat(s)${L.length>150?' (150 premiers)':''}\n`+L.slice(0,150).map(iaLigne).join('\n')}
async function iaReclasser(a){const refs=[...new Set(a.refs||[])];if(!refs.length)throw new Error('aucune transaction');if(!iaCompteOk(a.compte))throw new Error('compte '+a.compte+' absent du plan');
  const why=('Reclassé : '+(a.raison||'demande à l’assistant')).slice(0,140);let n=0,ferme=0;const per=new Map(),byJe=new Map();
  refs.forEach(r=>{const[k,x,y]=r.split(':');if(k==='R')(per.get(x)||per.set(x,[]).get(x)).push(+y);else if(k==='J')(byJe.get(x)||byJe.set(x,[]).get(x)).push(+y)});
  for(const[pid,Is]of per){const set=t=>{if(lk(t.date)){ferme++;return}audit('Transaction reclassée',`${txTxt(t)} : ${t.acct} → ${a.compte} ${accName(String(a.compte))}${typeof a.taxable==='boolean'&&a.taxable!==!!t.tax?`, taxes ${a.taxable?'cochées':'décochées'}`:''} (${a.raison||'assistant'})`);Object.assign(t,{acct:String(a.compte),st:'manuel',why,unk:false});if(typeof a.taxable==='boolean')t.tax=a.taxable;n++};
    if(P&&P.mois+'_'+P.src===pid){Is.forEach(i=>P.tx[i]&&set(P.tx[i]));if(P.revise){audit('Mois révisé modifié',`${moisLbl(P.mois)} · ${P.src} : révision retirée`);P.revise=null}savePerNow();continue}
    let doc;if(local)doc=LOCAL.periodes[C.id+'/'+pid];else{const q=await db.collection('clients').doc(C.id).collection('periodes').doc(pid).get();doc=q.exists?q.data():null}
    if(!doc)continue;Is.forEach(i=>doc.tx[i]&&set(doc.tx[i]));if(doc.revise){audit('Mois révisé modifié',`${pid} : révision retirée`);delete doc.revise}doc.todo=doc.tx.filter(aCl).length;doc.updated=new Date().toISOString();
    if(local)LOCAL.periodes[C.id+'/'+pid]=doc;else await db.collection('clients').doc(C.id).collection('periodes').doc(pid).set(doc)}
  for(const[id,Ks]of byJe){const j=JE.find(x=>x.id===id);if(!j)continue;if(lk(j.date)){ferme+=Ks.length;continue}const{id:_,...d}=j;Ks.forEach(k=>audit('Écriture modifiée',`${j.date} ${j.ref||''} ${j.desc||''} : ligne ${d.lines[k]?.a} → ${a.compte} (${a.raison||'assistant'})`));d.lines=d.lines.map((l,k)=>Ks.includes(k)?{...l,a:String(a.compte)}:l);d.updated=new Date().toISOString();n+=Ks.length;
    if(local){LOCAL.je[C.id+'/'+id]=d}else await(await jeCol()).doc(id).set(d)}
  LED=null;if(tab==='je')renderJe();else if(typeof render==='function')render();
  return `${n} transaction(s) reclassée(s) dans ${a.compte} ${accName(String(a.compte))}${ferme?` · ${ferme} ignorée(s) : exercice fermé`:''}`}
function iaInit(){if(!window.ASSISTANT||!sampleFn||iaInit.ok)return;iaInit.ok=1;
  window.ASSISTANT.init({id:'compta',nom:'Comptabilité',ask:p=>sampleFn.json(p,{modelTier:'default'}),contexte:iaContexte,
    accueil:'Bonjour! Je peux passer des écritures, reclasser des transactions (déjà classées ou non, avec ou sans taxes), apparier des virements avec vos comptes liés, créer des règles de classement, ajouter des comptes, mettre à jour le profil du dossier (description, méthode, notes), répondre sur les soldes et ouvrir des rapports. Je vous montre toujours la modification avant de l’appliquer.',
    exemples:['Passe une écriture : 10 000 $ dans l’encaisse, en contrepartie des comptes fournisseurs, au 31 décembre','Mets tous les dépôts directs du transitoire dans les ventes','Montre-moi les transactions de plus de 1 000 $ dans les frais de véhicule','Quel est le solde de la banque?'],
    guide:`Tu travailles dans le logiciel de tenue de livres, sur le dossier ouvert (ou la liste des dossiers si aucun n'est ouvert).
OUTILS (lecture, exécutés seuls) :
- {"type":"chercher","compte":"5300","texte":"ESSO","du":"2026-01-01","au":"2026-12-31","transitoire":true,"montant":125.50} — tous les champs sont facultatifs. Renvoie les transactions avec leur ref.
ACTIONS (après confirmation) :
- {"type":"ecriture","date":"AAAA-MM-JJ","ref":"AJ-01","description":"...","ajustement":false,"lignes":[{"compte":"1060","debit":10000,"credit":0},{"compte":"2620","debit":0,"credit":10000}]} — doit balancer. "ajustement":true pour une écriture d'ajustement de fin d'exercice.
- {"type":"reclasser","refs":["R:2026-03_bnc:4","J:abc:1"],"compte":"8521","taxable":true,"raison":"Précision du client : publicité Facebook"} — déplace des transactions (refs exactes du contexte ou d'une recherche) vers un autre compte. "taxable" facultatif (relevés seulement).
- {"type":"regle","motif":"DEPOT DIRECT","compte":"4000","sens":"entree|sortie|les deux","taxable":false} — retient une règle pour classer automatiquement les transactions dont la description contient ce motif (aussi les prochains relevés).
- {"type":"compte","numero":"8525","nom":"PUBLICITÉ EN LIGNE"} — ajoute un compte au plan.
- {"type":"profil","description":"...","notes":"...","methode":"caisse|factures|adeposer","tps_tvq":true,"employeur":false,"devises":{"1062":"USD"}} — met à jour le profil du dossier (Paramètres) : description de l'entreprise, « Comment on tient ce dossier » (notes), méthode de comptabilisation, inscription TPS/TVQ, employeur, devise des comptes. Tous les champs sont facultatifs : ne mets que ceux à changer. Pour les notes, garde ce qui existe déjà et ajoute (sauf si on te demande de remplacer).
- {"type":"rapport","rapport":"bs|is|tb|gl|jr|tx|gifi","du":"AAAA-MM-JJ","au":"AAAA-MM-JJ"} — ouvre un rapport (exécuté sans confirmation).
- {"type":"ouvrir_dossier","id":"..."} — ouvre un dossier client (exécuté sans confirmation).
Reclasser fonctionne aussi sur des transactions DÉJÀ classées, dans n'importe quel mois (sauf un exercice fermé) : par exemple, pour enlever la TPS/TVQ (montant taxes comprises dans la dépense), cherche les transactions puis reclasser vers le même compte avec "taxable":false. Ne dis jamais que tu n'as pas accès aux transactions classées : cherche-les.
APPARIER un virement entre deux comptes du client (compte personnel du propriétaire, autre compte de banque, carte de crédit — voir « Comptes liés ») : trouve la transaction (outil chercher avec le montant), repère dans les comptes liés le montant opposé à quelques jours près, puis reclasser vers le compte de ce compte lié avec la raison « Apparié : <nom du compte lié>, <date> ». S'il n'y a pas de correspondance, dis-le et propose le compte le plus probable (avance de l'actionnaire, etc.).
Pour reclasser « toutes les transactions X », cherche d'abord (ou prends celles du contexte), puis propose une seule action reclasser avec toutes les refs. Si c'est récurrent, propose aussi une règle. Les montants des écritures sont en dollars. N'utilise jamais un compte de titre ou de total (numéros ronds comme 4000 ou lignes TOTAL) : seulement les comptes de détail listés.`,
    outils:{chercher:iaChercher},
    actions:{
      ecriture:{titre:a=>`Écriture du ${a.date||'?'}${a.ref?' — '+a.ref:''}`,
        verifier:a=>{if(!C)return'Aucun dossier ouvert.';const L=a.lignes||[];if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date||''))return'Date invalide.';if(lk(a.date))return'Cette date est dans un exercice fermé.';
          const bad=L.find(l=>!iaCompteOk(l.compte));if(bad)return iaCompteErr(bad.compte);const d=L.reduce((s,l)=>s+Math.round((+l.debit||0)*100),0),c=L.reduce((s,l)=>s+Math.round((+l.credit||0)*100),0);if(L.length<2||d!==c||!d)return`L’écriture ne balance pas (débits ${iaMt(d)}, crédits ${iaMt(c)}).`},
        apercu:a=>`<p style="margin:0 0 6px">${esc(a.description||'')}${a.ajustement?' <strong>(AJE)</strong>':''}</p><table><tr><th>Compte</th><th class="n">Débit</th><th class="n">Crédit</th></tr>${(a.lignes||[]).map(l=>`<tr><td>${esc(l.compte)} ${esc(accName(String(l.compte)))}</td><td class="n">${+l.debit?fmtN(Math.round(l.debit*100)):''}</td><td class="n">${+l.credit?fmtN(Math.round(l.credit*100)):''}</td></tr>`).join('')}</table>`,
        executer:async a=>{const lines=a.lignes.map(l=>({a:String(l.compte),d:Math.round((+l.debit||0)*100),c:Math.round((+l.credit||0)*100)})).filter(l=>l.d||l.c);
          const doc={date:a.date,ref:String(a.ref||'IA').slice(0,20),desc:String(a.description||'').slice(0,120),type:a.ajustement?'aje':'',ex:exOf(a.date),lines,updated:new Date().toISOString()};
          audit('Écriture ajoutée (assistant)',`${doc.date} ${doc.ref} ${doc.desc} : ${lines.map(l=>`${l.a} ${l.d?'Dt '+fmt(l.d):'Ct '+fmt(l.c)}`).join(', ')}`);if(local){LOCAL.je=LOCAL.je||{};LOCAL.je[C.id+'/j'+Date.now()]=doc}else await(await jeCol()).doc().set(doc);LED=null;if(tab==='je')renderJe();return'Écriture enregistrée (Écritures de journal)'}},
      reclasser:{titre:a=>`Reclasser ${(a.refs||[]).length} transaction(s) vers ${a.compte} ${accName(String(a.compte))}`,
        verifier:a=>!C?'Aucun dossier ouvert.':!iaCompteOk(a.compte)?iaCompteErr(a.compte):!(a.refs||[]).length?'Aucune transaction.':null,
        apercu:a=>{const L=(a.refs||[]).map(r=>IAC.get(r)).filter(Boolean);const tot=L.reduce((s,x)=>s+Math.abs(x.m),0);return `${a.raison?`<p style="margin:0 0 6px">${esc(a.raison)}</p>`:''}<table><tr><th>Date</th><th>Description</th><th class="n">Montant</th><th>Compte actuel</th></tr>${L.slice(0,40).map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.desc)}</td><td class="n">${fmtN(Math.abs(x.m))}</td><td>${esc(x.a)}</td></tr>`).join('')}</table>${L.length>40?`<p style="margin:4px 0 0">… et ${L.length-40} autres</p>`:''}<p style="margin:6px 0 0"><strong>Total : ${fmtN(tot)} $</strong>${typeof a.taxable==='boolean'?` · ${a.taxable?'taxable':'non taxable'}`:''}</p>`},
        executer:iaReclasser},
      regle:{titre:a=>`Règle : « ${norm(a.motif)} » → ${a.compte} ${accName(String(a.compte))}`,
        verifier:a=>!C?'Aucun dossier ouvert.':!iaCompteOk(a.compte)?iaCompteErr(a.compte):norm(a.motif).length<3?'Motif trop court.':null,
        apercu:a=>`<p style="margin:0">Les transactions dont la description contient <strong>${esc(norm(a.motif))}</strong>${a.sens&&a.sens!=='les deux'?` (${a.sens==='sortie'?'sorties':'entrées'} seulement)`:''} seront classées dans ce compte${a.taxable?', taxables':''}, y compris dans les prochains relevés.</p>`,
        executer:async a=>{const p=norm(a.motif);C.rules=(C.rules||[]).filter(r=>r.p!==p);const r={p,a:String(a.compte),t:!!a.taxable};if(a.sens==='sortie'||a.sens==='entree')r.s=a.sens;C.rules.push(r);
          if(typeof reclass==='function'&&P)reclass();saveClient();renderRules();LED=null;if(typeof render==='function')render();if(P)savePer();return'Règle ajoutée (Règles de classement)'}},
      compte:{titre:a=>`Nouveau compte ${a.numero} ${a.nom}`,verifier:a=>!C?'Aucun dossier ouvert.':!/^\d{3,6}$/.test(String(a.numero||''))?'Numéro invalide.':PLAN.some(p=>p[0]===String(a.numero))?'Ce numéro existe déjà.':null,
        apercu:a=>`<p style="margin:0">Ajout au plan comptable du dossier${C.sage50?' (pensez à le créer aussi dans Sage)':''}.</p>`,executer:async a=>{addAccount(String(a.numero),String(a.nom).toUpperCase());return'Compte ajouté au plan'}},
      profil:{titre:()=>'Profil du dossier',verifier:a=>!C?'Aucun dossier ouvert.':a.methode&&!METH[a.methode]?'Méthode inconnue.':Object.keys(a.devises||{}).find(k=>!iaCompteOk(k)||!['CAD','USD'].includes(a.devises[k]))?'Devise ou compte invalide.':null,
        apercu:a=>{const L=[];const av=(t,x,y)=>L.push(`<tr><td>${t}</td><td>${esc(x||'—')}</td><td><strong>${esc(y)}</strong></td></tr>`);
          if(a.description!=null)av('Description',C.desc||'',String(a.description));if(a.notes!=null)av('Comment on tient ce dossier',C.notes||'',String(a.notes));if(a.methode)av('Méthode',METH[methodeEff()],METH[a.methode]);
          if(a.tps_tvq!=null)av('Inscrit TPS/TVQ',(C.profil?.tx??true)?'oui':'non',a.tps_tvq?'oui':'non');if(a.employeur!=null)av('Employeur',C.profil?.emp?'oui':'non',a.employeur?'oui':'non');
          Object.entries(a.devises||{}).forEach(([k,v])=>av('Devise '+k+' '+accName(k),devOf(k),v));return`<table><tr><th>Champ</th><th>Avant</th><th>Après</th></tr>${L.join('')}</table>`},
        executer:async a=>{if(a.description!=null)C.desc=String(a.description).slice(0,2000);if(a.notes!=null)C.notes=String(a.notes).slice(0,4000);if(a.methode){C.methode=a.methode;if(a.methode==='adeposer')adepAssurer()}
          if(a.tps_tvq!=null||a.employeur!=null)C.profil={...(C.profil||{}),...(a.tps_tvq!=null?{tx:!!a.tps_tvq}:{}),...(a.employeur!=null?{emp:!!a.employeur}:{})};
          if(a.devises)C.dev={...(C.dev||{}),...a.devises};audit('Profil du dossier (assistant)',Object.keys(a).filter(k=>k!=='type').join(', '));LED=null;saveClient();renderSettings();if(tab==='home')renderHome().catch(()=>{});return'Profil du dossier mis à jour (Paramètres)'}},
      rapport:{auto:true,titre:()=>'',apercu:()=>'',executer:async a=>{if(!C)throw new Error('aucun dossier ouvert');setTab('rep');if(a.du)$('repFrom').value=a.du;if(a.au)$('repTo').value=a.au;const b=document.querySelector(`[data-r="${a.rapport}"]`);if(b)b.click();else runRep();return'Rapport ouvert'}},
      ouvrir_dossier:{auto:true,titre:()=>'',apercu:()=>'',executer:async a=>{if(!CLIENTS.some(c=>c.id===a.id))throw new Error('dossier introuvable');await openClient(a.id);navPush();return'Dossier ouvert : '+C.nom}}}})}
/* ---------- historique du navigateur : le bouton Précédent reste dans la plateforme ---------- */
let NAVQ=false,PENDING=null;
const hashOf=()=>C?`#c=${encodeURIComponent(C.id)}&t=${tab}`+(tab==='rep'?`&r=${REP}`+($('repFrom').value?`&du=${$('repFrom').value}`:'')+($('repTo').value?`&au=${$('repTo').value}`:'')+(REP==='gl'&&$('repAcc').value?`&acc=${encodeURIComponent($('repAcc').value)}`:''):tab==='rev'&&mode==='m'&&$('pMois').value?`&m=${$('pMois').value}&s=${encodeURIComponent($('pSrc').value)}`:tab==='mis'&&MIS?`&ms=${mStep}`:''):'#';
function navPush(){if(NAVQ)return;const h=hashOf();if(location.hash===h||(h==='#'&&!location.hash))return;try{history.pushState(null,'',h)}catch(e){}}
function parseHash(){const q=new URLSearchParams(location.hash.slice(1));return{c:q.get('c'),t:q.get('t')||'home',r:q.get('r'),du:q.get('du')||'',au:q.get('au')||'',acc:q.get('acc')||'',m:q.get('m'),s:q.get('s'),ms:q.get('ms')}}
async function navRest(h){if(h.t==='rev'&&h.m&&(!P||P.mois!==h.m||P.src!==h.s)){if(mode!=='m'){mode='m';document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.mode==='m'));$('lMois').hidden=false;$('lFrom').hidden=$('lTo').hidden=true}$('pMois').value=h.m;if([...$('pSrc').options].some(o=>o.value===h.s))$('pSrc').value=h.s;await openPeriod();return}
  if(h.t==='mis'&&h.ms&&h.ms!==mStep){mStep=h.ms;await renderMis();return}
  navRep(h)}
function navRep(h){if(h.t!=='rep'||!h.r)return;REP=h.r;document.querySelectorAll('[data-r]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.r===REP));$('repFrom').value=h.du;$('repTo').value=h.au;$('repAccL').hidden=REP!=='gl';if(REP==='gl')$('repAcc').value=h.acc;repUI();runRep()}
window.addEventListener('popstate',async()=>{const h=parseHash(),{c,t}=h;NAVQ=true;
  try{if(!c){if(C)$('back').click()}else if(!C||C.id!==c){if(P)savePerNow();if(CLIENTS.some(x=>x.id===c)||local){await openClient(c);setTab(t);await navRest(h)}}else{if(tab!==t)setTab(t);await navRest(h)}}finally{NAVQ=false}});
{const h=parseHash();if(h.c)PENDING=h}
function savePerNow(){if(pTimer){clearTimeout(pTimer);pTimer=null;enforceLock(P);P.multi?flushMulti():savePerFlush(P)}}
function savePerFlush(p){const pid=p.mois+'_'+p.src;const snap={mois:p.mois,src:p.src,statut:p.statut||'en cours',exported:p.exported||'',chk:p.chk||{},verif:p.verif||{},...(p.revise?{revise:p.revise}:{}),tx:p.tx.map(t=>({date:t.date,desc:t.desc,amt:t.amt,acct:t.acct,tax:!!t.tax,st:t.st,why:t.why||'',unk:!!t.unk,inv:t.inv||'',...(t.rel?{rel:t.rel}:{}),...(t.pj?.length?{pj:t.pj}:{})})),n:p.tx.length,todo:p.tx.filter(aCl).length,updated:new Date().toISOString()};
  if(local){LOCAL.periodes[C.id+'/'+pid]=snap;return}const cid=C.id;pWriting=pWriting.then(()=>db.collection('clients').doc(cid).collection('periodes').doc(pid).set(snap)).catch(()=>{})}
function fillSelects(){
  const SA=srcAccounts();$('pSrc').innerHTML=SA.map(([n,t])=>`<option value="${esc(n)}">${esc(n+' '+t)}</option>`).join('');
  {const pref=SA.find(([n])=>n===C.src)||SA.find(([n,t])=>/COMPTE COURANT|COURANT|CHEQUE/.test(norm(t)))||SA.find(([n,t])=>/BANQUE|ENCAISSE/.test(norm(t)));if(pref)$('pSrc').value=pref[0]}
  $('rA').innerHTML=OPTS;['sTr','sTpsA','sTvqA','sTpsV','sTvqV'].forEach(id=>$(id).innerHTML='<option value="">—</option>'+OPTS);
}
async function openPeriod(){
  const mois=$('pMois').value,src=$('pSrc').value;if(!mois||!src){P=null;render();return}
  if(P&&pTimer)savePerNow();
  P={mois,src,tx:[],statut:'en cours'};render();
  let d=null;
  try{if(local)d=LOCAL.periodes[C.id+'/'+mois+'_'+src]||null;
    else{const s=await db.collection('clients').doc(C.id).collection('periodes').doc(mois+'_'+src).get();d=s.exists?s.data():null}}
  catch(e){msg('Impossible de lire cette période pour le moment.',true)}
  if(P.mois!==mois||P.src!==src)return;
  if(d){P.statut=d.statut;P.exported=d.exported;P.chk=d.chk||{};P.verif=d.verif||{};P.revise=d.revise||null;P.tx=(d.tx||[]).map(t=>({...t,id:++seq}));snapLock();reclass();if(autoMatch())savePer()}
  {const att=relAttente(src,mois);if(att.length){const r=mergeInto(P,att);LED=null;if(r.added){msg(`${r.added} transaction(s) mises de côté lors d’un relevé précédent (chevauchement d’exercice) ajoutées à ce mois.`);savePer()}}}
  if(!d)snapLock();
  idFilter=null;AIITEMS=[];PREV=[];
  try{const[y,m]=mois.split('-').map(Number);const pm=m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`;let pd=null;
    if(local)pd=LOCAL.periodes[C.id+'/'+pm+'_'+src]||null;else{const s=await db.collection('clients').doc(C.id).collection('periodes').doc(pm+'_'+src).get();pd=s.exists?s.data():null}
    if(pd&&P.mois===mois)PREV=(pd.tx||[]).filter(t=>t.amt<0&&t.st!=='transit').map(t=>({k:keyOf(t.desc),desc:t.desc,amt:t.amt}))}catch(e){}
  if(C.src!==src){C.src=src;saveClient()}
  msg(d?'':`Période vide. Déposez le relevé de ${moisLbl(mois)} pour le compte ${src}.`);
  render();if(tab==='rev')navPush();
}
let mode='m';
const openCur=()=>mode==='r'?openRange():openPeriod();
$('pOpen').onclick=openCur;$('pMois').onchange=openPeriod;$('pSrc').onchange=openCur;$('rFrom').onchange=openRange;$('rTo').onchange=openRange;
async function setMode(m){mode=m;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m));
  $('lMois').hidden=m==='r';$('lFrom').hidden=$('lTo').hidden=m!=='r';$('pClear').hidden=m==='r';
  $('pOpen').textContent=m==='r'?'Ouvrir ces mois':'Ouvrir la période';
  if(m==='r'&&(!$('rFrom').value||!$('rTo').value)){let ms=[];try{if(local)ms=Object.keys(LOCAL.periodes).filter(k=>k.startsWith(C.id+'/')).map(k=>k.split('/')[1].split('_')[0]);
      else{const sn=await db.collection('clients').doc(C.id).collection('periodes').get();ms=sn.docs.map(d=>d.data().mois)}}catch(e){}
    ms.sort();const now=new Date();const def=`${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,'0')}`;
    $('rFrom').value=ms[0]||def;$('rTo').value=ms[ms.length-1]||$('pMois').value}
  openCur()}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
let rangeTok=0;
async function openRange(){let f=$('rFrom').value,t=$('rTo').value;const src=$('pSrc').value;if(!f||!t||!src)return;if(f>t)[f,t]=[t,f];
  if(P&&pTimer)savePerNow();const tok=++rangeTok;
  const months=[];let[y,m]=f.split('-').map(Number);const[ty,tm]=t.split('-').map(Number);
  while((y<ty||(y===ty&&m<=tm))&&months.length<36){months.push(`${y}-${String(m).padStart(2,'0')}`);if(++m>12){m=1;y++}}
  P={multi:true,mois:months[0],to:months[months.length-1],src,tx:[],parts:[],statut:'en cours'};idFilter=null;AIITEMS=[];PREV=[];msg('Chargement des mois…');render();
  for(const mo of months){let d=null;try{d=await readPeriod(mo,src)}catch(e){}if(tok!==rangeTok)return;
    P.parts.push({mois:mo,src,statut:d?.statut||'en cours',exported:d?.exported||'',exists:!!d});(d?.tx||[]).forEach(x=>P.tx.push({...x,id:++seq,_m:mo}))}
  snapLock();P.tx.forEach(classify);P.tx.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);if(autoMatch())savePer();
  P.statut=P.parts.some(p=>p.exists)&&P.parts.filter(p=>p.exists).every(p=>p.statut==='importée')?'importée':'en cours';
  if(C.src!==src){C.src=src;saveClient()}
  msg(`${P.tx.length} transaction(s) de ${moisLbl(months[0])} à ${moisLbl(months[months.length-1])}, sur ${P.parts.filter(p=>p.exists).length} mois avec des données. Les modifications sont enregistrées dans chaque mois.`);render()}

/* ---------- onglets ---------- */
const CFG=['set','plan','rules','links','per'],PGT={home:['Accueil','Où en est le dossier et ce qu’il reste à faire.'],rev:['Transactions','Déposez un relevé, puis classez les transactions du mois.'],inv:['Factures','Comptes clients et fournisseurs.'],je:['Écritures de journal','Ajustements, amortissement et soldes d’ouverture.'],rec:['Conciliation bancaire','Comparez les livres aux soldes des relevés.'],rep:['Rapports','Bilan, résultats, grand livre et autres rapports.'],mis:['Mission de compilation','Tout le dossier de fin d’exercice, étape par étape.'],pay:['Paie','Salaire de l’actionnaire et des employés : retenues, cotisations et DAS.'],exp:['Archive et export','L’archive PDF du dossier, et l’export vers Sage 50 s’il est activé dans Paramètres.']};
function setTab(t){tab=t;const g=CFG.includes(t)?'set':t;document.querySelectorAll('#side [data-t]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===g));document.querySelectorAll('#cfgNav [data-t]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));
  $('cfgNav').hidden=g!=='set';const pt=PGT[g]||['Réglages','Plan comptable, règles, comptes liés, exercices et paramètres du dossier.'];$('pgTitle').textContent=pt[0];$('pgSub').textContent=pt[1];window.scrollTo?.(0,0);
  $('tHome').hidden=t!=='home';if(t==='set'){renderAudit();renderUsers()}if(t==='home')renderHome();
  for(const[k,id]of[['exp','tExp'],['pay','tPay'],['rev','tRev'],['per','tPer'],['plan','tPlan'],['rules','tRules'],['links','tLinks'],['inv','tInv'],['rec','tRec'],['je','tJe'],['rep','tRep'],['mis','tMis'],['set','tSet']])$(id).hidden=k!==t;
  if(t==='mis')renderMis();
  if(t==='set'&&C){renderDev();$('sMeth').value=C.methode||'';$('sMethNote').textContent=METH[methodeEff()]}if(t==='links')renderLinks();if(t==='je')renderJe();if(t==='rec')initRec();if(t==='inv')renderInv();if(t==='rep')initRep();
  if(t==='per'||t==='exp')loadPeriods();if(t==='exp')fillArcEx();if(t==='pay')renderPay();if(t==='exp')$('expPer').textContent=P?`${moisLbl(P.mois||$('pMois').value)} · ${$('pSrc').value} ${accName($('pSrc').value)}`:'aucun';navPush()}
document.querySelectorAll('#side [data-t],#cfgNav [data-t]').forEach(b=>b.onclick=()=>setTab(b.dataset.t));

let PERS=[];
async function yearSel(){const src=$('ySrc').value,f=$('yFrom').value||'0000-00',t=$('yTo').value||'9999-99';
  const L=PERS.filter(p=>p.src===src&&p.mois>=f&&p.mois<=t&&!($('ySkip').checked&&p.statut==='importée')).sort((a,b)=>a.mois.localeCompare(b.mois));
  return L.map(p=>({...p,tx:(p.tx||[]).map(x=>({...x}))}))}
async function yearFile(){const L=await yearSel();if(!L.length){$('yMsg').textContent='Aucune période dans cet intervalle.';return null}
  L.forEach(p=>p.tx.forEach(classify));
  const nw=new Map(newAccts()),used=new Set();L.forEach(p=>p.tx.forEach(t=>lines(t,p.src).forEach(([a])=>{if(nw.has(a))used.add(a)})));
  $('yWarn').hidden=!used.size;if(used.size)$('yWarn').innerHTML=`<strong>Avant d'importer, créez ces comptes dans Sage :</strong> ${[...used].sort().map(a=>esc(a+' '+nw.get(a))).join(', ')}`;
  const todo=L.reduce((s,p)=>s+p.tx.filter(t=>t.st==='transit').length,0),n=L.reduce((s,p)=>s+p.tx.length,0);
  $('yMsg').textContent=`${L.length} période(s), ${n} écritures${todo?`, dont ${todo} au transitoire ${C.tr}`:''}.`;
  return L.map(p=>buildFile(p)).filter(Boolean).join('')}
$('yCp').onclick=async()=>{const f=await yearFile();if(f==null)return;try{await navigator.clipboard.writeText(f);$('yMsg').textContent+=' Copié.'}catch(e){$('yMsg').textContent+=' Copie refusée par le navigateur.'}};
$('yDl').onclick=async()=>{const f=await yearFile();if(f==null)return;try{await downloads.save({filename:`${C.nom.replace(/[^\w-]+/g,'_')}_${$('yFrom').value}_a_${$('yTo').value}_${$('ySrc').value}_sage50.txt`,data:sageBytes(f)});$('yMsg').textContent+=' Fichier enregistré.'}catch(e){$('yMsg').textContent+=' Téléchargement annulé ou refusé.'}};
$('yMark').onclick=async()=>{const L=await yearSel();if(!L.length)return;const day=new Date().toLocaleDateString('fr-CA');
  L.forEach(p=>{p.tx=p.tx.map(t=>({...t,id:++seq}));p.statut='importée';p.exported=day;savePerFlush(p)});await pWriting;
  if(P&&L.some(p=>p.mois===P.mois&&p.src===P.src)){P.statut='importée';P.exported=day}$('yMsg').textContent=`${L.length} période(s) marquée(s) comme importées.`;loadPeriods()};
async function loadPeriods(){
  $('plist').innerHTML='<tr><td colspan="6" class="empty">Chargement…</td></tr>';let L=[];
  try{if(local)L=Object.entries(LOCAL.periodes).filter(([k])=>k.startsWith(C.id+'/')).map(([,v])=>v);
    else{const s=await db.collection('clients').doc(C.id).collection('periodes').get();L=s.docs.map(d=>d.data())}PERS=L;L.forEach(todoNow);
    const srcs=[...new Set(L.map(p=>p.src))];const keep=$('ySrc').value;$('ySrc').innerHTML=srcs.map(x=>`<option value="${esc(x)}">${esc(x+' '+accName(x))}</option>`).join('');if(srcs.includes(keep))$('ySrc').value=keep;
    const ms=L.map(p=>p.mois).sort();if(!$('yFrom').value&&ms.length){$('yFrom').value=ms[0];$('yTo').value=ms[ms.length-1]}$('yDl').hidden=!downloads;}
  catch(e){$('plist').innerHTML='<tr><td colspan="6" class="empty">Lecture impossible pour le moment.</td></tr>';return}
  {const[xd,xf]=exRange();if(xd&&!$('perAll').checked)L=L.filter(p=>p.mois>=xd.slice(0,7)&&p.mois<=(xf||'9999-99').slice(0,7))}
  L.sort((a,b)=>b.mois.localeCompare(a.mois)||a.src.localeCompare(b.src));
  $('plist').innerHTML=L.length?L.map(p=>`<tr><td>${esc(moisLbl(p.mois))}</td><td>${esc(p.src)} ${esc(accName(p.src))}</td><td class="num">${+p.n||0}</td><td class="num">${+p.todo||0}</td><td>${p.statut==='importée'?'<span class="pill ok">Importée dans Sage</span>':p.todo?'<span class="pill todo">À réviser</span>':'<span class="pill">Prête</span>'}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="sm" data-m="${esc(p.mois)}" data-s="${esc(p.src)}">Ouvrir</button><button class="sm danger" data-del="${esc(p.mois+'_'+p.src)}">Supprimer</button></div></td></tr>`).join('')
    :'<tr><td colspan="6" class="empty">Aucune période encore. Déposez un premier relevé dans Révision.</td></tr>';
}
$('plist').onclick=e=>{const b=e.target.closest('button[data-m]');if(!b)return;$('pMois').value=b.dataset.m;
  if(![...$('pSrc').options].some(o=>o.value===b.dataset.s))$('pSrc').insertAdjacentHTML('beforeend',`<option value="${esc(b.dataset.s)}">${esc(b.dataset.s)}</option>`);
  $('pSrc').value=b.dataset.s;setTab('rev');openPeriod()};

/* ---------- révision ---------- */
function visible(){if(!P)return[];if(idFilter)return P.tx.filter(t=>idFilter.ids.has(t.id));const q=norm($('q').value);
  return P.tx.filter(t=>(filter==='all'||(filter==='todo'&&aCl(t))||(filter==='sug'&&t.st==='suggere')||(filter==='done'&&!aCl(t)&&t.st!=='suggere'))&&(!q||norm(t.desc).includes(q)||String(t.acct).includes(q)))}
function render(){try{revUI()}catch(e){}
  const tx=P?P.tx:[];const v=visible();
  $('tb').innerHTML=v.length?v.map(t=>`<tr class="${t.st}" data-id="${t.id}">
    <td><input type="checkbox" data-k="sel" aria-label="Sélectionner" ${SEL.has(t.id)?'checked':''}${lk(t.date)?' disabled':''}></td>
    <td class="d">${esc(t.date)}</td><td>${esc(t.desc)}${t.pj?.length?` <span title="${esc(t.pj.map(p=>p.n).join(', '))}">${t.pj.map(p=>`<a href="#" data-pjo="${esc(p.c)}" style="text-decoration:none">📎</a>`).join('')}</span>`:''}<div class="why">${esc(t.why||'')}</div></td>
    <td class="num ${t.amt>0?'pos':''}">${esc(fmt(t.amt))}</td>
    <td><select data-k="acct" aria-label="Compte"${lk(t.date)?' disabled title="Exercice fermé"':''}>${optsSel(t.acct)}</select></td>
    <td><input type="checkbox" data-k="tax" aria-label="Taxes incluses" ${t.tax?'checked':''}${lk(t.date)?' disabled':''}></td></tr>`).join('')
    :`<tr><td colspan="6" class="empty">${!tx.length?'Aucune transaction dans cette période.':filter==='todo'?'Rien au transitoire. La période est prête à exporter.':'Rien à afficher.'}</td></tr>`;
  const tot=tx.length,todo=tx.filter(aCl).length,sug=tx.filter(t=>t.st==='suggere').length;
  $('gPer').textContent=P?(P.multi&&P.to!==P.mois?`${moisLbl(P.mois)} – ${moisLbl(P.to)}`:moisLbl(P.mois)):'—';$('gTot').textContent=tot;$('gOk').textContent=tot-todo-sug;$('gTodo').textContent=todo;
  $('bOk').style.width=tot?((tot-todo-sug)/tot*100)+'%':'0';$('bSug').style.width=tot?(sug/tot*100)+'%':'0';$('bTodo').style.width=tot?(todo/tot*100)+'%':'0';
  const unk=tx.filter(t=>t.st==='transit'&&t.unk).length;
  $('ask').hidden=!sampleFn||!unk;$('ask').textContent=`Classer les ${unk} inconnus avec l'IA`;
  $('acceptSug').hidden=!sug;$('acceptSug').textContent=`Accepter les ${sug} suggestions`;
  $('fban').hidden=!idFilter;if(idFilter)$('fbanT').textContent='Filtre : '+idFilter.title;
  renderSummary();renderExport();renderChecks();renderBulk();
  const nl=tx.filter(t=>lk(t.date)).length;$('lockBan').hidden=!nl;if(nl)$('lockBan').textContent=`${nl} transaction(s) appartiennent à un exercice fermé : elles sont en lecture seule.`;
}
function lines(t,src){
  const L=[[src||P.src,t.amt]];const g=-t.amt;
  if(t.tax&&t.acct!==C.tr){const gross=Math.abs(g),n0=Math.round(gross/1.14975),tps=Math.round(n0*0.05),tvq=Math.round(n0*0.09975),net=gross-tps-tvq;
    if(g>0)L.push([t.acct,net],[C.tpsA,tps],[C.tvqA,tvq]);else L.push([t.acct,-net],[C.tpsV,-tps],[C.tvqV,-tvq])}
  else L.push([t.acct,g]);return L}
function renderSummary(){const m=new Map();(P?P.tx:[]).forEach(t=>lines(t).forEach(([a,c])=>{const o=m.get(a)||[0,0];c>0?o[0]+=c:o[1]-=c;m.set(a,o)}));
  $('sum').innerHTML=[...m].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([a,[d,c]])=>`<tr><td>${esc(a)} ${esc(accName(a))}${a===C.tr?' <span class="pill todo">transitoire</span>':''}</td><td class="num">${d?esc(fmt(d)):''}</td><td class="num">${c?esc(fmt(c)):''}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">Aucune transaction.</td></tr>'}
const sageDate=iso=>{const[y,m,d]=iso.split('-');return C.dfmt==='dmys'?`${d}/${m}/${y}`:C.dfmt==='dmy'?`${d}-${m}-${y}`:C.dfmt==='ymd'?`${y}-${m}-${d}`:`${m}-${d}-${C.dfmt==='yyyy'?y:y.slice(2)}`};
function buildFile(p=P){if(!p)return'';return p.tx.map((t,i)=>{const src=('REL'+t.date.slice(5).replace('-','')+'-'+(i+1)).slice(0,20);
  return `${sageDate(t.date)},"${src}","${t.desc.replace(/["\r\n]/g,' ').slice(0,75)}"\r\n`+lines(t,p.src).filter(l=>l[1]).map(([a,c])=>`${a},${(c/100).toFixed(2)}`).join('\r\n')}).join('\r\n')+'\r\n'}
const CP={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
const sageBytes=str=>{const b=new Uint8Array(str.length);for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);b[i]=c<128||(c>159&&c<256)?c:(CP[c]||63)}return b};
function exportIssues(tx,src){const I=[];const[d,f]=exRange();const nw=new Set(newAccts().map(p=>p[0]));
  tx.forEach(t=>{const L=lines(t,src);if(d&&t.date<d)I.push(`${t.date} ${t.desc} : avant le début de l'exercice (${d})`);if(f&&t.date>f)I.push(`${t.date} ${t.desc} : après la fin de l'exercice (${f})`);
    if(t.acct===src)I.push(`${t.date} ${t.desc} : classé dans le compte du relevé lui-même (${src})`);
    L.forEach(([a])=>{const p=PLAN.find(q=>q[0]===a);if(!p)I.push(`${t.date} ${t.desc} : compte ${a} absent du plan`);else if(isHeader(p[0],p[1]))I.push(`${t.date} ${t.desc} : compte de titre ou de total ${a}`)});
    if(L.reduce((s,l)=>s+l[1],0))I.push(`${t.date} ${t.desc} : écriture non balancée`)});return I}
function renderNewAcc(){const iss=P?exportIssues(P.tx,P.src):[];$('expIss').hidden=!iss.length;if(iss.length)$('expIss').innerHTML=`<strong>Sage refusera ces écritures, à corriger avant l'export :</strong><ul style="margin:6px 0">${iss.slice(0,12).map(x=>`<li>${esc(x)}</li>`).join('')}${iss.length>12?`<li>… et ${iss.length-12} autre(s)</li>`:''}</ul>`;const un=usedNew(),el=$('newAcc');el.hidden=!un.length;if(!un.length)return;
  el.innerHTML=`<strong>Avant d'importer, créez ces comptes dans Sage :</strong><ul style="margin:6px 0">${un.map(([n,t])=>`<li>${esc(n)} ${esc(t)}</li>`).join('')}</ul><button class="sm" id="newAccOk">C'est fait, ils existent dans Sage</button>`;
  $('newAccOk').onclick=()=>{un.forEach(([n])=>{if(!C.sage.includes(n))C.sage.push(n)});saveClient();render()}}
function renderExport(){renderNewAcc();const f=buildFile(),ls=f.trimEnd().split(/\r?\n/);$('exPrev').textContent=f?ls.slice(0,12).join('\n')+(ls.length>12?'\n…':''):'';
  const todo=P?P.tx.filter(t=>t.st==='transit').length:0,sug=P?P.tx.filter(t=>t.st==='suggere').length:0;
  $('exMsg').textContent=P?.statut==='importée'?`Marquée comme importée dans Sage le ${P.exported||''}.`:[todo&&`${todo} transaction(s) iront au compte transitoire ${C.tr}.`,sug&&`${sug} suggestion(s) de l'IA pas encore vérifiée(s).`].filter(Boolean).join(' ');
  $('markDone').disabled=!P||!P.tx.length}

function showToast(html,acts){const el=$('toast');el.innerHTML=html;el.classList.add('on');
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>{acts[b.dataset.a]?.();el.classList.remove('on')});
  clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),14000)}
$('tb').addEventListener('change',e=>{
  const tr=e.target.closest('tr');if(!tr)return;const t=P.tx.find(x=>x.id==tr.dataset.id);if(!t)return;
  if(e.target.dataset.k!=='sel'&&!revOk()){render();return}
  if(e.target.dataset.k==='sel'){e.target.checked?SEL.add(t.id):SEL.delete(t.id);renderBulk();return}
  if(e.target.dataset.k==='tax'){audit('Taxes modifiées',`${txTxt(t)} : taxes ${e.target.checked?'cochées':'décochées'}`);t.tax=e.target.checked;if(t.st==='auto'){t.st='manuel';t.why='Ajusté à la main'}render();savePer();return}
  if(e.target.value==='__new'){e.target.value=t.acct;newAccount(t);return}
  if(t.inv){const iv=INV.find(i=>i.id===t.inv);if(iv){delete iv.pay;saveInv(iv).catch(()=>{})}t.inv=''}
  const a=e.target.value;audit('Transaction classée à la main',`${txTxt(t)} : ${t.acct} → ${a} ${accName(a)}`);Object.assign(t,{acct:a,st:'manuel',why:'Classé à la main',unk:false});
  afterManual(t,a);
});
let dlgTx=null,planFromFile=false;
let dlgCb=null;
function newAccount(t,cb){dlgTx=t;dlgCb=cb||null;$('accNo').value='';$('accNm').value='';$('accErr').textContent='';try{$('accDlg').showModal()}catch(e){$('accDlg').setAttribute('open','')}$('accNo').focus()}
$('accForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel'){dlgTx=null;if(dlgCb){const cb=dlgCb;dlgCb=null;cb(null)}return}
  const no=$('accNo').value.trim(),nm=$('accNm').value.trim().replace(/\s+/g,' ');
  if(!no||!nm){e.preventDefault();$('accErr').textContent='Numéro et nom requis.';return}
  if(PLAN.some(p=>p[0]===no)){e.preventDefault();$('accErr').textContent=`Le compte ${no} existe déjà : ${accName(no)}.`;return}
  addAccount(no,nm);const t=dlgTx;dlgTx=null;if(dlgCb){const cb=dlgCb;dlgCb=null;cb(no)}
  if(t){Object.assign(t,{acct:no,st:'manuel',why:'Classé à la main',unk:false});afterManual(t,no)}});
function renommerCompte(no,nm){const L=PLAN.map(p=>p[0]===no?[no,nm]:p);C.plan=L.map(p=>p.join(' ')).join('\n');audit('Compte renommé',`${no} → ${nm}`);setPlan();fillSelects();renderSettings();renderRules();$('planTxt').value=C.plan;saveClient()}
function addAccount(no,nm){if(!Array.isArray(C.sage))C.sage=PLAN.map(p=>p[0]);
  const L=PLAN.concat([[no,nm]]).sort((a,b)=>a[0].localeCompare(b[0],'fr',{numeric:true}));C.plan=L.map(p=>p.join(' ')).join('\n');
  setPlan();fillSelects();renderSettings();renderRules();$('planTxt').value=C.plan;saveClient();render()}
function afterManual(t,a){
  if(!P.tx.some(x=>x.st==='transit')&&!P.tx.some(x=>x.st==='suggere')){render();savePer();const un=usedNew();showToast(`<span>✓ Enregistré dans ${esc(a)} ${esc(accName(a))}. Tout est classé.</span><button class="sm pri" data-a="f">Terminer la période</button>`,{f:openFinish});return}
  const p=keyOf(t.desc);const others=P.tx.filter(x=>x!==t&&x.st!=='manuel'&&has(norm(x.desc),p));
  render();savePer();const ok=`<span>✓ Enregistré : ${esc(t.desc.slice(0,40))} → ${esc(a)} ${esc(accName(a))}.</span>`;if(a===C.tr||!p){showToast(ok,{});return}
  showToast(`${ok}<span>Retenir pour ce client : « ${esc(p)} » → ${esc(a)} ${esc(accName(a))}${others.length?`, et l'appliquer aux ${others.length} autres semblables`:''} ?</span><button class="sm pri" data-a="y">Retenir la règle</button><button class="sm" data-a="n">Juste celle-ci</button>`,
    {y:()=>{C.rules=(C.rules||[]).filter(r=>r.p!==p);C.rules.push({p,a,t:!!t.tax});others.forEach(x=>{if(x.st==='suggere')x.st='transit'});reclass();saveClient();renderRules();render();savePer()}});
}
document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filter=b.dataset.f;document.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',x===b));render()});
$('q').oninput=render;
$('acceptSug').onclick=()=>{P.tx.filter(t=>t.st==='suggere').forEach(t=>{const p=keyOf(t.desc);if(p&&!(C.rules||[]).some(r=>r.p===p))C.rules.push({p,a:t.acct,t:!!t.tax});Object.assign(t,{st:'auto',why:'Règle du client : '+p})});saveClient();renderRules();render();savePer()};

/* ---------- lecture de fichiers ---------- */
const loadScript=src=>new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s)});
function decode(buf){let s=new TextDecoder('utf-8').decode(buf);if(s.includes(String.fromCharCode(0xFFFD)))s=new TextDecoder('windows-1252').decode(buf);return s.replace(/^﻿/,'')}
function parseCSV(text){const first=text.split(/\r?\n/).slice(0,8).join('\n');const d=[';',',','\t'].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
    else if(c==='"')q=true;else if(c===d){row.push(cell);cell=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row.map(x=>x.trim()));row=[];cell=''}
    else cell+=c}
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row.map(x=>x.trim()));return rows}
async function readXlsx(f){if(!window.XLSX)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});const ws=wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws,{header:1,raw:false,dateNF:'yyyy-mm-dd',defval:''}).map(r=>r.map(x=>String(x).trim())).filter(r=>r.some(Boolean))}
const PDFDOC=new WeakMap();
async function pdfImage(f,n){const doc=PDFDOC.get(f);const pg=await doc.getPage(n);const vp=pg.getViewport({scale:2});const cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
  await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;const b=await new Promise(ok=>cv.toBlob(ok,'image/jpeg',0.85));return new File([b],'page'+n+'.jpg',{type:'image/jpeg'})}
async function pdfPages(f){const V='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  if(!window.pdfjsLib){await loadScript(V+'pdf.worker.min.js');await loadScript(V+'pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc=V+'pdf.worker.min.js'}
  let doc;try{doc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise}catch(e){throw new Error(/password/i.test(e?.name+e?.message)?'le PDF est protégé par un mot de passe':'le fichier PDF ne s’ouvre pas ('+(e?.message||e)+')')}
  PDFDOC.set(f,doc);const pages=[];
  for(let p=1;p<=doc.numPages;p++){const tc=await(await doc.getPage(p)).getTextContent();const rows=new Map();
    tc.items.forEach(it=>{const y=Math.round(it.transform[5]/3);(rows.get(y)||rows.set(y,[]).get(y)).push(it)});
    pages.push([...rows].sort((a,b)=>b[0]-a[0]).map(([,it])=>it.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n'))}
  return pages}
const rowsOf=async f=>/\.xlsx?$/i.test(f.name)?readXlsx(f):parseCSV(decode(await f.arrayBuffer()));

/* ---------- relevés : colonnes ---------- */
const MOIS={JAN:1,JANV:1,FEV:2,FEB:2,MAR:3,MARS:3,AVR:4,APR:4,MAI:5,MAY:5,JUN:6,JUIN:6,JUL:7,JUIL:7,AOU:8,AUG:8,SEP:9,SEPT:9,OCT:10,NOV:11,DEC:12};
const isDate=s=>/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)||/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(s)||/^\d{1,2}\s+[A-Za-zéû]{3,5}\.?\s+\d{4}$/.test(s);
function toISO(s,order){let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);if(m){let[a,b,y]=[+m[1],+m[2],m[3]];if(y.length===2)y='20'+y;const[dd,mm]=order==='MDY'?[b,a]:[a,b];return `${y}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`}
  m=norm(s).match(/^(\d{1,2})\s+([A-Z]{3,5})\.?\s+(\d{4})$/);if(m&&MOIS[m[2]])return `${m[3]}-${String(MOIS[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`;return null}
function toCents(s){if(s==null)return null;let x=String(s).replace(/[\s $]/g,'').replace(/CAD/i,'');if(!x)return null;
  let neg=false;if(/^\(.*\)$/.test(x)){neg=true;x=x.slice(1,-1)}if(/-$/.test(x)){neg=true;x=x.slice(0,-1)}if(x.startsWith('-')){neg=true;x=x.slice(1)}
  if(x.includes(',')&&x.includes('.'))x=x.lastIndexOf(',')>x.lastIndexOf('.')?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'');
  else if(x.includes(','))x=/,\d{1,2}$/.test(x)?x.replace(',','.'):x.replace(/,/g,'');
  if(!/^\d*\.?\d+$/.test(x))return null;const c=Math.round(parseFloat(x)*100);return neg?-c:c}
function guess(rows){const hasHead=!rows[0].some(isDate);const head=hasHead?rows[0]:null;const body=(hasHead?rows.slice(1):rows).slice(0,60);
  const n=Math.max(...rows.map(r=>r.length));const st=[];
  for(let c=0;c<n;c++){const v=body.map(r=>r[c]||'');const fl=v.filter(Boolean);
    st.push({c,h:norm(head?.[c]||''),date:v.filter(isDate).length/body.length,num:fl.filter(x=>toCents(x)!==null&&!/^\d{5,}$/.test(x)).length/Math.max(1,fl.length),fill:fl.length/body.length,len:fl.reduce((s,x)=>s+x.length,0)/Math.max(1,fl.length),dec:fl.some(x=>/[.,]\d{2}$/.test(x))})}
  const by=re=>st.find(s=>re.test(s.h))?.c??-1;
  let date=by(/^DATE|DATE (DE )?TRANS|POSTED|TRANSACTION DATE/);if(date<0)date=[...st].sort((a,b)=>b.date-a.date)[0].c;
  let desc=by(/DESCRIPTION|LIBELLE|DETAIL|MARCHAND|MERCHANT|PAYEE/);if(desc<0)desc=[...st].filter(s=>s.num<.5&&s.c!==date).sort((a,b)=>b.len-a.len)[0]?.c??-1;
  let out=by(/RETRAIT|DEBIT|WITHDRAW|SORTIE|ACHAT/),inn=by(/DEPOT|CREDIT|DEPOSIT|ENTREE|PAIEMENT/),amt=by(/^MONTANT|AMOUNT/);
  if(amt<0&&out<0){const nums=st.filter(s=>s.num>.9&&s.dec&&s.c!==date&&!/SOLDE|BALANCE/.test(s.h));const sp=nums.filter(s=>s.fill<.95);
    if(sp.length>=2){out=sp[0].c;inn=sp[1].c}else if(nums.length)amt=nums[0].c}
  let order='DMY';for(const r of body){const m=(r[date]||'').match(/^(\d{1,2})[-/.](\d{1,2})[-/.]/);if(m){if(+m[2]>12){order='MDY';break}if(+m[1]>12)break}}
  let bal=by(/SOLDE|BALANCE/);if(bal<0){const full=st.filter(s=>s.num>.9&&s.dec&&s.fill>=.95&&![date,amt,out,inn].includes(s.c));if(full.length)bal=full[full.length-1].c}
  const d2=st.find(s=>/DESCRIPTION 2|DESCRIPTION2|DETAILS? 2/.test(s.h))?.c??-1;
  return {head,body:hasHead?rows.slice(1):rows,n,date,desc,desc2:d2!==desc?d2:-1,amt,out,inn,bal,order}}
function showMap(g,name){parsed=g;const o=`<option value="-1">—</option>`+Array.from({length:g.n},(_,c)=>`<option value="${c}">${esc(g.head?.[c]||'Colonne '+(c+1))}${g.body[0]?.[c]?' : '+esc(String(g.body[0][c]).slice(0,24)):''}</option>`).join('');
  for(const[id,k]of[['mDate','date'],['mDesc','desc'],['mDesc2','desc2'],['mAmt','amt'],['mOut','out'],['mIn','inn'],['mBal','bal']]){$(id).innerHTML=o;$(id).value=g[k]??-1}
  {const carte=/CARTE|VISA|MASTERCARD|AMEX/.test(norm(accName(P.src)))||/^2/.test(String(P.src));let inv=carte;
    /* le signe des achats varie selon la banque : on regarde les paiements (ou, à défaut, la majorité des lignes) */
    if(carte&&g.amt>=0){const v=g.body.map(r=>({d:norm((r[g.desc]||'')+' '+(g.desc2>=0?r[g.desc2]||'':'')),c:toCents(r[g.amt])})).filter(x=>x.c);const pay=v.filter(x=>/PAYMENT|PAIEMENT|MERCI|THANK/.test(x.d));
      if(pay.length)inv=pay.filter(x=>x.c<0).length>pay.length/2;else if(v.length)inv=v.filter(x=>x.c>0).length>v.length/2}
    $('mInv').checked=inv}$('mapFile').textContent=name;$('mapBox').hidden=false;preview()}
function mapped(g=parsed){const [cD,cS,cS2,cA,cO,cI]=['mDate','mDesc','mDesc2','mAmt','mOut','mIn'].map(id=>+$(id).value),inv=$('mInv').checked,res=[];
  for(const r of g.body){const date=toISO(r[cD]||'',g.order);if(!date)continue;let c;
    if(cA>=0)c=toCents(r[cA]);else{const o=toCents(r[cO]),i=toCents(r[cI]);if(o===null&&i===null)continue;c=(i?Math.abs(i):0)-(o?Math.abs(o):0)}
    if(c===null||c===0)continue;if(inv)c=-c;res.push({date,desc:[r[cS],cS2>=0?r[cS2]:''].filter(Boolean).join(' ').replace(/\s+/g,' ')||'(sans description)',amt:c})}
  return res}
function preview(){const m=queue.length>1?queue.flatMap(q=>mapped(q.g)):mapped();$('mPrev').textContent=m.length?m.slice(0,6).map(t=>`${t.date}   ${fmt(t.amt).padStart(14)}   ${t.desc}`).join('\n')+`\n… ${m.length} transactions reconnues`:'Aucune transaction reconnue avec ces colonnes.'}
['mDate','mDesc','mDesc2','mAmt','mOut','mIn','mInv'].forEach(id=>$(id).onchange=preview);
$('mGo').onclick=()=>{const Q=queue.length?queue:[{name:'',g:parsed}];const per=Q.map(q=>({name:q.name,m:mapped(q.g)}));const m=per.flatMap(x=>x.m);
  const bad=per.filter(x=>!x.m.length&&x.name).map(x=>x.name);if(!m.length){msg('Aucune transaction reconnue. Vérifiez les colonnes.',true);return}
  const sts=Q.map(q=>stmtOfCsv(q.g,q.name)).filter(Boolean);
  {const g0=Q[0].g,h=norm(String(g0.head?.[g0.amt]??''));if(/\bUSD\b|US\$|\bUS\b/.test(h)&&devOf(P.src)!=='USD'){C.dev={...(C.dev||{}),[P.src]:'USD'};audit('Devise du compte',`${P.src} : USD (colonne ${g0.head[g0.amt]})`);saveClient();LED=null;setTimeout(()=>msg($('msg').textContent+` Montants en dollars US : le compte ${P.src} est maintenant en US$ (converti en $ CA au grand livre).`),1500)}}
  $('mapBox').hidden=true;queue=[];importAny(m).then(()=>{if(sts.length){sts.forEach(addStmt);saveClient();msg($('msg').textContent+` Soldes repris pour la conciliation : ${sts.length} relevé(s).`)}if(bad.length)msg($('msg').textContent+` Rien de reconnu dans : ${bad.join(', ')} (colonnes différentes? importez ce fichier seul).`,true)})};
$('mCancel').onclick=()=>{$('mapBox').hidden=true};
const msg=(t,err)=>{$('msg').textContent=t;$('msg').className='msg'+(err?' err':'')};

/* Anti-doublons : dans un même compte, une transaction = une date + un montant. On compte les occurrences (date, montant) déjà dans la période :
   reverser le même relevé, ou le même relevé dans un autre format (PDF, CSV, Excel, description écrite autrement), n'ajoute rien;
   trois frais de 1,50 $ le même jour restent trois frais; une transaction manquante est ajoutée. */
/* Deux relevés consécutifs qui partagent seulement leur date de coupure (8 sept–8 oct, puis 8 oct–8 nov) ne contiennent jamais la même transaction :
   ce jour-là, une transaction du relevé voisin ne compte pas comme doublon. Deux relevés qui se recouvrent vraiment (mensuel + export du 15 au 30) se dédoublonnent. */
const voisins=(a,b)=>{if(!a||!b||a===b)return false;const[ad,aa]=a.split('_'),[bd,ba]=b.split('_');const lo=ad>bd?ad:bd,hi=aa<ba?aa:ba;return hi<=lo};
let MSTAT=null,REPORT=[];
function mergeInto(p,list){
  let added=0,dup=0;const seen=new Map();
  for(const x of list){if(lk(x.date)){if(MSTAT)MSTAT.verr=(MSTAT.verr||0)+1;continue}const k=x.date+'|'+x.amt;const s=(seen.get(k)||0)+1;seen.set(k,s);
    const h=p.tx.filter(t=>t.date===x.date&&t.amt===x.amt&&!voisins(t.rel,x.rel)).length;if(s<=h){dup++;continue}
    const t={id:++seq,...x};classify(t);p.tx.push(t);added++}
  p.tx.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  if(added&&p.statut==='importée')p.statut='en cours';
  if(added&&p.revise){audit('Mois révisé modifié',`${moisLbl(p.mois)} · ${p.src} : ${added} transaction(s) ajoutée(s), révision retirée`);p.revise=null}
  if(MSTAT){MSTAT.added+=added;MSTAT.dup+=dup}
  return {added,dup}}
async function readPeriod(m,src){if(local)return LOCAL.periodes[C.id+'/'+m+'_'+src]||null;const s=await db.collection('clients').doc(C.id).collection('periodes').doc(m+'_'+src).get();return s.exists?s.data():null}
/* Relevés qui chevauchent la fin (ou le début) de l'exercice : les transactions hors de l'exercice en cours sont mises de côté
   et ajoutées automatiquement quand on travaille dans l'exercice où elles tombent (ex. relevé du 8 sept. au 8 oct., fin d'exercice le 30 sept.). */
const exBornes=()=>{const x=curEx();if(x)return[x.deb,x.fin];const r=exRange();return r[0]&&r[1]?r:null};
function relAttente(src,mois){const b=exBornes();if(!b||!C)return[];const[xd,xf]=b;const dans=x=>x.date>=xd&&x.date<=xf;
  const pris=(C.attente||[]).filter(x=>(!src||x.src===src)&&(!mois||x.date.slice(0,7)===mois)&&dans(x)&&!lk(x.date));
  const st=(C.attenteSt||[]).filter(x=>x.du>=xd&&x.au<=xf);
  if(pris.length)C.attente=C.attente.filter(x=>!pris.includes(x));
  if(st.length){C.attenteSt=C.attenteSt.filter(x=>!st.includes(x));st.forEach(addStmt)}
  if(pris.length||st.length)saveClient();return pris.map(({date,desc,amt,rel})=>({date,desc,amt,...(rel?{rel}:{})}))}
async function importAny(list){const b=exBornes();let hors=[];if(MSTAT)MSTAT.lu+=list.length;
  if(b){const[xd,xf]=b;hors=list.filter(x=>x.date<xd||x.date>xf);
    if(hors.length){list=list.filter(x=>x.date>=xd&&x.date<=xf);
      /* déjà dans les livres de l'autre exercice (ex. relevé reversé l'année suivante) : doublons, pas « mis de côté » */
      const parM=new Map();hors.forEach(x=>{const m=x.date.slice(0,7);parM.set(m,[...(parM.get(m)||[]),x])});const neufs=[];
      for(const[m,L]of parM){let tx=[];try{const d=await readPeriod(m,P.src);tx=d?.tx||[]}catch(e){}const seen=new Map();
        L.forEach(x=>{const k=x.date+'|'+x.amt,n=(seen.get(k)||0)+1;seen.set(k,n);const h=tx.filter(t=>t.date===x.date&&t.amt===x.amt&&!voisins(t.rel,x.rel)).length;if(n<=h){if(MSTAT)MSTAT.dup++}else neufs.push(x)})}
      hors=neufs}
    if(hors.length){const k=x=>x.src+'|'+x.date+'|'+x.amt;const have=new Map();(C.attente||[]).forEach(x=>have.set(k(x),(have.get(k(x))||0)+1));const seen=new Map();
      const avant=(C.attente||[]).length;
      C.attente=[...(C.attente||[]),...hors.map(x=>({date:x.date,desc:x.desc,amt:x.amt,src:P.src,...(x.rel?{rel:x.rel}:{})})).filter(x=>{const n=(seen.get(k(x))||0)+1;seen.set(k(x),n);return n>(have.get(k(x))||0)})];const nv=C.attente.length-avant;if(MSTAT){MSTAT.cote+=nv;MSTAT.dup+=hors.length-nv};saveClient()}}
  list=list.concat(relAttente(P.src));
  if(list.length)await importAny0(list);else msg('');LED=null;pairPlus();
  if(hors.length){const[xd,xf]=b,ap=hors.filter(x=>x.date>xf).length,av=hors.length-ap;
    msg(`${$('msg').textContent} ${ap?`${ap} transaction(s) après la fin d’exercice (${xf})`:''}${ap&&av?' et ':''}${av?`${av} transaction(s) avant le début de l’exercice (${xd})`:''} mise(s) de côté : elles ne touchent pas cet exercice et seront ajoutées automatiquement quand vous travaillerez dans l’exercice où elles tombent.`.trim())}}
/* Partage un relevé qui chevauche les bornes de l'exercice : la partie dans l'exercice sert à la conciliation, le reste attend son exercice. */
function stmtExercice(st,list){const b=exBornes();if(!st||!b)return st;const[xd,xf]=b;if(st.du>=xd&&st.au<=xf)return st;
  const deja=q=>[...(C.stmts||[]),...(C.attenteSt||[])].some(x=>x.src===q.src&&x.du===q.du&&x.au===q.au);
  if(st.au<xd||st.du>xf){if(!deja(st))C.attenteSt=[...(C.attenteSt||[]),st];return null}
  const sum=f=>list.filter(f).reduce((a,x)=>a+x.amt,0);let{du,au,sd,sf}=st;const parts=[];
  if(du<xd&&au>=xd){const s0={...st,au:addDays(xd,-1),sf:sd+sum(x=>x.date<xd),nom:st.nom+' (avant l’exercice)'};parts.push(s0);sd=s0.sf;du=xd}
  let fin=null;if(au>xf&&du<=xf){fin={...st,du:addDays(xf,1),sd:sd+sum(x=>x.date>=du&&x.date<=xf),nom:st.nom+' (après la fin d’exercice)'};au=xf;sf=fin.sd}
  if(fin)parts.push(fin);C.attenteSt=[...(C.attenteSt||[]),...parts.filter(p=>!deja(p))];
  return{...st,du,au,sd,sf,nom:st.nom+(parts.length?' (partie dans l’exercice)':'')}}
async function importAny0(list){
  if(P.multi){const L=list.map(x=>({...x,_m:x.date.slice(0,7)}));L.forEach(x=>{if(!P.parts.some(p=>p.mois===x._m))P.parts.push({mois:x._m,src:P.src,statut:'en cours',exported:'',exists:false})});
    P.parts.sort((a,b)=>a.mois.localeCompare(b.mois));const{added,dup}=mergeInto(P,L);P.parts.forEach(p=>{if(p.statut==='importée'&&L.some(x=>x._m===p.mois))p.statut='en cours'});
    msg(`${added} transaction(s) ajoutée(s)${dup?`, ${dup} doublon(s) ignoré(s)`:''}.`);autoMatch();AIITEMS=[];render();savePer();
    if(sampleFn&&P.tx.some(t=>t.st==='transit'&&t.unk))try{await askAI(true)}catch(e){console.warn(e)}return}
  const by=new Map();list.forEach(x=>{const m=x.date.slice(0,7);by.set(m,[...(by.get(m)||[]),x])});
  const months=[...by.keys()].sort();
  if(months.length===1&&months[0]===P.mois)return addTx(list);
  savePerNow();msg(`Répartition en ${months.length} mois…`);
  const src=P.src,cur=P,ps=[];let added=0,dup=0;
  for(const m of months){let p=cur.mois===m?cur:null;
    if(!p){p={mois:m,src,tx:[],statut:'en cours'};try{const d=await readPeriod(m,src);if(d){p.statut=d.statut;p.exported=d.exported;p.tx=(d.tx||[]).map(t=>({...t,id:++seq}));p.tx.forEach(classify)}}catch(e){}}
    const r=mergeInto(p,by.get(m));added+=r.added;dup+=r.dup;ps.push(p)}
  let n=0,iaPanne=false;if(sampleFn&&ps.some(p=>p.tx.some(t=>t.st==='transit'&&t.unk))){msg(`${added} transactions réparties sur ${months.length} mois. L'IA classe les fournisseurs inconnus…`);try{n=await aiSuggest(ps.flatMap(p=>p.tx))}catch(e){console.warn(e);iaPanne=true}}
  ps.forEach(p=>savePerFlush(p));
  const last=months[months.length-1];if((C.last||'')<last){C.last=last;saveClient()}
  await pWriting;
  $('pMois').value=months[0];await openPeriod();
  msg(`${added} transaction(s) ${months.length>1?`réparties sur ${months.length} mois (${moisLbl(months[0])} à ${moisLbl(last)})`:`ajoutée(s) en ${moisLbl(months[0])}`}${dup?`, ${dup} doublon(s) ignoré(s)`:''}.${n?` L'IA a proposé un compte pour ${n} transaction(s).`:''}${iaPanne?' L’IA n’a pas pu proposer de comptes pour l’instant : classez-les, ou relancez « Classer les inconnus avec l’IA » plus tard.':''} Chaque mois est une période : voyez l'onglet Périodes, ou exportez l'exercice d'un coup.`);
}
async function addTx(list){
  const {added,dup}=mergeInto(P,list);
  msg(`${added} transaction(s) ajoutée(s)${dup?`, ${dup} doublon(s) ignoré(s)`:''}.`);
  autoMatch();AIITEMS=[];render();savePer();
  if(sampleFn&&P.tx.some(t=>t.st==='transit'&&t.unk))try{await askAI(true)}catch(e){console.warn(e)}
  const n=checks().filter(c=>c.lvl!=='ok').length;if(n)msg($('msg').textContent+` ${n} point(s) à vérifier plus bas.`);
}

/* Rapport d'activité PayPal (CSV : Date, Description, Currency, Gross, Fee, Net, Balance…) : les lignes de la devise du compte,
   chaque vente au brut et ses frais à part; le solde du rapport sert à la conciliation. */
function paypalTx(rows,name){const h=(rows[0]||[]).map(x=>norm(x));const ix=k=>h.indexOf(k);
  const I={d:ix('DATE'),ds:ix('DESCRIPTION')>=0?ix('DESCRIPTION'):ix('TYPE'),cur:ix('CURRENCY'),g:ix('GROSS'),f:ix('FEE'),n:ix('NET'),b:ix('BALANCE'),nm:ix('NAME')};
  if([I.d,I.ds,I.cur,I.g,I.f,I.n].some(i=>i<0))return null;
  const body=rows.slice(1).filter(r=>r[I.d]&&r[I.cur]),cur=r=>String(r[I.cur]).trim().toUpperCase();
  let order='DMY';for(const r of body){const m=String(r[I.d]).match(/^(\d{1,2})[/.-](\d{1,2})[/.-]/);if(m){if(+m[2]>12){order='MDY';break}if(+m[1]>12)break}}
  const iso=x=>toISO(String(x).trim(),order);let dev=devOf(P.src);const curs=[...new Set(body.map(cur))];
  if(!body.some(r=>cur(r)===dev)&&dev==='CAD'&&curs.includes('USD')){C.dev={...(C.dev||{}),[P.src]:'USD'};audit('Devise du compte',`${P.src} : USD (rapport PayPal)`);saveClient();LED=null;dev='USD'}
  const L=body.filter(r=>cur(r)===dev),autres=body.filter(r=>cur(r)!==dev);const out=[];let first=null,last=null;
  L.forEach(r=>{const date=iso(r[I.d]);if(!date)return;const g=toCents(r[I.g])||0,f=toCents(r[I.f])||0,b=I.b>=0?toCents(r[I.b]):null,nm=I.nm>=0?String(r[I.nm]||'').trim():'';let ds=String(r[I.ds]).trim();
    if(/CURRENCY CONVERSION/.test(norm(ds))){const e=autres.find(x=>iso(x[I.d])===date&&/PAYMENT/.test(norm(x[I.ds])));if(e)ds=`Paiement en ${cur(e)} à ${String(e[I.nm]||'').trim()||'un fournisseur'} (conversion PayPal)`}
    const desc=`${ds}${nm?' — '+nm:''}`.slice(0,120);if(g)out.push({date,desc,amt:g});if(f)out.push({date,desc:`Frais PayPal — ${desc}`.slice(0,120),amt:f});
    if(b!=null){const net=toCents(r[I.n])??g+f;if(!first)first={date,sd:b-net};last={date,sf:b}}});
  const fm=String(name).match(/(20\d{6})\d{6}-(20\d{6})\d{6}/),d8=x=>`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)}`;
  out._st=first&&last?{src:P.src,du:fm?d8(fm[1]):first.date,au:fm?d8(fm[2]):last.date,sd:first.sd,sf:last.sf,nom:name,via:'Rapport PayPal'}:null;out._dev=dev;out._autres=curs.filter(c=>c!==dev);return out}
async function handle(files){
  if(!P||(!P.multi&&P.src!==$('pSrc').value)){if(!$('pSrc').value){msg('Choisissez d’abord le compte du relevé (banque ou carte).',true);return}if(!$('pMois').value)$('pMois').value=new Date().toISOString().slice(0,7);await openPeriod();if(!P){msg('Impossible d’ouvrir la période.',true);return}}
  const pdfs=files.filter(f=>/\.pdf$/i.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name));const lignes=[];let err=false;
  for(const f of pdfs){REPORT=[];MSTAT={lu:0,added:0,dup:0,cote:0};
    try{await readStatementPdf(f);const r=REPORT[0];const m=MSTAT;
      if(r)audit('Relevé versé',`${f.name}${r.du?` (${r.du} au ${r.au})`:''} : ${MSTAT.added} ajoutée(s), ${MSTAT.dup} doublon(s), ${MSTAT.cote} mise(s) de côté`);
      if(r)lignes.push(`${f.name}${r.du?` (du ${r.du} au ${r.au})`:''} : ${r.n} lues${r.ok?' ✓ soldes concordants':' ⚠ soldes non vérifiés'} · ${m.added} ajoutée(s) · ${m.dup} doublon(s) ignoré(s)${m.cote?` · ${m.cote} mise(s) de côté (hors exercice)`:''}${m.verr?` · ${m.verr} refusée(s) : dates protégées`:''}`)}
    catch(e){console.error(e);err=true;lignes.push(`${f.name} : lecture impossible (${e.message||e}). Réessayez, ou exportez le relevé en CSV.`)}
    MSTAT=null}
  if(pdfs.length>1||lignes.length&&pdfs.length){$('msg').style.whiteSpace='pre-line';msg((pdfs.length>1?'Relevés versés :\n':'')+lignes.join('\n')+(pdfs.length===1&&!err?'\n'+$('msg').textContent:''),err)}
  queue=[];
  for(const f of files.filter(f=>!/\.pdf$/i.test(f.name))){
    try{const rows=await rowsOf(f);if(rows.length<2){msg(f.name+' : fichier vide ou illisible.',true);continue}
      const pp=paypalTx(rows,f.name);if(pp){MSTAT={lu:0,added:0,dup:0,cote:0};if(pp.length)await importAny(pp);const m=MSTAT;MSTAT=null;
        if(pp._st){const sx=stmtExercice(pp._st,pp);if(sx)addStmt(sx);saveClient()}audit('Rapport PayPal versé',`${f.name} : ${m.added} ajoutée(s)`);
        msg(`${f.name} (rapport PayPal, en ${pp._dev}) : ${pp.length} ligne(s) — ventes au brut et frais PayPal séparés · ${m.added} ajoutée(s) · ${m.dup} doublon(s) ignoré(s)${m.cote?` · ${m.cote} mise(s) de côté (hors exercice)`:''}.${pp._st?' Soldes repris pour la conciliation.':''}${pp._autres.length?` Les lignes en ${pp._autres.join(', ')} servent seulement à décrire les conversions (chaque devise a son propre solde chez PayPal).`:''}`);continue}
      queue.push({name:f.name,g:guess(rows)})}
    catch(e){msg(`Lecture impossible de ${f.name} : ${e.message||e}.`,true)}}
  if(queue.length)showMap(queue[0].g,queue.length>1?`${queue[0].name} et ${queue.length-1} autre(s) fichier(s), mêmes colonnes`:queue[0].name);
}
let queue=[];
/* Lecture directe d'un relevé PDF en tableau (colonnes débits / crédits / solde), sans IA.
   Le résultat n'est retenu que si solde d'ouverture + transactions = solde de clôture, au cent près. */
const moisN=w=>{w=norm(w);return MOIS[w.slice(0,4)]||MOIS[w.slice(0,3)]||0};
async function pdfTable(f){const doc=PDFDOC.get(f);if(!doc)return null;
  const AMT=/^\(?-?\$?\s?\d{1,3}(?:[  ,.]\d{3})*[.,]\d{2}\s?\$?\)?(?:\s?CR)?$/i;
  const cents=t=>{const neg=/^\(|-|CR$/i.test(t.trim());const d=t.replace(/[^\d.,]/g,'');const m=d.match(/^(.*)[.,](\d{2})$/);if(!m)return null;return(neg?-1:1)*(+(m[1].replace(/[.,]/g,'')+m[2]))};
  const pages=[];for(let p=1;p<=doc.numPages;p++){const tc=await(await doc.getPage(p)).getTextContent();const rows=new Map();
    tc.items.filter(it=>it.str.trim()).forEach(it=>{const y=Math.round(it.transform[5]/3);(rows.get(y)||rows.set(y,[]).get(y)).push({s:it.str.trim(),x:it.transform[4],r:it.transform[4]+it.width})});
    pages.push([...rows].sort((a,b)=>b[0]-a[0]).map(([,it])=>it.sort((a,b)=>a.x-b.x)))}
  const all=pages.flat().map(r=>r.map(i=>i.s).join(' ')).join('\n');
  const pm=norm(all).match(/(?:DU|FROM)\s+(\d{1,2})\s+([A-Z]+)\.?,?\s+(\d{4})\s+(?:AU|TO)\s+(\d{1,2})\s+([A-Z]+)\.?,?\s+(\d{4})/);if(!pm)return null;
  const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const du=iso(pm[3],moisN(pm[2]),pm[1]),au=iso(pm[6],moisN(pm[5]),pm[4]);if(!moisN(pm[2])||!moisN(pm[5]))return null;
  const solde=re=>{for(const r of pages.flat()){const t=norm(r.map(i=>i.s).join(' '));if(re.test(t)){const a=r.filter(i=>AMT.test(i.s));if(a.length)return cents(a[a.length-1].s)}}return null};
  const sd=solde(/SOLDE D.?OUVERTURE|SOLDE PRECEDENT|SOLDE ANTERIEUR|OPENING BALANCE|PREVIOUS BALANCE/),sf=solde(/SOLDE DE CLOTURE|SOLDE DE FERMETURE|NOUVEAU SOLDE|SOLDE FINAL|CLOSING BALANCE|NEW BALANCE/);
  if(sd==null||sf==null)return null;
  const out=[];let cols=null,date=null,pend='';
  const annee=(m,d)=>{for(const y of[+du.slice(0,4),+au.slice(0,4)]){const x=iso(y,m,d);const t=Date.parse(x),a=Date.parse(du)-864e6,b=Date.parse(au)+864e6;if(t>=a&&t<=b)return x}return null};
  for(const rows of pages){cols=null;
    for(const r of rows){const t=norm(r.map(i=>i.s).join(' '));
      if(!cols){const h=k=>r.find(i=>k.test(norm(i.s)));const de=h(/DEBIT|RETRAIT|WITHDRAW/),cr=h(/CREDIT|DEPOT|DEPOSIT/),so=h(/^SOLDE|BALANCE/);
        if(de&&cr&&de!==cr){cols={de:de.r,cr:cr.r,so:so?.r};pend=''}continue}
      if(/SOLDE D.?OUVERTURE|OPENING BALANCE|SOLDE PRECEDENT/.test(t))continue;
      if(/SOLDE DE CLOTURE|CLOSING BALANCE|SOLDE DE FERMETURE|NOUVEAU SOLDE/.test(t)){cols=null;continue}
      const dm=t.match(/^(\d{1,2})\s+([A-Z]{3,9})\.?(?=\s|$)/);let skip=0;
      if(dm&&moisN(dm[2])){const x=annee(moisN(dm[2]),+dm[1]);if(!x)return null;date=x;skip=dm[0].length}
      const amts=r.filter(i=>AMT.test(i.s)&&i.x>(cols.de-200));
      let desc=r.filter(i=>!amts.includes(i)).map(i=>i.s).join(' ');if(skip){desc=desc.replace(/^\s*\d{1,2}\s+\S+\.?\s*/,'').replace(new RegExp('^'+dm[1]+'\\s+\\S+\\.?\\s*'),'')}
      desc=desc.trim();
      const tx=amts.filter(i=>{const d=[['de',Math.abs(i.r-cols.de)],['cr',Math.abs(i.r-cols.cr)],['so',cols.so?Math.abs(i.r-cols.so):1e9]].sort((a,b)=>a[1]-b[1])[0];i.k=d[0];return d[0]!=='so'&&d[1]<60});
      if(!tx.length){if(desc&&date&&!amts.length)pend=(pend+' '+desc).trim().slice(0,200);continue}
      if(!date||tx.length>1)return null;
      const c=Math.abs(cents(tx[0].s));out.push({date,desc:((pend?pend+' ':'')+desc).replace(/\s+/g,' ').trim().slice(0,120)||'Transaction',amt:tx[0].k==='de'?-c:c});pend=''}}
  if(!out.length)return null;
  const tot=out.reduce((a,x)=>a+x.amt,0);if(tot!==sf-sd)return null;
  out._st={src:P?.src||'',du,au,sd,sf,nom:f.name,via:'lecture directe'};out._direct=true;return out}
async function readStatementPdf(f){
  const out=await pdfTx(f,msg);
  if(!out.length){msg('Aucune transaction trouvée dans ce PDF. Essayez le CSV.',true);return}
  if(out._st)out.forEach(x=>x.rel=out._st.du+'_'+out._st.au);
  let usdNote='';try{const doc=PDFDOC.get(f);if(doc&&devOf(P.src)!=='USD'){const tc=await(await doc.getPage(1)).getTextContent();const t1=norm(tc.items.map(i=>i.str).join(' '));
    if(/FONDS EN USD|EN DOLLARS US|DOLLARS AMERICAINS|\bUS DOLLARS?\b|\(USD\)|DEVISE : USD/.test(t1)){C.dev={...(C.dev||{}),[P.src]:'USD'};audit('Devise du compte',`${P.src} : USD (relevé en dollars US)`);saveClient();LED=null;usdNote=` Relevé en dollars US : le compte ${P.src} est maintenant en US$ (converti en $ CA au grand livre).`}}}catch(e){}
  const tot=out.reduce((a,x)=>a+x.amt,0),ok=out._st&&tot===out._st.sf-out._st.sd;
  await importAny(out);msg($('msg').textContent+(out._direct?' Relevé lu directement (sans IA) : solde d’ouverture + transactions = solde de clôture, au cent près.':ok?' Lu par l’IA : le total concorde avec les soldes du relevé.':out._st?` Lu par l’IA : ATTENTION, écart de ${fmt(out._st.sf-out._st.sd-tot)} avec les soldes du relevé — une transaction manque ou est mal lue.`:' Lu par l’IA dans le PDF : comparez le total avec le relevé.')+(out._err?.length?` Attention, pages non lues : ${out._err.join(' · ')}.`:''));
  if(out._st)REPORT.push({nom:f.name,du:out._st.du,au:out._st.au,n:out.length,ok:out._direct||ok,via:out._direct?'lecture directe':'IA'});else REPORT.push({nom:f.name,n:out.length,ok:false,via:'IA'});
  if(out._st){const o=out._st,b=exBornes(),dehors=b&&(o.au<b[0]||o.du>b[1]);if(!(dehors&&(C.stmts||[]).some(x=>x.src===o.src&&x.du===o.du&&x.au===o.au)))C.stmts=(C.stmts||[]).filter(x=>!(x.src===o.src&&x.du===o.du&&x.au===o.au));{const sx=stmtExercice(o,out);if(sx)addStmt(sx)}saveClient();msg($('msg').textContent+' Soldes du relevé repris pour la conciliation.')}
  if(usdNote)msg($('msg').textContent+usdNote);
}
/* Relevé de carte de crédit (mise en page RBC et semblables : « DATE DE L'OPÉRATION / DATE D'INSCRIPTION », montants entre parenthèses = crédits),
   lu directement sans IA; retenu seulement si solde précédent + opérations = nouveau solde, au cent près. Montants au signe du grand livre :
   achat négatif, paiement positif; soldes dus en négatif. */
async function pdfCarte(f){const doc=PDFDOC.get(f);if(!doc)return null;const lignes=[];
  for(let p=1;p<=doc.numPages;p++){const tc=await(await doc.getPage(p)).getTextContent();const it=tc.items.filter(i=>i.str.trim());
    const W=(await doc.getPage(p)).view[2]||612;const cut=Math.min(...it.filter(i=>i.transform[4]>W*0.35&&/RENSEIGNEMENTS IMPORTANTS|PAIEMENTS ET TAUX|CALCUL DE VOTRE SOLDE|COMMUNIQUEZ AVEC NOUS/.test(norm(i.str))).map(i=>i.transform[4]),1e9);
    /* les lettres accentuées arrivent parfois en morceaux collés : on ne met une espace que s'il y a un vrai blanc */
    const join=L=>L.reduce((t,i,k)=>{const pr=L[k-1];return t+(pr&&i.transform[4]-(pr.transform[4]+pr.width)>1.2?' ':'')+i.str.trim()},'');
    const rows=new Map();it.forEach(i=>{const y=Math.round(i.transform[5]/3);(rows.get(y)||rows.set(y,[]).get(y)).push(i)});
    [...rows].sort((a,b)=>b[0]-a[0]).forEach(([,r])=>{r.sort((a,b)=>a.transform[4]-b.transform[4]);lignes.push({g:join(r.filter(i=>i.transform[4]<cut-4)),t:join(r)})})}
  const T=norm(lignes.map(l=>l.t).join('\n'));const pm=T.match(/(?:REVELE|RELEVE|PERIODE)?\s*DU\s+(\d{1,2})\s+([A-Z]{3,4})\.?\s*(\d{4})?\s+AU\s+(\d{1,2})\s+([A-Z]{3,4})\.?\s+(\d{4})/);if(!pm)return null;
  const mE=moisN(pm[5]),yE=+pm[6],mD=moisN(pm[2]);if(!mE||!mD)return null;const yD=pm[3]?+pm[3]:(mD>mE?yE-1:yE);
  const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const mt=x=>{const neg=/\(/.test(x)||/-/.test(x);const d=x.replace(/[^\d,.]/g,'');const m=d.match(/^(.*)[,.](\d{2})$/);return m?(neg?-1:1)*+(m[1].replace(/[.,]/g,'')+m[2]):null};
  const solde=re=>{for(const l of lignes){const n=norm(l.t),m=n.match(re);if(m){const a=n.slice(m.index+m[0].length).match(/^[^\d(]{0,30}(\(?-?\d{1,3}(?:[  ]\d{3})*[,.]\d{2}\s?\$?\)?)/);if(a)return mt(a[1])}}return null};
  const sd=solde(/SOLDE DE COMPTE PRECEDENT|SOLDE PRECEDENT|PREVIOUS (ACCOUNT )?BALANCE/),sf=solde(/SOLDE DE COMPTE TOTAL|NOUVEAU SOLDE|NEW BALANCE/);if(sd==null||sf==null)return null;
  const out=[];const RX=/^(\d{2}) ([A-Z]{3,4})\.? (\d{2}) ([A-Z]{3,4})\.? (.+?) (\(?-?[\d  ]{1,12}[,.]\d{2} ?\$?\)?)$/;
  for(const l of lignes){const n=norm(l.g);const m=n.match(RX);if(!m)continue;/* date d'inscription : c'est elle qui place l'opération dans la période du relevé */const mo=moisN(m[4]);if(!mo)continue;const y=mo>mE&&mD>mE?yD:mo>mE?yE-1:yE;const v=mt(m[6]);if(v==null)continue;
    out.push({date:iso(y,mo,+m[3]),desc:m[5].replace(/\s+/g,' ').slice(0,120),amt:-v})}
  if(!out.length)return null;const tot=out.reduce((a,x)=>a+x.amt,0);if(-sd+tot!==-sf)return null;
  out._st={du:iso(yD,mD,+pm[1]),au:iso(yE,mE,+pm[4]),sd:-sd,sf:-sf,nom:f.name,via:'lecture directe',src:P.src};out._direct=true;return out}
async function pdfTx(f,say){
  say('Lecture du PDF…');const pages=await pdfPages(f);const out=[];const errs=[];
  try{const d=await pdfTable(f);if(d)return d}catch(e){console.warn('lecture directe',e)}
  try{const d=await pdfCarte(f);if(d)return d}catch(e){console.warn('lecture directe (carte)',e)}
  if(!sampleFn)throw new Error('ce relevé demande l’IA, qui n’est pas disponible ici');
  const INSTR=`Extrais CHAQUE transaction de ces pages seulement. Ignore soldes, totaux, sommaires et reports. Réponds uniquement avec un tableau JSON : [{"date":"AAAA-MM-JJ","description":"texte tel quel","montant":-12.34}]. montant négatif = sortie d'argent (retrait, achat, frais), positif = entrée (dépôt, remboursement, paiement reçu sur la carte). Déduis l'année de la période du relevé. [] s'il n'y a aucune transaction.`;
  const add=r=>{let n=0;(Array.isArray(r)?r:[]).forEach(x=>{const d=toISO(String(x.date||''));const c=Math.round(Number(x.montant)*100);if(d&&c){out.push({date:d,desc:String(x.description||'').slice(0,120),amt:c});n++}});return n};
  const parImage=async n=>{say(`L'IA regarde l'image de la page ${n} sur ${pages.length}…`);
    return add(await sampleFn.json(`Voici l'image d'une page d'un relevé bancaire ou de carte de crédit canadien.${pages[0].trim()?` Texte de la page 1 pour contexte (période, année) :\n${pages[0].slice(0,1500)}`:''}\n\n${INSTR}`,{modelTier:'default',images:[await pdfImage(f,n)]}))};
  for(let i=0;i<pages.length;i++){const n=i+1;
    try{if(pages[i].replace(/\s/g,'').length<80){await parImage(n);continue}
      say(`L'IA lit la page ${n} sur ${pages.length}…`);
      try{add(await sampleFn.json(`Voici le texte d'un relevé bancaire ou de carte de crédit canadien. Page 1 pour contexte (période, année) :\n${pages[0].slice(0,1500)}\n\n--- PAGE À EXTRAIRE ---\n${pages[i]}\n\n${INSTR}`,{modelTier:'default'}))}
      catch(e){await parImage(n)}}
    catch(e){console.error(e);errs.push(`page ${n} : ${e.message||e}`)}}
  if(!out.length&&!errs.length&&pages.some(p=>p.trim())){for(let n=1;n<=pages.length;n++){try{await parImage(n)}catch(e){errs.push(`page ${n} : ${e.message||e}`)}}}
  if(!out.length&&errs.length)throw new Error(errs.join(' · '));
  out._err=errs;
  const scan=pages[0].replace(/\s/g,'').length<80;
  try{const s=await sampleFn.json(`${scan?'Images':'Texte'} de la première et de la dernière page d'un relevé bancaire ou de carte de crédit canadien :\n${pages[0].slice(0,2500)}\n...\n${pages[pages.length-1].slice(-2500)}\n\nDonne la période et les soldes. Réponds uniquement en JSON : {"du":"AAAA-MM-JJ","au":"AAAA-MM-JJ","solde_debut":1234.56,"solde_fin":1234.56,"carte":false}. Pour une carte de crédit, carte=true et les soldes sont les montants dus (positifs). null si introuvable.`,{modelTier:'default',...(scan?{images:[await pdfImage(f,1),...(pages.length>1?[await pdfImage(f,pages.length)]:[])]}:{})});
    const du=toISO(String(s?.du||'')),au=toISO(String(s?.au||''));if(du&&au&&s.solde_debut!=null&&s.solde_fin!=null){const sg=s.carte?-1:1;out._st={src:P?.src||'',du,au,sd:sg*Math.round(Number(s.solde_debut)*100),sf:sg*Math.round(Number(s.solde_fin)*100),nom:f.name,via:'IA'}}}catch(e){}
  return out;
}
$('goLinks').onclick=e=>{e.preventDefault();setTab('links')};
$('file').onchange=e=>{handle([...e.target.files]);e.target.value=''};
function dropzone(el,fn){['dragenter','dragover'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.remove('over')}));el.addEventListener('drop',e=>fn([...e.dataTransfer.files]))}
dropzone($('drop'),handle);

/* ---------- IA : fournisseurs inconnus ---------- */
async function aiSuggest(txs){
  const descs=[...new Set(txs.filter(t=>t.st==='transit'&&t.unk).map(t=>t.desc))].slice(0,150);if(!descs.length)return 0;
  const r=await sampleFn.json(`Tu aides un cabinet comptable québécois à faire la tenue de livres du client « ${C.nom} ». Plan comptable du client :\n${PLAN.map(p=>p.join(' ')).join('\n')}\n${iaProfil()?`\n${iaProfil()}\n`:''}${C.notes?`\nNotes du cabinet sur ce client : ${C.notes}\n`:''}\nPour chaque description de transaction bancaire ci-dessous, donne le compte de dépense ou de revenu le plus probable dans CE plan (numéro exact). Si c'est un nom de personne, un virement ou trop vague pour savoir, mets null. taxable = true si la dépense porte normalement TPS/TVQ au Québec.\n${descs.map((k,i)=>i+'. '+k).join('\n')}\n\nRéponds uniquement avec un tableau JSON : [{"i":0,"compte":"5310","taxable":true}]`,{modelTier:'default'});
  const ok=new Set(PLAN.map(p=>p[0]));let n=0;
  (Array.isArray(r)?r:[]).forEach(x=>{const d=descs[x.i];const a=x.compte==null?null:String(x.compte);if(d==null||!a||!ok.has(a)||a===C.tr)return;
    txs.filter(t=>t.desc===d&&t.st==='transit').forEach(t=>{Object.assign(t,{acct:a,tax:!!x.taxable,st:'suggere',why:'Suggéré par l’IA : à vérifier',unk:false});n++})});
  return n}
async function askAI(auto){
  if(!P.tx.some(t=>t.st==='transit'&&t.unk))return;
  $('ask').disabled=true;$('ask').textContent='L’IA classe…';if(auto)msg($('msg').textContent+' L’IA classe les fournisseurs inconnus…');
  try{const n=await aiSuggest(P.tx);
    msg(`${auto?$('msg').textContent.replace(' L’IA classe les fournisseurs inconnus…',''):''} ${n?`L'IA a proposé un compte pour ${n} transaction(s) : voyez l'onglet « Suggérées par l'IA ».`:'L’IA n’a rien pu classer avec assez de certitude.'}`.trim());
    savePer();
  }catch(e){msg(e.code==='rate_limited'?'Trop de demandes à l’IA, réessayez dans une minute.':e.code==='not_granted'?'Accès à l’IA refusé.':'Classement par l’IA impossible pour le moment.',true)}
  $('ask').disabled=false;render();
}
$('ask').onclick=()=>askAI(false);

/* ---------- points à vérifier ---------- */
const EXEMPT=/ASSURANCE|FRAIS BANC|FRAIS DE BANQUE|INTERET|SALAIRE|IMMATRICUL|PERMIS|TAXES MUNICIPALES|TAXES FONCIERES|DONS|AMENDE|PENALITE|RETRAIT|ACTIONNAIRE|EMPRUNT|PRET/;
const TAXABLE=new RegExp([CAT.carb,CAT.elec,CAT.tel,CAT.log,CAT.four,CAT.pub,CAT.veh].map(r=>r.source).join('|'));
const BIGSKIP=/JURIDIQUE|LEGAL|AVOCAT|NOTAIRE|COMPTABILITE|LOYER|SALAIRE|REMBOURS|CARTE|EMPRUNT|PRET|TPS|TVQ|RETRAIT|ACTIONNAIRE|TRANSITOIRE|IMPOT|DAS|REVENU QUEBEC|SOUS.?TRAIT|HONORAIRE|AVANCE|DIVIDENDE|INTERET|ASSURANCE|FRAIS BANCAIRE|COTISATION|TAXES|PERMIS|ABONNEMENT|TELECOM|ELECTRICITE|CARBURANT|PUBLICITE|REPAS|DEPLACEMENT|FORMATION|DONS?\b|SERVICES PROFESSIONNELS|CONSULTANT/;
/* « Dépense importante » : pas signalée quand une règle du client classe déjà ce fournisseur dans un compte qui ne peut pas être une immobilisation (ex. Marta → sous-traitance). Sans règle, ou vers un compte d’équipement, on signale. */
const IMMO=/^(?!.*(LOCATION|LOYER|DENEIGEMENT|GESTION|CONCIERGERIE|BUANDERIE)).*(MATERIEL|EQUIPEMENT|OUTIL|\bMOBILIER\b|AMEUBLEMENT|ORDINATEUR|INFORMATIQUE|LOGICIEL|ENTRETIEN|REPARATION|AMELIORATION|RENOVATION|FOURNITURE|MATERIAUX|ACHAT|VEHICULE|CAMION|MACHIN|INSTRUMENT|APPAREIL|IMMOBILISATION|DIVERS|AUTRES? (DEPENSES|FRAIS))/;
const PROF=/\b(AVOCATS?|NOTAIRES?|LAWYERS?|JURIDIQUE|LEGAL|CPA|COMPTABLES?|HUISSIER|ARPENTEUR|ACTUAIRE)\b/;
const parRegle=t=>t.st==='auto'&&/^Règle du client/.test(t.why||'');
/* Professions dont les services sont exonérés : sans réglage contraire, on suppose le client non inscrit à la TPS/TVQ. */
const EXONERE=/\b(MEDECIN|DR|DRE|DOCTEUR|CLINIQUE MEDICALE|DENTISTE|PSYCHOLOGUE|PHYSIOTHERAPEUTE|CHIROPRATICIEN|OPTOMETRISTE|ORTHOPHONISTE|ERGOTHERAPEUTE|INFIRMIER|INFIRMIERE|SAGE-FEMME|AUDIOLOGISTE|PODIATRE|ACUPUNCTEUR|GARDERIE|CPE)\b/;
/* Une dépense importante confirmée (✓ Vérifié) pour un fournisseur et un compte ne revient plus dans les autres mois du dossier. */
const immoCle=t=>keyOf(t.desc)+'|'+t.acct;
const immoDejaOk=t=>{const v=(C.immoOk||{})[immoCle(t)];return!!v&&v!==P.mois+'_'+P.src};
const dd=(a,b)=>Math.abs((new Date(a)-new Date(b))/864e5);
function checks(){
  if(!P||!P.tx.length)return[];const tx=P.tx,out=[],add=(lvl,title,detail,list)=>out.push({lvl,title,detail,ids:(list||[]).map(t=>t.id)});
  const nm=t=>norm(accName(t.acct)),sumA=l=>l.reduce((s,t)=>s+Math.abs(t.amt),0);
  const tr=tx.filter(t=>t.st==='transit');
  const dep=tr.filter(t=>t.amt>0);
  if(dep.length)add('haut',`Dépôts non identifiés : ${dep.length} (${fmt(sumA(dep))})`,'Ventes taxables? Prêt? Apport de l’actionnaire? Remboursement de taxes? À savoir avant de déclarer les ventes et la TPS/TVQ perçue.',dep);
  const out_=tr.filter(t=>t.amt<0);
  if(out_.length)add('haut',`Sorties au transitoire : ${out_.length} (${fmt(sumA(out_))})`,C.sage50?'Classez-les avant l’export, ou exportez-les au transitoire et régularisez dans Sage plus tard.':'Classez-les, ou laissez-les au transitoire pour les régulariser plus tard.',out_);
  const sug=tx.filter(t=>t.st==='suggere');if(sug.length)add('moyen',`Suggestions de l'IA à confirmer : ${sug.length}`,'Vérifiez le compte proposé, puis « Accepter les suggestions » pour en faire des règles.',sug);
  const gab=tx.filter(t=>/\b(RETRAIT|GAB|DAB|ATM)\b/.test(norm(t.desc))&&t.amt<0);
  if(gab.length)add('moyen',`Retraits en argent comptant : ${gab.length} (${fmt(sumA(gab))})`,'Sans pièce justificative, ça va généralement en retraits ou avances à l’actionnaire. Demandez au client.',gab);
  const grp=new Map();tr.filter(t=>AMBIG.test(norm(t.desc))&&t.amt<0).forEach(t=>{const k=t.amt;grp.set(k,[...(grp.get(k)||[]),t])});
  const prevAmts=new Set(PREV.map(p=>p.amt));
  tr.filter(t=>AMBIG.test(norm(t.desc))&&t.amt<0&&prevAmts.has(t.amt)&&(grp.get(t.amt)||[]).length<2).forEach(t=>grp.set(t.amt,[t,t]));
  for(const[a,l]of grp){const u=[...new Set(l)];if(l.length>=2||(Math.abs(a)>=50000&&Math.abs(a)%10000===0))add('moyen',`Virement récurrent ou rond : ${fmt(a)}${u.length>1?` × ${u.length}`:''}`,'Souvent un loyer, un salaire ou un remboursement de prêt. Demandez au client, classez-le, puis retenez la règle.',u)}
  const dups=[];for(let i=0;i<tx.length;i++)for(let j=i+1;j<tx.length;j++){const a=tx[i],b=tx[j];if(a.amt===b.amt&&a.amt<0&&keyOf(a.desc)===keyOf(b.desc)&&!AMBIG.test(norm(a.desc))&&dd(a.date,b.date)<=3)dups.push([a,b])}
  dups.forEach(([a,b])=>add('moyen',`Doublon possible : ${a.desc}`,`${fmt(a.amt)} le ${a.date} et le ${b.date}. Double paiement?`,[a,b]));
  const big=tx.filter(t=>t.amt<=-150000&&t.st!=='transit'&&/^[56]/.test(String(t.acct))&&!BIGSKIP.test(nm(t))&&!(parRegle(t)&&!IMMO.test(nm(t)))&&!PROF.test(norm(t.desc))&&!immoDejaOk(t));
  big.forEach(t=>add('moyen',`Dépense importante : ${t.desc} (${fmt(t.amt)})`,'Plus de 1 500 $ : obtenez la facture et vérifiez si c’est une immobilisation à amortir plutôt qu’une dépense.',[t]));
  const self=tx.filter(t=>t.acct===(t.src||P.src));if(self.length)add('haut',`Classé dans le compte du relevé lui-même : ${self.length}`,`Ces transactions vont dans ${P.src} ${accName(P.src)}, le compte de banque du relevé : l'écriture s'annule. Choisissez le bon compte.`,self);
  const hdr=tx.filter(t=>{const p=PLAN.find(q=>q[0]===t.acct);return p&&isHeader(p[0],p[1])});if(hdr.length)add('haut',`Compte de titre ou de total : ${hdr.length}`,`${C.sage50?'Sage refuse les écritures':'Pas d’écriture possible'} dans ${[...new Set(hdr.map(t=>t.acct+' '+accName(t.acct)))].join(', ')}. Choisissez un compte détaillé.`,hdr);
  const nonInscrit=(C.profil?.tx??FICHE?.tps_tvq??(EXONERE.test(norm((C.desc||'')+' '+(FICHE?.description||'')+' '+C.nom))?false:undefined))===false;
  if(nonInscrit){const tt=tx.filter(t=>t.tax);if(tt.length)add('haut',`Taxes ventilées alors que le client n’est pas inscrit à la TPS/TVQ : ${tt.length}`,'Ce client ne réclame ni CTI ni RTI : décochez « Taxes incl. » (le montant complet va dans la dépense).',tt)}
  const exTax=nonInscrit?[]:tx.filter(t=>t.tax&&EXEMPT.test(nm(t)));
  if(exTax.length)add('haut',`Taxes ventilées sur des comptes exemptés : ${exTax.length}`,'Assurances, frais bancaires, intérêts, permis : pas de CTI ni de RTI. Décochez « Taxes incl. ».',exTax);
  const noTax=nonInscrit?[]:tx.filter(t=>!t.tax&&t.amt<0&&t.st!=='transit'&&TAXABLE.test(nm(t))&&!EXEMPT.test(nm(t)));
  if(noTax.length)add('bas',`Taxes non ventilées : ${noTax.length}`,'Ces dépenses portent normalement la TPS et la TVQ. Cochez « Taxes incl. » si le fournisseur est inscrit.',noTax);
  const rep=nonInscrit?[]:tx.filter(t=>t.tax&&t.amt<0&&CAT.rep.test(nm(t)));
  if(rep.length){const taxes=rep.reduce((s,t)=>{const g=Math.abs(t.amt),n0=Math.round(g/1.14975);return s+Math.round(n0*0.05)+Math.round(n0*0.09975)},0);
    add('bas','Repas : CTI et RTI limités à 50 %',`Taxes ventilées sur les repas : ${fmt(taxes)}. Environ ${fmt(Math.round(taxes/2))} doit retourner en dépense : ajustez dans Sage.`,rep)}
  if(PREV.length){const now=new Set(tx.map(t=>keyOf(t.desc)));const miss=[...new Map(PREV.filter(p=>p.k&&!AMBIG.test(norm(p.desc))&&!now.has(p.k)).map(p=>[p.k,p])).values()];
    if(miss.length)add('bas',`Paiements du mois précédent absents : ${miss.length}`,miss.slice(0,8).map(p=>`${p.desc} (${fmt(p.amt)})`).join(' · ')+'. Payés autrement, ou facture manquante?',[])}
  const rank={haut:0,moyen:1,bas:2};out.sort((a,b)=>rank[a.lvl]-rank[b.lvl]);
  if(!out.length)out.push({lvl:'ok',title:'Rien à signaler',detail:'Tout est classé et aucune anomalie n’a été détectée.',ids:[]});
  return out;
}
let CHK=[],CHKV=false;
const chkCle=(c,pre)=>(pre==='a'?'ia:':'')+c.title;
const chkCat=c=>c.title.split(/\s[:(]/)[0].trim();
const chkOff=c=>(C.chkOff||[]).includes(chkCat(c));
/* Points vérifiés : retenus au niveau du dossier, transaction par transaction (type de point + compte + date + montant + description).
   Ils restent vérifiés en vue « Un mois » comme « Plusieurs mois », après un changement de page, et quand le compte du point change.
   Une nouvelle transaction qui s'ajoute au point le fait revenir. */
const vSig=t=>(t.src||P.src)+'|'+t.date+'|'+t.amt+'|'+norm(t.desc).slice(0,40);
const vKeys=(c,pre)=>{const cat=(pre==='a'?'ia:':'')+chkCat(c);const L=P?P.tx.filter(t=>c.ids.includes(t.id)):[];return L.length?L.map(t=>cat+'|'+vSig(t)):[cat+'|'+(P?.src||'')+'|'+c.title]};
const vInfo=(c,pre)=>{const V=C.verifTx||{},ks=vKeys(c,pre);if(ks.every(k=>V[k]))return V[ks[0]];return(P&&P.verif&&P.verif[chkCle(c,pre)])||null};
const chkFait=(c,pre)=>!!vInfo(c,pre);
function itemHtml(c,i,pre){const info=vInfo(c,pre),v=!!info;
  return `<li class="${v?'ok':c.lvl}"><div><strong>${esc(c.title)}</strong><span>${esc(c.detail)}</span>${v?`<small class="note" style="display:block;margin-top:2px">Vérifié le ${new Date(info.le).toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'})}${info.par?' par '+esc(info.par):''}</small>`:''}</div><div class="row" style="gap:6px;flex-wrap:nowrap">${c.ids.length?`<button class="sm" data-c="${pre}${i}">Voir</button>`:''}${c.lvl==='ok'?'':v?`<button class="sm" data-unv="${pre}${i}" title="Remettre dans les points à vérifier">↺ Remettre</button>`:`<button class="sm pri" data-vok="${pre}${i}" title="Point vérifié : le retirer de la liste">✓ Vérifié</button>${pre==='c'?`<button class="sm" data-mute="${esc(chkCat(c))}" title="Ne plus signaler ce type de point pour ce dossier" aria-label="Ne plus signaler ce type de point pour ce dossier">🔕</button>`:''}`}</div></li>`}
function renderChecks(){CHK=checks();const all=[...CHK.map((c,i)=>[c,i,'c']),...AIITEMS.map((c,i)=>[c,i,'a'])].filter(([c,,p])=>c.lvl!=='ok'&&!(p==='c'&&chkOff(c)));
  const vus=all.filter(([c,,p])=>chkFait(c,p)),ouv=all.filter(([c,,p])=>!chkFait(c,p));
  $('chkN').textContent=ouv.length;$('chkNA').textContent=ouv.length;$('chkNV').textContent=vus.length;$('chkVA').setAttribute('aria-pressed',!CHKV);$('chkVV').setAttribute('aria-pressed',CHKV);
  if(!P||!P.tx.length){$('chk').innerHTML='<li><div><span>Déposez un relevé pour voir les vérifications.</span></div></li>';$('aiBox').hidden=true}
  else if(CHKV){$('chk').innerHTML=(vus.length?vus.map(([c,i,p])=>itemHtml(c,i,p)).join(''):'<li><div><span>Aucun point vérifié pour cette période. Cliquez sur « ✓ Vérifié » dans un point pour l’y déplacer.</span></div></li>')+((C.chkOff||[]).length?`<li><div><strong>Types de points désactivés pour ce dossier</strong><span>${(C.chkOff||[]).map(k=>`${esc(k)} <a href="#" data-unmute="${esc(k)}">réactiver</a>`).join(' · ')}</span></div></li>`:'');$('aiBox').hidden=true}
  else{const oc=ouv.filter(([,,p])=>p==='c'),oa=ouv.filter(([,,p])=>p==='a');$('chk').innerHTML=oc.length?oc.map(([c,i,p])=>itemHtml(c,i,p)).join(''):itemHtml({lvl:'ok',title:'Rien à signaler',detail:vus.length?`Tous les points sont vérifiés (${vus.length}).`:'Tout est classé et aucune anomalie n’a été détectée.',ids:[]},0,'c');
    $('aiBox').hidden=!oa.length;$('aiChk').innerHTML=oa.map(([c,i,p])=>itemHtml(c,i,p)).join('')}
  $('aiRev').hidden=!sampleFn||!P||!P.tx.length}
$('chkVA').onclick=()=>{CHKV=false;renderChecks()};$('chkVV').onclick=()=>{CHKV=true;renderChecks()};
document.getElementById('chkPanel').addEventListener('click',e=>{const m=e.target.closest('[data-mute],[data-unmute]');if(!m)return;e.preventDefault();
  if(m.dataset.mute){if(!confirm(`Ne plus signaler « ${m.dataset.mute} » pour ce dossier? (Réactivable dans l’onglet Vérifiés.)`))return;C.chkOff=[...new Set([...(C.chkOff||[]),m.dataset.mute])]}else C.chkOff=(C.chkOff||[]).filter(k=>k!==m.dataset.unmute);saveClient();renderChecks()});
document.getElementById('chkPanel').addEventListener('click',e=>{const b=e.target.closest('button[data-vok],button[data-unv]');if(!b||!P)return;const k=b.dataset.vok||b.dataset.unv,c=k[0]==='c'?CHK[+k.slice(1)]:AIITEMS[+k.slice(1)];if(!c)return;
  C.verifTx=C.verifTx||{};const qui={le:new Date().toISOString(),par:(document.getElementById('whoE')?.textContent||'').trim()};
  vKeys(c,k[0]).forEach(x=>{if(b.dataset.vok)C.verifTx[x]=qui;else delete C.verifTx[x]});if(P.verif)delete P.verif[chkCle(c,k[0])];saveClient();
  if(/^Dépense importante/.test(c.title)){C.immoOk=C.immoOk||{};P.tx.filter(t=>c.ids.includes(t.id)).forEach(t=>{if(b.dataset.vok)C.immoOk[immoCle(t)]=P.mois+'_'+P.src;else delete C.immoOk[immoCle(t)]});saveClient()}
  savePer();renderChecks()});
document.getElementById('chkPanel').addEventListener('click',e=>{const k=e.target.closest('button[data-c]')?.dataset.c;if(!k)return;
  const c=k[0]==='c'?CHK[+k.slice(1)]:AIITEMS[+k.slice(1)];if(!c)return;idFilter={ids:new Set(c.ids),title:c.title};render();$('txTable').scrollIntoView({behavior:'smooth',block:'start'})});
$('fbanX').onclick=()=>{idFilter=null;render()};
$('aiRev').onclick=async()=>{
  const b=$('aiRev');b.disabled=true;b.textContent='L’IA révise la période…';
  const rows=P.tx.map((t,i)=>`${i} | ${t.date} | ${t.desc} | ${(t.amt/100).toFixed(2)} | ${t.acct} ${accName(t.acct)} | ${t.tax?'taxes incl.':'sans taxes'}${t.st==='transit'?' | TRANSITOIRE':''}`).join('\n');
  try{const r=await sampleFn.json(`Tu es un technicien comptable expérimenté au Québec qui révise la tenue de livres de « ${C.nom} »${iaProfil()?' ('+iaProfil()+')':''} pour ${moisLbl(P.mois)}, compte ${P.src} ${accName(P.src)}.\nPlan comptable :\n${PLAN.map(p=>p.join(' ')).join('\n')}\n${C.notes?`Notes du cabinet : ${C.notes}\n`:''}\nTransactions (index | date | description | montant, négatif = sortie | compte | taxes) :\n${rows}\n\nDonne au plus 8 points de révision utiles et concrets : classements probablement erronés (avec le compte que tu proposes, numéro du plan), transactions au transitoire dont tu peux deviner la nature, traitement TPS/TVQ douteux, éléments inhabituels, et questions précises à poser au client. Pas de généralités ni de répétitions. Réponds uniquement avec un tableau JSON : [{"niveau":"haut|moyen|bas","titre":"court","detail":"une ou deux phrases","lignes":[0,3]}]`,{modelTier:'complex'});
    AIITEMS=(Array.isArray(r)?r:[]).slice(0,8).map(x=>({lvl:['haut','moyen','bas'].includes(x.niveau)?x.niveau:'moyen',title:String(x.titre||'').slice(0,140),detail:String(x.detail||'').slice(0,400),ids:(Array.isArray(x.lignes)?x.lignes:[]).map(i=>P.tx[+i]?.id).filter(Boolean)})).filter(x=>x.title);
    if(!AIITEMS.length)AIITEMS=[{lvl:'ok',title:'L’IA n’a rien relevé de particulier.',detail:'',ids:[]}];
  }catch(e){AIITEMS=[{lvl:'moyen',title:'Revue par l’IA impossible pour le moment',detail:e.code==='rate_limited'?'Trop de demandes, réessayez dans une minute.':'Réessayez plus tard.',ids:[]}]}
  b.disabled=false;b.textContent='Revue complète par l’IA';render();$('aiBox').scrollIntoView({behavior:'smooth',block:'nearest'})};

/* ---------- sélection multiple ---------- */
function renderBulk(){if(!P){SEL.clear()}else{const ids=new Set(P.tx.map(t=>t.id));for(const id of SEL)if(!ids.has(id))SEL.delete(id)}
  const v=visible();$('selAll').checked=v.length>0&&v.every(t=>SEL.has(t.id));$('selAll').indeterminate=!$('selAll').checked&&v.some(t=>SEL.has(t.id));
  $('bulk').hidden=!SEL.size;if(!SEL.size)return;const sel=P.tx.filter(t=>SEL.has(t.id));
  $('bulkN').textContent=`${sel.length} sélectionnée(s) · ${fmt(sel.reduce((s,t)=>s+t.amt,0))}`;
  if(!$('bulkAcct').options.length||$('bulkAcct').dataset.v!==OPTS.length+''){$('bulkAcct').innerHTML='<option value="">Choisir le compte…</option><option value="__new">+ Nouveau compte…</option>'+OPTS;$('bulkAcct').dataset.v=OPTS.length+''}}
$('selAll').onchange=()=>{const v=visible();if($('selAll').checked)v.forEach(t=>SEL.add(t.id));else v.forEach(t=>SEL.delete(t.id));render()};
$('bulkX').onclick=()=>{SEL.clear();render()};
$('bulkDel').onclick=e=>confirm2(e.currentTarget,'',()=>{const n=SEL.size;P.tx.filter(t=>SEL.has(t.id)&&t.inv).forEach(t=>{const iv=INV.find(i=>i.id===t.inv);if(iv){delete iv.pay;saveInv(iv).catch(()=>{})}});
  P.tx=P.tx.filter(t=>!SEL.has(t.id));SEL.clear();LED=null;render();savePer();msg(`${n} transaction(s) supprimée(s).`);$('bulkDel').textContent='Supprimer'});
$('bulkAcct').onchange=()=>{if($('bulkAcct').value==='__new')newAccount(null,no=>{$('bulkAcct').dataset.v='';renderBulk();$('bulkAcct').value=no||''})};
$('bulkGo').onclick=()=>{const a=$('bulkAcct').value,tx=$('bulkTax').value;if(!a||a==='__new'){$('bulkAcct').focus();return}if(!revOk())return;
  const sel=P.tx.filter(t=>SEL.has(t.id));audit('Classement en lot',`${sel.length} transaction(s) → ${a} ${accName(a)}${tx!==''?(tx==='1'?', taxes cochées':', taxes décochées'):''} : ${sel.slice(0,6).map(txTxt).join(' · ')}${sel.length>6?' …':''}`);sel.forEach(t=>{Object.assign(t,{acct:a,st:'manuel',why:'Classé en lot',unk:false});if(tx!=='')t.tax=tx==='1'});
  SEL.clear();render();savePer();
  const keys=[...new Set(sel.map(t=>keyOf(t.desc)).filter(Boolean))];
  showToast(`<span>${sel.length} transaction(s) classée(s) dans ${esc(a)} ${esc(accName(a))}.${keys.length&&keys.length<=3?` Retenir pour ce client : ${keys.map(k=>'« '+esc(k)+' »').join(', ')} ?`:''}</span>${keys.length&&keys.length<=3?'<button class="sm pri" data-a="y">Retenir</button><button class="sm" data-a="n">Non</button>':''}`,
    {y:()=>{keys.forEach(p=>{C.rules=(C.rules||[]).filter(r=>r.p!==p);C.rules.push({p,a,t:tx==='1'})});reclass();saveClient();renderRules();render();savePer()}})};

/* ---------- factures ---------- */
let INV=[],invF='ouv',invEdit=null;
const cfAcc=()=>C.cf||findAcc(/COMPTES FOURNISSEURS|FOURNISSEURS A PAYER|COMPTES A PAYER/)||'2100';
const ccAcc=()=>C.cc||findAcc(/COMPTES CLIENTS|CLIENTS A RECEVOIR|COMPTES A RECEVOIR/)||'1200';
const addDays=(d,n)=>{const x=new Date(d+'T12:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
async function invCol(){return db?db.collection('clients').doc(C.id).collection('factures'):null}
async function loadInv(){INV=[];try{if(local)INV=Object.entries(LOCAL.inv||{}).filter(([k])=>k.startsWith(C.id+'/')).map(([k,v])=>({id:k.split('/')[1],...v}));
  else{const s=await(await invCol()).get();INV=s.docs.map(d=>({id:d.id,...d.data()}))}}catch(e){}INV.sort((a,b)=>b.date.localeCompare(a.date));return INV}
async function saveInv(i){LED=null;const{id,...doc}=i;doc.updated=new Date().toISOString();
  if(local){LOCAL.inv=LOCAL.inv||{};const k=id||'i'+Date.now()+Math.random().toString(36).slice(2,6);LOCAL.inv[C.id+'/'+k]=doc;i.id=k;return}
  const col=await invCol();const ref=id?col.doc(id):col.doc();i.id=ref.id;await ref.set(doc)}
function invLines(i){const cf=cfAcc(),cc=methodeEff()==='adeposer'&&adepAcc()?adepAcc():ccAcc();let L=i.type==='achat'?[[i.acct,i.ht],[C.tpsA,i.tps],[C.tvqA,i.tvq],[cf,-i.total]]:[[cc,i.total],[i.acct,-i.ht],[C.tpsV,-i.tps],[C.tvqV,-i.tvq]];
  L=L.filter(l=>l[1]);const s=L.reduce((a,l)=>a+l[1],0);if(s){const k=L.findIndex(l=>l[0]===i.acct);if(k>=0)L[k][1]-=s}return L}
function matchInvoices(txs){if(!INV.length)return 0;const cf=cfAcc(),cc=ccAcc();
  txs.forEach(t=>{if(t.st==='facture'&&!INV.some(i=>i.id===t.inv)){t.st='transit';t.inv='';classify(t)}});
  const used=new Set(txs.filter(t=>t.st==='facture').map(t=>t.inv));let n=0;const ch=[];
  INV.filter(i=>!used.has(i.id)&&!i.pay&&i.total).forEach(inv=>{const want=inv.type==='achat'?-inv.total:inv.total;const tw=norm(inv.tiers).split(' ').filter(w=>w.length>2&&!GENW.test(w));
    const sc=t=>tw.filter(w=>norm(t.desc).includes(w)).length*1000-dd(t.date,inv.date);
    const c=txs.filter(t=>t.amt===want&&['transit','auto','suggere'].includes(t.st)&&t.date>=addDays(inv.date,-5)&&t.date<=addDays(inv.date,150)).sort((a,b)=>sc(b)-sc(a))[0];
    if(!c)return;Object.assign(c,{acct:inv.type==='achat'?cf:cc,tax:false,st:'facture',inv:inv.id,unk:false,why:`Paiement de la facture ${inv.no||''} ${inv.tiers}`.replace(/\s+/g,' ')});inv.pay={date:c.date,desc:c.desc};ch.push(inv);n++});
  ch.forEach(i=>saveInv(i).catch(()=>{}));return n}
function renderInv(){const q=norm($('invQ').value);$('ifAcct').innerHTML=OPTS;
  const L=INV.filter(i=>(invF==='all'||(invF==='ouv'&&!i.pay)||(invF==='pay'&&i.pay))&&(!q||norm(i.tiers+' '+(i.no||'')).includes(q)));
  $('invList').innerHTML=L.length?L.map(i=>`<tr><td class="d">${esc(i.date)}</td><td><strong>${esc(i.tiers)}</strong><div class="why">${i.type==='achat'?'Achat':'Vente'}${i.desc?' · '+esc(i.desc):''}</div></td><td>${esc(i.no||'')}</td><td>${esc(i.acct)} ${esc(accName(i.acct))}</td><td class="num">${fmtN(i.total)}</td><td>${i.pay?`<span class="pill ok">Payée le ${esc(i.pay.date)}</span>`:`<span class="pill todo">Ouverte</span>${i.ech&&i.ech<new Date().toISOString().slice(0,10)?'<div class="why" style="color:var(--claret)">Échue</div>':''}`}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="sm" data-ie="${esc(i.id)}">Modifier</button>${i.pay?`<button class="sm" data-iu="${esc(i.id)}">Non payée</button>`:''}<button class="sm danger" data-del="inv-${esc(i.id)}">Supprimer</button></div></td></tr>`).join('')
    :'<tr><td colspan="7" class="empty">Aucune facture.</td></tr>'}
document.querySelectorAll('[data-if]').forEach(b=>b.onclick=()=>{invF=b.dataset.if;document.querySelectorAll('[data-if]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderInv()});
$('invQ').oninput=renderInv;
function invOpen(i){invEdit=i||null;$('invForm').hidden=false;$('ifErr').textContent='';$('ifAcct').innerHTML=OPTS;
  $('ifType').value=i?.type||$('invType').value;$('ifTiers').value=i?.tiers||'';$('ifNo').value=i?.no||'';$('ifDate').value=i?.date||'';$('ifEch').value=i?.ech||'';
  $('ifAcct').value=i?.acct||'';$('ifHt').value=i?(i.ht/100).toFixed(2):'';$('ifTps').value=i?(i.tps/100).toFixed(2):'';$('ifTvq').value=i?(i.tvq/100).toFixed(2):'';$('ifTot').value=i?(i.total/100).toFixed(2):'';$('ifDesc').value=i?.desc||'';
  $('invForm').scrollIntoView({behavior:'smooth',block:'nearest'})}
$('invNew').onclick=()=>invOpen();$('ifCancel').onclick=()=>{$('invForm').hidden=true};
$('invForm').onsubmit=async e=>{e.preventDefault();const tot=cents($('ifTot').value),tps=cents($('ifTps').value),tvq=cents($('ifTvq').value);let ht=cents($('ifHt').value);if(!ht)ht=tot-tps-tvq;
  if(!tot||!$('ifAcct').value){$('ifErr').textContent='Total et compte requis.';return}
  if(lk($('ifDate').value)||(invEdit&&lk(invEdit.date))){$('ifErr').textContent='Date dans un exercice fermé : rouvrez l’exercice d’abord.';return}
  const i={...(invEdit||{}),type:$('ifType').value,tiers:$('ifTiers').value.trim(),no:$('ifNo').value.trim(),date:$('ifDate').value,ech:$('ifEch').value,acct:$('ifAcct').value,ht,tps,tvq,total:tot,desc:$('ifDesc').value.trim()};
  if(invEdit&&invEdit.total!==tot)delete i.pay;
  try{await saveInv(i);if(!invEdit)INV.unshift(i);else Object.assign(invEdit,i);$('invForm').hidden=true;afterInv()}catch(err){$('ifErr').textContent='Enregistrement impossible.'}};
function afterInv(){INV.sort((a,b)=>b.date.localeCompare(a.date));if(P&&matchInvoices(P.tx)){render();savePer()}LED=null;renderInv()}
$('invList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.ie){invOpen(INV.find(i=>i.id===b.dataset.ie));return}
  if(b.dataset.iu){const i=INV.find(x=>x.id===b.dataset.iu);if(i){delete i.pay;saveInv(i);renderInv()}return}
  if(b.dataset.del?.startsWith('inv-'))confirm2(b,'',async()=>{const id=b.dataset.del.slice(4);{const iv=INV.find(x=>x.id===id);if(iv)audit('Facture supprimée',`${iv.type==='achat'?'Achat':'Vente'} ${iv.no||''} ${iv.tiers} ${iv.date} ${fmt(iv.total||0)}`)}try{if(local)delete LOCAL.inv[C.id+'/'+id];else await(await invCol()).doc(id).delete()}catch(err){}INV=INV.filter(i=>i.id!==id);if(P&&P.tx.some(t=>t.inv===id)){matchInvoices(P.tx);render();savePer()}LED=null;renderInv()})});
async function readInvoice(f,type){let text='',imgs=null;
  if(/\.pdf$/i.test(f.name))text=(await pdfPages(f)).join('\n\n').slice(0,12000);
  else{const lim=sampleFn.limits?await sampleFn.limits().catch(()=>null):null;if(!lim?.images)throw new Error('photos');imgs=[f]}
  const prompt=`Facture ${type==='achat'?'reçue d’un fournisseur par':'émise à un client par'} l'entreprise « ${C.nom} » (Québec). Plan comptable :\n${PLAN.filter(([n])=>/^[45-9]/.test(n)).map(p=>p.join(' ')).join('\n')}\n${text?'\nTexte de la facture :\n'+text:'\nLa facture est dans l’image jointe.'}\n\nRéponds uniquement en JSON : {"tiers":"nom du ${type==='achat'?'fournisseur':'client'}","numero":"","date":"AAAA-MM-JJ","echeance":"AAAA-MM-JJ ou null","avant_taxes":0.00,"tps":0.00,"tvq":0.00,"total":0.00,"description":"5 mots max","compte":"numéro du plan le plus probable (${type==='achat'?'dépense':'revenu'})"}`;
  const r=await sampleFn.json(prompt,imgs?{images:imgs,modelTier:'default'}:{modelTier:'default'});
  const c=v=>Math.round(Number(v||0)*100);const tot=c(r?.total);if(!tot)throw new Error('vide');const tps=c(r.tps),tvq=c(r.tvq);let ht=c(r.avant_taxes);if(!ht)ht=tot-tps-tvq;
  const acct=PLAN.some(p=>p[0]===String(r.compte))?String(r.compte):'';
  return{type,tiers:String(r.tiers||'').slice(0,80)||'(inconnu)',no:String(r.numero||'').slice(0,30),date:toISO(String(r.date||''))||new Date().toISOString().slice(0,10),ech:toISO(String(r.echeance||''))||'',acct:acct||C.tr,ht,tps,tvq,total:tot,desc:String(r.description||'').slice(0,60),src:f.name}}
async function handleInv(files){if(!sampleFn){$('invMsg').textContent='La lecture des factures demande l’IA, indisponible ici. Utilisez « Nouvelle facture ».';return}
  const type=$('invType').value;let ok=0,bad=[];
  for(const [k,f] of files.entries()){$('invMsg').textContent=`L'IA lit ${f.name} (${k+1}/${files.length})…`;
    try{const i=await readInvoice(f,type);const dup=INV.find(x=>x.tiers===i.tiers&&x.total===i.total&&x.date===i.date);if(dup){bad.push(f.name+' (déjà entrée)');continue}await saveInv(i);INV.unshift(i);ok++}
    catch(err){bad.push(f.name+(err.message==='photos'?' (photos non prises en charge ici : utilisez un PDF)':''))}}
  afterInv();$('invMsg').textContent=`${ok} facture(s) lue(s) et inscrite(s). Vérifiez le compte de chacune.${bad.length?' Non lues : '+bad.join(', ')+'.':''}`}
$('invFile').onchange=e=>{const f=[...e.target.files];e.target.value='';handleInv(f)};dropzone($('invDrop'),handleInv);
function agingHtml(type,to){const L=INV.filter(i=>i.type===type&&i.date<=to&&(!i.pay||i.pay.date>to));const by=new Map();
  L.forEach(i=>{const age=dd(i.ech||i.date,to)*(to>=(i.ech||i.date)?1:-1);const b=age<=30?0:age<=60?1:age<=90?2:3;const o=by.get(i.tiers)||[0,0,0,0,0];o[b]+=i.total;o[4]+=i.total;by.set(i.tiers,o)});
  const T=[0,0,0,0,0];let x='';[...by].sort((a,b)=>b[1][4]-a[1][4]).forEach(([n,o])=>{o.forEach((v,k)=>T[k]+=v);x+=`<tr><td>${esc(n)}</td>${o.map(v=>`<td class="num">${fmtN(v)}</td>`).join('')}</tr>`});
  return `<h2>${type==='achat'?'Comptes fournisseurs':'Comptes clients'} au ${esc(to)} : âge des comptes</h2><table class="rep"><tr class="sec"><td>${type==='achat'?'Fournisseur':'Client'}</td><td class="num">0-30 j</td><td class="num">31-60 j</td><td class="num">61-90 j</td><td class="num">90+ j</td><td class="num">Total</td></tr>${x||'<tr><td colspan="6" class="empty">Aucune facture ouverte.</td></tr>'}<tr class="tot"><td>Total</td>${T.map(v=>`<td class="num">${fmtN(v)||'0,00'}</td>`).join('')}</tr></table>`}

/* ---------- conciliation ---------- */
function stmtOfCsv(g,nom){const cB=+$('mBal').value;if(cB<0)return null;const[cD,cA,cO,cI]=['mDate','mAmt','mOut','mIn'].map(id=>+$(id).value),inv=$('mInv').checked;const R=[];
  for(const r of g.body){const date=toISO(r[cD]||'',g.order);if(!date)continue;let c;if(cA>=0)c=toCents(r[cA]);else{const o=toCents(r[cO]),i=toCents(r[cI]);if(o===null&&i===null)continue;c=(i?Math.abs(i):0)-(o?Math.abs(o):0)}
    let b=toCents(r[cB]);if(c==null||b==null)continue;if(inv){c=-c;b=-b}R.push({date,c,b})}
  if(R.length<1)return null;const asc=R[0].date<=R[R.length-1].date;const F=asc?R[0]:R[R.length-1],L=asc?R[R.length-1]:R[0];
  return{src:P.src,du:F.date,au:L.date,sd:F.b-F.c,sf:L.b,nom,via:'CSV'}}
function addStmt(st){if(!st)return;C.stmts=(C.stmts||[]).filter(x=>!(x.src===st.src&&x.du===st.du&&x.au===st.au));C.stmts.push(st);C.stmts.sort((a,b)=>a.src.localeCompare(b.src)||a.du.localeCompare(b.du))}
function initRec(){const srcs=[...new Set([...srcAccounts().map(p=>p[0]),...(C.stmts||[]).map(s=>s.src)])];
  $('recSrc').innerHTML=srcs.map(a=>`<option value="${esc(a)}">${esc(a+' '+accName(a))}</option>`).join('');$('recSrc').value=C.src&&srcs.includes(C.src)?C.src:srcs[0]||'';runRec()}
$('recGo').onclick=()=>runRec(true);$('recSrc').onchange=()=>runRec();
async function runRec(force){const src=$('recSrc').value;$('recList').innerHTML='<tr><td colspan="9" class="empty">Calcul…</td></tr>';
  try{if(!LED||force)LED=await loadLedger()}catch(e){$('recList').innerHTML='<tr><td colspan="9" class="empty">Lecture impossible.</td></tr>';return}
  const S=(C.stmts||[]).filter(x=>x.src===src).sort((a,b)=>a.du.localeCompare(b.du));
  const tx=LED.filter(e=>e.kind==='rel'&&e.src===src).map(e=>({date:e.date,amt:e.amt}));
  let ok=0,prev=null;const rows=S.map((s,i)=>{let T=tx.filter(t=>t.date>=s.du&&t.date<=s.au),share='';
    const sh=new Set();if(S[i-1]&&S[i-1].au===s.du)sh.add(s.du);if(S[i+1]&&S[i+1].du===s.au)sh.add(s.au);
    if(sh.size){const core=T.filter(t=>!sh.has(t.date)),B=T.filter(t=>sh.has(t.date));const tgt=s.sf-s.sd-core.reduce((a,t)=>a+t.amt,0);
      if(B.reduce((a,t)=>a+t.amt,0)!==tgt&&B.length<=18){for(let m=0;m<(1<<B.length);m++){let x=0;for(let k=0;k<B.length;k++)if(m>>k&1)x+=B[k].amt;if(x===tgt){T=core.concat(B.filter((_,k)=>m>>k&1));share=` Certaines transactions du ${[...sh].join(' et du ')} sont sur le relevé voisin (jour partagé).`;break}}}}const inn=T.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),out=T.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0);
    const calc=s.sd+inn+out,diff=s.sf-calc;const gap=prev&&prev.sf!==s.sd?` Le relevé précédent finit à ${fmtN(prev.sf)}.`:'';const hole=prev&&dd(prev.au,s.du)>1?` Trou du ${prev.au} au ${s.du}.`:'';prev=s;if(!diff&&!gap&&!hole)ok++;
    return `<tr><td class="d">${esc(s.du)} au ${esc(s.au)}<div class="why">${esc(s.nom||'')} · ${esc(s.via||'manuel')}</div></td><td class="num">${fmtN(s.sd)||'0,00'}</td><td class="num">${fmtN(inn)}</td><td class="num">${fmtN(-out)}</td><td class="num">${fmtN(calc)||'0,00'}</td><td class="num">${fmtN(s.sf)||'0,00'}</td><td class="num">${diff?`<span class="bad-b">${fmtN(diff)}</span>`:''}</td><td>${diff?`<span class="pill todo">Ne balance pas</span>`:'<span class="pill ok">Concilié</span>'}${gap||hole?`<div class="why" style="color:var(--claret)">${esc(gap+hole)}</div>`:''}${share&&!diff?`<div class="why">${esc(share)}</div>`:''}${diff?`<div class="why">${diff>0?'Il manque des entrées ou il y a des sorties en trop':'Il manque des sorties ou il y a des entrées en trop'} de ${fmtN(Math.abs(diff))} $.${T.length?'':' Aucune transaction importée pour cette période.'}</div>`:''}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">${diff?`<button class="sm pri" data-fx="${i}">Trouver l'écart</button>`:''}<button class="sm danger" data-del="st-${i}">Retirer</button></div></td></tr>`});
  $('recList').innerHTML=rows.join('')||'<tr><td colspan="9" class="empty">Aucun relevé avec soldes pour ce compte. Importez un CSV avec la colonne « Solde », un PDF, ou ajoutez-le à la main ci-dessous.</td></tr>';
  const last=S[S.length-1];let book='';
  if(last&&devOf(src)==='USD'){const bv=balances(LED,null,last.au).get(src)||0;book=`<span class="note">Compte en dollars US : les relevés se concilient en US$ (ci-dessus). Au grand livre, le solde est en $ CA : ${fmtN(bv)} $ CA au ${last.au}. La réévaluation au taux de fin d’exercice est proposée dans Écritures › Régularisations de fin d’exercice.</span>`}
  else if(last){const B=balances(LED,null,last.au);const bv=B.get(src)||0;book=bv===last.sf?`<span class="ok-b">Solde aux livres au ${last.au} : ${fmtN(bv)} $ = relevé.</span>`:`<span class="bad-b">Solde aux livres au ${last.au} : ${fmtN(bv)} $, relevé : ${fmtN(last.sf)} $ (écart ${fmtN(last.sf-bv)} $).</span> <span class="note">Vérifiez le solde d'ouverture du compte ${esc(src)} dans Écritures, ou un relevé manquant.</span>`}
  let ouvChk='';{const o=C.ouv,s0=o&&S.find(s=>s.du===o.date);if(s0&&o.s){const livres=o.s[src]||0,us=devOf(src)==='USD';let att=s0.sd,txt=`${fmtN(s0.sd)||'0,00'} $`;
    if(us){const r=tauxDe(veille(o.date))||tauxDe(o.date);att=r?Math.round(s0.sd*r):null;txt=`${fmtN(s0.sd)} US$${r?` ≈ ${fmtN(att)} $ CA (taux ${r})`:''}`}
    if(att!=null&&Math.abs(att-livres)>(us?Math.abs(att)*0.02:0))ouvChk=`<p class="msg err" style="margin:6px 0">Solde d’ouverture au ${o.date} : ${fmtN(livres)||'0,00'} $ CA aux livres, mais le relevé donne ${txt}. Écart de ${fmtN(att-livres)} $ CA, à valider avec les états de l’an dernier (Écritures › Soldes d’ouverture).</p>`}}
  const out=tx.filter(t=>!S.some(s=>t.date>=s.du&&t.date<=s.au)).length;
  $('recSum').innerHTML=ouvChk+(S.length?`<p><strong>${ok} relevé(s) sur ${S.length} concilié(s).</strong> ${book}${out?` <span class="note">${out} transaction(s) hors des périodes de relevés.</span>`:''}</p>`:'');
  $('recList').querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>{FX={st:S[+b.dataset.fx],src};$('fxFile').click()});
  $('recList').querySelectorAll('[data-del^="st-"]').forEach(b=>b.onclick=()=>confirm2(b,'',()=>{const s=S[+b.dataset.del.slice(3)];C.stmts=C.stmts.filter(x=>x!==s);saveClient();runRec()}))}
function stmtAuto(g,nom,src){if(g.bal==null||g.bal<0)return null;const inv=/^2/.test(src);const R=[];
  for(const r of g.body){const date=toISO(r[g.date]||'',g.order);if(!date)continue;let c;if(g.amt>=0)c=toCents(r[g.amt]);else{const o=toCents(r[g.out]),i=toCents(r[g.inn]);if(o===null&&i===null)continue;c=(i?Math.abs(i):0)-(o?Math.abs(o):0)}
    let b=toCents(r[g.bal]);if(c==null||b==null)continue;if(inv){c=-c;b=-b}R.push({date,c,b})}
  if(!R.length)return null;const asc=R[0].date<=R[R.length-1].date;const F=asc?R[0]:R[R.length-1],L=asc?R[R.length-1]:R[0];return{src,du:F.date,au:L.date,sd:F.b-F.c,sf:L.b,nom,via:'CSV'}}
async function recFiles(files){const src=$('recSrc').value;let ok=0,bad=[];
  for(const [k,f] of files.entries()){$('recMsg').textContent=`Lecture de ${f.name} (${k+1}/${files.length})…`;
    try{let st=null;if(/\.pdf$/i.test(f.name)){if(!sampleFn)throw 0;const pages=await pdfPages(f);
        const s=await sampleFn.json(`Texte de la première et de la dernière page d'un relevé bancaire ou de carte de crédit canadien :\n${pages[0].slice(0,2500)}\n...\n${pages[pages.length-1].slice(-2500)}\n\nDonne la période et les soldes. Réponds uniquement en JSON : {"du":"AAAA-MM-JJ","au":"AAAA-MM-JJ","solde_debut":1234.56,"solde_fin":1234.56,"carte":false}. Pour une carte de crédit, carte=true et les soldes sont les montants dus (positifs). Un solde débiteur (découvert) est négatif.`,{modelTier:'default'});
        const du=toISO(String(s?.du||'')),au=toISO(String(s?.au||''));if(du&&au&&s.solde_debut!=null&&s.solde_fin!=null){const sg=s.carte?-1:1;st={src,du,au,sd:sg*Math.round(Number(s.solde_debut)*100),sf:sg*Math.round(Number(s.solde_fin)*100),nom:f.name,via:'IA'}}}
      else{const rows=await rowsOf(f);if(rows.length>1)st=stmtAuto(guess(rows),f.name,src)}
      if(st){addStmt(st);ok++}else bad.push(f.name)}catch(e){bad.push(f.name)}}
  saveClient();$('recMsg').textContent=`${ok} relevé(s) ajouté(s) à la conciliation du compte ${src}.${bad.length?` Soldes introuvables dans : ${bad.join(', ')} (ajoutez-les à la main ci-dessous).`:''}`;runRec(true)}
$('recFile').onchange=e=>{const f=[...e.target.files];e.target.value='';recFiles(f)};dropzone($('recDrop'),recFiles);
let FX=null;
async function addToPeriods(list,src){const by=new Map();list.forEach(x=>{const m=x.date.slice(0,7);by.set(m,[...(by.get(m)||[]),x])});let n=0;
  for(const[m,L]of by){let p={mois:m,src,tx:[],statut:'en cours'};const d=await readPeriod(m,src);if(d){p={...p,...d,tx:(d.tx||[]).map(t=>({...t,id:++seq}))}}
    n+=mergeInto(p,L).added;savePerFlush(p)}await pWriting;LED=null;if(P&&P.src===src)P.multi?openRange():openPeriod();return n}
$('fxFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f||!FX)return;const{st,src}=FX;const box=$('fxBox');box.hidden=false;box.innerHTML='<p class="note">Lecture du relevé…</p>';
  try{let T=[];if(/\.pdf$/i.test(f.name)){if(!sampleFn)throw 0;T=await pdfTx(f,t=>box.innerHTML=`<p class="note">${esc(t)}</p>`)}else{const rows=await rowsOf(f);T=autoMap(guess(rows));if(/^2/.test(src))T=T.map(x=>({...x,amt:-x.amt}))}
    T=T.filter(x=>x.date>=st.du&&x.date<=st.au);if(!LED)LED=await loadLedger();
    const A=LED.filter(e=>e.kind==='rel'&&e.src===src&&e.date>=st.du&&e.date<=st.au).map(e=>({date:e.date,desc:e.desc,amt:e.amt,mois:e.mois}));
    const pool=[...A];const miss=[];T.forEach(x=>{let k=pool.findIndex(a=>a.amt===x.amt&&a.date===x.date);if(k<0)k=pool.findIndex(a=>a.amt===x.amt&&dd(a.date,x.date)<=3);if(k>=0)pool.splice(k,1);else miss.push(x)});
    const SS=(C.stmts||[]).filter(x=>x.src===src&&x!==st);const shd=new Set(SS.flatMap(x=>[x.du,x.au]).filter(d=>d===st.du||d===st.au));
    const extra=pool.filter(x=>!shd.has(x.date)),onOther=pool.filter(x=>shd.has(x.date));const sum=l=>l.reduce((s,x)=>s+x.amt,0);const tSum=sum(T),relCalc=st.sd+tSum;
    const row=x=>`<tr><td class="d">${esc(x.date)}</td><td>${esc(x.desc)}</td><td class="num">${esc(fmtN(x.amt))}</td></tr>`;
    box.innerHTML=`<h2>Écart du relevé ${esc(st.du)} au ${esc(st.au)}</h2>
      <p>Le relevé contient ${T.length} transaction(s), l'application ${A.length}. ${relCalc!==st.sf?`<span class="bad-b">Attention : même le relevé lu ne balance pas (${fmtN(st.sd)} + ${fmtN(tSum)} ≠ ${fmtN(st.sf)}). Les soldes saisis sont peut-être mal lus : corrigez-les (Retirer, puis Ajouter à la main).</span>`:''}</p>
      ${miss.length?`<h2>Manquantes dans l'application (${miss.length}, ${fmtN(sum(miss))} $)</h2><table class="rep">${miss.map(row).join('')}</table><button class="pri sm" id="fxAdd" style="margin-top:8px">Ajouter ces ${miss.length} transaction(s)</button>`:'<p class="ok-b">Aucune transaction manquante.</p>'}
      ${extra.length?`<h2 style="margin-top:12px">En trop dans l'application (${extra.length}, ${fmtN(sum(extra))} $)</h2><p class="note">Absentes de ce relevé : doublon, mauvaise date, ou transaction d'un autre compte. Ouvrez la période pour la supprimer ou la corriger.</p><table class="rep">${extra.map(x=>`<tr><td class="d">${esc(x.date)}</td><td><a data-open="${esc(x.mois+'|'+src+'|'+x.desc)}">${esc(x.desc)}</a></td><td class="num">${esc(fmtN(x.amt))}</td></tr>`).join('')}</table>`:'<p class="ok-b">Aucune transaction en trop.</p>'}
      ${onOther.length?`<p class="note" style="margin-top:8px">${onOther.length} transaction(s) du ${[...shd].join(' / ')} ne sont pas sur ce relevé mais sur le relevé voisin qui partage cette date : c'est normal.</p>`:''}
      <button class="sm" id="fxClose" style="margin-top:8px">Fermer</button>`;
    $('fxClose').onclick=()=>{box.hidden=true};
    if($('fxAdd'))$('fxAdd').onclick=async()=>{$('fxAdd').disabled=true;const n=await addToPeriods(miss,src);box.innerHTML=`<p class="ok-b">${n} transaction(s) ajoutée(s) et classée(s) par les règles. Vérifiez-les dans Révision.</p>`;runRec(true)};
    box.querySelectorAll('[data-open]').forEach(a=>a.onclick=()=>{const[m,s2,desc]=a.dataset.open.split('|');setTab('rev');$('pMois').value=m;$('pSrc').value=s2;filter='all';document.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f==='all'));$('q').value=desc;openPeriod()});
  }catch(err){box.innerHTML='<p class="msg err">Lecture du relevé impossible.</p>'}};
$('recForm').onsubmit=e=>{e.preventDefault();const sd=toCents($('rcSd').value.replace(/\s/g,'')),sf=toCents($('rcSf').value.replace(/\s/g,''));if(sd==null||sf==null)return;
  addStmt({src:$('recSrc').value,du:$('rcDu').value,au:$('rcAu').value,sd,sf,nom:'',via:'manuel'});saveClient();e.target.reset();runRec()};

/* ---------- grand livre ---------- */
const cents=s=>{const c=toCents(s);return c==null?0:c};
const fmtN=c=>c?new Intl.NumberFormat('fr-CA',{minimumFractionDigits:2,maximumFractionDigits:2}).format(c/100):'';
function exRange(){const d=C.exDeb||(C.ouv&&C.ouv.date)||'',f=C.exFin||'';if(d&&f)return[d,f];
  if(d){const x=new Date(d+'T12:00');x.setFullYear(x.getFullYear()+1);x.setDate(x.getDate()-1);return[d,x.toISOString().slice(0,10)]}
  return['',''];}
async function jeCol(){return db?db.collection('clients').doc(C.id).collection('ecritures'):null}
let JE=[];
async function loadJe(){JE=[];try{if(local)JE=Object.entries(LOCAL.je||{}).filter(([k])=>k.startsWith(C.id+'/')).map(([k,v])=>({id:k.split('/')[1],...v}));
  else{const s=await(await jeCol()).get();JE=s.docs.map(d=>({id:d.id,...d.data()}))}}catch(e){}JE.sort((a,b)=>a.date.localeCompare(b.date));return JE}
async function loadLedger(){
  if(P&&pTimer)savePerNow();await pWriting;
  let L=[];try{if(local)L=Object.entries(LOCAL.periodes).filter(([k])=>k.startsWith(C.id+'/')).map(([,v])=>v);
    else{const s=await db.collection('clients').doc(C.id).collection('periodes').get();L=s.docs.map(d=>d.data())}}catch(e){throw e}
  const E=[];
  const U=new Set(L.map(p=>p.src).filter(s=>devOf(s)==='USD'));
  if(U.size){const ds=L.filter(p=>U.has(p.src)).flatMap(p=>(p.tx||[]).map(t=>t.date)).sort();if(ds.length)await tauxAssurer(ds[0],ds[ds.length-1])}
  L.forEach(p=>(p.tx||[]).forEach((x,i)=>{const t={...x};classify(t,p.src);const us=U.has(p.src),r=us&&t.cad==null?tauxDe(t.date):null,cad=!us?t.amt:t.cad!=null?t.cad:r?Math.round(t.amt*r):null;
    E.push({date:t.date,ref:('REL'+t.date.slice(5).replace('-','')),desc:us?`${t.desc} [${fmtN(t.amt)} US$ ${t.cad!=null?'au montant réel du virement':'× '+(r||'taux manquant')}]`:t.desc,lines:t.mirror||cad==null?[]:lines({...t,amt:cad},p.src).filter(l=>l[1]),kind:'rel',mois:p.mois,src:p.src,i,amt:t.amt,cad,dev:us?'USD':'',sansTaux:cad==null,mirror:!!t.mirror,acct:t.acct,tax:!!t.tax,st:t.st,todo:isTr(t)&&!t.mirror})}));
  await loadInv();INV.forEach(i=>E.push({date:i.date,ref:(i.type==='achat'?'ACH ':'VTE ')+(i.no||''),desc:i.tiers+(i.desc?' — '+i.desc:''),lines:invLines(i),kind:'inv',id:i.id}));
  (await loadJe()).forEach(j=>E.push({date:j.date,ref:j.ref||'JG',desc:j.desc||'',lines:(j.lines||[]).map(l=>[l.a,(l.d||0)-(l.c||0)]).filter(l=>l[1]),kind:'je',id:j.id,aje:j.type==='aje',todo:!!C.tr&&(j.lines||[]).some(l=>l.a===C.tr)}));
  E.sort((a,b)=>a.date.localeCompare(b.date));
  return E}
function balances(E,from,to,ouvTo=to){/* soldes au "to" ; pour revenus/charges : depuis le début d'exercice ou "from" */
  const[exD]=exRange();const m=new Map();const add=(a,c)=>m.set(a,(m.get(a)||0)+c);
  const ouv=C.ouv&&(!ouvTo||C.ouv.date<=ouvTo)?C.ouv:null;const re=bnrAcc()||'3560';
  if(ouv)Object.entries(ouv.s||{}).forEach(([a,c])=>{if(+String(a)[0]>=4)add(re,c);else add(a,c)});
  const isStart=from||exD||'';
  E.forEach(e=>{if(to&&e.date>to)return;if(ouv&&e.date<ouv.date)return;e.lines.forEach(([a,c])=>{if(+String(a)[0]>=4&&isStart&&e.date<isStart)add(re,c);else add(a,c)})});
  return m}
function groups(acctSet,first){/* regroupe les comptes du plan par sections Sage (totaux) */
  const pl=PLAN.filter(([n])=>first.includes(String(n)[0]));const out=[];let cur={title:'',items:[]};
  pl.forEach(([n,t])=>{if(/^TOTAL/.test(norm(t))){cur.title=t.replace(/^total\s*[-:]?\s*/i,'');out.push(cur);cur={title:'',items:[]};return}
    if(acctSet.has(n))cur.items.push(n)});
  out.push(cur);[...acctSet].filter(a=>first.includes(String(a)[0])&&!PLAN.some(p=>p[0]===a)).forEach(a=>out[out.length-1].items.push(a));
  return out.filter(g=>g.items.length)}
let REP='bs',LED=null;
function repUI(){$('repCmpL').hidden=!['bs','is'].includes(REP);$('repFromL').hidden=REP==='bs'||REP==='ap'||REP==='ar'}
function initRep(){const[d,f]=exRange();['repFrom','repTo'].forEach(id=>{const el=$(id);el.min=d||'';el.max=f||'';if(el.value&&d&&f&&(el.value<d||el.value>f))el.value=''});if(d&&f&&!$('repFrom').value&&!$('repTo').value){$('repFrom').value=d;$('repTo').value=f}repUI();
  $('repHint').textContent=d?`Exercice du ${d} au ${f}. Changez les dates au besoin, puis cliquez sur Afficher.`:'';
  $('repAcc').innerHTML='<option value="">Tous les comptes</option>'+OPTS;if(!d)$('repMsg').textContent='Indiquez le début et la fin de l’exercice dans Paramètres (ou les soldes d’ouverture dans Écritures).';runRep()}
document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{REP=b.dataset.r;document.querySelectorAll('[data-r]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('repAccL').hidden=REP!=='gl';repUI();runRep();navPush()});
$('repGo').onclick=()=>{runRep(true);navPush()};$('repCmp').onchange=()=>runRep();
$('repEx').onclick=()=>{const[d,f]=exRange();$('repFrom').value=d;$('repTo').value=f;runRep()};
/* comparatifs : mêmes dates, 1 à 3 ans plus tôt, calculés dans le contexte de l'exercice concerné */
const shiftY=(d,k)=>{if(!d)return d;const[y,m,j]=d.split('-').map(Number);const last=new Date(Date.UTC(y-k,m,0)).getUTCDate();return `${y-k}-${String(m).padStart(2,'0')}-${String(Math.min(j,last)).padStart(2,'0')}`};
const veille=d=>new Date(new Date(d+'T12:00Z')-864e5).toISOString().slice(0,10);
function ouvInitial(){const L=(C.ex||[]).filter(x=>x.ouv).sort((a,b)=>a.deb.localeCompare(b.deb));return L[0]?.ouv||C.ouv||null}
function colBal(E,f,t){/* {B (bilan), I (résultats), ni} pour une période antérieure, ou null si les données n'existent pas */
  const ex=(C.ex||[]).find(x=>x.deb<=t&&x.fin>=t);
  if(ex){const sv=[C.exDeb,C.exFin,C.ouv];C.exDeb=ex.deb;C.exFin=ex.fin;C.ouv=ex.ouv||null;
    try{const st=f&&f>=ex.deb?f:ex.deb;const I=balances(E,st,t);if(!E.some(e=>e.date<=t&&e.date>=ex.deb)&&!ex.ouv)return null;return{B:balances(E,null,t),I,ni:[...I].filter(([a])=>+String(a)[0]>=4).reduce((s,[,c])=>s-c,0)}}finally{[C.exDeb,C.exFin,C.ouv]=sv}}
  const o=ouvInitial();if(!o||t!==veille(o.date))return null;
  const B=new Map(),I=new Map();const re=bnrAcc()||'3560';let ni=0;
  Object.entries(o.s||{}).forEach(([a,c])=>{if(+String(a)[0]>=4){I.set(a,c);ni-=c}else B.set(a,(B.get(a)||0)+c)});
  const[exD]=exRange();return{B,I:f&&shiftY(f,-1)===exD?I:null,ni,pre:true}}
async function runRep(force){$('repOut').innerHTML='<p class="note">Calcul…</p>';
  try{if(!LED||force)LED=await loadLedger()}catch(e){$('repOut').innerHTML='<p class="msg err">Lecture des données impossible.</p>';return}
  const f=$('repFrom').value,t=$('repTo').value,E=LED;
  if(!t||(!f&&!['bs','ap','ar'].includes(REP))){const[d0,f0]=exRange();$('repOut').innerHTML=`<p class="note" style="padding:18px 0">Inscrivez ${['bs','ap','ar'].includes(REP)?'la date':'les dates du début et de la fin'} de la période${d0?` (exercice du ${esc(d0)} au ${esc(f0)})`:''}, puis cliquez sur <strong>Afficher</strong>.</p>`;$('repMsg').textContent='';return}
  const todo=E.filter(e=>e.todo&&(!f||e.date>=f)&&(!t||e.date<=t)).length;
  const tr=t=>`<tr${t[2]?` class="${t[2]}"`:''}>${t[0]}</tr>`;
  const link=a=>a===C.tr&&todo?`<a data-gl="${esc(a)}" style="color:var(--claret);font-weight:600" title="${todo} transaction(s) à régulariser : cliquez pour les voir">${esc(a)} ${esc(accName(a))} · à régulariser</a>`:`<a data-gl="${esc(a)}">${esc(a)} ${esc(accName(a))}</a>`;
  let h='',warn=todo&&REP==='gl'&&$('repAcc').value===C.tr?`<p class="note">${todo} transaction(s) au compte transitoire ${esc(C.tr)} dans cette période, à régulariser.</p><div class="row" style="margin:-4px 0 10px"><button class="sm pri" data-askcli>Demander les détails au client</button><button class="sm" data-ansimp>Importer les réponses du client</button></div>`:'';
  if(REP==='bs'||REP==='is'||REP==='mo'){const MO=REP==='mo',nC=MO?0:+$('repCmp').value||0,[exD,exF]=exRange(),cur={B:balances(E,null,t),I:balances(E,f||exD,t)};cur.ni=[...cur.I].filter(([a])=>+String(a)[0]>=4).reduce((s,[,c])=>s-c,0);
    let cols=[{t,f,...cur}];for(let k=1;k<=nC;k++){const tk=shiftY(t,k),fk=shiftY(f||exD,k);cols.push({t:tk,f:fk,...(colBal(E,fk,tk)||{})})}
    if(MO){const d0=(f||exD),d1=(t||exF);cols=[];if(d0&&d1){for(let m=d0.slice(0,7);m<=d1.slice(0,7)&&cols.length<13;){const[y,mm]=m.split('-').map(Number);const fin=new Date(y,mm,0).getDate();const a=m+'-01'<d0?d0:m+'-01',b=`${m}-${String(fin).padStart(2,'0')}`>d1?d1:`${m}-${String(fin).padStart(2,'0')}`;cols.push({f:a,t:b,I:balances(E,a,b),lbl:moisLbl(m)});m=mm===12?`${y+1}-01`:`${y}-${String(mm+1).padStart(2,'0')}`}
      cols.push({f:d0,t:d1,I:balances(E,d0,d1),lbl:'Total'})}}
    const M=REP==='bs'?'B':'I',ok=c=>!!c[M],omis=MO?0:cols.slice(1).filter(c=>!ok(c)).length;if(omis)cols=cols.filter((c,i)=>i===0||ok(c));const head=`<tr class="grp"><td></td>${cols.map(c=>`<td class="num">${esc(c.lbl||(REP==='bs'?c.t:(c.f+' au '+c.t)))}${ok(c)?'':'<br><small>non disponible</small>'}</td>`).join('')}</tr>`;
    const val=(c,a,sign)=>ok(c)?sign*(c[M].get(a)||0):null,cell=v=>`<td class="num">${v==null?'':fmtN(v)}</td>`;
    const sect=(title,first,sign)=>{const set=new Set(cols.flatMap(c=>ok(c)?[...c[M]].filter(([a,v])=>v&&first.includes(String(a)[0])&&(REP==='bs'||+String(a)[0]>=4)).map(([a])=>a):[]));
      const tot=cols.map(c=>ok(c)?0:null);let x=`<tr class="sec"><td colspan="${cols.length+1}">${title}</td></tr>`;
      groups(set,first).forEach(g=>{const st=cols.map(c=>ok(c)?0:null);if(g.title)x+=`<tr class="grp"><td colspan="${cols.length+1}">${esc(g.title)}</td></tr>`;
        g.items.forEach(a=>{const v=cols.map(c=>val(c,a,sign));v.forEach((y,i)=>{if(y!=null)st[i]+=y});x+=`<tr><td class="ind">${link(a)}</td>${v.map(cell).join('')}</tr>`});
        if(g.title)x+=`<tr class="sub"><td>Total ${esc(g.title.toLowerCase())}</td>${st.map(cell).join('')}</tr>`;st.forEach((y,i)=>{if(y!=null)tot[i]+=y})});return[x,tot]};
    const row=(cls,l,v)=>`<tr class="${cls}"><td>${l}</td>${v.map(cell).join('')}</tr>`,sub=(a,b,sg=1)=>a.map((y,i)=>y==null||b[i]==null?null:y+sg*b[i]);
    if(REP==='bs'){const[a,ta]=sect('Actif','1',1),[p,tp]=sect('Passif','2',-1);let[c,tc]=sect('Avoir des actionnaires','3',-1);const ni=cols.map(k=>ok(k)?k.ni:null);
      c+=row('','<span class="ind">Bénéfice net (perte) de l\'exercice</span>',ni);tc=sub(tc,ni);const pa=sub(tp,tc),okB=Math.abs(ta[0]-tp[0]-tc[0])<1;
      h=`<h2>Bilan au ${esc(t)}</h2><table class="rep">${nC?head:''}${a}${row('tot','Total de l\'actif',ta)}${p}${row('sub','Total du passif',tp)}${c}${row('sub','Total de l\'avoir',tc)}${row('tot','Total du passif et de l\'avoir',pa)}</table>
        <p class="${okB?'ok-b':'bad-b'}">${okB?'Le bilan balance.':`Écart de ${fmtN(ta[0]-tp[0]-tc[0])} $ : vérifiez les soldes d'ouverture.`}</p>`}
    else{const[r,tr_]=sect('Revenus','4',-1),[d,td]=sect('Dépenses','56789',1);
      h=`<h2>${MO?'Résultats par mois':'État des résultats'} du ${esc(f||cols[0]?.f||'')} au ${esc(t||cols[cols.length-1]?.t||'')}</h2>${MO?'<div class="scroll">':''}<table class="rep"${MO?' style="font-size:12px"':''}>${nC||MO?head:''}${r}${row('sub','Total des revenus',tr_)}${d}${row('sub','Total des dépenses',td)}${row('tot','Bénéfice net (perte)',sub(tr_,td,-1))}</table>${MO?'</div>':''}`}
    if(E.some(e=>e.sansTaux&&(!t||e.date<=t)))h+=`<p class="msg err">Taux de change manquants : ${E.filter(e=>e.sansTaux).length} transaction(s) en dollars US ne sont pas encore converties en $ CA et n’apparaissent pas dans ce rapport. Vérifiez la connexion, puis rouvrez le rapport.</p>`;
    if(omis)h+=`<p class="note">Comparatif omis pour ${omis>1?'les années':'l’année'} sans données dans ce dossier (ni exercice ni soldes d’ouverture correspondants).</p>`}
  if(REP==='tb'){const B=balances(E,null,t);const[exD]=exRange();const I=balances(E,f||exD,t);let D=0,K=0,x='';
    const all=new Map([...[...B].filter(([a])=>+String(a)[0]<4),...[...I].filter(([a])=>+String(a)[0]>=4)]);
    [...all].filter(([,c])=>c).sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'fr',{numeric:true})).forEach(([a,c])=>{c>0?D+=c:K-=c;x+=`<tr><td>${link(a)}</td><td class="num">${c>0?fmtN(c):''}</td><td class="num">${c<0?fmtN(-c):''}</td></tr>`});
    h=`<h2>Balance de vérification au ${esc(t)}</h2><table class="rep"><tr class="sec"><td>Compte</td><td class="num">Débit</td><td class="num">Crédit</td></tr>${x}<tr class="tot"><td>Total</td><td class="num">${fmtN(D)}</td><td class="num">${fmtN(K)}</td></tr></table><p class="${D===K?'ok-b':'bad-b'}">${D===K?'Débits = crédits.':'Débits et crédits ne balancent pas.'}</p>`}
  if(REP==='gl'){const sel=$('repAcc').value;const B0=f?balances(E,exRange()[0]||f,new Date(new Date(f+'T12:00')-864e5).toISOString().slice(0,10),f):new Map();
    const accs=sel?[sel]:[...new Set([...E.flatMap(e=>e.lines.map(l=>l[0])),...[...B0].filter(([,c])=>c).map(([a])=>a)])].sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true}));let x='';
    accs.forEach(a=>{const rows=[];E.forEach(e=>{if((f&&e.date<f)||(t&&e.date>t))return;e.lines.forEach(([b,c])=>{if(b===a)rows.push([e,c])})});
      let sb=B0.get(a)||0;if(!rows.length&&!sb)return;
      x+=`<tr class="sec"><td colspan="6">${esc(a)} ${esc(accName(a))}</td></tr><tr class="grp"><td colspan="5">Solde d'ouverture</td><td class="num">${fmtN(sb)}</td></tr>`;let D=0,K=0;
      rows.forEach(([e,c])=>{sb+=c;c>0?D+=c:K-=c;x+=`<tr><td class="d">${esc(e.date)}</td><td>${esc(e.ref)}</td><td><a href="#" data-drw="${esc(e.kind==='rel'?`R|${e.mois}_${e.src}|${e.i}`:e.kind==='je'?`J|${e.id}`:e.kind==='inv'?`I|${e.id}`:'')}" title="Corriger">${esc(e.desc)||'(sans description)'}</a></td><td class="num">${c>0?fmtN(c):''}</td><td class="num">${c<0?fmtN(-c):''}</td><td class="num">${fmtN(sb)}</td></tr>`});
      x+=`<tr class="sub"><td colspan="3">Total ${esc(a)}</td><td class="num">${fmtN(D)}</td><td class="num">${fmtN(K)}</td><td class="num">${fmtN(sb)}</td></tr>`});
    h=`<h2>Grand livre du ${esc(f)} au ${esc(t)}</h2><table class="rep"><tr class="grp"><td>Date</td><td>Réf.</td><td>Description</td><td class="num">Débit</td><td class="num">Crédit</td><td class="num">Solde</td></tr>${x||'<tr><td colspan="6" class="empty">Aucune écriture.</td></tr>'}</table>`}
  if(REP==='tx')h=txSumHtml(E,f,t);
  if(REP==='txd')h=txDetHtml(E,f,t);
  if(REP==='das')h=await dasHtml(f,t);
  if(REP==='ap'||REP==='ar'){await loadInv();h=agingHtml(REP==='ap'?'achat':'vente',t)}
  if(REP==='gifi'){if(!GIFIAUTO.has(C.id))setTimeout(gifiAuto,0);const[exD]=exRange();const B=balances(E,null,t),I=balances(E,f||exD,t);const G=C.gifi||{};
    const acc=[...new Map([...[...B].filter(([a,c])=>c&&+String(a)[0]<4),...[...I].filter(([a,c])=>c&&+String(a)[0]>=4)])].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'fr',{numeric:true}));
    const sum=new Map();acc.forEach(([a,c])=>{const k=G[a]||'?';const v=['1'].includes(String(a)[0])||+String(a)[0]>=5?c:-c;sum.set(k,(sum.get(k)||0)+v)});
    h=`<h2>Codes IGRF (annexes 100 et 125 de la T2) au ${esc(t)}</h2><div class="row" style="margin:6px 0 10px"><label class="sm" style="cursor:pointer;border:1px solid var(--line);border-radius:8px;padding:6px 12px">Importer les IGRF de la T2 de l’an dernier<input type="file" id="gifiFile" accept=".csv,.xlsx,.xls,.txt,.pdf" hidden></label><button class="sm" id="gifiAi" ${sampleFn?'':'disabled'}>Suggérer les codes avec l'IA</button><button class="sm" id="gifiStd">Codes du plan type</button><button class="sm" id="gifiExp">Exporter pour la T2 (CSV)</button><span class="note" id="gifiMsg">Corrigez un code directement dans la colonne IGRF.</span></div>
      <datalist id="igrfDl">${Object.entries(IGRF).filter(([c])=>!igrfTot(c)).map(([c,d])=>`<option value="${c}">${esc(d)}</option>`).join('')}</datalist><table class="rep"><tr class="sec"><td>Compte</td><td>IGRF</td><td class="num">Montant</td></tr>${acc.map(([a,c])=>`<tr><td>${link(a)}</td><td style="white-space:nowrap"><input data-gifi="${esc(a)}" list="igrfDl" value="${esc(G[a]||'')}" style="width:80px;min-height:32px;padding:2px 6px${G[a]&&!igrfOk(G[a])?';border-color:#c0392b':''}${(C.gifiIa||{})[a]?';background:#fff3c4;color:#0b1626':''}"${(C.gifiIa||{})[a]?' title="Code proposé par l’IA : vérifiez-le (il redevient normal quand vous le modifiez)"':''} inputmode="numeric"> <small style="color:${G[a]&&!igrfOk(G[a])?'#c0392b':'var(--mute,#667)'}">${G[a]?(IGRF[G[a]]?esc(IGRF[G[a]])+(igrfTot(G[a])?' — code de total, à éviter':''):'Code inconnu'):''}</small></td><td class="num">${fmtN(['1'].includes(String(a)[0])||+String(a)[0]>=5?c:-c)}</td></tr>`).join('')}</table>
      <h2 style="margin-top:16px">Sommaire par code</h2><table class="rep"><tr class="sec"><td>Code IGRF</td><td class="num">Montant</td></tr>${[...sum].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`<tr><td>${k==='?'?'<span class="bad-b">Sans code</span>':esc(k)+(IGRF[k]?' '+esc(IGRF[k]):'')}</td><td class="num">${fmtN(v)}</td></tr>`).join('')}</table>`+gifiCtl(E)}
  if(REP==='jr'){let x='';E.filter(e=>(!f||e.date>=f)&&(!t||e.date<=t)).forEach(e=>{x+=`<tr class="grp"><td class="d">${esc(e.date)}</td><td>${esc(e.ref)}</td><td colspan="2">${esc(e.desc)}</td></tr>`;e.lines.forEach(([a,c])=>x+=`<tr><td></td><td class="ind" colspan="1">${esc(a)} ${esc(accName(a))}</td><td class="num">${c>0?fmtN(c):''}</td><td class="num">${c<0?fmtN(-c):''}</td></tr>`)});
    h=`<h2>Journal général du ${esc(f)} au ${esc(t)}</h2><table class="rep"><tr class="sec"><td>Date</td><td>Compte</td><td class="num">Débit</td><td class="num">Crédit</td></tr>${x||'<tr><td colspan="4" class="empty">Aucune écriture.</td></tr>'}</table>`}
  $('repOut').innerHTML=warn+h;$('repMsg').textContent=`${E.length} écritures dans le dossier · ${C.nom}`;if(REP==='gifi'&&GIFIMSG){const m=$('gifiMsg');if(m)m.textContent=GIFIMSG;GIFIMSG=''}}
/* ---------- fiche de correction par-dessus les rapports ---------- */
let DRW=null;
const drwClose=()=>{$('txDrw').hidden=true;$('txDrw').innerHTML='';DRW=null};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&DRW)drwClose()});
async function drwOpen(k){const[t,a,b]=k.split('|');const el=$('txDrw');el.hidden=false;el.innerHTML='<p class="note">Chargement…</p>';DRW={t,a,b};
  const head=(titre,meta,amt)=>`<button class="sm x" id="drwX" aria-label="Fermer">✕</button><h3>${esc(titre)}</h3><div class="meta">${meta}</div>${amt!=null?`<div class="amt">${fmt(amt)}</div>`:''}`;
  const sel=v=>`<select id="drwAcc">${OPTS}</select>`;
  if(t==='R'){const[mois,...rest]=a.split('_'),src=rest.join('_'),i=+b;let doc;
    if(P&&!P.multi&&P.mois===mois&&P.src===src)doc={tx:P.tx};else{try{doc=await readPeriod(mois,src)}catch(e){}}
    const x=doc?.tx?.[i];if(!x){el.innerHTML=head('Transaction introuvable','Rouvrez le rapport.')+'';$('drwX').onclick=drwClose;return}
    DRW.x={...x};DRW.rev=(P&&!P.multi&&P.mois===mois&&P.src===src)?P.revise:doc.revise;const ferme=lk(x.date),p=keyOf(x.desc);
    el.innerHTML=head(x.desc,`${esc(x.date)} · Relevé ${esc(src)} ${esc(accName(src))} · ${esc(moisLbl(mois))}${x.why?`<br>${esc(x.why)}`:''}`,x.amt)+
      (ferme?'<p class="msg err">Exercice fermé : cette transaction ne peut plus être modifiée.</p>':
      `<label class="f">Compte${sel()}</label>
       <label class="row" style="gap:8px;align-items:center;margin:4px 0 10px"><input type="checkbox" id="drwTax"${x.tax?' checked':''}> Taxes incluses (TPS/TVQ ventilées)</label>
       <label class="f">Note (facultatif, affichée sous la transaction)<input id="drwWhy" placeholder="ex. remboursement d’abonnement"></label>
       ${p?`<label class="row" style="gap:8px;align-items:flex-start;margin:4px 0 12px"><input type="checkbox" id="drwRule"> <span>Créer une règle : les prochaines transactions « ${esc(p)} » iront aussi dans ce compte.<br><small class="note">Laissez décoché pour une correction ponctuelle : seule cette transaction change.</small></span></label>`:''}
       <div class="row" style="gap:8px"><button class="pri" id="drwOk">Enregistrer</button><button id="drwGo">Voir dans le mois →</button></div><p class="msg" id="drwMsg"></p>`)+
      `<h3 style="font-size:14px;margin:16px 0 2px">Pièces jointes</h3><div id="drwPj">${pjListe(x.pj,!ferme)}</div>${ferme?'':`<label class="sm" style="display:inline-block;cursor:pointer;border:1px solid var(--line);border-radius:8px;padding:6px 12px">Joindre une facture ou un reçu<input type="file" id="drwPjF" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.xlsx,.xls,.csv,.doc,.docx" hidden></label>`}<p class="note" id="drwPjM"></p>`;
    $('drwX').onclick=drwClose;if(ferme)return;$('drwAcc').value=x.acct;
    const pjMaj=async fn=>{await majTx(mois,src,i,t=>{t.pj=fn(t.pj||[]);DRW.x.pj=t.pj});$('drwPj').innerHTML=pjListe(DRW.x.pj,true);LED=null};
    $('drwPjF').onchange=async e=>{const F=[...e.target.files];e.target.value='';try{const L=await pjEnvoyer(F,t=>$('drwPjM').textContent=t);await pjMaj(p0=>[...p0,...L]);audit('Pièce jointe ajoutée',`${txTxt(x)} : ${L.map(p=>p.n).join(', ')}`);$('drwPjM').textContent=`✓ ${L.length} pièce(s) jointe(s).`}catch(err){$('drwPjM').textContent='Envoi impossible : '+err.message}};
    $('drwPj').onclick=async e=>{const b=e.target.closest('[data-pjx]');if(!b)return;const k=+b.dataset.pjx,pj=(DRW.x.pj||[])[k];if(!pj||!confirm(`Retirer ${pj.n}?`))return;try{await pjMaj(p0=>p0.filter((_,j)=>j!==k));window.tlFichiers.retirer(pj.c).catch(()=>{});audit('Pièce jointe retirée',`${txTxt(x)} : ${pj.n}`)}catch(err){$('drwPjM').textContent=err.message}};
    $('drwGo').onclick=()=>{drwClose();goMois(mois,src,x.desc)};
    $('drwOk').onclick=async()=>{const acc=$('drwAcc').value,tax=$('drwTax').checked;if(DRW.rev&&!confirm(`${moisLbl(mois)} : ${revTxt(DRW.rev)}.\n\nModifier quand même? Le mois devra être révisé de nouveau.`))return;$('drwOk').disabled=true;
      try{await iaReclasser({refs:[`R:${mois}_${src}:${i}`],compte:acc,taxable:tax,raison:$('drwWhy').value.trim()||'correction depuis le rapport'});
        if($('drwRule')?.checked&&p){C.rules=(C.rules||[]).filter(r=>r.p!==p);C.rules.push({p,a:acc,t:tax});saveClient();renderRules();if(P)reclass()}
        LED=null;await runRep();$('drwMsg').className='msg';$('drwMsg').textContent=`✓ Enregistré : ${acc} ${accName(acc)}. Le rapport est à jour.`;setTimeout(()=>{if(DRW&&DRW.b===b)drwClose()},1400)}
      catch(e){$('drwMsg').className='msg err';$('drwMsg').textContent='Enregistrement impossible : '+(e.message||e)}$('drwOk').disabled=false}}
  else if(t==='J'){const j=(await loadJe()).find(x=>x.id===a);if(!j){el.innerHTML=head('Écriture introuvable','');$('drwX').onclick=drwClose;return}
    const ferme=lk(j.date);
    el.innerHTML=head(j.desc||j.ref||'Écriture de journal',`${esc(j.date)} · Écriture de journal ${esc(j.ref||'')}${j.type==='aje'?' · AJE':''}`,null)+
      `<table>${(j.lines||[]).map((l,k)=>`<tr><td>${ferme?esc(l.a+' '+accName(l.a)):`<select data-jl="${k}">${OPTS}</select>`}</td><td class="num" style="text-align:right;white-space:nowrap">${l.d?fmtN(l.d)+' Dt':fmtN(l.c)+' Ct'}</td></tr>`).join('')}</table>
      ${ferme?'<p class="msg err">Exercice fermé.</p>':'<div class="row" style="gap:8px"><button class="pri" id="drwOk">Enregistrer</button><button id="drwGo">Ouvrir l’écriture complète →</button></div><p class="msg" id="drwMsg"></p>'}`;
    $('drwX').onclick=drwClose;if(ferme)return;el.querySelectorAll('[data-jl]').forEach(s2=>s2.value=j.lines[+s2.dataset.jl].a);
    $('drwGo').onclick=()=>{drwClose();setTab('je');navPush();setTimeout(()=>jeOpen(JE.find(x=>x.id===a)||j),300)};
    $('drwOk').onclick=async()=>{const ch=[...el.querySelectorAll('[data-jl]')].filter(s2=>s2.value!==j.lines[+s2.dataset.jl].a);if(!ch.length){drwClose();return}
      try{for(const s2 of ch)await iaReclasser({refs:[`J:${a}:${s2.dataset.jl}`],compte:s2.value,raison:'correction depuis le rapport'});LED=null;await runRep();$('drwMsg').textContent='✓ Enregistré. Le rapport est à jour.';setTimeout(drwClose,1400)}
      catch(e){$('drwMsg').className='msg err';$('drwMsg').textContent='Enregistrement impossible : '+(e.message||e)}}}
  else if(t==='I'){await loadInv();const iv=INV.find(x=>x.id===a);if(!iv){el.innerHTML=head('Facture introuvable','');$('drwX').onclick=drwClose;return}
    el.innerHTML=head(`${iv.type==='achat'?'Facture d’achat':'Facture de vente'} ${iv.no||''} — ${iv.tiers}`,`${esc(iv.date)}${iv.desc?' · '+esc(iv.desc):''}`,iv.total)+
      `<p class="note">Une facture se corrige dans sa fiche (compte, taxes, montant).</p><div class="row"><button class="pri" id="drwGo">Ouvrir la facture →</button></div>`;
    $('drwX').onclick=drwClose;$('drwGo').onclick=()=>{drwClose();setTab('inv');navPush();setTimeout(()=>invOpen(iv),300)}}
  else{el.innerHTML=head('Écriture d’ouverture','Les soldes d’ouverture se modifient dans Écritures › Soldes d’ouverture.',null);$('drwX').onclick=drwClose}}
function goMois(m,src,desc){setTab('rev');if(mode!=='m'){mode='m';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode==='m'));$('lMois').hidden=false;$('lFrom').hidden=$('lTo').hidden=true}
  $('pMois').value=m;if(![...$('pSrc').options].some(x=>x.value===src))$('pSrc').insertAdjacentHTML('beforeend',`<option value="${esc(src)}">${esc(src)}</option>`);$('pSrc').value=src;
  filter='all';document.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f==='all'));$('q').value=desc;openPeriod();navPush()}
$('repOut').addEventListener('click',e=>{const g=e.target.closest('[data-gl]');if(g){e.preventDefault();REP='gl';document.querySelectorAll('[data-r]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.r==='gl'));$('repAccL').hidden=false;$('repAcc').value=g.dataset.gl;if(!$('repFrom').value)$('repFrom').value=exRange()[0];repUI();runRep();navPush();return}
  const dw=e.target.closest('[data-drw]');if(dw){e.preventDefault();if(dw.dataset.drw)drwOpen(dw.dataset.drw);return}
  const o=e.target.closest('[data-open]');if(o){const[m,src,desc]=o.dataset.open.split('|');setTab('rev');if(mode!=='m'){mode='m';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode==='m'));$('lMois').hidden=false;$('lFrom').hidden=$('lTo').hidden=true}
    $('pMois').value=m;if(![...$('pSrc').options].some(x=>x.value===src))$('pSrc').insertAdjacentHTML('beforeend',`<option value="${esc(src)}">${esc(src)}</option>`);$('pSrc').value=src;
    filter='all';document.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.f==='all'));$('q').value=desc;openPeriod()}});
function repRows(){return[...$('repOut').querySelectorAll('tr')].map(r=>[...r.cells].map(c=>c.textContent.trim()))}
const REPN={bs:'Bilan',is:'Etat des resultats',mo:'Resultats par mois',tb:'Balance de verification',gl:'Grand livre',jr:'Journal general',tx:'TPS-TVQ',ap:'Comptes fournisseurs',ar:'Comptes clients',gifi:'IGRF'};
async function repPdfBytes(){
  {if(!window.jspdf)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');if(!window.jspdf.jsPDF.API.autoTable)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'pt',format:'letter',orientation:REP==='mo'?'landscape':'portrait'});const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight();
    const cl=t=>String(t||'').replace(/[   ]/g,' ').replace(/[✓✗→]/g,'').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
    let y=42;doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(cl(C.nom),40,y);y+=14;doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(110);doc.text(`Produit le ${new Date().toLocaleDateString('fr-CA')} · Intranet Boujrad CPA Inc.`,40,y);doc.setTextColor(0);y+=18;
    const room=n=>{if(y+n>H-40){doc.addPage();y=42}};
    $('repOut').querySelectorAll('h2, table.rep, p').forEach(el=>{if(el.tagName!=='TABLE'&&el.closest('table'))return;
      if(el.tagName==='H2'){room(30);doc.setFont('helvetica','bold');doc.setFontSize(12.5);doc.text(cl(el.textContent),40,y);y+=12;return}
      if(el.tagName==='P'){const t=cl(el.textContent);if(!t)return;doc.setFont('helvetica',el.querySelector('.bad-b,.ok-b')||el.className.includes('-b')?'bold':'normal');doc.setFontSize(9);const L=doc.splitTextToSize(t,W-80);room(L.length*11+6);doc.text(L,40,y+8);y+=L.length*11+8;return}
      const body=[...el.rows].map(r=>{const k=r.className;return[...r.cells].map(c=>({content:cl(c.querySelector('input')?.value||c.textContent),colSpan:c.colSpan,styles:{halign:c.classList.contains('num')?'right':'left',fontStyle:/sec|grp|sub|tot/.test(k)?'bold':'normal',cellPadding:{top:3,bottom:3,left:c.classList.contains('ind')?14:4,right:4},fillColor:/sec/.test(k)?[240,240,240]:false}}))});
      doc.autoTable({startY:y,body,theme:'plain',margin:{left:40,right:40},styles:{fontSize:REP==='mo'?6.5:8.5,textColor:20},
        didDrawCell:d=>{const k=el.rows[d.row.index]?.className||'';if(/tot/.test(k)){doc.setDrawColor(0);doc.setLineWidth(.8);doc.line(d.cell.x,d.cell.y,d.cell.x+d.cell.width,d.cell.y);doc.line(d.cell.x,d.cell.y+d.cell.height-1,d.cell.x+d.cell.width,d.cell.y+d.cell.height-1);doc.line(d.cell.x,d.cell.y+d.cell.height+1,d.cell.x+d.cell.width,d.cell.y+d.cell.height+1)}else if(/sub/.test(k)){doc.setDrawColor(0);doc.setLineWidth(.5);doc.line(d.cell.x,d.cell.y,d.cell.x+d.cell.width,d.cell.y)}}});
      y=doc.lastAutoTable.finalY+14});
    const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(130);doc.text(`Page ${i} de ${n}`,W-40,H-22,{align:'right'})}
    return{data:new Uint8Array(doc.output('arraybuffer')),filename:`${C.nom.replace(/[^\w-]+/g,'_')}_${REPN[REP]||REP}_${$('repTo').value||$('repFrom').value||new Date().toISOString().slice(0,10)}.pdf`.replace(/\s+/g,'_')}}}
$('repPdf').onclick=async()=>{if(!downloads){$('repMsg').textContent='Téléchargement indisponible dans cette vue.';return}$('repMsg').textContent='Préparation du PDF…';
  try{const r=await repPdfBytes();await downloads.save(r);$('repMsg').textContent='PDF enregistré.'}catch(e){$('repMsg').textContent=e?.code==='declined'?'Téléchargement annulé.':'Création du PDF impossible.'}};
/* Envoyer le rapport affiché au client, en PDF */
const REPT={bs:'Bilan',is:'État des résultats',mo:'Résultats par mois',tb:'Balance de vérification',gl:'Grand livre',jr:'Journal général',tx:'Sommaire TPS/TVQ',txd:'Détail TPS/TVQ',ap:'Comptes fournisseurs',ar:'Comptes clients',das:'Sommaire des DAS',gifi:'Codes IGRF'};
const REPL={bs:'le bilan',is:'l’état des résultats',mo:'l’état des résultats par mois',tb:'la balance de vérification',gl:'le grand livre',jr:'le journal général',tx:'le sommaire TPS/TVQ',txd:'le détail TPS/TVQ',ap:'les comptes fournisseurs',ar:'les comptes clients',das:'le sommaire des DAS',gifi:'les codes IGRF'};
$('repSend').onclick=async()=>{if(!window.tlSendEmail){$('repMsg').textContent='Envoi de courriel indisponible ici.';return}
  const f=$('repFrom').value,t=$('repTo').value,acc=REP==='gl'&&$('repAcc').value?` — compte ${$('repAcc').value} ${accName($('repAcc').value)}`:'';
  const per=f&&t?`du ${dLong(f)} au ${dLong(t)}`:t?`au ${dLong(t)}`:'';const quoi=(REPL[REP]||'le rapport')+acc;
  $('rsTo').value=C.email||'';if(!C.email&&window.tlFindEmail)window.tlFindEmail(C.nom).then(e=>{if(e&&!$('rsTo').value)$('rsTo').value=e}).catch(()=>{});
  $('rsSub').value=`${C.nom} — ${REPT[REP]||'Rapport'}${acc} ${per}`.trim();
  $('rsBody').value=`Bonjour,\n\nVous trouverez ci-joint ${quoi} ${per}, en PDF.\n\n${REP==='gl'?'Si certaines transactions devraient être classées dans un autre compte, indiquez-le-nous simplement en répondant à ce courriel (date, montant et le bon compte), et nous ferons la correction.\n\n':''}N’hésitez pas à nous écrire si vous avez des questions.\n\nCordialement,`;
  $('rsMsg').textContent=`Pièce jointe : PDF de ${quoi} (tel qu’affiché à l’écran).`;const d=$('repSendDlg');try{d.showModal()}catch(e){d.setAttribute('open','')}};
$('rsClose').onclick=()=>{const d=$('repSendDlg');d.close?d.close():d.removeAttribute('open')};
$('rsGo').onclick=async()=>{const to=$('rsTo').value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)){$('rsMsg').textContent='Entrez une adresse courriel valide.';return}
  const b=$('rsGo');b.disabled=true;$('rsMsg').textContent='Préparation du PDF…';
  try{const r=await repPdfBytes();$('rsMsg').textContent='Envoi…';await window.tlSendEmail({to,subject:$('rsSub').value,text:$('rsBody').value,attachments:[{filename:r.filename,contentType:'application/pdf',content:b64(r.data)}]});
    if($('rsKeep').checked&&to!==C.email){C.email=to.slice(0,200);saveClient()}
    const d=$('repSendDlg');d.close?d.close():d.removeAttribute('open');$('repMsg').textContent=`✓ ${REPN[REP]||'Rapport'} envoyé à ${to} en PDF.`}
  catch(e){$('rsMsg').textContent='Envoi impossible : '+(e instanceof Event?'l’outil PDF n’a pas pu se charger (connexion Internet?). Réessayez.':(e.message||e))}b.disabled=false};
$('repCp').onclick=async()=>{try{await navigator.clipboard.writeText(repRows().map(r=>r.join('\t')).join('\r\n'));$('repMsg').textContent='Copié : collez dans Excel.'}catch(e){$('repMsg').textContent='Copie refusée.'}};
$('repCsv').onclick=async()=>{const csv='﻿'+repRows().map(r=>r.map(c=>`"${c.replace(/"/g,'""')}"`).join(';')).join('\r\n');
  if(!downloads){try{await navigator.clipboard.writeText(csv);$('repMsg').textContent='Téléchargement indisponible ici : copié à la place.'}catch(e){}return}
  try{await downloads.save({filename:`${C.nom.replace(/[^\w-]+/g,'_')}_${REP}_${$('repTo').value}.csv`,data:csv});$('repMsg').textContent='Fichier enregistré.'}catch(e){$('repMsg').textContent='Téléchargement annulé.'}};

$('repOut').addEventListener('change',e=>{const a=e.target.dataset?.gifi;if(a==null)return;C.gifi=C.gifi||{};const v=e.target.value.trim();if(v)C.gifi[a]=v;else delete C.gifi[a];if(C.gifiIa)delete C.gifiIa[a];e.target.style.background='';saveClient()});
$('repOut').addEventListener('click',async e=>{if(e.target.id!=='gifiAi')return;e.target.disabled=true;$('gifiMsg').textContent='L’IA associe les codes…';
  try{const r=await sampleFn.json(`Associe chaque compte de ce plan comptable d'une société québécoise (Sage 50) au code IGRF/GIFI de l'ARC le plus approprié pour les annexes 100 (bilan) et 125 (résultats) de la T2. Ignore les comptes de titre et de total. Utilise uniquement des codes de cette liste officielle (n'utilise jamais un code de total) :\n${igrfListe()}\n\nPlan comptable :\n${PLAN.filter(([n,t])=>!isHeader(n,t)).map(p=>p.join(' ')).join('\n')}\n\nRéponds uniquement en JSON : {"1060":"1002","4200":"8000"}`,{modelTier:'complex'});
    let n=0;C.gifi=C.gifi||{};Object.entries(r||{}).forEach(([a,c])=>{if(PLAN.some(p=>p[0]===a)&&igrfOk(String(c))&&!C.gifi[a]){C.gifi[a]=String(c);n++}});saveClient();runRep();$('repMsg').textContent=`${n} code(s) IGRF suggéré(s). Vérifiez-les.`}
  catch(err){$('gifiMsg').textContent='Suggestion impossible pour le moment.';e.target.disabled=false}});

const IGRF={"1000":"Encaisse et dépôts","1001":"Encaisse","1002":"Dépôts dans des banques et des institutions canadiennes – monnaie canadienne","1003":"Dépôts dans des banques et des institutions canadiennes – devises étrangères","1004":"Dépôts dans des banques étrangères – monnaie canadienne","1005":"Dépôts dans des banques étrangères – devises étrangères","1006":"Caisse de crédit – dépôt central","1007":"Autres éléments de l'actif similaires à l'encaisse","1060":"Comptes clients","1061":"Provision pour créances douteuses","1062":"Comptes clients commerciaux","1063":"Provision pour mauvaises créances – comptes clients commerciaux","1064":"Comptes clients de personnes apparentées","1065":"Provision pour mauvaises créances – personnes apparentées","1066":"Impôts à recevoir","1067":"Intérêts à recevoir","1068":"Retenues de garantie à recevoir","1069":"Créances au titre de baux","1070":"Provision pour éléments douteux contenus dans certaines créances au titre de baux","1071":"Comptes à recevoir d'employés","1072":"Provision pour mauvaises créances – employés","1073":"Montants à recevoir de membres d'OSBL (organisme sans but lucratif)","1120":"Stocks","1121":"Stock de marchandises à vendre","1122":"Pièces et fournitures en stock","1123":"Biens immobiliers figurant dans un inventaire","1124":"Stocks d'agrégats","1125":"Travaux en cours","1126":"Matières premières","1127":"Titres figurant dans un inventaire","1180":"Placements à court terme","1181":"Dépôts à terme canadiens","1182":"Actions de sociétés canadiennes","1183":"Obligations canadiennes","1184":"Bons du Trésor canadien","1185":"Titres acquis avec entente de rachat","1186":"Autres placements canadiens à court terme","1187":"Placements étrangers à court terme","1240":"Prêts et effets à recevoir","1241":"Prêts remboursables sur demande","1242":"Autres prêts à recevoir","1243":"Effets à recevoir","1244":"Hypothèques à recevoir","1300":"Sommes exigibles d'actionnaires/d'administrateurs (sociétés seulement)","1301":"Sommes exigibles d'actionnaires (particuliers)","1302":"Sommes exigibles d'actionnaires (sociétés)","1303":"Sommes exigibles d'administrateurs","1310":"Sommes exigibles d'associé(s)/commandité(s)","1311":"Sommes exigibles des commanditaires","1312":"Sommes exigibles d'associés qui sont des sociétés de personnes","1313":"Sommes exigibles des commandités","1314":"Sommes exigibles d'associés déterminés qui ne sont pas des commanditaires","1360":"Placements dans une (des) coentreprise(s)/société(s) de personnes","1380":"Sommes exigibles de coentreprises/sociétés de personnes","1400":"Sommes exigibles de personnes apparentées/placements dans des personnes apparentées","1401":"Billets à demande de personnes apparentées","1402":"Intérêts à recevoir de personnes apparentées","1403":"Prêts/avances à recevoir de personnes apparentées","1460":"Dettes des clients pour acceptation","1480":"Autres éléments d'actif à court terme","1481":"Impôts sur le revenu futurs (reportés) (sociétés seulement)","1482":"Revenus de placements accumulés","1483":"Impôts recouvrables/remboursables","1484":"Dépenses payées d'avance","1485":"Avances de forage","1486":"Cautionnement/dépôts sur soumissions","1599":"Total de l'actif à court terme","1600":"Terrains","1601":"Frais d'amélioration des terrains","1602":"Amortissement cumulé de l'amélioration des terrains","1620":"Biens épuisables","1621":"Amortissement cumulé des biens épuisables","1622":"Biens en ressources pétrolifères et en gaz naturel","1623":"Amortissement cumulé des biens en ressources pétrolifères et en gaz naturel","1624":"Biens miniers","1625":"Amortissement cumulé des biens miniers","1626":"Frais d'exploration et d'exploitation reportés","1627":"Amortissement cumulé des frais d'exploration et d'exploitation reportés","1628":"Carrières","1629":"Amortissement cumulé des carrières","1630":"Carrières de gravier","1631":"Amortissement cumulé des carrières de gravier","1632":"Concessions forestières","1633":"Amortissement cumulé des concessions forestières","1680":"Bâtiments","1681":"Amortissement cumulé des bâtiments","1682":"Installations de fabrication et de traitement","1683":"Amortissement cumulé des installations de fabrication et de traitement","1684":"Bâtiments en construction","1740":"Machines, matériel, meubles et accessoires","1741":"Amortissement cumulé des machines, du matériel, des meubles et des accessoires","1742":"Véhicules automobiles","1743":"Amortissement cumulé des véhicules automobiles","1744":"Outils et matrices","1745":"Amortissement cumulé des outils et des matrices","1746":"Matériel de construction et d'excavation","1747":"Amortissement cumulé du matériel de construction et d'excavation","1748":"Matériel d'exploitation forestière","1749":"Amortissement cumulé du matériel d'exploitation forestière","1750":"Filets et matériel de pêche","1751":"Amortissement cumulé des filets et du matériel de pêche","1752":"Matériel d'exploitation minière","1753":"Amortissement cumulé du matériel d'exploitation minière","1754":"Réseaux pétroliers et gaziers","1755":"Amortissement cumulé des réseaux pétroliers et gaziers","1756":"Matériel de production pour les industries de ressources naturelles","1757":"Amortissement cumulé du matériel de production pour les industries de ressources naturelles","1758":"Matériel de production autre que pour les industries de ressources naturelles","1759":"Amortissement cumulé du matériel de production autre que pour les industries de ressources naturelles","1760":"Matériel d'exploration","1761":"Amortissement cumulé du matériel d'exploration","1762":"Matériel d'expédition","1763":"Amortissement cumulé du matériel d'expédition","1764":"Navires et bateaux","1765":"Amortissement cumulé des navires et des bateaux","1766":"Aéronefs","1767":"Amortissement cumulé des aéronefs","1768":"Panneaux indicateurs","1769":"Amortissement cumulé des panneaux indicateurs","1770":"Petits outils","1771":"Amortissement cumulé des petits outils","1772":"Matériel de radio et de communication","1773":"Amortissement cumulé du matériel de radio et de communication","1774":"Matériel informatique/logiciels","1775":"Amortissement cumulé du matériel informatique/logiciels","1776":"Instruments de musique","1777":"Amortissement cumulé des instruments de musique","1778":"Satellites","1779":"Amortissement cumulé des satellites","1780":"Stations terrestres","1781":"Amortissement cumulé des stations terrestres","1782":"Machines et matériel en cours de fabrication","1783":"Matériel de transport","1784":"Amortissement cumulé du matériel de transport","1785":"Autres machines et matériel","1786":"Amortissement cumulé des autres machines et autre matériel","1787":"Meubles et accessoires","1788":"Amortissement cumulé des meubles et accessoires","1900":"Autres immobilisations","1901":"Amortissement cumulé des autres immobilisations","1902":"Chemins d'exploitation forestière","1903":"Amortissement cumulé des chemins d'exploitation forestière","1904":"Aires asphaltées et parcs de stationnement","1905":"Amortissement des aires asphaltées et des parcs de stationnement","1906":"Quais","1907":"Amortissement cumulé des quais","1908":"Clôtures","1909":"Amortissement cumulé des clôtures","1910":"Contrats de location – acquisition (bâtiments)","1911":"Amortissement cumulé des contrats de location – acquisition (bâtiments)","1912":"Contrats de location – acquisition (matériel)","1913":"Amortissement cumulé des contrats de location – acquisition (matériel)","1914":"Contrats de location – acquisition (véhicules)","1915":"Amortissement cumulé des contrats de location – acquisition (véhicules)","1916":"Contrats de location – acquisition (autres)","1917":"Amortissement cumulé des contrats de location – acquisition (autres)","1918":"Améliorations locatives","1919":"Amortissement cumulé des améliorations locatives","1920":"Autres immobilisations en construction","1921":"Aires de camping","1922":"Amortissement cumulé des aires de camping","2008":"Total des immobilisations","2009":"Total de l'amortissement cumulé des immobilisations","2010":"Actif incorporel","2011":"Amortissement cumulé de l'actif incorporel","2012":"Achalandage","2013":"Amortissement cumulé de l'achalandage","2014":"Contingents","2015":"Amortissement cumulé des contingents","2016":"Permis","2017":"Amortissement cumulé des permis","2018":"Frais de constitution en société (sociétés seulement)","2019":"Amortissement cumulé des frais de constitution en société (sociétés seulement)","2020":"Marques de commerce et brevets","2021":"Amortissement cumulé des marques de commerce et des brevets","2022":"Listes de clients","2023":"Amortissement cumulé des listes de clients","2024":"Droits","2025":"Amortissement cumulé des droits","2026":"Recherche et développement","2027":"Amortissement cumulé de la recherche et du développement","2070":"Droits relatifs à des ressources","2071":"Amortissement cumulé des droits relatifs à des ressources","2072":"Droits de coupe","2073":"Amortissement cumulé des droits de coupe","2074":"Droits miniers","2075":"Amortissement cumulé des droits miniers","2076":"Droits pétroliers et gaziers","2077":"Amortissement cumulé des droits pétroliers et gaziers","2178":"Total de l'actif incorporel","2179":"Total de l'amortissement cumulé de l'actif incorporel","2180":"Sommes exigibles d'actionnaires/d'administrateurs","2181":"Sommes exigibles d'actionnaires (particuliers)","2182":"Sommes exigibles d'actionnaires (sociétés)","2183":"Sommes exigibles d'administrateurs","2190":"Sommes exigibles de membres","2200":"Placements dans une (des) coentreprise(s)/société(s) de personnes","2210":"Sommes exigibles d'associé(s)/commandité(s)","2211":"Sommes exigibles des commanditaires","2212":"Sommes exigibles d'associés qui sont des sociétés de personnes","2213":"Sommes exigibles des commandités","2214":"Sommes exigibles d'associés déterminés qui ne sont pas des commanditaires","2220":"Sommes exigibles de coentreprises/sociétés de personnes","2240":"Sommes exigibles de personnes apparentées/placements dans des personnes apparentées","2241":"Sommes exigibles de/placements dans des personnes apparentées canadiennes","2242":"Actions de sociétés apparentées canadiennes","2243":"Prêts/avances à des sociétés apparentées canadiennes","2244":"Placements dans des sociétés apparentées canadiennes à la valeur d'acquisition","2245":"Placements dans des sociétés apparentées canadiennes à la valeur de consolidation","2246":"Sommes exigibles de/placements dans des parties apparentées étrangères","2247":"Actions de sociétés apparentées étrangères","2248":"Prêts/avances à des sociétés apparentées étrangères","2249":"Placements dans des sociétés apparentées étrangères à la valeur d'acquisition","2250":"Placements dans des sociétés apparentées étrangères à la valeur de consolidation","2280":"Placements dans des locations en partenariat","2300":"Placements à long terme","2301":"Actions de sociétés étrangères","2302":"Autres types de placements à l'étranger","2303":"Actions de sociétés canadiennes","2304":"Titres de créance du gouvernement du Canada","2305":"Titres de créance de gouvernements provinciaux et d'administrations municipales du Canada","2306":"Obligations et débentures de sociétés canadiennes","2307":"Titres de créance","2308":"Titres de participation","2309":"Titres acquis à la suite d'une entente de rachat","2310":"Actions de la caisse de crédit centrale","2311":"Autres placements canadiens à long terme","2360":"Prêts à long terme","2361":"Prêts hypothécaires","2362":"Prêts personnels et prêts sur carte de crédit","2363":"Prêts du gouvernement et prêts commerciaux","2364":"Marges de crédit","2420":"Autres éléments d'actif à long terme","2421":"Impôts sur le revenu futurs (reportés) (sociétés seulement)","2422":"Frais de régime de pension reportés","2423":"Pertes de change non matérialisées reportées","2424":"Autres éléments/frais reportés","2425":"Amortissement cumulé des frais reportés","2426":"Fonds de réserve","2427":"Valeur de rachat de l'assurance-vie","2589":"Total de l'actif à long terme","2590":"Actif détenu en fiducie","2599":"Total de l'actif","2600":"Découvert bancaire","2620":"Montants et charges à payer","2621":"Effets commerciaux à payer","2622":"Effets commerciaux à payer à des personnes apparentées","2623":"Retenues de garantie à payer","2624":"Salaires à payer","2625":"Frais de gestion à payer","2626":"Gratifications à payer","2627":"Retenues salariales à payer","2628":"Retenues d'impôts et de taxes à payer","2629":"Intérêts à payer","2630":"Montants à payer aux membres d'OSBL (organisme sans but lucratif)","2680":"Taxes et impôts à payer","2700":"Dettes à court terme","2701":"Emprunts auprès de banques canadiennes","2702":"Éléments de passif pour les titres vendus à découvert","2703":"Éléments de passif pour les titres vendus à la suite d'une entente de rachat","2704":"Titres sur l'or et sur l'argent","2705":"Chèques et autres effets en circulation","2706":"Billets garantis","2707":"Prêts sur carte de crédit","2770":"Revenus reportés","2780":"Sommes dues à un (des) actionnaire(s)/administrateur(s)","2781":"Sommes dues à un (des) actionnaire(s) (particuliers)","2782":"Sommes dues à un (des) actionnaire(s) (sociétés)","2783":"Sommes dues à un (des) administrateur(s)","2790":"Sommes payables aux associé(s)/commandité(s)","2791":"Sommes payables aux commanditaires","2792":"Sommes payables aux associés qui sont des sociétés de personnes","2793":"Sommes payables aux commandités","2794":"Sommes payables aux associés déterminés qui ne sont pas des commanditaires","2840":"Sommes dues à une (des) coentreprise(s)/société(s) de personnes","2860":"Sommes dues à des personnes apparentées","2861":"Billets à demande dus à des personnes apparentées","2862":"Intérêts à payer à des personnes apparentées","2863":"Avances à payer à des personnes apparentées","2920":"Portion à court terme du passif à long terme","2940":"Acceptations de banque","2960":"Autres éléments du passif à court terme","2961":"Sommes reçues en dépôt","2962":"Dividendes à payer","2963":"Impôts sur le revenu futurs (reportés) (sociétés seulement)","2964":"Réserve pour garanties et indemnités","2965":"Provisions et réserves générales","2966":"Parts des membres de l'équipage","3139":"Total du passif à court terme","3140":"Dettes à long terme","3141":"Hypothèques","3142":"Emprunts d'une société de crédit agricole","3143":"Emprunts d'une banque à charte","3144":"Emprunts d'une caisse populaire/d'une coopérative de crédit","3145":"Emprunts du gouvernement provincial ou territorial","3146":"Emprunts d'un fournisseur","3147":"Prêts personnels","3148":"Emprunts d'une fédération, d'une centrale ou d'une ligue","3149":"Marges de crédit","3150":"Éléments de passif pour les titres vendus à découvert","3151":"Éléments de passif pour les titres vendus à la suite d'une entente de rachat","3152":"Billets garantis","3200":"Cautionnement des institutions financières","3210":"Obligations et débentures","3220":"Revenus reportés","3240":"Impôts sur le revenu futurs (reportés) (sociétés seulement)","3260":"Sommes dues à un (des) actionnaire(s)/administrateur(s)","3261":"Sommes dues à un (des) actionnaire(s) (particuliers)","3262":"Sommes dues à un (des) actionnaire(s) (sociétés)","3263":"Sommes dues à un (des) administrateur(s)","3270":"Sommes dues à des membres","3280":"Sommes dues à une (des) coentreprise(s)/société(s) de personnes","3291":"Sommes payables aux associé(s)/commandité(s)","3292":"Sommes payables aux commanditaires","3293":"Sommes payables aux associés qui sont des sociétés de personnes","3294":"Sommes payables aux commandités","3295":"Sommes payables aux associés déterminés qui ne sont pas des commanditaires","3300":"Sommes dues à des personnes apparentées","3301":"Sommes dues à des personnes apparentées canadiennes","3302":"Sommes dues à des personnes apparentées étrangères","3320":"Autres éléments de passif à long terme","3321":"Obligations, engagements et location-acquisition à long terme","3322":"Réserves pour garanties et indemnités","3323":"Provision pour la restauration des sites d'exploitation","3324":"Contribution à une fiducie pour l'environnement admissible","3325":"Provisions et réserves générales","3326":"Redressement pour les actions privilégiées (sociétés seulement)","3327":"Répartition aux membres (sociétés seulement)","3328":"Revenus différés de contrats incomplets","3450":"Total du passif à long terme","3460":"Dettes de second rang","3470":"Sommes détenues en fiducie","3499":"Total du passif","3500":"Actions ordinaires","3520":"Actions privilégiées","3540":"Surplus d'apport et autres surplus","3541":"Surplus d'apport","3542":"Surplus d'expertise","3543":"Réserve générale","3545":"Revenu net / perte nette","3546":"Redressements sur exercices antérieurs","3547":"Redressements relatifs aux devises","3548":"Éléments inhabituels de revenu","3550":"Revenu total net/perte totale nette","3551":"Bilan d'ouverture de capital de commandités","3552":"Revenu net ou perte nette de commandités","3553":"Retraits de commandités","3554":"Cotisation de commandités durant l'exercice","3560":"Bilan de fermeture du capital des commandités","3561":"Bilan d'ouverture du capital des commanditaires","3562":"Revenu net ou perte nette des commanditaires","3563":"Retraits de commanditaires","3564":"Cotisation de commanditaires durant l'exercice","3570":"Compte du siège social","3571":"Bilan de fermeture du capital des commanditaires","3575":"Total du capital des capitaux propres associés","3580":"Cumul des autres éléments du résultat étendu","3585":"Total du passif et du capital des associés","3600":"Bénéfices non répartis/déficit","3620":"Total des capitaux propres","3640":"Total du passif et des capitaux propres","3660":"Bénéfices non répartis/déficit – début de l'exercice","3680":"Revenu net/perte nette","3700":"Dividendes déclarés","3701":"Dividendes en espèces","3702":"Ristournes","3720":"Redressements sur exercices antérieurs","3740":"Autres éléments touchant les bénéfices non répartis","3741":"Rachat d'actions","3742":"Réserves spéciales (sociétés et coopératives seulement)","3743":"Redressements relatifs aux devises","3744":"Éléments inhabituels de revenu","3745":"Transferts interfonds","3849":"Bénéfices non répartis/déficit – fin de l'exercice","7000":"Écarts de réévaluation","7002":"Gains/pertes au titre de prestations définies","7004":"Gains/pertes résultant de la conversion des états financiers d'un établissement à l'étranger","7006":"Gains/pertes se rapportant aux instruments de capitaux propres","7008":"Partie réelle des gains/pertes sur instruments de couverture de flux de trésorerie","7010":"Impôt sur le revenu concernant les autres éléments du résultat étendu (sociétés seulement)","7020":"Autres éléments divers du résultat étendu","8000":"Ventes commerciales de biens et services","8020":"Ventes de biens et de services à des personnes apparentées","8030":"Ventes entre divisions","8040":"Ventes de ressources naturelles","8041":"Ventes de pétrole et de gaz naturel","8042":"Ventes de pétrole et de gaz naturel à des personnes apparentées","8043":"Commercialisation du gaz","8044":"Revenus de traitement","8045":"Revenus de transport par pipeline","8046":"Ventes reliées à l'exploration séismique","8047":"Revenus provenant de l'exploitation minière","8048":"Revenus provenant du charbon","8049":"Revenus provenant des sables bitumineux","8050":"Revenus provenant des redevances","8051":"Revenus/pertes d'une société de personnes/coentreprise – pétrole et gaz","8052":"Revenus/pertes d'une société de personnes/coentreprise – mines","8053":"Autres revenus de production","8089":"Total des ventes de biens et services","8090":"Revenus de placements","8091":"Intérêts de sources étrangères","8092":"Intérêts d'obligations et de débentures canadiennes","8093":"Intérêts de prêts hypothécaires canadiens","8094":"Intérêts d'autres sources canadiennes","8095":"Revenus de dividendes","8096":"Dividendes de sources canadiennes","8097":"Dividendes de sources étrangères","8100":"Revenus d'intérêts (institutions financières)","8101":"Intérêts de prêts","8102":"Intérêts de valeurs mobilières","8103":"Intérêts de dépôts en banque","8120":"Revenus de commissions","8121":"Revenus de commissions sur des transactions immobilières","8140":"Revenus de location","8141":"Revenus de location immobilière","8142":"Revenus de location de films","8150":"Contrats de location de véhicules","8160":"Revenus provenant de la pêche","8161":"Ventes de poisson","8162":"Autres produits marins","8163":"Subventions, crédits et dégrèvements de pêche","8164":"Subsides de pêche","8165":"Indemnité pour perte d'un revenu ou d'un bien de pêche","8166":"Revenu de pêcheur à la part","8210":"Profits/pertes sur la disposition d'éléments d'actif","8211":"Profits/pertes sur la vente de placements","8212":"Profits/pertes sur la disposition d'avoirs miniers","8220":"Montants reçus d'OSBL (organisme sans but lucratif)","8221":"Frais d'adhésion","8222":"Cotisations","8223":"Dons","8224":"Ventes et recettes brutes provenant d'activités de l'organisme","8230":"Autres revenus","8231":"Gains/pertes sur devises étrangères","8232":"Revenus/pertes de filiales/de sociétés affiliées","8233":"Revenus/pertes d'autres divisions","8234":"Revenus/pertes de coentreprises","8235":"Revenus/pertes de sociétés de personnes","8236":"Réalisation de revenus différés","8237":"Revenus de redevances autres que l'exploitation des ressources naturelles","8238":"Crédits d'impôts de l'Alberta au titre des redevances","8239":"Honoraires de gestion et d'administration","8240":"Revenus de télécommunications","8241":"Honoraires de consultation","8242":"Subventions et octrois","8243":"Ventes de sous-produits","8244":"Frais d'administration provenant du service des dépôts","8245":"Frais d'administration provenant du service du crédit","8246":"Frais d'administration provenant du service des cartes bancaires","8247":"Ristournes","8248":"Recouvrement d'assurance","8249":"Recouvrement de frais","8250":"Recouvrement de mauvaises créances","8299":"Total des revenus","8300":"Stock d'ouverture","8301":"Stock d'ouverture – produits finis","8302":"Stock d'ouverture – matières premières","8303":"Stock d'ouverture – produits en cours de fabrication","8320":"Achats/coût des matériaux","8340":"Salaires directs","8350":"Avantages sociaux relatifs aux salaires directs","8360":"Fournisseurs et sous-traitants","8370":"Coûts de production (autres que de ressources naturelles)","8400":"Coûts de production de ressources naturelles","8401":"Exploitation de pipelines","8402":"Forage","8403":"Coûts de restauration de sites d'exploitation","8404":"Redevances dérogatoires brutes","8405":"Redevances de propriété franche","8406":"Paiements de location de concessions publiques","8407":"Prospection/travaux de géologie","8408":"Exploitation de puits, carburant et matériel","8409":"Abandon de puits et puits secs","8410":"Autres paiements de location","8411":"Frais d'exploration","8412":"Frais d'aménagement","8435":"Sommes exigées par la Couronne","8436":"Redevances à la Couronne","8437":"Frais de location de la Couronne","8438":"Impôts sur le minerai de propriété franche","8439":"Impôts miniers","8440":"Frais de location de sables bitumineux","8441":"Surtaxe de la Saskatchewan sur les ressources naturelles","8450":"Autres coûts directs","8451":"Location et exploitation de matériel","8452":"Cour à bois","8453":"Coûts d'exploitation forestière","8454":"Coûts des chemins forestiers","8455":"Droits de coupe","8456":"Coûts des redevances","8457":"Frais de transport à l'achat et droits","8458":"Moins-value de l'inventaire","8459":"Coût direct de l'amortissement des biens corporels","8460":"Coût direct de l'amortissement des biens constitués par des ressources naturelles","8461":"Autres frais indirects attribués au coût des ventes","8500":"Stock de fermeture","8501":"Stock de fermeture – produits finis","8502":"Stock de fermeture – matières premières","8503":"Stock de fermeture – produits en cours de fabrication","8518":"Coût des ventes","8519":"Profit brut/perte brute","8520":"Publicité et promotion","8521":"Publicité","8522":"Dons","8523":"Repas et frais de représentation","8524":"Promotion","8570":"Amortissement de biens incorporels","8571":"Écart d'acquisition (achalandage)","8590":"Créances irrécouvrables","8610":"Pertes sur prêts","8611":"Provision pour les pertes sur prêts","8620":"Avantages sociaux","8621":"Assurances collectives","8622":"Partie de l'employeur des avantages sociaux","8623":"Cotisations aux régimes de revenus différés","8650":"Amortissement des biens constitués par des ressources naturelles","8670":"Amortissement des biens corporels","8690":"Assurances","8691":"Assurance sur la vie des dirigeants","8710":"Intérêts et frais bancaires","8711":"Intérêts sur les dettes à court terme","8712":"Intérêts sur les obligations et les débentures","8713":"Intérêts sur les prêts hypothécaires","8714":"Intérêts sur les dettes à long terme","8715":"Frais bancaires","8716":"Frais de cartes de crédit","8717":"Frais de recouvrement et de crédit","8740":"Intérêts payés (institutions financières)","8741":"Intérêts payés sur les dépôts","8742":"Intérêts payés sur les obligations et les débentures","8760":"Taxes d'affaires, droits d'adhésion et licences","8761":"Droits d'adhésion","8762":"Taxes d'affaires","8763":"Frais de franchise","8764":"Frais à verser aux gouvernements","8790":"Impôt des grandes sociétés de la Nouvelle-Écosse","8810":"Frais de bureau","8811":"Papeterie et fournitures de bureau","8812":"Services de bureau","8813":"Traitement des données","8860":"Honoraires professionnels","8861":"Frais légaux","8862":"Frais comptables","8863":"Honoraires d'experts-conseils","8864":"Honoraires d'architectes","8865":"Frais d'évaluation","8866":"Frais de laboratoire","8867":"Honoraires médicaux","8868":"Frais de vétérinaire","8869":"Frais de courtage","8870":"Frais de transfert","8871":"Frais de gestion et d'administration","8872":"Affinage et dosage","8873":"Droits d'enregistrement et frais d'agents de transfert","8874":"Coûts de restructuration","8875":"Frais d'une commission des valeurs mobilières","8876":"Frais de formation","8877":"Studio et enregistrement","8910":"Frais de location","8911":"Loyer de biens immobiliers","8912":"Frais d'occupation","8913":"Frais de copropriété","8914":"Location de matériel","8915":"Location de véhicules motorisés","8916":"Amarrage (bateaux)","8917":"Entreposage","8918":"Location de contingents","8960":"Réparations et entretien","8961":"Réparations et entretien – bâtiments","8962":"Réparations et entretien – véhicules","8963":"Réparations et entretien – bateaux","8964":"Réparations et entretien – machines et matériel","9010":"Autres frais de réparation et d'entretien","9011":"Dépenses d'usinage","9012":"Frais relatifs aux routes","9013":"Sécurité","9014":"Enlèvement de déchets","9060":"Salaires et traitements","9061":"Commissions","9062":"Part de l'équipage","9063":"Gratifications","9064":"Jetons de présence des administrateurs","9065":"Salaires des cadres","9066":"Salaires des employés","9110":"Contrats de sous-traitance","9130":"Fournitures","9131":"Petit outillage","9132":"Frais d'atelier","9133":"Uniformes","9134":"Blanchissage","9135":"Alimentation et restauration","9136":"Matériel de pêche","9137":"Filets et pièges","9138":"Sel, appâts et glace","9139":"Fournitures de camp","9150":"Dépenses liées à l'informatique","9151":"Amélioration et modernisation","9152":"Internet","9180":"Taxes foncières","9200":"Frais de déplacement","9201":"Réunions et congrès","9220":"Services publics","9221":"Électricité","9222":"Eau","9223":"Chauffage","9224":"Frais de carburant","9225":"Téléphone et télécommunications","9270":"Autres dépenses","9271":"Écarts de caisse","9272":"Remboursement de frais de la société mère (sociétés seulement)","9273":"Frais de vente","9274":"Frais de transport et d'entreposage","9275":"Livraison, fret et messageries","9276":"Frais de garantie","9277":"Frais de redevances – résidents","9278":"Frais de redevances – non-résidents","9279":"Frais de déchargement","9280":"Frais d'enfouissement","9281":"Frais de véhicules","9282":"Recherche et développement","9283":"Retenues d'impôts","9284":"Frais d'administration et frais généraux","9285":"Dépenses entre divisions","9286":"Transferts interfonds","9367":"Total des frais d'exploitation","9368":"Total des dépenses","9369":"Revenu non agricole net","9970":"Revenu net/perte nette avant impôts et éléments extraordinaires","9975":"Éléments extraordinaires","9976":"Règlements juridiques","9980":"Profits/pertes non matérialisés","9985":"Éléments inhabituels","9990":"Impôts sur le revenu exigibles de l'exercice (sociétés seulement)","9995":"Provision pour impôts sur le revenu futurs (différés) (sociétés seulement)","9998":"Total - autres revenus étendus","9999":"Revenu net/perte nette après impôts et éléments extraordinaires"};/* liste des postes de l'IGRF de l'ARC (guide RC4088, Annexe A), sauf les postes agricoles */
const igrfTot=c=>/^Total/.test(IGRF[c]||'')||['9999','9970','8519','8518','3849','3680','3660','3640','3620'].includes(c);
const igrfOk=c=>!!IGRF[c]&&!igrfTot(c);
const igrfListe=()=>Object.entries(IGRF).filter(([c])=>!igrfTot(c)).map(([c,d])=>c+' '+d).join('\n');
/* --- IGRF : import de la T2 de l'an dernier, association des comptes, contrôle et export --- */
const gifiSg=(a,c)=>['1'].includes(String(a)[0])||+String(a)[0]>=5?c:-c;
function gifiPrior(E){const[exD]=exRange();if(!exD)return null;const P=colBal(E,shiftY(exD,1),veille(exD));if(!P)return null;
  const m=new Map();[...(P.B||new Map())].forEach(([a,c])=>{if(+String(a)[0]<4&&c)m.set(a,c)});[...(P.I||new Map())].forEach(([a,c])=>{if(+String(a)[0]>=4&&c)m.set(a,c)});return m}
function gifiCtl(E){const T=C.gifiT2;if(!T||!T.l?.length)return'';const P=gifiPrior(E),G=C.gifi||{},got=new Map();
  if(P)[...P].forEach(([a,c])=>{const k=G[a];if(k)got.set(k,(got.get(k)||0)+gifiSg(a,c))});
  const rows=T.l.map(x=>{const v=got.get(x.code),d=v==null?null:v-x.c;return `<tr><td>${esc(x.code)}</td><td>${esc(x.lib||'')}</td><td class="num">${fmtN(x.c)}</td><td class="num">${v==null?'—':fmtN(v)}</td><td class="num">${d==null?'<span class="bad-b">aucun compte</span>':Math.abs(d)<100?'<span class="ok-b">OK</span>':`<span class="bad-b">${fmtN(d)}</span>`}</td></tr>`}).join('');
  const ok=T.l.filter(x=>{const v=got.get(x.code);return v!=null&&Math.abs(v-x.c)<100}).length;
  return `<h2 style="margin-top:16px">Contrôle avec la T2 de l’an dernier</h2><p class="note">${esc(T.nom||'')} · ${T.l.length} codes importés le ${esc(T.le||'')} · ${ok} concordent à 1 $ près avec les soldes de l’an dernier de ce dossier${P?'':' (soldes de l’an dernier introuvables : ajoutez les soldes d’ouverture)'}.</p>
    <table class="rep"><tr class="sec"><td>Code</td><td>Description (T2)</td><td class="num">T2 an dernier</td><td class="num">Comptes associés</td><td class="num">Écart</td></tr>${rows}</table>`}
function gifiParse(rows){const out=new Map();rows.forEach(r=>{const cells=r.map(x=>String(x??'').trim()).filter(Boolean);const i=cells.findIndex(x=>/^\d{4}$/.test(x)&&+x>=1000&&+x<=9999);if(i<0)return;
    const nums=cells.slice(i+1).map(x=>toCents(x.replace(/\s/g,'').replace(/\$/g,''))).filter(x=>x!=null);if(!nums.length)return;
    const lib=cells.slice(i+1).filter(x=>toCents(x.replace(/\s/g,'').replace(/\$/g,''))==null).join(' ').slice(0,80);const code=cells[i];
    if(!out.has(code))out.set(code,{code,lib,c:nums[0]})});return[...out.values()].filter(x=>x.c)}
async function gifiImport(f){const say=t=>{const m=$('gifiMsg');if(m)m.textContent=t};say('Lecture du fichier…');
  try{let rows;if(/\.pdf$/i.test(f.name)){const pages=await pdfPages(f);rows=pages.join('\n').split('\n').map(l=>l.split(/\s{2,}|\t/))}
    else if(/\.txt$/i.test(f.name))rows=(await f.text()).split(/\r?\n/).map(l=>l.split(/[;,\t]|\s{2,}/));else rows=await rowsOf(f);
    const L=gifiParse(rows);if(!L.length){say('Aucun code IGRF trouvé : le fichier doit contenir des codes à 4 chiffres et leurs montants.');return}
    C.gifiT2={nom:f.name,le:new Date().toLocaleDateString('fr-CA'),l:L};if(!LED)LED=await loadLedger();
    const P=gifiPrior(LED),G=C.gifi=C.gifi||{},accts=PLAN.filter(([n,t])=>!isHeader(n,t)).map(([n])=>n);let nExact=0,nAi=0;
    // 1) montant identique et unique
    if(P){const libres=new Map(L.map(x=>[x.code,x.c]));[...P].forEach(([a,c])=>{if(G[a])return;const v=gifiSg(a,c);const m=L.filter(x=>Math.abs(x.c-v)<100);if(m.length===1){G[a]=m[0].code;nExact++}})}
    // 2) l'IA pour le reste, en privilégiant les codes de la T2
    const rest=accts.filter(a=>!G[a]);
    if(rest.length&&sampleFn){say(`${nExact} compte(s) associé(s) par le montant. L’IA associe les autres…`);
      const r=await sampleFn.json(`Tu es CPA au Québec. Associe chaque compte du plan comptable d'une société au code IGRF (GIFI) de l'ARC pour les annexes 100 et 125 de la T2.
Utilise de préférence les codes de la T2 de l'an dernier ci-dessous; si aucun ne convient, prends le code le plus précis de la liste officielle plus bas. N'utilise jamais un code de total. Les montants de l'an dernier t'aident à reconnaître les comptes.
Codes de la T2 de l'an dernier (code ; description ; montant) :
${L.map(x=>`${x.code} ; ${x.lib} ; ${(x.c/100).toFixed(2)}`).join('\n')}

Comptes à associer (numéro ; nom ; solde de l'an dernier) :
${rest.map(a=>`${a} ; ${accName(a)} ; ${P&&P.get(a)?(gifiSg(a,P.get(a))/100).toFixed(2):'—'}`).join('\n')}

Liste officielle des codes IGRF :
${igrfListe()}

Réponds uniquement en JSON : {"1060":"1002","4200":"8000"}`,{modelTier:'complex'});
      Object.entries(r||{}).forEach(([a,c])=>{if(rest.includes(a)&&igrfOk(String(c))&&!G[a]){G[a]=String(c);nAi++}})}
    saveClient();runRep();setTimeout(()=>{const m=$('gifiMsg');if(m)m.textContent=`${L.length} codes importés de la T2. ${nExact} compte(s) associé(s) par le montant, ${nAi} par l’IA. Vérifiez le contrôle en bas, puis corrigez au besoin dans la colonne IGRF.`},50)}
  catch(err){console.error(err);say('Lecture impossible de ce fichier.')}}
async function gifiExport(){if(!LED)LED=await loadLedger();const t=$('repTo').value,[exD]=exRange(),f=$('repFrom').value||exD,E=LED,G=C.gifi||{};
  const B=balances(E,null,t),I=balances(E,f,t),sum=new Map(),sans=[];
  [...new Map([...[...B].filter(([a,c])=>c&&+String(a)[0]<4),...[...I].filter(([a,c])=>c&&+String(a)[0]>=4)])].forEach(([a,c])=>{const k=G[a];if(!k){sans.push(a);return}sum.set(k,(sum.get(k)||0)+gifiSg(a,c))});
  if(sans.length&&!confirm(`${sans.length} compte(s) sans code IGRF (${sans.slice(0,6).join(', ')}${sans.length>6?'…':''}) seront exclus. Exporter quand même?`))return;
  const csv=[...sum].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k},${(v/100).toFixed(2)}`).join('\r\n')+'\r\n';
  const name=`${C.nom.replace(/[^\w-]+/g,'_')}_IGRF_${t}.csv`;
  if(!downloads){try{await navigator.clipboard.writeText(csv);$('repMsg').textContent='Téléchargement indisponible ici : copié à la place.'}catch(e){}return}
  try{await downloads.save({filename:name,data:csv});$('repMsg').textContent='Fichier IGRF enregistré (code, montant) : importez-le dans votre logiciel de T2.'}catch(e){$('repMsg').textContent='Téléchargement annulé.'}}
$('repOut').addEventListener('change',e=>{if(e.target.id==='gifiFile'){const f=e.target.files[0];e.target.value='';if(f)gifiImport(f)}});
$('repOut').addEventListener('click',e=>{if(e.target.id==='gifiExp')gifiExport()});
function gifiStdMap(){const ref=new Map();DEF_PLAN.split('\n').forEach(l=>{const m=l.match(/^(\S+)\s+(.*)$/);if(m&&DEF_GIFI[m[1]])ref.set(m[1]+'|'+norm(m[2]),DEF_GIFI[m[1]])});Object.values(SECTEURS).forEach(S=>S.c.forEach(([n,nm,g])=>{if(g)ref.set(n+'|'+norm(nm),g)}));
  const G=C.gifi=C.gifi||{};let n=0;PLAN.forEach(([a,t])=>{if(G[a])return;const g=ref.get(a+'|'+norm(t));if(g){G[a]=g;n++}});return n}
/* À l'ouverture du rapport IGRF : les comptes sans code sont associés automatiquement (plan type, puis l'IA), une fois par dossier et par session. */
const GIFIAUTO=new Set();
async function gifiAuto(){if(!C||GIFIAUTO.has(C.id))return;GIFIAUTO.add(C.id);const manque=()=>PLAN.filter(([n,t])=>!isHeader(n,t)&&!(C.gifi||{})[n]);if(!manque().length)return;
  const nStd=gifiStdMap();let nIa=0;const reste=manque();
  if(reste.length&&sampleFn){$('repMsg').textContent=`L’IA associe les codes IGRF de ${reste.length} compte(s)…`;
    try{const r=await sampleFn.json(`Associe chaque compte de ce plan comptable d'une société québécoise au code IGRF/GIFI de l'ARC le plus approprié pour les annexes 100 (bilan) et 125 (résultats) de la T2. Utilise uniquement des codes de cette liste officielle (jamais un code de total) :\n${igrfListe()}\n\nComptes à associer :\n${reste.map(p=>p.join(' ')).join('\n')}\n\nPlan complet pour contexte :\n${PLAN.map(p=>p.join(' ')).join('\n')}\n\nRéponds uniquement en JSON : {"1060":"1002","4200":"8000"}`,{modelTier:'complex'});
      C.gifiIa=C.gifiIa||{};Object.entries(r||{}).forEach(([a,c])=>{if(reste.some(p=>p[0]===a)&&igrfOk(String(c))&&!igrfTot(String(c))){C.gifi[a]=String(c);C.gifiIa[a]=1;nIa++}})}catch(e){}}
  if(nStd||nIa){saveClient();GIFIMSG=`Codes IGRF associés automatiquement : ${nStd} selon le plan type${nIa?`, ${nIa} par l’IA (en jaune : à jeter un coup d’œil)`:''}. ${manque().length?`${manque().length} compte(s) sans code.`:'Tous les comptes ont un code.'}`;runRep()}}
let GIFIMSG='';
function gifiStd(){const ref=new Map();DEF_PLAN.split('\n').forEach(l=>{const m=l.match(/^(\S+)\s+(.*)$/);if(m&&DEF_GIFI[m[1]])ref.set(m[1]+'|'+norm(m[2]),DEF_GIFI[m[1]])});Object.values(SECTEURS).forEach(S=>S.c.forEach(([n,nm,g])=>{if(g)ref.set(n+'|'+norm(nm),g)}));
  const G=C.gifi=C.gifi||{};let n=0;PLAN.forEach(([a,t])=>{if(G[a])return;const g=ref.get(a+'|'+norm(t));if(g){G[a]=g;n++}});saveClient();runRep();setTimeout(()=>{const m=$('gifiMsg');if(m)m.textContent=n?`${n} compte(s) associé(s) selon le plan type (même numéro et même nom).`:'Aucun compte de ce plan ne correspond au plan type (numéro et nom identiques).'},50)}
$('repOut').addEventListener('click',e=>{if(e.target.id==='gifiStd')gifiStd()});

/* fermeture d'exercice : voir module Exercices */

/* ---------- soldes d'ouverture ---------- */
function ouvParse(txt){const s={};let bad=0;txt.split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>{const m=l.match(/^(\S+)\s+(.+)$/);if(!m){bad++;return}const c=toCents(m[2].replace(/\s/g,''));if(c==null){bad++;return}if(c)s[m[1]]=(s[m[1]]||0)+c});return{s,bad}}
function ouvShow(){const o=C.ouv;$('ouvDate').value=o?.date||exRange()[0]||'';$('ouvTxt').value=o?Object.entries(o.s).sort((a,b)=>a[0].localeCompare(b[0],'fr',{numeric:true})).map(([a,c])=>`${a} ${(c/100).toFixed(2)}`).join('\n'):''}
$('ouvFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;$('ouvMsg').textContent='Lecture…';
  try{let rows;if(/\.pdf$/i.test(f.name)){const pages=await pdfPages(f);rows=pages.join('\n').split('\n').map(l=>l.split(/\s{2,}|\t/))}else rows=await rowsOf(f);
    const out=[];rows.forEach(r=>{const i=r.findIndex(x=>/^\d{3,8}$/.test(String(x).trim()));if(i<0)return;const nums=r.slice(i+1).map(x=>toCents(String(x).replace(/\s/g,''))).filter((x,j,arr)=>x!=null);
      const raw=r.slice(i+1).map(x=>String(x).trim());const numIdx=raw.map((x,j)=>toCents(x.replace(/\s/g,''))!=null&&/\d/.test(x)?j:-1).filter(j=>j>=0);
      let c=0;if(numIdx.length>=2){const d=toCents(raw[numIdx[numIdx.length-2]].replace(/\s/g,''))||0,k=toCents(raw[numIdx[numIdx.length-1]].replace(/\s/g,''))||0;c=Math.abs(d)-Math.abs(k)}else if(numIdx.length===1)c=toCents(raw[numIdx[0]].replace(/\s/g,''))||0;
      if(c)out.push(`${String(r[i]).trim()} ${(c/100).toFixed(2)}`)});
    $('ouvTxt').value=out.join('\n');const{s}=ouvParse(out.join('\n'));const tot=Object.values(s).reduce((a,b)=>a+b,0);
    $('ouvMsg').textContent=`${out.length} soldes repris. ${tot?`Écart débits/crédits : ${fmtN(tot)} $ — vérifiez.`:'Débits = crédits.'} Vérifiez puis enregistrez.`}catch(err){$('ouvMsg').textContent='Lecture impossible de ce fichier.'}};
$('ouvSave').onclick=()=>{const{s,bad}=ouvParse($('ouvTxt').value);const d=$('ouvDate').value;if(!d){$('ouvMsg').textContent='Indiquez la date des soldes.';return}
  if(curEx()?.statut==='ferme'){$('ouvMsg').textContent='Exercice fermé : les soldes d’ouverture sont figés. Rouvrez l’exercice pour les modifier.';return}
  const tot=Object.values(s).reduce((a,b)=>a+b,0);const miss=Object.keys(s).filter(a=>!PLAN.some(p=>p[0]===a));
  C.ouv={date:d,s};if(!C.exDeb)C.exDeb=d;syncEx();saveClient();renderSettings();LED=null;
  $('ouvMsg').textContent=`${Object.keys(s).length} soldes enregistrés au ${d}.`+(tot?` Attention : débits et crédits diffèrent de ${fmtN(tot)} $.`:' Débits = crédits.')+(miss.length?` Comptes absents du plan : ${miss.join(', ')}.`:'')+(bad?` ${bad} ligne(s) ignorée(s).`:'')};

/* ---------- écritures manuelles ---------- */
let jeEdit=null;
function jeRow(a='',d='',c=''){return `<tr><td><select class="jeA" aria-label="Compte"><option value=""></option>${OPTS.replace(`value="${esc(a)}"`,`value="${esc(a)}" selected`)}</select></td><td><input class="jeD" inputmode="decimal" value="${esc(d)}" style="width:120px;text-align:right"></td><td><input class="jeC" inputmode="decimal" value="${esc(c)}" style="width:120px;text-align:right"></td><td><button type="button" class="sm" data-x>×</button></td></tr>`}
function jeBal(){let D=0,K=0;$('jeLines').querySelectorAll('tr').forEach(r=>{D+=cents(r.querySelector('.jeD').value);K+=cents(r.querySelector('.jeC').value)});
  $('jeBal').textContent=`Débits ${fmtN(D)||'0,00'} · Crédits ${fmtN(K)||'0,00'}${D===K?' ✓':` · écart ${fmtN(D-K)}`}`;$('jeBal').className=D===K&&D?'ok-b':'bad-b';return D===K&&D>0}
/* ---------- régularisations de fin d'exercice proposées par l'IA ---------- */
let AJEP=null;
async function ajeDossier(){const x=curEx();const[d,f]=x?[x.deb,x.fin]:exRange();if(!d||!f)throw new Error('Indiquez d’abord les dates de l’exercice dans Paramètres.');
  LED=null;LED=await loadLedger();const B=balances(LED,null,f),I=balances(LED,d,f);
  const det=PLAN.filter(([n,t])=>!isHeader(n,t));const sol=det.map(([a,t])=>{const c=+String(a)[0]>=4?(I.get(a)||0):(B.get(a)||0);return c?`${a} ${t} : ${iaMt(c)}`:''}).filter(Boolean);
  const tx=LED.filter(e=>e.kind==='rel');const dans=tx.filter(e=>e.date>=d&&e.date<=f);
  const fin60=addDays(f,-60),apres=[...tx.filter(e=>e.date>f&&e.date<=addDays(f,120)),...(C.attente||[]).filter(e=>e.date>f).map(e=>({date:e.date,desc:e.desc,amt:e.amt,acct:'(mis de côté)'}))];
  const L=(e)=>`${e.date} | ${e.desc} | ${iaMt(e.amt??0)} | ${e.acct||''}${/^\d/.test(e.acct||'')?' '+accName(e.acct):''}`;
  const gros=dans.filter(e=>Math.abs(e.amt)>=50000&&+String(e.acct)[0]>=5).map(L);
  const fin=dans.filter(e=>e.date>=fin60&&+String(e.acct)[0]>=4).map(L);
  const pret=det.filter(([a,t])=>/PRET|EMPRUNT|FINANCEMENT|HYPOTH|CREDIT.?BAIL|LOCATION.?FINAN|MARGE/.test(norm(t))).map(([a,t])=>a);
  const pretTx=dans.filter(e=>pret.includes(e.acct)||/LEAS|FINANCEMENT|PRET|LOAN|HYPOTH/.test(norm(e.desc))).map(L);
  const je=(await loadJe()).filter(j=>j.date>=d&&j.date<=f).map(j=>`${j.date} ${j.ref||''} ${j.desc||''}${j.type==='aje'?' (AJE)':''} : ${(j.lines||[]).map(l=>`${l.a} ${l.d?'Dt '+iaMt(l.d):'Ct '+iaMt(l.c)}`).join(', ')}`);
  const memo=(C.ajeMemo||[]).filter(m=>m.ex!==f).slice(-30).map(m=>`${m.ex} : ${m.titre} — ${m.desc} (${m.lignes})`);
  return{d,f,txt:`Dossier : ${C.nom}. ${iaProfil()}${C.notes?' Notes du cabinet : '+C.notes:''}
Exercice du ${d} au ${f}. Compte transitoire : ${C.tr||'—'}. Compte de taxes : TPS ${C.tpsA||'?'}/${C.tpsV||'?'}, TVQ ${C.tvqA||'?'}/${C.tvqV||'?'}.
Plan comptable (comptes de détail) :\n${det.map(p=>p.join(' ')).join('\n')}

Soldes au ${f} (bilan : solde cumulé; résultats : depuis le début de l'exercice; débit +, crédit −) :\n${sol.join('\n')}

Dépenses de 500 $ et plus dans l'exercice :\n${gros.slice(0,150).join('\n')||'aucune'}
Revenus et dépenses des 60 derniers jours de l'exercice :\n${fin.slice(0,150).join('\n')||'aucun'}
Paiements de prêts, crédit-bail ou financement dans l'exercice :\n${pretTx.slice(0,60).join('\n')||'aucun'}
Transactions bancaires APRÈS la fin d'exercice (pour frais courus, revenus à recevoir, factures de l'exercice payées après) :\n${apres.slice(0,150).map(L).join('\n')||'aucune'}
Écritures de journal déjà passées dans l'exercice :\n${je.join('\n')||'aucune'}
Régularisations acceptées les années précédentes (à reproposer si elles s'appliquent encore, avec les montants de cette année) :\n${memo.join('\n')||'aucune'}`}}
/* réévaluation des comptes en US$ au taux de clôture : calculée, pas devinée (solde du relevé × taux de la Banque du Canada) */
async function reevalProps(){const x=curEx();const[d,f]=x?[x.deb,x.fin]:exRange();const U=comptesUSD();if(!f||!U.length)return[];
  await tauxAssurer(f,f);const r=tauxDe(f);if(!LED)LED=await loadLedger();const out=[];
  for(const a of U){const S=(C.stmts||[]).filter(s=>s.src===a).sort((x,y)=>x.du.localeCompare(y.du));
    const s=S.find(s=>s.du<=f&&s.au>=f)||[...S].reverse().find(s=>s.au<=f);const tx=LED.filter(e=>e.kind==='rel'&&e.src===a);let usd=null,src='';
    if(s&&s.au>=f){usd=s.sd+tx.filter(e=>e.date>=s.du&&e.date<=f).reduce((t,e)=>t+e.amt,0);src=`relevé du ${s.du} au ${s.au}`}
    else if(s){usd=s.sf+tx.filter(e=>e.date>s.au&&e.date<=f).reduce((t,e)=>t+e.amt,0);src=`relevé terminé le ${s.au} et transactions suivantes`}
    const titre=`Réévaluation du compte en dollars US ${a} ${accName(a)}`;
    if(usd==null||!r){out.push({titre,explication:usd==null?'Aucun relevé avec soldes pour ce compte : versez les relevés (Conciliation) pour calculer la réévaluation.':'Taux de la Banque du Canada introuvable pour la fin d’exercice.',confiance:'basse',lignes:[],err:'données manquantes',etat:''});continue}
    const B=balances(LED,null,f).get(a)||0,cible=Math.round(usd*r),diff=cible-B;if(Math.abs(diff)<1)continue;
    const fx=fxAccAssurer(),lignes=diff>0?[{a,d:diff,c:0},{a:fx,d:0,c:diff}]:[{a,d:0,c:-diff},{a:fx,d:-diff,c:0}];
    out.push({titre,explication:`Le solde en dollars US au ${f} (${fmtN(usd)} US$, ${src}) est converti au taux de clôture de la Banque du Canada. L’écart avec le solde aux livres en $ CA est un${diff>0?' gain':'e perte'} de change.`,calcul:`${fmtN(usd)} US$ × ${r} = ${fmtN(cible)} $ CA; solde aux livres ${fmtN(B)} $ CA; écart ${fmtN(diff)} $ CA`,confiance:'haute',pieces:['Relevé du compte à la fin d’exercice','Taux de change de la Banque du Canada au '+f],lignes,err:lk(f)?'exercice fermé ou protégé':'',etat:''})}
  return out}
async function ajeProposer(){const out=$('ajeOut');if(!sampleFn){const FXP=await reevalProps().catch(()=>[]);if(FXP.length){AJEP={f:(exBornes()||exRange())[1],props:FXP,dem:[],com:'L’IA n’est pas disponible ici : seules les réévaluations de change (calculées) sont proposées.'};ajeRender();return}out.innerHTML='<p class="msg err">L’IA n’est pas disponible ici.</p>';return}
  $('ajeGo').disabled=true;out.innerHTML='<p class="note">L’IA passe le dossier en revue… (environ une minute)</p>';
  try{const D=await ajeDossier();
    const r=await sampleFn.json(`Tu es CPA au Québec et tu prépares les régularisations (écritures d'ajustement) de fin d'exercice d'un client, pour une mission de compilation. Données du dossier :\n\n${D.txt}\n${comptesUSD().length?`Comptes en dollars US (${comptesUSD().join(', ')}) : ils sont réévalués à part au taux de clôture; ne propose pas de réévaluation de change.\n`:''}Méthode du dossier : ${METH[methodeEff()]}\n\n
Passe en revue, en t'appuyant uniquement sur ces données : prêts et crédit-bail (séparer capital et intérêts des paiements, intérêts courus), amortissement/DPA des immobilisations (demi-taux l'année d'acquisition), charges payées d'avance (assurances, abonnements annuels), frais courus (honoraires comptables de fin d'année, factures de l'exercice payées après la fin), revenus à recevoir (ex. RAMQ d'après la fin qui concernent l'exercice) ou reportés, TPS/TVQ (solde à payer ou à recevoir cohérent; aucune si le client n'est pas inscrit), salaires et DAS à payer, impôts sur le revenu estimés, compte transitoire et avances de l'actionnaire, comptes anormaux (solde du mauvais côté).
Ne propose une écriture que si les données la justifient; quand il manque une pièce (relevé de prêt, facture, registre des immobilisations), dis-le dans "a_demander" plutôt que d'inventer un montant. Utilise seulement des comptes de détail du plan (numéros exacts). Chaque écriture doit balancer, datée du ${D.f}.
Réponds uniquement en JSON : {"propositions":[{"titre":"Frais courus — honoraires comptables","explication":"pourquoi, en 1-3 phrases","calcul":"comment le montant est obtenu","confiance":"haute|moyenne|basse","pieces":["pièce à conserver"],"lignes":[{"compte":"6xxx","debit":1500,"credit":0},{"compte":"2xxx","debit":0,"credit":1500}]}],"a_demander":["document à obtenir du client et pourquoi"],"commentaire":"vue d'ensemble en 2 phrases"}`,{modelTier:'complex'});
    const ok=new Set(PLAN.filter(([n,t])=>!isHeader(n,t)).map(p=>p[0]));
    const props=(Array.isArray(r?.propositions)?r.propositions:[]).map(p=>{const lignes=(p.lignes||[]).map(l=>({a:String(l.compte),d:Math.round((+l.debit||0)*100),c:Math.round((+l.credit||0)*100)})).filter(l=>l.d||l.c);
      const dt=lignes.reduce((s,l)=>s+l.d,0),ct=lignes.reduce((s,l)=>s+l.c,0);const bad=lignes.find(l=>!ok.has(l.a));
      return{...p,lignes,err:!lignes.length?'aucune ligne':dt!==ct?`ne balance pas (${fmtN(dt)} / ${fmtN(ct)})`:bad?`compte ${bad.a} absent du plan ou compte de titre`:lk(D.f)?'exercice fermé ou protégé':'',etat:''}});
    const FXP=await reevalProps().catch(()=>[]);AJEP={f:D.f,props:[...FXP,...props],dem:Array.isArray(r?.a_demander)?r.a_demander:[],com:String(r?.commentaire||'')};ajeRender()}
  catch(e){const FXP=await reevalProps().catch(()=>[]);if(FXP.length){AJEP={f:(exBornes()||exRange())[1],props:FXP,dem:[],com:`Revue de l’IA impossible (${e.message||e}) : seules les réévaluations de change, calculées, sont proposées.`};ajeRender()}else out.innerHTML=`<p class="msg err">Revue impossible : ${esc(e.message||e)}</p>`}$('ajeGo').disabled=false}
function ajeRender(){const out=$('ajeOut');if(!AJEP){out.innerHTML='';return}const{props,dem,com}=AJEP;const cf={haute:'ok',moyenne:'',basse:'todo'};
  out.innerHTML=(com?`<p style="margin:10px 0">${esc(com)}</p>`:'')+(props.length?props.map((p,i)=>`<div style="border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0${p.etat?';opacity:.6':''}">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px"><strong>${esc(p.titre||'Régularisation')}</strong><span class="pill ${cf[p.confiance]??''}">Confiance ${esc(p.confiance||'?')}</span></div>
    <p style="margin:6px 0">${esc(p.explication||'')}</p>${p.calcul?`<p class="note" style="margin:4px 0">Calcul : ${esc(p.calcul)}</p>`:''}
    <table class="rep" style="margin:8px 0"><tr class="grp"><td>Compte</td><td class="num">Débit</td><td class="num">Crédit</td></tr>${p.lignes.map(l=>`<tr><td>${esc(l.a)} ${esc(accName(l.a))}</td><td class="num">${l.d?fmtN(l.d):''}</td><td class="num">${l.c?fmtN(l.c):''}</td></tr>`).join('')}</table>
    ${(p.pieces||[]).length?`<p class="note" style="margin:4px 0">Pièces : ${(p.pieces||[]).map(esc).join(' · ')}</p>`:''}
    ${p.etat?`<p class="note"><strong>${p.etat==='ok'?'✓ Passée au journal (AJE)':'Rejetée'}</strong></p>`:p.err?`<p class="msg err">À corriger avant de passer : ${esc(p.err)}</p><div class="row" style="gap:6px"><button class="sm" data-ajemod="${i}">Modifier</button><button class="sm" data-ajeno="${i}">Rejeter</button></div>`
      :`<div class="row" style="gap:6px"><button class="sm pri" data-ajeok="${i}">Accepter</button><button class="sm" data-ajemod="${i}">Modifier</button><button class="sm" data-ajeno="${i}">Rejeter</button></div>`}</div>`).join(''):'<p class="note">Aucune régularisation proposée à partir des données actuelles.</p>')+
    (dem.length?`<div style="margin-top:12px"><strong>À obtenir du client</strong><ul style="margin:6px 0 0 18px">${dem.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'')}
function ajeMemo(p){C.ajeMemo=[...(C.ajeMemo||[]).filter(m=>!(m.ex===AJEP.f&&m.titre===p.titre)),{ex:AJEP.f,titre:String(p.titre||'').slice(0,80),desc:String(p.explication||'').slice(0,200),lignes:p.lignes.map(l=>`${l.a} ${l.d?'Dt':'Ct'} ${iaMt(l.d||l.c)}`).join(', ')}].slice(-80);saveClient()}
$('ajeGo').onclick=ajeProposer;
$('ajeOut').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!AJEP)return;const i=+(b.dataset.ajeok??b.dataset.ajemod??b.dataset.ajeno);const p=AJEP.props[i];if(!p)return;
  const doc={date:AJEP.f,ref:'AJE',desc:String(p.titre||'Régularisation de fin d’exercice').slice(0,120),type:'aje',ex:exOf(AJEP.f),lines:p.lignes,updated:new Date().toISOString()};
  if(b.dataset.ajeno!=null){p.etat='non';ajeRender();return}
  if(b.dataset.ajemod!=null){jeOpen({...doc});ajeMemo(p);return}
  b.disabled=true;try{if(local){LOCAL.je=LOCAL.je||{};LOCAL.je[C.id+'/j'+Date.now()]=doc}else await(await jeCol()).doc().set(doc);audit('Régularisation acceptée (AJE)',`${doc.date} ${doc.desc} : ${p.lignes.map(l=>`${l.a} ${l.d?'Dt '+fmt(l.d):'Ct '+fmt(l.c)}`).join(', ')}`);LED=null;p.etat='ok';ajeMemo(p);if(typeof renderJe==='function')renderJe();ajeRender()}
  catch(err){b.disabled=false;alert('Enregistrement impossible : '+(err.message||err))}});
let JEPJ=[];
function jeOpen(j,tpl){jeEdit=j?.id||null;JEPJ=[...(j?.pj||[])];setTimeout(()=>{$('jePj').innerHTML=pjListe(JEPJ,true)},0);$('jeForm').hidden=false;$('jeErr').textContent='';$('jeDate').value=j?.date||exRange()[1]||'';$('jeRef').value=j?.ref||'';$('jeDesc').value=j?.desc||'';$('jeType').value=j?.type||'';
  const L=j?.lines?.length?j.lines:(tpl||[{},{}]);$('jeLines').innerHTML=L.map(l=>jeRow(l.a,l.d?(l.d/100).toFixed(2):'',l.c?(l.c/100).toFixed(2):'')).join('');jeBal();$('jeForm').scrollIntoView({behavior:'smooth',block:'nearest'})}
$('jeNew').onclick=()=>jeOpen();
$('jePjF').onchange=async e=>{const F=[...e.target.files];e.target.value='';try{const L=await pjEnvoyer(F,t=>$('jePjM').textContent=t);JEPJ=[...JEPJ,...L];$('jePj').innerHTML=pjListe(JEPJ,true);$('jePjM').textContent='Enregistrez l’écriture pour garder la pièce.'}catch(err){$('jePjM').textContent='Envoi impossible : '+err.message}};
$('jePj').onclick=e=>{const b=e.target.closest('[data-pjx]');if(!b)return;JEPJ=JEPJ.filter((_,k)=>k!==+b.dataset.pjx);$('jePj').innerHTML=pjListe(JEPJ,true)};
$('jePaie').onclick=()=>{const f=re=>findAcc(re)||'';jeOpen({ref:'PAIE',desc:'Paie de l’actionnaire — remplacez les montants par ceux du calcul de paie',lines:[
  {a:f(/SALAIRES/)},{a:f(/CHARGE DU RRQ|RRQ.*CHARGE/)},{a:f(/CHARGE DU RQAP/)},{a:f(/CHARGE DE A-?E|ASSURANCE-EMPLOI.*CHARGE/)},{a:f(/FSSQ|FSS/)},{a:f(/CNESST|CSST/)},
  {a:f(/RRQ A PAYER/)},{a:f(/RQAP A PAYER/)},{a:f(/ASSURANCE-EMPLOI A PAYER/)},{a:f(/IMPOT FEDERAL A PAYER/)},{a:f(/QUEBEC A PAYER/)},{a:f(/FSSQ A PAYER/)},{a:f(/CNESST A PAYER/)},{a:f(/PRETS DES PROPRIETAIRES|ACTIONNAIRE/)}]})};
$('jeAdd').onclick=()=>{$('jeLines').insertAdjacentHTML('beforeend',jeRow());jeBal()};
$('jeLines').addEventListener('input',jeBal);$('jeLines').addEventListener('change',jeBal);
$('jeLines').addEventListener('click',e=>{if(e.target.dataset.x!=null){e.target.closest('tr').remove();jeBal()}});
$('jeCancel').onclick=()=>{$('jeForm').hidden=true};
$('jeSave').onclick=async()=>{const date=$('jeDate').value;const lines=[...$('jeLines').querySelectorAll('tr')].map(r=>({a:r.querySelector('.jeA').value,d:cents(r.querySelector('.jeD').value),c:cents(r.querySelector('.jeC').value)})).filter(l=>l.a&&(l.d||l.c));
  if(!date){$('jeErr').textContent='Date requise.';return}if(lk(date)||(jeEdit&&lk(JE.find(x=>x.id===jeEdit)?.date))){$('jeErr').textContent='Cette date est dans un exercice fermé : rouvrez-le d’abord (Paramètres).';return}if(!jeBal()||lines.length<2){$('jeErr').textContent='L’écriture doit balancer (débits = crédits).';return}
  const doc={date,ref:$('jeRef').value.trim().slice(0,20),desc:$('jeDesc').value.trim().slice(0,120),type:$('jeType').value,ex:exOf(date),lines,...(JEPJ.length?{pj:JEPJ}:{}),updated:new Date().toISOString()};
  const jl=l=>l.map(x=>`${x.a} ${x.d?'Dt '+fmt(x.d):'Ct '+fmt(x.c)}`).join(', ');const old=jeEdit&&JE.find(x=>x.id===jeEdit);audit(old?'Écriture modifiée':'Écriture ajoutée',`${date} ${doc.ref} ${doc.desc}${doc.type==='aje'?' (AJE)':''} : ${old?jl(old.lines||[])+' → ':''}${jl(lines)}`);
  try{if(local){LOCAL.je=LOCAL.je||{};LOCAL.je[C.id+'/'+(jeEdit||'j'+Date.now())]=doc}else{const col=await jeCol();await(jeEdit?col.doc(jeEdit):col.doc()).set(doc)}
    $('jeForm').hidden=true;LED=null;renderJe()}catch(e){$('jeErr').textContent='Enregistrement impossible.'}};
async function renderJe(){ouvShow();await loadJe();const[xd,xf]=exRange();const JL=JE.filter(j=>$('jeAll').checked||!xd||(j.date>=xd&&j.date<=(xf||'9999')));
  $('jeList').innerHTML=JL.length?JL.map(j=>`<tr><td class="d">${esc(j.date)}</td><td>${esc(j.ref||'')}${j.type==='aje'?' <span class="pill">AJE</span>':''}${lk(j.date)?' <span class="pill">Fermé</span>':''}</td><td>${esc(j.desc||'')}</td><td class="num">${fmtN((j.lines||[]).reduce((s,l)=>s+(l.d||0),0))}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="sm" data-je="${esc(j.id)}">Modifier</button><button class="sm danger" data-del="je-${esc(j.id)}">Supprimer</button></div></td></tr>`).join('')
    :'<tr><td colspan="5" class="empty">Aucune écriture dans cet exercice.</td></tr>'}
$('jeList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.je){jeOpen(JE.find(j=>j.id===b.dataset.je));return}
  if(b.dataset.del?.startsWith('je-')){if(lk(JE.find(j=>j.id===b.dataset.del.slice(3))?.date)){b.textContent='Exercice fermé';return}}
  if(b.dataset.del?.startsWith('je-'))confirm2(b,'',async()=>{const id=b.dataset.del.slice(3);{const j=JE.find(x=>x.id===id);if(j)audit('Écriture supprimée',`${j.date} ${j.ref||''} ${j.desc||''} : ${(j.lines||[]).map(x=>`${x.a} ${x.d?'Dt '+fmt(x.d):'Ct '+fmt(x.c)}`).join(', ')}`)}try{if(local)delete LOCAL.je[C.id+'/'+id];else await(await jeCol()).doc(id).delete()}catch(err){}LED=null;renderJe()})});

/* ---------- comptes liés ---------- */
function matchLinks(txs){const pool=[];(C.links||[]).forEach(l=>(l.tx||[]).forEach(([d,a,ds])=>pool.push({l,d,a,ds,used:false})));
  if(!pool.length)return{n:0,by:{}};
  const take=(t,strict)=>{const c=pool.filter(p=>!p.used&&p.a===-t.amt&&dd(p.d,t.date)<=5&&(!strict||p.l.acct===t.acct)).sort((x,y)=>dd(x.d,t.date)-dd(y.d,t.date))[0];if(c)c.used=true;return c};
  txs.filter(t=>t.st==='apparie').forEach(t=>take(t,true));
  let n=0;const by={};
  [...txs].sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{if(t.st==='manuel'||t.st==='apparie'||t.st==='suggere')return;if(!(t.st==='transit'||(t.st==='auto'&&t.acct===C.tr)))return;
    const c=take(t,false);if(!c||!c.l.acct)return;Object.assign(t,{acct:c.l.acct,tax:false,st:'apparie',unk:false,why:`Apparié : ${c.l.nom}, ${c.ds?c.ds.slice(0,40)+', ':''}${c.d}`});n++;by[c.l.nom]=(by[c.l.nom]||0)+Math.abs(t.amt)});
  return{n,by}}
function autoMatch(){if(!P)return 0;const ni=matchInvoices(P.tx);if(ni)msg(($('msg').textContent+` ${ni} paiement(s) de facture apparié(s).`).trim());if(!(C.links||[]).length)return ni;const r=matchLinks(P.tx);
  if(r.n)msg(($('msg').textContent+` ${r.n} virement(s) apparié(s) : `+Object.entries(r.by).map(([k,v])=>`${k} ${fmt(v)}`).join(', ')+'.').trim());return r.n+ni}
function renderLinks(){const L=C.links||[];$('lnkAcct').innerHTML='<option value="__new">+ Nouveau compte…</option>'+OPTS;
  const pick=findAcc(/ACTIONNAIRE|SOCIETE (MERE|APPARENTEE|LIEE)|HOLDING|PORTEFEUILLE/);if(pick)$('lnkAcct').value=pick;
  $('lnkList').innerHTML=L.length?L.map(l=>{const ds=(l.tx||[]).map(x=>x[0]).sort();return `<tr><td><strong>${esc(l.nom)}</strong></td><td><select data-la="${esc(l.id)}" aria-label="Compte">${OPTS.replace(`value="${esc(l.acct)}"`,`value="${esc(l.acct)}" selected`)}</select></td><td>${(l.tx||[]).length?`${(l.tx||[]).length} transactions, ${esc(ds[0])} au ${esc(ds[ds.length-1])}`:'<span class="why">aucun</span>'}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="sm" data-lf="${esc(l.id)}">Verser des relevés</button><button class="sm danger" data-del="lnk-${esc(l.id)}">Retirer</button></div></td></tr>`}).join('')
    :'<tr><td colspan="4" class="empty">Aucun compte lié. Ajoutez la holding ou un compte personnel du propriétaire.</td></tr>'}
$('lnkAcct').onchange=()=>{if($('lnkAcct').value==='__new')newAccount(null,no=>{renderLinks();if(no)$('lnkAcct').value=no})};
$('lnkForm').onsubmit=e=>{e.preventDefault();const nom=$('lnkNom').value.trim(),acct=$('lnkAcct').value;if(!nom||acct==='__new')return;
  C.links=[...(C.links||[]),{id:'l'+Date.now().toString(36),nom,acct,tx:[]}];$('lnkNom').value='';saveClient();renderLinks();$('lnkMsg').textContent=`« ${nom} » ajouté. Versez maintenant ses relevés.`};
let lnkTarget=null;
$('lnkList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.lf){lnkTarget=b.dataset.lf;$('lnkFile').click();return}
  if(b.dataset.del?.startsWith('lnk-'))confirm2(b,'',()=>{const id=b.dataset.del.slice(4);C.links=C.links.filter(l=>l.id!==id);saveClient();renderLinks()})});
$('lnkList').addEventListener('change',e=>{const id=e.target.dataset.la;if(!id)return;const l=C.links.find(x=>x.id===id);if(l){l.acct=e.target.value;saveClient()}});
function autoMap(g){const res=[];for(const r of g.body){const date=toISO(r[g.date]||'',g.order);if(!date)continue;let c;
  if(g.amt>=0)c=toCents(r[g.amt]);else{const o=toCents(r[g.out]),i=toCents(r[g.inn]);if(o===null&&i===null)continue;c=(i?Math.abs(i):0)-(o?Math.abs(o):0)}
  if(!c)continue;res.push({date,desc:[r[g.desc]].filter(Boolean).join(' '),amt:c})}return res}
$('lnkFile').onchange=async e=>{const files=[...e.target.files];e.target.value='';const l=(C.links||[]).find(x=>x.id===lnkTarget);if(!l)return;
  const say=t=>$('lnkMsg').textContent=t;let all=[];
  for(const f of files){try{if(/\.pdf$/i.test(f.name)){all=all.concat(await pdfTx(f,say))}
      else{const rows=await rowsOf(f);if(rows.length>1)all=all.concat(autoMap(guess(rows)))}}catch(err){console.error(err);say(`Lecture impossible de ${f.name} : ${err.message||err}.`)}}
  if(!all.length){say('Aucune transaction reconnue dans ces relevés.');return}
  const have=new Set((l.tx||[]).map(x=>x.join('|')));let n=0;
  all.forEach(x=>{const row=[x.date,x.amt,norm(x.desc).slice(0,40)];if(!have.has(row.join('|'))){l.tx=[...(l.tx||[]),row];have.add(row.join('|'));n++}});
  l.tx.sort((a,b)=>a[0].localeCompare(b[0]));saveClient();renderLinks();
  const m=P?matchLinks(P.tx).n:0;if(m){render();savePer()}
  say(`${n} transaction(s) ajoutée(s) pour « ${l.nom} ».${m?` ${m} virement(s) de la période ouverte apparié(s).`:''}`)};
$('lnkRun').onclick=()=>{if(!P||!P.tx.length){$('lnkMsg').textContent='Ouvrez d’abord une période dans Révision.';return}
  const r=matchLinks(P.tx);if(r.n){render();savePer()}
  if(r.n){$('lnkMsg').textContent=`${r.n} virement(s) apparié(s) : `+Object.entries(r.by).map(([k,v])=>`${k} ${fmt(v)}`).join(', ')+'.';return}
  $('lnkMsg').textContent=diag()};
function diag(){const L=C.links||[],ds=P.tx.map(t=>t.date).sort(),from=ds[0],to=ds[ds.length-1];
  const per=P.multi?`${moisLbl(P.mois)} à ${moisLbl(P.to)}`:moisLbl(P.mois);
  const done=P.tx.filter(t=>t.st==='apparie').length;
  const cand=P.tx.filter(t=>t.st!=='manuel'&&t.st!=='apparie'&&(t.st==='transit'||AMBIG.test(norm(t.desc))));
  const lt=L.flatMap(l=>(l.tx||[]).map(x=>({l,d:x[0],a:x[1]})));
  const inR=lt.filter(x=>x.d>=from&&dd(x.d,from)>=-6&&x.d<=to||dd(x.d,to)<=5);
  const near=lt.filter(x=>x.d>=from&&x.d<=to);
  const sameSign=cand.filter(t=>lt.some(x=>x.a===t.amt&&dd(x.d,t.date)<=5)).length;
  const farDate=cand.filter(t=>lt.some(x=>x.a===-t.amt&&dd(x.d,t.date)>5&&dd(x.d,t.date)<=31)).length;
  const p=[`Aucun nouveau virement apparié dans ${per}.`];
  if(done)p.push(`${done} virement(s) étaient déjà appariés.`);
  if(!lt.length)p.push('Aucun relevé n’a encore été versé dans les comptes liés : cliquez sur « Verser des relevés ».');
  else if(!near.length)p.push(`Les relevés des comptes liés ne couvrent pas cette période (ils vont du ${lt.map(x=>x.d).sort()[0]} au ${lt.map(x=>x.d).sort().pop()}). Ouvrez la bonne période, ou « Plusieurs mois » dans Révision.`);
  else p.push(`${near.length} transaction(s) des comptes liés tombent dans cette période, et ${cand.length} virement(s) du client restent à identifier.`);
  if(sameSign)p.push(`${sameSign} montant(s) correspondent mais avec le même signe : le relevé lié a peut-être ses retraits et dépôts inversés. Retirez-le et reversez-le, ou envoyez-moi une capture.`);
  if(farDate)p.push(`${farDate} montant(s) correspondent à plus de 5 jours d’écart : vérifiez-les à la main.`);
  if(cand.length&&lt.length&&!sameSign&&!farDate&&near.length)p.push('Aucun montant identique : les virements ont peut-être été faits en plusieurs fois, ou vers un compte qui n’est pas encore lié.');
  return p.join(' ')}

/* ---------- discussion avec l'IA ---------- */
let PROP=null;
function renderChat(){const L=C.chat||[];
  $('chatLog').innerHTML=(L.length?L:[{who:'ai',text:'Dites-moi qui est le propriétaire, les employés, le locateur, les clients réguliers… Je créerai les règles pour ce dossier.'}]).map(m=>`<div class="bub ${m.who==='me'?'me':'ai'}">${esc(m.text)}</div>`).join('')+(PROP?propHtml():'');
  $('chatLog').scrollTop=1e6;$('chatPanel').hidden=!!window.ASSISTANT&&!!sampleFn;$('chatGo').disabled=!sampleFn;if(!sampleFn)$('chatMsg').textContent='L’IA n’est pas disponible dans cette vue.'}
function propHtml(){const p=PROP;let h='<div class="bub ai"><strong>Proposition</strong><div class="prop">';
  p.nc.forEach((a,i)=>h+=`<label><input type="checkbox" data-nc="${i}" checked> Nouveau compte ${esc(a.numero)} ${esc(a.nom)} (à créer aussi dans Sage)</label>`);
  p.rg.forEach((x,i)=>h+=`<label><input type="checkbox" data-rg="${i}" checked> « ${esc(x.p)} »${x.s!=='les deux'?` (${x.s==='sortie'?'sorties':'entrées'})`:''} → ${esc(x.a)} ${esc(PLAN.find(q=>q[0]===x.a)?.[1]||p.nc.find(n=>n.numero===x.a)?.nom||'')}${x.t?', taxable':''}${x.d?` à partir du ${esc(x.d)}`:''} <span class="why">· ${x.n} transaction(s) ce mois-ci</span></label>`);
  if(p.note)h+=`<label><input type="checkbox" data-note checked> Retenir dans les notes : ${esc(p.note)}</label>`;
  return h+'</div><div class="row" style="margin-top:8px"><button type="button" class="sm pri" id="propOk">Appliquer</button><button type="button" class="sm" id="propNo">Ignorer</button></div></div>'}
$('chatLog').addEventListener('click',e=>{if(e.target.id==='propNo'){PROP=null;renderChat()}if(e.target.id!=='propOk'||!PROP)return;
  const box=$('chatLog'),on=sel=>box.querySelector(sel)?.checked;const p=PROP;PROP=null;let nr=0,nm=0;
  p.nc.forEach((a,i)=>{if(on(`[data-nc="${i}"]`)&&!PLAN.some(x=>x[0]===a.numero))addAccount(a.numero,a.nom)});
  const added=[];p.rg.forEach((x,i)=>{if(!on(`[data-rg="${i}"]`)||!PLAN.some(q=>q[0]===x.a))return;C.rules=(C.rules||[]).filter(r=>!(r.p===x.p&&(r.s||'les deux')===x.s&&(r.d||'')===(x.d||'')));C.rules.push(x.d?{p:x.p,a:x.a,t:x.t,s:x.s,d:x.d}:{p:x.p,a:x.a,t:x.t,s:x.s});added.push(x);nr++});
  if(p.note&&on('[data-note]'))C.notes=((C.notes||'')+'\n'+p.note).trim();
  if(P)P.tx.forEach(t=>{if((t.st==='transit'||t.st==='suggere'||t.st==='auto')&&added.some(x=>has(norm(t.desc),x.p))){const o=t.acct+t.tax;t.st='transit';classify(t);if(t.st==='auto'&&t.acct+t.tax!==o)nm++}});LED=null;
  C.chat=[...(C.chat||[]),{who:'ai',text:`Appliqué : ${nr} règle(s)${nm?`, ${nm} transaction(s) reclassée(s) ce mois-ci`:''}.`}].slice(-20);
  saveClient();renderRules();renderSettings();renderChat();render();if(P&&P.tx.length)savePer()});
$('chatForm').onsubmit=async e=>{e.preventDefault();const text=$('chatIn').value.trim();if(!text||!sampleFn)return;
  if(window.ASSISTANT){$('chatIn').value='';window.ASSISTANT.demander(text);return}
  C.chat=[...(C.chat||[]),{who:'me',text}].slice(-20);$('chatIn').value='';PROP=null;renderChat();$('chatGo').disabled=true;$('chatMsg').textContent='L’IA réfléchit…';
  const descs=[...new Map((P?P.tx:[]).map(t=>[t.desc,t])).values()].slice(0,120).map(t=>`${t.desc} | ${(t.amt/100).toFixed(2)}`).join('\n');
  try{const r=await sampleFn.json(`Tu es l'assistant de tenue de livres d'un cabinet comptable québécois pour le client « ${C.nom} ».
Plan comptable :\n${PLAN.map(p=>p.join(' ')).join('\n')}
Règles actuelles : ${(C.rules||[]).map(r=>`${r.p}→${r.a}${r.t?' taxable':''}${r.d?' depuis '+r.d:''}${r.s&&r.s!=='les deux'?' ('+r.s+')':''}`).join(' ; ')||'aucune'}
Notes : ${C.notes||'aucune'}
Descriptions bancaires de la période ouverte (description | montant, négatif = sortie) :\n${descs||'(aucune)'}
Conversation récente :\n${(C.chat||[]).slice(-8,-1).map(m=>(m.who==='me'?'Comptable : ':'IA : ')+m.text).join('\n')}

Message du comptable : ${text}

Transforme ses explications en règles de classement. Une règle = motif (mots en MAJUSCULES sans accents tels qu'ils apparaissent dans les descriptions bancaires, le plus précis possible, ex. « FARAZ » ou « MARIE ROY » ; regarde comment les noms sont écrits dans les descriptions ci-dessus), compte (numéro exact du plan), sens ("sortie", "entree" ou "les deux"), taxable (true/false ; un particulier non inscrit = false), depuis (date AAAA-MM-JJ à partir de laquelle la règle s'applique, ex. « Marta charge les taxes depuis janvier » → même motif et compte, taxable true, depuis la date ; sinon omets-le ; une règle avec date a priorité sur la même règle sans date). Si aucun compte du plan ne convient (ex. avance à l'actionnaire, prêt de l'actionnaire), propose-le dans nouveaux_comptes avec un numéro libre cohérent avec le plan et utilise ce numéro dans la règle. Si les descriptions ne contiennent pas les noms (ex. seulement « VIREMENT INTERAC »), dis-le clairement : la règle ne pourra pas les attraper. note = un fait durable sur le client à retenir (une phrase) ou "". reponse = 1 à 3 phrases en français québécois simple, sans répéter la liste des règles.
Réponds uniquement en JSON : {"reponse":"...","regles":[{"motif":"FARAZ","compte":"2650","sens":"les deux","taxable":false,"depuis":null}],"nouveaux_comptes":[{"numero":"2650","nom":"Avances de l'actionnaire"}],"note":"..."}`,{modelTier:'complex'});
    const nc=(Array.isArray(r?.nouveaux_comptes)?r.nouveaux_comptes:[]).map(a=>({numero:String(a.numero||'').trim(),nom:String(a.nom||'').trim().slice(0,60)})).filter(a=>/^[0-9A-Za-z-]{3,12}$/.test(a.numero)&&a.nom);
    const valid=new Set([...PLAN.map(p=>p[0]),...nc.map(a=>a.numero)]);
    const rg=(Array.isArray(r?.regles)?r.regles:[]).map(x=>{const p=norm(x.motif).replace(/[^A-Z0-9 &'-]/g,' ').replace(/\s+/g,' ').trim();const s=x.sens==='sortie'||x.sens==='entree'?x.sens:'les deux';
      const dd_=toISO(String(x.depuis||''))||'';return {p,a:String(x.compte||''),t:!!x.taxable,s,d:dd_,n:(P?P.tx:[]).filter(t=>has(norm(t.desc),p)&&(!dd_||t.date>=dd_)&&(s==='les deux'||(s==='sortie'?t.amt<0:t.amt>0))).length}}).filter(x=>x.p.length>=3&&valid.has(x.a));
    const note=String(r?.note||'').trim().slice(0,300);
    C.chat=[...C.chat,{who:'ai',text:String(r?.reponse||'Voici ce que je propose.').slice(0,800)}].slice(-20);
    PROP=(rg.length||note||nc.length)?{rg,nc:nc.filter(a=>rg.some(x=>x.a===a.numero)&&!PLAN.some(p=>p[0]===a.numero)),note}:null;
    $('chatMsg').textContent='';saveClient();
  }catch(err){C.chat=[...C.chat,{who:'ai',text:err.code==='rate_limited'?'Trop de demandes, réessayez dans une minute.':'Je n’ai pas pu répondre pour le moment.'}];$('chatMsg').textContent=''}
  $('chatGo').disabled=false;renderChat()};
$('chatIn').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))$('chatForm').requestSubmit()});

/* ---------- effacer ---------- */
const arm={};function confirm2(btn,label,fn){if(arm[btn.id||btn.dataset.del]){delete arm[btn.id||btn.dataset.del];fn();return}
  const k=btn.id||btn.dataset.del;arm[k]=1;const old=btn.textContent;btn.textContent='Cliquez encore pour confirmer';setTimeout(()=>{if(arm[k]){delete arm[k];btn.textContent=old}},5000)}
async function delPeriod(pid){if(monthLocked(pid.slice(0,7))){msg('Ce mois touche un exercice fermé : rouvrez l’exercice pour le modifier.',true);throw new Error('lock')}if(local){delete LOCAL.periodes[C.id+'/'+pid];return}await pWriting;await db.collection('clients').doc(C.id).collection('periodes').doc(pid).delete()}
$('pRev').onclick=()=>{if(!P)return;if(P.revise){if(!confirm('Retirer la révision de ce mois?'))return;audit('Révision retirée',`${moisLbl(P.mois)} · ${P.src}`);P.revise=null}
  else{const ouv=P.tx.filter(aCl).length;if(ouv&&!confirm(`${ouv} transaction(s) encore à classer. Marquer le mois révisé quand même?`))return;P.revise={le:new Date().toISOString(),par:(document.getElementById('whoE')?.textContent||'').trim()};audit('Mois révisé',`${moisLbl(P.mois)} · ${P.src} ${accName(P.src)}`)}
  savePer();revUI()};
$('pClear').onclick=e=>confirm2(e.currentTarget,'',async()=>{if(!P)return;clearTimeout(pTimer);pTimer=null;const pid=P.mois+'_'+P.src;
  try{audit('Période vidée',`${moisLbl(P.mois)} · ${P.src} ${accName(P.src)} · ${P.tx.length} transaction(s) retirée(s)`);await delPeriod(pid);P.tx=[];P.statut='en cours';AIITEMS=[];idFilter=null;render();msg(`Période ${moisLbl(P.mois)} vidée. Vous pouvez redéposer le relevé.`);setSave('Enregistré')}catch(err){msg('Effacement impossible pour le moment.',true)}
  $('pClear').textContent='Vider cette période'});
$('plist').addEventListener('click',e=>{const b=e.target.closest('button[data-del]');if(!b)return;e.stopPropagation();
  confirm2(b,'',async()=>{try{await delPeriod(b.dataset.del);if(P&&P.mois+'_'+P.src===b.dataset.del){P.tx=[];P.statut='en cours';render()}loadPeriods()}catch(err){b.textContent='Erreur'}})},true);
$('wipe').onclick=e=>confirm2(e.currentTarget,'',async()=>{if((C.ex||[]).some(x=>x.statut==='ferme')){$('wipeMsg').textContent='Des exercices sont fermés : rouvrez-les avant de tout effacer.';return}clearTimeout(pTimer);pTimer=null;$('wipeMsg').textContent='Effacement…';
  try{let ids=[];if(local)ids=Object.keys(LOCAL.periodes).filter(k=>k.startsWith(C.id+'/')).map(k=>k.slice(C.id.length+1));
    else{const sn=await db.collection('clients').doc(C.id).collection('periodes').get();ids=sn.docs.map(d=>d.id)}
    for(const id of ids)await delPeriod(id);
    if($('wipeRules').checked)C.rules=[];C.last='';saveClient();renderRules();
    if(P){P.tx=[];P.statut='en cours'}AIITEMS=[];idFilter=null;render();
    $('wipeMsg').textContent=`${ids.length} période(s) effacée(s).${$('wipeRules').checked?' Règles apprises effacées.':''} Le dossier repart à zéro.`}
  catch(err){$('wipeMsg').textContent='Effacement impossible pour le moment.'}
  $('wipe').textContent='Effacer toutes les périodes'});

/* ---------- fin de période ---------- */
function openFinish(){if(!P||!P.tx.length)return;P.chk=P.chk||{};const K=P.chk;
  const un=usedNew(),todo=P.tx.filter(t=>t.st==='transit').length,sug=P.tx.filter(t=>t.st==='suggere').length,iss=exportIssues(P.tx,P.src);
  const ds=P.tx.map(t=>t.date).sort(),minD=ds[0],maxD=ds[ds.length-1];const[exD,exF]=exRange();const usesTr=P.tx.some(t=>t.acct===C.tr);
  $('finT').textContent=`Terminer ${P.multi&&P.to!==P.mois?moisLbl(P.mois)+' – '+moisLbl(P.to):moisLbl(P.mois)} · ${C.nom}`;
  const I=[];const it=(sec,id,auto,html)=>I.push({sec,id,auto,html});
  it('Dans l’application','plan',Array.isArray(C.sage)&&C.sage.length?true:null,`Plan comptable versé à partir du dossier Sage de ce client${Array.isArray(C.sage)&&C.sage.length?'':' <span class="why">(onglet Plan comptable)</span>'}`);
  it('Dans l’application','ex',null,exD?`Exercice <strong>${esc(exD)} au ${esc(exF)}</strong>, le même que dans Sage`:`Exercice entré dans Paramètres <span class="bad-b">(manquant)</span>`);
  it('Dans l’application','fmt',C.dfmt==='yy'||C.dfmt==='yyyy',C.dfmt==='yy'||C.dfmt==='yyyy'?'Format de date de l’import : <strong>mm-jj-aa</strong>':'Format de date : <span class="bad-b">doit être mm-jj-aa</span> <button type="button" class="sm" id="finFmt">Corriger</button>');
  it('Dans l’application','rev',!todo&&!sug?true:null,!todo&&!sug?'Révision terminée : rien au transitoire':`Il reste ${todo} transaction(s) au transitoire${sug?` et ${sug} suggestion(s) de l'IA`:''}. Cochez si c'est voulu (elles iront au ${esc(C.tr)}).`);
  it('Dans l’application','iss',!iss.length,!iss.length?'Aucune écriture que Sage refuserait':`<span class="bad-b">Sage refusera ${iss.length} écriture(s)</span> : ${iss.slice(0,4).map(esc).join(' ; ')}${iss.length>4?' …':''}`);
  it('Dans Sage','ses',null,`Date de session au moins le <strong>${esc(maxD)}</strong> <span class="why">(Configuration &gt; Paramètres &gt; Entreprise &gt; Informations)</span>`);
  it('Dans Sage','old',null,`Transaction la plus ancienne au plus tard le <strong>${esc(minD)}</strong>`);
  it('Dans Sage','exs',null,exD?`Début et fin d'exercice : <strong>${esc(exD)} au ${esc(exF)}</strong>`:'Début et fin d’exercice vérifiés');
  if(un.length)it('Dans Sage','acc',false,`<span class="bad-b">Créer ces comptes</span> avec le même numéro, comme comptes de détail : ${un.map(([n,t])=>esc(n+' '+t)).join(', ')} <button type="button" class="sm" id="finAcc">C'est fait</button>`);
  else it('Dans Sage','acc',true,'Aucun nouveau compte à créer');
  if(usesTr)it('Dans Sage','tr',null,`Le compte transitoire <strong>${esc(C.tr)} ${esc(accName(C.tr))}</strong> existe et est un compte de détail (pas un titre ni un total)`);
  it('Dans Sage','bak',null,'Sauvegarde faite (Fichier &gt; Sauvegarde)');
  it('Import','dl',K.dl?true:null,`Fichier téléchargé <strong>maintenant</strong> (${P.tx.length} écritures), pas un ancien fichier`);
  it('Import','imp',null,'Importé dans Sage (Fichier &gt; Importation/Exportation &gt; Importer des transactions &gt; journal général) et le sommaire indique <strong>« Transactions non lues : 0 »</strong>');
  it('Import','done',P.statut==='importée'?true:null,P.statut==='importée'?`Période marquée comme importée${P.exported?' le '+esc(P.exported):''}`:'Période marquée comme importée <button type="button" class="sm" id="finDone">Marquer maintenant</button>');
  const isOk=x=>x.auto===true||(x.auto===null&&K[x.id]);const n=I.filter(isOk).length;let sec='';
  $('finL').innerHTML=`<li style="list-style:none;margin-left:-20px"><div class="bar"><i style="width:${n/I.length*100}%"></i></div><span class="note">${n} sur ${I.length} étapes faites</span></li>`+I.map(x=>{const h=x.sec!==sec?`<li style="list-style:none;margin:8px 0 0 -20px;font-weight:800">${x.sec}</li>`:'';sec=x.sec;
    return h+`<li style="list-style:none;margin-left:-20px"><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" data-ck="${x.id}" ${isOk(x)?'checked':''} ${x.auto!==null?'disabled':''} style="margin-top:2px"><span>${x.html}${x.auto===true?' <span class="ok-b">✓ vérifié</span>':''}</span></label></li>`}).join('');
  $('finL').querySelectorAll('[data-ck]').forEach(c=>c.onchange=()=>{K[c.dataset.ck]=c.checked;savePer();openFinish()});
  $('finMsg').textContent=n<I.length?`Il reste ${I.length-n} étape(s) avant un import sans erreur.`:'Tout est prêt.';$('finDl').hidden=!downloads;
  if($('finAcc'))$('finAcc').onclick=()=>{un.forEach(([n])=>{if(!C.sage.includes(n))C.sage.push(n)});saveClient();render();openFinish()};
  if($('finFmt'))$('finFmt').onclick=()=>{C.dfmt='yy';saveClient();renderSettings();render();openFinish()};
  if($('finDone'))$('finDone').onclick=()=>{$('markDone').click();openFinish()};
  if(!$('finDlg').open){try{$('finDlg').showModal()}catch(e){$('finDlg').setAttribute('open','')}}}
$('finish').onclick=openFinish;$('finX').onclick=()=>$('finDlg').close();
$('finDl').onclick=async()=>{try{await downloads.save({filename:`${C.nom.replace(/[^\w-]+/g,'_')}_${P.mois}_${P.src}_sage50.txt`,data:sageBytes(buildFile())});P.chk=P.chk||{};P.chk.dl=1;savePer();openFinish();$('finMsg').textContent='Fichier enregistré.'}catch(e){$('finMsg').textContent='Téléchargement annulé ou refusé.'}};
$('finCp').onclick=async()=>{try{await navigator.clipboard.writeText(buildFile());P.chk=P.chk||{};P.chk.dl=1;savePer();openFinish();$('finMsg').textContent='Copié. Collez-le dans un fichier .txt (encodage ANSI).'}catch(e){$('finMsg').textContent='Copie refusée par le navigateur.'}};
let wasTodo=0;

/* ---------- export ---------- */
$('cp').onclick=async()=>{try{await navigator.clipboard.writeText(buildFile());$('exMsg').textContent='Copié. Collez-le dans un fichier .txt pour l’importer dans Sage.'}catch(e){$('exMsg').textContent='Copie refusée par le navigateur.'}};
$('dl').onclick=async()=>{try{await downloads.save({filename:`${C.nom.replace(/[^\w-]+/g,'_')}_${P.mois}_${P.src}_sage50.txt`,data:sageBytes(buildFile())});$('exMsg').textContent='Fichier enregistré.'}catch(e){$('exMsg').textContent='Téléchargement annulé ou refusé.'}};
$('markDone').onclick=()=>{const day=new Date().toLocaleDateString('fr-CA');P.statut='importée';P.exported=day;if(P.multi)P.parts.forEach(p=>{if(P.tx.some(t=>t._m===p.mois)){p.statut='importée';p.exported=day}});renderExport();savePer()};

/* ---------- plan comptable ---------- */
function planFromRows(rows){const out=[];for(const r of rows){const i=r.findIndex(x=>/^\d{3,8}(-\d{1,4})?$/.test(String(x).trim()));if(i<0)continue;
  const name=r.slice(i+1).map(x=>String(x).trim()).find(x=>x&&!/^[\d.,\s-]+$/.test(x));if(name)out.push(String(r[i]).trim()+' '+name)}return out}
async function handlePlan(files){const f=files[0];if(!f)return;$('planMsg').textContent='Lecture…';
  try{let lines=[];
    if(/\.pdf$/i.test(f.name)){const pages=await pdfPages(f);lines=pages.join('\n').split('\n').map(l=>l.match(/^\s*(\d{3,8}(?:-\d{1,4})?)\s+[-–]?\s*(.+?)\s*$/)).filter(Boolean).map(m=>m[1]+' '+m[2].replace(/\s+(Actif|Passif|Capital|Revenu|Dépense|Charge|Total|Sous-total|Groupe|Compte)(\s.*)?$/i,'').trim())}
    else lines=planFromRows(await rowsOf(f));
    const seen=new Set();lines=lines.filter(l=>{const k=l.split(' ')[0];if(seen.has(k))return false;seen.add(k);return true});
    if(!lines.length){$('planMsg').textContent='Aucun compte reconnu dans ce fichier. Collez la liste à la main.';return}
    $('planTxt').value=lines.join('\n');planFromFile=true;$('planMsg').textContent=`${lines.length} comptes reconnus. Vérifiez puis cliquez sur « Enregistrer le plan ».`;
  }catch(e){$('planMsg').textContent='Lecture impossible de ce fichier.'}}
$('planFile').onchange=e=>{handlePlan([...e.target.files]);e.target.value=''};dropzone($('planDrop'),handlePlan);
$('planBase').onclick=()=>{const cur=parsePlanText($('planTxt').value),have=new Set(cur.map(p=>p[0])),names=new Set(cur.map(p=>norm(p[1])));
  const add=parsePlanText(DEF_PLAN).filter(([n,t])=>!have.has(n)&&!names.has(norm(t))&&!isHeader(n,t));const clash=parsePlanText(DEF_PLAN).filter(([n,t])=>have.has(n)&&!names.has(norm(t))&&!isHeader(n,t));
  if(!add.length){$('planMsg').textContent='Rien à ajouter : le plan contient déjà tous les comptes du plan de base.';return}
  $('planTxt').value=$('planTxt').value.replace(/\s*$/,'')+'\n'+add.map(p=>p.join(' ')).join('\n');$('planMsg').textContent=`${add.length} compte(s) ajouté(s) à la liste${clash.length?` (${clash.length} sauté(s) parce que leur numéro est déjà pris)`:''}. Vérifiez, puis cliquez sur Enregistrer le plan.`};
$('planSave').onclick=()=>{const before=PLAN.map(p=>p[0]);C.plan=$('planTxt').value;
  if(planFromFile)C.sage=parsePlanText(C.plan).map(p=>p[0]);else if(!Array.isArray(C.sage))C.sage=before;planFromFile=false;const sp=detectSpecial({...C,tr:'',tpsA:'',tvqA:'',tpsV:'',tvqV:''});
  for(const k of Object.keys(sp))if(sp[k])C[k]=sp[k];setPlan();fillSelects();if(!srcAccounts().some(p=>p[0]===C.src)||/CAISSE/.test(norm(accName(C.src))))C.src=banqueDef();$('pSrc').value=C.src;
  reclass();saveClient();renderRules();renderSettings();render();if(P&&P.tx.length)savePer();
  const miss=['tr','tpsA','tvqA'].filter(k=>!C[k]);
  const nw=newAccts();
  $('planMsg').textContent=`Plan enregistré : ${PLAN.length} comptes.`+(nw.length&&C.sage50?` À créer dans Sage avant l'import : ${nw.map(p=>p.join(' ')).join(', ')}.`:'')+(miss.length?' Choisissez le compte transitoire et les comptes de taxes dans Paramètres.':` Transitoire ${C.tr}, CTI ${C.tpsA}, RTI ${C.tvqA}.`);
  $('cSub').textContent=`${PLAN.length} comptes au plan · ${(C.rules||[]).length} règles apprises · transitoire ${C.tr||'non défini'}`}

/* ---------- règles et paramètres ---------- */
function renderRules(){const R=C.rules||[];$('rCount').textContent=R.length;
  $('rules').innerHTML=R.length?R.map((r,i)=>[r,i]).sort((a,b)=>a[0].p.localeCompare(b[0].p)).map(([r,i])=>`<tr><td>${esc(r.p)}</td><td>${esc(r.a)} ${esc(accName(r.a))}${r.s&&r.s!=='les deux'?` <span class="pill">${r.s==='sortie'?'sorties':'entrées'} seulement</span>`:''}${r.d?` <span class="pill">à partir du ${esc(r.d)}</span>`:''}</td><td>${r.t?'Oui':'Non'}</td><td><button class="sm" data-p="${esc(r.p)}" data-i="${i}">Retirer</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">Aucune encore. Elles s’ajoutent quand vous classez une transaction à la main.</td></tr>';
  $('baseRules').innerHTML=baseResolved().map(r=>`<tr><td>${esc(r.p)}</td><td>${r.a?esc(r.a+' '+accName(r.a)):'<span class="why">aucun compte correspondant</span>'}</td><td>${r.t?'Oui':'Non'}</td></tr>`).join('')}
$('rules').onclick=e=>{const b=e.target.closest('button');const p=b?.dataset.p;if(p==null)return;const i=b.dataset.i!=null?+b.dataset.i:C.rules.findIndex(r=>r.p===p);if(i>=0)C.rules.splice(i,1);saveClient();reclass();renderRules();render();savePer()};
$('rAdd').onclick=()=>{const p=norm($('rP').value);if(!p)return;C.rules=(C.rules||[]).filter(r=>r.p!==p);C.rules.push({p,a:$('rA').value,t:$('rT').checked});$('rP').value='';saveClient();reclass();renderRules();render();savePer()};
function renderSettings(){renderExList();$('sEmail').value=C.email||'';$('sExD').value=C.exDeb||'';$('sExF').value=C.exFin||'';$('sNom').value=C.nom;$('sNotes').value=C.notes||'';$('sDesc').value=C.desc||'';$('sTx').checked=(C.profil?.tx??FICHE?.tps_tvq)!==false;$('sEmp').checked=!!(C.profil?.emp??FICHE?.employeur);$('sDescSrc').textContent=FICHE?.description&&!C.desc?'Description reprise de la fiche du client dans Gestion du cabinet : '+FICHE.description.slice(0,160):'';$('sDf').value=C.dfmt||'yy';$('sSage').checked=!!C.sage50;$('sMeth').value=C.methode||'';$('sMethNote').textContent=METH[methodeEff()];renderDev();for(const[id,k]of[['sTr','tr'],['sTpsA','tpsA'],['sTvqA','tvqA'],['sTpsV','tpsV'],['sTvqV','tvqV']])$(id).value=C[k]||''}
$('sSage').onchange=()=>{C.sage50=$('sSage').checked;sageUI();saveClient()};
const sageUI=()=>document.body.classList.toggle('nosage',!C?.sage50);
function renderDev(){const SA=srcAccounts().filter(([n,t])=>!isHeader(n,t));const box=$('sDevBox');if(!box)return;
  box.innerHTML=`<div class="f" style="margin:0">Devise des comptes de banque, de cartes et de paiement</div><p class="note" style="margin:2px 0 6px">Un compte en dollars US se concilie en US$; le grand livre le convertit en $ CA au taux quotidien de la Banque du Canada, et la réévaluation de fin d’exercice est proposée dans les régularisations.</p>`+
  SA.map(([n,t])=>`<label class="row" style="gap:8px;align-items:center;margin:3px 0"><select data-dev="${esc(n)}" style="width:auto"><option value="CAD">$ CA</option><option value="USD"${devOf(n)==='USD'?' selected':''}>$ US</option></select> ${esc(n+' '+t)}</label>`).join('')}
document.addEventListener('change',e=>{const s_=e.target.closest('[data-dev]');if(!s_||!C)return;const a=s_.dataset.dev;C.dev={...(C.dev||{})};C.dev[a]=s_.value;audit('Devise du compte',`${a} : ${s_.value}`);LED=null;saveClient();$('sMethNote').textContent=METH[methodeEff()]});
$('sMeth').onchange=()=>{$('sMethNote').textContent=METH[$('sMeth').value||methodeEff()]};

$('sSave').onclick=()=>{if(curEx()?.statut==='ferme'&&($('sExD').value!==C.exDeb||$('sExF').value!==C.exFin)){$('sMsg').textContent='Exercice fermé : ses dates ne peuvent pas changer.';return}C.exDeb=$('sExD').value;C.exFin=$('sExF').value;syncEx();C.nom=$('sNom').value.trim()||C.nom;C.desc=$('sDesc').value.trim();C.profil={...(C.profil||{}),tx:$('sTx').checked,emp:$('sEmp').checked};C.notes=$('sNotes').value;C.methode=$('sMeth').value;if(C.methode==='adeposer')adepAssurer();C.email=$('sEmail').value.trim().slice(0,200);C.dfmt=$('sDf').value;for(const[id,k]of[['sTr','tr'],['sTpsA','tpsA'],['sTvqA','tvqA'],['sTpsV','tpsV'],['sTvqV','tvqV']])C[k]=$(id).value;
  $('cName').textContent=C.nom;reclass();saveClient();fillExSel();render();if(P&&P.tx.length)savePer();$('sMsg').textContent='Enregistré.'};
let delArm=false;$('delC').onclick=()=>{if(!delArm){delArm=true;$('delC').textContent='Cliquez encore pour confirmer';setTimeout(()=>{delArm=false;$('delC').textContent='Supprimer ce dossier'},5000);return}
  C.deleted=true;saveClient();const i=CLIENTS.findIndex(c=>c.id===C.id);if(i>=0)CLIENTS[i].deleted=true;$('back').click()};

/* ---------- exercices ---------- */
let MIS=null,mStep='acc',mSec='',mTimer=null;
const lk=d=>{if(!d||!C)return false;if((C.ex||[]).some(x=>x.statut==='ferme'&&d>=x.deb&&d<=x.fin))return true;if((C.ex||[]).some(x=>x.deverr&&d>=x.deb&&d<=x.fin))return false;if(C.lkAvant&&d<C.lkAvant)return true;
  return false};
function lkJournal(quoi){audit('Exercices',quoi);const qui=(document.getElementById('whoE')?.textContent||'').trim();C.lkLog=[...(C.lkLog||[]),{le:new Date().toISOString(),qui,quoi}].slice(-50)}
function renderLk(){if(!C)return;C.lk2=false;$('lkAv').value=C.lkAvant||'';const L=C.lkLog||[];
  $('lkLog').innerHTML=L.length?'<strong>Historique</strong><br>'+L.slice().reverse().slice(0,12).map(x=>`${esc(new Date(x.le).toLocaleString('fr-CA',{dateStyle:'medium',timeStyle:'short'}))}${x.qui?' · '+esc(x.qui):''} : ${esc(x.quoi)}`).join('<br>'):''}
const monthLocked=m=>!!C&&(C.ex||[]).some(x=>x.statut==='ferme'&&x.deb.slice(0,7)<=m&&x.fin.slice(0,7)>=m);
const curEx=()=>(C?.ex||[]).find(x=>x.id===C.exCur)||null;
const exOf=d=>(C?.ex||[]).find(x=>d>=x.deb&&d<=x.fin)?.id||'';
const exLbl=x=>x?`${x.deb} au ${x.fin}`:'';
const finOf=d=>{const x=new Date(d+'T12:00');x.setFullYear(x.getFullYear()+1);x.setDate(x.getDate()-1);return x.toISOString().slice(0,10)};
const dLong=d=>d?new Date(d+'T12:00').toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}):'[date]';
const reAcct=()=>bnrAcc()||'3560';
const isDiv=a=>String(a)[0]==='3'&&/DIVIDENDE/.test(norm(accName(a)));
function migrateEx(){if(!Array.isArray(C.ex))C.ex=[];
  if(!C.ex.length&&(C.exDeb||C.ouv)){const[d,f]=exRange();if(d)C.ex.push({id:d,deb:d,fin:f||finOf(d),statut:'ouvert',ouv:C.ouv||null})}
  C.ex.sort((a,b)=>a.deb.localeCompare(b.deb));
  if(!C.ex.some(x=>x.id===C.exCur))C.exCur=(C.ex.find(x=>x.statut!=='ferme')||C.ex[C.ex.length-1])?.id||''}
function syncEx(){if(!C.exDeb)return;let e=curEx();
  if(!e){e={id:C.exDeb,deb:C.exDeb,fin:C.exFin||finOf(C.exDeb),statut:'ouvert',ouv:C.ouv||null};C.ex=[...(C.ex||[]),e].sort((a,b)=>a.deb.localeCompare(b.deb));C.exCur=e.id}
  if(e.statut==='ferme')return;e.deb=C.exDeb;e.fin=C.exFin||finOf(C.exDeb);e.ouv=C.ouv||null}
function useEx(id,quiet){const e=(C.ex||[]).find(x=>x.id===id);if(e){C.exCur=e.id;C.exDeb=e.deb;C.exFin=e.fin;C.ouv=e.ouv||null}
  fillExSel();LED=null;MIS=null;if(quiet)return;saveClient();renderSettings();
  $('repFrom').value='';$('repTo').value='';
  const m=$('pMois').value;if(e&&(m<e.deb.slice(0,7)||m>e.fin.slice(0,7)))$('pMois').value=(C.last&&C.last<=e.fin.slice(0,7)&&C.last>=e.deb.slice(0,7))?C.last:e.fin.slice(0,7);
  setTab(tab);if(tab==='rev'&&mode==='m')openPeriod()}
function fillExSel(){const L=C.ex||[];
  $('exSel').innerHTML=L.length?L.map(x=>`<option value="${esc(x.id)}">${esc(exLbl(x))}${x.statut==='ferme'?' · fermé':''}</option>`).join(''):'<option value="">À définir dans Paramètres</option>';$('exSel').value=C.exCur||'';
  const e=curEx();$('exPill').hidden=!e;$('exPill').textContent=e?(e.statut==='ferme'?'Fermé : lecture seule':'Ouvert'):'';$('exPill').className='pill'+(e&&e.statut!=='ferme'?' ok':'');renderExList()}
function renderExList(){const L=C.ex||[];
  $('exList').innerHTML=L.length?L.map(x=>`<tr${x.id===C.exCur?' class="sel"':''}><td><strong>${esc(exLbl(x))}</strong></td><td>${x.statut==='ferme'?`<span class="pill">Fermé le ${esc((x.fermeLe||'').slice(0,10))}</span>`:x.deverr?'<span class="pill todo">Déverrouillé temporairement</span>':lkRegle(x)?'<span class="pill">Protégé</span>':'<span class="pill ok">Ouvert</span>'}</td><td>${x.ouv?`${Object.keys(x.ouv.s||{}).length} comptes au ${esc(x.ouv.date)}`:'—'}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">${x.id===C.exCur?'<span class="note">Affiché</span>':`<button class="sm" data-exgo="${esc(x.id)}">Afficher</button>`}${x.statut==='ferme'?`<button class="sm" data-exopen="${esc(x.id)}">Rouvrir…</button>`:x.deverr?`<button class="sm" data-exrelock="${esc(x.id)}">Reverrouiller</button>`:lkRegle(x)?`<button class="sm" data-exunlock="${esc(x.id)}">Déverrouiller…</button>`:''}</div></td></tr>`).join('')
    :'<tr><td colspan="4" class="empty">Indiquez le début et la fin de l’exercice ci-dessus, puis Enregistrer.</td></tr>';
  const e=curEx();$('yearEnd').hidden=!e||e.statut==='ferme';$('exReopen').hidden=!e||e.statut!=='ferme';renderLk();if(tab==='set')renderAudit()}
const lkRegle=x=>{if(x.statut==='ferme'||x.deverr)return false;const L=[...(C.ex||[])].sort((a,b)=>a.deb.localeCompare(b.deb));return!!(C.lkAvant&&x.deb<C.lkAvant)};
$('exList').addEventListener('click',e=>{const b=e.target.closest('[data-exopen],[data-exunlock],[data-exrelock]');if(!b)return;const id=b.dataset.exopen||b.dataset.exunlock||b.dataset.exrelock;const x=(C.ex||[]).find(y=>y.id===id);if(!x)return;
  if(b.dataset.exrelock){delete x.deverr;lkJournal(`Exercice ${exLbl(x)} reverrouillé`);saveClient();fillExSel();LED=null;return}
  const ferme=x.statut==='ferme';if(!confirm(`Voulez-vous vraiment ${ferme?'rouvrir':'déverrouiller'} l’exercice ${exLbl(x)}?\n\nSi la T2 de cet exercice a déjà été produite, une modification changera des chiffres déjà déclarés.${ferme?'\nAprès vos corrections, refermez-le pour mettre à jour les soldes d’ouverture de l’exercice suivant.':'\nIl restera modifiable jusqu’à ce que vous cliquiez « Reverrouiller ».'}`))return;
  if(ferme){x.statut='ouvert';delete x.fermeLe}else x.deverr=true;lkJournal(`Exercice ${exLbl(x)} ${ferme?'rouvert':'déverrouillé temporairement'}`);saveClient();fillExSel();LED=null;if(P)openPeriod()});
async function renderUsers(){const box=$('usrList');if(!box)return;if(!window.tlAdmin){$('usrPanel').hidden=true;return}
  const admin=estCPA();$('usrInv').hidden=!admin;
  try{const[M,I]=await Promise.all([window.tlAdmin.membres(),admin?window.tlAdmin.invitations():Promise.resolve([])]);const nA=M.filter(m=>m.role==='admin').length;
    box.innerHTML=M.map(m=>`<tr><td>${esc(m.email)}${m.email===window.tlMoi?' <span class="note">(vous)</span>':''}</td><td>${admin&&!(m.role==='admin'&&nA<2)?`<select data-urole="${esc(m.user_id)}"><option value="membre"${m.role!=='admin'?' selected':''}>Technicien</option><option value="admin"${m.role==='admin'?' selected':''}>CPA (administrateur)</option></select>`:m.role==='admin'?'CPA (administrateur)':'Technicien'}</td><td>${admin&&m.email!==window.tlMoi?`<button class="sm danger" data-uout="${esc(m.user_id)}" data-mail="${esc(m.email)}">Retirer l’accès</button>`:''}</td></tr>`).join('')+
      I.map(i=>`<tr><td>${esc(i.email)} <span class="pill todo">invitation en attente</span></td><td>${i.role==='admin'?'CPA (administrateur)':'Technicien'}</td><td><button class="sm" data-uinv="${esc(i.email)}">Annuler</button></td></tr>`).join('')}
  catch(e){box.innerHTML=`<tr><td colspan="3" class="empty">Lecture impossible : ${esc(e.message||e)}</td></tr>`}}
$('usrGo').onclick=async()=>{const m=$('usrMail').value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)){$('usrMsg').textContent='Courriel invalide.';return}
  try{await window.tlAdmin.inviter(m,$('usrRole').value);audit('Utilisateur invité',`${m} (${$('usrRole').value==='admin'?'CPA':'Technicien'})`);$('usrMail').value='';$('usrMsg').textContent=`✓ ${m} invité.`;renderUsers()}catch(e){$('usrMsg').textContent='Invitation impossible : '+e.message}};
$('usrList').addEventListener('change',async e=>{const u=e.target.dataset.urole;if(!u)return;try{await window.tlAdmin.role(u,e.target.value);audit('Rôle modifié',`${e.target.closest('tr').cells[0].textContent} → ${e.target.value==='admin'?'CPA':'Technicien'}`);$('usrMsg').textContent='✓ Rôle modifié (effectif à sa prochaine connexion).';renderUsers()}catch(x){$('usrMsg').textContent='Modification impossible : '+x.message}});
$('usrList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.uout){if(!confirm(`Retirer l’accès de ${b.dataset.mail} à l’intranet?`))return;try{await window.tlAdmin.retirer(b.dataset.uout);audit('Accès retiré',b.dataset.mail);renderUsers()}catch(x){$('usrMsg').textContent=x.message}}
  if(b.dataset.uinv){try{await window.tlAdmin.annuler(b.dataset.uinv);renderUsers()}catch(x){$('usrMsg').textContent=x.message}}});
$('audQ').oninput=()=>renderAudit();
$('audCsv').onclick=async()=>{if(!downloads)return;const q=x=>`"${String(x||'').replace(/"/g,'""')}"`;const csv='\ufeffQuand;Qui;Quoi;Détail\r\n'+AUDL.map(e=>[e.le,e.qui,e.quoi,e.detail].map(q).join(';')).join('\r\n');try{await downloads.save({filename:`${C.nom.replace(/[^\w-]+/g,'_')}_piste_de_verification.csv`,data:new TextEncoder().encode(csv)})}catch(e){}};
$('lkSave').onclick=()=>{const v2=false,av=$('lkAv').value||'';const moins=(!v2&&C.lk2)||(av!==(C.lkAvant||'')&&(!av||(C.lkAvant&&av<C.lkAvant)));
  const raison='';if(moins&&!confirm('Vous réduisez la protection : des exercices déjà produits redeviendront modifiables. Continuer?')){renderLk();return}
  const avant=C.lkAvant?'avant le '+C.lkAvant:'sans date';C.lk2=v2;C.lkAvant=av;
  lkJournal(`Date de verrouillage : ${avant} → ${av?'avant le '+av:'aucune'}`);saveClient();fillExSel();LED=null;if(P)openPeriod();$('lkMsg').textContent='✓ Protection enregistrée.'};
$('exSel').onchange=()=>{if(P)savePerNow();useEx($('exSel').value)};
$('exList').addEventListener('click',e=>{const b=e.target.closest('[data-exgo]');if(b){if(P)savePerNow();useEx(b.dataset.exgo)}});
function tbFor(E,x,o={}){const m=new Map(),add=(a,c)=>m.set(a,(m.get(a)||0)+c),re=reAcct(),ouv=x.ouv;
  if(ouv)Object.entries(ouv.s||{}).forEach(([a,c])=>add(+String(a)[0]>=4?re:a,c));
  E.forEach(e=>{if(e.date>x.fin)return;if(ouv&&e.date<ouv.date)return;if(o.noAje&&e.aje&&e.date>=x.deb)return;
    e.lines.forEach(([a,c])=>add(+String(a)[0]>=4&&e.date<x.deb?re:a,c))});
  return m}
$('yearEnd').onclick=e=>{confirm2(e.currentTarget,'',async()=>{await fermerEx(curEx());$('yearEnd').textContent='Fermer l’exercice affiché'})};
async function fermerEx(x,garder){if(!x){$('yeMsg').textContent='Indiquez d’abord les dates de l’exercice.';return}
  if(P)savePerNow();$('yeMsg').textContent='Calcul des soldes de clôture…';
  try{LED=null;const E=await loadLedger();const todo=E.filter(t=>t.todo&&t.date>=x.deb&&t.date<=x.fin).length;
    const B=tbFor(E,x),re=reAcct(),s={};B.forEach((c,a)=>{if(!c)return;const k=(+String(a)[0]>=4||isDiv(a))?re:a;s[k]=(s[k]||0)+c});Object.keys(s).forEach(k=>{if(!s[k])delete s[k]});
    x.statut='ferme';x.fermeLe=new Date().toISOString();x.cloture={date:x.fin,s};lkJournal(`Exercice ${exLbl(x)} fermé`);
    const nd=addDays(x.fin,1);let n=C.ex.find(y=>y.deb===nd);
    if(!n){n={id:nd,deb:nd,fin:finOf(nd),statut:'ouvert',ouv:null};C.ex.push(n);C.ex.sort((a,b)=>a.deb.localeCompare(b.deb))}
    const upd=n.statut!=='ferme';if(upd)n.ouv={date:nd,s};
    saveClient();if(!garder)useEx(n.id);
    $('yeMsg').textContent=`Exercice ${exLbl(x)} fermé et verrouillé. Exercice affiché : ${exLbl(n)}.`+(upd?` Soldes d’ouverture figés (${Object.keys(s).length} comptes).`:' L’exercice suivant est fermé : rouvrez-le pour mettre à jour ses soldes d’ouverture.')+(todo?` Attention : ${todo} transaction(s) étaient encore au compte transitoire.`:'')+` Pour garder une copie de l’exercice fermé : Archive et export › choisissez « ${exLbl(x)} ».`;C.arcSugg=x.id}
  catch(err){$('yeMsg').textContent='Calcul impossible.'}}
$('exReopen').onclick=e=>confirm2(e.currentTarget,'',()=>{const x=curEx();if(!x)return;if(!confirm(`Voulez-vous vraiment rouvrir l’exercice ${exLbl(x)}?\n\nSi la T2 a déjà été produite, une modification changera des chiffres déjà déclarés.`))return;lkJournal(`Exercice ${exLbl(x)} rouvert`);x.statut='ouvert';delete x.fermeLe;saveClient();useEx(x.id);
  $('yeMsg').textContent=`Exercice ${exLbl(x)} rouvert. Après vos corrections, refermez-le pour mettre à jour les soldes d’ouverture de l’exercice suivant.`;$('exReopen').textContent='Rouvrir l’exercice affiché'});
$('exNew').onclick=async()=>{const L=C.ex||[],last=L[L.length-1];if(!last){$('yeMsg').textContent='Indiquez d’abord le début et la fin du premier exercice ci-dessus.';return}
  const vieux=L.slice(0,-1).filter(x=>x.statut!=='ferme');
  if(last.statut!=='ferme'&&confirm(`Avant d’ouvrir le nouvel exercice : la T2 de l’exercice ${exLbl(last)} est-elle produite?${vieux.length?`\n\nÀ noter : ${vieux.map(exLbl).join(', ')} ${vieux.length>1?'sont':'est'} aussi encore ouvert${vieux.length>1?'s':''}. Si leur T2 est produite, fermez-les dans l’ordre (le plus ancien d’abord).`:''}\n\nOK = fermer cet exercice maintenant (ses soldes de clôture deviennent les soldes d’ouverture du nouvel exercice).\nAnnuler = le laisser ouvert pour l’instant.`)){await fermerEx(last);return}
  const d=addDays(last.fin,1);const n={id:d,deb:d,fin:finOf(d),statut:'ouvert',ouv:null};C.ex.push(n);saveClient();useEx(n.id);$('yeMsg').textContent=`Exercice ${exLbl(n)} ajouté. Fermez le précédent pour reporter ses soldes.`};
function snapLock(){if(P)P._lk=P.tx.filter(t=>lk(t.date)).map(t=>({...t}))}
function enforceLock(p){if(!p||!p._lk)return;const snap=new Map(p._lk.map(t=>[t.id,t])),seen=new Set(),out=[];let ch=false;
  p.tx.forEach(t=>{if(!lk(t.date)){out.push(t);return}const o=snap.get(t.id);if(!o){ch=true;return}seen.add(t.id);
    if(['acct','tax','st','amt','date','desc','inv'].some(k=>(t[k]??'')!==(o[k]??'')))ch=true;out.push(Object.assign(t,{...o}))});
  p._lk.forEach(o=>{if(!seen.has(o.id)){out.push({...o});ch=true}});
  if(ch){p.tx=out.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);msg('Exercice fermé : ses transactions sont en lecture seule, les modifications ont été annulées.',true);setTimeout(render,0)}}

/* ---------- mission de compilation ---------- */
const NOTE1={
  ex:'La méthode de comptabilité appliquée dans la préparation des informations financières se fonde sur le coût historique, compte tenu des opérations de trésorerie ainsi que des éléments suivants :',
  caisse:'Les états financiers ont été compilés par la direction selon la méthode de la comptabilité de caisse : les produits sont constatés lorsqu’ils sont encaissés et les charges lorsqu’elles sont payées. Les immobilisations sont passées en charges ou amorties selon les taux utilisés aux fins de l’impôt sur le revenu. Aucun état des flux de trésorerie n’a été préparé.',
  fisc:'Les états financiers ont été compilés par la direction à partir des montants déterminés aux fins de l’impôt sur le revenu. Les produits et les charges sont constatés selon la méthode de la comptabilité d’exercice et l’amortissement correspond à la déduction pour amortissement réclamée. Aucun état des flux de trésorerie n’a été préparé.'};
const ACC=['Les règles de déontologie (Code de déontologie des comptables professionnels agréés) peuvent être respectées, y compris quant à l’indépendance ou à sa divulgation dans le rapport.',
  'Aucun conflit d’intérêts n’a été relevé, ou les mesures de sauvegarde nécessaires sont en place.',
  'Le cabinet possède la compétence, le temps et les ressources nécessaires pour réaliser la mission.',
  'Rien n’indique un manque d’intégrité de la direction ou des responsables de la gouvernance.',
  'L’utilisation prévue des informations financières et les utilisateurs visés sont connus.',
  'La méthode de comptabilité retenue convient compte tenu de l’utilisation prévue.',
  'Les conditions de la mission ont été convenues par écrit avec la direction (lettre de mission).',
  'Le dossier de l’exercice précédent a été revu et les points à reporter ont été notés (s’il y a lieu).',
  'Les honoraires des exercices antérieurs ont été réglés ou les modalités sont convenues.',
  'L’identité du client et de ses dirigeants a été vérifiée conformément aux obligations du cabinet.'];
const QS=['Avez-vous fourni les relevés de tous les comptes bancaires, cartes de crédit et marges de crédit de l’entreprise jusqu’à la fin de l’exercice?',
  'Des clients vous devaient-ils de l’argent à la fin de l’exercice? (liste des factures impayées)',
  'Y avait-il un inventaire de marchandises, de matériaux ou de travaux en cours à la fin de l’exercice? (valeur et méthode)',
  'L’entreprise a-t-elle acheté, vendu ou mis au rebut du matériel, du mobilier, un véhicule ou un immeuble pendant l’exercice? (factures et contrats)',
  'Des factures de fournisseurs pour des biens ou services reçus avant la fin de l’exercice étaient-elles impayées?',
  'Des dépenses ont-elles été payées d’avance pour l’exercice suivant (assurances, loyer, abonnements)?',
  'De nouveaux emprunts, marges, contrats de location ou financements ont-ils été conclus ou modifiés? (relevés de prêt au dernier jour)',
  'Des salaires, primes, vacances ou commissions étaient-ils dus aux employés ou à l’actionnaire à la fin de l’exercice?',
  'Des dividendes ont-ils été déclarés ou versés pendant l’exercice? (résolutions)',
  'L’actionnaire a-t-il payé personnellement des dépenses de l’entreprise, ou l’entreprise a-t-elle payé des dépenses personnelles?',
  'Y a-t-il eu des opérations avec des personnes ou des sociétés liées (holding, famille, autres sociétés de l’actionnaire)?',
  'Un véhicule est-il utilisé pour l’entreprise? À qui appartient-il et quel est le kilométrage d’affaires?',
  'Toutes les déclarations de TPS et de TVQ de l’exercice ont-elles été produites? (copies)',
  'L’entreprise a-t-elle des employés? Les remises de retenues, T4 et relevés 1 sont-ils à jour?',
  'Y a-t-il des avis de cotisation, des vérifications ou des litiges en cours (ARC, Revenu Québec, autres)?',
  'Existe-t-il des engagements importants (baux, contrats, garanties, cautionnements)?',
  'Des événements importants sont-ils survenus depuis la fin de l’exercice?',
  'Y a-t-il eu des changements au capital-actions, aux actionnaires ou aux administrateurs?',
  'L’entreprise a-t-elle reçu ou demandé des subventions ou des crédits d’impôt?',
  'Les activités de l’entreprise ont-elles changé pendant l’exercice?'];
const SECS=[['A','Encaisse','1',/BANQUE|ENCAISSE|CAISSE|COMPTE COURANT|EPARGNE|TRANSITOIRE/],['B','Placements','1',/PLACEMENT|INVESTISSEMENT|CERTIFICAT|DEPOT A TERME/],
  ['C','Débiteurs','1',/CLIENTS|DEBITEUR|A RECEVOIR|CREANCE/],['D','Stocks','1',/STOCK|INVENTAIRE|MARCHANDISE/],['E','Frais payés d’avance','1',/PAYES? D.?AVANCE|PREPAYE/],
  ['F','Immobilisations','1',/EQUIPEMENT|MOBILIER|MATERIEL|VEHICULE|AUTOMOBILE|AMORTISSEMENT|BATIMENT|TERRAIN|IMMOBILIS|ORDINATEUR|INFORMATIQUE|AMELIORATION|OUTILLAGE|MACHINERIE|ACHALANDAGE/],
  ['G','Autres actifs','1',null],
  ['CC','Impôts sur le revenu','2',/IMPOTS? SUR LE REVENU|IMPOTS? DES SOCIETES/],['BB','Sommes à remettre à l’État','2',/TPS|TVQ|TAXE|DAS|RRQ|RQAP|ASSURANCE.EMPLOI|IMPOT|FSS|CNESST|CSST|RETENUE|REMISE/],
  ['EE','Avances des actionnaires et apparentés','2',/ACTIONNAIRE|ADMINISTRATEUR|APPARENT|PROPRIETAIRE|ASSOCIE|LIEE|DIRIGEANT/],
  ['DD','Emprunts et dette à long terme','2',/^(?!.*(MARGE|COURT TERME|MOINS D.UN AN)).*(EMPRUNT|PRET|HYPOTHEQUE|DETTE|FINANCEMENT|OBLIGATION LOCATIVE)/],
  ['AA','Créditeurs et charges à payer','2',null],['GG','Capital-actions','3',/CAPITAL/],['HH','Bénéfices non répartis et dividendes','3',null],
  ['10','Produits','4',null],['20','Coût des ventes','5',/ACHATS|COUT DES|MATIERES|FRET|MARCHANDISES VENDUES/],
  ['30','Salaires et charges sociales','5',/SALAIRE|REMUNERATION|CHARGES? SOCIALES|RRQ|RQAP|ASSURANCE.EMPLOI|FSS|CNESST|CSST|AVANTAGES SOCIAUX/],['40','Frais d’exploitation','5',null]];
const SECN=Object.fromEntries(SECS.map(s=>[s[0],s[1]]));
const PROC={A:['Conciliation bancaire au dernier jour de l’exercice (onglet Conciliation)','Soldes concordent aux relevés de fin d’exercice','Compte transitoire vidé'],
  B:['Relevés de placement de fin d’exercice obtenus','Revenus de placement inscrits'],C:['Liste des comptes clients à la fin de l’exercice obtenue de la direction','Créances douteuses discutées avec la direction'],
  D:['Valeur de l’inventaire de fin d’exercice obtenue de la direction (questionnaire)','Méthode d’évaluation documentée'],E:['Assurances, loyers et abonnements payés d’avance calculés'],
  F:['Acquisitions et dispositions appuyées par des factures','Amortissement de l’exercice calculé (AJE)','Tableau de DPA mis à jour (étape Fiscalité)'],G:['Nature des autres actifs documentée'],
  AA:['Factures de fournisseurs impayées à la fin de l’exercice obtenues','Honoraires de compilation et autres charges à payer inscrits','Solde des cartes de crédit concorde au relevé'],
  BB:['TPS et TVQ conciliées aux déclarations produites','Retenues à la source conciliées (PD7A, TPZ-1015, T4 et RL-1)'],CC:['Impôts de l’exercice estimés et acomptes versés pris en compte'],
  DD:['Soldes des emprunts concordent aux relevés du prêteur','Portion à court terme déterminée'],EE:['Solde de l’actionnaire concilié avec la direction','Remboursement dans l’année suivante vérifié (paragraphe 15(2) LIR)'],
  GG:['Capital-actions concorde au registre des actions'],HH:['Dividendes appuyés par des résolutions','Conciliation des bénéfices non répartis'],
  '10':['Produits comparés à l’exercice précédent','Produits concordent aux déclarations de TPS/TVQ'],'20':['Coût des ventes et marge brute comparés à l’exercice précédent'],
  '30':['Salaires concordent aux sommaires T4 et RL-1'],'40':['Variations importantes expliquées','Repas et frais de représentation identifiés (50 %)','Dépenses personnelles exclues ou reclassées']};
const FINCHK=['Toutes les étapes du dossier ont été complétées et signées.','Les ajustements de fin d’exercice ont été approuvés par la direction.','Les états financiers ont été lus en entier et comparés aux chiffres de l’exercice précédent.','Le rapport de compilation est daté et signé.','La direction a approuvé les états financiers compilés et reconnu sa responsabilité (déclaration signée).','Les déclarations de revenus (T2 et CO-17) ont été préparées à partir des états financiers finaux, s’il y a lieu.','Le dossier est prêt à être archivé.'];
const STEPS=[['acc','1. Acceptation'],['let','2. Lettre de mission'],['ent','3. Entité et méthode'],['q','4. Questionnaire'],['bv','5. Balance de travail'],['ws','6. Feuilles de travail'],['aje','7. Ajustements'],['ef','8. États financiers'],['fis','9. Fiscalité'],['dec','10. Déclaration'],['fin','11. Achèvement']];
function secAuto(a){const d=String(a)[0],cls=d>='5'?'5':d,n=norm(accName(a));const L=SECS.filter(s=>s[2]===cls);return(L.find(s=>s[3]&&s[3].test(n))||L.find(s=>!s[3])||['40'])[0]}
const secOf=a=>(MIS&&MIS.map[a])||secAuto(a);
const fmtP=c=>c?(c<0?`(${fmtN(-c)})`:fmtN(c)):'—';
const gp=(o,p)=>p.split('.').reduce((x,k)=>x==null?x:x[k],o);
function sp(o,p,v){const k=p.split('.');let x=o;k.slice(0,-1).forEach(q=>{if(x[q]==null||typeof x[q]!=='object')x[q]={};x=x[q]});x[k[k.length-1]]=v}
const mIn=(p,lbl,o={})=>`<label class="f"${o.st?` style="${o.st}"`:''}>${lbl}<input data-mk="${p}" value="${esc(gp(MIS,p)??'')}"${o.type?` type="${o.type}"`:''}${o.rr?' data-rr':''}></label>`;
const mTa=(p,lbl,h=90,rr)=>`<label class="f" style="margin-top:8px">${lbl}<textarea data-mk="${p}" style="min-height:${h}px"${rr?' data-rr':''}>${esc(gp(MIS,p)??'')}</textarea></label>`;
const mCk=(p,lbl,rr=true)=>`<label class="row" style="gap:8px;margin-top:8px"><input type="checkbox" data-mk="${p}"${gp(MIS,p)?' checked':''}${rr?' data-rr':''}> ${lbl}</label>`;
const mYn=p=>{const v=gp(MIS,p)||'';return `<select data-mk="${p}" data-rr><option value=""${v?'':' selected'}>—</option>${['Oui','Non','S.O.'].map(o=>`<option${v===o?' selected':''}>${o}</option>`).join('')}</select>`};
const sign=(p,lbl='Préparé par')=>`<div class="row" style="margin-top:10px;align-items:flex-end">${mIn(p+'.prep',lbl+' (initiales)',{st:'width:150px',rr:1})}${mIn(p+'.prepD','Date',{type:'date'})}${mIn(p+'.rev','Révisé par',{st:'width:150px'})}${mIn(p+'.revD','Date',{type:'date'})}</div>`;

function newMis(x){const today=new Date().toISOString().slice(0,10);
  return{v:1,ex:x.id,deb:x.deb,fin:x.fin,cree:new Date().toISOString(),statut:'en cours',acc:{},indep:'oui',indepRaison:'',
    lettre:{date:today,ville:'Laval',usage:'la direction, l’institution financière de l’entreprise et la préparation des déclarations de revenus',fiscal:true,honoraires:'',signee:false},
    ent:{activites:'',forme:'Société par actions (Loi sur les sociétés par actions du Québec)',utilisateurs:'La direction, l’institution financière et les autorités fiscales',base:'ex',note1:NOTE1.ex},
    quest:{},qx:[],map:{},ws:{},ajeOk:{},ia:null,
    ef:{dateRapport:'',ville:'Laval',signataire:'Boujrad CPA Inc.',nImmo:true,nDette:false,dette:'[Préciser pour chaque emprunt : prêteur, taux d’intérêt, versements, échéance et garanties.]',nAct:false,act:'Les avances de l’actionnaire ne portent pas intérêt et ne comportent aucune modalité de remboursement.',nCap:true,arr:true,nous:false,actions:'',capAut:'',constit:'',statut:'',permis:'',chLbl:'Frais d’administration',amo:{},cap:'Autorisé : un nombre illimité d’actions ordinaires, votantes et participantes, sans valeur nominale.\nÉmis : [nombre] actions ordinaires',prevIS:'',revu:false},
    fisc:{dpa:[],autres:[],taux:'',ok:false},decl:{date:'',signee:false},ach:{},approb:{}}}
async function loadMis(){MIS=null;if(!C.exCur)return null;
  if(local)MIS=(LOCAL.mis||{})[C.id+'/'+C.exCur]||null;else{const s=await db.collection('clients').doc(C.id).collection('missions').doc(C.exCur).get();MIS=s.exists?s.data():null}
  if(MIS){MIS.map=MIS.map||{};MIS.ws=MIS.ws||{};MIS.qx=MIS.qx||[];MIS.ajeOk=MIS.ajeOk||{}}return MIS}
function saveMis(){if(!MIS)return;if(!estCPA()){$('misSave').textContent='Lecture seule (réservé au CPA)';return}clearTimeout(mTimer);$('misSave').textContent='Modifications en attente…';const cid=C.id,ex=C.exCur,data=JSON.parse(JSON.stringify(MIS));
  mTimer=setTimeout(async()=>{mTimer=null;data.updated=new Date().toISOString();
    try{if(local){LOCAL.mis=LOCAL.mis||{};LOCAL.mis[cid+'/'+ex]=data}else await db.collection('clients').doc(cid).collection('missions').doc(ex).set(data);$('misSave').textContent='Enregistré'}catch(e){$('misSave').textContent='Erreur d’enregistrement'}},700)}

async function misCalc(){if(!LED)LED=await loadLedger();const E=LED,x=curEx();
  const cur=tbFor(E,x),pre=tbFor(E,x,{noAje:true});
  const L=C.ex||[],i=L.findIndex(y=>y.id===x.id),pv=i>0&&L[i-1].fin===addDays(x.deb,-1)?L[i-1]:null;
  let prior=null,priorIS=false,pOuv=null;
  if(pv&&(pv.ouv||E.some(e=>e.date>=pv.deb&&e.date<=pv.fin))){prior=tbFor(E,pv);priorIS=true;pOuv=pv.ouv}
  else if(x.ouv){prior=new Map();Object.entries(x.ouv.s||{}).forEach(([a,c])=>{prior.set(a,(prior.get(a)||0)+c);if(+String(a)[0]>=4)priorIS=true})}
  if(prior&&!priorIS&&MIS.ef.prevIS){const{s}=ouvParse(MIS.ef.prevIS);const re=reAcct();Object.entries(s).forEach(([a,c])=>{prior.set(a,(prior.get(a)||0)+c);prior.set(re,(prior.get(re)||0)-c)});priorIS=Object.keys(s).length>0}
  const accts=[...new Set([...cur.keys(),...(prior?prior.keys():[]),...pre.keys()])].filter(a=>cur.get(a)||pre.get(a)||(prior&&prior.get(a))).sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true}));
  const todo=E.filter(e=>e.todo&&e.date>=x.deb&&e.date<=x.fin).length;
  const aje=E.filter(e=>e.aje&&e.date>=x.deb&&e.date<=x.fin);
  const secs=[...new Set(accts.map(secOf))];MIS.secs=SECS.map(s=>s[0]).filter(k=>secs.includes(k));
  return{E,x,pv,cur,pre,prior,priorIS,pOuv,accts,todo,aje}}

/* --- états financiers : calcul --- */
function fsCalc(d){const S=(m,k)=>m?[...m].filter(([a])=>secOf(a)===k).reduce((s,[,c])=>s+c,0):0;
  const NI=m=>m?-[...m].filter(([a])=>+String(a)[0]>=4).reduce((s,[,c])=>s+c,0):0;
  const col=(m,ouv,hasIS)=>{if(!m)return null;const v={};SECS.forEach(([k])=>v[k]=S(m,k));const ni=NI(m);
    const re=-v.HH+ni;let ca={A:v.A,B:v.B,C:v.C,D:v.D,E:v.E,tax:0},cl={AA:-v.AA,BB:-v.BB,CC:-v.CC,ovd:0};
    if(ca.A<0){cl.ovd=-ca.A;ca.A=0}if(cl.BB<0){ca.tax=-cl.BB;cl.BB=0}
    const tca=Object.values(ca).reduce((s,c)=>s+c,0),ta=tca+v.F+v.G,tcl=Object.values(cl).reduce((s,c)=>s+c,0),tl=tcl-v.DD-v.EE,eq=-v.GG+re;
    let deb=null,div=0,oth=0;if(ouv){deb=-Object.entries(ouv.s||{}).filter(([a])=>secOf(a)==='HH'||+String(a)[0]>=4).reduce((s,[,c])=>s+c,0);
      const dO=Object.entries(ouv.s||{}).filter(([a])=>isDiv(a)).reduce((s,[,c])=>s+c,0);div=[...m].filter(([a])=>isDiv(a)).reduce((s,[,c])=>s+c,0)-dO;oth=re-(deb+ni-div)}
    return{v,ni,re,ca,cl,tca,ta,tcl,tl,dd:-v.DD,ee:-v.EE,cap:-v.GG,eq,deb,div,oth,hasIS}};
  const cur=col(d.cur,d.x.ouv,true),pri=col(d.prior,d.pOuv,d.priorIS);
  const isA=[...new Set([...d.cur.keys(),...(d.prior&&d.priorIS?d.prior.keys():[])])].filter(a=>+String(a)[0]>=4&&(d.cur.get(a)||(d.priorIS&&d.prior?.get(a)))).sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true}));
  return{cur,pri,isA}}
function rapHtml(d){const M=MIS,nom=esc(C.nom),fin=dLong(d.x.fin);
  return `<h1 class="c">Rapport de compilation</h1><p>À la direction de ${nom}</p>
  <p>Sur la base des informations fournies par la direction, nous avons compilé le bilan de ${nom} au ${fin}, ainsi que l’état des résultats et l’état des bénéfices non répartis de l’exercice clos à cette date, et la note 1, qui décrit la méthode de comptabilité appliquée pour leur préparation (les « informations financières »).</p>
  <p>La direction est responsable de l’exactitude et de l’exhaustivité des informations sous-jacentes utilisées pour compiler les informations financières, ainsi que du choix de la méthode de comptabilité.</p>
  <p>Nous avons réalisé la mission conformément à la Norme canadienne de services connexes (NCSC) 4200, <i>Missions de compilation</i>, qui exige que nous nous conformions aux règles de déontologie pertinentes. Notre responsabilité consiste à aider la direction à préparer les informations financières.</p>
  <p>Nous n’avons pas réalisé une mission d’audit ou une mission d’examen, et nous ne sommes pas tenus de mettre en œuvre des procédures pour vérifier l’exactitude ou l’exhaustivité des informations fournies par la direction. Par conséquent, nous n’exprimons pas une opinion d’audit ou une conclusion d’examen, et nous ne fournissons aucune forme d’assurance sur les informations financières.</p>
  <p>Le lecteur doit garder à l’esprit que les informations financières risquent de ne pas convenir à ses besoins.</p>
  ${M.indep==='non'?`<p>Nous ne sommes pas indépendants de ${nom}${M.indepRaison?' : '+esc(M.indepRaison):''}.</p>`:''}
  <div class="sig">${esc(M.ef.signataire||'Boujrad CPA Inc.')}<br>Par ${esc(M.approb.prep||'[CPA]')}, CPA</div><p>${esc(M.ef.ville||'Laval')}, le ${dLong(M.ef.dateRapport)}</p>`}
function letHtml(){const M=MIS,L=M.lettre,nom=esc(C.nom),fin=dLong(M.fin);
  return `<p>${esc(L.ville||'Laval')}, le ${dLong(L.date)}</p><p>À la direction de ${nom}</p><p><strong>Objet : Mission de compilation des informations financières de l’exercice se terminant le ${fin}</strong></p>
  <p>Madame, Monsieur,</p><p>La présente confirme notre compréhension des conditions et des objectifs de notre mission, ainsi que de la nature et des limites des services que nous fournirons.</p>
  <h3>Objectif et étendue de la mission</h3><p>Vous nous avez demandé de compiler, à partir des informations que vous nous fournirez, le bilan de ${nom} au ${fin}, l’état des résultats et l’état des bénéfices non répartis de l’exercice clos à cette date, ainsi qu’une note décrivant la méthode de comptabilité appliquée. Ces informations financières sont destinées à ${esc(L.usage)}.</p>
  <h3>Nos responsabilités</h3><p>Nous réaliserons la mission conformément à la Norme canadienne de services connexes (NCSC) 4200, <i>Missions de compilation</i>, et aux règles de déontologie pertinentes. Une mission de compilation ne constitue ni un audit ni un examen. Nous ne sommes pas tenus de vérifier l’exactitude ou l’exhaustivité des informations que vous nous fournirez, et nous n’exprimerons aucune opinion ni conclusion et ne fournirons aucune forme d’assurance. Notre mission ne permet pas de déceler les erreurs, les fraudes ou les actes illégaux qui pourraient exister.</p>
  <h3>Responsabilités de la direction</h3><p>La direction est responsable de l’exactitude et de l’exhaustivité des documents et des informations fournis, du choix de la méthode de comptabilité, de la tenue des registres comptables et de la conservation des pièces justificatives, ainsi que de l’approbation des états financiers compilés. Elle confirmera ces responsabilités dans une lettre de déclaration.</p>
  <h3>Rapport</h3><p>Les états financiers compilés seront accompagnés de notre rapport de compilation, qui indiquera notamment que le lecteur doit garder à l’esprit que les informations financières risquent de ne pas convenir à ses besoins.${M.indep==='non'?' Comme nous ne sommes pas indépendants de votre entreprise, le rapport le mentionnera.':''}</p>
  ${L.fiscal?'<h3>Autres services</h3><p>Nous préparerons également les déclarations de revenus fédérale (T2) et québécoise (CO-17) de l’exercice à partir des états financiers compilés.</p>':''}
  ${L.honoraires?`<h3>Honoraires</h3><p>${esc(L.honoraires)}</p>`:''}
  <p>Veuillez signer et nous retourner une copie de la présente pour confirmer votre accord.</p><p>Veuillez agréer nos salutations distinguées.</p>
  <div class="sig">${esc(M.ef.signataire||'Boujrad CPA Inc.')}</div><p style="margin-top:26px">Accepté au nom de ${nom} :</p><div class="sig">Signature et titre</div><div class="sig" style="margin-top:20px">Date</div>`}
function decHtml(){const M=MIS,nom=esc(C.nom),fin=dLong(M.fin);
  return `<p>Le ${dLong(M.decl.date||M.ef.dateRapport)}</p><p>${esc(M.ef.signataire||'Boujrad CPA Inc.')}<br>220-672, boulevard des Laurentides, Laval (Québec) H7G 2V9</p>
  <p><strong>Objet : Déclaration de la direction — états financiers compilés de ${nom} pour l’exercice clos le ${fin}</strong></p>
  <p>Dans le cadre de votre mission de compilation, nous confirmons, au mieux de nos connaissances et de notre jugement, ce qui suit :</p><ol>
  <li>Nous reconnaissons notre responsabilité à l’égard de l’exactitude et de l’exhaustivité des informations fournies et du choix de la méthode de comptabilité décrite à la note 1.</li>
  <li>Nous vous avons fourni tous les documents comptables, pièces justificatives et procès-verbaux pertinents, et toutes les opérations de l’exercice ont été enregistrées.</li>
  <li>Nous vous avons communiqué l’identité des parties liées et les opérations conclues avec elles.</li>
  <li>Nous vous avons informés des engagements, éventualités, litiges et avis de cotisation connus.</li>
  <li>Aucun événement survenu après la fin de l’exercice ne nécessite d’ajustement ou de mention dans les états financiers, autre que ceux qui vous ont été communiqués.</li>
  <li>Nous avons examiné et approuvé les écritures d’ajustement proposées et en acceptons la responsabilité.</li>
  <li>Nous avons lu et approuvé les états financiers compilés.</li></ol>
  <p style="margin-top:20px">Pour ${nom},</p><div class="sig">Nom, titre et signature</div>`}

/* --- états financiers : format du cabinet (modèle 9392-6467) --- */
const NOTE2_INTRO='La méthode de comptabilité appliquée dans la préparation des informations financières se fonde sur le coût historique, compte tenu des opérations de trésorerie ainsi que des éléments suivants :';
const AMO_DEF=n=>/TERRAIN/.test(n)?['Non amorti','-']:/BATIMENT|IMMEUBLE|EDIFICE/.test(n)?['Dégressif','4 %']:/VEHICULE|AUTOMOBILE|MATERIEL ROULANT|CAMION/.test(n)?['Dégressif','30 %']:/ORDINATEUR|INFORMATIQUE|LOGICIEL/.test(n)?['Dégressif','55 %']:/AMELIORATION/.test(n)?['Linéaire','5 ans']:['Dégressif','20 %'];
function efModel(d){const M=MIS,E=M.ef,ARR=E.arr!==false,R=c=>ARR?Math.round((c||0)/100)*100:(c||0),hasP=!!d.prior,pIS=hasP&&d.priorIS;
  const cur=a=>d.cur.get(a)||0,pri=a=>hasP?(d.prior.get(a)||0):0;const nm=a=>accName(a),N=a=>norm(nm(a));
  const inSec=k=>d.accts.filter(a=>secOf(a)===k);const sumR=(L,f,sg)=>L.reduce((s,a)=>s+R(sg*f(a)),0);
  const isTax=a=>/IMPOTS? SUR LE REVENU/.test(N(a)),isAm=a=>/AMORTISSEMENT/.test(N(a));
  /* résultats */
  const rows=(L,sg)=>L.filter(a=>R(cur(a))||(pIS&&R(pri(a)))).map(a=>({t:'l',l:nm(a),a:R(sg*cur(a)),b:pIS?R(sg*pri(a)):null,ind:1}));
  const rv=inSec('10'),cs=inSec('20'),ch=[...inSec('30'),...inSec('40')].filter(a=>!isTax(a)).sort((a,b)=>(isAm(a)-isAm(b))||(Math.abs(cur(b))-Math.abs(cur(a)))),tx=d.accts.filter(a=>+String(a)[0]>=5&&isTax(a));
  const T=(L,f,sg)=>sumR(L,f,sg);const rvA=T(rv,cur,-1),rvB=T(rv,pri,-1),csA=T(cs,cur,1),csB=T(cs,pri,1),chA=T(ch,cur,1),chB=T(ch,pri,1),txA=T(tx,cur,1),txB=T(tx,pri,1);
  const niA=rvA-csA-chA-txA,niB=pIS?rvB-csB-chB-txB:null;
  const IS=[{t:'g',l:'Produits'},...rows(rv,-1)];if(rv.length>1)IS.push({t:'s',a:rvA,b:pIS?rvB:null});
  if(cs.length){IS.push({t:'sp'},{t:'g',l:'Coût des ventes'},...rows(cs,1),{t:'s',a:csA,b:pIS?csB:null},{t:'l',l:'Bénéfice brut',a:rvA-csA,b:pIS?rvB-csB:null,bold:1})}
  IS.push({t:'sp'},{t:'g',l:E.chLbl||'Frais d’administration'},...rows(ch,1),{t:'s',a:chA,b:pIS?chB:null});
  if(tx.length)IS.push({t:'sp'},{t:'l',l:'Bénéfice (perte) avant impôts',a:rvA-csA-chA,b:pIS?rvB-csB-chB:null,bold:1},{t:'l',l:'Impôts sur le revenu',a:txA,b:pIS?txB:null,ind:1});
  IS.push({t:'sp'},{t:'n',l:'Bénéfice net (perte nette)',a:niA,b:niB});
  /* bénéfices non répartis */
  const HH=inSec('HH'),divA=R(d.accts.filter(isDiv).reduce((s,a)=>s+cur(a),0)-Object.entries(d.x.ouv?.s||{}).filter(([a])=>isDiv(a)).reduce((s,[,c])=>s+c,0));
  const divB=d.pOuv?R(d.accts.filter(isDiv).reduce((s,a)=>s+pri(a),0)-Object.entries(d.pOuv.s||{}).filter(([a])=>isDiv(a)).reduce((s,[,c])=>s+c,0)):0;
  const debOf=o=>o?R(-Object.entries(o.s||{}).filter(([a])=>secOf(a)==='HH'||+String(a)[0]>=4).reduce((s,[,c])=>s+c,0)):null;
  const reBS=(f,ni)=>-HH.reduce((s,a)=>s+f(a),0)+ni;
  const finB=hasP?R(reBS(pri,pIS?(niB!=null?-[...d.prior].filter(([a])=>+String(a)[0]>=4).reduce((s,[,c])=>s+c,0):0):0)):null;
  const debA=finB!=null?finB:debOf(d.x.ouv);const othA=R(reBS(cur,-[...d.cur].filter(([a])=>+String(a)[0]>=4).reduce((s,[,c])=>s+c,0)))-(debA+niA-divA);
  const finA=debA+niA-divA+othA;const debB=d.pOuv?debOf(d.pOuv):(finB!=null&&niB!=null?finB-niB+divB:null),othB=finB!=null&&debB!=null&&niB!=null?finB-(debB+niB-divB):0;
  const RE=[{t:'l',l:'Solde au début',a:debA,b:debB,bold:1},{t:'l',l:'Bénéfice net (perte nette)',a:niA,b:niB,ind:1}];
  if(divA||divB)RE.push({t:'l',l:'Dividendes',a:-divA,b:hasP?-divB:null,ind:1});if(othA||othB)RE.push({t:'l',l:'Redressements',a:othA,b:hasP?othB:null,ind:1});
  RE.push({t:'n',l:'Solde à la fin'+(finA<0?' (déficit)':''),a:finA,b:finB});
  /* bilan */
  const S=(k,f,sg=1)=>R(sg*inSec(k).reduce((s,a)=>s+f(a),0));const both=(k,sg)=>[S(k,cur,sg),hasP?S(k,pri,sg):null];
  let[cA,cB]=both('A',1);const[bA,bB]=both('B',1),[cl0,cl1]=both('C',1),[dA,dB]=both('D',1),[eA,eB]=both('E',1),[fA,fB]=both('F',1),[gA,gB]=both('G',1);
  let[aaA,aaB]=both('AA',-1),[bbA,bbB]=both('BB',-1);const[ccA,ccB]=both('CC',-1),[eeA,eeB]=both('EE',-1),[capA,capB]=both('GG',-1);
  let ovA=0,ovB=0,trA=0,trB=0;if(cA<0){ovA=-cA;cA=0}if(cB<0){ovB=-cB;cB=0}if(bbA<0){trA=-bbA;bbA=0}if(bbB<0){trB=-bbB;bbB=0}
  const dd=inSec('DD').map(a=>({l:nm(a),a:R(-cur(a)),b:hasP?R(-pri(a)):null})).filter(x=>x.a||x.b);
  const lA=dd.reduce((s,x)=>s+x.a,0)+eeA,lB=dd.reduce((s,x)=>s+(x.b||0),0)+(eeB||0);
  const clA=ovA+aaA+bbA+ccA,clB=ovB+(aaB||0)+(bbB||0)+(ccB||0),eqA=capA+finA,eqB=(capB||0)+(finB||0);
  let caA=cA+bA+cl0+trA+dA+eA,caB=(cB||0)+(bB||0)+(cl1||0)+trB+(dB||0)+(eB||0);
  const adjA=(clA+lA+eqA)-(caA+fA+gA),adjB=hasP?(clB+lB+eqB)-(caB+(fB||0)+(gB||0)):0;cA+=adjA;caA+=adjA;if(hasP){cB=(cB||0)+adjB;caB+=adjB}
  const L=(l,a,b,ind=1)=>(a||b)?{t:'l',l,a,b,ind}:null;const NO={};let n=2;
  if(fA||fB)NO.F=++n;if(E.nDette&&dd.length)NO.DD=++n;if(E.nAct&&(eeA||eeB))NO.EE=++n;if(capA||capB)NO.GG=++n;
  const BS=[{t:'h',l:'ACTIF'},{t:'sp'},{t:'g',l:'Court terme'},L('Encaisse',cA,cB),L('Placements',bA,bB),L('Comptes clients',cl0,cl1),L('Taxes à recevoir',trA,trB),L('Stocks',dA,dB),L('Frais payés d’avance',eA,eB),{t:'s',a:caA,b:hasP?caB:null},{t:'sp'},
    (fA||fB)?{t:'k',l:'Immobilisations corporelles',note:NO.F,a:fA,b:fB}:null,(gA||gB)?{t:'k',l:'Autres actifs',a:gA,b:gB}:null,{t:'t',a:caA+fA+gA,b:hasP?caB+(fB||0)+(gB||0):null},{t:'sp'},
    {t:'h',l:'PASSIF'},{t:'sp'},{t:'g',l:'Court terme'},L('Découvert bancaire',ovA,ovB),L('Fournisseurs et charges à payer',aaA,aaB),L('Taxes à payer',bbA,bbB),L('Impôts sur le revenu à payer',ccA,ccB),{t:'s',a:clA,b:hasP?clB:null}];
  if(lA||lB)BS.push({t:'sp'},{t:'g',l:'Long terme'},...dd.map(x=>({t:'l',l:x.l+(NO.DD&&x===dd[dd.length-1]?'':''),a:x.a,b:x.b,ind:1})),L('Somme due à l’actionnaire',eeA,eeB),{t:'s',a:lA,b:hasP?lB:null});
  BS.push({t:'s',a:clA+lA,b:hasP?clB+lB:null},{t:'sp'},{t:'h',l:'CAPITAUX PROPRES'},{t:'sp'},{t:'k',l:'Capital-actions',note:NO.GG,a:capA,b:capB},{t:'k',l:'Bénéfices non répartis'+((finA<0||finB<0)?' (déficit)':''),a:finA,b:finB},{t:'s',a:eqA,b:hasP?eqB:null},{t:'t',a:clA+lA+eqA,b:hasP?clB+lB+eqB:null});
  /* notes */
  const notes=[{n:1,t:'STATUT ET NATURE DES ACTIVITÉS',p:[E.statut||`La société a été constituée le ${E.constit?dLong(E.constit):'[date]'} en vertu de la Loi sur les sociétés par actions du Québec. Elle oeuvre dans ${M.ent.activites?M.ent.activites.replace(/\.$/,''):'[secteur d’activité]'}.`]}];
  const F=inSec('F'),acc=F.filter(isAm),cost=F.filter(a=>!isAm(a));
  const pair=c=>acc.filter(a=>{const x=N(a),y=N(c).replace(/^(COUT|COÛT)\s*-?\s*/,'');return x.includes(y)||y.split(' ').filter(w=>w.length>3).some(w=>x.includes(w))});
  const used=new Set();const cats=cost.map(c=>{const ac=pair(c).filter(a=>!used.has(a));ac.forEach(a=>used.add(a));return{l:nm(c).replace(/^co[uû]t\s*-?\s*/i,''),n:N(c),c:R(cur(c)),am:R(-ac.reduce((s,a)=>s+cur(a),0)),pb:R(pri(c)+ac.reduce((s,a)=>s+pri(a),0))}});
  acc.filter(a=>!used.has(a)).forEach(a=>cats.push({l:nm(a),n:N(a),c:0,am:R(-cur(a)),pb:R(pri(a))}));
  if(M.ent.base==='ex'||!M.ent.base){const bl=[];if(cl0||cl1)bl.push('Comptes clients, déduction faite d’une provision pour créances douteuses;');if(dA||dB)bl.push('Stocks évalués au moindre du coût et de la valeur nette de réalisation;');if(eA||eB)bl.push('Frais payés d’avance;');
    if(cats.length)bl.push({t:`Immobilisations corporelles amorties sur leur durée de vie utile estimative selon les méthodes et les taux indiqués ci-dessous.${cats.some(c=>/TERRAIN/.test(c.n))?' Le terrain n’est pas amorti.':''}`,tab:cats.filter(c=>!/TERRAIN/.test(c.n)&&c.c).map(c=>{const k=c.l.replace(/[^\w]/g,'_'),o=(E.amo||{})[k]||{},df=AMO_DEF(c.n);return[c.l,o.m||df[0],o.t||df[1],k]})});
    if(aaA||aaB||bbA||bbB)bl.push('Comptes fournisseurs et charges à payer;');const lt=[dd.length?(dd.length===1?dd[0].l.toLowerCase():'emprunts'):'',(eeA||eeB)?'somme due à l’actionnaire':''].filter(Boolean);if(lt.length){const s=lt.join(' et ')+'.';bl.push(s[0].toUpperCase()+s.slice(1))}
    notes.push({n:2,t:'MÉTHODE DE COMPTABILITÉ',p:(M.ent.note1||NOTE2_INTRO).split('\n'),bl})}
  else notes.push({n:2,t:'MÉTHODE DE COMPTABILITÉ',p:M.ent.note1.split('\n')});
  if(NO.F)notes.push({n:NO.F,t:'IMMOBILISATIONS CORPORELLES',fa:{cats,hasP,tot:[cats.reduce((s,c)=>s+c.c,0),cats.reduce((s,c)=>s+c.am,0),fA,fB]}});
  if(NO.DD)notes.push({n:NO.DD,t:'DETTE À LONG TERME',p:E.dette.split('\n')});if(NO.EE)notes.push({n:NO.EE,t:'SOMME DUE À L’ACTIONNAIRE',p:E.act.split('\n')});
  if(NO.GG)notes.push({n:NO.GG,t:'CAPITAL-ACTIONS',cap:{lbl:E.actions||'[nombre] actions ordinaires',a:capA,b:capB,hasP,aut:E.capAut||''}});
  const fin=dLong(d.x.fin);
  return{nom:C.nom,fin,N:d.x.fin.slice(0,4),N1:String(+d.x.fin.slice(0,4)-1),hasP,pIS,
    pages:[{k:'cover'},{k:'toc'},{k:'rap'},{k:'fs',t:'RÉSULTATS',s:`Exercice terminé le ${fin}`,rows:IS},{k:'fs',t:'BÉNÉFICES NON RÉPARTIS',s:`Exercice terminé le ${fin}`,rows:RE},
      {k:'fs',t:'BILAN',s:`Au ${fin}`,rows:BS.filter(Boolean),sig:1},{k:'notes',t:'NOTES AFFÉRENTES AUX INFORMATIONS FINANCIÈRES',s:`Au ${fin}`,notes}]}}
function rapParas(m){const M=MIS,E=M.ef,je=E.nous?0:1,nom=m.nom,f=m.fin;
  return[je?`J'ai compilé, à partir des informations fournies par la direction, le bilan de la société ${nom} au ${f}, les états des résultats et des bénéfices non répartis pour l'exercice terminé à cette date ainsi que la note 2, qui décrit la méthode de comptabilité appliquée à la préparation des informations financières compilées et, s'il y a lieu, d'autres informations explicatives (les « informations financières »).`
      :`Nous avons compilé, à partir des informations fournies par la direction, le bilan de la société ${nom} au ${f}, les états des résultats et des bénéfices non répartis pour l'exercice terminé à cette date ainsi que la note 2, qui décrit la méthode de comptabilité appliquée à la préparation des informations financières compilées et, s'il y a lieu, d'autres informations explicatives (les « informations financières »).`,
    `La responsabilité des informations financières ci-jointes, y compris de l'exactitude et de l'exhaustivité des informations sous-jacentes ayant servi à leur compilation, et de la sélection de la méthode de comptabilité, incombe à la direction.`,
    je?`J'ai réalisé la mission conformément à la Norme canadienne de services connexes (NCSC) 4200, Missions de compilation, qui exige que je me conforme aux règles de déontologie pertinentes. Ma responsabilité consiste à assister la direction dans la préparation des informations financières.`
      :`Nous avons réalisé la mission conformément à la Norme canadienne de services connexes (NCSC) 4200, Missions de compilation, qui exige que nous nous conformions aux règles de déontologie pertinentes. Notre responsabilité consiste à assister la direction dans la préparation des informations financières.`,
    je?`Je n'ai pas réalisé une mission d'audit ou d'examen et n'étais pas tenu de mettre en œuvre des procédures pour vérifier l'exactitude et l'exhaustivité des informations fournies par la direction. Par conséquent, je n'exprime pas une opinion d'audit ni une conclusion de mission d'examen, ni ne fournis une quelconque forme d'assurance à l'égard des informations financières.`
      :`Nous n'avons pas réalisé une mission d'audit ou d'examen et n'étions pas tenus de mettre en œuvre des procédures pour vérifier l'exactitude et l'exhaustivité des informations fournies par la direction. Par conséquent, nous n'exprimons pas une opinion d'audit ni une conclusion de mission d'examen, ni ne fournissons une quelconque forme d'assurance à l'égard des informations financières.`,
    `Le lecteur doit garder à l'esprit que les informations financières risquent de ne pas convenir à ses besoins.`,
    ...(M.indep==='non'?[`${je?'Je ne suis pas indépendant':'Nous ne sommes pas indépendants'} de la société ${nom}${M.indepRaison?' : '+M.indepRaison:''}.`]:[])]}
const fd=c=>{if(c==null)return'';if(!c)return'-';const s=new Intl.NumberFormat('fr-CA',{maximumFractionDigits:MIS.ef.arr!==false?0:2,minimumFractionDigits:MIS.ef.arr!==false?0:2}).format(Math.abs(c)/100);return c<0?`(${s})`:s};
function efPreview(m){const E=MIS.ef,h=(t,s)=>`<div class="ehd"><strong>${esc(m.nom)}</strong><em>${esc(t)}</em><b>${esc(s)}</b></div>`;
  const yr=`<tr class="yr"><td></td><td class="num"><b>${m.N}</b><br>$</td>${m.hasP?`<td class="num">${m.N1}<br>$</td>`:''}</tr>`;
  const row=r=>{if(r.t==='sp')return'<tr class="sp"><td colspan="3"></td></tr>';if(r.t==='h')return `<tr><td colspan="3"><em>${esc(r.l)}</em></td></tr>`;if(r.t==='g')return `<tr><td colspan="3"><strong>${esc(r.l)}</strong></td></tr>`;
    const lbl=r.t==='k'?`<strong>${esc(r.l)}</strong>${r.note?` (note ${r.note})`:''}`:r.t==='n'||r.bold?`<strong>${esc(r.l)}</strong>`:esc(r.l||'');
    return `<tr class="${r.t}"><td${r.ind?' class="ind"':''}>${lbl}</td><td class="num"><b>${fd(r.a)}</b></td>${m.hasP?`<td class="num">${fd(r.b)}</td>`:''}</tr>`};
  let x=`<div class="pg ecov"><hr><p><strong><em>${esc(m.nom)}</em></strong></p><p><strong>INFORMATIONS FINANCIÈRES</strong></p><p><strong>${esc(m.fin)}</strong></p><hr></div>`;
  x+=`<div class="pg">${h('TABLE DES MATIÈRES',m.fin)}<table class="etoc"><tr><td></td><td class="num"><b>Page</b></td></tr><tr><td><b>Rapport de mission de compilation</b></td><td class="num">2</td></tr><tr><td><b>Informations financières</b></td><td></td></tr><tr><td class="ind">Résultats</td><td class="num">3</td></tr><tr><td class="ind">Bénéfices non répartis</td><td class="num">4</td></tr><tr><td class="ind">Bilan</td><td class="num">5</td></tr><tr><td class="ind">Notes afférentes aux informations financières</td><td class="num">6</td></tr></table></div>`;
  x+=`<div class="pg"><p class="c"><strong><em>RAPPORT DE MISSION DE COMPILATION</em></strong></p><p><strong><em>À la direction de</em><br>${esc(m.nom)}</strong></p>${rapParas(m).map(p=>`<p class="j">${esc(p).replace('Missions de compilation','<em>Missions de compilation</em>')}</p>`).join('')}
    <p style="margin-top:40px">______________________________<sup>1</sup></p><p style="margin-top:20px">${esc(E.ville||'Laval')}, le ${esc(dLong(E.dateRapport))}</p><p style="margin-top:40px;font-size:12px"><sup>1</sup> Par ${esc(MIS.approb.prep||'______________________')}, CPA, permis de CPA nº ${esc(E.permis||'__________')}</p></div>`;
  m.pages.filter(p=>p.k==='fs').forEach(p=>{x+=`<div class="pg">${h(p.t,p.s)}<table class="efs">${yr}${p.rows.map(row).join('')}</table>${p.sig?'<p style="margin-top:30px"><strong>POUR LE CONSEIL D’ADMINISTRATION,</strong></p><p style="margin-top:26px">______________________________, administrateur</p><p style="margin-top:20px">______________________________, administrateur</p>':''}</div>`});
  const np=m.pages.find(p=>p.k==='notes');x+=`<div class="pg">${h(np.t,np.s)}${np.notes.map(nt=>`<p class="nt"><strong>${nt.n}.&nbsp;&nbsp;${esc(nt.t)}</strong></p><div class="nb">${(nt.p||[]).map(p=>`<p class="j">${esc(p)}</p>`).join('')}
    ${nt.bl?`<ul>${nt.bl.map(b=>typeof b==='string'?`<li>${esc(b)}</li>`:`<li>${esc(b.t)}${b.tab.length?`<table class="efs" style="max-width:420px"><tr><td></td><td><b>Méthodes</b></td><td><b>Taux</b></td></tr>${b.tab.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>`:''}</li>`).join('')}</ul>`:''}
    ${nt.fa?`<table class="efs"><tr class="yr"><td></td><td class="num" colspan="3"><b>${m.N}</b></td>${nt.fa.hasP?`<td class="num">${m.N1}</td>`:''}</tr><tr class="yr"><td></td><td class="num">Coût<br>$</td><td class="num">Amortissement cumulé<br>$</td><td class="num">Valeur nette<br>$</td>${nt.fa.hasP?'<td class="num">Valeur nette<br>$</td>':''}</tr>${nt.fa.cats.map(c=>`<tr><td>${esc(c.l)}</td><td class="num"><b>${fd(c.c)}</b></td><td class="num"><b>${fd(c.am)}</b></td><td class="num"><b>${fd(c.c-c.am)}</b></td>${nt.fa.hasP?`<td class="num">${fd(c.pb)}</td>`:''}</tr>`).join('')}<tr class="t"><td></td><td class="num"><b>${fd(nt.fa.tot[0])}</b></td><td class="num"><b>${fd(nt.fa.tot[1])}</b></td><td class="num"><b>${fd(nt.fa.tot[2])}</b></td>${nt.fa.hasP?`<td class="num">${fd(nt.fa.tot[3])}</td>`:''}</tr></table>`:''}
    ${nt.cap?`<table class="efs">${yr}${nt.cap.aut?`<tr><td colspan="3">${esc(nt.cap.aut)}</td></tr>`:''}<tr><td>Émis et payé :</td><td></td>${nt.cap.hasP?'<td></td>':''}</tr><tr class="s"><td class="ind">${esc(nt.cap.lbl)}</td><td class="num"><b>${fd(nt.cap.a)}</b></td>${nt.cap.hasP?`<td class="num">${fd(nt.cap.b)}</td>`:''}</tr></table>`:''}</div>`).join('')}</div>`;
  return x}
async function efPdf(m,file){if(!downloads)throw{code:'nodl'};
  if(!window.jspdf)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'pt',format:'letter'});const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),X=72,XR=W-72;
  const cl=t=>String(t??'').replace(/[   ]/g,' ').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...');
  const F=(st,sz)=>{doc.setFont('helvetica',st);doc.setFontSize(sz)};const C1=XR-80,C2=XR;let y=0,pg=0;
  const line=(x1,x2,yy,w=.5)=>{doc.setLineWidth(w);doc.line(x1,yy,x2,yy)};
  const newPage=()=>{if(pg++)doc.addPage();y=72};
  const hdr=(t,s)=>{F('bold',11);doc.text(cl(m.nom),X,y);y+=11;F('bolditalic',7.5);doc.text(cl(t),X,y);y+=9;F('bold',7.5);doc.text(cl(s),X,y);y+=6;line(X,XR,y,1.4);y+=24};
  const para=(t,o={})=>{F(o.st||'normal',o.sz||9.5);const L=doc.splitTextToSize(cl(t),(o.w||XR-X));if(y+L.length*12>H-70){newPage()}
    if(o.just&&L.length>1){L.forEach((ln,i)=>{const last=i===L.length-1;if(last){doc.text(ln,o.x||X,y)}else doc.text(ln,o.x||X,y,{maxWidth:o.w||XR-X,align:'justify'});y+=12})}else{doc.text(L,o.c?W/2:(o.x||X),y,{align:o.c?'center':'left'});y+=L.length*12}y+=o.after??8};
  const amt=(a,b,hasP,bold=true)=>{F(bold?'bold':'normal',9);if(a!=null)doc.text(cl(fd(a)),hasP?C1:C2,y,{align:'right'});F('normal',9);if(hasP&&b!=null)doc.text(cl(fd(b)),C2,y,{align:'right'})};
  const yrs=(hasP)=>{F('bold',9);doc.text(m.N,hasP?C1:C2,y,{align:'right'});if(hasP){F('normal',9);doc.text(m.N1,C2,y,{align:'right'})}y+=10;F('bold',9);doc.text('$',hasP?C1:C2,y,{align:'right'});if(hasP){F('normal',9);doc.text('$',C2,y,{align:'right'})}y+=16};
  const cols=hasP=>hasP?[C1-62,C2-62]:[C2-62];
  // couverture
  newPage();y=300;line(X+20,W/2+70,y,1.2);y+=24;F('bolditalic',10);doc.text(cl(m.nom),(X+20+W/2+70)/2,y,{align:'center'});y+=18;F('bold',7.5);doc.text('INFORMATIONS FINANCIÈRES',(X+20+W/2+70)/2,y,{align:'center'});y+=18;doc.text(cl(m.fin),(X+20+W/2+70)/2,y,{align:'center'});y+=24;line(X+20,W/2+70,y,1.2);
  // table des matières
  newPage();hdr('TABLE DES MATIÈRES',m.fin);y+=60;F('bold',9);doc.text('Page',XR,y,{align:'right'});y+=20;
  [['Rapport de mission de compilation','2',1,0],['Informations financières','',1,0],['Résultats','3',0,1],['Bénéfices non répartis','4',0,1],['Bilan','5',0,1],['Notes afférentes aux informations financières','6',0,1]].forEach(([l,p,b,i])=>{F(b?'bold':'normal',9);doc.text(cl(l),X+(i?18:0),y);F('normal',9);if(p)doc.text(p,XR,y,{align:'right'});y+=20});
  // rapport
  newPage();y=110;F('bolditalic',12);doc.text('RAPPORT DE MISSION DE COMPILATION',W/2,y,{align:'center'});y+=36;F('bolditalic',9.5);doc.text('À la direction de',X,y);y+=12;F('bold',9.5);doc.text(cl(m.nom),X,y);y+=30;
  rapParas(m).forEach(p=>para(p,{just:1,after:9}));y+=50;line(X,X+170,y,.5);F('normal',6);doc.text('1',X+173,y-3);y+=40;F('normal',9.5);doc.text(cl(`${MIS.ef.ville||'Laval'}, le ${dLong(MIS.ef.dateRapport)}`),X,y);
  y=H-90;line(X,X+170,y,.5);y+=12;F('normal',6);doc.text('1',X,y-3);F('normal',8.5);doc.text(cl(`Par ${MIS.approb.prep||'______________________'}, CPA, permis de CPA nº ${MIS.ef.permis||'__________'}`),X+5,y);
  // états
  const drawRows=(rows,hasP)=>{rows.forEach(r=>{if(y>H-80){newPage()}
    if(r.t==='sp'){y+=6;return}if(r.t==='h'){F('bolditalic',9);doc.text(cl(r.l),X,y);y+=15;return}if(r.t==='g'){F('bold',9);doc.text(cl(r.l),X,y);y+=13;return}
    const xs=cols(hasP);if(r.t==='s'||r.t==='t'){doc.setDrawColor(0);xs.forEach(x=>line(x,x+62,y-9,.6));}
    if(r.t==='n'){line(X,XR,y-9,.6)}if(r.t==='k'){}
    if(r.l){if(r.t==='k'){F('bold',9);doc.text(cl(r.l),X,y);if(r.note){const w=doc.getTextWidth(cl(r.l));F('normal',9);doc.text(` (note ${r.note})`,X+w,y)}}else{F(r.t==='n'||r.bold?'bold':'normal',9);doc.text(cl(r.l),X+(r.ind?16:0),y)}}
    amt(r.a,r.b,hasP);
    if(r.t==='k')line(X,XR,y+4,.5);
    if(r.t==='t'||r.t==='n'){xs.forEach(x=>{line(r.t==='n'?X:x,x+62,y+4,.6);line(r.t==='n'?X:x,x+62,y+6.5,.6)});if(r.t==='n')line(X,XR,y+4,.6)}
    y+=r.t==='s'||r.t==='t'||r.t==='n'?16:13})};
  m.pages.filter(p=>p.k==='fs').forEach(p=>{newPage();hdr(p.t,p.s);yrs(m.hasP);drawRows(p.rows,m.hasP);
    if(p.sig){y+=40;F('bold',8.5);doc.text('POUR LE CONSEIL D’ADMINISTRATION,'.replace('’',"'"),X,y);y+=36;F('normal',8.5);doc.text('______________________________, administrateur',X,y);y+=30;doc.text('______________________________, administrateur',X,y)}});
  // notes
  const np=m.pages.find(p=>p.k==='notes');newPage();hdr(np.t,np.s);const NX=X+28;
  np.notes.forEach(nt=>{if(y>H-130)newPage();F('bold',8.5);doc.text(nt.n+'.',X,y);doc.text(cl(nt.t),NX,y);y+=16;
    (nt.p||[]).forEach(p=>para(p,{x:NX,w:XR-NX,just:1}));
    (nt.bl||[]).forEach(b=>{const t=typeof b==='string'?b:b.t;F('normal',9.5);doc.text('-',NX,y);const L=doc.splitTextToSize(cl(t),XR-NX-22);doc.text(L,NX+22,y);y+=L.length*12+6;
      if(typeof b!=='string'&&b.tab.length){F('bold',8.5);doc.text('Méthodes',NX+200,y);doc.text('Taux',NX+300,y);y+=12;F('normal',8.5);b.tab.forEach(r=>{doc.text(cl(r[0]),NX+22,y);doc.text(cl(r[1]),NX+200,y);doc.text(cl(r[2]),NX+300,y);y+=12});y+=8}});
    if(nt.fa){const fa=nt.fa,cx=fa.hasP?[XR-230,XR-160,XR-90,XR]:[XR-160,XR-90,XR];y+=4;F('bold',8.5);doc.text(m.N,fa.hasP?cx[1]-20:cx[1]-20,y,{align:'center'});if(fa.hasP){F('normal',8.5);doc.text(m.N1,cx[3],y,{align:'right'})}y+=4;line(cx[0]-50,cx[2],y,.5);y+=10;
      [['','Amortissement','Valeur','Valeur'],['Coût','cumulé','nette','nette'],['$','$','$','$']].forEach(rw=>{rw.forEach((t,i)=>{if(i===3&&!fa.hasP)return;F(i<3?'bold':'normal',8.5);doc.text(t,cx[i],y,{align:'right'})});y+=10});y+=6;
      fa.cats.forEach((c,i)=>{F('normal',8.5);doc.text(cl(c.l),NX+10,y);F('bold',8.5);[c.c,c.am,c.c-c.am].forEach((v,j)=>doc.text(cl(fd(v)),cx[j],y,{align:'right'}));if(fa.hasP){F('normal',8.5);doc.text(cl(fd(c.pb)),cx[3],y,{align:'right'})}if(i===fa.cats.length-1)line(NX+10,XR,y+4,.5);y+=13});
      F('bold',8.5);fa.tot.slice(0,3).forEach((v,j)=>doc.text(cl(fd(v)),cx[j],y,{align:'right'}));if(fa.hasP){F('normal',8.5);doc.text(cl(fd(fa.tot[3])),cx[3],y,{align:'right'})}line(cx[0]-50,XR,y+4,.6);line(cx[0]-50,XR,y+6.5,.6);y+=24}
    if(nt.cap){const c=nt.cap;y+=2;yrs(c.hasP);if(c.aut)para(c.aut,{x:NX,w:XR-NX});F('normal',8.5);doc.text('Émis et payé :',NX+10,y);y+=13;doc.text(cl(c.lbl),NX+20,y);amt(c.a,c.b,c.hasP);cols(c.hasP).forEach(x=>line(x,x+62,y+4,.6));y+=24}
    y+=6});
  const n=doc.getNumberOfPages();for(let i=4;i<=n;i++){doc.setPage(i);F('normal',8);doc.text(String(i-1),W/2,H-36,{align:'center'})}
  await downloads.save({filename:file.replace(/[^\w.-]+/g,'_'),data:new Uint8Array(doc.output('arraybuffer'))})}

/* --- rendu de l'onglet --- */
/* Mission de compilation : réservée au CPA (le technicien consulte et télécharge, sans modifier) */
function lockMis(){if(estCPA())return;const box=document.getElementById('tMis');if(!box)return;
  box.querySelectorAll('#misBody input,#misBody textarea,#misBody select,#misBody button,#misHead button').forEach(x=>{if(!/^(misEfPdf|misWpPdf)$/.test(x.id)&&!x.dataset.ms&&!/PDF|Télécharger|Imprimer/i.test(x.textContent))x.disabled=true});
  if(!document.getElementById('misRO'))document.getElementById('misHead')?.insertAdjacentHTML('afterbegin','<p class="msg err" id="misRO" style="margin:10px 0 0">Mission de compilation réservée au CPA : vous pouvez la consulter et télécharger les PDF, mais pas la créer ni la modifier.</p>')}
async function renderMis(){const x=curEx();$('misMsg').textContent='';setTimeout(lockMis,0);
  if(!x){$('misSub').textContent='';$('misHead').innerHTML='<p class="note" style="margin-top:10px">Définissez d’abord l’exercice (début et fin) dans Paramètres.</p>';$('misBody').innerHTML='';return}
  $('misSub').textContent=`${C.nom} · exercice du ${dLong(x.deb)} au ${dLong(x.fin)}`;
  if(!MIS||MIS.ex!==x.id){$('misHead').innerHTML='<p class="note">Chargement…</p>';try{await loadMis()}catch(e){$('misHead').innerHTML='<p class="msg err">Lecture impossible pour le moment.</p>';return}}
  if(!MIS){$('misBody').innerHTML='';$('misHead').innerHTML=`<div style="margin-top:14px"><button class="pri big" id="misNew">Créer le dossier de mission de compilation pour cet exercice</button>
    <p class="note" style="margin-top:10px">Prépare tout le dossier d’un coup à partir des livres de l’exercice : acceptation et indépendance, lettre de mission, questionnaire de fin d’exercice, balance de vérification de travail, feuilles de travail par section (A à HH, 10 à 40), écritures d’ajustement, états financiers compilés avec rapport et notes, conciliation fiscale et DPA, déclaration de la direction et liste d’achèvement.${sampleFn?' L’IA analyse ensuite la balance pour proposer les ajustements de fin d’exercice, les questions au client et les explications des variations.':''}</p></div>`;return}
  const done=stepDone();$('misHead').innerHTML=`<div class="row" style="margin-top:10px;justify-content:space-between"><div class="row"><span class="pill ${MIS.statut==='terminée'?'ok':''}">${MIS.statut==='terminée'?'Mission terminée':'En cours'}</span><strong>${Object.values(done).filter(Boolean).length} / ${STEPS.length} étapes</strong></div>
    <div class="row"><button class="sm danger" id="misCancel" title="Supprime ce dossier de mission ; les livres ne sont pas touchés">Annuler la mission</button><button class="sm pri" id="misEfPdf">États financiers (PDF)</button><button class="sm" id="misWpPdf">Dossier de travail (PDF)</button>${sampleFn?'<button class="sm" id="misIa">Analyse IA</button>':''}</div></div>
    <div class="steps">${STEPS.map(([k,l])=>`<button data-ms="${k}" aria-pressed="${k===mStep}" class="${done[k]?'done':''}"><span class="dot"></span>${l}</button>`).join('')}</div>`;
  await renderStep()}
function stepDone(){const M=MIS;return{acc:ACC.every((_,i)=>M.acc['q'+i])&&!!M.acc.prep,let:!!M.lettre.signee,ent:!!(M.ent.activites&&M.ent.note1),q:QS.every((_,i)=>M.quest['q'+i]?.r),
  bv:!!M.bvOk,ws:!!(M.secs||[]).length&&M.secs.every(k=>M.ws[k]?.prep),aje:!!M.ajeDone,ef:!!M.ef.revu,fis:!!M.fisc.ok,dec:!!M.decl.signee,fin:M.statut==='terminée'}}
async function renderStep(){setTimeout(lockMis,0);const el=$('misBody');let d=null;
  if(['bv','ws','aje','ef','fis'].includes(mStep)){el.innerHTML='<div class="panel"><p class="note">Calcul…</p></div>';try{d=await misCalc()}catch(e){el.innerHTML='<div class="panel"><p class="msg err">Lecture des données impossible.</p></div>';return}}
  el.innerHTML=`<div class="panel">${stepHtml(mStep,d)}</div>`}
function stepHtml(k,d){const M=MIS;
  if(k==='acc')return `<h2>1. Acceptation ou maintien de la relation client</h2><p class="note">À remplir avant d’accepter la mission (NCSC 4200 : règles de déontologie, conditions de la mission convenues).</p>
    <table class="qa stack"><thead><tr><th>Point</th><th style="width:110px">Réponse</th><th>Commentaire</th></tr></thead><tbody>${ACC.map((q,i)=>`<tr><td>${esc(q)}</td><td>${mYn('acc.q'+i)}</td><td><input data-mk="acc.c${i}" value="${esc(M.acc['c'+i]||'')}"></td></tr>`).join('')}</tbody></table>
    <h3 style="margin-top:16px">Indépendance</h3><div class="row"><label class="row" style="gap:6px"><input type="radio" name="ind" data-mk="indep" value="oui" data-rr${M.indep!=='non'?' checked':''}> Le cabinet est indépendant de l’entité</label><label class="row" style="gap:6px"><input type="radio" name="ind" data-mk="indep" value="non" data-rr${M.indep==='non'?' checked':''}> Non indépendant (sera mentionné dans le rapport)</label></div>
    ${M.indep==='non'?mIn('indepRaison','Raison (facultatif dans le rapport, ex. tenue des livres par le cabinet)',{st:'margin-top:8px'}):''}${sign('acc')}`;
  if(k==='let')return `<h2>2. Lettre de mission</h2><div class="mgrid">${mIn('lettre.date','Date de la lettre',{type:'date',rr:1})}${mIn('lettre.ville','Ville',{rr:1})}${mIn('lettre.honoraires','Honoraires (texte, facultatif)',{rr:1})}</div>
    ${mTa('lettre.usage','Utilisation prévue des informations financières (« destinées à… »)',60,1)}${mCk('lettre.fiscal','Inclure la préparation des déclarations T2 et CO-17')}
    <div class="row" style="margin-top:10px"><button class="sm pri" data-pdf="let">Lettre de mission (PDF)</button></div><div class="paper"><div class="pg">${letHtml()}</div></div>${mCk('lettre.signee','Lettre signée par le client et classée au dossier')}`;
  if(k==='ent')return `<h2>3. Connaissance de l’entité et méthode de comptabilité</h2>${mTa('ent.activites','Nature des activités, principaux clients et fournisseurs, employés',80,1)}
    <div class="mgrid">${mIn('ent.forme','Forme juridique')}${mIn('ent.utilisateurs','Utilisateurs prévus')}</div>
    <label class="f" style="margin-top:8px">Méthode de comptabilité<select data-mk="ent.base" data-rr data-base>${[['ex','Comptabilité d’exercice, coût historique'],['caisse','Comptabilité de caisse'],['fisc','Base fiscale'],['perso','Personnalisée']].map(([v,l])=>`<option value="${v}"${M.ent.base===v?' selected':''}>${l}</option>`).join('')}</select></label>
    ${mTa('ent.note1','Note 1 des états financiers (modifiable)',120)}<p class="note">La NCSC 4200 exige que les informations compilées décrivent la méthode de comptabilité appliquée. Adaptez le texte à la situation du client.</p>`;
  if(k==='q')return `<h2>4. Questionnaire de fin d’exercice</h2><p class="note">Envoyez-le au client (PDF), puis inscrivez ses réponses. Les réponses « Oui » mènent souvent à un ajustement (étape 7).</p>
    <div class="row" style="margin:8px 0"><button class="sm pri" data-pdf="q">Questionnaire à envoyer au client (PDF)</button></div>
    <table class="qa stack"><thead><tr><th>Question</th><th style="width:110px">Réponse</th><th>Détails</th></tr></thead><tbody>${QS.map((q,i)=>`<tr><td>${i+1}. ${esc(q)}</td><td>${mYn('quest.q'+i+'.r')}</td><td><input data-mk="quest.q${i}.d" value="${esc(M.quest['q'+i]?.d||'')}"></td></tr>`).join('')}
    ${M.qx.map((q,i)=>`<tr><td>${QS.length+i+1}. ${esc(q.q)} <span class="pill">IA</span></td><td>${mYn('qx.'+i+'.r')}</td><td><input data-mk="qx.${i}.d" value="${esc(q.d||'')}"></td></tr>`).join('')}</tbody></table>`;
  if(k==='bv'){let D=0,K=0;const bal=d.accts.reduce((s,a)=>s+(d.cur.get(a)||0),0);M.bvOk=!d.todo&&!bal&&d.accts.length>0;saveMis();
    const rows=d.accts.map(a=>{const c=d.cur.get(a)||0,p=d.pre.get(a)||0;c>0?D+=c:K-=c;return `<tr><td><select data-map="${esc(a)}" style="min-height:32px;padding:2px 4px">${SECS.map(s=>`<option value="${s[0]}"${secOf(a)===s[0]?' selected':''}>${s[0]}</option>`).join('')}</select></td><td>${esc(a)} ${esc(accName(a))}</td><td class="num">${fmtN(d.prior?.get(a)||0)}</td><td class="num">${fmtN(p)}</td><td class="num">${fmtN(c-p)}</td><td class="num"><strong>${fmtN(c)}</strong></td></tr>`}).join('');
    return `<h2>5. Balance de vérification de travail au ${esc(d.x.fin)}</h2><p class="note">Préliminaire = livres avant ajustements; AJE = écritures d’ajustement de l’exercice; Final = base des états financiers. Débit positif, crédit négatif. La colonne Section relie chaque compte à sa feuille de travail; changez-la au besoin.</p>
    ${d.todo?`<p class="msg err">${d.todo} transaction(s) encore au compte transitoire ${esc(C.tr)} dans cet exercice : classez-les avant de finaliser.</p>`:''}
    <div class="scroll"><table class="rep"><tr class="sec"><td>Section</td><td>Compte</td><td class="num">N-1</td><td class="num">Préliminaire</td><td class="num">AJE</td><td class="num">Final</td></tr>${rows}
    <tr class="tot"><td></td><td>Total débits / crédits</td><td></td><td></td><td></td><td class="num">${fmtN(D)} / ${fmtN(K)}</td></tr></table></div><p class="${bal?'bad-b':'ok-b'}">${bal?'La balance ne balance pas : vérifiez les soldes d’ouverture.':'Débits = crédits.'}</p>`}
  if(k==='ws'){const secs=M.secs||[];if(!mSec||!secs.includes(mSec))mSec=secs[0]||'';if(!mSec)return '<h2>6. Feuilles de travail</h2><p class="note">Aucun solde dans cet exercice.</p>';
    const A=d.accts.filter(a=>secOf(a)===mSec),sg=['1','5','6','7','8','9'].includes(String(A[0]||'1')[0])?1:-1;let t=[0,0,0];
    const rows=A.map(a=>{const p=sg*(d.prior?.get(a)||0),c=sg*(d.cur.get(a)||0),pr=sg*(d.pre.get(a)||0),v=c-p,pc=p?v/Math.abs(p)*100:null,fl=Math.abs(v)>=100000&&(pc==null||Math.abs(pc)>=10);t[0]+=p;t[1]+=pr;t[2]+=c;
      return `<tr><td>${esc(a)} ${esc(accName(a))}</td><td class="num">${fmtP(p)}</td><td class="num">${fmtP(pr)}</td><td class="num">${fmtP(c-pr)}</td><td class="num"><strong>${fmtP(c)}</strong></td><td class="num${fl?' flag':''}">${fmtP(v)}</td><td class="num${fl?' flag':''}">${pc==null?'—':pc.toFixed(0)+' %'}</td></tr>`}).join('');
    const W=M.ws[mSec]||{};
    return `<h2>6. Feuilles de travail</h2><div class="steps">${secs.map(s=>`<button data-sec="${s}" aria-pressed="${s===mSec}" class="${M.ws[s]?.prep?'done':''}"><span class="dot"></span>${s} ${esc(SECN[s])}</button>`).join('')}</div>
    <h3 style="margin-top:16px">${mSec} — ${esc(SECN[mSec])} : sommaire</h3><div class="scroll"><table class="rep"><tr class="sec"><td>Compte</td><td class="num">N-1</td><td class="num">Préliminaire</td><td class="num">AJE</td><td class="num">Final</td><td class="num">Variation</td><td class="num">%</td></tr>${rows}
    <tr class="tot"><td>Total ${mSec}</td><td class="num">${fmtP(t[0])}</td><td class="num">${fmtP(t[1])}</td><td class="num">${fmtP(t[2]-t[1])}</td><td class="num">${fmtP(t[2])}</td><td class="num">${fmtP(t[2]-t[0])}</td><td></td></tr></table></div>
    <p class="note">En rouge : variations d’au moins 1 000 $ et 10 % à expliquer.</p><h3>Travaux</h3>${(PROC[mSec]||[]).map((p,i)=>mCk(`ws.${mSec}.p${i}`,esc(p),false)).join('')}
    ${mTa(`ws.${mSec}.expl`,'Explications des variations, pièces obtenues et conclusions',100)}${sign('ws.'+mSec)}`}
  if(k==='aje'){const ia=M.ia;let n=0;
    const rows=d.aje.map(e=>{n++;const ni=-e.lines.filter(([a])=>+String(a)[0]>=4).reduce((s,[,c])=>s+c,0);
      return `<tr><td class="d">${esc(e.date)}</td><td>${esc(e.ref)}</td><td>${esc(e.desc)}<div class="note">${e.lines.map(([a,c])=>`${esc(a)} ${esc(accName(a))} : ${c>0?'Dt '+fmtN(c):'Ct '+fmtN(-c)}`).join(' · ')}</div></td><td class="num">${fmtP(ni)}</td><td><label class="row" style="gap:6px"><input type="checkbox" data-mk="ajeOk.${esc(e.id)}"${M.ajeOk[e.id]?' checked':''}> Approuvée</label></td></tr>`}).join('');
    return `<h2>7. Écritures d’ajustement de fin d’exercice (AJE)</h2><p class="note">Les AJE sont des écritures de journal de type « Ajustement de fin d’exercice », datées dans l’exercice. Elles mettent à jour la balance, les feuilles de travail et les états financiers.</p>
    <div class="row" style="margin:8px 0"><button class="sm pri" id="ajeNew">Nouvelle écriture d’ajustement</button>${sampleFn?'<button class="sm" id="misIa2">Proposer les ajustements avec l’IA</button>':''}</div>
    <div class="scroll"><table class="stack"><thead><tr><th>Date</th><th>Réf.</th><th>Écriture</th><th class="num">Effet sur le bénéfice</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="empty">Aucune écriture d’ajustement pour l’instant.</td></tr>'}</tbody></table></div>
    ${ia&&ia.aje?.length?`<h3 style="margin-top:16px">Ajustements proposés par l’IA (${esc((ia.date||'').slice(0,10))})</h3><ul class="chk">${ia.aje.map((a,i)=>`<li class="warn"><div><strong>${esc(a.desc||'')}</strong><span>${esc(a.raison||'')}${(a.lignes||[]).length?' — '+a.lignes.map(l=>`${esc(l.compte)} ${l.debit?'Dt '+esc(l.debit):''}${l.credit?'Ct '+esc(l.credit):''}`).join(' · '):''}</span></div><button class="sm" data-iaje="${i}">Préparer l’écriture</button></li>`).join('')}</ul>`:''}
    ${mCk('ajeDone','Toutes les écritures d’ajustement ont été passées en revue et approuvées par la direction')}`}
  if(k==='ef'){const m=efModel(d),fa=m.pages[6].notes.find(n=>n.bl)?.bl.find(b=>typeof b!=='string');
    return `<h2>8. États financiers compilés</h2><p class="note">Format du cabinet : page titre, table des matières, rapport de mission de compilation, résultats, bénéfices non répartis, bilan et notes, montants arrondis au dollar.</p>
    <div class="mgrid">${mIn('ef.dateRapport','Date du rapport',{type:'date',rr:1})}${mIn('ef.ville','Ville',{rr:1})}${mIn('approb.prep','CPA signataire (nom)',{rr:1})}${mIn('ef.permis','Permis de CPA nº',{rr:1})}${mIn('ef.constit','Date de constitution',{type:'date',rr:1})}${mIn('ef.actions','Actions émises et payées (ex. 100 actions ordinaires)',{rr:1})}${mIn('ef.chLbl','Titre des charges à l’état des résultats',{rr:1})}</div>
    ${mTa('ent.activites','Nature des activités (note 1 : « Elle oeuvre dans… »), ex. la location d’immeubles',50,1)}
    <div class="row">${mCk('ef.arr','Arrondir au dollar')}${mCk('ef.nous','Rapport au « nous » (plusieurs associés)')}${mCk('ef.nDette','Note Dette à long terme')}${mCk('ef.nAct','Note Somme due à l’actionnaire')}</div>
    <details style="margin-top:8px"><summary>Textes des notes, méthodes d’amortissement et chiffres comparatifs</summary>${mTa('ef.statut','Note 1 en entier (laisser vide pour le texte automatique)',50,1)}${mTa('ent.note1','Note 2 : introduction',60,1)}
    ${fa&&fa.tab.length?`<table class="qa" style="margin-top:8px"><tr><th>Immobilisation</th><th>Méthode</th><th>Taux</th></tr>${fa.tab.map(r=>`<tr><td>${esc(r[0])}</td><td><input data-mk="ef.amo.${r[3]}.m" value="${esc(r[1])}" data-rr></td><td><input data-mk="ef.amo.${r[3]}.t" value="${esc(r[2])}" data-rr></td></tr>`).join('')}</table>`:''}
    ${mTa('ef.capAut','Capital-actions : texte « Autorisé » (facultatif)',40,1)}${mTa('ef.dette','Dette à long terme : modalités',50,1)}${mTa('ef.act','Somme due à l’actionnaire',40,1)}
    ${d.priorIS?'':mTa('ef.prevIS','Résultats de l’exercice précédent (un compte par ligne : numéro puis montant, débit positif, crédit négatif) — pour les chiffres comparatifs',90,1)}</details>
    <div class="row" style="margin-top:10px"><button class="sm pri" data-pdf="ef">Télécharger les états financiers (PDF)</button></div>
    <div class="paper efp" id="efPaper">${efPreview(m)}</div>${mCk('ef.revu','États financiers lus en entier et comparés à l’exercice précédent')}`}
  if(k==='fis'){const f=fsCalc(d),sumA=re=>d.accts.filter(a=>+String(a)[0]>=5&&re.test(norm(accName(a)))).reduce((s,a)=>s+(d.cur.get(a)||0),0);
    const am=sumA(/AMORTISSEMENT/),rep=Math.round(sumA(/REPAS|REPRESENTATION|DIVERTISSEMENT/)/2),pen=sumA(/AMENDE|PENALITE/),imp=sumA(/IMPOTS? SUR LE REVENU/),dons=sumA(/\bDONS?\b|BIENFAISANCE/);
    const dpa=(M.fisc.dpa||[]).map(r=>{const f0=cents(r.fnacc),ac=cents(r.acq),di=cents(r.disp),t=parseFloat(String(r.taux).replace(',','.'))/100||0,fa=parseFloat(String(r.f||'1').replace(',','.'))||1,net=ac-di,base=f0+(net>0?net*fa:net),x=Math.max(0,Math.round(base*t));return{...r,f0,ac,di,x,fin:f0+net-x,rec:f0+net<0}});
    const tDpa=dpa.reduce((s,r)=>s+r.x,0),aut=(M.fisc.autres||[]).reduce((s,r)=>s+cents(r.m),0),ri=f.cur.ni+am+rep+pen+imp+dons-tDpa+aut,tx=parseFloat(String(M.fisc.taux).replace(',','.'))||0;
    const L=(l,c,k)=>`<tr${k?` class="${k}"`:''}><td${k?'':' class="ind"'}>${l}</td><td class="num">${fmtP(c)}</td></tr>`;
    return `<h2>9. Conciliation fiscale et DPA</h2><h3>Conciliation du bénéfice net et du revenu imposable (annexe 1 / CO-17)</h3><table class="rep">${L('Bénéfice net (perte) selon les états financiers',f.cur.ni,'sub')}
      ${L('Plus : amortissement comptable',am)}${L('Plus : 50 % des repas et frais de représentation',rep)}${L('Plus : amendes et pénalités',pen)}${L('Plus : impôts sur le revenu',imp)}${L('Plus : dons (déduits séparément)',dons)}${L('Moins : déduction pour amortissement (DPA)',-tDpa)}
      ${(M.fisc.autres||[]).map((r,i)=>`<tr><td class="ind"><input data-mk="fisc.autres.${i}.l" value="${esc(r.l||'')}" placeholder="Autre ajustement"></td><td class="num"><input data-mk="fisc.autres.${i}.m" value="${esc(r.m||'')}" data-rr inputmode="decimal" style="width:120px;text-align:right"></td></tr>`).join('')}
      ${L('Revenu imposable estimé',ri,'tot')}</table><button class="sm" data-add="autres">+ Autre ajustement</button>
      <div class="row" style="margin-top:10px;align-items:flex-end">${mIn('fisc.taux','Taux combiné d’impôt (%) — facultatif',{st:'width:220px',rr:1})}${tx?`<strong>Impôt estimé : ${fmtN(Math.round(Math.max(0,ri)*tx/100))} $</strong>`:''}</div>
      <p class="note">Vérifiez les taux applicables (déduction pour petite entreprise, revenu de placement, etc.) avant de vous fier à cette estimation.</p>
      <h3 style="margin-top:16px">Tableau de la DPA (annexe 8)</h3><div class="scroll"><table class="rep"><tr class="sec"><td>Catégorie</td><td>Description</td><td class="num">FNACC début</td><td class="num">Acquisitions</td><td class="num">Dispositions</td><td class="num">Taux %</td><td class="num">Facteur 1re année</td><td class="num">DPA</td><td class="num">FNACC fin</td></tr>
      ${dpa.map((r,i)=>`<tr>${['cl','desc','fnacc','acq','disp','taux','f'].map(q=>`<td><input data-mk="fisc.dpa.${i}.${q}" value="${esc(r[q]??(q==='f'?'1':''))}" data-rr style="width:${q==='desc'?'150':'90'}px;min-height:30px;padding:2px 6px"${q!=='desc'&&q!=='cl'?' inputmode="decimal"':''}></td>`).join('')}<td class="num">${fmtN(r.x)}</td><td class="num${r.rec?' flag':''}">${fmtP(r.fin)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="7">Total de la DPA</td><td class="num">${fmtN(tDpa)}</td><td></td></tr></table></div><button class="sm" data-add="dpa">+ Catégorie</button>
      <p class="note">Facteur 1re année appliqué aux acquisitions nettes : 0,5 (règle de la demi-année), 1 (aucun ajustement) ou 1,5 (incitatif à l’investissement accéléré). Vérifiez la règle en vigueur pour la date de mise en service. Un FNACC négatif (en rouge) indique une récupération d’amortissement.</p>
      <h3 style="margin-top:16px">Conciliation des bénéfices non répartis</h3><table class="rep">${L('Solde au début',f.cur.deb||0)}${L('Bénéfice net',f.cur.ni)}${L('Dividendes',f.cur.div?-f.cur.div:0)}${L('Redressements et autres',f.cur.oth)}${L('Solde à la fin',f.cur.re,'tot')}</table>
      <div class="row" style="margin-top:10px"><button class="sm" id="toGifi">Ouvrir le rapport IGRF (T2)</button></div>${mCk('fisc.ok','Conciliation fiscale, DPA et IGRF révisées')}`}
  if(k==='dec')return `<h2>10. Déclaration de la direction</h2><div class="mgrid">${mIn('decl.date','Date (habituellement celle du rapport)',{type:'date',rr:1})}</div>
    <div class="row" style="margin-top:10px"><button class="sm pri" data-pdf="dec">Lettre de déclaration (PDF)</button></div><div class="paper"><div class="pg">${decHtml()}</div></div>${mCk('decl.signee','Déclaration signée par la direction et classée au dossier')}`;
  if(k==='fin'){const done=stepDone();return `<h2>11. Achèvement et approbation</h2><ul class="chk">${STEPS.slice(0,-1).map(([s,l])=>`<li class="${done[s]?'ok':'warn'}"><div><strong>${l}</strong><span>${done[s]?'Complétée':'À compléter'}</span></div><button class="sm" data-ms="${s}">Ouvrir</button></li>`).join('')}</ul>
    <h3 style="margin-top:14px">Liste d’achèvement</h3>${FINCHK.map((p,i)=>mCk('ach.c'+i,esc(p),false)).join('')}
    <div class="row" style="margin-top:10px;align-items:flex-end">${mIn('approb.prep','Préparé par (CPA)',{st:'width:180px'})}${mIn('approb.prepDate','Date',{type:'date'})}${mIn('approb.rev','Révisé par',{st:'width:180px'})}${mIn('approb.revDate','Date',{type:'date'})}${mIn('approb.dirDate','Approbation des états financiers par la direction',{type:'date'})}</div>
    <div class="row" style="margin-top:12px">${MIS.statut==='terminée'?'<button id="misReopen">Rouvrir la mission</button>':'<button class="pri" id="misDone">Terminer la mission</button>'}<button class="sm" id="misToClose">Fermer l’exercice (Paramètres)</button><button class="sm danger" id="misDel">Supprimer le dossier de mission</button></div>
    <p class="note">Une fois la mission terminée, fermez l’exercice pour verrouiller les livres et reporter les soldes à l’exercice suivant.</p>`}
  return ''}

/* --- événements --- */
$('tMis').addEventListener('input',e=>{const p=e.target.dataset.mk;if(!p||!MIS||e.target.type==='checkbox'||e.target.type==='radio'||e.target.tagName==='SELECT')return;sp(MIS,p,e.target.value);saveMis()});
$('tMis').addEventListener('change',async e=>{const t=e.target;if(!MIS)return;
  if(t.dataset.map){if(t.value===secAuto(t.dataset.map))delete MIS.map[t.dataset.map];else MIS.map[t.dataset.map]=t.value;saveMis();renderStep();return}
  const p=t.dataset.mk;if(!p)return;const v=t.type==='checkbox'?t.checked:t.value;if(t.type==='radio'&&!t.checked)return;sp(MIS,p,v);
  if(t.dataset.base!=null&&NOTE1[v])MIS.ent.note1=NOTE1[v];saveMis();if(t.dataset.rr!=null){const y=window.scrollY;await renderMis();window.scrollTo(0,y)}});
$('tMis').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='misNew'){b.disabled=true;$('misMsg').textContent='Création du dossier…';const x=curEx();MIS=newMis(x);if(C.notes)MIS.ent.activites=C.notes;MIS.ef.dateRapport='';mStep='acc';
    try{await misCalc()}catch(err){}saveMis();await renderMis();$('misMsg').textContent='Dossier créé : toutes les étapes sont prêtes.'+(sampleFn?' Analyse de la balance par l’IA…':'');if(sampleFn)iaMis();return}
  if(b.dataset.ms){mStep=b.dataset.ms;await renderMis();navPush();return}
  if(b.dataset.sec){mSec=b.dataset.sec;renderStep();return}
  if(b.dataset.add==='dpa'){MIS.fisc.dpa.push({cl:'',desc:'',fnacc:'',acq:'',disp:'',taux:'',f:'1'});saveMis();renderStep();return}
  if(b.dataset.add==='autres'){MIS.fisc.autres.push({l:'',m:''});saveMis();renderStep();return}
  if(b.dataset.pdf){misPdf(b.dataset.pdf,b);return}
  if(b.id==='misEfPdf'){misPdf('ef',b);return}if(b.id==='misWpPdf'){misPdf('wp',b);return}
  if(b.id==='misIa'||b.id==='misIa2'){iaMis();return}
  if(b.id==='ajeNew'){const x=curEx();const n=(LED||[]).filter(e=>e.aje&&e.date>=x.deb&&e.date<=x.fin).length+1;setTab('je');jeOpen({ref:'AJE-'+String(n).padStart(2,'0'),date:x.fin,type:'aje',desc:''});return}
  if(b.dataset.iaje!=null){const a=MIS.ia.aje[+b.dataset.iaje],x=curEx();const n=(LED||[]).filter(e=>e.aje&&e.date>=x.deb&&e.date<=x.fin).length+1;
    const lines=(a.lignes||[]).map(l=>({a:String(l.compte||''),d:Math.round((+l.debit||0)*100),c:Math.round((+l.credit||0)*100)}));setTab('je');
    jeOpen({ref:'AJE-'+String(n).padStart(2,'0'),date:x.fin,type:'aje',desc:String(a.desc||'').slice(0,120),lines:lines.length?lines:[{},{}]});
    $('jeErr').textContent=lines.some(l=>l.a&&!PLAN.some(p=>p[0]===l.a))?'Un compte proposé n’existe pas au plan : choisissez-en un autre ou créez-le.':'Vérifiez les comptes et les montants, puis enregistrez.';return}
  if(b.id==='toGifi'){REP='gifi';setTab('rep');document.querySelectorAll('[data-r]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.r==='gifi'));runRep(true);return}
  if(b.id==='misDone'){MIS.statut='terminée';MIS.termineLe=new Date().toISOString();saveMis();renderMis();return}
  if(b.id==='misReopen'){MIS.statut='en cours';saveMis();renderMis();return}
  if(b.id==='misToClose'){setTab('set');$('yearEnd').scrollIntoView({behavior:'smooth',block:'center'});return}
  if(b.id==='misDel'||b.id==='misCancel')confirm2(b,'',async()=>{try{if(local)delete(LOCAL.mis||{})[C.id+'/'+C.exCur];else await db.collection('clients').doc(C.id).collection('missions').doc(C.exCur).delete();MIS=null;renderMis()}catch(err){b.textContent='Erreur'}})});

/* --- IA --- */
async function iaMis(){if(!sampleFn||!MIS)return;const say=t=>$('misMsg').textContent=t;say('L’IA analyse la balance de l’exercice…');
  try{const d=await misCalc();const bv=d.accts.map(a=>`${a} ${accName(a)} [${secOf(a)}] | N-1 ${((d.prior?.get(a)||0)/100).toFixed(2)} | N ${((d.cur.get(a)||0)/100).toFixed(2)}`).join('\n');
    const qa=QS.map((q,i)=>MIS.quest['q'+i]?.r?`- ${q} → ${MIS.quest['q'+i].r} ${MIS.quest['q'+i].d||''}`:'').filter(Boolean).join('\n');
    const r=await sampleFn.json(`Tu es un CPA québécois qui prépare une mission de compilation (NCSC 4200) pour ${C.nom}, exercice du ${d.x.deb} au ${d.x.fin}.
Balance de vérification (débit positif, crédit négatif; [section de feuille de travail]) :
${bv}
${d.todo?`Attention : ${d.todo} transactions sont encore au compte transitoire ${C.tr}.`:''}
Notes du dossier : ${C.notes||'aucune'}
Réponses du client au questionnaire :
${qa||'aucune pour l’instant'}
Plan comptable disponible :
${PLAN.filter(([n,t])=>!isHeader(n,t)).map(p=>p.join(' ')).join('\n')}

1) Propose les écritures d’ajustement de fin d’exercice probables (amortissement, frais payés d’avance, charges à payer dont les honoraires de compilation, reclassements de soldes anormaux, salaire ou dividende de l’actionnaire, TPS/TVQ, impôts). Utilise uniquement des numéros de comptes du plan. Mets un montant seulement s’il se calcule à partir des données; sinon montant 0 et explique ce qu’il faut obtenir.
2) Liste au plus 8 questions précises à poser au client, qui ne répètent pas le questionnaire standard.
3) Pour chaque section qui présente une variation importante, une explication courte des causes probables à confirmer.
Réponds uniquement en JSON : {"ajustements":[{"desc":"","raison":"","lignes":[{"compte":"","debit":0,"credit":0}]}],"questions":[""],"variations":{"A":""}}`,{modelTier:'complex'});
    MIS.ia={date:new Date().toISOString(),aje:(r?.ajustements||[]).slice(0,15)};
    const known=new Set(MIS.qx.map(q=>q.q));(r?.questions||[]).slice(0,8).forEach(q=>{q=String(q||'').trim();if(q&&!known.has(q))MIS.qx.push({q,r:'',d:''})});
    Object.entries(r?.variations||{}).forEach(([s,t])=>{if(SECN[s]&&t){MIS.ws[s]=MIS.ws[s]||{};if(!MIS.ws[s].expl)MIS.ws[s].expl='[Proposé par l’IA — à confirmer] '+String(t)}});
    saveMis();await renderMis();say(`Analyse terminée : ${MIS.ia.aje.length} ajustement(s) proposé(s) (étape 7), ${MIS.qx.length} question(s) ajoutée(s) au questionnaire (étape 4), explications des variations dans les feuilles de travail (étape 6). Tout est à valider.`)}
  catch(e){say('Analyse par l’IA impossible pour le moment. Le dossier reste complet; vous pourrez relancer l’analyse.')}}

/* --- PDF --- */
async function pdfOf(root,file){if(!downloads)throw{code:'nodl'};
  if(!window.jspdf)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');if(!window.jspdf.jsPDF.API.autoTable)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'pt',format:'letter'});const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),X=60,TW=W-2*X;
  const cl=t=>String(t||'').replace(/[   ]/g,' ').replace(/[✓✗→⚠]/g,'').replace(/[’‘]/g,"'").replace(/[“”«»]/g,'"').replace(/[–—]/g,'-').replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/…/g,'...').replace(/\s+/g,' ').trim();
  let y=64;const room=n=>{if(y+n>H-60){doc.addPage();y=64}};const foots=[];
  [...root.children].forEach((pg,pi)=>{if(pi>0){doc.addPage();y=64}const p0=doc.getNumberOfPages();
    const walk=el=>{for(const n of el.children){const tg=n.tagName,c=n.classList.contains('c');
      if(tg==='TABLE'){const ncol=Math.max(...[...n.rows].map(r=>[...r.cells].reduce((s,x)=>s+x.colSpan,0)));
        const body=[...n.rows].map(r=>{const k=r.className;return[...r.cells].map(x=>({content:cl(x.querySelector('input,select')?.value??x.textContent),colSpan:x.colSpan,styles:{halign:x.classList.contains('num')?'right':'left',fontStyle:/sec|grp|sub|tot/.test(k)?'bold':'normal',cellPadding:{top:2.5,bottom:2.5,left:x.classList.contains('ind')?16:4,right:4},fillColor:/sec/.test(k)&&!n.classList.contains('fs')?[238,241,246]:false}}))});
        const fs=n.classList.contains('fs');doc.autoTable({startY:y,body,theme:'plain',margin:{left:fs?X+30:X,right:fs?X+30:X},styles:{fontSize:fs?9.5:8.5,textColor:20},columnStyles:fs?{1:{cellWidth:90},2:{cellWidth:90}}:{},
          didDrawCell:dd=>{const k=n.rows[dd.row.index]?.className||'';if(dd.column.index===0&&ncol>1)return;if(/tot/.test(k)&&(dd.cell.raw.content||'')!==''){doc.setDrawColor(0);doc.setLineWidth(.7);doc.line(dd.cell.x+4,dd.cell.y,dd.cell.x+dd.cell.width,dd.cell.y);doc.line(dd.cell.x+4,dd.cell.y+dd.cell.height-1,dd.cell.x+dd.cell.width,dd.cell.y+dd.cell.height-1);doc.line(dd.cell.x+4,dd.cell.y+dd.cell.height+1,dd.cell.x+dd.cell.width,dd.cell.y+dd.cell.height+1)}else if(/sub/.test(k)&&(dd.cell.raw.content||'')!==''){doc.setDrawColor(0);doc.setLineWidth(.5);doc.line(dd.cell.x+4,dd.cell.y,dd.cell.x+dd.cell.width,dd.cell.y)}}});
        y=doc.lastAutoTable.finalY+12;continue}
      if(tg==='H1'||tg==='H2'||tg==='H3'){const sz=tg==='H1'?15:tg==='H2'?12.5:11;room(sz*2.4);y+=tg==='H3'?6:4;doc.setFont('helvetica','bold');doc.setFontSize(sz);const L=doc.splitTextToSize(cl(n.textContent),TW);doc.text(L,c?W/2:X,y,{align:c?'center':'left'});y+=L.length*sz*1.25+4;continue}
      if(n.classList.contains('sig')){room(56);y+=30;doc.setDrawColor(0);doc.setLineWidth(.6);doc.line(X,y,X+220,y);doc.setFont('helvetica','normal');doc.setFontSize(9);const L=n.innerHTML.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').split('\n').map(x=>cl(x.replace(/&amp;/g,'&'))).filter(Boolean);doc.text(L,X,y+12);y+=L.length*11+16;continue}
      if(tg==='P'||tg==='LI'||tg==='LABEL'){const t=cl(n.textContent);if(!t)continue;const it=n.classList.contains('i'),b=!!n.querySelector('strong')&&cl(n.querySelector('strong').textContent)===t;doc.setFont('helvetica',b?'bold':it?'italic':'normal');doc.setFontSize(10);
        const pre=tg==='LI'?(n.parentElement.tagName==='OL'?([...n.parentElement.children].indexOf(n)+1)+'. ':'- '):'';const ind=tg==='LI'?14:0;const L=doc.splitTextToSize(pre+t,TW-ind);room(L.length*13+6);doc.text(L,c?W/2:X+ind,y+9,{align:c?'center':'left'});y+=L.length*13+7;continue}
      if(tg==='DIV'&&!n.children.length){const h=parseInt(n.style.height)||0;if(h){y+=h*0.75;continue}}
      if(n.children.length)walk(n)}};
    walk(pg);foots.push([p0,doc.getNumberOfPages(),pg.dataset.foot||'']);});
  const nP=doc.getNumberOfPages();for(let i=1;i<=nP;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(120);
    const f=foots.find(([a,b])=>i>=a&&i<=b);if(f&&f[2])doc.text(cl(f[2]),W/2,H-28,{align:'center'});doc.text(`${cl(C.nom)} · ${i} / ${nP}`,W-X,H-28,{align:'right'});doc.setTextColor(0)}
  await downloads.save({filename:file.replace(/[^\w.-]+/g,'_'),data:new Uint8Array(doc.output('arraybuffer'))})}
function wpHtml(d){const M=MIS,pg=(t,b,f='')=>`<div class="pg"${f?` data-foot="${esc(f)}"`:''}><h2>${t}</h2>${b}</div>`,ans=v=>esc(v||'—'),done=stepDone(),nom=esc(C.nom);
  const so=o=>`<p>Préparé par : ${esc(o?.prep||'____')} le ${esc(o?.prepD||'____')} · Révisé par : ${esc(o?.rev||'____')} le ${esc(o?.revD||'____')}</p>`;
  let h=`<div class="pg"><div style="height:100px"></div><h1 class="c">${nom}</h1><p class="c">Dossier de travail — mission de compilation (NCSC 4200)</p><p class="c">Exercice du ${dLong(M.deb)} au ${dLong(M.fin)}</p><div style="height:40px"></div>
    <h3>Index</h3><table class="rep">${STEPS.map(([k,l])=>`<tr><td>${l}</td><td class="num">${done[k]?'Complétée':'À compléter'}</td></tr>`).join('')}</table></div>`;
  h+=pg('1. Acceptation ou maintien',`<table class="rep"><tr class="sec"><td>Point</td><td>Réponse</td><td>Commentaire</td></tr>${ACC.map((q,i)=>`<tr><td>${esc(q)}</td><td>${ans(M.acc['q'+i])}</td><td>${esc(M.acc['c'+i]||'')}</td></tr>`).join('')}</table><p>Indépendance : ${M.indep==='non'?'non indépendant'+(M.indepRaison?' ('+esc(M.indepRaison)+')':''):'indépendant'}</p>${so(M.acc)}`);
  h+=`<div class="pg"><h2>2. Lettre de mission</h2>${letHtml()}<p>Statut : ${M.lettre.signee?'signée et classée':'non signée'}</p></div>`;
  h+=pg('3. Entité et méthode de comptabilité',`<h3>Activités</h3><p>${ans(M.ent.activites)}</p><p>Forme juridique : ${esc(M.ent.forme)}</p><p>Utilisateurs prévus : ${esc(M.ent.utilisateurs)}</p><h3>Note 1</h3><p>${esc(M.ent.note1)}</p>`);
  h+=pg('4. Questionnaire de fin d’exercice',`<table class="rep"><tr class="sec"><td>Question</td><td>Réponse</td><td>Détails</td></tr>${QS.map((q,i)=>`<tr><td>${i+1}. ${esc(q)}</td><td>${ans(M.quest['q'+i]?.r)}</td><td>${esc(M.quest['q'+i]?.d||'')}</td></tr>`).join('')}${M.qx.map((q,i)=>`<tr><td>${QS.length+i+1}. ${esc(q.q)}</td><td>${ans(q.r)}</td><td>${esc(q.d||'')}</td></tr>`).join('')}</table>`);
  h+=pg('5. Balance de vérification de travail',`<table class="rep"><tr class="sec"><td>Sect.</td><td>Compte</td><td class="num">N-1</td><td class="num">Préliminaire</td><td class="num">AJE</td><td class="num">Final</td></tr>${d.accts.map(a=>{const c=d.cur.get(a)||0,p=d.pre.get(a)||0;return `<tr><td>${secOf(a)}</td><td>${esc(a)} ${esc(accName(a))}</td><td class="num">${fmtN(d.prior?.get(a)||0)}</td><td class="num">${fmtN(p)}</td><td class="num">${fmtN(c-p)}</td><td class="num">${fmtN(c)}</td></tr>`}).join('')}</table>`);
  (M.secs||[]).forEach(s=>{const A=d.accts.filter(a=>secOf(a)===s),sg=['1','5','6','7','8','9'].includes(String(A[0]||'1')[0])?1:-1,W=M.ws[s]||{};
    h+=pg(`6. Feuille ${s} — ${esc(SECN[s])}`,`<table class="rep"><tr class="sec"><td>Compte</td><td class="num">N-1</td><td class="num">Préliminaire</td><td class="num">AJE</td><td class="num">Final</td><td class="num">Variation</td></tr>${A.map(a=>{const p=sg*(d.prior?.get(a)||0),c=sg*(d.cur.get(a)||0),pr=sg*(d.pre.get(a)||0);return `<tr><td>${esc(a)} ${esc(accName(a))}</td><td class="num">${fmtP(p)}</td><td class="num">${fmtP(pr)}</td><td class="num">${fmtP(c-pr)}</td><td class="num">${fmtP(c)}</td><td class="num">${fmtP(c-p)}</td></tr>`}).join('')}</table>
      <h3>Travaux</h3><ul>${(PROC[s]||[]).map((p,i)=>`<li>[${W['p'+i]?'X':' '}] ${esc(p)}</li>`).join('')}</ul><h3>Explications et conclusions</h3><p>${ans(W.expl)}</p>${so(W)}`)});
  h+=pg('7. Écritures d’ajustement',`<table class="rep"><tr class="sec"><td>Réf.</td><td>Compte</td><td class="num">Débit</td><td class="num">Crédit</td></tr>${d.aje.map(e=>`<tr class="grp"><td>${esc(e.ref)}</td><td colspan="3">${esc(e.date)} — ${esc(e.desc)} ${M.ajeOk[e.id]?'(approuvée)':'(à approuver)'}</td></tr>${e.lines.map(([a,c])=>`<tr><td></td><td>${esc(a)} ${esc(accName(a))}</td><td class="num">${c>0?fmtN(c):''}</td><td class="num">${c<0?fmtN(-c):''}</td></tr>`).join('')}`).join('')||'<tr><td colspan="4">Aucune écriture d’ajustement.</td></tr>'}</table>`);
  const tmp=document.createElement('div');tmp.innerHTML=stepHtml('fis',d);tmp.querySelectorAll('button,.note,label').forEach(x=>x.remove());
  h+=`<div class="pg"><h2>9. Conciliation fiscale et DPA</h2>${[...tmp.querySelectorAll('h3,table')].map(x=>x.outerHTML).join('')}</div>`;
  h+=`<div class="pg"><h2>10. Déclaration de la direction</h2>${decHtml()}<p>Statut : ${M.decl.signee?'signée et classée':'non signée'}</p></div>`;
  h+=pg('11. Achèvement',`<ul>${FINCHK.map((p,i)=>`<li>[${M.ach?.['c'+i]?'X':' '}] ${esc(p)}</li>`).join('')}</ul><p>Préparé par : ${esc(M.approb.prep||'____')} le ${esc(M.approb.prepDate||'____')} · Révisé par : ${esc(M.approb.rev||'____')} le ${esc(M.approb.revDate||'____')}</p><p>États financiers approuvés par la direction le ${esc(M.approb.dirDate||'____')}</p><p>Statut de la mission : ${esc(M.statut)}</p>`);
  return h}
async function misPdf(kind,btn){const say=t=>$('misMsg').textContent=t;if(!downloads){say('Téléchargement indisponible dans cette vue.');return}btn.disabled=true;say('Préparation du PDF…');
  try{const root=document.createElement('div');let name=C.nom+'_';const fy=MIS.fin;
    if(kind==='let'){root.innerHTML=`<div class="pg">${letHtml()}</div>`;name+='Lettre_de_mission_'+fy}
    else if(kind==='dec'){root.innerHTML=`<div class="pg">${decHtml()}</div>`;name+='Declaration_de_la_direction_'+fy}
    else if(kind==='q'){root.innerHTML=`<div class="pg"><h1>${esc(C.nom)}</h1><h2>Questionnaire de fin d’exercice — exercice clos le ${dLong(MIS.fin)}</h2><p>Merci de répondre à chaque question et de joindre les documents demandés.</p><table class="rep"><tr class="sec"><td>Question</td><td>Oui / Non</td><td>Détails</td></tr>${[...QS,...MIS.qx.map(q=>q.q)].map((q,i)=>`<tr><td>${i+1}. ${esc(q)}</td><td>${esc((i<QS.length?MIS.quest['q'+i]?.r:MIS.qx[i-QS.length]?.r)||'')}</td><td>${esc((i<QS.length?MIS.quest['q'+i]?.d:MIS.qx[i-QS.length]?.d)||'')}</td></tr>`).join('')}</table><div class="sig">Signature de la direction et date</div></div>`;name+='Questionnaire_'+fy}
    else{const d=await misCalc();if(kind==='ef'){await efPdf(efModel(d),name+'Informations_financieres_'+fy+'.pdf');say('PDF enregistré.');btn.disabled=false;return}else{root.innerHTML=wpHtml(d);name+='Dossier_de_travail_'+fy}}
    await pdfOf(root,name+'.pdf');say('PDF enregistré.')}
  catch(e){say(e?.code==='declined'?'Téléchargement annulé.':'Création du PDF impossible.')}btn.disabled=false}

$('perAll').onchange=loadPeriods;$('jeAll').onchange=renderJe;


/* ---------- paie ---------- */
/* Taux 2026 (Revenu Québec, ARC, EDSC) */
const PR={2026:{rrq:{mga:74600,exe:3500,t:6.30,mga2:85000,t2:4},rqap:{max:103000,e:.430,r:.602},ae:{max:68900,e:1.30,r:1.82},cnt:{max:103000,t:.06},
  fed:{br:[[58523,14],[117045,20.5],[181440,26],[258482,29],[1e12,33]],bpa:16452,ab:16.5},qc:{br:[[54345,14],[108680,19],[132245,24],[1e12,25.75]],bpa:18952}}};
const prOf=y=>PR[y]||PR[Math.max(...Object.keys(PR).map(Number))];
const FREQ={1:'Annuelle (ou prime unique)',12:'Mensuelle',24:'Bimensuelle',26:'Aux deux semaines',52:'Hebdomadaire'};
let PAY=[];
const payCol=()=>db.collection('clients').doc(C.id).collection('paies');
async function loadPay(){PAY=[];try{if(local)PAY=Object.entries(LOCAL.pay||{}).filter(([k])=>k.startsWith(C.id+'/')).map(([k,v])=>({id:k.split('/')[1],...v}));else{const s=await payCol().get();PAY=s.docs.map(d=>({id:d.id,...d.data()}))}}catch(e){}PAY.sort((a,b)=>a.date.localeCompare(b.date));return PAY}
const pset=()=>{C.paie=C.paie||{};const s=C.paie;return{fss:s.fss??1.65,cnesst:s.cnesst??0,sal:s.sal||findAcc(/SALAIRE|REMUNERATION/,true)||'',chg:s.chg||findAcc(/CHARGES? SOCIALES|AVANTAGES SOCIAUX|COTISATIONS? D.?EMPLOYEUR/,true)||'',
  das:s.das||findAcc(/DAS|RETENUES? A LA SOURCE|SOMMES A REMETTRE|DEDUCTIONS A LA SOURCE|REMISES/)||'',net:s.net||findAcc(/SALAIRES? A PAYER|PAIE A PAYER/)||C.paie.net||''}};
const brk=(A,br)=>{let t=0,lo=0;for(const[hi,r]of br){if(A>lo)t+=(Math.min(A,hi)-lo)*r/100;lo=hi}return t};
function payCalc(emp,date,brut,ovr={}){const y=+date.slice(0,4),R=prOf(y),P=+emp.freq||12,g=brut/100;
  const ytd=PAY.filter(p=>p.emp===emp.id&&p.date.slice(0,4)===String(y)&&p.date<date).reduce((s,p)=>s+(p.c?.brut||0)/100,0);
  const r2=x=>Math.round(x*100);const cap=(max,v)=>Math.max(0,Math.min(v,max-ytd));
  const rrqMax=(R.rrq.mga-R.rrq.exe)*R.rrq.t/100,rrqYtd=PAY.filter(p=>p.emp===emp.id&&p.date.slice(0,4)===String(y)&&p.date<date).reduce((s,p)=>s+(p.c?.rrq||0)/100,0);
  const rrq=Math.max(0,Math.min(Math.max(0,Math.min(g,Math.max(0,R.rrq.mga-ytd))-R.rrq.exe/P)*R.rrq.t/100,rrqMax-rrqYtd));
  const rrq2=Math.max(0,Math.min(ytd+g,R.rrq.mga2)-Math.max(ytd,R.rrq.mga))*R.rrq.t2/100;
  const ins=cap(R.rqap.max,g),rqap=ins*R.rqap.e/100,ae=emp.act?0:cap(R.ae.max,g)*R.ae.e/100,aeR=emp.act?0:cap(R.ae.max,g)*R.ae.r/100;
  const A=g*P,base=rrq*P*(5.3/R.rrq.t),K=0.14*(R.fed.bpa+Math.min(base,(R.rrq.mga-R.rrq.exe)*0.053)+Math.min(ae*P,R.ae.max*R.ae.e/100)+Math.min(rqap*P,R.rqap.max*R.rqap.e/100));
  const fedA=Math.max(0,brk(A-(rrq2*P)-(rrq*P*(1/R.rrq.t)),R.fed.br)-K)*(1-R.fed.ab/100),qcA=Math.max(0,brk(A-(rrq2*P)-(rrq*P*(1/R.rrq.t)),R.qc.br)-0.14*R.qc.bpa);
  const S=pset();const c={brut:r2(g),rrq:r2(rrq),rrq2:r2(rrq2),rqap:r2(rqap),ae:r2(ae),impF:ovr.impF!=null&&ovr.impF!==''?cents(ovr.impF):r2(fedA/P),impQ:ovr.impQ!=null&&ovr.impQ!==''?cents(ovr.impQ):r2(qcA/P),
    eRrq:r2(rrq+rrq2),eRqap:r2(ins*R.rqap.r/100),eAe:r2(aeR),fss:r2(g*S.fss/100),cnt:r2(cap(R.cnt.max,g)*R.cnt.t/100),cnesst:r2(g*S.cnesst/100)};
  c.ded=c.rrq+c.rrq2+c.rqap+c.ae+c.impF+c.impQ;c.net=c.brut-c.ded;c.emp=c.eRrq+c.eRqap+c.eAe+c.fss+c.cnt+c.cnesst;c.estF=r2(fedA/P);c.estQ=r2(qcA/P);return c}
function payLines(c){const S=pset();return[{a:S.sal,d:c.brut,c:0},{a:S.chg,d:c.emp,c:0},{a:S.das,d:0,c:c.ded+c.emp},{a:S.net,d:0,c:c.net}].filter(l=>l.d||l.c)}
function renderPayEmp(){const E=C.emp||[];$('pyEmpList').innerHTML=E.length?E.map(e=>`<tr><td><strong>${esc(e.nom)}</strong></td><td>${e.act?'Oui (exempt d’AE)':'Non'}</td><td>${esc(FREQ[e.freq]||'')}</td><td class="num">${e.def?fmtN(e.def):''}</td><td><button class="sm danger" data-pyedel="${esc(e.id)}">Retirer</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">Aucun employé. Ajoutez l’actionnaire ou un employé ci-dessous.</td></tr>';
  $('pyEmp').innerHTML=E.map(e=>`<option value="${esc(e.id)}">${esc(e.nom)}</option>`).join('')}
async function renderPay(){const S=pset();renderPayEmp();
  $('pySal').innerHTML=$('pyChg').innerHTML=$('pyDas').innerHTML=$('pyNet').innerHTML='<option value="">— choisir —</option>'+OPTS;$('pySal').value=S.sal;$('pyChg').value=S.chg;$('pyDas').value=S.das;$('pyNet').value=S.net;$('pyFss').value=S.fss;$('pyCn').value=S.cnesst;
  if(!$('pyDate').value)$('pyDate').value=new Date().toISOString().slice(0,10);
  const R=prOf(+$('pyDate').value.slice(0,4));$('pyRates').innerHTML=`<tr><td>RRQ</td><td>${R.rrq.t} % (employé et employeur) entre ${fmtN(R.rrq.exe*100)} $ et ${fmtN(R.rrq.mga*100)} $; 2e cotisation supplémentaire ${R.rrq.t2} % jusqu’à ${fmtN(R.rrq.mga2*100)} $</td></tr>
    <tr><td>RQAP</td><td>${String(R.rqap.e).replace('.',',')} % employé, ${String(R.rqap.r).replace('.',',')} % employeur, jusqu’à ${fmtN(R.rqap.max*100)} $</td></tr><tr><td>Assurance-emploi (Québec)</td><td>${String(R.ae.e).replace('.',',')} % employé, ${String(R.ae.r).replace('.',',')} % employeur, jusqu’à ${fmtN(R.ae.max*100)} $ (actionnaire à plus de 40 % : exclu)</td></tr>
    <tr><td>FSS</td><td>${String(S.fss).replace('.',',')} % de la masse salariale (1,65 % si masse salariale de 1 M$ ou moins, hors secteurs primaire et manufacturier)</td></tr><tr><td>Normes du travail (CNT)</td><td>0,06 % jusqu’à ${fmtN(R.cnt.max*100)} $ (payée avec le Sommaire 1)</td></tr><tr><td>CNESST</td><td>${String(S.cnesst).replace('.',',')} % (taux propre à l’employeur, voir l’avis de cotisation)</td></tr>
    <tr><td>Impôt fédéral</td><td>Paliers ${R.fed.br.map(b=>b[1]+' %').join(', ')}; montant personnel ${fmtN(R.fed.bpa*100)} $; abattement du Québec ${String(R.fed.ab).replace('.',',')} %</td></tr><tr><td>Impôt du Québec</td><td>Paliers ${R.qc.br.map(b=>String(b[1]).replace('.',',')+' %').join(', ')}; montant personnel ${fmtN(R.qc.bpa*100)} $</td></tr>`;
  await loadPay();const x=curEx(),L=PAY.filter(p=>!x||(p.date>=x.deb&&p.date<=x.fin)),nm=id=>(C.emp||[]).find(e=>e.id===id)?.nom||'?';
  $('pyList').innerHTML=L.length?L.map(p=>`<tr><td class="d">${esc(p.date)}</td><td>${esc(nm(p.emp))}</td><td class="num">${fmtN(p.c.brut)}</td><td class="num">${fmtN(p.c.ded)}</td><td class="num"><strong>${fmtN(p.c.net)}</strong></td><td class="num">${fmtN(p.c.emp)}</td><td>${lk(p.date)?'<span class="pill">Fermé</span>':`<button class="sm danger" data-pydel="${esc(p.id)}">Supprimer</button>`}</td></tr>`).join('')
    +`<tr class="tot"><td colspan="2">Total de l’exercice</td><td class="num">${fmtN(L.reduce((s,p)=>s+p.c.brut,0))}</td><td class="num">${fmtN(L.reduce((s,p)=>s+p.c.ded,0))}</td><td class="num">${fmtN(L.reduce((s,p)=>s+p.c.net,0))}</td><td class="num">${fmtN(L.reduce((s,p)=>s+p.c.emp,0))}</td><td></td></tr>`
    :'<tr><td colspan="7" class="empty">Aucune paie dans cet exercice.</td></tr>';payPrev()}
function payPrev(){const e=(C.emp||[]).find(x=>x.id===$('pyEmp').value);if(!e||!$('pyBrut').value||!$('pyDate').value){$('pyCalc').innerHTML='<p class="note">Choisissez l’employé, la date et le salaire brut pour voir le calcul.</p>';$('pySave').disabled=true;return}
  const c=payCalc(e,$('pyDate').value,cents($('pyBrut').value),{impF:$('pyImpF').value,impQ:$('pyImpQ').value});$('pySave').disabled=false;
  const r=(l,v,k='')=>`<tr${k?` class="${k}"`:''}><td${k?'':' class="ind"'}>${l}</td><td class="num">${fmtN(v)||'0,00'}</td></tr>`;
  $('pyCalc').innerHTML=`<div class="two"><table class="rep"><tr class="sec"><td>Retenues de l’employé</td><td></td></tr>${r('Salaire brut',c.brut,'sub')}${r('Impôt fédéral'+($('pyImpF').value?' (saisi)':' (estimé)'),c.impF)}${r('Impôt du Québec'+($('pyImpQ').value?' (saisi)':' (estimé)'),c.impQ)}${r('RRQ',c.rrq)}${c.rrq2?r('RRQ — 2e cotisation supplémentaire',c.rrq2):''}${r('RQAP',c.rqap)}${r('Assurance-emploi'+(e.act?' (exclu)':''),c.ae)}${r('Total des retenues',c.ded,'sub')}${r('Salaire net',c.net,'tot')}</table>
    <table class="rep"><tr class="sec"><td>Cotisations de l’employeur</td><td></td></tr>${r('RRQ',c.eRrq)}${r('RQAP',c.eRqap)}${r('Assurance-emploi',c.eAe)}${r('FSS',c.fss)}${r('Normes du travail',c.cnt)}${r('CNESST',c.cnesst)}${r('Total employeur',c.emp,'sub')}${r('DAS à remettre (retenues + employeur)',c.ded+c.emp,'tot')}</table></div>`}
['pyEmp','pyDate','pyBrut','pyImpF','pyImpQ'].forEach(id=>$(id).addEventListener('input',payPrev));$('pyEmp').addEventListener('change',()=>{const e=(C.emp||[]).find(x=>x.id===$('pyEmp').value);if(e?.def&&!$('pyBrut').value)$('pyBrut').value=(e.def/100).toFixed(2);payPrev()});
$('pyEmpAdd').onclick=()=>{const nom=$('pyEN').value.trim();if(!nom){$('pyEMsg').textContent='Nom requis.';return}C.emp=[...(C.emp||[]),{id:'e'+Date.now().toString(36),nom:nom.slice(0,80),act:$('pyEA').checked,freq:+$('pyEF').value,def:cents($('pyED').value)}];saveClient();$('pyEN').value='';$('pyED').value='';$('pyEMsg').textContent='Ajouté.';renderPayEmp();payPrev()};
$('tPay').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pyedel){if(PAY.some(p=>p.emp===b.dataset.pyedel)){b.textContent='A des paies';return}C.emp=(C.emp||[]).filter(x=>x.id!==b.dataset.pyedel);saveClient();renderPayEmp();return}
  if(b.dataset.pydel)confirm2(b,'',async()=>{const id=b.dataset.pydel,p=PAY.find(x=>x.id===id);try{if(local){delete(LOCAL.pay||{})[C.id+'/'+id];if(p?.je)delete(LOCAL.je||{})[C.id+'/'+p.je]}else{await payCol().doc(id).delete();if(p?.je)await(await jeCol()).doc(p.je).delete()}}catch(err){}LED=null;renderPay()})});
$('pySet').onclick=()=>{C.paie={...(C.paie||{}),sal:$('pySal').value,chg:$('pyChg').value,das:$('pyDas').value,net:$('pyNet').value,fss:parseFloat(String($('pyFss').value).replace(',','.'))||0,cnesst:parseFloat(String($('pyCn').value).replace(',','.'))||0};saveClient();$('pySMsg').textContent='Enregistré.';renderPay()};
$('pySave').onclick=async()=>{const e=(C.emp||[]).find(x=>x.id===$('pyEmp').value),date=$('pyDate').value;if(!e||!date)return;
  if(lk(date)){$('pyMsg').textContent='Cette date est dans un exercice fermé.';return}const S=pset();if(!S.sal||!S.chg||!S.das||!S.net){$('pyMsg').textContent='Choisissez d’abord les 4 comptes dans « Comptes et taux » ci-dessous.';$('pySetBox').open=true;return}
  await loadPay();const c=payCalc(e,date,cents($('pyBrut').value),{impF:$('pyImpF').value,impQ:$('pyImpQ').value});const id='p'+Date.now().toString(36),jid='paie-'+id;
  const je={date,ref:'PAIE-'+date.slice(5).replace('-',''),desc:('Paie — '+e.nom).slice(0,120),type:'',ex:exOf(date),paie:id,lines:payLines(c),updated:new Date().toISOString()};
  const doc={date,emp:e.id,freq:e.freq,c,je:jid,updated:new Date().toISOString()};
  try{if(local){LOCAL.pay=LOCAL.pay||{};LOCAL.pay[C.id+'/'+id]=doc;LOCAL.je=LOCAL.je||{};LOCAL.je[C.id+'/'+jid]=je}else{await payCol().doc(id).set(doc);await(await jeCol()).doc(jid).set(je)}
    LED=null;$('pyMsg').textContent=`Paie enregistrée : net ${fmtN(c.net)} $, DAS ${fmtN(c.ded+c.emp)} $. L’écriture ${je.ref} est passée au journal.`;$('pyBrut').value='';$('pyImpF').value='';$('pyImpQ').value='';renderPay()}
  catch(err){$('pyMsg').textContent='Enregistrement impossible.'}};

/* --- rapports : DAS, TPS/TVQ --- */
async function dasHtml(f,t){await loadPay();const L=PAY.filter(p=>(!f||p.date>=f)&&(!t||p.date<=t)),nm=id=>(C.emp||[]).find(e=>e.id===id)?.nom||'?';
  const M=new Map();L.forEach(p=>{const k=p.date.slice(0,7);M.set(k,[...(M.get(k)||[]),p])});const S=(A,k)=>A.reduce((s,p)=>s+(typeof k==='function'?k(p.c):p.c[k]||0),0);
  const due=m=>{const[y,mm]=m.split('-').map(Number);return `15 ${new Date(mm===12?y+1:y,mm%12,15).toLocaleDateString('fr-CA',{month:'long',year:'numeric'})}`};
  const rows=[...M].sort().map(([m,A])=>{const arc=S(A,'impF')+S(A,'ae')+S(A,'eAe'),rq=S(A,'impQ')+S(A,'rrq')+S(A,'rrq2')+S(A,'eRrq')+S(A,'rqap')+S(A,'eRqap')+S(A,'fss')+S(A,'cnesst');
    return{m,A,arc,rq,html:`<tr><td>${esc(moisLbl(m))}</td><td class="num">${fmtN(S(A,'brut'))}</td><td class="num">${fmtN(S(A,'impF'))}</td><td class="num">${fmtN(S(A,'ae')+S(A,'eAe'))}</td><td class="num"><strong>${fmtN(arc)}</strong></td><td class="num">${fmtN(S(A,'impQ'))}</td><td class="num">${fmtN(S(A,'rrq')+S(A,'rrq2')+S(A,'eRrq'))}</td><td class="num">${fmtN(S(A,'rqap')+S(A,'eRqap'))}</td><td class="num">${fmtN(S(A,'fss'))}</td><td class="num">${fmtN(S(A,'cnesst'))}</td><td class="num"><strong>${fmtN(rq)}</strong></td><td>${esc(due(m))}</td></tr>`}});
  const tot=k=>rows.reduce((s,r)=>s+r[k],0);const E=[...new Set(L.map(p=>p.emp))];
  return `<h2>Retenues à la source (DAS) du ${esc(f)} au ${esc(t)}</h2><p class="note">Remises mensuelles (remettant régulier) : au plus tard le 15 du mois suivant. ARC : impôt fédéral et assurance-emploi. Revenu Québec : impôt du Québec, RRQ, RQAP, FSS et CNESST. La cotisation aux normes du travail (CNT) se paie avec le Sommaire 1 en février.</p>
  <div class="scroll"><table class="rep"><tr class="sec"><td>Mois</td><td class="num">Salaires bruts</td><td class="num">Impôt fédéral</td><td class="num">AE (empl. + employeur)</td><td class="num">Total ARC</td><td class="num">Impôt Québec</td><td class="num">RRQ (×2)</td><td class="num">RQAP (×2)</td><td class="num">FSS</td><td class="num">CNESST</td><td class="num">Total Revenu Québec</td><td>Échéance</td></tr>
  ${rows.map(r=>r.html).join('')||'<tr><td colspan="12">Aucune paie dans cette période.</td></tr>'}<tr class="tot"><td>Total</td><td class="num">${fmtN(S(L,'brut'))}</td><td class="num">${fmtN(S(L,'impF'))}</td><td class="num">${fmtN(S(L,'ae')+S(L,'eAe'))}</td><td class="num">${fmtN(tot('arc'))}</td><td class="num">${fmtN(S(L,'impQ'))}</td><td class="num">${fmtN(S(L,'rrq')+S(L,'rrq2')+S(L,'eRrq'))}</td><td class="num">${fmtN(S(L,'rqap')+S(L,'eRqap'))}</td><td class="num">${fmtN(S(L,'fss'))}</td><td class="num">${fmtN(S(L,'cnesst'))}</td><td class="num">${fmtN(tot('rq'))}</td><td></td></tr></table></div>
  <h2 style="margin-top:18px">Sommaire par employé (feuillets T4 et RL-1)</h2><div class="scroll"><table class="rep"><tr class="sec"><td>Employé</td><td class="num">Revenus d’emploi</td><td class="num">Impôt fédéral</td><td class="num">Impôt Québec</td><td class="num">RRQ</td><td class="num">RQAP</td><td class="num">AE</td><td class="num">CNT (employeur)</td></tr>
  ${E.map(id=>{const A=L.filter(p=>p.emp===id);return `<tr><td>${esc(nm(id))}</td><td class="num">${fmtN(S(A,'brut'))}</td><td class="num">${fmtN(S(A,'impF'))}</td><td class="num">${fmtN(S(A,'impQ'))}</td><td class="num">${fmtN(S(A,'rrq')+S(A,'rrq2'))}</td><td class="num">${fmtN(S(A,'rqap'))}</td><td class="num">${fmtN(S(A,'ae'))}</td><td class="num">${fmtN(S(A,'cnt'))}</td></tr>`}).join('')||'<tr><td colspan="8">—</td></tr>'}</table></div>`}
function txDetHtml(E,f,t){const ac=[C.tpsV,C.tvqV,C.tpsA,C.tvqA];const L=E.filter(e=>(!f||e.date>=f)&&(!t||e.date<=t)&&e.lines.some(l=>ac.includes(l[0]))).sort((a,b)=>a.date.localeCompare(b.date));
  const g=(e,a)=>e.lines.filter(l=>l[0]===a).reduce((s,l)=>s+l[1],0);let T=[0,0,0,0,0];
  const rows=L.map(e=>{const base=-e.lines.filter(l=>!ac.includes(l[0])&&String(l[0])[0]!=='1'&&String(l[0])[0]!=='2').reduce((s,l)=>s+l[1],0),v=[-g(e,C.tpsV),-g(e,C.tvqV),g(e,C.tpsA),g(e,C.tvqA)];T[0]+=v[0];T[1]+=v[1];T[2]+=v[2];T[3]+=v[3];
    return `<tr><td class="d">${esc(e.date)}</td><td>${esc(e.ref||'')}</td><td>${esc(e.desc||'')}</td><td class="num">${fmtN(Math.abs(base))}</td>${v.map(x=>`<td class="num">${fmtN(x)}</td>`).join('')}</tr>`}).join('');
  return `<h2>TPS/TVQ détaillé du ${esc(f)} au ${esc(t)}</h2><p class="note">Chaque opération qui touche les comptes de taxes : perçues (${esc(C.tpsV)}, ${esc(C.tvqV)}) et payées (${esc(C.tpsA)}, ${esc(C.tvqA)}).</p>
  <div class="scroll"><table class="rep"><tr class="sec"><td>Date</td><td>Réf.</td><td>Description</td><td class="num">Montant avant taxes</td><td class="num">TPS perçue</td><td class="num">TVQ perçue</td><td class="num">CTI (TPS payée)</td><td class="num">RTI (TVQ payée)</td></tr>${rows||'<tr><td colspan="8">Aucune opération taxable dans la période.</td></tr>'}
  <tr class="tot"><td colspan="4">Total</td>${T.slice(0,4).map(x=>`<td class="num">${fmtN(x)||'0,00'}</td>`).join('')}</tr></table></div>`}
function txSumHtml(E,f,t){const inR=e=>(!f||e.date>=f)&&(!t||e.date<=t);const fl=a=>E.filter(inR).reduce((s,e)=>s+e.lines.filter(l=>l[0]===a).reduce((x,l)=>x+l[1],0),0);
  const tpsV=-fl(C.tpsV),tvqV=-fl(C.tvqV),cti=fl(C.tpsA),rti=fl(C.tvqA);const rev=-E.filter(inR).reduce((s,e)=>s+e.lines.filter(l=>String(l[0])[0]==='4').reduce((x,l)=>x+l[1],0),0);
  const r=(n,l,v,k='')=>`<tr${k?` class="${k}"`:''}><td style="width:70px">${n}</td><td>${l}</td><td class="num">${fmtN(v)||'0,00'}</td></tr>`;
  return `<h2>TPS/TVQ sommaire du ${esc(f)} au ${esc(t)}</h2><p class="note">Les montants à reporter dans la déclaration (méthode régulière). Les ventes viennent des comptes de produits (4xxx); validez la part détaxée ou exonérée avant de produire.</p>
  <div class="two"><table class="rep"><tr class="sec"><td colspan="3">TPS/TVH (ARC)</td></tr>${r('101','Ventes et autres recettes',rev)}${r('105','TPS perçue',tpsV)}${r('108','Crédits de taxe sur les intrants (CTI)',cti)}${r('109',tpsV-cti>=0?'Taxe nette à remettre':'Remboursement net',Math.abs(tpsV-cti),'tot')}</table>
  <table class="rep"><tr class="sec"><td colspan="3">TVQ (Revenu Québec)</td></tr>${r('203','Ventes et autres recettes',rev)}${r('205','TVQ perçue',tvqV)}${r('206','Remboursements de la taxe sur les intrants (RTI)',rti)}${r('209',tvqV-rti>=0?'Taxe nette à remettre':'Remboursement net',Math.abs(tvqV-rti),'tot')}</table></div>
  <p class="note">Les repas et frais de représentation ne donnent droit qu’à 50 % des CTI et RTI.</p>`}

/* ---------- confirmation d'action ---------- */
function notify(m,err){let t=document.getElementById('ntf');if(!t){t=document.createElement('div');t.id='ntf';t.setAttribute('role','status');t.style.cssText='position:fixed;left:50%;bottom:26px;transform:translate(-50%,16px);opacity:0;color:#fff;padding:12px 20px;border-radius:12px;font-weight:600;font-size:15px;box-shadow:0 10px 30px rgba(11,22,38,.25);transition:opacity .2s,transform .2s;z-index:2000;pointer-events:none;max-width:min(560px,92vw);text-align:center';document.body.appendChild(t)}
  t.textContent=(err?'':'✓ ')+m;t.style.background=err?'#b3261e':'#1d7a4f';t.style.opacity='1';t.style.transform='translate(-50%,0)';clearTimeout(t._h);t._h=setTimeout(()=>{t.style.opacity='0';t.style.transform='translate(-50%,16px)'},4500)}

/* ---------- demande de précisions au client (compte transitoire) ---------- */
let MAILL=[];
async function trList(){if(!LED)LED=await loadLedger();const x=curEx();
  return LED.filter(e=>e.todo&&(!x||(e.date>=x.deb&&e.date<=x.fin))).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{const tl=e.lines.find(l=>l[0]===C.tr),o=e.lines.find(l=>l[0]!==C.tr);
    return{date:e.date,desc:e.desc||'',amt:tl?tl[1]:0,src:e.kind==='rel'?e.src:(o?.[0]||'')}})}
const moneyA=c=>new Intl.NumberFormat('fr-CA',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(c)/100)+' $';
const fnBase=()=>`${C.nom}_transactions_a_preciser`.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w-]+/g,'_').replace(/_+/g,'_');
const perTxt=()=>{const x=curEx(),d=MAILL.map(t=>t.date).sort();return d.length?`du ${d[0]} au ${d[d.length-1]}`:x?`de l’exercice ${x.deb} au ${x.fin}`:''};
async function askPdf(){if(!window.jspdf)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');if(!window.jspdf.jsPDF.API.autoTable)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  const cl=t=>String(t||'').replace(/[   ]/g,' ').replace(/[’‘]/g,"'").replace(/[“”«»]/g,'"').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'pt',format:'letter',orientation:'landscape'});const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight();
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(cl(C.nom),40,42);doc.setFontSize(11.5);doc.text('Transactions à préciser',40,60);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(90);const ret=MAILL.filter(t=>t.amt>0).reduce((s,t)=>s+t.amt,0),dep=MAILL.filter(t=>t.amt<0).reduce((s,t)=>s+t.amt,0),mo=c=>moneyA(c).replace(/[\u00a0\u202f]/g,' ');
  doc.text(cl(`${MAILL.length} transaction(s) ${perTxt()} · retraits : ${mo(ret)} · dépôts : ${mo(dep)} · produit le ${new Date().toLocaleDateString('fr-CA')} · Boujrad CPA Inc.`),40,75);
  doc.text(cl('Pour chaque transaction, indiquez dans la dernière colonne de quoi il s’agit (à qui le paiement a été fait ou de qui l’argent provient, et pourquoi), et joignez la facture s’il y a lieu.'),40,89);doc.setTextColor(0);
    doc.autoTable({startY:102,head:[['Date','Type','Montant','Description','Compte','Précisions du client']],
    body:MAILL.map(t=>[t.date,t.amt>0?'Retrait':'Dépôt',mo(t.amt),cl(t.desc),cl(t.src?t.src+' '+accName(t.src):''),'']),
    theme:'grid',margin:{left:40,right:40},styles:{fontSize:8.5,cellPadding:4,valign:'top',lineColor:[200,205,215]},headStyles:{fillColor:[31,61,110],textColor:255},
    columnStyles:{0:{cellWidth:62},1:{cellWidth:46},2:{cellWidth:68,halign:'right'},3:{cellWidth:200},4:{cellWidth:120},5:{cellWidth:'auto',minCellHeight:26}}});
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(130);doc.text(`Page ${i} de ${n}`,W-40,H-20,{align:'right'})}
  return new Uint8Array(doc.output('arraybuffer'))}
async function askXlsx(){if(!window.XLSX)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const rows=[[`${C.nom} — transactions à préciser ${perTxt()}`],['Inscrivez vos précisions dans les colonnes F et G, puis retournez-nous ce fichier.'],[],
    ['Date','Type','Montant ($)','Description (relevé)','Compte','De quoi s’agit-il? (à qui / de qui, et pourquoi)','Facture jointe? (oui/non)'],
    ...MAILL.map(t=>[t.date,t.amt>0?'Retrait':'Dépôt',Math.abs(t.amt)/100,t.desc,t.src?`${t.src} ${accName(t.src)}`:'','',''])];
  const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:11},{wch:9},{wch:12},{wch:42},{wch:26},{wch:50},{wch:16}];
  for(let r=4;r<rows.length;r++){const c=ws[XLSX.utils.encode_cell({r,c:2})];if(c)c.z='#,##0.00'}
  ws['!autofilter']={ref:`A4:G${rows.length}`};const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'À préciser');
  return new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'}))}
const b64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)};
async function openAsk(){const d=$('mailDlg');$('mailMsg').textContent='';$('mailInfo').textContent='Préparation de la liste…';d.showModal?d.showModal():d.setAttribute('open','');
  try{MAILL=await trList()}catch(e){$('mailInfo').textContent='Lecture des données impossible.';return}
  $('mailInfo').textContent=MAILL.length?`${MAILL.length} transaction(s) au compte transitoire ${C.tr} ${perTxt()}.`:'Aucune transaction au compte transitoire dans cet exercice.';
  $('mailTo').value=C.email||'';if(!C.email&&typeof window.tlFindEmail==='function')window.tlFindEmail(C.nom).then(v=>{if(v&&!$('mailTo').value){$('mailTo').value=v;$('mailMsg').textContent='Courriel trouvé dans la fiche du client (Gestion du cabinet).'}}).catch(()=>{});
  $('mailSub').value=`${C.nom} — précisions demandées sur ${MAILL.length} transaction${MAILL.length>1?'s':''}`;
  $('mailAtt').textContent=`Pièces jointes : ${fnBase()}.pdf (pour consulter) et ${fnBase()}.xlsx (pour répondre directement dans le fichier).`;
  $('mailBody').value=`Bonjour,

Dans le cadre de la tenue de livres de ${C.nom}, nous avons besoin de précisions sur ${MAILL.length>1?`les ${MAILL.length} transactions`:'la transaction'} présentée${MAILL.length>1?'s':''} en pièce jointe afin de ${MAILL.length>1?'les':'la'} classer dans les bons comptes.

Pour chacune, pourriez-vous nous indiquer de quoi il s’agit (à qui le paiement a été fait ou de qui l’argent provient, et pour quelle raison) et nous transmettre la facture ou la pièce justificative, s’il y a lieu?

La liste est jointe en format PDF et Excel. Vous pouvez inscrire vos réponses directement dans le fichier Excel et nous le retourner.

Merci de nous les faire parvenir le plus tôt possible.

Cordialement,

Boujrad CPA Inc.`;
  $('mailSend').hidden=typeof window.tlSendEmail!=='function'}
document.addEventListener('click',e=>{if(e.target.closest('[data-askcli]')){e.preventDefault();openAsk()}});
$('mailClose').onclick=()=>{const d=$('mailDlg');d.close?d.close():d.removeAttribute('open')};
const keepTo=()=>{const v=$('mailTo').value.trim();if($('mailSaveTo').checked&&v&&v!==C.email){C.email=v.slice(0,200);saveClient()}};
const mailOk=()=>{const v=$('mailTo').value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){$('mailMsg').textContent='Entrez une adresse courriel valide.';return false}return true};
$('mailOpen').onclick=()=>{if(!mailOk())return;keepTo();const u=`mailto:${encodeURIComponent($('mailTo').value.trim())}?subject=${encodeURIComponent($('mailSub').value)}&body=${encodeURIComponent($('mailBody').value)}`;
  $('mailMsg').textContent='Votre messagerie s’ouvre : joignez-y le PDF et l’Excel (boutons « Télécharger »), car une messagerie ne peut pas les recevoir automatiquement.';
  const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()};
$('mailCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('mailBody').value);$('mailMsg').textContent='Message copié.'}catch(e){$('mailBody').select();$('mailMsg').textContent='Sélectionné : faites Ctrl+C.'}};
const askDl=async(kind)=>{if(!downloads){$('mailMsg').textContent='Téléchargement indisponible dans cette vue.';return}$('mailMsg').textContent='Préparation…';
  try{await downloads.save({filename:fnBase()+(kind==='pdf'?'.pdf':'.xlsx'),data:kind==='pdf'?await askPdf():await askXlsx()});$('mailMsg').textContent='Fichier enregistré.'}catch(e){$('mailMsg').textContent=e?.code==='declined'?'Téléchargement annulé.':'Création du fichier impossible.'}};
$('mailPdf').onclick=()=>askDl('pdf');$('mailXls').onclick=()=>askDl('xlsx');
$('mailSend').onclick=async()=>{if(!mailOk())return;keepTo();const b=$('mailSend');b.disabled=true;$('mailMsg').textContent='Préparation des pièces jointes…';
  try{const att=MAILL.length?[{filename:fnBase()+'.pdf',contentType:'application/pdf',content:b64(await askPdf())},{filename:fnBase()+'.xlsx',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',content:b64(await askXlsx())}]:[];
    $('mailMsg').textContent='Envoi…';await window.tlSendEmail({to:$('mailTo').value.trim(),subject:$('mailSub').value,text:$('mailBody').value,attachments:att});
    const dest=$('mailTo').value.trim();C.demandes=[...(C.demandes||[]),{date:new Date().toISOString(),to:dest,n:MAILL.length}].slice(-50);saveClient();
    const dl=$('mailDlg');dl.close?dl.close():dl.removeAttribute('open');notify(`Courriel envoyé à ${dest} avec le PDF et l’Excel joints`);if(document.querySelector('#side [data-t=home][aria-current]')||!$('tHome')?.hidden)renderHome().catch(()=>{})}
  catch(e){notify('Envoi impossible : le courriel n’est pas parti',1);$('mailMsg').textContent='Envoi impossible ('+(e?.message||'service de courriel non configuré')+'). Téléchargez le PDF et l’Excel, puis utilisez « Ouvrir dans ma messagerie ».'}b.disabled=false};



/* ---------- archive PDF du dossier (fermeture d'exercice ou transfert au nouveau comptable) ---------- */
function fillArcEx(){const L=(C.ex||[]).slice().sort((a,b)=>a.deb.localeCompare(b.deb));$('arcEx').innerHTML=(L.length>1?'<option value="*">Tous les exercices</option>':'')+L.map(x=>`<option value="${esc(x.id)}"${x.id===(C.arcSugg&&L.some(y=>y.id===C.arcSugg)?C.arcSugg:C.exCur)?' selected':''}>${esc(exLbl(x))}${x.statut==='ferme'?' · fermé':''}</option>`).join('')||'<option value="">Aucun exercice</option>'}
async function captureDl(fn){const out=[],orig=downloads;downloads={save:async o=>{out.push(o)}};try{await fn()}finally{downloads=orig}return out}
async function arcBuild(exIds,withData,say){const orig=C.exCur,files=[],REPS=[['bs','01_Bilan'],['is','02_Etat_des_resultats'],['tb','03_Balance_de_verification'],['gl','04_Grand_livre'],['jr','05_Journal_general'],['tx','06_TPS-TVQ_sommaire'],['txd','07_TPS-TVQ_detail']];
  const keepREP=REP,keepF=$('repFrom').value,keepT=$('repTo').value,keepAcc=$('repAcc').value;let n=0;
  try{await loadInv();const hasInv=INV.length>0;let hasPay=false;try{await loadPay();hasPay=PAY.length>0}catch(e){}
    for(const id of exIds){useEx(id,true);const x=curEx(),dir=`${x.deb}_au_${x.fin}`;LED=null;$('repFrom').value=x.deb;$('repTo').value=x.fin;$('repAcc').value='';
      const list=[...REPS,...(hasPay?[['das','08_DAS']]:[]),...(hasInv?[['ar','09_Comptes_clients'],['ap','10_Comptes_fournisseurs']]:[])];
      for(const[r,nm]of list){say(`${exLbl(x)} : ${nm.slice(3).replace(/_/g,' ')}…`);REP=r;await runRep(!LED);const got=await captureDl(()=>$('repPdf').onclick());if(got[0])files.push([`${dir}/${nm}.pdf`,got[0].data]);n++}
      if(await loadMis()){for(const[k,nm]of[['ef','11_Etats_financiers'],['let','12_Lettre_de_mission'],['dec','13_Declaration_de_la_direction'],['wp','14_Dossier_de_travail']]){say(`${exLbl(x)} : mission (${nm.slice(3).replace(/_/g,' ')})…`);const got=await captureDl(()=>misPdf(k,document.createElement('button')));if(got[0])files.push([`${dir}/Mission_de_compilation/${nm}.pdf`,got[0].data])}}}
    if(withData){say('Données du dossier…');LED=await loadLedger();const PL=Object.fromEntries(PLAN);const c2=v=>(v/100).toFixed(2).replace('.',',');const q=v=>{v=String(v??'');return /[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};
      const rows=['Date;Référence;Description;Compte;Nom du compte;Débit;Crédit'];LED.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>e.lines.forEach(([a,v])=>{if(v)rows.push([e.date,e.ref,e.desc,a,PL[a]||'',v>0?c2(v):'',v<0?c2(-v):''].map(q).join(';'))}));
      files.push(['Donnees/grand-livre-complet.csv','﻿'+rows.join('\r\n')]);files.push(['Donnees/plan-comptable.csv','﻿Compte;Nom\r\n'+PLAN.map(([n,t])=>q(n)+';'+q(t)).join('\r\n')]);
      const one={format:'tenue-livres-v1',date:new Date().toISOString(),clients:[{id:C.id,data:JSON.parse(JSON.stringify(C))}]};
      for(const sub of SUBS){if(local){const src=sub==='periodes'?LOCAL.periodes:sub==='ecritures'?(LOCAL.je||{}):sub==='missions'?(LOCAL.mis||{}):sub==='paies'?(LOCAL.pay||{}):(LOCAL.inv||{});one.clients[0][sub]=Object.entries(src).filter(([k])=>k.startsWith(C.id+'/')).map(([k,v])=>({id:k.split('/')[1],data:v}))}
        else one.clients[0][sub]=(await db.collection('clients').doc(C.id).collection(sub).get()).docs.map(d=>({id:d.id,data:d.data()}))}
      files.push(['Donnees/dossier-importable.json',JSON.stringify(one)])}
    try{say('Piste de vérification…');await audFlush();const A=(await audLire()).sort((a,b)=>a.le.localeCompare(b.le));if(A.length){const q=v=>{v=String(v??'');return /[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};files.push(['Piste_de_verification.csv','\ufeffQuand;Qui;Quoi;Détail\r\n'+A.map(e=>[e.le,e.qui,e.quoi,e.detail].map(q).join(';')).join('\r\n')])}}catch(e){}
    if(window.tlFichiers){const L=[];try{const per=local?Object.entries(LOCAL.periodes).filter(([k])=>k.startsWith(C.id+'/')).map(([,v])=>v):(await db.collection('clients').doc(C.id).collection('periodes').get()).docs.map(d=>d.data());
        per.forEach(p=>(p.tx||[]).forEach(t=>(t.pj||[]).forEach(f=>L.push([`Pieces_jointes/${t.date} ${t.desc.replace(/[^\w .-]+/g,'_').slice(0,40)} - ${f.n.replace(/[^\w .-]+/g,'_')}`,f.c]))));(await loadJe()).forEach(j=>(j.pj||[]).forEach(f=>L.push([`Pieces_jointes/${j.date} ecriture ${String(j.ref||'').replace(/[^\w-]+/g,'_')} - ${f.n.replace(/[^\w .-]+/g,'_')}`,f.c])))}catch(e){}
      for(const[k,[n,c]]of L.entries()){say(`Pièces jointes : ${k+1} sur ${L.length}…`);try{files.push([n,await window.tlFichiers.lire(c)])}catch(e){}}}
    files.push(['LISEZMOI.txt',`ARCHIVE DU DOSSIER — ${C.nom}\nProduite le ${new Date().toLocaleDateString('fr-CA')} par Boujrad CPA Inc.\n\nUn dossier par exercice, avec les rapports en PDF (prêts à imprimer) et, s'il y a lieu, le dossier de la mission de compilation.\n${withData?`\nDonnees/grand-livre-complet.csv : toutes les écritures comptables (s'ouvre dans Excel; s'importe dans tout logiciel comptable).\nDonnees/plan-comptable.csv : le plan comptable.\nDonnees/dossier-importable.json : le dossier complet dans un format ouvert, pour le reprendre dans le logiciel de Boujrad CPA Inc. ou le convertir pour un autre logiciel.\n`:''}`])}
  finally{useEx(orig,true);REP=keepREP;$('repFrom').value=keepF;$('repTo').value=keepT;$('repAcc').value=keepAcc;LED=null}
  return files}
$('arcGo').onclick=async()=>{const b=$('arcGo'),say=t=>$('arcMsg').textContent=t,v=$('arcEx').value;if(!v){say('Définissez d’abord un exercice dans Paramètres.');return}
  const ids=v==='*'?(C.ex||[]).slice().sort((a,c)=>a.deb.localeCompare(c.deb)).map(x=>x.id):[v];b.disabled=true;
  try{const files=await arcBuild(ids,$('arcData').checked,say);say('Compression…');await loadScript('https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.52/dist/zip.min.js');zip.configure({useWebWorkers:false});
    const pw=$('arcPw').value;const w=new zip.ZipWriter(new zip.Uint8ArrayWriter(),pw?{password:pw,encryptionStrength:3}:{});
    for(const[n,d]of files)await w.add(n,typeof d==='string'?new zip.TextReader(d):new zip.Uint8ArrayReader(d instanceof Uint8Array?d:new Uint8Array(d)));
    const data=await w.close(),name=`${C.nom}_archive_${v==='*'?'tous_les_exercices':(C.ex||[]).find(x=>x.id===v)?.fin||''}.zip`.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.-]+/g,'_');
    if(downloads)await downloads.save({filename:name,data});else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/zip'}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
    say(`${files.length} fichier(s) dans l’archive.`);notify(`Archive du dossier téléchargée (${files.filter(f=>f[0].endsWith('.pdf')).length} PDF)`)}
  catch(e){say(e?.code==='declined'?'Téléchargement annulé.':'Archive impossible : '+(e?.message||'réessayez.'));notify('Archive impossible',1)}b.disabled=false};

/* ---------- réponses du client : import du fichier Excel rempli et reclassement ---------- */
let ANS=[];
const ansCents=v=>{let x=String(v??'').replace(/[\s  $]/g,'');if(!x)return null;if(/,\d{1,2}$/.test(x))x=x.replace(/\./g,'').replace(',','.');else x=x.replace(/,/g,'');const n=parseFloat(x);return isNaN(n)?null:Math.round(Math.abs(n)*100)};
const ansDate=v=>{const t=String(v||'').trim();let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);if(m){const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}return t};
async function ansCandidates(){/* transactions encore au transitoire : relevés (période + rang) et écritures */
  let L=[];if(local)L=Object.entries(LOCAL.periodes).filter(([k])=>k.startsWith(C.id+'/')).map(([,v])=>v);else{const q=await db.collection('clients').doc(C.id).collection('periodes').get();L=q.docs.map(d=>d.data())}
  const out=[];L.forEach(p=>{const src=(P&&P.mois===p.mois&&P.src===p.src)?P:p;(src.tx||[]).forEach((x,i)=>{const t={...x};classify(t);if(isTr(t)&&!lk(t.date))out.push({kind:'rel',pid:p.mois+'_'+p.src,mois:p.mois,src:p.src,i,date:t.date,desc:t.desc,c:Math.abs(t.amt),sortie:t.amt<0})})});
  (await loadJe()).forEach(j=>(j.lines||[]).forEach((l,k)=>{if(l.a===C.tr&&!lk(j.date)){const v=(l.d||0)-(l.c||0);out.push({kind:'je',id:j.id,k,date:j.date,desc:j.desc||j.ref||'',c:Math.abs(v),sortie:v>0})}}));return out}
async function ansRead(f){const rows=/\.xlsx?$/i.test(f.name)?await readXlsx(f):parseCSV(decode(await f.arrayBuffer()));
  const h=rows.findIndex(r=>r.some(c=>/^date$/i.test(c.trim()))&&r.some(c=>/montant/i.test(c)));if(h<0)throw new Error('En-têtes introuvables : utilisez le fichier envoyé au client.');
  const H=rows[h].map(c=>norm(c)),col=re=>H.findIndex(c=>re.test(c));
  const ci={date:col(/^DATE$/),type:col(/^TYPE$/),mt:col(/MONTANT/),desc:col(/DESCRIPTION/),expl:col(/S.?AGIT|PRECISION|EXPLICATION/),fac:col(/FACTURE/)};
  return rows.slice(h+1).map(r=>({date:ansDate(r[ci.date]),type:r[ci.type]||'',c:ansCents(r[ci.mt]),desc:r[ci.desc]||'',expl:(ci.expl>=0?r[ci.expl]:'')||'',fac:ci.fac>=0?r[ci.fac]||'':''})).filter(x=>x.date&&x.c)}
function ansRender(){const n=ANS.filter(a=>a.m&&a.expl.trim()).length,nm=ANS.filter(a=>!a.m).length;
  $('ansOut').innerHTML=`<p class="note" style="margin:0 0 8px">${ANS.length} ligne(s) lue(s) · <strong>${n}</strong> avec une explication à classer${nm?` · ${nm} introuvable(s) au compte transitoire (déjà classée(s) ou montant différent)`:''}.</p>
    <table class="rep" style="width:100%"><thead><tr><th>Date</th><th class="num">Montant</th><th>Description</th><th>Explication du client</th><th>Compte</th><th>Taxes</th></tr></thead><tbody>${ANS.map((a,i)=>`<tr${a.m?'':' style="opacity:.5"'}><td style="white-space:nowrap">${esc(a.date)}</td><td class="num" style="white-space:nowrap">${a.m&&a.m.sortie?'-':''}${(a.c/100).toLocaleString('fr-CA',{minimumFractionDigits:2})}</td><td>${esc(a.desc)}</td>
      <td>${a.expl?esc(a.expl):'<span class="note">— pas de réponse —</span>'}${/^o/i.test(a.fac)?' <span class="note">· facture jointe</span>':''}</td>
      <td>${a.m&&a.expl.trim()?`<select data-ans="${i}" style="max-width:260px"><option value="">— garder au transitoire —</option>${PLAN.filter(([n,t])=>n!==C.tr&&!isHeader(n,t)).map(([n,t])=>`<option value="${esc(n)}"${a.acct===n?' selected':''}>${esc(n+' '+t)}</option>`).join('')}</select>${a.ai?'<br><span class="note">Proposé par l’IA</span>':''}`:a.m?'':'<span class="note">Introuvable</span>'}</td>
      <td>${a.m&&a.expl.trim()?`<input type="checkbox" data-anst="${i}"${a.tax?' checked':''} title="TPS/TVQ incluses">`:''}</td></tr>`).join('')}</tbody></table>`;
  $('ansApply').hidden=!n;$('ansAi').hidden=!(n&&sampleFn)}
async function ansAi(){const L=ANS.map((a,i)=>({i,a})).filter(({a})=>a.m&&a.expl.trim());if(!L.length||!sampleFn)return;$('ansMsg').textContent='L’IA propose les comptes…';$('ansAi').disabled=true;
  try{const r=await sampleFn.json(`Tu aides un cabinet comptable québécois à faire la tenue de livres du client « ${C.nom} ». Plan comptable du client :\n${PLAN.map(p=>p.join(' ')).join('\n')}\n${iaProfil()?`\n${iaProfil()}\n`:''}${C.notes?`\nNotes du cabinet sur ce client : ${C.notes}\n`:''}\nLe client a expliqué les transactions bancaires suivantes. Pour chacune, donne le compte le plus approprié dans CE plan (numéro exact, jamais le compte transitoire ${C.tr}) et indique si la TPS et la TVQ s'appliquent (achat ou vente taxable au Québec). Si l'explication est insuffisante, compte = null.\n${L.map(({i,a})=>`${i}. ${a.m.sortie?'Sortie':'Entrée'} de ${(a.c/100).toFixed(2)} $ le ${a.date} · relevé : « ${a.desc} » · explication du client : « ${a.expl} »`).join('\n')}\nRéponds en JSON seulement : [{"i":numéro,"compte":"numéro ou null","taxable":true|false}]`);
    const ok=new Set(PLAN.map(p=>p[0]));let n=0;(Array.isArray(r)?r:[]).forEach(x=>{const a=ANS[x.i];const c=x.compte==null?null:String(x.compte);if(!a||!c||!ok.has(c)||c===C.tr)return;if(!a.acct){a.acct=c;a.tax=!!x.taxable;a.ai=true;n++}});
    $('ansMsg').textContent=n?`L’IA a proposé ${n} compte(s). Vérifiez-les, puis cliquez sur « Appliquer ».`:'L’IA n’a pas pu proposer de compte : choisissez-les dans la liste.';ansRender()}
  catch(e){$('ansMsg').textContent='Suggestion par l’IA impossible pour le moment : choisissez les comptes dans la liste.'}$('ansAi').disabled=false}
async function ansApply(){const L=ANS.filter(a=>a.m&&a.acct);if(!L.length){$('ansMsg').textContent='Choisissez au moins un compte.';return}
  const b=$('ansApply');b.disabled=true;$('ansMsg').textContent='Reclassement…';const why=a=>('Précision du client : '+a.expl.trim()).slice(0,140);
  try{const per=new Map();L.filter(a=>a.m.kind==='rel').forEach(a=>{(per.get(a.m.pid)||per.set(a.m.pid,[]).get(a.m.pid)).push(a)});
    for(const[pid,As]of per){if(P&&P.mois+'_'+P.src===pid){As.forEach(a=>Object.assign(P.tx[a.m.i],{acct:a.acct,tax:!!a.tax,st:'manuel',why:why(a),unk:false}));savePerNow();continue}
      let doc;if(local)doc=LOCAL.periodes[C.id+'/'+pid];else{const q=await db.collection('clients').doc(C.id).collection('periodes').doc(pid).get();doc=q.exists?q.data():null}
      if(!doc)continue;As.forEach(a=>Object.assign(doc.tx[a.m.i],{acct:a.acct,tax:!!a.tax,st:'manuel',why:why(a),unk:false}));doc.todo=doc.tx.filter(aCl).length;doc.updated=new Date().toISOString();
      if(local)LOCAL.periodes[C.id+'/'+pid]=doc;else await db.collection('clients').doc(C.id).collection('periodes').doc(pid).set(doc)}
    const byJe=new Map();L.filter(a=>a.m.kind==='je').forEach(a=>{(byJe.get(a.m.id)||byJe.set(a.m.id,[]).get(a.m.id)).push(a)});
    for(const[id,As]of byJe){const j=JE.find(x=>x.id===id);if(!j)continue;const{id:_,...d}=j;d.lines=d.lines.map((l,k)=>{const a=As.find(x=>x.m.k===k);return a?{...l,a:a.acct}:l});d.desc=(d.desc||'')+(d.desc?' · ':'')+'précisé par le client';d.updated=new Date().toISOString();
      if(local){LOCAL.je[C.id+'/'+id]=d}else await(await jeCol()).doc(id).set(d)}
    C.demandes=[...(C.demandes||[])];const last=C.demandes.at(-1);if(last)last.repondu=new Date().toISOString();saveClient();LED=null;
    const dl=$('ansDlg');dl.close?dl.close():dl.removeAttribute('open');notify(`${L.length} transaction(s) reclassée(s) à partir des réponses du client`);
    if(tab==='home')renderHome().catch(()=>{});else if(typeof render==='function')render()}
  catch(e){$('ansMsg').textContent='Reclassement impossible : '+(e?.message||'réessayez.');notify('Reclassement impossible',1)}b.disabled=false}
function openAns(){const d=$('ansDlg');ANS=[];$('ansOut').innerHTML='';$('ansMsg').textContent='';$('ansFile').value='';$('ansApply').hidden=$('ansAi').hidden=true;d.showModal?d.showModal():d.setAttribute('open','')}
document.addEventListener('click',e=>{if(e.target.closest('[data-ansimp]')){e.preventDefault();openAns()}});
$('ansClose').onclick=()=>{const d=$('ansDlg');d.close?d.close():d.removeAttribute('open')};
$('ansFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;$('ansMsg').textContent='Lecture du fichier…';
  try{const rows=await ansRead(f),cand=await ansCandidates();ANS=rows.map(r=>{const sortie=/retrait|sortie|debit/i.test(norm(r.type));const pool=cand.filter(c=>!c.used&&c.c===r.c&&c.date===r.date&&(!r.type||c.sortie===sortie));const m=pool.find(c=>norm(c.desc)===norm(r.desc))||pool[0]||null;if(m)m.used=true;return{...r,m,acct:'',tax:false}});
    $('ansMsg').textContent='';ansRender();if(sampleFn&&ANS.some(a=>a.m&&a.expl.trim()))ansAi()}
  catch(err){$('ansMsg').textContent=err?.message||'Lecture du fichier impossible.'}};
$('ansOut').addEventListener('change',e=>{const i=e.target.dataset.ans??e.target.dataset.anst;if(i==null)return;const a=ANS[+i];if(e.target.dataset.ans!=null){a.acct=e.target.value;a.ai=false}else a.tax=e.target.checked});
$('ansAi').onclick=ansAi;$('ansApply').onclick=ansApply;

/* ---------- accueil du dossier ---------- */
/* ---------- Boîte de dépôt : tout le paquet du client d'un coup (ZIP ou fichiers) ----------
   Chaque document est reconnu (relevé de banque ou de carte, rapport PayPal, export bancaire, états financiers, commandes, règlements…),
   rattaché à son compte (créé au besoin, avec sa devise), puis versé en un clic. Les doutes sont en jaune, avec la raison. */
let BOITE=null;
const ZIPJS='https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.52/dist/zip.min.js';
const nomMac=s=>String(s).replace(/#U([0-9a-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).normalize('NFC');
async function boiteDeplier(files){const out=[];
  for(const f of files){if(/\.zip$/i.test(f.name)){if(!window.zip)await loadScript(ZIPJS);zip.configure({useWebWorkers:false});const r=new zip.ZipReader(new zip.BlobReader(f));
      for(const e of await r.getEntries()){const ch=nomMac(e.filename);if(e.directory||/(^|\/)(__MACOSX\/|\._)|\.DS_Store$/.test(ch))continue;
        const b=await e.getData(new zip.BlobWriter());const g=new File([b],ch.split('/').pop());g._chemin=ch;out.push(g)}await r.close()}
    else if(!/^\._|\.DS_Store$/.test(f.name)){f._chemin=f._chemin||f.name;out.push(f)}}
  return out}
const BANQUES=[[/BANQUE ROYALE|\bRBC\b|ROYAL BANK/,'RBC'],[/DESJARDINS/,'Desjardins'],[/BANQUE NATIONALE|NATIONAL BANK|\bBNC\b/,'BNC'],[/\bBMO\b|BANQUE DE MONTREAL|BANK OF MONTREAL/,'BMO'],[/\bTD\b|TORONTO-DOMINION|CANADA TRUST/,'TD'],[/SCOTIA/,'Scotia'],[/\bCIBC\b/,'CIBC'],[/TANGERINE/,'Tangerine'],[/AMERICAN EXPRESS|\bAMEX\b/,'Amex']];
const banqueDe=t=>(BANQUES.find(([re])=>re.test(t))||[0,''])[1];
/* mots distinctifs du nom du dossier (sans INC, LTEE…) pour reconnaître un relevé de l'entreprise */
const motsNom=()=>norm(C?.nom||'').split(/[^A-Z0-9]+/).filter(w=>w.length>=4&&!/^(INC|INCORPOREE|LTEE|LIMITEE|CORP|COMPAGNIE|SOCIETE|GROUPE|ENTREPRISES?|SERVICES?)$/.test(w));
async function boiteReconnaitre(f){const nm=f.name,ch=norm(f._chemin||nm);const r={f,nom:nm,chemin:f._chemin||nm,type:'autre',action:'ignorer',note:'',doute:false,dev:'CAD',der:'',banque:''};
  try{try{const h=await crypto.subtle.digest('SHA-256',await f.arrayBuffer());r.hash=[...new Uint8Array(h)].slice(0,12).map(b=>b.toString(16).padStart(2,'0')).join('')}catch(e){}if(/\.pdf$/i.test(nm)){const pages=await pdfPages(f);const t1=norm(pages[0]||''),t5=norm(pages.slice(0,6).join('\n'));r.pages=pages.length;r.banque=banqueDe(t1);
      const usd=/FONDS EN USD|EN DOLLARS US|DOLLARS AMERICAINS|\bUS DOLLARS?\b|\(USD\)/.test(t1);if(usd)r.dev='USD';
      const carte=t1.match(/\d{4} ?\d{2}\*{2} ?\*{4} ?(\d{4})|\*{4} ?(\d{4})/);const cpt=t1.match(/NUMERO DE COMPTE:?\s*([\d -]{7,})|ACCOUNT NUMBER:?\s*([\d -]{7,})/);
      const mots=motsNom(),entreprise=!mots.length||mots.some(w=>t1.includes(w));r.perso=!entreprise||/COMPTE PERSONNEL|PARTICULIERS|PERSONAL (CHEQUING|ACCOUNT|BANKING)/.test(t1);
      if(/SOLDE DE COMPTE PRECEDENT|SOLDE PRECEDENT|PREVIOUS (ACCOUNT )?BALANCE|NOUVEAU SOLDE/.test(t1)&&carte){Object.assign(r,{type:'carte',der:carte[1]||carte[2],action:'verser'})}
      else if(/SOLDE D'OUVERTURE|OPENING BALANCE|RELEVE DE COMPTE|DETAILS DES OPERATIONS|ACCOUNT STATEMENT/.test(t1)&&!/PAYPAL/.test(t1)){Object.assign(r,{type:'banque',der:cpt?(cpt[1]||cpt[2]).replace(/\D/g,'').slice(-4):'',action:'verser'});if(!r.der){r.doute=true;r.note='Numéro de compte introuvable : choisissez le compte.'}}
      else if(/PAYPAL/.test(t1)){Object.assign(r,{type:'paypal-pdf',note:'Rapport PayPal en PDF : le CSV du même rapport est versé à sa place (il donne chaque ligne).'})}
      else if(/BALANCE DE VERIFICATION|TRIAL BALANCE|ETATS FINANCIERS|AVIS AU LECTEUR|MISSION DE COMPILATION|FINANCIAL STATEMENTS|DOCUMENTS DE FIN D.ANNEE|EXERCICE CLOS/.test(t5)||pages.some(p=>/BALANCE DE VERIFICATION|TRIAL BALANCE/.test(norm(p)))){
        const tbp=pages.map((p,i)=>/BALANCE DE VERIFICATION|TRIAL BALANCE/.test(norm(p))?i:-1).filter(i=>i>=0);
        const fin=(()=>{const T=pages.filter((_,i)=>tbp.includes(i)).join('\n')||t5;const m=norm(T).match(/YEAR END:?\s*([A-Z]+ \d{1,2},? \d{4})|EXERCICE CLOS LE\s*(\d{4}-\d{2}-\d{2}|\d{1,2} [A-Z]+ \d{4})|AU (\d{1,2}) ([A-Z]+) (\d{4})/);if(!m)return'';
          const EN={JANUARY:1,FEBRUARY:2,MARCH:3,APRIL:4,MAY:5,JUNE:6,JULY:7,AUGUST:8,SEPTEMBER:9,OCTOBER:10,NOVEMBER:11,DECEMBER:12};
          if(m[1]){const x=m[1].match(/([A-Z]+) (\d{1,2}),? (\d{4})/);return x&&EN[x[1]]?`${x[3]}-${String(EN[x[1]]).padStart(2,'0')}-${x[2].padStart(2,'0')}`:''}
          if(m[2]&&/^\d{4}/.test(m[2]))return m[2];const x=(m[2]||`${m[3]} ${m[4]} ${m[5]}`).match(/(\d{1,2}) ([A-Z]+) (\d{4})/);return x&&moisN(x[2])?`${x[3]}-${String(moisN(x[2])).padStart(2,'0')}-${x[1].padStart(2,'0')}`:''})();
        Object.assign(r,{type:'etats',fin,tbp,note:tbp.length?`Balance de vérification trouvée (pages ${tbp.map(i=>i+1).join(', ')})${fin?`, fin d’exercice ${fin}`:''}.`:'États financiers sans balance de vérification lisible.'})}
      else if(/GMAIL|OUTLOOK|^DE :|^FROM:|OBJET :|SUBJECT:/.test(t1)){r.type='courriel';r.note='Courriel : à lire, rien à verser.'}
      else if(!pages.join('').trim()){r.type='document';r.note='PDF en image (aucun texte lisible) : à consulter vous-même.'}
      else{r.type='document';r.note='Document non reconnu (facture, reçu ou autre) : versez-le dans Factures s’il s’agit d’une facture.';r.doute=true}}
    else if(/\.(csv|xlsx?|txt)$/i.test(nm)){const rows=await rowsOf(f);r.rows=rows;const top=norm(rows.slice(0,15).map(x=>x.join(' ')).join(' '));const h=(rows[0]||[]).map(norm);
      if(h.includes('GROSS')&&h.includes('FEE')&&h.includes('NET')){const ic=h.indexOf('CURRENCY');const curs=[...new Set(rows.slice(1).map(x=>String(x[ic]||'').trim().toUpperCase()).filter(Boolean))];
        r.dev=curs.includes('USD')&&!curs.includes('CAD')?'USD':curs.includes('CAD')?'CAD':curs[0]||'CAD';Object.assign(r,{type:'paypal',action:'verser',banque:'PayPal',note:`Rapport PayPal (${curs.join(', ')}) : ventes au brut, frais séparés.`})}
      else if(h.includes('TYPE DE COMPTE')&&h.some(x=>/NUMERO DU COMPTE|ACCOUNT NUMBER/.test(x))){const ia=h.findIndex(x=>/NUMERO DU COMPTE|ACCOUNT NUMBER/.test(x)),it=h.indexOf('TYPE DE COMPTE');const ex=rows[1]||[];
        const iu=h.findIndex(x=>/USD/.test(x)),icd=h.findIndex(x=>/CAD/.test(x));const usd=iu>=0&&rows.slice(1).some(x=>x[iu])&&!(icd>=0&&rows.slice(1).some(x=>x[icd]));
        Object.assign(r,{type:/VISA|MASTERCARD|CARTE|CREDIT/.test(norm(ex[it]))?'carte-csv':'banque-csv',der:String(ex[ia]||'').replace(/\D/g,'').slice(-4),dev:usd?'USD':'CAD',banque:'RBC',action:'verser'})}
      else if(/ORDER|COMMANDE/.test(h.join(' '))&&/SKU|PRODUCT|PRODUIT|TOTAL/.test(h.join(' '))){r.type='commandes';r.ventes=commandesParMois(rows);const v=r.ventes;
        r.note=v?`${v.n} commande(s) payée(s), ${v.resume}. ${methodeEff()==='adeposer'?'Ventes du mois inscrites dans « Transactions à déposer ».':'Choisissez « Ventes du mois » pour inscrire les ventes par mois dans « Transactions à déposer » (les dépôts viendront les réduire).'}`:`Commandes de la boutique (${rows.length-1} lignes) : colonnes de total ou de date introuvables.`;
        if(v&&methodeEff()==='adeposer')r.action='ventes'}
      else if(/AMERICAN EXPRESS|ELAVON|PAYMENT STATEMENT|SALES REPORT|PAYMENT REPORT|SETTLEMENT|CONSOLIDATION/.test(top+' '+ch)){r.type='reglements';r.proc=/AMEX|AMERICAN EXPRESS/.test(top+' '+ch)?'AMEX':/ELAVON/.test(top+' '+ch)?'ELAVON':'';
        if(r.proc==='AMEX'&&/CONSOLIDATION|SYNTHESE/.test(top+' '+ch)){r.note='Synthèse des relevés AMEX : les relevés mensuels servent à leur place (même information).'}
        else if(r.proc==='AMEX'){r.frais=fraisAmex(rows);r.note=r.frais?`Relevé de règlement AMEX : AMEX verse le net, après sa commission (${r.frais.resume}). « Frais du mois » inscrit ces commissions en frais de cartes, en réduction de ${methodeEff()==='adeposer'?'« Transactions à déposer »':'des ventes'}.`:'Relevé AMEX : commissions introuvables.';if(r.frais&&methodeEff()==='adeposer')r.action='frais'}
        else if(r.proc==='ELAVON'){r.frais={regle:true};r.note='Rapport Elavon : Elavon verse les ventes au complet et prélève ses frais à part, en fin de mois (sorties « ELAVON » dans le compte bancaire). « Frais du mois » crée la règle : sorties ELAVON → frais de cartes.';if(methodeEff()==='adeposer')r.action='frais'}
        else r.note='Rapport du processeur de paiement : les versements sont déjà dans le relevé bancaire. Sert au contrôle.'}
      else{const g=guess(rows);if(g.date>=0&&(g.amt>=0||g.out>=0)){Object.assign(r,{type:'banque-csv',action:'verser',doute:true,note:'Export bancaire sans numéro de compte : choisissez le compte.'})}else{r.type='document';r.note='Tableau non reconnu.';r.doute=true}}}
    else{r.type='document';r.note='Format non pris en charge ici.'}}
  catch(e){r.type='erreur';r.note='Lecture impossible : '+(e instanceof Event?'outil de lecture non chargé (connexion)':e.message||e);r.doute=true}
  return r}
/* compte du plan pour un document : par les 4 derniers chiffres, sinon un nouveau compte proposé (numéro libre, devise dans le nom) */
function boiteCompte(r,crees){const carte=/carte/.test(r.type);if(r.type==='paypal'){const nm=`PayPal ${r.dev}`;const a=PLAN.find(([n,t])=>norm(t)===norm(nm))||PLAN.find(([n,t])=>/PAYPAL/.test(norm(t))&&devOf(n)===r.dev);return a?{acct:a[0],neuf:false}:{acct:'',neuf:true,nom:nm}}
  if(r.der){const a=PLAN.find(([n,t])=>t.includes(r.der)&&(carte?/^2/.test(n):/^1/.test(n)));if(a)return{acct:a[0],neuf:false};const k=crees.find(c=>c.der===r.der&&c.carte===carte);if(k)return{acct:k.acct,neuf:true,nom:k.nom}}
  const nom=carte?`Carte ${r.banque||''} ${r.dev==='USD'?'USD ':''}${r.der}`.replace(/\s+/g,' ').trim():`Banque ${r.banque||''} ${r.dev} ${r.der}`.replace(/\s+/g,' ').trim();return{acct:'',neuf:true,nom}}
function boiteNumero(carte,pris){const R=carte?[2141,2149]:[1061,1099];for(let n=R[0];n<=R[1];n++)if(!pris.has(String(n)))return String(n);return carte?'2199':'1099'}
async function boiteAnalyser(files){const box=$('bxOut');box.innerHTML='<p class="note">Ouverture du paquet…</p>';
  const F=await boiteDeplier(files);const L=[];for(const[k,f]of F.entries()){box.innerHTML=`<p class="note">Lecture de ${esc(f.name)} (${k+1}/${F.length})…</p>`;L.push(await boiteReconnaitre(f))}
  /* doublons : fichier identique (même contenu, peu importe le nom), ou même rapport en CSV et en Excel */
  const copie=x=>/COPIE|COPY|\(\d+\)\.\w+$| \d\.\w+$/.test(norm(x.nom));const vu=new Map();for(const r of L){if(!r.hash)continue;let o=vu.get(r.hash);if(!o){vu.set(r.hash,r);continue}let d=r;if(copie(o)&&!copie(r)){vu.set(r.hash,r);d=o;o=r}Object.assign(d,{action:'ignorer',doublon:true,note:`Doublon exact de « ${o.nom} » : écarté.`})}
  const cmd=L.filter(r=>r.type==='commandes'&&r.ventes&&!r.doublon);cmd.forEach((r,i)=>{const o=cmd.slice(0,i).find(x=>x.ventes.n===r.ventes.n&&JSON.stringify(x.ventes.M)===JSON.stringify(r.ventes.M));if(o){r.action='ignorer';r.doublon=true;r.note=`Même rapport de commandes que « ${o.nom} » (autre format) : écarté.`}});
  /* comptes personnels : on ne verse rien sans décision */
  L.filter(r=>r.perso&&['banque','carte'].includes(r.type)&&!r.doublon).forEach(r=>{r.action='ignorer';r.doute=true;r.note=`À RÉGLER — compte personnel ou d’une autre entité? Le nom de l’entreprise (${C.nom}) n’apparaît pas sur ce relevé. Est-ce qu’on le prend en compte (dépenses d’entreprise payées par l’actionnaire → avances), le met dans les Comptes liés pour apparier les virements, ou l’écarte? Choisissez « Verser » seulement si c’est bien un compte de l’entreprise.`});
  /* comptes : existants, ou à créer (un seul par compte même s'il y a plusieurs relevés) */
  const pris=new Set(PLAN.map(p=>p[0])),crees=[];
  /* compte générique existant à reprendre (et renommer) plutôt que d'en créer un : même nature, même devise, sans numéro de compte dans le nom; d'abord celui qui a un solde d'ouverture */
  const reprendre=(r,nom)=>{const carte=/carte/.test(r.type),pp=r.type==='paypal',ouv=C.ouv?.s||{},pris2=new Set(crees.map(c=>c.acct));
    const cands=srcAccounts().filter(([n,t])=>!isHeader(n,t)&&!pris2.has(n)&&!/\d{4}/.test(t)&&(carte?/^2/.test(n):/^1/.test(n))&&devOf(n)===r.dev&&(pp?/PAYPAL/.test(norm(t)):!/PAYPAL|CAISSE|EPARGNE|PLACEMENT/.test(norm(t)))&&(!carte||!r.banque||true));
    const marque=([n,t])=>carte?(/VISA/.test(norm(t))&&/VISA/.test(norm(r.chemin+' '+r.nom))?2:/MASTERCARD/.test(norm(t))&&/MASTER/.test(norm(r.chemin+' '+r.nom))?2:0):0;
    const c=cands.sort((a,b)=>(ouv[b[0]]?1:0)-(ouv[a[0]]?1:0)||marque(b)-marque(a)||a[0].localeCompare(b[0]))[0];return c?{acct:c[0],ancien:c[1],nom}:null};
  for(const r of L.filter(r=>r.action==='verser')){const c=boiteCompte(r,crees);if(c.acct){r.acct=c.acct;r.neuf=c.neuf}else if(c.neuf&&!c.acct&&(()=>{const k=reprendre(r,c.nom);if(!k)return false;crees.push({acct:k.acct,nom:k.nom,dev:r.dev,der:r.der,carte:/carte/.test(r.type),ancien:k.ancien});r.acct=k.acct;r.neuf=true;return true})()){}else{const carte=/carte/.test(r.type);const n=r.type==='paypal'?(()=>{for(let x=1068;x<1099;x++)if(!pris.has(String(x)))return String(x)})():boiteNumero(carte,pris);pris.add(n);crees.push({acct:n,nom:c.nom,dev:r.dev,der:r.der,carte});r.acct=n;r.neuf=true}}
  /* un même compte en PDF et en CSV : les relevés PDF (avec leurs soldes) passent avant l'export */
  for(const r of L.filter(r=>/-csv$/.test(r.type)&&r.acct))if(L.some(x=>x.acct===r.acct&&(x.type==='banque'||x.type==='carte'))){r.action='ignorer';r.note='Même compte que les relevés PDF : l’export CSV ferait double (les PDF donnent aussi les soldes pour la conciliation).'}
  const etats=L.filter(r=>r.type==='etats'&&r.tbp?.length).sort((a,b)=>(b.fin||'').localeCompare(a.fin||''));const x=curEx();
  const cible=x?addDays(x.deb,-1):etats[0]?.fin;const bon=etats.find(r=>r.fin===cible)||(!x?etats[0]:null);
  etats.forEach(r=>{if(r===bon){r.action='ouverture';r.note+=' Servira aux soldes d’ouverture.'}else r.note+=r.fin?' Autre exercice : gardé pour référence.':''});
  if(etats.length&&!bon){etats[0].doute=true;etats[0].note+=` Aucune balance au ${cible} (veille de l’exercice) : vérifiez.`}
  const exProp=!x&&bon?.fin?{deb:addDays(bon.fin,1),fin:shiftY(bon.fin,-1)}:null;
  /* mois couverts par compte (périodes des relevés) */
  BOITE={L,crees,exProp,bon};boiteAfficher()}
const TYPES_BX={banque:'Relevé bancaire',carte:'Relevé de carte','banque-csv':'Export bancaire (CSV)','carte-csv':'Export de carte (CSV)',paypal:'Rapport PayPal (CSV)','paypal-pdf':'Rapport PayPal (PDF)',etats:'États financiers',commandes:'Commandes de la boutique',reglements:'Rapport de paiements',courriel:'Courriel',document:'Document',erreur:'Illisible',autre:'Autre'};
function boiteAfficher(){if(!BOITE)return;const{L,crees,exProp}=BOITE;const box=$('bxOut');
  const opts=a=>`<option value="">— compte —</option>`+srcAccounts().filter(([n,t])=>!isHeader(n,t)).map(([n,t])=>`<option value="${esc(n)}"${n===a?' selected':''}>${esc(n+' '+t)}</option>`).join('')+crees.filter(c=>!c.ancien).map(c=>`<option value="${esc(c.acct)}"${c.acct===a?' selected':''}>${esc(c.acct+' '+c.nom)} (nouveau)</option>`).join('');
  const ord=['banque','carte','paypal','banque-csv','carte-csv','etats','paypal-pdf','reglements','commandes','courriel','document','erreur','autre'];
  const R0=L.map((r,i)=>({r,i})).sort((a,b)=>ord.indexOf(a.r.type)-ord.indexOf(b.r.type)||String(a.r.acct||'').localeCompare(String(b.r.acct||''))||a.r.nom.localeCompare(b.r.nom));
  /* les relevés d'un même compte sur une seule ligne */
  const R=[],Rx=[];R0.forEach(x=>{if(x.r.action==='ignorer'&&!x.r.doute&&!['banque','carte','paypal','banque-csv','carte-csv','commandes','etats'].includes(x.r.type)){Rx.push(x);return}const k=['banque','carte'].includes(x.r.type)&&x.r.acct?x.r.type+'|'+x.r.acct:null;const g=k&&R.find(y=>y.k===k);if(g){g.ix.push(x.i);return}R.push({...x,k,ix:[x.i]})});
  const nb=L.filter(r=>r.action!=='ignorer').length;
  box.innerHTML=`<p style="margin:8px 0"><strong>${L.length} document(s) reconnu(s).</strong> ${nb} à verser ou à utiliser, ${L.length-nb} gardé(s) pour référence. Vérifiez les lignes en jaune, puis appliquez.</p>
  ${exProp?`<p class="msg" style="margin:6px 0">Exercice proposé : du ${exProp.deb} au ${exProp.fin} (d’après les états financiers de l’an dernier).</p>`:''}
  ${crees.filter(c=>c.ancien).length?`<p class="note" style="margin:6px 0">Comptes existants repris et renommés : ${crees.filter(c=>c.ancien).map(c=>`${esc(c.acct)} « ${esc(c.ancien)} » → <strong>${esc(c.nom)}</strong>${c.dev==='USD'?' (en US$)':''}`).join(' · ')}</p>`:''}
  ${crees.filter(c=>!c.ancien).length?`<p class="note" style="margin:6px 0">Comptes à créer : ${crees.filter(c=>!c.ancien).map(c=>`<strong>${esc(c.acct)} ${esc(c.nom)}</strong>${c.dev==='USD'?' (en US$)':''}`).join(' · ')}</p>`:''}
  <div style="overflow:auto"><table class="rep"><tr class="grp"><td>Document</td><td>Reconnu comme</td><td>Compte</td><td>Action</td><td>Note</td></tr>
  ${R.map(({r,i,ix})=>`<tr${ix.some(j=>L[j].doute)?' style="background:#fff6d6"':''}><td style="max-width:260px;word-break:break-word">${ix.length>1?`<strong>${ix.length} relevés</strong><div class="why">${esc(L[ix[0]].nom)} … ${esc(L[ix[ix.length-1]].nom)}</div>`:esc(r.nom)}<div class="why">${esc(r.chemin.split('/').slice(0,-1).join(' / '))}</div></td><td>${esc(TYPES_BX[r.type]||r.type)}${r.dev==='USD'?' · US$':''}</td>
    <td>${['banque','carte','paypal','banque-csv','carte-csv'].includes(r.type)?`<select data-bxa="${ix.join(',')}" style="width:auto;max-width:220px">${opts(r.acct)}</select>`:''}</td>
    <td><select data-bxx="${ix.join(',')}" style="width:auto">${[['verser','Verser'],['ouverture','Soldes d’ouverture'],['ventes','Ventes du mois → à déposer'],['frais','Frais du mois'],['ignorer','Garder pour référence']].filter(([v])=>v!=='ouverture'||r.type==='etats').filter(([v])=>v!=='ventes'||(r.type==='commandes'&&r.ventes)).filter(([v])=>v!=='frais'||r.frais).filter(([v])=>v!=='verser'||!['etats','commandes','reglements','courriel','document','erreur','autre','paypal-pdf'].includes(r.type)).map(([v,t])=>`<option value="${v}"${r.action===v?' selected':''}>${t}</option>`).join('')}</select></td>
    <td class="note" style="max-width:360px">${esc(r.note||'')}</td></tr>`).join('')}</table></div>
  ${Rx.length?`<details style="margin-top:8px"><summary class="note">${Rx.length} document(s) sans utilité pour la comptabilité, écartés (rapports de contrôle, courriels, doublons…)</summary><ul class="note" style="margin:6px 0 0 18px">${Rx.map(({r})=>`<li>${esc(r.nom)} — ${esc(TYPES_BX[r.type]||r.type)}${r.note?' : '+esc(r.note):''}</li>`).join('')}</ul></details>`:''}
  ${L.some(r=>r.perso&&['banque','carte'].includes(r.type)&&!r.doublon)?`<p class="msg err" style="margin:8px 0">À régler : ${L.filter(r=>r.perso&&['banque','carte'].includes(r.type)&&!r.doublon).length} relevé(s) qui semblent personnels ou d’une autre entité (en jaune). Rien n’en sera versé sans votre choix.</p>`:''}
  <div class="row" style="margin-top:10px"><button class="pri" id="bxGo">Appliquer : créer les comptes et tout verser</button><button id="bxX">Annuler</button><span class="msg" id="bxMsg"></span></div>`;
  box.querySelectorAll('[data-bxa]').forEach(s=>s.onchange=()=>{s.dataset.bxa.split(',').forEach(j=>{const r=L[+j];r.acct=s.value;r.doute=!s.value});boiteAfficher()});
  box.querySelectorAll('[data-bxx]').forEach(s=>s.onchange=()=>{s.dataset.bxx.split(',').forEach(j=>{L[+j].action=s.value})});
  $('bxX').onclick=()=>{BOITE=null;box.innerHTML=''};$('bxGo').onclick=boiteAppliquer}
/* Rapport de commandes (WooCommerce, Shopify…) : une commande par numéro, payées seulement; totaux par mois, Canada / hors Canada, par devise. */
function commandesParMois(rows){const h=(rows[0]||[]).map(norm);const ix=(...re)=>{for(const x of re){const k=h.findIndex(c=>x.test(c));if(k>=0)return k}return-1};
  const I={id:ix(/^ORDER (NAME|NUMBER|ID|#)$/,/^(NAME|NUMERO|N° DE COMMANDE|COMMANDE)$/,/ORDER/),d:ix(/^ORDER DATE$/,/^DATE( DE (LA )?COMMANDE)?$/,/CREATED AT|PAID AT|DATE/),t:ix(/^ORDER TOTAL$/,/^TOTAL$/,/TOTAL/),
    cur:ix(/ORDER CURRENCY|^CURRENCY$|DEVISE/),pays:ix(/SHIPPING COUNTRY|PAYS DE LIVRAISON|^COUNTRY$|PAYS/),prov:ix(/SHIPPING (STATE|PROVINCE)|PROVINCE/),st:ix(/^(ORDER )?STATUS$|STATUT/),paid:ix(/DATE PAID|PAID AT|FINANCIAL STATUS/)};
  if(I.d<0||I.t<0)return null;const vus=new Set(),M={};let n=0;const pays={};
  for(const r of rows.slice(1)){const id=I.id>=0?String(r[I.id]||'').trim():'';if(id&&vus.has(id))continue;if(id)vus.add(id);
    if(I.st>=0&&/CANCEL|ANNUL|REFUND|REMBOURS|FAILED|ECHOU|PENDING|ATTENTE|DRAFT/.test(norm(r[I.st])))continue;if(I.paid>=0&&!String(r[I.paid]||'').trim())continue;
    const date=toISO(String(r[I.d]||'').trim(),'YMD')||toISO(String(r[I.d]||'').trim(),'DMY');const c=toCents(r[I.t]);if(!date||!c)continue;
    const dev=I.cur>=0&&String(r[I.cur]||'').trim()?String(r[I.cur]).trim().toUpperCase():'CAD',p=I.pays>=0?String(r[I.pays]||'').trim().toUpperCase():'',ca=/^(CA|CAN|CANADA)$/.test(p);
    const m=date.slice(0,7);M[m]=M[m]||{};const k=(ca?'ca':'intl')+'|'+dev;M[m][k]=(M[m][k]||0)+c;n++;pays[p||'?']=(pays[p||'?']||0)+1;
    if(ca&&I.prov>=0){const q=String(r[I.prov]||'').trim().toUpperCase()||'?';M[m]['prov|'+q]=(M[m]['prov|'+q]||0)+c}}
  if(!n)return null;const tot={};Object.values(M).forEach(x=>Object.entries(x).forEach(([k,v])=>{if(!k.startsWith('prov'))tot[k]=(tot[k]||0)+v}));
  const T=(z,d)=>tot[z+'|'+d]||0,devs=[...new Set(Object.keys(tot).map(k=>k.split('|')[1]))];
  const resume=devs.map(d=>`hors Canada ${fmtN(T('intl',d))} ${d==='USD'?'US$':'$'} · Canada ${fmtN(T('ca',d))||'0,00'} ${d==='USD'?'US$':'$'}`).join(' ; ')+` (pays : ${Object.entries(pays).sort((a,b)=>b[1]-a[1]).map(([p,k])=>`${p} ${k}`).join(', ')})`;
  return{M,n,resume,devs}}
async function jeEcrire(doc){await loadJe();const old=JE.find(j=>j.ref===doc.ref&&j.auto===doc.auto);
  if(local){LOCAL.je=LOCAL.je||{};LOCAL.je[C.id+'/'+(old?.id||'j'+Date.now()+Math.random().toString(36).slice(2,5))]=doc}else{const col=await jeCol();await(old?col.doc(old.id):col.doc()).set(doc)}LED=null;return!!old}
function compteLibre(de,a){const pris=new Set(PLAN.map(p=>p[0]));for(let n=de;n<=a;n++)if(!pris.has(String(n)))return String(n);return String(a)}
/* ventes du mois → Transactions à déposer : Dt à déposer / Ct ventes (hors Canada : détaxées; Canada : taxes à séparer selon la province, cas par cas) */
async function ventesMensuelles(r){const V=r.ventes;const ad=adepAssurer();const res=[];
  const vi=findAcc(/VENTES?.*(EXPORT|INTERNATION|HORS CANADA|ETRANGER)/)||(()=>{const n=compteLibre(4010,4099);addAccount(n,'Ventes — exportations hors Canada (détaxées)');return n})();
  let vc=null;const caAcc=()=>vc||(vc=findAcc(/VENTES?.*CANADA(?!.*HORS)/)||(()=>{const n=compteLibre(4010,4099);addAccount(n,'Ventes — Canada (taxables)');return n})());
  const x=curEx();for(const m of Object.keys(V.M).sort()){const fin=`${m}-${String(new Date(+m.slice(0,4),+m.slice(5,7),0).getDate()).padStart(2,'0')}`;
    if(x&&(fin<x.deb||m+'-01'>x.fin)){res.push(`${m} : hors de l’exercice, ignoré.`);continue}if(lk(fin)){res.push(`${m} : exercice fermé ou protégé, ignoré.`);continue}
    const lignes=[],det=[];let ok=true;
    for(const[k,c]of Object.entries(V.M[m])){const[z,dev]=k.split('|');if(z==='prov')continue;let cad=c,tx='';
      if(dev!=='CAD'){if(dev!=='USD'){res.push(`${m} : devise ${dev} non prise en charge.`);ok=false;break}await tauxAssurer(m+'-01',fin);const L=Object.entries(C.taux||{}).filter(([d])=>d.slice(0,7)===m).map(([,v])=>v);
        if(!L.length){res.push(`${m} : taux de change introuvable.`);ok=false;break}const moy=+(L.reduce((a,b)=>a+b,0)/L.length).toFixed(4);cad=Math.round(c*moy);tx=` (${fmtN(c)} US$ × ${moy}, taux moyen du mois)`}
      lignes.push({a:z==='ca'?caAcc():vi,d:0,c:cad});det.push(`${z==='ca'?'Canada':'hors Canada'} ${fmtN(cad)} $${tx}`)}
    if(!ok||!lignes.length)continue;const tot=lignes.reduce((a,l)=>a+l.c,0);lignes.unshift({a:ad,d:tot,c:0});
    const doc={date:x&&fin>x.fin?x.fin:fin,ref:`VENTES ${m}`,desc:`Ventes de ${moisLbl(m)} selon le rapport de commandes : ${det.join(' · ')}`.slice(0,240),type:'normal',auto:'ventes-commandes',ex:exOf(fin),lines:lignes,updated:new Date().toISOString()};
    const remp=await jeEcrire(doc);res.push(`${moisLbl(m)} : ${fmtN(tot)} $ CA${remp?' (écriture remplacée)':''}.`);
    const prov=Object.entries(V.M[m]).filter(([k])=>k.startsWith('prov|'));if(prov.length)res.push(`   Canada par province : ${prov.map(([k,v])=>`${k.slice(5)} ${fmtN(v)}`).join(', ')} : taxes à séparer selon la province de livraison.`)}
  audit('Ventes du mois',`${r.nom} : ${res.length} mois → ${ad} ${accName(ad)}`);return res}
/* Relevé de règlement AMEX (Payment Statement) : une ligne « TOTAL jj/mm/aaaa » par versement; à la fin : brut, débits, remboursements, commission, frais de service, versé. */
function fraisAmex(rows){const top=norm(rows.slice(0,6).map(x=>x.join(' ')).join(' '));const dev=/USD|US DOLLAR/.test(top)?'USD':'CAD';const M={};let n=0;
  for(const r of rows){const cel=r.map(x=>String(x??'').trim()).filter(Boolean);const t=cel.find(x=>/^TOTAL \d{2}\/\d{2}\/\d{4}$/.test(x));if(!t)continue;
    const nums=cel.filter(x=>/^\(?-?\$?\s?-?[\d,]*\d(\.\d{1,2})?\s?\$?\)?$/.test(x)&&/[.$]/.test(x+(/^-?\d+$/.test(x)?'':''))).map(toCents).filter(v=>v!=null);if(nums.length<6)continue;const fee=nums[nums.length-3]+nums[nums.length-2];
    const[d,mo,y]=t.slice(6).split('/');const m=`${y}-${mo}`;M[m]=(M[m]||0)+fee;n++}
  if(!n)return null;const tot=Object.values(M).reduce((a,b)=>a+b,0);return{M,dev,resume:`${n} versements, commissions ${fmtN(-tot)} ${dev==='USD'?'US$':'$'}`}}
async function moyMois(m){const fin=`${m}-${String(new Date(+m.slice(0,4),+m.slice(5,7),0).getDate()).padStart(2,'0')}`;await tauxAssurer(m+'-01',fin);const L=Object.entries(C.taux||{}).filter(([d])=>d.slice(0,7)===m).map(([,v])=>v);return L.length?+(L.reduce((a,b)=>a+b,0)/L.length).toFixed(4):null}
const fraisAcc=()=>findAcc(/FRAIS DE CARTES?|CARTE DE CREDIT ET DE PAIEMENT|FRAIS DE TRAITEMENT|FRAIS MARCHAND|MERCHANT/)||(()=>{const n=compteLibre(6270,6299);addAccount(n,'Frais de carte de crédit et de paiement');return n})();
/* frais des processeurs : AMEX (déduits des versements) → écriture par mois; Elavon (prélevés à part) → règle de classement des sorties */
async function fraisMensuels(r){const fa=fraisAcc(),res=[];
  if(r.frais?.regle){const p='ELAVON';C.rules=(C.rules||[]).filter(x=>!(x.p===p&&x.s==='sortie'));C.rules.push({p,a:fa,t:false,s:'sortie'});saveClient();renderRules();LED=null;audit('Règle (Boîte de dépôt)',`sorties ${p} → ${fa}`);return[`Règle : sorties « ${p} » → ${fa} ${accName(fa)} (frais prélevés en fin de mois).`]}
  const ct=methodeEff()==='adeposer'?adepAssurer():(findAcc(/VENTES?.*(EXPORT|INTERNATION)/)||findAcc(/^VENTES?\b/)||'');if(!ct)return['Compte de ventes introuvable : écriture non créée.'];const x=curEx();
  for(const m of Object.keys(r.frais.M).sort()){const fin=`${m}-${String(new Date(+m.slice(0,4),+m.slice(5,7),0).getDate()).padStart(2,'0')}`;if(x&&(fin<x.deb||m+'-01'>x.fin))continue;if(lk(fin)){res.push(`${m} : exercice fermé, ignoré.`);continue}
    let c=-r.frais.M[m],tx='';if(!c)continue;if(r.frais.dev==='USD'){const moy=await moyMois(m);if(!moy){res.push(`${m} : taux introuvable.`);continue}tx=` (${fmtN(c)} US$ × ${moy})`;c=Math.round(c*moy)}
    const L=c>0?[{a:fa,d:c,c:0},{a:ct,d:0,c}]:[{a:ct,d:-c,c:0},{a:fa,d:0,c:-c}];
    const remp=await jeEcrire({date:x&&fin>x.fin?x.fin:fin,ref:`FRAIS ${r.proc} ${m}`,desc:`Commissions ${r.proc} de ${moisLbl(m)}, déduites des versements${tx}`.slice(0,200),type:'normal',auto:'frais-'+r.proc,ex:exOf(fin),lines:L,updated:new Date().toISOString()});
    res.push(`${moisLbl(m)} : ${fmtN(c)} $ CA${remp?' (remplacée)':''}.`)}
  audit('Frais du mois',`${r.nom} : ${res.length} mois → ${fa}`);return res}
async function boiteOuverture(r,date){if(!sampleFn)throw new Error('la lecture de la balance demande l’IA');
  const pages=(await pdfPages(r.f));const T=r.tbp.map(i=>pages[i]).join('\n\n').slice(0,24000);
  const det=PLAN.filter(([n,t])=>!isHeader(n,t)&&+String(n)[0]<=3).map(p=>p.join(' ')).join('\n');
  const j=await sampleFn.json(`Voici la balance de vérification de fin d’exercice d’un client (exercice terminé le ${r.fin||'?'}), préparée par son ancien comptable :\n\n${T}\n\nPlan comptable du client dans notre logiciel (comptes de bilan seulement) :\n${det}\n\nDonne les soldes d’ouverture de l’exercice suivant, au ${date} : uniquement les comptes de BILAN (actif, passif, capitaux propres), avec les montants FINAUX (après régularisations et reclassements : colonne « Rep », « Final » ou « Après ajustements » s’il y en a plusieurs). Les comptes de résultats (revenus, charges) et les dividendes de l’exercice sont fermés dans les bénéfices non répartis : le montant des BNR doit être le solde de clôture (BNR d’ouverture + bénéfice net − dividendes). Associe chaque compte au compte le plus juste de notre plan (numéro exact); plusieurs comptes de l’ancien plan peuvent aller dans le même. Si aucun compte du plan ne convient (ex. un deuxième compte PayPal ou un compte dans une autre devise), mets "compte":"NOUVEAU" avec "nom" (nom clair, devise comprise) et "classe" (actif, passif ou capitaux) : il sera créé. Débit positif, crédit négatif; le total doit être nul.
Réponds uniquement en JSON : {"soldes":[{"compte":"1060","montant":1234.56,"source":"51211000 Banque RBC CAD"}],"remarques":"ce qui demande vérification, en 1-2 phrases"}`,{modelTier:'complex'});
  const nouv=[];for(const x of(j?.soldes||[]))if(String(x.compte).toUpperCase()==='NOUVEAU'&&x.nom){const ex=PLAN.find(([n,t])=>norm(t)===norm(x.nom));if(ex){x.compte=ex[0];continue}
    const cl=/passif/i.test(x.classe)?2:/capit/i.test(x.classe)?3:1,pris=new Set(PLAN.map(p=>p[0]));let n=cl===1&&/BANQUE|PAYPAL|COMPTE|CAISSE|STRIPE/.test(norm(x.nom))?1061:cl*1000+100;while(pris.has(String(n))&&n<cl*1000+999)n++;
    addAccount(String(n),String(x.nom).slice(0,60));if(/\bUSD\b|US\$|DOLLARS? US/.test(norm(x.nom)))C.dev={...(C.dev||{}),[String(n)]:'USD'};x.compte=String(n);nouv.push(`${n} ${x.nom}`)}
  const ok=new Set(PLAN.map(p=>p[0]));const s={};for(const x of(j?.soldes||[])){const a=String(x.compte);const c=Math.round((+x.montant||0)*100);if(!ok.has(a)||!c)continue;s[a]=(s[a]||0)+c}
  const tot=Object.values(s).reduce((a,c)=>a+c,0);return{s,tot,rem:(nouv.length?`Compte(s) créé(s) pour l’ouverture : ${nouv.join(', ')}. `:'')+String(j?.remarques||'')}}
async function boiteAppliquer(){const{L,crees,exProp}=BOITE;const say=t=>{$('bxMsg').textContent=t};$('bxGo').disabled=true;const res=[];
  try{if(exProp&&!curEx()){C.exDeb=exProp.deb;C.exFin=exProp.fin;syncEx();saveClient();res.push(`Exercice du ${exProp.deb} au ${exProp.fin}.`)}
    for(const c of crees.filter(c=>L.some(r=>r.acct===c.acct&&r.action==='verser'))){if(c.ancien){renommerCompte(c.acct,c.nom);res.push(`Compte renommé : ${c.acct} « ${c.ancien} » → ${c.nom}${c.dev==='USD'?' (US$)':''}.`)}else{addAccount(c.acct,c.nom);res.push(`Compte créé : ${c.acct} ${c.nom}${c.dev==='USD'?' (US$)':''}.`)}C.dev={...(C.dev||{}),[c.acct]:c.dev}}
    for(const r of L.filter(r=>r.action==='verser'&&r.acct&&r.dev==='USD'))if(devOf(r.acct)!=='USD'){C.dev={...(C.dev||{}),[r.acct]:'USD'}}
    saveClient();LED=null;
    const o=L.find(r=>r.action==='ouverture');if(o){say('Lecture de la balance de vérification de l’an dernier (IA)…');const x=curEx();const date=x?.deb||addDays(o.fin,1);
      try{const{s,tot,rem}=await boiteOuverture(o,date);if(Object.keys(s).length&&!tot){C.ouv={date,s};if(!C.exDeb)C.exDeb=date;syncEx();saveClient();audit('Soldes d’ouverture',`${o.nom} : ${Object.keys(s).length} comptes au ${date}`);res.push(`Soldes d’ouverture au ${date} : ${Object.keys(s).length} comptes repris de « ${o.nom} » (débits = crédits).${rem?' À vérifier : '+rem:''}`)}
        else res.push(`Soldes d’ouverture : la balance lue ne balance pas (écart ${fmt(tot)}). Saisissez-les dans Écritures › Soldes d’ouverture.`)}
      catch(e){res.push('Soldes d’ouverture non repris : '+(e.message||e)+'. Saisissez-les dans Écritures › Soldes d’ouverture.')}}
    const parC=new Map();L.filter(r=>r.action==='verser'&&r.acct).forEach(r=>parC.set(r.acct,[...(parC.get(r.acct)||[]),r]));
    setTab('rev');
    for(const[acct,R]of parC){say(`Versement dans ${acct} ${accName(acct)}…`);$('pSrc').value=acct;if(!$('pMois').value)$('pMois').value=(curEx()?.deb||new Date().toISOString()).slice(0,7);if(P&&pTimer)savePerNow();await pWriting;P=null;await openPeriod();
      const pdf=R.filter(r=>/\.pdf$/i.test(r.nom)).map(r=>r.f).sort((a,b)=>a.name.localeCompare(b.name));const pp=R.filter(r=>r.type==='paypal').map(r=>r.f);
      if(pdf.length||pp.length)await handle([...pdf,...pp]);res.push(`${acct} ${accName(acct)} : ${$('msg').innerText.split('\n').filter(Boolean).length>1?$('msg').innerText.replace(/\n/g,' · ').slice(0,400):$('msg').textContent.slice(0,300)}`);
      for(const r of R.filter(r=>/-csv$/.test(r.type))){const g=guess(r.rows);let list=autoMap(g);if(/carte/.test(r.type)){const pay=list.filter(x=>/PAYMENT|PAIEMENT|MERCI/.test(norm(x.desc)));if(pay.length&&pay.filter(x=>x.amt<0).length>pay.length/2)list=list.map(x=>({...x,amt:-x.amt}))}
        MSTAT={lu:0,added:0,dup:0,cote:0};if(list.length)await importAny(list);res.push(`${acct} : ${r.nom} — ${MSTAT.added} ajoutée(s), ${MSTAT.dup} doublon(s).`);MSTAT=null}}
    if(P&&pTimer)savePerNow();await pWriting;
    for(const r of L.filter(r=>r.action==='ventes'&&r.ventes)){say('Ventes du mois…');if(C.methode!=='adeposer'){C.methode='adeposer';saveClient();res.push('Méthode du dossier : ventes dans « Transactions à déposer » (les dépôts les réduisent).')}
      const v=await ventesMensuelles(r);res.push(`Ventes du mois depuis « ${r.nom} » → ${adepAcc()} ${accName(adepAcc())} :`,...v.map(x=>'  '+x))}
    {const vus=new Set();for(const r of L.filter(r=>r.action==='frais'&&r.frais)){say('Frais des processeurs…');const k=r.proc+(r.frais.regle?'-regle':'');const v=await fraisMensuels(r);if(r.frais.regle&&vus.has(k))continue;vus.add(k);res.push(`Frais ${r.proc} (${r.nom}) :`,...v.map(x=>'  '+x))}}
    say('Appariement des virements entre vos comptes…');const n=await pairInterne();if(n)res.push(`${n} virement(s) entre vos comptes apparié(s) (comptés une seule fois).`);
    {const P_=L.filter(r=>r.perso&&['banque','carte'].includes(r.type)&&r.action==='ignorer'&&!r.doublon);if(P_.length){C.aRegler=[...(C.aRegler||[]).filter(x=>!P_.some(r=>r.nom===x.fichier)),...P_.map(r=>({fichier:r.nom,quoi:'Compte personnel ou d’une autre entité? Relevé non versé : on le prend en compte, on le met dans les Comptes liés, ou on l’écarte?',le:new Date().toISOString().slice(0,10)}))];saveClient();res.push(`À régler : ${P_.length} relevé(s) qui semblent personnels ou d’une autre entité, non versés (voir l’Accueil).`)}}
    audit('Boîte de dépôt',`${L.length} document(s) : ${res.length} opération(s)`);LED=null;
    $('bxOut').innerHTML=`<div class="msg" style="white-space:pre-line;margin-top:8px">${esc(res.join('\n'))}</div><div class="row" style="margin-top:10px"><button class="sm pri" data-go="rec">Voir la conciliation</button><button class="sm" data-go="rev">Classer les transactions</button></div>`;BOITE=null;renderHome().catch(()=>{})}
  catch(e){console.error(e);say('Erreur : '+(e.message||e))}finally{const b=$('bxGo');if(b)b.disabled=false}}
dropzone($('bxDrop'),f=>boiteAnalyser(f).catch(err=>{$('bxOut').innerHTML=`<p class="msg err">${esc(err.message||err)}</p>`}));
$('bxFile').onchange=e=>{const f=[...e.target.files];e.target.value='';if(f.length)boiteAnalyser(f).catch(err=>{$('bxOut').innerHTML=`<p class="msg err">${esc(err.message||err)}</p>`})};
async function renderHome(){const x=curEx(),cid=C.id;$('hKpi').innerHTML='';$('hMeth').innerHTML=`<strong>Comment on tient ce dossier :</strong> ${esc(METH[methodeEff()])}${C.methode?'':' <em>(automatique : aucune facture de vente versée)</em>'}${comptesUSD().length?` · Comptes en dollars US : ${esc(comptesUSD().join(', '))}`:''}${C.notes?`<br>${esc(C.notes.slice(0,400))}`:''} <a href="#" data-go="set">Modifier</a>`;
  if(!x){$('hTodo').innerHTML='<li><i class="r"></i><div>Définissez l’exercice (début et fin)<small>Nécessaire pour les rapports, la clôture et la mission.</small></div><button class="sm pri" data-go="set">Ouvrir</button></li>';$('hMonths').innerHTML='';return}
  let L=[];try{if(local)L=Object.entries(LOCAL.periodes).filter(([k])=>k.startsWith(cid+'/')).map(([,v])=>v);else{const s=await db.collection('clients').doc(cid).collection('periodes').get();L=s.docs.map(d=>d.data())}}catch(e){}
  if(C?.id!==cid)return;PERS=L;L.forEach(todoNow);
  const ms=[];for(let m=x.deb.slice(0,7);m<=x.fin.slice(0,7);){ms.push(m);const[y,mm]=m.split('-').map(Number);m=mm===12?`${y+1}-01`:`${y}-${String(mm+1).padStart(2,'0')}`}
  const now=new Date().toISOString().slice(0,7),by=m=>L.filter(p=>p.mois===m),todo=ms.reduce((s,m)=>s+by(m).reduce((t,p)=>t+(+p.todo||0),0),0);
  $('navTodo').hidden=!todo;$('navTodo').textContent=todo;$('navTodo').title=`${todo} transaction(s) à classer dans l’exercice (tous les mois) : voyez les mois en rouge dans l’Accueil.`;
  $('hMonths').innerHTML=ms.map(m=>{const P_=by(m),n=P_.reduce((s,p)=>s+(+p.n||0),0),t=P_.reduce((s,p)=>s+(+p.todo||0),0),fut=m>now;
    const sa=(C.sansAct||[]).includes(m),cls=!P_.length?(fut?'fut':sa?'o':''):t?'r':'o',st=!P_.length?(fut?'À venir':sa?'Aucune activité':'Aucun relevé'):t?`${t} à classer`:P_.every(p=>p.revise)?'Révisé ✓':P_.every(p=>p.statut==='importée')&&C.sage50?'Importé dans Sage':'Classé';
    return `<button class="mo ${cls}" data-mo="${m}" data-src="${esc(P_[0]?.src||'')}"><b>${esc(moisLbl(m))}</b><span>${st}</span>${n?`<small>${n} transaction${n>1?'s':''}</small>`:''}</button>`}).join('');
  const T=[];const add=(c,t,s,go,lbl)=>T.push(`<li><i class="${c}"></i><div>${t}${s?`<small>${s}</small>`:''}</div>${go?`<button class="sm${c==='r'?' pri':''}" data-go="${go}">${lbl}</button>`:''}</li>`);
  (C.aRegler||[]).forEach((x,k)=>T.push(`<li><i class="r"></i><div>À régler : ${esc(x.quoi)}<small>${esc(x.fichier)} · ${esc(x.le||'')}</small></div><button class="sm" data-aregler="${k}">Réglé</button></li>`));
  {const L=[...(C.ex||[])].sort((a,b)=>a.deb.localeCompare(b.deb)),vieux=L.slice(0,-2).filter(x=>x.statut!=='ferme');
    if(vieux.length)add('g',`${vieux.length>1?`${vieux.length} exercices de plus de deux ans sont`:`L’exercice ${exLbl(vieux[0])} est`} encore ouvert${vieux.length>1?'s':''}`,`${vieux.map(exLbl).join(' · ')} : si la T2 est produite, c’est le temps de fermer — les chiffres déclarés seront protégés.`,'set','Fermer…');
    const prec=L.length>=2?L[L.length-2]:null;if(prec&&prec.statut!=='ferme'&&!vieux.includes(prec)&&new Date()>new Date(addDays(prec.fin,180)+'T12:00'))add('g',`Exercice ${exLbl(prec)} encore ouvert`,'Plus de six mois après sa fin : si la T2 est produite, fermez-le pour protéger les chiffres déclarés.','set','Fermer…')}
  {const trn=ms.reduce((s,m)=>s+by(m).reduce((t,p)=>t+(+p.trn||0),0),0);if(trn){const m=ms.find(m=>by(m).some(p=>+p.trn));add('g',`Compte transitoire ${esc(C.tr)} : ${trn} transaction${trn>1?'s':''} à régulariser`,`Classées au transitoire en attendant une précision : ${[...new Set(ms.flatMap(m=>by(m).filter(p=>+p.trn).map(p=>`${moisLbl(m)} : ${p.trn}`)))].slice(0,8).join(' · ')}`,'mo:'+m+':'+(by(m).find(p=>+p.trn)?.src||''),'Voir')}}
  if(todo){const m=ms.find(m=>by(m).some(p=>+p.todo));add('r',`${todo} transaction${todo>1?'s':''} au compte transitoire`,`${[...new Set(ms.flatMap(m=>by(m).filter(p=>+p.todo).map(p=>`${moisLbl(m)} (${p.src} ${accName(p.src)}) : ${p.todo}`)))].slice(0,6).join(' · ')}`,'mo:'+m+':'+(by(m).find(p=>+p.todo)?.src||''),'Classer');T.push(`<li><i class="g"></i><div>Demander les détails au client<small>${(()=>{const d=(C.demandes||[]).at(-1);return d?`Dernière demande envoyée le ${new Date(d.date).toLocaleDateString('fr-CA',{day:'numeric',month:'long'})} à ${esc(d.to)} (${d.n} transaction${d.n>1?'s':''})`:'Envoie la liste des transactions à préciser par courriel'})()}</small></div><button class="sm" data-askcli>Envoyer</button></li>`)}
  const SA=new Set(C.sansAct||[]),miss=ms.filter(m=>m<now&&!by(m).length&&!SA.has(m));if(miss.length)T.push(`<li><i class="g"></i><div>${miss.length} mois sans relevé<small>${miss.slice(0,6).map(moisLbl).join(', ')+(miss.length>6?'…':'')}</small></div><div class="row" style="gap:6px;justify-content:flex-end"><button class="sm" data-sansact="${miss[0]}" title="Aucun relevé à déposer pour ce mois">Aucune activité en ${esc(moisLbl(miss[0]))}</button><button class="sm" data-go="mo:${miss[0]}:">Déposer</button></div></li>`);
  /* mise en place du dossier : ce qui manque encore */
  const SET=[];const setItem=(t,s,btns)=>SET.push(`<li><i class="g"></i><div>${t}${s?`<small>${s}</small>`:''}</div><div class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">${btns}</div></li>`);
  if(!x.ouv)setItem('Soldes d’ouverture','Nouveau client qui démarre? Les soldes sont à zéro. Client qui change de comptable? Importez la balance de vérification de la fin de l’exercice précédent.',`<button class="sm" data-ouv0>Nouveau client : soldes à zéro</button><button class="sm pri" data-go="je">Importer la BV</button>`);
  if(!C.desc&&!FICHE?.description)setItem('Description de l’entreprise','Activités, employés, véhicules… L’IA s’en sert pour classer les transactions.','<button class="sm" data-go="set">Décrire</button>');
  if(!C.email&&!FICHE?.courriel)setItem('Courriel du client','Pour lui envoyer les demandes de précisions.','<button class="sm" data-go="set">Ajouter</button>');
  if(window.tlFiche&&FICHE===null&&chargerFiche.fait)setItem('Fiche client dans Gestion du cabinet','Aucune fiche à ce nom : créez-la pour les échéances, le contrat et la facturation.','<a class="sm" href="centre.html" style="align-self:center">Ouvrir Gestion du cabinet</a>');
  if(!L.length)setItem('Premier relevé bancaire','Déposez les relevés de la banque et des cartes de crédit pour commencer.',`<button class="sm" data-go="mo:${x.deb.slice(0,7)}:">Déposer</button>`);
  if(SET.length)T.unshift(`<li style="display:block;border:0;padding:4px 0 0"><strong>Mise en place du dossier</strong></li>`,...SET,`<li style="display:block;border:0;padding:8px 0 0"><strong>Travail en cours</strong></li>`);
  /* contrôles selon le profil de l'entreprise (TPS/TVQ, employés) */
  try{const prof={tx:C.profil?.tx??FICHE?.tps_tvq,emp:C.profil?.emp??FICHE?.employeur},dans=d=>d>=x.deb&&d<=x.fin&&!lk(d);
    if(prof.tx===false){let n=0,tot=0;L.forEach(p=>(p.tx||[]).forEach(t0=>{const t={...t0};classify(t);if(t.tax&&dans(t.date)){n++;tot+=Math.abs(t.amt)}}));
      if(!LED)LED=await loadLedger();const ta=[C.tpsA,C.tvqA,C.tpsV,C.tvqV].filter(Boolean),je=LED.filter(e=>e.kind!=='rel'&&dans(e.date)&&e.lines.some(l=>ta.includes(l[0]))).length;
      if(n||je)T.unshift(`<li><i class="r"></i><div>Taxes calculées alors que le client n’est pas inscrit à la TPS/TVQ<small>${n?`${n} transaction(s) bancaire(s) traitée(s) comme taxables (${fmtN(tot)} $)`:''}${n&&je?' · ':''}${je?`${je} écriture(s) ou facture(s) touchent les comptes de taxes`:''}. Correction proposée : traiter ces transactions sans taxes.</small></div><div class="row" style="gap:6px;justify-content:flex-end">${n?`<button class="sm pri" data-fixtax>Retirer les taxes</button>`:''}<button class="sm" data-iaask="Le client n’est pas inscrit à la TPS/TVQ, mais des transactions ou des écritures utilisent les comptes de TPS/TVQ. Cherche-les et propose les corrections.">Voir avec l’assistant</button></div></li>`)}
    if(prof.emp===false){if(!LED)LED=await loadLedger();const pay=PLAN.filter(([n,t])=>!isHeader(n,t)&&(['2120','2125','2130','5100','5110','5120'].includes(n)||/SALAIRE|DAS\b|RETENUES? A LA SOURCE|CHARGES SOCIALES|VACANCES A PAYER/.test(norm(t)))).map(p=>p[0]);
      const E=LED.filter(e=>dans(e.date)&&e.lines.some(l=>pay.includes(l[0])));
      if(E.length)T.unshift(`<li><i class="r"></i><div>Salaires ou DAS inscrits alors que le client n’a pas d’employés<small>${E.length} transaction(s) dans ${[...new Set(E.flatMap(e=>e.lines.map(l=>l[0]).filter(a=>pay.includes(a))))].map(a=>a+' '+accName(a)).join(', ')}. S’il s’agit de paiements à l’actionnaire ou à des sous-traitants, il faut les reclasser.</small></div><div class="row" style="justify-content:flex-end"><button class="sm pri" data-iaask="Le client n’a pas d’employés, mais il y a des transactions dans les comptes de salaires et de DAS cette année. Cherche-les, explique ce qu’elles semblent être et propose une correction (par exemple avances à l’actionnaire, dividendes ou sous-traitance).">Corriger avec l’assistant</button></div></li>`)}
  }catch(e){}
  try{if(!MIS||MIS.ex!==x.id)await loadMis();}catch(e){}if(C?.id!==cid)return;
  if(MIS){const dn=Object.values(stepDone()).filter(Boolean).length;add(MIS.statut==='terminée'?'o':'g',`Mission de compilation : ${dn} / ${STEPS.length} étapes`,MIS.statut==='terminée'?'Mission terminée.':'Reprenez là où vous étiez.','mis','Continuer')}
  else if(x.fin<=new Date().toISOString().slice(0,10))add('g','Mission de compilation à créer','L’exercice est terminé : préparez les états financiers.','mis','Créer');
  if(x.statut==='ferme')add('o','Exercice fermé','Les livres de cet exercice sont verrouillés.','','');
  const IGN=new Set(((C.ign||{})[x.id])||[]),cle=h=>h.replace(/<small>[\s\S]*$/,'').replace(/<[^>]+>/g,'').replace(/[\d\s]+/g,' ').trim().slice(0,80);let nIgn=0;
  const T2=T.filter(li=>{if(/display:block/.test(li))return true;if(IGN.has(cle(li))){nIgn++;return false}return true}).map(li=>/display:block/.test(li)?li:li.replace(/<\/li>$/,`<button class="sm" data-ign="${esc(cle(li))}" title="Ne plus afficher ce point" aria-label="Ne plus afficher ce point" style="border:0;background:transparent;color:var(--mute,#667);padding:2px 6px;min-height:0">✕</button></li>`));
  if(!T2.filter(li=>!/display:block/.test(li)).length)T2.push('<li><i class="o"></i><div>Rien en attente<small>Tout est à jour pour cet exercice.</small></div></li>');
  if(nIgn)T2.push(`<li style="display:block;border:0;padding:6px 0 0"><small class="note">${nIgn} point(s) masqué(s) · <a href="#" data-unign>Réafficher</a></small></li>`);
  $('hTodo').innerHTML=T2.join('');
  try{if(!LED)LED=await loadLedger();if(C?.id!==cid)return;const m=tbFor(LED,x);let rv=0,ch=0,cash=0;m.forEach((c,a)=>{const d=String(a)[0];if(d==='4')rv-=c;else if(d>='5')ch+=c;else if(secOf(a)==='A'&&a!==C.tr)cash+=c});
    const k=(l,v,c='')=>`<div class="kpi"><span>${l}</span><b class="${c}">${v?fmtP(v):'0,00'} $</b></div>`;
    {const n=LED.filter(e=>e.todo&&e.date>=x.deb&&e.date<=x.fin).length;if(n&&!$('hTodo').querySelector('[data-askcli]'))$('hTodo').insertAdjacentHTML('afterbegin',`<li><i class="r"></i><div>${n} transaction${n>1?'s':''} au compte transitoire<small>${(()=>{const d=(C.demandes||[]).at(-1);return d?`Demande envoyée le ${new Date(d.date).toLocaleDateString('fr-CA',{day:'numeric',month:'long'})} à ${esc(d.to)} · en attente des réponses du client`:'Demandez les détails au client par courriel'})()}</small></div><button class="sm${(C.demandes||[]).length?'':' pri'}" data-askcli>${(C.demandes||[]).length?'Renvoyer':'Envoyer'}</button>${(C.demandes||[]).length?'<button class="sm pri" data-ansimp>Importer les réponses</button>':''}</li>`)}
    $('hKpi').innerHTML=k('Produits de l’exercice',rv)+k('Charges',ch)+k(rv-ch<0?'Perte':'Bénéfice',rv-ch,rv-ch<0?'neg':'')+k('Encaisse',cash)}catch(e){}}
$('expChg').onclick=()=>setTab('rev');
$('tHome').addEventListener('click',e=>{const z=e.target.closest('[data-ign],[data-unign],[data-sansact]');if(!z)return;e.preventDefault();const x=curEx();if(!x)return;C.ign=C.ign||{};
  if(z.dataset.ign!=null){C.ign[x.id]=[...new Set([...(C.ign[x.id]||[]),z.dataset.ign])]}else if(z.hasAttribute('data-unign')){C.ign[x.id]=[]}else{C.sansAct=[...new Set([...(C.sansAct||[]),z.dataset.sansact])]}
  saveClient();renderHome()});
$('tHome').addEventListener('click',async e=>{const z=e.target.closest('[data-ouv0],[data-fixtax],[data-iaask]');if(!z)return;
  if(z.hasAttribute('data-iaask')){if(window.ASSISTANT?.demander)window.ASSISTANT.demander(z.dataset.iaask);else notify('L’assistant IA n’est pas disponible ici.');return}
  if(z.hasAttribute('data-ouv0')){if(!confirm('Confirmer que c’est un nouveau client qui démarre : tous les soldes d’ouverture sont à zéro?'))return;C.ouv={date:curEx().deb,s:{},zero:true};syncEx();saveClient();LED=null;notify('Soldes d’ouverture à zéro (nouveau client)');renderHome();return}
  if(z.hasAttribute('data-fixtax')){if(!confirm('Le client n’est pas inscrit : les transactions bancaires de cet exercice seront traitées sans TPS/TVQ, et ses règles de classement aussi. Continuer?'))return;
    const x=curEx();let n=0;C.rules=(C.rules||[]).map(r=>({...r,t:false}));const L=await iaPeriodes();
    for(const p of L){const src=(P&&P.mois===p.mois&&P.src===p.src)?P:p;let ch=0;(src.tx||[]).forEach(t=>{const c={...t};classify(c);if(c.tax&&t.date>=x.deb&&t.date<=x.fin&&!lk(t.date)){Object.assign(t,{acct:c.acct,st:'manuel',tax:false,why:'Sans taxes : client non inscrit à la TPS/TVQ',unk:false});n++;ch++}});
      if(!ch)continue;if(src===P){savePerNow();continue}p.updated=new Date().toISOString();if(local)LOCAL.periodes[C.id+'/'+p.mois+'_'+p.src]=p;else await db.collection('clients').doc(C.id).collection('periodes').doc(p.mois+'_'+p.src).set(p)}
    saveClient();LED=null;notify(`${n} transaction(s) corrigée(s) : sans TPS/TVQ`);renderHome();return}});
$('tHome').addEventListener('click',e=>{const q=e.target.closest('[data-aregler]');if(q){const x=(C.aRegler||[])[+q.dataset.aregler];C.aRegler=(C.aRegler||[]).filter((_,k)=>k!==+q.dataset.aregler);if(x)audit('Point réglé',`${x.fichier} : ${x.quoi}`);saveClient();renderHome().catch(()=>{});return}});
$('tHome').addEventListener('click',e=>{const b=e.target.closest('[data-mo],[data-go]');if(!b)return;
  let m=b.dataset.mo,src=b.dataset.src;const g=b.dataset.go||'';if(g.startsWith('mo:')){[,m,src]=g.split(':')}else if(g){setTab(g);return}
  if(mode!=='m'){mode='m';document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.mode==='m'));$('lMois').hidden=false;$('lFrom').hidden=$('lTo').hidden=true}
  $('pMois').value=m;if(src&&[...$('pSrc').options].some(o=>o.value===src))$('pSrc').value=src;setTab('rev');openPeriod()});

/* ---------- sauvegarde ---------- */
const SUBS=['periodes','ecritures','factures','missions','paies','audit'];
$('bkExp').onclick=async()=>{const say=t=>$('bkMsg').textContent=t;say('Préparation…');
  try{const out={format:'tenue-livres-v1',date:new Date().toISOString(),clients:[]};
    const L=local?Object.entries(LOCAL.clients).map(([id,d])=>({id,d})):(await db.collection('clients').get()).docs.map(x=>({id:x.id,d:x.data()}));
    for(const{id,d}of L){const c={id,data:d};for(const sub of SUBS){if(local){const src=sub==='periodes'?LOCAL.periodes:sub==='ecritures'?(LOCAL.je||{}):sub==='missions'?(LOCAL.mis||{}):sub==='paies'?(LOCAL.pay||{}):(LOCAL.inv||{});c[sub]=Object.entries(src).filter(([k])=>k.startsWith(id+'/')).map(([k,v])=>({id:k.split('/')[1],data:v}))}
        else c[sub]=(await db.collection('clients').doc(id).collection(sub).get()).docs.map(x=>({id:x.id,data:x.data()}))}out.clients.push(c);say(`Lecture : ${out.clients.length}/${L.length} dossier(s)…`)}
    const json=JSON.stringify(out);if(downloads)await downloads.save({filename:`sauvegarde_dossiers_${new Date().toISOString().slice(0,10)}.json`,data:json});else await navigator.clipboard.writeText(json);
    say(`${out.clients.length} dossier(s) exporté(s).`)}catch(e){say(e?.code==='declined'?'Téléchargement annulé.':'Exportation impossible.')}};
$('bkImp').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const say=t=>$('bkMsg').textContent=t;
  try{const j=JSON.parse(await f.text());if(j.format!=='tenue-livres-v1')throw 0;let n=0;
    for(const c of j.clients){if(local){LOCAL.clients[c.id]=c.data;for(const sub of SUBS)(c[sub]||[]).forEach(x=>{const t=sub==='periodes'?LOCAL.periodes:sub==='ecritures'?(LOCAL.je=LOCAL.je||{}):sub==='missions'?(LOCAL.mis=LOCAL.mis||{}):sub==='paies'?(LOCAL.pay=LOCAL.pay||{}):(LOCAL.inv=LOCAL.inv||{});t[c.id+'/'+x.id]=x.data})}
      else{await db.collection('clients').doc(c.id).set(c.data);for(const sub of SUBS)for(const x of c[sub]||[])await db.collection('clients').doc(c.id).collection(sub).doc(x.id).set(x.data)}
      n++;say(`Import : ${n}/${j.clients.length} dossier(s)…`)}
    say(`${n} dossier(s) importé(s).`);renderList()}catch(err){say('Fichier de sauvegarde invalide ou import impossible.')}};

/* ---------- démarrage ---------- */
renderList();
const goLocal=why=>{if(db||local)return;local=true;$('dbStatus').textContent=why;renderList()};
const start=setTimeout(()=>goLocal('Base de données injoignable : les dossiers ne seront gardés que pendant cette session.'),10000);
if(window.claude?.use){
  claude.use('db').then(d=>{if(!d){clearTimeout(start);goLocal('Connectez-vous à Claude pour enregistrer les dossiers. En attendant, rien n’est gardé après la fermeture.');return}
    db=d;let first=true;
    db.collection('clients').onSnapshot(s=>{if(first){first=false;clearTimeout(start)}if(local)return;
      CLIENTS=s.docs.map(x=>({id:x.id,...x.data()}));$('dbStatus').textContent=`${CLIENTS.filter(c=>!c.deleted).length} dossier(s) · enregistrés pour le cabinet`;renderList()},
      e=>{clearTimeout(start);$('dbStatus').textContent=e.code==='revoked'?'Accès retiré.':'Base de données indisponible pour le moment.'});
  }).catch(()=>goLocal('Base de données indisponible.'));
  claude.use('sample').then(f=>{sampleFn=f;iaInit();if(C){render();renderChat()}}).catch(()=>{});
  claude.use('dictation').then(dc=>{if(!dc)return;const mic=$('mic');mic.hidden=false;let lang='fr';
    dc.onFinal(({text})=>{const el=$('chatIn');el.value=el.value?el.value+text:text.replace(/^\s+/,'')});
    dc.onPartial(({text})=>{$('chatMsg').textContent=text?'… '+text:''});
    dc.onState(({state,reason})=>{const on=state!=='idle';mic.setAttribute('aria-pressed',on);$('micT').textContent=on?'Arrêter':'Parler';
      if(!on){$('chatMsg').textContent=reason==='not_granted'?'Micro refusé. Vous pouvez l’autoriser dans les permissions de la page.':reason==='rate_limited'?'Micro occupé, réessayez dans un instant.':reason==='upstream_error'?'Le micro a eu un problème, réessayez.':'';
        if(reason==='unavailable'){if(lang){lang=null;$('chatMsg').textContent='Dictée en français indisponible : réessayez, la langue du navigateur sera utilisée.'}else mic.hidden=true}}});
    mic.onclick=()=>{if(dc.active()){dc.stop().catch(()=>{});return}
      dc.start(lang?{language:lang}:undefined).catch(e=>{if(e.code==='not_granted')$('chatMsg').textContent='Micro refusé.';else if(e.code==='unavailable'&&lang){lang=null;$('chatMsg').textContent='Dictée en français indisponible : cliquez de nouveau.'}})}}).catch(()=>{});
  claude.use('downloads').then(d=>{downloads=d;$('dl').hidden=!d}).catch(()=>{});
}else goLocal('Base de données indisponible ici : les dossiers ne seront gardés que pendant cette session.');
}
