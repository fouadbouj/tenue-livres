/* Gestion du cabinet — sauvegarde complète (fichier ZIP protégé par mot de passe) et restauration */
(()=>{
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ZIPJS='https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.52/dist/zip.min.js';
const load=src=>new Promise((ok,ko)=>{if(window.zip)return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('Chargement de l’outil de compression impossible.'));document.head.appendChild(s)});
/* tables du cabinet, dans l'ordre de restauration (les clients d'abord) */
const TABLES=[['cc_clients','clients'],['cc_contrats','contrats'],['cc_dpa_accords','accords-dpa'],['cc_factures','factures'],['cc_lots_dpa','fichiers-dpa'],['cc_acces','acces-portail'],['cc_publications','documents-publies'],
  ['cc_messages','messages'],['cc_demandes','demandes-documents'],['cc_taches','taches'],['cc_notes','journal'],['cc_echeances','echeances-faites'],['cc_parametres','parametres'],['pc_dossiers','impots-profils'],['pc_soumissions','impots-declarations']];
const RESTORABLE=new Set(['cc_clients','cc_contrats','cc_dpa_accords','cc_factures','cc_lots_dpa','cc_acces','cc_publications','cc_messages','cc_demandes','cc_taches','cc_notes','cc_echeances','cc_parametres']);
const SUBS=['periodes','ecritures','factures','missions','paies','audit'];
const sb=()=>window.CCsb,notify=(m,e)=>window.CCnotify&&window.CCnotify(m,e);
async function all(table){const out=[];for(let f=0;;f+=1000){const{data,error}=await sb().from(table).select('*').range(f,f+999);if(error)throw new Error(`${table} : ${error.message}`);out.push(...data);if(data.length<1000)break}return out}

/* ---------- CSV lisible dans Excel ---------- */
const cell=v=>{if(v==null)return'';if(typeof v==='object')v=JSON.stringify(v);v=String(v);return /[;"\n\r]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};
const csv=(rows,cols)=>{if(!rows.length)return'﻿(aucune donnée)\r\n';cols=cols||[...new Set(rows.flatMap(r=>Object.keys(r)))];return '﻿'+[cols.join(';'),...rows.map(r=>cols.map(c=>cell(r[c])).join(';'))].join('\r\n')+'\r\n'};
const flat=(rows,key)=>rows.map(r=>{const{[key]:obj,...rest}=r;return{...rest,...Object.fromEntries(Object.entries(obj||{}).filter(([,v])=>v==null||typeof v!=='object'||Array.isArray(v)).map(([k,v])=>[key+'.'+k,Array.isArray(v)?JSON.stringify(v):v]))}});
const safe=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w .-]+/g,'_').trim().slice(0,80)||'sans-nom';

/* ---------- comptabilité : reconstruit le format du logiciel comptable et un grand livre lisible ---------- */
function plan(c){return String(c.plan||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/^(\S+)\s+(.*)$/);return m?[m[1],m[2]]:[l,'']})}
function grandLivre(c,sub){const P=plan(c),nom=Object.fromEntries(P),norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
  const find=re=>(P.find(([n,t])=>re.test(norm(t)))||[])[0];const cf=c.cf||find(/COMPTES FOURNISSEURS|FOURNISSEURS A PAYER|COMPTES A PAYER/)||'2100',cc=c.cc||find(/COMPTES CLIENTS|CLIENTS A RECEVOIR|COMPTES A RECEVOIR/)||'1200';
  const E=[];
  (sub.periodes||[]).forEach(({data:p})=>(p.tx||[]).forEach(t=>{const L=[[p.src,t.amt]],g=-t.amt;
    if(t.tax&&t.acct!==c.tr){const gross=Math.abs(g),n0=Math.round(gross/1.14975),tps=Math.round(n0*0.05),tvq=Math.round(n0*0.09975),net=gross-tps-tvq;if(g>0)L.push([t.acct,net],[c.tpsA,tps],[c.tvqA,tvq]);else L.push([t.acct,-net],[c.tpsV,-tps],[c.tvqV,-tvq])}else L.push([t.acct,g]);
    E.push({date:t.date,source:'Relevé '+p.src,ref:'REL'+String(t.date).slice(5).replace('-',''),desc:t.desc,lines:L,note:t.why||''})}));
  (sub.factures||[]).forEach(({data:i})=>{let L=i.type==='achat'?[[i.acct,i.ht],[c.tpsA,i.tps],[c.tvqA,i.tvq],[cf,-i.total]]:[[cc,i.total],[i.acct,-i.ht],[c.tpsV,-i.tps],[c.tvqV,-i.tvq]];L=L.filter(l=>l[1]);const s=L.reduce((a,l)=>a+l[1],0);if(s){const k=L.findIndex(l=>l[0]===i.acct);if(k>=0)L[k][1]-=s}
    E.push({date:i.date,source:i.type==='achat'?'Facture d’achat':'Facture de vente',ref:(i.type==='achat'?'ACH ':'VTE ')+(i.no||''),desc:(i.tiers||'')+(i.desc?' — '+i.desc:''),lines:L})});
  (sub.ecritures||[]).forEach(({data:j})=>E.push({date:j.date,source:j.type==='aje'?'Écriture d’ajustement':'Écriture de journal',ref:j.ref||'JG',desc:j.desc||'',lines:(j.lines||[]).map(l=>[l.a,(l.d||0)-(l.c||0)])}));
  E.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const ex=d=>{const x=(c.ex||[]).find(x=>d>=x.deb&&d<=x.fin);return x?`${x.deb} au ${x.fin}`:''};const $$=v=>(v/100).toFixed(2).replace('.',',');
  const rows=[];E.forEach(e=>e.lines.filter(l=>l[1]).forEach(([a,v])=>rows.push({Date:e.date,Exercice:ex(e.date),Source:e.source,'Référence':e.ref,Description:e.desc,Compte:a,'Nom du compte':nom[a]||'','Débit':v>0?$$(v):'','Crédit':v<0?$$(-v):'',Note:e.note||''})));
  const mv=new Map();E.forEach(e=>e.lines.forEach(([a,v])=>{const k=ex(e.date)+'|'+a;const o=mv.get(k)||{Exercice:ex(e.date),Compte:a,'Nom du compte':nom[a]||'',d:0,c:0};v>0?o.d+=v:o.c-=v;mv.set(k,o)}));
  const mvt=[...mv.values()].sort((x,y)=>x.Exercice.localeCompare(y.Exercice)||String(x.Compte).localeCompare(String(y.Compte),'fr',{numeric:true})).map(o=>({Exercice:o.Exercice,Compte:o.Compte,'Nom du compte':o['Nom du compte'],'Débits':$$(o.d),'Crédits':$$(o.c),'Solde (débit − crédit)':$$(o.d-o.c)}));
  return{gl:csv(rows,['Date','Exercice','Source','Référence','Description','Compte','Nom du compte','Débit','Crédit','Note']),mvt:csv(mvt),plan:csv(P.map(([n,t])=>({Compte:n,Nom:t}))),n:E.length}}

