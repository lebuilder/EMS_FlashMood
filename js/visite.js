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

    // call html2pdf after images are ready; Chrome sometimes renders blank with html2pdf/html2canvas
    waitForImages(clone, 10000).then(()=>{
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
              html2pdf().set(opt).from(clone).save().then(()=>{
                const el = document.getElementById('tmpPdfExport'); el && el.parentNode.removeChild(el);
              }).catch(e2=>{ console.error('html2pdf error after missing jsPDF', e2); alert('Erreur lors de la génération du PDF. Consultez la console.'); const el = document.getElementById('tmpPdfExport'); el && el.parentNode.removeChild(el); });
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
            const el = document.getElementById('tmpPdfExport');
            el && el.parentNode.removeChild(el);
          }
        }).catch(err=>{
          console.warn('html2canvas fallback failed or not available, falling back to html2pdf', err);
          // fallback to default html2pdf flow
          html2pdf().set(opt).from(clone).save().then(()=>{
            const el = document.getElementById('tmpPdfExport');
            el && el.parentNode.removeChild(el);
          }).catch(e2=>{
            console.error('html2pdf error after html2canvas failure', e2);
            alert('Erreur lors de la génération du PDF. Consultez la console.');
            const el = document.getElementById('tmpPdfExport');
            el && el.parentNode.removeChild(el);
          });
        });
        return;
      }

      // default path using html2pdf
      html2pdf().set(opt).from(clone).save().then(()=>{
        const el = document.getElementById('tmpPdfExport');
        el && el.parentNode.removeChild(el);
      }).catch(err=>{
        console.error('html2pdf error', err);
        alert('Erreur lors de la génération du PDF. Consultez la console.');
        const el = document.getElementById('tmpPdfExport');
        el && el.parentNode.removeChild(el);
      });
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
    // Open printable view (fallback) button
    const openPrintableBtn = document.getElementById('openPrintable');
    function openPrintableView(sourceCard){
      const clone = sourceCard.cloneNode(true);
      replaceInputsWithText(clone);
      // remove interactive elements
      const buttons = clone.querySelectorAll('button'); buttons.forEach(b=>b.parentNode && b.parentNode.removeChild(b));

      // compute base href so relative CSS and images resolve in the new window
      const loc = window.location.href;
      const baseHref = loc.replace(/\/[^\/]*$/, '/');

      // build minimal HTML for printable window
      const headHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`;
      const baseTag = `<base href="${baseHref}">`;
      // include the same stylesheets (relative paths) — baseTag makes these resolve correctly
      const cssLinks = [`<link rel="stylesheet" href="css/index.css">`,`<link rel="stylesheet" href="css/visite.css">`].join('\n');
      const bodyHtml = `<body style="background:#fff;padding:20px">${clone.outerHTML}</body></html>`;
      const final = headHtml + baseTag + cssLinks + '</head>' + bodyHtml;

      const w = window.open('', '_blank');
      if(!w){ alert('Impossible d\'ouvrir une nouvelle fenêtre. Autorisez les popups pour ce site.'); return; }
      w.document.open();
      w.document.write(final);
      w.document.close();

      // wait for images to load in the new window, with a timeout
      function waitForImages(win, timeout=7000){
        return new Promise((resolve)=>{
          try{
            const imgs = win.document.images;
            if(!imgs || imgs.length===0) return setTimeout(resolve, 50);
            let remaining = imgs.length;
            const timer = setTimeout(()=>{ resolve(); }, timeout);
            for(const img of imgs){
              if(img.complete && img.naturalWidth>0){
                remaining--;
                if(remaining===0){ clearTimeout(timer); resolve(); }
              } else {
                img.addEventListener('load', ()=>{ remaining--; if(remaining===0){ clearTimeout(timer); resolve(); } }, {once:true});
                img.addEventListener('error', ()=>{ remaining--; if(remaining===0){ clearTimeout(timer); resolve(); } }, {once:true});
              }
            }
          }catch(e){ console.warn('waitForImages failed', e); resolve(); }
        });
      }

      // after resources load (or timeout), focus and open print dialog
      waitForImages(w, 7000).then(()=>{
        try{ w.focus(); setTimeout(()=>{ try{ w.print(); }catch(e){ console.warn('print failed', e); } }, 250); }catch(e){ console.warn('focus/print failed', e); }
      });
    }
    openPrintableBtn && openPrintableBtn.addEventListener('click', (e)=>{ e.preventDefault(); openPrintableView(card); });

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
    document.querySelectorAll('.image-controls button[data-target]').forEach(btn=>{
      const target = btn.getAttribute('data-target');
      const cfg = imageTargets[target];
      if(!cfg) return;
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

    // Paste handling: user clicks a 'Coller' button which sets currentPasteTarget, then paste event is handled
    let currentPasteTarget = null;
    document.querySelectorAll('button[id$="PasteBtn"]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        currentPasteTarget = btn.getAttribute('data-target');
        // give a short instruction by focusing the area
        const area = imageTargets[currentPasteTarget] && imageTargets[currentPasteTarget].area;
        area && area.focus();
        // inform user briefly
        btn.textContent = 'Prêt — appuyez sur Ctrl+V';
        setTimeout(()=>{ btn.innerHTML = 'Coller (Ctrl+V)'; },3000);
      });
    });

    document.addEventListener('paste', (ev)=>{
      if(!ev.clipboardData) return;
      const items = ev.clipboardData.items;
      if(!items) return;
      for(let i=0;i<items.length;i++){
        const it = items[i];
        if(it.type.indexOf('image') !== -1){
          const blob = it.getAsFile();
          if(!blob) continue;
          const targetKey = currentPasteTarget || 'photo';
          const cfg = imageTargets[targetKey];
          if(cfg && cfg.img){ loadImageFileToImg(blob, cfg.img); }
          currentPasteTarget = null;
          ev.preventDefault();
          return;
        }
      }
    });

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
