/* Intranet : page d'accueil de l'équipe (Comptabilité, Gestion du cabinet) et Paramètres du cabinet (administrateurs) */
(()=>{
const cfg=window.CONFIG||{},sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let ROLE='membre',MOI='',CAB={};
/* identité du cabinet : une seule source (cc_parametres « cabinet ») */
const CHAMPS=[['nom','Nom légal du cabinet','Boujrad CPA Inc.',1],['neq','NEQ','1234567890'],['ne','Numéro d’entreprise (ARC)','123456789'],['tps','Numéro de TPS','123456789 RT0001',1],['tvq','Numéro de TVQ','1234567890 TQ0001',1],
  ['adresse','Adresse','220-672, boulevard des Laurentides',1],['ville','Ville, province et code postal','Laval (Québec) H7G 2V9',1],['telephone','Téléphone principal','450 000-0000'],['telephone2','Autre téléphone (sans frais, cellulaire…)',''],
  ['courriel','Courriel général','info@boujradcpa.com',1],['courrielFact','Courriel de facturation','admin@boujradcpa.com'],['site','Site Web','boujradcpa.com']];
async function start(s){MOI=s.user.email;const{data:m}=await sb.from('tl_membres').select('role').eq('user_id',s.user.id).maybeSingle();
  $('auth').hidden=true;$('who').hidden=false;$('whoE').textContent=MOI;
  if(!m){$('app').hidden=false;$('home').innerHTML=`<h1>Accès en attente</h1><p class="sub">Le compte ${esc(MOI)} n’est pas encore autorisé. Demandez à l’administrateur du cabinet de vous inviter.</p>`;return}
  ROLE=m.role||'membre';$('app').hidden=false;$('tPar').hidden=ROLE!=='admin';
  const p=MOI.split('@')[0].split(/[._-]/)[0];$('hello').textContent=`Bonjour${p?' '+p.charAt(0).toUpperCase()+p.slice(1):''}`;
  if(location.hash==='#parametres'&&ROLE==='admin')ouvrirPar()}
function vue(par){$('home').hidden=par;$('par').hidden=!par;window.scrollTo(0,0)}
async function ouvrirPar(){if(ROLE!=='admin')return;vue(true);if(location.hash!=='#parametres')history.pushState(null,'','#parametres');
  const{data}=await sb.from('cc_parametres').select('cle,valeur').in('cle',['cabinet','facturation']);const g=k=>(data||[]).find(x=>x.cle===k)?.valeur||{};
  const fac=g('facturation');CAB={tps:fac.tps||'',tvq:fac.tvq||'',courrielFact:fac.courriel||'',...g('cabinet')};
  $('cabF').innerHTML=CHAMPS.map(([k,l,ph,req])=>`<label class="f"><b${req?' class="req"':''}>${l}</b><input data-cab="${k}" value="${esc(CAB[k]||'')}" placeholder="${esc(ph)}"></label>`).join('');
  users()}
$('tPar').onclick=ouvrirPar;$('parBack').onclick=e=>{e.preventDefault();history.pushState(null,'','intranet.html');vue(false)};
window.addEventListener('popstate',()=>{location.hash==='#parametres'&&ROLE==='admin'?ouvrirPar():vue(false)});
$('cabSave').onclick=async()=>{const v={};document.querySelectorAll('[data-cab]').forEach(i=>v[i.dataset.cab]=i.value.trim());
  const manque=CHAMPS.filter(c=>c[3]&&!v[c[0]]).map(c=>c[1]);if(manque.length){$('cabM').textContent='À remplir : '+manque.join(', ');$('cabM').className='msg err';return}
  $('cabSave').disabled=true;$('cabM').className='msg';$('cabM').textContent='Enregistrement…';
  try{const now=new Date().toISOString();let r=await sb.from('cc_parametres').upsert({cle:'cabinet',valeur:v,updated_at:now});if(r.error)throw r.error;
    /* la facturation garde ses propres réglages (Desjardins, Interac…), mais prend les numéros de taxes et le courriel du cabinet */
    const{data:f}=await sb.from('cc_parametres').select('valeur').eq('cle','facturation').maybeSingle();
    r=await sb.from('cc_parametres').upsert({cle:'facturation',valeur:{...(f?.valeur||{}),tps:v.tps,tvq:v.tvq,courriel:v.courrielFact||v.courriel},updated_at:now});if(r.error)throw r.error;
    CAB=v;$('cabM').textContent='✓ Enregistré. Les prochaines factures et les prochains documents utiliseront ces renseignements.'}
  catch(e){$('cabM').className='msg err';$('cabM').textContent='Enregistrement impossible : '+(e.message||e)}finally{$('cabSave').disabled=false}};
/* utilisateurs : membres et invitations */
async function users(){const L=$('usrL');try{const[{data:M,error:e1},{data:I,error:e2}]=await Promise.all([sb.from('tl_membres').select('user_id,email,role').order('email'),sb.from('tl_invitations').select('email,role').order('email')]);if(e1||e2)throw e1||e2;
    const nA=M.filter(m=>m.role==='admin').length,lib=r=>r==='admin'?'CPA (administrateur)':'Technicien';
    L.innerHTML=M.map(m=>`<tr><td>${esc(m.email)}${m.email===MOI?' <span class="sub">(vous)</span>':''}</td><td>${m.role==='admin'&&nA<2?lib(m.role):`<select data-urole="${esc(m.user_id)}"><option value="membre"${m.role!=='admin'?' selected':''}>Technicien</option><option value="admin"${m.role==='admin'?' selected':''}>CPA (administrateur)</option></select>`}</td><td>${m.email!==MOI?`<button class="sm danger" data-uout="${esc(m.user_id)}" data-mail="${esc(m.email)}">Retirer l’accès</button>`:''}</td></tr>`).join('')+
      (I||[]).map(i=>`<tr><td>${esc(i.email)} <span class="pill">invitation en attente</span></td><td>${lib(i.role)}</td><td><button class="sm" data-uinv="${esc(i.email)}">Annuler</button></td></tr>`).join('')}
  catch(e){L.innerHTML=`<tr><td colspan="3">Lecture impossible : ${esc(e.message||e)}</td></tr>`}}
$('usrGo').onclick=async()=>{const m=$('usrMail').value.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)){$('usrM').textContent='Courriel invalide.';return}
  const{error}=await sb.from('tl_invitations').upsert({email:m,role:$('usrRole').value});$('usrM').textContent=error?'Invitation impossible : '+error.message:`✓ ${m} invité.`;if(!error){$('usrMail').value='';users()}};
