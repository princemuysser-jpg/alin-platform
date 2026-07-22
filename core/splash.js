/* ALIN v2.4.2 — lightweight animated splash before the existing store. */
(()=>{
  'use strict';
  const root=document.getElementById('alinSplash');
  const route=window.AlinEntryRoute;
  if(!root||!route||typeof route.go!=='function')return;

  const reduced=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}})();
  const minVisible=reduced?650:1550;
  const exitDuration=reduced?120:280;
  const started=performance.now();
  let leaving=false;

  try{
    const prefetch=document.createElement('link');
    prefetch.rel='prefetch';
    prefetch.as='document';
    prefetch.href=route.target;
    document.head.append(prefetch);
  }catch(_){ }

  const leave=()=>{
    if(leaving)return;
    leaving=true;
    const remaining=Math.max(0,minVisible-(performance.now()-started));
    window.setTimeout(()=>{
      root.classList.add('is-leaving');
      root.setAttribute('aria-hidden','true');
      window.setTimeout(route.go,exitDuration);
    },remaining);
  };

  if(document.readyState==='complete')leave();
  else window.addEventListener('load',leave,{once:true});
  window.setTimeout(leave,2200);
})();
