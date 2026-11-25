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
  if(error){const s=error.context?.status;throw err(s===429?'rate_limited':s===401||s===403?'not_granted':'unavailable',error.message)}
  const text=data?.text||'';opts.onText&&opts.onText({text,delta:text});return{text,truncated:!!data?.truncated}}
const sample=(input,opts)=>ask(input,opts);
/* envoi de courriel par la fonction serveur « tl-email » (Resend) */
window.tlSendEmail=async({to,subject,text})=>{const{data,error}=await sb.functions.invoke(cfg.FONCTION_COURRIEL||'tl-email',{body:{to,subject,text}});if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data};
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
#auth .m{font-size:14px;min-height:1em}#auth .e{color:#b3261e}#who{position:fixed;top:8px;right:12px;z-index:40;font:13px system-ui;display:flex;gap:8px;align-items:center}#who button{font:inherit;font-size:13px;border:1px solid currentColor;background:transparent;border-radius:6px;padding:4px 10px;cursor:pointer}`;
document.head.insertAdjacentHTML('beforeend',`<style>${css}</style>`);
document.title=cfg.NOM_CABINET||document.title;
function loginUI(){return new Promise(done=>{const d=document.createElement('div');d.id='auth';d.innerHTML=`<form><img src="favicon.svg" alt="" width="48" height="48" style="display:block;margin:0 0 14px"><h1>${(cfg.NOM_CABINET||'Tenue de livres').replace(/</g,'&lt;')}</h1>
  <label>Courriel<br><input type="email" id="aE" required autocomplete="username"></label><label>Mot de passe<br><input type="password" id="aP" autocomplete="current-password"></label>
  <button>Se connecter</button><button type="button" class="alt" id="aNew">Première connexion : créer mon mot de passe</button><button type="button" class="alt" id="aLink">Recevoir un lien de connexion par courriel</button><div class="m" id="aM"></div></form>`;
  document.body.appendChild(d);const M=(t,e)=>{const m=d.querySelector('#aM');m.textContent=t;m.className='m'+(e?' e':'')};const E=()=>d.querySelector('#aE').value.trim(),Pw=()=>d.querySelector('#aP').value;
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();M('Connexion…');const{error}=await sb.auth.signInWithPassword({email:E(),password:Pw()});if(error){const x=(error.message||'').toLowerCase();M(x.includes('not confirmed')?'Courriel pas encore confirmé : cliquez sur le lien reçu de Supabase (vérifiez les pourriels).':x.includes('invalid')?'Courriel ou mot de passe invalide. Première fois ? Cliquez sur « Première connexion ».':'Connexion impossible : '+error.message,1)}else{d.remove();done()}};
  d.querySelector('#aNew').onclick=async()=>{if(!E()||Pw().length<8){M('Entrez votre courriel et un mot de passe d’au moins 8 caractères.',1);return}const{data,error}=await sb.auth.signUp({email:E(),password:Pw()});if(error){M(/registered|exists/i.test(error.message)?'Ce compte existe déjà : cliquez sur « Se connecter ».':'Création impossible : '+error.message,1);return}if(data.session){d.remove();done();return}M('Compte créé. Ouvrez le courriel de confirmation de Supabase (vérifiez les pourriels), cliquez sur le lien, puis revenez cliquer sur « Se connecter ».')};
  d.querySelector('#aLink').onclick=async()=>{if(!E()){M('Entrez votre courriel.',1);return}const{error}=await sb.auth.signInWithOtp({email:E(),options:{emailRedirectTo:location.href.split('#')[0]}});M(error?error.message:'Lien envoyé : ouvrez-le dans ce navigateur.',!!error)};})}
async function boot(){let{data:{session}}=await sb.auth.getSession();if(!session){await loginUI();({data:{session}}=await sb.auth.getSession())}
  const{data:m}=await sb.from('tl_membres').select('role').eq('user_id',session.user.id).maybeSingle();
  if(!m){document.body.insertAdjacentHTML('beforeend',`<div id="auth"><form><h1>Accès en attente</h1><p>Le compte ${session.user.email.replace(/</g,'&lt;')} n'est pas encore autorisé. Demandez à l'administrateur du cabinet de l'ajouter aux membres.</p><button type="button" onclick="sbClient.auth.signOut().then(()=>location.reload())">Se déconnecter</button></form></div>`);return}
  document.body.insertAdjacentHTML('beforeend',`<div id="who"><a href="centre.html" style="color:inherit">Gestion du cabinet</a><span>${session.user.email.replace(/</g,'&lt;')}</span><button type="button" id="logout">Déconnexion</button></div>`);
  document.getElementById('logout').onclick=()=>sb.auth.signOut().then(()=>location.reload());
  const dict=makeDictation();
  window.claude={use:async n=>n==='db'?db:n==='sample'?sample:n==='downloads'?downloads:n==='dictation'?dict:n==='user'?{id:async()=>session.user.id}:null};
  const s=document.createElement('script');s.src='app.js?v='+(window.APP_VERSION||'1');document.body.appendChild(s)}
boot();
})();
