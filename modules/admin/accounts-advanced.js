// === admin/accounts-advanced.js ===
/* ===== admin/js/admin-accounts-v133.js ===== */

(function(){
  'use strict';
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const arr=v=>Array.isArray(v)?v:[];
  const roleLabel={teacher:'مدرس',library:'مكتبة',courier:'مندوب',accountant:'محاسب',admin:'مدير'};
  const permissionLabels={dashboard:'الرئيسية',orders:'الطلبات',booklets:'الملازم',products:'المنتجات',accounts:'الحسابات',finance:'المالية',settlements:'التسويات',reports:'التقارير',notifications:'الإشعارات',settings:'الإعدادات'};
  let editingId=null;

  function parseAreas(v){return window.AlinCourierAreas?.parse?.(v)||[]}
  function areaList(){return window.AlinCourierAreas?.list?.()||[]}
  function accountAreas(x){return window.AlinCourierAreas?.forAccount?.(x)||parseAreas(x?.areas||x?.area)}
  function allAccounts(){
    const canonical=arr(window.db?.accounts?.all);
    const courierRows=arr(window.db?.couriers||window.db?.accounts?.couriers);
    if(canonical.length){
      const couriersById=new Map(courierRows.map(x=>[String(x.id),x]));
      return canonical.map(x=>{
        if(x.role!=='courier')return {...x};
        const courier=couriersById.get(String(x.id))||{};
        return {...x,...courier,id:x.id,role:'courier',auth_user_id:x.auth_user_id,status:x.status||courier.status};
      });
    }
    const teachers=arr(window.db?.accounts?.teachers).map(x=>({...x,role:'teacher'}));
    const libraries=arr(window.db?.accounts?.libraries).map(x=>({...x,role:'library'}));
    const couriers=courierRows.map(x=>({...x,role:'courier'}));
    const accountants=arr(window.db?.accounts?.accountants).map(x=>({...x,role:'accountant'}));
    return [...teachers,...libraries,...couriers,...accountants];
  }
  function account(id){return allAccounts().find(x=>String(x.id)===String(id))}
  function ordersFor(x){return arr(window.db?.orders).filter(o=>String(o.teacher_id||'')===String(x.id)||String(o.library_id||o.pickup_library_id||'')===String(x.id)||String(o.courier_id||o.delegate_id||'')===String(x.id))}
  function settlementsFor(x){return [...arr(window.db?.settlements),...arr(window.db?.library_settlements),...arr(window.db?.courier_settlements),...arr(window.db?.librarySettlements),...arr(window.db?.courierSettlements)].filter(s=>String(s.account_id||s.teacher_id||s.library_id||s.courier_id||'')===String(x.id))}
  function permsFor(x){try{return JSON.parse(localStorage.getItem('alin_permissions_'+x.id)||'null')||defaultPerms(x.role)}catch(_){return defaultPerms(x.role)}}
  function defaultPerms(role){if(role==='teacher')return ['dashboard','booklets','orders','finance'];if(role==='library')return ['dashboard','orders','finance','settlements','notifications'];if(role==='courier')return ['dashboard','orders','finance','settlements'];return ['dashboard']}
  function history(id){try{return JSON.parse(localStorage.getItem('alin_account_activity_'+id)||'[]')}catch(_){return []}}
  function log(id,action,details=''){const rows=history(id);rows.unshift({at:new Date().toISOString(),action,details,by:window.current?.name||'المدير'});localStorage.setItem('alin_account_activity_'+id,JSON.stringify(rows.slice(0,80)))}
  function areaPicker(x){
    const selected=new Set(accountAreas(x));
    const names=[...new Set([...areaList(),...selected])].sort((a,b)=>a.localeCompare(b,'ar'));
    return `<section id="v132CourierFields" class="v132-courier-fields" ${x.role==='courier'?'':'hidden'}>
      <div class="v163-area-toolbar"><div><h4>مناطق عمل المندوب</h4><small>يمكن تحديد أكثر من منطقة ويظهر المندوب فقط للطلبات المطابقة.</small></div><div><button type="button" class="secondary" onclick="v132CourierAreasSelectAll()">تحديد الكل</button><button type="button" class="secondary" onclick="v132CourierAreasClear()">إلغاء التحديد</button></div></div>
      <div id="v132CourierAreaPicker" class="v163-area-picker">${names.map(name=>`<label><input type="checkbox" value="${escx(name)}" ${selected.has(name)?'checked':''} onchange="v132CourierAreaCount()"><span>${escx(name)}</span></label>`).join('')}</div>
      <div class="v132-courier-meta"><label>حالة توفر المندوب<select id="v132Availability"><option value="available" ${String(x.availability||'available')==='available'?'selected':''}>متاح</option><option value="busy" ${String(x.availability||'')==='busy'?'selected':''}>مشغول</option><option value="offline" ${String(x.availability||'')==='offline'?'selected':''}>غير متصل</option></select></label><p><b id="v132CourierAreaCount">${selected.size}</b> منطقة محددة</p></div>
    </section>`;
  }
  function renderEditor(x){
    const host=document.getElementById('v132AccountEditorHost');if(!host)return;
    const os=ordersFor(x),ss=settlementsFor(x),perms=permsFor(x),role=x.role||'teacher',linked=Boolean(x.auth_user_id);
    host.innerHTML=`<section class="v132-account-editor"><header class="v132-editor-head"><div><h3>تعديل حساب ${escx(x.name||'')}</h3><p>${linked?'الحساب مربوط بخدمة الدخول ويمكن تحديث بياناته وكلمة مروره.':'الحساب قديم وغير مربوط؛ تعيين كلمة مرور جديدة يربطه تلقائياً.'}</p></div><span class="v131-status ${linked?'active':'pending'}">${linked?'مربوط':'يحتاج ربط'}</span><button class="v132-editor-close" onclick="v132CloseAccountEditor()">إغلاق</button></header><div class="v132-account-form"><label>نوع الحساب<select id="v132Role" onchange="v132SyncRoleFields()"><option value="teacher" ${role==='teacher'?'selected':''}>مدرس</option><option value="library" ${role==='library'?'selected':''}>مكتبة</option><option value="courier" ${role==='courier'?'selected':''}>مندوب</option></select></label><label class="span-2">الاسم الكامل<input id="v132Name" value="${escx(x.name||'')}"></label><label>الحالة<select id="v132Status"><option value="active" ${String(x.status||'active')==='active'?'selected':''}>فعال</option><option value="inactive" ${String(x.status||'')==='inactive'?'selected':''}>موقوف</option><option value="pending" ${String(x.status||'')==='pending'?'selected':''}>قيد المراجعة</option></select></label><label>اسم الدخول<input id="v132Username" value="${escx(x.username||'')}"></label><label>رقم الهاتف<input id="v132Phone" value="${escx(x.phone||x.mobile||'')}"></label><label id="v132AreaLabel">المنطقة<input id="v132Area" value="${escx(x.area||'')}"></label><label id="v132LandmarkLabel">أقرب نقطة دالة<input id="v132Landmark" value="${escx(x.landmark||'')}"></label>${areaPicker(x)}<label class="span-4">ملاحظات الحساب<textarea id="v132Notes">${escx(x.notes||'')}</textarea></label><section class="v132-password-box"><h4>${linked?'إعادة تعيين كلمة المرور':'ربط الحساب وتعيين كلمة المرور'}</h4><div class="v132-password-row"><input id="v132NewPassword" type="password" placeholder="اكتب كلمة مرور جديدة من 8 أحرف أو أرقام"><button onclick="v132ResetPassword()">${linked?'تغيير كلمة المرور':'ربط وحفظ'}</button></div></section><section class="v132-permissions"><h4>الصلاحيات</h4><div class="v132-permission-grid">${Object.entries(permissionLabels).map(([k,v])=>`<label><input type="checkbox" data-v132-permission="${k}" ${perms.includes(k)?'checked':''}>${v}</label>`).join('')}</div></section><section class="v132-link-summary"><article><small>الطلبات المرتبطة</small><b>${os.length}</b></article><article><small>التسويات المرتبطة</small><b>${ss.length}</b></article><article><small>سجل النشاط</small><b>${history(x.id).length}</b></article></section><div class="v132-form-actions"><button class="secondary" onclick="v132OpenActivity('${escx(x.id)}')">سجل النشاط</button><button class="v132-save" onclick="v132SaveAccount()">حفظ التعديلات</button></div></div></section>`;
    window.v132SyncRoleFields();
    host.scrollIntoView({behavior:'smooth',block:'start'});
  }

  window.v132SyncRoleFields=()=>{
    const courier=document.getElementById('v132Role')?.value==='courier';
    const fields=document.getElementById('v132CourierFields');if(fields)fields.hidden=!courier;
    const area=document.getElementById('v132AreaLabel'),landmark=document.getElementById('v132LandmarkLabel');
    if(area)area.hidden=courier;if(landmark)landmark.hidden=courier;
    window.v132CourierAreaCount();
  };
  window.v132CourierAreaCount=()=>{const count=document.querySelectorAll('#v132CourierAreaPicker input:checked').length;const el=document.getElementById('v132CourierAreaCount');if(el)el.textContent=String(count);return count};
  window.v132CourierAreasSelectAll=()=>{document.querySelectorAll('#v132CourierAreaPicker input').forEach(x=>x.checked=true);window.v132CourierAreaCount()};
  window.v132CourierAreasClear=()=>{document.querySelectorAll('#v132CourierAreaPicker input').forEach(x=>x.checked=false);window.v132CourierAreaCount()};
  window.v132OpenAccountEditor=id=>{const x=account(id);if(!x)return alert('تعذر العثور على الحساب');editingId=id;renderEditor(x)};
  window.v132CloseAccountEditor=()=>{editingId=null;const h=document.getElementById('v132AccountEditorHost');if(h)h.innerHTML=''};
  window.v132SaveAccount=async()=>{
    const x=account(editingId);if(!x)return;
    const role=document.getElementById('v132Role')?.value||x.role;
    const typedPassword=document.getElementById('v132NewPassword')?.value.trim()||'';
    const selectedAreas=[...document.querySelectorAll('#v132CourierAreaPicker input:checked')].map(el=>String(el.value||'').trim()).filter(Boolean);
    const payload={account_id:x.id,role,name:document.getElementById('v132Name')?.value.trim()||'',username:document.getElementById('v132Username')?.value.trim()||'',status:document.getElementById('v132Status')?.value||'active',phone:document.getElementById('v132Phone')?.value.trim()||'',area:role==='courier'?(selectedAreas[0]||''):(document.getElementById('v132Area')?.value.trim()||''),areas:role==='courier'?selectedAreas:undefined,availability:role==='courier'?(document.getElementById('v132Availability')?.value||'available'):undefined,landmark:role==='courier'?'':(document.getElementById('v132Landmark')?.value.trim()||''),notes:document.getElementById('v132Notes')?.value.trim()||'',password:typedPassword||undefined};
    if(!payload.name||!payload.username)return alert('أكمل الاسم واسم الدخول');
    if(role==='courier'&&!selectedAreas.length)return alert('اختر منطقة عمل واحدة على الأقل للمندوب');
    if(role==='courier'&&!payload.phone)return alert('أدخل رقم هاتف المندوب');
    if(typedPassword&&typedPassword.length<8)return alert('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');
    try{
      if(!window.ALINAuth?.updateAccountFromAdmin)throw new Error('خدمة تعديل الحساب الآمن غير جاهزة');
      await window.ALINAuth.updateAccountFromAdmin(payload);
      const perms=[...document.querySelectorAll('[data-v132-permission]:checked')].map(el=>el.dataset.v132Permission);
      localStorage.setItem('alin_permissions_'+x.id,JSON.stringify(perms));
      log(x.id,'تعديل الحساب',role==='courier'?`تم تحديث البيانات ومناطق العمل: ${selectedAreas.join('، ')}`:'تم تحديث البيانات والصلاحيات');
      if(typeof audit==='function')await audit('account','تعديل آمن لحساب '+x.id);
      if(typeof load==='function')await load();
      if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();
      if(typeof toast==='function')toast(role==='courier'?'تم حفظ حساب المندوب ومناطق عمله':'تم حفظ تعديلات الحساب');
    }catch(e){alert('تعذر حفظ الحساب: '+e.message)}
  };
  window.v132ResetPassword=async()=>{const x=account(editingId),pass=document.getElementById('v132NewPassword')?.value.trim();if(!x||!pass)return alert('اكتب كلمة المرور الجديدة');if(pass.length<8)return alert('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');try{if(!window.ALINAuth?.resetPasswordFromAdmin)throw new Error('خدمة تغيير كلمة المرور غير متاحة');await window.ALINAuth.resetPasswordFromAdmin(x.id,pass);log(x.id,x.auth_user_id?'إعادة تعيين كلمة المرور':'ربط الحساب الموجود وتعيين كلمة المرور');if(typeof audit==='function')await audit('account','تحديث كلمة مرور '+x.id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast('تم تغيير كلمة المرور وربط الحساب بنجاح')}catch(e){alert('تعذر تغيير كلمة المرور: '+e.message)}};
  window.v132ToggleAccount=async(id,status)=>{const x=account(id);if(!x)return;try{if(x.auth_user_id){if(!window.ALINAuth?.updateAccountFromAdmin)throw new Error('خدمة تحديث الحساب غير جاهزة');await window.ALINAuth.updateAccountFromAdmin({account_id:id,status})}else{if(window.ALINAuth?.ensureAdminSession)await window.ALINAuth.ensureAdminSession();if(typeof update!=='function')throw new Error('خدمة تحديث الحساب غير جاهزة');await update('accounts',{status,updated_at:new Date().toISOString()},{id})}log(id,status==='active'?'تفعيل الحساب':'إيقاف الحساب');if(typeof audit==='function')await audit('account',(status==='active'?'تفعيل ':'إيقاف ')+id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast(status==='active'?'تم تفعيل الحساب':'تم إيقاف الحساب')}catch(e){alert('تعذر تحديث الحالة: '+e.message)}};
  window.v132SafeDeleteAccount=async id=>{const x=account(id);if(!x)return;const os=ordersFor(x),ss=settlementsFor(x);if(os.length||ss.length){alert(`لا يمكن حذف الحساب لأنه مرتبط بـ ${os.length} طلب و${ss.length} تسوية. سيتم فتح خيار إيقاف الحساب بدلاً من الحذف.`);return v132ToggleAccount(id,'inactive')}if(!confirm('حذف الحساب نهائياً؟'))return;try{if(!window.ALINAuth?.deleteAccountFromAdmin)throw new Error('خدمة حذف الحساب الآمن غير جاهزة');await window.ALINAuth.deleteAccountFromAdmin(id);log(id,'حذف الحساب');if(typeof audit==='function')await audit('account','حذف حساب آمن '+id);if(typeof load==='function')await load();if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();if(typeof toast==='function')toast('تم حذف الحساب')}catch(e){alert('تعذر حذف الحساب: '+e.message)}};
  window.v132OpenActivity=id=>{const x=account(id);if(!x)return;const rows=history(id);const host=document.getElementById('v132AccountEditorHost');if(!host)return;host.innerHTML=`<section class="v132-account-editor"><header class="v132-editor-head"><div><h3>سجل نشاط ${escx(x.name||'')}</h3><p>آخر التعديلات والإجراءات المسجلة على الحساب.</p></div><button class="v132-editor-close" onclick="v132CloseAccountEditor()">إغلاق</button></header><div class="v132-activity">${rows.map(r=>`<article><b>${escx(r.action)}</b><small>${new Date(r.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')} — ${escx(r.by||'المدير')}${r.details?' — '+escx(r.details):''}</small></article>`).join('')||'<div class="v132-warning">لا يوجد نشاط مسجل لهذا الحساب بعد.</div>'}</div></section>`;host.scrollIntoView({behavior:'smooth',block:'start'})};
})();

;
