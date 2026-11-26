/* Portail client — questionnaires de service (lien reçu par courriel : portail.html?service=JETON) */
(()=>{
const $=id=>document.getElementById(id);
const notify=(m,err)=>{let t=$('ntf');if(!t){t=document.createElement('div');t.id='ntf';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=(err?'':'✓ ')+m;t.className=(err?'err ':'')+'on';clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),4500)};
const safe=n=>n.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-120);
const dl=x=>x?new Date(x).toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}):'';
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
let sb,U,esc,L=[],CUR=null,R={},F=[],DIRTY=false,timer=null;

// Le lien du courriel : on garde le jeton le temps que la personne se connecte ou crée son compte (même après la confirmation du courriel)
const qs=new URLSearchParams(location.search).get('service');
if(qs){store.set('svc-jeton',qs);history.replaceState(null,'',location.pathname)}
const jetonAttente=store.get('svc-jeton');
if(jetonAttente&&$('aS')){$('aT').textContent='Votre questionnaire';$('aS').textContent='Pour remplir votre questionnaire et déposer vos documents en toute sécurité, connectez-vous ou créez votre compte avec votre adresse courriel.'}

const box=()=>{let b=$('svc');if(!b){b=document.createElement('div');b.id='svc';$('hi').after(b)}return b};
const autres=v=>{['space','perso','ent'].forEach(id=>{const e=$(id);if(!e)return;if(v){e.style.display=''}else e.style.display='none'})};

document.addEventListener('portail-pret',async()=>{({sb,U,esc}=window.PORTAIL);let ouvrir=null;
  const j=store.get('svc-jeton');if(j){store.set('svc-jeton',null);const{data,error}=await sb.rpc('pc_service_ouvrir',{p_jeton:j});
    if(error)box().innerHTML=`<div class="card"><p class="msg err">Ce lien de questionnaire n’est plus valide ou a déjà été ouvert avec un autre compte. Écrivez-nous pour en recevoir un nouveau.</p></div>`;else ouvrir=data}
  await charger();if(ouvrir)ouvrirQ(ouvrir);else liste()});

async function charger(){const{data}=await sb.from('cc_services').select('*').eq('user_id',U.id).order('created_at',{ascending:false});L=data||[]}
function liste(){CUR=null;autres(true);const o=L.filter(s=>['envoyée','en cours'].includes(s.statut)),r=L.filter(s=>['reçue','traitée'].includes(s.statut)&&(Date.now()-new Date(s.recu_le||s.updated_at))/864e5<60);
  box().innerHTML=o.length||r.length?`<div class="card" style="border:2px solid ${o.length?'var(--gold)':'var(--line)'}"><h2 style="margin-top:0">${o.length?'Questionnaire'+(o.length>1?'s':'')+' à remplir':'Vos questionnaires'}</h2>
    ${o.map(s=>`<div class="row" style="justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--line)"><div><strong>${esc(s.titre)}</strong><br><small class="sub">Reçu le ${dl(s.created_at)}${s.statut==='en cours'&&Object.keys(s.reponses||{}).length?' · commencé':''}</small></div><button class="pri" data-svc="${s.id}">${Object.keys(s.reponses||{}).length?'Continuer':'Remplir'}</button></div>`).join('')}
    ${r.map(s=>`<div style="padding:8px 0;border-top:1px solid var(--line)"><strong>${esc(s.titre)}</strong> <span class="pill ok">Envoyé le ${dl(s.recu_le)}</span></div>`).join('')}</div>`:''}

function ouvrirQ(id){const s=L.find(x=>x.id===id);if(!s)return liste();CUR=s;R={...(s.reponses||{})};F=[...(s.fichiers||[])];DIRTY=false;
  const q=window.QUEST.liste[s.service];if(!q){box().innerHTML='<div class="card"><p class="msg err">Questionnaire inconnu.</p></div>';return}
  // une personne au départ dans les listes requises
  window.QUEST.sections(s.service).forEach(sec=>sec.c.forEach(x=>{if(x.t==='rep'&&x.min&&!(R[x.k]||[]).length)R[x.k]=[{}]}));
  if(!R.courriel&&window.QUEST.sections(s.service).some(sec=>sec.c.some(x=>x.k==='courriel')))R.courriel=U.email;
  autres(false);dessine();window.scrollTo(0,0)}
