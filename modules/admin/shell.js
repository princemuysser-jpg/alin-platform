// === admin/shell.js ===
/* ===== admin/js/admin-shell.js ===== */

(function(){
  const registry=new Map();
  window.AlinAdminModules={
    register(name,enhancer){registry.set(name,enhancer)},
    enhance(name){const fn=registry.get(name);if(typeof fn==='function')try{fn(document.getElementById('adminContent'))}catch(e){console.warn('Admin module',name,e)}},
    list(){return [...registry.keys()]}
  };
  function markTabs(tab){
    document.querySelectorAll('#adminPage .admin-tabs button').forEach(btn=>{
      const m=(btn.getAttribute('onclick')||'').match(/adminTab\('([^']+)'\)/);
      if(m) btn.dataset.adminTab=m[1];
      btn.classList.toggle('active-admin-tab',btn.dataset.adminTab===tab);
    });
  }
  function decorate(tab){
    const page=document.getElementById('adminPage'),content=document.getElementById('adminContent');
    if(!page||!content)return;
    page.dataset.activeAdminTab=tab||'';
    page.classList.add('admin-module-ready');
    content.dataset.adminModule=tab||'';
    markTabs(tab);
    window.AlinAdminModules.enhance(tab);
  }
  function install(){
    document.querySelectorAll('#adminPage .admin-tabs button').forEach(btn=>{
      const m=(btn.getAttribute('onclick')||'').match(/adminTab\('([^']+)'\)/);if(m)btn.dataset.adminTab=m[1];
    });
    const base=window.adminTab;
    if(typeof base==='function'&&!base.__alinModular){
      const wrapped=function(tab){const result=base.apply(this,arguments);requestAnimationFrame(()=>decorate(tab));return result};
      wrapped.__alinModular=true;window.adminTab=wrapped;
    }
    const current=window.activeAdminTab||document.querySelector('#adminPage .admin-tabs button')?.dataset.adminTab||'accounts';
    requestAnimationFrame(()=>decorate(current));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;
