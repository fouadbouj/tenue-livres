/* Facturation : factures, accord de DPA du payeur (Règle H1) et fichier de prélèvements Desjardins (norme 005 de Paiements Canada) */
(()=>{
const TPS=0.05,TVQ=0.09975;
const r2=v=>Math.round((+v+Number.EPSILON)*100)/100;
const money=v=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(+v||0);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dLong=x=>x?new Date(String(x).slice(0,10)+'T12:00').toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}):'____________';
const MOIS=p=>{const[y,m]=p.split('-').map(Number);return new Date(Date.UTC(y,m-1,15)).toLocaleDateString('fr-CA',{month:'long',year:'numeric',timeZone:'UTC'})};
function taxes(st,taxable=true){st=r2(st);const tps=taxable?r2(st*TPS):0,tvq=taxable?r2(st*TVQ):0;return{sous_total:st,tps,tvq,total:r2(st+tps+tvq)}}

/* ---------- facture ---------- */
function factureHtml(f,c){const e=f.emetteur||{};
  return `<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"><title>Facture ${esc(f.numero||'')}</title><style>
  @page{size:letter;margin:2cm}body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#111;max-width:760px;margin:24px auto;padding:0 18px}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c99d45;padding-bottom:14px}.logo{font:800 26pt Georgia,serif;color:#0b1626}.logo i{color:#c99d45;font-style:normal}
  h1{font-size:20pt;margin:0;color:#1f3d6e;text-align:right}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f2f4f8}.r{text-align:right;white-space:nowrap}
  .tot td{border:0;padding:4px 8px}.tot .g td{font-weight:700;font-size:12pt;border-top:2px solid #111}.box{background:#f6f7fa;border-radius:8px;padding:10px 14px;margin-top:18px}.muted{color:#555;font-size:9pt}
  </style></head><body>
  <div class="hd"><div><div class="logo">bCPA<i>.</i></div><div><strong>${esc(e.nom||'Boujrad CPA Inc.')}</strong><br>${esc(e.adresse||'220-672, boulevard des Laurentides')}<br>${esc(e.ville||'Laval (Québec) H7G 2V9')}${e.courriel?'<br>'+esc(e.courriel):''}</div></div>
  <div><h1>FACTURE</h1><table style="margin-top:8px;width:auto;margin-left:auto"><tr><td>Numéro</td><td class="r"><strong>${esc(f.numero||'(à l’enregistrement)')}</strong></td></tr><tr><td>Date</td><td class="r">${dLong(f.date)}</td></tr>${f.mode==='autre'&&f.echeance?`<tr><td>Payable au plus tard le</td><td class="r">${dLong(f.echeance)}</td></tr>`:''}</table></div></div>
  <p style="margin-top:18px"><strong>Facturé à :</strong><br>${esc(c.nom)}${c.adresse?'<br>'+esc(c.adresse):''}${c.ville?'<br>'+esc(c.ville)+(c.code_postal?' '+esc(c.code_postal):''):''}</p>
  <table><thead><tr><th>Description</th><th class="r">Montant</th></tr></thead><tbody>${(f.lignes||[]).map(l=>`<tr><td>${esc(l.description)}</td><td class="r">${money(l.montant)}</td></tr>`).join('')}</tbody></table>
  <table class="tot" style="width:320px;margin-left:auto"><tr><td>Sous-total</td><td class="r">${money(f.sous_total)}</td></tr><tr><td>TPS (5 %)${e.tps?`<br><span class="muted">${esc(e.tps)}</span>`:''}</td><td class="r">${money(f.tps)}</td></tr><tr><td>TVQ (9,975 %)${e.tvq?`<br><span class="muted">${esc(e.tvq)}</span>`:''}</td><td class="r">${money(f.tvq)}</td></tr><tr class="g"><td>Total</td><td class="r">${money(f.total)}</td></tr></table>
  <div class="box">${f.mode==='dpa'?`<strong>Paiement par débit préautorisé.</strong> Le montant de ${money(f.total)} ${f.statut==='payée'?`a été prélevé${f.paye_le?' le '+dLong(f.paye_le):''}`:'sera prélevé dans votre compte'} conformément à votre accord de débits préautorisés. Aucune action n’est requise de votre part.`:`<strong>Modalités de paiement :</strong> ${f.statut==='payée'?`payée${f.paye_le?' le '+dLong(f.paye_le):''}. Merci!`:`payable${f.echeance?' au plus tard le '+dLong(f.echeance):' sur réception'} par virement Interac ou bancaire, en indiquant le numéro de facture.`}`}</div>
  ${f.note?`<p class="muted">${esc(f.note)}</p>`:''}<p class="muted" style="margin-top:24px">Merci de votre confiance. Pour toute question, écrivez-nous dans la section « Messages » de votre portail client.</p></body></html>`}

