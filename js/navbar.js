// Highlight the active navbar link based on current filename
document.addEventListener('DOMContentLoaded', ()=>{
    try{
        const links = Array.from(document.querySelectorAll('.site-navbar a'));
        const path = (window.location.pathname || '').split('/').pop() || 'index.html';
        links.forEach(a=>{
            const href = (a.getAttribute('href')||'').split('/').pop();
            if(!href) return;
            if(href === path) {
                // Hide the link for the current page so it doesn't appear in the navbar
                // This keeps the navbar cleaner and prevents linking to the same page
                try{ a.style.display = 'none'; }catch(e){}
                a.classList.remove('active');
                a.removeAttribute('aria-current');
            } else {
                a.classList.remove('active');
                a.removeAttribute('aria-current');
            }
        });
    }catch(e){}
});
