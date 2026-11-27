/* Couche « site web » : remplace les services de Claude par Supabase (connexion, base de données)
   et une fonction serveur qui appelle l'API d'Anthropic. Le logiciel (app.js) ne change pas. */
(function(){
const cfg=window.CONFIG||{};
const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
window.sbClient=sb;
const err=(code,message)=>{const e=new Error(message||code);e.code=code;return e};

/* ---------- base de données (même interface que l'application) ---------- */
const snapDoc=(id,data)=>({id,exists:!!data,data:()=>data||undefined,metadata:{fromCache:false,hasPendingWrites:false}});
function docRef(coll,id){return{id,path:coll+'/'+id,
  async get(){const{data,error}=await sb.from('tl_docs').select('data').eq('coll',coll).eq('id',id).maybeSingle();if(error)throw err('unavailable',error.message);return snapDoc(id,data?data.data:null)},
  async set(d){const{error}=await sb.from('tl_docs').upsert({coll,id,data:d,updated_at:new Date().toISOString()});if(error)throw err(error.code==='54000'?'quota_exceeded':'unavailable',error.message)},
  async update(d){const cur=await this.get();if(!cur.exists)throw err('invalid_argument','document absent');await this.set({...cur.data(),...d})},
  async delete(){const{error}=await sb.from('tl_docs').delete().eq('coll',coll).eq('id',id);if(error)throw err('unavailable',error.message)},
  collection(sub){return collRef(coll+'/'+id+'/'+sub)}}}
function collRef(coll){
  const fetchAll=async()=>{const out=[];let from=0;for(;;){const{data,error}=await sb.from('tl_docs').select('id,data').eq('coll',coll).range(from,from+999);if(error)throw err('unavailable',error.message);out.push(...data);if(data.length<1000)break;from+=1000}
    const docs=out.map(r=>snapDoc(r.id,r.data));return{docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}};
  return{path:coll,
    doc(id){return docRef(coll,id||(crypto.randomUUID?crypto.randomUUID().replace(/-/g,'').slice(0,20):Date.now().toString(36)+Math.random().toString(36).slice(2,10)))},
    async add(d){const r=this.doc();await r.set(d);return r},
    get:fetchAll,
    onSnapshot(next,onErr){let alive=true;const run=()=>fetchAll().then(s=>alive&&next(s)).catch(e=>alive&&onErr&&onErr(e));run();
      const ch=sb.channel('tl-docs-'+coll+'-'+Math.random().toString(36).slice(2)).on('postgres_changes',{event:'*',schema:'public',table:'tl_docs',filter:'coll=eq.'+coll},()=>run()).subscribe();
      const t=setInterval(run,30000);return()=>{alive=false;clearInterval(t);sb.removeChannel(ch)}}}}
const db={collection:collRef,doc:p=>{const k=p.split('/');return docRef(k.slice(0,-1).join('/'),k[k.length-1])}};

/* ---------- IA (via la fonction serveur « ai », la clé reste sur le serveur) ---------- */
const toB64=f=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=ko;r.readAsDataURL(f)});
async function ask(input,opts={}){const prompt=typeof input==='string'?input:input.map(m=>m.content).join('\n\n');
  const images=[];for(const f of opts.images||[])images.push({media_type:f.type||'image/jpeg',data:await toB64(f)});
  const{data,error}=await sb.functions.invoke(cfg.FONCTION_IA||'tl-ai',{body:{prompt,images,tier:opts.modelTier||'default'}});
  if(error){const s=error.context?.status;let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw err(s===429?'rate_limited':s===401||s===403?'not_granted':'unavailable',m)}
  const text=data?.text||'';opts.onText&&opts.onText({text,delta:text});return{text,truncated:!!data?.truncated}}
