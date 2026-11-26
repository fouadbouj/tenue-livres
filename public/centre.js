/* Centre clients — intranet : rappels TPS/TVQ, documents reçus, soumissions du portail client */
(()=>{
const cfg=window.CONFIG||{},sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SITE=cfg.APP_URL||location.origin,dl=x=>x?new Date((x.length===10?x+'T12:00':x)).toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'}):'—';
let SVC=[],ACC=[],PUB=[],MSG=[],CLI=[],DEM=[],PCS=[],TAB=location.hash==='#paiements'?'pay':location.hash==='#services'?'dt':'board',PAYF='',NEWPAY=new Set(),EDIT=null,FILT='ouvertes',PCY='';
const notify=(m,err)=>{let t=document.getElementById('ntf');if(!t){t=document.createElement('div');t.id='ntf';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=(err?'':'✓ ')+m;t.className=(err?'err ':'')+'on';clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),4200)};
window.CCsb=sb;window.CCnotify=(m,e)=>notify(m,e);
const fn=async(name,body)=>{const{data,error}=await sb.functions.invoke(name,{body});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data};

/* périodes terminées (même logique que la fonction cc-rappels) */
const iso=d=>d.toISOString().slice(0,10),finMois=(y,m)=>new Date(Date.UTC(y,m,0));
function periodes(c,auj=new Date()){const M=+String(c.fin_exercice).slice(0,2)||12,pas=c.frequence==='mensuelle'?1:c.frequence==='trimestrielle'?3:12,dep=new Date(c.depuis+'T00:00:00Z'),out=[];
  for(let y=dep.getUTCFullYear()-1;y<=auj.getUTCFullYear();y++)for(let m=1;m<=12;m++){if(pas>1&&((m-M)%pas+pas)%pas!==0)continue;const fin=finMois(y,m);if(fin>=auj||fin<dep)continue;
    out.push({periode:`${pas===1?'M':pas===3?'T':'A'}-${iso(fin)}`,debut:iso(new Date(Date.UTC(y,m-pas,1))),fin:iso(fin),echeance:iso(pas===12?finMois(y,m+3):finMois(y,m+1))})}return out}
const STP={'à envoyer':'g','envoyée':'g','reçue':'ok','apportée au bureau':'ok','annulée':''};

async function load(){const[a,b,c,d,e,f,g,h,k,l,m1,m2,m3,m4,m5]=await Promise.all([sb.from('cc_clients').select('*').order('nom'),sb.from('cc_demandes').select('*').order('fin',{ascending:false}),sb.from('pc_soumissions').select('*').order('updated_at',{ascending:false}),sb.from('cc_acces').select('*'),sb.from('cc_publications').select('*').order('created_at',{ascending:false}),sb.from('cc_messages').select('*').order('created_at'),sb.from('cc_contrats').select('*'),sb.from('cc_taches').select('*'),sb.from('cc_notes').select('*').order('created_at',{ascending:false}),sb.from('cc_echeances').select('*'),sb.from('cc_dpa_accords').select('*'),sb.from('cc_factures').select('*'),sb.from('cc_lots_dpa').select('*'),sb.from('cc_parametres').select('*'),sb.from('cc_services').select('*').order('created_at',{ascending:false})]);
  ACC=d.data||[];PUB=e.data||[];MSG=f.data||[];CTR=g.data||[];TCH=h.data||[];NOT=k.data||[];ECH=l.data||[];ACCD=m1.data||[];FAC=m2.data||[];LOTS=m3.data||[];SVC=m5.data||[];PAR=(m4.data||[]).find(x=>x.cle==='facturation')?.valeur||{};
  if(a.error){$('tdem').innerHTML=`<div class="card"><p class="msg err">Lecture impossible : ${esc(a.error.message)}. Avez-vous exécuté le fichier supabase/portail_centre.sql?</p></div>`;return}
  CLI=a.data||[];DEM=b.data||[];PCS=c.data||[];render()}
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TAB));['board','dem','cli','pay','tache','pc','fact','sauv','dt'].forEach(k=>$('t'+k).hidden=k!==TAB);badge();({board:rBoard,dem:rDem,cli:rCli,pay:rPay,tache:rTache,pc:rPc,fact:rFact,dt:rDt,sauv:()=>window.rSauv&&window.rSauv()})[TAB]()}

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
  const tabs=[['fiche','Fiche'],['contrat','Contrat de services'],['factu','Facturation'],['portail','Portail et documents'],['suivi','Tâches et journal']];
  $('tcli').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><div><button class="sm" id="cCancel">← Tous les clients</button></div>${c.id?`<div class="row" style="gap:6px;align-items:center"><span class="pill ${STC[c.statut||'actif']}">${esc(c.statut||'actif')}</span><button class="sm" id="cDt">Demande type</button>${(c.statut||'actif')!=='inactif'?'<button class="sm danger" id="cFin">Fin de mandat</button>':''}</div>`:''}</div>
    <h2 style="margin:12px 0 4px">${neuf?'Nouveau client':esc(c.nom)}</h2>${c.id?`<nav class="tabs">${tabs.map(([k,l])=>`<button data-ft="${k}" aria-pressed="${FT===k}">${l}</button>`).join('')}</nav>`:''}<div id="fBody" style="margin-top:14px"></div></div>`;
  ({fin:fFin,fiche:fFiche,contrat:fContrat,factu:fFact,portail:()=>{$('fBody').innerHTML=portalPanel(c).replace(/<div class="card">/g,'<div class="card" style="box-shadow:none;border:1px solid var(--line)">');if($('pTy'))syncPub(c,'type')},suivi:fSuivi})[FT]()}

function fFiche(){const c={type:'entreprise',statut:'actif',forme:'Société par actions',province:'QC',frequence:'trimestrielle',fin_exercice:'12-31',depuis:new Date().toLocaleDateString('fr-CA'),ouverture:new Date().toLocaleDateString('fr-CA'),tps_tvq:true,spcc_dpe:true,actif:true,contacts:[],checklist:{},documents:'Relevés bancaires et de cartes de crédit, factures de ventes et factures d’achats de la période.',...EDIT};
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
    <label class="f" style="margin-top:12px"><b>Description de l’entreprise</b><small class="sub" style="font-weight:400">Activités, clientèle, employés, véhicules, particularités. L’IA s’en sert pour proposer le plan comptable et classer les transactions.</small><textarea id="cDs" placeholder="Ex. firme d’ingénieurs en structure, 2 employés, un véhicule, bureau loué à Laval">${v('description')}</textarea></label>
    <label class="f" style="margin-top:12px"><b>Notes internes</b><textarea id="cNo">${v('notes')}</textarea></label>
    <div class="row" style="margin-top:12px"><button class="pri" id="cSave">${c.id?'Enregistrer':'Créer le client'}</button>${c.id?'<button class="sm danger" id="cDel">Supprimer le client</button>':''}<span class="msg" id="cM"></span></div>`}
const pRow=(p={})=>`<div class="row pers" style="gap:8px;margin-bottom:6px;align-items:flex-end">${[['nom','Nom'],['role','Rôle (actionnaire, conjoint…)'],['courriel','Courriel'],['telephone','Téléphone']].map(([k,l])=>`<label class="f" style="flex:1;min-width:150px"><b>${l}</b><input data-p="${k}" value="${esc(p[k]||'')}"></label>`).join('')}<button class="sm danger" data-pdel>Retirer</button></div>`;
async function saveFiche(){const c=EDIT,g=id=>$(id)?.value.trim()||null,tx=$('cTx')?.checked!==false&&$('cTy').value!=='particulier',st=$('cSt').value;
  const chk={...(c.checklist||{})};document.querySelectorAll('[data-chk]:not([disabled])').forEach(x=>{if(x.checked)chk[x.dataset.chk]=chk[x.dataset.chk]||new Date().toLocaleDateString('fr-CA');else delete chk[x.dataset.chk]});
  const row={type:$('cTy').value,nom:g('cN'),forme:$('cFo').value,statut:st,groupe:g('cGr'),responsable:g('cRe'),ouverture:g('cOu'),langue:$('cLa').value,contact:g('cC'),courriel:g('cE'),telephone:g('cTel'),adresse:g('cAd'),ville:g('cVi'),province:g('cPr'),code_postal:g('cCp'),
    neq:g('cNeq'),no_entreprise:g('cBn'),no_tps:g('cTps'),no_tvq:g('cTvq'),fin_exercice:/^\d\d-\d\d$/.test($('cX')?.value||'')?$('cX').value:'12-31',spcc_dpe:!!$('cDpe')?.checked,employeur:!!$('cEmp')?.checked,tps_tvq:tx,
    frequence:$('cF')?.value||'trimestrielle',depuis:g('cD')||new Date().toLocaleDateString('fr-CA'),documents:g('cT')||c.documents||'Relevés bancaires et de cartes de crédit, factures de ventes et factures d’achats de la période.',actif:tx&&st==='actif'&&!!$('cA')?.checked,
    contacts:[...document.querySelectorAll('.pers')].map(r=>Object.fromEntries([...r.querySelectorAll('[data-p]')].map(i=>[i.dataset.p,i.value.trim()]))).filter(p=>p.nom||p.courriel),checklist:chk,notes:g('cNo'),description:g('cDs'),updated_at:new Date().toISOString()};
  if(!row.nom){$('cM').textContent='Nom requis.';$('cM').className='msg err';return}
  const sv=x=>c.id?sb.from('cc_clients').update(x).eq('id',c.id).select().single():sb.from('cc_clients').insert(x).select().single();
  let r=await sv(row);if(r.error&&/description/.test(r.error.message||'')){const{description:_,...rest}=row;r=await sv(rest);if(!r.error)notify('Fiche enregistrée, sauf la description : exécutez d’abord la mise à jour SQL (centre_dossiers.sql).',1)}
  if(r.error){$('cM').textContent=r.error.message;$('cM').className='msg err';return}
  await load();EDIT=CLI.find(x=>x.id===r.data.id)||r.data;TAB='cli';render();$('cM').textContent=c.id?'Enregistré.':'Client créé. Prochaine étape : le contrat de services.';$('cM').className='msg ok';notify(c.id?'Fiche client enregistrée':'Client créé')}

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
    <h3>3. Paiement</h3>${yn('dpa','Paiement par débits préautorisés mensuels (accord signé avec le contrat)?')}
    ${d.dpa?`<div class="kq"><span>Montant prélevé chaque mois, avant taxes</span>${ni('dpaMontant',110,d.forfait||'0,00')}</div><div class="kq"><span>Jour du prélèvement (1 à 28)</span>${ni('dpaJour',60)}</div><div class="kq"><span>Premier prélèvement</span><input type="date" data-k="dpaDebut" value="${esc(d.dpaDebut||'')}"></div>${yn('dpaRenonce','Le client renonce au préavis de 10 jours avant le premier prélèvement?')}
    <p class="sub" style="font-size:13px;margin:4px 0">Avec un contrat annuel de 3 600 $, inscrivez 300 $ : le client paie 344,93 $ par mois, taxes incluses.</p>`:''}
    <h3>4. Questions</h3>
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
const kData=()=>{const d=CED.d;return{...d,dpaMontant:d.dpa?(d.dpaMontant||d.forfait||''):'',signataire:{nom:d.sigNom||'',titre:d.sigTitre||''}}};
const kClient=()=>({...EDIT,numero:CED.numero});
function kPreview(){const f=$('kFrame');if(f)f.srcdoc=window.CONTRAT.html(kClient(),kData())}
const withSig=(h,k)=>k.signe_le?h.replace('</body>',`<div style="border:2px solid #1d7a4f;background:#eef8f2;padding:12px;margin:24px 0;font-size:10.5pt">Contrat accepté électroniquement par <strong>${esc(k.signe_nom)}</strong>${k.signe_titre?', '+esc(k.signe_titre):''}, le ${new Date(k.signe_le).toLocaleString('fr-CA',{dateStyle:'long',timeStyle:'short'})}, au moyen du portail client de Boujrad CPA Inc.</div></body>`):h;
function kPrint(h){const w=window.open('','_blank');if(!w){alert('Autorisez les fenêtres surgissantes pour imprimer.');return}w.document.open();w.document.write(h.replace('</body>','<script>setTimeout(()=>print(),300)<\/script></body>'));w.document.close()}
async function kSave(){const d=kData(),row={client_id:EDIT.id,numero:CED.numero,donnees:d,updated_at:new Date().toISOString()};
  const r=CED.id?await sb.from('cc_contrats').update(row).eq('id',CED.id).select().single():await sb.from('cc_contrats').insert({...row,statut:'brouillon'}).select().single();
  if(r.error){$('kM').textContent=r.error.message;$('kM').className='msg err';return null}CED.id=r.data.id;const i=CTR.findIndex(x=>x.id===r.data.id);i>=0?CTR[i]=r.data:CTR.push(r.data);$('kM').textContent='Brouillon enregistré.';$('kM').className='msg ok';notify('Brouillon du contrat enregistré');return r.data}
function kNew(src){const c=EDIT,yr=new Date().getFullYear(),n=CTR.filter(x=>(x.numero||'').startsWith(`C-${yr}-`)).length+1;
  const base=src?JSON.parse(JSON.stringify(src.donnees)):window.CONTRAT.defauts(c);base.sigNom=base.signataire?.nom||'';base.sigTitre=base.signataire?.titre||'';base.date=new Date().toLocaleDateString('fr-CA');
  if(!src){base.services={};if(c.type==='particulier')base.services.t1={on:true};else{['tdl','tps','compil','t2'].forEach(k=>base.services[k]={on:true});if(c.employeur)['paie','releves'].forEach(k=>base.services[k]={on:true});base.services.conseil={on:true}}}
  CED={id:null,numero:`C-${yr}-${String(n).padStart(3,'0')}`,d:base};fContrat()}
document.addEventListener('input',e=>{const t=e.target;if(!CED||!$('kFrame'))return;
  if(t.dataset.k){CED.d[t.dataset.k]=t.value;kPreview()}else if(t.dataset.svt){CED.d.services[t.dataset.svt].tarif=t.value;kPreview()}});
document.addEventListener('change',e=>{const t=e.target;if(!CED||!$('kFrame'))return;
  if(t.dataset.k){CED.d[t.dataset.k]=t.value;t.tagName==='SELECT'?ctrEditor():kPreview()}else if(t.dataset.sv){const x=CED.d.services[t.dataset.sv]||{};x.on=t.checked;CED.d.services[t.dataset.sv]=x;ctrEditor()}
  else if(t.dataset.svu){CED.d.services[t.dataset.svu].unite=t.value;kPreview()}else if(t.dataset.pay){CED.d.paiement=[...document.querySelectorAll('[data-pay]:checked')].map(x=>x.dataset.pay);kPreview()}});

