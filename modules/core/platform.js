// === core/platform.js ===
/* ===== core/js/platform-legacy.js ===== */

async function uploadFileV52(folder,file,opts={}){
  const {required=false,type='any'}=opts;
  if(!file || !file.name || Number(file.size)<=0){
    if(required) throw new Error('اختر الملف من جهازك');
    return null;
  }
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  const mime=String(file.type||'').toLowerCase();
  if(type==='pdf' && ext!=='pdf' && !mime.includes('pdf')) throw new Error('اختر ملف PDF صحيح');
  if(type==='image' && !mime.startsWith('image/') && !['jpg','jpeg','png','webp'].includes(ext)) throw new Error('اختر صورة صحيحة');
  const safeExt=type==='pdf'?'pdf':(['jpg','jpeg','png','webp'].includes(ext)?ext:'png');
  const key=String(folder).replace(/[^a-z0-9_-]/gi,'')+'/'+Date.now()+'_'+Math.random().toString(36).slice(2,14)+'.'+safeExt;
  const contentType=type==='pdf'?'application/pdf':(file.type||'image/png');
  const {data,error}=await sb.storage.from('alin-files').upload(key,file,{upsert:false,contentType,cacheControl:'3600'});
  if(error) throw new Error('فشل رفع الملف: '+(error.message||'خطأ غير معروف'));
  return data?.path||key;
}

const SYSTEM_URL = 'https://jyavewwlgiaibtdqyzpd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5YXZld3dsZ2lhaWJ0ZHF5enBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTczMzcsImV4cCI6MjA5ODk5MzMzN30.fcjx4JrNdwd5Xrm_Nn1CaWWJoJLF6_DyYGakFPuGwGQ';
localStorage.removeItem('ALIN_SYSTEM_URL');
localStorage.removeItem('ALIN_رابط النظام');
localStorage.removeItem('ALIN_SUPABASE_ANON_KEY');
let sb = null;

let db = {accounts:{teachers:[],libraries:[]},booklets:[],products:[],categories:[],banners:[],coupons:[],notifications:[],orders:[],permits:[],ledger:[],withdrawals:[],audit:[],settings:{storeType:'booklet'}};
let current = null, pendingRole = '', checkoutItem = null;

/* V115: live state bridge for modular role files */
try{
  const expose=(name,getter,setter)=>{
    const d=Object.getOwnPropertyDescriptor(window,name);
    if(!d||d.configurable) Object.defineProperty(window,name,{configurable:true,enumerable:false,get:getter,set:setter});
  };
  expose('db',()=>db,v=>{db=v||db});
  expose('current',()=>current,v=>{current=v});
  expose('pendingRole',()=>pendingRole,v=>{pendingRole=v||''});
  expose('checkoutItem',()=>checkoutItem,v=>{checkoutItem=v});
  expose('financialEntries',()=>db.financialEntries||db.financial_entries||[],v=>{db.financialEntries=v||[];db.financial_entries=v||[]});
  expose('financialPayouts',()=>db.financialPayouts||db.financial_payouts||[],v=>{db.financialPayouts=v||[];db.financial_payouts=v||[]});
  expose('librarySettlements',()=>db.librarySettlements||db.library_settlements||[],v=>{db.librarySettlements=v||[];db.library_settlements=v||[]});
  expose('courierSettlements',()=>db.courierSettlements||[],v=>{db.courierSettlements=v||[]});
  expose('couriers',()=>db.couriers||db.accounts?.couriers||[],v=>{db.couriers=v||[]});
}catch(e){console.warn('[Alin V115 state bridge]',e);}

// ALIN V38: عناصر وهمية آمنة حتى لا تتوقف الواجهة إذا حذفنا حقول الفلترة من المتجر
const ALIN_DUMMY_EL = { value:'', innerHTML:'', textContent:'', style:{display:''}, classList:{add(){},remove(){},toggle(){}}, addEventListener(){}, querySelector(){return null;} };
const safeEl = id => document.getElementById(id) || ALIN_DUMMY_EL;
const searchInput = safeEl('searchInput');
const filterCategory = safeEl('filterCategory');
const filterTeacher = safeEl('filterTeacher');
const money = n => (+n || 0).toLocaleString('ar-IQ');
const teacherName = id => db.accounts.teachers.find(x => x.id === id)?.name || '';
const uid = p => p + Math.random().toString(16).slice(2,10) + Date.now().toString(16).slice(-6);