const sample=(input,opts)=>ask(input,opts);
/* envoi de courriel par la fonction serveur « tl-email » (Resend) */
window.tlFindEmail=async nom=>{const n=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(inc|ltee|ltd|enr|senc)\b\.?/g,'').replace(/[^a-z0-9]+/g,' ').trim();const{data}=await sb.from('cc_clients').select('nom,courriel').not('courriel','is',null);const k=n(nom);const m=(data||[]).find(x=>n(x.nom)===k);return m?.courriel||''};
window.tlFiche=async nom=>{const n=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(inc|ltee|ltd|enr|senc)\b\.?/g,'').replace(/[^a-z0-9]+/g,' ').trim();const{data}=await sb.from('cc_clients').select('*');const k=n(nom);return(data||[]).find(x=>n(x.nom)===k)||null};
window.tlSendEmail=async({to,subject,text,attachments})=>{const{data,error}=await sb.functions.invoke(cfg.FONCTION_COURRIEL||'tl-email',{body:{to,subject,text,attachments}});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data};
sample.json=async(input,opts)=>{const{text}=await ask(input,opts);const t=text.replace(/```json|```/g,'');const i=Math.min(...['{','['].map(c=>{const k=t.indexOf(c);return k<0?1e9:k}));
  const j=Math.max(t.lastIndexOf('}'),t.lastIndexOf(']'));if(i>=1e9||j<i)throw err('unavailable','réponse non JSON');return JSON.parse(t.slice(i,j+1))};
sample.limits=async()=>({images:true});

/* ---------- téléchargements ---------- */
const downloads={async save({filename,data}){const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);return{status:'saved'}}};

/* ---------- dictée (reconnaissance vocale du navigateur : Chrome, Edge) ---------- */
function makeDictation(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return null;let rec=null,state='idle';const H={p:[],f:[],s:[]};
  const setS=(s,reason)=>{state=s;H.s.forEach(h=>h(reason?{state:s,reason}:{state:s}))};
  return{start(o={}){if(rec)return Promise.resolve();rec=new SR();rec.lang=o.language==='fr'||!o.language?'fr-CA':o.language;rec.continuous=true;rec.interimResults=true;
      rec.onresult=e=>{let part='';for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)H.f.forEach(h=>h({text:' '+r[0].transcript.trim()}));else part+=r[0].transcript}H.p.forEach(h=>h({text:part}))};
      rec.onerror=e=>{const r=e.error==='not-allowed'?'not_granted':'upstream_error';rec=null;setS('idle',r)};rec.onend=()=>{if(rec){rec=null;setS('idle','stopped')}};
      setS('starting');rec.start();setS('listening');return Promise.resolve()},
    async stop(){if(rec){const r=rec;rec=null;r.stop();setS('idle','stopped')}},active:()=>state!=='idle',
    onPartial(h){H.p.push(h);return()=>{}},onFinal(h){H.f.push(h);return()=>{}},onState(h){H.s.push(h);return()=>{}}}}