/* ---------- accord de DPA du payeur (annexe du contrat) ---------- */
function accordHtml(c,d,acc){const pers=c.type==='particulier',mt=taxes(d.dpaMontant||0,true);
  const v=x=>x?`<strong>${esc(x)}</strong>`:'____________';
  return `<h2>Accord de débits préautorisés (DPA) du payeur</h2>
  <p><strong>Bénéficiaire :</strong> Boujrad CPA Inc., 220-672, boulevard des Laurentides, Laval (Québec) H7G 2V9. Pour toute question, demande de renseignements ou recours, communiquez avec le bénéficiaire par la section « Messages » du portail client ou à l’adresse courriel indiquée sur ses factures.</p>
  <p><strong>Payeur :</strong> ${esc(c.nom)} · <strong>Titulaire du compte :</strong> ${v(acc?.titulaire)} · <strong>Institution :</strong> ${v(acc?.institution)} · <strong>Transit :</strong> ${v(acc?.transit)} · <strong>Compte :</strong> ${acc?.compte?'<strong>•••'+esc(String(acc.compte).slice(-3))+'</strong>':'____________'}</p>
  <p><strong>Catégorie :</strong> DPA ${pers?'personnel':'d’entreprise'}.</p>
  <p><strong>Autorisation :</strong> le payeur autorise le bénéficiaire et l’institution financière désignée ci-dessus à débiter son compte du montant prévu ci-dessous, aux dates prévues, pour le paiement des honoraires découlant du contrat de services auquel le présent accord est annexé. Le payeur reconnaît que la remise du présent accord au bénéficiaire équivaut à sa remise à son institution financière.</p>
  <p><strong>Montant et fréquence :</strong> débit à intervalle fixe, chaque mois, le ${esc(d.dpaJour||'1')}<sup>${String(d.dpaJour||'1')==='1'?'er':'e'}</sup> jour du mois (ou le jour ouvrable suivant), à compter du ${dLong(d.dpaDebut)}, d’un montant de <strong>${money(mt.total)}</strong>, soit ${money(mt.sous_total)} plus la TPS (${money(mt.tps)}) et la TVQ (${money(mt.tvq)}). Le bénéficiaire peut, sur avis écrit d’au moins 10 jours civils, modifier ce montant à la suite d’une modification des honoraires prévue au contrat; aucun avis n’est requis si la modification découle uniquement d’un changement des taux de taxes. Le bénéficiaire peut aussi débiter le compte, sur avis écrit d’au moins 10 jours civils, pour des travaux supplémentaires facturés conformément au contrat.</p>
  <p><strong>Confirmation :</strong> le bénéficiaire confirme le présent accord par écrit au payeur, au moyen du portail client et par courriel. ${d.dpaRenonce?'<u><strong>Le payeur renonce au délai de 10 jours civils entre la confirmation du présent accord et le premier débit.</strong></u>':'Le premier débit aura lieu au moins 10 jours civils après cette confirmation.'}</p>
  <p><strong>Annulation :</strong> le payeur peut modifier ou révoquer le présent accord en tout temps, sur préavis écrit de 10 jours civils transmis au bénéficiaire. Pour obtenir un modèle de formulaire d’annulation ou plus d’information sur son droit d’annuler un accord de DPA, le payeur peut s’adresser à son institution financière ou consulter le site www.paiements.ca. La révocation de l’accord ne met pas fin au contrat de services ni aux honoraires dus en vertu de celui-ci.</p>
  <p><strong>Recours :</strong> le payeur dispose de certains droits de recours si un débit n’est pas conforme au présent accord. Par exemple, il a le droit de recevoir le remboursement de tout débit non autorisé ou non conforme au présent accord, en présentant une demande à son institution financière ${pers?'dans les 90 jours civils':'dans les 10 jours ouvrables'} suivant la date du débit. Pour obtenir plus d’information sur ses droits de recours, le payeur peut communiquer avec son institution financière ou consulter le site www.paiements.ca.</p>
  <p><strong>Débit refusé :</strong> si un débit est refusé faute de provision suffisante ou pour une autre raison, le bénéficiaire peut présenter de nouveau le débit et réclamer les frais bancaires engagés. Le payeur s’engage à aviser le bénéficiaire de tout changement de compte au moins 10 jours civils avant le débit suivant.</p>
  <p><strong>Renseignements :</strong> le payeur consent à la communication des renseignements contenus dans le présent accord à l’institution financière du bénéficiaire, dans la mesure nécessaire au traitement des débits. Le payeur déclare que toutes les personnes dont la signature est requise pour autoriser des débits dans ce compte ont signé le présent accord.</p>`}

