/* JS for EMS_FlashMood/psy.html: add selection checkboxes and generate/copy summary */
document.addEventListener('DOMContentLoaded', ()=>{
  const table = document.querySelector('table.psy-table');
  if(!table) return;
  const thead = table.querySelector('thead tr');
  // insert header for select column
  const selTh = document.createElement('th'); selTh.className = 'select-col'; selTh.textContent = '';
  thead.insertBefore(selTh, thead.firstChild);

  const rows = Array.from(table.querySelectorAll('tbody tr'));
  rows.forEach((tr, idx)=>{
    const firstTd = tr.querySelector('td');
    const disorder = firstTd ? firstTd.textContent.trim() : `Ligne ${idx+1}`;
    const symptoms = (tr.children[2] && tr.children[2].innerHTML) || '';
    const treatment = (tr.children[3] && tr.children[3].textContent.trim()) || '';
    tr.setAttribute('data-disorder', disorder);
    tr.setAttribute('data-symptoms', symptoms);
    tr.setAttribute('data-treatment', treatment);

    const td = document.createElement('td');
    td.className = 'select-col';
    const chk = document.createElement('input');
    chk.type='checkbox'; chk.className='select-disorder';
    td.appendChild(chk);
    tr.insertBefore(td, tr.firstChild);
  });

  const generateBtn = document.getElementById('generateBtn');
  const summarySection = document.getElementById('summarySection');
  const summaryContent = document.getElementById('summaryContent');
  const copyBtn = document.getElementById('copySummary');

  function generateSummary(){
    const checked = Array.from(document.querySelectorAll('.select-disorder:checked')).map(cb=>cb.closest('tr'));
    if(checked.length === 0){
      summarySection.style.display='block';
      summaryContent.innerHTML = '<em>Aucune pathologie sélectionnée.</em>';
      copyBtn.style.display='none';
      return;
    }
    let html = '';
    html += `<p><strong>Résumé généré — ${checked.length} élément(s)</strong></p>`;
    html += '<div style="display:flex;flex-direction:column;gap:0.6rem">';
    checked.forEach(tr=>{
      const name = tr.getAttribute('data-disorder');
      const symptoms = tr.getAttribute('data-symptoms');
      const treatment = tr.getAttribute('data-treatment');
      html += `<div class="psy-summary-item">`;
      html += `<h5 style="margin:0 0 6px 0">${name}</h5>`;
      if(symptoms) html += `<div><strong>Symptômes:</strong><div style="margin-top:4px">${symptoms}</div></div>`;
      if(treatment) html += `<div style="margin-top:6px"><strong>Traitement recommandé:</strong> ${treatment}</div>`;
      html += `</div>`;
    });
    html += '</div>';
    summarySection.style.display='block';
    summaryContent.innerHTML = html;
    copyBtn.style.display='inline-block';
    summarySection.scrollIntoView({behavior:'smooth'});
  }

  generateBtn && generateBtn.addEventListener('click', generateSummary);

  copyBtn && copyBtn.addEventListener('click', ()=>{
    const text = summaryContent.innerText || summaryContent.textContent;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>{
        copyBtn.textContent = 'Copié';
        setTimeout(()=>{ copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copier'; },1500);
      }).catch(()=>{ alert('Impossible de copier automatiquement.'); });
    } else {
      // Fallback: create textarea
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try{ document.execCommand('copy'); copyBtn.textContent = 'Copié'; }catch(e){ alert('Copie impossible'); }
      document.body.removeChild(ta);
      setTimeout(()=>{ copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copier'; },1500);
    }
  });
});
