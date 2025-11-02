(function(){
  // Shared theme module: setTheme/toggleTheme + initialization
  function setTheme(dark){
    try{
      if(dark) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
      localStorage.setItem('sapd_theme', dark ? 'dark' : 'light');
      const btn = document.getElementById('themeToggle');
      if(btn) btn.innerText = dark ? '☀️' : '🌙';
    }catch(e){}
  }
  function toggleTheme(){ setTheme(!(document.body.classList.contains('dark-mode'))); }

  document.addEventListener('DOMContentLoaded', ()=>{
    try{
      const t = localStorage.getItem('sapd_theme');
      setTheme(t === 'dark');
      const btn = document.getElementById('themeToggle');
      if(btn) btn.addEventListener('click', toggleTheme);
    }catch(e){}
  });

  // Expose to global for pages that might call setTheme/toggleTheme
  window.setTheme = setTheme;
  window.toggleTheme = toggleTheme;
})();