/* ---------- tâches et journal ---------- */
const PRI={haute:'r',normale:'',basse:'g'};
const tRow=(t,cli)=>{const ret=t.statut!=='fait'&&t.echeance&&t.echeance<new Date().toLocaleDateString('fr-CA');return `<tr${t.statut==='fait'?' style="opacity:.55"':''}><td><strong>${esc(t.titre)}</strong>${t.details?`<br><small class="sub">${esc(t.details)}</small>`:''}${cli&&t.client_id?`<br><a href="#" data-cli="${t.client_id}"><small>${esc(CLI.find(c=>c.id===t.client_id)?.nom||'')}</small></a>`:''}</td><td>${t.echeance?`<span class="${ret?'pill r':''}">${dl(t.echeance)}</span>`:'—'}</td><td>${esc(t.responsable||'—')}</td><td><span class="pill ${PRI[t.priorite]}">${esc(t.priorite)}</span></td><td><div class="row" style="gap:6px">${t.statut==='fait'?`<button class="sm" data-tdo="${t.id}" data-v="à faire">Rouvrir</button>`:`<button class="sm pri" data-tdo="${t.id}" data-v="fait">Fait</button>`}<button class="sm danger" data-tdel="${t.id}">×</button></div></td></tr>`};
const tForm=p=>`<div class="row" style="gap:8px;align-items:flex-end;margin-top:10px"><label class="f" style="flex:2;min-width:200px"><b>Nouvelle tâche</b><input id="${p}T" placeholder="Ex. Relancer pour les relevés de décembre"></label><label class="f"><b>Échéance</b><input id="${p}E" type="date"></label><label class="f" style="width:140px"><b>Responsable</b><input id="${p}R"></label><label class="f"><b>Priorité</b><select id="${p}P"><option>normale</option><option>haute</option><option>basse</option></select></label><button class="pri" data-tadd="${p}">Ajouter</button></div>`;
function fSuivi(){const c=EDIT,T=TCH.filter(t=>t.client_id===c.id).sort((a,b)=>(a.statut==='fait')-(b.statut==='fait')||(a.echeance||'9').localeCompare(b.echeance||'9')),N=NOT.filter(n=>n.client_id===c.id);
  $('fBody').innerHTML=`<h3 style="margin-top:0">Tâches</h3><table><thead><tr><th>Tâche</th><th>Échéance</th><th>Responsable</th><th>Priorité</th><th></th></tr></thead><tbody>${T.map(t=>tRow(t)).join('')||'<tr><td colspan="5" class="sub">Aucune tâche.</td></tr>'}</tbody></table>${tForm('f')}
    <h3>Journal du dossier</h3><div class="row" style="gap:8px;align-items:flex-end"><label class="f"><b>Type</b><select id="nTy"><option value="note">Note</option><option value="appel">Appel</option><option value="rencontre">Rencontre</option><option value="courriel">Courriel</option></select></label><label class="f" style="flex:1"><b>Ce qui s’est dit ou fait</b><input id="nTx"></label><button class="pri" id="nAdd">Ajouter</button></div>
    <div style="display:grid;gap:8px;margin-top:12px">${N.map(n=>`<div style="border-left:3px solid var(--gold);padding:4px 12px"><small class="sub">${new Date(n.created_at).toLocaleString('fr-CA',{dateStyle:'medium',timeStyle:'short'})} · ${esc(n.type)}${n.auteur?' · '+esc(n.auteur):''}</small><div style="white-space:pre-wrap">${esc(n.texte)}</div></div>`).join('')||'<p class="sub">Aucune entrée.</p>'}</div>`}
