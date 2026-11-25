/* Centre clients — intranet : rappels TPS/TVQ, documents reçus, soumissions du portail client */
(()=>{
const cfg=window.CONFIG||{},sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SITE=cfg.APP_URL||location.origin,dl=x=>x?new Date((x.length===10?x+'T12:00':x)).toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'}):'—';
let ACC=[],PUB=[],MSG=[],CLI=[],DEM=[],PCS=[],TAB=location.hash==='#paiements'?'pay':'board',PAYF='',NEWPAY=new Set(),EDIT=null,FILT='ouvertes',PCY='';
const fn=async(name,body)=>{const{data,error}=await sb.functions.invoke(name,{body});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data};

/* périodes terminées (même logique que la fonction cc-rappels) */
const iso=d=>d.toISOString().slice(0,10),finMois=(y,m)=>new Date(Date.UTC(y,m,0));
function periodes(c,auj=new Date()){const M=+String(c.fin_exercice).slice(0,2)||12,pas=c.frequence==='mensuelle'?1:c.frequence==='trimestrielle'?3:12,dep=new Date(c.depuis+'T00:00:00Z'),out=[];
  for(let y=dep.getUTCFullYear()-1;y<=auj.getUTCFullYear();y++)for(let m=1;m<=12;m++){if(pas>1&&((m-M)%pas+pas)%pas!==0)continue;const fin=finMois(y,m);if(fin>=auj||fin<dep)continue;
    out.push({periode:`${pas===1?'M':pas===3?'T':'A'}-${iso(fin)}`,debut:iso(new Date(Date.UTC(y,m-pas,1))),fin:iso(fin),echeance:iso(pas===12?finMois(y,m+3):finMois(y,m+1))})}return out}
const STP={'à envoyer':'g','envoyée':'g','reçue':'ok','apportée au bureau':'ok','annulée':''};

async function load(){const[a,b,c,d,e,f,g,h,k,l]=await Promise.all([sb.from('cc_clients').select('*').order('nom'),sb.from('cc_demandes').select('*').order('fin',{ascending:false}),sb.from('pc_soumissions').select('*').order('updated_at',{ascending:false}),sb.from('cc_acces').select('*'),sb.from('cc_publications').select('*').order('created_at',{ascending:false}),sb.from('cc_messages').select('*').order('created_at'),sb.from('cc_contrats').select('*'),sb.from('cc_taches').select('*'),sb.from('cc_notes').select('*').order('created_at',{ascending:false}),sb.from('cc_echeances').select('*')]);
  ACC=d.data||[];PUB=e.data||[];MSG=f.data||[];CTR=g.data||[];TCH=h.data||[];NOT=k.data||[];ECH=l.data||[];
  if(a.error){$('tdem').innerHTML=`<div class="card"><p class="msg err">Lecture impossible : ${esc(a.error.message)}. Avez-vous exécuté le fichier supabase/portail_centre.sql?</p></div>`;return}
  CLI=a.data||[];DEM=b.data||[];PCS=c.data||[];render()}
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TAB));['board','dem','cli','pay','tache','pc'].forEach(k=>$('t'+k).hidden=k!==TAB);badge();({board:rBoard,dem:rDem,cli:rCli,pay:rPay,tache:rTache,pc:rPc})[TAB]()}