/* ---------- connexion ---------- */
const css=`#auth{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:var(--bg,#f4f6fa);font-family:"Libre Franklin",system-ui,sans-serif}
#auth form{background:var(--panel,#fff);border:1px solid var(--line,#d5deeb);border-radius:12px;padding:28px;width:min(400px,92vw);display:grid;gap:12px}
#auth h1{font-size:26px;margin:0}#auth input{font:inherit;font-size:16px;padding:10px;border:1px solid var(--line,#ccc);border-radius:6px;min-height:44px}
#auth button{font:inherit;font-weight:600;min-height:44px;border-radius:6px;border:1px solid #1f3d6e;background:#1f3d6e;color:#fff;cursor:pointer}#auth .alt{background:transparent;color:#1f3d6e}
#auth .m{font-size:14px;min-height:1em}#auth .e{color:#b3261e}#who{position:relative;z-index:40;font:14px system-ui;display:flex;gap:16px;align-items:center;justify-content:flex-end;padding:13px 24px;background:#0b1626;color:#fff}#who a{color:#fff}#who button{font:inherit;font-size:14px;border:1px solid rgba(255,255,255,.5);color:#fff;background:transparent;border-radius:8px;padding:6px 14px;min-height:34px!important;cursor:pointer;min-height:0;height:auto;line-height:1.4;box-shadow:none}#who .wb{margin-right:auto;font-weight:600;font-size:15px;letter-spacing:.2px;display:flex;align-items:center;gap:12px}#who .wb>span{opacity:.85;border-left:1px solid rgba(255,255,255,.35);padding-left:12px}@media (max-width:640px){#who{gap:10px;padding:12px 14px}#who .wb>span,#whoE{display:none}#who button{padding:4px 10px}}#who .wb i{color:#c99d45;font-style:normal}`;
document.head.insertAdjacentHTML('beforeend',`<style>${css}</style>`);
document.title=cfg.NOM_CABINET||document.title;
function loginUI(){return new Promise(done=>{const d=document.createElement('div');d.id='auth';d.innerHTML=`<form><img src="bcpa-nuit.svg" alt="bCPA." height="34" style="display:block;height:34px;width:auto;margin:0 0 16px"><h1>${(cfg.NOM_CABINET||'Tenue de livres').replace(/</g,'&lt;')}</h1>
  <label>Courriel<br><input type="email" id="aE" required autocomplete="username"></label><label>Mot de passe<br><input type="password" id="aP" autocomplete="current-password"></label>
  <button>Se connecter</button><button type="button" class="alt" id="aNew">Première connexion : créer mon mot de passe</button><button type="button" class="alt" id="aLink">Recevoir un lien de connexion par courriel</button><div class="m" id="aM"></div></form>`;
  document.body.appendChild(d);const M=(t,e)=>{const m=d.querySelector('#aM');m.textContent=t;m.className='m'+(e?' e':'')};const E=()=>d.querySelector('#aE').value.trim(),Pw=()=>d.querySelector('#aP').value;
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();M('Connexion…');const{error}=await sb.auth.signInWithPassword({email:E(),password:Pw()});if(error){const x=(error.message||'').toLowerCase();M(x.includes('not confirmed')?'Courriel pas encore confirmé : cliquez sur le lien reçu de Supabase (vérifiez les pourriels).':x.includes('invalid')?'Courriel ou mot de passe invalide. Première fois ? Cliquez sur « Première connexion ».':'Connexion impossible : '+error.message,1)}else{d.remove();done()}};
  d.querySelector('#aNew').onclick=async()=>{if(!E()||Pw().length<8){M('Entrez votre courriel et un mot de passe d’au moins 8 caractères.',1);return}const{data,error}=await sb.auth.signUp({email:E(),password:Pw()});if(error){M(/registered|exists/i.test(error.message)?'Ce compte existe déjà : cliquez sur « Se connecter ».':'Création impossible : '+error.message,1);return}if(data.session){d.remove();done();return}M('Compte créé. Ouvrez le courriel de confirmation de Supabase (vérifiez les pourriels), cliquez sur le lien, puis revenez cliquer sur « Se connecter ».')};
  d.querySelector('#aLink').onclick=async()=>{if(!E()){M('Entrez votre courriel.',1);return}const{error}=await sb.auth.signInWithOtp({email:E(),options:{emailRedirectTo:location.href.split('#')[0]}});M(error?error.message:'Lien envoyé : ouvrez-le dans ce navigateur.',!!error)};})}