function init(){
  if(!SYSTEM_URL || !SUPABASE_ANON_KEY || !window.supabase){ sb=null; return false; }
  if(!sb) sb = window.supabase.createClient(SYSTEM_URL, SUPABASE_ANON_KEY);
  return true;
}
function requireConnection(){
  if(init()) return true;
  const msg='الاتصال بالنظام غير مضبوط. ادخل إلى الإعدادات واحفظ رابط النظام ومفتاح الربط مرة واحدة، ثم أعد المحاولة.';
  if(current?.role==='admin'){ try{ renderSettingsAdmin(); }catch(e){} }
  alert(msg);
  return false;
}
function openSystemSettings(){ renderSettingsAdmin(); }
async function saveSystemSettings(){ if(systemMsg) systemMsg.textContent='الاتصال مباشر ومثبت ولا يحتاج إدخال رابط أو مفتاح.'; }
async function query(table){ if(!requireConnection()) return []; const {data,error}=await sb.from(table).select('*'); if(error)throw error; return data||[]; }
async function insert(table,row){ if(table==='orders'&&window.ALIN_CONFIG?.authEnabled===true)throw new Error('إنشاء الطلب المباشر متوقف؛ استخدم خدمة الطلب الآمنة'); if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط'); const {data,error}=await sb.from(table).insert(row).select().single(); if(error)throw error; return data; }
async function update(table,values,match){ if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط'); let q=sb.from(table).update(values); Object.entries(match).forEach(([k,v])=>q=q.eq(k,v)); const {error}=await q; if(error)throw error; }
async function removeRow(table,match){ if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط'); let q=sb.from(table).delete(); Object.entries(match).forEach(([k,v])=>q=q.eq(k,v)); const {error}=await q; if(error)throw error; }

async function audit(kind,text){ try{ await insert('audit',{id:uid('A'),kind,text}); }catch(e){} }
async function ensureStorageReady(){
  if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط');
  try{
    const {error}=await sb.storage.from('alin-files').list('', {limit:1});
    if(error){
      const m=String(error.message||'').toLowerCase();
      if(m.includes('bucket') || m.includes('not found')) throw new Error('مجلد التخزين alin-files غير موجود. نفّذ ملف RUN_ON_SUPABASE_v2_0_15_COMPLETE.sql مرة واحدة.');
      if(m.includes('policy') || m.includes('permission') || m.includes('row-level')) throw new Error('صلاحيات التخزين ناقصة. نفّذ ملف RUN_ON_SUPABASE_v2_0_15_COMPLETE.sql مرة واحدة.');
    }
  }catch(e){
    if(String(e.message||'').includes('RUN_ON_SUPABASE_v2_0_15_COMPLETE.sql')) throw e;
  }
}
function safeFileName(name){
  const base=String(name||'file').split(/[\\/]/).pop().replace(/\.[^.]+$/,'');
  return base.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'file';
}
async function uploadFile(bucketPath, file, opts={}){
  const {required=false, type='any'} = opts;
  const isRealFile = file && typeof file === 'object' && file.name && Number(file.size) > 0;
  if(!isRealFile){
    if(required) throw new Error('الملف مطلوب. اضغط اختيار ملف وحدد الملف من جهازك.');
    return null;
  }
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  const mime=String(file.type||'').toLowerCase();
  if(type==='pdf' && !(ext === 'pdf' || mime.includes('pdf'))) throw new Error('اختر ملف PDF حقيقي فقط');
  if(type==='image' && !(mime.startsWith('image/') || ['jpg','jpeg','png','webp','gif','svg'].includes(ext))) throw new Error('اختر صورة صحيحة فقط');
  if(file.size < 100) throw new Error('الملف فارغ أو تالف، اختر الملف من جديد');
  await ensureStorageReady();
  const safeExt = type==='pdf' ? 'pdf' : (ext || (type==='image'?'png':'bin'));
  const folder=String(bucketPath||'files').replace(/^\/+|\/+$/g,'');
  const path=`${folder}/${Date.now()}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}.${safeExt}`;
  const contentType = type==='pdf' ? 'application/pdf' : (file.type || (type==='image'?'image/png':'application/octet-stream'));
  const cleanFile = file.slice ? new File([file.slice(0,file.size)], file.name, {type: contentType}) : file;
  const {data,error}=await sb.storage.from('alin-files').upload(path,cleanFile,{upsert:true, contentType, cacheControl:'3600'});
  if(error){
    const m=String(error.message||'').toLowerCase();
    if(m.includes('bucket') || m.includes('not found')) throw new Error('مجلد التخزين alin-files غير موجود. نفّذ ملف RUN_ON_SUPABASE_v2_0_15_COMPLETE.sql مرة واحدة.');
    if(m.includes('policy') || m.includes('permission') || m.includes('row-level')) throw new Error('صلاحيات الرفع ناقصة. نفّذ ملف RUN_ON_SUPABASE_v2_0_15_COMPLETE.sql مرة واحدة.');
    if(m.includes('invalid key')) throw new Error('تعذر إنشاء اسم آمن للملف. تم إصلاح هذا الخلل في V51؛ حدّث ملفات الموقع وحاول الرفع من جديد.');
    throw new Error('فشل رفع الملف: '+(error.message||'خطأ غير معروف'));
  }
  const publicUrl=mediaUrl(data?.path||path);
  try{
    const ok=await checkPublicFile(publicUrl);
    if(!ok) throw new Error('الملف رُفع لكن الرابط غير عام. نفّذ ملف RUN_ON_SUPABASE_v2_0_15_COMPLETE.sql.');
  }catch(e){
    if(String(e.message||'').includes('RUN_ON_SUPABASE_v2_0_15_COMPLETE.sql')) throw e;
  }
  return data?.path||path;
}
function mediaUrl(path){
  if(!path) return '';
  let raw=String(path).trim();
  try{
    if(/^https?:\/\//i.test(raw)){
      const u=new URL(raw);
      const markers=['/storage/v1/object/public/','/storage/v1/object/sign/','/storage/v1/object/authenticated/'];
      const marker=markers.find(m=>u.pathname.includes(m));
      if(!marker) return raw;
      const tail=decodeURIComponent(u.pathname.split(marker)[1]||'');
      const parts=tail.split('/').filter(Boolean);
      const bucket=parts.shift()||'';
      if(bucket==='alin-files') raw=parts.join('/');
      else {
        const folderMap={booklets:'booklets',covers:'covers',teachers:'teachers',brand:'brand',products:'products','teacher-requests':'teacher-requests'};
        raw=(folderMap[bucket]||bucket)+'/'+parts.join('/');
      }
    }
  }catch(e){}
  raw=raw.replace(/^\/+/, '').replace(/^alin-files\//,'');
  const {data}=sb.storage.from('alin-files').getPublicUrl(raw);
  return data.publicUrl;
}
async function checkPublicFile(url){
  try{
    const r=await fetch(url,{method:'GET',cache:'no-store'});
    if(!r.ok) return false;
    const t=(r.headers.get('content-type')||'').toLowerCase();
    if(t.includes('application/json')) return false;
    return true;
  }catch(e){ return true; }
}

async function load(){
  if(!init()){ renderAll(); return; }
  try{
    const optional=table=>query(table).catch(error=>{console.warn(`[ALIN load] optional table ${table}`,error);return []});
    const [accounts,booklets,products,categories,banners,coupons,orders,permits,ledger,withdrawals,auditRows,settingsRows,teacherRequests,teacherPayouts,financialEntries,financialPayouts,financialReturns,librarySettlements,courierSettlements,notifications] = await Promise.all([
      query('accounts'),query('booklets'),query('products'),query('categories'),query('banners'),optional('coupons'),query('orders'),query('permits'),query('ledger'),query('withdrawals'),query('audit'),query('settings'),optional('teacher_requests'),optional('teacher_payouts'),optional('financial_entries'),optional('financial_payouts'),optional('financial_returns'),optional('library_settlements'),optional('delegate_settlements'),optional('notifications')
    ]);
    db.accounts={all:accounts,teachers:accounts.filter(x=>x.role==='teacher'),libraries:accounts.filter(x=>x.role==='library'),couriers:accounts.filter(x=>x.role==='courier'),accountants:accounts.filter(x=>x.role==='accountant')};
    db.booklets=booklets; db.products=products; db.categories=categories; db.banners=banners; db.coupons=coupons;
    db.orders=orders.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')); db.permits=permits; db.ledger=ledger; db.withdrawals=withdrawals;
    db.audit=auditRows.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')); db.settings={storeType:'booklet'};
    db.teacherRequests=teacherRequests; db.teacherPayouts=teacherPayouts; db.teacher_payouts=teacherPayouts;
    db.financialEntries=financialEntries; db.financial_entries=financialEntries; db.financialPayouts=financialPayouts; db.financial_payouts=financialPayouts; db.financialReturns=financialReturns;
    db.librarySettlements=librarySettlements; db.library_settlements=librarySettlements; db.courierSettlements=courierSettlements; db.notifications=notifications;
    settingsRows.forEach(x=>db.settings[x.key]=x.value);
    try{v19Notifications=notifications}catch(_){ }
    renderAll();
    window.dispatchEvent(new CustomEvent('alin:data-refreshed',{detail:{source:'platform-load'}}));
  }catch(e){ console.error(e); if(current?.role==='admin') alert('تعذر تحميل بيانات النظام، تم تثبيت الواجهة بدون إيقاف.'); }
}
async function seedData(){
  throw new Error('تم تعطيل إنشاء الحسابات والبيانات التجريبية في النسخة الآمنة');
}

/* PLATFORM STEP 10: storefront ownership moved to modules/store/discovery.js. */

/* Login, logout, page navigation and role guards live in modules/core/navigation.js. */
/* PLATFORM STEP 10: legacy storefront override removed. */

/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */





/* v2.2.3: legacy direct PDF opener removed; library printing module is authoritative. */
async function usePermit(id){ const p=db.permits.find(x=>x.id===id); if(!p || p.used>=p.qty)return alert('إذن النسخ منتهي'); const used=(+p.used||0)+1; await update('permits',{used,status:used>=p.qty?'done':'active'},{id}); await audit('copy','استخدام إذن نسخة '+id); await load(); }
/* PLATFORM STEP 9: admin statistics are owned by modules/admin/shell.js. */
/* PLATFORM STEP 8: finance implementation moved to core/finance-runtime.js and modules/admin/finance.js. */
/* PLATFORM STEP 9: admin routing is owned by modules/admin/shell.js. */
/* PLATFORM STEP 9: account administration is owned by modules/admin/accounts.js. */

/* Product, category and booklet administration is implemented only in modules/admin/products.js and modules/admin/booklets.js. */





/* platform step 5: removed legacy renderOrdersAdmin; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy devPay; authoritative code is modules/admin/orders.js */

function renderAdsAdmin(){ adminContent.innerHTML=`<h2>اللوحة الإعلانية</h2><div class="form-grid"><input id="adTitle" placeholder="عنوان الإعلان"><input id="adText" placeholder="نص الإعلان"><button onclick="addAd()">إضافة إعلان</button></div>${db.banners.map(x=>`<div class="row"><div><b>${x.title}</b><small>${x.text}</small></div><button onclick="toggleAd('${x.id}',${x.active})">${x.active?'إيقاف':'تشغيل'}</button></div>`).join('')}`; }
async function addAd(){ await insert('banners',{id:uid('AD'),title:adTitle.value,text:adText.value,active:1}); await audit('banner','إضافة إعلان'); await load(); renderAdsAdmin(); }
async function toggleAd(id,active){ await update('banners',{active:active?0:1},{id}); await load(); renderAdsAdmin(); }

function renderSettingsAdmin(){ adminContent.innerHTML=`<h2>إعدادات المنصة</h2><div class="form-grid"><input id="platformNameInput" value="آلين" placeholder="اسم المنصة"><input id="platformPhoneInput" value="" placeholder="رقم الهاتف"><button onclick="saveSystemSettings()">حفظ</button></div><div id="systemMsg"></div>`; }
function renderAll(){ window.renderStore?.(); window.renderTeacher?.(); window.renderLibrary?.(); window.adminStatsRender?.(); }
document.addEventListener('DOMContentLoaded', load);
/* ================= ALIN V18 UPGRADE ================= */
const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function emptyState(text){ return `<div class="empty">${esc(text)}</div>`; }
function toast(text){ const old=document.querySelector('.toast'); if(old)old.remove(); const el=document.createElement('div'); el.className='toast'; el.textContent=text; document.body.appendChild(el); setTimeout(()=>el.remove(),2200); }
/* PLATFORM STEP 9: legacy admin router and account CRUD removed. */




renderAdsAdmin = function(){ adminContent.innerHTML=`<h2>اللوحة الإعلانية</h2><div class="form-grid"><input id="adTitle" placeholder="عنوان الإعلان"><input id="adText" placeholder="نص الإعلان"><button onclick="addAd()">إضافة إعلان</button></div>${db.banners.length?db.banners.map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${esc(x.text)}</small></div><div class="row-actions"><button class="secondary" onclick="editAd('${x.id}')">تعديل</button><button onclick="toggleAd('${x.id}',${x.active})">${x.active?'إيقاف':'تشغيل'}</button><button class="danger" onclick="deleteAd('${x.id}')">حذف</button></div></div>`).join(''):emptyState('لا توجد إعلانات')}`; }
async function editAd(id){ const x=db.banners.find(a=>a.id===id); if(!x)return; const title=prompt('عنوان الإعلان',x.title||''); if(title===null)return; const text=prompt('نص الإعلان',x.text||''); if(text===null)return; await update('banners',{title:title.trim(),text:text.trim()},{id}); await load(); renderAdsAdmin(); toast('تم تعديل الإعلان'); }
async function deleteAd(id){ if(!confirm('حذف الإعلان؟'))return; try{await removeRow('banners',{id}); await load(); renderAdsAdmin(); toast('تم حذف الإعلان')}catch(e){alert(e.message)} }


/* platform step 5: removed legacy renderOrdersAdmin; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy orderStatus; authoritative code is modules/admin/orders.js */


/* ================= ALIN V19 NOTIFICATIONS ================= */
let v19Notifications=[];
const v19OldLoad=load;
load=async function(){ await v19OldLoad(); if(sb){try{v19Notifications=await query('notifications');db.notifications=v19Notifications}catch(error){console.warn('[ALIN notifications] optional load failed',error);v19Notifications=[];db.notifications=[]}} applyBrand(); renderCartBadge(); renderAll(); };
function applyBrand(){ const n=db.settings.platform_name||'منصة آلين'; document.title=n; document.querySelectorAll('.brand b').forEach(x=>x.textContent=n.replace('منصة ','')); const hero=document.querySelector('.hero'); if(hero)hero.innerHTML=`<h2>${esc(db.settings.hero_title||n)}</h2><p>${esc(db.settings.hero_text||'')}</p>`; }

/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */

function renderNotificationsAdmin(){
  const rows=(typeof alinV78NotificationRows==='function'?alinV78NotificationRows():(v19Notifications||[]));
  adminContent.innerHTML=`<h2>الإشعارات</h2><div class="form-grid"><select id="ntAudience"><option value="all">الجميع</option><option value="teacher">المدرسين</option><option value="library">المكتبات</option><option value="student">المتجر / الطلبة</option></select><input id="ntTitle" placeholder="العنوان"><input id="ntText" placeholder="نص الإشعار"><button onclick="sendNotification()">إرسال</button></div>${rows.map(n=>`<div class="row"><div><b>${esc(n.title||'')}</b><small>${esc(n.message||n.text||'')} — ${esc(n.target_role||n.audience||'all')}</small></div><button class="danger" onclick="deleteNotification('${n.id}')">حذف</button></div>`).join('')||emptyState('لا توجد إشعارات')}`;
}
async function sendNotification(){
  const title=document.getElementById('ntTitle')?.value.trim()||'';
  const message=document.getElementById('ntText')?.value.trim()||'';
  const target_role=document.getElementById('ntAudience')?.value||'all';
  if(!title)return alert('اكتب عنوان الإشعار');
  try{
    await insert('notifications',{id:uid('NT'),target_role,target_id:'',title,message,status:'active',created_at:new Date().toISOString(),from_user:'admin'});
    try{v19Notifications=await query('notifications');}catch(_){}
    try{db.notifications=await query('notifications');}catch(_){}
    await audit('notification','إرسال إشعار '+title);
    renderNotificationsAdmin();
    if(typeof alinV78RenderBadge==='function')alinV78RenderBadge();
    toast('تم إرسال الإشعار');
  }catch(e){ console.error('Notification send failed',e); alert('فشل إرسال الإشعار إلى Supabase. نفّذ ملف alin_v78_notifications_center.sql ثم أعد المحاولة.'); }
}
async function deleteNotification(id){
  await removeRow('notifications',{id});
  try{v19Notifications=await query('notifications');}catch(_){}
  try{db.notifications=await query('notifications');}catch(_){}
  renderNotificationsAdmin();
}








/* platform step 5: removed legacy renderOrdersAdmin; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy orderStatus; authoritative code is modules/admin/orders.js */
renderSettingsAdmin=function(){adminContent.innerHTML=`<h2>إعدادات المنصة</h2><div class="form-grid"><input id="platformName" value="${esc(db.settings.platform_name||'منصة آلين')}" placeholder="اسم المنصة"><input id="platformPhone" value="${esc(db.settings.platform_phone||'')}" placeholder="رقم الهاتف"><input id="heroTitle" value="${esc(db.settings.hero_title||'')}" placeholder="عنوان الواجهة"><input id="heroText" value="${esc(db.settings.hero_text||'')}" placeholder="نص الواجهة"><input id="lowStockDefault" type="number" value="${esc(db.settings.low_stock_default||'5')}" placeholder="حد المخزون المنخفض"><button onclick="savePlatformSettings()">حفظ الإعدادات</button></div><div class="settings-preview"><b>معاينة</b><h3>${esc(db.settings.hero_title||'')}</h3><p>${esc(db.settings.hero_text||'')}</p></div>`;}
async function savePlatformSettings(){const vals={platform_name:platformName.value.trim(),platform_phone:platformPhone.value.trim(),hero_title:heroTitle.value.trim(),hero_text:heroText.value.trim(),low_stock_default:lowStockDefault.value||'5'};for(const [key,value] of Object.entries(vals))await sb.from('settings').upsert({key,value});await audit('settings','تحديث إعدادات المنصة');await load();renderSettingsAdmin();toast('تم حفظ الإعدادات')}

/* ================= ALIN V21 LIBRARY SYSTEM ================= */
function libIsOpen(lib){ return lib?.is_open !== false && lib?.is_open !== 'false'; }
function libStatusText(lib){ return libIsOpen(lib) ? 'مفتوح الآن' : (lib.open_note || 'مغلق حالياً'); }
function activeLibraries(){ return db.accounts.libraries.filter(x=>x.status==='active'); }

const v21OldApplyBrand = applyBrand;
applyBrand = function(){
  v21OldApplyBrand();
  document.title=(db.settings.platform_name||'منصة آلين');
  const badge=document.querySelector('.version-badge'); if(badge) badge.textContent='منصة آلين';
};



function librariesVisibleList(){
  return `<div class="lib-list">${activeLibraries().map(x=>`<div class="lib-choice ${libIsOpen(x)?'open':'closed'}"><b>${esc(x.name)}</b>${libIsOpen(x)?'<span class="open-badge">مفتوح</span>':'<span class="closed-badge">مغلق</span>'}<small>${esc(x.area||'')} — ${esc(x.landmark||'')}</small>${!libIsOpen(x)?`<small>${esc(x.open_note||'لا يستقبل طلبات حالياً')}</small>`:''}</div>`).join('')}</div>`;
}











/* platform step 5: removed legacy v21 order alias; authoritative code is modules/admin/orders.js */


/* platform step 5: removed legacy orderStatus; authoritative code is modules/admin/orders.js */

function openOrderPdf(orderId){
  const o=db.orders.find(x=>x.id===orderId); const b=db.booklets.find(x=>x.id===o?.item_id);
  if(!b?.file_path) return alert('لا يوجد ملف PDF لهذه الملزمة');
  const url=mediaUrl(b.file_path)+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>عارض الملزمة للطباعة</h2><div class="print-only-note">الملف مخصص للعرض والطباعة من داخل المنصة. زر التحميل غير ظاهر.</div><div class="pdf-viewer"><iframe id="pdfFrame" src="${url}"></iframe></div><div class="row-actions no-print"><button onclick="printPdfFrame()">طباعة PDF</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
}
function openProtected(id){
  const p=db.permits.find(x=>x.id===id); const orderId=p?.order_id; if(orderId) return openOrderPdf(orderId);
  const b=db.booklets.find(x=>x.id===p?.booklet_id); if(!b?.file_path)return alert('لا يوجد ملف PDF');
  checkoutBox.innerHTML=`<h2>عارض الملزمة للطباعة</h2><div class="print-only-note">الملف مخصص للعرض والطباعة فقط.</div><div class="pdf-viewer"><iframe id="pdfFrame" src="${mediaUrl(b.file_path)}#toolbar=0&navpanes=0&scrollbar=1"></iframe></div><button onclick="printPdfFrame()">طباعة PDF</button>`;
  checkoutModal.classList.remove('hidden');
}
function printPdfFrame(){
  try{ document.getElementById('pdfFrame')?.contentWindow?.print(); }
  catch(e){ alert('إذا لم تبدأ الطباعة، استخدم أمر الطباعة من المتصفح بدون تنزيل الملف.'); }
}
function printReceipt(orderId){
  const o=db.orders.find(x=>x.id===orderId), lib=db.accounts.libraries.find(x=>x.id===o?.library_id);
  if(!o)return;
  checkoutBox.innerHTML=`<div class="receipt"><h2>وصل منصة آلين</h2><div class="receipt-line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div><div class="receipt-line"><b>الطالب</b><span>${esc(o.student_name||'')}</span></div><div class="receipt-line"><b>الهاتف</b><span>${esc(o.student_phone||'')}</span></div><div class="receipt-line"><b>المادة</b><span>${esc(o.title||'')}</span></div><div class="receipt-line"><b>العدد</b><span>${o.qty}</span></div><div class="receipt-line"><b>المبلغ</b><span>${money(o.total)} د.ع</span></div><div class="receipt-line"><b>المكتبة</b><span>${esc(lib?.name||'')}</span></div><div class="receipt-line"><b>العنوان</b><span>${esc((lib?.area||'')+' — '+(lib?.landmark||''))}</span></div><p>شكراً لاستخدام منصة آلين</p></div><div class="row-actions no-print"><button onclick="window.print()">طباعة الوصل</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
}



/* ================= ALIN V22 TEACHER SYSTEM ================= */
db.teacherRequests = [];
db.teacherRequests = [];
let activeTeacherTab = 'dashboard';
/* v2.2.3: teacher payout/load wrapper removed; base load is authoritative. */













function isMissingTableError(e, tableName){
  const msg=String(e?.message||e||'');
  return msg.includes(tableName) && (msg.includes('Could not find the table') || msg.includes('schema cache') || msg.includes('does not exist'));
}



















/* ================= ALIN V23 MALZAMA STORE DISPLAY ================= */
const ALIN_VERSION = 'V23 Malzama';







/* PLATFORM STEP 10: legacy storefront override removed. */

/* PLATFORM STEP 10: legacy storefront override removed. */

async function uploadBookletV23(){
  try{
    const f=new FormData(bookForm);
    const cover=await uploadFile('covers',f.get('cover'),{type:'image'});
    const ti=await uploadFile('teachers',f.get('teacherImage'),{type:'image'});
    const pdfFile=f.get('bookletFile');
    if(!pdfFile||!pdfFile.name)throw new Error('ملف PDF مطلوب');
    const fp=await uploadFile('booklets',pdfFile,{required:true,type:'pdf'});
    const teacherId=String(f.get('teacherId')||'');
    const teacherPhone=String(f.get('teacherPhone')||teacherObj(teacherId).phone||'').trim();
    const row={id:uid('B'),title:String(f.get('title')||'').trim(),teacher_id:teacherId,subject:String(f.get('subject')||'').trim(),grade:String(f.get('grade')||'').trim(),price:+f.get('price')||0,cover_path:cover,teacher_image_path:ti,teacher_phone:teacherPhone,file_path:fp,file_name:pdfFile.name,status:'published',store_pdf_visible:false,library_pdf_print:true};
    if(!row.title) throw new Error('اكتب اسم الملزمة');
    await insert('booklets',row);
    if(teacherPhone) { try{ await update('accounts',{phone:teacherPhone},{id:teacherId}); }catch(e){} }
    await audit('booklet','نشر ملزمة V23 '+row.title);
    await load(); renderBookletsAdmin(); toast('تم رفع الملزمة ونشرها في المتجر بدون PDF');
  }catch(e){ alert(e.message); }
}







function printOrderReceipt(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  const lib=(db.accounts.libraries||[]).find(l=>l.id===o.library_id)||{};
  checkoutBox.innerHTML=`<div class="receipt"><h2>وصل طلب منصة آلين</h2><p>المكتبة: ${esc(lib.name||'-')} — ${esc(lib.area||'')}</p><div class="receipt-line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div><div class="receipt-line"><b>الطالب</b><span>${esc(o.student_name)}</span></div><div class="receipt-line"><b>المادة</b><span>${esc(o.title)} × ${o.qty}</span></div><div class="receipt-line"><b>الإجمالي</b><span>${money(o.total)} د.ع</span></div></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
}

/* ================= ALIN V24 FINANCIAL LEDGER ================= */
/* ================= ALIN V25 LIBRARY SETTLEMENTS ================= */
// ===== V26 Manual Mastercard Payment =====
function manualPayInfoHtml(){
  const card=esc(db.settings.manual_card_number||'يحدد من لوحة الإدارة');
  const holder=esc(db.settings.manual_card_holder||'منصة آلين');
  return `<div class="checkout-total"><b>تحويل يدوي بالماستر كارد</b><br>حوّل المبلغ إلى البطاقة: <b>${card}</b><br>اسم المستلم: ${holder}<br><small>بعد التحويل ارفع صورة الوصل. الطلب يبقى بانتظار تأكيد الإدارة.</small></div>`;
}
function toggleManualPay(){const v=document.querySelector('input[name="payMethod"]:checked')?.value; document.getElementById('manualPayBox')?.classList.toggle('hidden',v!=='manual_mastercard');}



/* platform step 5: removed legacy viewPaymentReceipt; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy approveManualPayment; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy rejectManualPayment; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy v25 order alias; authoritative code is modules/admin/orders.js */


/* platform step 5: removed legacy renderOrdersAdmin; authoritative code is modules/admin/orders.js */

const _renderSettingsAdminV26=renderSettingsAdmin;
renderSettingsAdmin=function(){_renderSettingsAdminV26();adminContent.innerHTML+=`<h3>الدفع اليدوي بالماستر كارد</h3><div class="form-grid"><input id="manualCardNumber" value="${esc(db.settings.manual_card_number||'')}" placeholder="رقم البطاقة أو رقم التحويل"><input id="manualCardHolder" value="${esc(db.settings.manual_card_holder||'')}" placeholder="اسم صاحب البطاقة"></div><button onclick="saveManualCardSettings()">حفظ بيانات الدفع</button><p><small>هذه البيانات تظهر للطالب لغرض التحويل اليدوي فقط. لا يتم طلب رقم بطاقة الطالب أو CVV داخل المنصة.</small></p>`;}
async function saveManualCardSettings(){for(const [key,value] of [['manual_card_number',manualCardNumber.value.trim()],['manual_card_holder',manualCardHolder.value.trim()]]){const exists=(await query('settings')).find(x=>x.key===key);if(exists)await update('settings',{value},{key});else await insert('settings',{key,value});}await audit('settings','تحديث بيانات الدفع اليدوي');await load();renderSettingsAdmin();alert('تم حفظ بيانات الدفع اليدوي');}


/* ================= ALIN V27 UI REFRESH + ADMIN SECURITY ================= */
window.ALIN_VERSION='V27 UI Refresh';
try{document.title=(db?.settings?.platform_name||'منصة آلين')}catch(e){}

async function sha256Text(text){
  if(window.crypto&&crypto.subtle){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  return 'plain:'+text;
}
async function settingsSet(key,value){
  const exists=(await query('settings')).find(x=>x.key===key);
  if(exists) await update('settings',{value},{key}); else await insert('settings',{key,value});
}
function adminUser(){return db.settings.admin_username||'admin'}
async function adminPassOk(pass){
  const saved=db.settings.admin_password_hash;
  if(!saved) return false;
  return (await sha256Text(pass))===saved;
}
/* Legacy local admin login removed; admin access uses Supabase Auth through navigation.js. */
const _renderSettingsAdminV27=renderSettingsAdmin;
renderSettingsAdmin=function(){
  _renderSettingsAdminV27();
  adminContent.innerHTML+=`<div class="settings-section security-box"><h3>أمان حساب المدير</h3><p class="muted">غيّر اسم الدخول والرمز السري للمدير من هنا. الرمز الجديد يحفظ بصيغة مشفرة داخل قاعدة البيانات.</p><div class="form-grid"><input id="adminLoginName" value="${esc(adminUser())}" placeholder="اسم دخول المدير"><input id="adminCurrentPass" type="password" placeholder="الرمز الحالي"><input id="adminNewPass" type="password" placeholder="الرمز الجديد"><input id="adminNewPass2" type="password" placeholder="تأكيد الرمز الجديد"></div><button onclick="saveAdminSecurity()">حفظ بيانات المدير</button><div id="adminSecurityMsg"></div></div>`;
};
async function saveAdminSecurity(){
  try{
    const username=adminLoginName.value.trim();
    const currentPass=adminCurrentPass.value.trim();
    const newPass=adminNewPass.value.trim();
    const newPass2=adminNewPass2.value.trim();
    if(!username) throw new Error('اكتب اسم دخول المدير');
    if(!(await adminPassOk(currentPass))) throw new Error('الرمز الحالي غير صحيح');
    await settingsSet('admin_username',username);
    if(newPass){
      if(newPass.length<4) throw new Error('الرمز الجديد قصير');
      if(newPass!==newPass2) throw new Error('تأكيد الرمز غير مطابق');
      await settingsSet('admin_password_hash',await sha256Text(newPass));
    }
    await audit('security','تغيير بيانات دخول المدير');
    await load();
    renderSettingsAdmin();
    toast('تم حفظ بيانات المدير');
  }catch(e){
    if(window.adminSecurityMsg) adminSecurityMsg.textContent=e.message;
    alert(e.message);
  }
}

/* ================= ALIN V28 BRAND MANAGER ================= */
window.ALIN_VERSION='Alin Clean';
try{document.title=(db?.settings?.platform_name||'منصة آلين')}catch(e){}
function brandPublicUrl(path){
  if(!path) return '';
  if(String(path).startsWith('http')) return path;
  try{return mediaUrl(path)}catch(e){return ''}
}
function setLogoNode(node, url, fallbackText='آ'){
  if(!node) return;
  if(url) node.innerHTML=`<img class="logo-img" src="${esc(url)}" alt="شعار آلين">`;
  else node.textContent=fallbackText;
}
function applyBrandV28(){
  const n=db.settings.platform_name||'منصة آلين';
  document.title=n;
  const logoUrl=brandPublicUrl(db.settings.platform_logo_path||db.settings.platform_logo_url||'');
  const iconUrl=brandPublicUrl(db.settings.platform_icon_path||db.settings.platform_icon_url||'');
  document.querySelectorAll('.login-card .logo').forEach(x=>setLogoNode(x,logoUrl,'آ'));
  document.querySelectorAll('.topbar .logo.small').forEach(x=>setLogoNode(x,iconUrl||logoUrl,'آ'));
  document.querySelectorAll('.brand b').forEach(x=>x.textContent=n.replace('منصة ',''));
  const favicon=document.querySelector('link[rel="icon"]'); if(favicon&&iconUrl) favicon.href=iconUrl;
  const apple=document.querySelector('link[rel="apple-touch-icon"]'); if(apple&&iconUrl) apple.href=iconUrl;
  const theme=document.querySelector('meta[name="theme-color"]'); if(theme&&db.settings.theme_color) theme.content=db.settings.theme_color;
  try{
    if(iconUrl){
      const manifest={name:n,short_name:(db.settings.platform_short_name||'آلين'),description:'منصة آلين للتصميم والقرطاسية والملازم',lang:'ar',dir:'rtl',start_url:'./',scope:'./',display:'standalone',orientation:'portrait-primary',background_color:'#111827',theme_color:'#111827',icons:[{src:iconUrl,sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:iconUrl,sizes:'512x512',type:'image/png',purpose:'any maskable'}]};
      const blob=new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'});
      const m=document.querySelector('link[rel="manifest"]'); if(m) m.href=URL.createObjectURL(blob);
    }
  }catch(e){}
}
const _renderAllV28=renderAll;
renderAll=function(){_renderAllV28();setTimeout(applyBrandV28,30)};
const _renderSettingsAdminV28=renderSettingsAdmin;
renderSettingsAdmin=function(){
  _renderSettingsAdminV28();
  const logoUrl=brandPublicUrl(db.settings.platform_logo_path||db.settings.platform_logo_url||'');
  const iconUrl=brandPublicUrl(db.settings.platform_icon_path||db.settings.platform_icon_url||'');
  adminContent.innerHTML+=`<div class="settings-section brand-uploader"><h3>هوية المنصة</h3><p class="muted">تحكم بشعار البرنامج وأيقونة التطبيق الرئيسية من لوحة المدير.</p><div class="brand-logo-preview"><div><small>الشعار الحالي</small><div class="preview-box preview-wide">${logoUrl?`<img class="logo-img" src="${esc(logoUrl)}">`:'آ'}</div></div><div><small>أيقونة التطبيق</small><div class="preview-box">${iconUrl?`<img class="logo-img" src="${esc(iconUrl)}">`:'آ'}</div></div></div><div class="form-grid"><label>رفع شعار البرنامج<input id="brandLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><label>رفع أيقونة التطبيق<input id="brandIconFile" type="file" accept="image/png,image/jpeg,image/webp"></label><input id="platformShortName" value="${esc(db.settings.platform_short_name||'آلين')}" placeholder="الاسم المختصر للتطبيق"></div><div class="brand-actions"><button onclick="saveBrandIdentity()">حفظ الهوية</button><button class="ghost" onclick="resetBrandIdentity()">استعادة الافتراضي</button></div><p class="identity-note">الشعار يتغير فورًا داخل الموقع. أيقونة التطبيق المثبتة على الموبايل قد تحتاج حذف الاختصار وإضافته مرة ثانية بسبب كاش النظام.</p><div id="brandMsg"></div></div>`;
};
async function uploadBrandFile(file,kind){
  if(!file) return '';
  const allowed=['image/png','image/jpeg','image/webp','image/svg+xml'];
  if(!allowed.includes(file.type)) throw new Error('ارفع صورة PNG أو JPG أو WEBP');
  if(file.size>1024*1024*2) throw new Error('حجم الصورة كبير. الأفضل أقل من 2MB');
  return await uploadFile('brand/'+kind,file);
}
async function saveBrandIdentity(){
  try{
    const logoFile=brandLogoFile.files[0];
    const iconFile=brandIconFile.files[0];
    if(logoFile){const p=await uploadBrandFile(logoFile,'logo'); await settingsSet('platform_logo_path',p);}
    if(iconFile){const p=await uploadBrandFile(iconFile,'icon'); await settingsSet('platform_icon_path',p);}
    await settingsSet('platform_short_name',platformShortName.value.trim()||'آلين');
    await audit('brand','تحديث شعار وأيقونة المنصة');
    await load();renderSettingsAdmin();applyBrandV28();toast('تم حفظ هوية المنصة');
  }catch(e){if(window.brandMsg)brandMsg.textContent=e.message; alert(e.message)}
}
async function resetBrandIdentity(){
  if(!confirm('استعادة الشعار والأيقونة الافتراضية؟')) return;
  await settingsSet('platform_logo_path','');
  await settingsSet('platform_icon_path','');
  await settingsSet('platform_short_name','آلين');
  await audit('brand','استعادة الهوية الافتراضية');
  await load();renderSettingsAdmin();applyBrandV28();toast('تمت الاستعادة');
}

// V28.2: منع تداخل الشعار الكامل مع عنوان صفحة الدخول
(function(){
  const oldApplyBrand = window.applyBrand;
  window.applyBrand = function(){
    if(typeof oldApplyBrand === 'function') oldApplyBrand();
    try{
      const logoUrl = brandPublicUrl(db.settings.platform_logo_path||db.settings.platform_logo_url||'');
      const iconUrl = brandPublicUrl(db.settings.platform_icon_path||db.settings.platform_icon_url||'');
      document.querySelectorAll('.login-card').forEach(card=>card.classList.toggle('brand-full-logo', !!logoUrl));
      // لا نستخدم الشعار الكامل كأيقونة صغيرة إذا لم يرفع المدير أيقونة منفصلة
      document.querySelectorAll('.topbar .logo.small').forEach(x=>setLogoNode(x, iconUrl, 'آ'));
      document.title=(db?.settings?.platform_name||'منصة آلين');
    }catch(e){}
  };
})();


/* V29 Delivery + COD + Library Join Requests (built on V28.2) */
let libraryJoinRequests = [];
let couriers = [];
let courierSettlements = [];
const _loadV29 = load;
load = async function(){
  await _loadV29();
  if(sb){
    try{ libraryJoinRequests = await query('library_join_requests'); }catch(e){ libraryJoinRequests=[]; console.warn('V29 library_join_requests migration pending',e); }
    try{ couriers = await query('couriers'); }catch(e){ couriers=[]; console.warn('V29 couriers migration pending',e); }
    try{ courierSettlements = await query('courier_settlements'); }catch(e){ courierSettlements=[]; console.warn('V29 courier_settlements migration pending',e); }
  }
};
function deliveryFee(){ return +(db?.settings?.delivery_fee||0); }
function activeCouriers(){const fn=window.AlinCourierModules&&window.AlinCourierModules['activeCouriers'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] activeCouriers is not loaded yet');}














function renderCouriersAdmin(){const fn=window.AlinCourierModules&&window.AlinCourierModules['renderCouriersAdmin'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] renderCouriersAdmin is not loaded yet');}
function addCourier(){const fn=window.AlinCourierModules&&window.AlinCourierModules['addCourier'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] addCourier is not loaded yet');}
function toggleCourier(){const fn=window.AlinCourierModules&&window.AlinCourierModules['toggleCourier'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] toggleCourier is not loaded yet');}
function renderCourierSettlementsAdmin(){const fn=window.AlinCourierModules&&window.AlinCourierModules['renderCourierSettlementsAdmin'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] renderCourierSettlementsAdmin is not loaded yet');}
function assignCourier(){const fn=window.AlinCourierModules&&window.AlinCourierModules['assignCourier'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] assignCourier is not loaded yet');}
function courierOrderStatus(){const fn=window.AlinCourierModules&&window.AlinCourierModules['courierOrderStatus'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] courierOrderStatus is not loaded yet');}

/* platform step 5: removed legacy v29 order alias; authoritative code is modules/admin/orders.js */


/* platform step 5: removed legacy renderOrdersAdmin; authoritative code is modules/admin/orders.js */
const _renderSettingsV29 = renderSettingsAdmin;
renderSettingsAdmin = function(){
  _renderSettingsV29();
  adminContent.innerHTML += `<div class="settings-section"><h3>إعدادات التوصيل</h3><div class="form-grid"><input id="deliveryFeeInput" type="number" value="${deliveryFee()}" placeholder="أجور التوصيل"><button onclick="saveDeliverySettings()">حفظ أجور التوصيل</button></div><p class="muted">تم إلغاء خيار الماستر كارد. الدفع نقدًا عند الاستلام فقط.</p></div>`;
};
async function saveDeliverySettings(){ await settingsSet('delivery_fee',String(+deliveryFeeInput.value||0)); await audit('settings','تحديث أجور التوصيل'); await load(); renderSettingsAdmin(); toast('تم حفظ أجور التوصيل'); }

/* ================= ALIN V29.1 STOREFRONT ENHANCEMENT ================= */
/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */



/* ================= ALIN V29.2 CLEAN STOREFRONT FIX ================= */
/* PLATFORM STEP 10: legacy storefront override removed. */

/* ================= ALIN V31 STORE + OPERATIONS ================= */
/* PLATFORM STEP 10: legacy storefront override removed. */

/* ================= ALIN V32 CLEAN STORE HEADER + EDITABLE FOOTER SECTIONS ================= */
/* PLATFORM STEP 10: legacy storefront override removed. */

/* ================= ALIN V37 ADMIN SETTINGS RESTORE ================= */
(function(){
  function brandPublicUrlLocal(path){
    if(!path) return '';
    if(/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('./')) return path;
    try{return mediaUrl(path)}catch(e){return path}
  }
  function securitySectionHtml(){
    return `<div class="settings-section security-box"><h3>تغيير اسم الدخول والرمز السري</h3><p class="muted">من هنا تغيّر بيانات دخول لوحة المدير.</p><div class="form-grid"><input id="adminLoginName" value="${esc((db.settings&&db.settings.admin_username)||'admin')}" placeholder="اسم دخول المدير"><input id="adminCurrentPass" type="password" placeholder="الرمز الحالي"><input id="adminNewPass" type="password" placeholder="الرمز الجديد"><input id="adminNewPass2" type="password" placeholder="تأكيد الرمز الجديد"></div><button onclick="saveAdminSecurity()">حفظ بيانات المدير</button><div id="adminSecurityMsg"></div></div>`;
  }
  function brandSectionHtml(){
    const logoUrl=brandPublicUrlLocal(db.settings.platform_logo_path||db.settings.platform_logo_url||'');
    const iconUrl=brandPublicUrlLocal(db.settings.platform_icon_path||db.settings.platform_icon_url||'');
    return `<div class="settings-section brand-uploader"><h3>شعار المتجر وأيقونة التطبيق</h3><p class="muted">غيّر شعار المتجر الظاهر داخل المنصة وأيقونة التطبيق للموبايل.</p><div class="brand-logo-preview"><div><small>شعار المتجر الحالي</small><div class="preview-box preview-wide">${logoUrl?`<img class="logo-img" src="${esc(logoUrl)}">`:'آ'}</div></div><div><small>أيقونة التطبيق الحالية</small><div class="preview-box">${iconUrl?`<img class="logo-img" src="${esc(iconUrl)}">`:'آ'}</div></div></div><div class="form-grid"><label>رفع شعار المتجر<input id="brandLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><label>رفع أيقونة التطبيق<input id="brandIconFile" type="file" accept="image/png,image/jpeg,image/webp"></label><input id="platformShortName" value="${esc(db.settings.platform_short_name||'آلين')}" placeholder="الاسم المختصر للتطبيق"></div><div class="brand-actions"><button onclick="saveBrandIdentity()">حفظ الشعار والأيقونة</button><button class="ghost" onclick="resetBrandIdentity()">استعادة الافتراضي</button></div><p class="identity-note">بعد تغيير الأيقونة قد تحتاج حذف اختصار التطبيق من الهاتف وإضافته مرة ثانية.</p><div id="brandMsg"></div></div>`;
  }
  function footerSectionHtml(){
    return `<div class="settings-section footer-editor"><h3>تعديل فقرات نهاية المتجر</h3><p class="muted">تظهر أسفل صفحة المتجر فقط.</p><div class="form-grid"><input id="aboutTitleInput" value="${esc(db.settings.about_title||'عن المنصة')}" placeholder="عنوان عن المنصة"><input id="contactTitleInput" value="${esc(db.settings.contact_title||'تواصل معنا')}" placeholder="عنوان التواصل"><textarea id="aboutTextInput" placeholder="نص عن المنصة">${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</textarea><textarea id="contactTextInput" placeholder="نص تواصل معنا">${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</textarea></div><button onclick="saveFooterSections()">حفظ فقرات المتجر</button></div>`;
  }
  function deliverySectionHtml(){
    return `<div class="settings-section"><h3>إعدادات التوصيل</h3><div class="form-grid"><input id="deliveryFeeInput" type="number" value="${esc(db.settings.delivery_fee||'0')}" placeholder="أجور التوصيل"><button onclick="saveDeliverySettings()">حفظ أجور التوصيل</button></div><p class="muted">الدفع عند الاستلام: في المكتبة أو عند تسليم المندوب.</p></div>`;
  }
  window.renderSettingsAdmin=function(){
    adminContent.innerHTML=`<h2>إعدادات لوحة المدير</h2><div class="form-grid"><input id="platformName" value="${esc(db.settings.platform_name||'منصة آلين')}" placeholder="اسم المنصة"><input id="platformPhone" value="${esc(db.settings.platform_phone||'')}" placeholder="رقم الهاتف"><input id="heroTitle" value="${esc(db.settings.hero_title||'')}" placeholder="عنوان الواجهة"><input id="heroText" value="${esc(db.settings.hero_text||'')}" placeholder="نص الواجهة"><input id="lowStockDefault" type="number" value="${esc(db.settings.low_stock_default||'5')}" placeholder="حد المخزون المنخفض"><button onclick="savePlatformSettings()">حفظ الإعدادات العامة</button></div><div class="settings-preview"><b>معاينة</b><h3>${esc(db.settings.hero_title||'')}</h3><p>${esc(db.settings.hero_text||'')}</p></div>`+
    securitySectionHtml()+brandSectionHtml()+footerSectionHtml()+deliverySectionHtml();
  };
  /* booklet admin implementation moved to modules/admin/booklets.js */
})();

/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */

/* PLATFORM STEP 10: legacy storefront override removed. */

/* PLATFORM STEP 10: legacy storefront override removed. */







window.showLibInfo=selectedLibraryLine;



/* ================= ALIN V42 CART DELIVERY + SETTLEMENT ROUTING ================= */
window.ALIN_VERSION='Alin Clean Cart Routing';
function orderExtraV42(){
  const forcedDelivery=cartHasNonBooklets();
  const f=forcedDelivery?'home_delivery':(document.querySelector('input[name="fulfillment"]:checked')?.value||'pickup');
  if(f==='pickup'){
    if(!libSelect?.value) throw Error('اختر مكتبة الاستلام');
    return {fulfillment_type:'pickup',library_id:libSelect.value,courier_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
  }
  if(!deliveryArea.value.trim()||!deliveryLandmark.value.trim()) throw Error('اختر المنطقة واكتب أقرب نقطة دالة');
  return {fulfillment_type:'home_delivery',library_id:null,courier_id:courierSelect?.value||null,delivery_area:deliveryArea.value.trim(),delivery_address:null,delivery_landmark:deliveryLandmark.value.trim(),delivery_fee:deliveryFee(),payment_method:'cash_to_courier',payment_status:'cod_pending'};
}
/* PLATFORM STEP 10: legacy storefront override removed. */
/* platform step 5: removed legacy orderStatus; authoritative code is modules/admin/orders.js */
/* platform step 5: removed legacy renderOrdersAdmin; authoritative code is modules/admin/orders.js */


/* ================= ALIN V43 ADMIN BOOKLETS NO SECTION + STORE SEARCH ================= */
window.ALIN_VERSION='Alin V43 Store Search No Booklet Section';
function alinStoreSearchText(){ return String(document.getElementById('searchInput')?.value||'').trim().toLowerCase(); }


/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */

/* ================= ALIN V44 CLEAN BOOKLETS + STUDENT TRACK CODE ================= */
window.ALIN_VERSION='Alin V44 Tracking Code Fix';
function alinOrderNumber(){
  return 'ALIN-'+new Date().toISOString().slice(2,10).replaceAll('-','')+'-'+Math.floor(1000+Math.random()*9000);
}
function alinTrackingResultHtml(numbers, msg){
  const list=(numbers||[]).map(n=>`<div class="track-code-card"><span>كود التتبع</span><b>${esc(n)}</b><button class="secondary" onclick="copyText('${esc(n)}')">نسخ</button></div>`).join('');
  return `<h2>تم استلام طلبك</h2><p>${esc(msg||'احتفظ بكود التتبع حتى تتابع حالة الطلب من واجهة المتجر.')}</p>${list}<div class="student-track-note">اكتب كود التتبع في مربع <b>تتبع حالة الطلب</b> الموجود بصفحة المتجر.</div><button onclick="closeCheckout()">إغلاق</button>`;
}
window.copyText=function(t){ try{ navigator.clipboard.writeText(t); toast('تم نسخ كود التتبع'); }catch(e){ alert(t); } };

// إبقاء صفحة الملازم نظيفة بدون نظام الأقسام القديم
/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */


// كل طلب من السلة يظهر للطالب كود تتبع واضح بعد تأكيد الشراء

// احتياطاً: إذا انفتح شراء مباشر بأي مكان، يحوله للسلة حتى لا تضيع أكواد التتبع


/* ================= ALIN V45 OPTIONAL STUDENT ACCOUNT ================= */
window.ALIN_VERSION='Alin V46 Store Search Fixed';
const ALIN_STUDENTS_KEY='ALIN_STUDENT_ACCOUNTS_V1';
const ALIN_STUDENT_SESSION_KEY='ALIN_STUDENT_SESSION_V1';
function studentAccounts(){try{return JSON.parse(localStorage.getItem(ALIN_STUDENTS_KEY)||'[]')}catch(e){return []}}
function saveStudentAccounts(rows){localStorage.setItem(ALIN_STUDENTS_KEY,JSON.stringify(rows||[]))}
function currentStudent(){try{return JSON.parse(localStorage.getItem(ALIN_STUDENT_SESSION_KEY)||'null')}catch(e){return null}}
function setCurrentStudent(s){ if(s) localStorage.setItem(ALIN_STUDENT_SESSION_KEY,JSON.stringify(s)); else localStorage.removeItem(ALIN_STUDENT_SESSION_KEY); updateStudentAuthBar(); }
function updateStudentAuthBar(){
  const s=currentStudent();
  const btn=document.getElementById('studentAuthBtn');
  const st=document.getElementById('studentAuthStatus');
  if(btn) btn.textContent=s?'👤 حسابي':'👤 تسجيل دخول';
  if(st) st.textContent=s?`مرحباً ${s.name} — التسجيل اختياري`:'التسجيل اختياري والطلب متاح للجميع';
}
window.openStudentAuth=function(mode='login'){
  const box=document.getElementById('studentAuthBox'); if(!box)return;
  const s=currentStudent();
  if(s){
    box.innerHTML=`<h2>حساب الطالب</h2><div class="student-profile-box"><b>${esc(s.name)}</b><br><small>${esc(s.phone||'')}</small></div><div class="row-actions"><button onclick="showStudentOrders()">طلباتي</button><button class="secondary" onclick="showStudentAuthForm('edit')">تعديل البيانات</button><button class="danger" onclick="studentLogout()">تسجيل خروج</button></div><div id="studentOrdersBox"></div>`;
  }else{
    box.innerHTML=studentAuthForm(mode);
  }
  document.getElementById('studentAuthModal')?.classList.remove('hidden');
};
window.closeStudentAuth=function(){document.getElementById('studentAuthModal')?.classList.add('hidden')}
function studentAuthForm(mode){
  const isCreate=mode==='create', isEdit=mode==='edit', s=currentStudent()||{};
  return `<h2>${isEdit?'تعديل حساب الطالب':isCreate?'إنشاء حساب طالب':'تسجيل دخول الطالب'}</h2><p class="muted">الحساب اختياري، تقدر تطلب بدون تسجيل دخول.</p>${!isEdit?`<div class="auth-switch"><button class="${!isCreate?'active':''}" onclick="showStudentAuthForm('login')">تسجيل دخول</button><button class="${isCreate?'active':''}" onclick="showStudentAuthForm('create')">إنشاء حساب</button></div>`:''}<div class="form-grid">${isCreate||isEdit?`<input id="studentAuthName" placeholder="اسم الطالب" value="${esc(s.name||'')}">`:''}<input id="studentAuthPhone" placeholder="رقم الهاتف" value="${esc(s.phone||'')}"><input id="studentAuthPass" type="password" placeholder="الرمز السري"></div>${isCreate||isEdit?`<input id="studentAuthAddress" placeholder="العنوان اختياري" value="${esc(s.address||'')}">`:''}<button onclick="${isEdit?'saveStudentEdit()':isCreate?'studentCreate()':'studentLogin()'}">${isEdit?'حفظ التعديل':isCreate?'إنشاء الحساب':'دخول'}</button><div id="studentAuthMsg"></div>`;
}
window.showStudentAuthForm=function(mode){const box=document.getElementById('studentAuthBox'); if(box) box.innerHTML=studentAuthForm(mode)}
window.studentCreate=function(){try{
  const name=(studentAuthName.value||'').trim(), phone=(studentAuthPhone.value||'').trim(), pass=(studentAuthPass.value||'').trim(), address=(studentAuthAddress.value||'').trim();
  if(!name||!phone||!pass) throw Error('أكمل الاسم ورقم الهاتف والرمز السري');
  const rows=studentAccounts(); if(rows.some(x=>x.phone===phone)) throw Error('هذا الرقم مسجل مسبقاً');
  const row={id:uid('S'),name,phone,password:pass,address,created_at:new Date().toISOString()}; rows.push(row); saveStudentAccounts(rows); setCurrentStudent({id:row.id,name,phone,address}); toast('تم إنشاء الحساب'); openStudentAuth();
}catch(e){studentAuthMsg.textContent=e.message}}
window.studentLogin=function(){try{
  const phone=(studentAuthPhone.value||'').trim(), pass=(studentAuthPass.value||'').trim();
  const row=studentAccounts().find(x=>x.phone===phone&&x.password===pass); if(!row) throw Error('رقم الهاتف أو الرمز غير صحيح');
  setCurrentStudent({id:row.id,name:row.name,phone:row.phone,address:row.address||''}); closeStudentAuth(); toast('تم تسجيل الدخول');
}catch(e){studentAuthMsg.textContent=e.message}}
window.saveStudentEdit=function(){try{
  const s=currentStudent(); if(!s)throw Error('سجل دخول أولاً');
  const rows=studentAccounts(); const i=rows.findIndex(x=>x.id===s.id); if(i<0)throw Error('الحساب غير موجود');
  const name=(studentAuthName.value||'').trim(), phone=(studentAuthPhone.value||'').trim(), pass=(studentAuthPass.value||'').trim(), address=(studentAuthAddress.value||'').trim();
  if(!name||!phone)throw Error('أكمل الاسم ورقم الهاتف');
  if(rows.some((x,idx)=>idx!==i&&x.phone===phone))throw Error('هذا الرقم مستخدم بحساب آخر');
  rows[i]={...rows[i],name,phone,address}; if(pass)rows[i].password=pass; saveStudentAccounts(rows); setCurrentStudent({id:s.id,name,phone,address}); toast('تم حفظ التعديل'); openStudentAuth();
}catch(e){studentAuthMsg.textContent=e.message}}
window.studentLogout=function(){setCurrentStudent(null); closeStudentAuth(); toast('تم تسجيل الخروج')}
window.showStudentOrders=function(){
  const s=currentStudent(), box=document.getElementById('studentOrdersBox'); if(!s||!box)return;
  const rows=(db.orders||[]).filter(o=>(o.student_phone||'')===s.phone).slice(0,20);
  box.innerHTML='<h3>طلباتي</h3>'+(rows.length?rows.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.tracking_code||o.id)}</b><small>${esc(o.title||'')} — ${money(o.total)} د.ع — ${esc(o.status||'')}</small></div><button onclick="closeStudentAuth(); trackOrderInput.value='${esc(o.order_number||o.tracking_code||o.id)}'; trackOrder()">تتبع</button></div>`).join(''):emptyState('لا توجد طلبات بهذا الرقم'));
};

// تحديث شريط حساب الطالب بعد كل عرض متجر
/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */

// تعبئة بيانات الطالب وربط الطلب بالحساب من خلال أحداث السلة المركزية.
document.addEventListener('alin:cart-rendered',()=>{
  const s=typeof currentStudent==='function'?currentStudent():null;if(!s)return;
  const n=document.getElementById('studentName'),p=document.getElementById('studentPhone');
  if(n&&!n.value)n.value=s.name||'';if(p&&!p.value)p.value=s.phone||'';
});
document.addEventListener('alin:order-created',()=>{
  const s=typeof currentStudent==='function'?currentStudent():null;
  if(s&&typeof audit==='function')Promise.resolve(audit('student_order','طلب من حساب طالب '+s.phone)).catch(()=>{});
});

document.addEventListener('DOMContentLoaded', updateStudentAuthBar);



/* ================= ALIN V47 FULL CHECK + FINAL OVERRIDES ================= */
window.ALIN_VERSION='Alin V47 Full Check Fix';

function alinSafe(id){ return document.getElementById(id); }
function alinOpenLibraries(){ return (db.accounts?.libraries||[]).filter(x=>x.status==='active'); }
function alinLibOpen(x){ try{return typeof libIsOpen==='function' ? libIsOpen(x) : x?.is_open!==false;}catch(e){return x?.is_open!==false;} }


window.libraryOptionsClean=alinLibraryOptions;

/* PLATFORM STEP 10: legacy storefront override removed. */

/* PLATFORM STEP 10: legacy storefront override removed. */

/* PLATFORM STEP 10: legacy storefront override removed. */



function alinCouriersOptions(){const fn=window.AlinCourierModules&&window.AlinCourierModules['alinCouriersOptions'];if(typeof fn==='function')return fn.apply(this,arguments);console.warn('[Alin modular] alinCouriersOptions is not loaded yet');}


window.addEventListener('error', function(e){ console.warn('ALIN caught error:', e.message); });
document.addEventListener('DOMContentLoaded', function(){
  try{ if('serviceWorker' in navigator){ navigator.serviceWorker.getRegistrations?.().then(rs=>rs.forEach(r=>r.update())); } }catch(e){}
});

/* ===== ALIN V50: stable PDF resolver/viewer ===== */
async function alinResolveStoredFile(value, preferredFolder='booklets'){
  if(!value) return null;
  const raw=String(value).trim();
  const candidates=[];
  const add=p=>{ p=String(p||'').replace(/^\/+/,'').replace(/^alin-files\//,''); if(p && !candidates.includes(p)) candidates.push(p); };

  if(!/^https?:\/\//i.test(raw)) add(raw);

  try{
    if(/^https?:\/\//i.test(raw)){
      const u=new URL(raw);
      const decoded=decodeURIComponent(u.pathname);
      const marks=['/storage/v1/object/public/','/storage/v1/object/sign/','/storage/v1/object/authenticated/'];
      for(const mark of marks){
        if(decoded.includes(mark)){
          const tail=decoded.split(mark)[1]||'';
          const parts=tail.split('/').filter(Boolean);
          const oldBucket=parts.shift()||'';
          const rest=parts.join('/');
          if(oldBucket==='alin-files') add(rest);
          else {
            add(`${oldBucket}/${rest}`);
            add(`${preferredFolder}/${parts.at(-1)||''}`);
          }
        }
      }
      const filename=decoded.split('/').filter(Boolean).at(-1);
      if(filename) add(`${preferredFolder}/${filename}`);
    }
  }catch(e){}

  const fileName=raw.split('?')[0].split('#')[0].split('/').filter(Boolean).at(-1);
  if(fileName) add(`${preferredFolder}/${fileName}`);

  for(const path of candidates){
    try{
      const {data}=sb.storage.from('alin-files').getPublicUrl(path);
      const url=data?.publicUrl;
      if(!url) continue;
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok) continue;
      const ct=(r.headers.get('content-type')||'').toLowerCase();
      if(ct.includes('application/json')) continue;
      const blob=await r.blob();
      if(!blob.size) continue;
      return {path,url,blob,contentType:blob.type||ct};
    }catch(e){}
  }
  return null;
}




/* ===== end ALIN V50 ===== */

/* ===== ALIN V55: automatic profit and settlement distribution ===== */
/* ===== end ALIN V55 ===== */

/* ===== ALIN V57});

/* ===== ALIN V57: library print-only PDF + clean finance + preview publish ===== */
function alinV57BookletVisible(b){
  return String(b?.status||'') === 'published' || String(b?.publish_status||'') === 'published' || b?.published === true || b?.is_published === true;
}
function alinV57BookletApproved(b){ return b?.teacher_approved === true || String(b?.publish_status||'') === 'approved' || String(b?.status||'') === 'approved'; }
/* platform step 5: removed legacy v57 order alias; authoritative code is modules/admin/orders.js */


/* platform step 5: removed legacy orderStatus; authoritative code is modules/admin/orders.js */




window.printReceipt = function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId), lib=(db.accounts?.libraries||[]).find(x=>x.id===o?.library_id);
  if(!o)return;
  const s=alinV57Shares(o), b=alinV57OrderBooklet(o), teacher=(db.accounts?.teachers||[]).find(x=>x.id===b?.teacher_id);
  checkoutBox.innerHTML=`<div class="receipt"><h2>وصل وتسوية منصة آلين</h2>
  <div class="receipt-line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div>
  <div class="receipt-line"><b>الطالب</b><span>${esc(o.student_name||'')}</span></div>
  <div class="receipt-line"><b>الملزمة/المادة</b><span>${esc(o.title||'')}</span></div>
  <div class="receipt-line"><b>العدد</b><span>${o.qty||1}</span></div>
  <div class="receipt-line"><b>المبلغ المستلم</b><span>${money(s.total)} د.ع</span></div>
  <hr>
  <div class="receipt-line"><b>ربح المدير</b><span>${money(s.admin)} د.ع</span></div>
  <div class="receipt-line"><b>ربح المدرس ${teacher?esc(teacher.name):''}</b><span>${money(s.teacher)} د.ع</span></div>
  ${s.delivery==='library'?`<div class="receipt-line"><b>تسوية المكتبة ${lib?esc(lib.name):''}</b><span>${money(s.library)} د.ع</span></div>`:`<div class="receipt-line"><b>تسوية المندوب</b><span>${money(s.delegate)} د.ع</span></div>`}
  <p>حالة التسوية: ${o.settlement_done?'مثبتة':'تظهر بعد ضغط تسليم'}</p></div>
  <div class="row-actions no-print"><button onclick="window.print()">طباعة الوصل</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
};

/* PLATFORM STEP 10: legacy storefront override removed. */

/* ===== end ALIN V57 ===== */

/* ================= ALIN V59 FIX: library print-only, clean settlement, teacher approval publish ================= */
/* platform step 5: removed legacy orderStatus; authoritative code is modules/admin/orders.js */






window.printReceipt = window.printOrderReceipt = function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  const b=alinV59OrderBooklet(o), t=(db.accounts?.teachers||[]).find(x=>x.id===b?.teacher_id), lib=(db.accounts?.libraries||[]).find(x=>x.id===o.library_id);
  const s=alinV59Shares(o);
  checkoutBox.innerHTML=`<div class="receipt"><h2>وصل وتسوية منصة آلين</h2><div class="receipt-line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div><div class="receipt-line"><b>الطالب</b><span>${esc(o.student_name||'')}</span></div><div class="receipt-line"><b>المادة</b><span>${esc(o.title||'')}</span></div><div class="receipt-line"><b>العدد</b><span>${esc(o.qty||1)}</span></div><div class="receipt-line"><b>المبلغ المستلم</b><span>${money(s.total)} د.ع</span></div><hr><div class="receipt-line"><b>ربح المدير</b><span>${money(s.admin)} د.ع</span></div><div class="receipt-line"><b>ربح المدرس ${t?esc(t.name):''}</b><span>${money(s.teacher)} د.ع</span></div>${s.delivery==='library'?`<div class="receipt-line"><b>حصة المكتبة ${lib?esc(lib.name):''}</b><span>${money(s.library)} د.ع</span></div>`:`<div class="receipt-line"><b>حصة المندوب</b><span>${money(s.delegate)} د.ع</span></div>`}<p>تثبت الحسابات عند ضغط تسليم. زر إلغاء التسليم لا يحتسب مبلغ.</p></div><div class="row-actions no-print"><button onclick="window.print()">طباعة الوصل</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
};













/* v2.2.3: legacy load wrapper removed; base load fetches teacher and finance tables. */



/* ================= ALIN V60 LIBRARY RECEIPT / SETTLEMENT CLEANUP ================= */
window.printReceipt = window.printOrderReceipt = function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===o.library_id);
  checkoutBox.innerHTML=`<div class="receipt">
    <h2>وصل طلب منصة آلين</h2>
    <div class="receipt-line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div>
    <div class="receipt-line"><b>الطالب</b><span>${esc(o.student_name||'')}</span></div>
    <div class="receipt-line"><b>الهاتف</b><span>${esc(o.student_phone||'')}</span></div>
    <div class="receipt-line"><b>المادة</b><span>${esc(o.title||'')}</span></div>
    <div class="receipt-line"><b>العدد</b><span>${esc(o.qty||1)}</span></div>
    <div class="receipt-line"><b>المبلغ الكلي</b><span>${money(+o.total||0)} د.ع</span></div>
    <div class="receipt-line"><b>المكتبة</b><span>${esc(lib?.name||'')}</span></div>
    <p>شكراً لاستخدام منصة آلين</p>
  </div><div class="row-actions no-print"><button onclick="window.print()">طباعة الوصل</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
};

window.printPdfFrame = function(){
  const frame=document.getElementById('pdfFrame');
  if(!frame) return;
  try{
    frame.focus();
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }catch(e){
    toast('تعذر بدء الطباعة من العارض. افتح أمر الطباعة من المتصفح.');
  }
};







/* ================= ALIN V61 PDF PRINT FIX ================= */
let alinV61PdfBlobUrl = '';
async function alinV61PreparePrintablePdf(frame, sourceUrl){
  try{
    if(alinV61PdfBlobUrl){ URL.revokeObjectURL(alinV61PdfBlobUrl); alinV61PdfBlobUrl=''; }
    const clean=String(sourceUrl||'').split('#')[0];
    const res=await fetch(clean,{cache:'no-store'});
    if(!res.ok) throw new Error('PDF '+res.status);
    const blob=await res.blob();
    alinV61PdfBlobUrl=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));
    frame.src=alinV61PdfBlobUrl+'#toolbar=0&navpanes=0&scrollbar=1';
    frame.dataset.printReady='1';
    return true;
  }catch(e){
    console.warn('printable pdf',e);
    frame.dataset.printReady='0';
    return false;
  }
}
window.printPdfFrame = async function(){
  const frame=document.getElementById('pdfFrame');
  if(!frame) return toast('عارض PDF غير موجود');
  if(frame.dataset.printReady!=='1'){
    const ok=await alinV61PreparePrintablePdf(frame, frame.dataset.source||frame.src);
    if(!ok) return toast('تعذر تجهيز ملف PDF للطباعة');
    await new Promise(r=>setTimeout(r,900));
  }
  try{
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }catch(e){
    console.warn('pdf print',e);
    const w=window.open(alinV61PdfBlobUrl,'_blank');
    if(!w) return toast('اسمح بالنوافذ المنبثقة للطباعة');
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){} },1200);
  }
};








/* ================= ALIN V63 ACTIVE LIBRARY SETTLEMENT ================= */




/* ================= ALIN V64 ADMIN-ONLY LIBRARY SETTLEMENT ================= */
/* ================= ALIN V65 FINANCIAL BALANCES / PAYOUTS ================= */
/* ================= ALIN V66 PERSISTENT SETTLEMENT SAVE FIX ================= */
try{ if(typeof toast==='function') console.log('ALIN V66 settlement persistence fix loaded'); }catch(e){}

/* ================= ALIN V67 CURRENT BALANCE DISPLAY FIX ================= */




/* ================= ALIN V68 BALANCE SYNC ALL DASHBOARDS ================= */
/* Update teacher dashboard "المتبقي" so it shows current balance after payouts */





/* Update library page profit box and remove stale duplicate boxes */





/* Make finance admin cards depend on current balance everywhere */
/* ================= ALIN V69 BEAUTIFUL PRINT RECEIPTS ================= */
function alinV69PrintTemplate(title, bodyHtml, footerNote=''){
  const date=new Date().toLocaleString('ar-IQ');
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <title>${esc(title)} - منصة آلين</title>
  <style>
    @page{size:A5;margin:10mm}
    *{box-sizing:border-box}
    body{font-family:Arial,Tahoma,sans-serif;background:#f6f8fb;color:#0b1b36;margin:0;padding:18px;direction:rtl}
    .receipt-wrap{max-width:560px;margin:auto;background:#fff;border:1px solid #dfe7f3;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,35,70,.10)}
    .head{padding:20px 22px;background:linear-gradient(135deg,#0b1b36,#17345f);color:#fff;text-align:center}
    .brand{font-size:28px;font-weight:900;letter-spacing:.5px;margin:0}
    .sub{font-size:13px;opacity:.9;margin-top:5px}
    .title{font-size:20px;font-weight:800;margin:14px 0 0;color:#ffd27a}
    .body{padding:20px 22px}
    .line{display:flex;justify-content:space-between;gap:16px;border-bottom:1px dashed #d7dfec;padding:10px 0;font-size:15px}
    .line b{color:#0b1b36}
    .line span{font-weight:700;color:#1b2b45;text-align:left}
    .total{margin-top:14px;padding:14px;border-radius:14px;background:#f2f6ff;border:1px solid #dce8ff;font-size:18px}
    .total span{font-size:24px;color:#a56f00;font-weight:900}
    .note{margin-top:16px;text-align:center;color:#5d6b82;font-size:13px}
    .signs{display:flex;justify-content:space-between;margin-top:30px;gap:18px}
    .sign{flex:1;text-align:center;border-top:1px solid #8b98aa;padding-top:8px;color:#334}
    .foot{padding:12px 22px;background:#f7f9fc;border-top:1px solid #e5ebf4;text-align:center;color:#6a7688;font-size:12px}
    @media print{
      body{background:#fff;padding:0}
      .receipt-wrap{box-shadow:none;border-radius:0;border:0}
      .no-print{display:none!important}
    }
  </style></head><body>
    <div class="receipt-wrap">
      <div class="head"><h1 class="brand">منصة آلين</h1><div class="sub">للملازم والقرطاسية</div><div class="title">${esc(title)}</div></div>
      <div class="body">${bodyHtml}<div class="note">${esc(footerNote||'شكراً لاستخدام منصة آلين')}</div><div class="signs"><div class="sign">توقيع الإدارة</div><div class="sign">توقيع المستلم</div></div></div>
      <div class="foot">تاريخ الطباعة: ${date}</div>
    </div>
  </body></html>`;
}
function alinV69OpenPrint(title, body, note){
  const w=window.open('','_blank');
  w.document.write(alinV69PrintTemplate(title,body,note));
  w.document.close();
  setTimeout(()=>{try{w.focus();w.print();}catch(e){}},350);
}
window.printReceipt = window.printOrderReceipt = function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===o.library_id);
  const html=`<div class="line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div>
    <div class="line"><b>اسم الطالب</b><span>${esc(o.student_name||'')}</span></div>
    <div class="line"><b>الهاتف</b><span>${esc(o.student_phone||'')}</span></div>
    <div class="line"><b>المادة</b><span>${esc(o.title||'')}</span></div>
    <div class="line"><b>عدد النسخ</b><span>${esc(o.qty||1)}</span></div>
    <div class="line"><b>المكتبة</b><span>${esc(lib?.name||'')}</span></div>
    <div class="total"><b>المبلغ الكلي</b><br><span>${money(+o.total||0)} د.ع</span></div>`;
  alinV69OpenPrint('وصل طلب', html, 'هذا الوصل لا يحتوي على تفاصيل أرباح داخلية');
};
/* ================= ALIN V70 TEACHER PROFIT TITLES FIX ================= */
/* ================= ALIN V71 COMPLETE ADMIN TOOLS ================= */
const ALIN_V71_VERSION='V71 Complete Admin Tools';

function alinV71Now(){ return new Date().toISOString(); }
function alinV71UserLabel(){
  return (current?.name||current?.username||current?.role||'مستخدم');
}
async function alinV71Audit(action, details, meta={}){
  const row={id:uid('AU'),action,details,user_id:current?.id||'',user_role:current?.role||'',user_name:alinV71UserLabel(),meta,created_at:alinV71Now()};
  try{ await insert('audit_logs',row); }catch(e){
    try{
      const rows=JSON.parse(localStorage.getItem('alin_v71_audit_logs')||'[]');
      rows.unshift(row); localStorage.setItem('alin_v71_audit_logs',JSON.stringify(rows.slice(0,1000)));
    }catch(_){}
  }
  try{ if(db.auditLogs) db.auditLogs.unshift(row); else db.auditLogs=[row]; }catch(_){}
}
function alinV71AuditRows(){
  let rows=[];
  try{ rows=rows.concat(db.auditLogs||[]); }catch(e){}
  try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v71_audit_logs')||'[]')); }catch(e){}
  const seen=new Set();
  return rows.filter(x=>{const k=x.id||String(x.created_at)+x.details;if(seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
}

async function alinV71Notify(role, userId, title, message){
  const row={id:uid('NT'),target_role:role||'all',target_id:userId||'',title,message,status:'active',read_at:'',created_at:alinV71Now(),from_user:alinV71UserLabel()};
  try{ await insert('notifications',row); }catch(e){
    try{
      const rows=JSON.parse(localStorage.getItem('alin_v71_notifications')||'[]');
      rows.unshift(row); localStorage.setItem('alin_v71_notifications',JSON.stringify(rows.slice(0,1000)));
    }catch(_){}
  }
  try{ if(db.notifications) db.notifications.unshift(row); else db.notifications=[row]; }catch(_){}
}
function alinV71NotificationRows(){
  let rows=[];
  try{ rows=rows.concat(db.notifications||[]); }catch(e){}
  try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v71_notifications')||'[]')); }catch(e){}
  const seen=new Set();
  return rows.filter(x=>{const k=x.id||String(x.created_at)+x.title;if(seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
}
function alinV71VisibleNotifications(){
  const role=current?.role||'';
  const id=current?.id||'';
  return alinV71NotificationRows().filter(n=>{
    if(n.status==='deleted') return false;
    if(n.target_role==='all') return true;
    if(n.target_role===role && (!n.target_id || n.target_id===id)) return true;
    return false;
  });
}
async function alinV71MarkRead(id){
  const row=alinV71NotificationRows().find(x=>x.id===id); if(!row)return;
  row.read_at=alinV71Now();
  try{ await update('notifications',{read_at:row.read_at},{id}); }catch(e){
    try{
      const rows=JSON.parse(localStorage.getItem('alin_v71_notifications')||'[]');
      const r=rows.find(x=>x.id===id); if(r)r.read_at=row.read_at;
      localStorage.setItem('alin_v71_notifications',JSON.stringify(rows));
    }catch(_){}
  }
  renderAll();
}
window.alinV71MarkRead=alinV71MarkRead;

function alinV71Money(n){ try{return money(+n||0)}catch(e){return (+n||0).toLocaleString('ar-IQ')} }
function alinV71DateOnly(v){ return (v||'').slice(0,10); }
function alinV71CsvCell(v){
  v=String(v??'').replaceAll('"','""');
  return `"${v}"`;
}
function alinV71Download(filename, content, type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},500);
}
function alinV71Backup(){
  const data={version:ALIN_V71_VERSION,created_at:alinV71Now(),db};
  alinV71Download('alin-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
  alinV71Audit('backup','تنزيل نسخة احتياطية');
}
window.alinV71Backup=alinV71Backup;


/* platform step 5: removed legacy alinV71OrderStatusLabel; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy alinV71StatusClass; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy alinV71SetOrderStatus; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy v71 order export; authoritative code is modules/admin/orders.js */


/* platform step 5: removed legacy alinV71OrderSearchHtml; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy alinV71OrderMatches; authoritative code is modules/admin/orders.js */

/* platform step 5: removed legacy alinV71StatusControls; authoritative code is modules/admin/orders.js */

/* wrap settlement and payout functions with audit/notification */
/* Admin finance enhancement: filters, export, audit, notifications */
/* Admin settings: fixed version */
const alinV71RenderSettingsBase=window.renderSettingsAdmin;
window.renderSettingsAdmin=renderSettingsAdmin=function(){
  try{ alinV71RenderSettingsBase(); }catch(e){ adminContent.innerHTML='<h2>الإعدادات</h2>'; }
  adminContent.innerHTML += `<h3>معلومات الإصدار</h3>
  <div class="notice"><b>الإصدار المرفوع حالياً</b><div>${ALIN_V71_VERSION}</div><small>تم إصلاح كاش الملفات وربط أدوات الإدارة بهذا الإصدار.</small></div>`;
};

/* PLATFORM STEP 9: legacy dashboard injection removed; dashboard and notifications have dedicated modules. */

/* Render visible notifications for teacher/library/admin pages */
function alinV71InjectNotifications(target){
  if(!target) return;
  const rows=alinV71VisibleNotifications().filter(x=>!x.read_at).slice(0,5);
  const old=document.getElementById('alinV71NotifBox'); if(old) old.remove();
  if(!rows.length) return;
  const box=document.createElement('div');
  box.id='alinV71NotifBox';
  box.className='notice';
  box.innerHTML=`<b>الإشعارات</b>${rows.map(n=>`<div style="border-top:1px solid #dbe4f0;margin-top:8px;padding-top:8px"><b>${esc(n.title||'')}</b><br><small>${esc(n.message||'')}</small><br><button class="secondary" onclick="alinV71MarkRead('${n.id}')">تمت القراءة</button></div>`).join('')}`;
  target.prepend(box);
}






/* platform step 5: removed legacy alinV71 render wrapper + renderOrdersAdmin; authoritative code is modules/admin/orders.js */


/* CSS */
const alinV71Style=document.createElement('style');
alinV71Style.textContent=`
.status-badge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;font-weight:800;font-size:12px;background:#edf2f7;color:#10203a;margin:2px}
.status-new{background:#eef6ff;color:#0b4d91}
.status-printing{background:#fff7df;color:#9a6400}
.status-ready{background:#e9fff1;color:#087a35}
.status-completed,.status-delivered{background:#e7f7ee;color:#08703b}
.status-cancelled{background:#ffecec;color:#b01919}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
`;
document.head.appendChild(alinV71Style);

/* Load extra tables */
const alinV71LoadBase=window.load||load;
load=window.load=async function(){
  await alinV71LoadBase();
  try{ db.auditLogs=await query('audit_logs'); }catch(e){ db.auditLogs=alinV71AuditRows(); }
  try{ db.notifications=await query('notifications'); }catch(e){ db.notifications=alinV71NotificationRows(); }
};


/* PLATFORM STEP 10: V72-V77 legacy storefront removed; modules/store/discovery.js is authoritative. */
/* ================= ALIN V78 NOTIFICATION CENTER UI ================= */
function alinV78NotificationRows(){
  let rows=[];
  try{ rows=rows.concat(db.notifications||[]); }catch(e){}
  try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v71_notifications')||'[]')); }catch(e){}
  const seen=new Set();
  return rows.filter(x=>{
    const k=x.id||String(x.created_at)+String(x.title);
    if(!k||seen.has(k))return false;
    seen.add(k);
    return x.status!=='deleted';
  }).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
}
function alinV78VisibleNotifications(){
  const role=current?.role||'student';
  const id=current?.id||'';
  return alinV78NotificationRows().filter(n=>{
    if(n.target_role==='all')return true;
    if(role==='student' || role==='customer'){
      return n.target_role==='student'||n.target_role==='customer'||n.target_role==='store';
    }
    if(n.target_role===role && (!n.target_id || n.target_id===id))return true;
    return false;
  });
}
function alinV78UnreadCount(){
  return alinV78VisibleNotifications().filter(x=>!x.read_at).length;
}
async function alinV78Read(id){
  const n=alinV78NotificationRows().find(x=>x.id===id); if(!n)return;
  const now=new Date().toISOString();
  try{await update('notifications',{read_at:now},{id});}catch(e){}
  try{
    const local=JSON.parse(localStorage.getItem('alin_v71_notifications')||'[]');
    const r=local.find(x=>x.id===id); if(r)r.read_at=now;
    localStorage.setItem('alin_v71_notifications',JSON.stringify(local));
  }catch(e){}
  n.read_at=now;
  alinV78RenderBadge();
  const panel=document.getElementById('alinV78Panel');
  if(panel) alinV78Open();
}
async function alinV78ReadAll(){
  for(const n of alinV78VisibleNotifications().filter(x=>!x.read_at)){
    try{await update('notifications',{read_at:new Date().toISOString()},{id:n.id});}catch(e){}
  }
  try{
    const local=JSON.parse(localStorage.getItem('alin_v71_notifications')||'[]');
    local.forEach(x=>{
      if(alinV78VisibleNotifications().some(v=>v.id===x.id)) x.read_at=new Date().toISOString();
    });
    localStorage.setItem('alin_v71_notifications',JSON.stringify(local));
  }catch(e){}
  alinV78RenderBadge();
  const panel=document.getElementById('alinV78Panel');
  if(panel) panel.remove();
}
function alinV78Open(){
  const old=document.getElementById('alinV78Panel');
  if(old){old.remove();return;}
  const rows=alinV78VisibleNotifications();
  const panel=document.createElement('div');
  panel.id='alinV78Panel';
  panel.className='alin-v78-panel';
  panel.innerHTML=`<div class="alin-v78-panel-head"><div><b>الإشعارات</b><small>${rows.length} إشعار</small></div><div><button onclick="alinV78ReadAll()">قراءة الكل</button><button onclick="document.getElementById('alinV78Panel')?.remove()">×</button></div></div>
  <div class="alin-v78-list">
    ${rows.map(n=>`<button class="alin-v78-item ${n.read_at?'read':'unread'}" onclick="alinV78Read('${n.id}')">
      <span class="alin-v78-icon">${n.read_at?'✓':'🔔'}</span>
      <div class="alin-v78-item-body"><div class="alin-v78-item-title"><b>${esc(n.title||'إشعار')}</b>${!n.read_at?'<span>جديد</span>':''}</div><p>${esc(n.message||n.text||'')}</p><small>${new Date(n.created_at||Date.now()).toLocaleString('ar-IQ')}</small></div>
    </button>`).join('')||'<div class="alin-v78-empty"><span>🔕</span><b>لا توجد إشعارات حالياً</b><small>ستظهر الإشعارات الجديدة هنا</small></div>'}
  </div>`;
  document.body.appendChild(panel);
}
function alinV78ButtonHtml(extraClass=''){
  const c=alinV78UnreadCount();
  return `<button class="alin-v78-notify-btn ${extraClass}" onclick="alinV78Open()" title="الإشعارات">
    <span class="alin-v78-bell">🔔</span>${c?`<span class="alin-v78-count">${c>99?'99+':c}</span>`:''}
  </button>`;
}
function alinV78RenderBadge(){
  document.querySelectorAll('.alin-v78-notify-btn').forEach(btn=>{
    const c=alinV78UnreadCount();
    let badge=btn.querySelector('.alin-v78-count');
    if(c){
      if(!badge){badge=document.createElement('span');badge.className='alin-v78-count';btn.appendChild(badge);}
      badge.textContent=c>99?'99+':c;
    }else if(badge) badge.remove();
  });
}
window.alinV78Open=alinV78Open;
window.alinV78Read=alinV78Read;
window.alinV78ReadAll=alinV78ReadAll;

/* Store notification button */
/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */

/* Teacher notification button */





/* Library notification button */





/* Generic injection for student/store page after all renders */
function alinV78EnsureButtons(){
  const role=current?.role||'student';
  if((role==='student'||role==='customer'||!current?.role)){
    const host=document.querySelector('.alin-v72-top')||document.getElementById('storePage')||document.querySelector('.store-page');
    if(host && !host.querySelector('.alin-v78-store-notify')){
      const wrap=document.createElement('div');
      wrap.className='alin-v78-store-notify';
      wrap.innerHTML=alinV78ButtonHtml();
      host.prepend(wrap);
    }
  }
  if(role==='teacher'){
    const host=document.getElementById('teacherContent')||document.getElementById('teacherPage');
    if(host && !host.querySelector('.alin-v78-teacher-notify')){
      const wrap=document.createElement('div');
      wrap.className='alin-v78-role-notify alin-v78-teacher-notify';
      wrap.innerHTML=alinV78ButtonHtml();
      host.prepend(wrap);
    }
  }
  if(role==='library'){
    const host=document.getElementById('libraryPage')||document.getElementById('libraryHistory')?.parentElement;
    if(host && !host.querySelector('.alin-v78-library-notify')){
      const wrap=document.createElement('div');
      wrap.className='alin-v78-role-notify alin-v78-library-notify';
      wrap.innerHTML=alinV78ButtonHtml();
      host.prepend(wrap);
    }
  }
  alinV78RenderBadge();
}
setTimeout(alinV78EnsureButtons,900);
document.addEventListener('DOMContentLoaded',()=>setTimeout(alinV78EnsureButtons,900));

const alinV78Style=document.createElement('style');
alinV78Style.textContent=`
.alin-v78-store-notify,.alin-v78-role-notify{display:flex;justify-content:flex-start;align-items:center;z-index:20}
.alin-v78-role-notify{margin:8px 0 14px}
.alin-v78-notify-btn{position:relative;width:46px;height:46px;border:1px solid #dfe6ef;border-radius:15px;background:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 24px rgba(15,34,65,.08)}
.alin-v78-bell{font-size:21px;line-height:1}
.alin-v78-count{position:absolute;top:-6px;right:-6px;min-width:21px;height:21px;padding:0 5px;border-radius:999px;background:#d93025;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff}
.alin-v78-panel{position:fixed;top:74px;left:22px;width:min(420px,calc(100vw - 24px));max-height:72vh;background:#fff;border:1px solid #dfe6ef;border-radius:22px;box-shadow:0 24px 70px rgba(8,25,50,.24);z-index:100000;overflow:hidden;direction:rtl}
.alin-v78-panel-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #e7ecf3;background:#f8fafc}
.alin-v78-panel-head b{display:block;font-size:19px;color:#0b1830}.alin-v78-panel-head small{color:#748197}
.alin-v78-panel-head>div:last-child{display:flex;gap:7px}.alin-v78-panel-head button{border:0;border-radius:10px;padding:8px 10px;background:#e9eef5;color:#0b1830;font-weight:800;cursor:pointer}
.alin-v78-list{max-height:60vh;overflow:auto;padding:9px}
.alin-v78-item{width:100%;display:grid;grid-template-columns:10px 1fr;gap:10px;text-align:right;border:0;border-radius:14px;padding:12px;background:#fff;cursor:pointer;margin-bottom:6px}
.alin-v78-item.unread{background:#f0f6ff}.alin-v78-item.read{opacity:.78}
.alin-v78-dot{width:8px;height:8px;border-radius:50%;background:#2a6edb;margin-top:7px}.alin-v78-item.read .alin-v78-dot{background:#b8c1cf}
.alin-v78-item b{display:block;color:#0b1830}.alin-v78-item p{margin:5px 0;color:#5e6c80;line-height:1.55}.alin-v78-item small{color:#8a95a5}
.alin-v78-empty{text-align:center;padding:35px;color:#748197}
@media(max-width:620px){.alin-v78-panel{top:auto;bottom:82px;left:12px;right:12px;width:auto;max-height:68vh}.alin-v78-notify-btn{width:43px;height:43px}}
`;
document.head.appendChild(alinV78Style);


/* PLATFORM STEP 10: V79 legacy product-source override removed. */
/* ================= ALIN V79 COMPREHENSIVE STABILITY FIX ================= */
function alinV79NormalizeProduct(p={}){
  const category=String(p.category_id||p.category||p.type||'stationery').trim()||'stationery';
  const rawStatus=String(p.status||'published').toLowerCase();
  return Object.assign(p,{
    name:String(p.name||p.title||'منتج').trim()||'منتج',
    details:String(p.details||p.description||''),
    description:String(p.description||p.details||''),
    price:Math.max(0,Number(p.price)||0),
    stock:Math.max(0,Number(p.stock)||0),
    category,category_id:category,type:category,
    status:['hidden','archived','deleted','inactive'].includes(rawStatus)?rawStatus:'published'
  });
}
function alinV79RefreshProducts(){ db.products=(db.products||[]).map(alinV79NormalizeProduct); }
/* PLATFORM STEP 10: legacy storefront override removed. */
/* PLATFORM STEP 10: legacy storefront override removed. */
window.addEventListener('unhandledrejection',e=>{ console.error('ALIN unhandled promise',e.reason); });
window.addEventListener('error',e=>{ console.error('ALIN runtime error',e.error||e.message); });


/* ================= ALIN V81 UI FIX: NOTIFICATIONS + MODAL CLOSE + QUANTITY ================= */
(function(){
  const st=document.createElement('style');
  st.textContent=`
  .x,.alin-v77-close{display:grid!important;place-items:center!important;width:44px!important;height:44px!important;padding:0!important;border-radius:50%!important;background:#fff!important;color:#0b1830!important;border:1px solid #dbe3ee!important;box-shadow:0 10px 28px rgba(7,22,47,.22)!important;font-size:28px!important;font-family:Arial,sans-serif!important;line-height:1!important;z-index:100!important;opacity:1!important;visibility:visible!important}
  .x{top:14px!important;left:14px!important}.alin-v77-close{top:14px!important;left:14px!important}
  .x:hover,.alin-v77-close:hover{transform:scale(1.06);background:#fff3f2!important;color:#b42318!important}
  .modal-card{max-height:92vh;overflow:auto;padding-top:68px!important}
  .alin-v77-modal-card{overflow:auto!important}
  .alin-v77-qty-wrap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:800;color:#344054}
  .alin-v77-qty-wrap>span{white-space:nowrap}
  .alin-v77-qty{display:grid!important;grid-template-columns:48px 58px 48px!important;border:2px solid #cfd9e7!important;border-radius:14px!important;overflow:hidden!important;background:#fff!important;box-shadow:0 5px 14px rgba(15,34,65,.08)!important}
  .alin-v77-qty button{display:grid!important;place-items:center!important;width:48px!important;height:46px!important;padding:0!important;border:0!important;border-radius:0!important;background:#0b1830!important;color:#fff!important;font-size:25px!important;font-weight:900!important;line-height:1!important}
  .alin-v77-qty button:hover{background:#d6aa42!important;color:#07162f!important}
  .alin-v77-qty input{display:block!important;width:58px!important;height:46px!important;padding:0!important;border:0!important;border-radius:0!important;background:#fff!important;color:#07162f!important;text-align:center!important;font-size:18px!important;font-weight:900!important;appearance:textfield!important;-moz-appearance:textfield!important}
  .alin-v77-qty input::-webkit-inner-spin-button,.alin-v77-qty input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  .alin-v78-notify-btn{background:linear-gradient(145deg,#fff,#f3f7fc)!important;border:1px solid #d7e0ec!important;box-shadow:0 10px 28px rgba(15,34,65,.13)!important;transition:.2s!important}
  .alin-v78-notify-btn:hover{transform:translateY(-2px) rotate(-3deg);box-shadow:0 15px 34px rgba(15,34,65,.2)!important}
  .alin-v78-panel{border:0!important;box-shadow:0 28px 85px rgba(8,25,50,.3)!important}
  .alin-v78-panel-head{background:linear-gradient(135deg,#0b1830,#163d72)!important;color:#fff!important;border:0!important;padding:18px!important}
  .alin-v78-panel-head b{color:#fff!important;font-size:20px!important}.alin-v78-panel-head small{color:#dbe7f7!important}
  .alin-v78-panel-head button{background:rgba(255,255,255,.14)!important;color:#fff!important;border:1px solid rgba(255,255,255,.2)!important}
  .alin-v78-list{padding:12px!important;background:#f5f8fc!important}
  .alin-v78-item{grid-template-columns:46px 1fr!important;gap:12px!important;padding:14px!important;border:1px solid #e1e8f1!important;box-shadow:0 6px 16px rgba(15,34,65,.06)!important;transition:.18s!important;align-items:start!important}
  .alin-v78-item:hover{transform:translateY(-1px);border-color:#c8d6e8!important;box-shadow:0 10px 24px rgba(15,34,65,.11)!important}
  .alin-v78-item.unread{background:linear-gradient(135deg,#edf5ff,#fff)!important;border-color:#b9d5fb!important}
  .alin-v78-item.read{background:#fff!important;opacity:.88!important}
  .alin-v78-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#e8f1ff;font-size:19px}
  .alin-v78-item.read .alin-v78-icon{background:#eef1f5;color:#667085}
  .alin-v78-item-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.alin-v78-item-title span{background:#d93025;color:#fff;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900}
  .alin-v78-item p{margin:6px 0!important;color:#475467!important}.alin-v78-item small{display:block;color:#8995a7!important}
  .alin-v78-empty{display:grid;gap:7px;place-items:center;padding:48px 20px!important;background:#fff;border:1px dashed #cfd8e6;border-radius:17px}.alin-v78-empty span{font-size:34px}.alin-v78-empty b{color:#344054}.alin-v78-empty small{color:#98a2b3}
  @media(max-width:650px){.modal{padding:8px!important}.modal-card{width:100%!important;max-height:96vh!important;border-radius:18px!important;padding:62px 16px 18px!important}.alin-v77-modal{padding:8px!important}.alin-v77-modal-card{width:100%!important;max-height:96vh!important;border-radius:18px!important}.alin-v77-close,.x{width:42px!important;height:42px!important;top:10px!important;left:10px!important}.alin-v77-modal-actions{align-items:stretch!important}.alin-v77-qty-wrap{width:100%;justify-content:space-between}.alin-v77-qty{grid-template-columns:52px 1fr 52px!important;width:100%!important}.alin-v77-qty input{width:100%!important}.alin-v77-qty button{width:52px!important}.alin-v78-item{grid-template-columns:40px 1fr!important}.alin-v78-icon{width:38px;height:38px}}
  `;
  document.head.appendChild(st);
})();


/* ================= ALIN V84 SMART COMMERCE FEATURES ================= */
/* PLATFORM STEP 10: legacy storefront override removed. */


/* ================= ALIN V85 FULL FEATURES INTEGRATION ================= */
/* PLATFORM STEP 10: legacy storefront override removed. */


/* ================= ALIN V86 LIBRARY PROFESSIONAL DASHBOARD ================= */




/* PLATFORM STEP 10: V88 legacy product modal removed; discovery details are authoritative. */
/* PLATFORM STEP 10: V90 storefront statistics moved to discovery.js. */
/* ================= ALIN V91 NOTIFICATIONS DISPLAY CLEANUP ================= */




/* ================= ALIN V92 FULL AUDIT STABILITY LAYER ================= */
(function(){
  let scheduled=false;

  function removeDuplicateNodes(selector){
    const rows=[...document.querySelectorAll(selector)];
    rows.slice(1).forEach(el=>el.remove());
  }

  function normalizeInterface(){
    removeDuplicateNodes('.alin-v85-adminfeatures');
    removeDuplicateNodes('.bottom-nav');
    removeDuplicateNodes('#alinV78Panel');
    removeDuplicateNodes('.alin-v78-panel');

    // Keep only one red counter inside each button.
    document.querySelectorAll('button,a').forEach(el=>{
      const badges=[...el.querySelectorAll(':scope > .alin-v84-badge,:scope > .alin-v85-badge')];
      badges.slice(1).forEach(x=>x.remove());
    });

    // Remove accidental empty overlays/modals.
    document.querySelectorAll('.alin-v77-modal,.alin-v85-overlay,.alin-v86-overlay').forEach(el=>{
      if(!el.querySelector('button,h1,h2,h3,img,input,article'))el.remove();
    });

    try{ if(typeof alinV90RefreshStoreStats==='function') alinV90RefreshStoreStats(); }catch(_){}
  }

  function scheduleNormalize(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      normalizeInterface();
    });
  }

  const observer={observe(){},disconnect(){},takeRecords(){return[];}};
  window.addEventListener('load',()=>{
    observer.observe(document.body,{childList:true,subtree:true});
    scheduleNormalize();
    setTimeout(scheduleNormalize,800);
    setTimeout(scheduleNormalize,2200);
  });

  // A visible, non-blocking error message for unexpected runtime failures.
  window.addEventListener('unhandledrejection',event=>{
    console.error('ALIN V92 async error:',event.reason);
  });
  window.addEventListener('error',event=>{
    console.error('ALIN V92 runtime error:',event.error||event.message);
  });
})();


/* ================= ALIN V93 SAFE CLEANUP (NON-DESTRUCTIVE) ================= */
(function(){
  const onceFlags=new Set();
  let normalizeQueued=false;

  function runOnce(key,fn){
    if(onceFlags.has(key))return;
    try{
      fn();
      onceFlags.add(key);
    }catch(err){
      console.error('ALIN V93 runOnce failed:',key,err);
    }
  }

  function keepFirst(selector){
    const nodes=[...document.querySelectorAll(selector)];
    nodes.slice(1).forEach(node=>node.remove());
  }

  function removeExtraBadges(){
    document.querySelectorAll('button,a').forEach(el=>{
      const badges=[...el.querySelectorAll(':scope > .alin-v84-badge,:scope > .alin-v85-badge,:scope > .alin-v86-badge')];
      badges.slice(1).forEach(node=>node.remove());
    });
  }

  function normalizeUi(){
    try{
      keepFirst('.alin-v85-adminfeatures');
      keepFirst('.bottom-nav');
      keepFirst('#alinV78Panel');
      keepFirst('.alin-v78-panel');
      removeExtraBadges();

      document.querySelectorAll('.alin-v77-modal,.alin-v85-overlay,.alin-v86-overlay').forEach(el=>{
        const hasContent=el.querySelector('button,h1,h2,h3,img,input,article,.row,.panel');
        if(!hasContent)el.remove();
      });

      if(typeof alinV90RefreshStoreStats==='function'){
        alinV90RefreshStoreStats();
      }
    }catch(err){
      console.error('ALIN V93 normalizeUi failed:',err);
    }
  }

  function scheduleNormalize(){
    if(normalizeQueued)return;
    normalizeQueued=true;
    requestAnimationFrame(()=>{
      normalizeQueued=false;
      normalizeUi();
    });
  }

  function safeWrap(name){
    const fn=window[name];
    if(typeof fn!=='function'||fn.__alinV93Wrapped)return;
    const wrapped=function(){
      try{
        return fn.apply(this,arguments);
      }catch(err){
        console.error(`ALIN V93 ${name} failed:`,err);
        try{
          if(typeof toast==='function')toast('حدث خطأ بسيط، أعد المحاولة');
        }catch(_){}
        return undefined;
      }finally{
        scheduleNormalize();
      }
    };
    wrapped.__alinV93Wrapped=true;
    window[name]=wrapped;
  }

  window.addEventListener('load',()=>{
    runOnce('observer',()=>{
      const observer={observe(){},disconnect(){},takeRecords(){return[];}};
      observer.observe(document.body,{childList:true,subtree:true});
      window.__alinV93Observer=observer;
    });

    [
      'renderStore',
      'renderProductsAdmin',
      'renderNotificationsAdmin'
    ].forEach(safeWrap);

    scheduleNormalize();
    setTimeout(scheduleNormalize,700);
    setTimeout(scheduleNormalize,1800);
  });

  window.addEventListener('unhandledrejection',event=>{
    console.error('ALIN V93 async error:',event.reason);
  });

  window.addEventListener('error',event=>{
    console.error('ALIN V93 runtime error:',event.error||event.message);
  });
})();


/* ================= ALIN V94 SINGLE NOTIFICATION BUTTON ================= */
(function(){
  function notificationButtons(){
    return [...document.querySelectorAll(
      '.alin-v78-notify-btn, [data-notification-button], button[onclick*="alinV78"], button[onclick*="Notification"], button[onclick*="notification"]'
    )].filter(el=>{
      const text=(el.textContent||'').trim();
      return el.classList.contains('alin-v78-notify-btn') || /🔔|إشعار/.test(text);
    });
  }

  function choosePrimary(buttons){
    if(!buttons.length)return null;
    return buttons.find(el=>el.closest('header,.topbar,.app-header,.teacher-header,.admin-heading')) || buttons[0];
  }

  function fixNotificationButton(){
    const buttons=notificationButtons();
    if(!buttons.length)return;

    const primary=choosePrimary(buttons);
    buttons.forEach(el=>{ if(el!==primary) el.remove(); });

    primary.classList.add('alin-v94-notification-button');
    primary.innerHTML='<span class="alin-v94-bell" aria-hidden="true">🔔</span><span class="alin-v94-notify-count" hidden>0</span>';
    primary.setAttribute('aria-label','الإشعارات');
    primary.setAttribute('title','الإشعارات');

    primary.querySelectorAll('.alin-v84-badge,.alin-v85-badge,.alin-v86-badge,.alin-v78-badge').forEach(x=>x.remove());
  }

  let queued=false;
  const scheduleFix=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      fixNotificationButton();
    });
  };

  const observer={observe(){},disconnect(){},takeRecords(){return[];}};
  window.addEventListener('load',()=>{
    observer.observe(document.body,{childList:true,subtree:true});
    scheduleFix();
    setTimeout(scheduleFix,500);
    setTimeout(scheduleFix,1500);
  });
})();


/* ================= ALIN V95 RESTORE LIBRARY SETTLEMENT ================= */




/* ALIN 2.0.1: legacy V96 banner patch removed; store/banners.js is authoritative. */

/* PLATFORM STEP 10: V97 legacy card decorator removed; discovery favorites are authoritative. */