/* ---------- documents à recevoir ---------- */
function rDem(){const nm=id=>CLI.find(c=>c.id===id)?.nom||'?';
  const manquantes=CLI.filter(c=>c.actif).flatMap(c=>periodes(c).filter(p=>(Date.now()-new Date(p.fin))/864e5<=120&&!DEM.some(d=>d.client_id===c.id&&d.periode===p.periode)).map(p=>({...p,client_id:c.id})));
  const L=DEM.filter(d=>FILT==='toutes'||(FILT==='ouvertes'?['à envoyer','envoyée'].includes(d.statut):['reçue','apportée au bureau'].includes(d.statut)));
  $('tdem').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><div class="row">${[['ouvertes','En attente'],['recues','Reçues'],['toutes','Toutes']].map(([k,l])=>`<button class="sm${FILT===k?' pri':''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="row"><button class="sm" id="gen"${manquantes.length?'':' disabled'}>Créer les demandes des périodes terminées (${manquantes.length})</button><button class="sm pri" id="tour">Envoyer les rappels dus maintenant</button></div></div>
    <p class="sub" style="margin:10px 0 0;font-size:14px">Chaque jour, les rappels partent automatiquement : un premier courriel à la fin de la période, puis un rappel aux 7 jours (3 au plus) tant que les documents ne sont pas reçus.</p><div class="msg" id="dM"></div>
    <div class="scroll"><table style="margin-top:8px"><thead><tr><th>Client</th><th>Période</th><th>Échéance</th><th>Statut</th><th>Rappels</th><th>Documents</th><th></th></tr></thead><tbody>
    ${L.map(d=>`<tr><td><strong>${esc(nm(d.client_id))}</strong></td><td>${dl(d.debut)} au ${dl(d.fin)}</td><td>${dl(d.echeance)}</td><td><span class="pill ${STP[d.statut]||''}">${esc(d.statut)}</span>${d.recu_le?`<br><small class="sub">${dl(d.recu_le)}</small>`:''}</td><td>${d.rappels}${d.dernier_rappel?`<br><small class="sub">${dl(d.dernier_rappel)}</small>`:''}</td>
      <td>${(d.fichiers||[]).map((f,i)=>`<a href="#" data-file="${esc(f.path)}">${esc(f.nom)}</a>`).join('<br>')||'—'}</td>
      <td><div class="row" style="gap:6px">${['à envoyer','envoyée'].includes(d.statut)?`<button class="sm" data-send="${d.id}">Envoyer</button>`:''}<button class="sm" data-link="${d.id}">Copier le lien</button>${d.statut!=='apportée au bureau'?`<button class="sm" data-st="${d.id}" data-v="apportée au bureau">Apporté au bureau</button>`:''}${d.statut!=='annulée'?`<button class="sm danger" data-st="${d.id}" data-v="annulée">Annuler</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="7" class="sub">Aucune demande.</td></tr>'}</tbody></table></div></div>`}

/* ---------- dossiers clients ---------- */
const FORMES=['Société par actions','Entreprise individuelle','Société de personnes','OBNL','Fiducie','Particulier'];
const CHK=[['contrat','Contrat de services signé',1],['identite','Identité du client vérifiée (pièce d’identité)'],['conflits','Vérification des conflits d’intérêts'],['procRQ','Procuration Revenu Québec (représentant professionnel)'],['procARC','Autorisation ARC (Représenter un client)'],['portail','Accès au portail client créé',1],['intranet','Dossier comptable ouvert dans l’intranet'],['anterieurs','Documents des années antérieures reçus (états financiers, déclarations, avis de cotisation)']];
const STC={prospect:'g',actif:'ok',inactif:''};
let FT='fiche',CQ='',CS='actif',CTR=[],TCH=[],NOT=[],ECH=[],CED=null;
const societe=c=>c.type!=='particulier'&&!/individuelle|personnes|Particulier/.test(c.forme||'');
const chkAuto=(c,k)=>k==='contrat'?CTR.some(x=>x.client_id===c.id&&x.statut==='signé'):k==='portail'?ACC.some(a=>a.client_id===c.id&&a.user_id):false;
function rCli(){if(EDIT)return rFiche();
  const q=CQ.toLowerCase(),L=CLI.filter(c=>(CS==='tous'||(c.statut||'actif')===CS)&&(!q||[c.nom,c.contact,c.courriel,c.neq,c.groupe,c.telephone].some(v=>(v||'').toLowerCase().includes(q))));
  const nb=k=>CLI.filter(c=>(c.statut||'actif')===k).length;
  $('tcli').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-end"><div class="row" style="align-items:flex-end"><label class="f" style="width:300px"><b>Rechercher</b><input id="cQ" value="${esc(CQ)}" placeholder="Nom, NEQ, courriel, groupe…"></label>
    <div class="row" style="gap:6px">${[['actif','Actifs'],['prospect','Prospects'],['inactif','Inactifs'],['tous','Tous']].map(([k,l])=>`<button class="sm${CS===k?' pri':''}" data-cs="${k}">${l}${k!=='tous'?` (${nb(k)})`:''}</button>`).join('')}</div></div>
    <button class="pri" id="cNew">+ Nouveau client</button></div>
    <div class="scroll" style="margin-top:12px"><table><thead><tr><th>Client</th><th>Type</th><th>Coordonnées</th><th>Fin d’exercice</th><th>Services</th><th>Dossier</th><th></th></tr></thead><tbody>
    ${L.map(c=>{const ck=CHK.filter(([k])=>chkAuto(c,k)||c.checklist?.[k]).length,unread=MSG.filter(m=>m.client_id===c.id&&m.auteur==='client'&&!m.lu).length,ct=CTR.filter(x=>x.client_id===c.id&&x.statut!=='annulé').sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
      return `<tr><td><strong>${esc(c.nom)}</strong>${c.groupe?`<br><small class="sub">Groupe : ${esc(c.groupe)}</small>`:''}${c.contact?`<br><small class="sub">${esc(c.contact)}</small>`:''}</td><td>${c.type==='particulier'?'Particulier':esc(c.forme||'Entreprise')}<br><span class="pill ${STC[c.statut||'actif']}">${esc(c.statut||'actif')}</span></td>
      <td>${esc(c.courriel||'—')}${c.telephone?`<br><small>${esc(c.telephone)}</small>`:''}</td><td>${c.type==='particulier'?'—':esc(c.fin_exercice)}</td>
      <td>${[c.tps_tvq!==false&&c.type!=='particulier'?`TPS/TVQ ${esc(c.frequence)}`:'',c.employeur?'Employeur':''].filter(Boolean).join('<br>')||'—'}</td>
      <td><small>Ouverture : ${ck}/${CHK.length}</small><br>${ct?`<span class="pill ${ct.statut==='signé'?'ok':'g'}">Contrat ${esc(ct.statut)}</span>`:'<span class="pill r">Pas de contrat</span>'}${unread?` <span class="pill r">${unread} message(s)</span>`:''}</td>
      <td><button class="sm" data-edit="${c.id}">Ouvrir</button></td></tr>`}).join('')||'<tr><td colspan="7" class="sub">Aucun client.</td></tr>'}</tbody></table></div></div>`}

function rFiche(){const c=EDIT,neuf=!c.id;if(neuf)FT='fiche';
  const tabs=[['fiche','Fiche'],['contrat','Contrat de services'],['portail','Portail et documents'],['suivi','Tâches et journal']];
  $('tcli').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><div><button class="sm" id="cCancel">← Tous les clients</button></div>${c.id?`<span class="pill ${STC[c.statut||'actif']}">${esc(c.statut||'actif')}</span>`:''}</div>
    <h2 style="margin:12px 0 4px">${neuf?'Nouveau client':esc(c.nom)}</h2>${c.id?`<nav class="tabs">${tabs.map(([k,l])=>`<button data-ft="${k}" aria-pressed="${FT===k}">${l}</button>`).join('')}</nav>`:''}<div id="fBody" style="margin-top:14px"></div></div>`;
  ({fiche:fFiche,contrat:fContrat,portail:()=>{$('fBody').innerHTML=portalPanel(c).replace(/<div class="card">/g,'<div class="card" style="box-shadow:none;border:1px solid var(--line)">');if($('pTy'))syncPub(c,'type')},suivi:fSuivi})[FT]()}

function fFiche(){const c={type:'entreprise',statut:'actif',forme:'Société par actions',province:'QC',frequence:'trimestrielle',fin_exercice:'12-31',depuis:new Date().toISOString().slice(0,10),ouverture:new Date().toISOString().slice(0,10),tps_tvq:true,spcc_dpe:true,actif:true,contacts:[],checklist:{},documents:'Relevés bancaires et de cartes de crédit, factures de ventes et factures d’achats de la période.',...EDIT};
  const v=k=>esc(c[k]??''),inp=(id,l,k,t='text',ph='')=>`<label class="f"><b>${l}</b><input id="${id}" type="${t}" value="${v(k)}" placeholder="${ph}"></label>`,sel=(id,l,k,o)=>`<label class="f"><b>${l}</b><select id="${id}">${o.map(x=>{const[val,lab]=Array.isArray(x)?x:[x,x];return `<option value="${val}"${String(c[k]??'')===val?' selected':''}>${lab}</option>`}).join('')}</select></label>`;
  const grp=c.groupe?CLI.filter(x=>x.groupe===c.groupe&&x.id!==c.id):[];
  $('fBody').innerHTML=`<h3>Identification</h3><div class="grid">${sel('cTy','Type','type',[['entreprise','Entreprise'],['particulier','Particulier']])}<label class="f"><b class="req">Nom (raison sociale ou nom complet)</b><input id="cN" value="${v('nom')}"></label>
    ${sel('cFo','Forme juridique','forme',FORMES)}${sel('cSt','Statut du dossier','statut',[['prospect','Prospect'],['actif','Actif'],['inactif','Inactif']])}
    ${inp('cGr','Groupe (sociétés liées)','groupe','text','Ex. Famille Tremblay')}${inp('cRe','Responsable au cabinet','responsable','text','Ex. Fouad')}${inp('cOu','Client depuis','ouverture','date')}${sel('cLa','Langue','langue',[['fr','Français'],['en','Anglais']])}</div>
    ${grp.length?`<p class="sub" style="font-size:14px">Même groupe : ${grp.map(x=>`<a href="#" data-cli="${x.id}">${esc(x.nom)}</a>`).join(', ')}</p>`:''}
    <h3>Coordonnées</h3><div class="grid">${inp('cC','Personne-ressource principale','contact')}${inp('cE','Courriel','courriel','email')}${inp('cTel','Téléphone','telephone','tel')}${inp('cAd','Adresse','adresse')}${inp('cVi','Ville','ville')}${inp('cPr','Province','province')}${inp('cCp','Code postal','code_postal')}</div>
    <h3>Autres personnes</h3><div id="cPers">${(c.contacts||[]).map(pRow).join('')}</div><button class="sm" id="cPAdd" style="margin-top:6px">+ Ajouter une personne</button>
    <div id="cEntBloc"${c.type==='particulier'?' hidden':''}><h3>Numéros et fiscalité</h3><div class="grid">${inp('cNeq','NEQ','neq')}${inp('cBn','Numéro d’entreprise (NE)','no_entreprise','text','9 chiffres')}${inp('cTps','Numéro de TPS','no_tps','text','123456789 RT0001')}${inp('cTvq','Numéro de TVQ','no_tvq','text','1234567890 TQ0001')}
      <label class="f"><b>Fin d’exercice (mm-jj)</b><input id="cX" value="${v('fin_exercice')}" placeholder="12-31"></label></div>
      <label class="opt"><input type="checkbox" id="cDpe"${c.spcc_dpe?' checked':''}> <span>SPCC admissible à la déduction pour petite entreprise (solde fédéral payable 3 mois après la fin d’exercice; Québec : 2 mois)</span></label>
      <label class="opt"><input type="checkbox" id="cEmp"${c.employeur?' checked':''}> <span>Employeur (remises de DAS, T4/RL-1, CNESST)</span></label>
      <label class="opt"><input type="checkbox" id="cTx"${c.tps_tvq!==false?' checked':''}> <span>Inscrit à la TPS/TVQ</span></label>
      <div class="grid" id="cTxBloc"${c.tps_tvq===false?' hidden':''}>${sel('cF','Fréquence de déclaration TPS/TVQ','frequence',['mensuelle','trimestrielle','annuelle'])}<label class="f"><b>Demander les documents à partir du</b><input id="cD" type="date" value="${v('depuis')}"></label></div>
      <div id="cTxBloc2"${c.tps_tvq===false?' hidden':''}><label class="f" style="margin-top:10px"><b>Documents demandés (texte du courriel de rappel)</b><textarea id="cT">${v('documents')}</textarea></label>
      <label class="opt"><input type="checkbox" id="cA"${c.actif?' checked':''}> <span>Envoyer automatiquement les demandes de documents et les rappels</span></label></div></div>
    <h3>Ouverture du dossier</h3><div style="display:grid;gap:4px">${CHK.map(([k,l,auto])=>{const ok=auto?chkAuto(c,k):!!c.checklist?.[k];return `<label class="opt"><input type="checkbox" data-chk="${k}"${ok?' checked':''}${auto?' disabled':''}> <span>${l}${auto?' <small class="sub">(automatique)</small>':c.checklist?.[k]?` <small class="sub">(${dl(c.checklist[k])})</small>`:''}</span></label>`}).join('')}</div>
    <label class="f" style="margin-top:12px"><b>Notes internes</b><textarea id="cNo">${v('notes')}</textarea></label>
    <div class="row" style="margin-top:12px"><button class="pri" id="cSave">${c.id?'Enregistrer':'Créer le client'}</button>${c.id?'<button class="sm danger" id="cDel">Supprimer le client</button>':''}<span class="msg" id="cM"></span></div>`}
const pRow=(p={})=>`<div class="row pers" style="gap:8px;margin-bottom:6px;align-items:flex-end">${[['nom','Nom'],['role','Rôle (actionnaire, conjoint…)'],['courriel','Courriel'],['telephone','Téléphone']].map(([k,l])=>`<label class="f" style="flex:1;min-width:150px"><b>${l}</b><input data-p="${k}" value="${esc(p[k]||'')}"></label>`).join('')}<button class="sm danger" data-pdel>Retirer</button></div>`;
async function saveFiche(){const c=EDIT,g=id=>$(id)?.value.trim()||null,tx=$('cTx')?.checked!==false&&$('cTy').value!=='particulier',st=$('cSt').value;
  const chk={...(c.checklist||{})};document.querySelectorAll('[data-chk]:not([disabled])').forEach(x=>{if(x.checked)chk[x.dataset.chk]=chk[x.dataset.chk]||new Date().toISOString().slice(0,10);else delete chk[x.dataset.chk]});
  const row={type:$('cTy').value,nom:g('cN'),forme:$('cFo').value,statut:st,groupe:g('cGr'),responsable:g('cRe'),ouverture:g('cOu'),langue:$('cLa').value,contact:g('cC'),courriel:g('cE'),telephone:g('cTel'),adresse:g('cAd'),ville:g('cVi'),province:g('cPr'),code_postal:g('cCp'),
    neq:g('cNeq'),no_entreprise:g('cBn'),no_tps:g('cTps'),no_tvq:g('cTvq'),fin_exercice:/^\d\d-\d\d$/.test($('cX')?.value||'')?$('cX').value:'12-31',spcc_dpe:!!$('cDpe')?.checked,employeur:!!$('cEmp')?.checked,tps_tvq:tx,
    frequence:$('cF')?.value||'trimestrielle',depuis:g('cD')||new Date().toISOString().slice(0,10),documents:g('cT')||c.documents||'Relevés bancaires et de cartes de crédit, factures de ventes et factures d’achats de la période.',actif:tx&&st==='actif'&&!!$('cA')?.checked,
    contacts:[...document.querySelectorAll('.pers')].map(r=>Object.fromEntries([...r.querySelectorAll('[data-p]')].map(i=>[i.dataset.p,i.value.trim()]))).filter(p=>p.nom||p.courriel),checklist:chk,notes:g('cNo'),updated_at:new Date().toISOString()};
  if(!row.nom){$('cM').textContent='Nom requis.';$('cM').className='msg err';return}
  const r=c.id?await sb.from('cc_clients').update(row).eq('id',c.id).select().single():await sb.from('cc_clients').insert(row).select().single();
  if(r.error){$('cM').textContent=r.error.message;$('cM').className='msg err';return}
  await load();EDIT=CLI.find(x=>x.id===r.data.id)||r.data;TAB='cli';render();$('cM').textContent=c.id?'Enregistré.':'Client créé. Prochaine étape : le contrat de services.';$('cM').className='msg ok'}

/* ---------- contrat de services ---------- */
const UN=window.CONTRAT?.UNITES||{};
function fContrat(){const c=EDIT,L=CTR.filter(x=>x.client_id===c.id).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  if(CED)return ctrEditor();
  $('fBody').innerHTML=`<div class="row" style="justify-content:space-between"><p class="sub" style="margin:0;font-size:14px">Répondez au questionnaire, cochez les services et inscrivez les tarifs : le contrat complet se rédige tout seul. Envoyez-le ensuite au client pour signature électronique dans son portail, ou imprimez-le.</p><button class="pri" id="kNew">+ Nouveau contrat</button></div>
    <table style="margin-top:12px"><thead><tr><th>Contrat</th><th>Services</th><th>Statut</th><th></th></tr></thead><tbody>${L.map(k=>{const n=Object.values(k.donnees?.services||{}).filter(s=>s.on).length;return `<tr><td><strong>${esc(k.numero||'—')}</strong><br><small class="sub">Créé le ${dl(k.created_at)}</small></td><td>${n} service(s)${k.donnees?.mode==='forfait'&&k.donnees.forfait?`<br><small>Forfait ${Number(k.donnees.forfait).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})}/mois</small>`:''}</td>
      <td><span class="pill ${k.statut==='signé'?'ok':k.statut==='envoyé'?'g':k.statut==='annulé'?'':'g'}">${esc(k.statut)}</span>${k.envoye_le?`<br><small class="sub">Envoyé le ${dl(k.envoye_le)}</small>`:''}${k.signe_le?`<br><small class="sub">Signé le ${dl(k.signe_le)} par ${esc(k.signe_nom)}</small>`:''}</td>
      <td><div class="row" style="gap:6px">${k.statut==='brouillon'?`<button class="sm" data-kedit="${k.id}">Modifier</button>`:''}<button class="sm" data-kprint="${k.id}">Imprimer / PDF</button>${k.statut==='brouillon'?`<button class="sm pri" data-ksend="${k.id}">Envoyer pour signature</button>`:''}${['brouillon','envoyé'].includes(k.statut)?`<button class="sm danger" data-kcancel="${k.id}">Annuler</button>`:''}${k.statut!=='brouillon'?`<button class="sm" data-kcopy="${k.id}">Dupliquer</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="4" class="sub">Aucun contrat pour ce client.</td></tr>'}</tbody></table><div class="msg" id="kM"></div>`}
function ctrEditor(){const c=EDIT,d=CED.d,S=window.CONTRAT.SERVICES,cats=[...new Set(S.map(s=>s.cat))];
  const yn=(k,l,extra='')=>`<div class="kq"><span>${l}</span><div class="row" style="gap:6px"><button class="sm${d[k]?' pri':''}" data-yn="${k}" data-v="1">Oui</button><button class="sm${!d[k]?' pri':''}" data-yn="${k}" data-v="0">Non</button>${d[k]?extra:''}</div></div>`;
  const ni=(k,w=90,ph='')=>`<input data-k="${k}" value="${esc(d[k]??'')}" style="width:${w}px" placeholder="${ph}">`;
  $('fBody').innerHTML=`<div class="kgrid"><div>
    <h3 style="margin-top:0">1. Services</h3>${cats.map(cat=>`<p style="margin:12px 0 4px"><strong>${cat}</strong></p>${S.filter(s=>s.cat===cat).map(s=>{const x=d.services[s.id]||{};return `<div class="ksv"><label class="opt" style="flex:1"><input type="checkbox" data-sv="${s.id}"${x.on?' checked':''}> <span>${s.nom}</span></label>${x.on&&(d.mode==='service'||s.unite==='heure')?`<input data-svt="${s.id}" value="${esc(x.tarif??'')}" placeholder="${s.unite==='heure'?esc(d.horaire):'Tarif'}" style="width:90px"> <select data-svu="${s.id}">${Object.entries(UN).map(([k,l])=>`<option value="${k}"${(x.unite||s.unite)===k?' selected':''}>${l}</option>`).join('')}</select>`:''}</div>`}).join('')}`).join('')}
    <h3>2. Tarification</h3><div class="row" style="gap:6px"><button class="sm${d.mode==='forfait'?' pri':''}" data-mode="forfait">Forfait mensuel</button><button class="sm${d.mode==='service'?' pri':''}" data-mode="service">Tarif par service</button></div>
    ${d.mode==='forfait'?`<div class="kq"><span>Montant du forfait mensuel ($, avant taxes)</span>${ni('forfait',110,'0,00')}</div>`:''}<div class="kq"><span>Taux horaire (travaux hors forfait, représentation, conseils)</span>${ni('horaire',90)}</div>
    <h3>3. Questions</h3>
    <div class="kq"><span>Date d’entrée en vigueur</span><input type="date" data-k="date" value="${esc(d.date)}"></div>
    <div class="kq"><span>Signataire du client</span><div class="row" style="gap:6px">${ni('sigNom',170,'Nom')}${ni('sigTitre',120,'Titre')}</div></div>
    ${d.services.tdl?.on?`<div class="kq"><span>Fréquence de la tenue de livres</span><select data-k="frequenceTdl">${['mensuelle','trimestrielle','annuelle'].map(o=>`<option${d.frequenceTdl===o?' selected':''}>${o}</option>`).join('')}</select></div>`:''}
    ${d.services.tdl?.on||d.services.tps?.on?`<div class="kq"><span>Documents à remettre au plus tard le … jour suivant la fin de période</span>${ni('delaiDocs',60)}</div>`:''}
    ${d.services.t1?.on?`<div class="kq"><span>Particuliers visés par les déclarations T1/TP-1</span>${ni('particuliers',220,'Ex. Jean Tremblay et Marie Roy')}</div>`:''}
    <div class="kq"><span>Durée du contrat</span><select data-k="duree"><option value="indeterminee"${d.duree==='indeterminee'?' selected':''}>Indéterminée</option><option value="12mois"${d.duree==='12mois'?' selected':''}>12 mois, renouvelable</option></select></div>
    <div class="kq"><span>Préavis de résiliation (jours)</span>${ni('preavis',60)}</div>
    <div class="kq"><span>Modes de paiement acceptés</span><div class="row" style="gap:8px">${[['prelevement','Prélèvement'],['virement','Virement'],['cheque','Chèque'],['carte','Carte']].map(([k,l])=>`<label class="opt" style="margin:0"><input type="checkbox" data-pay="${k}"${d.paiement.includes(k)?' checked':''}> <span>${l}</span></label>`).join('')}</div></div>
    <div class="kq"><span>Factures payables en (jours)</span>${ni('echeance',60)}</div>
    ${yn('interets','Intérêts sur les factures en retard?',`${ni('taux',50)} % par année`)}
    ${yn('avance','Avance à la signature?',`${ni('avanceMontant',90,'$')}`)}
    ${yn('indexation','Indexation annuelle des honoraires?',`max. ${ni('indexTaux',50)} %`)}
    ${yn('portail','Le client transmet ses documents par le portail client?')}
    ${yn('procurations','Procurations Revenu Québec et ARC requises?')}
    ${yn('electronique','Communications et acceptation électroniques?')}
    <label class="f" style="margin-top:10px"><b>Dispositions particulières (facultatif)</b><textarea data-k="clauses" style="min-height:70px">${esc(d.clauses||'')}</textarea></label>
    <div class="row" style="margin-top:12px"><button class="pri" id="kSave">Enregistrer le brouillon</button><button id="kPrev">Imprimer / PDF</button><button class="sm" id="kBack">Fermer</button><span class="msg" id="kM"></span></div>
    <p class="sub" style="font-size:12.5px;margin-top:10px">Modèle de contrat à faire valider une première fois par votre conseiller juridique ou l’Ordre avant usage courant.</p>
  </div><div><h3 style="margin-top:0">Aperçu</h3><iframe id="kFrame" title="Aperçu du contrat" style="width:100%;height:900px;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe></div></div>`;
  kPreview()}
const kData=()=>{const d=CED.d;return{...d,signataire:{nom:d.sigNom||'',titre:d.sigTitre||''}}};
const kClient=()=>({...EDIT,numero:CED.numero});
function kPreview(){const f=$('kFrame');if(f)f.srcdoc=window.CONTRAT.html(kClient(),kData())}
const withSig=(h,k)=>k.signe_le?h.replace('</body>',`<div style="border:2px solid #1d7a4f;background:#eef8f2;padding:12px;margin:24px 0;font-size:10.5pt">Contrat accepté électroniquement par <strong>${esc(k.signe_nom)}</strong>${k.signe_titre?', '+esc(k.signe_titre):''}, le ${new Date(k.signe_le).toLocaleString('fr-CA',{dateStyle:'long',timeStyle:'short'})}, au moyen du portail client de Boujrad CPA Inc.</div></body>`):h;
function kPrint(h){const w=window.open('','_blank');if(!w){alert('Autorisez les fenêtres surgissantes pour imprimer.');return}w.document.open();w.document.write(h.replace('</body>','<script>setTimeout(()=>print(),300)<\/script></body>'));w.document.close()}
async function kSave(){const d=kData(),row={client_id:EDIT.id,numero:CED.numero,donnees:d,updated_at:new Date().toISOString()};
  const r=CED.id?await sb.from('cc_contrats').update(row).eq('id',CED.id).select().single():await sb.from('cc_contrats').insert({...row,statut:'brouillon'}).select().single();
  if(r.error){$('kM').textContent=r.error.message;$('kM').className='msg err';return null}CED.id=r.data.id;const i=CTR.findIndex(x=>x.id===r.data.id);i>=0?CTR[i]=r.data:CTR.push(r.data);$('kM').textContent='Brouillon enregistré.';$('kM').className='msg ok';return r.data}
function kNew(src){const c=EDIT,yr=new Date().getFullYear(),n=CTR.filter(x=>(x.numero||'').startsWith(`C-${yr}-`)).length+1;
  const base=src?JSON.parse(JSON.stringify(src.donnees)):window.CONTRAT.defauts(c);base.sigNom=base.signataire?.nom||'';base.sigTitre=base.signataire?.titre||'';base.date=new Date().toISOString().slice(0,10);
  if(!src){base.services={};if(c.type==='particulier')base.services.t1={on:true};else{['tdl','tps','compil','t2'].forEach(k=>base.services[k]={on:true});if(c.employeur)['paie','releves'].forEach(k=>base.services[k]={on:true});base.services.conseil={on:true}}}
  CED={id:null,numero:`C-${yr}-${String(n).padStart(3,'0')}`,d:base};fContrat()}
document.addEventListener('input',e=>{const t=e.target;if(!CED||!$('kFrame'))return;
  if(t.dataset.k){CED.d[t.dataset.k]=t.value;kPreview()}else if(t.dataset.svt){CED.d.services[t.dataset.svt].tarif=t.value;kPreview()}});
document.addEventListener('change',e=>{const t=e.target;if(!CED||!$('kFrame'))return;
  if(t.dataset.k){CED.d[t.dataset.k]=t.value;t.tagName==='SELECT'?ctrEditor():kPreview()}else if(t.dataset.sv){const x=CED.d.services[t.dataset.sv]||{};x.on=t.checked;CED.d.services[t.dataset.sv]=x;ctrEditor()}
  else if(t.dataset.svu){CED.d.services[t.dataset.svu].unite=t.value;kPreview()}else if(t.dataset.pay){CED.d.paiement=[...document.querySelectorAll('[data-pay]:checked')].map(x=>x.dataset.pay);kPreview()}});

/* ---------- tâches et journal ---------- */
const PRI={haute:'r',normale:'',basse:'g'};
const tRow=(t,cli)=>{const ret=t.statut!=='fait'&&t.echeance&&t.echeance<new Date().toISOString().slice(0,10);return `<tr${t.statut==='fait'?' style="opacity:.55"':''}><td><strong>${esc(t.titre)}</strong>${t.details?`<br><small class="sub">${esc(t.details)}</small>`:''}${cli&&t.client_id?`<br><a href="#" data-cli="${t.client_id}"><small>${esc(CLI.find(c=>c.id===t.client_id)?.nom||'')}</small></a>`:''}</td><td>${t.echeance?`<span class="${ret?'pill r':''}">${dl(t.echeance)}</span>`:'—'}</td><td>${esc(t.responsable||'—')}</td><td><span class="pill ${PRI[t.priorite]}">${esc(t.priorite)}</span></td><td><div class="row" style="gap:6px">${t.statut==='fait'?`<button class="sm" data-tdo="${t.id}" data-v="à faire">Rouvrir</button>`:`<button class="sm pri" data-tdo="${t.id}" data-v="fait">Fait</button>`}<button class="sm danger" data-tdel="${t.id}">×</button></div></td></tr>`};
const tForm=p=>`<div class="row" style="gap:8px;align-items:flex-end;margin-top:10px"><label class="f" style="flex:2;min-width:200px"><b>Nouvelle tâche</b><input id="${p}T" placeholder="Ex. Relancer pour les relevés de décembre"></label><label class="f"><b>Échéance</b><input id="${p}E" type="date"></label><label class="f" style="width:140px"><b>Responsable</b><input id="${p}R"></label><label class="f"><b>Priorité</b><select id="${p}P"><option>normale</option><option>haute</option><option>basse</option></select></label><button class="pri" data-tadd="${p}">Ajouter</button></div>`;
function fSuivi(){const c=EDIT,T=TCH.filter(t=>t.client_id===c.id).sort((a,b)=>(a.statut==='fait')-(b.statut==='fait')||(a.echeance||'9').localeCompare(b.echeance||'9')),N=NOT.filter(n=>n.client_id===c.id);
  $('fBody').innerHTML=`<h3 style="margin-top:0">Tâches</h3><table><thead><tr><th>Tâche</th><th>Échéance</th><th>Responsable</th><th>Priorité</th><th></th></tr></thead><tbody>${T.map(t=>tRow(t)).join('')||'<tr><td colspan="5" class="sub">Aucune tâche.</td></tr>'}</tbody></table>${tForm('f')}
    <h3>Journal du dossier</h3><div class="row" style="gap:8px;align-items:flex-end"><label class="f"><b>Type</b><select id="nTy"><option value="note">Note</option><option value="appel">Appel</option><option value="rencontre">Rencontre</option><option value="courriel">Courriel</option></select></label><label class="f" style="flex:1"><b>Ce qui s’est dit ou fait</b><input id="nTx"></label><button class="pri" id="nAdd">Ajouter</button></div>
    <div style="display:grid;gap:8px;margin-top:12px">${N.map(n=>`<div style="border-left:3px solid var(--gold);padding:4px 12px"><small class="sub">${new Date(n.created_at).toLocaleString('fr-CA',{dateStyle:'medium',timeStyle:'short'})} · ${esc(n.type)}${n.auteur?' · '+esc(n.auteur):''}</small><div style="white-space:pre-wrap">${esc(n.texte)}</div></div>`).join('')||'<p class="sub">Aucune entrée.</p>'}</div>`}
let TF='ouvertes';
function rTache(){const auj=new Date().toISOString().slice(0,10),L=TCH.filter(t=>TF==='toutes'||(TF==='faites'?t.statut==='fait':t.statut!=='fait')).sort((a,b)=>(a.echeance||'9').localeCompare(b.echeance||'9'));
  const ret=TCH.filter(t=>t.statut!=='fait'&&t.echeance&&t.echeance<auj).length;
  $('ttache').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><div class="row" style="gap:6px">${[['ouvertes','À faire'],['faites','Faites'],['toutes','Toutes']].map(([k,l])=>`<button class="sm${TF===k?' pri':''}" data-tf="${k}">${l}</button>`).join('')}</div>${ret?`<span class="pill r">${ret} en retard</span>`:''}</div>
    <div class="scroll" style="margin-top:10px"><table><thead><tr><th>Tâche</th><th>Échéance</th><th>Responsable</th><th>Priorité</th><th></th></tr></thead><tbody>${L.map(t=>tRow(t,1)).join('')||'<tr><td colspan="5" class="sub">Aucune tâche.</td></tr>'}</tbody></table></div>
    ${tForm('g')}<label class="f" style="max-width:320px;margin-top:8px"><b>Client (facultatif)</b><select id="gC"><option value="">— Tâche du cabinet —</option>${CLI.map(c=>`<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label></div>`}

/* ---------- échéancier du cabinet ---------- */
const ymd=d=>d.toISOString().slice(0,10),fMois=(y,m)=>new Date(Date.UTC(y,m,0));
function plusMois(fe,n){const[y,m,d]=fe.split('-').map(Number),fin=fMois(y,m).getUTCDate()===d;return fin?ymd(fMois(y,m+n)):ymd(new Date(Date.UTC(y,m-1+n,Math.min(d,fMois(y,m+n).getUTCDate()))))}
function obligations(c,y1,y2){const out=[],st=c.statut||'actif';if(st==='inactif'||st==='prospect')return out;const add=(cle,type,titre,date,info)=>out.push({cle,type,titre,date,info,client_id:c.id});
  const mmdd=c.fin_exercice||'12-31';
  for(let y=y1-1;y<=y2;y++){
    if(c.type!=='particulier'){const fe=`${y}-${mmdd}`;
      if(c.tps_tvq!==false){const M=+mmdd.slice(0,2),pas=c.frequence==='mensuelle'?1:c.frequence==='trimestrielle'?3:12;
        for(let m=1;m<=12;m++){if(pas>1&&((m-M)%pas+pas)%pas!==0)continue;const fin=ymd(fMois(y,m));const ech=ymd(pas===12?fMois(y,m+3):fMois(y,m+1));add('tps:'+fin,'TPS/TVQ','Déclaration et paiement de TPS/TVQ',ech,`Période se terminant le ${dl(fin)}`)}}
      if(societe(c)){add('soldeqc:'+fe,'Impôt','Paiement du solde d’impôt — Québec',plusMois(fe,2),`Exercice terminé le ${dl(fe)} (2 mois)`);
        add('soldefed:'+fe,'Impôt','Paiement du solde d’impôt — fédéral',plusMois(fe,c.spcc_dpe?3:2),`Exercice terminé le ${dl(fe)} (${c.spcc_dpe?'3 mois, SPCC avec DPE':'2 mois'})`);
        add('t2:'+fe,'T2/CO-17','Production des déclarations T2 et CO-17',plusMois(fe,6),`Exercice terminé le ${dl(fe)} (6 mois)`)}
      else add('t1ind:'+y,'T1/TP-1','Production des déclarations T1 et TP-1 (travailleur autonome)',`${y+1}-06-15`,`Année ${y} · solde payable le 30 avril`)}
    else add('t1:'+y,'T1/TP-1','Déclarations T1 et TP-1 et paiement du solde',`${y+1}-04-30`,`Année ${y}`);
    if(c.employeur){for(let m=1;m<=12;m++)add(`das:${y}-${String(m).padStart(2,'0')}`,'DAS','Remise des retenues à la source (DAS)',`${y}-${String(m+1>12?1:m+1).padStart(2,'0')}-15`.replace(/^\d{4}/,m===12?y+1:y),`Paies de ${new Date(Date.UTC(y,m-1,15)).toLocaleDateString('fr-CA',{month:'long',year:'numeric'})}`);
      add('t4:'+y,'Relevés','Feuillets T4 et relevés RL-1 (et sommaires)',ymd(fMois(y+1,2)),`Année ${y}`);add('cnesst:'+y,'Relevés','Déclaration des salaires CNESST',`${y+1}-03-15`,`Année ${y}`)}}
  const dep=c.depuis||c.ouverture;return out.filter(o=>!dep||o.date>=dep)}
let EM=new Date().toISOString().slice(0,7);
function etatOb(o){const f=ECH.find(e=>e.client_id===o.client_id&&e.cle===o.cle);if(f)return{ok:1,txt:`Fait le ${dl(f.fait_le)}`};
  if(o.type==='TPS/TVQ'){const fin=o.cle.slice(4),p=PUB.find(p=>p.client_id===o.client_id&&p.periode_fin===fin&&p.montant>0);if(p?.paye_le)return{ok:1,txt:'Payé par le client'};if(p)return{txt:'Déclaration publiée, paiement à confirmer'};const d=DEM.find(d=>d.client_id===o.client_id&&d.fin===fin);if(d)return{txt:['reçue','apportée au bureau'].includes(d.statut)?'Documents reçus':'Documents : '+d.statut}}
  return{}}
function rBoard(){const[y,m]=EM.split('-').map(Number),deb=`${EM}-01`,fin=ymd(fMois(y,m)),auj=ymd(new Date());
  const ALL=CLI.flatMap(c=>obligations(c,y-1,y+1)),mois=ALL.filter(o=>o.date>=deb&&o.date<=fin).sort((a,b)=>a.date.localeCompare(b.date)),
    retard=ALL.filter(o=>o.date<deb&&o.date>=ymd(new Date(Date.UTC(y,m-7,1)))&&o.date<auj&&!etatOb(o).ok).sort((a,b)=>a.date.localeCompare(b.date));
  const types=[...new Set(mois.map(o=>o.type))],nom=id=>CLI.find(c=>c.id===id)?.nom||'?';
  const fins=CLI.filter(c=>c.type!=='particulier'&&(c.statut||'actif')==='actif'&&+String(c.fin_exercice).slice(0,2)===m),
    tch=TCH.filter(t=>t.statut!=='fait'&&t.echeance&&t.echeance<=fin).sort((a,b)=>a.echeance.localeCompare(b.echeance)),
    unread=MSG.filter(x=>x.auteur==='client'&&!x.lu).length,signes=CTR.filter(k=>k.signe_le&&(Date.now()-new Date(k.signe_le))/864e5<15),attente=CTR.filter(k=>k.statut==='envoyé');
  const row=o=>{const e=etatOb(o),late=!e.ok&&o.date<auj;return `<tr style="background:${e.ok?'#e6f5ec':late?'#fdecea':'transparent'}"><td style="white-space:nowrap"><strong>${dl(o.date)}</strong></td><td><a href="#" data-cli="${o.client_id}"><strong>${esc(nom(o.client_id))}</strong></a></td><td><span class="pill">${esc(o.type)}</span> ${esc(o.titre)}<br><small class="sub">${esc(o.info)}</small></td><td>${e.txt?`<small>${esc(e.txt)}</small>`:'—'}</td><td>${ECH.some(x=>x.client_id===o.client_id&&x.cle===o.cle)?`<button class="sm" data-undo="${o.client_id}|${o.cle}">Annuler</button>`:e.ok?'':`<button class="sm pri" data-done="${o.client_id}|${o.cle}">Fait</button>`}</td></tr>`};
  const nm=new Date(Date.UTC(y,m-1,15)).toLocaleDateString('fr-CA',{month:'long',year:'numeric'});
  $('tboard').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div class="row" style="align-items:center;gap:8px"><button class="sm" data-em="-1">←</button><h2 style="margin:0;text-transform:capitalize">${nm}</h2><button class="sm" data-em="1">→</button>${EM!==auj.slice(0,7)?'<button class="sm" data-em="0">Mois courant</button>':''}</div><button class="sm" id="bPrint">Imprimer</button></div>
    <div class="kpis">${[['Échéances du mois',mois.length],['Faites',mois.filter(o=>etatOb(o).ok).length],['En retard (mois précédents)',retard.length],['Tâches dues',tch.length]].map(([l,v])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    ${types.length?`<p class="sub" style="font-size:14px;margin:4px 0 0">${types.map(t=>`${esc(t)} : ${mois.filter(o=>o.type===t).length}`).join(' · ')}</p>`:''}</div>
    ${retard.length?`<div class="card"><h2 style="color:var(--red)">En retard</h2><div class="scroll"><table><tbody>${retard.map(row).join('')}</tbody></table></div></div>`:''}
    <div class="card"><h2>Échéances de ${nm}</h2><div class="scroll"><table><thead><tr><th>Date</th><th>Client</th><th>Obligation</th><th>Suivi</th><th></th></tr></thead><tbody>${mois.map(row).join('')||'<tr><td colspan="5" class="sub">Aucune échéance ce mois-ci.</td></tr>'}</tbody></table></div>
    <p class="sub" style="font-size:13px">Calculé à partir des fiches clients : fréquence TPS/TVQ, fin d’exercice, SPCC avec DPE, employeur et type de client. Solde d’impôt : 2 mois au Québec; 3 mois au fédéral pour une SPCC qui a droit à la DPE, sinon 2 mois. T2 et CO-17 : 6 mois. Si une date tombe un samedi, un dimanche ou un jour férié, l’échéance est reportée au jour ouvrable suivant.</p></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card"><h2>Fins d’exercice ce mois-ci</h2>${fins.map(c=>`<div><a href="#" data-cli="${c.id}">${esc(c.nom)}</a> <small class="sub">· ${esc(c.fin_exercice)}</small></div>`).join('')||'<p class="sub">Aucune.</p>'}<p class="sub" style="font-size:13px">Planifiez la demande des documents de fin d’année et la mission de compilation.</p></div>
    <div class="card"><h2>Tâches à faire</h2>${tch.slice(0,10).map(t=>`<div style="margin-bottom:6px">${t.echeance<auj?'<span class="pill r">En retard</span> ':''}<strong>${esc(t.titre)}</strong> <small class="sub">· ${dl(t.echeance)}${t.client_id?' · '+esc(nom(t.client_id)):''}</small></div>`).join('')||'<p class="sub">Rien d’urgent.</p>'}<button class="sm" data-t="tache">Toutes les tâches</button></div>
    <div class="card"><h2>À surveiller</h2><div>${unread?`<span class="pill r">${unread}</span> message(s) de clients non lus`:'Aucun message non lu'}</div><div style="margin-top:6px">${attente.length} contrat(s) en attente de signature</div>${signes.map(k=>`<div style="margin-top:6px"><span class="pill ok">Signé</span> ${esc(nom(k.client_id))} <small class="sub">· ${dl(k.signe_le)}</small></div>`).join('')}</div></div>`}

/* ---------- impôts personnels (portail) ---------- */
const LAB={prenom:'Prénom',nom:'Nom',ddn:'Date de naissance',nas:'NAS',tel:'Téléphone',courriel:'Courriel',langue:'Langue',adresse:'Adresse',app:'App.',ville:'Ville',prov:'Province',cp:'Code postal',adresse31:'Adresse au 31 décembre',arrivee:'Arrivée au Canada/Québec',citoyen:'Citoyen canadien',elections:'Élections Canada',
  etat:'État civil',date_etat:'Date du changement',c_prenom:'Conjoint : prénom',c_nom:'Conjoint : nom',c_ddn:'Conjoint : naissance',c_nas:'Conjoint : NAS',c_revenu:'Conjoint : revenu net',c_client:'Déclaration du conjoint par le cabinet',
  logement:'Logement au 31 décembre',rl31:'No de logement (RL-31)',seul:'Vit seul(e)',assur:'Assurance médicaments',mois_ramq:'Mois RAMQ',situ_detail:'Précisions',banque:'Dépôt direct',representant:'Autorise la représentation',commentaires:'Commentaires'};
const CHGL={c_adresse:'adresse',c_etat:'état civil',c_conjoint:'conjoint',c_enfants:'enfants',c_logement:'logement',c_banque:'compte bancaire',c_aucun:'aucun changement'};
function rPc(){const ys=[...new Set(PCS.map(s=>s.annee))].sort((a,b)=>b-a);if(!PCY)PCY=String(ys[0]||'');const L=PCS.filter(s=>!PCY||String(s.annee)===PCY);
  $('tpc').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><label class="f" style="width:200px"><b>Année</b><select id="pcY"><option value="">Toutes</option>${ys.map(y=>`<option${String(y)===PCY?' selected':''}>${y}</option>`).join('')}</select></label>
    <div class="row"><span class="pill g">${L.filter(s=>s.statut==='reçue').length} à traiter</span><span class="pill">${L.filter(s=>s.statut==='brouillon').length} en cours de remplissage</span></div></div>
    <p class="sub" style="font-size:14px">Les clients créent leur compte sur le portail (boujradcpa.com → Connexion → Portail client), remplissent le formulaire et déposent leurs documents.</p>
    <div class="scroll"><table><thead><tr><th>Client</th><th>Année</th><th>Type</th><th>Statut</th><th>Mis à jour</th><th>Documents</th><th></th></tr></thead><tbody>
    ${L.map(s=>{const f=s.formulaire||{};return `<tr><td><strong>${esc((f.prenom||'')+' '+(f.nom||''))}</strong><br><small class="sub">${esc(f.courriel||'')}</small></td><td>${s.annee}</td><td>${s.type==='nouveau'?'Nouveau':'Existant'}</td><td><span class="pill ${s.statut==='reçue'?'g':s.statut==='terminée'?'ok':''}">${esc(s.statut)}</span></td><td>${dl(s.updated_at)}</td><td>${(s.fichiers||[]).length}</td><td><button class="sm" data-pc="${s.id}">Ouvrir</button></td></tr>`}).join('')||'<tr><td colspan="7" class="sub">Aucune soumission.</td></tr>'}</tbody></table></div></div><div id="pcD"></div>`}
async function pcOpen(id){const s=PCS.find(x=>x.id===id);if(!s)return;const f=s.formulaire||{};
  const kv=Object.entries(LAB).filter(([k])=>f[k]!=null&&f[k]!=='').map(([k,l])=>`<dt>${esc(l)}</dt><dd>${esc(f[k])}</dd>`).join('');
  const sit=(f.situ||[]).join(', ');const chg=Object.entries(CHGL).filter(([k])=>f[k]).map(([,l])=>l).join(', ');
  const enf=(f.enfants||[]).map(e=>`<li>${esc(e.prenom)} ${esc(e.nom)} · ${esc(e.ddn)} · ${esc(e.lien||'')} · ${esc(e.garde||'')}${e.nas?' · NAS '+esc(e.nas):''}${e.handicap?' · handicap':''}</li>`).join('');
  $('pcD').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc((f.prenom||'')+' '+(f.nom||''))} · ${s.annee}</h2><button class="sm" id="pcX">Fermer</button></div>
    ${s.type==='existant'?`<p><strong>Changements déclarés :</strong> ${esc(chg||'—')}</p>`:''}<dl class="kv">${kv}</dl>${enf?`<h3>Personnes à charge</h3><ul>${enf}</ul>`:''}<h3>Situations de l’année</h3><p>${esc(sit||'—')}</p>
    <h3>Documents</h3><ul>${(s.fichiers||[]).map(x=>`<li><a href="#" data-file="${esc(x.path)}">${esc(x.nom)}</a></li>`).join('')||'<li>—</li>'}</ul>
    <div class="grid" style="margin-top:10px"><label class="f"><b>Statut</b><select id="pcS">${['brouillon','reçue','en traitement','terminée'].map(o=>`<option${s.statut===o?' selected':''}>${o}</option>`).join('')}</select></label>
    <label class="f" style="grid-column:span 2"><b>Note visible par le client</b><input id="pcN" value="${esc(s.note_cabinet||'')}"></label></div>
    <div class="row" style="margin-top:10px"><button class="pri" id="pcSave" data-id="${s.id}">Enregistrer</button><span class="msg" id="pcM"></span></div></div>`;$('pcD').scrollIntoView({behavior:'smooth'})}


/* ---------- portail entreprise : accès, documents publiés, messages ---------- */
function portalPanel(c){const A=ACC.filter(a=>a.client_id===c.id),P=PUB.filter(p=>p.client_id===c.id),Ms=MSG.filter(m=>m.client_id===c.id),D=DEM.filter(d=>d.client_id===c.id&&(d.fichiers||[]).length);
  const unread=Ms.filter(m=>m.auteur==='client'&&!m.lu);if(unread.length)sb.from('cc_messages').update({lu:true}).in('id',unread.map(m=>m.id)).then(()=>unread.forEach(m=>m.lu=true));
  return `<div class="card"><h2>Accès au portail client</h2><p class="sub" style="font-size:14px">Remettez un code à chaque personne de l’entreprise qui doit accéder à l’espace Entreprise du portail. Le code ne sert qu’une fois.</p>
    <table><thead><tr><th>Courriel</th><th>Code</th><th>Statut</th><th></th></tr></thead><tbody>${A.map(a=>`<tr><td>${esc(a.courriel||'—')}</td><td style="font-family:monospace">${esc(a.code)}</td><td>${a.user_id?`<span class="pill ok">Lié le ${dl(a.joint_le)}</span>`:'<span class="pill g">En attente</span>'}</td><td><div class="row" style="gap:6px">${a.user_id?'':`<button class="sm" data-inv="${a.id}">Copier l’invitation</button>`}<button class="sm danger" data-accdel="${a.id}">Retirer</button></div></td></tr>`).join('')||'<tr><td colspan="4" class="sub">Aucun accès.</td></tr>'}</tbody></table>
    <div class="row" style="margin-top:10px;align-items:flex-end"><label class="f" style="width:300px"><b>Courriel de la personne</b><input id="aCo" type="email" value="${esc(c.courriel||'')}"></label><button id="aNew">Créer un code d’accès</button></div><div class="msg" id="aMsg"></div></div>
  <div class="card"><h2>Publier un document pour le client</h2><p class="sub" style="font-size:14px">Ex. la déclaration de TPS/TVQ produite, avec le montant à payer, la date limite et le code de paiement. Le client la voit dans son portail.</p>
    <div class="grid"><label class="f"><b>Type</b><select id="pTy">${TYPES.map(o=>`<option>${o}</option>`).join('')}</select></label>
      <label class="f"><b>Période</b><select id="pPs">${perOpts(c)}</select></label>
      <label class="f"><b class="req">Titre</b><input id="pT"></label><label class="f"><b>Payable à</b><select id="pOr">${['Revenu Québec','ARC','Aucun paiement'].map(o=>`<option>${o}</option>`).join('')}</select></label>
      <label class="f"><b>Montant à payer ($)</b><input id="pMo" inputmode="decimal" placeholder="0,00"></label><label class="f"><b>Date limite</b><input id="pEc" type="date"></label>
      <label class="f"><b id="pCoL">Code de paiement (20 caractères)</b><input id="pCo" autocomplete="off"></label></div>
    <label class="f" style="margin-top:10px"><b>Comment payer (envoyé au client, modifiable)</b><textarea id="pIn" style="min-height:150px"></textarea></label>
    <label class="f" style="margin-top:10px"><b>Fichier(s)</b><input type="file" id="pF" multiple></label>
    <label class="opt" style="margin-top:10px"><input type="checkbox" id="pAv" checked> <span>Aviser le client par courriel (sans le montant ni le code : il les voit dans son portail)</span></label><div class="row" style="margin-top:10px"><button class="pri" id="pGo">Publier</button><span class="msg" id="pMsg"></span></div>
    <h3>Publiés</h3><table><thead><tr><th>Document</th><th>Montant</th><th>Date limite</th><th>Client</th><th></th></tr></thead><tbody>${P.map(p=>`<tr><td><strong>${esc(p.titre)}</strong><br><small class="sub">${esc(p.type)} · ${dl(p.created_at)}</small>${(p.fichiers||[]).map(f=>`<br><a href="#" data-file="${esc(f.path)}">${esc(f.nom)}</a>`).join('')}</td><td>${p.montant!=null?Number(p.montant).toLocaleString('fr-CA',{style:'currency',currency:'CAD'}):'—'}</td><td>${dl(p.echeance)}</td>
      <td>${p.paye_le?`<span class="pill ok">Payé (${dl(p.paye_le)})</span>`:p.vu_le?`<span class="pill">Vu ${dl(p.vu_le)}</span>`:'<span class="pill g">Pas encore vu</span>'}<br><small class="sub">${p.avise_le?'Avisé par courriel le '+dl(p.avise_le):'Pas avisé par courriel'}${p.rappel_le?' · rappel le '+dl(p.rappel_le):''}</small></td><td><div class="row" style="gap:6px"><button class="sm" data-avis="${p.id}">${p.avise_le?'Renvoyer l’avis':'Aviser'}</button><button class="sm danger" data-pubdel="${p.id}">Retirer</button></div></td></tr>`).join('')||'<tr><td colspan="5" class="sub">Rien de publié.</td></tr>'}</tbody></table></div>
  <div class="card"><h2>Messages et documents reçus</h2><div style="display:grid;gap:10px;max-height:420px;overflow:auto">${Ms.map(m=>`<div style="justify-self:${m.auteur==='cabinet'?'end':'start'};max-width:80%;background:${m.auteur==='cabinet'?'var(--soft)':'#fbf4e4'};border-radius:12px;padding:10px 14px"><small class="sub">${m.auteur==='cabinet'?'Cabinet':'Client'} · ${dl(m.created_at)}</small><div style="white-space:pre-wrap">${esc(m.texte)}</div>${(m.fichiers||[]).map(f=>`<a href="#" data-file="${esc(f.path)}">${esc(f.nom)}</a>`).join('<br>')}</div>`).join('')||'<p class="sub">Aucun message.</p>'}</div>
    <label class="f" style="margin-top:12px"><b>Répondre au client</b><textarea id="rTx" style="min-height:70px"></textarea></label><div class="row" style="margin-top:8px"><button class="pri" id="rGo">Envoyer</button></div>
    ${D.length?`<h3>Documents TPS/TVQ déposés</h3><ul>${D.map(d=>`<li>${dl(d.debut)} au ${dl(d.fin)} : ${(d.fichiers||[]).map(f=>`<a href="#" data-file="${esc(f.path)}">${esc(f.nom)}</a>`).join(', ')}</li>`).join('')}</ul>`:''}</div>`}

/* ---------- publication : périodes, instructions de paiement ---------- */
const TYPES=['Déclaration TPS/TVQ','Remise de DAS (Québec)','Remise de DAS (fédéral)','Solde d’impôt de la société (Québec)','Solde d’impôt de la société (fédéral)','Acomptes provisionnels','Avis de cotisation','États financiers','Lettre ou avis','Autre'];
const dLong=x=>new Date(x+'T12:00').toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'});
function perList(c){const L=periodes(c).reverse().slice(0,8);DEM.filter(d=>d.client_id===c.id).forEach(d=>{if(!L.some(p=>p.fin===d.fin))L.push(d)});return L.sort((a,b)=>b.fin.localeCompare(a.fin))}
const perLbl=p=>`${dLong(p.debut)} au ${dLong(p.fin)}`;
function perOpts(c){return perList(c).map((p,i)=>`<option value="${p.fin}"${i===0?' selected':''}>${perLbl(p)}</option>`).join('')+'<option value="">Aucune période</option>'}
function perOf(c,fin){const p=perList(c).find(x=>x.fin===fin);return p?{fin:p.fin,lbl:perLbl(p),echeance:p.echeance,debut:p.debut}:null}
function instr(org,type){
  if(org==='Revenu Québec')return `Comment payer à Revenu Québec, par le site ou l’application de votre institution financière :
1. Connectez-vous au compte bancaire de l’entreprise.
2. Ajoutez la facture (le fournisseur) « Revenu Québec – Code de paiement ». Selon votre banque, elle se trouve dans la liste des fournisseurs ou dans la section « Remises gouvernementales ».
3. Sélectionnez cette facture et inscrivez le code de paiement de 20 caractères comme numéro de compte.
4. Inscrivez le montant exact et confirmez le paiement.${type==='Déclaration TPS/TVQ'?'\nLa TPS et la TVQ se paient ensemble, en un seul paiement à Revenu Québec.':''}
Le code de paiement ne sert qu’une fois. Payez quelques jours ouvrables avant la date limite pour éviter les intérêts et les pénalités.`;
  if(org==='ARC'){const f=/DAS/.test(type)?'« Retenues sur la paye fédérales – Régulier ou trimestriel – EMPTX (PD7A) » (ou la variante « Seuil 1 » ou « Seuil 2 » si c’est votre cas)':/Acomptes/.test(type)?'« Fédéral – Paiements de l’impôt des sociétés – TXINS »':/TPS/.test(type)?'« Fédéral – Déclaration de la TPS/TVH – TPS-P »':'« Fédéral – Solde de l’impôt sur le revenu des sociétés dû – TXBAL »';
    return `Comment payer à l’Agence du revenu du Canada (ARC), par le site ou l’application de votre institution financière :
1. Connectez-vous au compte bancaire de l’entreprise.
2. Ajoutez le fournisseur ${f}. Le nom peut varier légèrement d’une banque à l’autre.
3. Comme numéro de compte, inscrivez le numéro indiqué dans le portail (numéro d’entreprise de 15 caractères).
4. Inscrivez le montant exact et confirmez le paiement.
Payez quelques jours ouvrables avant la date limite : le paiement est réputé fait le jour ouvrable où la banque le traite.`}
  return ''}
function syncPub(c,force){const ty=$('pTy').value,per=perOf(c,$('pPs').value);
  if(force==='type'){$('pOr').value=/fédéral/.test(ty)?'ARC':/États|Lettre|Avis de cotisation|Autre/.test(ty)?'Aucun paiement':'Revenu Québec'}
  const org=$('pOr').value;$('pCoL').textContent=org==='ARC'?'Numéro de compte ARC (15 caractères)':org==='Revenu Québec'?'Code de paiement (20 caractères)':'Code ou référence';
  $('pMo').disabled=$('pCo').disabled=org==='Aucun paiement';
  const short=/TPS/.test(ty)?'Déclaration de TPS/TVQ':ty;if(!$('pT').dataset.touched)$('pT').value=per?`${short} — ${per.lbl}`:short;
  if(ty==='Déclaration TPS/TVQ'&&per&&!$('pEc').dataset.touched)$('pEc').value=per.echeance;
  if(!$('pIn').dataset.touched)$('pIn').value=instr(org,ty)}
document.addEventListener('input',e=>{if(['pT','pEc','pIn'].includes(e.target.id))e.target.dataset.touched='1'});
document.addEventListener('change',e=>{if(!EDIT?.id)return;if(e.target.id==='pTy')syncPub(EDIT,'type');else if(['pPs','pOr'].includes(e.target.id))syncPub(EDIT)});

/* ---------- suivi des paiements ---------- */
const money=v=>v==null?'—':Number(v).toLocaleString('fr-CA',{style:'currency',currency:'CAD'});
function badge(){const n=PUB.filter(p=>p.paye_le&&!p.paye_vu).length,bt=document.querySelector('#tabs [data-t=pay]');if(bt)bt.innerHTML='Paiements'+(n?` <span class="pill ok" style="margin-left:4px">${n} nouveau${n>1?'x':''}</span>`:'');
  const t=$('toast');if(t){t.hidden=!n||TAB==='pay';t.innerHTML=n?`<strong>${n} client${n>1?'s ont':' a'} confirmé ${n>1?'leurs paiements':'son paiement'}.</strong> <button class="sm" data-t="pay">Voir les paiements</button>`:''}}
function rPay(){const P=PUB.filter(p=>p.montant>0&&p.organisme!=='Aucun paiement');
  const cles=[...new Set(P.map(p=>p.periode_fin||(p.echeance||'').slice(0,7)||'—'))].sort().reverse();if(!PAYF||!cles.includes(PAYF))PAYF=cles[0]||'';
  const lbl=k=>/^\d{4}-\d\d-\d\d$/.test(k)?'Périodes se terminant le '+dLong(k):/^\d{4}-\d\d$/.test(k)?'Date limite en '+new Date(k+'-15T12:00').toLocaleDateString('fr-CA',{month:'long',year:'numeric'}):'Sans date';
  const L=P.filter(p=>(p.periode_fin||(p.echeance||'').slice(0,7)||'—')===PAYF).sort((a,b)=>(!!a.paye_le-!!b.paye_le)||(a.echeance||'').localeCompare(b.echeance||''));
  const auj=new Date().toISOString().slice(0,10),nP=L.filter(p=>p.paye_le).length,tot=L.reduce((s,p)=>s+ +p.montant,0),totP=L.filter(p=>p.paye_le).reduce((s,p)=>s+ +p.montant,0);
  const nouv=PUB.filter(p=>p.paye_le&&!p.paye_vu);nouv.forEach(p=>NEWPAY.add(p.id));if(nouv.length)sb.from('cc_publications').update({paye_vu:true}).in('id',nouv.map(p=>p.id)).then(()=>{nouv.forEach(p=>p.paye_vu=true);badge()});
  const nom=id=>CLI.find(c=>c.id===id)?.nom||'—';
  $('tpay').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-end"><label class="f" style="width:440px;max-width:100%"><b>Période</b><select id="payF">${cles.map(k=>`<option value="${k}"${k===PAYF?' selected':''}>${lbl(k)}</option>`).join('')||'<option>Aucun paiement publié</option>'}</select></label>
    <div style="text-align:right"><strong style="font-size:22px;color:var(--ok)">${nP} sur ${L.length} payé${nP>1?'s':''}</strong><br><span class="sub" style="font-size:14px">${money(totP)} sur ${money(tot)}</span></div></div>
    <div class="scroll" style="margin-top:14px"><table><thead><tr><th>Client</th><th>Document</th><th>Montant</th><th>Date limite</th><th>Statut</th></tr></thead><tbody>${L.map(p=>{const ret=!p.paye_le&&p.echeance&&p.echeance<auj;
      return `<tr style="background:${p.paye_le?'#e6f5ec':ret?'#fdecea':'transparent'}"><td><a href="#" data-cli="${p.client_id}"><strong>${esc(nom(p.client_id))}</strong></a></td><td>${esc(p.titre)}<br><small class="sub">${esc(p.organisme)}</small></td><td>${money(p.montant)}</td><td>${dl(p.echeance)}</td>
      <td>${p.paye_le?`<span class="pill ok">✓ Payé le ${dl(p.paye_le)}</span>${NEWPAY.has(p.id)?' <span class="pill g">Nouveau</span>':''}`:ret?'<span class="pill r">En retard</span>':p.vu_le?`<span class="pill">Vu le ${dl(p.vu_le)}, pas payé</span>`:p.avise_le?'<span class="pill g">Avisé, pas encore vu</span>':'<span class="pill g">Pas avisé</span>'}</td></tr>`}).join('')||'<tr><td colspan="5" class="sub">Aucun paiement publié pour cette période. Publiez les déclarations à payer depuis la fiche du client (onglet Clients TPS/TVQ).</td></tr>'}</tbody></table></div>
    <p class="sub" style="font-size:13px;margin-top:10px">Vert : le client a cliqué sur « J’ai fait le paiement ». Rouge : date limite passée sans confirmation. Un rappel part automatiquement 5 jours avant la date limite si le rappel quotidien est activé.</p></div>`}
document.addEventListener('change',e=>{if(e.target.id==='payF'){PAYF=e.target.value;rPay()}});
document.addEventListener('click',e=>{const a=e.target.closest('a[data-cli]');if(!a)return;e.preventDefault();EDIT=CLI.find(c=>c.id===a.dataset.cli);FT='fiche';CED=null;TAB='cli';render();window.scrollTo(0,0)});
setInterval(async()=>{if($('app').hidden||document.hidden)return;const{data}=await sb.from('cc_publications').select('*').order('created_at',{ascending:false});if(!data)return;
  const avant=PUB.filter(p=>p.paye_le).length;PUB=data;badge();if(TAB==='pay'&&PUB.filter(p=>p.paye_le).length!==avant)rPay()},60000);
const reopen=async()=>{const id=EDIT?.id;await load();EDIT=CLI.find(c=>c.id===id)||null;TAB='cli';render()};
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!EDIT?.id)return;const c=EDIT;
  if(b.id==='aNew'){const{error}=await sb.from('cc_acces').insert({client_id:c.id,courriel:$('aCo').value.trim()||null});if(error){$('aMsg').textContent=error.message;return}reopen();return}
  if(b.dataset.inv){const a=ACC.find(x=>x.id===b.dataset.inv);const lien=`${SITE}/portail.html?invite=${a.code}`;const txt=`Bonjour,\n\nVotre espace Entreprise pour ${c.nom} est prêt sur le portail client de Boujrad CPA Inc. Vous pourrez y déposer vos documents, consulter vos déclarations et les montants à payer, et nous écrire.\n\n1. Ouvrez ${lien}\n2. Créez votre compte (ou connectez-vous).\n3. Votre code d’invitation : ${a.code}\n\nCordialement,\nBoujrad CPA Inc.`;
    try{await navigator.clipboard.writeText(txt);b.textContent='Copiée'}catch(err){prompt('Copiez l’invitation :',txt)}return}
  if(b.dataset.accdel){await sb.from('cc_acces').delete().eq('id',b.dataset.accdel);reopen();return}
  if(b.id==='pGo'){const titre=$('pT').value.trim();if(!titre){$('pMsg').textContent='Titre requis.';return}b.disabled=true;$('pMsg').textContent='Publication…';const fich=[];
    for(const f of $('pF').files){const path=`c/${c.id}/cabinet/${Date.now()}-${f.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-120)}`;const{error}=await sb.storage.from('documents').upload(path,f,{contentType:f.type||undefined});if(error){$('pMsg').textContent='Envoi du fichier impossible : '+error.message;b.disabled=false;return}fich.push({path,nom:f.name,taille:f.size})}
    const mo=$('pMo').value.trim()?parseFloat($('pMo').value.replace(/\s/g,'').replace(',','.')):null;
    const per=perOf(c,$('pPs').value),org=$('pOr').value;
    const{data:ins,error}=await sb.from('cc_publications').insert({client_id:c.id,titre,type:$('pTy').value,periode:per?.lbl||null,periode_fin:per?.fin||null,organisme:org,montant:org==='Aucun paiement'||isNaN(mo)?null:mo,echeance:$('pEc').value||null,code_paiement:$('pCo').value.trim()||null,instructions:$('pIn').value.trim()||null,fichiers:fich}).select('id').single();
    if(error){$('pMsg').textContent=error.message;b.disabled=false;return}
    let note='Publié.';if($('pAv').checked){try{const r=await fn(cfg.FONCTION_AVIS||'cc-avis',{action:'publication',publication_id:ins.id});note=`Publié. Avis envoyé à ${r.envoye_a.join(', ')}.`}catch(err){note='Publié, mais le courriel n’a pas pu partir : '+err.message}}
    await reopen();$('pMsg')&&($('pMsg').textContent=note);return}
  if(b.dataset.avis){b.disabled=true;try{const r=await fn(cfg.FONCTION_AVIS||'cc-avis',{action:'publication',publication_id:b.dataset.avis});await reopen();$('pMsg').textContent='Avis envoyé à '+r.envoye_a.join(', ')+'.'}catch(err){$('pMsg').textContent='Envoi impossible : '+err.message;b.disabled=false}return}
  if(b.dataset.pubdel){await sb.from('cc_publications').delete().eq('id',b.dataset.pubdel);reopen();return}
  if(b.id==='rGo'){const t=$('rTx').value.trim();if(!t)return;const{error}=await sb.from('cc_messages').insert({client_id:c.id,auteur:'cabinet',texte:t.slice(0,5000)});if(!error)reopen()}});

/* ---------- événements ---------- */
document.addEventListener('change',e=>{if(e.target.id==='pcY'){PCY=e.target.value;rPc()}});
document.addEventListener('click',async e=>{const b=e.target.closest('button,a[data-file]');if(!b)return;
  if(b.dataset.t){TAB=b.dataset.t;render();return}if(b.dataset.f){FILT=b.dataset.f;rDem();return}
  if(b.dataset.file){e.preventDefault();const{data,error}=await sb.storage.from('documents').createSignedUrl(b.dataset.file,300);if(error){alert('Ouverture impossible : '+error.message);return}window.open(data.signedUrl,'_blank','noopener');return}
  if(b.id==='gen'){b.disabled=true;const rows=CLI.filter(c=>c.actif).flatMap(c=>periodes(c).filter(p=>(Date.now()-new Date(p.fin))/864e5<=120&&!DEM.some(d=>d.client_id===c.id&&d.periode===p.periode)).map(p=>({...p,client_id:c.id})));
    const{error}=await sb.from('cc_demandes').insert(rows);$('dM').textContent=error?'Création impossible : '+error.message:`${rows.length} demande(s) créée(s).`;load();return}
  if(b.id==='tour'){b.disabled=true;$('dM').textContent='Envoi des rappels…';try{const r=await fn(cfg.FONCTION_RAPPELS||'cc-rappels',{});$('dM').textContent=`${r.crees} demande(s) créée(s), ${r.envoyes} courriel(s) envoyé(s).`+(r.erreurs?.length?' Erreurs : '+r.erreurs.join(' · '):'');load()}catch(err){$('dM').textContent='Envoi impossible : '+err.message;b.disabled=false}return}
  if(b.dataset.send){b.disabled=true;try{await fn(cfg.FONCTION_RAPPELS||'cc-rappels',{demande_id:b.dataset.send});$('dM').textContent='Courriel envoyé.';load()}catch(err){$('dM').textContent='Envoi impossible : '+err.message;b.disabled=false}return}
  if(b.dataset.link){const u=`${SITE}/portail.html?depot=${b.dataset.link}`;try{await navigator.clipboard.writeText(u);$('dM').textContent='Lien copié : '+u}catch(err){$('dM').textContent=u}return}
  if(b.dataset.st){const v=b.dataset.v;const{error}=await sb.from('cc_demandes').update({statut:v,...(v==='apportée au bureau'?{recu_le:new Date().toISOString()}:{})}).eq('id',b.dataset.st);$('dM').textContent=error?error.message:'Statut mis à jour.';load();return}
  if(b.dataset.edit){EDIT=CLI.find(c=>c.id===b.dataset.edit);FT='fiche';CED=null;rCli();window.scrollTo(0,0);return}
  if(b.id==='cCancel'){EDIT=null;CED=null;rCli();return}
  if(b.dataset.pc){pcOpen(b.dataset.pc);return}if(b.id==='pcX'){$('pcD').innerHTML='';return}
  if(b.id==='pcSave'){const{error}=await sb.from('pc_soumissions').update({statut:$('pcS').value,note_cabinet:$('pcN').value.trim()||null,updated_at:new Date().toISOString()}).eq('id',b.dataset.id);$('pcM').textContent=error?error.message:'Enregistré.';if(!error){const id=b.dataset.id;await load();TAB='pc';render();pcOpen(id)}}});


/* ---------- événements : dossiers, contrats, tâches, échéancier ---------- */
const who=()=>$('whoE')?.textContent||'';
document.addEventListener('input',e=>{if(e.target.id==='cQ'){CQ=e.target.value;const p=e.target.selectionStart;rCli();const q=$('cQ');q.focus();q.setSelectionRange(p,p)}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='cTy'){$('cEntBloc').hidden=t.value==='particulier';if(t.value==='particulier')$('cFo').value='Particulier'}
  if(t.id==='cTx'){$('cTxBloc').hidden=$('cTxBloc2').hidden=!t.checked}});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const ds=b.dataset;
  if(b.id==='cNew'){EDIT={};FT='fiche';CED=null;rCli();window.scrollTo(0,0);return}
  if(ds.cs){CS=ds.cs;rCli();return}
  if(ds.ft){FT=ds.ft;CED=null;rFiche();return}
  if(b.id==='cPAdd'){$('cPers').insertAdjacentHTML('beforeend',pRow());return}
  if('pdel' in ds){b.closest('.pers').remove();return}
  if(b.id==='cSave'){b.disabled=true;await saveFiche();return}
  if(b.id==='cDel'){if(!confirm(`Supprimer définitivement ${EDIT.nom} et tout son dossier (demandes, documents publiés, messages, contrats, tâches)?`))return;const{error}=await sb.from('cc_clients').delete().eq('id',EDIT.id);if(error){$('cM').textContent=error.message;return}EDIT=null;await load();return}
  /* contrats */
  if(b.id==='kNew'){kNew();return}
  if(ds.kedit){const k=CTR.find(x=>x.id===ds.kedit);CED={id:k.id,numero:k.numero,d:{...k.donnees,sigNom:k.donnees.signataire?.nom||'',sigTitre:k.donnees.signataire?.titre||''}};fContrat();return}
  if(ds.kcopy){kNew(CTR.find(x=>x.id===ds.kcopy));return}
  if(ds.kprint){const k=CTR.find(x=>x.id===ds.kprint);kPrint(withSig(k.html||window.CONTRAT.html({...EDIT,numero:k.numero},k.donnees),k));return}
  if(b.id==='kPrev'){kPrint(window.CONTRAT.html(kClient(),kData()));return}
  if(b.id==='kSave'){if(await kSave()){}return}
  if(b.id==='kBack'){CED=null;fContrat();return}
  if(ds.yn){CED.d[ds.yn]=ds.v==='1';ctrEditor();return}
  if(ds.mode){CED.d.mode=ds.mode;ctrEditor();return}
  if(ds.kcancel){if(!confirm('Annuler ce contrat? Le client ne pourra plus le signer.'))return;await sb.from('cc_contrats').update({statut:'annulé',updated_at:new Date().toISOString()}).eq('id',ds.kcancel);await sb.from('cc_publications').delete().eq('contrat_id',ds.kcancel);await load();return}
  if(ds.ksend){const k=CTR.find(x=>x.id===ds.ksend),c=EDIT;
    if(!ACC.some(a=>a.client_id===c.id)){$('kM').textContent='Créez d’abord un accès au portail pour ce client (onglet Portail et documents), ou imprimez le contrat pour une signature sur papier.';$('kM').className='msg err';return}
    if(!confirm('Envoyer ce contrat au client pour signature? Il ne pourra plus être modifié.'))return;b.disabled=true;
    const h=window.CONTRAT.html({...c,numero:k.numero},k.donnees),now=new Date().toISOString();
    let r=await sb.from('cc_contrats').update({statut:'envoyé',html:h,envoye_le:now,updated_at:now}).eq('id',k.id);if(r.error){$('kM').textContent=r.error.message;b.disabled=false;return}
    const{data:pub,error}=await sb.from('cc_publications').insert({client_id:c.id,titre:`Contrat de services ${k.numero} à signer`,type:'Contrat de services',organisme:'Aucun paiement',contrat_id:k.id,fichiers:[]}).select('id').single();
    let note='Contrat envoyé dans le portail du client.';if(!error){try{const a=await fn(cfg.FONCTION_AVIS||'cc-avis',{action:'publication',publication_id:pub.id});note+=` Avis envoyé à ${a.envoye_a.join(', ')}.`}catch(err){note+=' Le courriel d’avis n’a pas pu partir : '+err.message}}
    await load();$('kM')&&($('kM').textContent=note);return}
  /* tâches et journal */
  if(ds.tadd){const p=ds.tadd,ti=$(p+'T').value.trim();if(!ti)return;const{error}=await sb.from('cc_taches').insert({titre:ti,echeance:$(p+'E').value||null,responsable:$(p+'R').value.trim()||null,priorite:$(p+'P').value,client_id:p==='f'?EDIT.id:($('gC').value||null)});if(!error)await load();return}
  if(ds.tdo){await sb.from('cc_taches').update({statut:ds.v,fait_le:ds.v==='fait'?new Date().toISOString():null}).eq('id',ds.tdo);await load();return}
  if(ds.tdel){if(!confirm('Supprimer cette tâche?'))return;await sb.from('cc_taches').delete().eq('id',ds.tdel);await load();return}
  if(ds.tf){TF=ds.tf;rTache();return}
  if(b.id==='nAdd'){const tx=$('nTx').value.trim();if(!tx)return;const{error}=await sb.from('cc_notes').insert({client_id:EDIT.id,type:$('nTy').value,texte:tx.slice(0,5000),auteur:who()});if(!error)await load();return}
  /* échéancier */
  if(ds.em){if(ds.em==='0')EM=new Date().toISOString().slice(0,7);else{const[y,m]=EM.split('-').map(Number),d=new Date(Date.UTC(y,m-1+ +ds.em,1));EM=d.toISOString().slice(0,7)}rBoard();return}
  if(ds.done){const[cid,cle]=ds.done.split('|');b.disabled=true;const{error}=await sb.from('cc_echeances').insert({client_id:cid,cle,par:who()});if(!error)await load();return}
  if(ds.undo){const[cid,cle]=ds.undo.split('|');await sb.from('cc_echeances').delete().eq('client_id',cid).eq('cle',cle);await load();return}
  if(b.id==='bPrint'){window.print();return}});

/* ---------- connexion (membres du cabinet seulement) ---------- */
async function start(s){const{data:m}=await sb.from('tl_membres').select('role').eq('user_id',s.user.id).maybeSingle();
  if(!m){$('auth').hidden=false;$('aM').textContent='Ce compte n’est pas autorisé dans l’intranet. Les clients utilisent le Portail client.';$('aM').className='msg err';await sb.auth.signOut();return}
  $('auth').hidden=true;$('app').hidden=false;$('who').hidden=false;$('whoE').textContent=s.user.email;load()}
$('aF').onsubmit=async e=>{e.preventDefault();$('aM').textContent='Connexion…';const{data,error}=await sb.auth.signInWithPassword({email:$('aE').value.trim(),password:$('aP').value});if(error){$('aM').textContent='Courriel ou mot de passe invalide.';$('aM').className='msg err';return}start(data.session)};
$('out').onclick=()=>sb.auth.signOut().then(()=>location.reload());
(async()=>{const{data:{session}}=await sb.auth.getSession();session?start(session):$('auth').hidden=false})();
})();