/* ---------- fichier de prélèvements Desjardins (norme 005, enregistrements de 1 464 caractères) ---------- */
const ascii=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x20-\x7E]/g,' ').toUpperCase();
const A=(s,n)=>ascii(s).slice(0,n).padEnd(n,' '),N=(v,n)=>String(Math.round(+v||0)).replace(/\D/g,'').slice(-n).padStart(n,'0');
const jul=iso=>{const d=new Date(iso+'T12:00:00Z'),y=d.getUTCFullYear(),j=Math.floor((d-Date.UTC(y,0,1))/864e5)+1;return '0'+String(y).slice(-2)+String(j).padStart(3,'0')};
/* p : {organisme, nomCourt, nomLong, transitRetour, compteRetour, codeEnt, codePers}; tx : [{montant (total $), institution, transit, compte, nom, reference, info, categorie}] */
function fichier005(p,numero,creation,echeance,tx){const org=N(p.organisme,10),fno=N(numero,4),L=[];let seq=1;
  const rec=s=>{if(s.length!==1464)throw new Error('Longueur invalide : '+s.length);L.push(s)};
  rec(('A'+N(1,9)+org+fno+jul(creation)+'81510').padEnd(55,' ')+'CAD'.padEnd(1464-55,' '));
  for(let i=0;i<tx.length;i+=6){let r='D'+N(++seq,9)+org+fno;
    for(let k=0;k<6;k++){const t=tx[i+k];if(!t){r+=' '.repeat(240);continue}
      const code=t.categorie==='personnel'?(p.codePers||p.codeEnt):p.codeEnt;
      const seg=N(code,3)+N(Math.round(t.montant*100),10)+jul(echeance)+'0'+N(t.institution,3)+N(t.transit,5)+A(String(t.compte).replace(/\s/g,''),12)+'0'.repeat(22)+'000'
        +A(p.nomCourt,15)+A(t.nom,30)+A(p.nomLong,30)+org+A(t.reference,19)+'0815'+N(p.transitRetour,5)+A(p.compteRetour,12)+A(t.info,15)+' '.repeat(22)+'  '+'0'.repeat(11);
      if(seg.length!==240)throw new Error('Segment invalide');r+=seg}
    rec(r)}
  const tot=tx.reduce((s,t)=>s+Math.round(t.montant*100),0);
  rec(('Z'+N(++seq,9)+org+fno+N(tot,14)+N(tx.length,8)+N(0,14)+N(0,8)+'0'.repeat(44)).padEnd(1464,' '));
  return L.join('\r\n')+'\r\n'}


