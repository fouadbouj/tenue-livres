/* Portail client : « Nous autoriser comme représentant » (ARC et Revenu Québec) */
document.addEventListener('portail-pret',async()=>{const{sb,esc}=window.PORTAIL||{};if(!sb)return;
  let R={};try{const{data}=await sb.from('cc_parametres').select('valeur').eq('cle','representant').maybeSingle();R=data?.valeur||{}}catch(e){}
  const lab={ne:'Numéro d’entreprise du cabinet (NE)',idrep:'ID Rep',idgroupe:'ID Groupe'};const k=R.affiche&&R[R.affiche]?R.affiche:['ne','idgroupe','idrep'].find(x=>R[x]);
  const box=document.createElement('div');box.className='card';box.id='repCard';box.style.marginTop='16px';
  box.innerHTML=`<details><summary style="cursor:pointer;font-weight:700;font-size:18px">Nous autoriser comme représentant (ARC et Revenu Québec)</summary>
    <p class="sub" style="margin-top:8px">Pour que nous puissions répondre à l’ARC pour vous, récupérer vos feuillets et corriger votre dossier, autorisez Boujrad CPA Inc. dans votre compte de l’ARC. Ça prend quelques minutes.</p>
    ${k?`<div class="info" style="margin:10px 0"><strong>${esc(lab[k])} à entrer :</strong> <span style="font-family:ui-monospace,monospace;font-size:17px;letter-spacing:.5px">${esc(R[k])}</span> <button type="button" class="sm" id="repCp">Copier</button><br><small>Le nom affiché par l’ARC doit être « Boujrad CPA Inc. ».</small></div>`
      :`<div class="info" style="margin:10px 0">Écrivez-nous dans vos messages pour obtenir notre identifiant de représentant.</div>`}
    <ol style="margin:8px 0 0 18px;line-height:1.6"><li><b>Particulier :</b> Mon dossier › Profil › autoriser ou gérer les représentants › <em>Autoriser un représentant</em>.</li>
      <li><b>Entreprise :</b> Mon dossier d’entreprise › <em>Autoriser ou gérer les représentants</em> › <em>Autoriser un représentant</em>.</li>
      <li>Entrez l’identifiant ci-dessus, vérifiez le nom du cabinet, choisissez le <b>niveau 2</b> (et, pour une entreprise, le numéro d’entreprise au complet), puis confirmez.</li>
      <li>Revenu Québec : nous vous ferons signer la procuration (formulaire MR-69); vous n’avez rien à faire de ce côté pour l’instant.</li></ol>
    <p style="margin:10px 0 0"><a href="https://boujradcpa.com/guides/autoriser-representant.html" target="_blank" rel="noopener">Voir le guide complet, étape par étape →</a></p></details>`;
  const main=document.querySelector('main');(main||document.body).appendChild(box);
  box.querySelector('#repCp')?.addEventListener('click',async e=>{try{await navigator.clipboard.writeText(R[k]);e.target.textContent='Copié ✓'}catch(x){}})});
