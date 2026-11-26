/* Assistant IA de l'intranet : bouton flottant + conversation.
   L'application fournit : ask(prompt) -> texte, contexte() -> texte, guide (actions permises), outils (lecture, exécutés seuls) et actions (modifications, exécutées après confirmation).
   Protocole : l'IA répond en JSON {"message": "...", "outils": [...], "actions": [...]} */
(()=>{
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const css=`#iaBtn{position:fixed;right:22px;bottom:22px;z-index:900;width:56px;height:56px;border-radius:50%;border:0;background:#0b1626;color:#fff;box-shadow:0 8px 26px rgba(11,22,38,.35);cursor:pointer;display:grid;place-items:center;padding:0;min-height:0}
#iaBtn:hover{transform:translateY(-2px)}#iaBtn svg{width:26px;height:26px}#iaBtn .dot{position:absolute;top:6px;right:6px;width:11px;height:11px;border-radius:50%;background:#c99d45;border:2px solid #0b1626}
#iaPan{position:fixed;right:22px;bottom:90px;z-index:901;width:min(440px,calc(100vw - 24px));height:min(640px,calc(100vh - 120px));background:#fff;border:1px solid #dfe3ea;border-radius:16px;box-shadow:0 20px 60px rgba(11,22,38,.28);display:flex;flex-direction:column;overflow:hidden;font:14.5px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b1626}
#iaPan[hidden]{display:none}#iaPan header{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#0b1626;color:#fff}#iaPan header b{font-size:15px}#iaPan header small{opacity:.7;font-size:12px;display:block}
#iaPan header button{margin-left:auto;background:transparent;border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:8px;padding:4px 10px;font-size:12.5px;cursor:pointer;min-height:0}#iaPan header button+button{margin-left:6px}
#iaLog{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f6f7fa}
.iam{max-width:90%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}.iam.me{align-self:flex-end;background:#0b1626;color:#fff;border-bottom-right-radius:4px}.iam.ai{align-self:flex-start;background:#fff;border:1px solid #e3e6ec;border-bottom-left-radius:4px}
.iam.sys{align-self:center;background:transparent;color:#667085;font-size:12.5px;padding:2px}.iact{align-self:stretch;background:#fff;border:1px solid #d7c08a;border-left:4px solid #c99d45;border-radius:10px;padding:10px 12px}
.iact h4{margin:0 0 6px;font-size:14px}.iact table{width:100%;border-collapse:collapse;font-size:13px}.iact td,.iact th{padding:3px 4px;border-bottom:1px solid #eef0f3;text-align:left}.iact .n{text-align:right;white-space:nowrap}
.iact .err{color:#b42318;font-size:13px;margin-top:6px}.iact .row2{display:flex;gap:8px;margin-top:8px;align-items:center}.iact button{border-radius:8px;padding:5px 12px;font-size:13px;cursor:pointer;border:1px solid #0b1626;background:#fff;color:#0b1626;min-height:0}
.iact button.ok{background:#0b1626;color:#fff}.iact .st{font-size:12.5px;font-weight:600}.iact .st.g{color:#067647}.iact .st.r{color:#b42318}
#iaSug{display:flex;flex-wrap:wrap;gap:6px}#iaSug button{background:#fff;border:1px solid #d0d5dd;border-radius:999px;padding:5px 10px;font-size:12.5px;cursor:pointer;color:#0b1626;min-height:0;text-align:left}
#iaF{display:flex;gap:8px;padding:10px;border-top:1px solid #e3e6ec;background:#fff;align-items:stretch;margin:0}#iaPan #iaIn{flex:1;resize:none;height:46px!important;min-height:0!important;max-height:140px;border:1px solid #d0d5dd!important;border-radius:10px;padding:11px 12px;font:inherit;font-size:14.5px;box-shadow:none;outline-offset:0}
#iaPan #iaGo{border:0;border-radius:10px;background:#0b1626;color:#fff;padding:0 16px;cursor:pointer;font-weight:600;font-size:14px;min-height:0!important;height:46px!important}#iaGo:disabled{opacity:.5}
.iadots{display:inline-flex;gap:4px}.iadots i{width:6px;height:6px;border-radius:50%;background:#98a2b3;animation:iab 1s infinite}.iadots i:nth-child(2){animation-delay:.15s}.iadots i:nth-child(3){animation-delay:.3s}@keyframes iab{0%,80%{opacity:.3}40%{opacity:1}}
@media print{#iaBtn,#iaPan{display:none!important}}`;
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18.5 9.4 13.8 11.2 12 16 10.2 11.2 5.5 9.4 10.2 7.6z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>';

let A=null,LOG=[],BUSY=false;
const key=()=>'ia-'+(A?.id||'x');
const save=()=>{try{sessionStorage.setItem(key(),JSON.stringify(LOG.slice(-40)))}catch(e){}};
const load=()=>{try{LOG=JSON.parse(sessionStorage.getItem(key())||'[]')}catch(e){LOG=[]}};
const $=id=>document.getElementById(id);

function render(){const l=$('iaLog');if(!l)return;
  l.innerHTML=(LOG.length?'':`<div class="iam ai">${esc(A.accueil)}</div><div id="iaSug">${A.exemples.map(x=>`<button type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>`)+
   LOG.map((m,i)=>m.r==='me'?`<div class="iam me">${esc(m.t)}</div>`:m.r==='tool'?`<div class="iam sys">🔍 ${esc((m.t.match(/(\d+) résultat/)||[])[1]?m.t.match(/(\d+) résultat/)[1]+' résultat(s) trouvé(s)':'Recherche effectuée')}</div>`:m.r==='sys'?`<div class="iam sys">${esc(m.t)}</div>`:m.r==='act'?carte(m,i):`<div class="iam ai">${esc(m.t)}</div>`).join('')+
   (BUSY?'<div class="iam ai"><span class="iadots"><i></i><i></i><i></i></span></div>':'');l.scrollTop=1e6}
function carte(m,i){const d=A.actions[m.a.type];let prev='',err='';try{const v=d.verifier?d.verifier(m.a):null;if(v)err=v;prev=d.apercu(m.a)}catch(e){err=e.message}
  return `<div class="iact"><h4>${esc(d.titre(m.a))}</h4>${prev}${err?`<div class="err">${esc(err)}</div>`:''}<div class="row2">${m.s==='ok'?`<span class="st g">✓ ${esc(m.res||'Fait')}</span>`:m.s==='no'?'<span class="st r">Annulé</span>':m.s==='err'?`<span class="st r">${esc(m.res)}</span>`:m.s==='run'?'<span class="st">En cours…</span>':err?`<button type="button" data-no="${i}">Ignorer</button>`:`<button type="button" class="ok" data-ok="${i}">Confirmer</button><button type="button" data-no="${i}">Annuler</button>`}</div></div>`}

function prompt(extra){const h=LOG.filter(m=>m.r!=='sys').slice(-24).map(m=>m.r==='me'?'Utilisateur : '+m.t:m.r==='act'?`(Action proposée ${m.a.type} — ${m.s==='ok'?'confirmée et exécutée : '+(m.res||''):m.s==='no'?'refusée':m.s==='err'?'échouée : '+m.res:'en attente'})`:m.r==='tool'?'Résultat de recherche :\n'+m.t:'Assistant : '+m.t).join('\n');
  return `Tu es l'assistant IA de Boujrad CPA Inc. (cabinet comptable au Québec) dans ${A.nom}. Date du jour : ${new Date().toLocaleDateString('fr-CA')}.
Tu aides l'équipe en français québécois professionnel, de façon brève et précise. Tu peux répondre aux questions, chercher des données et proposer des actions.

${A.guide}

RÈGLES
- Réponds UNIQUEMENT avec un objet JSON : {"message":"texte court pour l'utilisateur","outils":[...],"actions":[...]}. Les tableaux peuvent être vides.
- "outils" : recherches en lecture seule. Elles sont exécutées tout de suite et leurs résultats te sont renvoyés : n'écris alors qu'un court message d'attente. N'utilise un outil que si l'information n'est pas déjà dans le contexte.
- "actions" : modifications. Elles ne sont exécutées qu'après la confirmation de l'utilisateur; dans "message", résume ce que tu proposes.
- N'invente jamais un compte, un client, une transaction ou un identifiant : utilise seulement ceux du contexte ou des résultats de recherche. S'il manque une information, pose la question sans proposer d'action.
- Les montants sont en dollars avec un point décimal (ex. 1234.56).

CONTEXTE ACTUEL
${extra.contexte}

CONVERSATION
${h}`}

async function tour(){BUSY=true;render();$('iaGo').disabled=true;
  try{for(let k=0;k<4;k++){const ctx=await A.contexte();const r=await A.ask(prompt({contexte:ctx}));
      const outils=Array.isArray(r?.outils)?r.outils:[],actions=Array.isArray(r?.actions)?r.actions:[];
      if(outils.length&&k<3){const res=[];for(const o of outils.slice(0,3)){const f=A.outils[o?.type];res.push(f?await f(o).catch(e=>'Erreur : '+e.message):'Outil inconnu : '+o?.type)}
        if(r.message)LOG.push({r:'sys',t:r.message});LOG.push({r:'tool',t:res.join('\n\n').slice(0,40000)});render();continue}
      if(r?.message)LOG.push({r:'ai',t:String(r.message)});
      for(const a of actions){if(!a||!A.actions[a.type])continue;if(A.actions[a.type].auto){try{const res=await A.actions[a.type].executer(a);LOG.push({r:'sys',t:res||'Fait'})}catch(e){LOG.push({r:'sys',t:'Impossible : '+e.message})}}else{try{if(A.actions[a.type].capture)a._avant=A.actions[a.type].capture(a)}catch(e){}LOG.push({r:'act',a,s:''})}}
      break}}
  catch(e){LOG.push({r:'ai',t:'Je n’ai pas pu répondre ('+(e.message||'erreur')+'). Réessayez dans un instant.'})}
  BUSY=false;save();render();$('iaGo').disabled=false;$('iaIn').focus()}

function envoyer(t){t=String(t||'').trim();if(!t||BUSY)return;LOG.push({r:'me',t});$('iaIn').value='';tour()}

function init(cfg){A={exemples:[],outils:{},actions:{},accueil:'Bonjour! Que puis-je faire pour vous?',...cfg};load();
  if(!$('iaBtn')){const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend',`<button id="iaBtn" type="button" aria-label="Assistant IA" title="Assistant IA">${ICON}</button>
    <section id="iaPan" hidden role="dialog" aria-label="Assistant IA"><header>${ICON.replace('<svg','<svg width="20" height="20"')}<div><b>Assistant IA</b><small id="iaSub"></small></div><button type="button" id="iaNew">Nouvelle conversation</button><button type="button" id="iaX" aria-label="Fermer">✕</button></header>
    <div id="iaLog"></div><form id="iaF"><textarea id="iaIn" placeholder="Demandez quelque chose…" aria-label="Message à l’assistant"></textarea><button id="iaGo">Envoyer</button></form></section>`);
    $('iaBtn').onclick=()=>{const p=$('iaPan');p.hidden=!p.hidden;if(!p.hidden){render();$('iaIn').focus()}};
    $('iaX').onclick=()=>{$('iaPan').hidden=true};
    $('iaNew').onclick=()=>{if(BUSY)return;LOG=[];save();render()};
    $('iaF').onsubmit=e=>{e.preventDefault();envoyer($('iaIn').value)};
    $('iaIn').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();envoyer($('iaIn').value)}};
    $('iaLog').onclick=async e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.ex){envoyer(b.dataset.ex);return}
      if(b.dataset.no){LOG[+b.dataset.no].s='no';save();render();return}
      if(b.dataset.ok){const m=LOG[+b.dataset.ok];m.s='run';render();try{m.res=await A.actions[m.a.type].executer(m.a)||'Fait';m.s='ok'}catch(err){m.res='Impossible : '+(err.message||err);m.s='err'}save();render()}}}
  $('iaSub').textContent=A.nom;render()}
window.ASSISTANT={init,refresh:()=>render()};
})();