let TF='ouvertes';
function rTache(){const auj=new Date().toLocaleDateString('fr-CA'),L=TCH.filter(t=>TF==='toutes'||(TF==='faites'?t.statut==='fait':t.statut!=='fait')).sort((a,b)=>(a.echeance||'9').localeCompare(b.echeance||'9'));
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
let EM=new Date().toLocaleDateString('fr-CA').slice(0,7);
function etatOb(o){const f=ECH.find(e=>e.client_id===o.client_id&&e.cle===o.cle);if(f)return{ok:1,txt:`Fait le ${dl(f.fait_le)}`};
  if(o.type==='TPS/TVQ'){const fin=o.cle.slice(4),p=PUB.find(p=>p.client_id===o.client_id&&p.periode_fin===fin&&p.montant>0);if(p?.paye_le)return{ok:1,txt:'Payé par le client'};if(p)return{txt:'Déclaration publiée, paiement à confirmer'};const d=DEM.find(d=>d.client_id===o.client_id&&d.fin===fin);if(d)return{txt:['reçue','apportée au bureau'].includes(d.statut)?'Documents reçus':'Documents : '+d.statut}}
  return{}}
function rBoard(){const[y,m]=EM.split('-').map(Number),deb=`${EM}-01`,fin=ymd(fMois(y,m)),auj=new Date().toLocaleDateString('fr-CA');
  const ALL=CLI.flatMap(c=>obligations(c,y-1,y+1)),mois=ALL.filter(o=>o.date>=deb&&o.date<=fin).sort((a,b)=>a.date.localeCompare(b.date)),
    retard=ALL.filter(o=>o.date<deb&&o.date>=ymd(new Date(Date.UTC(y,m-7,1)))&&o.date<auj&&!etatOb(o).ok).sort((a,b)=>a.date.localeCompare(b.date));
  const types=[...new Set(mois.map(o=>o.type))],nom=id=>CLI.find(c=>c.id===id)?.nom||'?';
  const fins=CLI.filter(c=>c.type!=='particulier'&&(c.statut||'actif')==='actif'&&+String(c.fin_exercice).slice(0,2)===m),
    tch=TCH.filter(t=>t.statut!=='fait'&&t.echeance&&t.echeance<=fin).sort((a,b)=>a.echeance.localeCompare(b.echeance)),
    unread=MSG.filter(x=>x.auteur==='client'&&!x.lu).length,signes=CTR.filter(k=>k.signe_le&&(Date.now()-new Date(k.signe_le))/864e5<15),attente=CTR.filter(k=>k.statut==='envoyé');
  const row=o=>{const e=etatOb(o),late=!e.ok&&o.date<auj;return `<tr style="background:${e.ok?'#e6f5ec':late?'#fdecea':'transparent'}"><td style="white-space:nowrap"><strong>${dl(o.date)}</strong></td><td><a href="#" data-cli="${o.client_id}"><strong>${esc(nom(o.client_id))}</strong></a></td><td><span class="pill">${esc(o.type)}</span> ${esc(o.titre)}<br><small class="sub">${esc(o.info)}</small></td><td>${e.txt?`<small>${esc(e.txt)}</small>`:'—'}</td><td>${ECH.some(x=>x.client_id===o.client_id&&x.cle===o.cle)?`<button class="sm" data-undo="${o.client_id}|${o.cle}">Annuler</button>`:e.ok?'':`<button class="sm pri" data-done="${o.client_id}|${o.cle}">Fait</button>`}</td></tr>`};
  const nm=new Date(Date.UTC(y,m-1,15)).toLocaleDateString('fr-CA',{month:'long',year:'numeric'});
  $('tboard').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div class="row" style="align-items:center;gap:8px"><button class="sm" data-em="-1">←</button><h2 style="margin:0;text-transform:capitalize">${nm}</h2><button class="sm" data-em="1">→</button>${EM!==auj.slice(0,7)?'<button class="sm" data-em="0">Mois courant</button>':''}</div><div class="row" style="gap:6px"><button class="sm" id="bMail">Envoyer le sommaire du mois par courriel</button><button class="sm" id="bPrint">Imprimer</button></div></div><div class="msg" id="bM"></div>
    <div class="kpis">${[['Échéances du mois',mois.length],['Faites',mois.filter(o=>etatOb(o).ok).length],['En retard (mois précédents)',retard.length],['Tâches dues',tch.length]].map(([l,v])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    ${types.length?`<p class="sub" style="font-size:14px;margin:4px 0 0">${types.map(t=>`${esc(t)} : ${mois.filter(o=>o.type===t).length}`).join(' · ')}</p>`:''}</div>
    ${(()=>{const R=SVC.filter(x=>x.statut==='reçue');return R.length?`<div class="card" style="border:2px solid var(--green,#1d7a4f)"><h2 style="margin-top:0">Questionnaires reçus à traiter (${R.length})</h2>${R.map(x=>`<div class="row" style="justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--line)"><div>${x.vu?'':'<span class="pill r">Nouveau</span> '}<strong>${esc(CLI.find(k=>k.id===x.client_id)?.nom||x.contact||x.courriel||'')}</strong> a déposé : ${esc(x.titre)} <small class="sub">· ${dl(x.recu_le)} · ${(x.fichiers||[]).length} document(s)</small></div><button class="sm pri" data-svgo="${x.id}">Voir</button></div>`).join('')}</div>`:''})()}
    ${retard.length?`<div class="card"><h2 style="color:var(--red)">En retard</h2><div class="scroll"><table><tbody>${retard.map(row).join('')}</tbody></table></div></div>`:''}
    <div class="card"><h2>Échéances de ${nm}</h2><div class="scroll"><table><thead><tr><th>Date</th><th>Client</th><th>Obligation</th><th>Suivi</th><th></th></tr></thead><tbody>${mois.map(row).join('')||'<tr><td colspan="5" class="sub">Aucune échéance ce mois-ci.</td></tr>'}</tbody></table></div>
    <p class="sub" style="font-size:13px">Calculé à partir des fiches clients : fréquence TPS/TVQ, fin d’exercice, SPCC avec DPE, employeur et type de client. Solde d’impôt : 2 mois au Québec; 3 mois au fédéral pour une SPCC qui a droit à la DPE, sinon 2 mois. T2 et CO-17 : 6 mois. Si une date tombe un samedi, un dimanche ou un jour férié, l’échéance est reportée au jour ouvrable suivant.</p></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card"><h2>Fins d’exercice ce mois-ci</h2>${fins.map(c=>`<div><a href="#" data-cli="${c.id}">${esc(c.nom)}</a> <small class="sub">· ${esc(c.fin_exercice)}</small></div>`).join('')||'<p class="sub">Aucune.</p>'}<p class="sub" style="font-size:13px">Planifiez la demande des documents de fin d’année et la mission de compilation.</p></div>
    <div class="card"><h2>Tâches à faire</h2>${tch.slice(0,10).map(t=>`<div style="margin-bottom:6px">${t.echeance<auj?'<span class="pill r">En retard</span> ':''}<strong>${esc(t.titre)}</strong> <small class="sub">· ${dl(t.echeance)}${t.client_id?' · '+esc(nom(t.client_id)):''}</small></div>`).join('')||'<p class="sub">Rien d’urgent.</p>'}<button class="sm" data-t="tache">Toutes les tâches</button></div>
    <div class="card"><h2>À surveiller</h2><div>${unread?`<span class="pill r">${unread}</span> message(s) de clients non lus`:'Aucun message non lu'}</div><div style="margin-top:6px">${attente.length} contrat(s) en attente de signature</div><div style="margin-top:6px">${FAC.filter(f=>['rejetée','à payer'].includes(f.statut)).length} facture(s) impayée(s) · ${CLI.filter(c=>(c.statut||'actif')==='actif'&&!acActif(c.id)).length} client(s) actif(s) sans DPA</div>${signes.map(k=>`<div style="margin-top:6px"><span class="pill ok">Signé</span> ${esc(nom(k.client_id))} <small class="sub">· ${dl(k.signe_le)}</small></div>`).join('')}</div></div>`}

/* ---------- impôts personnels (portail) ---------- */
const LAB={prenom:'Prénom',nom:'Nom',ddn:'Date de naissance',nas:'NAS',tel:'Téléphone',courriel:'Courriel',langue:'Langue',adresse:'Adresse',app:'App.',ville:'Ville',prov:'Province',cp:'Code postal',adresse31:'Adresse au 31 décembre',arrivee:'Arrivée au Canada/Québec',citoyen:'Citoyen canadien',elections:'Élections Canada',
  etat:'État civil',date_etat:'Date du changement',c_prenom:'Conjoint : prénom',c_nom:'Conjoint : nom',c_ddn:'Conjoint : naissance',c_nas:'Conjoint : NAS',c_revenu:'Conjoint : revenu net',c_client:'Déclaration du conjoint par le cabinet',
  logement:'Logement au 31 décembre',rl31:'No de logement (RL-31)',seul:'Vit seul(e)',assur:'Assurance médicaments',mois_ramq:'Mois RAMQ',situ_detail:'Précisions',banque:'Dépôt direct',representant:'Autorise la représentation',cj_tel:'Conjoint : téléphone',cj_courriel:'Conjoint : courriel',cj_langue:'Conjoint : langue',cj_adresse:'Conjoint : adresse',cj_arrivee:'Conjoint : arrivée au Canada/Québec',cj_citoyen:'Conjoint : citoyen canadien',cj_elections:'Conjoint : Élections Canada',cj_assur:'Conjoint : assurance médicaments',cj_mois_ramq:'Conjoint : mois RAMQ',cj_situ_detail:'Conjoint : précisions',cj_banque:'Conjoint : dépôt direct',cj_representant:'Conjoint : autorise la représentation',commentaires:'Commentaires'};
const CHGL={c_adresse:'adresse',c_etat:'état civil',c_conjoint:'conjoint',c_enfants:'enfants',c_logement:'logement',c_banque:'compte bancaire',c_aucun:'aucun changement'};
function rPc(){const ys=[...new Set(PCS.map(s=>s.annee))].sort((a,b)=>b-a);if(!PCY)PCY=String(ys[0]||'');const L=PCS.filter(s=>!PCY||String(s.annee)===PCY);
  $('tpc').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><label class="f" style="width:200px"><b>Année</b><select id="pcY"><option value="">Toutes</option>${ys.map(y=>`<option${String(y)===PCY?' selected':''}>${y}</option>`).join('')}</select></label>
    <div class="row"><span class="pill g">${L.filter(s=>s.statut==='reçue').length} à traiter</span><span class="pill">${L.filter(s=>s.statut==='brouillon').length} en cours de remplissage</span></div></div>
    <p class="sub" style="font-size:14px">Les clients créent leur compte sur le portail (boujradcpa.com → Connexion → Portail client), remplissent le formulaire et déposent leurs documents.</p>
    <div class="scroll"><table><thead><tr><th>Client</th><th>Année</th><th>Type</th><th>Statut</th><th>Mis à jour</th><th>Documents</th><th></th></tr></thead><tbody>
    ${L.map(s=>{const f=s.formulaire||{};return `<tr><td><strong>${esc((f.prenom||'')+' '+(f.nom||''))}</strong>${f.c_client==='Oui'?`<br><span class="pill g">+ conjoint : ${esc(f.c_prenom||'')}</span>`:''}<br><small class="sub">${esc(f.courriel||'')}</small></td><td>${s.annee}</td><td>${s.type==='nouveau'?'Nouveau':'Existant'}</td><td><span class="pill ${s.statut==='reçue'?'g':s.statut==='terminée'?'ok':''}">${esc(s.statut)}</span></td><td>${dl(s.updated_at)}</td><td>${(s.fichiers||[]).length}</td><td><button class="sm" data-pc="${s.id}">Ouvrir</button></td></tr>`}).join('')||'<tr><td colspan="7" class="sub">Aucune soumission.</td></tr>'}</tbody></table></div></div><div id="pcD"></div>`}
async function pcOpen(id){const s=PCS.find(x=>x.id===id);if(!s)return;const f=s.formulaire||{};
  const kv=Object.entries(LAB).filter(([k])=>f[k]!=null&&f[k]!=='').map(([k,l])=>`<dt>${esc(l)}</dt><dd>${esc(f[k])}</dd>`).join('');
  const sit=(f.situ||[]).join(', ');const chg=Object.entries(CHGL).filter(([k])=>f[k]).map(([,l])=>l).join(', ');
  const enf=(f.enfants||[]).map(e=>`<li>${esc(e.prenom)} ${esc(e.nom)} · ${esc(e.ddn)} · ${esc(e.lien||'')} · ${esc(e.garde||'')}${e.nas?' · NAS '+esc(e.nas):''}${e.handicap?' · handicap':''}</li>`).join('');
  $('pcD').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc((f.prenom||'')+' '+(f.nom||''))}${f.c_client==='Oui'?` et ${esc((f.c_prenom||'')+' '+(f.c_nom||''))}`:''} · ${s.annee}</h2><button class="sm" id="pcX">Fermer</button></div>
    ${s.type==='existant'?`<p><strong>Changements déclarés :</strong> ${esc(chg||'—')}</p>`:''}<dl class="kv">${kv}</dl>${enf?`<h3>Personnes à charge</h3><ul>${enf}</ul>`:''}<h3>Situations de l’année</h3><p>${esc(sit||'—')}</p>${f.c_client==='Oui'?`<h3>Situations de l’année du conjoint (${esc(f.c_prenom||'')})</h3><p>${esc((f.cj_situ||[]).join(', ')||'—')}</p>`:''}
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
function badge(){const ns=SVC.filter(x=>x.statut==='reçue'&&!x.vu).length,bd=document.querySelector('#tabs [data-t=dt]');if(bd)bd.innerHTML='Demandes'+(ns?` <span class="pill ok" style="margin-left:4px">${ns} reçu${ns>1?'s':''}</span>`:'');
  const n=PUB.filter(p=>p.paye_le&&!p.paye_vu).length,bt=document.querySelector('#tabs [data-t=pay]');if(bt)bt.innerHTML='Paiements'+(n?` <span class="pill ok" style="margin-left:4px">${n} nouveau${n>1?'x':''}</span>`:'');
  const t=$('toast');if(t){t.hidden=!n||TAB==='pay';t.innerHTML=n?`<strong>${n} client${n>1?'s ont':' a'} confirmé ${n>1?'leurs paiements':'son paiement'}.</strong> <button class="sm" data-t="pay">Voir les paiements</button>`:''}}
function rPay(){const P=PUB.filter(p=>p.montant>0&&p.organisme!=='Aucun paiement');
  const cles=[...new Set(P.map(p=>p.periode_fin||(p.echeance||'').slice(0,7)||'—'))].sort().reverse();if(!PAYF||!cles.includes(PAYF))PAYF=cles[0]||'';
  const lbl=k=>/^\d{4}-\d\d-\d\d$/.test(k)?'Périodes se terminant le '+dLong(k):/^\d{4}-\d\d$/.test(k)?'Date limite en '+new Date(k+'-15T12:00').toLocaleDateString('fr-CA',{month:'long',year:'numeric'}):'Sans date';
  const L=P.filter(p=>(p.periode_fin||(p.echeance||'').slice(0,7)||'—')===PAYF).sort((a,b)=>(!!a.paye_le-!!b.paye_le)||(a.echeance||'').localeCompare(b.echeance||''));
  const auj=new Date().toLocaleDateString('fr-CA'),nP=L.filter(p=>p.paye_le).length,tot=L.reduce((s,p)=>s+ +p.montant,0),totP=L.filter(p=>p.paye_le).reduce((s,p)=>s+ +p.montant,0);
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
  if(b.id==='aNew'){const{error}=await sb.from('cc_acces').insert({client_id:c.id,courriel:$('aCo').value.trim()||null});if(error){$('aMsg').textContent=error.message;return}await reopen();notify('Code d’accès créé : copiez l’invitation pour le client');return}
  if(b.dataset.inv){const a=ACC.find(x=>x.id===b.dataset.inv);const lien=`${SITE}/portail.html?invite=${a.code}`;const txt=`Bonjour,\n\nVotre espace Entreprise pour ${c.nom} est prêt sur le portail client de Boujrad CPA Inc. Vous pourrez y déposer vos documents, consulter vos déclarations et les montants à payer, et nous écrire.\n\n1. Ouvrez ${lien}\n2. Créez votre compte (ou connectez-vous).\n3. Votre code d’invitation : ${a.code}\n\nCordialement,\nBoujrad CPA Inc.`;
    try{await navigator.clipboard.writeText(txt);b.textContent='Copiée';notify('Invitation copiée : collez-la dans un courriel au client')}catch(err){prompt('Copiez l’invitation :',txt)}return}
  if(b.dataset.accdel){await sb.from('cc_acces').delete().eq('id',b.dataset.accdel);reopen();return}
  if(b.id==='pGo'){const titre=$('pT').value.trim();if(!titre){$('pMsg').textContent='Titre requis.';return}b.disabled=true;$('pMsg').textContent='Publication…';const fich=[];
    for(const f of $('pF').files){const path=`c/${c.id}/cabinet/${Date.now()}-${f.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-120)}`;const{error}=await sb.storage.from('documents').upload(path,f,{contentType:f.type||undefined});if(error){$('pMsg').textContent='Envoi du fichier impossible : '+error.message;b.disabled=false;return}fich.push({path,nom:f.name,taille:f.size})}
    const mo=$('pMo').value.trim()?parseFloat($('pMo').value.replace(/\s/g,'').replace(',','.')):null;
    const per=perOf(c,$('pPs').value),org=$('pOr').value;
    const{data:ins,error}=await sb.from('cc_publications').insert({client_id:c.id,titre,type:$('pTy').value,periode:per?.lbl||null,periode_fin:per?.fin||null,organisme:org,montant:org==='Aucun paiement'||isNaN(mo)?null:mo,echeance:$('pEc').value||null,code_paiement:$('pCo').value.trim()||null,instructions:$('pIn').value.trim()||null,fichiers:fich}).select('id').single();
    if(error){$('pMsg').textContent=error.message;b.disabled=false;return}
    let note='Publié.';if($('pAv').checked){try{const r=await fn(cfg.FONCTION_AVIS||'cc-avis',{action:'publication',publication_id:ins.id});note=`Publié. Avis envoyé à ${r.envoye_a.join(', ')}.`}catch(err){note='Publié, mais le courriel n’a pas pu partir : '+err.message}}
    await reopen();$('pMsg')&&($('pMsg').textContent=note);notify(note,/pas pu/.test(note));return}
  if(b.dataset.avis){b.disabled=true;try{const r=await fn(cfg.FONCTION_AVIS||'cc-avis',{action:'publication',publication_id:b.dataset.avis});await reopen();$('pMsg').textContent='Avis envoyé à '+r.envoye_a.join(', ')+'.';notify('Avis envoyé à '+r.envoye_a.join(', '))}catch(err){$('pMsg').textContent='Envoi impossible : '+err.message;b.disabled=false}return}
  if(b.dataset.pubdel){await sb.from('cc_publications').delete().eq('id',b.dataset.pubdel);reopen();return}
  if(b.id==='rGo'){const t=$('rTx').value.trim();if(!t)return;const{error}=await sb.from('cc_messages').insert({client_id:c.id,auteur:'cabinet',texte:t.slice(0,5000)});if(!error){await reopen();notify('Réponse envoyée dans le portail du client')}else notify('Envoi impossible : '+error.message,1)}});

/* ---------- événements ---------- */
document.addEventListener('change',e=>{if(e.target.id==='pcY'){PCY=e.target.value;rPc()}});
document.addEventListener('click',async e=>{const b=e.target.closest('button,a[data-file]');if(!b)return;
  if(b.dataset.t){if(b.dataset.t==='cli'&&TAB==='cli'){EDIT=null;CED=null}TAB=b.dataset.t;render();return}if(b.dataset.f){FILT=b.dataset.f;rDem();return}
  if(b.dataset.file){e.preventDefault();const{data,error}=await sb.storage.from('documents').createSignedUrl(b.dataset.file,300);if(error){alert('Ouverture impossible : '+error.message);return}window.open(data.signedUrl,'_blank','noopener');return}
  if(b.id==='gen'){b.disabled=true;const rows=CLI.filter(c=>c.actif).flatMap(c=>periodes(c).filter(p=>(Date.now()-new Date(p.fin))/864e5<=120&&!DEM.some(d=>d.client_id===c.id&&d.periode===p.periode)).map(p=>({...p,client_id:c.id})));
    const{error}=await sb.from('cc_demandes').insert(rows);$('dM').textContent=error?'Création impossible : '+error.message:`${rows.length} demande(s) créée(s).`;load();return}
  if(b.id==='tour'){b.disabled=true;$('dM').textContent='Envoi des rappels…';try{const r=await fn(cfg.FONCTION_RAPPELS||'cc-rappels',{});$('dM').textContent=`${r.crees} demande(s) créée(s), ${r.envoyes} courriel(s) envoyé(s).`+(r.erreurs?.length?' Erreurs : '+r.erreurs.join(' · '):'');load()}catch(err){$('dM').textContent='Envoi impossible : '+err.message;notify('Envoi impossible : '+err.message,1);b.disabled=false}return}
  if(b.dataset.send){b.disabled=true;try{await fn(cfg.FONCTION_RAPPELS||'cc-rappels',{demande_id:b.dataset.send});$('dM').textContent='Courriel envoyé.';notify('Demande de documents envoyée au client');load()}catch(err){$('dM').textContent='Envoi impossible : '+err.message;notify('Envoi impossible : '+err.message,1);b.disabled=false}return}
  if(b.dataset.link){const u=`${SITE}/portail.html?depot=${b.dataset.link}`;try{await navigator.clipboard.writeText(u);$('dM').textContent='Lien copié : '+u}catch(err){$('dM').textContent=u}return}
  if(b.dataset.st){const v=b.dataset.v;const{error}=await sb.from('cc_demandes').update({statut:v,...(v==='apportée au bureau'?{recu_le:new Date().toISOString()}:{})}).eq('id',b.dataset.st);$('dM').textContent=error?error.message:'Statut mis à jour.';load();return}
  if(b.dataset.edit){EDIT=CLI.find(c=>c.id===b.dataset.edit);FT='fiche';CED=null;rCli();window.scrollTo(0,0);return}
  if(b.id==='cCancel'){EDIT=null;CED=null;rCli();return}
  if(b.dataset.pc){pcOpen(b.dataset.pc);return}if(b.id==='pcX'){$('pcD').innerHTML='';return}
  if(b.id==='pcSave'){const{error}=await sb.from('pc_soumissions').update({statut:$('pcS').value,note_cabinet:$('pcN').value.trim()||null,updated_at:new Date().toISOString()}).eq('id',b.dataset.id);$('pcM').textContent=error?error.message:'Enregistré.';if(!error){notify('Dossier mis à jour');const id=b.dataset.id;await load();TAB='pc';render();pcOpen(id)}}});


/* ---------- facturation et débits préautorisés ---------- */
let ACCD=[],FAC=[],LOTS=[],PAR={},FV='prel',FF='ouvertes',FD='';
const F=()=>window.FACTURE;
const fmt=v=>F().money(v);
const acOf=id=>ACCD.filter(a=>a.client_id===id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
const acActif=id=>ACCD.find(a=>a.client_id===id&&a.statut==='actif');
const STF={'à prélever':'g','transmise':'g','payée':'ok','rejetée':'r','à payer':'r','annulée':''};
const emetteur=()=>({nom:'Boujrad CPA Inc.',adresse:'220-672, boulevard des Laurentides',ville:'Laval (Québec) H7G 2V9',tps:PAR.tps||'',tvq:PAR.tvq||'',courriel:PAR.courriel||''});
const nomC=id=>CLI.find(c=>c.id===id)?.nom||'?';
function prochainJour(j){const n=new Date(),d=new Date(n.getFullYear(),n.getMonth(),j);if(d<=n)d.setMonth(d.getMonth()+1);return d.toLocaleDateString('fr-CA')}
function joursOuvrables(a,b){let n=0;const d=new Date(a+'T12:00');const e=new Date(b+'T12:00');while(d<e){d.setDate(d.getDate()+1);if(d.getDay()%6)n++}return n}
function rFact(){const tabs=[['prel','Prélèvements du mois'],['fac','Factures'],['cc','Comptes clients'],['par','Paramètres']];
  $('tfact').innerHTML=`<div class="card"><nav class="tabs">${tabs.map(([k,l])=>`<button data-fv="${k}" aria-pressed="${FV===k}">${l}</button>`).join('')}</nav><div id="fvBody" style="margin-top:14px"></div></div>`;
  ({prel:vPrel,fac:vFac,cc:vCC,par:vPar})[FV]()}

/* -- prélèvements -- */
function vPrel(){if(!FD)FD=prochainJour(+(PAR.jour||1));const per=FD.slice(0,7),jr=+FD.slice(8,10),auj=new Date().toLocaleDateString('fr-CA'),lim=new Date(Date.now()+10*864e5).toLocaleDateString('fr-CA');
  const actifs=ACCD.filter(a=>a.statut==='actif'&&(CLI.find(c=>c.id===a.client_id)?.statut||'actif')==='actif');
  const rows=actifs.map(a=>{const pre=!a.renonce_preavis&&a.signe_le&&new Date(a.signe_le)>new Date(new Date(FD+'T12:00')-10*864e5),avant=a.debut>FD,autreJour=a.jour!==jr;
    const fm=FAC.find(f=>f.client_id===a.client_id&&f.periode===per&&f.mode==='dpa'&&f.statut!=='annulée'),extra=FAC.filter(f=>f.client_id===a.client_id&&f.mode==='dpa'&&f.statut==='à prélever'&&f!==fm&&f.date<=FD);
    return{a,pre,avant,autreJour,fm,extra,ok:!pre&&!avant&&!autreJour}});
  const ok=rows.filter(r=>r.ok),aFact=ok.filter(r=>!r.fm),pret=ok.filter(r=>r.fm?.statut==='à prélever'||r.extra.length);
  const total=pret.reduce((s,r)=>s+(r.fm?.statut==='à prélever'?+r.fm.total:0)+r.extra.reduce((x,f)=>x+ +f.total,0),0);
  const sans=CLI.filter(c=>(c.statut||'actif')==='actif'&&!acActif(c.id));
  const bus=joursOuvrables(auj,FD),days=(new Date(FD)-new Date(auj))/864e5;
  $('fvBody').innerHTML=`<div class="row" style="align-items:flex-end;gap:12px"><label class="f"><b>Date du prélèvement</b><input type="date" id="fdD" value="${FD}"></label>
    <div class="sub" style="font-size:14px;padding-bottom:10px">Facturation de ${F().MOIS(per)} · accords au ${jr}${jr===1?'er':'e'} du mois</div></div>
    ${bus<2?`<div class="alert" style="margin-top:10px"><strong>Trop tard pour cette date.</strong>Desjardins doit recevoir le fichier au plus tard à midi, 2 jours ouvrables avant la date du prélèvement.</div>`:days>14?`<div class="info" style="margin-top:10px">Desjardins accepte un fichier au plus 14 jours avant la date du prélèvement : générez-le à partir du ${new Date(new Date(FD)-14*864e5).toLocaleDateString('fr-CA',{day:'numeric',month:'long'})}.</div>`:''}
    <div class="kpis"><div class="kpi"><b>${ok.length}</b><span>Accords à prélever à cette date</span></div><div class="kpi"><b>${aFact.length}</b><span>Factures du mois à créer</span></div><div class="kpi"><b>${fmt(total)}</b><span>Total prêt à prélever</span></div><div class="kpi"><b style="color:${sans.length?'var(--red)':'var(--navy)'}">${sans.length}</b><span>Clients actifs sans accord DPA</span></div></div>
    <div class="row" style="margin-top:14px"><button class="pri" id="fdFac"${aFact.length?'':' disabled'}>1. Créer les factures de ${F().MOIS(per)} (${aFact.length})</button><button class="pri" id="fdGen"${pret.length&&bus>=2&&days<=14?'':' disabled'}>2. Générer le fichier Desjardins (${pret.length})</button></div><div class="msg" id="fdM"></div>
    <div class="scroll" style="margin-top:12px"><table><thead><tr><th>Client</th><th>Accord</th><th>Facture du mois</th><th>Autres montants</th><th>Statut</th></tr></thead><tbody>${rows.map(r=>`<tr${r.ok?'':' style="opacity:.6"'}><td><a href="#" data-cli="${r.a.client_id}">${esc(nomC(r.a.client_id))}</a></td><td>${fmt(r.a.montant)} + taxes · le ${r.a.jour}<br><small class="sub">${esc(r.a.titulaire)} · ${esc(r.a.institution)}-${esc(r.a.transit)} · •••${esc(String(r.a.compte).slice(-3))}</small></td>
      <td>${r.fm?`${esc(r.fm.numero)} · ${fmt(r.fm.total)}`:'—'}</td><td>${r.extra.map(f=>`${esc(f.numero)} · ${fmt(f.total)}`).join('<br>')||'—'}</td>
      <td>${r.autreJour?`<small>Prélevé le ${r.a.jour} du mois</small>`:r.avant?`<small>Premier prélèvement le ${dl(r.a.debut)}</small>`:r.pre?'<span class="pill r">Préavis de 10 jours non écoulé</span>':r.fm?`<span class="pill ${STF[r.fm.statut]}">${esc(r.fm.statut)}</span>`:'<span class="pill g">Facture à créer</span>'}</td></tr>`).join('')||'<tr><td colspan="5" class="sub">Aucun accord de DPA actif. Les accords se signent avec le contrat dans le portail, ou se saisissent dans la fiche du client (onglet Facturation).</td></tr>'}</tbody></table></div>
    ${sans.length?`<details class="fold" style="margin-top:12px"><summary><span>Clients actifs sans accord de DPA (${sans.length})</span></summary><p>${sans.map(c=>`<a href="#" data-cli="${c.id}">${esc(c.nom)}</a>`).join(' · ')}</p></details>`:''}
    <h3>Fichiers transmis</h3><table><thead><tr><th>Fichier</th><th>Date du prélèvement</th><th>Débits</th><th>Total</th><th>Statut</th><th></th></tr></thead><tbody>${LOTS.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(l=>`<tr><td>No ${String(l.numero_fichier).padStart(4,'0')}<br><small class="sub">${dl(l.created_at)}</small></td><td>${dl(l.date_prelevement)}</td><td>${l.nb}</td><td>${fmt(l.total)}</td><td><span class="pill ${l.statut==='traité'?'ok':l.statut==='annulé'?'':'g'}">${esc(l.statut)}</span></td>
      <td><div class="row" style="gap:6px">${l.contenu&&l.statut!=='annulé'?`<button class="sm" data-ldl="${l.id}">Télécharger</button>`:''}${l.statut==='généré'?`<button class="sm" data-lst="${l.id}" data-v="transmis">Transmis à Desjardins</button>`:''}${['généré','transmis'].includes(l.statut)?`<button class="sm pri" data-lst="${l.id}" data-v="traité">Prélèvements reçus</button><button class="sm danger" data-lst="${l.id}" data-v="annulé">Annuler</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="6" class="sub">Aucun fichier.</td></tr>'}</tbody></table>
    <p class="sub" style="font-size:13px">Étapes : créez les factures (elles apparaissent dans le portail des clients), générez le fichier, puis déposez-le dans AccèsD Affaires (Transmission de données – dépôt ou retrait direct) au plus tard à midi, 2 jours ouvrables avant la date du prélèvement. Quand l’argent est reçu, cliquez sur « Prélèvements reçus ». Un débit refusé se marque dans l’onglet Factures.</p>`}
async function creerFactures(){const per=FD.slice(0,7),jr=+FD.slice(8,10),rows=ACCD.filter(a=>a.statut==='actif'&&a.jour===jr&&a.debut<=FD&&(CLI.find(c=>c.id===a.client_id)?.statut||'actif')==='actif'&&!(!a.renonce_preavis&&a.signe_le&&new Date(a.signe_le)>new Date(new Date(FD+'T12:00')-10*864e5))&&!FAC.some(f=>f.client_id===a.client_id&&f.periode===per&&f.mode==='dpa'&&f.statut!=='annulée'));
  const ins=rows.map(a=>{const k=CTR.find(x=>x.id===a.contrat_id),t=F().taxes(a.montant);return{client_id:a.client_id,periode:per,date:new Date().toLocaleDateString('fr-CA'),mode:'dpa',statut:'à prélever',emetteur:emetteur(),
    lignes:[{description:`Honoraires professionnels — ${F().MOIS(per)}${k?` (contrat ${k.numero})`:''}`,montant:+a.montant}],...t}});
  if(!ins.length)return;const{error}=await sb.from('cc_factures').insert(ins);const msg=error?'Création impossible : '+error.message:`${ins.length} facture(s) créée(s). Elles sont visibles dans le portail des clients.`;await load();$('fdM')&&($('fdM').textContent=msg);notify(msg,!!error)}
async function genererFichier(){const p=PAR,need=[['organisme',/^\d{10}$/,'numéro d’organisme Desjardins (10 chiffres)'],['nomCourt',/./,'nom abrégé'],['nomLong',/./,'nom complet'],['transitRetour',/^\d{5}$/,'transit du compte de retour'],['compteRetour',/^[\d-]{5,12}$/,'compte de retour']].filter(([k,re])=>!re.test(p[k]||''));
  if(need.length){$('fdM').textContent='Complétez les paramètres : '+need.map(x=>x[2]).join(', ')+'.';$('fdM').className='msg err';FV='par';setTimeout(rFact,1500);return}
  const jr=+FD.slice(8,10),acc=ACCD.filter(a=>a.statut==='actif'&&a.jour===jr),tx=[],ids=[];
  for(const a of acc){const fs=FAC.filter(f=>f.client_id===a.client_id&&f.mode==='dpa'&&f.statut==='à prélever'&&f.date<=FD);if(!fs.length)continue;
    const tot=F().r2(fs.reduce((s,f)=>s+ +f.total,0));tx.push({montant:tot,institution:a.institution,transit:a.transit,compte:a.compte,nom:a.titulaire,categorie:a.categorie,reference:fs.length===1?fs[0].numero:fs[0].numero+'+'+(fs.length-1),info:'HON '+FD.slice(0,7)});ids.push(...fs.map(f=>f.id))}
  if(!tx.length)return;if(!confirm(`Générer le fichier Desjardins : ${tx.length} débit(s), ${fmt(tx.reduce((s,t)=>s+t.montant,0))}, le ${dl(FD)}?`))return;
  const tot=F().r2(tx.reduce((s,t)=>s+t.montant,0));const{data:lot,error}=await sb.from('cc_lots_dpa').insert({date_prelevement:FD,nb:tx.length,total:tot,statut:'généré'}).select().single();
  if(error){$('fdM').textContent=error.message;return}
  let txt;try{txt=F().fichier005(p,lot.numero_fichier,new Date().toLocaleDateString('fr-CA'),FD,tx)}catch(err){$('fdM').textContent='Fichier invalide : '+err.message;await sb.from('cc_lots_dpa').delete().eq('id',lot.id);return}
  await sb.from('cc_lots_dpa').update({contenu:txt}).eq('id',lot.id);await sb.from('cc_factures').update({statut:'transmise',lot_id:lot.id}).in('id',ids);
  telecharger(`DPA-Desjardins-${String(lot.numero_fichier).padStart(4,'0')}-${FD}.txt`,txt);await load();$('fdM').textContent='Fichier généré et téléchargé. Déposez-le dans AccèsD Affaires.';$('fdM').className='msg ok';notify('Fichier Desjardins généré et téléchargé')}
function telecharger(nom,txt){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download=nom;document.body.appendChild(a);a.click();a.remove()}

/* -- factures -- */
function vFac(){const flt={ouvertes:f=>['à prélever','transmise','rejetée','à payer'].includes(f.statut),impayees:f=>['rejetée','à payer'].includes(f.statut),payees:f=>f.statut==='payée',toutes:()=>true}[FF];
  const L=FAC.filter(flt).sort((a,b)=>(b.numero||'').localeCompare(a.numero||''));
  $('fvBody').innerHTML=`<div class="row" style="justify-content:space-between"><div class="row" style="gap:6px">${[['ouvertes','En cours'],['impayees','Impayées'],['payees','Payées'],['toutes','Toutes']].map(([k,l])=>`<button class="sm${FF===k?' pri':''}" data-ff="${k}">${l}</button>`).join('')}</div><button class="pri" data-fnew="">+ Nouvelle facture</button></div>
    <div id="fnBox"></div><div class="scroll" style="margin-top:12px">${facTable(L,1)}</div>`}
const facTable=(L,cli)=>`<table><thead><tr><th>Facture</th>${cli?'<th>Client</th>':''}<th>Description</th><th class="r">Total</th><th>Paiement</th><th>Statut</th><th></th></tr></thead><tbody>${L.map(f=>`<tr><td><strong>${esc(f.numero||'')}</strong><br><small class="sub">${dl(f.date)}</small></td>${cli?`<td><a href="#" data-cli="${f.client_id}">${esc(nomC(f.client_id))}</a></td>`:''}<td>${esc((f.lignes||[]).map(l=>l.description).join(' · ')).slice(0,90)}</td><td class="r">${fmt(f.total)}</td><td>${f.mode==='dpa'?'Débit préautorisé':f.paye_par==='carte'?'Carte de crédit':f.paye_par==='interac'?'Interac':'Interac ou carte'}${f.echeance&&f.mode==='autre'?`<br><small class="sub">dû le ${dl(f.echeance)}</small>`:''}${f.envoye_le?`<br><small class="sub">envoyée le ${dl(f.envoye_le)}</small>`:''}</td>
  <td><span class="pill ${STF[f.statut]}">${esc(f.statut)}</span>${f.paye_le?`<br><small class="sub">${dl(f.paye_le)}</small>`:''}</td><td><div class="row" style="gap:6px"><button class="sm" data-fprint="${f.id}">Voir</button>${f.mode==='autre'&&['à payer','rejetée'].includes(f.statut)?`<button class="sm" data-fsend="${f.id}">${f.envoye_le?'Renvoyer':'Envoyer'}</button>`:''}${['transmise','à payer','rejetée','à prélever'].includes(f.statut)?`<button class="sm pri" data-fst="${f.id}" data-v="payée">Payée</button>`:''}${f.statut==='transmise'?`<button class="sm danger" data-fst="${f.id}" data-v="rejetée">Débit refusé</button>`:''}${f.statut==='rejetée'&&acActif(f.client_id)?`<button class="sm" data-fst="${f.id}" data-v="à prélever">Reprélever</button>`:''}${['à prélever','à payer','rejetée'].includes(f.statut)?`<button class="sm danger" data-fst="${f.id}" data-v="annulée">Annuler</button>`:''}</div></td></tr>`).join('')||`<tr><td colspan="${cli?7:6}" class="sub">Aucune facture.</td></tr>`}</tbody></table>`;
function facForm(cid){const c=CLI.find(x=>x.id===cid);return `<div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:12px"><h3 style="margin-top:0">Nouvelle facture</h3><div class="grid">
  <label class="f"><b class="req">Client</b><select id="fnC"><option value="__nouveau">+ Nouveau client…</option>${CLI.map(x=>`<option value="${x.id}"${x.id===cid?' selected':''}>${esc(x.nom)}</option>`).join('')}</select></label>
  <label class="f fnNv" hidden><b class="req">Nom du nouveau client</b><input id="fnNom" placeholder="Prénom Nom ou nom de l’entreprise"></label><label class="f fnNv" hidden><b class="req">Courriel du nouveau client</b><input id="fnMail" type="email"></label>
  <label class="f"><b>Paiement</b><select id="fnM"><option value="dpa"${acActif(cid)?' selected':''}>Débit préautorisé (prochain fichier)</option><option value="autre"${acActif(cid)?'':' selected'}>Virement ou autre</option></select></label><label class="f"><b>Payable au plus tard le</b><input type="date" id="fnE" value="${new Date(Date.now()+30*864e5).toLocaleDateString('fr-CA')}"></label></div>
  <div id="fnL">${[0,1].map(()=>fnRow()).join('')}</div><button class="sm" id="fnAdd">+ Ligne</button>
  <label class="opt"><input type="checkbox" id="fnT" checked> <span>Taxable (TPS et TVQ)</span></label><label class="opt"><input type="checkbox" id="fnSend" checked> <span>Envoyer la facture au client par courriel (PDF et modes de paiement)</span></label><label class="f"><b>Note sur la facture (facultatif)</b><input id="fnN"></label>
  <div class="row" style="margin-top:10px"><button class="pri" id="fnGo">Créer la facture</button><button class="sm" id="fnX">Annuler</button><span class="msg" id="fnMsg"></span></div>
  ${c&&c.statut!=='actif'?'':`<p class="sub" style="font-size:13px">Une facture prélevée par DPA en dehors du montant mensuel exige un avis écrit de 10 jours au client : la facture déposée dans son portail tient lieu d’avis si elle est créée au moins 10 jours avant le prélèvement.</p>`}</div>`}
const fnRow=()=>`<div class="row fnr" style="gap:8px;margin-top:6px"><input data-fl="d" placeholder="Description (ex. Travaux de rattrapage 2025, 4 h)" style="flex:1"><input data-fl="m" placeholder="Montant" inputmode="decimal" style="width:120px"></div>`;

/* -- comptes clients -- */
function vCC(){const L=CLI.map(c=>{const fs=FAC.filter(f=>f.client_id===c.id&&f.statut!=='annulée'),imp=fs.filter(f=>['rejetée','à payer'].includes(f.statut)),enc=fs.filter(f=>['à prélever','transmise'].includes(f.statut));
    const vieux=imp.map(f=>f.mode==='autre'?f.echeance||f.date:f.date).sort()[0];return{c,imp:imp.reduce((s,f)=>s+ +f.total,0),enc:enc.reduce((s,f)=>s+ +f.total,0),paye:fs.filter(f=>f.statut==='payée'&&f.date.slice(0,4)===String(new Date().getFullYear())).reduce((s,f)=>s+ +f.total,0),vieux,a:acActif(c.id)}}).filter(x=>x.imp||x.enc||x.paye||x.a||(x.c.statut||'actif')==='actif');
  const mensuel=ACCD.filter(a=>a.statut==='actif').reduce((s,a)=>s+ +a.montant,0),imp=L.reduce((s,x)=>s+x.imp,0);
  $('fvBody').innerHTML=`<div class="kpis"><div class="kpi"><b>${fmt(mensuel)}</b><span>Honoraires mensuels prélevés (avant taxes)</span></div><div class="kpi"><b>${fmt(mensuel*12)}</b><span>Sur 12 mois</span></div><div class="kpi"><b style="color:${imp?'var(--red)':'var(--navy)'}">${fmt(imp)}</b><span>Impayé (débits refusés et factures échues)</span></div><div class="kpi"><b>${L.filter(x=>!x.a&&(x.c.statut||'actif')==='actif').length}</b><span>Clients actifs sans DPA</span></div></div>
    <div class="scroll" style="margin-top:12px"><table><thead><tr><th>Client</th><th>Accord DPA</th><th class="r">En cours</th><th class="r">Impayé</th><th>Plus ancien impayé</th><th class="r">Payé cette année</th></tr></thead><tbody>${L.sort((a,b)=>b.imp-a.imp||a.c.nom.localeCompare(b.c.nom)).map(x=>{const j=x.vieux?Math.floor((Date.now()-new Date(x.vieux))/864e5):0;return `<tr><td><a href="#" data-cli="${x.c.id}">${esc(x.c.nom)}</a></td><td>${x.a?`<span class="pill ok">${fmt(x.a.montant)}/mois</span>`:'<span class="pill r">Aucun</span>'}</td><td class="r">${x.enc?fmt(x.enc):'—'}</td><td class="r">${x.imp?`<strong style="color:var(--red)">${fmt(x.imp)}</strong>`:'—'}</td><td>${x.vieux?`${dl(x.vieux)} <small class="sub">(${j} j)</small>`:'—'}</td><td class="r">${x.paye?fmt(x.paye):'—'}</td></tr>`}).join('')}</tbody></table></div>`}

/* -- paramètres -- */

/* --- factures envoyées par courriel : PDF + modes de paiement (Interac, carte via payer.html) --- */
async function nouveauClient(nom,courriel){const{data,error}=await sb.from('cc_clients').insert({nom,courriel,type:'particulier',statut:'actif',actif:false,tps_tvq:false,ouverture:new Date().toLocaleDateString('fr-CA')}).select().single();if(error)throw error;CLI.push(data);return data}
const payInfo=f=>({interac:PAR.interac||'',interacNote:PAR.interacNote||'',carte:PAR.carte==='oui',lien:f.jeton?`${SITE}/payer.html?f=${f.jeton}`:''});
async function envoyerFacture(f,to){const c=CLI.find(x=>x.id===f.client_id)||{};to=to||c.courriel;if(!to)throw new Error('aucun courriel au dossier du client');
  const pay=payInfo(f),pdf=await F().facturePdf(f,c,pay);
  await fn(cfg.FONCTION_COURRIEL||'tl-email',{to,subject:`Facture ${f.numero} — Boujrad CPA Inc.`,text:F().courrielFacture(f,c,pay),attachments:[{filename:`Facture-${f.numero}.pdf`,content:pdf,contentType:'application/pdf'}]});
  await sb.from('cc_factures').update({envoye_le:new Date().toISOString()}).eq('id',f.id);await sb.from('cc_notes').insert({client_id:f.client_id,type:'courriel',texte:`Facture ${f.numero} (${fmt(f.total)}) envoyée à ${to}`,auteur:who()});
  await load();notify(`Facture ${f.numero} envoyée à ${to}`)}
document.addEventListener('change',e=>{if(e.target.id==='fnC'){document.querySelectorAll('.fnNv').forEach(x=>x.hidden=e.target.value!=='__nouveau');if(e.target.value==='__nouveau'){$('fnM').value='autre'}}});
document.addEventListener('click',async e=>{const b=e.target.closest('button[data-fsend]');if(!b)return;const f=FAC.find(x=>x.id===b.dataset.fsend),c=CLI.find(x=>x.id===f?.client_id)||{};
  let to=c.courriel;if(!to){to=prompt('Courriel du client pour l’envoi de la facture :','');if(!to)return;await sb.from('cc_clients').update({courriel:to}).eq('id',c.id)}
  if(f.envoye_le&&!confirm(`Renvoyer la facture ${f.numero} à ${to}?`))return;b.disabled=true;try{await envoyerFacture(f,to)}catch(err){notify('Envoi impossible : '+err.message,1);b.disabled=false}});
function vPar(){const p=PAR,i=(k,l,ph='',hint='')=>`<label class="f"><b>${l}</b><input data-par="${k}" value="${esc(p[k]||'')}" placeholder="${ph}">${hint?`<small class="sub">${hint}</small>`:''}</label>`;
  $('fvBody').innerHTML=`<h3 style="margin-top:0">Cabinet (sur les factures)</h3><div class="grid">${i('tps','Numéro de TPS du cabinet','123456789 RT0001')}${i('tvq','Numéro de TVQ du cabinet','1234567890 TQ0001')}${i('courriel','Courriel de facturation','admin@boujradcpa.com')}${i('jour','Jour de prélèvement par défaut','1','Entre 1 et 28')}</div>
    <h3>Desjardins — retrait direct (débits préautorisés)</h3><p class="sub" style="font-size:14px">Ces renseignements vous sont remis par votre caisse lors de l’adhésion au service de retrait direct dans AccèsD Affaires.</p>
    <div class="grid">${i('organisme','Numéro d’organisme (10 chiffres)','0000000000','Remis par la caisse')}${i('nomCourt','Nom abrégé (15 caractères)','BOUJRAD CPA','Apparaît sur le relevé du client')}${i('nomLong','Nom complet (30 caractères)','BOUJRAD CPA INC.')}${i('transitRetour','Transit de votre caisse (5 chiffres)','','Compte où les montants sont déposés et les retours imputés')}${i('compteRetour','Numéro de folio (compte)','')}${i('codeEnt','Code de transaction — DPA d’entreprise','700','700 = DPA d’entreprise')}${i('codePers','Code de transaction — DPA personnel','','À confirmer avec Desjardins pour les particuliers')}</div>
    <h3>Paiement des factures (clients sans débit préautorisé)</h3><p class="sub" style="font-size:14px">Ces modes de paiement figurent dans le courriel de facture, sur la facture en PDF et sur la page de paiement du client.</p>
    <div class="grid">${i('interac','Courriel pour les virements Interac','paiement@boujradcpa.com','Adresse inscrite au dépôt automatique de votre banque')}${i('interacNote','Précision Interac (facultatif)','Dépôt automatique : aucune question de sécurité')}
    <label class="f"><b>Paiement par carte de crédit</b><select data-par="carte"><option value="non"${p.carte!=='oui'?' selected':''}>Non offert pour l’instant</option><option value="oui"${p.carte==='oui'?' selected':''}>Offert (Stripe configuré)</option></select><small class="sub">Exige un compte Stripe : voir les instructions dans la conversation.</small></label></div>
    <div class="row" style="margin-top:12px"><button class="pri" id="parSave">Enregistrer</button><span class="msg" id="parM"></span></div>
    <p class="sub" style="font-size:13px">Avant le premier vrai fichier, Desjardins exige un fichier d’essai pour valider le format : générez un premier lot et demandez au soutien AccèsD Affaires de le traiter en mode essai.</p>`}

/* -- fiche client : facturation -- */
function fFact(){const c=EDIT,a=acOf(c.id),fs=FAC.filter(f=>f.client_id===c.id).sort((x,y)=>(y.numero||'').localeCompare(x.numero||'')),imp=fs.filter(f=>['rejetée','à payer'].includes(f.statut)).reduce((s,f)=>s+ +f.total,0);
  const t=a?F().taxes(a.montant):null;
  $('fBody').innerHTML=`<h3 style="margin-top:0">Accord de débits préautorisés</h3>${a?`<div class="info"><div class="row" style="justify-content:space-between"><div><span class="pill ${a.statut==='actif'?'ok':'r'}">${esc(a.statut)}</span> <strong>${fmt(a.montant)}</strong> + taxes = <strong>${fmt(t.total)}</strong> le ${a.jour}${a.jour===1?'er':'e'} de chaque mois, à compter du ${dl(a.debut)}</div></div>
      <div style="margin-top:6px">Titulaire : ${esc(a.titulaire)} · Institution ${esc(a.institution)} · Transit ${esc(a.transit)} · Compte <span id="acNo">•••${esc(String(a.compte).slice(-3))}</span> <button class="sm" data-acshow="${a.id}">Afficher</button></div>
      <small class="sub">${a.source==='papier'?'Accord papier':'Signé dans le portail'}${a.signe_le?` le ${dl(a.signe_le)} par ${esc(a.signe_nom||'')}`:''} · DPA ${esc(a.categorie)}${a.renonce_preavis?' · renonciation au préavis de 10 jours':''}${a.specimen?.path?` · <a href="#" data-file="${esc(a.specimen.path)}">spécimen de chèque</a>`:''}</small>
      <div class="row" style="gap:6px;margin-top:8px">${a.statut==='actif'?`<button class="sm" data-acst="${a.id}" data-v="suspendu">Suspendre</button>`:''}${a.statut==='suspendu'?`<button class="sm" data-acst="${a.id}" data-v="actif">Réactiver</button>`:''}${a.statut!=='annulé'?`<button class="sm danger" data-acst="${a.id}" data-v="annulé">Annuler l’accord (révocation)</button>`:''}</div></div>`:'<p class="sub">Aucun accord. Il se signe avec le contrat dans le portail (contrat avec « Paiement par débits préautorisés »), ou saisissez ci-dessous un accord signé sur papier.</p>'}
    <details class="fold" style="margin-top:10px"${a?'':' open'}><summary><span>${a?'Remplacer par un accord papier':'Saisir un accord signé sur papier'}</span></summary><div class="grid" style="margin-top:8px">
      <label class="f"><b class="req">Titulaire du compte</b><input id="apT" value="${esc(c.nom)}"></label><label class="f"><b class="req">Institution (3 chiffres)</b><input id="apI" placeholder="815" maxlength="3"></label><label class="f"><b class="req">Transit (5 chiffres)</b><input id="apR" maxlength="5"></label><label class="f"><b class="req">Compte</b><input id="apC" maxlength="12"></label>
      <label class="f"><b class="req">Montant mensuel avant taxes</b><input id="apM" inputmode="decimal"></label><label class="f"><b>Jour du mois</b><input id="apJ" value="${esc(PAR.jour||'1')}"></label><label class="f"><b>Premier prélèvement</b><input id="apD" type="date" value="${prochainJour(+(PAR.jour||1))}"></label><label class="f"><b>Date de signature</b><input id="apS" type="date" value="${new Date().toLocaleDateString('fr-CA')}"></label></div>
      <label class="opt"><input type="checkbox" id="apP"> <span>Le client a renoncé au préavis de 10 jours avant le premier prélèvement</span></label><div class="row" style="margin-top:8px"><button class="pri" id="apGo">Enregistrer l’accord</button><span class="msg" id="apMsg"></span></div></details>
    <div class="row" style="justify-content:space-between;margin-top:18px"><h3 style="margin:0">Factures${imp?` · <span style="color:var(--red)">impayé ${fmt(imp)}</span>`:''}</h3><button class="pri" data-fnew="${c.id}">+ Nouvelle facture</button></div><div id="fnBox"></div><div class="scroll" style="margin-top:8px">${facTable(fs)}</div>`}

/* ---------- événements : facturation ---------- */
document.addEventListener('change',e=>{const t=e.target;if(t.id==='fdD'){FD=t.value;vPrel()}});
document.addEventListener('click',async e=>{const a=e.target.closest('a[data-acshow]');const b=e.target.closest('button');if(!b)return;const ds=b.dataset;
  if(ds.fv){FV=ds.fv;rFact();return}
  if(ds.ff){FF=ds.ff;vFac();return}
  if(b.id==='fdFac'){b.disabled=true;await creerFactures();return}
  if(b.id==='fdGen'){b.disabled=true;await genererFichier();return}
  if(ds.ldl){const l=LOTS.find(x=>x.id===ds.ldl);telecharger(`DPA-Desjardins-${String(l.numero_fichier).padStart(4,'0')}-${l.date_prelevement}.txt`,l.contenu);return}
  if(ds.lst){const l=LOTS.find(x=>x.id===ds.lst),v=ds.v;
    if(v==='annulé'&&!confirm('Annuler ce fichier? Les factures redeviennent « à prélever ». Ne le faites que si le fichier n’a pas été traité par Desjardins.'))return;
    if(v==='traité'&&!confirm(`Confirmer que les prélèvements du ${dl(l.date_prelevement)} ont été reçus? Les factures passent à « payée ». Marquez ensuite les débits refusés, s’il y a lieu.`))return;
    await sb.from('cc_lots_dpa').update({statut:v}).eq('id',l.id);
    if(v==='traité')await sb.from('cc_factures').update({statut:'payée',paye_le:l.date_prelevement}).eq('lot_id',l.id).eq('statut','transmise');
    if(v==='annulé')await sb.from('cc_factures').update({statut:'à prélever',lot_id:null}).eq('lot_id',l.id).eq('statut','transmise');
    await load();notify({transmis:'Fichier marqué comme transmis',traité:'Prélèvements reçus : factures payées',annulé:'Fichier annulé'}[v]);return}
  if(ds.fprint){const f=FAC.find(x=>x.id===ds.fprint);kPrint(F().factureHtml(f,CLI.find(c=>c.id===f.client_id)||{}));return}
  if(ds.fst){const f=FAC.find(x=>x.id===ds.fst),v=ds.v;
    if(v==='annulée'&&!confirm(`Annuler la facture ${f.numero}?`))return;
    const up={statut:v};if(v==='payée')up.paye_le=new Date().toLocaleDateString('fr-CA');if(v==='à prélever')up.lot_id=null;
    await sb.from('cc_factures').update(up).eq('id',f.id);
    if(v==='rejetée')await sb.from('cc_taches').insert({client_id:f.client_id,titre:`Débit refusé — facture ${f.numero} (${fmt(f.total)})`,details:'Communiquer avec le client, confirmer son compte, puis cliquer sur « Reprélever » dans la facture.',echeance:new Date(Date.now()+3*864e5).toLocaleDateString('fr-CA'),priorite:'haute'});
    await load();notify({payée:'Facture marquée payée',rejetée:'Débit refusé : une tâche de relance a été créée',annulée:'Facture annulée','à prélever':'Facture remise au prochain prélèvement'}[v]);return}
  if('fnew' in ds){$('fnBox').innerHTML=facForm(ds.fnew||CLI[0]?.id);return}
  if(b.id==='fnAdd'){$('fnL').insertAdjacentHTML('beforeend',fnRow());return}
  if(b.id==='fnX'){$('fnBox').innerHTML='';return}
  if(b.id==='fnGo'){const lignes=[...document.querySelectorAll('.fnr')].map(r=>({description:r.querySelector('[data-fl=d]').value.trim(),montant:F().r2(parseFloat(r.querySelector('[data-fl=m]').value.replace(/\s/g,'').replace(',','.'))||0)})).filter(l=>l.description&&l.montant);
    if(!lignes.length){$('fnMsg').textContent='Ajoutez au moins une ligne avec un montant.';return}let cid=$('fnC').value;const m=$('fnM').value;
    if(cid==='__nouveau'){const nom=$('fnNom').value.trim(),mail=$('fnMail').value.trim();if(!nom||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)){$('fnMsg').textContent='Inscrivez le nom et un courriel valide du nouveau client.';return}
      try{cid=(await nouveauClient(nom,mail)).id}catch(err){$('fnMsg').textContent=err.message;return}}
    if(m==='dpa'&&!acActif(cid)){$('fnMsg').textContent='Ce client n’a pas d’accord de DPA actif : choisissez « Virement ou autre ».';return}
    const t=F().taxes(lignes.reduce((s,l)=>s+l.montant,0),$('fnT').checked);b.disabled=true;
    const{error}=await sb.from('cc_factures').insert({client_id:cid,lignes,...t,mode:m,statut:m==='dpa'?'à prélever':'à payer',echeance:m==='autre'?$('fnE').value||null:null,emetteur:emetteur(),note:$('fnN').value.trim()||null,date:new Date().toLocaleDateString('fr-CA')});
    if(error){$('fnMsg').textContent=error.message;b.disabled=false;return}const envoyer=$('fnSend')?.checked&&m==='autre';await load();
    if(envoyer){const f=FAC.filter(x=>x.client_id===cid).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))[0];try{await envoyerFacture(f)}catch(err){notify('Facture créée, mais envoi impossible : '+err.message,1);return}}else notify('Facture créée');return}
  if(b.id==='parSave'){const v={};document.querySelectorAll('[data-par]').forEach(i=>v[i.dataset.par]=i.value.trim());
    if(v.organisme&&!/^\d{10}$/.test(v.organisme)){$('parM').textContent='Le numéro d’organisme doit avoir 10 chiffres.';return}
    const{error}=await sb.from('cc_parametres').upsert({cle:'facturation',valeur:v,updated_at:new Date().toISOString()});$('parM').textContent=error?error.message:'Enregistré.';if(!error){PAR=v;notify('Paramètres de facturation enregistrés')}return}
  if(ds.acshow){const a=ACCD.find(x=>x.id===ds.acshow);$('acNo').textContent=a.compte;b.remove();return}
  if(ds.acst){const v=ds.v;if(v==='annulé'&&!confirm('Annuler l’accord de DPA? Aucun prélèvement ne sera plus fait pour ce client.'))return;
    await sb.from('cc_dpa_accords').update({statut:v,...(v==='annulé'?{annule_le:new Date().toISOString()}:{})}).eq('id',ds.acst);await load();return}
  if(b.id==='apGo'){const g=id=>$(id).value.trim(),m=parseFloat(g('apM').replace(',','.')),j=parseInt(g('apJ'))||1;
    if(!/^\d{3}$/.test(g('apI'))||!/^\d{5}$/.test(g('apR'))||!/^[\d-]{5,12}$/.test(g('apC'))||!(m>0)||j<1||j>28){$('apMsg').textContent='Vérifiez : institution 3 chiffres, transit 5 chiffres, compte 5 à 12 chiffres, montant et jour (1 à 28).';$('apMsg').className='msg err';return}
    if(!confirm('Enregistrer cet accord? L’accord actif actuel, s’il y en a un, sera remplacé.'))return;
    await sb.from('cc_dpa_accords').update({statut:'annulé',annule_le:new Date().toISOString(),note:'Remplacé'}).eq('client_id',EDIT.id).eq('statut','actif');
    const{error}=await sb.from('cc_dpa_accords').insert({client_id:EDIT.id,categorie:EDIT.type==='particulier'?'personnel':'entreprise',titulaire:g('apT'),institution:g('apI'),transit:g('apR'),compte:g('apC'),montant:m,jour:j,debut:g('apD'),renonce_preavis:$('apP').checked,signe_le:g('apS')+'T12:00:00',signe_nom:g('apT'),source:'papier',statut:'actif'});
    if(error){$('apMsg').textContent=error.message;return}await load();notify('Accord de débits préautorisés enregistré');return}});

/* ---------- demandes de service : questionnaire en ligne (recommandé) ou courriel avec la liste ---------- */
let DTC='',DTM='incorporation',DTE=false,MOV={},DTQ=true,DTV=null,DTF='';
const QL=()=>window.QUEST?.liste||{},enLigne=()=>DTQ&&!!QL()[DTM],LIEN='{LIEN DU QUESTIONNAIRE}';
const SST={'envoyée':['g','Envoyé, pas encore ouvert'],'en cours':['g','En cours de remplissage'],'reçue':['ok','Reçu — à traiter'],'traitée':['','Traité'],'annulée':['','Annulé']};
const svcUrl=s=>`${SITE}/portail.html?service=${s.jeton}`;
function dtBody(){const m=window.MODELES.liste.find(x=>x.id===DTM),c=CLI.find(x=>x.id===DTC);
  if(enLigne())return{sujet:`${QL()[DTM].nom} — questionnaire à remplir${c?` — ${c.nom}`:''}`,texte:window.QUEST.courriel(DTM,c,LIEN)};
  const o=MOV[DTM];if(o)return{sujet:o.sujet,texte:o.corps.replace('{CONTACT}',c?.contact?' '+c.contact:'')};return{sujet:m.sujet+(c?` — ${c.nom}`:''),texte:window.MODELES.texte(m,c)}}
async function rDt(){if(!window.MODELES){$('tdt').innerHTML='<div class="card"><p class="msg err">Modèles indisponibles.</p></div>';return}
  if(DTV){const s=SVC.find(x=>x.id===DTV);if(s)return rSvc(s);DTV=null}
  const{data}=await sb.from('cc_parametres').select('valeur').eq('cle','modeles').maybeSingle();MOV=data?.valeur||{};
  const c=CLI.find(x=>x.id===DTC),b=dtBody(),q=!!QL()[DTM];DTE=false;
  if(!DTF)DTF=SVC.some(x=>x.statut==='reçue')?'recues':'attente';
  const LS=SVC.filter(x=>DTF==='toutes'||(DTF==='attente'?['envoyée','en cours'].includes(x.statut):DTF==='recues'?x.statut==='reçue':x.statut==='traitée')),nom=x=>CLI.find(k=>k.id===x.client_id)?.nom||x.contact||x.courriel||'—';
  $('tdt').innerHTML=`<div class="card" id="svList"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Questionnaires envoyés</h2><div class="row">${[['recues','Reçus à traiter',SVC.filter(x=>x.statut==='reçue').length],['attente','En attente du client',SVC.filter(x=>['envoyée','en cours'].includes(x.statut)).length],['traites','Traités'],['toutes','Tous']].map(([k,l,n])=>`<button class="sm${DTF===k?' pri':''}" data-svf="${k}">${l}${n?` (${n})`:''}</button>`).join('')}</div></div>
    <div class="scroll"><table style="margin-top:10px"><thead><tr><th>Envoyé le</th><th>Client</th><th>Service</th><th>Statut</th><th></th></tr></thead><tbody>${LS.map(x=>`<tr${x.statut==='reçue'&&!x.vu?' style="background:#e6f5ec"':''}><td style="white-space:nowrap">${dl(x.created_at)}</td><td><strong>${esc(nom(x))}</strong><br><small class="sub">${esc(x.courriel||'')}</small></td><td>${esc(x.titre)}</td>
      <td><span class="pill ${SST[x.statut][0]}">${SST[x.statut][1]}</span>${x.statut==='reçue'&&!x.vu?' <span class="pill r">Nouveau</span>':''}${x.recu_le?`<br><small class="sub">Reçu le ${dl(x.recu_le)}</small>`:x.relance_le?`<br><small class="sub">Relancé le ${dl(x.relance_le)}</small>`:''}</td>
      <td style="white-space:nowrap">${['reçue','traitée'].includes(x.statut)?`<button class="sm pri" data-svv="${x.id}">Voir les réponses</button>`:['envoyée','en cours'].includes(x.statut)?`<button class="sm" data-svr="${x.id}">Relancer</button> <button class="sm" data-svl="${x.id}">Copier le lien</button> <button class="sm danger" data-svx="${x.id}">Annuler</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="sub">Aucun questionnaire.</td></tr>'}</tbody></table></div></div>
    <div class="card"><h2>Nouvelle demande au client</h2><p class="sub" style="font-size:14px">Choisissez le service et le client. Avec le questionnaire en ligne, le client reçoit un lien sécurisé vers son portail : il répond aux questions et dépose les pièces au même endroit, et vous êtes avisé dès qu’il a terminé.</p>
    <div class="grid"><label class="f"><b>Service</b><select id="dtM">${window.MODELES.liste.map(m=>`<option value="${m.id}"${m.id===DTM?' selected':''}>${esc(m.nom)}${QL()[m.id]?'':' (courriel seulement)'}</option>`).join('')}</select></label>
      <label class="f"><b>Client</b><select id="dtC"><option value="">— Pas encore client (courriel libre) —</option>${CLI.filter(x=>(x.statut||'actif')!=='inactif').map(x=>`<option value="${x.id}"${x.id===DTC?' selected':''}>${esc(x.nom)}</option>`).join('')}</select></label>
      <label class="f"><b class="req">Courriel</b><input id="dtE" type="email" value="${esc(c?.courriel||'')}"></label></div>
    ${q?`<div class="row" style="margin-top:10px;gap:4px 22px"><label class="opt"><input type="radio" name="dtq" value="1"${DTQ?' checked':''}> <span><strong>Questionnaire en ligne dans le portail</strong> (recommandé)</span></label><label class="opt"><input type="radio" name="dtq" value="0"${DTQ?'':' checked'}> <span>Courriel avec la liste, à nous retourner</span></label></div>`:''}
    <label class="f" style="margin-top:10px"><b>Objet</b><input id="dtS" value="${esc(b.sujet)}"></label>
    <label class="f" style="margin-top:10px"><b>Message</b><textarea id="dtT" style="min-height:${enLigne()?300:420}px;font-size:14px;line-height:1.5">${esc(b.texte)}</textarea></label>
    ${enLigne()?`<p class="sub" style="font-size:13px;margin:6px 0 0">${esc(LIEN)} sera remplacé à l’envoi par un lien sécurisé propre à cette demande.</p>`:''}
    <div class="row" style="margin-top:10px"><button class="pri" id="dtGo">${enLigne()?'Envoyer le questionnaire':'Envoyer'}</button>${enLigne()?'':`<button id="dtCp">Copier le message</button><button class="sm" id="dtSv">Enregistrer ce texte comme modèle</button>${MOV[DTM]?'<button class="sm" id="dtRs">Revenir au modèle d’origine</button>':''}`}<span class="msg" id="dtMsg"></span></div>
    <p class="sub" style="font-size:13px">Le courriel part de admin@boujradcpa.com avec la signature du cabinet. Pour un client existant, l’envoi est noté dans son journal et une tâche de suivi est créée pour dans 7 jours.</p></div>`;
  if(location.hash==='#services'){history.replaceState(null,'',location.pathname);$('svList')?.scrollIntoView()}}

/* --- réponses reçues --- */
async function rSvc(s){if(!s.vu&&s.statut==='reçue'){s.vu=true;sb.from('cc_services').update({vu:true}).eq('id',s.id).then(()=>badge())}
  const cl=CLI.find(x=>x.id===s.client_id),n=(s.fichiers||[]).length;
  $('tdt').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><button class="sm" data-svb>← Tous les questionnaires</button><div class="row" style="gap:6px">
    ${cl?`<a href="#" data-cli="${cl.id}" class="sm" style="align-self:center">Fiche de ${esc(cl.nom)}</a>`:'<button class="sm pri" data-svcli>Créer la fiche client</button>'}
    ${s.statut==='reçue'?'<button class="sm pri" data-svt>Marquer comme traité</button>':s.statut==='traitée'?'<button class="sm" data-svat>Remettre « à traiter »</button>':''}
    <button class="sm" data-svo>Rouvrir pour le client</button><button class="sm" data-svp>Imprimer ou PDF</button></div></div>
    <h2 style="margin-bottom:4px">${esc(s.titre)}</h2><p class="sub" style="margin-top:0">${esc(cl?.nom||s.contact||'')} ${esc(s.courriel||'')} · reçu le ${dl(s.recu_le)} · ${n} document${n>1?'s':''} · <span class="pill ${SST[s.statut][0]}">${SST[s.statut][1]}</span></p>
    ${!cl?'<div class="info" style="margin-bottom:10px">Futur client : « Créer la fiche client » remplit sa fiche à partir des réponses et lui donne accès à son entreprise dans le portail (avec le même compte).</div>':''}
    <div id="svR">${window.QUEST.resumeHtml(s.service,s.reponses||{},s.fichiers||[],esc)}</div><div class="msg" id="svM"></div></div>`}
function svcPrint(s){const h=$('svR').innerHTML.replace(/<button[^>]*>([^<]*)<\/button>/g,'$1');const w=window.open('','_blank');if(!w)return;
  w.document.write(`<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"><title>${esc(s.titre)}</title><style>body{font:11pt/1.45 Arial,sans-serif;max-width:760px;margin:30px auto;color:#111}h1{font-size:16pt}h3{margin:18px 0 6px;font-size:12pt;border-bottom:1px solid #999}table{width:100%;border-collapse:collapse}th{text-align:left;font-weight:normal;color:#444;width:38%;vertical-align:top;padding:4px 8px 4px 0}td{padding:4px 0}.pill{color:#b00}</style></head><body><h1>${esc(s.titre)}</h1><p>${esc(CLI.find(x=>x.id===s.client_id)?.nom||s.contact||'')} ${esc(s.courriel||'')} · reçu le ${dl(s.recu_le)}</p>${h}<script>setTimeout(()=>print(),300)<\/script></body></html>`);w.document.close()}
async function svcSet(s,patch,msg){const{error}=await sb.from('cc_services').update({...patch,updated_at:new Date().toISOString()}).eq('id',s.id);if(error){notify('Modification impossible : '+error.message,1);return false}Object.assign(s,patch);if(msg)notify(msg);return true}

document.addEventListener('input',e=>{if(e.target.id==='dtT'||e.target.id==='dtS')DTE=true});
document.addEventListener('change',e=>{const t=e.target;if(t.id!=='dtM'&&t.id!=='dtC'&&t.name!=='dtq')return;
  if(DTE&&!confirm('Remplacer le message modifié par le texte du modèle?')){if(t.id==='dtM')t.value=DTM;else if(t.id==='dtC')t.value=DTC;else document.querySelector(`input[name=dtq][value="${DTQ?1:0}"]`).checked=true;return}
  if(t.id==='dtM')DTM=t.value;else if(t.id==='dtC')DTC=t.value;else DTQ=t.value==='1';rDt()});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const S_=id=>SVC.find(x=>x.id===id),cur=()=>S_(DTV);
  if(b.dataset.svgo){DTV=b.dataset.svgo;TAB='dt';render();window.scrollTo(0,0);return}
  if(b.dataset.svf){DTF=b.dataset.svf;rDt();return}
  if(b.dataset.svv){DTV=b.dataset.svv;rDt();window.scrollTo(0,0);return}
  if(b.hasAttribute('data-svb')){DTV=null;rDt();return}
  if(b.dataset.svl){try{await navigator.clipboard.writeText(svcUrl(S_(b.dataset.svl)));notify('Lien copié : collez-le dans un courriel ou un texto')}catch(err){prompt('Lien du questionnaire',svcUrl(S_(b.dataset.svl)))}return}
  if(b.dataset.svx){if(!confirm('Annuler ce questionnaire? Le lien ne fonctionnera plus.'))return;if(await svcSet(S_(b.dataset.svx),{statut:'annulée'},'Questionnaire annulé'))rDt();return}
  if(b.dataset.svr){const s=S_(b.dataset.svr),cl=CLI.find(x=>x.id===s.client_id),ct=cl?.contact||s.contact;b.disabled=true;
    try{await fn(cfg.FONCTION_COURRIEL||'tl-email',{to:s.courriel,subject:`Rappel : ${s.titre} — questionnaire à remplir`,text:`Bonjour${ct?' '+ct:''},

Petit rappel : votre questionnaire « ${s.titre} » n’est pas encore terminé. Vous pouvez le remplir et déposer les pièces demandées dans votre portail client :

${svcUrl(s)}

Vos réponses déjà saisies sont conservées.

Cordialement,

Boujrad CPA Inc.`});await svcSet(s,{relance_le:new Date().toISOString()},`Rappel envoyé à ${s.courriel}`);rDt()}catch(err){notify('Envoi impossible : '+err.message,1);b.disabled=false}return}
  if(b.hasAttribute('data-svt')){if(await svcSet(cur(),{statut:'traitée',traite_le:new Date().toISOString()},'Questionnaire marqué comme traité'))rSvc(cur());return}
  if(b.hasAttribute('data-svat')){if(await svcSet(cur(),{statut:'reçue',traite_le:null},'Remis à traiter'))rSvc(cur());return}
  if(b.hasAttribute('data-svo')){if(!confirm('Rouvrir le questionnaire pour que le client le complète ou le corrige? Il pourra le renvoyer avec le même lien.'))return;if(await svcSet(cur(),{statut:'en cours'},'Questionnaire rouvert pour le client')){DTV=null;rDt()}return}
  if(b.hasAttribute('data-svp')){svcPrint(cur());return}
  if(b.hasAttribute('data-svcli')){const s=cur(),d=window.QUEST.fiche(s.service,s.reponses||{}),auj=new Date().toLocaleDateString('fr-CA');
    if(!confirm(`Créer la fiche client « ${d.nom} » à partir des réponses?`))return;b.disabled=true;
    const{data:c,error}=await sb.from('cc_clients').insert({...d,courriel:d.courriel||s.courriel,statut:'actif',actif:false,tps_tvq:false,depuis:auj,ouverture:auj}).select().single();
    if(error){notify('Création impossible : '+error.message,1);b.disabled=false;return}
    await sb.from('cc_services').update({client_id:c.id}).eq('id',s.id);s.client_id=c.id;
    if(s.user_id)await sb.from('cc_acces').insert({client_id:c.id,courriel:s.courriel,user_id:s.user_id,joint_le:new Date().toISOString()});
    await sb.from('cc_notes').insert({client_id:c.id,type:'note',texte:`Fiche créée à partir du questionnaire « ${s.titre} » reçu le ${dl(s.recu_le)}.`,auteur:who()});
    notify(`Fiche « ${c.nom} » créée${s.user_id?' et accès au portail donné':''}. Complétez-la au besoin.`);await load();return}
  if(b.id==='dtGo'){const to=$('dtE').value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)){$('dtMsg').textContent='Entrez une adresse courriel valide.';$('dtMsg').className='msg err';return}
    b.disabled=true;const m=window.MODELES.liste.find(x=>x.id===DTM),cl=CLI.find(x=>x.id===DTC),q=enLigne()?QL()[DTM]:null;let txt=$('dtT').value,svc=null;
    try{if(q){const r=await sb.from('cc_services').insert({client_id:DTC||null,service:DTM,titre:q.nom,courriel:to,contact:cl?.contact||null}).select().single();if(r.error)throw r.error;svc=r.data;
        txt=txt.includes(LIEN)?txt.split(LIEN).join(svcUrl(svc)):txt+'\n\n'+svcUrl(svc)}
      try{await fn(cfg.FONCTION_COURRIEL||'tl-email',{to,subject:$('dtS').value,text:txt})}catch(err){if(svc)await sb.from('cc_services').delete().eq('id',svc.id);throw err}
      if(DTC){await sb.from('cc_notes').insert({client_id:DTC,type:'courriel',texte:`${q?'Questionnaire en ligne envoyé':'Demande type envoyée'} : ${m.nom} (à ${to})`,auteur:who()});
        await sb.from('cc_taches').insert({client_id:DTC,titre:`Suivi : ${m.nom} — renseignements attendus`,echeance:new Date(Date.now()+7*864e5).toLocaleDateString('fr-CA'),priorite:'normale'})}
      notify(q?`Questionnaire « ${q.nom} » envoyé à ${to}`:`Demande « ${m.nom} » envoyée à ${to}`);DTE=false;if(q)DTF='attente';await load()}catch(err){$('dtMsg').textContent='Envoi impossible : '+err.message;$('dtMsg').className='msg err';notify('Envoi impossible',1)}b.disabled=false;return}
  if(b.id==='dtCp'){try{await navigator.clipboard.writeText($('dtT').value);notify('Message copié')}catch(err){$('dtT').select()}return}
  if(b.id==='dtSv'){const corps=$('dtT').value.replace(/^Bonjour[^,\n]*,/,'Bonjour{CONTACT},');MOV[DTM]={sujet:$('dtS').value.replace(/ — [^—]+$/,''),corps};
    const{error}=await sb.from('cc_parametres').upsert({cle:'modeles',valeur:MOV,updated_at:new Date().toISOString()});if(!error){notify('Modèle enregistré pour les prochaines demandes');DTE=false;rDt()}return}
  if(b.id==='dtRs'){if(!confirm('Revenir au texte d’origine de ce modèle?'))return;delete MOV[DTM];await sb.from('cc_parametres').upsert({cle:'modeles',valeur:MOV,updated_at:new Date().toISOString()});notify('Modèle d’origine rétabli');DTE=false;rDt();return}
  if(b.id==='cDt'){DTC=EDIT.id;DTE=false;DTV=null;TAB='dt';render();window.scrollTo(0,0);return}});

