// Highlight the active navbar link based on current filename
document.addEventListener('DOMContentLoaded', ()=>{
    try{
        const links = Array.from(document.querySelectorAll('.site-navbar a'));
        const path = (window.location.pathname || '').split('/').pop() || 'index.html';
        links.forEach(a=>{
            const href = (a.getAttribute('href')||'').split('/').pop();
            if(!href) return;
            if(href === path) {
                a.classList.add('active');
                a.setAttribute('aria-current','page');
            } else {
                a.classList.remove('active');
                a.removeAttribute('aria-current');
            }
        });
    }catch(e){}
});
