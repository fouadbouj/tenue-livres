/* Centre clients — intranet : rappels TPS/TVQ, documents reçus, soumissions du portail client */
(()=>{
const cfg=window.CONFIG||{},sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SITE=cfg.APP_URL||location.origin,dl=x=>x?new Date((x.length===10?x+'T12:00':x)).toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'}):'—';
let CLI=[],DEM=[],PCS=[],TAB='dem',EDIT=null,FILT='ouvertes',PCY='';
const fn=async(name,body)=>{const{data,error}=await sb.functions.invoke(name,{body});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data};

/* périodes terminées (même logique que la fonction cc-rappels) */
const iso=d=>d.toISOString().slice(0,10),finMois=(y,m)=>new Date(Date.UTC(y,m,0));
function periodes(c,auj=new Date()){const M=+String(c.fin_exercice).slice(0,2)||12,pas=c.frequence==='mensuelle'?1:c.frequence==='trimestrielle'?3:12,dep=new Date(c.depuis+'T00:00:00Z'),out=[];
  for(let y=dep.getUTCFullYear()-1;y<=auj.getUTCFullYear();y++)for(let m=1;m<=12;m++){if(pas>1&&((m-M)%pas+pas)%pas!==0)continue;const fin=finMois(y,m);if(fin>=auj||fin<dep)continue;
    out.push({periode:`${pas===1?'M':pas===3?'T':'A'}-${iso(fin)}`,debut:iso(new Date(Date.UTC(y,m-pas,1))),fin:iso(fin),echeance:iso(pas===12?finMois(y,m+3):finMois(y,m+1))})}return out}
const STP={'à envoyer':'g','envoyée':'g','reçue':'ok','apportée au bureau':'ok','annulée':''};

async function load(){const[a,b,c]=await Promise.all([sb.from('cc_clients').select('*').order('nom'),sb.from('cc_demandes').select('*').order('fin',{ascending:false}),sb.from('pc_soumissions').select('*').order('updated_at',{ascending:false})]);
  if(a.error){$('tdem').innerHTML=`<div class="card"><p class="msg err">Lecture impossible : ${esc(a.error.message)}. Avez-vous exécuté le fichier supabase/portail_centre.sql?</p></div>`;return}
  CLI=a.data||[];DEM=b.data||[];PCS=c.data||[];render()}
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TAB));['dem','cli','pc'].forEach(k=>$('t'+k).hidden=k!==TAB);({dem:rDem,cli:rCli,pc:rPc})[TAB]()}

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
      <td><div class="row" style="gap:6px">${['à envoyer','envoyée'].includes(d.statut)?`<button class="sm" data-send="${d.id}">Envoyer</button>`:''}<button class="sm" data-link="${d.jeton}">Copier le lien</button>${d.statut!=='apportée au bureau'?`<button class="sm" data-st="${d.id}" data-v="apportée au bureau">Apporté au bureau</button>`:''}${d.statut!=='annulée'?`<button class="sm danger" data-st="${d.id}" data-v="annulée">Annuler</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="7" class="sub">Aucune demande.</td></tr>'}</tbody></table></div></div>`}

/* ---------- clients TPS/TVQ ---------- */
function rCli(){const c=EDIT||{nom:'',contact:'',courriel:'',frequence:'trimestrielle',fin_exercice:'12-31',depuis:new Date().toISOString().slice(0,10),documents:'Relevés bancaires et de cartes de crédit, factures de ventes et factures d’achats de la période.',actif:true,notes:''};
  $('tcli').innerHTML=`<div class="card"><h2>${EDIT?.id?'Modifier le client':'Ajouter un client'}</h2><div class="grid">
    <label class="f"><b class="req">Nom de l’entreprise</b><input id="cN" value="${esc(c.nom)}"></label><label class="f"><b>Personne-ressource</b><input id="cC" value="${esc(c.contact||'')}"></label>
    <label class="f"><b>Courriel des rappels</b><input id="cE" type="email" value="${esc(c.courriel||'')}"></label>
    <label class="f"><b>Fréquence TPS/TVQ</b><select id="cF">${['mensuelle','trimestrielle','annuelle'].map(o=>`<option${c.frequence===o?' selected':''}>${o}</option>`).join('')}</select></label>
    <label class="f"><b>Fin d’exercice (mm-jj)</b><input id="cX" value="${esc(c.fin_exercice)}" placeholder="12-31"></label><label class="f"><b>Suivre à partir du</b><input id="cD" type="date" value="${esc(c.depuis)}"></label></div>
    <label class="f" style="margin-top:10px"><b>Documents demandés (texte du courriel)</b><textarea id="cT">${esc(c.documents)}</textarea></label>
    <label class="opt"><input type="checkbox" id="cA"${c.actif?' checked':''}> Rappels actifs</label>
    <div class="row" style="margin-top:8px"><button class="pri" id="cSave">Enregistrer</button>${EDIT?'<button id="cCancel">Annuler</button>':''}<span class="msg" id="cM"></span></div></div>
    <div class="card"><h2>Clients (${CLI.length})</h2><div class="scroll"><table><thead><tr><th>Client</th><th>Courriel</th><th>Fréquence</th><th>Prochaine période</th><th>Statut</th><th></th></tr></thead><tbody>
    ${CLI.map(c=>{const p=periodes(c,new Date(Date.now()+400*864e5)).find(p=>new Date(p.fin)>=new Date());return `<tr><td><strong>${esc(c.nom)}</strong>${c.contact?`<br><small class="sub">${esc(c.contact)}</small>`:''}</td><td>${esc(c.courriel||'—')}</td><td>${esc(c.frequence)}</td><td>${p?`fin le ${dl(p.fin)}`:'—'}</td><td>${c.actif?'<span class="pill ok">Actif</span>':'<span class="pill">Inactif</span>'}</td><td><button class="sm" data-edit="${c.id}">Modifier</button></td></tr>`}).join('')||'<tr><td colspan="6" class="sub">Aucun client encore.</td></tr>'}</tbody></table></div></div>`}

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

