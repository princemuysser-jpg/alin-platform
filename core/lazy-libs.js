/* ALIN 2.0.3 - Load optional libraries only when a feature needs them. */
(function(){
  const MAMMOTH_URL='https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
  let mammothPromise=null;

  window.AlinLoadMammoth=function(){
    if(window.mammoth) return Promise.resolve(window.mammoth);
    if(mammothPromise) return mammothPromise;

    mammothPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=MAMMOTH_URL;
      script.async=true;
      script.crossOrigin='anonymous';
      script.onload=()=>window.mammoth
        ? resolve(window.mammoth)
        : reject(new Error('تعذر تشغيل مكتبة معاينة Word'));
      script.onerror=()=>reject(new Error('تعذر تحميل مكتبة معاينة Word. تحقق من الإنترنت ثم حاول مجدداً.'));
      document.head.appendChild(script);
    }).catch(error=>{
      mammothPromise=null;
      throw error;
    });

    return mammothPromise;
  };
})();
