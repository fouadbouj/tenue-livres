// Bouton « Guide » de l'équipe : le contenu est demandé à la fonction serveur « guide », réservée aux membres connectés.
(function(){
const nom=/centre\.html/.test(location.pathname)?'gestion':'compta';
const css=`#gdOv{position:fixed;inset:0;background:rgba(11,22,38,.45);z-index:2000;display:flex;justify-content:flex-end}#gdP{background:#fff;width:min(760px,100%);height:100%;overflow:auto;padding:26px 30px 60px;font:15px/1.6 system-ui,sans-serif;color:#1b2430;box-shadow:-8px 0 30px rgba(0,0,0,.2)}#gdP h1{font-size:22px;margin:0 0 4px}#gdP h2{font-size:17px;margin:26px 0 8px;padding-top:10px;border-top:1px solid #e6e8ec}#gdP .et{padding-left:22px}#gdP .et li{margin:6px 0}#gdP .truc{background:#fbf6ea;border-left:3px solid #c99d45;padding:10px 14px;border-radius:6px;margin:10px 0}#gdP .som{background:#f4f6f9;border-radius:8px;padding:10px 16px;columns:2;font-size:14px}#gdP .som a{color:#1f3b63}#gdP .x{float:right;border:1px solid #ccd;background:#fff;border-radius:8px;padding:5px 12px;cursor:pointer}#gdP input{width:100%;padding:8px 10px;border:1px solid #ccd;border-radius:8px;margin:12px 0;font:inherit}@media(max-width:640px){#gdP{padding:18px}#gdP .som{columns:1}}`;
async function ouvrir(){
  if(!document.getElementById('gdCss'))document.head.insertAdjacentHTML('beforeend',`<style id="gdCss">${css}</style>`);
  document.body.insertAdjacentHTML('beforeend',`<div id="gdOv"><div id="gdP" role="dialog" aria-label="Guide"><button class="x" id="gdX">Fermer ✕</button><p>Chargement du guide…</p></div></div>`);
  const ov=document.getElementById('gdOv'),P=document.getElementById('gdP'),fermer=()=>ov.remove();
  ov.onclick=e=>{if(e.target===ov||e.target.id==='gdX')fermer()};
  document.addEventListener('keydown',function k(e){if(e.key==='Escape'){fermer();document.removeEventListener('keydown',k)}});
  try{
    if(!window.tlGuideFn)throw new Error('connectez-vous d’abord');
    const{data,error}=await window.tlGuideFn(nom);
    if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}
    if(data?.error)throw new Error(data.error);
    const tmp=document.createElement('div');tmp.innerHTML=data.html;
    const som=[...tmp.querySelectorAll('section')].map(s=>`<li><a href="#" data-gd="${s.id}">${s.querySelector('h2').textContent}</a></li>`).join('');
    P.innerHTML=`<button class="x" id="gdX">Fermer ✕</button><h1>${data.titre}</h1><p style="color:#5a6472;margin:0">Réservé à l’équipe du cabinet. Mis à jour avec le logiciel.</p><input id="gdQ" placeholder="Chercher dans le guide (ex. relevé, conciliation, trousse)…"><ul class="som">${som}</ul><div id="gdC">${data.html}</div>`;
    P.querySelectorAll('[data-gd]').forEach(a=>a.onclick=e=>{e.preventDefault();P.querySelector('#'+a.dataset.gd).scrollIntoView({behavior:'smooth'})});
    P.querySelector('#gdQ').oninput=e=>{const q=e.target.value.trim().toLowerCase();P.querySelectorAll('#gdC section').forEach(s=>s.hidden=q&&!s.textContent.toLowerCase().includes(q))};
  }catch(e){P.innerHTML=`<button class="x" id="gdX">Fermer ✕</button><p>Le guide n’a pas pu s’ouvrir : ${String(e.message||e).replace(/</g,'&lt;')}</p>`}
}
function bouton(){
  const w=document.getElementById('who');if(!w||w.hidden||document.getElementById('gdB'))return;
  const b=document.createElement('button');b.type='button';b.id='gdB';b.textContent='Guide';b.title='Guide d’utilisation (équipe)';b.onclick=ouvrir;
  const out=w.querySelector('#logout,#out');out?w.insertBefore(b,out):w.appendChild(b);
}
new MutationObserver(bouton).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
window.tlOuvrirGuide=ouvrir;
})();
