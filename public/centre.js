/* Centre clients — intranet : rappels TPS/TVQ, documents reçus, soumissions du portail client */
(()=>{
const cfg=window.CONFIG||{},sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SITE=cfg.APP_URL||location.origin,dl=x=>x?new Date((x.length===10?x+'T12:00':x)).toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'}):'—';
let ACC=[],PUB=[],MSG=[],CLI=[],DEM=[],PCS=[],TAB=location.hash==='#paiements'?'pay':'dem',PAYF='',NEWPAY=new Set(),EDIT=null,FILT='ouvertes',PCY='';
const fn=async(name,body)=>{const{data,error}=await sb.functions.invoke(name,{body});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data};

/* périodes terminées (même logique que la fonction cc-rappels) */
const iso=d=>d.toISOString().slice(0,10),finMois=(y,m)=>new Date(Date.UTC(y,m,0));
function periodes(c,auj=new Date()){const M=+String(c.fin_exercice).slice(0,2)||12,pas=c.frequence==='mensuelle'?1:c.frequence==='trimestrielle'?3:12,dep=new Date(c.depuis+'T00:00:00Z'),out=[];
  for(let y=dep.getUTCFullYear()-1;y<=auj.getUTCFullYear();y++)for(let m=1;m<=12;m++){if(pas>1&&((m-M)%pas+pas)%pas!==0)continue;const fin=finMois(y,m);if(fin>=auj||fin<dep)continue;
    out.push({periode:`${pas===1?'M':pas===3?'T':'A'}-${iso(fin)}`,debut:iso(new Date(Date.UTC(y,m-pas,1))),fin:iso(fin),echeance:iso(pas===12?finMois(y,m+3):finMois(y,m+1))})}return out}
const STP={'à envoyer':'g','envoyée':'g','reçue':'ok','apportée au bureau':'ok','annulée':''};

async function load(){const[a,b,c,d,e,f]=await Promise.all([sb.from('cc_clients').select('*').order('nom'),sb.from('cc_demandes').select('*').order('fin',{ascending:false}),sb.from('pc_soumissions').select('*').order('updated_at',{ascending:false}),sb.from('cc_acces').select('*'),sb.from('cc_publications').select('*').order('created_at',{ascending:false}),sb.from('cc_messages').select('*').order('created_at')]);
  ACC=d.data||[];PUB=e.data||[];MSG=f.data||[];
  if(a.error){$('tdem').innerHTML=`<div class="card"><p class="msg err">Lecture impossible : ${esc(a.error.message)}. Avez-vous exécuté le fichier supabase/portail_centre.sql?</p></div>`;return}
  CLI=a.data||[];DEM=b.data||[];PCS=c.data||[];render()}
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TAB));['dem','cli','pay','pc'].forEach(k=>$('t'+k).hidden=k!==TAB);badge();({dem:rDem,cli:rCli,pay:rPay,pc:rPc})[TAB]()}

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

/* ---------- clients TPS/TVQ ---------- */
function rCli(){const c=EDIT||{nom:'',contact:'',courriel:'',frequence:'trimestrielle',fin_exercice:'12-31',depuis:new Date().toISOString().slice(0,10),documents:'Relevés bancaires et de cartes de crédit, factures de ventes et factures d’achats de la période.',actif:true,notes:''};
  $('tcli').innerHTML=`<div class="card"><h2>${EDIT?.id?'Modifier le client':'Ajouter un client'}</h2><div class="grid">
    <label class="f"><b class="req">Nom de l’entreprise</b><input id="cN" value="${esc(c.nom)}"></label><label class="f"><b>Personne-ressource</b><input id="cC" value="${esc(c.contact||'')}"></label>
    <label class="f"><b>Courriel des rappels</b><input id="cE" type="email" value="${esc(c.courriel||'')}"></label>
    <label class="f"><b>Fréquence TPS/TVQ</b><select id="cF">${['mensuelle','trimestrielle','annuelle'].map(o=>`<option${c.frequence===o?' selected':''}>${o}</option>`).join('')}</select></label>
    <label class="f"><b>Fin d’exercice (mm-jj)</b><input id="cX" value="${esc(c.fin_exercice)}" placeholder="12-31"></label><label class="f"><b>Suivre à partir du</b><input id="cD" type="date" value="${esc(c.depuis)}"></label></div>
    <label class="f" style="margin-top:10px"><b>Documents demandés (texte du courriel)</b><textarea id="cT">${esc(c.documents)}</textarea></label>
    <label class="opt"><input type="checkbox" id="cA"${c.actif?' checked':''}> Rappels actifs</label>
    <div class="row" style="margin-top:8px"><button class="pri" id="cSave">Enregistrer</button>${EDIT?'<button id="cCancel">Fermer</button>':''}<span class="msg" id="cM"></span></div></div>${EDIT?.id?portalPanel(EDIT):''}
    <div class="card"><h2>Clients (${CLI.length})</h2><div class="scroll"><table><thead><tr><th>Client</th><th>Courriel</th><th>Fréquence</th><th>Prochaine période</th><th>Statut</th><th>Portail</th><th></th></tr></thead><tbody>
    ${CLI.map(c=>{const p=periodes(c,new Date(Date.now()+400*864e5)).find(p=>new Date(p.fin)>=new Date());return `<tr><td><strong>${esc(c.nom)}</strong>${c.contact?`<br><small class="sub">${esc(c.contact)}</small>`:''}</td><td>${esc(c.courriel||'—')}</td><td>${esc(c.frequence)}</td><td>${p?`fin le ${dl(p.fin)}`:'—'}</td><td>${c.actif?'<span class="pill ok">Actif</span>':'<span class="pill">Inactif</span>'}</td><td>${ACC.some(a=>a.client_id===c.id&&a.user_id)?'<span class="pill ok">Lié</span>':'—'}${MSG.filter(m=>m.client_id===c.id&&m.auteur==='client'&&!m.lu).length?` <span class="pill r">${MSG.filter(m=>m.client_id===c.id&&m.auteur==='client'&&!m.lu).length} message(s)</span>`:''}</td><td><button class="sm" data-edit="${c.id}">Ouvrir</button></td></tr>`}).join('')||'<tr><td colspan="7" class="sub">Aucun client encore.</td></tr>'}</tbody></table></div></div>`;if(EDIT?.id&&$('pTy'))syncPub(EDIT,'type')}

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
document.addEventListener('click',e=>{const a=e.target.closest('a[data-cli]');if(!a)return;e.preventDefault();EDIT=CLI.find(c=>c.id===a.dataset.cli);TAB='cli';render();window.scrollTo(0,0)});
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
