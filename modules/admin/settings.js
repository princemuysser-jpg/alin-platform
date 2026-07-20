// === admin/settings.js ===
/* ===== admin/js/admin-settings-v144.js ===== */
(function(){
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=()=>{try{return typeof db!=='undefined'?(db.settings||{}):{}}catch(e){return {}}};
  const val=(k,d='')=>state()[k]??d;
  const brandUrl=path=>{if(!path)return '';if(String(path).startsWith('http')||String(path).startsWith('blob:')||String(path).startsWith('data:'))return String(path);try{return typeof mediaUrl==='function'?mediaUrl(path):String(path)}catch(e){return String(path)}};
  function brandPreview(kind){const s=state(),path=kind==='logo'?(s.platform_logo_path||s.platform_logo_url):(s.platform_icon_path||s.platform_icon_url),url=brandUrl(path);return url?`<img src="${escv(url)}" alt="${kind==='logo'?'شعار المنصة':'أيقونة التطبيق'}">`:'<span>آ</span>'}
  function updateBrandPreview(box,file){if(!box)return;if(!file){box.innerHTML='<span>آ</span>';return}const url=URL.createObjectURL(file);box.innerHTML=`<img src="${url}" alt="معاينة">`;box.dataset.previewUrl=url}
  async function uploadIdentity(file,kind){if(!file)return '';const allowed=kind==='logo'?['image/png','image/jpeg','image/webp','image/svg+xml']:['image/png','image/jpeg','image/webp'];if(!allowed.includes(file.type))throw new Error('صيغة الصورة غير مدعومة');if(file.size>2*1024*1024)throw new Error('حجم الصورة يجب أن يكون أقل من 2MB');if(typeof uploadBrandFile==='function')return uploadBrandFile(file,kind);if(typeof uploadFile==='function')return uploadFile('brand/'+kind,file);throw new Error('وظيفة رفع الصور غير متاحة')}
  function applyIdentityNow(){try{if(typeof applyBrandV28==='function')applyBrandV28();const s=state(),logo=brandUrl(s.platform_logo_path||s.platform_logo_url),icon=brandUrl(s.platform_icon_path||s.platform_icon_url);document.querySelectorAll('.alin98-logo').forEach(el=>{if(logo){el.innerHTML=`<img src="${logo}" alt="شعار آلين">`;el.classList.add('as145-has-image')}else{el.textContent='آ';el.classList.remove('as145-has-image')}});document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(el=>{if(icon)el.href=icon})}catch(e){}}
  async function saveOne(key,value){
    if(typeof settingsSet==='function') return settingsSet(key,String(value));
    if(typeof alinV57SaveSetting==='function') return alinV57SaveSetting(key,String(value));
    if(typeof sb!=='undefined'&&sb?.from){const {error}=await sb.from('settings').upsert({key,value:String(value)});if(error)throw error;return}
    throw new Error('تعذر الوصول إلى إعدادات قاعدة البيانات');
  }
  async function saveMany(obj,msgEl){
    msgEl.className='as144-status';msgEl.textContent='جارٍ الحفظ...';
    try{for(const [k,v] of Object.entries(obj))await saveOne(k,v);try{if(typeof audit==='function')await audit('settings','تحديث إعدادات لوحة المدير')}catch(e){};try{if(typeof load==='function')await load()}catch(e){};msgEl.className='as144-status ok';msgEl.textContent='تم حفظ الإعدادات بنجاح';if(typeof toast==='function')toast('تم حفظ الإعدادات')}
    catch(e){msgEl.className='as144-status err';msgEl.textContent=e.message||'تعذر حفظ الإعدادات'}
  }
  function render(root){
    if(!root)return;root.className='panel admin-settings-v144';
    root.innerHTML=`
      <div class="as144-head"><div><h2>إعدادات المنصة</h2><p>إدارة الهوية والأرباح والتوصيل والطلبات وحساب المدير من مكان واحد.</p></div><span class="as144-version">v2.0.15</span></div>
      <div class="as144-tabs" role="tablist">
        <button class="active" data-as144-tab="general">عام</button><button data-as144-tab="profits">الأرباح</button><button data-as144-tab="orders">الطلبات والتوصيل</button><button data-as144-tab="brand">الهوية والتواصل</button><button data-as144-tab="security">أمان المدير</button>
      </div>
      <section class="as144-panel active" data-as144-panel="general">
        <div class="as144-card"><h3>الإعدادات العامة</h3><div class="as144-grid">
          <div class="as144-field"><label>اسم المنصة</label><input id="as144PlatformName" value="${escv(val('platform_name','منصة آلين'))}"></div>
          <div class="as144-field"><label>رقم الإصدار</label><input id="as144Version" value="${escv(val('app_version','V145'))}"></div>
          <div class="as144-field"><label>حد تنبيه المخزون</label><input id="as144LowStock" type="number" min="0" value="${escv(val('low_stock_default','5'))}"></div>
          <div class="as144-field"><label>حد تنبيه ذمة المكتبة</label><input id="as144DebtLimit" type="number" min="0" value="${escv(val('library_debt_alert_limit','500000'))}"></div>
          <div class="as144-field full"><label>ملاحظة إدارية داخلية</label><textarea id="as144AdminNote">${escv(val('admin_internal_note',''))}</textarea></div>
        </div><div class="as144-actions"><button class="as144-save" data-as144-save="general">حفظ الإعدادات العامة</button></div><div id="as144GeneralMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="profits">
        <div class="as144-card"><h3>نسب الأرباح الافتراضية</h3><div class="as144-grid">
          <div class="as144-field"><label>حصة المنصة %</label><input id="as144AdminProfit" type="number" min="0" max="100" value="${escv(val('admin_profit_percent','20'))}"></div>
          <div class="as144-field"><label>حصة المدرس %</label><input id="as144TeacherProfit" type="number" min="0" max="100" value="${escv(val('teacher_profit_percent','50'))}"></div>
          <div class="as144-field"><label>حصة المكتبة %</label><input id="as144LibraryProfit" type="number" min="0" max="100" value="${escv(val('library_profit_percent','30'))}"></div>
          <div class="as144-field"><label>عمولة المندوب %</label><input id="as144CourierProfit" type="number" min="0" max="100" value="${escv(val('delegate_profit_percent','30'))}"></div>
        </div><div id="as144ProfitTotal" class="as144-profit-total"></div><div class="as144-note">تُستخدم هذه النسب كإعدادات افتراضية، ويمكن أن تبقى بعض الملازم مرتبطة بتوزيع خاص بها.</div><div class="as144-actions"><button class="as144-save" data-as144-save="profits">حفظ نسب الأرباح</button></div><div id="as144ProfitsMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="orders">
        <div class="as144-card"><h3>الطلبات والتوصيل</h3><div class="as144-grid">
          <div class="as144-field"><label>أجور التوصيل الافتراضية</label><input id="as144DeliveryFee" type="number" min="0" value="${escv(val('delivery_fee','0'))}"></div>
          <div class="as144-field"><label>حالة استقبال الطلبات</label><select id="as144PauseScope"><option value="" ${val('order_pause_scope','')===''?'selected':''}>الطلبات مفتوحة</option><option value="all" ${val('order_pause_scope','')==='all'?'selected':''}>إيقاف الكل</option><option value="booklet" ${val('order_pause_scope','')==='booklet'?'selected':''}>إيقاف الملازم</option><option value="stationery" ${val('order_pause_scope','')==='stationery'?'selected':''}>إيقاف القرطاسية</option><option value="gift" ${val('order_pause_scope','')==='gift'?'selected':''}>إيقاف الهدايا</option></select></div>
          <div class="as144-field full"><label>سبب إيقاف الطلبات</label><textarea id="as144PauseReason">${escv(val('order_pause_reason',''))}</textarea></div>
        </div><div class="as144-toggle"><div><b>إظهار التوصيل للبيت</b><small style="display:block;color:#667085">السماح للطالب باختيار المندوب أو التوصيل.</small></div><input id="as144DeliveryEnabled" type="checkbox" ${String(val('delivery_enabled','true'))!=='false'?'checked':''}></div><div class="as144-actions"><button class="as144-save" data-as144-save="orders">حفظ إعدادات الطلبات</button></div><div id="as144OrdersMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="brand">
        <div class="as144-card as145-brand-card"><h3>شعار المنصة وأيقونة التطبيق</h3><p class="as145-brand-intro">ارفع شعار المنصة وأيقونة التطبيق وشاهد المعاينة قبل الحفظ.</p>
          <div class="as145-brand-previews">
            <div><small>الشعار الحالي</small><div id="as145LogoPreview" class="as145-preview as145-preview-wide">${brandPreview('logo')}</div></div>
            <div><small>أيقونة التطبيق</small><div id="as145IconPreview" class="as145-preview">${brandPreview('icon')}</div></div>
          </div>
          <div class="as144-grid">
            <div class="as144-field"><label>رفع شعار المنصة</label><input id="as145LogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><small>يفضل شعار أفقي بخلفية شفافة.</small></div>
            <div class="as144-field"><label>رفع أيقونة التطبيق</label><input id="as145IconFile" type="file" accept="image/png,image/jpeg,image/webp"><small>يفضل صورة مربعة 512×512.</small></div>
            <div class="as144-field"><label>الاسم المختصر للتطبيق</label><input id="as145ShortName" value="${escv(val('platform_short_name','آلين'))}" maxlength="20"></div>
          </div>
          <div class="as144-actions"><button class="as145-reset" id="as145BrandReset">استعادة الافتراضي</button><button class="as144-save" id="as145BrandSave">حفظ الشعار والأيقونة</button></div><div id="as145BrandMsg" class="as144-status"></div>
          <div class="as144-note">بعد تغيير أيقونة التطبيق قد تحتاج حذف اختصار المنصة من الهاتف وإضافته من جديد بسبب كاش الجهاز.</div>
        </div>
        <div class="as144-card"><h3>الواجهة والتواصل</h3><div class="as144-grid">
          <div class="as144-field"><label>عنوان الواجهة</label><input id="as144HeroTitle" value="${escv(val('hero_title','كل ما تحتاجه للدراسة بمكان واحد'))}"></div>
          <div class="as144-field"><label>رقم واتساب المنصة</label><input id="as144Whatsapp" value="${escv(val('whatsapp',val('platform_phone','')))}"></div>
          <div class="as144-field full"><label>نص الواجهة</label><textarea id="as144HeroText">${escv(val('hero_text','اختر ملزمتك أو قرطاسيتك واطلبها بسهولة.'))}</textarea></div>
          <div class="as144-field"><label>عنوان قسم عن المنصة</label><input id="as144AboutTitle" value="${escv(val('about_title','عن المنصة'))}"></div>
          <div class="as144-field"><label>عنوان التواصل</label><input id="as144ContactTitle" value="${escv(val('contact_title','تواصل معنا'))}"></div>
          <div class="as144-field full"><label>نص عن المنصة</label><textarea id="as144AboutText">${escv(val('about_text','منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.'))}</textarea></div>
          <div class="as144-field full"><label>نص التواصل</label><textarea id="as144ContactText">${escv(val('contact_text','للاستفسار أو الانضمام، تواصل مع إدارة منصة آلين.'))}</textarea></div>
        </div><div class="as144-actions"><button class="as144-save" data-as144-save="brand">حفظ الهوية والتواصل</button></div><div id="as144BrandMsg" class="as144-status"></div></div>
      </section>
      <section class="as144-panel" data-as144-panel="security">
        <div class="as144-card as144-danger"><h3>أمان حساب المدير</h3><div class="as144-grid">
          <div class="as144-field"><label>اسم دخول المدير</label><input id="adminLoginName" value="${escv(typeof adminUser==='function'?adminUser():val('admin_username','admin'))}"></div>
          <div class="as144-field"><label>الرمز الحالي</label><input id="adminCurrentPass" type="password"></div>
          <div class="as144-field"><label>الرمز الجديد</label><input id="adminNewPass" type="password"></div>
          <div class="as144-field"><label>تأكيد الرمز الجديد</label><input id="adminNewPass2" type="password"></div>
        </div><div class="as144-note">اترك حقول الرمز الجديد فارغة إذا كنت تريد تغيير اسم الدخول فقط.</div><div class="as144-actions"><button class="as144-save" id="as144SecuritySave">حفظ بيانات المدير</button></div><div id="adminSecurityMsg" class="as144-status"></div></div>
      </section>`;
    root.querySelectorAll('[data-as144-tab]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-as144-tab]').forEach(x=>x.classList.toggle('active',x===b));root.querySelectorAll('[data-as144-panel]').forEach(x=>x.classList.toggle('active',x.dataset.as144Panel===b.dataset.as144Tab))});
    const profitInputs=['as144AdminProfit','as144TeacherProfit','as144LibraryProfit'];
    const updateTotal=()=>{const total=profitInputs.reduce((a,id)=>a+(+document.getElementById(id).value||0),0);document.getElementById('as144ProfitTotal').textContent=`مجموع نسب المنصة والمدرس والمكتبة: ${total}%`};profitInputs.forEach(id=>document.getElementById(id).addEventListener('input',updateTotal));updateTotal();
    root.querySelector('[data-as144-save="general"]').onclick=()=>saveMany({platform_name:as144PlatformName.value.trim(),app_version:as144Version.value.trim(),low_stock_default:as144LowStock.value||5,library_debt_alert_limit:as144DebtLimit.value||0,admin_internal_note:as144AdminNote.value.trim()},as144GeneralMsg);
    root.querySelector('[data-as144-save="profits"]').onclick=()=>saveMany({admin_profit_percent:as144AdminProfit.value||20,teacher_profit_percent:as144TeacherProfit.value||50,library_profit_percent:as144LibraryProfit.value||30,delegate_profit_percent:as144CourierProfit.value||30},as144ProfitsMsg);
    root.querySelector('[data-as144-save="orders"]').onclick=()=>saveMany({delivery_fee:as144DeliveryFee.value||0,order_pause_scope:as144PauseScope.value,order_pause_reason:as144PauseReason.value.trim(),delivery_enabled:as144DeliveryEnabled.checked?'true':'false'},as144OrdersMsg);
    root.querySelector('[data-as144-save="brand"]').onclick=()=>saveMany({hero_title:as144HeroTitle.value.trim(),hero_text:as144HeroText.value.trim(),whatsapp:as144Whatsapp.value.trim(),platform_phone:as144Whatsapp.value.trim(),about_title:as144AboutTitle.value.trim(),about_text:as144AboutText.value.trim(),contact_title:as144ContactTitle.value.trim(),contact_text:as144ContactText.value.trim()},as144BrandMsg);
    const logoFile=root.querySelector('#as145LogoFile'),iconFile=root.querySelector('#as145IconFile'),logoBox=root.querySelector('#as145LogoPreview'),iconBox=root.querySelector('#as145IconPreview');
    logoFile.onchange=()=>updateBrandPreview(logoBox,logoFile.files[0]);iconFile.onchange=()=>updateBrandPreview(iconBox,iconFile.files[0]);
    root.querySelector('#as145BrandSave').onclick=async()=>{const m=root.querySelector('#as145BrandMsg');m.className='as144-status';m.textContent='جارٍ رفع الهوية وحفظها...';try{const data={platform_short_name:root.querySelector('#as145ShortName').value.trim()||'آلين'};if(logoFile.files[0])data.platform_logo_path=await uploadIdentity(logoFile.files[0],'logo');if(iconFile.files[0])data.platform_icon_path=await uploadIdentity(iconFile.files[0],'icon');await saveMany(data,m);try{if(typeof load==='function')await load()}catch(e){}applyIdentityNow();m.className='as144-status ok';m.textContent='تم تحديث الشعار والأيقونة بنجاح'}catch(e){m.className='as144-status err';m.textContent=e.message||'تعذر حفظ الهوية'}};
    root.querySelector('#as145BrandReset').onclick=async()=>{if(!confirm('استعادة الشعار والأيقونة الافتراضية؟'))return;const m=root.querySelector('#as145BrandMsg');await saveMany({platform_logo_path:'',platform_icon_path:'',platform_short_name:'آلين'},m);try{if(typeof load==='function')await load()}catch(e){}logoBox.innerHTML='<span>آ</span>';iconBox.innerHTML='<span>آ</span>';applyIdentityNow()};
    root.querySelector('#as144SecuritySave').onclick=async()=>{const m=document.getElementById('adminSecurityMsg');if(typeof saveAdminSecurity==='function'){try{await saveAdminSecurity()}catch(e){m.className='as144-status err';m.textContent=e.message||'تعذر حفظ بيانات المدير'}}else m.textContent='وظيفة أمان المدير غير متاحة في هذه النسخة'};
  }
  function ensureButton(){const tabs=document.querySelector('#adminPage .admin-tabs');if(!tabs)return;const btn=[...tabs.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("adminTab('settings')"));if(btn){btn.textContent='الإعدادات';btn.dataset.adminTab='settings'}}
  function install(){ensureButton();if(window.AlinAdminModules)AlinAdminModules.register('settings',render);const base=window.adminTab;if(typeof base==='function'&&!base.__v144Settings){const wrapped=function(tab){const r=base.apply(this,arguments);if(tab==='settings')requestAnimationFrame(()=>render(document.getElementById('adminContent')));return r};wrapped.__v144Settings=true;window.adminTab=wrapped}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;
