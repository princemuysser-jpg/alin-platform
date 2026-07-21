// === admin/branding.js ===
/* ALIN v2.3.0 — authoritative visual identity owner. No function wrapping. */
(function(){
  'use strict';
  const defaults={theme:'education',primary:'#0b2345',secondary:'#e1aa32',background:'#f5f7fb',card:'#ffffff',success:'#15803d',warning:'#b7791f',danger:'#b42318',font:'Cairo',radius:18,shadow:'soft',logo:'',logoDark:'',icon:''};
  const templates={classic:{theme:'classic',primary:'#1d4ed8',secondary:'#f59e0b',background:'#f8fafc',card:'#ffffff'},dark:{theme:'dark',primary:'#171717',secondary:'#d4a72c',background:'#f3f4f6',card:'#ffffff'},education:{theme:'education',primary:'#0b2345',secondary:'#e1aa32',background:'#f5f7fb',card:'#ffffff'}};
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const settings=()=>window.db?.settings||{};
  const stored=()=>{try{return JSON.parse(localStorage.getItem('alin_visual_identity_v227')||'{}')}catch(_){return{}}};
  const urlOf=value=>{if(!value)return '';if(/^https?:|^blob:|^data:/i.test(String(value)))return String(value);try{return window.mediaUrl?.(value)||String(value)}catch(_){return String(value)}};
  const shadowValue=name=>name==='none'?'none':name==='medium'?'0 14px 34px rgba(7,26,55,.11)':'0 8px 24px rgba(7,26,55,.07)';

  function current(){const s=settings(),local=stored();return {...defaults,...local,theme:s.visual_theme||local.theme||defaults.theme,primary:s.visual_primary||local.primary||defaults.primary,secondary:s.visual_secondary||local.secondary||defaults.secondary,background:s.visual_background||local.background||defaults.background,card:s.visual_card||local.card||defaults.card,success:s.visual_success||local.success||defaults.success,warning:s.visual_warning||local.warning||defaults.warning,danger:s.visual_danger||local.danger||defaults.danger,font:s.visual_font||local.font||defaults.font,radius:Number(s.visual_radius||local.radius||defaults.radius),shadow:s.visual_shadow||local.shadow||defaults.shadow,logo:s.platform_logo_path||s.platform_logo_url||local.logo||'',logoDark:s.platform_logo_dark_path||local.logoDark||'',icon:s.platform_icon_path||s.platform_icon_url||local.icon||''}}

  function setLogo(node,url,fallback='آ'){
    if(!node)return;
    if(url)node.innerHTML=`<img class="logo-img" src="${escv(url)}" alt="شعار آلين" style="width:100%;height:100%;object-fit:contain">`;
    else node.textContent=fallback;
  }
  function applyTheme(identity=current()){
    const style=document.documentElement.style;
    style.setProperty('--alin-primary',identity.primary);style.setProperty('--alin-primary-2',identity.primary);style.setProperty('--alin-primary-3',identity.primary);
    style.setProperty('--alin-gold',identity.secondary);style.setProperty('--alin-gold-2',identity.secondary);style.setProperty('--alin-bg',identity.background);style.setProperty('--alin-surface',identity.card);style.setProperty('--alin-surface-2',identity.card);
    style.setProperty('--alin-success',identity.success);style.setProperty('--alin-warning',identity.warning);style.setProperty('--alin-danger',identity.danger);style.setProperty('--alin-radius-lg',`${identity.radius}px`);style.setProperty('--alin-radius-md',`${Math.max(10,identity.radius-4)}px`);style.setProperty('--alin-shadow-md',shadowValue(identity.shadow));
    if(document.body)document.body.style.fontFamily=`"${identity.font}",Tahoma,"Segoe UI",sans-serif`;
    document.documentElement.dataset.alinTheme=identity.theme||'custom';
    const name=settings().platform_name||'منصة آلين',logo=urlOf(identity.logo),icon=urlOf(identity.icon);
    document.title=name;
    document.querySelectorAll('.brand b').forEach(node=>node.textContent=name.replace('منصة ',''));
    document.querySelectorAll('.login-card .logo').forEach(node=>setLogo(node,logo,'آ'));
    document.querySelectorAll('.topbar .logo.small').forEach(node=>setLogo(node,icon||logo,'آ'));
    document.querySelectorAll('.alin98-logo').forEach(node=>setLogo(node,logo||icon,'آ'));
    if(icon)document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link=>link.href=icon);
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content=identity.primary;
    window.dispatchEvent(new CustomEvent('alin:brand-applied',{detail:{identity}}));
    return identity;
  }
  function applyBrand(){return applyTheme(current())}

  async function uploadBrandFile(file,kind){
    if(!file)return '';
    const allowed=kind==='icon'?['image/png','image/jpeg','image/webp']:['image/png','image/jpeg','image/webp','image/svg+xml'];
    if(!allowed.includes(file.type))throw new Error('صيغة الصورة غير مدعومة');
    if(file.size>3*1024*1024)throw new Error('حجم الصورة يجب أن يكون أقل من 3MB');
    if(typeof window.uploadFile!=='function')throw new Error('خدمة رفع الصور غير متاحة');
    return window.uploadFile(`brand/${kind}`,file,{required:true,type:'image',maxBytes:3*1024*1024});
  }
  async function saveIdentity(identity){
    if(typeof window.settingsSet!=='function')throw new Error('خدمة الإعدادات غير جاهزة');
    const map={visual_theme:identity.theme,visual_primary:identity.primary,visual_secondary:identity.secondary,visual_background:identity.background,visual_card:identity.card,visual_success:identity.success,visual_warning:identity.warning,visual_danger:identity.danger,visual_font:identity.font,visual_radius:identity.radius,visual_shadow:identity.shadow,platform_logo_path:identity.logo||'',platform_logo_dark_path:identity.logoDark||'',platform_icon_path:identity.icon||''};
    for(const [key,value] of Object.entries(map))await window.settingsSet(key,value);
    localStorage.setItem('alin_visual_identity_v227',JSON.stringify(identity));
    applyTheme(identity);
    if(typeof window.audit==='function')await window.audit('brand','تحديث الهوية البصرية للمنصة');
    return identity;
  }

  function preview(box,file){if(!box||!file)return;const url=URL.createObjectURL(file);box.innerHTML=`<img src="${url}" alt="معاينة">`;box.dataset.previewUrl=url}
  function render(root=document.getElementById('adminContent')){
    if(!root)return;const base=current();let draft={...base};
    root.className='admin-brand-v176';
    root.innerHTML=`<header class="ab176-head"><div><h2>الهوية البصرية</h2><p>شعار وألوان وخطوط موحدة لكل صفحات منصة آلين.</p></div><span>v2.3.0</span></header><div class="ab176-layout"><main>
      <section class="ab176-card"><h3>قوالب جاهزة</h3><div class="ab176-templates">${Object.entries({classic:'Alin Classic',dark:'Dark Pro',education:'Education'}).map(([key,label])=>`<button class="ab176-template ${draft.theme===key?'active':''}" data-theme="${key}"><span class="ab176-swatches"><i style="background:${templates[key].primary}"></i><i style="background:${templates[key].secondary}"></i><i style="background:${templates[key].background}"></i></span><b>${label}</b></button>`).join('')}</div></section>
      <section class="ab176-card"><h3>الشعار والأيقونة</h3><div class="ab176-uploads"><div class="ab176-upload"><div id="ab176LogoPreview" class="ab176-upload-preview">${draft.logo?`<img src="${escv(urlOf(draft.logo))}" alt="الشعار">`:'آ'}</div><div class="ab176-field"><label>الشعار الأساسي</label><input id="ab176Logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></div></div><div class="ab176-upload"><div id="ab176DarkLogoPreview" class="ab176-upload-preview">${draft.logoDark?`<img src="${escv(urlOf(draft.logoDark))}" alt="شعار الوضع الداكن">`:'آ'}</div><div class="ab176-field"><label>شعار الوضع الداكن</label><input id="ab176DarkLogo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></div></div><div class="ab176-upload"><div id="ab176IconPreview" class="ab176-upload-preview">${draft.icon?`<img src="${escv(urlOf(draft.icon))}" alt="أيقونة التطبيق">`:'آ'}</div><div class="ab176-field"><label>أيقونة التطبيق</label><input id="ab176Icon" type="file" accept="image/png,image/jpeg,image/webp"></div></div></div></section>
      <section class="ab176-card"><h3>الألوان والتنسيق</h3><div class="ab176-grid">${[['primary','اللون الأساسي'],['secondary','اللون الثانوي'],['background','الخلفية'],['card','البطاقات'],['success','النجاح'],['warning','التنبيه'],['danger','الخطر']].map(([key,label])=>`<label>${label}<input type="color" data-color="${key}" value="${escv(draft[key])}"></label>`).join('')}<label>الخط<select id="ab176Font"><option value="Cairo" ${draft.font==='Cairo'?'selected':''}>Cairo</option><option value="Tajawal" ${draft.font==='Tajawal'?'selected':''}>Tajawal</option><option value="Arial" ${draft.font==='Arial'?'selected':''}>Arial</option></select></label><label>استدارة البطاقات<input id="ab176Radius" type="range" min="8" max="28" value="${draft.radius}"><small>${draft.radius}px</small></label><label>الظل<select id="ab176Shadow"><option value="none" ${draft.shadow==='none'?'selected':''}>بدون</option><option value="soft" ${draft.shadow==='soft'?'selected':''}>خفيف</option><option value="medium" ${draft.shadow==='medium'?'selected':''}>متوسط</option></select></label></div><div class="ab176-actions"><button id="ab176Reset" class="secondary">استعادة الافتراضي</button><button id="ab176Save">حفظ وتطبيق الهوية</button></div><div id="ab176Status" class="ab176-status"></div></section>
    </main><aside class="ab176-preview-wrap"><div class="ab176-card"><h3>معاينة مباشرة</h3><div id="ab176Preview" class="ab176-preview"><div class="ab176-preview-top"><div class="ab176-preview-brand"><span id="ab176PreviewLogo" class="ab176-preview-logo">آ</span><div><b>منصة آلين</b><small style="display:block;opacity:.75">للملازم والقرطاسية</small></div></div></div><div class="ab176-preview-body"><div class="ab176-preview-hero"><h4>كل ما تحتاجه للدراسة</h4><p>هوية موحدة وجذابة لكل صفحات المنصة.</p><button>تصفح المتجر</button></div><div class="ab176-preview-cards"><div class="ab176-preview-card"><b>الطلبات</b><small>24 طلباً</small></div><div class="ab176-preview-card"><b>الأرباح</b><small>125,000 د.ع</small></div></div></div></div></div></aside></div>`;
    const sync=()=>{const panel=root.querySelector('#ab176Preview');if(!panel)return;panel.style.setProperty('--ab-primary',draft.primary);panel.style.setProperty('--ab-secondary',draft.secondary);panel.style.setProperty('--ab-bg',draft.background);panel.style.setProperty('--ab-card',draft.card);panel.style.setProperty('--ab-font',`"${draft.font}",Tahoma,sans-serif`);panel.style.setProperty('--ab-radius',`${draft.radius}px`);panel.style.setProperty('--ab-shadow',shadowValue(draft.shadow));root.querySelector('#ab176PreviewLogo').innerHTML=draft.logo?`<img src="${escv(urlOf(draft.logo))}" alt="الشعار">`:'آ'};
    sync();
    root.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>{root.querySelectorAll('[data-theme]').forEach(item=>item.classList.toggle('active',item===button));draft={...draft,...templates[button.dataset.theme]};root.querySelectorAll('[data-color]').forEach(input=>input.value=draft[input.dataset.color]);sync()}));
    root.querySelectorAll('[data-color]').forEach(input=>input.addEventListener('input',()=>{draft[input.dataset.color]=input.value;draft.theme='custom';sync()}));
    root.querySelector('#ab176Font').addEventListener('change',event=>{draft.font=event.target.value;sync()});root.querySelector('#ab176Shadow').addEventListener('change',event=>{draft.shadow=event.target.value;sync()});root.querySelector('#ab176Radius').addEventListener('input',event=>{draft.radius=Number(event.target.value);event.target.nextElementSibling.textContent=`${draft.radius}px`;sync()});
    const logo=root.querySelector('#ab176Logo'),dark=root.querySelector('#ab176DarkLogo'),icon=root.querySelector('#ab176Icon');logo.addEventListener('change',()=>{if(logo.files[0]){preview(root.querySelector('#ab176LogoPreview'),logo.files[0]);draft.logo=URL.createObjectURL(logo.files[0]);sync()}});dark.addEventListener('change',()=>{if(dark.files[0])preview(root.querySelector('#ab176DarkLogoPreview'),dark.files[0])});icon.addEventListener('change',()=>{if(icon.files[0])preview(root.querySelector('#ab176IconPreview'),icon.files[0])});
    root.querySelector('#ab176Reset').addEventListener('click',async()=>{if(!confirm('استعادة هوية آلين الافتراضية؟'))return;const message=root.querySelector('#ab176Status');try{await saveIdentity({...defaults});message.className='ab176-status ok';message.textContent='تمت استعادة الهوية الافتراضية';render(root)}catch(error){message.className='ab176-status err';message.textContent=error.message||'تعذر الاستعادة'}});
    root.querySelector('#ab176Save').addEventListener('click',async()=>{const message=root.querySelector('#ab176Status');message.className='ab176-status';message.textContent='جارٍ حفظ الهوية...';try{if(logo.files[0])draft.logo=await uploadBrandFile(logo.files[0],'logo');if(dark.files[0])draft.logoDark=await uploadBrandFile(dark.files[0],'logo-dark');if(icon.files[0])draft.icon=await uploadBrandFile(icon.files[0],'icon');await saveIdentity(draft);message.className='ab176-status ok';message.textContent='تم حفظ وتطبيق الهوية البصرية بنجاح';window.toast?.('تم تطبيق الهوية البصرية')}catch(error){message.className='ab176-status err';message.textContent=error.message||'تعذر حفظ الهوية'}});
  }

  Object.assign(window,{applyBrand,applyBrandV28:applyBrand,uploadBrandFile,saveBrandIdentity:saveIdentity,resetBrandIdentity:()=>saveIdentity({...defaults})});
  function install(){applyBrand();window.AlinAdminModules?.register?.('brandIdentity',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('alin:data-refreshed',applyBrand);window.addEventListener('alin:settings-updated',applyBrand);
  window.AlinBrand=Object.freeze({current,apply:applyBrand,render,save:saveIdentity,upload:uploadBrandFile});
})();

;
