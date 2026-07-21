/* ALIN 2.0.1 — single authoritative banner module (admin + storefront). */
(function(){
  'use strict';

  const state={rows:[],index:0,timer:null,installed:false,saving:false};
  const q=(selector,root=document)=>root.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const today=()=>new Date().toISOString().slice(0,10);
  const truthy=value=>value===true||value===1||value==='1'||String(value).toLowerCase()==='true';
  const rows=()=>Array.isArray(window.db?.banners)?window.db.banners:state.rows;
  const client=()=>window.AlinCloud?.client?.()||window.sb||window.supabaseClient||null;

  function enabled(banner){return truthy(banner?.active) && banner?.status!=='hidden'}

  function active(banner){
    const date=today();
    return enabled(banner) &&
      (!banner?.start_date||String(banner.start_date).slice(0,10)<=date) &&
      (!banner?.end_date||String(banner.end_date).slice(0,10)>=date);
  }

  function safeLink(value){
    if(!value)return '';
    try{
      const url=new URL(String(value),location.href);
      return ['http:','https:'].includes(url.protocol)?url.href:'';
    }catch(_){return ''}
  }

  function imageUrl(banner){
    const ref=banner?.image_path||banner?.image_url||banner?.cover_path||'';
    if(!ref)return '';
    try{
      if(typeof window.mediaUrl==='function')return window.mediaUrl(ref);
    }catch(error){console.warn('[ALIN banners] media URL',error)}
    if(/^https?:\/\//i.test(String(ref)))return String(ref);
    try{return client()?.storage?.from('alin-files').getPublicUrl(String(ref).replace(/^\/+|^alin-files\//g,'')).data?.publicUrl||''}
    catch(_){return ''}
  }

  function host(){
    return document.getElementById('alinStoreBanners');
  }

  function sortedActiveRows(){
    return rows().filter(active).sort((a,b)=>
      (Number(a.sort_order)||0)-(Number(b.sort_order)||0) ||
      String(b.created_at||'').localeCompare(String(a.created_at||''))
    );
  }

  function renderStorefront(){
    const box=host();
    if(!box)return;
    const visible=sortedActiveRows();
    if(!visible.length){
      box.replaceChildren();
      box.hidden=true;
      clearInterval(state.timer);
      state.timer=null;
      return;
    }

    state.index=Math.min(state.index,visible.length-1);
    const banner=visible[state.index];
    const image=imageUrl(banner);
    const link=safeLink(banner.link_url);
    box.hidden=false;
    const hasText=Boolean(String(banner.title||'').trim()||String(banner.text||'').trim());
    box.innerHTML=`
      <article class="alin-store-banner${link?' is-clickable':''}${hasText?' has-copy':' no-copy'}" ${link?'role="link" tabindex="0"':''}>
        <div class="alin-store-banner__media">
          ${image?`<img class="alin-store-banner__image" src="${esc(image)}" alt="${esc(banner.title||'إعلان منصة آلين')}" loading="eager" decoding="async">`:`<span class="alin-store-banner__placeholder" aria-hidden="true">آ</span>`}
        </div>
        ${hasText?`<div class="alin-store-banner__content">
          <div class="alin-store-banner__copy">
            <span class="alin-store-banner__label">إعلان منصة آلين</span>
            ${banner.title?`<h2>${esc(banner.title)}</h2>`:''}
            ${banner.text?`<p>${esc(banner.text)}</p>`:''}
          </div>
          ${link?`<span class="alin-store-banner__cta" aria-hidden="true">عرض الإعلان <b>←</b></span>`:''}
        </div>`:''}
      </article>
      ${visible.length>1?`<div class="alin-store-banner__dots" aria-label="اختيار الإعلان">${visible.map((_,index)=>`<button type="button" class="${index===state.index?'active':''}" data-banner-index="${index}" aria-label="الإعلان ${index+1}"></button>`).join('')}</div>`:''}`;

    const article=q('.alin-store-banner',box);
    if(article&&link){
      const open=()=>window.open(link,'_blank','noopener,noreferrer');
      article.addEventListener('click',open);
      article.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}
      });
    }
    q('.alin-store-banner__image',box)?.addEventListener('error',event=>{
      console.warn('[ALIN banners] image failed',event.currentTarget.src);
      const media=event.currentTarget.closest('.alin-store-banner__media');
      event.currentTarget.remove();
      if(media)media.innerHTML='<span class="alin-store-banner__placeholder" aria-hidden="true">آ</span>';
      article?.classList.add('without-image');
    },{once:true});
    box.querySelectorAll('[data-banner-index]').forEach(button=>button.addEventListener('click',()=>{
      state.index=Number(button.dataset.bannerIndex)||0;
      renderStorefront();
      restartRotation();
    }));
  }

  function restartRotation(){
    clearInterval(state.timer);
    state.timer=null;
    if(sortedActiveRows().length>1){
      state.timer=setInterval(()=>{
        const count=sortedActiveRows().length;
        if(!count)return;
        state.index=(state.index+1)%count;
        renderStorefront();
      },6500);
    }
  }

  async function refresh(){
    try{
      if(typeof window.query==='function'){
        const data=await window.query('banners');
        if(Array.isArray(data)){
          state.rows=data;
          if(window.db)window.db.banners=data;
        }
      }else state.rows=rows();
    }catch(error){
      console.warn('[ALIN banners] refresh failed; using loaded rows',error);
      state.rows=rows();
    }
    renderStorefront();
    restartRotation();
  }

  function bannerById(id){return rows().find(item=>String(item.id)===String(id))}
  function value(id){return document.getElementById(id)?.value?.trim()||''}
  function setValue(id,next){const element=document.getElementById(id);if(element)element.value=next??''}
  function notify(message){if(typeof window.toast==='function')window.toast(message);else alert(message)}

  function clearForm(){
    ['alinBannerId','alinBannerTitle','alinBannerText','alinBannerLink','alinBannerStart','alinBannerEnd','alinBannerSort']
      .forEach(id=>setValue(id,''));
    const file=document.getElementById('alinBannerFile');if(file)file.value='';
    const save=document.getElementById('alinBannerSave');if(save)save.textContent='إضافة البنر';
  }

  async function uploadImage(file){
    if(!file)return '';
    if(typeof window.uploadFile!=='function')throw new Error('خدمة رفع الصور غير جاهزة');
    const result=await window.uploadFile('banners',file,{type:'image',required:true});
    if(!result)throw new Error('لم يتم استلام مسار الصورة بعد الرفع');
    return typeof result==='string'?result:(result.path||result.url||'');
  }

  async function removeStoredImage(path){
    const clean=String(path||'').replace(/^\/+|^alin-files\//g,'');
    if(!clean.startsWith('banners/'))return;
    try{
      const c=client();
      if(c?.storage){const {error}=await c.storage.from('alin-files').remove([clean]);if(error)console.warn('[ALIN banners] storage cleanup',error)}
    }catch(error){console.warn('[ALIN banners] storage cleanup',error)}
  }

  async function save(){
    if(state.saving)return;
    const id=value('alinBannerId');
    const title=value('alinBannerTitle');
    const text=value('alinBannerText');
    const link=value('alinBannerLink');
    const start=value('alinBannerStart')||null;
    const end=value('alinBannerEnd')||null;
    const sort=Number(value('alinBannerSort')||0);
    const file=document.getElementById('alinBannerFile')?.files?.[0];
    if(!title)return alert('اكتب عنوان البنر');
    if(start&&end&&start>end)return alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    if(link&&!safeLink(link))return alert('رابط البنر يجب أن يبدأ بـ http أو https');

    state.saving=true;
    const button=document.getElementById('alinBannerSave');
    if(button){button.disabled=true;button.textContent='جارٍ الحفظ...'}
    let newlyUploaded='';
    try{
      const old=bannerById(id);
      newlyUploaded=file?await uploadImage(file):'';
      const payload={
        title,text,link_url:link||null,
        image_path:newlyUploaded||(old?.image_path||null),
        start_date:start,end_date:end,sort_order:sort,
        active:old?enabled(old):true,updated_at:new Date().toISOString()
      };
      if(id){
        if(typeof window.update!=='function')throw new Error('خدمة تعديل البنر غير جاهزة');
        await window.update('banners',payload,{id});
        if(newlyUploaded&&old?.image_path&&old.image_path!==newlyUploaded)await removeStoredImage(old.image_path);
      }else{
        if(typeof window.insert!=='function')throw new Error('خدمة إضافة البنر غير جاهزة');
        await window.insert('banners',{
          id:typeof window.uid==='function'?window.uid('BN'):`BN-${Date.now()}`,
          ...payload,created_at:new Date().toISOString()
        });
      }
      if(typeof window.audit==='function')await window.audit('banner',`${id?'تعديل':'إضافة'} البنر ${title}`);
      await refresh();
      renderAdmin();
      clearForm();
      notify(id?'تم تعديل البنر والصورة':'تمت إضافة البنر والصورة');
    }catch(error){
      if(newlyUploaded)await removeStoredImage(newlyUploaded);
      console.error('[ALIN banners] save',error);
      alert(error?.message||'تعذر حفظ البنر');
    }finally{
      state.saving=false;
      if(button){button.disabled=false;button.textContent=id?'حفظ التعديل':'إضافة البنر'}
    }
  }

  function edit(id){
    const banner=bannerById(id);if(!banner)return;
    setValue('alinBannerId',banner.id);
    setValue('alinBannerTitle',banner.title);
    setValue('alinBannerText',banner.text);
    setValue('alinBannerLink',banner.link_url);
    setValue('alinBannerStart',String(banner.start_date||'').slice(0,10));
    setValue('alinBannerEnd',String(banner.end_date||'').slice(0,10));
    setValue('alinBannerSort',banner.sort_order||0);
    const save=document.getElementById('alinBannerSave');if(save)save.textContent='حفظ التعديل';
    document.getElementById('alinBannerTitle')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function toggle(id){
    const banner=bannerById(id);if(!banner)return;
    const next=!enabled(banner);
    try{
      await window.update('banners',{active:next,updated_at:new Date().toISOString()},{id});
      await refresh();renderAdmin();notify(next?'تم إظهار البنر':'تم إخفاء البنر');
    }catch(error){alert(error?.message||'تعذر تغيير حالة البنر')}
  }

  async function remove(id){
    const banner=bannerById(id);if(!banner)return;
    if(!confirm(`حذف البنر ${banner.title||''}؟`))return;
    try{
      await window.removeRow('banners',{id});
      await removeStoredImage(banner.image_path);
      if(typeof window.audit==='function')await window.audit('banner',`حذف البنر ${banner.title||''}`);
      await refresh();renderAdmin();notify('تم حذف البنر وصورته');
    }catch(error){alert(error?.message||'تعذر حذف البنر')}
  }

  function renderAdmin(){
    const container=document.getElementById('adminContent');
    if(!container)return;
    const list=rows().slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    container.innerHTML=`
      <section class="alin-banner-admin">
        <header class="alin-banner-admin__heading"><div><h2>الإعلانات والبنرات</h2><p>البنر المنشور يظهر مباشرة أعلى واجهة المتجر.</p></div><strong>${list.length} بنر</strong></header>
        <input id="alinBannerId" type="hidden">
        <div class="alin-banner-form">
          <label><span>عنوان البنر</span><input id="alinBannerTitle" maxlength="120" placeholder="مثال: عروض العودة إلى المدارس"></label>
          <label><span>نص الإعلان</span><textarea id="alinBannerText" maxlength="500" placeholder="وصف مختصر وواضح"></textarea></label>
          <label><span>رابط عند الضغط — اختياري</span><input id="alinBannerLink" inputmode="url" placeholder="https://..."></label>
          <label class="alin-banner-file"><span>صورة البنر</span><input id="alinBannerFile" type="file" accept="image/png,image/jpeg,image/webp"><small>المقاس المقترح للكمبيوتر 1600 × 500. النص يظهر تلقائيًا أسفل الصورة، وعلى الموبايل تتكيف القطعة دون تشويه الصورة.</small></label>
          <label><span>تاريخ البداية</span><input id="alinBannerStart" type="date"></label>
          <label><span>تاريخ النهاية</span><input id="alinBannerEnd" type="date"></label>
          <label><span>ترتيب الظهور</span><input id="alinBannerSort" type="number" min="0" value="0"></label>
          <div class="alin-banner-form__actions"><button id="alinBannerSave" type="button">إضافة البنر</button><button id="alinBannerClear" class="secondary" type="button">تفريغ الحقول</button></div>
        </div>
        <div class="alin-banner-list">${list.map(banner=>{
          const image=imageUrl(banner);
          return `<article class="alin-banner-row">
            <div class="alin-banner-preview">${image?`<img src="${esc(image)}" alt="${esc(banner.title||'بنر')}">`:'<span>لا توجد صورة</span>'}</div>
            <div class="alin-banner-info"><div><h3>${esc(banner.title||'بدون عنوان')}</h3><em class="${enabled(banner)?'active':'hidden'}">${enabled(banner)?'ظاهر':'مخفي'}</em></div><p>${esc(banner.text||'')}</p><small>${banner.start_date||'بدون بداية'} — ${banner.end_date||'بدون نهاية'} • ترتيب ${Number(banner.sort_order)||0}</small></div>
            <div class="alin-banner-actions"><button type="button" data-banner-action="edit" data-id="${esc(banner.id)}">تعديل</button><button type="button" class="secondary" data-banner-action="toggle" data-id="${esc(banner.id)}">${enabled(banner)?'إخفاء':'إظهار'}</button><button type="button" class="danger" data-banner-action="delete" data-id="${esc(banner.id)}">حذف</button></div>
          </article>`;
        }).join('')||'<div class="alin-banner-empty">لا توجد بنرات مضافة حالياً.</div>'}</div>
      </section>`;
    document.getElementById('alinBannerSave')?.addEventListener('click',save);
    document.getElementById('alinBannerClear')?.addEventListener('click',clearForm);
    container.querySelectorAll('[data-banner-action]').forEach(button=>button.addEventListener('click',()=>{
      const {bannerAction,id}=button.dataset;
      if(bannerAction==='edit')edit(id);
      else if(bannerAction==='toggle')toggle(id);
      else if(bannerAction==='delete')remove(id);
    }));
  }

  function install(){
    if(state.installed)return;state.installed=true;
    const oldAdmin=window.adminTab;
    if(typeof oldAdmin==='function')window.adminTab=function(tab){
      if(['ads','banners','advertisements'].includes(tab)){
        window.activeAdminTab='ads';
        renderAdmin();
        return;
      }
      return oldAdmin.apply(this,arguments);
    };
    document.addEventListener('alin:store-rendered',()=>setTimeout(renderStorefront,0));
    window.addEventListener('alin:data-mutated',event=>{if(event.detail?.table==='banners')refresh()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    refresh();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.AlinBanners=Object.freeze({refresh,renderStorefront,renderAdmin});
})();
