/* ===== admin/js/accounts.js ===== */

(function(){AlinAdminModules.register('accounts',root=>{if(!root)return;root.classList.add('admin-accounts-module');const h=root.querySelector('h2');if(h&&!root.querySelector('.admin-module-note'))h.insertAdjacentHTML('afterend','<div class="admin-module-note">إدارة المدرسين والمكتبات وحالات الحسابات من هذا القسم.</div>')})})();

/* ===== admin/js/admin-accounts-v131.js ===== */
(function(){
  const state={query:'',role:'all',status:'all',area:'all'};
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const arr=v=>Array.isArray(v)?v:[];
  const roleLabel={teacher:'مدرس',library:'مكتبة',courier:'مندوب',accountant:'محاسب',admin:'مدير'};
  function initials(name){return String(name||'؟').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('')||'؟'}
  function allAccounts(){
    const teachers=arr(db?.accounts?.teachers).map(x=>({...x,role:'teacher'}));
    const libraries=arr(db?.accounts?.libraries).map(x=>({...x,role:'library'}));
    const couriers=arr(db?.accounts?.couriers||db?.couriers).map(x=>({...x,role:'courier'}));
    const accountantUser=localStorage.getItem('alin_v121_accountant_user');
    const accountant=accountantUser?[{id:'LOCAL-ACCOUNTANT',role:'accountant',name:'المحاسب',username:accountantUser,status:'active',area:'صلاحية مالية'}]:[];
    const admin=[{id:'LOCAL-ADMIN',role:'admin',name:'مدير منصة آلين',username:'admin',status:'active',area:'إدارة كاملة'}];
    return [...teachers,...libraries,...couriers,...accountant,...admin];
  }
  function normalizedStatus(x){const s=String(x.status||'active').toLowerCase();return ['active','open','enabled','approved'].includes(s)?'active':['pending','review'].includes(s)?'pending':'inactive'}
  function filtered(){return allAccounts().filter(x=>{
    const text=[x.name,x.username,x.phone,x.area,x.landmark,roleLabel[x.role]].join(' ').toLowerCase();
    return (!state.query||text.includes(state.query.toLowerCase()))&&(state.role==='all'||x.role===state.role)&&(state.status==='all'||normalizedStatus(x)===state.status)&&(state.area==='all'||String(x.area||'')===state.area);
  })}
  function areas(){return [...new Set(allAccounts().map(x=>String(x.area||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'))}
  function stats(){const a=allAccounts();return {all:a.length,active:a.filter(x=>normalizedStatus(x)==='active').length,inactive:a.filter(x=>normalizedStatus(x)==='inactive').length,teachers:a.filter(x=>x.role==='teacher').length,libraries:a.filter(x=>x.role==='library').length}}
  function card(x){
    const st=normalizedStatus(x), locked=['admin','accountant'].includes(x.role), phone=x.phone||x.mobile||'', meta=[x.username?`الدخول: ${escx(x.username)}`:'',x.area?escx(x.area):'',phone?escx(phone):''].filter(Boolean);
    return `<article class="v131-account-card"><div class="v131-avatar ${escx(x.role)}">${escx(initials(x.name))}</div><div class="v131-account-info"><h3>${escx(x.name||roleLabel[x.role])}</h3><div class="v131-account-meta"><span class="v131-chip">${roleLabel[x.role]||escx(x.role)}</span>${meta.map(m=>`<span class="v131-chip">${m}</span>`).join('')}<span class="v131-status ${st}">${st==='active'?'فعال':st==='pending'?'قيد المراجعة':'موقوف'}</span></div></div><div class="v131-card-actions">${locked?`<button class="secondary" onclick="v131AccountInfo('${escx(x.id)}')">تفاصيل الصلاحية</button>`:`<button class="secondary" onclick="v132OpenAccountEditor('${escx(x.id)}')">تعديل كامل</button><button class="warning" onclick="v132ToggleAccount('${escx(x.id)}','${st==='active'?'inactive':'active'}')">${st==='active'?'إيقاف':'تفعيل'}</button><button class="secondary" onclick="v132OpenActivity('${escx(x.id)}')">النشاط</button><button class="danger" onclick="v132SafeDeleteAccount('${escx(x.id)}')">حذف</button>`}</div></article>`
  }
  function render(){
    if(!window.adminContent)return;
    const s=stats(), rows=filtered();
    adminContent.innerHTML=`<section class="v131-accounts"><header class="v131-accounts-head"><div><h2>إدارة الحسابات</h2><p>إدارة المدرسين والمكتبات والمندوبين والصلاحيات من مكان واحد.</p></div><button class="v131-add-account" onclick="v131ToggleAccountForm()">+ إضافة حساب جديد</button></header><section class="v131-account-stats"><article class="v131-account-stat"><small>إجمالي الحسابات</small><b>${s.all}</b></article><article class="v131-account-stat"><small>الحسابات الفعالة</small><b>${s.active}</b></article><article class="v131-account-stat danger"><small>الحسابات الموقوفة</small><b>${s.inactive}</b></article><article class="v131-account-stat"><small>المدرسون</small><b>${s.teachers}</b></article><article class="v131-account-stat"><small>المكتبات</small><b>${s.libraries}</b></article></section><section id="v131AccountForm" class="v131-account-form"><h3>إضافة حساب</h3><div class="form-grid"><select id="aRole"><option value="teacher">مدرس</option><option value="library">مكتبة</option></select><input id="aName" placeholder="الاسم الكامل"><input id="aUser" placeholder="اسم الدخول"><input id="aPass" type="password" placeholder="الرمز السري"><input id="aArea" placeholder="المنطقة"><input id="aLandmark" placeholder="أقرب نقطة دالة"></div><div class="form-actions"><button class="secondary" onclick="v131ToggleAccountForm(false)">إلغاء</button><button onclick="addAccount()">حفظ الحساب</button></div></section><section class="v131-account-tools"><input id="v131AccountSearch" value="${escx(state.query)}" placeholder="ابحث بالاسم أو اسم الدخول أو المنطقة" oninput="v131AccountFilter('query',this.value)"><select onchange="v131AccountFilter('role',this.value)"><option value="all">كل أنواع الحسابات</option>${Object.entries(roleLabel).map(([k,v])=>`<option value="${k}" ${state.role===k?'selected':''}>${v}</option>`).join('')}</select><select onchange="v131AccountFilter('status',this.value)"><option value="all">كل الحالات</option><option value="active" ${state.status==='active'?'selected':''}>فعال</option><option value="inactive" ${state.status==='inactive'?'selected':''}>موقوف</option><option value="pending" ${state.status==='pending'?'selected':''}>قيد المراجعة</option></select><select onchange="v131AccountFilter('area',this.value)"><option value="all">كل المناطق</option>${areas().map(a=>`<option value="${escx(a)}" ${state.area===a?'selected':''}>${escx(a)}</option>`).join('')}</select></section><nav class="v131-role-tabs">${[['all','الكل'],...Object.entries(roleLabel)].map(([k,v])=>`<button class="${state.role===k?'active':''}" onclick="v131AccountFilter('role','${k}')">${v}</button>`).join('')}</nav><section class="v131-account-grid">${rows.map(card).join('')||'<div class="v131-empty">لا توجد حسابات مطابقة للبحث والفلترة.</div>'}</section><section id="v132AccountEditorHost"></section></section>`;
    adminContent.dataset.adminModule='accounts';
  }
  window.v131AccountFilter=(k,v)=>{state[k]=v;render()};
  window.v131ToggleAccountForm=(force)=>{const el=document.getElementById('v131AccountForm');if(!el)return;el.classList.toggle('open',typeof force==='boolean'?force:!el.classList.contains('open'));if(el.classList.contains('open'))el.scrollIntoView({behavior:'smooth',block:'center'})};
  window.v131AccountInfo=id=>{const x=allAccounts().find(a=>String(a.id)===String(id));if(!x)return;alert(`${x.name}\nنوع الحساب: ${roleLabel[x.role]}\nالصلاحية: ${x.role==='admin'?'إدارة كاملة':'المالية والتقارير فقط'}`)};
  window.renderAccountsAdmin=render;
  if(window.AlinAdminModules?.register) AlinAdminModules.register('accounts',()=>render());
})();

