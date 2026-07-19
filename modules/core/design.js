// Alin module: core/design.js | v2.0.3
/* ===== core/design/design-system.js ===== */
(function(){
  document.documentElement.classList.add('alin-design-v175');
  function ready(){document.body?.classList.add('alin-ui-ready')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;b.classList.add('alin-click');setTimeout(()=>b.classList.remove('alin-click'),180)});
})();


;

