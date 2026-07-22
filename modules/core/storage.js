// === core/storage.js ===
/* ALIN v2.4.2 — strict public-media/private-document storage separation. */
(function(){
  'use strict';

  const PUBLIC_BUCKET='alin-files';
  const PRIVATE_BUCKET='alin-private';
  const PRIVATE_ROOTS=new Set(['booklets','teacher-requests']);
  const OBJECT_URLS=new Set();

  function client(){
    try{
      if(typeof window.init==='function')window.init();
      return window.sb||null;
    }catch(_){return null;}
  }
  function requireClient(){
    const value=client();
    if(!value)throw new Error('الاتصال بالتخزين غير متاح');
    return value;
  }
  function cleanSegment(value,label='المعرّف'){
    const clean=String(value||'').trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,96);
    if(!clean)throw new Error(`${label} غير صالح`);
    return clean;
  }
  function normalizedFolder(value){
    return String(value||'files').replace(/^\/+|\/+$/g,'').replace(/[^a-z0-9_\-/]/gi,'')||'files';
  }
  function rootFolder(value){return normalizedFolder(value).split('/')[0]||'files';}
  function isPrivateRoot(value){return PRIVATE_ROOTS.has(rootFolder(value));}
  function isDocumentPath(value){return PRIVATE_ROOTS.has(String(value||'').replace(/^\/+/, '').split('/')[0]);}

  function parseStoredRef(value){
    let raw=String(value||'').trim();
    if(!raw)return {bucket:PUBLIC_BUCKET,path:'',external:false};
    if(raw.startsWith('private://'))raw=raw.slice('private://'.length);
    try{
      if(/^https?:\/\//i.test(raw)){
        const url=new URL(raw);
        const decoded=decodeURIComponent(url.pathname);
        for(const marker of ['/storage/v1/object/public/','/storage/v1/object/sign/','/storage/v1/object/authenticated/']){
          if(!decoded.includes(marker))continue;
          const parts=(decoded.split(marker)[1]||'').split('/').filter(Boolean);
          const bucket=parts.shift()||'';
          return {bucket:bucket||PUBLIC_BUCKET,path:parts.join('/'),external:false};
        }
        return {bucket:'external',path:raw,external:true};
      }
    }catch(_){ }
    raw=raw.replace(/^\/+/, '');
    if(raw.startsWith(`${PRIVATE_BUCKET}/`))return {bucket:PRIVATE_BUCKET,path:raw.slice(PRIVATE_BUCKET.length+1),external:false};
    if(raw.startsWith(`${PUBLIC_BUCKET}/`))return {bucket:PUBLIC_BUCKET,path:raw.slice(PUBLIC_BUCKET.length+1),external:false};
    return {bucket:isDocumentPath(raw)?PRIVATE_BUCKET:PUBLIC_BUCKET,path:raw,external:false};
  }

  async function requireAuthenticatedSession(){
    const c=requireClient();
    const {data,error}=await c.auth.getSession();
    if(error||!data?.session?.user)throw new Error('انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة');
    return data.session;
  }

  async function ensureStorageReady(folder='files'){
    if(isPrivateRoot(folder))await requireAuthenticatedSession();
    else requireClient();
    return true;
  }

  function safeFileName(name){
    const base=String(name||'file').split(/[\\/]/).pop().replace(/\.[^.]+$/,'');
    return base.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'file';
  }
  function fileExtension(file){return (String(file?.name||'').split('.').pop()||'').toLowerCase();}
  async function fileHeader(file,length=16){
    const bytes=new Uint8Array(await file.slice(0,length).arrayBuffer());
    return bytes;
  }
  function bytesStart(bytes,signature){return signature.every((value,index)=>bytes[index]===value);}

  async function validateFile(file,{required=false,type='any',maxBytes}={}){
    const real=file&&typeof file==='object'&&file.name&&Number(file.size)>0;
    if(!real){if(required)throw new Error('اختر الملف من جهازك');return null;}
    const normalizedType=String(type||'any').toLowerCase();
    const limit=Number(maxBytes)||(
      normalizedType==='image'?5*1024*1024:
      normalizedType==='docx'?20*1024*1024:
      normalizedType==='pdf'?25*1024*1024:25*1024*1024
    );
    if(Number(file.size)>limit)throw new Error(`حجم الملف أكبر من المسموح (${Math.round(limit/1024/1024)}MB)`);
    if(Number(file.size)<100)throw new Error('الملف فارغ أو تالف');

    const ext=fileExtension(file);
    const mime=String(file.type||'').toLowerCase();
    const header=await fileHeader(file,16);

    if(normalizedType==='pdf'){
      if(ext!=='pdf')throw new Error('امتداد الملف يجب أن يكون PDF');
      if(mime&&!['application/pdf','application/octet-stream'].includes(mime))throw new Error('نوع ملف PDF غير صحيح');
      if(!bytesStart(header,[0x25,0x50,0x44,0x46,0x2d]))throw new Error('الملف لا يحتوي توقيع PDF صحيح');
      return {ext:'pdf',mime:'application/pdf',type:'pdf'};
    }
    if(normalizedType==='docx'){
      if(ext!=='docx')throw new Error('امتداد الملف يجب أن يكون DOCX');
      if(mime&&!['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'].includes(mime))throw new Error('نوع ملف Word غير صحيح');
      const isZip=bytesStart(header,[0x50,0x4b,0x03,0x04])||bytesStart(header,[0x50,0x4b,0x05,0x06])||bytesStart(header,[0x50,0x4b,0x07,0x08]);
      if(!isZip)throw new Error('ملف DOCX غير صحيح أو تالف');
      return {ext:'docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',type:'docx'};
    }
    if(normalizedType==='image'){
      const allowed=['jpg','jpeg','png','webp'];
      if(!allowed.includes(ext))throw new Error('اختر صورة JPG أو PNG أو WEBP');
      if(mime&&!mime.startsWith('image/'))throw new Error('نوع الصورة غير صحيح');
      const valid=(ext==='png'&&bytesStart(header,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))||
        ((ext==='jpg'||ext==='jpeg')&&bytesStart(header,[0xff,0xd8,0xff]))||
        (ext==='webp'&&bytesStart(header,[0x52,0x49,0x46,0x46])&&String.fromCharCode(...header.slice(8,12))==='WEBP');
      if(!valid)throw new Error('محتوى الصورة لا يطابق امتدادها');
      const normalizedExt=ext==='jpeg'?'jpg':ext;
      const normalizedMime=normalizedExt==='jpg'?'image/jpeg':`image/${normalizedExt}`;
      return {ext:normalizedExt,mime:normalizedMime,type:'image'};
    }
    throw new Error('نوع الملف غير مسموح. استخدم PDF أو DOCX أو صورة مدعومة');
  }

  function mediaUrl(value){
    if(!value)return '';
    const ref=parseStoredRef(value);
    if(ref.external)return ref.path;
    if(ref.bucket===PRIVATE_BUCKET||isDocumentPath(ref.path))return '';
    return requireClient().storage.from(PUBLIC_BUCKET).getPublicUrl(ref.path).data.publicUrl;
  }

  function registerObjectUrl(blob){
    const url=URL.createObjectURL(blob);
    OBJECT_URLS.add(url);
    window.setTimeout(()=>{try{URL.revokeObjectURL(url);}catch(_){ }OBJECT_URLS.delete(url);},10*60*1000);
    return url;
  }

  async function downloadPrivate(value,preferredFolder=''){
    await requireAuthenticatedSession();
    const ref=parseStoredRef(value);
    const expectedRoot=rootFolder(preferredFolder||ref.path);
    if(ref.external||ref.bucket!==PRIVATE_BUCKET||!isDocumentPath(ref.path)||!PRIVATE_ROOTS.has(expectedRoot)){
      throw new Error('هذا ملف قديم غير محمي. يجب على المدير إعادة رفعه إلى التخزين الخاص');
    }
    const {data,error}=await requireClient().storage.from(PRIVATE_BUCKET).download(ref.path);
    if(error||!data)throw new Error('ليس لديك صلاحية لفتح هذا الملف أو لم يعد مرتبطاً بطلبك');
    if(!Number(data.size))throw new Error('الملف فارغ أو غير متاح');
    return {blob:data,url:registerObjectUrl(data),path:ref.path,bucket:PRIVATE_BUCKET,contentType:data.type||''};
  }

  async function secureFileUrl(value,_expiresIn=300,preferredFolder='booklets'){
    const resolved=await downloadPrivate(value,preferredFolder);
    return resolved.url;
  }

  async function checkFileUrl(url){
    try{
      const response=await fetch(url,{method:'GET',cache:'no-store'});
      const contentType=(response.headers.get('content-type')||'').toLowerCase();
      return response.ok&&!contentType.includes('application/json');
    }catch(_){return false;}
  }
  const checkPublicFile=checkFileUrl;

  async function uploadFile(folder,file,options={}){
    folder=normalizedFolder(folder);
    const root=rootFolder(folder);
    const normalizedType=String(options.type||'any').toLowerCase();
    const info=await validateFile(file,{...options,type:normalizedType});
    if(!info)return null;
    await ensureStorageReady(folder);

    const privateDocument=PRIVATE_ROOTS.has(root);
    if(privateDocument&&root==='booklets'&&info.type!=='pdf')throw new Error('مجلد الملازم يقبل ملفات PDF فقط');
    if(privateDocument&&root==='teacher-requests'&&info.type!=='docx')throw new Error('طلبات المدرسين تقبل ملفات DOCX فقط');
    if(!privateDocument&&info.type!=='image')throw new Error('التخزين العام مخصص للصور فقط');

    let path='';
    const randomId=crypto.randomUUID().replace(/-/g,'');
    if(root==='booklets'){
      const entityId=cleanSegment(options.entityId,'رقم الملزمة');
      path=`booklets/${entityId}/${randomId}.pdf`;
    }else if(root==='teacher-requests'){
      const ownerId=cleanSegment(options.ownerId,'رقم المدرس');
      const entityId=cleanSegment(options.entityId,'رقم الطلب');
      path=`teacher-requests/${ownerId}/${entityId}/${randomId}.docx`;
    }else{
      path=`${folder}/${randomId}.${info.ext}`;
    }

    const bucket=privateDocument?PRIVATE_BUCKET:PUBLIC_BUCKET;
    const payload=file.slice?new File([file.slice(0,file.size)],file.name,{type:info.mime}):file;
    const {data,error}=await requireClient().storage.from(bucket).upload(path,payload,{
      upsert:false,
      contentType:info.mime,
      cacheControl:privateDocument?'0':'3600'
    });
    if(error){
      const message=String(error.message||'');
      if(/row-level|policy|permission|unauthorized/i.test(message))throw new Error('تم رفض رفع الملف بسبب الصلاحيات. نفّذ تحديث المرحلة الأولى في Supabase');
      if(/bucket|not found/i.test(message))throw new Error(`حاوية التخزين ${bucket} غير موجودة. نفّذ تحديث المرحلة الأولى في Supabase`);
      throw new Error(`فشل رفع الملف: ${message||'خطأ غير معروف'}`);
    }
    const stored=data?.path||path;
    return privateDocument?`${PRIVATE_BUCKET}/${stored}`:stored;
  }
  async function uploadFileV52(folder,file,options={}){return uploadFile(folder,file,options);}

  async function alinResolveStoredFile(value,preferredFolder='booklets'){
    if(!value)return null;
    const ref=parseStoredRef(value);
    if(PRIVATE_ROOTS.has(rootFolder(preferredFolder))||isDocumentPath(ref.path))return downloadPrivate(value,preferredFolder);
    if(ref.external)return {path:ref.path,bucket:'external',url:ref.path,blob:null,contentType:''};
    const url=mediaUrl(value);
    if(!url)return null;
    return {path:ref.path,bucket:PUBLIC_BUCKET,url,blob:null,contentType:''};
  }

  window.addEventListener('pagehide',()=>{
    for(const url of OBJECT_URLS){try{URL.revokeObjectURL(url);}catch(_){ }}
    OBJECT_URLS.clear();
  });

  Object.assign(window,{ensureStorageReady,safeFileName,uploadFile,uploadFileV52,mediaUrl,secureFileUrl,checkPublicFile,checkFileUrl,alinResolveStoredFile});
  window.AlinStorage=Object.freeze({
    publicBucket:PUBLIC_BUCKET,privateBucket:PRIVATE_BUCKET,
    ensureStorageReady,safeFileName,uploadFile,mediaUrl,secureFileUrl,
    checkFileUrl,resolve:alinResolveStoredFile,parseStoredRef
  });
})();
