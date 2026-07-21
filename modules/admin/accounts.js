// === admin/accounts.js ===
/* ALIN v2.2.5 — authoritative accounts administration. */

/* ===== admin/js/admin-accounts-v133.js ===== */
(function(){
  'use strict';
  const state={query:'',role:'all',status:'all',area:'all'};
  const DEFAULT_COURIER_AREAS=['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء','حي الحسين','حي العمل الشعبي','غرناطة','المنصور','البلديات','الشرطة'];
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const arr=v=>Array.isArray(v)?v:[];
  const roleLabel={teacher:'مدرس',library:'مكتبة',courier:'مندوب',accountant:'محاسب',admin:'مدير'};

  function unique(values){return [...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))]}
  function parseAreas(value){
    if(Array.isArray(value))return unique(value);
    if(value&&typeof value==='object')return unique(Object.values(value));
    const text=String(value||'').trim();
    if(!text)return[];
    try{const parsed=JSON.parse(text);if(Array.isArray(parsed))return unique(parsed)}catch(_){ }
    return unique(text.split(/[,،|]/));
  }
  function deliveryAreaNames(){
    const rows=arr(window.db?.deliveryAreas||window.db?.delivery_areas||window.deliveryAreas);
    const cloud=rows.filter(x=>x&&x.active!==false&&String(x.status||'active')!=='inactive').map(x=>x.name||x.title||x.area);
    const names=unique(cloud.length?cloud:(window.ALIN_KIRKUK_AREAS||DEFAULT_COURIER_AREAS));
    return names.sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function accountAreas(x){return unique([...parseAreas(x?.areas||x?.area_ids),...parseAreas(x?.area)])}
  window.AlinCourierAreas=Object.freeze({list:deliveryAreaNames,parse:parseAreas,forAccount:accountAreas});

  function initials(name){return String(name||'؟').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('')||'؟'}
  function allAccounts(){
    const teachers=arr(window.db?.accounts?.teachers).map(x=>({...x,role:'teacher'}));
    const libraries=arr(window.db?.accounts?.libraries).map(x=>({...x,role:'library'}));
    const couriers=arr(window.db?.accounts?.couriers||window.db?.couriers).map(x=>({...x,role:'courier'}));
    const accountants=arr(window.db?.accounts?.accountants).map(x=>({...x,role:'accountant'}));
    return [...teachers,...libraries,...couriers,...accountants];
  }
  function normalizedStatus(x){const s=String(x.status||'active').toLowerCase();return ['active','open','enabled','approved'].includes(s)?'active':['pending','review'].includes(s)?'pending':'inactive'}
  function filtered(){return allAccounts().filter(x=>{
    const xAreas=accountAreas(x);
    const text=[x.name,x.username,x.phone,x.mobile,x.landmark,roleLabel[x.role],...xAreas].join(' ').toLowerCase();
    return (!state.query||text.includes(state.query.toLowerCase()))&&(state.role==='all'||x.role===state.role)&&(state.status==='all'||normalizedStatus(x)===state.status)&&(state.area==='all'||xAreas.includes(state.area));
  })}
  function areas(){return unique(allAccounts().flatMap(accountAreas)).sort((a,b)=>a.localeCompare(b,'ar'))}
  function stats(){const a=allAccounts();return {all:a.length,active:a.filter(x=>normalizedStatus(x)==='active').length,inactive:a.filter(x=>normalizedStatus(x)==='inactive').length,teachers:a.filter(x=>x.role==='teacher').length,libraries:a.filter(x=>x.role==='library').length,couriers:a.filter(x=>x.role==='courier').length}}
  function card(x){
    const st=normalizedStatus(x),locked=['admin','accountant'].includes(x.role),phone=x.phone||x.mobile||'',xAreas=accountAreas(x);
    const meta=[x.username?`الدخول: ${escx(x.username)}`:'',phone?escx(phone):'',...xAreas.slice(0,4).map(escx)].filter(Boolean);
    if(xAreas.length>4)meta.push(`+${xAreas.length-4} مناطق`);
    return `<article class="v131-account-card"><div class="v131-avatar ${escx(x.role)}">${escx(initials(x.name))}</div><div class="v131-account-info"><h3>${escx(x.name||roleLabel[x.role])}</h3><div class="v131-account-meta"><span class="v131-chip">${roleLabel[x.role]||escx(x.role)}</span>${meta.map(m=>`<span class="v131-chip">${m}</span>`).join('')}<span class="v131-status ${st}">${st==='active'?'فعال':st==='pending'?'قيد المراجعة':'موقوف'}</span></div></div><div class="v131-card-actions">${locked?`<button class="secondary" onclick="v131AccountInfo('${escx(x.id)}')">تفاصيل الصلاحية</button>`:`<button class="secondary" onclick="v132OpenAccountEditor('${escx(x.id)}')">تعديل كامل</button><button class="warning" onclick="v132ToggleAccount('${escx(x.id)}','${st==='active'?'inactive':'active'}')">${st==='active'?'إيقاف':'تفعيل'}</button><button class="secondary" onclick="v132OpenActivity('${escx(x.id)}')">النشاط</button><button class="danger" onclick="v132SafeDeleteAccount('${escx(x.id)}')">حذف</button>`}</div></article>`;
  }
  function courierAreaPicker(){
    return `<section id="v163CourierAccountFields" class="v163-courier-account-fields" hidden>
      <div class="v163-courier-fields-title"><div><b>بيانات حساب المندوب</b><small>حدد كل المناطق التي يعمل بها المندوب. الطلبات تُطابق حسب منطقة الزبون.</small></div><span>مناطق متعددة</span></div>
      <div class="form-grid v163-courier-fields-grid"><input id="v163CourierPhone" inputmode="tel" placeholder="رقم هاتف المندوب"><select id="v163CourierAvailability"><option value="available">متاح</option><option value="busy">مشغول</option><option value="offline">غير متصل</option></select></div>
      <div class="v163-area-toolbar"><h4>مناطق عمل المندوب</h4><div><button type="button" class="secondary" onclick="v131CourierAreasSelectAll()">تحديد الكل</button><button type="button" class="secondary" onclick="v131CourierAreasClear()">إلغاء التحديد</button></div></div>
      <div id="v163CourierAreaPicker" class="v163-area-picker">${deliveryAreaNames().map(name=>`<label><input type="checkbox" value="${escx(name)}" onchange="v131CourierAreaCount()"><span>${escx(name)}</span></label>`).join('')}</div>
      <p class="v163-account-note"><b id="v163CourierAreaCount">0</b> منطقة محددة. بعد الحفظ يظهر المندوب فقط ضمن الطلبات المطابقة لمناطقه.</p>
    </section>`;
  }
  function render(){
    if(!window.adminContent)return;
    const s=stats(),rows=filtered();
    adminContent.innerHTML=`<section class="v131-accounts"><header class="v131-accounts-head"><div><h2>إدارة الحسابات</h2><p>إدارة المدرسين والمكتبات والمندوبين والصلاحيات من مكان واحد.</p></div><button class="v131-add-account" onclick="v131ToggleAccountForm()">+ إضافة حساب جديد</button></header><section class="v131-account-stats"><article class="v131-account-stat"><small>إجمالي الحسابات</small><b>${s.all}</b></article><article class="v131-account-stat"><small>الحسابات الفعالة</small><b>${s.active}</b></article><article class="v131-account-stat danger"><small>الحسابات الموقوفة</small><b>${s.inactive}</b></article><article class="v131-account-stat"><small>المدرسون</small><b>${s.teachers}</b></article><article class="v131-account-stat"><small>المكتبات</small><b>${s.libraries}</b></article><article class="v131-account-stat"><small>المندوبون</small><b>${s.couriers}</b></article></section><section id="v131AccountForm" class="v131-account-form"><h3>إضافة حساب</h3><div class="form-grid"><select id="aRole" onchange="v131SyncAccountRole()"><option value="teacher">مدرس</option><option value="library">مكتبة</option><option value="courier">مندوب</option><option value="accountant">محاسب</option></select><input id="aName" placeholder="الاسم الكامل"><input id="aUser" placeholder="اسم الدخول"><input id="aPass" type="password" placeholder="الرمز السري"><input id="aArea" placeholder="المنطقة"><input id="aLandmark" placeholder="أقرب نقطة دالة"></div>${courierAreaPicker()}<div class="form-actions"><button class="secondary" onclick="v131ToggleAccountForm(false)">إلغاء</button><button id="v131SaveAccountButton" onclick="addAccount()">حفظ الحساب</button></div></section><section class="v131-account-tools"><input id="v131AccountSearch" value="${escx(state.query)}" placeholder="ابحث بالاسم أو اسم الدخول أو المنطقة" oninput="v131AccountFilter('query',this.value)"><select onchange="v131AccountFilter('role',this.value)"><option value="all">كل أنواع الحسابات</option>${Object.entries(roleLabel).map(([k,v])=>`<option value="${k}" ${state.role===k?'selected':''}>${v}</option>`).join('')}</select><select onchange="v131AccountFilter('status',this.value)"><option value="all">كل الحالات</option><option value="active" ${state.status==='active'?'selected':''}>فعال</option><option value="inactive" ${state.status==='inactive'?'selected':''}>موقوف</option><option value="pending" ${state.status==='pending'?'selected':''}>قيد المراجعة</option></select><select onchange="v131AccountFilter('area',this.value)"><option value="all">كل المناطق</option>${areas().map(a=>`<option value="${escx(a)}" ${state.area===a?'selected':''}>${escx(a)}</option>`).join('')}</select></section><nav class="v131-role-tabs">${[['all','الكل'],...Object.entries(roleLabel)].map(([k,v])=>`<button class="${state.role===k?'active':''}" onclick="v131AccountFilter('role','${k}')">${v}</button>`).join('')}</nav><section class="v131-account-grid">${rows.map(card).join('')||'<div class="v131-empty">لا توجد حسابات مطابقة للبحث والفلترة.</div>'}</section><section id="v132AccountEditorHost"></section></section>`;
    adminContent.dataset.adminModule='accounts';
    adminContent.classList.add('admin-accounts-module');
    window.v131SyncAccountRole();
  }

  window.v131SyncAccountRole=()=>{
    const role=document.getElementById('aRole')?.value||'teacher';
    const courier=role==='courier';
    const box=document.getElementById('v163CourierAccountFields');if(box)box.hidden=!courier;
    const area=document.getElementById('aArea'),landmark=document.getElementById('aLandmark');
    if(area){area.hidden=courier;area.disabled=courier;}
    if(landmark){landmark.hidden=courier;landmark.disabled=courier;}
    const title=document.querySelector('#v131AccountForm h3');if(title)title.textContent=courier?'إضافة حساب مندوب':'إضافة حساب';
    const save=document.getElementById('v131SaveAccountButton');if(save)save.textContent=courier?'حفظ حساب المندوب':'حفظ الحساب';
    window.v131CourierAreaCount();
  };
  window.v131CourierAreaCount=()=>{const count=document.querySelectorAll('#v163CourierAreaPicker input:checked').length;const out=document.getElementById('v163CourierAreaCount');if(out)out.textContent=String(count);return count};
  window.v131CourierAreasSelectAll=()=>{document.querySelectorAll('#v163CourierAreaPicker input').forEach(x=>x.checked=true);window.v131CourierAreaCount()};
  window.v131CourierAreasClear=()=>{document.querySelectorAll('#v163CourierAreaPicker input').forEach(x=>x.checked=false);window.v131CourierAreaCount()};
  window.v131AccountFilter=(k,v)=>{state[k]=v;render()};
  window.v131ToggleAccountForm=(force)=>{const el=document.getElementById('v131AccountForm');if(!el)return;el.classList.toggle('open',typeof force==='boolean'?force:!el.classList.contains('open'));if(el.classList.contains('open')){window.v131SyncAccountRole();el.scrollIntoView({behavior:'smooth',block:'center'})}};
  window.v131AccountInfo=id=>{const x=allAccounts().find(a=>String(a.id)===String(id));if(!x)return;alert(`${x.name}\nنوع الحساب: ${roleLabel[x.role]}\nالصلاحية: ${x.role==='admin'?'إدارة كاملة':'المالية والتقارير فقط'}`)};
  window.renderAccountsAdmin=render;
  if(window.AlinAdminModules?.register)AlinAdminModules.register('accounts',()=>render());
})();

;
