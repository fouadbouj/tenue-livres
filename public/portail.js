/* Portail client — impôts personnels (T1 fédéral et TP-1 du Québec) */
(()=>{
const cfg=window.CONFIG||{},sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let U=null,DOS=null,SOU=null,F={},TYPE='',STEP=1,FILES=[];
const now=new Date(),Y0=now.getMonth()>=10?now.getFullYear():now.getFullYear()-1;

/* ---------- définition des formulaires ---------- */
const OUI=['Oui','Non'];
const ETAT=['Célibataire','Marié(e)','Conjoint(e) de fait','Séparé(e)','Divorcé(e)','Veuf ou veuve'];
const enCouple=f=>['Marié(e)','Conjoint(e) de fait'].includes(f.etat);
const SITU=[['emploi','Revenus d’emploi (T4 / relevé 1)'],['autonome','Travail autonome ou commissions'],['location','Revenus de location d’un immeuble'],['placements','Intérêts, dividendes ou placements (T5, T3, relevés 3 et 16)'],
  ['vente','Vente d’actions, de fonds ou de cryptomonnaies'],['immeuble','Vente d’un immeuble ou de votre résidence'],['habitation','Achat d’une première habitation ou CELIAPP'],['reer','Cotisations REER, CELIAPP ou régime de pension'],
  ['prestations','Prestations : assurance-emploi, RQAP, CNESST, SAAQ'],['retraite','Pension, rente de retraite, RRQ ou Sécurité de la vieillesse'],['garde','Frais de garde d’enfants'],['medicaux','Frais médicaux ou dentaires'],
  ['dons','Dons de bienfaisance ou contributions politiques'],['etudes','Études postsecondaires (frais de scolarité, T2202 / relevé 8)'],['demenagement','Déménagement de plus de 40 km pour le travail ou les études'],
  ['emploidep','Dépenses d’emploi ou télétravail (T2200 / TP-64.3)'],['pension','Pension alimentaire payée ou reçue'],['etranger','Biens à l’étranger de plus de 100 000 $ ou revenus étrangers'],
  ['handicap','Personne handicapée ou proche aidant'],['aines','Aîné de 70 ans ou plus (maintien à domicile)'],['acomptes','Acomptes provisionnels versés'],['autre','Autre situation (précisez plus bas)']];
const CHG=[['c_adresse','Adresse'],['c_etat','État civil'],['c_conjoint','Conjoint(e)'],['c_enfants','Enfants ou personnes à charge'],['c_logement','Logement (locataire ou propriétaire)'],['c_banque','Compte bancaire (dépôt direct)'],['c_aucun','Aucun changement']];

const S=(t,fields,o={})=>({t,fields,...o});
const fld=(k,l,t='text',o={})=>({k,l,t,...o});
function sections(type){const neu=type==='nouveau',chg=k=>f=>neu||!!f[k];
  return[
  S('Vos renseignements',[fld('prenom','Prénom','text',{req:1}),fld('nom','Nom de famille','text',{req:1}),fld('ddn','Date de naissance','date',{req:1}),fld('nas','Numéro d’assurance sociale (NAS)','nas',{req:1}),
    fld('tel','Téléphone','tel',{req:1}),fld('courriel','Courriel','email',{req:1}),fld('langue','Langue de correspondance','select',{opts:['Français','Anglais']})]),
  S('Adresse',[fld('adresse','Adresse (numéro et rue)','text',{req:1}),fld('app','Appartement','text'),fld('ville','Ville','text',{req:1}),fld('prov','Province','select',{opts:['Québec','Ontario','Autre'],req:1}),fld('cp','Code postal','text',{req:1}),
    fld('adr31','Votre adresse au 31 décembre était différente','check'),fld('adresse31','Adresse au 31 décembre','text',{show:f=>f.adr31}),
    ...(neu?[fld('arrivee','Date d’arrivée au Canada ou au Québec (si pendant l’année)','date'),fld('citoyen','Êtes-vous citoyen(ne) canadien(ne)?','radio',{opts:OUI,req:1}),fld('elections','Autorisez-vous l’ARC à transmettre vos renseignements à Élections Canada?','radio',{opts:OUI,show:f=>f.citoyen==='Oui'})]:[])],{show:chg('c_adresse')}),
  S('Situation familiale au 31 décembre',[fld('etat','État civil','select',{opts:ETAT,req:1}),fld('date_etat','Date du changement d’état civil (si pendant l’année)','date'),
    fld('c_prenom','Prénom du conjoint','text',{req:1,show:enCouple}),fld('c_nom','Nom du conjoint','text',{req:1,show:enCouple}),fld('c_ddn','Date de naissance du conjoint','date',{req:1,show:enCouple}),
    fld('c_nas','NAS du conjoint','nas',{req:1,show:enCouple}),fld('c_revenu','Revenu net approximatif du conjoint pour l’année','text',{show:enCouple}),fld('c_client','Préparons-nous aussi la déclaration de votre conjoint?','radio',{opts:OUI,show:enCouple})],{show:f=>neu||f.c_etat||f.c_conjoint}),
  S('Enfants et personnes à charge',[fld('enfants','','rep')],{show:chg('c_enfants'),note:'Ajoutez chaque enfant ou personne à votre charge. Le NAS est facultatif s’il n’en a pas.'}),
  S('Logement au 31 décembre',[fld('logement','Vous étiez','radio',{opts:['Locataire','Propriétaire','Hébergé(e) sans payer de loyer','Autre'],req:1}),
    fld('rl31','Numéro de logement (case A de votre relevé 31)','text',{show:f=>f.logement==='Locataire'}),fld('seul','Viviez-vous seul(e) toute l’année?','radio',{opts:OUI})],{show:chg('c_logement'),note:'Ces renseignements servent au crédit d’impôt pour solidarité du Québec.'}),
  S('Assurance médicaments',[fld('assur','Pendant l’année, vous étiez couvert(e) par','radio',{opts:['Une assurance collective privée (employeur, association) toute l’année','Le régime public de la RAMQ toute l’année','Les deux selon les mois'],req:1}),
    fld('mois_ramq','Mois couverts par la RAMQ','text',{show:f=>/deux/.test(f.assur||'')})]),
  S('Votre année '+($('yr')?.value||''),[fld('situ','Cochez tout ce qui s’applique à vous cette année','checks',{opts:SITU}),fld('situ_detail','Précisions (facultatif)','textarea')]),
  S('Paiement et autorisations',[fld('banque','Dépôt direct','radio',{opts:neu?['Je joindrai un spécimen de chèque','Je préfère recevoir un chèque par la poste']:['Mes informations bancaires n’ont pas changé','Je joindrai un nouveau spécimen de chèque'],req:1}),
    fld('representant','J’autorise Boujrad CPA Inc. à me représenter auprès de l’ARC et de Revenu Québec pour cette déclaration','radio',{opts:OUI,req:1}),fld('commentaires','Autres renseignements utiles pour votre déclaration','textarea')])]}

/* ---------- validation ---------- */
const nasOk=v=>{const d=String(v||'').replace(/\D/g,'');if(d.length!==9)return false;let s=0;for(let i=0;i<9;i++){let n=+d[i];if(i%2){n*=2;if(n>9)n-=9}s+=n}return s%10===0};
function errors(){const E=[];sections(TYPE).forEach(sec=>{if(sec.show&&!sec.show(F))return;sec.fields.forEach(x=>{if(x.show&&!x.show(F))return;const v=F[x.k];
  if(x.req&&(v==null||v===''))E.push(`${sec.t} : « ${x.l} » est requis.`);if(x.t==='nas'&&v&&!nasOk(v))E.push(`${sec.t} : le NAS « ${x.l} » n’est pas valide.`)})});
  if(TYPE==='nouveau'||F.c_enfants)(F.enfants||[]).forEach((e,i)=>{if(!e.prenom||!e.nom||!e.ddn)E.push(`Personne à charge ${i+1} : prénom, nom et date de naissance requis.`)});
  if(TYPE==='existant'&&!CHG.some(([k])=>F[k]))E.unshift('Indiquez ce qui a changé, ou cochez « Aucun changement ».');
  if(!F.consent)E.push('Le consentement à la collecte des renseignements est requis.');return E}

/* ---------- rendu ---------- */
function input(x){const v=F[x.k]??'',id='f_'+x.k;
  if(x.t==='select')return `<label class="f"><b class="${x.req?'req':''}">${esc(x.l)}</b><select id="${id}" data-k="${x.k}"><option value=""></option>${x.opts.map(o=>`<option${v===o?' selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
  if(x.t==='radio')return `<fieldset style="border:0;padding:0;margin:0;grid-column:1/-1"><legend class="f" style="font-size:14px;color:var(--mute)"><b class="${x.req?'req':''}" style="color:var(--ink)">${esc(x.l)}</b></legend><div class="row" style="gap:6px 22px">${x.opts.map(o=>`<label class="opt"><input type="radio" name="${id}" data-k="${x.k}" value="${esc(o)}"${v===o?' checked':''}> ${esc(o)}</label>`).join('')}</div></fieldset>`;
  if(x.t==='check')return `<label class="opt" style="grid-column:1/-1"><input type="checkbox" data-k="${x.k}"${v?' checked':''}> ${esc(x.l)}</label>`;
  if(x.t==='checks'){const set=new Set(v||[]);return `<div style="grid-column:1/-1"><p style="margin:0 0 4px;font-weight:600">${esc(x.l)}</p><div class="opts">${x.opts.map(([k,l])=>`<label class="opt"><input type="checkbox" data-ks="${x.k}" value="${k}"${set.has(k)?' checked':''}> ${esc(l)}</label>`).join('')}</div></div>`}
  if(x.t==='textarea')return `<label class="f" style="grid-column:1/-1"><b>${esc(x.l)}</b><textarea data-k="${x.k}">${esc(v)}</textarea></label>`;
  if(x.t==='rep'){const L=F.enfants||[];return `<div style="grid-column:1/-1">${L.map((e,i)=>`<div class="rep"><div class="grid">${[['prenom','Prénom',1],['nom','Nom',1],['ddn','Date de naissance',1,'date'],['nas','NAS (facultatif)',0]].map(([k,l,r,t])=>`<label class="f"><b class="${r?'req':''}">${l}</b><input ${t?`type="${t}"`:''} data-e="${i}" data-ek="${k}" value="${esc(e[k]||'')}"></label>`).join('')}
      <label class="f"><b>Lien</b><select data-e="${i}" data-ek="lien">${['Enfant','Petit-enfant','Parent ou grand-parent','Autre'].map(o=>`<option${e.lien===o?' selected':''}>${o}</option>`).join('')}</select></label>
      <label class="f"><b>Garde</b><select data-e="${i}" data-ek="garde">${['Exclusive (vit avec moi)','Partagée','Ne vit pas avec moi'].map(o=>`<option${e.garde===o?' selected':''}>${o}</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:8px;justify-content:space-between"><label class="opt"><input type="checkbox" data-e="${i}" data-ek="handicap"${e.handicap?' checked':''}> Atteint(e) d’un handicap</label><button type="button" class="sm danger" data-del-e="${i}">Retirer</button></div></div>`).join('')}
      <button type="button" class="sm" id="addE">+ Ajouter une personne</button></div>`}
  return `<label class="f"><b class="${x.req?'req':''}">${esc(x.l)}</b><input ${x.t==='nas'?'inputmode="numeric" placeholder="123 456 789"':`type="${x.t}"`} data-k="${x.k}" value="${esc(v)}"${x.t==='email'||x.t==='tel'?` autocomplete="${x.t==='email'?'email':'tel'}"`:''}></label>`}
function steps(n){STEP=n;document.querySelectorAll('#steps span').forEach(s=>s.className=+s.dataset.s===n?'on':'')}
function render(){const y=+$('yr').value;
  if(SOU&&SOU.statut!=='brouillon'){steps(3);$('view').innerHTML=`<div class="card"><h2>Votre dossier ${y} est envoyé</h2><p>Reçu le ${esc(new Date(SOU.updated_at).toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}))} · statut : <span class="pill ${SOU.statut==='terminée'?'ok':'g'}">${esc(SOU.statut)}</span></p>
    <p>${(SOU.fichiers||[]).length} document(s) déposé(s). Nous communiquerons avec vous si un renseignement manque.</p>${SOU.note_cabinet?`<div class="info">${esc(SOU.note_cabinet)}</div>`:''}
    <p class="sub" style="margin-top:12px">Vous avez oublié un document? Communiquez avec nous avant de le déposer, pour que votre déclaration ne soit pas déjà transmise.</p></div>`;return}
  if(!TYPE){steps(1);$('view').innerHTML=`<div class="card"><h2>Bienvenue</h2><p class="sub">Choisissez votre situation pour l’année ${y}.</p>
    <div class="choice"><button data-type="nouveau"><strong>Nouveau client</strong><span>C’est la première fois que Boujrad CPA prépare votre déclaration.</span></button><button data-type="existant"${DOS?' aria-pressed="true"':''}><strong>Client existant</strong><span>Nous avons déjà préparé votre déclaration : indiquez seulement ce qui a changé.</span></button></div></div>`;return}
  if(STEP===1){const S_=sections(TYPE);let h=`<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${TYPE==='nouveau'?'Formulaire nouveau client':'Formulaire client existant'} · ${y}</h2><button class="sm" id="chType">Changer</button></div>
    <p class="sub" style="margin-top:6px">Les champs marqués d’un astérisque sont requis. Vos réponses sont enregistrées à chaque étape.</p>`;
    if(TYPE==='existant')h+=`<h3>Qu’est-ce qui a changé depuis votre dernière déclaration?</h3><div class="opts">${CHG.map(([k,l])=>`<label class="opt"><input type="checkbox" data-k="${k}"${F[k]?' checked':''}> ${l}</label>`).join('')}</div>`;
    S_.forEach(sec=>{if(sec.show&&!sec.show(F))return;h+=`<h3>${esc(sec.t)}</h3>${sec.note?`<p class="sub" style="margin:0 0 8px;font-size:14px">${esc(sec.note)}</p>`:''}<div class="grid">${sec.fields.filter(x=>!x.show||x.show(F)).map(input).join('')}</div>`});
    h+=`<h3>Consentement</h3><label class="opt"><input type="checkbox" data-k="consent"${F.consent?' checked':''}> <span>J’autorise Boujrad CPA Inc. à recueillir, utiliser et conserver les renseignements personnels fournis dans ce formulaire, y compris mon NAS et ceux des personnes nommées, uniquement pour préparer et transmettre mes déclarations de revenus. Je confirme avoir l’autorisation des personnes dont je fournis les renseignements.</span></label>
      <div class="msg err" id="fErr"></div><div class="row" style="margin-top:14px"><button class="pri" id="next1">Continuer vers les documents</button><span class="msg" id="sv"></span></div></div>`;
    $('view').innerHTML=h;return}
  if(STEP===2){const s=new Set(F.situ||[]),L=[['T4 et relevé 1 de chaque employeur','emploi'],['Feuillets de placements : T5, T3, T5008 et relevés 3, 16, 18','placements'],['Relevés de ventes de titres ou de cryptomonnaies (gains et pertes)','vente'],
      ['Revenus et dépenses de votre entreprise ou de vos commissions','autonome'],['Revenus et dépenses de chaque immeuble locatif','location'],['Documents de vente ou d’achat d’immeuble','immeuble'],['Relevés CELIAPP et documents d’achat d’une première habitation','habitation'],
      ['Reçus de cotisations REER, CELIAPP ou régime de pension','reer'],['T4E, relevé 6 (RQAP) et autres feuillets de prestations','prestations'],['T4A(P), T4A(OAS), T4RSP, relevé 2','retraite'],['Reçus de frais de garde et relevé 24','garde'],
      ['Reçus de frais médicaux et dentaires (et assurances payées)','medicaux'],['Reçus de dons et de contributions politiques','dons'],['T2202 et relevé 8','etudes'],['Reçus et détails du déménagement','demenagement'],['T2200 / TP-64.3 signés par l’employeur, et vos dépenses','emploidep'],
      ['Jugement ou entente de pension alimentaire et paiements','pension'],['Relevés des biens et revenus étrangers','etranger'],['Certificat pour personne handicapée ou documents de proche aidant','handicap'],['Factures de services de maintien à domicile','aines'],['Reçus des acomptes provisionnels','acomptes']].filter(([,k])=>s.has(k)).map(([t])=>t);
    if(F.logement==='Locataire')L.unshift('Relevé 31 remis par votre propriétaire');if(TYPE==='nouveau')L.push('Vos avis de cotisation de l’an dernier (ARC et Revenu Québec)');if(/spécimen/i.test(F.banque||''))L.push('Un spécimen de chèque');
    $('view').innerHTML=`<div class="card"><h2>Vos documents ${y}</h2>
      <div class="alert" role="alert"><strong>IMPORTANT : déposez la totalité de vos documents en une seule fois.</strong>Votre déclaration sera préparée directement à partir des documents déposés. Ne les envoyez pas au fur et à mesure. Si votre dossier n’est pas complet, gardez vos documents et revenez les déposer lorsque vous aurez tout en main : dès la réception, nous commençons le traitement de votre dossier.</div>
      <h3>Documents à prévoir selon vos réponses</h3><ul>${L.map(t=>`<li>${esc(t)}</li>`).join('')||'<li>Tous vos feuillets et relevés reçus pour l’année.</li>'}<li>Tout autre feuillet, relevé ou reçu reçu pour l’année.</li></ul>
      <div class="drop" id="drop"><p style="margin:0 0 10px"><strong>Glissez vos fichiers ici</strong> ou</p><input type="file" id="files" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.csv,.xlsx,.xls,.doc,.docx" style="max-width:340px;margin:auto"><p class="sub" style="margin:8px 0 0;font-size:13px">PDF, photos ou documents Office · 25 Mo au maximum par fichier</p></div>
      <div class="msg" id="upM"></div>
      <div class="scroll"><table style="margin-top:10px"><thead><tr><th>Document déposé</th><th>Taille</th><th></th></tr></thead><tbody id="fl"></tbody></table></div>
      <div class="row" style="margin-top:14px"><button id="back1">Retour au formulaire</button><button class="pri" id="next2">Continuer</button></div></div>`;listFiles();return}
  if(STEP===3){$('view').innerHTML=`<div class="card"><h2>Envoyer votre dossier ${y}</h2><p>${FILES.length} document(s) déposé(s).</p>
      <div class="alert"><strong>Avant d’envoyer</strong>Assurez-vous d’avoir déposé tous vos documents. Une fois le dossier envoyé, nous préparons votre déclaration à partir de ce que vous nous avez transmis.</div>
      <label class="opt" style="margin-top:12px"><input type="checkbox" id="conf"> Je confirme avoir déposé la totalité de mes documents pour l’année ${y}.</label>
      <div class="row" style="margin-top:12px"><button id="back2">Retour aux documents</button><button class="pri" id="send" disabled>Envoyer mon dossier au cabinet</button></div><div class="msg" id="sM"></div></div>`}}
async function listFiles(){const y=$('yr').value;const{data,error}=await sb.storage.from('documents').list(`p/${U.id}/${y}`,{limit:200,sortBy:{column:'name',order:'asc'}});
  FILES=(data||[]).filter(f=>f.name&&f.id);const fl=$('fl');if(!fl)return;
  fl.innerHTML=FILES.length?FILES.map(f=>`<tr><td>${esc(f.name.replace(/^\d+-/,''))}</td><td>${Math.max(1,Math.round((f.metadata?.size||0)/1024))} Ko</td><td><button class="sm danger" data-rm="${esc(f.name)}">Retirer</button></td></tr>`).join(''):'<tr><td colspan="3" class="sub">Aucun document pour l’instant.</td></tr>';
  if(error)$('upM').textContent='Lecture des documents impossible pour le moment.'}
async function upload(list){const y=$('yr').value,M=$('upM');let ok=0,bad=[];M.className='msg';
  for(const f of list){if(f.size>26214400){bad.push(f.name+' (trop gros)');continue}M.textContent=`Envoi de ${f.name}…`;
    const nom=f.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-120);
    const{error}=await sb.storage.from('documents').upload(`p/${U.id}/${y}/${Date.now()}-${nom}`,f,{contentType:f.type||undefined,upsert:false});error?bad.push(f.name):ok++}
  M.textContent=`${ok} document(s) déposé(s).`+(bad.length?` Non déposé(s) : ${bad.join(', ')}.`:'');M.className='msg '+(bad.length?'err':'ok');listFiles()}
async function saveDraft(){const y=+$('yr').value,form={...F};const prof={...(DOS?.profil||{}),...Object.fromEntries(Object.entries(form).filter(([k])=>!['consent','situ','situ_detail','commentaires'].includes(k)&&!k.startsWith('c_')||['c_prenom','c_nom','c_ddn','c_nas','c_revenu','c_client'].includes(k)))};
  const r1=await sb.from('pc_dossiers').upsert({user_id:U.id,courriel:U.email,profil:prof,updated_at:new Date().toISOString()});if(r1.error)throw r1.error;DOS={profil:prof};
  const row={user_id:U.id,annee:y,type:TYPE,formulaire:form,statut:'brouillon',updated_at:new Date().toISOString()};
  const r2=SOU?await sb.from('pc_soumissions').update(row).eq('id',SOU.id).select().single():await sb.from('pc_soumissions').insert(row).select().single();if(r2.error)throw r2.error;SOU=r2.data}

/* ---------- événements ---------- */
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.k&&t.type!=='checkbox'&&t.type!=='radio'&&t.tagName!=='SELECT')F[t.dataset.k]=t.value;if(t.dataset.e!=null&&t.type!=='checkbox'&&t.tagName!=='SELECT'){F.enfants[+t.dataset.e][t.dataset.ek]=t.value}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='yr'){loadYear();return}if(t.id==='conf'){$('send').disabled=!t.checked;return}if(t.id==='files'){upload([...t.files]);t.value='';return}
  if(t.dataset.ks){const s=new Set(F[t.dataset.ks]||[]);t.checked?s.add(t.value):s.delete(t.value);F[t.dataset.ks]=[...s];return}
  if(t.dataset.e!=null){F.enfants[+t.dataset.e][t.dataset.ek]=t.type==='checkbox'?t.checked:t.value;return}
  if(t.dataset.k){F[t.dataset.k]=t.type==='checkbox'?t.checked:t.value;if(t.dataset.k==='c_aucun'&&t.checked)CHG.forEach(([k])=>{if(k!=='c_aucun')F[k]=false});else if(t.dataset.k.startsWith('c_')&&t.checked)F.c_aucun=false;
    if(t.type==='checkbox'||t.type==='radio'||t.tagName==='SELECT'){const y=window.scrollY;render();window.scrollTo(0,y)}}});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.type){TYPE=b.dataset.type;if(TYPE==='existant'&&DOS?.profil)F={...DOS.profil,...F};F.courriel=F.courriel||U.email;steps(1);render();return}
  if(b.id==='chType'){TYPE='';render();return}
  if(b.id==='addE'){F.enfants=[...(F.enfants||[]),{lien:'Enfant',garde:'Exclusive (vit avec moi)'}];render();return}
  if(b.dataset.delE!=null){F.enfants.splice(+b.dataset.delE,1);render();return}
  if(b.id==='next1'){const E=errors();if(E.length){$('fErr').innerHTML=E.slice(0,8).map(esc).join('<br>');return}b.disabled=true;$('sv').textContent='Enregistrement…';
    try{await saveDraft();steps(2);render();window.scrollTo(0,0)}catch(err){$('sv').textContent='Enregistrement impossible : '+(err.message||'réessayez.');b.disabled=false}return}
  if(b.id==='back1'){steps(1);render();return}
  if(b.id==='next2'){if(!FILES.length){$('upM').textContent='Déposez au moins un document.';$('upM').className='msg err';return}steps(3);render();return}
  if(b.id==='back2'){steps(2);render();return}
  if(b.dataset.rm){const{error}=await sb.storage.from('documents').remove([`p/${U.id}/${$('yr').value}/${b.dataset.rm}`]);if(error){$('upM').textContent='Retrait impossible.';return}listFiles();return}
  if(b.id==='send'){b.disabled=true;$('sM').textContent='Envoi…';const fich=FILES.map(f=>({path:`p/${U.id}/${$('yr').value}/${f.name}`,nom:f.name.replace(/^\d+-/,''),taille:f.metadata?.size||0}));
    const{data,error}=await sb.from('pc_soumissions').update({fichiers:fich,statut:'reçue',updated_at:new Date().toISOString()}).eq('id',SOU.id).select().single();
    if(error){$('sM').textContent='Envoi impossible : '+error.message;b.disabled=false;return}SOU=data;render();window.scrollTo(0,0)}});
document.addEventListener('dragover',e=>{const d=e.target.closest?.('#drop');if(d){e.preventDefault();d.classList.add('over')}});
document.addEventListener('dragleave',e=>{e.target.closest?.('#drop')?.classList.remove('over')});
document.addEventListener('drop',e=>{const d=e.target.closest?.('#drop');if(d){e.preventDefault();d.classList.remove('over');upload([...e.dataTransfer.files])}});

async function loadYear(){const y=+$('yr').value;$('view').innerHTML='<div class="card"><p class="sub">Chargement…</p></div>';
  const{data}=await sb.from('pc_soumissions').select('*').eq('user_id',U.id).eq('annee',y).maybeSingle();SOU=data||null;
  F=SOU?{...SOU.formulaire}:{courriel:U.email};TYPE=SOU?.type||'';steps(SOU&&SOU.statut==='brouillon'?1:1);render()}
async function start(){$('auth').hidden=true;$('reset').hidden=true;$('app').hidden=false;$('who').hidden=false;$('whoE').textContent=U.email;
  const{data}=await sb.from('pc_dossiers').select('*').eq('user_id',U.id).maybeSingle();DOS=data;
  const nm=DOS?.profil?.prenom||U.user_metadata?.nom?.split(' ')[0]||'';$('hi').textContent='Bonjour'+(nm?' '+nm:'');
  $('yr').innerHTML=[0,1,2,3].map(i=>Y0-i).map(y=>`<option value="${y}">${y}</option>`).join('');await loadYear()}

/* ---------- connexion ---------- */
let mode='in';const M=(t,e)=>{$('aM').textContent=t;$('aM').className='msg '+(e?'err':'ok')};
function setMode(m){mode=m;$('tIn').setAttribute('aria-pressed',m==='in');$('tNew').setAttribute('aria-pressed',m==='new');$('lNom').hidden=$('lP2').hidden=m!=='new';$('aForgot').hidden=m==='new';$('aGo').textContent=m==='new'?'Créer mon compte':'Se connecter';$('aP').autocomplete=m==='new'?'new-password':'current-password';M('')}
$('tIn').onclick=()=>setMode('in');$('tNew').onclick=()=>setMode('new');
$('aF').onsubmit=async e=>{e.preventDefault();const em=$('aE').value.trim(),pw=$('aP').value;
  if(mode==='new'){if(pw.length<8){M('Le mot de passe doit avoir au moins 8 caractères.',1);return}if(pw!==$('aP2').value){M('Les mots de passe ne correspondent pas.',1);return}
    const{data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{nom:$('aN').value.trim()},emailRedirectTo:location.origin+location.pathname}});
    if(error){M(/registered|exists/i.test(error.message)?'Un compte existe déjà avec ce courriel : connectez-vous.':error.message,1);return}
    if(data.session){U=data.user;start()}else M('Compte créé. Ouvrez le courriel de confirmation que nous venons de vous envoyer, puis revenez vous connecter.');return}
  M('Connexion…');const{data,error}=await sb.auth.signInWithPassword({email:em,password:pw});
  if(error){M(/confirm/i.test(error.message)?'Confirmez d’abord votre courriel avec le lien reçu.':'Courriel ou mot de passe invalide.',1);return}U=data.user;start()};
$('aForgot').onclick=async()=>{const em=$('aE').value.trim();if(!em){M('Entrez votre courriel, puis cliquez de nouveau.',1);return}
  const{error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});M(error?error.message:'Courriel envoyé : suivez le lien pour choisir un nouveau mot de passe.',!!error)};
$('rGo').onclick=async()=>{const pw=$('rP').value;if(pw.length<8){$('rM').textContent='8 caractères au minimum.';return}const{data,error}=await sb.auth.updateUser({password:pw});if(error){$('rM').textContent=error.message;return}U=data.user;start()};
$('out').onclick=()=>sb.auth.signOut().then(()=>location.reload());
sb.auth.onAuthStateChange((ev,s)=>{if(ev==='PASSWORD_RECOVERY'){$('auth').hidden=true;$('app').hidden=true;$('reset').hidden=false}});
(async()=>{if(/type=recovery/.test(location.hash))return;const{data:{session}}=await sb.auth.getSession();if(session){U=session.user;start()}else $('auth').hidden=false})();
})();
