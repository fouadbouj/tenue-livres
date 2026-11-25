/* Portail client — espace Entreprise : documents du cabinet à payer, dépôt de documents, échéancier, messages */
(()=>{
const $=id=>document.getElementById(id);let sb,U,esc,ENTS=[],CUR=null,SUB='pub',DEP=null,UP=[];
const dl=x=>x?new Date((x.length===10?x+'T12:00':x)).toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}):'—';
const money=v=>v==null?'':new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(v);
const safe=n=>n.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-120);
const iso=d=>d.toISOString().slice(0,10),finMois=(y,m)=>new Date(Date.UTC(y,m,0));
const QS=new URLSearchParams(location.search),invite=QS.get('invite')||'';let depot=QS.get('depot')||'';

document.addEventListener('portail-pret',()=>{({sb,U,esc}=window.PORTAIL);if(invite||depot)space('ent')});
document.addEventListener('click',e=>{const b=e.target.closest('[data-sp]');if(b)space(b.dataset.sp)});
function space(sp){document.querySelectorAll('#space button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sp===sp));$('perso').hidden=sp!=='perso';$('ent').hidden=sp!=='ent';if(sp==='ent')loadEnts()}

async function loadEnts(){$('ent').innerHTML='<div class="card"><p class="sub">Chargement…</p></div>';
  if(invite&&!sessionStorage.getItem('inv-'+invite)){sessionStorage.setItem('inv-'+invite,'1');await join(invite,true)}
  const{data,error}=await sb.from('cc_clients').select('*').order('nom');ENTS=data||[];
  if(error){$('ent').innerHTML=`<div class="card"><p class="msg err">Espace entreprise indisponible pour le moment.</p></div>`;return}
  if(depot&&ENTS.length){const{data:d}=await sb.from('cc_demandes').select('id,client_id').eq('id',depot).maybeSingle();if(d){CUR=d.client_id;SUB='dep';DEP=d.id;depot=''}}
  if(!CUR||!ENTS.some(x=>x.id===CUR))CUR=ENTS[0]?.id||null;render()}
async function join(code,quiet){const{data,error}=await sb.rpc('pc_rejoindre',{p_code:code});if(error){if(!quiet)return error.message;return}return null}

function render(){const ent=ENTS.find(x=>x.id===CUR);
  if(!ent){$('ent').innerHTML=`<div class="card"><h2>Espace entreprise</h2><p>Déposez les documents de votre entreprise (taxes, tenue de livres), retrouvez les déclarations préparées par le cabinet avec le montant et le code de paiement, et suivez vos échéances.</p>
    <div class="info">Pour accéder à votre entreprise, entrez le code d’invitation remis par Boujrad CPA. Vous ne l’avez pas? Écrivez-nous ou appelez le cabinet.</div>
    <div class="row" style="margin-top:12px;align-items:flex-end"><label class="f" style="width:260px"><b>Code d’invitation</b><input id="iCode" value="${esc(invite)}" autocomplete="off" style="text-transform:uppercase"></label><button class="pri" id="iGo">Accéder</button></div><div class="msg" id="iM"></div></div>`;return}
  $('ent').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-end">
    ${ENTS.length>1?`<label class="f" style="width:320px"><b>Entreprise</b><select id="eSel">${ENTS.map(x=>`<option value="${x.id}"${x.id===CUR?' selected':''}>${esc(x.nom)}</option>`).join('')}</select></label>`:`<h2 style="margin:0">${esc(ent.nom)}</h2>`}
    <button class="sm" id="eAdd">Ajouter une autre entreprise</button></div>
    <nav class="tabs" style="margin-top:14px">${[['pub','À payer et documents du cabinet'],['dep','Déposer des documents'],['fac','Factures'],['ech','Échéancier'],['msg','Messages']].map(([k,l])=>`<button data-sub="${k}" aria-pressed="${SUB===k}">${l}</button>`).join('')}</nav><div id="eBody" style="margin-top:14px"><p class="sub">Chargement…</p></div></div>`;
  ({pub:rPub,dep:rDep,fac:rFac,ech:rEch,msg:rMsg})[SUB](ent)}

/* --- documents du cabinet --- */
async function rPub(ent){const{data}=await sb.from('cc_publications').select('*').eq('client_id',ent.id).order('created_at',{ascending:false});const L=data||[];
  const due=L.filter(p=>p.montant>0&&!p.paye_le);
  $('eBody').innerHTML=(due.length?`<div class="alert" style="border-color:var(--gold);background:#fbf4e4;color:#5c430c"><strong style="color:#7a5a12">${due.length} paiement${due.length>1?'s':''} à faire</strong>Total : ${money(due.reduce((s,p)=>s+ +p.montant,0))}. Le détail et le code de paiement sont ci-dessous.</div>`:'')+
    (L.map(p=>`<div class="rep"><div class="row" style="justify-content:space-between"><div><strong>${esc(p.titre)}</strong><br><span class="sub" style="font-size:14px">${esc(p.type)}${p.periode?' · '+esc(p.periode):''} · publié le ${dl(p.created_at)}</span></div>
      ${p.montant>0&&p.organisme!=='Aucun paiement'?(p.paye_le?`<span class="pill ok">Payé le ${dl(p.paye_le)}</span>`:`<span class="pill r">À payer</span>`):''}</div>
      ${p.montant>0?`<dl class="kv" style="margin-top:10px"><dt>Montant à payer</dt><dd><strong>${money(p.montant)}</strong></dd>${p.echeance?`<dt>Date limite</dt><dd>${dl(p.echeance)}</dd>`:''}${p.code_paiement?`<dt>${p.organisme==='ARC'?'Numéro de compte à inscrire':p.organisme==='Revenu Québec'?'Code de paiement':'Code ou référence de paiement'}</dt><dd><strong style="font-family:monospace;font-size:16px">${esc(p.code_paiement)}</strong> <button class="sm" data-copy="${esc(p.code_paiement)}">Copier</button></dd>`:''}</dl>`:''}
      ${p.instructions?`<details style="margin-top:10px"${p.paye_le?'':' open'}><summary style="cursor:pointer;font-weight:600">Comment faire le paiement</summary><p style="white-space:pre-wrap;margin:8px 0 0;background:var(--soft);border-radius:10px;padding:10px 14px">${esc(p.instructions)}</p></details>`:''}
      <div class="row" style="margin-top:10px">${p.contrat_id?`<button class="sm pri" data-ctr="${p.contrat_id}">Lire et signer le contrat</button>`:''}${(p.fichiers||[]).map(f=>`<button class="sm" data-open="${esc(f.path)}" data-pub="${p.id}">${esc(f.nom)}</button>`).join('')}${p.montant>0&&p.organisme!=='Aucun paiement'?(p.paye_le?`<button class="sm" data-pay="${p.id}" data-v="non payé">Annuler « payé »</button>`:`<button class="sm pri" data-pay="${p.id}" data-v="payé">J’ai fait le paiement</button>`):''}</div></div>`).join('')||'<p class="sub">Aucun document du cabinet pour l’instant. Les déclarations et avis de paiement préparés par Boujrad CPA apparaîtront ici.</p>')
    +`<p class="sub" style="font-size:13px;margin-top:12px">Le paiement se fait auprès du gouvernement (par votre institution financière ou les services en ligne de l’ARC et de Revenu Québec), pas auprès du cabinet. « J’ai fait le paiement » nous informe seulement que c’est fait.</p>`;
  L.filter(p=>!p.vu_le).forEach(p=>sb.rpc('pc_publication',{p_id:p.id,p_action:'vu'}))}

/* --- contrat de services : lecture et signature électronique --- */
const withSig=(h,k)=>k.signe_le?h.replace('</body>',`<div style="border:2px solid #1d7a4f;background:#eef8f2;padding:12px;margin:24px 0;font-size:10.5pt">Contrat accepté électroniquement par <strong>${esc(k.signe_nom)}</strong>${k.signe_titre?', '+esc(k.signe_titre):''}, le ${new Date(k.signe_le).toLocaleString('fr-CA',{dateStyle:'long',timeStyle:'short'})}, au moyen du portail client de Boujrad CPA Inc.</div></body>`):h;
async function openCtr(id,msg){const{data:k}=await sb.from('cc_contrats').select('*').eq('id',id).maybeSingle();if(!k){$('eBody').innerHTML='<p class="msg err">Contrat introuvable.</p>';return}
  $('eBody').innerHTML=`<div class="row" style="justify-content:space-between"><button class="sm" id="kRet">← Retour</button><button class="sm" id="kImp">Imprimer ou enregistrer en PDF</button></div>${msg?`<div class="info" style="margin-top:12px;background:#e6f5ec"><strong>${esc(msg)}</strong></div>`:''}
    <iframe id="kFr" sandbox="allow-same-origin allow-modals" title="Contrat de services" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:10px;background:#fff;margin-top:12px"></iframe>
    ${k.statut==='envoyé'?`<div class="card" style="margin-top:12px;box-shadow:none;border:1px solid var(--line)"><h3 style="margin-top:0">Signature électronique</h3>${k.donnees?.dpa?`<div class="info" style="margin-bottom:12px"><strong>Débits préautorisés.</strong> Ce contrat prévoit un prélèvement mensuel de ${window.FACTURE?window.FACTURE.money(window.FACTURE.taxes(k.donnees.dpaMontant).total):''} (taxes incluses) le ${esc(k.donnees.dpaJour||'1')} de chaque mois, à compter du ${dl(k.donnees.dpaDebut)}. Les conditions sont à l’annexe B du contrat. Inscrivez le compte à débiter :</div>
      <div class="grid"><label class="f"><b class="req">Titulaire du compte</b><input id="dT" value="${esc(ENTS.find(x=>x.id===k.client_id)?.nom||'')}"></label><label class="f"><b class="req">Institution (3 chiffres)</b><input id="dI" inputmode="numeric" maxlength="3" placeholder="815"></label><label class="f"><b class="req">Transit (5 chiffres)</b><input id="dR" inputmode="numeric" maxlength="5"></label><label class="f"><b class="req">Numéro de compte</b><input id="dC" inputmode="numeric" maxlength="12" autocomplete="off"></label></div>
      <p class="sub" style="font-size:13px;margin:6px 0">Ces numéros figurent au bas d’un chèque : transit (5 chiffres), institution (3 chiffres, ex. 815 pour Desjardins), puis le numéro de compte.</p>
      <label class="f"><b>Spécimen de chèque ou relevé d’information bancaire (recommandé)</b><input type="file" id="dF" accept=".pdf,.jpg,.jpeg,.png,.heic"></label>
      ${k.donnees.dpaRenonce?'<p style="margin:8px 0"><u><strong>Je renonce au délai de 10 jours entre la confirmation de l’accord et le premier débit.</strong></u></p>':''}<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">`:''}
      <div class="grid"><label class="f"><b class="req">Votre nom complet</b><input id="kNom" autocomplete="name"></label><label class="f"><b>Votre titre (s’il y a lieu)</b><input id="kTi" placeholder="Ex. Président"></label></div>
      <label class="opt" style="margin-top:10px"><input type="checkbox" id="kOk"> <span>J’ai lu le contrat et ses annexes${k.donnees?.dpa?', y compris l’accord de débits préautorisés,':''} je les accepte et je suis autorisé(e) à signer au nom du client. Je reconnais que cette acceptation électronique a la même valeur qu’une signature manuscrite.</span></label>
      <div class="row" style="margin-top:10px"><button class="pri" id="kSign" data-id="${k.id}">Signer le contrat</button><span class="msg" id="kMsg"></span></div></div>`:k.statut==='signé'?`<p class="sub" style="margin-top:10px">Signé le ${dl(k.signe_le)} par ${esc(k.signe_nom)}.</p>`:'<p class="sub">Ce contrat a été annulé.</p>'}`;
  $('kFr').srcdoc=withSig(k.html||'',k)}

/* --- factures --- */
async function rFac(ent){const[{data},{data:dpa}]=await Promise.all([sb.from('cc_factures').select('*').eq('client_id',ent.id).order('date',{ascending:false}),sb.rpc('pc_mon_dpa',{p_client:ent.id})]);const L=data||[],a=(dpa||[])[0],FX=window.FACTURE;
  const st={'à prélever':'Sera prélevée','transmise':'Prélèvement en cours','payée':'Payée','rejetée':'Débit refusé — à régler','à payer':'À payer'};
  $('eBody').innerHTML=`${a&&a.statut==='actif'?`<div class="info">Paiement par débit préautorisé : <strong>${FX.money(FX.taxes(a.montant).total)}</strong> (taxes incluses) le ${a.jour} de chaque mois, compte •••${esc(a.compte_fin)}. Pour changer de compte, écrivez-nous dans « Messages » au moins 10 jours avant le prochain débit.</div>`:''}
    <table style="margin-top:12px"><thead><tr><th>Facture</th><th>Description</th><th class="r">Total</th><th>Statut</th><th></th></tr></thead><tbody>${L.map(f=>`<tr><td><strong>${esc(f.numero)}</strong><br><small class="sub">${dl(f.date)}</small></td><td>${esc((f.lignes||[]).map(l=>l.description).join(' · '))}</td><td class="r">${FX.money(f.total)}</td><td><span class="pill ${f.statut==='payée'?'ok':['rejetée','à payer'].includes(f.statut)?'r':''}">${st[f.statut]||esc(f.statut)}</span></td><td><button class="sm" data-fview="${f.id}">Voir ou imprimer</button></td></tr>`).join('')||'<tr><td colspan="5" class="sub">Aucune facture.</td></tr>'}</tbody></table>`;
  FACS=L}
let FACS=[];

/* --- dépôt de documents --- */
async function rDep(ent){const{data}=await sb.from('cc_demandes').select('*').eq('client_id',ent.id).order('fin',{ascending:false});const D=(data||[]).filter(d=>d.statut!=='annulée');
  const open=D.filter(d=>['à envoyer','envoyée'].includes(d.statut));
  if(!DEP)DEP=open[0]?.id||'divers';UP=[];
  $('eBody').innerHTML=`<label class="f" style="max-width:520px"><b>Documents pour</b><select id="dSel">${D.map(d=>`<option value="${d.id}"${DEP===d.id?' selected':''}>TPS/TVQ : ${dl(d.debut)} au ${dl(d.fin)}${['reçue','apportée au bureau'].includes(d.statut)?' (déjà reçue)':''}</option>`).join('')}<option value="divers"${DEP==='divers'?' selected':''}>Autres documents (tenue de livres, factures, lettres reçues)</option></select></label>
    ${DEP!=='divers'?`<p class="sub" style="margin:8px 0 0">À transmettre : ${esc(ent.documents||'')}</p>`:''}
    <div class="alert" style="margin-top:12px"><strong>Déposez tous les documents de la période en une seule fois.</strong>Nous préparons vos déclarations directement à partir de ce que vous déposez. Si quelque chose manque, gardez vos documents et revenez lorsque tout sera complet.</div>
    <div class="drop" id="eDrop" style="margin-top:12px"><p style="margin:0 0 10px"><strong>Glissez vos fichiers ici</strong> ou</p><input type="file" id="eFiles" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt,.ofx,.qbo,.zip" style="max-width:340px;margin:auto"><p class="sub" style="margin:8px 0 0;font-size:13px">25 Mo au maximum par fichier</p></div>
    <ul id="eList"></ul>${DEP==='divers'?'<label class="f"><b>Message pour le cabinet (facultatif)</b><textarea id="eNote" style="min-height:70px"></textarea></label>':''}
    <div class="row" style="margin-top:10px"><button class="pri" id="eFin" disabled>J’ai terminé : envoyer au cabinet</button></div><div class="msg" id="eM"></div>`}
async function upload(files){const m=$('eM');m.className='msg';for(const f of files){if(f.size>26214400){m.textContent=f.name+' : trop gros.';m.className='msg err';continue}
    const path=`c/${CUR}/${DEP}/${Date.now()}-${safe(f.name)}`;m.textContent='Envoi de '+f.name+'…';const{error}=await sb.storage.from('documents').upload(path,f,{contentType:f.type||undefined});
    if(error){m.textContent=f.name+' : envoi impossible.';m.className='msg err';continue}UP.push({path,nom:f.name,taille:f.size});$('eList').insertAdjacentHTML('beforeend',`<li>${esc(f.name)}</li>`)}
  if(UP.length&&m.className!=='msg err')m.textContent=`${UP.length} document(s) prêt(s). Cliquez sur « J’ai terminé » quand tout est déposé.`;$('eFin').disabled=!UP.length}

/* --- échéancier --- */
function rEch(ent){const M=+String(ent.fin_exercice).slice(0,2)||12,auj=new Date(),L=[];const pas=ent.frequence==='mensuelle'?1:ent.frequence==='trimestrielle'?3:12;
  for(let y=auj.getFullYear()-1;y<=auj.getFullYear()+1;y++)for(let m=1;m<=12;m++){if(pas>1&&((m-M)%pas+pas)%pas!==0)continue;const fin=finMois(y,m),ech=pas===12?finMois(y,m+3):finMois(y,m+1);if(ech<auj)continue;
    L.push({d:iso(ech),t:`Déclaration et paiement de TPS/TVQ`,s:`Période se terminant le ${dl(iso(fin))}`})}
  for(let y=auj.getFullYear()-1;y<=auj.getFullYear()+1;y++){const fe=finMois(y,M);const t2=finMois(y,M+6),sol=finMois(y,M+2),sol3=finMois(y,M+3);
    if(sol>=auj)L.push({d:iso(sol),t:'Paiement du solde d’impôt de la société',s:`Exercice terminé le ${dl(iso(fe))} · 3 mois (${dl(iso(sol3))}) pour certaines SPCC admissibles`});
    if(t2>=auj)L.push({d:iso(t2),t:'Production des déclarations de revenus de la société (T2 et CO-17)',s:`Exercice terminé le ${dl(iso(fe))}`})}
  sb.from('cc_publications').select('titre,montant,echeance,paye_le').eq('client_id',ent.id).not('echeance','is',null).then(({data})=>{(data||[]).filter(p=>!p.paye_le&&p.montant>0).forEach(p=>L.push({d:p.echeance,t:`Paiement : ${p.titre}`,s:money(p.montant),r:1}));
    L.sort((a,b)=>a.d.localeCompare(b.d));$('eBody').innerHTML=`<p class="sub" style="font-size:14px">Dates générales selon votre fréquence de déclaration (${esc(ent.frequence)}) et votre fin d’exercice. Le cabinet vous confirme les montants.</p>
      <table><thead><tr><th>Date</th><th>Échéance</th></tr></thead><tbody>${L.slice(0,12).map(x=>`<tr><td style="white-space:nowrap"><strong>${dl(x.d)}</strong></td><td>${x.r?'<span class="pill r">À payer</span> ':''}${esc(x.t)}<br><small class="sub">${esc(x.s)}</small></td></tr>`).join('')}</tbody></table>`})}

/* --- messages --- */
async function rMsg(ent){const{data}=await sb.from('cc_messages').select('*').eq('client_id',ent.id).order('created_at');
  $('eBody').innerHTML=`<div id="mList" style="display:grid;gap:10px;max-height:460px;overflow:auto">${(data||[]).map(m=>`<div style="justify-self:${m.auteur==='client'?'end':'start'};max-width:80%;background:${m.auteur==='client'?'var(--soft)':'#fbf4e4'};border-radius:12px;padding:10px 14px">
    <small class="sub">${m.auteur==='client'?'Vous':'Boujrad CPA'} · ${dl(m.created_at)}</small><div style="white-space:pre-wrap">${esc(m.texte)}</div>${(m.fichiers||[]).map(f=>`<button class="sm" data-open="${esc(f.path)}" style="margin-top:6px">${esc(f.nom)}</button>`).join(' ')}</div>`).join('')||'<p class="sub">Aucun message. Écrivez-nous ici pour toute question sur votre dossier.</p>'}</div>
    <label class="f" style="margin-top:12px"><b>Nouveau message</b><textarea id="mTxt" style="min-height:80px"></textarea></label><div class="row" style="margin-top:8px"><button class="pri" id="mGo">Envoyer</button><span class="msg" id="mM"></span></div>`;const l=$('mList');l.scrollTop=l.scrollHeight}

/* --- événements --- */
document.addEventListener('change',e=>{const t=e.target;if(!$('ent')||$('ent').hidden)return;
  if(t.id==='eSel'){CUR=t.value;DEP=null;render()}if(t.id==='dSel'){DEP=t.value;rDep(ENTS.find(x=>x.id===CUR))}if(t.id==='eFiles'){upload([...t.files]);t.value=''}});
document.addEventListener('dragover',e=>{const d=e.target.closest?.('#eDrop');if(d){e.preventDefault();d.classList.add('over')}});
document.addEventListener('drop',e=>{const d=e.target.closest?.('#eDrop');if(d){e.preventDefault();d.classList.remove('over');upload([...e.dataTransfer.files])}});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||$('ent').hidden)return;const ent=ENTS.find(x=>x.id===CUR);
  if(b.id==='iGo'){const err=await join($('iCode').value);if(err){$('iM').textContent=err==='code invalide ou déjà utilisé'?'Code invalide ou déjà utilisé.':err;$('iM').className='msg err';return}loadEnts();return}
  if(b.id==='eAdd'){CUR=null;ENTS=[];render();return}
  if(b.dataset.sub){SUB=b.dataset.sub;render();return}
  if(b.dataset.ctr){openCtr(b.dataset.ctr);return}
  if(b.dataset.fview){const f=FACS.find(x=>x.id===b.dataset.fview);const w=window.open('','_blank');if(w){w.document.write(window.FACTURE.factureHtml(f,ent).replace('</body>','<script>setTimeout(()=>print(),300)<\/script></body>'));w.document.close()}return}
  if(b.id==='kSign'){const nom=$('kNom').value.trim();if(!nom||!$('kOk').checked){$('kMsg').textContent='Inscrivez votre nom et cochez la case pour accepter.';$('kMsg').className='msg err';return}
    if($('dI')){const I=$('dI').value.trim(),R=$('dR').value.trim(),C=$('dC').value.replace(/\s/g,''),T=$('dT').value.trim();
      if(!T||!/^\d{3}$/.test(I)||!/^\d{5}$/.test(R)||!/^[\d-]{5,12}$/.test(C)){$('kMsg').textContent='Vérifiez le compte : titulaire, institution (3 chiffres), transit (5 chiffres) et numéro de compte (5 à 12 chiffres).';$('kMsg').className='msg err';return}
      b.disabled=true;let spec=null;const f=$('dF').files[0];if(f){const path=`c/${CUR}/divers/${Date.now()}-specimen-${safe(f.name)}`;const up=await sb.storage.from('documents').upload(path,f,{contentType:f.type||undefined});if(!up.error)spec={path,nom:f.name}}
      const{error:e1}=await sb.rpc('pc_signer_dpa',{p_contrat:b.dataset.id,p_titulaire:T,p_institution:I,p_transit:R,p_compte:C,p_renonce:!!(await sb.from('cc_contrats').select('donnees').eq('id',b.dataset.id).maybeSingle()).data?.donnees?.dpaRenonce,p_nom:nom,p_specimen:spec});
      if(e1){$('kMsg').textContent='Accord de DPA impossible : '+e1.message;$('kMsg').className='msg err';b.disabled=false;return}}
    b.disabled=true;const{error}=await sb.rpc('pc_signer_contrat',{p_id:b.dataset.id,p_nom:nom,p_titre:$('kTi').value.trim()});
    if(error){$('kMsg').textContent='Signature impossible : '+error.message;$('kMsg').className='msg err';b.disabled=false;return}
    const pub=(await sb.from('cc_publications').select('id').eq('contrat_id',b.dataset.id).maybeSingle()).data;if(pub)sb.functions.invoke(window.CONFIG?.FONCTION_AVIS||'cc-avis',{body:{action:'signature',publication_id:pub.id}}).catch(()=>{});
    openCtr(b.dataset.id,'Merci! Votre contrat est signé. Une copie reste disponible ici en tout temps.');return}
  if(b.id==='kRet'){rPub(ent);return}
  if(b.id==='kImp'){const w=window.open('','_blank');if(w){w.document.write($('kFr').srcdoc.replace('</body>','<script>setTimeout(()=>print(),300)<\/script></body>'));w.document.close()}return}
  if(b.dataset.copy){navigator.clipboard?.writeText(b.dataset.copy);b.textContent='Copié';return}
  if(b.dataset.open){const{data,error}=await sb.storage.from('documents').createSignedUrl(b.dataset.open,300);if(!error)window.open(data.signedUrl,'_blank','noopener');if(b.dataset.pub)sb.rpc('pc_publication',{p_id:b.dataset.pub,p_action:'vu'});return}
  if(b.dataset.pay){b.disabled=true;await sb.rpc('pc_publication',{p_id:b.dataset.pay,p_action:b.dataset.v});if(b.dataset.v==='payé')sb.functions.invoke(window.CONFIG?.FONCTION_AVIS||'cc-avis',{body:{action:'paiement',publication_id:b.dataset.pay}}).catch(()=>{});rPub(ent);return}
  if(b.id==='eFin'){b.disabled=true;let r;if(DEP==='divers')r=await sb.from('cc_messages').insert({client_id:CUR,auteur:'client',user_id:U.id,texte:($('eNote')?.value||'').trim()||`${UP.length} document(s) déposé(s).`,fichiers:UP});
      else r=await sb.rpc('pc_depot_fini',{p_demande:DEP,p_fichiers:UP});
    if(r.error){$('eM').textContent='Envoi impossible : '+r.error.message;$('eM').className='msg err';b.disabled=false;return}
    $('eBody').innerHTML=`<div class="info" style="font-size:16px"><strong>Merci!</strong> ${UP.length} document(s) bien reçu(s) par Boujrad CPA.</div>`;UP=[];DEP=null;return}
  if(b.id==='mGo'){const t=$('mTxt').value.trim();if(!t)return;b.disabled=true;const{error}=await sb.from('cc_messages').insert({client_id:CUR,auteur:'client',user_id:U.id,texte:t.slice(0,5000)});if(error){$('mM').textContent='Envoi impossible.';b.disabled=false;return}rMsg(ent)}});
})();
