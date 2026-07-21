// === core/storage.js ===
/* ALIN v2.2.7 — authoritative file storage and media resolver. */
(function(){
  'use strict';

  function client(){try{if(typeof window.init==='function')window.init();return window.sb||null}catch(_){return null}}
  function requireClient(){const value=client();if(!value)throw new Error('الاتصال بالتخزين غير متاح');return value}
  function normalizedFolder(value){return String(value||'files').replace(/^\/+|\/+$/g,'').replace(/[^a-z0-9_\-/]/gi,'')||'files'}

  async function ensureStorageReady(){
    const c=requireClient();
    try{
      const {error}=await c.storage.from('alin-files').list('',{limit:1});
      if(error){
        const message=String(error.message||'').toLowerCase();
        if(message.includes('bucket')||message.includes('not found'))throw new Error('مجلد التخزين alin-files غير موجود. نفّذ ملف تحديث Supabase الأخير مرة واحدة.');
        if(message.includes('policy')||message.includes('permission')||message.includes('row-level'))throw new Error('صلاحيات التخزين ناقصة. نفّذ ملف تحديث Supabase الأخير مرة واحدة.');
        throw error;
      }
      return true;
    }catch(error){
      if(error instanceof Error)throw error;
      throw new Error(String(error||'تعذر فحص التخزين'));
    }
  }

  function safeFileName(name){
    const base=String(name||'file').split(/[\\/]/).pop().replace(/\.[^.]+$/,'');
    return base.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'file';
  }

  function validateFile(file,{required=false,type='any',maxBytes=25*1024*1024}={}){
    const real=file&&typeof file==='object'&&file.name&&Number(file.size)>0;
    if(!real){if(required)throw new Error('اختر الملف من جهازك');return null}
    if(Number(file.size)>maxBytes)throw new Error(`حجم الملف أكبر من المسموح (${Math.round(maxBytes/1024/1024)}MB)`);
    const ext=(String(file.name).split('.').pop()||'').toLowerCase();
    const mime=String(file.type||'').toLowerCase();
    if(type==='pdf'&&ext!=='pdf'&&!mime.includes('pdf'))throw new Error('اختر ملف PDF صحيح');
    if(type==='image'&&!mime.startsWith('image/')&&!['jpg','jpeg','png','webp','gif','svg'].includes(ext))throw new Error('اختر صورة صحيحة');
    if(Number(file.size)<100)throw new Error('الملف فارغ أو تالف');
    return {ext,mime};
  }

  function mediaUrl(path){
    if(!path)return '';
    const c=requireClient();
    let raw=String(path).trim();
    try{
      if(/^https?:\/\//i.test(raw)){
        const url=new URL(raw);
        const markers=['/storage/v1/object/public/','/storage/v1/object/sign/','/storage/v1/object/authenticated/'];
        const marker=markers.find(value=>url.pathname.includes(value));
        if(!marker)return raw;
        const parts=decodeURIComponent(url.pathname.split(marker)[1]||'').split('/').filter(Boolean);
        const bucket=parts.shift()||'';
        if(bucket==='alin-files')raw=parts.join('/');
        else raw=`${bucket}/${parts.join('/')}`;
      }
    }catch(_){ }
    raw=raw.replace(/^\/+/, '').replace(/^alin-files\//,'');
    return c.storage.from('alin-files').getPublicUrl(raw).data.publicUrl;
  }

  async function checkPublicFile(url){
    try{
      const response=await fetch(url,{method:'GET',cache:'no-store'});
      if(!response.ok)return false;
      return !(response.headers.get('content-type')||'').toLowerCase().includes('application/json');
    }catch(_){return true}
  }

  async function uploadFile(folder,file,options={}){
    const info=validateFile(file,options);if(!info)return null;
    await ensureStorageReady();
    const c=requireClient();
    const type=options.type||'any';
    const ext=type==='pdf'?'pdf':(info.ext||(type==='image'?'png':'bin'));
    const path=`${normalizedFolder(folder)}/${Date.now()}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}.${ext}`;
    const contentType=type==='pdf'?'application/pdf':(file.type||(type==='image'?'image/png':'application/octet-stream'));
    const payload=file.slice?new File([file.slice(0,file.size)],file.name,{type:contentType}):file;
    const {data,error}=await c.storage.from('alin-files').upload(path,payload,{upsert:false,contentType,cacheControl:'3600'});
    if(error){
      const message=String(error.message||'');
      const lower=message.toLowerCase();
      if(lower.includes('bucket')||lower.includes('not found'))throw new Error('مجلد التخزين alin-files غير موجود');
      if(lower.includes('policy')||lower.includes('permission')||lower.includes('row-level'))throw new Error('صلاحيات رفع الملفات ناقصة');
      throw new Error(`فشل رفع الملف: ${message||'خطأ غير معروف'}`);
    }
    const stored=data?.path||path;
    const publicUrl=mediaUrl(stored);
    if(!(await checkPublicFile(publicUrl)))throw new Error('تم رفع الملف لكن الرابط العام غير متاح');
    return stored;
  }

  async function uploadFileV52(folder,file,options={}){return uploadFile(folder,file,options)}

  async function alinResolveStoredFile(value,preferredFolder='booklets'){
    if(!value)return null;
    const c=requireClient();
    const raw=String(value).trim();
    const candidates=[];
    const add=value=>{const clean=String(value||'').replace(/^\/+/, '').replace(/^alin-files\//,'');if(clean&&!candidates.includes(clean))candidates.push(clean)};
    if(!/^https?:\/\//i.test(raw))add(raw);
    try{
      if(/^https?:\/\//i.test(raw)){
        const url=new URL(raw),decoded=decodeURIComponent(url.pathname);
        for(const marker of ['/storage/v1/object/public/','/storage/v1/object/sign/','/storage/v1/object/authenticated/']){
          if(!decoded.includes(marker))continue;
          const parts=(decoded.split(marker)[1]||'').split('/').filter(Boolean),bucket=parts.shift()||'',rest=parts.join('/');
          if(bucket==='alin-files')add(rest);else{add(`${bucket}/${rest}`);add(`${preferredFolder}/${parts.at(-1)||''}`)}
        }
        const filename=decoded.split('/').filter(Boolean).at(-1);if(filename)add(`${preferredFolder}/${filename}`);
      }
    }catch(_){ }
    const filename=raw.split('?')[0].split('#')[0].split('/').filter(Boolean).at(-1);if(filename)add(`${preferredFolder}/${filename}`);
    for(const path of candidates){
      try{
        const url=c.storage.from('alin-files').getPublicUrl(path).data?.publicUrl;if(!url)continue;
        const response=await fetch(url,{cache:'no-store'});if(!response.ok)continue;
        const contentType=(response.headers.get('content-type')||'').toLowerCase();if(contentType.includes('application/json'))continue;
        const blob=await response.blob();if(!blob.size)continue;
        return {path,url,blob,contentType:blob.type||contentType};
      }catch(_){ }
    }
    return null;
  }

  Object.assign(window,{ensureStorageReady,safeFileName,uploadFile,uploadFileV52,mediaUrl,checkPublicFile,alinResolveStoredFile});
  window.AlinStorage=Object.freeze({ensureStorageReady,safeFileName,uploadFile,mediaUrl,checkPublicFile,resolve:alinResolveStoredFile});
})();

;
