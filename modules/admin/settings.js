// === admin/settings.js ===
/* ALIN v2.4.2 — authoritative platform settings. No router wrapping. */
(function(){
  'use strict';

  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const state=()=>window.db?.settings||{};
  const value=(key,fallback='')=>state()[key]??fallback;
  const root=()=>document.getElementById('adminContent');

  async function settingsSet(key,nextValue){
    const normalized=String(nextValue??'');
    const existing=typeof window.query==='function'?(await window.query('settings')).find(row=>String(row.key)===String(key)):null;
    if(existing&&typeof window.update==='function')await window.update('settings',{value:normalized},{key});
    else if(typeof window.insert==='function')await window.insert('settings',{key,value:normalized});
    else throw new Error('خدمة حفظ الإعدادات غير متاحة');
    window.db=window.db||{};window.db.settings=window.db.settings||{};window.db.settings[key]=normalized;
    return normalized;
  }

  async function saveMany(values,messageElement){
    if(messageElement){messageElement.className='as144-status';messageElement.textContent='جارٍ الحفظ...'}
    try{
      for(const [key,nextValue] of Object.entries(values))await settingsSet(key,nextValue);
      if(typeof window.audit==='function')await window.audit('settings','تحديث إعدادات المنصة');
      if(typeof window.applyBrand==='function')window.applyBrand();
      window.dispatchEvent(new CustomEvent('alin:settings-updated',{detail:{keys:Object.keys(values)}}));
      if(messageElement){messageElement.className='as144-status ok';messageElement.textContent='تم حفظ الإعدادات بنجاح'}
      window.toast?.('تم حفظ الإعدادات');
      return true;
    }catch(error){
      if(messageElement){messageElement.className='as144-status err';messageElement.textContent=error.message||'تعذر حفظ الإعدادات'}
      throw error;
    }
  }

  function currentAdmin(){
    if(window.current?.role==='admin')return window.current;
    return (window.db?.accounts?.all||[]).find(account=>account.role==='admin')||null;
  }
  function adminUser(){return currentAdmin()?.username||value('admin_username','admin')}
  async function saveAdminSecurity(){
    const message=document.getElementById('adminSecurityMsg');
    try{
      const account=currentAdmin();if(!account?.id)throw new Error('تعذر تحديد حساب المدير الحالي');
      const username=document.getElementById('adminLoginName')?.value.trim()||'';
      const password=document.getElementById('adminNewPass')?.value.trim()||'';
      const confirmPassword=document.getElementById('adminNewPass2')?.value.trim()||'';
      if(!username)throw new Error('اكتب اسم دخول المدير');
      if(password&&(password.length<12||!/[0-9]/.test(password)||!/[A-Za-z\u0600-\u06FF]/.test(password)))throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');
      if(password!==confirmPassword)throw new Error('تأكيد كلمة المرور غير مطابق');
      if(!window.ALINAuth?.updateAccountFromAdmin)throw new Error('خدمة الحسابات الآمنة غير جاهزة');
      await window.ALINAuth.updateAccountFromAdmin({account_id:account.id,role:'admin',name:account.name||'مدير المنصة',username,status:'active'});
      if(password){
        if(!window.ALINAuth?.resetPasswordFromAdmin)throw new Error('خدمة تغيير كلمة المرور غير متاحة');
        await window.ALINAuth.resetPasswordFromAdmin(account.id,password);
      }
      await settingsSet('admin_username',username);
      if(typeof window.audit==='function')await window.audit('security','تحديث بيانات دخول المدير عبر Supabase Auth');
      if(typeof window.load==='function')await window.load();
      if(message){message.className='as144-status ok';message.textContent='تم تحديث بيانات المدير وحساب الدخول بنجاح'}
      window.toast?.('تم تحديث حساب المدير');
      return true;
    }catch(error){
      if(message){message.className='as144-status err';message.textContent=error.message||'تعذر تحديث بيانات المدير'}
      throw error;
    }
  }

  function render(content=root()){
    if(!content)return;
    content.className='panel admin-settings-v144';
    const version=window.ALIN_CONFIG?.version||'2.4.2';
    content.innerHTML=`
      <div class="as144-head"><div><h2>إعدادات المنصة</h2><p>إدارة الإعدادات العامة والأرباح والطلبات والتواصل وأمان المدير.</p></div><span class="as144-version">v${escv(version)}</span></div>
      <div class="as144-tabs" role="tablist"><button class="active" data-as144-tab="general">عام</button><button data-as144-tab="profits">الأرباح</button><button data-as144-tab="orders">الطلبات</button><button data-as144-tab="contact">التواصل</button><button data-as144-tab="security">أمان المدير</button></div>
      <section class="as144-panel active" data-as144-panel="general"><div class="as144-card"><h3>الإعدادات العامة</h3><div class="as144-grid">
        <div class="as144-field"><label>اسم المنصة</label><input id="as144PlatformName" value="${escv(value('platform_name','منصة آلين'))}"></div>
        <div class="as144-field"><label>الاسم المختصر</label><input id="as144ShortName" value="${escv(value('platform_short_name','آلين'))}"></div>
        <div class="as144-field"><label>حد تنبيه المخزون</label><input id="as144LowStock" type="number" min="0" value="${escv(value('low_stock_default','5'))}"></div>
        <div class="as144-field"><label>حد تنبيه ذمة المكتبة</label><input id="as144DebtLimit" type="number" min="0" value="${escv(value('library_debt_alert_limit','500000'))}"></div>
        <div class="as144-field full"><label>ملاحظة إدارية داخلية</label><textarea id="as144AdminNote">${escv(value('admin_internal_note',''))}</textarea></div>
      </div><div class="as144-actions"><button class="as144-save" data-save="general">حفظ الإعدادات العامة</button><button class="secondary" onclick="adminTab('brandIdentity')">فتح الهوية البصرية</button></div><div id="as144GeneralMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="profits"><div class="as144-card"><h3>نسب الأرباح الافتراضية</h3><div class="as144-grid">
        <div class="as144-field"><label>حصة المنصة %</label><input id="as144AdminProfit" type="number" min="0" max="100" value="${escv(value('admin_profit_percent','20'))}"></div>
        <div class="as144-field"><label>حصة المدرس %</label><input id="as144TeacherProfit" type="number" min="0" max="100" value="${escv(value('teacher_profit_percent','50'))}"></div>
        <div class="as144-field"><label>حصة المكتبة %</label><input id="as144LibraryProfit" type="number" min="0" max="100" value="${escv(value('library_profit_percent','30'))}"></div>
        <div class="as144-field"><label>عمولة المندوب %</label><input id="as144CourierProfit" type="number" min="0" max="100" value="${escv(value('delegate_profit_percent','30'))}"></div>
      </div><div id="as144ProfitTotal" class="as144-profit-total"></div><div class="as144-actions"><button class="as144-save" data-save="profits">حفظ نسب الأرباح</button></div><div id="as144ProfitsMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="orders"><div class="as144-card"><h3>الطلبات والتوصيل</h3><div class="as144-grid">
        <div class="as144-field"><label>أجور التوصيل الافتراضية</label><input id="as144DeliveryFee" type="number" min="0" value="${escv(value('delivery_fee','0'))}"></div>
        <div class="as144-field"><label>حالة استقبال الطلبات</label><select id="as144PauseScope"><option value="" ${value('order_pause_scope','')===''?'selected':''}>الطلبات مفتوحة</option><option value="all" ${value('order_pause_scope','')==='all'?'selected':''}>إيقاف الكل</option><option value="booklet" ${value('order_pause_scope','')==='booklet'?'selected':''}>إيقاف الملازم</option><option value="stationery" ${value('order_pause_scope','')==='stationery'?'selected':''}>إيقاف القرطاسية</option><option value="gift" ${value('order_pause_scope','')==='gift'?'selected':''}>إيقاف الهدايا</option></select></div>
        <div class="as144-field full"><label>سبب إيقاف الطلبات</label><textarea id="as144PauseReason">${escv(value('order_pause_reason',''))}</textarea></div>
      </div><div class="as144-toggle"><div><b>التوصيل للبيت</b><small style="display:block;color:#667085">السماح للطالب باختيار التوصيل عن طريق المندوب.</small></div><input id="as144DeliveryEnabled" type="checkbox" ${String(value('delivery_enabled','true'))!=='false'?'checked':''}></div><div class="as144-actions"><button class="as144-save" data-save="orders">حفظ إعدادات الطلبات</button></div><div id="as144OrdersMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="contact"><div class="as144-card"><h3>واجهة المتجر والتواصل</h3><div class="as144-grid">
        <div class="as144-field"><label>عنوان الواجهة</label><input id="as144HeroTitle" value="${escv(value('hero_title','كل ما تحتاجه للدراسة بمكان واحد'))}"></div>
        <div class="as144-field"><label>رقم واتساب المنصة</label><input id="as144Whatsapp" value="${escv(value('whatsapp',value('platform_phone','')))}"></div>
        <div class="as144-field full"><label>نص الواجهة</label><textarea id="as144HeroText">${escv(value('hero_text','اختر ملزمتك أو قرطاسيتك واطلبها بسهولة.'))}</textarea></div>
        <div class="as144-field"><label>عنوان قسم عن المنصة</label><input id="as144AboutTitle" value="${escv(value('about_title','عن المنصة'))}"></div>
        <div class="as144-field"><label>عنوان التواصل</label><input id="as144ContactTitle" value="${escv(value('contact_title','تواصل معنا'))}"></div>
        <div class="as144-field full"><label>نص عن المنصة</label><textarea id="as144AboutText">${escv(value('about_text','منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.'))}</textarea></div>
        <div class="as144-field full"><label>نص التواصل</label><textarea id="as144ContactText">${escv(value('contact_text','للاستفسار أو الانضمام، تواصل مع إدارة منصة آلين.'))}</textarea></div>
      </div><div class="as144-actions"><button class="as144-save" data-save="contact">حفظ الواجهة والتواصل</button></div><div id="as144ContactMsg" class="as144-status"></div></div></section>
      <section class="as144-panel" data-as144-panel="security"><div class="as144-card as144-danger"><h3>أمان حساب المدير</h3><div class="as144-grid">
        <div class="as144-field"><label>اسم دخول المدير</label><input id="adminLoginName" value="${escv(adminUser())}"></div>
        <div class="as144-field"><label>كلمة المرور الجديدة</label><input id="adminNewPass" type="password" autocomplete="new-password"></div>
        <div class="as144-field"><label>تأكيد كلمة المرور</label><input id="adminNewPass2" type="password" autocomplete="new-password"></div>
      </div><div class="as144-note">يتم تحديث حساب المدير الحقيقي في Supabase Auth، وليس رمزاً محلياً داخل المتصفح.</div><div class="as144-actions"><button class="as144-save" id="as144SecuritySave">حفظ بيانات المدير</button></div><div id="adminSecurityMsg" class="as144-status"></div></div></section>`;

    content.querySelectorAll('[data-as144-tab]').forEach(button=>button.addEventListener('click',()=>{
      content.querySelectorAll('[data-as144-tab]').forEach(item=>item.classList.toggle('active',item===button));
      content.querySelectorAll('[data-as144-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.as144Panel===button.dataset.as144Tab));
    }));
    const profitIds=['as144AdminProfit','as144TeacherProfit','as144LibraryProfit'];
    const updateTotal=()=>{const total=profitIds.reduce((sum,id)=>sum+(Number(document.getElementById(id)?.value)||0),0);const label=document.getElementById('as144ProfitTotal');if(label)label.textContent=`مجموع نسب المنصة والمدرس والمكتبة: ${total}%`};profitIds.forEach(id=>document.getElementById(id)?.addEventListener('input',updateTotal));updateTotal();
    content.querySelector('[data-save="general"]')?.addEventListener('click',()=>saveMany({platform_name:document.getElementById('as144PlatformName').value.trim(),platform_short_name:document.getElementById('as144ShortName').value.trim()||'آلين',low_stock_default:document.getElementById('as144LowStock').value||5,library_debt_alert_limit:document.getElementById('as144DebtLimit').value||0,admin_internal_note:document.getElementById('as144AdminNote').value.trim()},document.getElementById('as144GeneralMsg')).catch(()=>{}));
    content.querySelector('[data-save="profits"]')?.addEventListener('click',()=>saveMany({admin_profit_percent:document.getElementById('as144AdminProfit').value||20,teacher_profit_percent:document.getElementById('as144TeacherProfit').value||50,library_profit_percent:document.getElementById('as144LibraryProfit').value||30,delegate_profit_percent:document.getElementById('as144CourierProfit').value||30},document.getElementById('as144ProfitsMsg')).catch(()=>{}));
    content.querySelector('[data-save="orders"]')?.addEventListener('click',()=>saveMany({delivery_fee:document.getElementById('as144DeliveryFee').value||0,order_pause_scope:document.getElementById('as144PauseScope').value,order_pause_reason:document.getElementById('as144PauseReason').value.trim(),delivery_enabled:document.getElementById('as144DeliveryEnabled').checked?'true':'false'},document.getElementById('as144OrdersMsg')).catch(()=>{}));
    content.querySelector('[data-save="contact"]')?.addEventListener('click',()=>saveMany({hero_title:document.getElementById('as144HeroTitle').value.trim(),hero_text:document.getElementById('as144HeroText').value.trim(),whatsapp:document.getElementById('as144Whatsapp').value.trim(),platform_phone:document.getElementById('as144Whatsapp').value.trim(),about_title:document.getElementById('as144AboutTitle').value.trim(),about_text:document.getElementById('as144AboutText').value.trim(),contact_title:document.getElementById('as144ContactTitle').value.trim(),contact_text:document.getElementById('as144ContactText').value.trim()},document.getElementById('as144ContactMsg')).catch(()=>{}));
    document.getElementById('as144SecuritySave')?.addEventListener('click',()=>saveAdminSecurity().catch(()=>{}));
  }

  Object.assign(window,{settingsSet,adminUser,saveAdminSecurity,renderSettingsAdmin:render,saveSystemSettings:()=>Promise.resolve(true),openSystemSettings:()=>window.adminTab?.('settings')});
  function install(){const button=[...document.querySelectorAll('#adminPage .admin-tabs button')].find(item=>(item.getAttribute('onclick')||'').includes("'settings'"));if(button){button.textContent='الإعدادات';button.dataset.adminTab='settings'}window.AlinAdminModules?.register?.('settings',render)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.AlinSettings=Object.freeze({render,set:settingsSet,saveMany,saveAdminSecurity});
})();

;
