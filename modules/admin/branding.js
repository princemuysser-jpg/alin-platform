// === admin/branding.js ===
/* ALIN v2.3.9 — visual identity editor with calm presets and appearance-safe theming. */
(function(){
  'use strict';

  const STORAGE_KEY='alin_visual_identity_v235';
  const LEGACY_STORAGE_KEY='alin_visual_identity_v227';
  const defaults={
    theme:'alin-original',
    primary:'#0b3158',secondary:'#c9a24a',background:'#f6f8fb',card:'#ffffff',
    success:'#2f7d62',warning:'#b98532',danger:'#b44b4b',
    font:'Cairo',radius:18,shadow:'soft',logo:'',logoDark:'',icon:''
  };

  const templates={
    'alin-original':{
      label:'آلين الأصلي',description:'أزرق هادئ مع لمسة ذهبية',
      theme:'alin-original',primary:'#0b3158',secondary:'#c9a24a',background:'#f6f8fb',card:'#ffffff',success:'#2f7d62',warning:'#b98532',danger:'#b44b4b',font:'Cairo',radius:18,shadow:'soft'
    },
    'sky-calm':{
      label:'سماء هادئة',description:'أزرق ضبابي ومريح للعين',
      theme:'sky-calm',primary:'#315d7a',secondary:'#9eb9c9',background:'#f3f7f9',card:'#ffffff',success:'#4e806d',warning:'#b38a4e',danger:'#a95b5b',font:'Tajawal',radius:20,shadow:'soft'
    },
    'sage-calm':{
      label:'مريمي هادئ',description:'أخضر طبيعي بطابع دراسي',
      theme:'sage-calm',primary:'#456b5f',secondary:'#b9a878',background:'#f4f7f3',card:'#ffffff',success:'#3f7b5d',warning:'#a98045',danger:'#a95555',font:'Cairo',radius:20,shadow:'soft'
    },
    'sand-calm':{
      label:'رملي دافئ',description:'ألوان دافئة وخفيفة',
      theme:'sand-calm',primary:'#6f5948',secondary:'#c2a278',background:'#faf7f1',card:'#fffdfa',success:'#5f8067',warning:'#ad7b3c',danger:'#aa5952',font:'Tajawal',radius:18,shadow:'soft'
    },
    'lavender-calm':{
      label:'لافندر هادئ',description:'بنفسجي ناعم بدون إزعاج',
      theme:'lavender-calm',primary:'#5d5d7d',secondary:'#b8afca',background:'#f7f6fa',card:'#ffffff',success:'#5e806e',warning:'#a98652',danger:'#a95b67',font:'Cairo',radius:22,shadow:'soft'
    },
    'rose-calm':{
      label:'وردي ترابي',description:'لون راقٍ ومناسب للهدايا',
      theme:'rose-calm',primary:'#765861',secondary:'#d0aeb5',background:'#faf6f7',card:'#ffffff',success:'#5b7d6b',warning:'#aa8050',danger:'#a64f5a',font:'Tajawal',radius:22,shadow:'soft'
    },
    'graphite-calm':{
      label:'رمادي احترافي',description:'محايد وهادئ للوحات الإدارة',
      theme:'graphite-calm',primary:'#3f4b59',secondary:'#aeb7c0',background:'#f4f6f8',card:'#ffffff',success:'#4d7b69',warning:'#9e7d4e',danger:'#a65353',font:'Cairo',radius:16,shadow:'soft'
    }
  };

  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const t=value=>window.AlinI18n?.t?.(value)||value;
  const settings=()=>window.db?.settings||{};
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min));
  const normalizeTheme=value=>value==='dark'?'graphite-calm':(templates[value]?value:'custom');
  const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return{}}};
  const stored=()=>({...readJson(LEGACY_STORAGE_KEY),...readJson(STORAGE_KEY)});
  const urlOf=value=>{if(!value)return '';if(/^https?:|^blob:|^data:/i.test(String(value)))return String(value);try{return window.mediaUrl?.(value)||String(value)}catch(_){return String(value)}};
  const validHex=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
  const hexToRgb=hex=>{const value=validHex(hex,'#000000').slice(1);return [0,2,4].map(index=>parseInt(value.slice(index,index+2),16))};
  const rgbToHex=rgb=>'#'+rgb.map(value=>Math.round(clamp(value,0,255)).toString(16).padStart(2,'0')).join('');
  const mix=(a,b,weight=.5)=>{const first=hexToRgb(a),second=hexToRgb(b);return rgbToHex(first.map((value,index)=>value+(second[index]-value)*weight))};
  const shadowValue=name=>name==='none'?'none':name==='medium'?'0 14px 34px rgba(7,26,55,.12)':'0 8px 24px rgba(7,26,55,.075)';

  function normalizeIdentity(identity={}){
    return {
      ...defaults,...identity,
      theme:normalizeTheme(identity.theme||defaults.theme),
      primary:validHex(identity.primary,defaults.primary),secondary:validHex(identity.secondary,defaults.secondary),
      background:validHex(identity.background,defaults.background),card:validHex(identity.card,defaults.card),
      success:validHex(identity.success,defaults.success),warning:validHex(identity.warning,defaults.warning),danger:validHex(identity.danger,defaults.danger),
      font:['Cairo','Tajawal','Arial'].includes(identity.font)?identity.font:defaults.font,
      radius:clamp(identity.radius,8,28),shadow:['none','soft','medium'].includes(identity.shadow)?identity.shadow:defaults.shadow,
      logo:String(identity.logo||''),logoDark:String(identity.logoDark||''),icon:String(identity.icon||'')
    };
  }

  function current(){
    const s=settings(),local=stored();
    return normalizeIdentity({
      ...local,
      theme:s.visual_theme||local.theme||defaults.theme,
      primary:s.visual_primary||local.primary||defaults.primary,
      secondary:s.visual_secondary||local.secondary||defaults.secondary,
      background:s.visual_background||local.background||defaults.background,
      card:s.visual_card||local.card||defaults.card,
      success:s.visual_success||local.success||defaults.success,
      warning:s.visual_warning||local.warning||defaults.warning,
      danger:s.visual_danger||local.danger||defaults.danger,
      font:s.visual_font||local.font||defaults.font,
      radius:s.visual_radius||local.radius||defaults.radius,
      shadow:s.visual_shadow||local.shadow||defaults.shadow,
      logo:s.platform_logo_path||s.platform_logo_url||local.logo||'',
      logoDark:s.platform_logo_dark_path||local.logoDark||'',
      icon:s.platform_icon_path||s.platform_icon_url||local.icon||''
    });
  }

  function setLogo(node,url,fallback='آ'){
    if(!node)return;
    if(url)node.innerHTML=`<img class="logo-img" src="${escv(url)}" alt="${escv(t('شعار منصة آلين'))}">`;
    else node.textContent=fallback;
  }

  function applyPalette(identity){
    const root=document.documentElement,style=root.style;
    const dark=root.dataset.alinTheme==='dark';
    const darkBg=mix(identity.primary,'#000000',.72);
    const darkSurface=mix(identity.primary,'#000000',.58);
    const darkSoft=mix(identity.primary,'#000000',.45);
    const border=dark?mix(identity.primary,'#ffffff',.22):mix(identity.primary,'#ffffff',.82);
    style.setProperty('--alin-primary',identity.primary);
    style.setProperty('--alin-primary-2',mix(identity.primary,'#ffffff',.12));
    style.setProperty('--alin-primary-3',mix(identity.primary,'#000000',.12));
    style.setProperty('--alin-gold',identity.secondary);
    style.setProperty('--alin-gold-2',mix(identity.secondary,'#ffffff',.14));
    style.setProperty('--alin-bg',dark?darkBg:identity.background);
    style.setProperty('--alin-surface',dark?darkSurface:identity.card);
    style.setProperty('--alin-surface-2',dark?darkSoft:mix(identity.card,identity.background,.45));
    style.setProperty('--alin-success',identity.success);
    style.setProperty('--alin-warning',identity.warning);
    style.setProperty('--alin-danger',identity.danger);
    style.setProperty('--alin-radius-lg',`${identity.radius}px`);
    style.setProperty('--alin-radius-md',`${Math.max(10,identity.radius-4)}px`);
    style.setProperty('--alin-shadow-md',shadowValue(identity.shadow));
    style.setProperty('--ao-ink',dark?'#f3f6f8':identity.primary);
    style.setProperty('--ao-gold',identity.secondary);
    style.setProperty('--ao-bg',dark?darkBg:identity.background);
    style.setProperty('--ao-surface',dark?darkSurface:identity.card);
    style.setProperty('--ao-soft',dark?darkSoft:mix(identity.background,identity.card,.5));
    style.setProperty('--ao-border',border);
    style.setProperty('--ao-muted',dark?'#b8c3cc':mix(identity.primary,'#ffffff',.42));
    style.setProperty('--ao-shadow',dark?'0 28px 80px rgba(0,0,0,.48)':shadowValue(identity.shadow));
  }

  function applyTheme(identity=current()){
    identity=normalizeIdentity(identity);
    applyPalette(identity);
    if(document.body)document.body.style.fontFamily=`"${identity.font}",Tahoma,"Segoe UI",sans-serif`;
    // Brand preset and light/dark appearance are separate. Never overwrite data-alin-theme here.
    document.documentElement.dataset.alinBrandTheme=identity.theme||'custom';
    const name=settings().platform_name||'منصة آلين';
    const useDarkLogo=document.documentElement.dataset.alinTheme==='dark'&&identity.logoDark;
    const logo=urlOf(useDarkLogo||identity.logo),icon=urlOf(identity.icon);
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
    identity=normalizeIdentity(identity);
    if(typeof window.settingsSet!=='function')throw new Error('خدمة الإعدادات غير جاهزة');
    const map={
      visual_theme:identity.theme,visual_primary:identity.primary,visual_secondary:identity.secondary,
      visual_background:identity.background,visual_card:identity.card,visual_success:identity.success,
      visual_warning:identity.warning,visual_danger:identity.danger,visual_font:identity.font,
      visual_radius:identity.radius,visual_shadow:identity.shadow,platform_logo_path:identity.logo||'',
      platform_logo_dark_path:identity.logoDark||'',platform_icon_path:identity.icon||''
    };
    for(const [key,value] of Object.entries(map))await window.settingsSet(key,value);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(identity));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    applyTheme(identity);
    window.dispatchEvent(new CustomEvent('alin:settings-updated',{detail:{keys:Object.keys(map)}}));
    if(typeof window.audit==='function')await window.audit('brand','تحديث الهوية البصرية للمنصة');
    return identity;
  }

  function imageMarkup(value,label){return value?`<img src="${escv(urlOf(value))}" alt="${escv(label)}">`:'<span aria-hidden="true">آ</span>'}
  function previewFile(box,file){
    if(!box||!file)return '';
    if(box.dataset.previewUrl)URL.revokeObjectURL(box.dataset.previewUrl);
    const url=URL.createObjectURL(file);box.dataset.previewUrl=url;box.innerHTML=`<img src="${url}" alt="${escv(t('معاينة'))}">`;return url;
  }

  function render(root=document.getElementById('adminContent')){
    if(!root)return;
    const base=current();let draft={...base};let busy=false;
    root.className='panel admin-brand-v235';
    const templateMarkup=Object.entries(templates).map(([key,preset])=>`
      <button type="button" class="ab235-template ${draft.theme===key?'active':''}" data-theme="${key}" aria-pressed="${draft.theme===key}">
        <span class="ab235-template-preview" style="--p:${preset.primary};--s:${preset.secondary};--b:${preset.background};--c:${preset.card}">
          <i></i><i></i><i></i><i></i>
        </span>
        <span><b>${escv(preset.label)}</b><small>${escv(preset.description)}</small></span>
        <em>${draft.theme===key?'مختار':'اختيار'}</em>
      </button>`).join('');

    root.innerHTML=`
      <header class="ab235-head">
        <div><span class="ab235-eyebrow">إعدادات المظهر</span><h2>الهوية البصرية</h2><p>غيّر هوية المنصة بأمان. القالب لا يغيّر الوضع النهاري أو الليلي.</p></div>
        <span class="ab235-version">v2.3.9</span>
      </header>
      <div class="ab235-layout">
        <main class="ab235-main">
          <section class="ab235-card">
            <div class="ab235-section-head"><div><h3>قوالب جاهزة هادئة</h3><p>اختر قالبًا ثم شاهد المعاينة قبل الحفظ.</p></div><span>${Object.keys(templates).length} قوالب</span></div>
            <div class="ab235-templates">${templateMarkup}</div>
          </section>

          <section class="ab235-card">
            <div class="ab235-section-head"><div><h3>الشعار والأيقونة</h3><p>PNG أو WebP أو JPG، والشعار يقبل SVG أيضًا. الحد الأعلى 3MB.</p></div></div>
            <div class="ab235-uploads">
              <article class="ab235-upload"><div id="ab235LogoPreview" class="ab235-upload-preview">${imageMarkup(draft.logo,'الشعار الأساسي')}</div><div><b>الشعار الأساسي</b><small>يظهر في الوضع النهاري وتسجيل الدخول.</small><label class="ab235-file">اختيار صورة<input id="ab235Logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><button type="button" class="ab235-clear" data-clear="logo">إزالة</button></div></article>
              <article class="ab235-upload"><div id="ab235DarkLogoPreview" class="ab235-upload-preview">${imageMarkup(draft.logoDark,'شعار الوضع الليلي')}</div><div><b>شعار الوضع الليلي</b><small>اختياري، ويُستخدم فقط عند تفعيل الوضع الليلي.</small><label class="ab235-file">اختيار صورة<input id="ab235DarkLogo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><button type="button" class="ab235-clear" data-clear="logoDark">إزالة</button></div></article>
              <article class="ab235-upload"><div id="ab235IconPreview" class="ab235-upload-preview icon">${imageMarkup(draft.icon,'أيقونة التطبيق')}</div><div><b>أيقونة التطبيق</b><small>يفضل ملف مربع بدقة 512×512.</small><label class="ab235-file">اختيار صورة<input id="ab235Icon" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" class="ab235-clear" data-clear="icon">إزالة</button></div></article>
            </div>
          </section>

          <section class="ab235-card">
            <div class="ab235-section-head"><div><h3>تخصيص الألوان</h3><p>يمكن تعديل أي قالب يدويًا قبل الحفظ.</p></div></div>
            <div class="ab235-colors">${[
              ['primary','اللون الأساسي'],['secondary','اللون الثانوي'],['background','الخلفية'],['card','البطاقات'],['success','النجاح'],['warning','التنبيه'],['danger','الخطر']
            ].map(([key,label])=>`<label><span>${label}</span><span class="ab235-color"><input type="color" data-color="${key}" value="${escv(draft[key])}"><output data-output="${key}">${escv(draft[key].toUpperCase())}</output></span></label>`).join('')}</div>
            <div class="ab235-controls">
              <label><span>الخط</span><select id="ab235Font"><option value="Cairo" ${draft.font==='Cairo'?'selected':''}>Cairo</option><option value="Tajawal" ${draft.font==='Tajawal'?'selected':''}>Tajawal</option><option value="Arial" ${draft.font==='Arial'?'selected':''}>Arial</option></select></label>
              <label><span>استدارة البطاقات</span><div class="ab235-range"><input id="ab235Radius" type="range" min="8" max="28" value="${draft.radius}"><output>${draft.radius}px</output></div></label>
              <label><span>الظل</span><select id="ab235Shadow"><option value="none" ${draft.shadow==='none'?'selected':''}>بدون</option><option value="soft" ${draft.shadow==='soft'?'selected':''}>خفيف</option><option value="medium" ${draft.shadow==='medium'?'selected':''}>متوسط</option></select></label>
            </div>
          </section>

          <div class="ab235-actions">
            <button type="button" id="ab235Reset" class="secondary">استعادة هوية آلين</button>
            <button type="button" id="ab235Save" class="primary">حفظ وتطبيق الهوية</button>
          </div>
          <div id="ab235Status" class="ab235-status" role="status" aria-live="polite"></div>
        </main>

        <aside class="ab235-preview-wrap">
          <section class="ab235-card ab235-sticky"><div class="ab235-section-head"><div><h3>معاينة مباشرة</h3><p>هذه المعاينة لا تغيّر المنصة إلا بعد الحفظ.</p></div></div>
            <div id="ab235Preview" class="ab235-preview">
              <div class="ab235-preview-top"><div class="ab235-preview-brand"><span id="ab235PreviewLogo" class="ab235-preview-logo">${imageMarkup(draft.logo,'شعار منصة آلين')}</span><div><b>منصة آلين</b><small>للملازم والقرطاسية والهدايا</small></div></div><span class="ab235-preview-bell">◌</span></div>
              <div class="ab235-preview-body"><div class="ab235-preview-hero"><small>كل ما يحتاجه الطالب</small><h4>دراسة أسهل بتصميم هادئ</h4><p>ملازم وقرطاسية وهدايا في مكان واحد.</p><button type="button">تصفح المتجر</button></div><div class="ab235-preview-cards"><article><span>الملازم</span><b>24</b></article><article><span>الطلبات</span><b>12</b></article><article><span>المكتبات</span><b>6</b></article></div></div>
            </div>
            <div class="ab235-note">الوضع النهاري والليلي يبقيان مستقلين عن القالب المختار.</div>
          </section>
        </aside>
      </div>`;

    const preview=root.querySelector('#ab235Preview');
    const status=root.querySelector('#ab235Status');
    const saveButton=root.querySelector('#ab235Save');
    const logoInput=root.querySelector('#ab235Logo');
    const darkLogoInput=root.querySelector('#ab235DarkLogo');
    const iconInput=root.querySelector('#ab235Icon');

    const sync=()=>{
      if(!preview)return;
      preview.style.setProperty('--ab-primary',draft.primary);preview.style.setProperty('--ab-secondary',draft.secondary);
      preview.style.setProperty('--ab-bg',draft.background);preview.style.setProperty('--ab-card',draft.card);
      preview.style.setProperty('--ab-font',`"${draft.font}",Tahoma,sans-serif`);preview.style.setProperty('--ab-radius',`${draft.radius}px`);
      preview.style.setProperty('--ab-shadow',shadowValue(draft.shadow));
      root.querySelector('#ab235PreviewLogo').innerHTML=imageMarkup(draft.logo,'شعار منصة آلين');
      root.querySelectorAll('.ab235-template').forEach(button=>{
        const active=button.dataset.theme===draft.theme;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
        const label=button.querySelector('em');if(label)label.textContent=active?'مختار':'اختيار';
      });
      root.querySelectorAll('[data-color]').forEach(input=>{if(input.value.toLowerCase()!==draft[input.dataset.color].toLowerCase())input.value=draft[input.dataset.color]});
      root.querySelectorAll('[data-output]').forEach(output=>output.textContent=String(draft[output.dataset.output]).toUpperCase());
      root.querySelector('#ab235Font').value=draft.font;root.querySelector('#ab235Shadow').value=draft.shadow;
      const radius=root.querySelector('#ab235Radius');radius.value=draft.radius;radius.nextElementSibling.textContent=`${draft.radius}px`;
    };

    root.querySelectorAll('.ab235-template').forEach(button=>button.addEventListener('click',()=>{
      const preset=templates[button.dataset.theme];if(!preset)return;draft=normalizeIdentity({...draft,...preset});sync();
    }));
    root.querySelectorAll('[data-color]').forEach(input=>input.addEventListener('input',()=>{draft[input.dataset.color]=input.value;draft.theme='custom';sync()}));
    root.querySelector('#ab235Font').addEventListener('change',event=>{draft.font=event.target.value;draft.theme='custom';sync()});
    root.querySelector('#ab235Shadow').addEventListener('change',event=>{draft.shadow=event.target.value;draft.theme='custom';sync()});
    root.querySelector('#ab235Radius').addEventListener('input',event=>{draft.radius=Number(event.target.value);draft.theme='custom';sync()});

    logoInput.addEventListener('change',()=>{if(logoInput.files[0]){draft.logo=previewFile(root.querySelector('#ab235LogoPreview'),logoInput.files[0]);sync()}});
    darkLogoInput.addEventListener('change',()=>{if(darkLogoInput.files[0]){draft.logoDark=previewFile(root.querySelector('#ab235DarkLogoPreview'),darkLogoInput.files[0])}});
    iconInput.addEventListener('change',()=>{if(iconInput.files[0]){draft.icon=previewFile(root.querySelector('#ab235IconPreview'),iconInput.files[0])}});
    root.querySelectorAll('[data-clear]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.clear;draft[key]='';const map={logo:['#ab235LogoPreview',logoInput],logoDark:['#ab235DarkLogoPreview',darkLogoInput],icon:['#ab235IconPreview',iconInput]};
      const [selector,input]=map[key];input.value='';root.querySelector(selector).innerHTML='<span aria-hidden="true">آ</span>';sync();
    }));

    root.querySelector('#ab235Reset').addEventListener('click',async()=>{
      if(busy||!confirm('استعادة هوية آلين الافتراضية؟'))return;busy=true;saveButton.disabled=true;status.className='ab235-status';status.textContent='جارٍ استعادة الهوية...';
      try{await saveIdentity({...defaults});status.className='ab235-status ok';status.textContent='تمت استعادة هوية آلين الافتراضية';window.toast?.('تمت استعادة الهوية');render(root)}
      catch(error){status.className='ab235-status err';status.textContent=error.message||'تعذر الاستعادة'}finally{busy=false;saveButton.disabled=false}
    });

    saveButton.addEventListener('click',async()=>{
      if(busy)return;busy=true;saveButton.disabled=true;status.className='ab235-status';status.textContent='جارٍ رفع الصور وحفظ الهوية...';
      try{
        if(logoInput.files[0])draft.logo=await uploadBrandFile(logoInput.files[0],'logo');
        if(darkLogoInput.files[0])draft.logoDark=await uploadBrandFile(darkLogoInput.files[0],'logo-dark');
        if(iconInput.files[0])draft.icon=await uploadBrandFile(iconInput.files[0],'icon');
        draft=await saveIdentity(draft);status.className='ab235-status ok';status.textContent='تم حفظ وتطبيق الهوية على جميع صفحات المنصة';window.toast?.('تم تطبيق الهوية البصرية');sync();
      }catch(error){status.className='ab235-status err';status.textContent=error.message||'تعذر حفظ الهوية'}finally{busy=false;saveButton.disabled=false}
    });
    sync();
  }

  Object.assign(window,{applyBrand,applyBrandV28:applyBrand,uploadBrandFile,saveBrandIdentity:saveIdentity,resetBrandIdentity:()=>saveIdentity({...defaults})});
  function install(){applyBrand();window.AlinAdminModules?.register?.('brandIdentity',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('alin:data-refreshed',applyBrand);
  window.addEventListener('alin:settings-updated',applyBrand);
  window.addEventListener('alin:theme-changed',applyBrand);
  window.AlinBrand=Object.freeze({current,apply:applyBrand,render,save:saveIdentity,upload:uploadBrandFile,templates:Object.freeze({...templates})});
})();

;