function dessine(){const s=CUR,q=window.QUEST.liste[s.service],y=window.scrollY,ferme=!['envoyée','en cours'].includes(s.statut);
  if(ferme){box().innerHTML=`<div class="card"><button class="sm" data-svcret>← Retour</button><h2>${esc(s.titre)}</h2><div class="info" style="font-size:16px"><strong>Merci!</strong> Votre questionnaire a été envoyé le ${dl(s.recu_le)}. Nous communiquerons avec vous si un renseignement manque.</div></div>`;return}
  box().innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><button class="sm" data-svcret>← Retour à mon portail</button><span class="msg" id="qSv"></span></div>
    <h2 style="margin-bottom:4px">${esc(q.nom)}</h2><p class="sub" style="margin-top:0">${esc(q.intro)} Les champs marqués d’un astérisque sont requis. Vos réponses sont enregistrées automatiquement : vous pouvez revenir terminer plus tard.</p>
    ${window.QUEST.formHtml(s.service,R,F,esc)}
    <div class="msg err" id="qErr" style="margin-top:12px"></div>
    <div class="row" style="margin-top:14px"><button class="pri" id="qSend">Envoyer au cabinet</button><button id="qSave">Enregistrer et terminer plus tard</button></div></div>`;window.scrollTo(0,y)}

async function sauver(envoyer){if(!CUR)return;clearTimeout(timer);const{error}=await sb.rpc('pc_service_enregistrer',{p_id:CUR.id,p_reponses:R,p_fichiers:F,p_envoyer:!!envoyer});
  if(error){const m=$('qSv');if(m){m.textContent='Enregistrement impossible';m.className='msg err'}throw error}DIRTY=false;CUR.reponses=R;CUR.fichiers=F;
  const m=$('qSv');if(m){m.textContent='Enregistré';m.className='msg ok'}}
const plusTard=()=>{DIRTY=true;clearTimeout(timer);timer=setTimeout(()=>sauver(false).catch(()=>{}),1500)};

async function deposer(k,files){const m=$('qSv');for(const f of files){if(f.size>26214400){notify(f.name+' : trop gros (25 Mo au maximum)',1);continue}
    if(m){m.textContent='Envoi de '+f.name+'…';m.className='msg'}const path=`s/${CUR.id}/${k}/${Date.now()}-${safe(f.name)}`;
    const{error}=await sb.storage.from('documents').upload(path,f,{contentType:f.type||undefined});if(error){notify(f.name+' : envoi impossible',1);continue}F.push({doc:k,path,nom:f.name,taille:f.size})}
  dessine();await sauver(false).catch(()=>{})}

document.addEventListener('input',e=>{const t=e.target;if(!CUR||!t.closest('#svc'))return;
  if(t.dataset.q&&t.type!=='checkbox'&&t.type!=='radio'&&t.tagName!=='SELECT'){R[t.dataset.q]=t.value;plusTard()}
  if(t.dataset.qr&&t.type!=='radio'&&t.tagName!=='SELECT'){R[t.dataset.qr][+t.dataset.i][t.dataset.qk]=t.value;plusTard()}});
document.addEventListener('change',e=>{const t=e.target;if(!CUR||!t.closest('#svc'))return;
  if(t.dataset.qfile){deposer(t.dataset.qfile,[...t.files]);t.value='';return}
  if(t.dataset.q){R[t.dataset.q]=t.type==='checkbox'?t.checked:t.value;if(t.type==='checkbox'||t.type==='radio'||t.tagName==='SELECT')dessine();plusTard()}
  if(t.dataset.qr){R[t.dataset.qr][+t.dataset.i][t.dataset.qk]=t.value;plusTard()}});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!b.closest('#svc'))return;
  if(b.dataset.svc){ouvrirQ(b.dataset.svc);return}
  if(b.hasAttribute('data-svcret')){if(DIRTY)await sauver(false).catch(()=>{});await charger();liste();window.scrollTo(0,0);return}
  if(b.dataset.qadd){(R[b.dataset.qadd]=R[b.dataset.qadd]||[]).push({});dessine();plusTard();return}
  if(b.dataset.qdel){const[k,i]=b.dataset.qdel.split('|');R[k].splice(+i,1);dessine();plusTard();return}
  if(b.dataset.qrm){await sb.storage.from('documents').remove([b.dataset.qrm]);F=F.filter(y=>y.path!==b.dataset.qrm);dessine();sauver(false).catch(()=>{});return}
  if(b.id==='qSave'){try{await sauver(false);notify('Vos réponses sont enregistrées. Vous pourrez terminer plus tard.')}catch(err){notify('Enregistrement impossible : '+err.message,1)}return}
  if(b.id==='qSend'){const E=window.QUEST.erreurs(CUR.service,R,F);if(E.length){$('qErr').innerHTML=E.slice(0,10).map(esc).join('<br>');$('qErr').scrollIntoView({block:'center'});return}
    b.disabled=true;try{await sauver(true)}catch(err){$('qErr').textContent='Envoi impossible : '+err.message;b.disabled=false;return}
    sb.functions.invoke(window.CONFIG?.FONCTION_AVIS||'cc-avis',{body:{action:'service',service_id:CUR.id}}).catch(()=>{});
    CUR.statut='reçue';CUR.recu_le=new Date().toISOString();await charger();dessine();window.scrollTo(0,0);notify('Questionnaire envoyé à Boujrad CPA Inc. Merci!')}});
window.addEventListener('beforeunload',()=>{if(DIRTY&&CUR)sauver(false).catch(()=>{})});
})();
