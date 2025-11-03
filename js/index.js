/* Per-page JS extracted from index.html
   Exposes functions used by inline attributes: add_fait, reset_faits, med, previewMed, copyPreview, avocat, appelDoj, etc.
*/

let lastBuiltMed = null;

function buildMedText(){
    const nom = (document.getElementById('nom')?.value||'').trim();
    const mail = (document.getElementById('mail')?.value||'').trim();
    const objets = (document.getElementById('objetsSaisis')?.value||'').trim()||'Biens personnels';
    const agents = (document.getElementById('agents')?.value||'').trim();
    const now = new Date();
    const pad = n=>n.toString().padStart(2,'0');
    const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} à ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // Simplified: EMS doesn't use the full 'peines' CSV here. Gather any free-text 'faits' if present.
    const faitsContainer = document.getElementById('add_2');
    let faitsList = [];
    if(faitsContainer){
        const children = Array.from(faitsContainer.children).filter(n=> n && (n.dataset?.faitName || n.innerText));
        if(children.length) faitsList = children.map(c => (c.dataset && c.dataset.faitName) ? c.dataset.faitName.trim() : c.innerText.split('\n')[0].trim());
        else { const peineVal = (document.getElementById('faits')?.value||'').trim(); if(peineVal) faitsList.push(peineVal); }
    }

    // No fine/time calculations in EMS-only mode
    const tempsDetention = '';
    const amende = '';
    const providedId = (document.getElementById('id_individu')?.value||'').trim();
    const medInput = (document.getElementById('med_link')?.value||'').trim();
    let uniq;
    if(providedId){ uniq = providedId; }
    else if(medInput){ uniq = medInput; try{ const idEl = document.getElementById('id_individu'); if(idEl) idEl.value = uniq; }catch(e){} }
    else { uniq = 'ID-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8).toUpperCase(); try{ const idEl = document.getElementById('id_individu'); if(idEl) idEl.value = uniq; }catch(e){} }
    const delim = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬'; let txt = '';
    txt+=delim+'\n'; txt+=`:calendar_spiral: Date: ${dateStr}\n`; txt+=`:bust_in_silhouette: Nom du suspect : ${nom}\n`; txt+=`:incoming_envelope: Email du suspect : ${mail}\n`; txt+=`:hourglass_flowing_sand: Temps de la détention : ${tempsDetention}\n`;
    if(faitsList.length){ txt+=`:book: Faits :\n`; faitsList.forEach(f=> txt+= '- ' + (f||'').replace(/\r?\n/g,' ').trim() + '\n'); } else { const peineVal = (document.getElementById('faits')?.value||'').trim(); txt+=`:book: Faits : ${peineVal}\n`; }
    txt+=`:dollar: Amende :  ${amende}\n`; txt+=`:briefcase: Biens personnels saisis : ${objets}\n`; txt+=`:school_satchel: Biens personnels à rendre : Biens personnels\n`;
    // removed avocat checkbox traces for EMS-only build
    txt+=`:envelope: ID unique de l\'individu : ${uniq}\n`; txt+=`:man_police_officer: Clôturé par : ${agents}\n`; txt+=delim+'\n';
    const meta = { suspectName: nom||'', med_link: (document.getElementById('med_link')?.value||'').trim(), faitsList, amende, tempsDetention: tempsDetention, matricule: (document.getElementById('matricule')?.value||'').trim(), poste: (document.getElementById('poste')?.value||'').trim(), agents, uniqueId: uniq };
    return { text: txt, meta }
}

function copyText(text){ function fallbackCopySync(t){ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); document.body.removeChild(ta); return true;}catch(e){ document.body.removeChild(ta); return false; } } if(navigator.clipboard && navigator.clipboard.writeText){ return navigator.clipboard.writeText(text).then(()=>true).catch(()=> Promise.resolve(fallbackCopySync(text))); } return Promise.resolve(fallbackCopySync(text)); }

