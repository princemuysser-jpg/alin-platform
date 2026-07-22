/* ALIN v2.4.2 — device router for the animated entry screen. */
(()=>{
  'use strict';
  const STORAGE_KEY='alin_device_view';
  let destination='';
  let chosen='desktop';
  let navigated=false;

  const cleanQuery=url=>{
    url.searchParams.delete('view');
    url.searchParams.delete('splash');
    return url;
  };

  try{
    const current=new URL(location.href);
    const forced=current.searchParams.get('view');
    chosen=forced==='mobile'||forced==='desktop'?forced:'';
    if(chosen){
      try{sessionStorage.setItem(STORAGE_KEY,chosen)}catch(_){ }
    }else{
      try{
        const saved=sessionStorage.getItem(STORAGE_KEY);
        if(saved==='mobile'||saved==='desktop')chosen=saved;
      }catch(_){ }
    }
    if(!chosen){
      const viewportWidth=window.visualViewport&&window.visualViewport.width;
      const width=Math.max(1,Math.round(viewportWidth||window.innerWidth||document.documentElement.clientWidth||1024));
      let coarse=false,hoverNone=false,portrait=false,touch=false;
      try{
        coarse=matchMedia('(pointer: coarse)').matches;
        hoverNone=matchMedia('(hover: none)').matches;
        portrait=matchMedia('(orientation: portrait)').matches;
      }catch(_){portrait=innerHeight>=innerWidth}
      try{touch=(navigator.maxTouchPoints||0)>0}catch(_){ }
      const ua=String(navigator.userAgent||'');
      const hintedMobile=!!(navigator.userAgentData&&navigator.userAgentData.mobile===true);
      const phone=hintedMobile||/iPhone|iPod|Android.+Mobile|Windows Phone|Mobile/i.test(ua)||(width<800&&coarse);
      const tablet=/iPad|Tablet|Kindle|Silk|Android(?!.*Mobile)/i.test(ua)||(/Macintosh/i.test(ua)&&touch)||((coarse||hoverNone)&&touch&&width>=800&&width<=1180);
      chosen=phone?'mobile':tablet&&(portrait||width<1000)?'mobile':'desktop';
      try{sessionStorage.setItem(STORAGE_KEY,chosen)}catch(_){ }
    }
    cleanQuery(current);
    current.pathname=current.pathname.replace(/[^/]*$/,'')+(chosen==='mobile'?'store-mobile.html':'store-desktop.html');
    destination=current.href;
  }catch(_){
    chosen=(window.innerWidth||1024)<800?'mobile':'desktop';
    let query='';
    try{
      query=String(location.search||'').replace(/^\?/,'').split('&').filter(part=>{
        if(!part)return false;
        let key=part.split('=')[0].replace(/\+/g,' ');
        try{key=decodeURIComponent(key)}catch(_){ }
        return key!=='view'&&key!=='splash';
      }).join('&');
    }catch(_){query=''}
    destination='./'+(chosen==='mobile'?'store-mobile.html':'store-desktop.html')+(query?'?'+query:'')+String(location.hash||'');
  }

  const go=()=>{
    if(navigated)return;
    navigated=true;
    location.replace(destination);
  };
  window.AlinEntryRoute=Object.freeze({view:chosen,target:destination,go});
  document.documentElement.dataset.alinEntryView=chosen;
  window.dispatchEvent(new CustomEvent('alin:entry-route-ready',{detail:{view:chosen,target:destination}}));
})();