/* ---------- fin de mandat ---------- */
const nrm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\b(inc|ltee|ltd|enr|senc)\b\.?/g,'').replace(/[^a-z0-9]+/g,' ').trim();
async function fFin(){const c=EDIT,a=acActif(c.id),fp=FAC.filter(f=>f.client_id===c.id&&f.statut==='à prélever'),acc=ACC.filter(x=>x.client_id===c.id);
  let tl=[];try{const{data}=await sb.from('tl_docs').select('id,data').eq('coll','clients');tl=(data||[]).filter(r=>{const n=nrm(r.data?.nom);return n&&(n===nrm(c.nom)||(c.groupe&&nrm(r.data?.nom).includes(nrm(c.groupe))))})}catch(e){}
  if(FT!=='fin'||EDIT!==c||!$('fBody'))return;
  $('fBody').innerHTML=`<div class="alert" style="margin-bottom:14px"><strong>Fin de mandat</strong>Le client nous quitte : arrêtez les prélèvements et les rappels, puis remettez-lui son dossier (ou à son nouveau comptable).</div>
    <h3 style="margin-top:0">1. Remettre le dossier</h3>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="pri" id="finZip">Télécharger le dossier du client (ZIP)</button><span class="sub" style="font-size:13px;align-self:center">Fiche, contrats signés, factures, accord de DPA et échanges du portail.</span></div>
    <p style="margin:12px 0 4px"><strong>Comptabilité</strong> : dans le logiciel comptable, ouvrez le dossier, puis <em>Exporter > Archive du dossier en PDF</em>, choisissez « Tous les exercices » et cochez « Inclure les données ». Le nouveau comptable reçoit tous les rapports, états financiers et le grand livre.</p>
    ${tl.length?tl.map(r=>`<a class="btn sm" href="index.html#c=${encodeURIComponent(r.id)}&t=exp" target="_blank" rel="noopener" style="display:inline-block;margin:4px 8px 0 0">Ouvrir le dossier comptable « ${esc(r.data.nom)} »</a>`).join(''):'<p class="sub" style="font-size:13px">Aucun dossier comptable au même nom trouvé : ouvrez-le depuis le logiciel comptable.</p>'}
    <h3>2. Fermer le dossier</h3><div style="display:grid;gap:6px">
      <label class="opt"><input type="checkbox" id="fin1" checked> <span>Mettre le dossier « inactif » et arrêter les demandes de documents et les rappels</span></label>
      ${a?`<label class="opt"><input type="checkbox" id="fin2" checked> <span>Annuler l’accord de débits préautorisés (${fmt(a.montant)} + taxes par mois) : aucun prélèvement ne sera plus fait</span></label>`:''}
      ${fp.length?`<label class="opt"><input type="checkbox" id="fin3"> <span>Annuler aussi les ${fp.length} facture(s) « à prélever » non transmises (${fmt(fp.reduce((s,f)=>s+ +f.total,0))}) — laissez décoché pour facturer le travail déjà fait</span></label>`:''}
      ${acc.length?`<label class="opt"><input type="checkbox" id="fin4"> <span>Retirer l’accès au portail client (${acc.length} accès) — laissez décoché quelques semaines s’il doit récupérer ses documents</span></label>`:''}</div>
    <div class="grid" style="margin-top:10px"><label class="f"><b>Date de fin du mandat</b><input type="date" id="finD" value="${new Date().toLocaleDateString('fr-CA')}"></label><label class="f"><b>Motif (interne)</b><input id="finR" placeholder="Ex. déménagement, nouveau comptable"></label></div>
    <div class="row" style="margin-top:12px"><button class="pri" id="finGo">Confirmer la fin de mandat</button><button class="sm" id="finX">Annuler</button></div>`}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!EDIT?.id)return;const c=EDIT;
  if(b.id==='cFin'){FT='fin';rFiche();return}
  if(b.id==='finX'){FT='fiche';rFiche();return}
  if(b.id==='finZip'){b.disabled=true;try{await window.dossierClientZip(c,{contrats:CTR.filter(x=>x.client_id===c.id),factures:FAC.filter(x=>x.client_id===c.id),accords:ACCD.filter(x=>x.client_id===c.id),messages:MSG.filter(x=>x.client_id===c.id),publications:PUB.filter(x=>x.client_id===c.id),demandes:DEM.filter(x=>x.client_id===c.id)});notify('Dossier du client téléchargé')}catch(err){notify('Téléchargement impossible : '+err.message,1)}b.disabled=false;return}
  if(b.id==='finGo'){if(!confirm(`Confirmer la fin du mandat de ${c.nom}?`))return;b.disabled=true;const d=$('finD').value,now=new Date().toISOString();
    try{if($('fin1')?.checked)await sb.from('cc_clients').update({statut:'inactif',actif:false,updated_at:now}).eq('id',c.id);
      if($('fin2')?.checked)await sb.from('cc_dpa_accords').update({statut:'annulé',annule_le:now,note:'Fin de mandat le '+d}).eq('client_id',c.id).eq('statut','actif');
      if($('fin3')?.checked)await sb.from('cc_factures').update({statut:'annulée',note:'Fin de mandat'}).eq('client_id',c.id).eq('statut','à prélever');
      if($('fin4')?.checked)await sb.from('cc_acces').delete().eq('client_id',c.id);
      await sb.from('cc_demandes').update({statut:'annulée'}).eq('client_id',c.id).in('statut',['à envoyer','envoyée']);
      await sb.from('cc_notes').insert({client_id:c.id,type:'note',texte:`Fin de mandat le ${d}.${$('finR').value.trim()?' Motif : '+$('finR').value.trim():''}`,auteur:who()});
      await load();EDIT=CLI.find(x=>x.id===c.id)||null;FT='fiche';TAB='cli';render();notify(`Fin de mandat enregistrée pour ${c.nom}`)}catch(err){notify('Impossible : '+err.message,1);b.disabled=false}}});

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
    if(k.donnees?.dpa&&!(parseFloat(String(k.donnees.dpaMontant).replace(',','.'))>0)){$('kM').textContent='Inscrivez le montant mensuel du débit préautorisé dans le contrat (Modifier), puis enregistrez.';$('kM').className='msg err';return}
    if(!confirm('Envoyer ce contrat au client pour signature? Il ne pourra plus être modifié.'))return;b.disabled=true;
    const h=window.CONTRAT.html({...c,numero:k.numero},k.donnees),now=new Date().toISOString();
    let r=await sb.from('cc_contrats').update({statut:'envoyé',html:h,envoye_le:now,updated_at:now}).eq('id',k.id);if(r.error){$('kM').textContent=r.error.message;b.disabled=false;return}
    const{data:pub,error}=await sb.from('cc_publications').insert({client_id:c.id,titre:`Contrat de services ${k.numero} à signer`,type:'Contrat de services',organisme:'Aucun paiement',contrat_id:k.id,fichiers:[]}).select('id').single();
    let note='Contrat envoyé dans le portail du client.';if(!error){try{const a=await fn(cfg.FONCTION_AVIS||'cc-avis',{action:'publication',publication_id:pub.id});note+=` Avis envoyé à ${a.envoye_a.join(', ')}.`}catch(err){note+=' Le courriel d’avis n’a pas pu partir : '+err.message}}
    await load();$('kM')&&($('kM').textContent=note);notify(note,/pas pu/.test(note));return}
  /* tâches et journal */
  if(ds.tadd){const p=ds.tadd,ti=$(p+'T').value.trim();if(!ti)return;const{error}=await sb.from('cc_taches').insert({titre:ti,echeance:$(p+'E').value||null,responsable:$(p+'R').value.trim()||null,priorite:$(p+'P').value,client_id:p==='f'?EDIT.id:($('gC').value||null)});if(!error){await load();notify('Tâche ajoutée')}return}
  if(ds.tdo){await sb.from('cc_taches').update({statut:ds.v,fait_le:ds.v==='fait'?new Date().toISOString():null}).eq('id',ds.tdo);await load();notify(ds.v==='fait'?'Tâche terminée':'Tâche rouverte');return}
  if(ds.tdel){if(!confirm('Supprimer cette tâche?'))return;await sb.from('cc_taches').delete().eq('id',ds.tdel);await load();return}
  if(ds.tf){TF=ds.tf;rTache();return}
  if(b.id==='nAdd'){const tx=$('nTx').value.trim();if(!tx)return;const{error}=await sb.from('cc_notes').insert({client_id:EDIT.id,type:$('nTy').value,texte:tx.slice(0,5000),auteur:who()});if(!error){await load();notify('Ajouté au journal du dossier')}return}
  /* échéancier */
  if(ds.em){if(ds.em==='0')EM=new Date().toLocaleDateString('fr-CA').slice(0,7);else{const[y,m]=EM.split('-').map(Number),d=new Date(Date.UTC(y,m-1+ +ds.em,1));EM=d.toISOString().slice(0,7)}rBoard();return}
  if(ds.done){const[cid,cle]=ds.done.split('|');b.disabled=true;const{error}=await sb.from('cc_echeances').insert({client_id:cid,cle,par:who()});if(!error){await load();notify('Échéance marquée comme faite')}return}
  if(ds.undo){const[cid,cle]=ds.undo.split('|');await sb.from('cc_echeances').delete().eq('client_id',cid).eq('cle',cle);await load();return}
  if(b.id==='bPrint'){window.print();return}
  if(b.id==='bMail'){b.disabled=true;$('bM').textContent='Envoi…';try{const r=await fn(cfg.FONCTION_RAPPELS||'cc-rappels',{sommaire:true});$('bM').textContent=typeof r.sommaire==='number'?`Sommaire envoyé (${r.sommaire} échéance(s), ${r.retard} en retard).`:'Envoi impossible : '+r.sommaire;notify($('bM').textContent,typeof r.sommaire!=='number')}catch(err){$('bM').textContent='Envoi impossible : '+err.message}b.disabled=false;return}});

