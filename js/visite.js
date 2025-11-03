// visite.js — generate downloadable PDF from the filled Visite Médicale form
(function(){
  function getFieldText(el){
    if(!el) return '';
    if(el.tagName === 'INPUT'){
      const type = el.type || '';
      if(type === 'checkbox') return el.checked ? 'Oui' : 'Non';
      if(type === 'radio') return el.checked ? (el.value || 'Oui') : '';
      return el.value || el.placeholder || '';
    }
    if(el.tagName === 'TEXTAREA') return el.value || '';
    if(el.tagName === 'SELECT') return el.value || '';
    return el.textContent || '';
  }

  function replaceInputsWithText(container){
    // Replace inputs, textareas and selects inside container with spans containing their values
    const inputs = Array.from(container.querySelectorAll('input, textarea, select'));
    inputs.forEach(el => {
      if(el.type === 'radio'){
        if(!el.checked){
          // remove unchecked radios
          el.parentNode && el.parentNode.removeChild(el);
        } else {
          const span = document.createElement('div');
          span.textContent = getFieldText(el);
          span.style.display = 'inline-block';
          el.parentNode && el.parentNode.replaceChild(span, el);
        }
        return;
      }

      if(el.type === 'checkbox'){
        // show label text if present; otherwise 'Oui/Non'
        const span = document.createElement('div');
        span.textContent = el.checked ? 'Oui' : 'Non';
        el.parentNode && el.parentNode.replaceChild(span, el);
        return;
      }

      // regular input / textarea / select
      const span = document.createElement('div');
      span.textContent = getFieldText(el);
      span.style.whiteSpace = 'pre-wrap';
      span.style.marginTop = '4px';
      el.parentNode && el.parentNode.replaceChild(span, el);
    });
  }

  function generateFilename(){
    const nom = (document.querySelector('input[name="nom"]') || {}).value || '';
    const id = (document.querySelector('input[name="id"]') || {}).value || '';
    const base = nom ? nom.replace(/[^a-zA-Z0-9-_]/g,'_') : 'visite';
    const suffix = id ? '_' + id.replace(/[^a-zA-Z0-9-_]/g,'') : '';
    const d = new Date();
    const date = d.toISOString().slice(0,10);
    return `${base}${suffix}_${date}.pdf`;
  }

  function generatePdfFromCard(cardEl){
    if(!window.html2pdf){
      alert('La librairie html2pdf n\'est pas chargée. Vérifiez la connexion ou rechargez la page.');
      return;
    }

    // clone the card so we can modify it for print without disturbing the page
    const clone = cardEl.cloneNode(true);
    // ensure inputs are replaced with text
    replaceInputsWithText(clone);

    // remove interactive-only elements (buttons)
    const buttons = clone.querySelectorAll('button');
    buttons.forEach(b => b.parentNode && b.parentNode.removeChild(b));

    // put clone off-screen so html2pdf can render it
    clone.style.position = 'fixed';
    clone.style.left = '-10000px';
    clone.style.top = '0';
    clone.id = 'tmpPdfExport';
    document.body.appendChild(clone);

    const opt = {
      margin:       10,
      filename:     generateFilename(),
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging:false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // call html2pdf
    html2pdf().set(opt).from(clone).save().then(()=>{
      // cleanup
      const el = document.getElementById('tmpPdfExport');
      el && el.parentNode.removeChild(el);
    }).catch(err=>{
      console.error('html2pdf error', err);
      alert('Erreur lors de la génération du PDF. Consultez la console.');
      const el = document.getElementById('tmpPdfExport');
      el && el.parentNode.removeChild(el);
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const downloadBtn = document.getElementById('downloadPdf');
    const card = document.querySelector('.visite-card');
    const previewBtn = document.getElementById('previewBtn');
    if(downloadBtn && card){
      downloadBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        generatePdfFromCard(card);
      });
    }

    // Preview logic: clone card, replace inputs with text and show in modal
    function showPreview(sourceCard){
      const clone = sourceCard.cloneNode(true);
      replaceInputsWithText(clone);
      // remove existing tmp preview if any
      const removeOverlay = () => {
        const ov = document.getElementById('pdfPreviewOverlay');
        ov && ov.parentNode.removeChild(ov);
        document.removeEventListener('keydown', onKeyDown);
      };

      const onKeyDown = (ev) => { if(ev.key === 'Escape') removeOverlay(); };

      // build overlay
      const overlay = document.createElement('div'); overlay.className = 'pdf-preview-overlay'; overlay.id = 'pdfPreviewOverlay';
      const dialog = document.createElement('div'); dialog.className = 'pdf-preview-dialog';

      const actions = document.createElement('div'); actions.className = 'pdf-preview-actions';
      const btnDownload = document.createElement('button'); btnDownload.className = 'btn btn-secondary'; btnDownload.innerHTML = '<i class="fa fa-download"></i> Télécharger PDF';
      const btnClose = document.createElement('button'); btnClose.className = 'btn btn-light'; btnClose.textContent = 'Fermer';
      actions.appendChild(btnClose); actions.appendChild(btnDownload);

      dialog.appendChild(actions);
      // put the cloned card inside dialog
      dialog.appendChild(clone);

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // download from the preview (use the same generator)
      btnDownload.addEventListener('click', ()=>{
        generatePdfFromCard(clone);
      });

      btnClose.addEventListener('click', ()=>{ removeOverlay(); });
      document.addEventListener('keydown', onKeyDown);
    }

    if(previewBtn && card){
      previewBtn.addEventListener('click', (e)=>{ e.preventDefault(); showPreview(card); });
    }

    // optional: enhance form submit to also generate PDF automatically
    const form = document.getElementById('visiteForm');
    if(form){
      form.addEventListener('submit', function(evt){
        evt.preventDefault();
        // Save could happen here (localStorage/export)
        // For now, generate PDF on submit as well
        generatePdfFromCard(card);
      });
    }
  });
})();