const LISEZMOI=d=>`SAUVEGARDE COMPLÈTE — BOUJRAD CPA INC.
Créée le ${d} depuis Gestion du cabinet (app.boujradcpa.com).

Ce fichier contient des renseignements personnels et confidentiels (NAS, comptes bancaires).
Gardez-le sur un support sûr (disque externe au bureau, OneDrive) et ne l'envoyez jamais par courriel.

CONTENU
1-Gestion-du-cabinet/   Une feuille par sujet (clients, contrats, accords de débits préautorisés, factures,
                        tâches, journal, impôts personnels…), en format CSV : s'ouvre directement dans Excel.
  contrats-signes/      Le texte de chaque contrat envoyé ou signé (s'ouvre dans un navigateur, s'imprime en PDF).
2-Comptabilite/         Pour chaque dossier comptable : le grand livre complet (toutes les écritures, par exercice),
                        les mouvements par compte et par exercice, et le plan comptable. Format CSV pour Excel.
3-Restauration/         Les mêmes données dans un format exact, pour les remettre dans le logiciel :
  comptabilite-dossiers.json   → Logiciel comptable > accueil > « Sauvegarde et transfert » > Importer.
  gestion-du-cabinet.json      → Gestion du cabinet > Sauvegarde > Restaurer.

Les documents déposés par les clients (relevés, factures, pièces) ne sont pas inclus : les clients en ont l'original.

FORMATS
CSV (séparateur point-virgule, UTF-8) : lisible par Excel, LibreOffice, Google Sheets et tout logiciel comptable.
JSON : format ouvert et documenté, lisible par n'importe quel développeur ou outil d'importation.
`;