function med(){ const res = buildMedText(); const medText = res.text||''; const meta = res.meta||{}; const now = new Date(); const pad=n=>n.toString().padStart(2,'0'); const heure = `${pad(now.getHours())}:${pad(now.getMinutes())}`; const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`; const suspect = meta.suspectName || ''; const accusations = (Array.isArray(meta.faitsList) && meta.faitsList.length) ? meta.faitsList.join(', ') : ((document.getElementById('faits')?.value||'').trim()); let noticeText=''; noticeText += `Monsieur | Madame : ${suspect}, il est actuellement ${heure} et nous sommes le ${dateStr}.\n\n`; noticeText += `Vous êtes placé en garde à vue pour les faits suivants : ${accusations}. Vous avez le droit de garder le silence. Si vous renoncez à ce droit, tout ce que vous direz pourra et sera retenu contre vous devant une cour de justice.\n\n`; noticeText += `Vous avez le droit d'avoir un avocat, et, que celui-ci soit présent lors de votre interrogatoire. Si vous n'en avez pas les moyens, un avocat vous sera commis d'office si disponible.\n\n`; noticeText += `Vous avez également le droit à une assistance médicale et d'avoir à manger et à boire.\n\n`; noticeText += `Avez-vous bien compris vos droits ?\nSouhaitez-vous un avocat et / ou avoir une assistance médicale ?\n\n`; noticeText += `A bien dire 3 fois si la personne ne comprend pas, au dessus vous pouvez passez à la suite`; try{ localStorage.setItem('sapd_last_med', JSON.stringify(meta)); }catch(e){} const content = document.getElementById('previewHtml'); if(content){ const safe = s=> (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); const parts=[]; parts.push('<div style="font-weight:700;margin-bottom:.5rem">Lecture des droits — Mise en détention</div>'); parts.push('<div style="line-height:1.4">'); parts.push('<div><strong>Monsieur | Madame :</strong> ' + safe(suspect) + ', <strong>il est actuellement</strong> ' + safe(heure) + ' <strong>et nous sommes le</strong> ' + safe(dateStr) + '.</div>'); parts.push('<p>Vous êtes placé en garde à vue pour les faits suivants : <em>' + safe(accusations) + '</em>.</p>'); parts.push('<p>Vous avez le droit de garder le silence. Si vous renoncez à ce droit, tout ce que vous direz pourra et sera retenu contre vous devant une cour de justice.</p>'); parts.push('<p>Vous avez le droit d\'avoir un avocat, et que celui-ci soit présent lors de votre interrogatoire. Si vous n\'en avez pas les moyens, un avocat vous sera commis d\'office si disponible.</p>'); parts.push('<p>Vous avez également le droit à une assistance médicale et d\'avoir à manger et à boire.</p>'); parts.push('<p><strong>Avez-vous bien compris vos droits ?</strong><br>Souhaitez-vous un avocat et / ou avoir une assistance médicale ?</p>'); parts.push('<p style="color:#777;font-size:.9rem">A bien dire 3 fois si la personne ne comprend pas, au dessus vous pouvez passer à la suite.</p>'); parts.push('</div>'); content.innerHTML = parts.join('\n'); } window.lastBuiltMed = { text: medText, meta }; const overlay = document.getElementById('previewOverlay'); if(overlay) overlay.style.display='flex'; copyText(medText).then(()=> showCopyBadge('M.E.D copiée')).catch(()=> showCopyBadge('Copie impossible')); }

function previewMed(){ const res = buildMedText(); window.lastBuiltMed = res; const content = document.getElementById('previewHtml'); if(content) content.innerHTML = formatMedHtml(res); const overlay = document.getElementById('previewOverlay'); if(overlay) overlay.style.display='flex'; }
function closePreview(){ const overlay = document.getElementById('previewOverlay'); if(overlay) overlay.style.display = 'none'; }
function copyPreview(){ if(!window.lastBuiltMed) return; copyText(window.lastBuiltMed.text).then(ok=> showCopyBadge(ok? 'M.E.D copiée':'Échec de la copie')); }
function formatMedHtml(res){
    const m = res.meta||{};
    const lines = [];
    const escapeHtml = s=> (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    lines.push('<div style="font-weight:700;margin-bottom:.5rem">M.E.D — Prévisualisation</div>');
    lines.push('<div style="font-size:.95rem;line-height:1.3">');
    lines.push('<div><strong>📅 Date :</strong> ' + escapeHtml(new Date().toLocaleString()) + '</div>');
    lines.push('<div><strong>👤 Nom :</strong> ' + escapeHtml(m.suspectName||'') + '</div>');
    lines.push('<div><strong>✉️ Email :</strong> ' + escapeHtml(document.getElementById('mail')?.value||'') + '</div>');
    lines.push('<div><strong>🆔 ID unique :</strong> ' + escapeHtml(m.uniqueId || document.getElementById('id_individu')?.value || '') + '</div>');
    lines.push('<div><strong>⏱️ Temps de détention :</strong> ' + escapeHtml(m.tempsDetention||'') + '</div>');
    if(Array.isArray(m.faitsList) && m.faitsList.length){ lines.push('<div><strong>📚 Faits :</strong></div>'); lines.push('<ul>'); m.faitsList.forEach(f=> lines.push('<li>'+escapeHtml(f)+'</li>')); lines.push('</ul>'); }
    lines.push('<div><strong>💰 Amende :</strong> ' + escapeHtml(m.amende||'') + '</div>');
    lines.push('<div><strong>💼 Objets saisis :</strong> ' + escapeHtml(document.getElementById('objetsSaisis')?.value||'') + '</div>');
    // Avocat info removed for EMS-only build
    lines.push('<div><strong>📎 Lien M.E.D :</strong> ' + (m.med_link ? ('<a href="'+escapeHtml(m.med_link)+'" target="_blank" rel="noreferrer">'+escapeHtml(m.med_link)+'</a>') : '') + '</div>');
    lines.push('<div style="margin-top:.5rem;color:#666;font-size:.85rem">ID: ' + escapeHtml(m.matricule||'') + ' · Poste: ' + escapeHtml(m.poste||'') + '</div>');
    lines.push('</div>');
    return lines.join('\n');
}

function showCopyBadge(msg){ try{ const b = document.getElementById('copyBadge'); if(!b) return; b.innerText = msg||'Copié'; b.style.display='block'; b.style.opacity='1'; b.style.transition=''; setTimeout(()=>{ b.style.transition='opacity .35s ease'; b.style.opacity='0'; setTimeout(()=>{ b.style.display='none'; }, 350); }, 1400); }catch(e){} }


// toggleAvocatControls removed for EMS-only build

function previewMed(){ const res = buildMedText(); lastBuiltMed = res; const content = document.getElementById('previewHtml'); if(content) content.innerHTML = formatMedHtml(res); const overlay = document.getElementById('previewOverlay'); if(overlay) overlay.style.display = 'flex'; }

function closePreview(){ const overlay = document.getElementById('previewOverlay'); if(overlay) overlay.style.display = 'none'; }

// Theme handling (index page)

// small helpers for UI bindings
document.addEventListener('DOMContentLoaded', ()=>{
    // No CSV or "faits" controls in EMS-only index. Wire up regulation toggles only.
    try{
        // Wire collapsible regulation sections (buttons with class .reg-toggle)
        const toggles = document.querySelectorAll('.reg-toggle');
        toggles.forEach(btn => {
            const section = btn.closest('.reg-section');
            const body = section ? section.querySelector('.reg-body') : null;
            // initialize maxHeight based on presence of .open
            if(body){
                if(section && section.classList.contains('open')){
                    body.style.maxHeight = body.scrollHeight + 'px';
                    btn.setAttribute('aria-expanded', 'true');
                } else {
                    body.style.maxHeight = null;
                    btn.setAttribute('aria-expanded', 'false');
                }
            }
            btn.addEventListener('click', ()=>{
                if(!section) return;
                const isOpen = section.classList.toggle('open');
                btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                if(body){
                    if(isOpen){
                        // expand
                        body.style.maxHeight = body.scrollHeight + 'px';
                    } else {
                        // collapse
                        body.style.maxHeight = null;
                    }
                }
            });
        });
    }catch(e){}
    // Theme handled by js/theme.js (shared module)
});

// expose globals used by HTML onclick attributes
window.med = med;
window.previewMed = previewMed;
window.copyPreview = copyPreview;
