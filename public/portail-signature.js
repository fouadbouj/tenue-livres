/* Portail client : lire et signer électroniquement un document déposé par le cabinet (ex. procuration MR-69) */
(()=>{const $=id=>document.getElementById(id);const P=()=>window.PORTAIL||{};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load=src=>new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('chargement impossible'));document.head.appendChild(s)});
async function libs(){const V='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';if(!window.pdfjsLib){await load(V+'pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc=V+'pdf.worker.min.js'}if(!window.PDFLib)await load('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js')}
const sha=async u8=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',u8))].map(b=>b.toString(16).padStart(2,'0')).join('');
let ST=null;
async function ouvrir(id){const{sb}=P();const{data:p,error}=await sb.from('cc_publications').select('*').eq('id',id).maybeSingle();if(error||!p){alert('Document introuvable.');return}
  const f=(p.fichiers||[]).find(x=>/\.pdf$/i.test(x.nom||x.path))||(p.fichiers||[])[0];if(!f){alert('Aucun fichier à signer.');return}
  let d=$('sigDlg');if(!d){d=document.createElement('dialog');d.id='sigDlg';d.style.cssText='width:min(860px,calc(100% - 20px));max-height:94vh;border:0;border-radius:16px;padding:20px;overflow:auto';document.body.appendChild(d)}
  d.innerHTML=`<h2 style="margin:0 0 4px">Signer : ${esc(p.titre)}</h2><p class="sub" style="margin:0 0 10px">1. Lisez le document. 2. Cliquez sur la page à l’endroit où signer (la case de signature). 3. Signez et confirmez.</p>
    <div id="sgPages" style="display:grid;gap:12px;background:var(--soft,#f1f4f9);padding:10px;border-radius:12px;max-height:52vh;overflow:auto"><p class="sub">Chargement du document…</p></div>
    <p class="sub" id="sgPos" style="margin:8px 0">Aucun emplacement choisi : la signature sera placée au bas de la dernière page.</p>
    <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f"><b>Votre nom complet</b><input id="sgNom" autocomplete="name"></label><label class="f"><b>Titre ou qualité (si vous signez pour une entreprise)</b><input id="sgTit" placeholder="ex. Président"></label></div>
    <div style="margin-top:10px"><b>Votre signature</b> <button type="button" class="sm" id="sgEff">Effacer</button><canvas id="sgPad" width="600" height="160" style="display:block;width:100%;max-width:600px;height:160px;border:1px dashed #9aa7b8;border-radius:10px;background:#fff;touch-action:none;margin-top:6px"></canvas><small class="sub">Signez avec la souris ou le doigt.</small></div>
    <label class="opt" style="display:flex;gap:8px;align-items:flex-start;margin-top:10px"><input type="checkbox" id="sgOk" style="width:auto;margin-top:3px"> <span>J’ai lu le document et j’accepte de le signer électroniquement. Cette signature a la même valeur que ma signature manuscrite.</span></label>
    <div class="row" style="margin-top:12px;gap:8px;display:flex"><button class="pri" id="sgGo">Signer le document</button><button id="sgX">Annuler</button><span class="msg" id="sgM"></span></div>`;
  d.showModal();$('sgX').onclick=()=>d.close();
  /* tablette de signature */
  const cv=$('sgPad'),cx=cv.getContext('2d');let des=false,trace=false;cx.lineWidth=2.4;cx.lineCap='round';cx.strokeStyle='#0b1626';
  const pt=e=>{const r=cv.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return[(t.clientX-r.left)*cv.width/r.width,(t.clientY-r.top)*cv.height/r.height]};
  const dn=e=>{e.preventDefault();des=true;const[x,y]=pt(e);cx.beginPath();cx.moveTo(x,y)},mv=e=>{if(!des)return;e.preventDefault();const[x,y]=pt(e);cx.lineTo(x,y);cx.stroke();trace=true},up=()=>{des=false};
  cv.addEventListener('mousedown',dn);cv.addEventListener('mousemove',mv);addEventListener('mouseup',up);cv.addEventListener('touchstart',dn,{passive:false});cv.addEventListener('touchmove',mv,{passive:false});cv.addEventListener('touchend',up);
  $('sgEff').onclick=()=>{cx.clearRect(0,0,cv.width,cv.height);trace=false};
  /* document */
  ST={p,f,pos:null,bytes:null};
  try{await libs();const{sb}=P();const{data:blob,error:er}=await sb.storage.from('documents').download(f.path);if(er)throw er;ST.bytes=new Uint8Array(await blob.arrayBuffer());
    const doc=await pdfjsLib.getDocument({data:ST.bytes.slice()}).promise;const box=$('sgPages');box.innerHTML='';
    for(let n=1;n<=doc.numPages;n++){const pg=await doc.getPage(n),vp=pg.getViewport({scale:1.3}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;c.style.cssText='width:100%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:crosshair';c.dataset.n=n;
      await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const w=document.createElement('div');w.style.position='relative';w.appendChild(c);box.appendChild(w);
      c.onclick=e=>{const r=c.getBoundingClientRect();ST.pos={page:n-1,x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};box.querySelectorAll('.sgMk').forEach(m=>m.remove());
        const m=document.createElement('div');m.className='sgMk';m.textContent='✍ Signature ici';m.style.cssText=`position:absolute;left:${(e.clientX-r.left)}px;top:${(e.clientY-r.top)-22}px;background:#c99d45;color:#0b1626;font:600 12px system-ui;padding:3px 8px;border-radius:6px;pointer-events:none`;w.appendChild(m);
        $('sgPos').textContent=`Emplacement choisi : page ${n}. Cliquez ailleurs pour le changer.`}}}
  catch(e){$('sgPages').innerHTML=`<p class="msg err">Le document ne s’affiche pas ici (${esc(e.message||e)}). Vous pouvez quand même l’ouvrir avec le bouton du document, puis signer.</p>`}
  $('sgGo').onclick=async()=>{const nom=$('sgNom').value.trim();if(!nom){$('sgM').textContent='Inscrivez votre nom complet.';return}if(!trace){$('sgM').textContent='Signez dans le cadre.';return}if(!$('sgOk').checked){$('sgM').textContent='Cochez la case de consentement.';return}if(!ST.bytes){$('sgM').textContent='Document non chargé : réessayez.';return}
    const b=$('sgGo');b.disabled=true;$('sgM').textContent='Signature en cours…';
    try{const{sb,U}=P();const{PDFDocument,rgb,StandardFonts}=window.PDFLib;const pdf=await PDFDocument.load(ST.bytes,{ignoreEncryption:true});const png=await pdf.embedPng(cv.toDataURL('image/png'));const font=await pdf.embedFont(StandardFonts.Helvetica);
      const quand=new Date(),qTxt=quand.toLocaleString('fr-CA',{dateStyle:'long',timeStyle:'short',timeZone:'America/Toronto'}),empreinte=await sha(ST.bytes);
      const pages=pdf.getPages(),pos=ST.pos||{page:pages.length-1,x:.12,y:.86},pg=pages[pos.page],{width:W,height:H}=pg.getSize(),sw=Math.min(170,W*.3),sh=sw*cv.height/cv.width;
      const x=Math.max(4,Math.min(W-sw-4,pos.x*W)),y=Math.max(14,Math.min(H-sh-4,H-pos.y*H-sh/2));
      pg.drawImage(png,{x,y,width:sw,height:sh});pg.drawText(`Signé électroniquement par ${nom} — ${qTxt}`.normalize('NFC'),{x,y:y-9,size:6.5,font,color:rgb(.15,.2,.3)});
      const c=pdf.addPage([612,792]);let yy=730;const L=(t,s=11,cl=rgb(.05,.08,.15))=>{c.drawText(String(t),{x:60,y:yy,size:s,font,color:cl});yy-=s+9};
      L('Certificat de signature électronique',16);yy-=6;L(`Document : ${ST.p.titre}`);L(`Fichier d’origine : ${ST.f.nom||''}`);L(`Signataire : ${nom}${$('sgTit').value.trim()?', '+$('sgTit').value.trim():''}`);L(`Compte du portail : ${U?.email||''}`);L(`Date et heure : ${qTxt} (heure de l’Est)`);
      L('Empreinte SHA-256 du document d’origine :',9);L(empreinte,8,rgb(.3,.35,.45));yy-=8;c.drawImage(png,{x:60,y:yy-70,width:210,height:210*cv.height/cv.width});yy-=90;
      L('Signé au moyen du portail client de Boujrad CPA Inc. Le signataire a confirmé avoir lu le document',9);L('et accepté de le signer électroniquement, avec la même valeur qu’une signature manuscrite.',9);
      const out=await pdf.save();const nomF=(ST.f.nom||'document.pdf').replace(/\.pdf$/i,'')+'-signe.pdf';const path=`c/${ST.p.client_id}/signes/${Date.now()}-${nomF.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]+/g,'_').slice(-120)}`;
      const{error:e1}=await sb.storage.from('documents').upload(path,new Blob([out],{type:'application/pdf'}),{contentType:'application/pdf'});if(e1)throw e1;
      const{error:e2}=await sb.rpc('pc_signer_document',{p_id:ST.p.id,p_nom:nom,p_titre:$('sgTit').value.trim(),p_fichier:{path,nom:nomF,taille:out.length,sha256_origine:empreinte}});if(e2)throw e2;
      sb.functions.invoke((window.CONFIG||{}).FONCTION_AVIS||'cc-avis',{body:{action:'document_signe',publication_id:ST.p.id}}).catch(()=>{});
      d.close();document.dispatchEvent(new CustomEvent('portail-signe',{detail:ST.p.id}));alert('Merci! Le document est signé. Le cabinet est avisé, et votre copie signée est dans votre portail.')}
    catch(e){$('sgM').textContent='Signature impossible : '+(e.message||e);b.disabled=false}}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-signer]');if(b){e.preventDefault();ouvrir(b.dataset.signer)}});
})();