/* ---------- facture en PDF (jsPDF) et courriel de facture ---------- */
const charger=src=>new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('chargement impossible'));document.head.appendChild(s)});
async function libsPdf(){if(!window.jspdf)await charger('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');if(!window.jspdf.jsPDF.API.autoTable)await charger('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}
async function facturePdf(f,c,pay={}){await libsPdf();const{jsPDF}=window.jspdf,doc=new jsPDF({unit:'pt',format:'letter'}),W=doc.internal.pageSize.getWidth(),e=f.emetteur||{},M=54,nav=[11,22,38],or=[201,157,69];
  const m$=v=>money(v).replace(/ | /g,' ');
  doc.setFont('helvetica','bold');doc.setFontSize(26);doc.setTextColor(...nav);doc.text('bCPA',M,70);doc.setTextColor(...or);doc.text('.',M+doc.getTextWidth('bCPA'),70);
  doc.setFontSize(10);doc.setTextColor(17,17,17);doc.text(e.nom||'Boujrad CPA Inc.',M,90);doc.setFont('helvetica','normal');doc.text([e.adresse||'220-672, boulevard des Laurentides',e.ville||'Laval (Québec) H7G 2V9',e.courriel||''].filter(Boolean),M,104);
  doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(31,61,110);doc.text('FACTURE',W-M,70,{align:'right'});doc.setFontSize(10);doc.setTextColor(17,17,17);doc.setFont('helvetica','normal');
  const info=[['Numéro',f.numero||''],['Date',dLong(f.date)],...(f.mode!=='dpa'&&f.echeance?[['Payable au plus tard le',dLong(f.echeance)]]:[])];info.forEach(([a,b],i)=>{doc.text(a,W-M-150,92+i*14,{align:'right'});doc.setFont('helvetica','bold');doc.text(b,W-M,92+i*14,{align:'right'});doc.setFont('helvetica','normal')});
  doc.setDrawColor(...or);doc.setLineWidth(2);doc.line(M,138,W-M,138);
  doc.setFont('helvetica','bold');doc.text('Facturé à :',M,162);doc.setFont('helvetica','normal');doc.text([c.nom||'',c.adresse||'',[c.ville,c.code_postal].filter(Boolean).join(' '),c.courriel||''].filter(Boolean),M,176);
  doc.autoTable({startY:230,margin:{left:M,right:M},head:[['Description',{content:'Montant',styles:{halign:'right'}}]],body:(f.lignes||[]).map(l=>[l.description,m$(l.montant)]),styles:{fontSize:10,cellPadding:6},headStyles:{fillColor:[242,244,248],textColor:17},columnStyles:{1:{halign:'right',cellWidth:110}}});
  let y=doc.lastAutoTable.finalY+8;const tot=[['Sous-total',m$(f.sous_total)],[`TPS (5 %)${e.tps?' — '+e.tps:''}`,m$(f.tps)],[`TVQ (9,975 %)${e.tvq?' — '+e.tvq:''}`,m$(f.tvq)]];
  tot.forEach(([a,b])=>{y+=16;doc.text(a,W-M-120,y,{align:'right'});doc.text(b,W-M,y,{align:'right'})});y+=8;doc.setLineWidth(1);doc.setDrawColor(17,17,17);doc.line(W-M-260,y,W-M,y);y+=16;doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('Total',W-M-120,y,{align:'right'});doc.text(m$(f.total),W-M,y,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(10);y+=34;
  const lignesPay=f.mode==='dpa'?[`Paiement par débit préautorisé : ${m$(f.total)} ${f.statut==='payée'?'prélevé':'sera prélevé'} conformément à votre accord.`]:f.statut==='payée'?[`Facture payée${f.paye_le?' le '+dLong(f.paye_le):''}. Merci!`]:
    ['Modes de paiement :',...(pay.interac?[`• Virement Interac à ${pay.interac} (indiquez le numéro ${f.numero} dans le message)${pay.interacNote?' — '+pay.interacNote:''}`]:[]),...(pay.lien&&pay.carte?[`• Carte de crédit, en ligne : ${pay.lien}`]:pay.lien?[`• Votre facture en ligne : ${pay.lien}`]:[])];
  doc.setFillColor(246,247,250);const hh=lignesPay.length*14+16;doc.roundedRect(M,y-14,W-2*M,hh,6,6,'F');doc.text(lignesPay.map(l=>doc.splitTextToSize(l,W-2*M-24)).flat(),M+12,y);y+=hh+10;
  if(f.note){doc.setTextColor(85,85,85);doc.text(doc.splitTextToSize(f.note,W-2*M),M,y);y+=20}
  doc.setTextColor(85,85,85);doc.setFontSize(9);doc.text('Merci de votre confiance.',M,y+10);
  return doc.output('datauristring').split(',')[1]}
function courrielFacture(f,c,pay={}){const qui=(c.contact||c.nom||'').trim();
  return `Bonjour${qui?' '+qui:''},

Merci d’avoir fait confiance à Boujrad CPA Inc. Vous trouverez ci-joint notre facture ${f.numero}${(f.lignes||[]).length?' ('+(f.lignes||[]).map(l=>String(l.description).replace(/\.$/,'')).map(d=>d.charAt(0).toLowerCase()+d.slice(1)).join(', ')+')':''}.

Montant total : ${money(f.total).replace(/ | /g,' ')} (taxes incluses)${f.echeance?`
Payable au plus tard le : ${dLong(f.echeance)}`:''}

Modes de paiement :
${[pay.lien&&pay.carte?`• Carte de crédit : payez en ligne en toute sécurité au ${pay.lien}`:'',pay.interac?`• Virement Interac : envoyez le montant à ${pay.interac} en indiquant le numéro de facture ${f.numero} dans le message${pay.interacNote?' ('+pay.interacNote+')':''}`:''].filter(Boolean).join('\n')||'• Communiquez avec nous pour le mode de paiement'}${pay.lien&&!pay.carte?`

Votre facture en ligne : ${pay.lien}`:''}

N’hésitez pas à nous écrire si vous avez des questions.

Merci de votre confiance!

Boujrad CPA Inc.`}
window.FACTURE={TPS,TVQ,r2,taxes,money,MOIS,factureHtml,accordHtml,fichier005,jul,facturePdf,courrielFacture,libsPdf};
})();