/* ---------- événements ---------- */
document.addEventListener('change',e=>{if(e.target.id==='pcY'){PCY=e.target.value;rPc()}});
document.addEventListener('click',async e=>{const b=e.target.closest('button,a[data-file]');if(!b)return;
  if(b.dataset.t){TAB=b.dataset.t;render();return}if(b.dataset.f){FILT=b.dataset.f;rDem();return}
  if(b.dataset.file){e.preventDefault();const{data,error}=await sb.storage.from('documents').createSignedUrl(b.dataset.file,300);if(error){alert('Ouverture impossible : '+error.message);return}window.open(data.signedUrl,'_blank','noopener');return}
  if(b.id==='gen'){b.disabled=true;const rows=CLI.filter(c=>c.actif).flatMap(c=>periodes(c).filter(p=>(Date.now()-new Date(p.fin))/864e5<=120&&!DEM.some(d=>d.client_id===c.id&&d.periode===p.periode)).map(p=>({...p,client_id:c.id})));
    const{error}=await sb.from('cc_demandes').insert(rows);$('dM').textContent=error?'Création impossible : '+error.message:`${rows.length} demande(s) créée(s).`;load();return}
  if(b.id==='tour'){b.disabled=true;$('dM').textContent='Envoi des rappels…';try{const r=await fn(cfg.FONCTION_RAPPELS||'cc-rappels',{});$('dM').textContent=`${r.crees} demande(s) créée(s), ${r.envoyes} courriel(s) envoyé(s).`+(r.erreurs?.length?' Erreurs : '+r.erreurs.join(' · '):'');load()}catch(err){$('dM').textContent='Envoi impossible : '+err.message;b.disabled=false}return}
  if(b.dataset.send){b.disabled=true;try{await fn(cfg.FONCTION_RAPPELS||'cc-rappels',{demande_id:b.dataset.send});$('dM').textContent='Courriel envoyé.';load()}catch(err){$('dM').textContent='Envoi impossible : '+err.message;b.disabled=false}return}
  if(b.dataset.link){const u=`${SITE}/depot.html?j=${b.dataset.link}`;try{await navigator.clipboard.writeText(u);$('dM').textContent='Lien copié : '+u}catch(err){$('dM').textContent=u}return}
  if(b.dataset.st){const v=b.dataset.v;const{error}=await sb.from('cc_demandes').update({statut:v,...(v==='apportée au bureau'?{recu_le:new Date().toISOString()}:{})}).eq('id',b.dataset.st);$('dM').textContent=error?error.message:'Statut mis à jour.';load();return}
  if(b.dataset.edit){EDIT=CLI.find(c=>c.id===b.dataset.edit);rCli();window.scrollTo(0,0);return}
  if(b.id==='cCancel'){EDIT=null;rCli();return}
  if(b.id==='cSave'){const row={nom:$('cN').value.trim(),contact:$('cC').value.trim()||null,courriel:$('cE').value.trim()||null,frequence:$('cF').value,fin_exercice:/^\d\d-\d\d$/.test($('cX').value)?$('cX').value:'12-31',depuis:$('cD').value||new Date().toISOString().slice(0,10),documents:$('cT').value.trim(),actif:$('cA').checked};
    if(!row.nom){$('cM').textContent='Nom requis.';return}const r=EDIT?.id?await sb.from('cc_clients').update(row).eq('id',EDIT.id):await sb.from('cc_clients').insert(row);
    if(r.error){$('cM').textContent=r.error.message;return}EDIT=null;await load();$('cM')&&($('cM').textContent='Enregistré.');return}
  if(b.dataset.pc){pcOpen(b.dataset.pc);return}if(b.id==='pcX'){$('pcD').innerHTML='';return}
  if(b.id==='pcSave'){const{error}=await sb.from('pc_soumissions').update({statut:$('pcS').value,note_cabinet:$('pcN').value.trim()||null,updated_at:new Date().toISOString()}).eq('id',b.dataset.id);$('pcM').textContent=error?error.message:'Enregistré.';if(!error){const id=b.dataset.id;await load();TAB='pc';render();pcOpen(id)}}});

/* ---------- connexion (membres du cabinet seulement) ---------- */
async function start(s){const{data:m}=await sb.from('tl_membres').select('role').eq('user_id',s.user.id).maybeSingle();
  if(!m){$('auth').hidden=false;$('aM').textContent='Ce compte n’est pas autorisé dans l’intranet. Les clients utilisent le Portail client.';$('aM').className='msg err';await sb.auth.signOut();return}
  $('auth').hidden=true;$('app').hidden=false;$('who').hidden=false;$('whoE').textContent=s.user.email;load()}
$('aF').onsubmit=async e=>{e.preventDefault();$('aM').textContent='Connexion…';const{data,error}=await sb.auth.signInWithPassword({email:$('aE').value.trim(),password:$('aP').value});if(error){$('aM').textContent='Courriel ou mot de passe invalide.';$('aM').className='msg err';return}start(data.session)};
$('out').onclick=()=>sb.auth.signOut().then(()=>location.reload());
(async()=>{const{data:{session}}=await sb.auth.getSession();session?start(session):$('auth').hidden=false})();
})();
