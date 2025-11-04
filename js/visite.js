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
        // Handle radio groups by name: include only the selected option in the PDF
        try{
          const name = el.name;
          if(name){
            // find radios in the same cloned container with same name
            const allRadios = Array.from(container.querySelectorAll('input[type="radio"][name="'+name+'"]'));
            if(allRadios.length){
              // Determine a sensible group container (parent of the radio items)
              let group = allRadios[0].closest('.form-check-inline');
              if(group) group = group.parentNode; // parent of the inline checks
              if(!group) group = allRadios[0].closest('.form-row') || allRadios[0].parentNode;
              // avoid double-processing
              if(group && group.dataset && group.dataset.__pdfProcessed){
                // remove this individual radio input element since group handled
                el.parentNode && el.parentNode.removeChild(el);
                return;
              }
              if(group) group.dataset.__pdfProcessed = '1';

              // find the selected radio
              const checked = allRadios.find(r=>r.checked);
              const div = document.createElement('div');
              div.className = 'replaced-field';
              if(checked){
                // locate label text associated with the checked radio
                let lbl = null;
                if(checked.id){ lbl = group && group.querySelector('label[for="'+checked.id+'"]'); }
                if(!lbl){ lbl = checked.nextElementSibling && checked.nextElementSibling.tagName === 'LABEL' ? checked.nextElementSibling : null; }
                if(!lbl){ const parent = checked.closest('.form-check'); if(parent) lbl = parent.querySelector('label'); }
                const text = (lbl && lbl.textContent) ? lbl.textContent.trim() : (checked.value || '').toString();
                div.textContent = text;
              } else {
                // nothing selected — leave empty
                div.textContent = '';
              }

              // Replace the whole group with the selected-text div
              if(group && group.parentNode){
                group.parentNode.replaceChild(div, group);
              } else {
                // fallback: replace each radio input by nothing
                allRadios.forEach(r=>{ r.parentNode && r.parentNode.removeChild(r); });
              }
              return;
            }
          }
        }catch(e){
          console.warn('Radio group processing failed, falling back to per-input handling', e);
        }

  // fallback per-input handling: keep only checked radio
  if(!el.checked){ el.parentNode && el.parentNode.removeChild(el); }
  else { const span = document.createElement('div'); span.className = 'replaced-field'; span.textContent = getFieldText(el); span.style.display = 'inline-block'; el.parentNode && el.parentNode.replaceChild(span, el); }
        return;
      }

      if(el.type === 'checkbox'){
        // For grouped checkboxes (eg. vaccines), only include checked items in the PDF.
        // Try to find a logical group container inside the cloned card first.
        const group = el.closest('.vaccin-checkboxes') || el.closest('.form-check-inline') || el.closest('.form-row');
        if(group){
          // process group only once
          if(group.dataset && group.dataset.__pdfProcessed) {
            // remove this input element since group will be handled
            el.parentNode && el.parentNode.removeChild(el);
            return;
          }
          group.dataset.__pdfProcessed = '1';
          const checkboxes = Array.from(group.querySelectorAll('input[type="checkbox"]'));
          const checked = checkboxes.filter(cb=>cb.checked).map(cb=>{
            // find label associated inside group
            let lbl = null;
            if(cb.id){ lbl = group.querySelector('label[for="'+cb.id+'"]'); }
            if(!lbl){
              // try sibling label
              lbl = cb.nextElementSibling && cb.nextElementSibling.tagName === 'LABEL' ? cb.nextElementSibling : null;
            }
            if(!lbl){
              // fallback: try parent .form-check label
              const parent = cb.closest('.form-check');
              if(parent) lbl = parent.querySelector('label');
            }
            const text = (lbl && lbl.textContent) ? lbl.textContent.trim() : (cb.value || '').toString();
            return text;
          }).filter(Boolean);
          const div = document.createElement('div');
          div.className = 'replaced-field';
          if(checked.length){
            const ul = document.createElement('ul');
            checked.forEach(t=>{ const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
            div.appendChild(ul);
          } else {
            // if nothing checked, insert empty placeholder (omit content in PDF)
            div.textContent = '';
          }
          // Replace the whole group element with the aggregate div
          group.parentNode && group.parentNode.replaceChild(div, group);
          return;
        }
        // fallback: show Oui/Non for standalone checkboxes
  const span = document.createElement('div');
  span.className = 'replaced-field';
  span.textContent = el.checked ? 'Oui' : 'Non';
  el.parentNode && el.parentNode.replaceChild(span, el);
        return;
      }

      // regular input / textarea / select
  const span = document.createElement('div');
  span.className = 'replaced-field';
  span.textContent = getFieldText(el);
  span.style.whiteSpace = 'pre-wrap';
  span.style.marginTop = '4px';
  el.parentNode && el.parentNode.replaceChild(span, el);
    });
  }

  // Dynamically load a script and ensure html2canvas is available
  function loadScript(url){
    return new Promise((resolve,reject)=>{
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = ()=> resolve();
      s.onerror = (e)=> reject(new Error('Failed to load script: '+url));
      document.head.appendChild(s);
    });
  }

  function ensureHtml2CanvasAvailable(){
    if(window.html2canvas) return Promise.resolve();
    // try to load from CDN
    const url = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    return loadScript(url).then(()=>{
      if(window.html2canvas) return Promise.resolve();
      return Promise.reject(new Error('html2canvas did not expose expected global'));
    });
  }

  // Load a Google Font stylesheet and wait for the font to be ready
  function ensureFontLoaded(fontName, fontUrl){
    return new Promise((resolve)=>{
      // add link if not present
      if(!document.querySelector('link[data-font="'+fontName+'"]')){
        const l = document.createElement('link'); l.rel='stylesheet'; l.href = fontUrl; l.setAttribute('data-font', fontName); document.head.appendChild(l);
      }
      // try to use Font Loading API
      if(document.fonts && document.fonts.load){
        document.fonts.load('16px "'+fontName+'"').then(()=>{ resolve(); }).catch(()=>{ document.fonts.ready.then(()=>resolve()).catch(()=>resolve()); });
      } else {
        setTimeout(()=>resolve(), 500);
      }
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

    // Helper: inject a small stylesheet to force a light appearance for the cloned export
    function addPdfLightStyle(){
      if(document.getElementById('pdfLightStyle')) return;
      const s = document.createElement('style');
      s.id = 'pdfLightStyle';
      s.type = 'text/css';
      s.textContent = '\n.pdf-light-mode, .pdf-light-mode * { background: #ffffff !important; color: #0b1220 !important; border-color: rgba(0,0,0,0.08) !important; box-shadow: none !important; }\n.pdf-light-mode img{ filter: none !important; }\n.pdf-light-mode .theme-toggle{ display:none !important; }\n';
      document.head.appendChild(s);
    }
  function removePdfLightStyle(){ const s = document.getElementById('pdfLightStyle'); if(s) s.parentNode.removeChild(s); }
  function addPdfExportStyle(){ if(document.getElementById('pdfExportStyle')) return; const s = document.createElement('style'); s.id='pdfExportStyle'; s.type='text/css'; s.textContent = '\n.pdf-export .replaced-field{ font-family: "Patrick Hand", "Segoe Script", cursive !important; color: #000 !important; font-size:14px !important; }\n.pdf-export .visite-title{ background:none !important; -webkit-background-clip:initial !important; color:#073763 !important; }\n.pdf-export .section-title{ color:#fff !important }\n'; document.head.appendChild(s); }
  function removePdfExportStyle(){ const s = document.getElementById('pdfExportStyle'); if(s) s.parentNode.removeChild(s); }
  function cleanupTmpExport(){ const el = document.getElementById('tmpPdfExport'); el && el.parentNode.removeChild(el); removePdfLightStyle(); removePdfExportStyle(); }
    // ensure inputs are replaced with text
    replaceInputsWithText(clone);

    // remove interactive-only elements (buttons)
  const buttons = clone.querySelectorAll('button');
  buttons.forEach(b => b.parentNode && b.parentNode.removeChild(b));

  // Optionally force the clone into a light-theme appearance.
  // Default: do NOT force for the Visite card so the PDF keeps the page styling (brown header etc).
  if(cardEl.classList && cardEl.classList.contains && cardEl.classList.contains('pdf-force-light')){
    addPdfLightStyle();
    clone.classList.add('pdf-light-mode');
  }

  // put clone in a visible location so renderers can capture it reliably
  // Use a fixed top-left placement (briefly visible) to avoid off-screen blank renders
  clone.style.position = 'fixed';
  clone.style.top = '10px';
  clone.style.left = '10px';
  // try to preserve width so layout matches on-screen card
  try{ clone.style.width = (cardEl.offsetWidth || 800) + 'px'; }catch(e){ clone.style.width = '800px'; }
  clone.style.transform = 'none';
  clone.style.zIndex = '99999';
  clone.id = 'tmpPdfExport';
  // ensure background is white for PDF rendering
  clone.style.background = '#ffffff';
  // add small visible border while debugging; removed in production if needed
  // clone.style.outline = '1px solid rgba(0,0,0,0.02)';
  document.body.appendChild(clone);

  // Prepare PDF-specific styling and fonts so the exported document matches expectations
  addPdfExportStyle();
  clone.classList.add('pdf-export');
  const pdfFontName = 'Patrick Hand';
  const pdfFontUrl = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap';

    const opt = {
      margin:       10,
      filename:     generateFilename(),
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging:false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    // helper: wait for images in the clone to be loaded (or error) before rendering
    function waitForImages(parent, timeoutMs = 5000){
      const imgs = Array.from(parent.querySelectorAll('img'))
        .filter(i => i.src && i.src.trim() !== '');
      if(imgs.length === 0) return Promise.resolve();
      let loaded = 0;
      return new Promise((resolve)=>{
        const onDone = ()=>{ loaded++; if(loaded >= imgs.length) resolve(); };
        imgs.forEach(img => {
          if(img.complete && img.naturalWidth !== 0){ onDone(); return; }
          const onLoad = ()=>{ cleanup(); onDone(); };
          const onError = ()=>{ cleanup(); onDone(); };
          const cleanup = ()=>{ img.removeEventListener('load', onLoad); img.removeEventListener('error', onError); };
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
        });
        // safety timeout to avoid hanging forever
        setTimeout(()=>{ resolve(); }, timeoutMs);
      });
    }

    // call html2pdf after fonts & images are ready; Chrome sometimes renders blank with html2pdf/html2canvas
    ensureFontLoaded(pdfFontName, pdfFontUrl).then(()=>{
      return waitForImages(clone, 10000);
    }).then(()=>{
      const ua = navigator.userAgent || '';
      const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
      if(isChrome){
        // fallback: try to load html2canvas if missing, then render via html2canvas + jsPDF
        console.debug('Visite: attempting html2canvas+jsPDF fallback for Chrome');
        const h2cOpts = Object.assign({ scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' }, opt.html2canvas || {});
        ensureHtml2CanvasAvailable().then(()=>{
          return html2canvas(clone, h2cOpts);
        }).then(canvas => {
          try{
            if(!canvas || !canvas.width || !canvas.height){
              console.error('Canvas empty', canvas);
              throw new Error('Canvas vide après html2canvas');
            }
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            // pick a jsPDF constructor from available globals (supports multiple builds)
            function getJsPDFConstructor(){
              if(window.jsPDF) return window.jsPDF;
              if(window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
              if(window.jspdf) return window.jspdf; // older bundles
              if(window.JSPDF) return window.JSPDF;
              return null;
            }
            const JsPDFCtor = getJsPDFConstructor();
            if(!JsPDFCtor){
              console.warn('jsPDF constructor not available; falling back to html2pdf');
              // try html2pdf fallback
              html2pdf().set(opt).from(clone).save().then(()=>{ cleanupTmpExport(); }).catch(e2=>{ console.error('html2pdf error after missing jsPDF', e2); alert('Erreur lors de la génération du PDF. Consultez la console.'); cleanupTmpExport(); });
              return;
            }
            const pdf = new JsPDFCtor(opt.jsPDF || { unit: 'mm', format: 'a4', orientation: 'portrait' });
            const pageWidth = 210; const pageHeight = 297; // mm
            const margin = opt.margin || 10;
            const pdfWidth = pageWidth - margin*2;
            const ratio = canvas.width / canvas.height;
            const pdfHeight = pdfWidth / ratio;
            if(pdfHeight <= (pageHeight - margin*2)){
              pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth, pdfHeight);
            } else {
              const scaledHeight = pageHeight - margin*2;
              const scaledWidth = scaledHeight * ratio;
              pdf.addImage(imgData, 'JPEG', margin, margin, scaledWidth, scaledHeight);
            }
            pdf.save(opt.filename);
          }catch(err){
            console.error('Fallback pdf generation error', err);
            alert('Erreur lors de la génération du PDF (fallback). Voir console.');
          } finally {
            cleanupTmpExport();
          }
        }).catch(err=>{
          console.warn('html2canvas fallback failed or not available, falling back to html2pdf', err);
          // fallback to default html2pdf flow
          html2pdf().set(opt).from(clone).save().then(()=>{ cleanupTmpExport(); }).catch(e2=>{ console.error('html2pdf error after html2canvas failure', e2); alert('Erreur lors de la génération du PDF. Consultez la console.'); cleanupTmpExport(); });
        });
        return;
      }

      // default path using html2pdf
      html2pdf().set(opt).from(clone).save().then(()=>{ cleanupTmpExport(); }).catch(err=>{ console.error('html2pdf error', err); alert('Erreur lors de la génération du PDF. Consultez la console.'); cleanupTmpExport(); });
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
    // (printable-window feature removed) — printing buttons were removed from the page and this fallback is disabled

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
  // Only show a close button in the preview — do NOT show a download button here
  const btnClose = document.createElement('button'); btnClose.className = 'btn btn-light'; btnClose.textContent = 'Fermer';
  actions.appendChild(btnClose);

      dialog.appendChild(actions);
      // put the cloned card inside dialog
      dialog.appendChild(clone);

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);



      btnClose.addEventListener('click', ()=>{ removeOverlay(); });
      document.addEventListener('keydown', onKeyDown);
    }

    if(previewBtn && card){
      previewBtn.addEventListener('click', (e)=>{ e.preventDefault(); showPreview(card); });
    }

    // Image upload / paste / drag-drop handlers
    const imageTargets = {
      photo: { area: document.getElementById('photoArea'), input: document.getElementById('photoInput'), img: document.getElementById('photoPreview') },
      id: { area: document.getElementById('idArea'), input: document.getElementById('idInput'), img: document.getElementById('idPreview') },
      work: { area: document.getElementById('workArea'), input: document.getElementById('workInput'), img: document.getElementById('workPreview') }
    };

    function loadImageFileToImg(file, imgEl){
      if(!file || !imgEl) return;
      const reader = new FileReader();
      reader.onload = function(ev){ imgEl.src = ev.target.result; imgEl.setAttribute('data-loaded','1'); };
      reader.readAsDataURL(file);
    }

    // attach file input changes and buttons
    // Only bind the file-picker trigger to the "Charger" buttons — exclude delete buttons
    document.querySelectorAll('.image-controls button[data-target]:not(.image-delete-btn)').forEach(btn=>{
      const target = btn.getAttribute('data-target');
      const cfg = imageTargets[target];
      if(!cfg) return;
      // If this button is not the delete button, clicking should open the file picker
      btn.addEventListener('click', ()=>{ cfg.input && cfg.input.click(); });
    });

    Object.keys(imageTargets).forEach(key=>{
      const cfg = imageTargets[key];
      if(!cfg) return;
      // file input
      cfg.input && cfg.input.addEventListener('change', (ev)=>{
        const f = ev.target.files && ev.target.files[0];
        if(f) loadImageFileToImg(f, cfg.img);
      });

      // drag/drop
      if(cfg.area){
        cfg.area.addEventListener('dragover', (e)=>{ e.preventDefault(); cfg.area.classList.add('image-drop-hover'); });
        cfg.area.addEventListener('dragleave', (e)=>{ e.preventDefault(); cfg.area.classList.remove('image-drop-hover'); });
        cfg.area.addEventListener('drop', (e)=>{
          e.preventDefault(); cfg.area.classList.remove('image-drop-hover');
          const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if(f) loadImageFileToImg(f, cfg.img);
        });
      }
    });

    // Paste feature removed at user's request — no paste handlers bound

    // Delete image buttons
    document.querySelectorAll('.image-controls button.image-delete-btn[data-target]').forEach(btn=>{
      const target = btn.getAttribute('data-target');
      btn.addEventListener('click', ()=>{
        const cfg = imageTargets[target];
        if(!cfg) return;
        // remove image src and data flag
        if(cfg.img){ cfg.img.removeAttribute('src'); cfg.img.removeAttribute('data-loaded'); }
        // reset file input
        if(cfg.input){ try{ cfg.input.value = ''; }catch(e){} }
      });
    });

    // Overlay delete buttons (on thumbnails)
    document.querySelectorAll('.image-overlay-delete[data-target]').forEach(btn=>{
      const target = btn.getAttribute('data-target');
      btn.addEventListener('click', ()=>{
        const cfg = imageTargets[target];
        if(!cfg) return;
        if(cfg.img){ cfg.img.removeAttribute('src'); cfg.img.removeAttribute('data-loaded'); }
        if(cfg.input){ try{ cfg.input.value = ''; }catch(e){} }
      });
    });

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