async function sauvegarder(pw){const d=new Date().toLocaleDateString('fr-CA'),files=[];const add=(n,t)=>files.push([n,t]);const say=t=>{$('svM').textContent=t};
  say('Lecture des données du cabinet…');const G={};for(const[t]of TABLES){G[t]=await all(t)}
  const nomC=id=>G.cc_clients.find(c=>c.id===id)?.nom||'';const withNom=rows=>rows.map(r=>({client:nomC(r.client_id),...r}));
  for(const[t,f]of TABLES){let rows=G[t];
    if(t==='cc_clients')rows=rows.map(({checklist,contacts,...r})=>({...r,contacts:(contacts||[]).map(p=>[p.nom,p.role,p.courriel,p.telephone].filter(Boolean).join(' / ')).join(' | '),ouverture_dossier:Object.entries(checklist||{}).map(([k,v])=>k+' '+v).join(', ')}));
    else if(t==='cc_contrats')rows=withNom(rows.map(({html,...r})=>r));
    else if(t==='cc_lots_dpa')rows=rows.map(({contenu,...r})=>r);
    else if(t==='pc_soumissions')rows=flat(rows,'formulaire');else if(t==='pc_dossiers')rows=flat(rows,'profil');
    else if(rows[0]&&'client_id'in rows[0])rows=withNom(rows);
    add(`1-Gestion-du-cabinet/${f}.csv`,csv(rows))}
  G.cc_contrats.filter(k=>k.html).forEach(k=>add(`1-Gestion-du-cabinet/contrats-signes/${safe(k.numero)} - ${safe(nomC(k.client_id))}.html`,k.signe_le?k.html.replace('</body>',`<p style="border:2px solid #1d7a4f;padding:10px">Accepté électroniquement par ${esc(k.signe_nom)}${k.signe_titre?', '+esc(k.signe_titre):''} le ${new Date(k.signe_le).toLocaleString('fr-CA')}.</p></body>`):k.html));
  say('Lecture de la comptabilité…');const docs=await all('tl_docs');const cl=docs.filter(r=>r.coll==='clients');
  const tl={format:'tenue-livres-v1',date:new Date().toISOString(),clients:cl.map(r=>{const c={id:r.id,data:r.data};SUBS.forEach(s=>c[s]=docs.filter(x=>x.coll===`clients/${r.id}/${s}`).map(x=>({id:x.id,data:x.data})));return c})};
  const pjs=[];tl.clients.forEach(c=>{const g=grandLivre(c.data||{},c),dir=`2-Comptabilite/${safe(c.data?.nom)}`;add(`${dir}/grand-livre.csv`,g.gl);add(`${dir}/mouvements-par-compte-et-exercice.csv`,g.mvt);add(`${dir}/plan-comptable.csv`,g.plan);
    if((c.audit||[]).length)add(`${dir}/piste-de-verification.csv`,csv(c.audit.map(x=>x.data).sort((a,b)=>String(a.le).localeCompare(String(b.le))),['le','qui','quoi','detail']));
    (c.periodes||[]).forEach(({data:p})=>(p.tx||[]).forEach(t=>(t.pj||[]).forEach(f=>pjs.push([`${dir}/pieces-jointes/${t.date} ${safe(t.desc).slice(0,40)} - ${safe(f.n)}`,f.c]))));
    (c.ecritures||[]).forEach(({data:j})=>(j.pj||[]).forEach(f=>pjs.push([`${dir}/pieces-jointes/${j.date} ecriture ${safe(j.ref||'')} - ${safe(f.n)}`,f.c])))});
  const bins=[];if($('svPj')?.checked!==false)for(const[k,[n,c]]of pjs.entries()){say(`Pièces jointes : ${k+1} sur ${pjs.length}…`);try{const{data}=await sb().storage.from('documents').download(c);if(data)bins.push([n,new Uint8Array(await data.arrayBuffer())])}catch(e){}}
  add('3-Restauration/comptabilite-dossiers.json',JSON.stringify(tl));
  add('3-Restauration/gestion-du-cabinet.json',JSON.stringify({format:'boujrad-gestion-v1',date:new Date().toISOString(),tables:Object.fromEntries(Object.entries(G).filter(([t])=>RESTORABLE.has(t)))}));
  add('LISEZMOI.txt',LISEZMOI(d));
  say('Compression et chiffrement…');await load(ZIPJS);zip.configure({useWebWorkers:false});
  const w=new zip.ZipWriter(new zip.BlobWriter('application/zip'),{password:pw,encryptionStrength:3});for(const[n,t]of files)await w.add(n,new zip.TextReader(t));for(const[n,u]of bins)await w.add(n,new zip.Uint8ArrayReader(u));const blob=await w.close();
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Sauvegarde_Boujrad_CPA_${d}.zip`;document.body.appendChild(a);a.click();a.remove();
  await sb().from('cc_parametres').upsert({cle:'sauvegarde',valeur:{date:new Date().toISOString(),par:$('whoE')?.textContent||'',clients:G.cc_clients.length,dossiers:tl.clients.length,taille:blob.size},updated_at:new Date().toISOString()});
  say('');return{clients:G.cc_clients.length,dossiers:tl.clients.length,taille:blob.size}}

async function restaurer(f,pw){await load(ZIPJS);zip.configure({useWebWorkers:false});const r=new zip.ZipReader(new zip.BlobReader(f),{password:pw});const ents=await r.getEntries();
  const e=ents.find(x=>x.filename.endsWith('3-Restauration/gestion-du-cabinet.json'));if(!e)throw new Error('Ce fichier ne contient pas de sauvegarde de Gestion du cabinet.');
  const j=JSON.parse(await e.getData(new zip.TextWriter()));await r.close();if(j.format!=='boujrad-gestion-v1')throw new Error('Format de sauvegarde inconnu.');let n=0;
  for(const t of TABLES.map(x=>x[0]).filter(t=>RESTORABLE.has(t))){const rows=j.tables[t]||[];for(let i=0;i<rows.length;i+=500){const{error}=await sb().from(t).upsert(rows.slice(i,i+500));if(error)throw new Error(`${t} : ${error.message}`)}n+=rows.length;$('rsM').textContent=`Restauration… ${n} ligne(s)`}
  return n}

/* Dossier d'un client qui part : fiche, contrats signés, factures, accord de DPA, échanges du portail */
window.dossierClientZip=async function(c,d){const files=[],add=(n,t)=>files.push([n,t]),nom=safe(c.nom);
  const fiche={...c};delete fiche.checklist;delete fiche.notes;fiche.contacts=(c.contacts||[]).map(p=>[p.nom,p.role,p.courriel,p.telephone].filter(Boolean).join(' / ')).join(' | ');
  add('fiche-client.csv',csv([fiche]));
  (d.contrats||[]).filter(k=>k.html&&k.statut!=='annulé').forEach(k=>add(`contrats/${safe(k.numero)}.html`,k.signe_le?k.html.replace('</body>',`<p style="border:2px solid #1d7a4f;padding:10px">Accepté électroniquement par ${esc(k.signe_nom)}${k.signe_titre?', '+esc(k.signe_titre):''} le ${new Date(k.signe_le).toLocaleString('fr-CA')}.</p></body>`):k.html));
  (d.factures||[]).filter(f=>f.statut!=='annulée').forEach(f=>add(`factures/${safe(f.numero)}.html`,window.FACTURE.factureHtml(f,c)));
  add('factures/liste-des-factures.csv',csv((d.factures||[]).map(({lignes,emetteur,lot_id,...f})=>({...f,description:(lignes||[]).map(l=>l.description).join(' | ')}))));
  if((d.accords||[]).length)add('accord-debits-preautorises.csv',csv(d.accords.map(({compte,specimen,signe_par,...a})=>({...a,compte:'•••'+String(compte).slice(-3)}))));
  if((d.messages||[]).length)add('messages-du-portail.csv',csv(d.messages.map(({fichiers,user_id,...m})=>({...m,fichiers:(fichiers||[]).map(f=>f.nom).join(' | ')}))));
  if((d.publications||[]).length)add('documents-transmis-par-le-cabinet.csv',csv(d.publications.map(({fichiers,...p})=>({...p,fichiers:(fichiers||[]).map(f=>f.nom).join(' | ')}))));
  if((d.demandes||[]).length)add('demandes-de-documents-tps-tvq.csv',csv(d.demandes.map(({jeton,fichiers,...x})=>({...x,fichiers:(fichiers||[]).map(f=>f.nom).join(' | ')}))));
  add('LISEZMOI.txt',`DOSSIER CLIENT — ${c.nom}\nRemis par Boujrad CPA Inc. le ${new Date().toLocaleDateString('fr-CA')}.\n\nfiche-client.csv : coordonnées et renseignements du dossier (Excel).\ncontrats/ : contrats de services (ouvrir dans un navigateur; imprimable en PDF).\nfactures/ : chaque facture (ouvrir dans un navigateur) et la liste complète (Excel).\nLes autres fichiers CSV contiennent l'accord de débits préautorisés, les échanges du portail et les documents transmis.\n\nLa comptabilité (états financiers, rapports et grand livre) est remise dans une archive distincte produite par le logiciel comptable.\n`);
  await load(ZIPJS);zip.configure({useWebWorkers:false});const w=new zip.ZipWriter(new zip.BlobWriter('application/zip'));for(const[n,t]of files)await w.add(`${nom}/${n}`,new zip.TextReader(t));const blob=await w.close();
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Dossier_${nom.replace(/\s+/g,'_')}_${new Date().toLocaleDateString('fr-CA')}.zip`;document.body.appendChild(a);a.click();a.remove()};

window.rSauv=async function(){const{data}=await sb().from('cc_parametres').select('valeur').eq('cle','sauvegarde').maybeSingle();const s=data?.valeur;const jours=s?Math.floor((Date.now()-new Date(s.date))/864e5):null;
  $('tsauv').innerHTML=`<div class="card"><h2>Sauvegarde complète</h2>
    <div class="${!s||jours>31?'alert':'info'}" style="margin-bottom:14px">${s?`<strong>Dernière sauvegarde : ${new Date(s.date).toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'})}</strong> (${jours===0?'aujourd’hui':`il y a ${jours} jour${jours>1?'s':''}`}) · ${s.clients} client(s), ${s.dossiers} dossier(s) comptable(s)${s.par?' · par '+esc(s.par):''}.${jours>31?' Faites-en une nouvelle.':''}`:'<strong>Aucune sauvegarde encore.</strong> Faites la première maintenant.'}</div>
    <p>Un seul fichier ZIP, protégé par mot de passe, qui contient :</p>
    <ul><li><strong>Gestion du cabinet</strong> : clients et leurs coordonnées, contrats (et le texte signé), accords de débits préautorisés, factures, tâches, journal, échéances, déclarations d’impôts personnelles. En <strong>Excel (CSV)</strong>, lisible sans le logiciel.</li>
      <li><strong>Comptabilité</strong> : pour chaque dossier, le <strong>grand livre complet</strong> par exercice, les mouvements par compte, le plan comptable et la piste de vérification, en Excel (CSV), et les pièces jointes.</li>
      <li><strong>Restauration</strong> : les mêmes données en format exact, pour les remettre dans le logiciel ou dans tout autre système.</li></ul>
    <p class="sub" style="font-size:14px">Les documents déposés par les clients ne sont pas inclus : les clients en gardent l’original. Faites une sauvegarde chaque mois et gardez-la sur un disque externe au bureau et dans OneDrive.</p>
    <div class="grid" style="max-width:640px"><label class="f"><b class="req">Mot de passe du fichier</b><input type="password" id="svP" autocomplete="new-password"></label><label class="f"><b class="req">Confirmer le mot de passe</b><input type="password" id="svP2" autocomplete="new-password"></label></div>
    <p class="sub" style="font-size:13px;margin:6px 0 0">12 caractères ou plus. Notez-le sur papier au bureau : sans lui, le fichier ne peut pas être ouvert. Pour ouvrir le fichier sur Windows, utilisez 7-Zip (gratuit, 7-zip.org) : l’Explorateur de Windows ne lit pas les fichiers chiffrés.</p>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="svPj" checked style="width:auto;margin:0"> Inclure les pièces jointes de la comptabilité (factures et reçus joints aux transactions)</label>
    <div class="row" style="margin-top:12px"><button class="pri" id="svGo">Télécharger la sauvegarde complète</button><span class="msg" id="svM"></span></div></div>
  <div class="card"><h2>Restaurer une sauvegarde</h2><p class="sub" style="font-size:14px">Remet les données de Gestion du cabinet à partir d’un fichier de sauvegarde (par exemple dans un nouveau projet). Les lignes existantes portant le même identifiant sont remplacées; rien n’est supprimé. Pour la comptabilité, importez <em>3-Restauration/comptabilite-dossiers.json</em> dans le logiciel comptable (accueil > Sauvegarde et transfert).</p>
    <div class="grid" style="max-width:640px"><label class="f"><b>Fichier de sauvegarde (.zip)</b><input type="file" id="rsF" accept=".zip"></label><label class="f"><b>Mot de passe</b><input type="password" id="rsP" autocomplete="off"></label></div>
    <div class="row" style="margin-top:10px"><button id="rsGo">Restaurer</button><span class="msg" id="rsM"></span></div></div>`};

document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='svGo'){const p=$('svP').value;if(p.length<12){$('svM').textContent='Le mot de passe doit avoir au moins 12 caractères.';$('svM').className='msg err';return}if(p!==$('svP2').value){$('svM').textContent='Les deux mots de passe ne sont pas identiques.';$('svM').className='msg err';return}
    b.disabled=true;$('svM').className='msg';try{const r=await sauvegarder(p);notify(`Sauvegarde téléchargée : ${r.clients} client(s), ${r.dossiers} dossier(s) comptable(s)`);window.rSauv()}catch(err){$('svM').textContent='Sauvegarde impossible : '+(err.message||err);$('svM').className='msg err';notify('Sauvegarde impossible',1)}b.disabled=false;return}
  if(b.id==='rsGo'){const f=$('rsF').files[0];if(!f){$('rsM').textContent='Choisissez le fichier .zip.';return}if(!confirm('Restaurer cette sauvegarde dans Gestion du cabinet? Les fiches portant le même identifiant seront remplacées par la version de la sauvegarde.'))return;
    b.disabled=true;try{const n=await restaurer(f,$('rsP').value);$('rsM').textContent=`${n} ligne(s) restaurée(s).`;notify(`Sauvegarde restaurée : ${n} ligne(s)`)}catch(err){$('rsM').textContent=/password|mot de passe|Invalid/i.test(err.message)?'Mot de passe incorrect.':'Restauration impossible : '+err.message;notify('Restauration impossible',1)}b.disabled=false}});
})();