async function boot(){let{data:{session}}=await sb.auth.getSession();if(!session){await loginUI();({data:{session}}=await sb.auth.getSession())}
  const{data:m}=await sb.from('tl_membres').select('role').eq('user_id',session.user.id).maybeSingle();
  window.tlFichiers={
    envoyer:async(path,f)=>{const{error}=await sb.storage.from('documents').upload(path,f,{contentType:f.type||undefined,upsert:false});if(error)throw new Error(error.message);return path},
    lien:async path=>{const{data,error}=await sb.storage.from('documents').createSignedUrl(path,300);if(error)throw new Error(error.message);return data.signedUrl},
    lire:async path=>{const{data,error}=await sb.storage.from('documents').download(path);if(error)throw new Error(error.message);return new Uint8Array(await data.arrayBuffer())},
    retirer:async path=>{const{error}=await sb.storage.from('documents').remove([path]);if(error)throw new Error(error.message)}};
  window.tlRole=m?.role||'membre';window.tlMoi=session.user.email;
  window.tlAdmin={
    membres:async()=>{const{data,error}=await sb.from('tl_membres').select('user_id,email,role,created_at').order('email');if(error)throw new Error(error.message);return data},
    role:async(uid,role)=>{const{error}=await sb.from('tl_membres').update({role}).eq('user_id',uid);if(error)throw new Error(error.message)},
    retirer:async uid=>{const{error}=await sb.from('tl_membres').delete().eq('user_id',uid);if(error)throw new Error(error.message)},
    invitations:async()=>{const{data,error}=await sb.from('tl_invitations').select('email,role,created_at').order('email');if(error)throw new Error(error.message);return data},
    inviter:async(email,role)=>{const{error}=await sb.from('tl_invitations').upsert({email:email.toLowerCase().trim(),role});if(error)throw new Error(error.message)},
    annuler:async email=>{const{error}=await sb.from('tl_invitations').delete().eq('email',email);if(error)throw new Error(error.message)}};
  if(!m){document.body.insertAdjacentHTML('beforeend',`<div id="auth"><form><h1>Accès en attente</h1><p>Le compte ${session.user.email.replace(/</g,'&lt;')} n'est pas encore autorisé. Demandez à l'administrateur du cabinet de l'ajouter aux membres.</p><button type="button" onclick="sbClient.auth.signOut().then(()=>location.reload())">Se déconnecter</button></form></div>`);return}
  document.body.insertAdjacentHTML('afterbegin',`<div id="who"><span class="wb"><svg width="61" height="24" viewBox="0 -2 264 104" aria-label="bCPA." role="img" style="display:block"><path d="M36.800000000000004 101.4Q30.1 101.4 26.5 99.1Q22.900000000000002 96.8 21.200000000000003 94.0H19.400000000000002V100.0H7.0V30.0H19.6V56.099999999999994H21.400000000000002Q22.5 54.3 24.35 52.699999999999996Q26.200000000000003 51.099999999999994 29.250000000000004 50.05Q32.300000000000004 49.0 36.800000000000004 49.0Q42.800000000000004 49.0 47.900000000000006 51.95Q53.0 54.9 56.1 60.599999999999994Q59.2 66.3 59.2 74.4V76.0Q59.2 84.1 56.1 89.8Q53.0 95.5 47.900000000000006 98.45Q42.800000000000004 101.4 36.800000000000004 101.4ZM33.0 90.4Q38.800000000000004 90.4 42.7 86.65Q46.6 82.9 46.6 75.7V74.7Q46.6 67.5 42.75 63.75Q38.900000000000006 60.0 33.0 60.0Q27.200000000000003 60.0 23.300000000000004 63.75Q19.400000000000002 67.5 19.400000000000002 74.7V75.7Q19.400000000000002 82.9 23.300000000000004 86.65Q27.200000000000003 90.4 33.0 90.4ZM94.0 101.4Q81.0 101.4 73.4 94.15Q65.80000000000001 86.9 65.80000000000001 73.4V56.599999999999994Q65.80000000000001 43.099999999999994 73.4 35.849999999999994Q81.0 28.599999999999994 94.0 28.599999999999994Q106.9 28.599999999999994 113.95 35.64999999999999Q121.0 42.699999999999996 121.0 55.0V55.599999999999994H108.0V54.599999999999994Q108.0 48.4 104.55000000000001 44.4Q101.10000000000001 40.4 94.0 40.4Q87.0 40.4 83.0 44.7Q79.0 49.0 79.0 56.4V73.6Q79.0 80.9 83.0 85.25Q87.0 89.6 94.0 89.6Q101.10000000000001 89.6 104.55000000000001 85.55Q108.0 81.5 108.0 75.4V73.6H121.0V75.0Q121.0 87.3 113.95 94.35Q106.9 101.4 94.0 101.4ZM128.8 100.0V30.0H157.60000000000002Q164.20000000000002 30.0 169.25 32.65Q174.3 35.3 177.15000000000003 40.099999999999994Q180.00000000000003 44.9 180.00000000000003 51.5V52.9Q180.00000000000003 59.4 177.05 64.25Q174.10000000000002 69.1 169.05 71.75Q164.00000000000003 74.4 157.60000000000002 74.4H142.00000000000003V100.0ZM142.00000000000003 62.4H156.3Q161.00000000000003 62.4 163.90000000000003 59.8Q166.8 57.199999999999996 166.8 52.699999999999996V51.699999999999996Q166.8 47.199999999999996 163.90000000000003 44.599999999999994Q161.00000000000003 42.0 156.3 42.0H142.00000000000003ZM181.40000000000003 100.0 199.8 30.0H222.8L241.20000000000002 100.0H227.60000000000002L223.8 84.6H198.8L195.00000000000003 100.0ZM201.90000000000003 72.4H220.70000000000002L212.20000000000002 38.3H210.40000000000003Z" fill="#fff"/><rect x="244" y="83" width="17" height="17" rx="3" fill="#c99d45"/></svg><span>Intranet</span></span><a href="centre.html" style="color:inherit">Gestion du cabinet</a><span id="whoE">${session.user.email.replace(/</g,'&lt;')}</span><button type="button" id="logout">Déconnexion</button></div>`);
  document.getElementById('logout').onclick=()=>sb.auth.signOut().then(()=>location.reload());
  const dict=makeDictation();
  window.claude={use:async n=>n==='db'?db:n==='sample'?sample:n==='downloads'?downloads:n==='dictation'?dict:n==='user'?{id:async()=>session.user.id}:null};
  const s=document.createElement('script');s.src='app.js?v='+(window.APP_VERSION||'1');document.body.appendChild(s)}
boot();
})();