/* ---------- connexion (membres du cabinet seulement) ---------- */

/* ---------- Assistant IA (bouton flottant) : gestion du cabinet ---------- */
const IA_CHAMPS={nom:'Nom',description:'Description de l’entreprise',courriel:'Courriel',telephone:'Téléphone',adresse:'Adresse',ville:'Ville',code_postal:'Code postal',contact:'Personne-ressource',statut:'Statut',forme:'Forme juridique',fin_exercice:'Fin d’exercice (MM-JJ)',frequence:'Fréquence TPS/TVQ',responsable:'Responsable',groupe:'Groupe',neq:'NEQ',no_entreprise:'No d’entreprise',no_tps:'No TPS',no_tvq:'No TVQ',langue:'Langue',employeur:'Employeur',tps_tvq:'Inscrit TPS/TVQ'};
const iaCli=id=>CLI.find(c=>c.id===id);
async function iaContexteC(){const auj=new Date().toLocaleDateString('fr-CA'),[y,m]=auj.split('-').map(Number),deb=auj.slice(0,8)+'01',fin=ymd(fMois(y,m));
  const ALL=CLI.flatMap(c=>obligations(c,y-1,y+1)),ob=ALL.filter(o=>!etatOb(o).ok&&o.date<=fin&&o.date>=ymd(new Date(Date.UTC(y,m-4,1)))).sort((a,b)=>a.date.localeCompare(b.date));
  const nom=id=>iaCli(id)?.nom||'—';
  return `Onglet affiché : ${TAB}${EDIT?` · fiche ouverte : ${EDIT.nom} (${EDIT.id})`:''}.
Clients (id | nom | statut | type/forme | fin d'exercice | TPS/TVQ | courriel | responsable | groupe | description) :
${CLI.map(c=>[c.id,c.nom,c.statut||'actif',[c.type,c.forme].filter(Boolean).join('/'),c.fin_exercice,c.tps_tvq?c.frequence:'non inscrit',c.courriel||'',c.responsable||'',c.groupe||'',(c.description||'').replace(/\s+/g,' ').slice(0,160)].join(' | ')).join('\n')}

Tâches ouvertes (id | titre | client | échéance | priorité | responsable) :
${TCH.filter(t=>t.statut!=='fait').map(t=>[t.id,t.titre,t.client_id?nom(t.client_id):'cabinet',t.echeance||'',t.priorite,t.responsable||''].join(' | ')).join('\n')||'aucune'}

Échéances non faites jusqu’à la fin du mois (client_id | client | clé | titre | date) :
${ob.slice(0,250).map(o=>[o.client_id,nom(o.client_id),o.cle,o.titre,o.date].join(' | ')).join('\n')||'aucune'}

Questionnaires de service reçus à traiter : ${SVC.filter(x=>x.statut==='reçue').map(x=>x.titre+' — '+(nom(x.client_id)!=='—'?nom(x.client_id):x.courriel)).join(' ; ')||'aucun'}.
Services offerts en demande (id : nom) : ${window.MODELES?.liste.map(x=>x.id+' : '+x.nom).join(' ; ')}.`}
function iaInitC(){if(!window.ASSISTANT||iaInitC.ok)return;iaInitC.ok=1;
  window.ASSISTANT.init({id:'centre',nom:'Gestion du cabinet',contexte:iaContexteC,
    ask:async p=>{const d=await fn(cfg.FONCTION_IA||'ai',{prompt:p,tier:'default'});const t=String(d?.text||'').replace(/```json|```/g,'');const i=t.indexOf('{'),j=t.lastIndexOf('}');if(i<0||j<i)throw new Error('réponse invalide');return JSON.parse(t.slice(i,j+1))},
    accueil:'Bonjour! Je suis votre secrétaire : j’écris et j’envoie des courriels aux clients, je facture et j’envoie les factures, créer et terminer des tâches, ajouter des notes, mettre à jour une fiche client, marquer des échéances comme faites, préparer une demande de service et répondre sur vos clients et vos échéances. Je vous montre toujours la modification avant de l’appliquer.',
    exemples:['Écris à Gestion Tremblay pour qu’il nous envoie ses factures pour la déclaration de TPS/TVQ','Facture Marie Tremblay pour sa déclaration de revenus 2026 : 75 $ plus taxes','Qu’est-ce qui est dû ce mois-ci?','Crée une tâche pour vendredi : appeler Gestion Tremblay pour ses relevés','Change le courriel de Gestion Tremblay pour info@tremblay.ca','Envoie le questionnaire d’incorporation à un nouveau client'],
    guide:`Tu travailles dans Gestion du cabinet (clients, échéances, tâches, demandes de service, facturation).
ACTIONS (après confirmation, sauf mention) :
- {"type":"tache","client_id":"uuid ou null","titre":"...","echeance":"AAAA-MM-JJ","priorite":"basse|normale|haute","details":"..."}
- {"type":"tache_faite","id":"uuid de la tâche"}
- {"type":"note","client_id":"uuid","texte":"..."} — note au journal du dossier.
- {"type":"modifier_client","client_id":"uuid","champs":{"courriel":"..."}} — champs permis : ${Object.keys(IA_CHAMPS).join(', ')}. statut : actif|inactif|prospect. frequence : mensuelle|trimestrielle|annuelle. fin_exercice au format MM-JJ.
- {"type":"echeance_faite","client_id":"uuid","cle":"clé de l'échéance du contexte"}
- {"type":"demande","client_id":"uuid ou null","service":"id du service","courriel":"..."} — ouvre le formulaire d'envoi prérempli; l'utilisateur relit et envoie lui-même (sans confirmation).
- {"type":"ouvrir_client","client_id":"uuid"} — ouvre la fiche (sans confirmation).
- {"type":"courriel","client_id":"uuid ou null","a":"adresse si pas de client ou autre adresse","objet":"...","message":"...","suivi_jours":7} — rédige et envoie un courriel au nom du cabinet (tu agis comme secrétaire). Style : français québécois professionnel, cordial et concis; commence par « Bonjour [prénom ou nom de la personne-ressource], », paragraphes courts séparés par une ligne vide, listes avec « • » au besoin, termine par « Merci et bonne journée, » ou « Cordialement, » SANS signature (elle est ajoutée automatiquement). Ne demande jamais de NAS ni de documents d'identité par courriel : invite plutôt le client à les déposer dans son portail client (https://app.boujradcpa.com/portail.html). "suivi_jours" crée une tâche de suivi (facultatif).
- {"type":"facture","client_id":"uuid ou null","nouveau":{"nom":"...","courriel":"..."},"courriel":"autre adresse facultative","lignes":[{"description":"Préparation de la déclaration de revenus 2026","montant":75}],"taxable":true,"echeance":"AAAA-MM-JJ","envoyer":true} — crée une facture payable par Interac ou par carte et l'envoie au client par courriel (PDF + modes de paiement). Les montants sont AVANT taxes. Si le client n'est pas dans la liste, demande d'abord son nom complet et son courriel, puis utilise "nouveau". Si le client existe sans courriel, demande-le et mets-le dans "courriel". Échéance par défaut : 15 jours.
Les dates relatives (« vendredi », « dans deux semaines ») sont calculées à partir de la date du jour.`,
    actions:{
      tache:{titre:a=>'Nouvelle tâche',verifier:a=>!String(a.titre||'').trim()?'Titre manquant.':a.client_id&&!iaCli(a.client_id)?'Client introuvable.':a.echeance&&!/^\d{4}-\d{2}-\d{2}$/.test(a.echeance)?'Date invalide.':null,
        apercu:a=>`<table><tr><td>Titre</td><td><strong>${esc(a.titre)}</strong></td></tr><tr><td>Client</td><td>${esc(a.client_id?iaCli(a.client_id)?.nom:'Cabinet')}</td></tr><tr><td>Échéance</td><td>${a.echeance?dl(a.echeance):'—'}</td></tr><tr><td>Priorité</td><td>${esc(a.priorite||'normale')}</td></tr>${a.details?`<tr><td>Détails</td><td>${esc(a.details)}</td></tr>`:''}</table>`,
        executer:async a=>{const{error}=await sb.from('cc_taches').insert({client_id:a.client_id||null,titre:String(a.titre).slice(0,200),details:a.details||null,echeance:a.echeance||null,priorite:['basse','normale','haute'].includes(a.priorite)?a.priorite:'normale'});if(error)throw error;await load();return'Tâche créée'}},
      tache_faite:{titre:a=>'Terminer la tâche',verifier:a=>!TCH.find(t=>t.id===a.id)?'Tâche introuvable.':null,apercu:a=>{const t=TCH.find(x=>x.id===a.id);return `<p style="margin:0">${esc(t?.titre)}${t?.client_id?' — '+esc(iaCli(t.client_id)?.nom):''}</p>`},
        executer:async a=>{const{error}=await sb.from('cc_taches').update({statut:'fait',fait_le:new Date().toISOString()}).eq('id',a.id);if(error)throw error;await load();return'Tâche terminée'}},
      note:{titre:a=>'Note au dossier de '+(iaCli(a.client_id)?.nom||'?'),verifier:a=>!iaCli(a.client_id)?'Client introuvable.':!String(a.texte||'').trim()?'Note vide.':null,apercu:a=>`<p style="margin:0;white-space:pre-wrap">${esc(a.texte)}</p>`,
        executer:async a=>{const{error}=await sb.from('cc_notes').insert({client_id:a.client_id,type:'note',texte:String(a.texte).slice(0,4000),auteur:who()});if(error)throw error;await load();return'Note ajoutée'}},
      modifier_client:{titre:a=>'Modifier la fiche de '+(iaCli(a.client_id)?.nom||'?'),
        verifier:a=>{const c=iaCli(a.client_id);if(!c)return'Client introuvable.';const k=Object.keys(a.champs||{});if(!k.length)return'Aucun changement.';const bad=k.filter(x=>!IA_CHAMPS[x]);if(bad.length)return'Champ non permis : '+bad.join(', ');
          const v=a.champs;if(v.statut&&!['actif','inactif','prospect'].includes(v.statut))return'Statut invalide.';if(v.frequence&&!['mensuelle','trimestrielle','annuelle'].includes(v.frequence))return'Fréquence invalide.';if(v.fin_exercice&&!/^\d{2}-\d{2}$/.test(v.fin_exercice))return'Fin d’exercice : format MM-JJ.';if(v.courriel&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.courriel))return'Courriel invalide.'},
        capture:a=>{const c=iaCli(a.client_id)||{};return Object.fromEntries(Object.keys(a.champs||{}).map(k=>[k,c[k]??null]))},
        apercu:a=>{const c=a._avant||iaCli(a.client_id)||{};return `<table><tr><th>Champ</th><th>Avant</th><th>Après</th></tr>${Object.entries(a.champs||{}).map(([k,v])=>`<tr><td>${esc(IA_CHAMPS[k]||k)}</td><td>${esc(c[k]??'—')}</td><td><strong>${esc(v)}</strong></td></tr>`).join('')}</table>`},
        executer:async a=>{const ch={...a.champs,updated_at:new Date().toISOString()};['employeur','tps_tvq'].forEach(k=>{if(k in ch)ch[k]=ch[k]===true||ch[k]==='true'||ch[k]==='oui'});
          const{error}=await sb.from('cc_clients').update(ch).eq('id',a.client_id);if(error)throw error;await sb.from('cc_notes').insert({client_id:a.client_id,type:'note',texte:'Fiche modifiée par l’assistant : '+Object.keys(a.champs).map(k=>IA_CHAMPS[k]).join(', '),auteur:who()});await load();return'Fiche mise à jour'}},
      echeance_faite:{titre:a=>'Marquer l’échéance comme faite',verifier:a=>!iaCli(a.client_id)?'Client introuvable.':!a.cle?'Échéance manquante.':null,apercu:a=>`<p style="margin:0">${esc(iaCli(a.client_id)?.nom)} — ${esc(a.cle)}</p>`,
        executer:async a=>{const{error}=await sb.from('cc_echeances').insert({client_id:a.client_id,cle:a.cle,par:who()});if(error)throw error;await load();return'Échéance marquée comme faite'}},

      facture:{titre:a=>`Facture à ${a.client_id?iaCli(a.client_id)?.nom:a.nouveau?.nom||'?'}${a.envoyer!==false?' — envoi par courriel':''}`,
        capture:a=>({courriel:a.courriel||(a.client_id?iaCli(a.client_id)?.courriel:a.nouveau?.courriel)||''}),
        verifier:a=>{const L=(a.lignes||[]).filter(l=>String(l.description||'').trim()&&+l.montant>0);if(!L.length)return'Aucune ligne de facture.';const ok=m=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m||'');
          if(a.client_id){if(!iaCli(a.client_id))return'Client introuvable.'}else if(!a.nouveau?.nom||!ok(a.nouveau?.courriel))return'Nom et courriel du nouveau client requis.';
          const to=a.courriel||(a.client_id?iaCli(a.client_id)?.courriel:a.nouveau?.courriel);if(a.envoyer!==false&&!ok(to))return'Aucun courriel valide pour envoyer la facture : précisez-le.';if(a.echeance&&!/^\d{4}-\d{2}-\d{2}$/.test(a.echeance))return'Échéance invalide.'},
        apercu:a=>{const L=(a.lignes||[]).filter(l=>+l.montant>0),t=F().taxes(L.reduce((s,l)=>s+ +l.montant,0),a.taxable!==false),to=a._avant?.courriel||a.courriel;
          return `<table>${a.nouveau?`<tr><td colspan="2"><strong>Nouveau client :</strong> ${esc(a.nouveau.nom)} (${esc(a.nouveau.courriel)})</td></tr>`:''}${L.map(l=>`<tr><td>${esc(l.description)}</td><td class="n">${fmt(+l.montant)}</td></tr>`).join('')}<tr><td>TPS</td><td class="n">${fmt(t.tps)}</td></tr><tr><td>TVQ</td><td class="n">${fmt(t.tvq)}</td></tr><tr><td><strong>Total</strong></td><td class="n"><strong>${fmt(t.total)}</strong></td></tr></table>
          <p style="margin:6px 0 0">Payable par ${[PAR.interac?'Interac':'',PAR.carte==='oui'?'carte de crédit':''].filter(Boolean).join(' ou ')||'— (ajoutez le courriel Interac dans Facturation > Paramètres)'}${a.echeance?' · échéance '+dl(a.echeance):' · échéance dans 15 jours'}${a.envoyer!==false?`<br>Envoyée à <strong>${esc(to)}</strong> avec la facture en PDF.`:'<br>Non envoyée.'}</p>`},
        executer:async a=>{let cid=a.client_id;if(!cid)cid=(await nouveauClient(a.nouveau.nom.trim(),a.nouveau.courriel.trim())).id;
          const lignes=(a.lignes||[]).filter(l=>+l.montant>0).map(l=>({description:String(l.description).trim().slice(0,200),montant:F().r2(+l.montant)})),t=F().taxes(lignes.reduce((s,l)=>s+l.montant,0),a.taxable!==false);
          const{data:f,error}=await sb.from('cc_factures').insert({client_id:cid,lignes,...t,mode:'autre',statut:'à payer',echeance:a.echeance||new Date(Date.now()+15*864e5).toLocaleDateString('fr-CA'),emetteur:emetteur(),date:new Date().toLocaleDateString('fr-CA')}).select().single();if(error)throw error;
          FAC.push(f);if(a.envoyer===false){await load();return`Facture ${f.numero} créée (${fmt(f.total)})`}
          const to=a.courriel||iaCli(cid)?.courriel;if(a.courriel&&!iaCli(cid)?.courriel)await sb.from('cc_clients').update({courriel:a.courriel}).eq('id',cid);await envoyerFacture(f,to);return`Facture ${f.numero} (${fmt(f.total)}) créée et envoyée à ${to}`}},
      courriel:{titre:a=>`Courriel à ${a.client_id?iaCli(a.client_id)?.nom:a.a||'?'}`,
        capture:a=>({to:a.a||(a.client_id?iaCli(a.client_id)?.courriel:'')||''}),
        verifier:a=>{const to=a._avant?.to||a.a||(a.client_id?iaCli(a.client_id)?.courriel:'');if(a.client_id&&!iaCli(a.client_id))return'Client introuvable.';if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to||''))return'Aucun courriel valide pour ce destinataire : précisez l’adresse.';if(!String(a.objet||'').trim()||!String(a.message||'').trim())return'Objet ou message manquant.'},
        apercu:a=>`<table><tr><td>À</td><td><strong>${esc(a._avant?.to||a.a||iaCli(a.client_id)?.courriel||'')}</strong></td></tr><tr><td>Objet</td><td>${esc(a.objet)}</td></tr></table><div style="white-space:pre-wrap;margin-top:8px;padding:8px 10px;background:#f6f7fa;border-radius:8px;font-size:13px">${esc(a.message)}</div><p style="margin:6px 0 0;font-size:12.5px;color:#667085">La signature du cabinet avec le logo est ajoutée automatiquement.</p>`,
        executer:async a=>{const to=a._avant?.to||a.a||iaCli(a.client_id)?.courriel;await fn(cfg.FONCTION_COURRIEL||'tl-email',{to,subject:String(a.objet).slice(0,200),text:String(a.message).replace(/\n*Boujrad CPA Inc\.?\s*$/,'')+'\n\nBoujrad CPA Inc.'});
          if(a.client_id){await sb.from('cc_notes').insert({client_id:a.client_id,type:'courriel',texte:`Courriel envoyé à ${to} : ${a.objet}`,auteur:who()});if(a.suivi_jours>0)await sb.from('cc_taches').insert({client_id:a.client_id,titre:`Suivi : ${a.objet}`,echeance:new Date(Date.now()+a.suivi_jours*864e5).toLocaleDateString('fr-CA'),priorite:'normale'});await load()}
          return`Courriel envoyé à ${to}${a.client_id&&a.suivi_jours>0?` · suivi dans ${a.suivi_jours} jours`:''}`}},
      demande:{auto:true,titre:()=>'',apercu:()=>'',executer:async a=>{if(!window.MODELES?.liste.some(x=>x.id===a.service))throw new Error('service inconnu');DTM=a.service;DTC=a.client_id&&iaCli(a.client_id)?a.client_id:'';DTE=false;DTV=null;DTQ=true;TAB='dt';render();
        setTimeout(()=>{if(a.courriel&&$('dtE'))$('dtE').value=a.courriel;$('dtGo')?.scrollIntoView({block:'center'})},400);return'Formulaire de demande ouvert : relisez puis cliquez sur Envoyer'}},
      ouvrir_client:{auto:true,titre:()=>'',apercu:()=>'',executer:async a=>{const c=iaCli(a.client_id);if(!c)throw new Error('client introuvable');EDIT=c;FT='fiche';CED=null;TAB='cli';render();window.scrollTo(0,0);return'Fiche ouverte : '+c.nom}}}})}
async function start(s){const{data:m}=await sb.from('tl_membres').select('role').eq('user_id',s.user.id).maybeSingle();
  if(!m){$('auth').hidden=false;$('aM').textContent='Ce compte n’est pas autorisé dans l’intranet. Les clients utilisent le Portail client.';$('aM').className='msg err';await sb.auth.signOut();return}
  $('auth').hidden=true;$('app').hidden=false;$('who').hidden=false;$('whoE').textContent=s.user.email;load().then(()=>iaInitC())}
$('aF').onsubmit=async e=>{e.preventDefault();$('aM').textContent='Connexion…';const{data,error}=await sb.auth.signInWithPassword({email:$('aE').value.trim(),password:$('aP').value});if(error){$('aM').textContent='Courriel ou mot de passe invalide.';$('aM').className='msg err';return}start(data.session)};
$('out').onclick=()=>sb.auth.signOut().then(()=>location.reload());
(async()=>{const{data:{session}}=await sb.auth.getSession();session?start(session):$('auth').hidden=false})();
})();