$('usrL').addEventListener('change',async e=>{const u=e.target.dataset.urole;if(!u)return;const{error}=await sb.from('tl_membres').update({role:e.target.value}).eq('user_id',u);$('usrM').textContent=error?error.message:'✓ Rôle modifié (effectif à sa prochaine connexion).';users()});
$('usrL').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.uout){if(!confirm(`Retirer l’accès de ${b.dataset.mail} à l’intranet?`))return;const{error}=await sb.from('tl_membres').delete().eq('user_id',b.dataset.uout);$('usrM').textContent=error?error.message:'✓ Accès retiré.';users()}
  if(b.dataset.uinv){const{error}=await sb.from('tl_invitations').delete().eq('email',b.dataset.uinv);$('usrM').textContent=error?error.message:'✓ Invitation annulée.';users()}});
$('aF').onsubmit=async e=>{e.preventDefault();$('aM').textContent='Connexion…';const{data,error}=await sb.auth.signInWithPassword({email:$('aE').value.trim(),password:$('aP').value});if(error){$('aM').textContent='Courriel ou mot de passe invalide.';$('aM').className='msg err';return}start(data.session)};
$('out').onclick=()=>sb.auth.signOut().then(()=>location.reload());
(async()=>{const{data:{session}}=await sb.auth.getSession();session?start(session):$('auth').hidden=false})();
})();
