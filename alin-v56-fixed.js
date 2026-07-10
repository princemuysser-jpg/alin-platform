
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

let db = {accounts:{teachers:[],libraries:[]},booklets:[],products:[],categories:[],banners:[],orders:[],permits:[],ledger:[],withdrawals:[],audit:[],settings:{storeType:'booklet'}};
let current = null, pendingRole = '', checkoutItem = null;

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
async function insert(table,row){ if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط'); const {data,error}=await sb.from(table).insert(row).select().single(); if(error)throw error; return data; }
async function update(table,values,match){ if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط'); let q=sb.from(table).update(values); Object.entries(match).forEach(([k,v])=>q=q.eq(k,v)); const {error}=await q; if(error)throw error; }
async function removeRow(table,match){ if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط'); let q=sb.from(table).delete(); Object.entries(match).forEach(([k,v])=>q=q.eq(k,v)); const {error}=await q; if(error)throw error; }

async function audit(kind,text){ try{ await insert('audit',{id:uid('A'),kind,text}); }catch(e){} }
async function ensureStorageReady(){
  if(!requireConnection()) throw new Error('الاتصال بالنظام غير مضبوط');
  try{
    const {error}=await sb.storage.from('alin-files').list('', {limit:1});
    if(error){
      const m=String(error.message||'').toLowerCase();
      if(m.includes('bucket') || m.includes('not found')) throw new Error('مجلد التخزين alin-files غير موجود. نفّذ ملف alin_v49_storage_fix.sql مرة واحدة.');
      if(m.includes('policy') || m.includes('permission') || m.includes('row-level')) throw new Error('صلاحيات التخزين ناقصة. نفّذ ملف alin_v49_storage_fix.sql مرة واحدة.');
    }
  }catch(e){
    if(String(e.message||'').includes('alin_v49_storage_fix')) throw e;
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
    if(m.includes('bucket') || m.includes('not found')) throw new Error('مجلد التخزين alin-files غير موجود. نفّذ ملف alin_v49_storage_fix.sql مرة واحدة.');
    if(m.includes('policy') || m.includes('permission') || m.includes('row-level')) throw new Error('صلاحيات الرفع ناقصة. نفّذ ملف alin_v49_storage_fix.sql مرة واحدة.');
    if(m.includes('invalid key')) throw new Error('تعذر إنشاء اسم آمن للملف. تم إصلاح هذا الخلل في V51؛ حدّث ملفات الموقع وحاول الرفع من جديد.');
    throw new Error('فشل رفع الملف: '+(error.message||'خطأ غير معروف'));
  }
  const publicUrl=mediaUrl(data?.path||path);
  try{
    const ok=await checkPublicFile(publicUrl);
    if(!ok) throw new Error('الملف رُفع لكن الرابط غير عام. نفّذ ملف alin_v49_storage_fix.sql.');
  }catch(e){
    if(String(e.message||'').includes('alin_v49_storage_fix')) throw e;
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
    const [accounts,booklets,products,categories,banners,orders,permits,ledger,withdrawals,auditRows,settingsRows] = await Promise.all([
      query('accounts'),query('booklets'),query('products'),query('categories'),query('banners'),query('orders'),query('permits'),query('ledger'),query('withdrawals'),query('audit'),query('settings')
    ]);
    db.accounts={teachers:accounts.filter(x=>x.role==='teacher'),libraries:accounts.filter(x=>x.role==='library')};
    db.booklets=booklets; db.products=products; db.categories=categories; db.banners=banners; db.orders=orders.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')); db.permits=permits; db.ledger=ledger; db.withdrawals=withdrawals; db.audit=auditRows.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')); db.settings={storeType:'booklet'};
    settingsRows.forEach(x=>db.settings[x.key]=x.value);
    if(!db.accounts.teachers.length && !db.accounts.libraries.length) await seedData();
    renderAll();
  }catch(e){ console.error(e); if(current?.role==='admin') alert('تعذر تحميل بيانات النظام، تم تثبيت الواجهة بدون إيقاف.'); }
}
async function seedData(){
  await insert('accounts',{id:'T1',role:'teacher',name:'ميسر صلاح الدين',username:'0770',password_hash:'1234',area:'كركوك',landmark:'',status:'active'});
  await insert('accounts',{id:'L1',role:'library',name:'مكتبة آلين',username:'LIB1',password_hash:'1234',area:'كركوك',landmark:'قرب المركز',status:'active'});
  await insert('booklets',{id:'B1',title:'ملزمة الفيزياء',teacher_id:'T1',subject:'الفيزياء',grade:'السادس الإعدادي',price:10000,status:'published'});
  await insert('banners',{id:'AD1',title:'أهلاً بكم في منصة آلين',text:'تصاميم وملازم وقرطاسية بجودة عالية وأسعار مناسبة',active:1});
  await audit('system','تهيئة بيانات أولية');
}

function showLogin(role){ pendingRole=role; loginForm.classList.remove('hidden'); loginMsg.textContent=''; loginU.value=''; loginPass.value=''; }
async function doLogin(){
  const u=loginU.value.trim(), p=loginPass.value.trim();
  if(pendingRole==='admin'){
    if(u==='admin' && p==='1234'){ current={role:'admin',name:'منصة آلين'}; openPage('admin'); return; }
    loginMsg.textContent='بيانات الدخول غير صحيحة'; return;
  }
  const list = pendingRole==='teacher'?db.accounts.teachers:db.accounts.libraries;
  const a=list.find(x=>x.username===u && x.password_hash===p && x.status==='active');
  if(!a){ loginMsg.textContent='بيانات الدخول غير صحيحة'; return; }
  current={role:pendingRole,id:a.id,name:a.name,username:a.username}; openPage(pendingRole);
}
function openPage(page){ login.classList.add('hidden'); app.classList.remove('hidden'); app.classList.toggle('store-mode', page==='store'); document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); const el=document.getElementById(page+'Page'); if(el)el.classList.remove('hidden'); activeNav.innerHTML=`<button>${{store:'المتجر',teacher:'المدرس',library:'المكتبة',admin:'الإدارة'}[page]||page}</button>`; renderAll(); }
function logout(){ current=null; app.classList.remove('store-mode'); app.classList.add('hidden'); login.classList.remove('hidden'); loginForm.classList.add('hidden'); }
async function setStoreType(type,btn){ db.settings.storeType=type; document.querySelectorAll('.store-nav button').forEach(x=>x.classList.remove('active')); if(btn)btn.classList.add('active'); else { const map={booklet:2,stationery:3,gift:4}; const b=document.querySelector(`.store-nav button:nth-child(${map[type]||2})`); if(b)b.classList.add('active'); } renderStore(); }

function storeItems(){
  if(db.settings.storeType==='booklet'){
    return db.booklets.filter(x=>x.status==='published').map(x=>({kind:'booklet',id:x.id,title:x.title,subject:x.subject,grade:x.grade,teacher:teacherName(x.teacher_id),price:x.price,cover:x.cover_path,stock:null}));
  }
  return db.products.filter(x=>x.type===db.settings.storeType&&x.status==='published').map(x=>({kind:x.type,id:x.id,title:x.name,subject:x.category,grade:x.category,teacher:'',price:x.price,cover:x.image_path,stock:x.stock}));
}
function renderStore(){
  if(!window.storeGrid || !db.booklets)return;
  bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${x.title}</h2><p>${x.text||''}</p></div><b>آ</b></div>`).join('');
  const items=storeItems(), q=(searchInput.value||'').toLowerCase();
  const cats=[...new Set(items.map(x=>x.grade||x.subject).filter(Boolean))], teachers=[...new Set(items.map(x=>x.teacher).filter(Boolean))];
  const oldCat=filterCategory.value, oldTeacher=filterTeacher.value;
  filterCategory.innerHTML='<option value="">كل الأقسام</option>'+cats.map(x=>`<option ${x===oldCat?'selected':''}>${x}</option>`).join('');
  filterTeacher.style.display=db.settings.storeType==='booklet'?'':'none';
  filterTeacher.innerHTML='<option value="">كل المدرسين</option>'+teachers.map(x=>`<option ${x===oldTeacher?'selected':''}>${x}</option>`).join('');
  const list=items.filter(x=>(!filterCategory.value||x.grade===filterCategory.value||x.subject===filterCategory.value)&&(!filterTeacher.value||x.teacher===filterTeacher.value)&&(`${x.title} ${x.teacher} ${x.subject}`).toLowerCase().includes(q));
  storeGrid.innerHTML=list.map(x=>`<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:(x.subject||'منتج')}</div><h3>${x.title}</h3>${x.teacher?`<p>${x.teacher}</p>`:''}<p>${x.grade||x.subject||''}</p>${x.stock!==null?`<p>المخزون: ${x.stock}</p>`:''}<div class="price">${money(x.price)} د.ع</div><button onclick="openCheckout('${x.kind}','${x.id}')">إتمام الشراء</button></article>`).join('')||'لا توجد مواد';
}
function openCheckout(kind,itemId){
  checkoutItem={kind,itemId};
  const item=kind==='booklet'?db.booklets.find(x=>x.id===itemId):db.products.find(x=>x.id===itemId);
  if(!item)return;
  const title=item.title||item.name, price=item.price||0;
  checkoutBox.innerHTML=`<h2>إتمام الشراء</h2><div class="row"><b>${title}</b><span>${money(price)} د.ع</span></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الطالب"><input id="qty" type="number" min="1" value="1" oninput="updateTotal()" placeholder="عدد النسخ"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر المكتبة</option>${db.accounts.libraries.filter(x=>x.status==='active').map(x=>`<option value="${x.id}">${x.name} — ${x.area||''} — ${x.landmark||''}</option>`).join('')}</select><div id="libInfo" class="checkout-total"></div><div class="checkout-total">المجموع: <b id="totalBox">${money(price)} د.ع</b></div></div><h3>الدفع</h3><p>حالياً إنشاء الطلب ثم تأكيد دفع تطويري من الإدارة.</p><button onclick="confirmCheckout()">إنشاء الطلب</button><div id="payMsg"></div>`;
  checkoutModal.classList.remove('hidden');
}
function closeCheckout(){ checkoutModal.classList.add('hidden'); checkoutItem=null; }
function updateTotal(){ if(!checkoutItem)return; const item=checkoutItem.kind==='booklet'?db.booklets.find(x=>x.id===checkoutItem.itemId):db.products.find(x=>x.id===checkoutItem.itemId); totalBox.textContent=money((+qty.value||1)*(item?.price||0))+' د.ع'; }
function showLibInfo(){ const lib=db.accounts.libraries.find(x=>x.id===libSelect.value); libInfo.innerHTML=lib?`<b>${lib.name}</b><br>المنطقة: ${lib.area||'-'}<br>أقرب نقطة: ${lib.landmark||'-'}`:''; }
async function confirmCheckout(){
  try{
    if(!checkoutItem)return;
    const item=checkoutItem.kind==='booklet'?db.booklets.find(x=>x.id===checkoutItem.itemId):db.products.find(x=>x.id===checkoutItem.itemId);
    if(!studentName.value.trim()||!studentPhone.value.trim()||!libSelect.value) throw new Error('أكمل بيانات الطلب');
    const q=+qty.value||1, total=(item.price||0)*q, oid=uid('O');
    await insert('orders',{id:oid,kind:checkoutItem.kind,item_id:item.id,title:item.title||item.name,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),library_id:libSelect.value,qty:q,unit_price:item.price,total,status:'pending',payment_status:'payment_pending'});
    await audit('order','إنشاء طلب '+(item.title||item.name));
    payMsg.innerHTML=`<div class="checkout-total"><b>تم إنشاء الطلب</b><br>رقم الطلب: ${oid}</div>`;
    await load();
  }catch(e){ payMsg.textContent=e.message; }
}

function renderTeacher(){ if(!window.teacherStats||!db.ledger)return; const teacherId=current?.role==='teacher'?current.id:(db.accounts.teachers[0]?.id||''); const books=db.booklets.filter(x=>x.teacher_id===teacherId), ledger=db.ledger.filter(x=>x.teacher_id===teacherId); teacherStats.innerHTML=`<div><b>الملازم</b><span>${books.length}</span></div><div><b>المبيعات</b><span>${ledger.length}</span></div><div><b>الرصيد</b><span>${money(ledger.reduce((a,x)=>a+(+x.teacher||0),0))} د.ع</span></div>`; teacherBooks.innerHTML=books.map(x=>`<div class="row"><b>${x.title}</b><span class="status">${x.status}</span></div>`).join('')||'لا توجد ملازم'; teacherSales.innerHTML=ledger.map(x=>`<div class="row"><b>${x.order_id}</b><span>${money(x.teacher)} د.ع</span></div>`).join('')||'لا توجد مبيعات'; }
function renderLibrary(){ if(!window.libraryStats||!db.permits)return; const libraryId=current?.role==='library'?current.id:(db.accounts.libraries[0]?.id||''); const permits=db.permits.filter(x=>x.library_id===libraryId), ledger=db.ledger.filter(x=>x.library_id===libraryId); libraryStats.innerHTML=`<div><b>طلبات النسخ</b><span>${permits.length}</span></div><div><b>الرصيد</b><span>${money(ledger.reduce((a,x)=>a+(+x.library||0),0))} د.ع</span></div>`; libraryPermits.innerHTML=permits.map(x=>`<div class="row"><div><b>${db.booklets.find(b=>b.id===x.booklet_id)?.title||''}</b><small>${x.used}/${x.qty}</small></div><div class="row-actions"><button onclick="openProtected('${x.id}')">فتح PDF</button><button onclick="usePermit('${x.id}')" ${x.status==='done'?'disabled':''}>تنفيذ نسخة</button></div></div>`).join('')||'لا توجد طلبات'; libraryHistory.innerHTML=permits.filter(x=>x.used).map(x=>`<div class="row"><b>${x.order_id}</b><span>${x.used}</span></div>`).join('')||'لا يوجد تنفيذ'; }
function openProtected(id){ const p=db.permits.find(x=>x.id===id); const b=db.booklets.find(x=>x.id===p?.booklet_id); if(!b?.file_path)return alert('لا يوجد ملف PDF'); window.open(mediaUrl(b.file_path),'_blank'); }
async function usePermit(id){ const p=db.permits.find(x=>x.id===id); if(!p || p.used>=p.qty)return alert('إذن النسخ منتهي'); const used=(+p.used||0)+1; await update('permits',{used,status:used>=p.qty?'done':'active'},{id}); await audit('copy','استخدام إذن نسخة '+id); await load(); }
async function requestWithdraw(role){ try{ const amount=+(role==='teacher'?teacherWithdrawAmount.value:libraryWithdrawAmount.value); if(amount<=0)throw new Error('المبلغ غير صحيح'); await insert('withdrawals',{id:uid('W'),role,account_id:current.id,amount,status:'pending'}); await audit('withdrawal','طلب سحب '+role); await load(); alert('تم إرسال الطلب'); }catch(e){ alert(e.message); } }

function adminStatsRender(){ if(!window.adminStats||!db.ledger)return; adminStats.innerHTML=`<div><b>الحسابات</b><span>${db.accounts.teachers.length+db.accounts.libraries.length}</span></div><div><b>الملازم</b><span>${db.booklets.length}</span></div><div><b>الطلبات</b><span>${db.orders.length}</span></div><div><b>دخل آلين</b><span>${money(db.ledger.reduce((a,x)=>a+(+x.alin||0),0))} د.ع</span></div>`; }
function adminTab(t){ adminStatsRender(); if(t==='accounts')return renderAccountsAdmin(); if(t==='booklets')return renderBookletsAdmin(); if(t==='products')return renderProductsAdmin(); if(t==='categories')return renderCategoriesAdmin(); if(t==='orders')return renderOrdersAdmin(); if(t==='finance')return renderFinanceAdmin(); if(t==='ads')return renderAdsAdmin(); if(t==='settings')return renderSettingsAdmin(); if(t==='audit')adminContent.innerHTML='<h2>سجل العمليات</h2>'+db.audit.map(x=>`<div class="row"><div><b>${x.text}</b><small>${x.created_at||''}</small></div><span>${x.kind}</span></div>`).join(''); }
function renderAccountsAdmin(){ adminContent.innerHTML=`<h2>الحسابات</h2><div class="form-grid"><select id="aRole"><option value="teacher">مدرس</option><option value="library">مكتبة</option></select><input id="aName" placeholder="الاسم"><input id="aUser" placeholder="اليوزر"><input id="aPass" placeholder="الرمز"><input id="aArea" placeholder="المنطقة"><input id="aLandmark" placeholder="أقرب نقطة"><button onclick="addAccount()">إضافة</button></div><h3>المدرسين</h3>${db.accounts.teachers.map(x=>`<div class="row"><div><b>${x.name}</b><small>${x.username} — ${x.area||''}</small></div><span>${x.status}</span></div>`).join('')}<h3>المكتبات</h3>${db.accounts.libraries.map(x=>`<div class="row"><div><b>${x.name}</b><small>${x.username} — ${x.area||''} — ${x.landmark||''}</small></div><span>${x.status}</span></div>`).join('')}`; }
async function addAccount(){ try{ await insert('accounts',{id:uid(aRole.value==='teacher'?'T':'L'),role:aRole.value,name:aName.value,username:aUser.value,password_hash:aPass.value,area:aArea.value,landmark:aLandmark.value,status:'active'}); await audit('account','إضافة حساب '+aName.value); await load(); renderAccountsAdmin(); }catch(e){ alert(e.message); } }

function renderBookletsAdmin(){ adminContent.innerHTML=`<h2>الملازم</h2><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${db.accounts.teachers.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="grade" placeholder="الصف"><input name="price" type="number" placeholder="السعر"><label>غلاف<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF الحقيقي<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${db.booklets.map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${teacherName(x.teacher_id)} — ${esc(x.file_name||'')} — ${esc(x.status||'')}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button onclick="setBookStatus('${x.id}','archived')">أرشفة</button><button class="danger" onclick="deleteBooklet('${x.id}')">حذف</button></div></div>`).join('')||emptyState('لا توجد ملازم')}`; }
async function uploadBooklet(){
  try{
    const f=new FormData(bookForm);
    const cover=await uploadFileV52('covers',f.get('cover'),{type:'image'});
    const ti=await uploadFileV52('teachers',f.get('teacherImage'),{type:'image'});
    const pdfFile=f.get('bookletFile');
    if(!pdfFile||!pdfFile.name) throw new Error('ملف PDF مطلوب');
    const fp=await uploadFileV52('booklets',pdfFile,{required:true,type:'pdf'});
    await insert('booklets',{
      id:uid('B'),
      title:f.get('title'),
      teacher_id:f.get('teacherId'),
      subject:f.get('subject'),
      grade:f.get('grade'),
      price:+f.get('price'),
      cover_path:cover,
      teacher_image_path:ti,
      file_path:fp,
      file_name:pdfFile.name,
      status:'draft',
      publish_status:'draft',
      published:false,
      is_published:false,
      teacher_approved:false
    });
    await audit('booklet','رفع ملزمة للمعاينة '+f.get('title'));
    await load();
    renderBookletsAdmin();
    alert('تم رفع الملزمة للمعاينة. اسم الملف العربي مقبول، ولن تظهر في المتجر قبل الموافقة والنشر.');
  }catch(e){ alert(e.message); }
}

function renderProductsAdmin(){ adminContent.innerHTML=`<h2>المنتجات</h2><form id="productForm" class="form-grid"><select name="type"><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input name="name" placeholder="اسم المنتج"><input name="category" placeholder="القسم"><input name="price" type="number" placeholder="السعر"><input name="stock" type="number" placeholder="المخزون"><label>صورة المنتج<input name="image" type="file" accept="image/*"></label><button type="button" onclick="addProduct()">إضافة المنتج</button></form>${db.products.map(x=>`<div class="row"><div><b>${x.name}</b><small>${x.category} — ${money(x.price)} د.ع — ${x.status}</small></div><button onclick="setProductStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button></div>`).join('')}`; }
async function addProduct(){ try{ const f=new FormData(productForm); const img=await uploadFile('products',f.get('image'),{type:'image'}); await insert('products',{id:uid('PR'),type:f.get('type'),name:f.get('name'),category:f.get('category'),price:+f.get('price'),stock:+f.get('stock')||0,image_path:img,status:'published'}); await audit('product','إضافة منتج '+f.get('name')); await load(); renderProductsAdmin(); }catch(e){ alert(e.message); } }
async function setProductStatus(id,status){ await update('products',{status},{id}); await audit('product','تغيير حالة منتج '+id); await load(); renderProductsAdmin(); }

function renderCategoriesAdmin(){ adminContent.innerHTML=`<h2>الأقسام</h2><div class="form-grid"><select id="catType"><option value="booklet">ملازم</option><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input id="catName" placeholder="اسم القسم"><button onclick="addCategory()">إضافة قسم</button></div>${db.categories.map(x=>`<div class="row"><div><b>${x.name}</b><small>${x.type}</small></div><span>${x.status}</span></div>`).join('')}`; }
async function addCategory(){ await insert('categories',{id:uid('C'),type:catType.value,name:catName.value,status:'active'}); await audit('category','إضافة قسم '+catName.value); await load(); renderCategoriesAdmin(); }

function renderOrdersAdmin(){ adminContent.innerHTML='<h2>الطلبات</h2>'+db.orders.map(x=>`<div class="row"><div><b>${x.title} × ${x.qty}</b><small>${x.student_name} — ${x.payment_status}</small></div>${x.payment_status==='payment_pending'?`<button onclick="devPay('${x.id}')">تأكيد دفع تطويري</button>`:''}</div>`).join(''); }
async function devPay(id){
  const o=db.orders.find(x=>x.id===id); if(!o)return;
  const b=db.booklets.find(x=>x.id===o.item_id);
  const alin=Math.round((+o.total)*0.30), teacher=Math.round((+o.total)*0.50), library=(+o.total)-alin-teacher;
  await update('orders',{status:'paid',payment_status:'paid',payment_ref:'DEV-'+uid('PAY')},{id});
  if(o.kind==='booklet'){
    await insert('permits',{id:uid('P'),order_id:id,booklet_id:o.item_id,library_id:o.library_id,qty:o.qty,used:0,status:'active'});
    await insert('ledger',{id:uid('LG'),order_id:id,alin,teacher,teacher_id:b?.teacher_id||'',library,library_id:o.library_id,settlement_status:'unsettled'});
  }
  await audit('payment','تأكيد دفع تطويري للطلب '+id); await load(); renderOrdersAdmin();
}

function renderFinanceAdmin(){ adminContent.innerHTML=`<h2>الدفتر المالي</h2>${db.ledger.map(x=>`<div class="row"><div><b>${x.order_id}</b><small>آلين ${money(x.alin)} — مدرس ${money(x.teacher)} — مكتبة ${money(x.library)}</small></div><span>${x.settlement_status}</span></div>`).join('')}<h3>طلبات السحب</h3>${db.withdrawals.map(x=>`<div class="row"><div><b>${x.role} — ${money(x.amount)} د.ع</b><small>${x.status}</small></div><div class="row-actions"><button onclick="withdrawStatus('${x.id}','approved')">موافقة</button><button onclick="withdrawStatus('${x.id}','paid')">تم الدفع</button><button class="danger" onclick="withdrawStatus('${x.id}','rejected')">رفض</button></div></div>`).join('')}`; }
async function withdrawStatus(id,status){ await update('withdrawals',{status},{id}); await audit('withdrawal','تحديث طلب سحب '+id); await load(); renderFinanceAdmin(); }

function renderAdsAdmin(){ adminContent.innerHTML=`<h2>اللوحة الإعلانية</h2><div class="form-grid"><input id="adTitle" placeholder="عنوان الإعلان"><input id="adText" placeholder="نص الإعلان"><button onclick="addAd()">إضافة إعلان</button></div>${db.banners.map(x=>`<div class="row"><div><b>${x.title}</b><small>${x.text}</small></div><button onclick="toggleAd('${x.id}',${x.active})">${x.active?'إيقاف':'تشغيل'}</button></div>`).join('')}`; }
async function addAd(){ await insert('banners',{id:uid('AD'),title:adTitle.value,text:adText.value,active:1}); await audit('banner','إضافة إعلان'); await load(); renderAdsAdmin(); }
async function toggleAd(id,active){ await update('banners',{active:active?0:1},{id}); await load(); renderAdsAdmin(); }

function renderSettingsAdmin(){ adminContent.innerHTML=`<h2>إعدادات المنصة</h2><div class="form-grid"><input id="platformNameInput" value="آلين" placeholder="اسم المنصة"><input id="platformPhoneInput" value="" placeholder="رقم الهاتف"><button onclick="saveSystemSettings()">حفظ</button></div><div id="systemMsg"></div>`; }
function renderAll(){ renderStore(); renderTeacher(); renderLibrary(); adminStatsRender(); if(window.adminContent&&!adminContent.innerHTML)adminTab('accounts'); }
document.addEventListener('DOMContentLoaded', load);
/* ================= ALIN V18 UPGRADE ================= */
let activeAdminTab = 'accounts';
const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function emptyState(text){ return `<div class="empty">${esc(text)}</div>`; }
function toast(text){ const old=document.querySelector('.toast'); if(old)old.remove(); const el=document.createElement('div'); el.className='toast'; el.textContent=text; document.body.appendChild(el); setTimeout(()=>el.remove(),2200); }
function markAdminTab(t){ activeAdminTab=t; document.querySelectorAll('.admin-tabs button').forEach(b=>b.classList.toggle('active-admin-tab',(b.getAttribute('onclick')||'').includes(`'${t}'`))); }

adminTab = function(t){
  markAdminTab(t); adminStatsRender();
  if(t==='accounts')return renderAccountsAdmin(); if(t==='booklets')return renderBookletsAdmin(); if(t==='products')return renderProductsAdmin(); if(t==='categories')return renderCategoriesAdmin(); if(t==='orders')return renderOrdersAdmin(); if(t==='finance')return renderFinanceAdmin(); if(t==='ads')return renderAdsAdmin(); if(t==='settings')return renderSettingsAdmin();
  if(t==='audit') adminContent.innerHTML='<h2>سجل العمليات</h2>'+(db.audit.length?db.audit.map(x=>`<div class="row"><div><b>${esc(x.text)}</b><small>${esc(x.created_at||'')}</small></div><span>${esc(x.kind)}</span></div>`).join(''):emptyState('لا توجد عمليات مسجلة'));
}

renderAccountsAdmin = function(){
  const rows = list => list.length ? list.map(x=>`<div class="row"><div><b>${esc(x.name)}</b><small>${esc(x.username)} — ${esc(x.area||'')}${x.landmark?' — '+esc(x.landmark):''}</small></div><div class="row-actions"><button class="secondary" onclick="editAccount('${x.id}')">تعديل</button><button onclick="toggleAccount('${x.id}','${x.status==='active'?'disabled':'active'}')">${x.status==='active'?'إيقاف':'تفعيل'}</button><button class="danger" onclick="deleteAccount('${x.id}')">حذف</button></div></div>`).join('') : emptyState('لا توجد حسابات');
  adminContent.innerHTML=`<h2>الحسابات</h2><div class="form-grid"><select id="aRole"><option value="teacher">مدرس</option><option value="library">مكتبة</option></select><input id="aName" placeholder="الاسم"><input id="aUser" placeholder="اسم الدخول"><input id="aPass" placeholder="الرمز السري"><input id="aArea" placeholder="المنطقة"><input id="aLandmark" placeholder="أقرب نقطة"><button onclick="addAccount()">إضافة حساب</button></div><h3>المدرسون</h3>${rows(db.accounts.teachers)}<h3>المكتبات</h3>${rows(db.accounts.libraries)}`;
}
addAccount = async function(){ try{ if(!aName.value.trim()||!aUser.value.trim()||!aPass.value.trim())throw new Error('أكمل الاسم واسم الدخول والرمز'); await insert('accounts',{id:uid(aRole.value==='teacher'?'T':'L'),role:aRole.value,name:aName.value.trim(),username:aUser.value.trim(),password_hash:aPass.value,status:'active',area:aArea.value.trim(),landmark:aLandmark.value.trim()}); await audit('account','إضافة حساب '+aName.value); await load(); renderAccountsAdmin(); toast('تمت إضافة الحساب'); }catch(e){alert(e.message)} }
async function editAccount(id){ const x=[...db.accounts.teachers,...db.accounts.libraries].find(a=>a.id===id); if(!x)return; const name=prompt('الاسم',x.name); if(name===null)return; const username=prompt('اسم الدخول',x.username); if(username===null)return; const area=prompt('المنطقة',x.area||''); if(area===null)return; const landmark=x.role==='library'?prompt('أقرب نقطة',x.landmark||''):x.landmark; await update('accounts',{name:name.trim(),username:username.trim(),area:area.trim(),landmark:landmark||''},{id}); await audit('account','تعديل حساب '+id); await load(); renderAccountsAdmin(); toast('تم تعديل الحساب'); }
async function toggleAccount(id,status){ await update('accounts',{status},{id}); await load(); renderAccountsAdmin(); toast(status==='active'?'تم تفعيل الحساب':'تم إيقاف الحساب'); }
async function deleteAccount(id){ if(!confirm('حذف الحساب نهائياً؟'))return; try{ await removeRow('accounts',{id}); await audit('account','حذف حساب '+id); await load(); renderAccountsAdmin(); toast('تم حذف الحساب'); }catch(e){alert('تعذر الحذف: '+e.message)} }

renderCategoriesAdmin = function(){ const typeName={booklet:'ملازم',stationery:'قرطاسية',gift:'هدايا'}; adminContent.innerHTML=`<h2>الأقسام</h2><div class="form-grid"><select id="catType"><option value="booklet">ملازم</option><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input id="catName" placeholder="اسم القسم"><button onclick="addCategory()">إضافة قسم</button></div>${db.categories.length?db.categories.map(x=>`<div class="row"><div><b>${esc(x.name)}</b><small>${typeName[x.type]||esc(x.type)}</small></div><div class="row-actions"><button class="secondary" onclick="editCategory('${x.id}')">تعديل</button><button onclick="toggleCategory('${x.id}','${x.status==='active'?'hidden':'active'}')">${x.status==='active'?'إخفاء':'إظهار'}</button><button class="danger" onclick="deleteCategory('${x.id}')">حذف</button></div></div>`).join(''):emptyState('لا توجد أقسام')}`; }
addCategory = async function(){ try{ if(!catName.value.trim())throw new Error('اكتب اسم القسم'); await insert('categories',{id:uid('C'),type:catType.value,name:catName.value.trim(),status:'active'}); await audit('category','إضافة قسم '+catName.value); await load(); renderCategoriesAdmin(); toast('تمت إضافة القسم'); }catch(e){alert(e.message)} }
async function editCategory(id){ const x=db.categories.find(a=>a.id===id); const name=prompt('اسم القسم',x?.name||''); if(name===null||!name.trim())return; await update('categories',{name:name.trim()},{id}); await load(); renderCategoriesAdmin(); toast('تم تعديل القسم'); }
async function toggleCategory(id,status){ await update('categories',{status},{id}); await load(); renderCategoriesAdmin(); }
async function deleteCategory(id){ if(!confirm('حذف القسم؟'))return; try{await removeRow('categories',{id}); await load(); renderCategoriesAdmin(); toast('تم حذف القسم')}catch(e){alert(e.message)} }

renderProductsAdmin = function(){ const cats=t=>db.categories.filter(c=>c.type===t&&c.status==='active'); adminContent.innerHTML=`<h2>المنتجات</h2><form id="productForm" class="form-grid"><select name="type" id="productType" onchange="refreshProductCategories()"><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input name="name" placeholder="اسم المنتج"><select name="category" id="productCategory"></select><input name="price" type="number" min="0" placeholder="السعر"><input name="stock" type="number" min="0" placeholder="المخزون"><label>صورة المنتج<input name="image" type="file" accept="image/*"></label><button type="button" onclick="addProduct()">إضافة المنتج</button></form>${db.products.length?db.products.map(x=>`<div class="row"><div><b>${esc(x.name)}</b><small>${esc(x.category)} — ${money(x.price)} د.ع — المخزون ${money(x.stock)}</small></div><div class="row-actions"><button class="secondary" onclick="editProduct('${x.id}')">تعديل</button><button onclick="setProductStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button class="danger" onclick="deleteProduct('${x.id}')">حذف</button></div></div>`).join(''):emptyState('لا توجد منتجات')}`; refreshProductCategories(); }
function refreshProductCategories(){ if(!window.productCategory)return; const list=db.categories.filter(c=>c.type===productType.value&&c.status==='active'); productCategory.innerHTML=list.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')||'<option value="عام">عام</option>'; }
addProduct = async function(){ try{ const f=new FormData(productForm); if(!String(f.get('name')||'').trim())throw new Error('اكتب اسم المنتج'); if(+f.get('price')<0||+f.get('stock')<0)throw new Error('السعر أو المخزون غير صحيح'); const img=await uploadFile('products',f.get('image'),{type:'image'}); await insert('products',{id:uid('PR'),type:f.get('type'),name:String(f.get('name')).trim(),category:f.get('category'),price:+f.get('price')||0,stock:+f.get('stock')||0,image_path:img,status:'published'}); await audit('product','إضافة منتج '+f.get('name')); await load(); renderProductsAdmin(); toast('تمت إضافة المنتج'); }catch(e){alert(e.message)} }
async function editProduct(id){ const x=db.products.find(a=>a.id===id); if(!x)return; const name=prompt('اسم المنتج',x.name); if(name===null)return; const price=prompt('السعر',x.price); if(price===null)return; const stock=prompt('المخزون',x.stock); if(stock===null)return; await update('products',{name:name.trim(),price:+price||0,stock:+stock||0},{id}); await audit('product','تعديل منتج '+id); await load(); renderProductsAdmin(); toast('تم تعديل المنتج'); }
async function deleteProduct(id){ if(!confirm('حذف المنتج؟'))return; try{await removeRow('products',{id}); await audit('product','حذف منتج '+id); await load(); renderProductsAdmin(); toast('تم حذف المنتج')}catch(e){alert(e.message)} }

renderBookletsAdmin = function(){ adminContent.innerHTML=`<h2>الملازم</h2><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${db.accounts.teachers.filter(x=>x.status==='active').map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="grade" placeholder="الصف"><input name="price" type="number" min="0" placeholder="السعر"><label>الغلاف<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${db.booklets.length?db.booklets.map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${esc(teacherName(x.teacher_id))} — ${esc(x.file_name||'')} — ${money(x.price)} د.ع</small></div><div class="row-actions"><button class="secondary" onclick="editBooklet('${x.id}')">تعديل</button><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button class="danger" onclick="archiveBooklet('${x.id}')">أرشفة</button></div></div>`).join(''):emptyState('لا توجد ملازم')}`; }
async function editBooklet(id){ const x=db.booklets.find(a=>a.id===id); if(!x)return; const title=prompt('اسم الملزمة',x.title); if(title===null)return; const subject=prompt('المادة',x.subject||''); if(subject===null)return; const grade=prompt('الصف',x.grade||''); if(grade===null)return; const price=prompt('السعر',x.price); if(price===null)return; await update('booklets',{title:title.trim(),subject:subject.trim(),grade:grade.trim(),price:+price||0},{id}); await audit('booklet','تعديل ملزمة '+id); await load(); renderBookletsAdmin(); toast('تم تعديل الملزمة'); }
async function archiveBooklet(id){ if(!confirm('أرشفة الملزمة؟ ستختفي من المتجر.'))return; await setBookStatus(id,'archived'); toast('تمت أرشفة الملزمة'); }

renderAdsAdmin = function(){ adminContent.innerHTML=`<h2>اللوحة الإعلانية</h2><div class="form-grid"><input id="adTitle" placeholder="عنوان الإعلان"><input id="adText" placeholder="نص الإعلان"><button onclick="addAd()">إضافة إعلان</button></div>${db.banners.length?db.banners.map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${esc(x.text)}</small></div><div class="row-actions"><button class="secondary" onclick="editAd('${x.id}')">تعديل</button><button onclick="toggleAd('${x.id}',${x.active})">${x.active?'إيقاف':'تشغيل'}</button><button class="danger" onclick="deleteAd('${x.id}')">حذف</button></div></div>`).join(''):emptyState('لا توجد إعلانات')}`; }
async function editAd(id){ const x=db.banners.find(a=>a.id===id); if(!x)return; const title=prompt('عنوان الإعلان',x.title||''); if(title===null)return; const text=prompt('نص الإعلان',x.text||''); if(text===null)return; await update('banners',{title:title.trim(),text:text.trim()},{id}); await load(); renderAdsAdmin(); toast('تم تعديل الإعلان'); }
async function deleteAd(id){ if(!confirm('حذف الإعلان؟'))return; try{await removeRow('banners',{id}); await load(); renderAdsAdmin(); toast('تم حذف الإعلان')}catch(e){alert(e.message)} }

renderOrdersAdmin = function(){ const statusLabel={payment_pending:'بانتظار الدفع',paid:'مدفوع',processing:'قيد التجهيز',ready:'جاهز',completed:'مكتمل',cancelled:'ملغي'}; adminContent.innerHTML='<h2>الطلبات</h2>'+(db.orders.length?db.orders.map(x=>`<div class="row"><div><b>${esc(x.title)} × ${x.qty}</b><small>${esc(x.student_name)} — ${esc(x.student_phone||'')} — ${money(x.total)} د.ع — ${statusLabel[x.status]||statusLabel[x.payment_status]||esc(x.status||'')}</small></div><div class="row-actions">${x.payment_status==='payment_pending'?`<button onclick="devPay('${x.id}')">تأكيد الدفع</button>`:''}${x.payment_status==='paid'?`<button class="secondary" onclick="orderStatus('${x.id}','processing')">تجهيز</button><button onclick="orderStatus('${x.id}','ready')">جاهز</button><button onclick="orderStatus('${x.id}','completed')">مكتمل</button>`:''}<button class="danger" onclick="orderStatus('${x.id}','cancelled')">إلغاء</button></div></div>`).join(''):emptyState('لا توجد طلبات')); }
async function orderStatus(id,status){ await update('orders',{status},{id}); await audit('order','تحديث الطلب '+id+' إلى '+status); await load(); renderOrdersAdmin(); toast('تم تحديث الطلب'); }

const oldOpenPageV18 = openPage;
openPage = function(page){ oldOpenPageV18(page); if(page==='admin')setTimeout(()=>adminTab(activeAdminTab),0); }

/* ================= ALIN V19.2 CONNECTION FIX ================= */
/* ================= ALIN V19 ================= */
let cart = JSON.parse(localStorage.getItem('ALIN_CART')||'[]');
let v19Coupons=[], v19Notifications=[];
const v19OldLoad=load;
load=async function(){ await v19OldLoad(); if(sb){ try{ [v19Coupons,v19Notifications]=await Promise.all([query('coupons'),query('notifications')]); }catch(e){console.warn('V19 migration pending',e)} } applyBrand(); renderCartBadge(); renderAll(); };
function applyBrand(){ const n=db.settings.platform_name||'منصة آلين'; document.title=n; document.querySelectorAll('.brand b').forEach(x=>x.textContent=n.replace('منصة ','')); const hero=document.querySelector('.hero'); if(hero)hero.innerHTML=`<h2>${esc(db.settings.hero_title||n)}</h2><p>${esc(db.settings.hero_text||'')}</p>`; }
function cartSave(){localStorage.setItem('ALIN_CART',JSON.stringify(cart));renderCartBadge()}
function renderCartBadge(){ const n=cart.reduce((a,x)=>a+x.qty,0); if(window.cartCount)cartCount.textContent=n; if(window.cartSummary)cartSummary.textContent=n?`${n} مادة في السلة`:''; }
function addToCart(kind,id){ const item=kind==='booklet'?db.booklets.find(x=>x.id===id):db.products.find(x=>x.id===id); if(!item)return; if(kind!=='booklet' && +item.stock<=0)return alert('المنتج نافد'); const old=cart.find(x=>x.kind===kind&&x.id===id); if(old)old.qty++; else cart.push({kind,id,title:item.title||item.name,price:+item.price||0,qty:1}); cartSave(); toast('تمت الإضافة إلى السلة'); }
function cartQty(i,d){cart[i].qty=Math.max(1,cart[i].qty+d);cartSave();openCart()}
function cartRemove(i){cart.splice(i,1);cartSave();openCart()}
function openCart(){ checkoutItem={kind:'cart'}; const sub=cart.reduce((a,x)=>a+x.price*x.qty,0); checkoutBox.innerHTML=`<h2>سلة آلين</h2><div class="cart-list">${cart.map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b><small>${money(x.price)} د.ع</small></div><div class="row-actions"><button onclick="cartQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="cartQty(${i},1)">+</button><button class="danger" onclick="cartRemove(${i})">حذف</button></div></div>`).join('')||emptyState('السلة فارغة')}</div>${cart.length?`<div class="checkout-total">المجموع: <b>${money(sub)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="كود الخصم"><button onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الهاتف"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${db.accounts.libraries.filter(x=>x.status==='active').map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.area||'')}</option>`).join('')}</select><div id="libInfo"></div></div><button onclick="confirmCartCheckout()">تأكيد الطلب</button>`:''}`; checkoutModal.classList.remove('hidden'); }
function validCoupon(code){ const c=v19Coupons.find(x=>x.code.toUpperCase()===code.toUpperCase()&&x.status==='active'); if(!c)return null; if(c.expires_at&&new Date(c.expires_at)<new Date())return null; if(+c.max_uses>0&&+c.used_count>=+c.max_uses)return null; return c; }
function checkCoupon(){ const c=validCoupon(couponInput.value.trim()); couponMsg.textContent=c?`تم تطبيق كوبون ${c.code}`:'الكوبون غير صالح أو منتهي'; }
async function confirmCartCheckout(){ try{ if(!cart.length)throw Error('السلة فارغة'); if(!studentName.value.trim()||!studentPhone.value.trim()||!libSelect.value)throw Error('أكمل بيانات الطلب'); const coupon=validCoupon(couponInput?.value?.trim()||''); for(const x of cart){ const product=x.kind==='booklet'?null:db.products.find(p=>p.id===x.id); if(product&&+product.stock<x.qty)throw Error('الكمية غير متوفرة: '+x.title); let raw=x.price*x.qty,discount=0; if(coupon)discount=coupon.discount_type==='fixed'?Math.min(raw,+coupon.discount_value):Math.round(raw*(+coupon.discount_value/100)); const oid=uid('O'), num='AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10); await insert('orders',{id:oid,order_number:num,kind:x.kind,item_id:x.id,title:x.title,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),library_id:libSelect.value,qty:x.qty,unit_price:x.price,total:raw-discount,discount,coupon_code:coupon?.code||null,status:'new',payment_status:'payment_pending',status_history:[{status:'new',at:new Date().toISOString()}]}); } if(coupon)await update('coupons',{used_count:(+coupon.used_count||0)+1},{id:coupon.id}); await audit('order','إنشاء طلب سلة من '+cart.length+' مواد'); cart=[];cartSave();await load(); checkoutBox.innerHTML='<h2>تم استلام طلبك</h2><p>تم إنشاء الطلب بنجاح. احتفظ برقم هاتفك لمتابعة الطلب مع المكتبة.</p><button onclick="closeCheckout()">إغلاق</button>'; }catch(e){alert(e.message)} }

const v19Store=renderStore;
renderStore=function(){ v19Store(); if(!window.storeGrid)return; const items=storeItems(),q=(searchInput.value||'').toLowerCase(); const list=items.filter(x=>(!filterCategory.value||x.grade===filterCategory.value||x.subject===filterCategory.value)&&(!filterTeacher.value||x.teacher===filterTeacher.value)&&(`${x.title} ${x.teacher} ${x.subject}`).toLowerCase().includes(q)); storeGrid.innerHTML=list.map(x=>`<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:(x.subject||'منتج')}</div><h3>${esc(x.title)}</h3>${x.teacher?`<p>${esc(x.teacher)}</p>`:''}<p>${esc(x.grade||x.subject||'')}</p>${x.stock!==null?`<p class="${x.stock<=5?'low-stock':''}">${x.stock<=0?'نافد':`المخزون: ${x.stock}`}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')" ${x.stock===0?'disabled':''}>أضف للسلة</button><button class="secondary" onclick="openCheckout('${x.kind}','${x.id}')">شراء مباشر</button></div></article>`).join('')||emptyState('لا توجد مواد'); renderCartBadge(); };

const v19AdminTab=adminTab;
adminTab=function(t){ window.activeAdminTab=t; if(t==='coupons')return renderCouponsAdmin(); if(t==='notifications')return renderNotificationsAdmin(); return v19AdminTab(t); };
function renderCouponsAdmin(){adminContent.innerHTML=`<h2>الكوبونات</h2><div class="form-grid"><input id="cpCode" placeholder="الكود"><select id="cpType"><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option></select><input id="cpValue" type="number" placeholder="قيمة الخصم"><input id="cpMax" type="number" placeholder="عدد الاستخدامات، 0 بلا حد"><input id="cpExpiry" type="date"><button onclick="addCoupon()">إضافة كوبون</button></div>${v19Coupons.map(c=>`<div class="row"><div><b>${esc(c.code)}</b><small>${c.discount_type==='percent'?c.discount_value+'%':money(c.discount_value)+' د.ع'} — استخدام ${c.used_count||0}/${c.max_uses||'∞'}</small></div><div class="row-actions"><button onclick="toggleCoupon('${c.id}','${c.status==='active'?'disabled':'active'}')">${c.status==='active'?'إيقاف':'تشغيل'}</button><button class="danger" onclick="deleteCoupon('${c.id}')">حذف</button></div></div>`).join('')||emptyState('لا توجد كوبونات')}`}
async function addCoupon(){try{if(!cpCode.value.trim()||+cpValue.value<=0)throw Error('أكمل بيانات الكوبون');await insert('coupons',{id:uid('CP'),code:cpCode.value.trim().toUpperCase(),discount_type:cpType.value,discount_value:+cpValue.value,max_uses:+cpMax.value||0,expires_at:cpExpiry.value?new Date(cpExpiry.value).toISOString():null,status:'active'});await load();renderCouponsAdmin();toast('تمت إضافة الكوبون')}catch(e){alert(e.message)}}
async function toggleCoupon(id,status){await update('coupons',{status},{id});await load();renderCouponsAdmin()}
async function deleteCoupon(id){if(!confirm('حذف الكوبون؟'))return;await removeRow('coupons',{id});await load();renderCouponsAdmin()}
function renderNotificationsAdmin(){adminContent.innerHTML=`<h2>الإشعارات</h2><div class="form-grid"><select id="ntAudience"><option value="all">الجميع</option><option value="teacher">المدرسين</option><option value="library">المكتبات</option></select><input id="ntTitle" placeholder="العنوان"><input id="ntText" placeholder="نص الإشعار"><button onclick="sendNotification()">إرسال</button></div>${v19Notifications.map(n=>`<div class="row"><div><b>${esc(n.title)}</b><small>${esc(n.text||'')} — ${esc(n.audience)}</small></div><button class="danger" onclick="deleteNotification('${n.id}')">حذف</button></div>`).join('')||emptyState('لا توجد إشعارات')}`}
async function sendNotification(){if(!ntTitle.value.trim())return alert('اكتب عنوان الإشعار');await insert('notifications',{id:uid('N'),audience:ntAudience.value,title:ntTitle.value.trim(),text:ntText.value.trim(),status:'active'});await audit('notification','إرسال إشعار '+ntTitle.value);await load();renderNotificationsAdmin();toast('تم إرسال الإشعار')}
async function deleteNotification(id){await removeRow('notifications',{id});await load();renderNotificationsAdmin()}

adminStatsRender=function(){if(!window.adminStats)return;const today=new Date().toISOString().slice(0,10),month=today.slice(0,7),todayOrders=db.orders.filter(x=>(x.created_at||'').slice(0,10)===today),monthOrders=db.orders.filter(x=>(x.created_at||'').slice(0,7)===month),low=db.products.filter(x=>+x.stock<=+(x.low_stock_limit||db.settings.low_stock_default||5));adminStats.innerHTML=`<div><b>طلبات اليوم</b><span>${todayOrders.length}</span></div><div><b>مبيعات الشهر</b><span>${money(monthOrders.reduce((a,x)=>a+(+x.total||0),0))} د.ع</span></div><div><b>طلبات الشهر</b><span>${monthOrders.length}</span></div><div><b>مخزون منخفض</b><span>${low.length}</span><small class="metric-note">${low.slice(0,2).map(x=>esc(x.name)).join('، ')}</small></div>`;}
renderTeacher=function(){if(!window.teacherStats)return;const id=current?.role==='teacher'?current.id:'';const books=db.booklets.filter(x=>x.teacher_id===id),led=db.ledger.filter(x=>x.teacher_id===id),bookIds=new Set(books.map(x=>x.id)),orders=db.orders.filter(x=>bookIds.has(x.item_id));const notices=v19Notifications.filter(n=>n.status==='active'&&(n.audience==='all'||n.audience==='teacher'));teacherStats.innerHTML=`<div><b>ملازمي</b><span>${books.length}</span></div><div><b>الطلبات</b><span>${orders.length}</span></div><div><b>النسخ المطلوبة</b><span>${orders.reduce((a,x)=>a+(+x.qty||0),0)}</span></div><div><b>المستحقات</b><span>${money(led.reduce((a,x)=>a+(+x.teacher||0),0))} د.ع</span></div>`;teacherBooks.innerHTML=notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.text||'')}</div></div>`).join('')+books.map(x=>`<div class="row"><b>${esc(x.title)}</b><span class="status">${esc(x.status)}</span></div>`).join('');teacherSales.innerHTML=orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)}</b><small>${esc(x.title)} × ${x.qty}</small></div><span>${money(x.total)} د.ع</span></div>`).join('')||emptyState('لا توجد مبيعات');}
renderLibrary=function(){if(!window.libraryStats)return;const id=current?.role==='library'?current.id:'';const orders=db.orders.filter(x=>x.library_id===id),led=db.ledger.filter(x=>x.library_id===id),notices=v19Notifications.filter(n=>n.status==='active'&&(n.audience==='all'||n.audience==='library'));libraryStats.innerHTML=`<div><b>طلبات المكتبة</b><span>${orders.length}</span></div><div><b>الجديدة</b><span>${orders.filter(x=>x.status==='new').length}</span></div><div><b>الجاهزة</b><span>${orders.filter(x=>x.status==='ready').length}</span></div><div><b>المستحقات</b><span>${money(led.reduce((a,x)=>a+(+x.library||0),0))} د.ع</span></div>`;libraryPermits.innerHTML=notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.text||'')}</div></div>`).join('')+orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)} — ${esc(x.title)}</b><small>${esc(x.student_name)} • ${esc(x.student_phone||'')} • ×${x.qty}</small></div><div class="row-actions"><button onclick="libraryOrderStatus('${x.id}','processing')">استلام</button><button onclick="libraryOrderStatus('${x.id}','ready')">جاهز</button><button onclick="libraryOrderStatus('${x.id}','completed')">تسليم</button></div></div>`).join('')||emptyState('لا توجد طلبات');libraryHistory.innerHTML=orders.filter(x=>x.status==='completed').map(x=>`<div class="row"><b>${esc(x.order_number||x.id)}</b><span>${money(x.total)} د.ع</span></div>`).join('')||emptyState('لا يوجد سجل تسليم');}
async function libraryOrderStatus(id,status){const o=db.orders.find(x=>x.id===id);const h=[...(o?.status_history||[]),{status,at:new Date().toISOString()}];await update('orders',{status,status_history:h},{id});await audit('order','المكتبة حدثت '+id+' إلى '+status);await load()}
renderOrdersAdmin=function(){const labels={new:'جديد',payment_pending:'بانتظار الدفع',processing:'قيد التجهيز',ready:'جاهز',completed:'تم التسليم',cancelled:'ملغي'};adminContent.innerHTML='<h2>الطلبات</h2>'+(db.orders.length?db.orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)} — ${esc(x.title)} × ${x.qty}</b><small>${esc(x.student_name)} — ${money(x.total)} د.ع — ${labels[x.status]||esc(x.status||'')}</small><div class="timeline">${(x.status_history||[]).map(h=>`<span class="done">${labels[h.status]||esc(h.status)}</span>`).join('')}</div></div><div class="row-actions"><button onclick="orderStatus('${x.id}','processing')">تجهيز</button><button onclick="orderStatus('${x.id}','ready')">جاهز</button><button onclick="orderStatus('${x.id}','completed')">تسليم</button><button class="danger" onclick="orderStatus('${x.id}','cancelled')">إلغاء</button></div></div>`).join(''):emptyState('لا توجد طلبات'));}
orderStatus=async function(id,status){const o=db.orders.find(x=>x.id===id);const h=[...(o?.status_history||[]),{status,at:new Date().toISOString()}];await update('orders',{status,status_history:h},{id});if(status==='processing'&&o&&o.kind!=='booklet'){const p=db.products.find(x=>x.id===o.item_id);if(p&&!(o.status_history||[]).some(x=>x.status==='processing'))await update('products',{stock:Math.max(0,+p.stock-(+o.qty||0))},{id:p.id});}await audit('order','تحديث الطلب '+id+' إلى '+status);await load();renderOrdersAdmin();toast('تم تحديث الطلب');}
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

function libraryOptionsHtml(){
  return activeLibraries().map(x=>`<option value="${x.id}" ${libIsOpen(x)?'':'disabled'}>${esc(x.name)} — ${esc(x.area||'')} — ${libIsOpen(x)?'مفتوح':'مغلق'}</option>`).join('');
}
function librariesVisibleList(){
  return `<div class="lib-list">${activeLibraries().map(x=>`<div class="lib-choice ${libIsOpen(x)?'open':'closed'}"><b>${esc(x.name)}</b>${libIsOpen(x)?'<span class="open-badge">مفتوح</span>':'<span class="closed-badge">مغلق</span>'}<small>${esc(x.area||'')} — ${esc(x.landmark||'')}</small>${!libIsOpen(x)?`<small>${esc(x.open_note||'لا يستقبل طلبات حالياً')}</small>`:''}</div>`).join('')}</div>`;
}

function showLibInfo(){
  const lib=db.accounts.libraries.find(x=>x.id===libSelect.value);
  if(!lib){ libInfo.innerHTML=''; return; }
  libInfo.innerHTML=`<div class="notice"><b>${esc(lib.name)}</b> ${libIsOpen(lib)?'<span class="open-badge">مفتوح</span>':'<span class="closed-badge">مغلق</span>'}<div>${esc(lib.area||'')} — ${esc(lib.landmark||'')}</div><small>${esc(libStatusText(lib))}</small></div>`;
}

openCart=function(){
  checkoutItem={kind:'cart'}; const sub=cart.reduce((a,x)=>a+x.price*x.qty,0);
  checkoutBox.innerHTML=`<h2>سلة آلين</h2><div class="cart-list">${cart.map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b><small>${money(x.price)} د.ع</small></div><div class="row-actions"><button onclick="cartQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="cartQty(${i},1)">+</button><button class="danger" onclick="cartRemove(${i})">حذف</button></div></div>`).join('')||emptyState('السلة فارغة')}</div>${cart.length?`<div class="checkout-total">المجموع: <b>${money(sub)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="كود الخصم"><button onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><h3>مكتبات الاستلام</h3>${librariesVisibleList()}<div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الهاتف"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${libraryOptionsHtml()}</select><div id="libInfo"></div></div><button onclick="confirmCartCheckout()">تأكيد الطلب</button>`:''}`;
  checkoutModal.classList.remove('hidden');
};

openCheckout=function(kind,itemId){
  checkoutItem={kind,itemId};
  const item=kind==='booklet'?db.booklets.find(x=>x.id===itemId):db.products.find(x=>x.id===itemId);
  if(!item)return;
  const title=item.title||item.name, price=item.price||0;
  checkoutBox.innerHTML=`<h2>إتمام الشراء</h2><div class="row"><b>${esc(title)}</b><span>${money(price)} د.ع</span></div><h3>مكتبات الاستلام</h3>${librariesVisibleList()}<div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الطالب"><input id="qty" type="number" min="1" value="1" oninput="updateTotal()" placeholder="عدد النسخ"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر المكتبة</option>${libraryOptionsHtml()}</select><div id="libInfo" class="checkout-total"></div><div class="checkout-total">المجموع: <b id="totalBox">${money(price)} د.ع</b></div></div><h3>الدفع</h3><p>حالياً إنشاء الطلب ثم تأكيد دفع تطويري من الإدارة.</p><button onclick="confirmCheckout()">إنشاء الطلب</button><div id="payMsg"></div>`;
  checkoutModal.classList.remove('hidden');
};

const v21OldConfirmCheckout = confirmCheckout;
confirmCheckout = async function(){
  const lib=db.accounts.libraries.find(x=>x.id===libSelect?.value);
  if(lib && !libIsOpen(lib)) return alert('هذه المكتبة مغلقة حالياً. اختر مكتبة مفتوحة.');
  return v21OldConfirmCheckout();
};
const v21OldConfirmCartCheckout = confirmCartCheckout;
confirmCartCheckout = async function(){
  const lib=db.accounts.libraries.find(x=>x.id===libSelect?.value);
  if(lib && !libIsOpen(lib)) return alert('هذه المكتبة مغلقة حالياً. اختر مكتبة مفتوحة.');
  return v21OldConfirmCartCheckout();
};

renderLibrary=function(){
  if(!window.libraryStats)return;
  const id=current?.role==='library'?current.id:'';
  const lib=db.accounts.libraries.find(x=>x.id===id);
  const orders=db.orders.filter(x=>x.library_id===id), led=db.ledger.filter(x=>x.library_id===id), notices=v19Notifications.filter(n=>n.status==='active'&&(n.audience==='all'||n.audience==='library'));
  libraryStats.innerHTML=`<div><b>طلبات المكتبة</b><span>${orders.length}</span></div><div><b>الجديدة</b><span>${orders.filter(x=>x.status==='new').length}</span></div><div><b>الجاهزة</b><span>${orders.filter(x=>x.status==='ready').length}</span></div><div><b>المستحقات</b><span>${money(led.reduce((a,x)=>a+(+x.library||0),0))} د.ع</span></div>`;
  const statusBox=lib?`<div class="library-status-card ${libIsOpen(lib)?'open':'closed'}"><div><b>حالة المكتبة: </b><span class="${libIsOpen(lib)?'status-open':'status-closed'}">${libIsOpen(lib)?'مفتوحة':'مغلقة'}</span><small style="display:block">${esc(lib.open_note||'')}</small></div><div class="row-actions"><button onclick="setLibraryOpen(true)">مفتوح</button><button class="warning" onclick="setLibraryOpen(false)">مغلق</button></div></div>`:'';
  libraryPermits.innerHTML=statusBox+notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.text||'')}</div></div>`).join('')+orders.map(x=>{
    const b=x.kind==='booklet'?db.booklets.find(bb=>bb.id===x.item_id):null;
    return `<div class="row library-order-card"><div><b>${esc(x.order_number||x.id)} — ${esc(x.title)}</b><small>${esc(x.student_name)} • ${esc(x.student_phone||'')} • ×${x.qty} • ${money(x.total)} د.ع</small><div class="timeline">${(x.status_history||[]).map(h=>`<span class="done">${esc(h.status)}</span>`).join('')}</div></div><div class="row-actions">${b?.file_path?`<button onclick="openOrderPdf('${x.id}')">عرض PDF</button>`:''}<button onclick="libraryOrderStatus('${x.id}','processing')">استلام</button><button onclick="libraryOrderStatus('${x.id}','ready')">جاهز</button><button onclick="libraryOrderStatus('${x.id}','completed')">تسليم</button><button class="secondary" onclick="printReceipt('${x.id}')">وصل</button></div></div>`
  }).join('')||emptyState('لا توجد طلبات');
  libraryHistory.innerHTML=orders.filter(x=>x.status==='completed').map(x=>`<div class="row"><b>${esc(x.order_number||x.id)}</b><span>${money(x.total)} د.ع</span></div>`).join('')||emptyState('لا يوجد سجل تسليم');
};

async function setLibraryOpen(open){
  const id=current?.id; if(!id)return;
  let note='';
  if(!open){ note=prompt('اكتب سبب الغلق أو وقت الفتح', 'مغلق حالياً')||'مغلق حالياً'; }
  await update('accounts',{is_open:!!open,open_note:open?'':note},{id});
  await audit('library',open?'فتح المكتبة':'غلق المكتبة');
  await load(); toast(open?'تم فتح المكتبة':'تم غلق المكتبة');
}

async function ensureOrderFinancials(o){
  if(!o || db.ledger.some(x=>x.order_id===o.id)) return;
  let alin=Math.round((+o.total||0)*0.30), teacher=0, teacher_id='', library=0;
  if(o.kind==='booklet'){
    const b=db.booklets.find(x=>x.id===o.item_id);
    teacher_id=b?.teacher_id||''; teacher=Math.round((+o.total||0)*0.50); library=(+o.total||0)-alin-teacher;
    if(!db.permits.some(p=>p.order_id===o.id)) await insert('permits',{id:uid('P'),order_id:o.id,booklet_id:o.item_id,library_id:o.library_id,qty:o.qty,used:0,status:'active'});
  }else{ library=Math.round((+o.total||0)*0.10); alin=(+o.total||0)-library; }
  await insert('ledger',{id:uid('LG'),order_id:o.id,alin,teacher,teacher_id,library,library_id:o.library_id,settlement_status:'unsettled'});
}

libraryOrderStatus=async function(id,status){
  const o=db.orders.find(x=>x.id===id); if(!o)return;
  if(['processing','ready','completed'].includes(status)) await ensureOrderFinancials(o);
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h},{id});
  await audit('order','المكتبة حدثت '+id+' إلى '+status);
  await load();
};

const v21OldOrderStatus = orderStatus;
orderStatus=async function(id,status){
  const o=db.orders.find(x=>x.id===id);
  if(o && ['processing','ready','completed'].includes(status)) await ensureOrderFinancials(o);
  return v21OldOrderStatus(id,status);
};

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

const v21OldRenderAccountsAdmin = renderAccountsAdmin;
renderAccountsAdmin=function(){
  v21OldRenderAccountsAdmin();
  const libs=db.accounts.libraries;
  const old=adminContent.innerHTML;
  if(!old.includes('حالة المكتبات')){
    adminContent.innerHTML += `<h3>حالة المكتبات في المتجر</h3>${libs.map(x=>`<div class="row"><div><b>${esc(x.name)}</b><small>${esc(x.area||'')} — ${esc(x.landmark||'')}</small></div><span>${libIsOpen(x)?'مفتوح':'مغلق'} ${x.open_note?`— ${esc(x.open_note)}`:''}</span></div>`).join('')}`;
  }
};


/* ================= ALIN V22 TEACHER SYSTEM ================= */
db.teacherRequests = [];
db.teacherPayouts = [];
let activeTeacherTab = 'dashboard';

const v22Load = load;
load = async function(){
  await v22Load();
  if(sb){
    try{ db.teacherRequests = await query('teacher_requests'); }catch(e){ db.teacherRequests=[]; console.warn('تعذر تحميل طلبات المدرسين', e.message); }
    try{ db.teacherPayouts = await query('teacher_payouts'); }catch(e){ db.teacherPayouts=[]; }
  }
  const badge=document.querySelector('.version-badge'); if(badge) badge.textContent='منصة آلين';
  document.title=(db.settings.platform_name||'منصة آلين');
  renderAll();
};
document.addEventListener('DOMContentLoaded', function(){ setTimeout(load,150); });

function teacherData(){
  const id=current?.role==='teacher'?current.id:'';
  const teacher=db.accounts.teachers.find(x=>x.id===id)||{};
  const books=db.booklets.filter(x=>x.teacher_id===id);
  const bookIds=new Set(books.map(x=>x.id));
  const orders=db.orders.filter(x=>x.kind==='booklet' && bookIds.has(x.item_id));
  const ledger=db.ledger.filter(x=>x.teacher_id===id);
  const payouts=(db.teacherPayouts||[]).filter(x=>x.teacher_id===id);
  const requests=(db.teacherRequests||[]).filter(x=>x.teacher_id===id);
  return {id,teacher,books,bookIds,orders,ledger,payouts,requests};
}
function teacherTab(tab){ activeTeacherTab=tab; renderTeacher(); }
function bestTeacherBook(books,orders){
  let counts={}; orders.forEach(o=>counts[o.item_id]=(counts[o.item_id]||0)+(+o.qty||0));
  const best=books.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0))[0];
  return best?`${esc(best.title)} (${counts[best.id]||0} نسخة)`:'-';
}
function teacherAccountPaid(id){ return (db.teacherPayouts||[]).filter(x=>x.teacher_id===id && x.status==='paid').reduce((a,x)=>a+(+x.amount||0),0) + (db.withdrawals||[]).filter(x=>x.role==='teacher'&&x.account_id===id&&x.status==='paid').reduce((a,x)=>a+(+x.amount||0),0); }

renderTeacher=function(){
  if(!window.teacherStats || !window.teacherContent)return;
  const {id,teacher,books,orders,ledger,payouts,requests}=teacherData();
  const today=new Date().toISOString().slice(0,10), month=today.slice(0,7);
  const due=ledger.reduce((a,x)=>a+(+x.teacher||0),0), paid=teacherAccountPaid(id), remaining=Math.max(0,due-paid);
  const notices=(v19Notifications||[]).filter(n=>n.status==='active'&&(n.audience==='all'||n.audience==='teacher'));
  teacherStats.innerHTML=`<div><b>الملازم</b><span>${books.length}</span></div><div><b>طلبات اليوم</b><span>${orders.filter(x=>(x.created_at||'').slice(0,10)===today).length}</span></div><div><b>النسخ المباعة</b><span>${orders.reduce((a,x)=>a+(+x.qty||0),0)}</span></div><div><b>المتبقي</b><span>${money(remaining)} د.ع</span></div>`;
  let html='';
  if(notices.length) html += notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.text||'')}</div></div>`).join('');
  if(activeTeacherTab==='dashboard'){
    html += `<h3>الرئيسية</h3><div class="stats"><div><b>أرباح مستحقة</b><span>${money(due)} د.ع</span></div><div><b>مدفوع</b><span>${money(paid)} د.ع</span></div><div><b>هذا الشهر</b><span>${orders.filter(x=>(x.created_at||'').slice(0,7)===month).length}</span></div><div><b>أكثر ملزمة</b><span>${bestTeacherBook(books,orders)}</span></div></div>`;
  } else if(activeTeacherTab==='booklets'){
    html += `<h3>ملازمي المصممة من الإدارة</h3>${books.map(b=>{const qty=orders.filter(o=>o.item_id===b.id).reduce((a,o)=>a+(+o.qty||0),0);return `<div class="row"><div><b>${esc(b.title)}</b><small>${esc(b.subject||'')} — ${esc(b.grade||'')} — ${money(b.price)} د.ع — ${qty} نسخة</small></div><div class="row-actions">${b.file_path?`<button onclick="openTeacherPdf('${b.id}')">مشاهدة الملزمة</button>`:''}<span class="status">${esc(b.status||'')}</span></div></div>`}).join('')||emptyState('لا توجد ملازم')}`;
  } else if(activeTeacherTab==='orders'){
    html += `<h3>طلبات ملازمي</h3>${orders.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.id)} — ${esc(o.title)}</b><small>العدد ${o.qty} • المكتبة: ${esc((db.accounts.libraries.find(l=>l.id===o.library_id)||{}).name||'-')} • الحالة: ${esc(o.status||'')}</small></div><span>${money(o.total)} د.ع</span></div>`).join('')||emptyState('لا توجد طلبات')}`;
  } else if(activeTeacherTab==='finance'){
    html += `<h3>الأرباح والمستحقات</h3><div class="stats"><div><b>الإجمالي</b><span>${money(due)} د.ع</span></div><div><b>المدفوع</b><span>${money(paid)} د.ع</span></div><div><b>المتبقي</b><span>${money(remaining)} د.ع</span></div></div><div class="form-grid"><input id="tFrom" type="date"><input id="tTo" type="date"><button onclick="printTeacherStatement()">طباعة كشف حساب</button><input id="teacherWithdrawAmount" type="number" placeholder="مبلغ السحب"><button onclick="requestWithdraw('teacher')">طلب سحب</button></div>${ledger.map(x=>`<div class="row"><b>${esc(x.order_id)}</b><span>${money(x.teacher)} د.ع</span></div>`).join('')||emptyState('لا توجد أرباح مسجلة')}`;
  } else if(activeTeacherTab==='requests'){
    html += `<h3>طلب إضافة ملزمة</h3><p>ارفع طلب الملزمة للإدارة. الإدارة تصممها وتراجعها ثم ترفع النسخة النهائية في صفحة المدرس للمشاهدة فقط.</p><form id="teacherRequestForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><input name="subject" placeholder="المادة"><input name="grade" placeholder="المرحلة/الصف"><textarea name="note" placeholder="تفاصيل إضافية للإدارة"></textarea><label>ملف أولي اختياري PDF<input name="source" type="file" accept=".pdf"></label><button type="button" onclick="sendTeacherBookRequest()">إرسال الطلب</button></form><h3>طلباتي</h3>${requests.map(r=>`<div class="row"><div><b>${esc(r.title)}</b><small>${esc(r.subject||'')} — ${esc(r.grade||'')} — ${esc(r.status||'')}</small></div></div>`).join('')||emptyState('لا توجد طلبات')}`;
  } else if(activeTeacherTab==='profile'){
    html += `<h3>ملف المدرس</h3><div class="form-grid"><input id="tpPhone" value="${esc(teacher.phone||'')}" placeholder="رقم الهاتف"><input id="tpSpecialty" value="${esc(teacher.specialty||'')}" placeholder="الاختصاص"><textarea id="tpBio" placeholder="نبذة قصيرة">${esc(teacher.bio||'')}</textarea><label>الصورة الشخصية<input id="tpAvatar" type="file" accept="image/*"></label><button onclick="saveTeacherProfile()">حفظ الملف</button></div><p class="print-only-note">الاسم وربط الملازم يتحكم بهما المدير فقط.</p>`;
  }
  teacherContent.innerHTML=html;
};

function isMissingTableError(e, tableName){
  const msg=String(e?.message||e||'');
  return msg.includes(tableName) && (msg.includes('Could not find the table') || msg.includes('schema cache') || msg.includes('does not exist'));
}

async function sendTeacherBookRequest(){
  try{
    const f=new FormData(teacherRequestForm);
    if(!String(f.get('title')||'').trim()) throw Error('اكتب اسم الملزمة');
    const sourceFile=f.get('source');
    const path=sourceFile&&sourceFile.name?await uploadFile('teacher-requests',sourceFile,{type:'pdf'}):'';
    await insert('teacher_requests',{id:uid('TR'),teacher_id:current.id,teacher_name:current.name,title:String(f.get('title')).trim(),subject:String(f.get('subject')||''),grade:String(f.get('grade')||''),note:String(f.get('note')||''),source_file_path:path||'',source_file_name:sourceFile?.name||'',status:'new'});
    await audit('teacher_request','طلب ملزمة من '+current.name);
    await load(); activeTeacherTab='requests'; renderTeacher(); toast('تم إرسال الطلب للإدارة');
  }catch(e){
    console.warn('teacher request error', e);
    if(isMissingTableError(e,'teacher_requests')){
      alert('تعذر إرسال طلب الملزمة حالياً. يرجى المحاولة مرة أخرى بعد قليل.');
      return;
    }
    alert('تعذر إرسال الطلب حالياً. تأكد من الاتصال واكتمال البيانات ثم حاول مرة أخرى.');
  }
}
async function saveTeacherProfile(){
  try{
    const avatar=tpAvatar.files&&tpAvatar.files[0]?await uploadFile('teachers',tpAvatar.files[0],{type:'image'}):(teacherData().teacher.avatar_path||'');
    await update('accounts',{phone:tpPhone.value.trim(),specialty:tpSpecialty.value.trim(),bio:tpBio.value.trim(),avatar_path:avatar},{id:current.id});
    await audit('teacher','تحديث ملف مدرس'); await load(); toast('تم حفظ ملف المدرس');
  }catch(e){alert(e.message)}
}
async function openTeacherPdf(bookletId){
  const b=db.booklets.find(x=>x.id===bookletId); if(!b?.file_path)return alert('لا يوجد ملف PDF لهذه الملزمة');
  const cleanUrl=mediaUrl(b.file_path);
  checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="pdf-viewer"><div class="pdf-loading">جاري فتح الملزمة...</div></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
  const ok=await checkPublicFile(cleanUrl);
  if(!ok){
    checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="empty-state"><b>تعذر فتح ملف الملزمة</b><p>الملف القديم غير مرتبط بالتخزين الحالي. احذف الملزمة من لوحة المدير وارفع ملف PDF من جديد.</p></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    return;
  }
  const url=cleanUrl+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="pdf-guard"><div class="watermark">${esc(current?.name||'منصة آلين')} — مشاهدة فقط</div><iframe src="${url}" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
}
function printTeacherStatement(){
  const {teacher,ledger}=teacherData();
  const from=tFrom.value, to=tTo.value;
  const rows=ledger.filter(x=>(!from||(x.created_at||'').slice(0,10)>=from)&&(!to||(x.created_at||'').slice(0,10)<=to));
  checkoutBox.innerHTML=`<div class="receipt"><h2>كشف حساب المدرس</h2><p>${esc(teacher.name||current.name)}</p>${rows.map(x=>`<div class="receipt-line"><b>${esc(x.order_id)}</b><span>${money(x.teacher)} د.ع</span></div>`).join('')}<h3>المجموع: ${money(rows.reduce((a,x)=>a+(+x.teacher||0),0))} د.ع</h3></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
}

const v22AdminTab = adminTab;
adminTab=function(t){ window.activeAdminTab=t; if(t==='teacherRequests')return renderTeacherRequestsAdmin(); return v22AdminTab(t); };
function renderTeacherRequestsAdmin(){
  const list=db.teacherRequests||[];
  adminContent.innerHTML=`<h2>طلبات المدرسين للملازم</h2>${list.map(r=>`<div class="row"><div><b>${esc(r.title)}</b><small>${esc(r.teacher_name||teacherName(r.teacher_id))} — ${esc(r.subject||'')} — ${esc(r.grade||'')} — ${esc(r.status||'')}</small><p>${esc(r.note||'')}</p></div><div class="row-actions">${r.source_file_path?`<button onclick="openTeacherRequestSource('${r.id}')">عرض الملف الأولي</button>`:''}<button onclick="teacherRequestStatus('${r.id}','designing')">قيد التصميم</button><button onclick="teacherRequestStatus('${r.id}','ready')">جاهزة</button><button class="danger" onclick="teacherRequestStatus('${r.id}','rejected')">رفض</button></div></div>`).join('')||emptyState('لا توجد طلبات')}`;
}
async function teacherRequestStatus(id,status){ await update('teacher_requests',{status},{id}); await audit('teacher_request','تحديث طلب مدرس '+id+' إلى '+status); await load(); renderTeacherRequestsAdmin(); }
function openTeacherRequestSource(id){
  const r=(db.teacherRequests||[]).find(x=>x.id===id); if(!r?.source_file_path)return;
  checkoutBox.innerHTML=`<h2>الملف الأولي من المدرس</h2><div class="pdf-viewer"><iframe src="${mediaUrl(r.source_file_path)}#toolbar=0&navpanes=0&scrollbar=1"></iframe></div><button onclick="closeCheckout()">إغلاق</button>`; checkoutModal.classList.remove('hidden');
}
function addTeacherPayoutPrompt(teacherId){
  const amount=+(prompt('مبلغ الدفع للمدرس')||0); if(amount<=0)return;
  insert('teacher_payouts',{id:uid('TP'),teacher_id:teacherId,amount,note:'تسديد من الإدارة',status:'paid'}).then(load);
}

const v22RenderFinanceAdmin = renderFinanceAdmin;
renderFinanceAdmin=function(){
  v22RenderFinanceAdmin();
  adminContent.innerHTML += `<h3>تسديد مستحقات المدرسين</h3>${db.accounts.teachers.map(t=>`<div class="row"><div><b>${esc(t.name)}</b><small>المستحق: ${money(db.ledger.filter(x=>x.teacher_id===t.id).reduce((a,x)=>a+(+x.teacher||0),0))} د.ع — المدفوع: ${money(teacherAccountPaid(t.id))} د.ع</small></div><button onclick="addTeacherPayoutPrompt('${t.id}')">تسجيل دفعة</button></div>`).join('')}`;
};


/* ================= ALIN V23 MALZAMA STORE DISPLAY ================= */
const ALIN_VERSION = 'V23 Malzama';
function teacherObj(id){ return (db.accounts?.teachers||[]).find(x=>x.id===id)||{}; }
function teacherPhoneForBooklet(b){ return b.teacher_phone || teacherObj(b.teacher_id).phone || ''; }
function teacherImageForBooklet(b){ return b.teacher_image_path || teacherObj(b.teacher_id).avatar_path || b.cover_path || ''; }

storeItems=function(){
  if(db.settings.storeType==='booklet'){
    return (db.booklets||[]).filter(x=>x.status==='published').map(x=>({
      kind:'booklet',id:x.id,title:x.title,subject:x.subject,grade:x.grade,
      teacher:teacherName(x.teacher_id),teacher_id:x.teacher_id,teacher_phone:teacherPhoneForBooklet(x),
      teacher_image:teacherImageForBooklet(x),price:x.price,cover:x.cover_path,stock:null,pdf_hidden:true
    }));
  }
  return (db.products||[]).filter(x=>x.type===db.settings.storeType&&x.status==='published').map(x=>({kind:x.type,id:x.id,title:x.name,subject:x.category,grade:x.category,teacher:'',price:x.price,cover:x.image_path,stock:x.stock}));
};

renderStore=function(){
  if(!window.storeGrid || !db.booklets)return;
  bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join('');
  const items=storeItems(), q=(searchInput.value||'').toLowerCase();
  const cats=[...new Set(items.map(x=>x.grade||x.subject).filter(Boolean))], teachers=[...new Set(items.map(x=>x.teacher).filter(Boolean))];
  const oldCat=filterCategory.value, oldTeacher=filterTeacher.value;
  filterCategory.innerHTML='<option value="">كل الأقسام</option>'+cats.map(x=>`<option ${x===oldCat?'selected':''}>${esc(x)}</option>`).join('');
  filterTeacher.style.display=db.settings.storeType==='booklet'?'':'none';
  filterTeacher.innerHTML='<option value="">كل المدرسين</option>'+teachers.map(x=>`<option ${x===oldTeacher?'selected':''}>${esc(x)}</option>`).join('');
  const list=items.filter(x=>(!filterCategory.value||x.grade===filterCategory.value||x.subject===filterCategory.value)&&(!filterTeacher.value||x.teacher===filterTeacher.value)&&(`${x.title} ${x.teacher} ${x.subject} ${x.teacher_phone||''}`).toLowerCase().includes(q));
  storeGrid.innerHTML=list.map(x=>{
    if(x.kind==='booklet'){
      const img=x.teacher_image?`<img src="${mediaUrl(x.teacher_image)}" alt="">`:`<div class="avatar-fallback">${esc((x.teacher||'م')[0])}</div>`;
      return `<article class="card booklet-card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:esc(x.subject||'ملزمة')}</div><h3>${esc(x.title)}</h3><div class="teacher-card-mini">${img}<div><b>${esc(x.teacher||'مدرس')}</b><small class="store-teacher-phone">${esc(x.teacher_phone||'بدون رقم')}</small></div></div><p>${esc(x.grade||x.subject||'')}</p><div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')">أضف للسلة</button><button class="secondary" onclick="openCheckout('${x.kind}','${x.id}')">شراء مباشر</button></div></article>`;
    }
    return `<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:(esc(x.subject||'منتج'))}</div><h3>${esc(x.title)}</h3><p>${esc(x.grade||x.subject||'')}</p>${x.stock!==null?`<p class="${x.stock<=5?'low-stock':''}">${x.stock<=0?'نافد':`المخزون: ${x.stock}`}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')" ${x.stock===0?'disabled':''}>أضف للسلة</button><button class="secondary" onclick="openCheckout('${x.kind}','${x.id}')">شراء مباشر</button></div></article>`;
  }).join('')||emptyState('لا توجد مواد');
  renderCartBadge();
};

renderBookletsAdmin=function(){
  adminContent.innerHTML=`<h2>الملازم</h2><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${db.accounts.teachers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="grade" placeholder="الصف"><input name="teacherPhone" placeholder="رقم موبايل المدرس"><input name="price" type="number" placeholder="السعر"><label>غلاف الملزمة<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF للمكتبة فقط<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBookletV23()">رفع ونشر</button></form>${db.booklets.map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${esc(teacherName(x.teacher_id))} — ${esc(x.teacher_phone||teacherObj(x.teacher_id).phone||'')} — ${esc(x.file_name||'')} — ${esc(x.status)}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button class="danger" onclick="setBookStatus('${x.id}','archived')">أرشفة</button></div></div>`).join('')}`;
};
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

async function openLibraryBookletPdf(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  if(!o || o.kind!=='booklet') return alert('هذا الطلب لا يحتوي ملزمة PDF');
  const b=(db.booklets||[]).find(x=>x.id===o.item_id);
  if(!b?.file_path) return alert('لا يوجد ملف PDF لهذه الملزمة');
  const cleanUrl=mediaUrl(b.file_path);
  checkoutBox.innerHTML=`<h2>PDF الملزمة للمكتبة</h2><div class="print-only-note">جاري فحص رابط الملف...</div><div class="pdf-viewer loading-box">انتظر قليلاً</div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
  const ok=await checkPublicFile(cleanUrl);
  if(!ok){
    checkoutBox.innerHTML=`<h2>ملف الملزمة غير متاح</h2><div class="print-only-note">رابط الملف القديم غير صالح أو الملف غير مرفوع داخل alin-files. احذف الملزمة من لوحة المدير وارفع ملف PDF الحقيقي من جديد.</div><div class="empty">لن تظهر رسالة Bucket not found بعد الآن، لكن يجب إعادة رفع الملف الصحيح.</div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    return;
  }
  const url=cleanUrl+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>PDF الملزمة للمكتبة</h2><div class="print-only-note">هذا الملف يظهر للمكتبة فقط لغرض الطباعة. لا يظهر في المتجر للطالب.</div><div class="pdf-viewer"><iframe id="pdfFrame" src="${url}" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button onclick="printPdfFrame()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
}

renderLibrary=function(){
  if(!window.libraryStats)return;
  const id=current?.role==='library'?current.id:'';
  const orders=(db.orders||[]).filter(x=>x.library_id===id),led=(db.ledger||[]).filter(x=>x.library_id===id),notices=(v19Notifications||[]).filter(n=>n.status==='active'&&(n.audience==='all'||n.audience==='library'));
  libraryStats.innerHTML=`<div><b>طلبات المكتبة</b><span>${orders.length}</span></div><div><b>الجديدة</b><span>${orders.filter(x=>x.status==='new').length}</span></div><div><b>الجاهزة</b><span>${orders.filter(x=>x.status==='ready').length}</span></div><div><b>المستحقات</b><span>${money(led.reduce((a,x)=>a+(+x.library||0),0))} د.ع</span></div>`;
  libraryPermits.innerHTML=notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.text||'')}</div></div>`).join('')+orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)} — ${esc(x.title)}</b><small>${esc(x.student_name)} • ${esc(x.student_phone||'')} • ×${x.qty} • ${esc(x.status||'')}</small></div><div class="row-actions">${x.kind==='booklet'?`<button class="library-pdf-btn" onclick="openLibraryBookletPdf('${x.id}')">عرض PDF</button>`:''}<button onclick="libraryOrderStatus('${x.id}','processing')">استلام</button><button onclick="libraryOrderStatus('${x.id}','ready')">جاهز</button><button onclick="libraryOrderStatus('${x.id}','completed')">تسليم</button><button class="secondary" onclick="printOrderReceipt('${x.id}')">وصل</button></div></div>`).join('')||emptyState('لا توجد طلبات');
  libraryHistory.innerHTML=orders.filter(x=>x.status==='completed').map(x=>`<div class="row"><b>${esc(x.order_number||x.id)}</b><span>${money(x.total)} د.ع</span></div>`).join('')||emptyState('لا يوجد سجل تسليم');
};

function printOrderReceipt(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  const lib=(db.accounts.libraries||[]).find(l=>l.id===o.library_id)||{};
  checkoutBox.innerHTML=`<div class="receipt"><h2>وصل طلب منصة آلين</h2><p>المكتبة: ${esc(lib.name||'-')} — ${esc(lib.area||'')}</p><div class="receipt-line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div><div class="receipt-line"><b>الطالب</b><span>${esc(o.student_name)}</span></div><div class="receipt-line"><b>المادة</b><span>${esc(o.title)} × ${o.qty}</span></div><div class="receipt-line"><b>الإجمالي</b><span>${money(o.total)} د.ع</span></div></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
}

/* ================= ALIN V24 FINANCIAL LEDGER ================= */
window.ALIN_VERSION='V25 Library Settlements';
let financialEntries=[], financialPayouts=[], financialReturns=[];
const v24OldLoad=load;
load=async function(){
  await v24OldLoad();
  if(sb){ try{ [financialEntries,financialPayouts,financialReturns]=await Promise.all([query('financial_entries'),query('financial_payouts'),query('financial_returns')]); }catch(e){ console.warn('V24 migration pending',e); } }
  adminStatsRender();
};
function partyPaid(role,id){ return financialPayouts.filter(x=>x.party_role===role&&x.party_id===id&&x.status==='paid').reduce((a,x)=>a+(+x.amount||0),0); }
function partyEarned(role,id){ const key=role==='teacher'?'teacher_amount':'library_amount', idkey=role+'_id'; return financialEntries.filter(x=>x[idkey]===id).reduce((a,x)=>a+(+x[key]||0),0); }
function calcDistribution(o){
  const gross=+o.total||0, qty=+o.qty||1;
  if(o.kind!=='booklet') return {platform:gross,teacher:0,library:0,teacher_id:'',mode:'platform_only',snapshot:{platform:gross}};
  const b=db.booklets.find(x=>x.id===o.item_id)||{}, mode=b.distribution_mode||'fixed';
  let teacher=0,library=0;
  if(mode==='percent'){ teacher=Math.round(gross*(+b.teacher_share||0)/100); library=Math.round(gross*(+b.library_share||0)/100); }
  else { teacher=(+b.teacher_share||0)*qty; library=(+b.library_share||0)*qty; }
  if(!b.teacher_share&&!b.library_share){ teacher=Math.round(gross*.5); library=Math.round(gross*.2); }
  const platform=Math.max(0,gross-teacher-library);
  return {platform,teacher,library,teacher_id:b.teacher_id||'',mode,snapshot:{mode,teacher_share:+b.teacher_share||0,library_share:+b.library_share||0,price:+b.price||0,qty}};
}
ensureOrderFinancials=async function(o){
  if(!o || o.status!=='completed' || financialEntries.some(x=>x.order_id===o.id&&x.entry_type==='sale')) return;
  const d=calcDistribution(o);
  await insert('financial_entries',{id:uid('FE'),order_id:o.id,order_number:o.order_number||o.id,entry_type:'sale',kind:o.kind,item_id:o.item_id,title:o.title,qty:+o.qty||1,gross:+o.total||0,platform_amount:d.platform,teacher_amount:d.teacher,library_amount:d.library,teacher_id:d.teacher_id,library_id:o.library_id||'',distribution_mode:d.mode,distribution_snapshot:d.snapshot,note:'تسوية تلقائية عند تم التسليم'});
  if(o.kind==='booklet'&&!db.permits.some(p=>p.order_id===o.id)) await insert('permits',{id:uid('P'),order_id:o.id,booklet_id:o.item_id,library_id:o.library_id,qty:o.qty,used:0,status:'active'});
};
libraryOrderStatus=async function(id,status){
  const o=db.orders.find(x=>x.id===id); if(!o)return;
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h},{id});
  o.status=status; o.status_history=h;
  if(status==='completed') await ensureOrderFinancials(o);
  await audit('order','المكتبة غيرت حالة الطلب '+(o.order_number||id)+' إلى '+status); await load(); renderLibrary();
};
async function saveBookDistribution(id){
  const mode=document.getElementById('distMode_'+id).value, teacher=+document.getElementById('tShare_'+id).value||0, library=+document.getElementById('lShare_'+id).value||0;
  if(mode==='percent'&&teacher+library>100)return alert('مجموع النسب لا يجوز أن يتجاوز 100%');
  await update('booklets',{distribution_mode:mode,teacher_share:teacher,library_share:library},{id}); await audit('finance','تعديل توزيع أرباح الملزمة '+id); await load(); renderFinanceAdmin();
}
async function recordPayout(role,id){
  const earned=partyEarned(role,id),paid=partyPaid(role,id),remaining=earned-paid;
  const amount=+(prompt('المتبقي '+money(remaining)+' د.ع\nاكتب مبلغ الدفعة')||0); if(amount<=0||amount>remaining)return alert('مبلغ الدفعة غير صحيح أو أكبر من المستحق');
  const method=prompt('طريقة الدفع: نقدي / تحويل / زين كاش / آسيا حوالة','نقدي')||'نقدي', note=prompt('تفاصيل الدفعة','')||'';
  const voucher='PV-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
  await insert('financial_payouts',{id:uid('FP'),voucher_number:voucher,party_role:role,party_id:id,amount,payment_method:method,note,status:'paid'}); await audit('finance','سند صرف '+voucher); await load(); renderFinanceAdmin(); alert('تم تسجيل سند الصرف '+voucher);
}
async function reversePayout(id){
  const p=financialPayouts.find(x=>x.id===id); if(!p||p.status!=='paid'||!confirm('إنشاء قيد عكسي لهذه الدفعة؟'))return;
  await update('financial_payouts',{status:'reversed'},{id}); await insert('financial_payouts',{id:uid('FP'),voucher_number:'RV-'+Date.now(),party_role:p.party_role,party_id:p.party_id,amount:p.amount,payment_method:p.payment_method,note:'قيد عكسي للسند '+p.voucher_number,status:'reversal',reversal_of:p.id}); await audit('finance','عكس سند '+p.voucher_number); await load(); renderFinanceAdmin();
}
async function returnOrder(orderId){
  const e=financialEntries.find(x=>x.order_id===orderId&&x.entry_type==='sale'); if(!e)return alert('لا يوجد قيد بيع نهائي لهذا الطلب');
  if(financialEntries.some(x=>x.reversed_entry_id===e.id))return alert('تم تسجيل مرتجع لهذا الطلب سابقاً');
  const reason=prompt('سبب المرتجع')||'مرتجع';
  await insert('financial_entries',{id:uid('FE'),order_id:e.order_id,order_number:e.order_number,entry_type:'return',kind:e.kind,item_id:e.item_id,title:e.title,qty:e.qty,gross:-Math.abs(+e.gross),platform_amount:-Math.abs(+e.platform_amount),teacher_amount:-Math.abs(+e.teacher_amount),library_amount:-Math.abs(+e.library_amount),teacher_id:e.teacher_id,library_id:e.library_id,distribution_mode:e.distribution_mode,distribution_snapshot:e.distribution_snapshot,note:reason,reversed_entry_id:e.id});
  await insert('financial_returns',{id:uid('FR'),order_id:e.order_id,entry_id:e.id,amount:e.gross,reason}); await audit('finance','مرتجع الطلب '+e.order_number); await load(); renderFinanceAdmin();
}
renderFinanceAdmin=function(){
  const sales=financialEntries.reduce((a,x)=>a+(+x.gross||0),0), platform=financialEntries.reduce((a,x)=>a+(+x.platform_amount||0),0), teachers=financialEntries.reduce((a,x)=>a+(+x.teacher_amount||0),0), libraries=financialEntries.reduce((a,x)=>a+(+x.library_amount||0),0);
  let html=`<h2>V25 — الدفتر المالي وتسويات المكتبات</h2><div class="stats"><div><b>صافي المبيعات</b><span>${money(sales)} د.ع</span></div><div><b>حصة المنصة</b><span>${money(platform)} د.ع</span></div><div><b>مستحقات المدرسين</b><span>${money(teachers)} د.ع</span></div><div><b>مستحقات المكتبات</b><span>${money(libraries)} د.ع</span></div></div>`;
  html+=`<h3>توزيع أرباح الملازم</h3>`+(db.booklets.map(b=>`<div class="row"><div><b>${esc(b.title)}</b><small>ثابت = مبلغ لكل نسخة، نسبة = من إجمالي الطلب</small></div><div class="row-actions"><select id="distMode_${b.id}"><option value="fixed" ${b.distribution_mode!=='percent'?'selected':''}>مبلغ ثابت</option><option value="percent" ${b.distribution_mode==='percent'?'selected':''}>نسبة %</option></select><input id="tShare_${b.id}" type="number" value="${+b.teacher_share||0}" placeholder="المدرس"><input id="lShare_${b.id}" type="number" value="${+b.library_share||0}" placeholder="المكتبة"><button onclick="saveBookDistribution('${b.id}')">حفظ</button></div></div>`).join('')||emptyState('لا توجد ملازم'));
  html+=`<h3>قيود المبيعات والمرتجعات</h3>`+(financialEntries.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).map(x=>`<div class="row"><div><b>${esc(x.order_number||x.order_id)} — ${x.entry_type==='return'?'مرتجع':'بيع مكتمل'}</b><small>${esc(x.title||'')} × ${x.qty} | منصة ${money(x.platform_amount)} | مدرس ${money(x.teacher_amount)} | مكتبة ${money(x.library_amount)}</small></div>${x.entry_type==='sale'?`<button class="danger" onclick="returnOrder('${x.order_id}')">تسجيل مرتجع</button>`:''}</div>`).join('')||emptyState('لا توجد قيود مالية نهائية'));
  html+=`<h3>مستحقات المدرسين</h3>`+db.accounts.teachers.map(t=>{const e=partyEarned('teacher',t.id),p=partyPaid('teacher',t.id);return `<div class="row"><div><b>${esc(t.name)}</b><small>مستحق ${money(e)} — مدفوع ${money(p)} — متبقي ${money(e-p)}</small></div><button onclick="recordPayout('teacher','${t.id}')">تسجيل دفعة</button></div>`}).join('');
  html+=`<h3>مستحقات المكتبات</h3>`+db.accounts.libraries.map(l=>{const e=partyEarned('library',l.id),p=partyPaid('library',l.id);return `<div class="row"><div><b>${esc(l.name)}</b><small>مستحق ${money(e)} — مدفوع ${money(p)} — متبقي ${money(e-p)}</small></div><button onclick="recordPayout('library','${l.id}')">تسجيل دفعة</button></div>`}).join('');
  html+=`<h3>سندات الصرف</h3>`+(financialPayouts.filter(x=>x.status==='paid').map(x=>`<div class="row"><div><b>${esc(x.voucher_number)}</b><small>${x.party_role==='teacher'?'مدرس':'مكتبة'} — ${money(x.amount)} د.ع — ${esc(x.payment_method)}</small></div><button class="danger" onclick="reversePayout('${x.id}')">قيد عكسي</button></div>`).join('')||emptyState('لا توجد سندات صرف'));
  adminContent.innerHTML=html;
};
adminStatsRender=function(){ if(!window.adminStats)return; const platform=financialEntries.reduce((a,x)=>a+(+x.platform_amount||0),0); adminStats.innerHTML=`<div><b>الحسابات</b><span>${db.accounts.teachers.length+db.accounts.libraries.length}</span></div><div><b>الملازم</b><span>${db.booklets.length}</span></div><div><b>الطلبات</b><span>${db.orders.length}</span></div><div><b>صافي حصة آلين</b><span>${money(platform)} د.ع</span></div>`; };


/* ================= ALIN V25 LIBRARY SETTLEMENTS ================= */
window.ALIN_VERSION='V25 Library Settlements';
let librarySettlements=[];
const v25OldLoad=load;
load=async function(){
  await v25OldLoad();
  if(sb){ try{ librarySettlements=await query('library_settlements'); }catch(e){ console.warn('V25 migration pending',e); librarySettlements=[]; } }
  adminStatsRender();
};
function libDebt(id){
  const owed=financialEntries.filter(x=>x.library_id===id).reduce((a,x)=>a+(+x.platform_amount||0)+(+x.teacher_amount||0),0);
  const paid=librarySettlements.filter(x=>x.library_id===id&&x.status!=='reversed'&&x.status!=='reversal').reduce((a,x)=>a+(+x.amount||0),0);
  return {owed,paid,remaining:owed-paid};
}
function settlementNo(){return 'RC-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase();}
async function recordLibrarySettlement(libraryId){
  const lib=(db.accounts.libraries||[]).find(x=>x.id===libraryId); if(!lib)return;
  const d=libDebt(libraryId);
  const amount=+(prompt('المتبقي على '+lib.name+' هو '+money(d.remaining)+' د.ع\nاكتب مبلغ التسوية المستلم من المكتبة')||0);
  if(amount<=0||amount>d.remaining)return alert('المبلغ غير صحيح أو أكبر من المتبقي');
  const method=prompt('طريقة الاستلام: نقدي / تحويل / زين كاش / آسيا حوالة','نقدي')||'نقدي';
  const periodFrom=prompt('من تاريخ اختياري YYYY-MM-DD','')||'';
  const periodTo=prompt('إلى تاريخ اختياري YYYY-MM-DD','')||'';
  const note=prompt('تفاصيل','')||'';
  const receipt=settlementNo();
  await insert('library_settlements',{id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,payment_method:method,period_from:periodFrom||null,period_to:periodTo||null,note,status:'received'});
  await audit('settlement','سند قبض تسوية مكتبة '+receipt);
  await load(); renderFinanceAdmin(); alert('تم تسجيل سند القبض '+receipt);
}
async function reverseLibrarySettlement(id){
  const s=librarySettlements.find(x=>x.id===id); if(!s||s.status==='reversed'||!confirm('إنشاء قيد عكسي لسند القبض؟'))return;
  await update('library_settlements',{status:'reversed'},{id});
  await insert('library_settlements',{id:uid('LS'),receipt_number:'RV-'+Date.now(),library_id:s.library_id,amount:s.amount,payment_method:s.payment_method,period_from:s.period_from,period_to:s.period_to,note:'قيد عكسي للسند '+s.receipt_number,status:'reversal',reversal_of:s.id});
  await audit('settlement','عكس سند قبض '+s.receipt_number);
  await load(); renderFinanceAdmin();
}
function printLibrarySettlement(id){
  const s=librarySettlements.find(x=>x.id===id); if(!s)return;
  const lib=(db.accounts.libraries||[]).find(x=>x.id===s.library_id)||{};
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px"><h2>سند قبض تسوية مكتبة</h2><p><b>رقم السند:</b> ${esc(s.receipt_number)}</p><p><b>المكتبة:</b> ${esc(lib.name||'')}</p><p><b>المبلغ:</b> ${money(s.amount)} د.ع</p><p><b>طريقة الاستلام:</b> ${esc(s.payment_method||'')}</p><p><b>الفترة:</b> ${esc(s.period_from||'-')} إلى ${esc(s.period_to||'-')}</p><p><b>تفاصيل:</b> ${esc(s.note||'')}</p><hr><p>توقيع الإدارة: ____________</p><p>توقيع المكتبة: ____________</p></div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}
function settlementRowsForLibrary(id){
  const entries=financialEntries.filter(x=>x.library_id===id);
  const gross=entries.reduce((a,x)=>a+(+x.gross||0),0);
  const libShare=entries.reduce((a,x)=>a+(+x.library_amount||0),0);
  const platform=entries.reduce((a,x)=>a+(+x.platform_amount||0),0);
  const teacher=entries.reduce((a,x)=>a+(+x.teacher_amount||0),0);
  const d=libDebt(id);
  return {gross,libShare,platform,teacher,owed:d.owed,paid:d.paid,remaining:d.remaining};
}
const v25OldRenderFinanceAdmin=renderFinanceAdmin;
renderFinanceAdmin=function(){
  v25OldRenderFinanceAdmin();
  let html=adminContent.innerHTML;
  html+=`<h3>تسويات المكتبات</h3><p class="muted">المكتبة تستلم من الطالب. المطلوب منها تسليمه = حصة المنصة + حصة المدرسين.</p>`;
  html+=(db.accounts.libraries||[]).map(l=>{const r=settlementRowsForLibrary(l.id);return `<div class="row settlement-row"><div><b>${esc(l.name)}</b><small>مبيعات ${money(r.gross)} — حصة المكتبة ${money(r.libShare)} — للمنصة ${money(r.platform)} — للمدرسين ${money(r.teacher)} — مدفوع ${money(r.paid)} — متبقي ${money(r.remaining)}</small></div><div class="row-actions"><button onclick="recordLibrarySettlement('${l.id}')">استلام تسوية</button><button class="secondary" onclick="printLibraryStatement('${l.id}')">طباعة كشف</button></div></div>`}).join('')||emptyState('لا توجد مكتبات');
  html+=`<h3>سندات قبض التسويات</h3>`+(librarySettlements.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).map(s=>{const l=(db.accounts.libraries||[]).find(x=>x.id===s.library_id)||{};return `<div class="row"><div><b>${esc(s.receipt_number)} — ${esc(l.name||'')}</b><small>${money(s.amount)} د.ع — ${esc(s.payment_method||'')} — ${esc(s.status||'')}</small></div><div class="row-actions"><button class="secondary" onclick="printLibrarySettlement('${s.id}')">طباعة سند</button>${s.status==='received'?`<button class="danger" onclick="reverseLibrarySettlement('${s.id}')">قيد عكسي</button>`:''}</div></div>`}).join('')||emptyState('لا توجد تسويات'));
  adminContent.innerHTML=html;
};
function printLibraryStatement(libraryId){
  const lib=(db.accounts.libraries||[]).find(x=>x.id===libraryId)||{};
  const r=settlementRowsForLibrary(libraryId);
  const rows=financialEntries.filter(x=>x.library_id===libraryId).map(x=>`<tr><td>${esc(x.order_number||x.order_id)}</td><td>${esc(x.title||'')}</td><td>${money(x.gross)}</td><td>${money(x.platform_amount)}</td><td>${money(x.teacher_amount)}</td><td>${money(x.library_amount)}</td></tr>`).join('');
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px"><h2>كشف تسوية مكتبة</h2><p><b>المكتبة:</b> ${esc(lib.name||'')}</p><p><b>إجمالي المبيعات:</b> ${money(r.gross)} د.ع</p><p><b>حصة المكتبة:</b> ${money(r.libShare)} د.ع</p><p><b>المطلوب تسليمه:</b> ${money(r.owed)} د.ع | <b>المدفوع:</b> ${money(r.paid)} د.ع | <b>المتبقي:</b> ${money(r.remaining)} د.ع</p><table border="1" cellspacing="0" cellpadding="6" width="100%"><thead><tr><th>رقم الطلب</th><th>المادة</th><th>المبلغ</th><th>آلين</th><th>المدرس</th><th>المكتبة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}
const v25OldRenderLibrary=renderLibrary;
renderLibrary=function(){
  v25OldRenderLibrary();
  if(current?.role==='library' && window.libraryHistory){
    const d=libDebt(current.id);
    libraryHistory.innerHTML = `<div class="notice"><b>تسوية المكتبة</b><div>المطلوب تسليمه للإدارة: ${money(d.owed)} د.ع<br>المدفوع: ${money(d.paid)} د.ع<br>المتبقي: ${money(d.remaining)} د.ع</div></div>` + libraryHistory.innerHTML;
  }
};
adminStatsRender=function(){ if(!window.adminStats)return; const platform=financialEntries.reduce((a,x)=>a+(+x.platform_amount||0),0); const totalDebt=(db.accounts.libraries||[]).reduce((a,l)=>a+libDebt(l.id).remaining,0); adminStats.innerHTML=`<div><b>الحسابات</b><span>${db.accounts.teachers.length+db.accounts.libraries.length}</span></div><div><b>الملازم</b><span>${db.booklets.length}</span></div><div><b>الطلبات</b><span>${db.orders.length}</span></div><div><b>متبقي التسويات</b><span>${money(totalDebt)} د.ع</span></div><div><b>صافي حصة آلين</b><span>${money(platform)} د.ع</span></div>`; };

// ===== V26 Manual Mastercard Payment =====
function manualPayInfoHtml(){
  const card=esc(db.settings.manual_card_number||'يحدد من لوحة الإدارة');
  const holder=esc(db.settings.manual_card_holder||'منصة آلين');
  return `<div class="checkout-total"><b>تحويل يدوي بالماستر كارد</b><br>حوّل المبلغ إلى البطاقة: <b>${card}</b><br>اسم المستلم: ${holder}<br><small>بعد التحويل ارفع صورة الوصل. الطلب يبقى بانتظار تأكيد الإدارة.</small></div>`;
}
function paymentChoiceHtml(){return `<h3>طريقة الدفع</h3><label><input type="radio" name="payMethod" value="cash" checked onchange="toggleManualPay()"> الدفع عند الاستلام</label> <label><input type="radio" name="payMethod" value="manual_mastercard" onchange="toggleManualPay()"> تحويل ماستر كارد يدوي</label><div id="manualPayBox" class="hidden">${manualPayInfoHtml()}<input id="paymentReceipt" type="file" accept="image/*,.pdf"><small>ارفع صورة أو PDF لوصل التحويل</small></div>`}
function toggleManualPay(){const v=document.querySelector('input[name="payMethod"]:checked')?.value; document.getElementById('manualPayBox')?.classList.toggle('hidden',v!=='manual_mastercard');}

openCheckout = function(kind,itemId){
  checkoutItem={kind,itemId}; const item=kind==='booklet'?db.booklets.find(x=>x.id===itemId):db.products.find(x=>x.id===itemId); const title=item?.title||item?.name||'',price=item?.price||0;
  checkoutBox.innerHTML=`<h2>إتمام الشراء</h2><div class="row"><b>${esc(title)}</b><span>${money(price)} د.ع</span></div><h3>مكتبات الاستلام</h3>${librariesVisibleList()}<div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الطالب"><input id="qty" type="number" min="1" value="1" oninput="updateTotal()" placeholder="عدد النسخ"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر المكتبة</option>${libraryOptionsHtml()}</select><div id="libInfo" class="checkout-total"></div><div class="checkout-total">المجموع: <b id="totalBox">${money(price)} د.ع</b></div></div>${paymentChoiceHtml()}<button onclick="confirmCheckoutV26()">إنشاء الطلب</button><div id="payMsg"></div>`; checkoutModal.classList.remove('hidden');
}
async function confirmCheckoutV26(){try{
  if(!checkoutItem)throw Error('لا توجد مادة'); const item=checkoutItem.kind==='booklet'?db.booklets.find(x=>x.id===checkoutItem.itemId):db.products.find(x=>x.id===checkoutItem.itemId); const q=Math.max(1,+qty.value||1); if(!studentName.value.trim()||!studentPhone.value.trim()||!libSelect.value)throw Error('أكمل بيانات الطلب');
  const method=document.querySelector('input[name="payMethod"]:checked')?.value||'cash'; let receipt=null; if(method==='manual_mastercard'){const f=paymentReceipt?.files?.[0]; if(!f)throw Error('ارفع صورة وصل التحويل'); receipt=await uploadFile('payment-receipts',f);}
  const oid=uid('O'),num='AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10); await insert('orders',{id:oid,order_number:num,kind:checkoutItem.kind,item_id:item.id,title:item.title||item.name,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),library_id:libSelect.value,qty:q,unit_price:item.price,total:q*item.price,status:'new',payment_status:method==='cash'?'cash_on_delivery':'manual_review',payment_method:method,payment_receipt_path:receipt,status_history:[{status:'new',at:new Date().toISOString()}]});
  await audit('order','إنشاء طلب '+num+' بطريقة '+method); await load(); payMsg.innerHTML=`<div class="checkout-total"><b>تم إنشاء الطلب</b><br>رقم الطلب: ${esc(num)}<br>${method==='manual_mastercard'?'وصل التحويل بانتظار تأكيد الإدارة.':'الدفع عند الاستلام من المكتبة.'}</div>`;
}catch(e){alert(e.message)}}

openCart = function(){ checkoutItem={kind:'cart'}; const sub=cart.reduce((a,x)=>a+x.price*x.qty,0); checkoutBox.innerHTML=`<h2>سلة آلين</h2><div class="cart-list">${cart.map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b><small>${money(x.price)} د.ع</small></div><div class="row-actions"><button onclick="cartQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="cartQty(${i},1)">+</button><button class="danger" onclick="cartRemove(${i})">حذف</button></div></div>`).join('')||emptyState('السلة فارغة')}</div>${cart.length?`<div class="checkout-total">المجموع: <b>${money(sub)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="كود الخصم"><button onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><h3>مكتبات الاستلام</h3>${librariesVisibleList()}<div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الهاتف"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${libraryOptionsHtml()}</select><div id="libInfo"></div></div>${paymentChoiceHtml()}<button onclick="confirmCartCheckoutV26()">تأكيد الطلب</button>`:''}`; checkoutModal.classList.remove('hidden'); }
async function confirmCartCheckoutV26(){try{
  if(!cart.length)throw Error('السلة فارغة'); if(!studentName.value.trim()||!studentPhone.value.trim()||!libSelect.value)throw Error('أكمل بيانات الطلب'); const method=document.querySelector('input[name="payMethod"]:checked')?.value||'cash'; let receipt=null; if(method==='manual_mastercard'){const f=paymentReceipt?.files?.[0]; if(!f)throw Error('ارفع صورة وصل التحويل'); receipt=await uploadFile('payment-receipts',f);} const coupon=validCoupon(couponInput?.value?.trim()||'');
  for(const x of cart){let raw=x.price*x.qty,discount=0;if(coupon)discount=coupon.discount_type==='fixed'?Math.min(raw,+coupon.discount_value):Math.round(raw*(+coupon.discount_value/100));const oid=uid('O'),num='AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10);await insert('orders',{id:oid,order_number:num,kind:x.kind,item_id:x.id,title:x.title,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),library_id:libSelect.value,qty:x.qty,unit_price:x.price,total:raw-discount,discount,coupon_code:coupon?.code||null,status:'new',payment_status:method==='cash'?'cash_on_delivery':'manual_review',payment_method:method,payment_receipt_path:receipt,status_history:[{status:'new',at:new Date().toISOString()}]});}
  if(coupon)await update('coupons',{used_count:(+coupon.used_count||0)+1},{id:coupon.id}); await audit('order','إنشاء طلب سلة بطريقة '+method); cart=[];cartSave();await load();checkoutBox.innerHTML=`<h2>تم استلام طلبك</h2><p>${method==='manual_mastercard'?'تم رفع الوصل والطلبات بانتظار تأكيد الإدارة.':'الدفع عند الاستلام من المكتبة.'}</p><button onclick="closeCheckout()">إغلاق</button>`;
}catch(e){alert(e.message)}}
function viewPaymentReceipt(id){const o=db.orders.find(x=>x.id===id);if(!o?.payment_receipt_path)return alert('لا يوجد وصل');const url=mediaUrl(o.payment_receipt_path);checkoutBox.innerHTML=`<h2>وصل التحويل</h2><div class="pdf-viewer"><iframe src="${url}"></iframe></div><div class="row-actions"><button onclick="approveManualPayment('${id}')">تأكيد الدفع</button><button class="danger" onclick="rejectManualPayment('${id}')">رفض الوصل</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;checkoutModal.classList.remove('hidden');}
async function approveManualPayment(id){await update('orders',{payment_status:'paid',status:'paid',payment_ref:'MAN-'+Date.now()},{id});await audit('payment','تأكيد تحويل يدوي للطلب '+id);await load();closeCheckout();renderOrdersAdmin();}
async function rejectManualPayment(id){await update('orders',{payment_status:'receipt_rejected',status:'new'},{id});await audit('payment','رفض وصل تحويل للطلب '+id);await load();closeCheckout();renderOrdersAdmin();}
const _renderOrdersAdminV25=renderOrdersAdmin;
renderOrdersAdmin=function(){const labels={new:'جديد',paid:'مدفوع',processing:'قيد التجهيز',ready:'جاهز',completed:'تم التسليم',cancelled:'ملغي'};adminContent.innerHTML='<h2>الطلبات</h2>'+(db.orders.length?db.orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)} — ${esc(x.title)} × ${x.qty}</b><small>${esc(x.student_name)} — ${money(x.total)} د.ع — ${labels[x.status]||esc(x.status||'')} — ${x.payment_status==='manual_review'?'وصل ماستر بانتظار المراجعة':x.payment_status==='cash_on_delivery'?'دفع عند الاستلام':x.payment_status==='paid'?'مدفوع':esc(x.payment_status||'')}</small></div><div class="row-actions">${x.payment_status==='manual_review'?`<button onclick="viewPaymentReceipt('${x.id}')">مراجعة الوصل</button>`:''}${x.payment_status==='paid'||x.payment_status==='cash_on_delivery'?`<button onclick="orderStatus('${x.id}','processing')">تجهيز</button><button onclick="orderStatus('${x.id}','ready')">جاهز</button><button onclick="orderStatus('${x.id}','completed')">تسليم</button>`:''}<button class="danger" onclick="orderStatus('${x.id}','cancelled')">إلغاء</button></div></div>`).join(''):emptyState('لا توجد طلبات'));}

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
  if(!saved) return pass==='1234';
  return (await sha256Text(pass))===saved;
}
const _doLoginV27=doLogin;
doLogin=async function(){
  const u=loginU.value.trim(), p=loginPass.value.trim();
  if(pendingRole==='admin'){
    if(u===adminUser() && await adminPassOk(p)){ current={role:'admin',name:'منصة آلين'}; openPage('admin'); return; }
    loginMsg.textContent='بيانات الدخول غير صحيحة'; return;
  }
  return _doLoginV27();
};
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
const _adminStatsRenderV27=adminStatsRender;
adminStatsRender=function(){
  _adminStatsRenderV27();
  document.querySelectorAll('.version-badge').forEach(x=>x.textContent='منصة آلين');
};
const _openPageV27=openPage;
openPage=function(page){
  _openPageV27(page);
  setTimeout(()=>{document.querySelectorAll('.version-badge').forEach(x=>x.textContent='منصة آلين');},50);
};

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
const _openPageV28=openPage;
openPage=function(page){_openPageV28(page);setTimeout(applyBrandV28,50);setTimeout(()=>{document.querySelectorAll('.version-badge').forEach(x=>x.textContent='منصة آلين');},60)};
const _adminStatsRenderV28=adminStatsRender;
adminStatsRender=function(){_adminStatsRenderV28();document.querySelectorAll('.version-badge').forEach(x=>x.textContent='منصة آلين')};
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
function activeCouriers(){ return (couriers||[]).filter(x=>x.status!=='inactive'); }
function fulfillmentHtml(){
  return `<h3>طريقة الاستلام والدفع</h3><div class="delivery-choice"><label><input type="radio" name="fulfillment" value="pickup" checked onchange="toggleDeliveryFields()"> استلام من المكتبة والدفع عند الاستلام</label><label><input type="radio" name="fulfillment" value="home_delivery" onchange="toggleDeliveryFields()"> توصيل للبيت والدفع للمندوب</label></div><div id="pickupFields"><h3>مكتبات الاستلام</h3>${librariesVisibleList()}<select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${libraryOptionsHtml()}</select><div id="libInfo"></div></div><div id="deliveryFields" class="hidden"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل للبيت"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">اختيار مندوب لاحقًا من الإدارة</option>${activeCouriers().map(c=>`<option value="${c.id}">${esc(c.name)} — ${esc(c.area||'')}</option>`).join('')}</select></div><div class="checkout-total">أجور التوصيل: <b>${money(deliveryFee())} د.ع</b></div></div><p class="muted">تم إلغاء الماستر كارد. الدفع يكون نقدًا عند الاستلام من المكتبة أو عند التسليم للمندوب.</p>`;
}
function toggleDeliveryFields(){
  const v=document.querySelector('input[name="fulfillment"]:checked')?.value||'pickup';
  const p=document.getElementById('pickupFields'), d=document.getElementById('deliveryFields');
  if(p)p.classList.toggle('hidden',v!=='pickup');
  if(d)d.classList.toggle('hidden',v!=='home_delivery');
}
function orderBaseExtra(){
  const f=document.querySelector('input[name="fulfillment"]:checked')?.value||'pickup';
  if(f==='pickup'){
    if(!libSelect?.value) throw Error('اختر مكتبة الاستلام');
    return {fulfillment_type:'pickup',library_id:libSelect.value,courier_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
  }
  if(!deliveryArea.value.trim()||!deliveryAddress.value.trim()||!deliveryLandmark.value.trim()) throw Error('أكمل بيانات التوصيل للبيت');
  return {fulfillment_type:'home_delivery',library_id:null,courier_id:courierSelect?.value||null,delivery_area:deliveryArea.value.trim(),delivery_address:deliveryAddress.value.trim(),delivery_landmark:deliveryLandmark.value.trim(),delivery_fee:deliveryFee(),payment_method:'cash_to_courier',payment_status:'cod_pending'};
}
openCart = function(){
  checkoutItem={kind:'cart'}; const sub=cart.reduce((a,x)=>a+x.price*x.qty,0);
  checkoutBox.innerHTML=`<h2>سلة آلين</h2><div class="cart-list">${cart.map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b><small>${money(x.price)} د.ع</small></div><div class="row-actions"><button onclick="cartQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="cartQty(${i},1)">+</button><button class="danger" onclick="cartRemove(${i})">حذف</button></div></div>`).join('')||emptyState('السلة فارغة')}</div>${cart.length?`<div class="checkout-total">مجموع المواد: <b>${money(sub)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="كود الخصم"><button onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الهاتف"></div>${fulfillmentHtml()}<button onclick="confirmCartCheckoutV29()">تأكيد الطلب</button>`:''}`;
  checkoutModal.classList.remove('hidden');
};
async function confirmCartCheckoutV29(){try{
  if(!cart.length)throw Error('السلة فارغة');
  if(!studentName.value.trim()||!studentPhone.value.trim())throw Error('أكمل اسم الطالب ورقم الهاتف');
  const extra=orderBaseExtra();
  const coupon=validCoupon(couponInput?.value?.trim()||'');
  for(const x of cart){
    const product=x.kind==='booklet'?null:db.products.find(p=>p.id===x.id);
    if(product&&+product.stock<x.qty)throw Error('الكمية غير متوفرة: '+x.title);
    let raw=x.price*x.qty,discount=0; if(coupon)discount=coupon.discount_type==='fixed'?Math.min(raw,+coupon.discount_value):Math.round(raw*(+coupon.discount_value/100));
    const total=raw-discount+(extra.fulfillment_type==='home_delivery'?deliveryFee():0);
    const oid=uid('O'), num='AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10);
    await insert('orders',{id:oid,order_number:num,kind:x.kind,item_id:x.id,title:x.title,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),qty:x.qty,unit_price:x.price,total,discount,coupon_code:coupon?.code||null,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra});
  }
  if(coupon) await update('coupons',{used_count:(+coupon.used_count||0)+1},{id:coupon.id});
  await audit('order','إنشاء طلب COD '+extra.fulfillment_type);
  cart=[];cartSave();await load();checkoutBox.innerHTML='<h2>تم استلام طلبك</h2><p>الدفع يكون عند الاستلام. إذا اخترت المكتبة تدفع للمكتبة، وإذا اخترت التوصيل تدفع للمندوب.</p><button onclick="closeCheckout()">إغلاق</button>';
}catch(e){alert(e.message)}}
openCheckout = function(kind,id,title,price){
  checkoutItem={kind,id,title,price}; checkoutModal.classList.remove('hidden');
  checkoutBox.innerHTML=`<h2>إتمام الشراء</h2><div class="row"><b>${esc(title)}</b><span>${money(price)} د.ع</span></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الطالب"><input id="qty" type="number" min="1" value="1" oninput="updateTotalV29()" placeholder="عدد النسخ"></div><div class="checkout-total">مجموع المادة: <b id="totalBox">${money(price)} د.ع</b></div>${fulfillmentHtml()}<button onclick="confirmCheckoutV29()">إنشاء الطلب</button><div id="payMsg"></div>`;
};
function updateTotalV29(){const q=+(document.getElementById('qty')?.value||1); if(totalBox) totalBox.textContent=money((checkoutItem?.price||0)*q)+' د.ع';}
async function confirmCheckoutV29(){try{
  if(!checkoutItem)throw Error('لا توجد مادة'); if(!studentName.value.trim()||!studentPhone.value.trim())throw Error('أكمل بيانات الطالب');
  const q=Math.max(1,+(qty.value||1)); const extra=orderBaseExtra(); const raw=(checkoutItem.price||0)*q; const total=raw+(extra.fulfillment_type==='home_delivery'?deliveryFee():0);
  const oid=uid('O'), num='AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10);
  await insert('orders',{id:oid,order_number:num,kind:checkoutItem.kind,item_id:checkoutItem.id,title:checkoutItem.title,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),qty:q,unit_price:checkoutItem.price,total,discount:0,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra});
  await audit('order','إنشاء طلب مفرد COD'); await load(); checkoutBox.innerHTML='<h2>تم استلام الطلب</h2><p>الدفع عند الاستلام فقط.</p><button onclick="closeCheckout()">إغلاق</button>';
}catch(e){alert(e.message)}}

function openLibraryJoinPortal(){
  checkoutModal.classList.remove('hidden');
  checkoutBox.innerHTML=`<h2>لوحة المكتبة</h2><p class="muted">إذا عندك حساب مكتبة اضغط دخول، أو ارسل طلب انضمام جديد للإدارة.</p><div class="row-actions"><button onclick="closeCheckout();showLogin('library')">دخول مكتبة موجودة</button></div><hr><h3>تسجيل مكتبة جديدة</h3><div class="form-grid"><input id="joinLibraryName" placeholder="اسم المكتبة"><input id="joinOwnerName" placeholder="اسم صاحب المكتبة"><input id="joinWhatsapp" placeholder="رقم واتساب مثبت"><input id="joinArea" placeholder="المحافظة / المنطقة"><input id="joinAddress" placeholder="العنوان الكامل"><input id="joinLandmark" placeholder="أقرب نقطة دالة"><input id="joinGps" placeholder="موقع GPS" readonly><button type="button" onclick="getLibraryGps()">تحديد موقعي الحالي</button></div><textarea id="joinNotes" placeholder="تفاصيل اختيارية"></textarea><button onclick="submitLibraryJoinRequest()">إرسال الطلب للإدارة</button><div id="joinMsg"></div>`;
}
function getLibraryGps(){
  if(!navigator.geolocation) return alert('المتصفح لا يدعم تحديد الموقع');
  navigator.geolocation.getCurrentPosition(pos=>{joinGps.value=pos.coords.latitude.toFixed(6)+','+pos.coords.longitude.toFixed(6);},err=>alert('تعذر تحديد الموقع: '+err.message),{enableHighAccuracy:true,timeout:10000});
}
async function submitLibraryJoinRequest(){try{
  const row={id:uid('LR'),library_name:joinLibraryName.value.trim(),owner_name:joinOwnerName.value.trim(),whatsapp:joinWhatsapp.value.trim(),area:joinArea.value.trim(),address:joinAddress.value.trim(),landmark:joinLandmark.value.trim(),gps:joinGps.value.trim(),notes:joinNotes.value.trim(),status:'pending'};
  if(!row.library_name||!row.owner_name||!row.whatsapp||!row.area||!row.address||!row.landmark) throw Error('أكمل كل الحقول المطلوبة');
  await insert('library_join_requests',row); await audit('library_request','طلب انضمام مكتبة '+row.library_name); joinMsg.textContent='تم إرسال الطلب. يبقى بانتظار موافقة الإدارة.';
}catch(e){alert(e.message)}}

const _adminTabV29 = adminTab;
adminTab = function(t){
  if(t==='libraryRequests') return renderLibraryRequestsAdmin();
  if(t==='couriers') return renderCouriersAdmin();
  if(t==='courierSettlements') return renderCourierSettlementsAdmin();
  return _adminTabV29(t);
};
function renderLibraryRequestsAdmin(){
  adminContent.innerHTML='<h2>طلبات انضمام المكتبات</h2>'+(libraryJoinRequests.length?libraryJoinRequests.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).map(r=>`<div class="row"><div><b>${esc(r.library_name)}</b><small>صاحبها: ${esc(r.owner_name)} • واتساب: ${esc(r.whatsapp)} • ${esc(r.area)} • ${esc(r.address)} • نقطة دالة: ${esc(r.landmark)} ${r.gps?`• GPS: ${esc(r.gps)}`:''}</small><small>${esc(r.notes||'')}</small></div><div class="row-actions"><span>${esc(r.status||'pending')}</span>${r.status==='pending'?`<button onclick="approveLibraryRequest('${r.id}')">موافقة وإنشاء حساب</button><button class="danger" onclick="rejectLibraryRequest('${r.id}')">رفض</button>`:''}</div></div>`).join(''):emptyState('لا توجد طلبات مكتبات'));
}
async function approveLibraryRequest(id){
  const r=libraryJoinRequests.find(x=>x.id===id); if(!r)return;
  const username=prompt('اسم المستخدم للمكتبة', (r.library_name||'LIB').replace(/\s+/g,'_'));
  if(!username)return; const pass=prompt('الرمز السري للمكتبة','1234'); if(!pass)return;
  const accId=uid('L');
  await insert('accounts',{id:accId,role:'library',name:r.library_name,username,password_hash:pass,area:r.area,landmark:r.landmark,status:'active',owner_name:r.owner_name,whatsapp:r.whatsapp,address:r.address,gps:r.gps});
  await update('library_join_requests',{status:'approved',approved_account_id:accId,approved_at:new Date().toISOString()},{id});
  await audit('library_request','الموافقة على مكتبة '+r.library_name); await load(); renderLibraryRequestsAdmin(); alert('تم إنشاء حساب المكتبة');
}
async function rejectLibraryRequest(id){ const reason=prompt('سبب الرفض',''); await update('library_join_requests',{status:'rejected',reject_reason:reason||'',rejected_at:new Date().toISOString()},{id}); await audit('library_request','رفض طلب مكتبة '+id); await load(); renderLibraryRequestsAdmin(); }
function renderCouriersAdmin(){
  adminContent.innerHTML=`<h2>المندوبين</h2><div class="form-grid"><input id="courierName" placeholder="اسم المندوب"><input id="courierPhone" placeholder="رقم الهاتف"><input id="courierArea" placeholder="المنطقة"><button onclick="addCourier()">إضافة مندوب</button></div>`+(couriers.map(c=>`<div class="row"><div><b>${esc(c.name)}</b><small>${esc(c.phone||'')} — ${esc(c.area||'')}</small></div><div class="row-actions"><span>${esc(c.status||'active')}</span><button onclick="toggleCourier('${c.id}')">تفعيل/إيقاف</button></div></div>`).join('')||emptyState('لا يوجد مندوبين'));
}
async function addCourier(){ if(!courierName.value.trim())return alert('اكتب اسم المندوب'); await insert('couriers',{id:uid('C'),name:courierName.value.trim(),phone:courierPhone.value.trim(),area:courierArea.value.trim(),status:'active'}); await audit('courier','إضافة مندوب'); await load(); renderCouriersAdmin(); }
async function toggleCourier(id){const c=couriers.find(x=>x.id===id); await update('couriers',{status:c.status==='inactive'?'active':'inactive'},{id}); await load(); renderCouriersAdmin();}
function renderCourierSettlementsAdmin(){
  const deliveryOrders=(db.orders||[]).filter(o=>o.fulfillment_type==='home_delivery');
  adminContent.innerHTML='<h2>تسويات المندوبين</h2><p class="muted">المندوب يستلم مبلغ الطلب من الطالب عند التسليم، ثم يسلم المبلغ للإدارة بسند قبض.</p>'+deliveryOrders.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.id)} — ${esc(o.title)}</b><small>الطالب: ${esc(o.student_name)} • العنوان: ${esc(o.delivery_area||'')} ${esc(o.delivery_address||'')} • المبلغ ${money(o.total)} د.ع • الحالة ${esc(o.status||'')}</small></div><div class="row-actions"><select id="assign_${o.id}"><option value="">مندوب</option>${couriers.map(c=>`<option value="${c.id}" ${o.courier_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button onclick="assignCourier('${o.id}')">حفظ</button><button onclick="courierOrderStatus('${o.id}','out_for_delivery')">قيد التوصيل</button><button onclick="courierOrderStatus('${o.id}','completed')">تم التسليم</button></div></div>`).join('')+(deliveryOrders.length?'':'لا توجد طلبات توصيل')+'<h3>سندات تسوية المندوبين</h3>'+(courierSettlements.map(s=>`<div class="row"><b>${esc(s.receipt_number)}</b><span>${money(s.amount)} د.ع</span></div>`).join('')||emptyState('لا توجد تسويات'));
}
async function assignCourier(id){ await update('orders',{courier_id:document.getElementById('assign_'+id).value||null},{id}); await audit('courier','تعيين مندوب للطلب '+id); await load(); renderCourierSettlementsAdmin(); }
async function courierOrderStatus(id,status){ await update('orders',{status,payment_status:status==='completed'?'paid':'cod_pending'},{id}); if(status==='completed') await maybeCreateFinancialEntry(id); await audit('courier','تحديث حالة توصيل '+id); await load(); renderCourierSettlementsAdmin(); }

const _renderOrdersAdminV29 = renderOrdersAdmin;
renderOrdersAdmin = function(){
  const labels={pickup:'استلام من المكتبة',home_delivery:'توصيل للبيت'};
  adminContent.innerHTML='<h2>الطلبات</h2>'+(db.orders.length?db.orders.map(x=>`<div class="row"><div><b>${esc(x.title)} × ${x.qty}</b><small>${esc(x.student_name)} — ${esc(x.student_phone||'')} — ${money(x.total)} د.ع — ${labels[x.fulfillment_type]||'استلام'} — ${esc(x.status||'')}</small></div><div class="row-actions">${x.fulfillment_type==='home_delivery'?`<button onclick="adminTab('courierSettlements')">إدارة التوصيل</button>`:''}<button onclick="orderStatus('${x.id}','processing')">تجهيز</button><button onclick="orderStatus('${x.id}','ready')">جاهز</button><button onclick="orderStatus('${x.id}','completed')">تم التسليم</button><button class="danger" onclick="orderStatus('${x.id}','cancelled')">إلغاء</button></div></div>`).join(''):emptyState('لا توجد طلبات'));
};
const _renderSettingsV29 = renderSettingsAdmin;
renderSettingsAdmin = function(){
  _renderSettingsV29();
  adminContent.innerHTML += `<div class="settings-section"><h3>إعدادات التوصيل</h3><div class="form-grid"><input id="deliveryFeeInput" type="number" value="${deliveryFee()}" placeholder="أجور التوصيل"><button onclick="saveDeliverySettings()">حفظ أجور التوصيل</button></div><p class="muted">تم إلغاء خيار الماستر كارد. الدفع نقدًا عند الاستلام فقط.</p></div>`;
};
async function saveDeliverySettings(){ await settingsSet('delivery_fee',String(+deliveryFeeInput.value||0)); await audit('settings','تحديث أجور التوصيل'); await load(); renderSettingsAdmin(); toast('تم حفظ أجور التوصيل'); }
const _openPageV29 = openPage;
openPage=function(page){_openPageV29(page);setTimeout(()=>{document.querySelectorAll('.version-badge').forEach(x=>x.textContent='منصة آلين'); document.title='منصة آلين';},80)};

/* ================= ALIN V29.1 STOREFRONT ENHANCEMENT ================= */
const _renderStoreV291 = renderStore;
renderStore = function(){
  _renderStoreV291();
  try{
    const navBtns=document.querySelectorAll('.store-nav button');
    navBtns.forEach(b=>b.classList.remove('active'));
    const idx=db.settings.storeType==='stationery'?2:db.settings.storeType==='gift'?3:1;
    if(navBtns[idx])navBtns[idx].classList.add('active');
    const h=document.getElementById('storeHeading');
    if(h) h.textContent=db.settings.storeType==='booklet'?'الملازم':db.settings.storeType==='stationery'?'القرطاسية':'الهدايا';
    const sb=document.getElementById('alinStatBooklets'), so=document.getElementById('alinStatOrders'), st=document.getElementById('alinStatTeachers'), sl=document.getElementById('alinStatLibraries');
    if(sb) sb.textContent=(db.booklets||[]).filter(x=>x.status==='published').length;
    if(so) so.textContent=(db.orders||[]).filter(x=>['delivered','completed','تم التسليم'].includes(x.status)).length;
    if(st) st.textContent=(db.accounts?.teachers||[]).filter(x=>x.status==='active').length;
    if(sl) sl.textContent=(db.accounts?.libraries||[]).filter(x=>x.status==='active').length;
    const fab=document.getElementById('cartCountFab'); if(fab)fab.textContent=cart.reduce((a,x)=>a+x.qty,0);
  }catch(e){}
};
const _addToCartV291=addToCart;
addToCart=function(kind,id){_addToCartV291(kind,id);const fab=document.getElementById('cartCountFab');if(fab)fab.textContent=cart.reduce((a,x)=>a+x.qty,0);}

const _openCheckoutV29Original = openCheckout;
openCheckout = function(kind,id,title,price){
  if(title===undefined){
    const item=kind==='booklet'?(db.booklets||[]).find(x=>x.id===id):(db.products||[]).find(x=>x.id===id);
    title=item?.title||item?.name||'المادة';
    price=+(item?.price||0);
  }
  return _openCheckoutV29Original(kind,id,title,price);
};


/* ================= ALIN V29.2 CLEAN STOREFRONT FIX ================= */
(function(){
  const typeLabel={booklet:'الملازم',stationery:'القرطاسية',gift:'الهدايا'};
  window.setStoreType=function(type,btn){
    db.settings.storeType=type||'booklet';
    document.querySelectorAll('.store-nav button').forEach(b=>b.classList.remove('active'));
    if(btn){ btn.classList.add('active'); }
    else{
      const idx=db.settings.storeType==='stationery'?2:db.settings.storeType==='gift'?3:1;
      const navBtn=document.querySelector(`.store-nav button:nth-child(${idx+1})`);
      if(navBtn) navBtn.classList.add('active');
    }
    renderStore();
  };
  window.storeItems=function(){
    const type=db.settings.storeType||'booklet';
    if(type==='booklet'){
      const fromBooklets=(db.booklets||[]).filter(x=>x.status==='published').map(x=>({
        kind:'booklet',id:x.id,title:x.title,subject:x.subject,grade:x.grade,
        teacher:teacherName(x.teacher_id),teacher_phone:x.teacher_phone||teacherObj?.(x.teacher_id)?.phone||'',
        price:x.price,cover:x.cover_path,stock:null
      }));
      const fromProducts=(db.products||[]).filter(x=>x.status==='published' && ['booklet','booklets','ملزمة','ملازم'].includes(String(x.type||'').trim())).map(x=>({
        kind:'booklet_product',id:x.id,title:x.name,subject:x.category,grade:x.category,teacher:'',teacher_phone:'',price:x.price,cover:x.image_path,stock:x.stock
      }));
      return [...fromBooklets,...fromProducts];
    }
    return (db.products||[]).filter(x=>x.type===type && x.status==='published').map(x=>({kind:x.type,id:x.id,title:x.name,subject:x.category,grade:x.category,teacher:'',price:x.price,cover:x.image_path,stock:x.stock}));
  };
  window.renderStore=function(){
    if(!window.storeGrid || !db.booklets)return;
    if(window.bannerBox) bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join('');
    const type=db.settings.storeType||'booklet';
    const items=storeItems();
    const q=(searchInput?.value||'').toLowerCase();
    const cats=[...new Set(items.map(x=>x.grade||x.subject).filter(Boolean))];
    const teachers=[...new Set(items.map(x=>x.teacher).filter(Boolean))];
    const oldCat=filterCategory?.value||'', oldTeacher=filterTeacher?.value||'';
    if(window.filterCategory) filterCategory.innerHTML='<option value="">كل الأقسام</option>'+cats.map(x=>`<option ${x===oldCat?'selected':''}>${esc(x)}</option>`).join('');
    if(window.filterTeacher){
      filterTeacher.style.display=type==='booklet'?'':'none';
      filterTeacher.innerHTML='<option value="">كل المدرسين</option>'+teachers.map(x=>`<option ${x===oldTeacher?'selected':''}>${esc(x)}</option>`).join('');
    }
    const list=items.filter(x=>(!filterCategory?.value||x.grade===filterCategory.value||x.subject===filterCategory.value)&&(!filterTeacher?.value||x.teacher===filterTeacher.value)&&(`${x.title||''} ${x.teacher||''} ${x.subject||''}`).toLowerCase().includes(q));
    if(window.storeHeading) storeHeading.textContent=typeLabel[type]||'المتجر';
    document.querySelectorAll('.store-nav button').forEach(b=>b.classList.remove('active'));
    const navIndex=type==='stationery'?3:type==='gift'?4:2;
    const navBtn=document.querySelector(`.store-nav button:nth-child(${navIndex})`); if(navBtn) navBtn.classList.add('active');
    storeGrid.innerHTML=list.map(x=>{
      const img=x.cover?`<img src="${mediaUrl(x.cover)}" alt="${esc(x.title||'')}">`:esc(x.subject||'منتج');
      const teacher=x.teacher?`<div class="teacher-card-mini"><div class="teacher-avatar">م</div><div><b>${esc(x.teacher)}</b>${x.teacher_phone?`<small>${esc(x.teacher_phone)}</small>`:''}</div></div>`:'';
      return `<article class="card clean-product-card"><div class="cover">${img}</div><h3>${esc(x.title||'')}</h3>${teacher}<p>${esc(x.grade||x.subject||'')}</p>${x.stock!==null?`<p class="stock-line">المخزون: ${money(x.stock)}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')">أضف للسلة</button><button class="secondary" onclick="openCheckout('${x.kind}','${x.id}')">شراء مباشر</button></div></article>`;
    }).join('')||emptyState('لا توجد مواد في هذا القسم');
    if(window.alinStatBooklets) alinStatBooklets.textContent=(db.booklets||[]).filter(x=>x.status==='published').length;
    if(window.alinStatOrders) alinStatOrders.textContent=(db.orders||[]).filter(x=>['completed','ready','processing','new'].includes(x.status)).length;
    if(window.alinStatTeachers) alinStatTeachers.textContent=(db.accounts?.teachers||[]).filter(x=>x.status==='active').length;
    if(window.alinStatLibraries) alinStatLibraries.textContent=(db.accounts?.libraries||[]).filter(x=>x.status==='active').length;
    renderCartBadge?.();
  };
  const oldOpenCheckout=window.openCheckout;
  window.openCheckout=function(kind,itemId){
    if(kind==='booklet_product') return oldOpenCheckout('stationery', itemId);
    return oldOpenCheckout(kind,itemId);
  };
  const oldAddToCart=window.addToCart;
  window.addToCart=function(kind,id){
    if(kind==='booklet_product') return oldAddToCart('stationery',id);
    return oldAddToCart(kind,id);
  };
  window.renderSettingsAdmin=function(){
    adminContent.innerHTML=`<h2>إعدادات المنصة</h2><div class="form-grid"><input id="platformName" value="${esc(db.settings.platform_name||'منصة آلين')}" placeholder="اسم المنصة"><input id="platformPhone" value="${esc(db.settings.platform_phone||'')}" placeholder="رقم الهاتف"><input id="heroTitle" value="${esc(db.settings.hero_title||'')}" placeholder="عنوان الواجهة"><input id="heroText" value="${esc(db.settings.hero_text||'')}" placeholder="نص الواجهة"><input id="lowStockDefault" type="number" value="${esc(db.settings.low_stock_default||'5')}" placeholder="حد المخزون المنخفض"><button onclick="savePlatformSettings()">حفظ الإعدادات</button></div><div class="settings-preview"><b>معاينة</b><h3>${esc(db.settings.hero_title||'')}</h3><p>${esc(db.settings.hero_text||'')}</p></div>`;
  };
})();

/* ================= ALIN V31 STORE + OPERATIONS ================= */
(function(){
  const statusLabels={pending:'تم استلام الطلب',new:'تم استلام الطلب',payment_pending:'بانتظار التأكيد',processing:'قيد التجهيز',ready:'جاهز بالمكتبة',out_delivery:'خرج للتوصيل',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي'};
  const statusSteps=['pending','processing','ready','out_delivery','completed'];
  function orderNo(o){return o?.order_number||o?.id||''}
  function lowStockLimit(){return +(db?.settings?.low_stock_default||5)}
  window.renderCartBadge=window.renderCartBadge||function(){try{const n=(window.cart||[]).reduce((a,x)=>a+(+x.qty||0),0); if(window.cartCount)cartCount.textContent=n; if(window.cartCountFab)cartCountFab.textContent=n;}catch(e){}};

  window.trackOrder=function(){
    const q=(window.trackOrderInput?.value||'').trim().toLowerCase();
    const box=window.trackOrderResult; if(!box)return;
    if(!q){box.className='track-result show';box.innerHTML='اكتب رقم الطلب أولاً';return;}
    const o=(db.orders||[]).find(x=>String(x.id||'').toLowerCase()===q||String(x.order_number||'').toLowerCase()===q);
    if(!o){box.className='track-result show';box.innerHTML='لم يتم العثور على الطلب. تأكد من الرقم واكتب نفس الرقم الظاهر عند إنشاء الطلب.';return;}
    const current=o.status||'pending';
    const reached=statusSteps.indexOf(current);
    box.className='track-result show';
    box.innerHTML=`<b>${esc(orderNo(o))} — ${esc(o.title||'')}</b><br><small>${esc(o.student_name||'')} • ${money(o.total||0)} د.ع</small><div class="timeline v31">${statusSteps.map((s,i)=>`<span class="${i<=Math.max(0,reached)?'done':''}">${statusLabels[s]}</span>`).join('')}</div>`;
  };

  window.storeItems=function(){
    const type=db.settings.storeType||'booklet';
    if(type==='booklet'){
      return (db.booklets||[]).filter(x=>x.status==='published').map(x=>({kind:'booklet',id:x.id,title:x.title,subject:x.subject,grade:x.grade,edition:x.edition||x.year||'نسخة 2027',teacher:teacherName(x.teacher_id),price:x.price,cover:x.cover_path,stock:null}));
    }
    return (db.products||[]).filter(x=>x.type===type&&x.status==='published').map(x=>({kind:x.type,id:x.id,title:x.name,subject:x.category,grade:x.category,edition:'',teacher:'',price:x.price,cover:x.image_path,stock:+(x.stock||0)}));
  };

  window.renderStore=function(){
    if(!window.storeGrid||!db.booklets)return;
    const type=db.settings.storeType||'booklet', label=type==='booklet'?'الملازم':type==='stationery'?'القرطاسية':'الهدايا';
    if(window.bannerBox)bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join('');
    const items=storeItems(), q=(searchInput?.value||'').toLowerCase();
    const cats=[...new Set(items.map(x=>x.grade||x.subject).filter(Boolean))], teachers=[...new Set(items.map(x=>x.teacher).filter(Boolean))];
    const oldCat=filterCategory?.value||'', oldTeacher=filterTeacher?.value||'';
    if(window.filterCategory) filterCategory.innerHTML='<option value="">كل الأقسام</option>'+cats.map(x=>`<option ${x===oldCat?'selected':''}>${esc(x)}</option>`).join('');
    if(window.filterTeacher){filterTeacher.style.display=type==='booklet'?'':'none';filterTeacher.innerHTML='<option value="">كل المدرسين</option>'+teachers.map(x=>`<option ${x===oldTeacher?'selected':''}>${esc(x)}</option>`).join('');}
    const list=items.filter(x=>(!filterCategory?.value||x.grade===filterCategory.value||x.subject===filterCategory.value)&&(!filterTeacher?.value||x.teacher===filterTeacher.value)&&(`${x.title||''} ${x.teacher||''} ${x.subject||''} ${x.grade||''}`).toLowerCase().includes(q));
    if(window.storeHeading)storeHeading.textContent=label;
    document.querySelectorAll('.store-nav button').forEach(b=>b.classList.remove('active'));
    const navIndex=type==='stationery'?3:type==='gift'?4:2; const nb=document.querySelector(`.store-nav button:nth-child(${navIndex})`); if(nb)nb.classList.add('active');
    storeGrid.innerHTML=list.map(x=>{
      const low=x.stock!==null&&x.stock<=lowStockLimit();
      const img=x.cover?`<img src="${mediaUrl(x.cover)}" alt="${esc(x.title||'')}">`:esc(x.subject||label);
      const teacher=x.teacher?`<div class="teacher-card-mini"><div class="teacher-avatar">${esc((x.teacher||'م').slice(0,1))}</div><div><b>${esc(x.teacher)}</b><small>${esc(x.subject||'')} • ${esc(x.edition||'')}</small></div></div>`:'';
      return `<article class="card clean-product-card"><div class="cover">${img}</div><h3>${esc(x.title||'')}</h3>${teacher}<p>${esc(x.grade||x.subject||'')}</p>${x.stock!==null?`<p class="stock-line ${low?'low-stock':''}">${low?'قرب النفاد — ':''}المخزون: ${money(x.stock)}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')">أضف للسلة</button><button class="secondary" onclick="openCheckout('${x.kind}','${x.id}')">شراء مباشر</button></div></article>`;
    }).join('')||emptyState('لا توجد مواد في هذا القسم حالياً');
    if(window.alinStatBooklets)alinStatBooklets.textContent=(db.booklets||[]).filter(x=>x.status==='published').length;
    if(window.alinStatOrders)alinStatOrders.textContent=(db.orders||[]).length;
    if(window.alinStatTeachers)alinStatTeachers.textContent=(db.accounts?.teachers||[]).filter(x=>x.status==='active').length;
    if(window.alinStatLibraries)alinStatLibraries.textContent=(db.accounts?.libraries||[]).filter(x=>x.status==='active').length;
    renderCartBadge();
  };

  const oldOpenCheckout=window.openCheckout;
  window.openCheckout=function(kind,itemId){
    checkoutItem={kind,itemId};
    const item=kind==='booklet'?(db.booklets||[]).find(x=>x.id===itemId):(db.products||[]).find(x=>x.id===itemId);
    if(!item)return;
    const title=item.title||item.name, price=+(item.price||0), libs=(db.accounts?.libraries||[]).filter(x=>x.status==='active');
    checkoutBox.innerHTML=`<h2>إتمام الشراء</h2><div class="row"><b>${esc(title)}</b><span>${money(price)} د.ع</span></div><div class="delivery-choice"><label><input type="radio" name="fulfillmentType" value="pickup" checked> استلام من المكتبة</label><label><input type="radio" name="fulfillmentType" value="home_delivery"> توصيل للبيت وتسليم المندوب</label></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الطالب / واتساب"><input id="studentAddress" placeholder="العنوان للتوصيل"><input id="qty" type="number" min="1" value="1" oninput="updateTotal()" placeholder="عدد النسخ"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر المكتبة</option>${libs.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.area||'')} — ${esc(x.landmark||'')}</option>`).join('')}</select><div id="libInfo" class="checkout-total"></div><div class="checkout-total">المجموع: <b id="totalBox">${money(price)} د.ع</b></div></div><h3>الدفع</h3><p class="muted">الدفع عند الاستلام فقط: في المكتبة أو عند تسليم المندوب.</p><button onclick="confirmCheckout()">إنشاء الطلب</button><div id="payMsg"></div>`;
    checkoutModal.classList.remove('hidden');
  };

  window.confirmCheckout=async function(){
    try{
      if(!checkoutItem)return;
      const item=checkoutItem.kind==='booklet'?(db.booklets||[]).find(x=>x.id===checkoutItem.itemId):(db.products||[]).find(x=>x.id===checkoutItem.itemId);
      if(!item)throw new Error('المادة غير موجودة');
      if(!studentName.value.trim()||!studentPhone.value.trim()||!libSelect.value)throw new Error('أكمل بيانات الطلب');
      const q=+qty.value||1,total=(+(item.price||0))*q,oid=uid('O'),onum='ALIN-'+String((db.orders||[]).length+1).padStart(4,'0');
      const fulfillment=(document.querySelector('input[name="fulfillmentType"]:checked')||{}).value||'pickup';
      await insert('orders',{id:oid,order_number:onum,kind:checkoutItem.kind,item_id:item.id,title:item.title||item.name,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),student_address:(window.studentAddress?.value||'').trim(),library_id:libSelect.value,qty:q,unit_price:item.price,total,status:'pending',payment_status:'cod',fulfillment_type:fulfillment,status_history:[{status:'pending',at:new Date().toISOString()}]});
      if(checkoutItem.kind!=='booklet'&&item.stock!==undefined) await update('products',{stock:Math.max(0,+item.stock-q)},{id:item.id});
      await audit('order','إنشاء طلب '+(item.title||item.name));
      const msg=encodeURIComponent(`طلب آلين رقم ${onum}\n${item.title||item.name}\nالعدد: ${q}\nالمجموع: ${money(total)} د.ع`);
      payMsg.innerHTML=`<div class="checkout-total"><b>تم إنشاء الطلب بنجاح</b><br>رقم الطلب: <b>${onum}</b><br><span class="whatsapp-chip">تنبيه واتساب جاهز</span><br><a target="_blank" href="https://wa.me/?text=${msg}">إرسال تفاصيل الطلب بالواتساب</a><div style="margin-top:10px" class="qr-box" title="QR الطلب"></div></div>`;
      await load();renderStore();
    }catch(e){payMsg.textContent=e.message;}
  };

  const oldRenderBookletsAdmin=window.renderBookletsAdmin;
  window.renderBookletsAdmin=function(){
    adminContent.innerHTML=`<h2>الملازم وإصداراتها</h2><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${(db.accounts?.teachers||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="grade" placeholder="الصف"><input name="edition" placeholder="السنة / الإصدار مثال 2027"><input name="price" type="number" placeholder="السعر"><label>غلاف<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF الحقيقي<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${(db.booklets||[]).map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${esc(teacherName(x.teacher_id))} — ${esc(x.subject||'')} — ${esc(x.grade||'')} — ${esc(x.edition||x.year||'بدون إصدار')} — ${money(x.price)} د.ع — ${esc(x.status||'')}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button class="danger" onclick="setBookStatus('${x.id}','archived')">أرشفة</button></div></div>`).join('')}`;
  };
  window.uploadBooklet=async function(){
    try{const f=new FormData(bookForm);const cover=await uploadFile('covers',f.get('cover'),{type:'image'});const ti=await uploadFile('teachers',f.get('teacherImage'),{type:'image'});const pdfFile=f.get('bookletFile');if(!pdfFile||!pdfFile.name)throw new Error('ملف PDF مطلوب');const fp=await uploadFile('booklets',pdfFile,{required:true,type:'pdf'});await insert('booklets',{id:uid('B'),title:f.get('title'),teacher_id:f.get('teacherId'),subject:f.get('subject'),grade:f.get('grade'),edition:f.get('edition')||'نسخة 2027',price:+f.get('price'),cover_path:cover,teacher_image_path:ti,file_path:fp,file_name:pdfFile.name,status:'published'});await audit('booklet','نشر ملزمة '+f.get('title'));await load();renderBookletsAdmin();toast('تم نشر الملزمة');}catch(e){alert(e.message);}
  };

  window.renderOrdersAdmin=function(){
    const orders=db.orders||[];
    adminContent.innerHTML='<h2>الطلبات وتتبعها</h2>'+(orders.length?orders.map(x=>`<div class="row"><div><b>${esc(orderNo(x))} — ${esc(x.title)} × ${x.qty}</b><small>${esc(x.student_name)} — ${esc(x.student_phone||'')} — ${money(x.total)} د.ع — ${statusLabels[x.status]||esc(x.status||'')}</small><div class="timeline">${(x.status_history||[]).map(h=>`<span class="done">${statusLabels[h.status]||esc(h.status)}</span>`).join('')}</div></div><div class="row-actions"><button onclick="orderStatus('${x.id}','processing')">تجهيز</button><button onclick="orderStatus('${x.id}','ready')">جاهز</button><button onclick="orderStatus('${x.id}','out_delivery')">خرج للتوصيل</button><button onclick="orderStatus('${x.id}','completed')">تسليم</button><button class="secondary" onclick="printReceipt('${x.id}')">وصل / QR</button><button class="danger" onclick="orderStatus('${x.id}','cancelled')">إلغاء</button></div></div>`).join(''):emptyState('لا توجد طلبات'));
  };

  window.renderFinanceAdmin=function(){
    const orders=db.orders||[], led=db.ledger||[]; const total=orders.reduce((a,x)=>a+(+x.total||0),0); const platform=led.reduce((a,x)=>a+(+x.alin||0),0); const teachers=led.reduce((a,x)=>a+(+x.teacher||0),0); const libraries=led.reduce((a,x)=>a+(+x.library||0),0); const delivery=orders.filter(x=>x.fulfillment_type==='home_delivery').length;
    adminContent.innerHTML=`<h2>المالية والمستحقات</h2><div class="v31-finance-grid"><div><b>إجمالي المبيعات</b><span>${money(total)} د.ع</span></div><div><b>ربح المنصة</b><span>${money(platform)} د.ع</span></div><div><b>مستحقات المدرسين</b><span>${money(teachers)} د.ع</span></div><div><b>مستحقات المكتبات</b><span>${money(libraries)} د.ع</span></div><div><b>طلبات التوصيل</b><span>${delivery}</span></div></div><h3>كشف المدرسين</h3>${(db.accounts?.teachers||[]).map(t=>{const ids=(db.booklets||[]).filter(b=>b.teacher_id===t.id).map(b=>b.id);const val=orders.filter(o=>ids.includes(o.item_id)).reduce((a,o)=>a+(+o.total||0),0);return `<div class="row"><b>${esc(t.name)}</b><span>${money(val)} د.ع</span></div>`}).join('')||emptyState('لا توجد حسابات')}`;
  };

  const oldOpenPage=window.openPage;
  window.openPage=function(page){oldOpenPage(page);setTimeout(()=>{document.title='منصة آلين';document.querySelectorAll('.version-badge').forEach(x=>x.textContent='منصة آلين');},50)};
})();

/* ================= ALIN V32 CLEAN STORE HEADER + EDITABLE FOOTER SECTIONS ================= */
(function(){
  function renderBottomInfo(){
    try{
      const about=document.getElementById('aboutPlatformBox');
      const contact=document.getElementById('contactPlatformBox');
      if(about){
        about.innerHTML=`<h2>${esc(db.settings.about_title||'عن المنصة')}</h2><p>${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</p>`;
      }
      if(contact){
        contact.innerHTML=`<h2>${esc(db.settings.contact_title||'تواصل معنا')}</h2><p>${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</p>`;
      }
    }catch(e){}
  }
  const oldRenderStore=window.renderStore;
  window.renderStore=function(){
    oldRenderStore&&oldRenderStore();
    renderBottomInfo();
  };
  const oldSettings=window.renderSettingsAdmin;
  window.renderSettingsAdmin=function(){
    if(oldSettings) oldSettings();
    const extra=`<div class="settings-section footer-editor"><h3>تعديل فقرات نهاية المتجر</h3><p class="muted">هذه الفقرات تظهر أسفل صفحة المتجر فقط.</p><div class="form-grid"><input id="aboutTitleInput" value="${esc(db.settings.about_title||'عن المنصة')}" placeholder="عنوان عن المنصة"><input id="contactTitleInput" value="${esc(db.settings.contact_title||'تواصل معنا')}" placeholder="عنوان التواصل"><textarea id="aboutTextInput" placeholder="نص عن المنصة">${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</textarea><textarea id="contactTextInput" placeholder="نص تواصل معنا">${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</textarea></div><button onclick="saveFooterSections()">حفظ فقرات المتجر</button></div>`;
    adminContent.innerHTML+=extra;
  };
  window.saveFooterSections=async function(){
    await settingsSet('about_title',aboutTitleInput.value.trim()||'عن المنصة');
    await settingsSet('about_text',aboutTextInput.value.trim());
    await settingsSet('contact_title',contactTitleInput.value.trim()||'تواصل معنا');
    await settingsSet('contact_text',contactTextInput.value.trim());
    await audit('settings','تحديث فقرات نهاية المتجر');
    await load();
    renderSettingsAdmin();
    toast('تم حفظ فقرات نهاية المتجر');
  };
  const oldOpenPage=window.openPage;
  window.openPage=function(page){oldOpenPage(page);setTimeout(()=>{renderBottomInfo();document.title='منصة آلين';document.querySelectorAll('.version-badge').forEach(x=>x.textContent='منصة آلين');},80)};
})();

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
  const oldRenderBookletsAdmin37=window.renderBookletsAdmin;
  window.renderBookletsAdmin=function(){
    oldRenderBookletsAdmin37&&oldRenderBookletsAdmin37();
    try{
      document.querySelectorAll('#adminContent .row').forEach(row=>{
        const firstBtn=row.querySelector('button[onclick^="setBookStatus"]');
        const txt=row.querySelector('small')?.textContent||'';
        const idMatch=row.innerHTML.match(/setBookStatus\('([^']+)'/);
        if(firstBtn && idMatch && !row.innerHTML.includes('deleteBooklet')){
          const box=row.querySelector('.row-actions')||row;
          box.insertAdjacentHTML('beforeend',`<button class="danger" onclick="deleteBooklet('${idMatch[1]}')">حذف</button>`);
        }
      });
    }catch(e){}
  };
})();

/* ================= ALIN V39 BOOKLET SECTIONS + CLEAN CHECKOUT ================= */
let selectedBookletSection = '';
function bookletSectionName(b){ return (b.grade || b.subject || 'ملازم عامة').trim(); }
function bookletSections(){ return [...new Set((db.booklets||[]).filter(x=>x.status==='published').map(bookletSectionName).filter(Boolean))]; }
function chooseBookletSection(sec){ selectedBookletSection=sec||''; renderStore(); document.getElementById('storeGrid')?.scrollIntoView({behavior:'smooth',block:'start'}); }
const v39SetStoreType = window.setStoreType;
window.setStoreType = async function(type,btn){ selectedBookletSection=''; await v39SetStoreType(type,btn); };

window.storeItems=function(){
  if(db.settings.storeType==='booklet'){
    return (db.booklets||[]).filter(x=>x.status==='published' && (!selectedBookletSection || bookletSectionName(x)===selectedBookletSection)).map(x=>({kind:'booklet',id:x.id,title:x.title,subject:x.subject,grade:bookletSectionName(x),teacher:teacherName(x.teacher_id),price:x.price,cover:x.cover_path,stock:null}));
  }
  return (db.products||[]).filter(x=>x.type===db.settings.storeType&&x.status==='published').map(x=>({kind:x.type,id:x.id,title:x.name,subject:x.category,grade:x.category,teacher:'',price:x.price,cover:x.image_path,stock:x.stock}));
};

window.renderStore=function(){
  if(!window.storeGrid)return;
  try{ bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join(''); }catch(e){}
  const head=document.getElementById('storeProducts');
  if(db.settings.storeType==='booklet' && !selectedBookletSection){
    const secs=bookletSections();
    if(head) head.innerHTML=`<div class="section-title"><h2>أقسام الملازم</h2><p>اختر القسم حتى تظهر الملازم الخاصة به فقط</p></div>`;
    storeGrid.innerHTML=secs.map(sec=>`<article class="card section-card" onclick="chooseBookletSection('${esc(String(sec)).replace(/'/g,'&#39;')}')"><div class="cover">📘</div><h3>${esc(sec)}</h3><p>فتح ملازم هذا القسم</p><div class="product-actions"><button>دخول القسم</button></div></article>`).join('') || emptyState('لا توجد أقسام ملازم');
    renderCartBadge();
    return;
  }
  const titleMap={booklet:selectedBookletSection||'الملازم',stationery:'القرطاسية',gift:'الهدايا'};
  if(head) head.innerHTML=`<div class="section-title"><h2>${esc(titleMap[db.settings.storeType]||'المتجر')}</h2>${db.settings.storeType==='booklet'?`<button class="secondary" onclick="chooseBookletSection('')">رجوع للأقسام</button>`:''}</div>`;
  const list=storeItems();
  storeGrid.innerHTML=list.map(x=>`<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:(x.subject||'منتج')}</div><h3>${esc(x.title)}</h3>${x.teacher?`<p>${esc(x.teacher)}</p>`:''}<p>${esc(x.grade||x.subject||'')}</p>${x.stock!==null?`<p class="${x.stock<=5?'low-stock':''}">${x.stock<=0?'نافد':`المخزون: ${x.stock}`}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')" ${x.stock===0?'disabled':''}>أضف للسلة</button><button class="secondary" onclick="openCheckout('${x.kind}','${x.id}')">شراء مباشر</button></div></article>`).join('')||emptyState('لا توجد مواد داخل هذا القسم');
  renderCartBadge();
  try{ const about=document.getElementById('aboutPlatformBox'); if(about) about.innerHTML=`<h2>${esc(db.settings.about_title||'عن المنصة')}</h2><p>${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</p>`; const contact=document.getElementById('contactPlatformBox'); if(contact) contact.innerHTML=`<h2>${esc(db.settings.contact_title||'تواصل معنا')}</h2><p>${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</p>`; }catch(e){}
};

window.renderBookletsAdmin=function(){
  const cats=(db.categories||[]).filter(c=>c.type==='booklet'&&c.status!=='hidden'&&c.status!=='archived');
  const opt=cats.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  adminContent.innerHTML=`<h2>الملازم</h2><p class="muted">اختر قسم الملزمة حتى تظهر داخل قسمها فقط في المتجر، وليس مباشرة في واجهة المتجر الرئيسية.</p><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${db.accounts.teachers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><select name="section"><option value="">اختر القسم</option>${opt}</select><input name="newSection" placeholder="أو اكتب قسم جديد"><input name="subject" placeholder="المادة"><input name="price" type="number" placeholder="السعر"><label>غلاف<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF الحقيقي<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${(db.booklets||[]).map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${esc(bookletSectionName(x))} — ${teacherName(x.teacher_id)} — ${esc(x.file_name||'')} — ${esc(x.status||'')}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button onclick="setBookStatus('${x.id}','archived')">أرشفة</button><button class="danger" onclick="deleteBooklet('${x.id}')">حذف</button></div></div>`).join('')||emptyState('لا توجد ملازم')}`;
};

window.uploadBooklet=async function(){
  try{
    const f=new FormData(bookForm);
    const section=(f.get('newSection')||f.get('section')||'ملازم عامة').trim();
    if(!f.get('title') || !section || !f.get('teacherId')) throw new Error('أكمل اسم الملزمة والقسم والمدرس');
    if(f.get('newSection') && !(db.categories||[]).some(c=>c.type==='booklet'&&c.name===section)){
      try{ await insert('categories',{id:uid('C'),type:'booklet',name:section,status:'active'}); }catch(e){}
    }
    const cover=await uploadFile('covers',f.get('cover'),{type:'image'});
    const ti=await uploadFile('teachers',f.get('teacherImage'),{type:'image'});
    const pdfFile=f.get('bookletFile');
    if(!pdfFile||!pdfFile.name)throw new Error('ملف PDF مطلوب');
    const fp=await uploadFile('booklets',pdfFile,{required:true,type:'pdf'});
    await insert('booklets',{id:uid('B'),title:f.get('title'),teacher_id:f.get('teacherId'),subject:f.get('subject'),grade:section,price:+f.get('price'),cover_path:cover,teacher_image_path:ti,file_path:fp,file_name:pdfFile.name,status:'published'});
    await audit('booklet','نشر ملزمة '+f.get('title')+' في قسم '+section);
    await load(); renderBookletsAdmin(); toast('تم نشر الملزمة داخل قسمها');
  }catch(e){ alert(e.message); }
};

function libraryOptionsClean(){ return activeLibraries().map(x=>`<option value="${x.id}" ${libIsOpen(x)?'':'disabled'}>${esc(x.name)} - ${libIsOpen(x)?'مفتوح':'مغلق'}</option>`).join(''); }
function selectedLibraryLine(){ const lib=db.accounts.libraries.find(x=>x.id===libSelect?.value); if(!lib){libInfo.innerHTML='';return;} libInfo.innerHTML=`<div class="library-one-line"><b>${esc(lib.name)}</b><span class="${libIsOpen(lib)?'open-badge':'closed-badge'}">${libIsOpen(lib)?'مفتوح':'مغلق'}</span><small>${esc(lib.area||'')} ${lib.landmark?'— '+esc(lib.landmark):''}</small></div>`; }
window.showLibInfo=selectedLibraryLine;

window.openCart=function(){
  checkoutItem={kind:'cart'}; const sub=cart.reduce((a,x)=>a+x.price*x.qty,0);
  checkoutBox.innerHTML=`<h2>سلة آلين</h2><div class="cart-list">${cart.map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b><small>${money(x.price)} د.ع × ${x.qty}</small></div><div class="row-actions"><button onclick="cartQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="cartQty(${i},1)">+</button><button class="danger" onclick="cartRemove(${i})">حذف</button></div></div>`).join('')||emptyState('السلة فارغة')}</div>${cart.length?`<div class="checkout-total">المجموع: <b>${money(sub)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="كود الخصم"><button onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الهاتف"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${libraryOptionsClean()}</select><div id="libInfo"></div></div><button onclick="confirmCartCheckout()">تأكيد الطلب</button>`:''}`;
  checkoutModal.classList.remove('hidden');
};

window.openCheckout=function(kind,itemId){
  checkoutItem={kind,itemId};
  const item=kind==='booklet'?db.booklets.find(x=>x.id===itemId):db.products.find(x=>x.id===itemId);
  if(!item)return;
  const title=item.title||item.name, price=item.price||0;
  checkoutBox.innerHTML=`<h2>إتمام الطلب</h2><div class="row"><b>${esc(title)}</b><span>${money(price)} د.ع</span></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الطالب"><input id="qty" type="number" min="1" value="1" oninput="updateTotal()" placeholder="عدد النسخ"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر المكتبة</option>${libraryOptionsClean()}</select><div id="libInfo" class="checkout-total"></div><div class="checkout-total">المجموع: <b id="totalBox">${money(price)} د.ع</b></div></div><button onclick="confirmCheckout()">إنشاء الطلب</button><div id="payMsg"></div>`;
  checkoutModal.classList.remove('hidden');
};

/* ================= ALIN V42 CART DELIVERY + SETTLEMENT ROUTING ================= */
window.ALIN_VERSION='Alin Clean Cart Routing';
function cartHasNonBooklets(){ return (cart||[]).some(x=>x.kind!=='booklet'); }
function cartHasBookletsOnly(){ return (cart||[]).length>0 && (cart||[]).every(x=>x.kind==='booklet'); }
function deliveryChoiceCartHtml(){
  const forcedDelivery=cartHasNonBooklets();
  if(forcedDelivery){
    return `<h3>طريقة التسليم</h3><div class="delivery-choice"><label><input type="radio" name="fulfillment" value="home_delivery" checked> عن طريق المندوب</label></div><div id="deliveryFields"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">اختيار المندوب من الإدارة</option>${activeCouriers().map(c=>`<option value="${c.id}">${esc(c.name)} — ${esc(c.area||'')}</option>`).join('')}</select></div><div class="checkout-total">أجور التوصيل: <b>${money(deliveryFee())} د.ع</b></div></div><p class="muted">القرطاسية والهدايا يتم تسليمها عن طريق المندوب فقط.</p>`;
  }
  return `<h3>طريقة التسليم والدفع</h3><div class="delivery-choice"><label><input type="radio" name="fulfillment" value="pickup" checked onchange="toggleDeliveryFields()"> عن طريق المكتبة — الدفع للمكتبة</label><label><input type="radio" name="fulfillment" value="home_delivery" onchange="toggleDeliveryFields()"> عن طريق المندوب — الدفع للمندوب</label></div><div id="pickupFields"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${libraryOptionsClean()}</select><div id="libInfo"></div></div><div id="deliveryFields" class="hidden"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">اختيار المندوب من الإدارة</option>${activeCouriers().map(c=>`<option value="${c.id}">${esc(c.name)} — ${esc(c.area||'')}</option>`).join('')}</select></div><div class="checkout-total">أجور التوصيل: <b>${money(deliveryFee())} د.ع</b></div></div>`;
}
function orderExtraV42(){
  const forcedDelivery=cartHasNonBooklets();
  const f=forcedDelivery?'home_delivery':(document.querySelector('input[name="fulfillment"]:checked')?.value||'pickup');
  if(f==='pickup'){
    if(!libSelect?.value) throw Error('اختر مكتبة الاستلام');
    return {fulfillment_type:'pickup',library_id:libSelect.value,courier_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
  }
  if(!deliveryArea.value.trim()||!deliveryAddress.value.trim()||!deliveryLandmark.value.trim()) throw Error('أكمل بيانات التوصيل');
  return {fulfillment_type:'home_delivery',library_id:null,courier_id:courierSelect?.value||null,delivery_area:deliveryArea.value.trim(),delivery_address:deliveryAddress.value.trim(),delivery_landmark:deliveryLandmark.value.trim(),delivery_fee:deliveryFee(),payment_method:'cash_to_courier',payment_status:'cod_pending'};
}
window.renderStore=function(){
  if(!window.storeGrid)return;
  try{ bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join(''); }catch(e){}
  const head=document.getElementById('storeProducts');
  if(db.settings.storeType==='booklet' && !selectedBookletSection){
    const secs=bookletSections();
    if(head) head.innerHTML=`<div class="section-title"><h2>أقسام الملازم</h2><p>اختر القسم حتى تظهر الملازم الخاصة به فقط</p></div>`;
    storeGrid.innerHTML=secs.map(sec=>`<article class="card section-card" onclick="chooseBookletSection('${esc(String(sec)).replace(/'/g,'&#39;')}')"><div class="cover">📘</div><h3>${esc(sec)}</h3><p>فتح ملازم هذا القسم</p><div class="product-actions"><button>دخول القسم</button></div></article>`).join('') || emptyState('لا توجد أقسام ملازم');
    renderCartBadge();
    return;
  }
  const titleMap={booklet:selectedBookletSection||'الملازم',stationery:'القرطاسية',gift:'الهدايا'};
  if(head) head.innerHTML=`<div class="section-title"><h2>${esc(titleMap[db.settings.storeType]||'المتجر')}</h2>${db.settings.storeType==='booklet'?`<button class="secondary" onclick="chooseBookletSection('')">رجوع للأقسام</button>`:''}</div>`;
  const list=storeItems();
  storeGrid.innerHTML=list.map(x=>`<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:(x.subject||'منتج')}</div><h3>${esc(x.title)}</h3>${x.teacher?`<p>${esc(x.teacher)}</p>`:''}<p>${esc(x.grade||x.subject||'')}</p>${x.stock!==null?`<p class="${x.stock<=5?'low-stock':''}">${x.stock<=0?'نافد':`المخزون: ${x.stock}`}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')" ${x.stock===0?'disabled':''}>أضف للسلة</button></div></article>`).join('')||emptyState('لا توجد مواد داخل هذا القسم');
  renderCartBadge();
  try{ const about=document.getElementById('aboutPlatformBox'); if(about) about.innerHTML=`<h2>${esc(db.settings.about_title||'عن المنصة')}</h2><p>${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</p>`; const contact=document.getElementById('contactPlatformBox'); if(contact) contact.innerHTML=`<h2>${esc(db.settings.contact_title||'تواصل معنا')}</h2><p>${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</p>`; }catch(e){}
};
window.openCart=function(){
  checkoutItem={kind:'cart'}; const sub=cart.reduce((a,x)=>a+x.price*x.qty,0);
  checkoutBox.innerHTML=`<h2>سلة آلين</h2><div class="cart-list">${cart.map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b><small>${money(x.price)} د.ع × ${x.qty}</small></div><div class="row-actions"><button onclick="cartQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="cartQty(${i},1)">+</button><button class="danger" onclick="cartRemove(${i})">حذف</button></div></div>`).join('')||emptyState('السلة فارغة')}</div>${cart.length?`<div class="checkout-total">مجموع المواد: <b>${money(sub)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="كود الخصم"><button onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الهاتف"></div>${deliveryChoiceCartHtml()}<button onclick="confirmCartCheckout()">تأكيد الشراء</button>`:''}`;
  checkoutModal.classList.remove('hidden');
};
window.openCheckout=function(kind,itemId){ addToCart(kind,itemId); openCart(); };
window.confirmCartCheckout=async function(){try{
  if(!cart.length)throw Error('السلة فارغة');
  if(!studentName.value.trim()||!studentPhone.value.trim())throw Error('أكمل اسم الطالب ورقم الهاتف');
  const baseExtra=orderExtraV42();
  const coupon=validCoupon(couponInput?.value?.trim()||'');
  let deliveryAdded=false;
  for(const x of cart){
    const product=x.kind==='booklet'?null:db.products.find(p=>p.id===x.id);
    if(product&&+product.stock<x.qty)throw Error('الكمية غير متوفرة: '+x.title);
    let raw=x.price*x.qty,discount=0; if(coupon)discount=coupon.discount_type==='fixed'?Math.min(raw,+coupon.discount_value):Math.round(raw*(+coupon.discount_value/100));
    const extra={...baseExtra};
    if(extra.fulfillment_type==='home_delivery'){
      extra.delivery_fee=deliveryAdded?0:deliveryFee();
      deliveryAdded=true;
    }
    const total=raw-discount+(+extra.delivery_fee||0);
    const oid=uid('O'), num='AL-'+Date.now().toString().slice(-8)+'-'+Math.floor(Math.random()*90+10);
    await insert('orders',{id:oid,order_number:num,kind:x.kind,item_id:x.id,title:x.title,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),qty:x.qty,unit_price:x.price,total,discount,coupon_code:coupon?.code||null,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra});
  }
  if(coupon) await update('coupons',{used_count:(+coupon.used_count||0)+1},{id:coupon.id});
  await audit('order','إنشاء طلب من السلة - '+baseExtra.fulfillment_type);
  const msg=baseExtra.fulfillment_type==='pickup'?'تم إنشاء الطلب. التسليم والدفع عن طريق المكتبة وسيظهر في تسويات المكتبة.':'تم إنشاء الطلب. التسليم والدفع عن طريق المندوب وسيظهر في تسويات المندوب.';
  cart=[];cartSave();await load();checkoutBox.innerHTML=`<h2>تم استلام طلبك</h2><p>${msg}</p><button onclick="closeCheckout()">إغلاق</button>`;
}catch(e){alert(e.message)}};
window.maybeCreateFinancialEntry=async function(id){
  const o=(db.orders||[]).find(x=>x.id===id); if(!o) return;
  o.status='completed'; o.payment_status='paid';
  if(typeof ensureOrderFinancials==='function') await ensureOrderFinancials(o);
};
window.orderStatus=async function(id,status){
  const o=(db.orders||[]).find(x=>x.id===id); if(!o)return;
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,payment_status:status==='completed'?'paid':(o.payment_status||'cod_pending'),status_history:h},{id});
  o.status=status; o.status_history=h; if(status==='completed') await maybeCreateFinancialEntry(id);
  await audit('order','تحديث الطلب '+(o.order_number||id)+' إلى '+status); await load(); renderOrdersAdmin(); toast('تم تحديث الطلب');
};
async function recordCourierSettlementForOrder(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  const amount=+(prompt('مبلغ تسوية المندوب', String(o.total||0))||0); if(amount<=0)return alert('المبلغ غير صحيح');
  const method=prompt('طريقة التسوية','نقدي')||'نقدي';
  const receipt='CR-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  await insert('courier_settlements',{id:uid('CS'),receipt_number:receipt,courier_id:o.courier_id||'',amount,payment_method:method,note:'تسوية طلب '+(o.order_number||o.id),status:'received'});
  await audit('courier','تسوية مندوب للطلب '+(o.order_number||o.id)); await load(); renderCourierSettlementsAdmin();
}
window.renderCourierSettlementsAdmin=function(){
  const deliveryOrders=(db.orders||[]).filter(o=>o.fulfillment_type==='home_delivery');
  adminContent.innerHTML='<h2>تسويات المندوبين</h2><p class="muted">كل طلب توصيل يظهر هنا. المندوب يستلم المبلغ من الطالب ثم يسلم للإدارة بسند تسوية.</p>'+deliveryOrders.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.id)} — ${esc(o.title)}</b><small>الطالب: ${esc(o.student_name)} • ${esc(o.delivery_area||'')} ${esc(o.delivery_address||'')} • المبلغ ${money(o.total)} د.ع • الحالة ${esc(o.status||'')}</small></div><div class="row-actions"><select id="assign_${o.id}"><option value="">مندوب</option>${couriers.map(c=>`<option value="${c.id}" ${o.courier_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button onclick="assignCourier('${o.id}')">حفظ</button><button onclick="courierOrderStatus('${o.id}','out_for_delivery')">قيد التوصيل</button><button onclick="courierOrderStatus('${o.id}','completed')">تم التسليم</button><button onclick="recordCourierSettlementForOrder('${o.id}')">تسجيل تسوية</button></div></div>`).join('')+(deliveryOrders.length?'':'لا توجد طلبات توصيل')+'<h3>سندات تسوية المندوبين</h3>'+(courierSettlements.map(s=>`<div class="row"><div><b>${esc(s.receipt_number)}</b><small>${esc((couriers.find(c=>c.id===s.courier_id)||{}).name||'مندوب')} — ${esc(s.payment_method||'')}</small></div><span>${money(s.amount)} د.ع</span></div>`).join('')||emptyState('لا توجد تسويات'));
};
window.renderOrdersAdmin=function(){
  const labels={pickup:'عن طريق المكتبة',home_delivery:'عن طريق المندوب'};
  adminContent.innerHTML='<h2>الطلبات</h2>'+(db.orders.length?db.orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)} — ${esc(x.title)} × ${x.qty}</b><small>${esc(x.student_name)} — ${esc(x.student_phone||'')} — ${money(x.total)} د.ع — ${labels[x.fulfillment_type]||'استلام'} — ${esc(x.status||'')}</small></div><div class="row-actions">${x.fulfillment_type==='home_delivery'?`<button onclick="adminTab('courierSettlements')">تسويات المندوب</button>`:`<button onclick="adminTab('finance')">تسويات المكتبة</button>`}<button onclick="orderStatus('${x.id}','processing')">تجهيز</button><button onclick="orderStatus('${x.id}','ready')">جاهز</button><button onclick="orderStatus('${x.id}','completed')">تم التسليم</button><button class="danger" onclick="orderStatus('${x.id}','cancelled')">إلغاء</button></div></div>`).join(''):emptyState('لا توجد طلبات'));
};


/* ================= ALIN V43 ADMIN BOOKLETS NO SECTION + STORE SEARCH ================= */
window.ALIN_VERSION='Alin V43 Store Search No Booklet Section';
function alinStoreSearchText(){ return String(document.getElementById('searchInput')?.value||'').trim().toLowerCase(); }
function alinBookletTeacher(b){ return teacherName(b.teacher_id); }
window.storeItems=function(){
  if(db.settings.storeType==='booklet'){
    const q=alinStoreSearchText();
    return (db.booklets||[])
      .filter(x=>x.status==='published')
      .map(x=>({kind:'booklet',id:x.id,title:x.title||'',subject:x.subject||'',grade:x.subject||'',teacher:alinBookletTeacher(x),price:x.price,cover:x.cover_path,stock:null}))
      .filter(x=>!q || (`${x.title} ${x.teacher} ${x.subject}`).toLowerCase().includes(q));
  }
  return (db.products||[])
    .filter(x=>x.type===db.settings.storeType&&x.status==='published')
    .map(x=>({kind:x.type,id:x.id,title:x.name||'',subject:x.category||'',grade:x.category||'',teacher:'',price:x.price,cover:x.image_path,stock:x.stock}));
};
window.setStoreType=async function(type){
  selectedBookletSection='';
  db.settings.storeType=type;
  try{ await saveSetting('storeType',type); }catch(e){}
  renderStore();
};
window.renderStore=function(){
  if(!window.storeGrid)return;
  try{ bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join(''); }catch(e){}
  const head=document.getElementById('storeProducts');
  const q=alinStoreSearchText();
  const titleMap={booklet:'الملازم',stationery:'القرطاسية',gift:'الهدايا'};
  if(head){
    head.innerHTML=`<div class="section-title"><h2>${esc(titleMap[db.settings.storeType]||'المتجر')}</h2>${db.settings.storeType==='booklet'&&q?`<p>نتائج البحث عن: ${esc(q)}</p>`:''}</div>`;
  }
  const list=storeItems();
  storeGrid.innerHTML=list.map(x=>`<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:(x.subject||'منتج')}</div><h3>${esc(x.title)}</h3>${x.teacher?`<p>${esc(x.teacher)}</p>`:''}<p>${esc(x.subject||'')}</p>${x.stock!==null?`<p class="${x.stock<=5?'low-stock':''}">${x.stock<=0?'نافد':`المخزون: ${x.stock}`}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')" ${x.stock===0?'disabled':''}>أضف للسلة</button></div></article>`).join('')||emptyState(db.settings.storeType==='booklet'?'لا توجد ملازم مطابقة للبحث':'لا توجد مواد');
  renderCartBadge();
  try{ const about=document.getElementById('aboutPlatformBox'); if(about) about.innerHTML=`<h2>${esc(db.settings.about_title||'عن المنصة')}</h2><p>${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</p>`; const contact=document.getElementById('contactPlatformBox'); if(contact) contact.innerHTML=`<h2>${esc(db.settings.contact_title||'تواصل معنا')}</h2><p>${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</p>`; }catch(e){}
};
window.renderBookletsAdmin=function(){
  adminContent.innerHTML=`<h2>الملازم</h2><p class="muted">أضف الملزمة باسمها والمدرس والمادة. لا يوجد اختيار قسم داخل صفحة الملازم.</p><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${db.accounts.teachers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="price" type="number" placeholder="السعر"><label>غلاف<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF الحقيقي<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${(db.booklets||[]).map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${teacherName(x.teacher_id)} — ${esc(x.subject||'')} — ${esc(x.file_name||'')} — ${esc(x.status||'')}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button onclick="setBookStatus('${x.id}','archived')">أرشفة</button><button class="danger" onclick="deleteBooklet('${x.id}')">حذف</button></div></div>`).join('')||emptyState('لا توجد ملازم')}`;
};
window.uploadBooklet=async function(){
  try{
    const f=new FormData(bookForm);
    const title=String(f.get('title')||'').trim();
    const subject=String(f.get('subject')||'').trim();
    const teacherId=String(f.get('teacherId')||'').trim();
    if(!title || !teacherId) throw new Error('أكمل اسم الملزمة والمدرس');
    const cover=await uploadFile('covers',f.get('cover'),{type:'image'});
    const ti=await uploadFile('teachers',f.get('teacherImage'),{type:'image'});
    const pdfFile=f.get('bookletFile');
    if(!pdfFile||!pdfFile.name)throw new Error('ملف PDF مطلوب');
    const fp=await uploadFile('booklets',pdfFile,{required:true,type:'pdf'});
    await insert('booklets',{id:uid('B'),title:title,teacher_id:teacherId,subject:subject,grade:'',price:+f.get('price'),cover_path:cover,teacher_image_path:ti,file_path:fp,file_name:pdfFile.name,status:'published'});
    await audit('booklet','نشر ملزمة '+title);
    await load(); renderBookletsAdmin(); toast('تم نشر الملزمة');
  }catch(e){ alert(e.message); }
};

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
window.storeItems=function(){
  if(db.settings.storeType==='booklet'){
    const q=String(document.getElementById('searchInput')?.value||'').trim().toLowerCase();
    return (db.booklets||[]).filter(x=>x.status==='published').map(x=>({kind:'booklet',id:x.id,title:x.title||'',subject:x.subject||'',grade:x.subject||'',teacher:teacherName(x.teacher_id),price:x.price,cover:x.cover_path,stock:null})).filter(x=>!q || (`${x.title} ${x.teacher} ${x.subject}`).toLowerCase().includes(q));
  }
  return (db.products||[]).filter(x=>x.type===db.settings.storeType&&x.status==='published').map(x=>({kind:x.type,id:x.id,title:x.name||'',subject:x.category||'',grade:x.category||'',teacher:'',price:x.price,cover:x.image_path,stock:x.stock}));
};
window.renderStore=function(){
  if(!window.storeGrid)return;
  try{ bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join(''); }catch(e){}
  const head=document.getElementById('storeProducts');
  const q=String(document.getElementById('searchInput')?.value||'').trim();
  const titleMap={booklet:'الملازم',stationery:'القرطاسية',gift:'الهدايا'};
  if(head) head.innerHTML=`<div class="section-title"><h2>${esc(titleMap[db.settings.storeType]||'المتجر')}</h2>${db.settings.storeType==='booklet'&&q?`<p>نتائج البحث عن: ${esc(q)}</p>`:''}</div>`;
  const list=storeItems();
  storeGrid.innerHTML=list.map(x=>`<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}">`:(x.subject||'منتج')}</div><h3>${esc(x.title)}</h3>${x.teacher?`<p>${esc(x.teacher)}</p>`:''}<p>${esc(x.subject||'')}</p>${x.stock!==null?`<p class="${x.stock<=5?'low-stock':''}">${x.stock<=0?'نافد':`المخزون: ${x.stock}`}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')" ${x.stock===0?'disabled':''}>أضف للسلة</button></div></article>`).join('')||emptyState(db.settings.storeType==='booklet'?'لا توجد ملازم مطابقة للبحث':'لا توجد مواد');
  renderCartBadge();
  try{ const about=document.getElementById('aboutPlatformBox'); if(about) about.innerHTML=`<h2>${esc(db.settings.about_title||'عن المنصة')}</h2><p>${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</p>`; const contact=document.getElementById('contactPlatformBox'); if(contact) contact.innerHTML=`<h2>${esc(db.settings.contact_title||'تواصل معنا')}</h2><p>${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</p>`; }catch(e){}
};

window.renderBookletsAdmin=function(){
  adminContent.innerHTML=`<h2>الملازم</h2><p class="muted">أضف الملزمة باسمها والمدرس والمادة فقط. لا يوجد نظام أقسام داخل الملازم.</p><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${db.accounts.teachers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="price" type="number" placeholder="السعر"><label>غلاف<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF الحقيقي<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${(db.booklets||[]).map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${teacherName(x.teacher_id)} — ${esc(x.subject||'')} — ${esc(x.file_name||'')} — ${esc(x.status||'')}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button onclick="setBookStatus('${x.id}','archived')">أرشفة</button><button class="danger" onclick="deleteBooklet('${x.id}')">حذف</button></div></div>`).join('')||emptyState('لا توجد ملازم')}`;
};
window.uploadBooklet=async function(){
  try{
    const f=new FormData(bookForm);
    const title=String(f.get('title')||'').trim(), subject=String(f.get('subject')||'').trim(), teacherId=String(f.get('teacherId')||'').trim();
    if(!title||!teacherId) throw new Error('أكمل اسم الملزمة والمدرس');
    const cover=await uploadFile('covers',f.get('cover'),{type:'image'});
    const ti=await uploadFile('teachers',f.get('teacherImage'),{type:'image'});
    const pdfFile=f.get('bookletFile'); if(!pdfFile||!pdfFile.name) throw new Error('ملف PDF مطلوب');
    const fp=await uploadFile('booklets',pdfFile,{required:true,type:'pdf'});
    await insert('booklets',{id:uid('B'),title,teacher_id:teacherId,subject,grade:'',price:+f.get('price'),cover_path:cover,teacher_image_path:ti,file_path:fp,file_name:pdfFile.name,status:'published'});
    await audit('booklet','نشر ملزمة '+title); await load(); renderBookletsAdmin(); toast('تم نشر الملزمة');
  }catch(e){ alert(e.message); }
};

// كل طلب من السلة يظهر للطالب كود تتبع واضح بعد تأكيد الشراء
window.confirmCartCheckout=async function(){try{
  if(!cart.length)throw Error('السلة فارغة');
  if(!studentName.value.trim()||!studentPhone.value.trim())throw Error('أكمل اسم الطالب ورقم الهاتف');
  const baseExtra=orderExtraV42();
  const coupon=validCoupon(couponInput?.value?.trim()||'');
  let deliveryAdded=false;
  const numbers=[];
  for(const x of cart){
    const product=x.kind==='booklet'?null:db.products.find(p=>p.id===x.id);
    if(product&&+product.stock<x.qty)throw Error('الكمية غير متوفرة: '+x.title);
    let raw=x.price*x.qty,discount=0;
    if(coupon)discount=coupon.discount_type==='fixed'?Math.min(raw,+coupon.discount_value):Math.round(raw*(+coupon.discount_value/100));
    const extra={...baseExtra};
    if(extra.fulfillment_type==='home_delivery'){ extra.delivery_fee=deliveryAdded?0:deliveryFee(); deliveryAdded=true; }
    const total=raw-discount+(+extra.delivery_fee||0);
    const oid=uid('O'), num=alinOrderNumber();
    numbers.push(num);
    await insert('orders',{id:oid,order_number:num,tracking_code:num,kind:x.kind,item_id:x.id,title:x.title,student_name:studentName.value.trim(),student_phone:studentPhone.value.trim(),qty:x.qty,unit_price:x.price,total,discount,coupon_code:coupon?.code||null,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra});
  }
  if(coupon) await update('coupons',{used_count:(+coupon.used_count||0)+1},{id:coupon.id});
  await audit('order','إنشاء طلب من السلة مع كود تتبع');
  const msg=baseExtra.fulfillment_type==='pickup'?'التسليم والدفع عن طريق المكتبة.':'التسليم والدفع عن طريق المندوب.';
  cart=[];cartSave();await load();checkoutBox.innerHTML=alinTrackingResultHtml(numbers,msg);
}catch(e){alert(e.message)}};

// احتياطاً: إذا انفتح شراء مباشر بأي مكان، يحوله للسلة حتى لا تضيع أكواد التتبع
window.openCheckout=function(kind,itemId){ addToCart(kind,itemId); openCart(); };


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
const renderStoreBeforeStudentAuth=window.renderStore;
window.renderStore=function(){ renderStoreBeforeStudentAuth(); updateStudentAuthBar(); };

// تعبئة بيانات الطالب تلقائياً إذا كان مسجل، بدون جعل التسجيل إجباري
const openCartBeforeStudentAuth=window.openCart;
window.openCart=function(){
  openCartBeforeStudentAuth();
  setTimeout(()=>{
    const s=currentStudent(); if(!s)return;
    const n=document.getElementById('studentName'), p=document.getElementById('studentPhone'), a=document.getElementById('deliveryAddress');
    if(n&&!n.value)n.value=s.name||''; if(p&&!p.value)p.value=s.phone||''; if(a&&!a.value)a.value=s.address||'';
  },50);
};

// ربط الطلب برقم حساب الطالب إذا كان مسجل، مع بقاء الطلب متاحاً للزائر
const confirmCartBeforeStudentAuth=window.confirmCartCheckout;
window.confirmCartCheckout=async function(){
  const s=currentStudent();
  await confirmCartBeforeStudentAuth();
  try{ if(s) await audit('student_order','طلب من حساب طالب '+s.phone); }catch(e){}
};

document.addEventListener('DOMContentLoaded', updateStudentAuthBar);


/* ================= ALIN V46 STORE SEARCH VISIBLE ================= */
document.addEventListener('DOMContentLoaded', function(){
  const si=document.getElementById('searchInput');
  if(si && !si.dataset.alinBound){
    si.dataset.alinBound='1';
    si.addEventListener('input', function(){ try{ renderStore(); }catch(e){} });
  }
});


/* ================= ALIN V47 FULL CHECK + FINAL OVERRIDES ================= */
window.ALIN_VERSION='Alin V47 Full Check Fix';

function alinSafe(id){ return document.getElementById(id); }
function alinSearchText(){ return String(alinSafe('searchInput')?.value || '').trim().toLowerCase(); }
function alinItemTitle(x){ return x.title || x.name || ''; }
function alinOrderNo(){ return 'ALIN-' + new Date().toISOString().slice(2,10).replaceAll('-','') + '-' + Math.floor(1000 + Math.random()*9000); }
function alinOpenLibraries(){ return (db.accounts?.libraries||[]).filter(x=>x.status==='active'); }
function alinLibOpen(x){ try{return typeof libIsOpen==='function' ? libIsOpen(x) : x?.is_open!==false;}catch(e){return x?.is_open!==false;} }
function alinLibraryOptions(){
  return alinOpenLibraries().map(x=>`<option value="${x.id}" ${alinLibOpen(x)?'':'disabled'}>${esc(x.name)} - ${alinLibOpen(x)?'مفتوح':'مغلق'}</option>`).join('');
}
window.libraryOptionsClean=alinLibraryOptions;
window.showLibInfo=function(){
  const select=alinSafe('libSelect'), box=alinSafe('libInfo'); if(!select||!box)return;
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===select.value);
  if(!lib){ box.innerHTML=''; return; }
  box.innerHTML=`<div class="library-one-line"><b>${esc(lib.name)}</b><span class="${alinLibOpen(lib)?'open-badge':'closed-badge'}">${alinLibOpen(lib)?'مفتوح':'مغلق'}</span><small>${esc(lib.area||'')} ${lib.landmark?'— '+esc(lib.landmark):''}</small></div>`;
};

window.setStoreType=async function(type){
  db.settings.storeType=type||'booklet';
  try{ if(typeof saveSetting==='function') await saveSetting('storeType',db.settings.storeType); }catch(e){}
  renderStore();
};

window.storeItems=function(){
  const type=db.settings?.storeType||'booklet';
  const q=alinSearchText();
  if(type==='booklet'){
    return (db.booklets||[])
      .filter(x=>x.status==='published')
      .map(x=>({kind:'booklet',id:x.id,title:x.title||'',subject:x.subject||'',teacher:teacherName(x.teacher_id),price:+x.price||0,cover:x.cover_path,stock:null}))
      .filter(x=>!q || (`${x.title} ${x.teacher} ${x.subject}`).toLowerCase().includes(q));
  }
  return (db.products||[])
    .filter(x=>x.type===type && x.status==='published')
    .map(x=>({kind:x.type,id:x.id,title:x.name||'',subject:x.category||'',teacher:'',price:+x.price||0,cover:x.image_path,stock:+x.stock||0}));
};

window.renderStore=function(){
  if(!alinSafe('storeGrid')) return;
  try{
    if(window.bannerBox) bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title)}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join('');
  }catch(e){}
  const type=db.settings?.storeType||'booklet';
  const labels={booklet:'الملازم',stationery:'القرطاسية',gift:'الهدايا'};
  const q=alinSearchText();
  const head=alinSafe('storeProducts');
  if(head) head.innerHTML=`<div class="section-title"><h2>${esc(labels[type]||'المتجر')}</h2>${type==='booklet'&&q?`<p>نتائج البحث عن: ${esc(q)}</p>`:''}</div>`;
  const list=storeItems();
  storeGrid.innerHTML=list.map(x=>`<article class="card"><div class="cover">${x.cover?`<img src="${mediaUrl(x.cover)}" alt="${esc(x.title)}">`:esc(x.subject||'منتج')}</div><h3>${esc(x.title)}</h3>${x.teacher?`<p>${esc(x.teacher)}</p>`:''}<p>${esc(x.subject||'')}</p>${x.stock!==null?`<p class="${x.stock<=5?'low-stock':''}">${x.stock<=0?'نافد':`المخزون: ${x.stock}`}</p>`:''}<div class="price">${money(x.price)} د.ع</div><div class="product-actions"><button onclick="addToCart('${x.kind}','${x.id}')" ${x.stock===0?'disabled':''}>أضف للسلة</button></div></article>`).join('') || emptyState(type==='booklet'?'لا توجد ملازم مطابقة للبحث':'لا توجد مواد');
  try{
    if(window.alinStatBooklets) alinStatBooklets.textContent=(db.booklets||[]).filter(x=>x.status==='published').length;
    if(window.alinStatOrders) alinStatOrders.textContent=(db.orders||[]).length;
    if(window.alinStatTeachers) alinStatTeachers.textContent=(db.accounts?.teachers||[]).filter(x=>x.status==='active').length;
    if(window.alinStatLibraries) alinStatLibraries.textContent=(db.accounts?.libraries||[]).filter(x=>x.status==='active').length;
    const about=alinSafe('aboutPlatformBox'); if(about) about.innerHTML=`<h2>${esc(db.settings.about_title||'عن المنصة')}</h2><p>${esc(db.settings.about_text||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.')}</p>`;
    const contact=alinSafe('contactPlatformBox'); if(contact) contact.innerHTML=`<h2>${esc(db.settings.contact_title||'تواصل معنا')}</h2><p>${esc(db.settings.contact_text||'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.')}</p>`;
    if(typeof updateStudentAuthBar==='function') updateStudentAuthBar();
  }catch(e){}
  try{ renderCartBadge(); }catch(e){}
};

window.renderBookletsAdmin=function(){
  if(!window.adminContent)return;
  adminContent.innerHTML=`<h2>الملازم</h2><p class="muted">إضافة الملزمة بدون أقسام: اسم الملزمة، المدرس، المادة، السعر، الغلاف، وصورة المدرس وملف PDF.</p><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${(db.accounts?.teachers||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="price" type="number" placeholder="السعر"><label>غلاف الملزمة<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF<input name="bookletFile" type="file" accept=".pdf,application/pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${(db.booklets||[]).map(x=>`<div class="row"><div><b>${esc(x.title)}</b><small>${esc(teacherName(x.teacher_id))} — ${esc(x.subject||'')} — ${esc(x.file_name||'')} — ${esc(x.status||'')}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button onclick="setBookStatus('${x.id}','archived')">أرشفة</button><button class="danger" onclick="deleteBooklet('${x.id}')">حذف</button></div></div>`).join('')||emptyState('لا توجد ملازم')}`;
};

window.uploadBooklet=async function(){
  try{
    const f=new FormData(bookForm);
    const title=String(f.get('title')||'').trim(), teacherId=String(f.get('teacherId')||'').trim(), subject=String(f.get('subject')||'').trim();
    if(!title||!teacherId) throw new Error('أكمل اسم الملزمة والمدرس');
    const pdfFile=f.get('bookletFile');
    if(!pdfFile||!pdfFile.name) throw new Error('ملف PDF مطلوب');
    const cover=await uploadFile('covers', f.get('cover'), {type:'image'});
    const teacherImage=await uploadFile('teachers', f.get('teacherImage'), {type:'image'});
    const filePath=await uploadFile('booklets', pdfFile, {required:true,type:'pdf'});
    await insert('booklets',{id:uid('B'),title,teacher_id:teacherId,subject,grade:'',price:+f.get('price')||0,cover_path:cover,teacher_image_path:teacherImage,file_path:filePath,file_name:pdfFile.name,status:'published'});
    await audit('booklet','نشر ملزمة '+title); await load(); renderBookletsAdmin(); toast('تم نشر الملزمة');
  }catch(e){ alert(e.message||'تعذر رفع الملزمة'); }
};

function alinCartHasProducts(){ return (cart||[]).some(x=>x.kind!=='booklet'); }
function alinDeliveryFee(){ try{return typeof deliveryFee==='function'?deliveryFee():0;}catch(e){return 0;} }
function alinCouriersOptions(){ try{return (typeof activeCouriers==='function'?activeCouriers():[]).map(c=>`<option value="${c.id}">${esc(c.name)}${c.area?' — '+esc(c.area):''}</option>`).join('');}catch(e){return '';} }
window.toggleDeliveryFields=function(){
  const f=document.querySelector('input[name="fulfillment"]:checked')?.value||'pickup';
  const p=alinSafe('pickupFields'), d=alinSafe('deliveryFields');
  if(p) p.classList.toggle('hidden', f!=='pickup');
  if(d) d.classList.toggle('hidden', f!=='home_delivery');
};
function alinDeliveryChoiceHtml(){
  if(alinCartHasProducts()){
    return `<h3>طريقة التسليم</h3><div class="delivery-choice"><label><input type="radio" name="fulfillment" value="home_delivery" checked> عن طريق المندوب</label></div><div id="deliveryFields"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">تحديد المندوب من الإدارة</option>${alinCouriersOptions()}</select></div><div class="checkout-total">أجور التوصيل: <b>${money(alinDeliveryFee())} د.ع</b></div></div><p class="muted">القرطاسية والهدايا تسلّم عن طريق المندوب فقط.</p>`;
  }
  return `<h3>طريقة التسليم والدفع</h3><div class="delivery-choice"><label><input type="radio" name="fulfillment" value="pickup" checked onchange="toggleDeliveryFields()"> عن طريق المكتبة — الدفع للمكتبة</label><label><input type="radio" name="fulfillment" value="home_delivery" onchange="toggleDeliveryFields()"> عن طريق المندوب — الدفع للمندوب</label></div><div id="pickupFields"><select id="libSelect" onchange="showLibInfo()"><option value="">اختر مكتبة الاستلام</option>${alinLibraryOptions()}</select><div id="libInfo"></div></div><div id="deliveryFields" class="hidden"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">تحديد المندوب من الإدارة</option>${alinCouriersOptions()}</select></div><div class="checkout-total">أجور التوصيل: <b>${money(alinDeliveryFee())} د.ع</b></div></div>`;
}
function alinOrderExtra(){
  const forced=alinCartHasProducts();
  const f=forced?'home_delivery':(document.querySelector('input[name="fulfillment"]:checked')?.value||'pickup');
  if(f==='pickup'){
    const lib=alinSafe('libSelect')?.value||''; if(!lib) throw new Error('اختر مكتبة الاستلام');
    return {fulfillment_type:'pickup',library_id:lib,courier_id:null,delivery_area:null,delivery_address:null,delivery_landmark:null,delivery_fee:0,payment_method:'cash_at_library',payment_status:'cod_pending'};
  }
  const area=(alinSafe('deliveryArea')?.value||'').trim(), addr=(alinSafe('deliveryAddress')?.value||'').trim(), land=(alinSafe('deliveryLandmark')?.value||'').trim();
  if(!area||!addr||!land) throw new Error('أكمل بيانات التوصيل');
  return {fulfillment_type:'home_delivery',library_id:null,courier_id:alinSafe('courierSelect')?.value||null,delivery_area:area,delivery_address:addr,delivery_landmark:land,delivery_fee:alinDeliveryFee(),payment_method:'cash_to_courier',payment_status:'cod_pending'};
}
window.openCart=function(){
  checkoutItem={kind:'cart'};
  const sub=(cart||[]).reduce((a,x)=>a+(+x.price||0)*(+x.qty||0),0);
  checkoutBox.innerHTML=`<h2>سلة آلين</h2><div class="cart-list">${(cart||[]).map((x,i)=>`<div class="row"><div><b>${esc(x.title)}</b><small>${money(x.price)} د.ع × ${x.qty}</small></div><div class="row-actions"><button onclick="cartQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="cartQty(${i},1)">+</button><button class="danger" onclick="cartRemove(${i})">حذف</button></div></div>`).join('')||emptyState('السلة فارغة')}</div>${cart.length?`<div class="checkout-total">مجموع المواد: <b>${money(sub)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="كود الخصم"><button onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><div class="form-grid"><input id="studentName" placeholder="اسم الطالب"><input id="studentPhone" placeholder="رقم الهاتف"></div>${alinDeliveryChoiceHtml()}<button onclick="confirmCartCheckout()">تأكيد الشراء</button>`:''}`;
  checkoutModal.classList.remove('hidden');
  try{ const s=typeof currentStudent==='function'?currentStudent():null; if(s){ if(studentName&&!studentName.value)studentName.value=s.name||''; if(studentPhone&&!studentPhone.value)studentPhone.value=s.phone||''; if(alinSafe('deliveryAddress')&&!deliveryAddress.value)deliveryAddress.value=s.address||''; } }catch(e){}
};
window.openCheckout=function(kind,itemId){ addToCart(kind,itemId); openCart(); };
window.confirmCartCheckout=async function(){
  try{
    if(!cart.length) throw new Error('السلة فارغة');
    const name=(alinSafe('studentName')?.value||'').trim(), phone=(alinSafe('studentPhone')?.value||'').trim();
    if(!name||!phone) throw new Error('أكمل اسم الطالب ورقم الهاتف');
    const baseExtra=alinOrderExtra();
    const coupon=typeof validCoupon==='function' ? validCoupon(alinSafe('couponInput')?.value?.trim()||'') : null;
    let deliveryAdded=false; const numbers=[];
    for(const x of cart){
      const product=x.kind==='booklet'?null:(db.products||[]).find(p=>p.id===x.id);
      if(product && (+product.stock||0)<(+x.qty||1)) throw new Error('الكمية غير متوفرة: '+x.title);
      const raw=(+x.price||0)*(+x.qty||1);
      let discount=0; if(coupon) discount=coupon.discount_type==='fixed'?Math.min(raw,+coupon.discount_value||0):Math.round(raw*((+coupon.discount_value||0)/100));
      const extra={...baseExtra}; if(extra.fulfillment_type==='home_delivery'){ extra.delivery_fee=deliveryAdded?0:alinDeliveryFee(); deliveryAdded=true; }
      const total=raw-discount+(+extra.delivery_fee||0); const id=uid('O'), num=alinOrderNo(); numbers.push(num);
      await insert('orders',{id,order_number:num,kind:x.kind,item_id:x.id,title:x.title,student_name:name,student_phone:phone,qty:+x.qty||1,unit_price:+x.price||0,total,discount,coupon_code:coupon?.code||null,status:'new',status_history:[{status:'new',at:new Date().toISOString()}],...extra});
    }
    if(coupon) try{ await update('coupons',{used_count:(+coupon.used_count||0)+1},{id:coupon.id}); }catch(e){}
    await audit('order','إنشاء طلب من السلة مع كود تتبع');
    const msg=baseExtra.fulfillment_type==='pickup'?'التسليم والدفع عن طريق المكتبة.':'التسليم والدفع عن طريق المندوب.';
    cart=[]; cartSave(); await load(); checkoutBox.innerHTML=alinTrackingResultHtml(numbers,msg);
  }catch(e){ alert(e.message||'تعذر إنشاء الطلب'); }
};

const alinAdminTabBeforeV47=window.adminTab;
window.adminTab=function(t){
  window.activeAdminTab=t;
  if(t==='booklets') return renderBookletsAdmin();
  if(t==='teacherRequests' && typeof renderTeacherRequestsAdmin==='function') return renderTeacherRequestsAdmin();
  if(t==='libraryRequests' && typeof renderLibraryRequestsAdmin==='function') return renderLibraryRequestsAdmin();
  if(t==='couriers' && typeof renderCouriersAdmin==='function') return renderCouriersAdmin();
  if(t==='courierSettlements' && typeof renderCourierSettlementsAdmin==='function') return renderCourierSettlementsAdmin();
  if(t==='coupons' && typeof renderCouponsAdmin==='function') return renderCouponsAdmin();
  if(t==='notifications' && typeof renderNotificationsAdmin==='function') return renderNotificationsAdmin();
  return alinAdminTabBeforeV47 ? alinAdminTabBeforeV47(t) : null;
};

window.addEventListener('error', function(e){ console.warn('ALIN caught error:', e.message); });
document.addEventListener('DOMContentLoaded', function(){
  const si=alinSafe('searchInput'); if(si && !si.dataset.v47){ si.dataset.v47='1'; si.addEventListener('input', ()=>{try{renderStore()}catch(e){}}); }
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

window.openLibraryBookletPdf=async function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  if(!o || o.kind!=='booklet') return alert('هذا الطلب لا يحتوي ملزمة PDF');
  const b=(db.booklets||[]).find(x=>x.id===o.item_id);
  if(!b?.file_path) return alert('لا يوجد ملف PDF لهذه الملزمة');

  checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="pdf-viewer loading-box">جاري فتح ملف PDF...</div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');

  const resolved=await alinResolveStoredFile(b.file_path,'booklets');
  if(!resolved){
    checkoutBox.innerHTML=`<h2>تعذر فتح الملزمة</h2><div class="empty">ملف PDF غير موجود أو لا يمكن قراءته من التخزين.</div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    return;
  }

  if(resolved.path!==b.file_path){
    try{ await update('booklets',{file_path:resolved.path},{id:b.id}); b.file_path=resolved.path; }catch(e){}
  }

  const directUrl = resolved.url;
  checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="pdf-viewer"><iframe id="pdfFrame" src="${directUrl}#toolbar=0&navpanes=0&scrollbar=1" type="application/pdf"></iframe></div><div class="row-actions no-print"><button onclick="window.open('${directUrl}','_blank')">فتح PDF</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
};

/* ===== end ALIN V50 ===== */


/* ===== ALIN V55: automatic profit and settlement distribution ===== */
function alinNumberV55(v){ return Number(v||0) || 0; }

function alinOrderTotalV55(order){
  if(!order) return 0;
  if(order.total) return alinNumberV55(order.total);
  const qty = alinNumberV55(order.quantity || order.qty || 1) || 1;
  if(order.price) return alinNumberV55(order.price) * qty;
  const itemId = order.item_id || order.booklet_id || order.product_id;
  const b = (db.booklets||[]).find(x => x.id === itemId);
  const p = (db.products||[]).find(x => x.id === itemId);
  return alinNumberV55((b||p||{}).price) * qty;
}

function alinBookletFromOrderV55(order){
  const itemId = order?.item_id || order?.booklet_id || order?.product_id;
  return (db.booklets||[]).find(x => x.id === itemId) || null;
}

function alinDeliveryTypeV55(order){
  const v = String(order?.delivery_type || order?.fulfillment_type || order?.delivery || '').toLowerCase();
  if(v.includes('delegate') || v.includes('مندوب') || v === 'courier') return 'delegate';
  if(v.includes('library') || v.includes('pickup') || v.includes('مكتبة')) return 'library';
  if(order?.library_id || order?.library_name) return 'library';
  return 'delegate';
}

async function alinInsertSafeV55(table, payload){
  try{
    const {error} = await sb.from(table).insert(payload);
    if(error) return false;
    return true;
  }catch(e){ return false; }
}

async function alinMarkOrderSettledV55(order, payload){
  const updatePayload = Object.assign({
    settlement_done: true,
    settlement_at: new Date().toISOString()
  }, payload || {});
  try{ await update('orders', updatePayload, {id: order.id}); Object.assign(order, updatePayload); }catch(e){}
}

async function alinApplySettlementV55(order){
  if(!order || order.settlement_done) return;
  const status = String(order.status || '').trim();
  const deliveredWords = ['تم التسليم','مكتمل','delivered','completed'];
  if(!deliveredWords.some(w => status.includes(w))) return;

  const total = alinOrderTotalV55(order);
  if(total <= 0) return;

  const booklet = alinBookletFromOrderV55(order);
  const teacherId = order.teacher_id || booklet?.teacher_id || booklet?.teacher || null;
  const libraryId = order.library_id || null;
  const delegateId = order.delegate_id || order.courier_id || null;
  const deliveryType = alinDeliveryTypeV55(order);

  const platformShare = alinNumberV55(order.platform_share ?? order.admin_share ?? order.manager_profit ?? Math.round(total * 0.20));
  const teacherShare = alinNumberV55(order.teacher_share ?? booklet?.teacher_share ?? Math.round(total * 0.50));
  let remaining = total - platformShare - teacherShare;
  if(remaining < 0) remaining = 0;

  const libraryShare = deliveryType === 'library' ? alinNumberV55(order.library_share ?? remaining) : 0;
  const delegateShare = deliveryType === 'delegate' ? alinNumberV55(order.delegate_share ?? remaining) : 0;

  const common = {
    order_id: order.id,
    order_number: order.order_number || order.tracking_code || order.id,
    amount: total,
    created_at: new Date().toISOString(),
    note: 'تسوية تلقائية عند تسليم الطلب'
  };

  await alinInsertSafeV55('admin_settlements', Object.assign({}, common, {
    type: 'platform_profit',
    profit: platformShare,
    party: 'admin'
  }));

  if(teacherId){
    await alinInsertSafeV55('teacher_settlements', Object.assign({}, common, {
      teacher_id: teacherId,
      profit: teacherShare,
      type: 'teacher_profit'
    }));
  }

  if(deliveryType === 'library' && libraryId){
    await alinInsertSafeV55('library_settlements', Object.assign({}, common, {
      library_id: libraryId,
      profit: libraryShare,
      type: 'library_collection'
    }));
  }

  if(deliveryType === 'delegate' && delegateId){
    await alinInsertSafeV55('delegate_settlements', Object.assign({}, common, {
      delegate_id: delegateId,
      profit: delegateShare,
      type: 'delegate_collection'
    }));
  }

  await alinMarkOrderSettledV55(order, {
    platform_profit: platformShare,
    teacher_profit: teacherShare,
    library_profit: libraryShare,
    delegate_profit: delegateShare,
    settlement_party: deliveryType
  });
}

async function alinSetOrderStatusV55(orderId, status){
  const order = (db.orders||[]).find(o => o.id === orderId);
  if(!order) return alert('الطلب غير موجود');
  try{
    await update('orders', {status, updated_at:new Date().toISOString()}, {id:orderId});
    order.status = status;
    if(String(status).includes('تم التسليم')) await alinApplySettlementV55(order);
    alert('تم تحديث حالة الطلب');
    renderAdmin && renderAdmin();
  }catch(e){
    alert('تعذر تحديث الطلب: ' + (e.message || 'خطأ غير معروف'));
  }
}

window.alinApplySettlementV55 = alinApplySettlementV55;
window.alinSetOrderStatusV55 = alinSetOrderStatusV55;
/* ===== end ALIN V55 ===== */

document.addEventListener('click', async (e)=>{
  const btn=e.target.closest('[data-order-status][data-order-id]');
  if(!btn) return;
  const st=btn.getAttribute('data-order-status');
  const id=btn.getAttribute('data-order-id');
  if(st && id && String(st).includes('تم التسليم')){
    setTimeout(async()=>{
      const order=(db.orders||[]).find(o=>o.id===id);
      if(order){ order.status=st; await alinApplySettlementV55(order); }
    },300);
  }
});


/* ===== ALIN V57: library print-only PDF + clean finance + preview publish ===== */
function alinV57Num(v){ return Number(v||0)||0; }
function alinV57SettingNum(key, fallback){
  const v = db?.settings?.[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function alinV57Ratios(){
  let admin = alinV57SettingNum('admin_profit_percent', 20);
  let teacher = alinV57SettingNum('teacher_profit_percent', 50);
  let library = alinV57SettingNum('library_profit_percent', 30);
  let delegate = alinV57SettingNum('delegate_profit_percent', 30);
  return {admin, teacher, library, delegate};
}
function alinV57BookletVisible(b){
  return String(b?.status||'') === 'published' || String(b?.publish_status||'') === 'published' || b?.published === true || b?.is_published === true;
}
function alinV57BookletApproved(b){ return b?.teacher_approved === true || String(b?.publish_status||'') === 'approved' || String(b?.status||'') === 'approved'; }
function alinV57OrderDelivery(o){
  const v = String(o?.fulfillment_type || o?.delivery_type || o?.delivery_method || '').toLowerCase();
  if(v.includes('delegate') || v.includes('مندوب') || v.includes('courier')) return 'delegate';
  if(v.includes('library') || v.includes('pickup') || v.includes('مكتبة')) return 'library';
  if(o?.library_id) return 'library';
  return 'delegate';
}
function alinV57OrderBooklet(o){ return (db.booklets||[]).find(b => b.id === (o?.item_id || o?.booklet_id)); }
function alinV57Shares(o){
  const total = alinV57Num(o?.total);
  const r = alinV57Ratios();
  const admin = Math.round(total * r.admin / 100);
  const teacher = o?.kind === 'booklet' ? Math.round(total * r.teacher / 100) : 0;
  const delivery = alinV57OrderDelivery(o);
  const library = delivery === 'library' ? Math.max(0, total - admin - teacher) : 0;
  const delegate = delivery === 'delegate' ? Math.max(0, total - admin - teacher) : 0;
  return {total, admin, teacher, library, delegate, delivery};
}
async function alinV57SaveSetting(key,value){
  try{
    const existing = await query('settings');
    const row = (existing||[]).find(x=>x.key===key);
    if(row) await update('settings',{value:String(value)},{key});
    else await insert('settings',{key,value:String(value)});
    db.settings[key]=String(value);
  }catch(e){ console.warn('setting save',key,e); }
}
async function saveFinanceRatiosV57(){
  await alinV57SaveSetting('admin_profit_percent', adminProfitPercent.value||20);
  await alinV57SaveSetting('teacher_profit_percent', teacherProfitPercent.value||50);
  await alinV57SaveSetting('library_profit_percent', libraryProfitPercent.value||30);
  await alinV57SaveSetting('delegate_profit_percent', delegateProfitPercent.value||30);
  toast('تم حفظ نسب الأرباح');
}
window.saveFinanceRatiosV57 = saveFinanceRatiosV57;

const alinV57OldRenderSettings = window.renderSettingsAdmin || renderSettingsAdmin;
window.renderSettingsAdmin = renderSettingsAdmin = function(){
  try{ alinV57OldRenderSettings(); }catch(e){ adminContent.innerHTML='<h2>إعدادات المنصة</h2>'; }
  const r = alinV57Ratios();
  adminContent.innerHTML += `<h3>نسب الأرباح والتسويات</h3>
  <p class="muted">تُحسب عند ضغط تسليم الطلب. المتبقي بعد ربح المدير والمدرس يذهب للمكتبة أو المندوب حسب طريقة التسليم.</p>
  <div class="form-grid">
    <input id="adminProfitPercent" type="number" value="${r.admin}" placeholder="نسبة المدير %">
    <input id="teacherProfitPercent" type="number" value="${r.teacher}" placeholder="نسبة المدرس %">
    <input id="libraryProfitPercent" type="number" value="${r.library}" placeholder="نسبة المكتبة %">
    <input id="delegateProfitPercent" type="number" value="${r.delegate}" placeholder="نسبة المندوب %">
    <button onclick="saveFinanceRatiosV57()">حفظ النسب</button>
  </div>`;
};

async function alinV57InsertLedger(o){
  if(!o || db.ledger?.some(x=>x.order_id===o.id)) return;
  const b = alinV57OrderBooklet(o);
  const s = alinV57Shares(o);
  const row = {
    id: uid('LG'),
    order_id: o.id,
    order_number: o.order_number || o.id,
    alin: s.admin,
    admin: s.admin,
    teacher: s.teacher,
    teacher_id: b?.teacher_id || o.teacher_id || '',
    library: s.library,
    library_id: o.library_id || '',
    delegate: s.delegate,
    delegate_id: o.delegate_id || '',
    total: s.total,
    delivery_type: s.delivery,
    settlement_status: 'unsettled',
    created_at: new Date().toISOString()
  };
  await insert('ledger', row);
  db.ledger = db.ledger || [];
  db.ledger.unshift(row);
  if(o.kind === 'booklet' && o.library_id && !db.permits?.some(p=>p.order_id===o.id)){
    try{ await insert('permits',{id:uid('P'),order_id:o.id,booklet_id:o.item_id,library_id:o.library_id,qty:o.qty,used:0,status:'active'}); }catch(e){}
  }
}
async function alinV57SettleOrder(o){
  if(!o) return;
  await alinV57InsertLedger(o);
  const s = alinV57Shares(o);
  const payload = {
    settlement_done: true,
    settlement_at: new Date().toISOString(),
    platform_profit: s.admin,
    teacher_profit: s.teacher,
    library_profit: s.library,
    delegate_profit: s.delegate,
    settlement_party: s.delivery
  };
  try{ await update('orders', payload, {id:o.id}); Object.assign(o,payload); }catch(e){}
  const lg = (db.ledger||[]).find(x=>x.order_id===o.id);
  if(lg && lg.settlement_status !== 'settled'){
    try{ await update('ledger',{settlement_status:'settled',settled_at:new Date().toISOString()},{id:lg.id}); Object.assign(lg,{settlement_status:'settled'}); }catch(e){}
  }
  try{
    if(typeof alinApplySettlementV55 === 'function') await alinApplySettlementV55(Object.assign({}, o, {status:'تم التسليم'}));
  }catch(e){}
}
window.alinV57SettleOrder = alinV57SettleOrder;

window.ensureOrderFinancials = async function(o){ if(o) await alinV57InsertLedger(o); };

window.libraryOrderStatus = async function(id,status){
  const o=(db.orders||[]).find(x=>x.id===id); if(!o) return;
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h},{id});
  o.status=status; o.status_history=h;
  if(status==='completed' || status==='تم التسليم') await alinV57SettleOrder(o);
  await audit('order','المكتبة حدثت '+id+' إلى '+status);
  await load();
  renderLibrary();
};

const alinV57OldOrderStatus = window.orderStatus || orderStatus;
window.orderStatus = orderStatus = async function(id,status){
  const o=(db.orders||[]).find(x=>x.id===id);
  if(alinV57OldOrderStatus) await alinV57OldOrderStatus(id,status);
  if(o && (status==='completed' || status==='تم التسليم')) await alinV57SettleOrder(o);
};

window.openOrderPdf = async function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  const b=alinV57OrderBooklet(o);
  if(!b?.file_path) return alert('لا يوجد ملف PDF لهذه الملزمة');
  const resolved = typeof alinResolveStoredFile === 'function' ? await alinResolveStoredFile(b.file_path,'booklets') : null;
  const url = (resolved?.url || mediaUrl(b.file_path)) + '#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>PDF الملزمة للمكتبة</h2>
    <div class="pdf-viewer"><iframe id="pdfFrame" src="${url}" oncontextmenu="return false"></iframe></div>
    <div class="row-actions no-print"><button onclick="printPdfFrame()">طباعة فقط</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
};

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

window.renderFinanceAdmin = renderFinanceAdmin = function(){
  const rows=db.ledger||[];
  const adminTotal=rows.reduce((a,x)=>a+alinV57Num(x.alin||x.admin),0);
  const teacherTotal=rows.reduce((a,x)=>a+alinV57Num(x.teacher),0);
  const libraryTotal=rows.reduce((a,x)=>a+alinV57Num(x.library),0);
  const delegateTotal=rows.reduce((a,x)=>a+alinV57Num(x.delegate),0);
  adminContent.innerHTML=`<h2>الدفتر المالي والتسويات</h2>
  <div class="stats"><div><b>ربح المدير</b><span>${money(adminTotal)} د.ع</span></div><div><b>المدرسين</b><span>${money(teacherTotal)} د.ع</span></div><div><b>المكتبات</b><span>${money(libraryTotal)} د.ع</span></div><div><b>المندوبين</b><span>${money(delegateTotal)} د.ع</span></div></div>
  ${rows.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.order_id)}</b><small>مدير ${money(x.alin||x.admin)} — مدرس ${money(x.teacher)} — مكتبة ${money(x.library)} — مندوب ${money(x.delegate||0)}</small></div><span>${esc(x.settlement_status||'unsettled')}</span></div>`).join('')||emptyState('لا توجد تسويات')}
  <h3>طلبات السحب</h3>${(db.withdrawals||[]).map(x=>`<div class="row"><div><b>${esc(x.role)} — ${money(x.amount)} د.ع</b><small>${esc(x.status)}</small></div><div class="row-actions"><button onclick="withdrawStatus('${x.id}','approved')">موافقة</button><button onclick="withdrawStatus('${x.id}','paid')">تم الدفع</button><button class="danger" onclick="withdrawStatus('${x.id}','rejected')">رفض</button></div></div>`).join('')}`;
};

window.renderBookletsAdmin = renderBookletsAdmin = function(){
  if(!window.adminContent)return;
  adminContent.innerHTML=`<h2>الملازم</h2>
  <p class="muted">الملزمة ترفع كمسودة للمعاينة أولاً. المدرس يضغط ✅ موافق للنشر، ثم المدير ينشرها لتظهر في المتجر.</p>
  <form id="bookForm" class="form-grid">
    <input name="title" placeholder="اسم الملزمة">
    <select name="teacherId">${(db.accounts?.teachers||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
    <input name="subject" placeholder="المادة">
    <input name="price" type="number" placeholder="السعر">
    <label>غلاف الملزمة<input name="cover" type="file" accept="image/*"></label>
    <label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label>
    <label>ملف PDF<input name="bookletFile" type="file" accept=".pdf,application/pdf" required></label>
    <button type="button" onclick="uploadBooklet()">رفع للمعاينة</button>
  </form>
  ${(db.booklets||[]).map(x=>{
    const st = alinV57BookletVisible(x)?'منشورة':(alinV57BookletApproved(x)?'موافق عليها - جاهزة للنشر':'مسودة بانتظار موافقة المدرس');
    return `<div class="row" data-booklet-id="${x.id}"><div><b>${esc(x.title)}</b><small>${esc(teacherName(x.teacher_id))} — ${esc(x.subject||'')} — ${esc(x.file_name||'')} — ${st}</small></div><div class="row-actions">
      ${x.file_path?`<button class="secondary" onclick="openTeacherPdf('${x.id}')">معاينة</button>`:''}
      ${alinV57BookletVisible(x)?`<button onclick="alinUnpublishBookletV56('${x.id}')">إيقاف النشر</button>`:`<button onclick="alinAdminPublishBookletV56('${x.id}')">نشر</button>`}
      <button class="danger" onclick="deleteBooklet('${x.id}')">حذف</button>
    </div></div>`;
  }).join('')||emptyState('لا توجد ملازم')}`;
};

window.uploadBooklet = async function(){
  try{
    const f=new FormData(bookForm);
    const title=String(f.get('title')||'').trim(), teacherId=String(f.get('teacherId')||'').trim(), subject=String(f.get('subject')||'').trim();
    if(!title||!teacherId) throw new Error('أكمل اسم الملزمة والمدرس');
    const pdfFile=f.get('bookletFile');
    if(!pdfFile||!pdfFile.name) throw new Error('ملف PDF مطلوب');
    const cover=await uploadFileV52('covers', f.get('cover'), {type:'image'});
    const teacherImage=await uploadFileV52('teachers', f.get('teacherImage'), {type:'image'});
    const filePath=await uploadFileV52('booklets', pdfFile, {required:true,type:'pdf'});
    await insert('booklets',{id:uid('B'),title,teacher_id:teacherId,subject,grade:'',price:+f.get('price')||0,cover_path:cover,teacher_image_path:teacherImage,file_path:filePath,file_name:pdfFile.name,status:'draft',publish_status:'draft',published:false,is_published:false,teacher_approved:false});
    await audit('booklet','رفع ملزمة للمعاينة '+title);
    await load(); renderBookletsAdmin(); toast('تم رفع الملزمة للمعاينة فقط');
  }catch(e){ alert(e.message||'تعذر رفع الملزمة'); }
};

const alinV57OldRenderTeacher = window.renderTeacher || renderTeacher;
window.renderTeacher = renderTeacher = function(){
  try{ alinV57OldRenderTeacher(); }catch(e){}
  if(!window.teacherContent || current?.role!=='teacher') return;
  const id=current.id;
  const draftBooks=(db.booklets||[]).filter(b=>b.teacher_id===id && !alinV57BookletVisible(b));
  if(!draftBooks.length) return;
  const box=`<h3>معاينة قبل النشر</h3>${draftBooks.map(b=>`<div class="row"><div><b>${esc(b.title)}</b><small>${esc(b.subject||'')} — ${esc(b.file_name||'')} — ${alinV57BookletApproved(b)?'تمت الموافقة':'بانتظار موافقتك'}</small></div><div class="row-actions">${b.file_path?`<button onclick="openTeacherPdf('${b.id}')">مشاهدة</button>`:''}${!alinV57BookletApproved(b)?`<button onclick="alinTeacherApproveBookletV56('${b.id}')">✅ موافق للنشر</button>`:''}</div></div>`).join('')}`;
  teacherContent.innerHTML = box + teacherContent.innerHTML;
};

window.storeItems = function(){
  const type=db.settings?.storeType||'booklet';
  const q=(String(document.getElementById('searchInput')?.value||'').trim().toLowerCase());
  if(type==='booklet'){
    return (db.booklets||[]).filter(alinV57BookletVisible).map(x=>({kind:'booklet',id:x.id,title:x.title||'',subject:x.subject||'',teacher:teacherName(x.teacher_id),price:+x.price||0,cover:x.cover_path,stock:null})).filter(x=>!q || (`${x.title} ${x.teacher} ${x.subject}`).toLowerCase().includes(q));
  }
  return (db.products||[]).filter(x=>x.status==='active'&&x.type===type).map(x=>({kind:'product',id:x.id,title:x.name||'',subject:x.category||'',teacher:'',price:+x.price||0,cover:x.image_path,stock:+(x.stock||0)})).filter(x=>!q||(`${x.title} ${x.subject}`).toLowerCase().includes(q));
};
/* ===== end ALIN V57 ===== */

/* ================= ALIN V59 FIX: library print-only, clean settlement, teacher approval publish ================= */
window.ALIN_VERSION='Alin V60 Receipt Settlement Fix';

function alinV59IsDeliveredStatus(status){
  const s=String(status||'').toLowerCase();
  return s==='completed' || s==='تم التسليم' || s.includes('delivered');
}
function alinV59IsCancelledStatus(status){
  const s=String(status||'').toLowerCase();
  return s==='cancelled' || s==='canceled' || s.includes('ملغي') || s.includes('إلغاء');
}
function alinV59OrderBooklet(o){ return (db.booklets||[]).find(b=>b.id===(o?.item_id||o?.booklet_id)); }
function alinV59Delivery(o){ return alinV57OrderDelivery ? alinV57OrderDelivery(o) : (o?.library_id?'library':'delegate'); }
function alinV59Shares(o){
  const total=Number(o?.total||0)||0;
  const r=typeof alinV57Ratios==='function'?alinV57Ratios():{admin:20,teacher:50,library:30,delegate:30};
  const delivery=alinV59Delivery(o);
  const admin=Math.round(total*(Number(r.admin)||0)/100);
  const teacher=(o?.kind==='booklet')?Math.round(total*(Number(r.teacher)||0)/100):0;
  const remainder=Math.max(0,total-admin-teacher);
  return {total,admin,teacher,library:delivery==='library'?remainder:0,delegate:delivery==='delegate'?remainder:0,delivery};
}
async function alinV59SaveSetting(key,value){
  if(typeof alinV57SaveSetting==='function') return alinV57SaveSetting(key,value);
  const row=(await query('settings')).find(x=>x.key===key);
  if(row) await update('settings',{value:String(value)},{key}); else await insert('settings',{key,value:String(value)});
  db.settings[key]=String(value);
}
window.saveFinanceRatiosV57 = async function(){
  await alinV59SaveSetting('admin_profit_percent', document.getElementById('adminProfitPercent')?.value||20);
  await alinV59SaveSetting('teacher_profit_percent', document.getElementById('teacherProfitPercent')?.value||50);
  await alinV59SaveSetting('library_profit_percent', document.getElementById('libraryProfitPercent')?.value||30);
  await alinV59SaveSetting('delegate_profit_percent', document.getElementById('delegateProfitPercent')?.value||30);
  toast('تم حفظ نسب الأرباح المعتمدة');
};

async function alinV59CreatePermit(o){
  if(o?.kind!=='booklet' || !o.library_id) return;
  if((db.permits||[]).some(p=>p.order_id===o.id)) return;
  const p={id:uid('P'),order_id:o.id,booklet_id:o.item_id,library_id:o.library_id,qty:Number(o.qty||1)||1,used:0,status:'active'};
  try{ await insert('permits',p); db.permits=db.permits||[]; db.permits.unshift(p); }catch(e){}
}
async function alinV59SettleOrder(o){
  if(!o || alinV59IsCancelledStatus(o.status)) return;
  const s=alinV59Shares(o), b=alinV59OrderBooklet(o);
  if(s.total<=0) return;
  let row=(db.ledger||[]).find(x=>x.order_id===o.id);
  const payload={
    order_id:o.id, order_number:o.order_number||o.id,
    alin:s.admin, admin:s.admin, teacher:s.teacher, teacher_id:b?.teacher_id||o.teacher_id||'',
    library:s.library, library_id:o.library_id||'', delegate:s.delegate, delegate_id:o.delegate_id||o.courier_id||'',
    total:s.total, delivery_type:s.delivery, settlement_status:'settled', settled_at:new Date().toISOString(), created_at: row?.created_at||new Date().toISOString()
  };
  if(row){ await update('ledger',payload,{id:row.id}); Object.assign(row,payload); }
  else { row=Object.assign({id:uid('LG')},payload); await insert('ledger',row); db.ledger=db.ledger||[]; db.ledger.unshift(row); }
  await alinV59CreatePermit(o);
  const op={settlement_done:true,settlement_at:new Date().toISOString(),platform_profit:s.admin,teacher_profit:s.teacher,library_profit:s.library,delegate_profit:s.delegate,settlement_party:s.delivery,payment_status:o.payment_status||'paid'};
  try{ await update('orders',op,{id:o.id}); Object.assign(o,op); }catch(e){}
}
async function alinV59CancelDelivery(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  if(!confirm('إلغاء التسليم؟ هذا الإيعاز لا يحتسب أي مبلغ بالحسابات.')) return;
  const h=[...(o.status_history||[]),{status:'cancelled',at:new Date().toISOString(),note:'إلغاء التسليم من المكتبة بدون احتساب مبلغ'}];
  try{ await update('orders',{status:'cancelled',status_history:h,settlement_done:false,settlement_cancelled:true},{id:orderId}); }catch(e){}
  const lg=(db.ledger||[]).find(x=>x.order_id===orderId);
  if(lg){ try{ await update('ledger',{settlement_status:'cancelled',alin:0,admin:0,teacher:0,library:0,delegate:0,total:0,note:'إلغاء التسليم بدون احتساب مبلغ'},{id:lg.id}); }catch(e){} }
  await audit('order','إلغاء تسليم بدون احتساب '+(o.order_number||orderId));
  await load(); renderLibrary();
}
window.alinV59CancelDelivery=alinV59CancelDelivery;

window.libraryOrderStatus = async function(id,status){
  const o=(db.orders||[]).find(x=>x.id===id); if(!o)return;
  if(alinV59IsCancelledStatus(status)) return alinV59CancelDelivery(id);
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h,payment_status:alinV59IsDeliveredStatus(status)?'paid':(o.payment_status||'cod_pending')},{id});
  Object.assign(o,{status,status_history:h});
  if(alinV59IsDeliveredStatus(status)) await alinV59SettleOrder(o);
  await audit('order','المكتبة غيرت حالة الطلب '+(o.order_number||id)+' إلى '+status);
  await load(); renderLibrary();
};
window.orderStatus = orderStatus = async function(id,status){
  const o=(db.orders||[]).find(x=>x.id===id); if(!o)return;
  if(alinV59IsCancelledStatus(status)){
    const h=[...(o.status_history||[]),{status:'cancelled',at:new Date().toISOString()}];
    await update('orders',{status:'cancelled',status_history:h,settlement_done:false,settlement_cancelled:true},{id});
    const lg=(db.ledger||[]).find(x=>x.order_id===id);
    if(lg) try{ await update('ledger',{settlement_status:'cancelled',alin:0,admin:0,teacher:0,library:0,delegate:0,total:0,note:'إلغاء بدون احتساب'},{id:lg.id}); }catch(e){}
  }else{
    const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
    await update('orders',{status,status_history:h,payment_status:alinV59IsDeliveredStatus(status)?'paid':(o.payment_status||'cod_pending')},{id});
    Object.assign(o,{status,status_history:h});
    if(alinV59IsDeliveredStatus(status)) await alinV59SettleOrder(o);
  }
  await audit('order','تحديث الطلب '+(o.order_number||id)+' إلى '+status); await load(); renderOrdersAdmin(); toast('تم تحديث الطلب');
};

window.openLibraryBookletPdf = async function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o || o.kind!=='booklet')return alert('هذا الطلب لا يحتوي ملف PDF');
  const b=alinV59OrderBooklet(o); if(!b?.file_path)return alert('لا يوجد ملف PDF لهذه الملزمة');
  const resolved=typeof alinResolveStoredFile==='function'?await alinResolveStoredFile(b.file_path,'booklets'):null;
  const base=(resolved?.url||mediaUrl(b.file_path));
  const url=base+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>عرض PDF للطباعة فقط</h2><div class="pdf-guard print-only"><div class="watermark">${esc(current?.name||'مكتبة')} — طباعة فقط — ${esc(o.order_number||o.id)}</div><iframe id="pdfFrame" src="${url}" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button onclick="printPdfFrame()">طباعة فقط</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
};
window.openOrderPdf=window.openLibraryBookletPdf;

window.printReceipt = window.printOrderReceipt = function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  const b=alinV59OrderBooklet(o), t=(db.accounts?.teachers||[]).find(x=>x.id===b?.teacher_id), lib=(db.accounts?.libraries||[]).find(x=>x.id===o.library_id);
  const s=alinV59Shares(o);
  checkoutBox.innerHTML=`<div class="receipt"><h2>وصل وتسوية منصة آلين</h2><div class="receipt-line"><b>رقم الطلب</b><span>${esc(o.order_number||o.id)}</span></div><div class="receipt-line"><b>الطالب</b><span>${esc(o.student_name||'')}</span></div><div class="receipt-line"><b>المادة</b><span>${esc(o.title||'')}</span></div><div class="receipt-line"><b>العدد</b><span>${esc(o.qty||1)}</span></div><div class="receipt-line"><b>المبلغ المستلم</b><span>${money(s.total)} د.ع</span></div><hr><div class="receipt-line"><b>ربح المدير</b><span>${money(s.admin)} د.ع</span></div><div class="receipt-line"><b>ربح المدرس ${t?esc(t.name):''}</b><span>${money(s.teacher)} د.ع</span></div>${s.delivery==='library'?`<div class="receipt-line"><b>حصة المكتبة ${lib?esc(lib.name):''}</b><span>${money(s.library)} د.ع</span></div>`:`<div class="receipt-line"><b>حصة المندوب</b><span>${money(s.delegate)} د.ع</span></div>`}<p>تثبت الحسابات عند ضغط تسليم. زر إلغاء التسليم لا يحتسب مبلغ.</p></div><div class="row-actions no-print"><button onclick="window.print()">طباعة الوصل</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
};

window.renderLibrary = renderLibrary = function(){
  if(!window.libraryStats)return;
  const id=current?.role==='library'?current.id:'';
  const orders=(db.orders||[]).filter(x=>x.library_id===id && !alinV59IsCancelledStatus(x.status));
  const cancelled=(db.orders||[]).filter(x=>x.library_id===id && alinV59IsCancelledStatus(x.status));
  const led=(db.ledger||[]).filter(x=>x.library_id===id && x.settlement_status!=='cancelled');
  const notices=(typeof v19Notifications!=='undefined'?v19Notifications:[]).filter(n=>n.status==='active'&&(n.audience==='all'||n.audience==='library'));
  libraryStats.innerHTML=`<div><b>طلبات المكتبة</b><span>${orders.length}</span></div><div><b>الجديدة</b><span>${orders.filter(x=>x.status==='new').length}</span></div><div><b>الجاهزة</b><span>${orders.filter(x=>x.status==='ready').length}</span></div><div><b>المستحقات</b><span>${money(led.reduce((a,x)=>a+(+x.library||0),0))} د.ع</span></div>`;
  libraryPermits.innerHTML=notices.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.text||'')}</div></div>`).join('')+(orders.map(x=>`<div class="row"><div><b>${esc(x.order_number||x.id)} — ${esc(x.title)}</b><small>${esc(x.student_name||'')} • ${esc(x.student_phone||'')} • ×${x.qty||1} • ${esc(x.status||'new')}</small></div><div class="row-actions">${x.kind==='booklet'?`<button class="library-pdf-btn" onclick="openLibraryBookletPdf('${x.id}')">عرض PDF</button>`:''}<button onclick="libraryOrderStatus('${x.id}','processing')">استلام</button><button onclick="libraryOrderStatus('${x.id}','ready')">جاهز</button><button onclick="libraryOrderStatus('${x.id}','completed')">تسليم</button><button class="secondary" onclick="printReceipt('${x.id}')">وصل الحسابات</button><button class="danger" onclick="alinV59CancelDelivery('${x.id}')">إلغاء تسليم</button></div></div>`).join('')||emptyState('لا توجد طلبات'));
  libraryHistory.innerHTML=`<div class="notice"><b>ملاحظة الحسابات</b><div>يُحتسب المبلغ فقط عند ضغط تسليم. إلغاء التسليم لا يدخل بالدفتر المالي.</div></div>`+led.map(x=>`<div class="row"><b>${esc(x.order_number||x.order_id)}</b><span>${money(x.library)} د.ع</span></div>`).join('')+(cancelled.length?`<h3>طلبات ملغاة بدون احتساب</h3>`+cancelled.map(x=>`<div class="row"><b>${esc(x.order_number||x.id)}</b><span>0 د.ع</span></div>`).join(''): '');
};

window.alinTeacherApproveBookletV56 = async function(id){
  const b=(db.booklets||[]).find(x=>x.id===id); if(!b)return alert('الملزمة غير موجودة');
  try{ await update('booklets',{teacher_approved:true,teacher_approved_at:new Date().toISOString(),publish_status:'approved',status:'approved'},{id}); Object.assign(b,{teacher_approved:true,publish_status:'approved',status:'approved'}); await audit('booklet','موافقة المدرس على النشر '+b.title); await load(); activeTeacherTab='booklets'; renderTeacher(); toast('تم إرسال الموافقة إلى لوحة المدير / طلبات المدرسين'); }catch(e){ alert('لم تتم الموافقة: '+(e.message||'')); }
};
window.alinAdminPublishBookletV56 = async function(id){
  const b=(db.booklets||[]).find(x=>x.id===id); if(!b)return alert('الملزمة غير موجودة');
  if(!alinV57BookletApproved(b) && !confirm('المدرس لم يوافق بعد. هل تريد النشر رغم ذلك؟')) return;
  await update('booklets',{status:'published',publish_status:'published',published:true,is_published:true,published_at:new Date().toISOString()},{id});
  await audit('booklet','نشر ملزمة بعد الموافقة '+b.title); await load(); renderTeacherRequestsAdmin(); toast('تم نشر الملزمة في المتجر');
};
window.alinUnpublishBookletV56 = async function(id){
  await update('booklets',{status:'hidden',publish_status:'hidden',published:false,is_published:false},{id}); await audit('booklet','إيقاف نشر ملزمة '+id); await load(); renderBookletsAdmin();
};

window.renderTeacherRequestsAdmin = function(){
  const approved=(db.booklets||[]).filter(b=>alinV57BookletApproved(b) && !alinV57BookletVisible(b));
  const drafts=(db.booklets||[]).filter(b=>!alinV57BookletApproved(b) && !alinV57BookletVisible(b));
  const reqs=db.teacherRequests||[];
  adminContent.innerHTML=`<h2>طلبات المدرسين</h2><h3>موافق عليها وجاهزة للنشر</h3>${approved.map(b=>`<div class="row"><div><b>${esc(b.title)}</b><small>${esc(teacherName(b.teacher_id))} — ${esc(b.subject||'')} — موافقة المدرس موجودة</small></div><div class="row-actions"><button class="secondary" onclick="openTeacherPdf('${b.id}')">معاينة</button><button onclick="alinAdminPublishBookletV56('${b.id}')">نشر الآن</button></div></div>`).join('')||emptyState('لا توجد ملازم موافق عليها')}<h3>بانتظار موافقة المدرس</h3>${drafts.map(b=>`<div class="row"><div><b>${esc(b.title)}</b><small>${esc(teacherName(b.teacher_id))} — ${esc(b.subject||'')} — لم يوافق المدرس بعد</small></div><div class="row-actions"><button class="secondary" onclick="openTeacherPdf('${b.id}')">معاينة</button></div></div>`).join('')||emptyState('لا توجد مسودات')}<h3>طلبات ملزمة من المدرسين</h3>${reqs.map(r=>`<div class="row"><div><b>${esc(r.title)}</b><small>${esc(r.teacher_name||teacherName(r.teacher_id))} — ${esc(r.subject||'')} — ${esc(r.grade||'')} — ${esc(r.status||'new')}</small><p>${esc(r.note||'')}</p></div><div class="row-actions">${r.source_file_path?`<button onclick="openTeacherRequestSource('${r.id}')">عرض الملف الأولي</button>`:''}<button onclick="teacherRequestStatus('${r.id}','designing')">قيد التصميم</button><button onclick="teacherRequestStatus('${r.id}','ready')">جاهزة</button><button class="danger" onclick="teacherRequestStatus('${r.id}','rejected')">رفض</button></div></div>`).join('')||emptyState('لا توجد طلبات')}`;
};
const alinV59AdminTabOld=adminTab;
window.adminTab = adminTab = function(t){ window.activeAdminTab=t; if(t==='teacherRequests') return renderTeacherRequestsAdmin(); if(t==='finance') return renderFinanceAdmin(); return alinV59AdminTabOld(t); };

const alinV59LoadOld=load;
load=async function(){
  await alinV59LoadOld();
  if(sb){ try{ db.teacherRequests=await query('teacher_requests'); }catch(e){ db.teacherRequests=db.teacherRequests||[]; } }
};


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

const alinV60RenderLibraryBase = window.renderLibrary;
window.renderLibrary = renderLibrary = function(){
  alinV60RenderLibraryBase();
  if(current?.role!=='library' || !window.libraryHistory) return;
  let owed=0, paid=0;
  try{
    if(typeof libDebt==='function'){
      const d=libDebt(current.id)||{};
      owed=+d.owed||0; paid=+d.paid||0;
    }else{
      const rows=(db.ledger||[]).filter(x=>x.library_id===current.id && x.settlement_status!=='cancelled');
      owed=rows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0),0);
      const pays=(typeof librarySettlements!=='undefined'?librarySettlements:[]).filter(x=>x.library_id===current.id&&x.status==='received');
      paid=pays.reduce((a,x)=>a+(+x.amount||0),0);
    }
  }catch(e){}
  const remaining=Math.max(0,owed-paid);
  const old=document.getElementById('alinV60LibraryDebt');
  if(old) old.remove();
  const box=document.createElement('div');
  box.id='alinV60LibraryDebt';
  box.className='notice';
  box.innerHTML=`<b>تسوية المكتبة</b><div>المبلغ بذمة المكتبة للإدارة: <strong>${money(remaining)} د.ع</strong><br>إجمالي المطلوب: ${money(owed)} د.ع<br>المسدّد: ${money(paid)} د.ع</div>`;
  libraryHistory.prepend(box);
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
const alinV61OldOpenLibraryBookletPdf = window.openLibraryBookletPdf;
window.openLibraryBookletPdf = async function(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  if(!o)return;
  const b=(typeof alinV59OrderBooklet==='function'?alinV59OrderBooklet(o):db.booklets.find(x=>x.id===o.item_id));
  if(!b?.file_path)return alert('لا يوجد ملف PDF لهذه الملزمة');
  const resolved=typeof alinResolveStoredFile==='function'?await alinResolveStoredFile(b.file_path,'booklets'):null;
  const source=(resolved?.url||mediaUrl(b.file_path));
  checkoutBox.innerHTML=`<h2>عرض PDF للطباعة فقط</h2><div class="pdf-guard print-only"><div class="watermark">${esc(current?.name||'مكتبة')} — طباعة فقط — ${esc(o.order_number||o.id)}</div><iframe id="pdfFrame" data-source="${esc(source)}" src="about:blank" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button id="alinPrintPdfBtn" onclick="printPdfFrame()">طباعة فقط</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
  const frame=document.getElementById('pdfFrame');
  const btn=document.getElementById('alinPrintPdfBtn');
  if(btn){ btn.disabled=true; btn.textContent='جاري تجهيز الطباعة...'; }
  const ok=await alinV61PreparePrintablePdf(frame,source);
  if(btn){ btn.disabled=false; btn.textContent=ok?'طباعة فقط':'إعادة محاولة الطباعة'; }
};
window.openOrderPdf=window.openLibraryBookletPdf;


/* ================= ALIN V63 ACTIVE LIBRARY SETTLEMENT ================= */
function alinV63LibraryDebt(libraryId){
  const ledgerRows=(db.ledger||[]).filter(x=>x.library_id===libraryId && x.settlement_status!=='cancelled');
  const owed=ledgerRows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0)+(+x.delegate||0),0);
  let paid=0;
  try{
    if(typeof librarySettlements!=='undefined'){
      paid=(librarySettlements||[]).filter(x=>x.library_id===libraryId && (x.status==='received'||x.status==='paid')).reduce((a,x)=>a+(+x.amount||0),0);
    }
  }catch(e){}
  try{
    const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');
    paid += local.filter(x=>x.library_id===libraryId && x.status==='received').reduce((a,x)=>a+(+x.amount||0),0);
  }catch(e){}
  return {owed,paid,remaining:Math.max(0,owed-paid)};
}
async function alinV63PayLibrarySettlement(libraryId){
  const d=alinV63LibraryDebt(libraryId);
  if(d.remaining<=0) return toast('لا يوجد مبلغ بذمة المكتبة');
  const amount=+(prompt('المبلغ بذمة المكتبة: '+money(d.remaining)+' د.ع\nاكتب مبلغ التسوية المستلم من المكتبة', d.remaining)||0);
  if(!amount || amount<=0 || amount>d.remaining) return alert('المبلغ غير صحيح');
  const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,status:'received',payment_method:'نقدي',created_at:new Date().toISOString(),note:'تسوية مكتبة من صفحة المكتبة'};
  let saved=false;
  try{
    await insert('library_settlements',row);
    if(typeof librarySettlements!=='undefined') librarySettlements.unshift(row);
    saved=true;
  }catch(e){
    try{
      const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');
      local.unshift(row);
      localStorage.setItem('alin_v63_library_settlements',JSON.stringify(local));
      saved=true;
    }catch(_){}
  }
  await audit('finance','استلام تسوية مكتبة '+receipt+' بمبلغ '+amount);
  toast(saved?'تم تثبيت التسوية':'تعذر حفظ التسوية');
  await load();
  renderLibrary();
}
window.alinV63PayLibrarySettlement=alinV63PayLibrarySettlement;

const alinV63RenderLibraryBase = window.renderLibrary;
window.renderLibrary = renderLibrary = function(){
  alinV63RenderLibraryBase();
  if(current?.role!=='library' || !window.libraryHistory) return;
  const d=alinV63LibraryDebt(current.id);
  const old=document.getElementById('alinV60LibraryDebt');
  if(old) old.remove();
  const old2=document.getElementById('alinV63LibraryDebt');
  if(old2) old2.remove();
  const box=document.createElement('div');
  box.id='alinV63LibraryDebt';
  box.className='notice';
  box.innerHTML=`<b>تسوية المكتبة</b>
    <div>المبلغ بذمة المكتبة للإدارة: <strong>${money(d.remaining)} د.ع</strong><br>
    إجمالي المطلوب: ${money(d.owed)} د.ع<br>
    المسدّد: ${money(d.paid)} د.ع</div>
    <div class="row-actions" style="margin-top:10px">
      <button onclick="alinV63PayLibrarySettlement('${current.id}')">تثبيت تسوية</button>
      <button class="secondary" onclick="renderLibrary()">تحديث</button>
    </div>`;
  libraryHistory.prepend(box);
};


/* ================= ALIN V64 ADMIN-ONLY LIBRARY SETTLEMENT ================= */
function alinV64LocalSettlements(){
  try{return JSON.parse(localStorage.getItem('alin_v64_library_settlements')||localStorage.getItem('alin_v63_library_settlements')||'[]');}
  catch(e){return [];}
}
function alinV64SaveLocalSettlements(rows){
  localStorage.setItem('alin_v64_library_settlements', JSON.stringify(rows||[]));
}
function alinV64AllSettlements(){
  let rows=[];
  try{ if(typeof librarySettlements!=='undefined') rows=rows.concat(librarySettlements||[]); }catch(e){}
  rows=rows.concat(alinV64LocalSettlements());
  const seen=new Set();
  return rows.filter(x=>{
    const k=x.id||x.receipt_number;
    if(!k || seen.has(k)) return false;
    seen.add(k); return true;
  });
}
function alinV64LibraryDebt(libraryId){
  const ledgerRows=(db.ledger||[]).filter(x=>x.library_id===libraryId && x.settlement_status!=='cancelled');
  const owed=ledgerRows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0)+(+x.delegate||0),0);
  const paid=alinV64AllSettlements().filter(x=>x.library_id===libraryId && (x.status==='received'||x.status==='paid')).reduce((a,x)=>a+(+x.amount||0),0);
  return {owed,paid,remaining:Math.max(0,owed-paid)};
}
async function alinV64AdminSettleLibrary(libraryId){
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===libraryId)||{};
  const d=alinV64LibraryDebt(libraryId);
  if(d.remaining<=0) return toast('لا يوجد مبلغ بذمة هذه المكتبة');
  const amount=+(prompt('تسوية مكتبة: '+(lib.name||'')+'\nالمتبقي بذمتها: '+money(d.remaining)+' د.ع\nاكتب المبلغ المستلم', d.remaining)||0);
  if(!amount || amount<=0 || amount>d.remaining) return alert('المبلغ غير صحيح');
  const method=prompt('طريقة الاستلام','نقدي')||'نقدي';
  const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,status:'received',payment_method:method,note:'تثبيت تسوية من لوحة المدير',created_at:new Date().toISOString()};
  try{
    await insert('library_settlements',row);
    if(typeof librarySettlements!=='undefined') librarySettlements.unshift(row);
  }catch(e){
    const local=alinV64LocalSettlements();
    local.unshift(row);
    alinV64SaveLocalSettlements(local);
  }
  await audit('finance','تثبيت تسوية مكتبة '+(lib.name||libraryId)+' سند '+receipt+' مبلغ '+amount);
  toast('تم تثبيت التسوية وتحديث حساب المكتبة');
  await load();
  renderFinanceAdmin();
}
function alinV64PrintSettlement(id){
  const s=alinV64AllSettlements().find(x=>x.id===id || x.receipt_number===id);
  if(!s) return;
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===s.library_id)||{};
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px">
    <h2>سند تسوية مكتبة</h2>
    <p><b>رقم السند:</b> ${esc(s.receipt_number||s.id)}</p>
    <p><b>المكتبة:</b> ${esc(lib.name||'')}</p>
    <p><b>المبلغ المستلم:</b> ${money(+s.amount||0)} د.ع</p>
    <p><b>طريقة الاستلام:</b> ${esc(s.payment_method||'نقدي')}</p>
    <p><b>التاريخ:</b> ${new Date(s.created_at||Date.now()).toLocaleString('ar-IQ')}</p>
    <hr><p>توقيع الإدارة: ____________</p>
  </div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}
window.alinV64AdminSettleLibrary=alinV64AdminSettleLibrary;
window.alinV64PrintSettlement=alinV64PrintSettlement;

const alinV64RenderLibraryBase = window.renderLibrary;
window.renderLibrary = renderLibrary = function(){
  alinV64RenderLibraryBase();
  if(current?.role!=='library' || !window.libraryHistory) return;
  const old=document.getElementById('alinV63LibraryDebt'); if(old) old.remove();
  const old0=document.getElementById('alinV60LibraryDebt'); if(old0) old0.remove();
  const d=alinV64LibraryDebt(current.id);
  const box=document.createElement('div');
  box.id='alinV64LibraryDebt';
  box.className='notice';
  box.innerHTML=`<b>تسوية المكتبة</b>
    <div>المبلغ بذمة المكتبة للإدارة: <strong>${money(d.remaining)} د.ع</strong><br>
    إجمالي المطلوب: ${money(d.owed)} د.ع<br>
    المسدّد: ${money(d.paid)} د.ع</div>
    <small>تثبيت التسوية يتم من لوحة المدير فقط.</small>`;
  const old2=document.getElementById('alinV64LibraryDebt'); if(old2) old2.remove();
  libraryHistory.prepend(box);
};

const alinV64RenderFinanceBase = window.renderFinanceAdmin;
window.renderFinanceAdmin = renderFinanceAdmin = function(){
  try{ alinV64RenderFinanceBase(); }catch(e){ adminContent.innerHTML='<h2>الدفتر المالي والتسويات</h2>'; }
  const libs=(db.accounts?.libraries||[]);
  const settlements=alinV64AllSettlements().slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  let html=`<h3>تسوية المكتبات</h3>
  <p class="muted">التسوية تثبت من المدير فقط. عند تثبيتها يتحدث المتبقي تلقائياً في صفحة المكتبة.</p>`;
  html+=libs.map(l=>{
    const d=alinV64LibraryDebt(l.id);
    return `<div class="row settlement-row"><div><b>${esc(l.name)}</b>
      <small>إجمالي المطلوب ${money(d.owed)} د.ع — المسدد ${money(d.paid)} د.ع — المتبقي ${money(d.remaining)} د.ع</small></div>
      <div class="row-actions"><button ${d.remaining<=0?'disabled':''} onclick="alinV64AdminSettleLibrary('${l.id}')">تثبيت تسوية</button></div></div>`;
  }).join('') || emptyState('لا توجد مكتبات');
  html+=`<h3>سجل سندات تسوية المكتبات</h3>`;
  html+=settlements.map(s=>{
    const l=libs.find(x=>x.id===s.library_id)||{};
    return `<div class="row"><div><b>${esc(s.receipt_number||s.id)} — ${esc(l.name||'')}</b>
      <small>${money(+s.amount||0)} د.ع — ${esc(s.payment_method||'نقدي')} — ${new Date(s.created_at||Date.now()).toLocaleString('ar-IQ')}</small></div>
      <div class="row-actions"><button class="secondary" onclick="alinV64PrintSettlement('${s.id||s.receipt_number}')">طباعة سند</button></div></div>`;
  }).join('') || emptyState('لا توجد سندات تسوية');
  adminContent.innerHTML += html;
};


/* ================= ALIN V65 FINANCIAL BALANCES / PAYOUTS ================= */
function alinV65LocalPayouts(){ try{return JSON.parse(localStorage.getItem('alin_v65_financial_payouts')||'[]');}catch(e){return [];} }
function alinV65SaveLocalPayouts(rows){ localStorage.setItem('alin_v65_financial_payouts', JSON.stringify(rows||[])); }
function alinV65AllPayouts(){
  let rows=[];
  try{ if(typeof financialPayouts!=='undefined') rows=rows.concat(financialPayouts||[]); }catch(e){}
  rows=rows.concat(alinV65LocalPayouts());
  const seen=new Set();
  return rows.filter(x=>{ const k=x.id||x.voucher_number; if(!k||seen.has(k)) return false; seen.add(k); return true; });
}
function alinV65LedgerRows(){ return (db.ledger||[]).filter(x=>x.settlement_status!=='cancelled'); }
function alinV65PartyName(role,id){
  if(role==='admin') return 'المدير';
  if(role==='teacher') return (db.accounts?.teachers||[]).find(x=>x.id===id)?.name || 'مدرس';
  if(role==='library') return (db.accounts?.libraries||[]).find(x=>x.id===id)?.name || 'مكتبة';
  if(role==='delegate') return (db.delegates||db.couriers||[]).find(x=>x.id===id)?.name || 'مندوب';
  return id||role;
}
function alinV65Earned(role,id){
  const rows=alinV65LedgerRows();
  if(role==='admin') return rows.reduce((a,x)=>a+(+x.admin||+x.alin||0),0);
  if(role==='teacher') return rows.filter(x=>x.teacher_id===id).reduce((a,x)=>a+(+x.teacher||0),0);
  if(role==='library') return rows.filter(x=>x.library_id===id && (x.delivery_type==='delegate'||x.delivery_type==='courier'||x.delegate_id||x.courier_id)).reduce((a,x)=>a+(+x.library||0),0);
  if(role==='delegate') return rows.filter(x=>(x.delegate_id||x.courier_id)===id).reduce((a,x)=>a+(+x.delegate||0),0);
  return 0;
}
function alinV65Paid(role,id){
  return alinV65AllPayouts().filter(x=>x.party_role===role && (role==='admin'||x.party_id===id) && (x.status==='paid'||x.status==='received')).reduce((a,x)=>a+(+x.amount||0),0);
}
function alinV65Balance(role,id){ const earned=alinV65Earned(role,id), paid=alinV65Paid(role,id); return {earned,paid,remaining:Math.max(0,earned-paid)}; }
async function alinV65PayBalance(role,id){
  const b=alinV65Balance(role,id);
  if(b.remaining<=0) return toast('لا يوجد مبلغ مستحق حالياً');
  const name=alinV65PartyName(role,id);
  const label=role==='admin'?'استلام ربح المدير':'تسديد أرباح '+name;
  const amount=+(prompt(label+'\nالمبلغ المستحق: '+money(b.remaining)+' د.ع\nاكتب مبلغ التسديد', b.remaining)||0);
  if(!amount || amount<=0 || amount>b.remaining) return alert('المبلغ غير صحيح');
  const method=prompt('طريقة الدفع/الاستلام','نقدي')||'نقدي';
  const voucher=(role==='admin'?'AR':'PV')+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('FP'),voucher_number:voucher,party_role:role,party_id:role==='admin'?'admin':id,party_name:name,amount,payment_method:method,status:role==='admin'?'received':'paid',note:label,created_at:new Date().toISOString()};
  try{ await insert('financial_payouts',row); if(typeof financialPayouts!=='undefined') financialPayouts.unshift(row); }
  catch(e){ const local=alinV65LocalPayouts(); local.unshift(row); alinV65SaveLocalPayouts(local); }
  await audit('finance',label+' سند '+voucher+' مبلغ '+amount);
  toast('تم تسجيل السند وتحديث الرصيد الجاري');
  await load(); renderFinanceAdmin();
}
function alinV65PrintPayout(id){
  const p=alinV65AllPayouts().find(x=>x.id===id || x.voucher_number===id); if(!p) return;
  const title=p.party_role==='admin'?'سند استلام ربح المدير':'سند صرف أرباح';
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px"><h2>${title}</h2><p><b>رقم السند:</b> ${esc(p.voucher_number||p.id)}</p><p><b>الجهة:</b> ${esc(p.party_name||alinV65PartyName(p.party_role,p.party_id))}</p><p><b>النوع:</b> ${esc(p.party_role||'')}</p><p><b>المبلغ:</b> ${money(+p.amount||0)} د.ع</p><p><b>طريقة الدفع:</b> ${esc(p.payment_method||'نقدي')}</p><p><b>التاريخ:</b> ${new Date(p.created_at||Date.now()).toLocaleString('ar-IQ')}</p><hr><p>توقيع الإدارة: ____________</p><p>توقيع المستلم: ____________</p></div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}
window.alinV65PayBalance=alinV65PayBalance; window.alinV65PrintPayout=alinV65PrintPayout;
function alinV65AdminPartyCards(){
  const teachers=(db.accounts?.teachers||[]).map(t=>({role:'teacher',id:t.id,name:t.name,title:'أرباح المدرس'}));
  const libraries=(db.accounts?.libraries||[]).map(l=>({role:'library',id:l.id,name:l.name,title:'ربح المكتبة من طلبات المندوب'}));
  const delegates=(db.delegates||db.couriers||[]).map(d=>({role:'delegate',id:d.id,name:d.name,title:'أرباح المندوب'}));
  const admin=[{role:'admin',id:'admin',name:'المدير',title:'ربح المدير'}];
  return admin.concat(teachers,libraries,delegates).map(p=>{ const b=alinV65Balance(p.role,p.id); return `<div class="row settlement-row"><div><b>${esc(p.title)} — ${esc(p.name||'')}</b><small>إجمالي مستحق ${money(b.earned)} د.ع — المسدد/المستلم ${money(b.paid)} د.ع — الرصيد الجاري ${money(b.remaining)} د.ع</small></div><div class="row-actions"><button ${b.remaining<=0?'disabled':''} onclick="alinV65PayBalance('${p.role}','${p.id}')">${p.role==='admin'?'استلام ربح المدير':'تسديد الأرباح'}</button></div></div>`; }).join('') || emptyState('لا توجد أرصدة');
}
function alinV65PayoutHistory(){
  const rows=alinV65AllPayouts().slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  return rows.map(p=>`<div class="row"><div><b>${esc(p.voucher_number||p.id)} — ${esc(p.party_name||alinV65PartyName(p.party_role,p.party_id))}</b><small>${money(+p.amount||0)} د.ع — ${esc(p.payment_method||'نقدي')} — ${new Date(p.created_at||Date.now()).toLocaleString('ar-IQ')}</small></div><div class="row-actions"><button class="secondary" onclick="alinV65PrintPayout('${p.id||p.voucher_number}')">طباعة سند</button></div></div>`).join('') || emptyState('لا توجد سندات أرباح');
}
const alinV65RenderFinanceBase = window.renderFinanceAdmin;
window.renderFinanceAdmin = renderFinanceAdmin = function(){
  try{ alinV65RenderFinanceBase(); }catch(e){ adminContent.innerHTML='<h2>الدفتر المالي والتسويات</h2>'; }
  adminContent.innerHTML += `<h3>أرصدة الأرباح المستحقة</h3><p class="muted">تسديد أرباح المدرسين والمكتبات والمندوبين، واستلام ربح المدير. كل تسديد يصفر الرصيد الجاري فقط ويحفظ السجل القديم.</p>${alinV65AdminPartyCards()}<h3>سجل سندات الأرباح</h3>${alinV65PayoutHistory()}`;
};
const alinV65RenderLibraryBase = window.renderLibrary;
window.renderLibrary = renderLibrary = function(){
  alinV65RenderLibraryBase();
  if(current?.role!=='library' || !window.libraryHistory) return;
  const b=alinV65Balance('library',current.id);
  const old=document.getElementById('alinV65LibraryProfit'); if(old) old.remove();
  const box=document.createElement('div'); box.id='alinV65LibraryProfit'; box.className='notice';
  box.innerHTML=`<b>ربح المكتبة المستحق</b><div>من طلبات المندوب فقط: <strong>${money(b.remaining)} د.ع</strong><br>إجمالي الربح: ${money(b.earned)} د.ع<br>المسدد من الإدارة: ${money(b.paid)} د.ع</div><small>تسديد ربح المكتبة يتم من لوحة المدير.</small>`;
  libraryHistory.prepend(box);
};

/* ================= ALIN V66 PERSISTENT SETTLEMENT SAVE FIX ================= */
function alinV66ReadLocal(key){ try{return JSON.parse(localStorage.getItem(key)||'[]')||[];}catch(e){return [];} }
function alinV66WriteLocal(key, rows){ try{localStorage.setItem(key, JSON.stringify(rows||[]));}catch(e){} }
function alinV66UpsertLocal(key,row){
  const rows=alinV66ReadLocal(key);
  const k=row.id||row.receipt_number||row.voucher_number;
  const i=rows.findIndex(x=>(x.id||x.receipt_number||x.voucher_number)===k);
  if(i>=0) rows[i]=Object.assign({},rows[i],row); else rows.unshift(row);
  alinV66WriteLocal(key,rows);
  return rows;
}
function alinV66MergeRows(a,b){
  const all=[...(a||[]),...(b||[])], seen=new Set();
  return all.filter(x=>{ const k=x.id||x.receipt_number||x.voucher_number; if(!k||seen.has(k)) return false; seen.add(k); return true; });
}

window.alinV64AllSettlements = alinV64AllSettlements = function(){
  let rows=[];
  try{ if(typeof librarySettlements!=='undefined') rows=rows.concat(librarySettlements||[]); }catch(e){}
  rows=rows.concat(alinV66ReadLocal('alin_v64_library_settlements'));
  rows=rows.concat(alinV66ReadLocal('alin_v63_library_settlements'));
  return alinV66MergeRows(rows,[]).filter(x=>x.status!=='reversed' && x.status!=='cancelled');
};
window.alinV64LibraryDebt = alinV64LibraryDebt = function(libraryId){
  const ledgerRows=(db.ledger||[]).filter(x=>x.library_id===libraryId && x.settlement_status!=='cancelled');
  const owed=ledgerRows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0)+(+x.delegate||0),0);
  const paid=alinV64AllSettlements().filter(x=>x.library_id===libraryId && (x.status==='received'||x.status==='paid')).reduce((a,x)=>a+(+x.amount||0),0);
  return {owed,paid,remaining:Math.max(0,owed-paid)};
};
window.alinV64AdminSettleLibrary = alinV64AdminSettleLibrary = async function(libraryId){
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===libraryId)||{};
  const d=alinV64LibraryDebt(libraryId);
  if(d.remaining<=0) return toast('لا يوجد مبلغ بذمة هذه المكتبة');
  const amount=+(prompt('تسوية مكتبة: '+(lib.name||'')+'\nالمتبقي بذمتها: '+money(d.remaining)+' د.ع\nاكتب المبلغ المستلم', d.remaining)||0);
  if(!amount || amount<=0 || amount>d.remaining) return alert('المبلغ غير صحيح');
  const method=prompt('طريقة الاستلام','نقدي')||'نقدي';
  const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,status:'received',payment_method:method,note:'تثبيت تسوية من لوحة المدير',created_at:new Date().toISOString()};
  alinV66UpsertLocal('alin_v64_library_settlements',row);
  try{
    await insert('library_settlements',row);
    if(typeof librarySettlements!=='undefined'){
      librarySettlements=alinV66MergeRows([row],librarySettlements);
    }
  }catch(e){ console.warn('library settlement db save failed, local saved', e); }
  await audit('finance','تثبيت تسوية مكتبة '+(lib.name||libraryId)+' سند '+receipt+' مبلغ '+amount);
  toast('تم حفظ التسوية وتحديث المتبقي');
  renderFinanceAdmin();
};

window.alinV65AllPayouts = alinV65AllPayouts = function(){
  let rows=[];
  try{ if(typeof financialPayouts!=='undefined') rows=rows.concat(financialPayouts||[]); }catch(e){}
  rows=rows.concat(alinV66ReadLocal('alin_v65_financial_payouts'));
  return alinV66MergeRows(rows,[]).filter(x=>x.status!=='reversed' && x.status!=='cancelled');
};
window.alinV65Paid = alinV65Paid = function(role,id){
  return alinV65AllPayouts().filter(x=>x.party_role===role && (role==='admin'||x.party_id===id) && (x.status==='paid'||x.status==='received')).reduce((a,x)=>a+(+x.amount||0),0);
};
window.alinV65Balance = alinV65Balance = function(role,id){
  const earned=alinV65Earned(role,id), paid=alinV65Paid(role,id);
  return {earned,paid,remaining:Math.max(0,earned-paid)};
};
window.alinV65PayBalance = alinV65PayBalance = async function(role,id){
  const b=alinV65Balance(role,id);
  if(b.remaining<=0) return toast('لا يوجد مبلغ مستحق حالياً');
  const name=alinV65PartyName(role,id);
  const label=role==='admin'?'استلام ربح المدير':'تسديد أرباح '+name;
  const amount=+(prompt(label+'\nالمبلغ المستحق: '+money(b.remaining)+' د.ع\nاكتب مبلغ التسديد', b.remaining)||0);
  if(!amount || amount<=0 || amount>b.remaining) return alert('المبلغ غير صحيح');
  const method=prompt('طريقة الدفع/الاستلام','نقدي')||'نقدي';
  const voucher=(role==='admin'?'AR':'PV')+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('FP'),voucher_number:voucher,party_role:role,party_id:role==='admin'?'admin':id,party_name:name,amount,payment_method:method,status:role==='admin'?'received':'paid',note:label,created_at:new Date().toISOString()};
  alinV66UpsertLocal('alin_v65_financial_payouts',row);
  try{
    await insert('financial_payouts',row);
    if(typeof financialPayouts!=='undefined') financialPayouts=alinV66MergeRows([row],financialPayouts);
  }catch(e){ console.warn('financial payout db save failed, local saved', e); }
  await audit('finance',label+' سند '+voucher+' مبلغ '+amount);
  toast('تم حفظ السند وتصفير الرصيد الجاري');
  renderFinanceAdmin();
};

const alinV66RenderLibraryBase = window.renderLibrary;
window.renderLibrary = renderLibrary = function(){
  alinV66RenderLibraryBase();
  if(current?.role!=='library' || !window.libraryHistory) return;
  const old=document.getElementById('alinV64LibraryDebt'); if(old) old.remove();
  const old2=document.getElementById('alinV65LibraryProfit'); if(old2) old2.remove();
  const d=alinV64LibraryDebt(current.id);
  const b=alinV65Balance('library',current.id);
  const box=document.createElement('div'); box.id='alinV66LibraryFinance'; box.className='notice';
  const exists=document.getElementById('alinV66LibraryFinance'); if(exists) exists.remove();
  box.innerHTML=`<b>حساب المكتبة</b><div>المبلغ بذمة المكتبة للإدارة: <strong>${money(d.remaining)} د.ع</strong><br>المسدّد من التسويات: ${money(d.paid)} د.ع<br>ربح المكتبة المستحق من طلبات المندوب: <strong>${money(b.remaining)} د.ع</strong><br>المسدد من الأرباح: ${money(b.paid)} د.ع</div><small>التسديد والتسوية من لوحة المدير فقط.</small>`;
  libraryHistory.prepend(box);
};

try{ if(typeof toast==='function') console.log('ALIN V66 settlement persistence fix loaded'); }catch(e){}

/* ================= ALIN V67 CURRENT BALANCE DISPLAY FIX ================= */
function alinV67SumTeacherBalances(){
  return (db.accounts?.teachers||[]).reduce((a,t)=>a+(+alinV65Balance('teacher',t.id).remaining||0),0);
}
function alinV67SumLibraryProfitBalances(){
  return (db.accounts?.libraries||[]).reduce((a,l)=>a+(+alinV65Balance('library',l.id).remaining||0),0);
}
function alinV67SumDelegateBalances(){
  return ((db.delegates||db.couriers||[])).reduce((a,d)=>a+(+alinV65Balance('delegate',d.id).remaining||0),0);
}
function alinV67SumLibrarySettlementDebt(){
  return (db.accounts?.libraries||[]).reduce((a,l)=>a+(+alinV64LibraryDebt(l.id).remaining||0),0);
}
function alinV67FinanceStatsHtml(){
  const adminBal=alinV65Balance('admin','admin').remaining;
  const teacherBal=alinV67SumTeacherBalances();
  const libraryDebt=alinV67SumLibrarySettlementDebt();
  const libraryProfit=alinV67SumLibraryProfitBalances();
  const delegateBal=alinV67SumDelegateBalances();
  return `<div class="stats">
    <div><b>ربح المدير الجاري</b><span>${money(adminBal)} د.ع</span></div>
    <div><b>أرباح المدرسين الجارية</b><span>${money(teacherBal)} د.ع</span></div>
    <div><b>متبقي تسويات المكتبات</b><span>${money(libraryDebt)} د.ع</span></div>
    <div><b>أرباح المكتبات عبر المندوب</b><span>${money(libraryProfit)} د.ع</span></div>
    <div><b>أرباح المندوبين</b><span>${money(delegateBal)} د.ع</span></div>
  </div>`;
}
function alinV67LibrarySettlementRows(){
  const libs=(db.accounts?.libraries||[]);
  return libs.map(l=>{
    const d=alinV64LibraryDebt(l.id);
    return `<div class="row settlement-row"><div><b>${esc(l.name||'مكتبة')}</b>
      <small>إجمالي المطلوب ${money(d.owed)} د.ع — المسدد ${money(d.paid)} د.ع — المتبقي ${money(d.remaining)} د.ع</small></div>
      <div class="row-actions"><button ${d.remaining<=0?'disabled':''} onclick="alinV64AdminSettleLibrary('${l.id}')">تثبيت تسوية</button></div></div>`;
  }).join('') || emptyState('لا توجد مكتبات');
}
function alinV67SettlementHistory(){
  const libs=(db.accounts?.libraries||[]);
  const rows=alinV64AllSettlements().slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  return rows.map(s=>{
    const l=libs.find(x=>x.id===s.library_id)||{};
    return `<div class="row"><div><b>${esc(s.receipt_number||s.id)} — ${esc(l.name||'')}</b>
      <small>${money(+s.amount||0)} د.ع — ${esc(s.payment_method||'نقدي')} — ${new Date(s.created_at||Date.now()).toLocaleString('ar-IQ')}</small></div>
      <div class="row-actions"><button class="secondary" onclick="alinV64PrintSettlement('${s.id||s.receipt_number}')">طباعة سند</button></div></div>`;
  }).join('') || emptyState('لا توجد سندات تسوية');
}
window.renderFinanceAdmin = renderFinanceAdmin = function(){
  adminContent.innerHTML = `<h2>الدفتر المالي والتسويات</h2>
  ${alinV67FinanceStatsHtml()}
  <h3>تسوية المكتبات</h3>
  <p class="muted">هذه تخص المبالغ التي استلمتها المكتبة من الطالب وبذمتها للإدارة. عند تثبيت التسوية ينخصم المبلغ فوراً ويبقى السند محفوظ.</p>
  ${alinV67LibrarySettlementRows()}
  <h3>أرصدة الأرباح المستحقة</h3>
  <p class="muted">هنا يتم تسديد أرباح المدرسين والمكتبات من طلبات المندوب والمندوبين، واستلام ربح المدير. كل تسديد يصفر الرصيد الجاري فقط ويحفظ السجل القديم.</p>
  ${alinV65AdminPartyCards()}
  <h3>سجل سندات تسوية المكتبات</h3>
  ${alinV67SettlementHistory()}
  <h3>سجل سندات الأرباح</h3>
  ${alinV65PayoutHistory()}`;
};
window.adminStatsRender = adminStatsRender = function(){
  if(!window.adminStats) return;
  const libraryDebt=alinV67SumLibrarySettlementDebt();
  const adminBal=alinV65Balance('admin','admin').remaining;
  const teacherBal=alinV67SumTeacherBalances();
  adminStats.innerHTML=`<div><b>الحسابات</b><span>${(db.accounts?.teachers||[]).length+(db.accounts?.libraries||[]).length}</span></div>
  <div><b>الملازم</b><span>${(db.booklets||[]).length}</span></div>
  <div><b>الطلبات</b><span>${(db.orders||[]).length}</span></div>
  <div><b>متبقي التسويات</b><span>${money(libraryDebt)} د.ع</span></div>
  <div><b>ربح المدير الجاري</b><span>${money(adminBal)} د.ع</span></div>
  <div><b>أرباح المدرسين الجارية</b><span>${money(teacherBal)} د.ع</span></div>`;
};
const alinV67OldPayBalance = window.alinV65PayBalance;
window.alinV65PayBalance = alinV65PayBalance = async function(role,id){
  await alinV67OldPayBalance(role,id);
  try{ adminStatsRender(); }catch(e){}
};
const alinV67OldSettleLibrary = window.alinV64AdminSettleLibrary;
window.alinV64AdminSettleLibrary = alinV64AdminSettleLibrary = async function(libraryId){
  await alinV67OldSettleLibrary(libraryId);
  try{ adminStatsRender(); }catch(e){}
};


/* ================= ALIN V68 BALANCE SYNC ALL DASHBOARDS ================= */
function alinV68PayoutRows(){
  let rows=[];
  try{ if(typeof financialPayouts!=='undefined') rows=rows.concat(financialPayouts||[]); }catch(e){}
  try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v65_financial_payouts')||'[]')); }catch(e){}
  try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v66_financial_payouts')||'[]')); }catch(e){}
  try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v67_financial_payouts')||'[]')); }catch(e){}
  try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v68_financial_payouts')||'[]')); }catch(e){}
  const seen=new Set();
  return rows.filter(x=>{
    const k=x.id||x.voucher_number;
    if(!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function alinV68LedgerRows(){
  return (db.ledger||[]).filter(x=>x.settlement_status!=='cancelled');
}
function alinV68Earned(role,id){
  const rows=alinV68LedgerRows();
  if(role==='admin') return rows.reduce((a,x)=>a+(+x.admin||+x.alin||0),0);
  if(role==='teacher') return rows.filter(x=>x.teacher_id===id).reduce((a,x)=>a+(+x.teacher||0),0);
  if(role==='library'){
    return rows.filter(x=>x.library_id===id && (x.delivery_type==='delegate'||x.delivery_type==='courier'||x.delegate_id||x.courier_id))
      .reduce((a,x)=>a+(+x.library||0),0);
  }
  if(role==='delegate') return rows.filter(x=>(x.delegate_id||x.courier_id)===id).reduce((a,x)=>a+(+x.delegate||0),0);
  return 0;
}
function alinV68Paid(role,id){
  return alinV68PayoutRows()
    .filter(x=>x.party_role===role && (role==='admin' || x.party_id===id) && (x.status==='paid'||x.status==='received'))
    .reduce((a,x)=>a+(+x.amount||0),0);
}
function alinV68Balance(role,id){
  const earned=alinV68Earned(role,id);
  const paid=alinV68Paid(role,id);
  return {earned,paid,remaining:Math.max(0,earned-paid)};
}
window.alinV68Balance=alinV68Balance;

/* Update teacher dashboard "المتبقي" so it shows current balance after payouts */
const alinV68RenderTeacherBase = window.renderTeacher;
window.renderTeacher = renderTeacher = function(){
  try{ alinV68RenderTeacherBase(); }catch(e){}
  if(current?.role!=='teacher') return;
  const b=alinV68Balance('teacher', current.id);
  try{
    const cards=[...(document.querySelectorAll('#teacherStats div, .stats div'))];
    cards.forEach(card=>{
      const label=(card.querySelector('b')?.textContent||'').trim();
      if(label.includes('المتبقي') || label.includes('مستحق')){
        const span=card.querySelector('span');
        if(span) span.textContent=money(b.remaining)+' د.ع';
      }
    });
  }catch(e){}
};

/* Update library page profit box and remove stale duplicate boxes */
const alinV68RenderLibraryBase = window.renderLibrary;
window.renderLibrary = renderLibrary = function(){
  try{ alinV68RenderLibraryBase(); }catch(e){}
  if(current?.role!=='library' || !window.libraryHistory) return;
  const b=alinV68Balance('library', current.id);
  ['alinV65LibraryProfit','alinV64LibraryDebt','alinV63LibraryDebt','alinV60LibraryDebt'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.remove();
  });
  const old=document.getElementById('alinV68LibraryProfit'); 
  if(old) old.remove();
  const box=document.createElement('div');
  box.id='alinV68LibraryProfit';
  box.className='notice';
  box.innerHTML=`<b>ربح المكتبة المستحق</b>
    <div>الرصيد الجاري بعد التسديد: <strong>${money(b.remaining)} د.ع</strong><br>
    إجمالي الربح: ${money(b.earned)} د.ع<br>
    المسدد من الإدارة: ${money(b.paid)} د.ع</div>
    <small>تسديد ربح المكتبة يتم من لوحة المدير.</small>`;
  libraryHistory.prepend(box);
};

/* Make finance admin cards depend on current balance everywhere */
function alinV68PartyName(role,id){
  if(role==='admin') return 'المدير';
  if(role==='teacher') return (db.accounts?.teachers||[]).find(x=>x.id===id)?.name || 'مدرس';
  if(role==='library') return (db.accounts?.libraries||[]).find(x=>x.id===id)?.name || 'مكتبة';
  if(role==='delegate') return (db.delegates||db.couriers||[]).find(x=>x.id===id)?.name || 'مندوب';
  return id||role;
}
async function alinV68PayBalance(role,id){
  const b=alinV68Balance(role,id);
  if(b.remaining<=0) return toast('لا يوجد مبلغ مستحق حالياً');
  const name=alinV68PartyName(role,id);
  const title=role==='admin'?'استلام ربح المدير':'تسديد أرباح '+name;
  const amount=+(prompt(title+'\nالرصيد الجاري: '+money(b.remaining)+' د.ع\nاكتب مبلغ التسديد', b.remaining)||0);
  if(!amount || amount<=0 || amount>b.remaining) return alert('المبلغ غير صحيح');
  const method=prompt('طريقة الدفع/الاستلام','نقدي')||'نقدي';
  const voucher=(role==='admin'?'AR':'PV')+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('FP'),voucher_number:voucher,party_role:role,party_id:role==='admin'?'admin':id,party_name:name,amount,payment_method:method,status:role==='admin'?'received':'paid',note:title,created_at:new Date().toISOString()};
  let saved=false;
  try{
    await insert('financial_payouts',row);
    saved=true;
  }catch(e){}
  try{
    const local=JSON.parse(localStorage.getItem('alin_v68_financial_payouts')||'[]');
    if(!local.some(x=>(x.id||x.voucher_number)===(row.id||row.voucher_number))){
      local.unshift(row);
      localStorage.setItem('alin_v68_financial_payouts',JSON.stringify(local));
    }
    saved=true;
  }catch(e){}
  try{ if(typeof financialPayouts!=='undefined') financialPayouts.unshift(row); }catch(e){}
  await audit('finance',title+' سند '+voucher+' مبلغ '+amount);
  toast(saved?'تم التسديد وتحديث كل الصفحات':'تعذر حفظ التسديد');
  await load();
  if(current?.role==='admin') renderFinanceAdmin();
  if(current?.role==='teacher') renderTeacher();
  if(current?.role==='library') renderLibrary();
}
window.alinV65PayBalance=alinV68PayBalance;
window.alinV68PayBalance=alinV68PayBalance;

const alinV68RenderFinanceBase = window.renderFinanceAdmin;
window.renderFinanceAdmin = renderFinanceAdmin = function(){
  try{ alinV68RenderFinanceBase(); }catch(e){ adminContent.innerHTML='<h2>الدفتر المالي والتسويات</h2>'; }
  const teachers=(db.accounts?.teachers||[]).map(t=>({role:'teacher',id:t.id,name:t.name,title:'أرباح المدرس'}));
  const libraries=(db.accounts?.libraries||[]).map(l=>({role:'library',id:l.id,name:l.name,title:'ربح المكتبة من طلبات المندوب'}));
  const delegates=(db.delegates||db.couriers||[]).map(d=>({role:'delegate',id:d.id,name:d.name,title:'أرباح المندوب'}));
  const parties=[{role:'admin',id:'admin',name:'المدير',title:'ربح المدير'}].concat(teachers,libraries,delegates);
  const html=`<h3>الأرصدة الجارية بعد التسديد</h3>
  <p class="muted">هذه الأرقام هي المتبقي الحقيقي بعد سندات التسديد، وتنعكس أيضاً بصفحة المدرس والمكتبة.</p>
  ${parties.map(p=>{
    const b=alinV68Balance(p.role,p.id);
    return `<div class="row settlement-row"><div><b>${esc(p.title)} — ${esc(p.name||'')}</b>
      <small>الإجمالي ${money(b.earned)} د.ع — المسدد ${money(b.paid)} د.ع — المتبقي ${money(b.remaining)} د.ع</small></div>
      <div class="row-actions"><button ${b.remaining<=0?'disabled':''} onclick="alinV68PayBalance('${p.role}','${p.id}')">${p.role==='admin'?'استلام ربح المدير':'تسديد الأرباح'}</button></div></div>`;
  }).join('')}`;
  adminContent.innerHTML += html;
};


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
window.alinV64PrintSettlement = function(id){
  const s=(typeof alinV64AllSettlements==='function'?alinV64AllSettlements():[]).find(x=>x.id===id || x.receipt_number===id);
  if(!s) return;
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===s.library_id)||{};
  const html=`<div class="line"><b>رقم السند</b><span>${esc(s.receipt_number||s.id)}</span></div>
    <div class="line"><b>المكتبة</b><span>${esc(lib.name||'')}</span></div>
    <div class="line"><b>طريقة الاستلام</b><span>${esc(s.payment_method||'نقدي')}</span></div>
    <div class="line"><b>التاريخ</b><span>${new Date(s.created_at||Date.now()).toLocaleString('ar-IQ')}</span></div>
    <div class="total"><b>المبلغ المستلم</b><br><span>${money(+s.amount||0)} د.ع</span></div>`;
  alinV69OpenPrint('سند تسوية مكتبة', html, 'تم تثبيت التسوية من لوحة المدير');
};
window.alinV65PrintPayout = window.alinV68PrintPayout = function(id){
  const rows=(typeof alinV68PayoutRows==='function'?alinV68PayoutRows():(typeof alinV65AllPayouts==='function'?alinV65AllPayouts():[]));
  const p=rows.find(x=>x.id===id || x.voucher_number===id);
  if(!p) return;
  const title=p.party_role==='admin'?'سند استلام ربح المدير':'سند صرف أرباح';
  const html=`<div class="line"><b>رقم السند</b><span>${esc(p.voucher_number||p.id)}</span></div>
    <div class="line"><b>الجهة</b><span>${esc(p.party_name||'')}</span></div>
    <div class="line"><b>نوع الحساب</b><span>${esc(p.party_role||'')}</span></div>
    <div class="line"><b>طريقة الدفع</b><span>${esc(p.payment_method||'نقدي')}</span></div>
    <div class="line"><b>التاريخ</b><span>${new Date(p.created_at||Date.now()).toLocaleString('ar-IQ')}</span></div>
    <div class="total"><b>المبلغ</b><br><span>${money(+p.amount||0)} د.ع</span></div>`;
  alinV69OpenPrint(title, html, 'تم تسجيل السند وحفظه في سجل منصة آلين');
};


/* ================= ALIN V70 TEACHER PROFIT TITLES FIX ================= */
function alinV70BookletTitleFromLedger(x){
  const direct=String(x.title||'').trim();
  if(direct && !/^[A-Za-z0-9]{12,}$/i.test(direct) && !/^O[0-9a-f]+$/i.test(direct)) return direct;
  const o=(db.orders||[]).find(o=>o.id===x.order_id || o.order_number===x.order_number);
  if(o?.title) return o.title;
  const itemId=x.item_id || o?.item_id;
  const b=(db.booklets||[]).find(b=>b.id===itemId);
  return b?.title || b?.name || 'ملزمة';
}
const alinV70RenderTeacherBase=window.renderTeacher;
window.renderTeacher=renderTeacher=function(){
  try{alinV70RenderTeacherBase();}catch(e){}
  if(current?.role!=='teacher') return;
  const teacherId=current.id;
  const rows=(db.ledger||[]).filter(x=>x.teacher_id===teacherId && x.settlement_status!=='cancelled');
  const candidates=[...document.querySelectorAll('#teacherContent .row, #teacherHistory .row, #teacherPayouts .row, .teacher-page .row')];
  candidates.forEach(row=>{
    const txt=(row.textContent||'');
    rows.forEach(x=>{
      const bad=[x.order_id,x.order_number].filter(Boolean);
      bad.forEach(id=>{
        if(txt.includes(String(id))){
          const title=alinV70BookletTitleFromLedger(x);
          row.querySelectorAll('b,strong').forEach(el=>{
            if((el.textContent||'').includes(String(id))) el.textContent=title;
          });
        }
      });
    });
  });
};


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
function alinV71FilterByPeriod(rows, mode, from, to){
  const today=new Date();
  let start='', end='';
  if(mode==='today'){
    start=end=today.toISOString().slice(0,10);
  }else if(mode==='month'){
    start=today.toISOString().slice(0,7)+'-01';
    end=today.toISOString().slice(0,10);
  }else{
    start=from||'';
    end=to||'';
  }
  return rows.filter(x=>{
    const d=alinV71DateOnly(x.created_at||x.settled_at||x.settlement_at||'');
    if(start && d<start) return false;
    if(end && d>end) return false;
    return true;
  });
}
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
function alinV71ExportFinanceCsv(){
  const rows=(db.ledger||[]).filter(x=>x.settlement_status!=='cancelled');
  const header=['رقم الطلب','التاريخ','المدير','المدرس','المكتبة','المندوب','الإجمالي','الحالة'];
  const csv='\ufeff'+[header].concat(rows.map(x=>[
    x.order_number||x.order_id||'',
    x.created_at||x.settled_at||'',
    x.admin||x.alin||0,
    x.teacher||0,
    x.library||0,
    x.delegate||0,
    x.total||0,
    x.settlement_status||''
  ])).map(r=>r.map(alinV71CsvCell).join(',')).join('\n');
  alinV71Download('alin-finance-'+new Date().toISOString().slice(0,10)+'.csv',csv,'text/csv;charset=utf-8');
  alinV71Audit('export_finance','تصدير الحسابات Excel/CSV');
}
function alinV71Backup(){
  const data={version:ALIN_V71_VERSION,created_at:alinV71Now(),db};
  alinV71Download('alin-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
  alinV71Audit('backup','تنزيل نسخة احتياطية');
}
window.alinV71ExportFinanceCsv=alinV71ExportFinanceCsv;
window.alinV71Backup=alinV71Backup;

function alinV71OrderStatusLabel(s){
  const map={new:'جديد',printing:'قيد الطباعة',ready:'جاهز',completed:'مسلّم',delivered:'مسلّم',cancelled:'ملغي'};
  return map[s]||s||'جديد';
}
function alinV71StatusClass(s){ return 'status-badge status-'+(s||'new'); }
async function alinV71SetOrderStatus(id,status){
  const o=(db.orders||[]).find(x=>x.id===id); if(!o)return;
  const h=[...(o.status_history||[]),{status,at:alinV71Now(),by:alinV71UserLabel()}];
  try{ await update('orders',{status,status_history:h},{id}); }catch(e){}
  o.status=status; o.status_history=h;
  await alinV71Audit('order_status','تغيير حالة الطلب '+(o.order_number||id)+' إلى '+alinV71OrderStatusLabel(status),{order_id:id,status});
  if(status==='completed'||status==='delivered') await alinV71Notify('admin','', 'طلب مسلّم', 'تم تسليم الطلب '+(o.order_number||id)+' بواسطة '+alinV71UserLabel());
  renderAll();
}
window.alinV71SetOrderStatus=alinV71SetOrderStatus;

function alinV71OrderSearchHtml(containerId='alinOrderSearch'){
  return `<div class="toolbar"><input id="${containerId}" placeholder="بحث سريع: رقم الطلب أو اسم الطالب" oninput="renderAll()" style="min-width:260px"></div>`;
}
function alinV71OrderMatches(o, inputId='alinOrderSearch'){
  const q=(document.getElementById(inputId)?.value||'').trim().toLowerCase();
  if(!q) return true;
  return String(o.order_number||o.id||'').toLowerCase().includes(q) || String(o.student_name||'').toLowerCase().includes(q) || String(o.student_phone||'').toLowerCase().includes(q);
}
function alinV71StatusControls(o){
  return `<span class="${alinV71StatusClass(o.status)}">${alinV71OrderStatusLabel(o.status)}</span>
  <select onchange="alinV71SetOrderStatus('${o.id}',this.value)">
    <option value="">تغيير الحالة</option>
    <option value="new">جديد</option>
    <option value="printing">قيد الطباعة</option>
    <option value="ready">جاهز</option>
    <option value="completed">مسلّم</option>
    <option value="cancelled">ملغي</option>
  </select>`;
}

/* wrap settlement and payout functions with audit/notification */
const alinV71OldPayBalance=window.alinV68PayBalance||window.alinV65PayBalance;
if(alinV71OldPayBalance){
  window.alinV68PayBalance=window.alinV65PayBalance=async function(role,id){
    await alinV71OldPayBalance(role,id);
    await alinV71Audit('payout','تسديد/استلام أرباح '+role+' '+(id||''),{role,id});
    if(role==='teacher') await alinV71Notify('teacher',id,'تم تسديد أرباحك','تم تسجيل سند تسديد أرباح من الإدارة.');
    if(role==='library') await alinV71Notify('library',id,'تم تسديد ربح المكتبة','تم تسجيل سند تسديد ربح المكتبة من الإدارة.');
  };
}
const alinV71OldAdminSettle=window.alinV64AdminSettleLibrary;
if(alinV71OldAdminSettle){
  window.alinV64AdminSettleLibrary=async function(libraryId){
    await alinV71OldAdminSettle(libraryId);
    await alinV71Audit('library_settlement','تثبيت تسوية مكتبة '+libraryId,{library_id:libraryId});
    await alinV71Notify('library',libraryId,'تم تثبيت تسوية المكتبة','تم تحديث حساب التسوية من لوحة المدير.');
  };
}
const alinV71OldSaveRatios=window.saveFinanceRatiosV57;
if(alinV71OldSaveRatios){
  window.saveFinanceRatiosV57=async function(){
    await alinV71OldSaveRatios();
    await alinV71Audit('profit_ratio','تعديل نسب الأرباح من الإعدادات');
    await alinV71Notify('admin','','تعديل نسب الأرباح','تم تعديل نسب أرباح المنصة.');
  };
}

/* Admin finance enhancement: filters, export, audit, notifications */
const alinV71RenderFinanceBase=window.renderFinanceAdmin;
window.renderFinanceAdmin=renderFinanceAdmin=function(){
  try{ alinV71RenderFinanceBase(); }catch(e){ adminContent.innerHTML='<h2>الدفتر المالي والتسويات</h2>'; }
  const mode=document.getElementById('alinV71FinanceMode')?.value||'all';
  const from=document.getElementById('alinV71FinanceFrom')?.value||'';
  const to=document.getElementById('alinV71FinanceTo')?.value||'';
  const rows=alinV71FilterByPeriod((db.ledger||[]).filter(x=>x.settlement_status!=='cancelled'),mode,from,to);
  const total=rows.reduce((a,x)=>a+(+x.total||0),0);
  const admin=rows.reduce((a,x)=>a+(+x.admin||+x.alin||0),0);
  const teacher=rows.reduce((a,x)=>a+(+x.teacher||0),0);
  const library=rows.reduce((a,x)=>a+(+x.library||0),0);
  const extra=`<h3>فلتر الحسابات والتصدير</h3>
    <div class="toolbar">
      <select id="alinV71FinanceMode" onchange="renderFinanceAdmin()">
        <option value="all" ${mode==='all'?'selected':''}>كل الفترات</option>
        <option value="today" ${mode==='today'?'selected':''}>اليوم</option>
        <option value="month" ${mode==='month'?'selected':''}>هذا الشهر</option>
        <option value="custom" ${mode==='custom'?'selected':''}>تاريخ محدد</option>
      </select>
      <input type="date" id="alinV71FinanceFrom" value="${esc(from)}" onchange="renderFinanceAdmin()">
      <input type="date" id="alinV71FinanceTo" value="${esc(to)}" onchange="renderFinanceAdmin()">
      <button onclick="alinV71ExportFinanceCsv()">تصدير Excel</button>
      <button class="secondary" onclick="alinV71Backup()">نسخ احتياطي</button>
    </div>
    <div class="stats"><div><b>إجمالي الفترة</b><span>${alinV71Money(total)} د.ع</span></div><div><b>ربح المدير</b><span>${alinV71Money(admin)} د.ع</span></div><div><b>المدرسين</b><span>${alinV71Money(teacher)} د.ع</span></div><div><b>المكتبات/المندوب</b><span>${alinV71Money(library)} د.ع</span></div></div>`;
  adminContent.innerHTML += extra;
};

/* Admin settings: fixed version */
const alinV71RenderSettingsBase=window.renderSettingsAdmin;
window.renderSettingsAdmin=renderSettingsAdmin=function(){
  try{ alinV71RenderSettingsBase(); }catch(e){ adminContent.innerHTML='<h2>الإعدادات</h2>'; }
  adminContent.innerHTML += `<h3>معلومات الإصدار</h3>
  <div class="notice"><b>الإصدار المرفوع حالياً</b><div>${ALIN_V71_VERSION}</div><small>تم إصلاح كاش الملفات وربط أدوات الإدارة بهذا الإصدار.</small></div>`;
};

/* Admin audit and notifications sections injected into dashboard/accounts if available */
function alinV71RenderAdminTools(){
  if(current?.role!=='admin' || !window.adminContent) return;
  const logs=alinV71AuditRows().slice(0,25);
  const notes=alinV71NotificationRows().slice(0,20);
  adminContent.innerHTML += `<h3>سجل التدقيق</h3>
    ${logs.map(x=>`<div class="row"><div><b>${esc(x.action||'')}</b><small>${esc(x.details||'')} — ${esc(x.user_name||'')} — ${new Date(x.created_at||Date.now()).toLocaleString('ar-IQ')}</small></div></div>`).join('')||emptyState('لا يوجد سجل تدقيق')}
    <h3>الإشعارات الداخلية</h3>
    <div class="form-grid"><input id="alinNotifyTitle" placeholder="عنوان الإشعار"><input id="alinNotifyMsg" placeholder="نص الإشعار">
    <select id="alinNotifyRole"><option value="all">الكل</option><option value="admin">المدير</option><option value="teacher">المدرسين</option><option value="library">المكتبات</option></select>
    <button onclick="alinV71SendManualNotification()">إرسال إشعار</button></div>
    ${notes.map(n=>`<div class="row"><div><b>${esc(n.title||'')}</b><small>${esc(n.message||'')} — إلى: ${esc(n.target_role||'all')} — ${new Date(n.created_at||Date.now()).toLocaleString('ar-IQ')}</small></div></div>`).join('')||emptyState('لا توجد إشعارات')}`;
}
async function alinV71SendManualNotification(){
  const title=document.getElementById('alinNotifyTitle')?.value||'إشعار';
  const msg=document.getElementById('alinNotifyMsg')?.value||'';
  const role=document.getElementById('alinNotifyRole')?.value||'all';
  await alinV71Notify(role,'',title,msg);
  await alinV71Audit('notification','إرسال إشعار داخلي إلى '+role);
  renderAll();
}
window.alinV71SendManualNotification=alinV71SendManualNotification;

const alinV71RenderAdminBase=window.renderAdmin;
if(alinV71RenderAdminBase){
  window.renderAdmin=renderAdmin=function(){
    try{ alinV71RenderAdminBase(); }catch(e){}
    setTimeout(()=>{try{alinV71RenderAdminTools()}catch(e){}},50);
  };
}

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
const alinV71RenderTeacherBase2=window.renderTeacher;
window.renderTeacher=renderTeacher=function(){
  try{ alinV71RenderTeacherBase2(); }catch(e){}
  alinV71InjectNotifications(document.getElementById('teacherContent')||document.body);
};
const alinV71RenderLibraryBase2=window.renderLibrary;
window.renderLibrary=renderLibrary=function(){
  try{ alinV71RenderLibraryBase2(); }catch(e){}
  alinV71InjectNotifications(document.getElementById('libraryHistory')||document.body);
};

/* Improve order rows after render: search + status labels */
const alinV71RenderOrdersAdminBase=window.renderOrdersAdmin;
if(alinV71RenderOrdersAdminBase){
  window.renderOrdersAdmin=renderOrdersAdmin=function(){
    alinV71RenderOrdersAdminBase();
    if(!window.adminContent) return;
    if(!document.getElementById('alinOrderSearch')) adminContent.innerHTML = alinV71OrderSearchHtml('alinOrderSearch') + adminContent.innerHTML;
    document.querySelectorAll('.row').forEach(row=>{
      const txt=row.textContent||'';
      const o=(db.orders||[]).find(o=>txt.includes(o.order_number||o.id));
      if(o && !row.querySelector('.status-badge')){
        const div=document.createElement('div');
        div.className='row-actions';
        div.innerHTML=alinV71StatusControls(o);
        row.appendChild(div);
      }
      if(o && !alinV71OrderMatches(o,'alinOrderSearch')) row.style.display='none';
    });
  };
}

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


/* ================= ALIN V72 MODERN STUDENT STOREFRONT ================= */
const ALIN_V72_VERSION='V72 Modern Student Store';
let alinV72StoreCategory='all';
let alinV72StoreSearch='';

function alinV72ProductImage(item){
  const raw=item?.image_path||item?.image||item?.cover_path||item?.teacher_image||'';
  if(!raw) return '';
  try{return mediaUrl(raw)}catch(e){return raw}
}
function alinV72StoreItems(){
  const books=(db.booklets||[]).filter(x=>x.status!=='hidden' && x.is_hidden!==true).map(x=>({...x,_type:'booklet',_category:'booklets'}));
  const products=(db.products||[]).filter(x=>x.status!=='hidden' && x.is_hidden!==true).map(x=>({...x,_type:'product',_category:x.category_id||x.category||'products'}));
  return books.concat(products);
}
function alinV72Matches(item){
  const q=(alinV72StoreSearch||'').trim().toLowerCase();
  const cat=alinV72StoreCategory;
  const categoryOk=cat==='all' || item._category===cat || item.category_id===cat || item.category===cat;
  if(!categoryOk) return false;
  if(!q) return true;
  const teacher=(db.accounts?.teachers||[]).find(t=>t.id===item.teacher_id)?.name||'';
  return [item.title,item.name,item.subject,item.grade,teacher].some(v=>String(v||'').toLowerCase().includes(q));
}
function alinV72OrderCount(item){
  return (db.orders||[]).filter(o=>o.item_id===item.id && o.status!=='cancelled').reduce((a,o)=>a+(+o.qty||1),0);
}
function alinV72TeacherName(item){
  return (db.accounts?.teachers||[]).find(t=>t.id===item.teacher_id)?.name||'';
}
function alinV72Card(item){
  const img=alinV72ProductImage(item);
  const title=item.title||item.name||'منتج';
  const teacher=alinV72TeacherName(item);
  const price=+item.price||0;
  const orderFn=item._type==='booklet'
    ? `openBooklet('${item.id}')`
    : `addToCart('${item.id}','product')`;
  return `<article class="alin-v72-card">
    <div class="alin-v72-cover">${img?`<img src="${esc(img)}" alt="${esc(title)}">`:`<div class="alin-v72-placeholder">آلين</div>`}
      ${alinV72OrderCount(item)>0?`<span class="alin-v72-hot">الأكثر طلباً</span>`:''}
    </div>
    <div class="alin-v72-card-body">
      <h3>${esc(title)}</h3>
      ${teacher?`<p class="alin-v72-teacher">${esc(teacher)}</p>`:''}
      ${item.subject||item.grade?`<small>${esc([item.subject,item.grade].filter(Boolean).join(' • '))}</small>`:''}
      <div class="alin-v72-buy"><strong>${money(price)} د.ع</strong><button onclick="${orderFn}">اطلب الآن</button></div>
    </div>
  </article>`;
}
function alinV72SetCategory(cat){
  alinV72StoreCategory=cat;
  alinV72RenderStore();
}
function alinV72Search(value){
  alinV72StoreSearch=value||'';
  alinV72RenderStore();
}
window.alinV72SetCategory=alinV72SetCategory;
window.alinV72Search=alinV72Search;

function alinV72RenderStore(){
  if(current?.role && current.role!=='student' && current.role!=='customer') return;
  const root=document.getElementById('storeView')||document.getElementById('storeContent')||document.querySelector('.store-page')||document.getElementById('shop');
  if(!root) return;
  const items=alinV72StoreItems();
  const visible=items.filter(alinV72Matches);
  const popular=items.slice().sort((a,b)=>alinV72OrderCount(b)-alinV72OrderCount(a)).filter(x=>alinV72OrderCount(x)>0).slice(0,6);
  const latest=items.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).slice(0,8);
  const cats=(db.categories||[]).slice(0,8);
  const libs=(db.accounts?.libraries||[]).slice(0,6);
  root.innerHTML=`<div class="alin-v72-store">
    <header class="alin-v72-top">
      <div class="alin-v72-brand"><div class="alin-v72-logo">آ</div><div><b>منصة آلين</b><small>الملازم والقرطاسية والهدايا</small></div></div>
      <div class="alin-v72-search"><span>⌕</span><input value="${esc(alinV72StoreSearch)}" oninput="alinV72Search(this.value)" placeholder="ابحث عن ملزمة، مدرس أو مادة"></div>
      <button class="alin-v72-cart" onclick="openCart()">السلة <span>${(db.cart||[]).length||0}</span></button>
    </header>

    <section class="alin-v72-hero">
      <div><span class="alin-v72-kicker">منصة الطالب</span><h1>كل ما تحتاجه للدراسة<br>بمكان واحد</h1>
      <p>اختر ملزمتك أو قرطاسيتك واطلبها بسهولة من منصة آلين.</p>
      <button onclick="document.getElementById('alinV72Products').scrollIntoView({behavior:'smooth'})">تصفح المنتجات</button></div>
      <div class="alin-v72-hero-mark">ALIN<small>منصة آلين</small></div>
    </section>

    <nav class="alin-v72-cats">
      <button class="${alinV72StoreCategory==='all'?'active':''}" onclick="alinV72SetCategory('all')"><span>⌂</span>الكل</button>
      <button class="${alinV72StoreCategory==='booklets'?'active':''}" onclick="alinV72SetCategory('booklets')"><span>▤</span>الملازم</button>
      ${cats.map(c=>`<button class="${alinV72StoreCategory===c.id?'active':''}" onclick="alinV72SetCategory('${c.id}')"><span>◇</span>${esc(c.name||c.title||'قسم')}</button>`).join('')}
    </nav>

    ${popular.length?`<section class="alin-v72-section"><div class="alin-v72-section-head"><div><small>اختيارات الطلاب</small><h2>الأكثر طلباً</h2></div></div><div class="alin-v72-grid">${popular.map(alinV72Card).join('')}</div></section>`:''}

    <section class="alin-v72-section" id="alinV72Products"><div class="alin-v72-section-head"><div><small>${alinV72StoreSearch?'نتائج البحث':'المتجر'}</small><h2>${alinV72StoreSearch?'النتائج':'وصل حديثاً'}</h2></div><span>${visible.length} منتج</span></div>
      <div class="alin-v72-grid">${(alinV72StoreSearch||alinV72StoreCategory!=='all'?visible:latest).map(alinV72Card).join('') || `<div class="alin-v72-empty">لا توجد نتائج مطابقة</div>`}</div>
    </section>

    ${libs.length?`<section class="alin-v72-section"><div class="alin-v72-section-head"><div><small>نقاط الاستلام</small><h2>مكتبات منصة آلين</h2></div></div><div class="alin-v72-libs">${libs.map(l=>`<div><span class="alin-v72-lib-icon">م</span><b>${esc(l.name||'مكتبة')}</b><small>${esc([l.area,l.landmark].filter(Boolean).join(' • '))}</small><em>${typeof libIsOpen==='function'&&libIsOpen(l)?'مفتوحة الآن':'متاحة للاستلام'}</em></div>`).join('')}</div></section>`:''}

    <footer class="alin-v72-footer"><b>منصة آلين</b><span>طلب أسهل • طباعة منظمة • استلام سريع</span></footer>
    <nav class="alin-v72-mobile-nav"><button onclick="alinV72SetCategory('all')">⌂<small>الرئيسية</small></button><button onclick="alinV72SetCategory('booklets')">▤<small>الملازم</small></button><button onclick="document.getElementById('alinV72Products').scrollIntoView()">◇<small>الأقسام</small></button><button onclick="openCart()">▣<small>السلة</small></button></nav>
  </div>`;
}
window.alinV72RenderStore=alinV72RenderStore;

/* Attach after existing store renderers without touching finance/admin */
const alinV72StoreCandidates=['renderStore','renderShop','renderHome','renderStorefront'];
alinV72StoreCandidates.forEach(name=>{
  if(typeof window[name]==='function'){
    const old=window[name];
    window[name]=function(...args){
      const result=old.apply(this,args);
      setTimeout(()=>{try{alinV72RenderStore()}catch(e){console.warn('V72 store',e)}},20);
      return result;
    };
  }
});
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{try{alinV72RenderStore()}catch(e){}},700));

/* version display */
const alinV72SettingsBase=window.renderSettingsAdmin;
if(alinV72SettingsBase){
  window.renderSettingsAdmin=renderSettingsAdmin=function(){
    alinV72SettingsBase();
    if(window.adminContent) adminContent.innerHTML += `<div class="notice"><b>واجهة المتجر</b><div>${ALIN_V72_VERSION}</div><small>واجهة الطالب الحديثة مفعلة بدون تغيير النظام المالي.</small></div>`;
  };
}

/* Store CSS */
const alinV72Style=document.createElement('style');
alinV72Style.textContent=`
.alin-v72-store{--ink:#0b1830;--gold:#c99021;--soft:#f4f7fb;max-width:1450px;margin:auto;color:var(--ink);padding-bottom:85px}
.alin-v72-top{display:grid;grid-template-columns:auto minmax(280px,620px) auto;gap:24px;align-items:center;padding:18px 4px}
.alin-v72-brand{display:flex;align-items:center;gap:11px}.alin-v72-brand b{display:block;font-size:21px}.alin-v72-brand small{display:block;color:#758196}
.alin-v72-logo{width:48px;height:48px;border-radius:16px;background:var(--ink);color:#f4c96d;display:grid;place-items:center;font-size:28px;font-weight:900}
.alin-v72-search{height:52px;background:#fff;border:1px solid #dfe6ef;border-radius:16px;display:flex;align-items:center;padding:0 16px;box-shadow:0 8px 25px rgba(20,38,70,.05)}
.alin-v72-search span{font-size:27px}.alin-v72-search input{border:0!important;outline:0;width:100%;box-shadow:none!important;background:transparent!important;font-size:15px}
.alin-v72-cart{border:0;border-radius:14px;background:var(--ink);color:#fff;padding:14px 18px;font-weight:800}.alin-v72-cart span{background:#d49a2b;border-radius:99px;padding:2px 7px;margin-right:6px}
.alin-v72-hero{min-height:360px;border-radius:32px;padding:54px 60px;display:flex;align-items:center;justify-content:space-between;overflow:hidden;background:radial-gradient(circle at 15% 20%,#28466f 0,transparent 35%),linear-gradient(125deg,#071225,#10284b);color:#fff;position:relative}
.alin-v72-hero h1{font-size:clamp(36px,5vw,68px);line-height:1.12;margin:12px 0}.alin-v72-hero p{color:#cbd5e4;font-size:18px;max-width:580px}.alin-v72-hero button{border:0;background:#d19a31;color:#071225;padding:15px 24px;border-radius:14px;font-weight:900}
.alin-v72-kicker{background:rgba(255,255,255,.09);padding:7px 12px;border-radius:99px;color:#f0c875}.alin-v72-hero-mark{font-size:90px;font-weight:900;color:rgba(255,255,255,.07);transform:rotate(-8deg);text-align:center}.alin-v72-hero-mark small{display:block;font-size:24px;color:#d4a341}
.alin-v72-cats{display:flex;gap:12px;overflow:auto;padding:22px 2px}.alin-v72-cats button{min-width:120px;border:1px solid #e0e6ee;background:#fff;border-radius:18px;padding:14px;font-weight:800;color:#34445e}.alin-v72-cats button span{display:block;font-size:24px;margin-bottom:5px}.alin-v72-cats button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.alin-v72-section{padding:26px 2px}.alin-v72-section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.alin-v72-section-head small{color:#b27b15;font-weight:800}.alin-v72-section-head h2{font-size:30px;margin:4px 0}.alin-v72-section-head>span{color:#718096}
.alin-v72-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.alin-v72-card{background:#fff;border:1px solid #e5eaf1;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(20,38,70,.05);transition:.2s}.alin-v72-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(20,38,70,.10)}
.alin-v72-cover{aspect-ratio:4/3;background:#eef2f7;position:relative;overflow:hidden}.alin-v72-cover img{width:100%;height:100%;object-fit:cover}.alin-v72-placeholder{width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(145deg,#10294d,#071225);color:#d5a23c;font-size:45px;font-weight:900}.alin-v72-hot{position:absolute;top:12px;right:12px;background:#fff5d9;color:#8d5a00;border-radius:99px;padding:6px 10px;font-size:11px;font-weight:900}
.alin-v72-card-body{padding:16px}.alin-v72-card h3{margin:0 0 7px;font-size:18px}.alin-v72-teacher{margin:0 0 5px;color:#52627a}.alin-v72-card small{color:#8490a2}.alin-v72-buy{display:flex;justify-content:space-between;align-items:center;margin-top:16px}.alin-v72-buy strong{font-size:18px}.alin-v72-buy button{border:0;border-radius:12px;background:var(--ink);color:#fff;padding:10px 14px;font-weight:800}
.alin-v72-libs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.alin-v72-libs>div{background:#fff;border:1px solid #e4eaf2;border-radius:18px;padding:17px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:center}.alin-v72-lib-icon{grid-row:1/4;width:44px;height:44px;border-radius:14px;background:#edf2f8;display:grid;place-items:center;font-weight:900}.alin-v72-libs small{color:#7a8799}.alin-v72-libs em{grid-column:3;grid-row:1/3;color:#16834a;font-style:normal;font-size:12px;font-weight:800}
.alin-v72-empty{grid-column:1/-1;padding:45px;text-align:center;background:#f7f9fc;border-radius:20px;color:#758196}.alin-v72-footer{margin-top:30px;border-radius:24px;background:#0b1830;color:#fff;padding:28px;display:flex;justify-content:space-between}.alin-v72-footer span{color:#bfc9d8}
.alin-v72-mobile-nav{display:none}
@media(max-width:900px){.alin-v72-store{padding:0 10px 90px}.alin-v72-top{grid-template-columns:1fr auto}.alin-v72-search{grid-column:1/-1;grid-row:2}.alin-v72-hero{padding:36px 25px;min-height:320px}.alin-v72-hero-mark{display:none}.alin-v72-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.alin-v72-libs{grid-template-columns:1fr}.alin-v72-mobile-nav{display:grid;grid-template-columns:repeat(4,1fr);position:fixed;bottom:0;left:0;right:0;z-index:999;background:#fff;border-top:1px solid #e1e7ef;padding:8px 6px calc(8px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(20,38,70,.08)}.alin-v72-mobile-nav button{border:0;background:transparent;color:#182943;font-size:20px}.alin-v72-mobile-nav small{display:block;font-size:10px;margin-top:3px}}
@media(max-width:560px){.alin-v72-brand small{display:none}.alin-v72-cart{padding:12px}.alin-v72-hero h1{font-size:38px}.alin-v72-hero p{font-size:15px}.alin-v72-grid{gap:10px}.alin-v72-card{border-radius:16px}.alin-v72-card-body{padding:12px}.alin-v72-card h3{font-size:15px}.alin-v72-buy{display:block}.alin-v72-buy button{width:100%;margin-top:10px}.alin-v72-section-head h2{font-size:25px}.alin-v72-footer{display:block;text-align:center}.alin-v72-footer span{display:block;margin-top:6px}}
`;
document.head.appendChild(alinV72Style);


/* ================= ALIN V73 PRODUCTS FORM + STOREFRONT FIX ================= */
const ALIN_V73_PRODUCTS_VERSION='V73 Products & Store Fix';

function alinV73ProductDetails(p){
  return p.details || p.description || p.note || p.notes || '';
}
function alinV73ProductImage(p){
  const raw=p.image_path||p.image||p.file_path||p.cover_path||'';
  if(!raw) return '';
  try{return mediaUrl(raw)}catch(e){return raw}
}
async function alinV73UploadProductFile(file){
  if(!file) return '';
  try{
    if(typeof uploadFile==='function') return await uploadFile(file,'products');
    if(typeof uploadToStorage==='function') return await uploadToStorage(file,'products');
  }catch(e){ console.warn('product upload',e); }
  return '';
}
async function alinV73AddProduct(){
  const category=(document.getElementById('alinV73ProductCategory')?.value||'').trim();
  const name=(document.getElementById('alinV73ProductName')?.value||'').trim();
  const details=(document.getElementById('alinV73ProductDetails')?.value||'').trim();
  const price=+(document.getElementById('alinV73ProductPrice')?.value||0);
  const stock=+(document.getElementById('alinV73ProductStock')?.value||0);
  const file=document.getElementById('alinV73ProductFile')?.files?.[0];
  if(!category) return alert('اختار قسم المنتج');
  if(!name) return alert('اكتب اسم المنتج');
  if(price<0 || stock<0) return alert('السعر أو المخزون غير صحيح');
  let image_path='';
  if(file){
    image_path=await alinV73UploadProductFile(file);
    if(!image_path){
      try{
        image_path=await new Promise((resolve,reject)=>{
          const r=new FileReader();
          r.onload=()=>resolve(r.result);
          r.onerror=reject;
          r.readAsDataURL(file);
        });
      }catch(e){}
    }
  }
  const row={
    id:uid('PR'),
    name,
    title:name,
    details,
    description:details,
    price,
    stock,
    category,
    category_id:category,
    image_path,
    status:'active',
    created_at:new Date().toISOString()
  };
  try{
    await insert('products',row);
    db.products=db.products||[];
    db.products.unshift(row);
  }catch(e){
    console.error(e);
    return alert('تعذر حفظ المنتج');
  }
  try{ await audit('product','إضافة المنتج '+name); }catch(e){}
  toast('تمت إضافة المنتج وظهر في المتجر');
  alinV73ClearProductForm();
  if(typeof renderProductsAdmin==='function') renderProductsAdmin();
  if(typeof alinV72RenderStore==='function') alinV72RenderStore();
}
function alinV73ClearProductForm(){
  ['alinV73ProductName','alinV73ProductDetails','alinV73ProductPrice','alinV73ProductStock','alinV73ProductFile'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    if(el.type==='file') el.value='';
    else el.value='';
  });
}
async function alinV73EditProduct(id){
  const p=(db.products||[]).find(x=>x.id===id); if(!p)return;
  const name=prompt('اسم المنتج',p.name||p.title||''); if(name===null)return;
  const details=prompt('تفاصيل المنتج',alinV73ProductDetails(p)); if(details===null)return;
  const price=+(prompt('السعر',p.price||0)||0);
  const stock=+(prompt('المخزون',p.stock||0)||0);
  const payload={name,title:name,details,description:details,price,stock};
  try{await update('products',payload,{id}); Object.assign(p,payload);}catch(e){return alert('تعذر تعديل المنتج');}
  toast('تم تعديل المنتج');
  renderProductsAdmin();
  if(typeof alinV72RenderStore==='function') alinV72RenderStore();
}
async function alinV73DeleteProduct(id){
  const p=(db.products||[]).find(x=>x.id===id); if(!p)return;
  if(!confirm('حذف المنتج '+(p.name||p.title||'')+'؟'))return;
  try{await remove('products',{id}); db.products=db.products.filter(x=>x.id!==id);}catch(e){return alert('تعذر حذف المنتج');}
  toast('تم حذف المنتج');
  renderProductsAdmin();
  if(typeof alinV72RenderStore==='function') alinV72RenderStore();
}
window.alinV73AddProduct=alinV73AddProduct;
window.alinV73EditProduct=alinV73EditProduct;
window.alinV73DeleteProduct=alinV73DeleteProduct;

window.renderProductsAdmin = renderProductsAdmin = function(){
  if(!window.adminContent)return;
  const cats=(db.categories||[]);
  const products=(db.products||[]);
  adminContent.innerHTML=`<h2>المنتجات</h2>
  <div class="alin-v73-product-form">
    <select id="alinV73ProductCategory">
      <option value="">اختار القسم</option>
      ${cats.map(c=>`<option value="${esc(c.id||c.name)}">${esc(c.name||c.title||'قسم')}</option>`).join('')}
      <option value="stationery">قرطاسية</option>
      <option value="gifts">هدايا</option>
    </select>
    <input id="alinV73ProductName" placeholder="اسم المنتج">
    <textarea id="alinV73ProductDetails" placeholder="تفاصيل المنتج"></textarea>
    <input id="alinV73ProductPrice" type="number" min="0" placeholder="السعر">
    <input id="alinV73ProductStock" type="number" min="0" placeholder="المخزون">
    <label class="alin-v73-file-label">صورة/ملف المنتج<input id="alinV73ProductFile" type="file" accept="image/*"></label>
    <button onclick="alinV73AddProduct()">إضافة المنتج</button>
  </div>
  <div class="alin-v73-product-list">
    ${products.map(p=>`<div class="alin-v73-product-row">
      <div class="alin-v73-product-thumb">${alinV73ProductImage(p)?`<img src="${esc(alinV73ProductImage(p))}">`:'<span>آلين</span>'}</div>
      <div class="alin-v73-product-info">
        <b>${esc(p.name||p.title||'منتج')}</b>
        <p>${esc(alinV73ProductDetails(p)||'بدون تفاصيل')}</p>
        <small>السعر: ${money(+p.price||0)} د.ع — المخزون: ${+p.stock||0}</small>
      </div>
      <div class="row-actions">
        <button class="secondary" onclick="alinV73EditProduct('${p.id}')">تعديل</button>
        <button class="danger" onclick="alinV73DeleteProduct('${p.id}')">حذف</button>
      </div>
    </div>`).join('')||emptyState('لا توجد منتجات')}
  </div>`;
};

/* Ensure modern store uses the actual product list and refreshes immediately */
if(typeof alinV72StoreItems==='function'){
  const alinV73OldStoreItems=alinV72StoreItems;
  alinV72StoreItems=function(){
    const items=alinV73OldStoreItems();
    return items.map(x=>{
      if(x._type==='product'){
        return {...x,title:x.name||x.title,details:alinV73ProductDetails(x),_category:x.category_id||x.category||'products'};
      }
      return x;
    });
  };
}
if(typeof alinV72Card==='function'){
  const alinV73OldCard=alinV72Card;
  alinV72Card=function(item){
    if(item._type!=='product') return alinV73OldCard(item);
    const img=alinV73ProductImage(item);
    const title=item.name||item.title||'منتج';
    const details=alinV73ProductDetails(item);
    return `<article class="alin-v72-card">
      <div class="alin-v72-cover">${img?`<img src="${esc(img)}" alt="${esc(title)}">`:`<div class="alin-v72-placeholder">آلين</div>`}</div>
      <div class="alin-v72-card-body">
        <h3>${esc(title)}</h3>
        ${details?`<p class="alin-v73-store-details">${esc(details)}</p>`:''}
        <small>المخزون: ${+item.stock||0}</small>
        <div class="alin-v72-buy"><strong>${money(+item.price||0)} د.ع</strong><button onclick="addToCart('${item.id}','product')">أضف للسلة</button></div>
      </div>
    </article>`;
  };
}

/* CSS */
const alinV73Style=document.createElement('style');
alinV73Style.textContent=`
.alin-v73-product-form{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:12px;align-items:stretch;margin:15px 0 24px}
.alin-v73-product-form textarea{min-height:90px;resize:vertical}
.alin-v73-product-form input,.alin-v73-product-form select,.alin-v73-product-form textarea{border:1px solid #dbe3ef;border-radius:14px;padding:14px;background:#fff}
.alin-v73-product-form button{border:0;border-radius:14px;background:#0b1830;color:#fff;font-weight:800}
.alin-v73-file-label{border:1px dashed #b9c6d8;border-radius:14px;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px}
.alin-v73-product-list{display:grid;gap:12px}
.alin-v73-product-row{display:grid;grid-template-columns:78px 1fr auto;gap:14px;align-items:center;background:#fff;border:1px solid #e1e7ef;border-radius:18px;padding:14px}
.alin-v73-product-thumb{width:78px;height:78px;border-radius:14px;background:#eef2f7;display:grid;place-items:center;overflow:hidden;font-weight:900}
.alin-v73-product-thumb img{width:100%;height:100%;object-fit:cover}
.alin-v73-product-info p{margin:5px 0;color:#617089}
.alin-v73-store-details{color:#66758a;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:38px}
@media(max-width:800px){.alin-v73-product-form{grid-template-columns:1fr}.alin-v73-product-row{grid-template-columns:62px 1fr}.alin-v73-product-row .row-actions{grid-column:1/-1}.alin-v73-product-thumb{width:62px;height:62px}}
`;
document.head.appendChild(alinV73Style);


/* ================= ALIN V74 SMART PRODUCT CARDS ================= */
function alinV74StockState(item){
  const n=Number(item.stock||0);
  if(n<=0)return {text:'نفد المخزون',cls:'out'};
  if(n<=5)return {text:'كمية محدودة',cls:'low'};
  return {text:'متوفر',cls:'available'};
}
function alinV74IsNew(item){
  const d=new Date(item.created_at||0);
  return d && !isNaN(d) && (Date.now()-d.getTime()) <= 14*24*60*60*1000;
}
function alinV74OrderCount(item){
  const id=String(item.id||'');
  let count=0;
  for(const o of (db.orders||[])){
    const rows=o.items||o.cart||o.order_items||[];
    if(Array.isArray(rows)) for(const r of rows){
      if(String(r.product_id||r.id||r.item_id||'')===id) count+=Number(r.qty||r.quantity||1);
    }
  }
  return count;
}
function alinV74Qty(id,delta){
  const el=document.getElementById('alinV74Qty_'+id);
  const item=(db.products||[]).find(x=>String(x.id)===String(id));
  if(!el||!item)return;
  const max=Math.max(1,Number(item.stock||0));
  el.value=Math.max(1,Math.min(max,Number(el.value||1)+delta));
}
function alinV74Add(id){
  const item=(db.products||[]).find(x=>String(x.id)===String(id));
  if(!item||Number(item.stock||0)<=0)return alert('المنتج غير متوفر حالياً');
  const qty=Math.max(1,Number(document.getElementById('alinV74Qty_'+id)?.value||1));
  for(let i=0;i<qty;i++) addToCart(id,'product');
  toast('تمت إضافة '+qty+' إلى السلة');
}
function alinV74OpenProduct(id){
  const p=(db.products||[]).find(x=>String(x.id)===String(id)); if(!p)return;
  const stock=alinV74StockState(p), img=alinV73ProductImage(p), details=alinV73ProductDetails(p);
  const modal=document.createElement('div');
  modal.className='alin-v74-modal';
  modal.innerHTML=`<div class="alin-v74-modal-card" onclick="event.stopPropagation()">
    <button class="alin-v74-close" onclick="this.closest('.alin-v74-modal').remove()">×</button>
    <div class="alin-v74-modal-img">${img?`<img src="${esc(img)}" alt="${esc(p.name||p.title||'منتج')}">`:'<div class="alin-v74-noimg">منصة آلين</div>'}</div>
    <div class="alin-v74-modal-info">
      <span class="alin-v74-stock ${stock.cls}">${stock.text}</span>
      <h2>${esc(p.name||p.title||'منتج')}</h2>
      <p>${esc(details||'لا توجد تفاصيل إضافية لهذا المنتج.')}</p>
      <strong class="alin-v74-price">${money(+p.price||0)} د.ع</strong>
      ${Number(p.stock||0)>0?`<div class="alin-v74-modal-actions">
        <div class="alin-v74-qty"><button onclick="alinV74Qty('${p.id}',-1)">−</button><input id="alinV74Qty_${p.id}" value="1" readonly><button onclick="alinV74Qty('${p.id}',1)">+</button></div>
        <button class="alin-v74-cart" onclick="alinV74Add('${p.id}')">أضف للسلة</button>
      </div>`:'<button class="alin-v74-cart disabled" disabled>غير متوفر حالياً</button>'}
    </div>
  </div>`;
  modal.onclick=()=>modal.remove();
  document.body.appendChild(modal);
}
window.alinV74Qty=alinV74Qty;
window.alinV74Add=alinV74Add;
window.alinV74OpenProduct=alinV74OpenProduct;

if(typeof alinV72Card==='function'){
  const alinV74PreviousCard=alinV72Card;
  alinV72Card=function(item){
    if(item._type!=='product') return alinV74PreviousCard(item);
    const img=alinV73ProductImage(item);
    const title=item.name||item.title||'منتج';
    const details=alinV73ProductDetails(item);
    const stock=alinV74StockState(item);
    const popular=alinV74OrderCount(item)>=5;
    return `<article class="alin-v74-product-card">
      <div class="alin-v74-image" onclick="alinV74OpenProduct('${item.id}')">
        ${img?`<img src="${esc(img)}" alt="${esc(title)}">`:`<div class="alin-v74-noimg">منصة آلين</div>`}
        <div class="alin-v74-badges">
          ${alinV74IsNew(item)?'<span class="alin-v74-badge new">جديد</span>':''}
          ${popular?'<span class="alin-v74-badge popular">الأكثر طلباً</span>':''}
        </div>
      </div>
      <div class="alin-v74-body">
        <span class="alin-v74-stock ${stock.cls}">${stock.text}</span>
        <h3 onclick="alinV74OpenProduct('${item.id}')">${esc(title)}</h3>
        <p>${esc(details||'')}</p>
        <strong class="alin-v74-price">${money(+item.price||0)} د.ع</strong>
        ${Number(item.stock||0)>0?`<div class="alin-v74-actions">
          <div class="alin-v74-qty"><button onclick="alinV74Qty('${item.id}',-1)">−</button><input id="alinV74Qty_${item.id}" value="1" readonly><button onclick="alinV74Qty('${item.id}',1)">+</button></div>
          <button class="alin-v74-cart" onclick="alinV74Add('${item.id}')">أضف للسلة</button>
        </div>`:`<button class="alin-v74-cart disabled" disabled>نفد المخزون</button>`}
      </div>
    </article>`;
  };
}

const alinV74Style=document.createElement('style');
alinV74Style.textContent=`
.alin-v74-product-card{background:#fff;border:1px solid #e4eaf2;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(13,31,58,.07);transition:.22s;direction:rtl}
.alin-v74-product-card:hover{transform:translateY(-4px);box-shadow:0 16px 38px rgba(13,31,58,.12)}
.alin-v74-image{height:220px;background:#f3f6fa;position:relative;cursor:pointer;overflow:hidden}
.alin-v74-image img{width:100%;height:100%;object-fit:cover;transition:.3s}.alin-v74-product-card:hover .alin-v74-image img{transform:scale(1.035)}
.alin-v74-noimg{width:100%;height:100%;display:grid;place-items:center;font-weight:900;font-size:24px;color:#0b1830;background:linear-gradient(145deg,#f7f9fc,#e9eef6)}
.alin-v74-badges{position:absolute;top:12px;right:12px;display:flex;gap:7px;flex-wrap:wrap}
.alin-v74-badge{padding:6px 10px;border-radius:999px;font-size:12px;font-weight:900;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.1)}
.alin-v74-badge.new{color:#0a7047}.alin-v74-badge.popular{color:#9a6500}
.alin-v74-body{padding:16px}.alin-v74-body h3{margin:8px 0 6px;font-size:18px;cursor:pointer;color:#0b1830}
.alin-v74-body p{margin:0 0 12px;color:#68768a;line-height:1.65;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:52px}
.alin-v74-stock{display:inline-block;font-size:12px;font-weight:900;padding:5px 9px;border-radius:999px}.alin-v74-stock.available{background:#e9f8f0;color:#087344}.alin-v74-stock.low{background:#fff4d8;color:#986600}.alin-v74-stock.out{background:#fdeaea;color:#b42318}
.alin-v74-price{display:block;font-size:21px;color:#a87500;margin:8px 0 14px}
.alin-v74-actions,.alin-v74-modal-actions{display:flex;gap:10px;align-items:center}.alin-v74-qty{display:grid;grid-template-columns:34px 38px 34px;border:1px solid #dce4ee;border-radius:12px;overflow:hidden;background:#fff}
.alin-v74-qty button,.alin-v74-qty input{height:38px;border:0;background:#fff;text-align:center;font-weight:900}.alin-v74-qty button{cursor:pointer;font-size:18px}.alin-v74-qty input{width:38px}
.alin-v74-cart{flex:1;min-height:40px;border:0;border-radius:12px;background:#0b1830;color:#fff;font-weight:900;cursor:pointer;padding:0 14px}.alin-v74-cart.disabled{background:#c8d0db;cursor:not-allowed}
.alin-v74-modal{position:fixed;inset:0;background:rgba(6,15,30,.62);z-index:99999;display:grid;place-items:center;padding:18px;backdrop-filter:blur(5px)}
.alin-v74-modal-card{width:min(850px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:26px;display:grid;grid-template-columns:1fr 1fr;position:relative;direction:rtl}
.alin-v74-modal-img{min-height:420px;background:#f2f5f9}.alin-v74-modal-img img{width:100%;height:100%;object-fit:contain}
.alin-v74-modal-info{padding:38px}.alin-v74-modal-info h2{font-size:28px;color:#0b1830}.alin-v74-modal-info p{line-height:1.9;color:#5f6e82;white-space:pre-wrap}
.alin-v74-close{position:absolute;top:12px;left:12px;width:38px;height:38px;border:0;border-radius:50%;background:#fff;box-shadow:0 5px 18px rgba(0,0,0,.15);font-size:25px;cursor:pointer;z-index:2}
@media(max-width:650px){.alin-v74-image{height:185px}.alin-v74-modal-card{grid-template-columns:1fr}.alin-v74-modal-img{min-height:280px;height:280px}.alin-v74-modal-info{padding:24px}.alin-v74-actions{flex-direction:column}.alin-v74-qty,.alin-v74-cart{width:100%}.alin-v74-qty{grid-template-columns:1fr 48px 1fr}}
`;
document.head.appendChild(alinV74Style);


/* ================= ALIN V75 PRODUCT SAVE HOTFIX ================= */
alinV73UploadProductFile = async function(file){
  if(!file || !file.name) return '';
  return await uploadFile('products', file, {type:'image'});
};

alinV73AddProduct = async function(){
  const category=(document.getElementById('alinV73ProductCategory')?.value||'عام').trim();
  const name=(document.getElementById('alinV73ProductName')?.value||'').trim();
  const details=(document.getElementById('alinV73ProductDetails')?.value||'').trim();
  const price=Number(document.getElementById('alinV73ProductPrice')?.value||0);
  const stock=Number(document.getElementById('alinV73ProductStock')?.value||0);
  const file=document.getElementById('alinV73ProductFile')?.files?.[0];
  try{
    if(!name) throw new Error('اكتب اسم المنتج');
    if(price<0 || stock<0) throw new Error('السعر أو المخزون غير صحيح');
    const image_path=file ? await uploadFile('products',file,{type:'image'}) : '';
    const row={
      id:uid('PR'),
      type:'stationery',
      name,
      category,
      price,
      stock,
      image_path,
      status:'published',
      details,
      description:details
    };
    await insert('products',row);
    await audit('product','إضافة منتج '+name);
    await load();
    alinV73ClearProductForm();
    renderProductsAdmin();
    if(typeof alinV72RenderStore==='function') alinV72RenderStore();
    toast('تمت إضافة المنتج وظهر في المتجر');
  }catch(e){
    console.error('ALIN V75 PRODUCT SAVE',e);
    alert(e?.message || 'تعذر حفظ المنتج');
  }
};
window.alinV73AddProduct=alinV73AddProduct;


/* ================= ALIN V76 REAL STORE CARD FIX ================= */
function alinV76StockState(x){
  if(x.kind==='booklet') return {text:'متوفر',cls:'available'};
  const n=Number(x.stock||0);
  if(n<=0) return {text:'نفد المخزون',cls:'out'};
  if(n<=5) return {text:'كمية محدودة',cls:'low'};
  return {text:'متوفر',cls:'available'};
}
function alinV76BookletDetails(id){
  const b=(db.booklets||[]).find(x=>x.id===id)||{};
  return b.description||b.details||[b.subject,b.grade].filter(Boolean).join(' • ');
}
function alinV76ProductDetailsById(id){
  const p=(db.products||[]).find(x=>x.id===id)||{};
  return p.details||p.description||p.category||'';
}
function alinV76IsNew(id,kind){
  const x=kind==='booklet'?(db.booklets||[]).find(v=>v.id===id):(db.products||[]).find(v=>v.id===id);
  const d=new Date(x?.created_at||0);
  return d && !isNaN(d) && (Date.now()-d.getTime())<=14*86400000;
}
function alinV76Card(x){
  const stock=alinV76StockState(x);
  const details=x.kind==='booklet'?alinV76BookletDetails(x.id):alinV76ProductDetailsById(x.id);
  const canBuy=x.kind==='booklet'||Number(x.stock||0)>0;
  return `<article class="alin-v76-card">
    <div class="alin-v76-cover" onclick="openCheckout('${x.kind}','${x.id}')">
      ${x.cover?`<img src="${mediaUrl(x.cover)}" alt="${esc(x.title)}">`:`<div class="alin-v76-noimg">${esc(x.subject||x.grade||'منصة آلين')}</div>`}
      <div class="alin-v76-badges">${alinV76IsNew(x.id,x.kind)?'<span class="alin-v76-badge new">جديد</span>':''}</div>
    </div>
    <div class="alin-v76-body">
      <span class="alin-v76-stock ${stock.cls}">${stock.text}</span>
      <h3>${esc(x.title)}</h3>
      ${x.teacher?`<p class="alin-v76-teacher">${esc(x.teacher)}</p>`:''}
      <p class="alin-v76-details">${esc(details||'')}</p>
      <div class="alin-v76-price">${money(x.price)} د.ع</div>
      <button class="alin-v76-buy ${canBuy?'':'disabled'}" ${canBuy?'':'disabled'} onclick="openCheckout('${x.kind}','${x.id}')">${canBuy?'اطلب الآن':'غير متوفر'}</button>
    </div>
  </article>`;
}
window.renderStore=renderStore=function(){
  if(!window.storeGrid || !db.booklets)return;
  try{
    bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title||'')}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join('');
  }catch(e){}
  const items=storeItems(), q=(searchInput?.value||'').toLowerCase();
  const cats=[...new Set(items.map(x=>x.grade||x.subject).filter(Boolean))], teachers=[...new Set(items.map(x=>x.teacher).filter(Boolean))];
  const oldCat=filterCategory?.value||'', oldTeacher=filterTeacher?.value||'';
  if(filterCategory) filterCategory.innerHTML='<option value="">كل الأقسام</option>'+cats.map(x=>`<option ${x===oldCat?'selected':''}>${esc(x)}</option>`).join('');
  if(filterTeacher){
    filterTeacher.style.display=db.settings.storeType==='booklet'?'':'none';
    filterTeacher.innerHTML='<option value="">كل المدرسين</option>'+teachers.map(x=>`<option ${x===oldTeacher?'selected':''}>${esc(x)}</option>`).join('');
  }
  const list=items.filter(x=>(!filterCategory?.value||x.grade===filterCategory.value||x.subject===filterCategory.value)&&(!filterTeacher?.value||x.teacher===filterTeacher.value)&&(`${x.title} ${x.teacher} ${x.subject} ${x.grade}`).toLowerCase().includes(q));
  storeGrid.classList.add('alin-v76-grid');
  storeGrid.innerHTML=list.map(alinV76Card).join('')||'<div class="alin-v76-empty">لا توجد مواد في هذا القسم</div>';
};
const alinV76Style=document.createElement('style');
alinV76Style.textContent=`
.alin-v76-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px!important}
.alin-v76-card{background:#fff;border:1px solid #e4eaf2;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(12,30,56,.07);transition:.22s;direction:rtl}
.alin-v76-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(12,30,56,.12)}
.alin-v76-cover{height:230px;background:#f2f5f9;position:relative;overflow:hidden;cursor:pointer}
.alin-v76-cover img{width:100%;height:100%;object-fit:cover;transition:.3s}
.alin-v76-card:hover .alin-v76-cover img{transform:scale(1.035)}
.alin-v76-noimg{height:100%;display:grid;place-items:center;background:linear-gradient(145deg,#eef3f8,#dde6f0);color:#0b1830;font-weight:900;font-size:24px;text-align:center;padding:20px}
.alin-v76-badges{position:absolute;top:12px;right:12px}.alin-v76-badge{background:#fff;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:900;box-shadow:0 4px 14px rgba(0,0,0,.1)}.alin-v76-badge.new{color:#087344}
.alin-v76-body{padding:16px}.alin-v76-body h3{margin:8px 0 6px;color:#0b1830;font-size:18px}.alin-v76-teacher{margin:0 0 5px;color:#52627a;font-weight:700}
.alin-v76-details{color:#6a778a;line-height:1.65;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:48px;margin:4px 0 12px}
.alin-v76-stock{display:inline-block;font-size:12px;font-weight:900;padding:5px 9px;border-radius:999px}.alin-v76-stock.available{background:#e9f8f0;color:#087344}.alin-v76-stock.low{background:#fff4d8;color:#986600}.alin-v76-stock.out{background:#fdeaea;color:#b42318}
.alin-v76-price{font-size:21px;font-weight:900;color:#a87500;margin:10px 0 14px}.alin-v76-buy{width:100%;border:0;border-radius:12px;background:#0b1830;color:#fff;padding:12px;font-weight:900;cursor:pointer}.alin-v76-buy.disabled{background:#c6ced9;cursor:not-allowed}
.alin-v76-empty{grid-column:1/-1;text-align:center;background:#fff;border-radius:18px;padding:40px;color:#6c7888}
@media(max-width:1000px){.alin-v76-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.alin-v76-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.alin-v76-cover{height:190px}}
@media(max-width:480px){.alin-v76-grid{gap:10px!important}.alin-v76-card{border-radius:16px}.alin-v76-cover{height:165px}.alin-v76-body{padding:12px}.alin-v76-body h3{font-size:15px}.alin-v76-price{font-size:18px}}
`;
document.head.appendChild(alinV76Style);
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{try{renderStore()}catch(e){}},900));


/* ================= ALIN V77 CART-FIRST STORE FLOW ================= */
function alinV77Item(kind,id){
  return kind==='booklet'
    ? (db.booklets||[]).find(x=>String(x.id)===String(id))
    : (db.products||[]).find(x=>String(x.id)===String(id));
}
function alinV77Details(kind,item){
  if(!item)return '';
  return kind==='booklet'
    ? (item.description||item.details||[item.subject,item.grade].filter(Boolean).join(' • '))
    : (item.details||item.description||item.category||'');
}
function alinV77Stock(kind,item){
  if(kind==='booklet') return {text:'متوفر',cls:'available',ok:true};
  const n=Number(item?.stock||0);
  if(n<=0)return {text:'نفد المخزون',cls:'out',ok:false};
  if(n<=5)return {text:'كمية محدودة',cls:'low',ok:true};
  return {text:'متوفر',cls:'available',ok:true};
}
function alinV77AddToCart(kind,id,qty=1){
  const item=alinV77Item(kind,id);
  if(!item)return alert('تعذر العثور على المادة');
  if(kind!=='booklet' && Number(item.stock||0)<=0)return alert('المنتج نافد');
  const count=Math.max(1,Number(qty||1));
  for(let i=0;i<count;i++) addToCart(kind,id);
  const modal=document.querySelector('.alin-v77-modal');
  if(modal) modal.remove();
}
function alinV77OpenDetails(kind,id){
  const item=alinV77Item(kind,id); if(!item)return;
  const title=item.title||item.name||'مادة';
  const details=alinV77Details(kind,item);
  const stock=alinV77Stock(kind,item);
  const cover=item.cover_path||item.image_path||item.cover||item.image||'';
  const teacher=kind==='booklet'?(typeof teacherName==='function'?teacherName(item.teacher_id):''):'';
  const modal=document.createElement('div');
  modal.className='alin-v77-modal';
  modal.innerHTML=`<div class="alin-v77-modal-card" onclick="event.stopPropagation()">
    <button class="alin-v77-close" onclick="this.closest('.alin-v77-modal').remove()">×</button>
    <div class="alin-v77-modal-image">${cover?`<img src="${mediaUrl(cover)}" alt="${esc(title)}">`:`<div class="alin-v77-noimg">منصة آلين</div>`}</div>
    <div class="alin-v77-modal-content">
      <span class="alin-v76-stock ${stock.cls}">${stock.text}</span>
      <h2>${esc(title)}</h2>
      ${teacher?`<p class="alin-v77-teacher">المدرس: ${esc(teacher)}</p>`:''}
      <p class="alin-v77-full-details">${esc(details||'لا توجد تفاصيل إضافية.')}</p>
      <div class="alin-v77-price">${money(+item.price||0)} د.ع</div>
      ${stock.ok?`<div class="alin-v77-modal-actions">
        <div class="alin-v77-qty"><button onclick="alinV77ChangeQty('${kind}','${id}',-1)">−</button><input id="alinV77Qty_${kind}_${id}" value="1" readonly><button onclick="alinV77ChangeQty('${kind}','${id}',1)">+</button></div>
        <button class="alin-v77-add" onclick="alinV77AddToCart('${kind}','${id}',document.getElementById('alinV77Qty_${kind}_${id}').value)">أضف للسلة</button>
      </div>`:`<button class="alin-v77-add disabled" disabled>غير متوفر حالياً</button>`}
    </div>
  </div>`;
  modal.onclick=()=>modal.remove();
  document.body.appendChild(modal);
}
function alinV77ChangeQty(kind,id,delta){
  const el=document.getElementById(`alinV77Qty_${kind}_${id}`); if(!el)return;
  const item=alinV77Item(kind,id);
  const max=kind==='booklet'?99:Math.max(1,Number(item?.stock||1));
  el.value=Math.max(1,Math.min(max,Number(el.value||1)+delta));
}
window.alinV77OpenDetails=alinV77OpenDetails;
window.alinV77AddToCart=alinV77AddToCart;
window.alinV77ChangeQty=alinV77ChangeQty;

window.renderStore=renderStore=function(){
  if(!window.storeGrid || !db.booklets)return;
  try{
    bannerBox.innerHTML=(db.banners||[]).filter(x=>x.active).map(x=>`<div class="banner-card"><div><h2>${esc(x.title||'')}</h2><p>${esc(x.text||'')}</p></div><b>آ</b></div>`).join('');
  }catch(e){}
  const items=storeItems(), q=(searchInput?.value||'').toLowerCase();
  const cats=[...new Set(items.map(x=>x.grade||x.subject).filter(Boolean))], teachers=[...new Set(items.map(x=>x.teacher).filter(Boolean))];
  const oldCat=filterCategory?.value||'', oldTeacher=filterTeacher?.value||'';
  if(filterCategory) filterCategory.innerHTML='<option value="">كل الأقسام</option>'+cats.map(x=>`<option ${x===oldCat?'selected':''}>${esc(x)}</option>`).join('');
  if(filterTeacher){
    filterTeacher.style.display=db.settings.storeType==='booklet'?'':'none';
    filterTeacher.innerHTML='<option value="">كل المدرسين</option>'+teachers.map(x=>`<option ${x===oldTeacher?'selected':''}>${esc(x)}</option>`).join('');
  }
  const list=items.filter(x=>(!filterCategory?.value||x.grade===filterCategory.value||x.subject===filterCategory.value)&&(!filterTeacher?.value||x.teacher===filterTeacher.value)&&(`${x.title} ${x.teacher} ${x.subject} ${x.grade}`).toLowerCase().includes(q));
  storeGrid.classList.add('alin-v76-grid');
  storeGrid.innerHTML=list.map(x=>{
    const item=alinV77Item(x.kind,x.id)||{};
    const details=alinV77Details(x.kind,item);
    const stock=alinV77Stock(x.kind,item);
    return `<article class="alin-v76-card">
      <div class="alin-v76-cover" onclick="alinV77OpenDetails('${x.kind}','${x.id}')">
        ${x.cover?`<img src="${mediaUrl(x.cover)}" alt="${esc(x.title)}">`:`<div class="alin-v76-noimg">${esc(x.subject||x.grade||'منصة آلين')}</div>`}
      </div>
      <div class="alin-v76-body">
        <span class="alin-v76-stock ${stock.cls}">${stock.text}</span>
        <h3 onclick="alinV77OpenDetails('${x.kind}','${x.id}')">${esc(x.title)}</h3>
        ${x.teacher?`<p class="alin-v76-teacher">${esc(x.teacher)}</p>`:''}
        <p class="alin-v76-details">${esc(details||'')}</p>
        <div class="alin-v76-price">${money(x.price)} د.ع</div>
        <div class="alin-v77-card-actions">
          <button class="alin-v77-details-btn" onclick="alinV77OpenDetails('${x.kind}','${x.id}')">عرض التفاصيل</button>
          <button class="alin-v77-cart-btn ${stock.ok?'':'disabled'}" ${stock.ok?'':'disabled'} onclick="alinV77AddToCart('${x.kind}','${x.id}',1)">أضف للسلة</button>
        </div>
      </div>
    </article>`;
  }).join('')||'<div class="alin-v76-empty">لا توجد مواد في هذا القسم</div>';
};

const alinV77Style=document.createElement('style');
alinV77Style.textContent=`
.alin-v77-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.alin-v77-details-btn,.alin-v77-cart-btn{border:0;border-radius:12px;padding:11px;font-weight:900;cursor:pointer}
.alin-v77-details-btn{background:#eef2f7;color:#0b1830}.alin-v77-cart-btn{background:#0b1830;color:#fff}.alin-v77-cart-btn.disabled{background:#c8d0db;cursor:not-allowed}
.alin-v77-modal{position:fixed;inset:0;background:rgba(6,15,30,.65);z-index:99999;display:grid;place-items:center;padding:18px;backdrop-filter:blur(5px)}
.alin-v77-modal-card{width:min(860px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:26px;display:grid;grid-template-columns:1fr 1fr;position:relative;direction:rtl}
.alin-v77-modal-image{min-height:420px;background:#f2f5f9}.alin-v77-modal-image img{width:100%;height:100%;object-fit:contain}
.alin-v77-modal-content{padding:36px}.alin-v77-modal-content h2{font-size:28px;color:#0b1830;margin:14px 0 8px}
.alin-v77-teacher{font-weight:800;color:#52627a}.alin-v77-full-details{line-height:1.9;color:#5f6e82;white-space:pre-wrap}
.alin-v77-price{font-size:25px;font-weight:900;color:#a87500;margin:18px 0}
.alin-v77-modal-actions{display:flex;gap:12px;align-items:center}.alin-v77-qty{display:grid;grid-template-columns:38px 42px 38px;border:1px solid #dce4ee;border-radius:12px;overflow:hidden}
.alin-v77-qty button,.alin-v77-qty input{height:42px;border:0;background:#fff;text-align:center;font-weight:900}.alin-v77-add{flex:1;border:0;border-radius:12px;background:#0b1830;color:#fff;padding:13px;font-weight:900}.alin-v77-add.disabled{background:#c8d0db}
.alin-v77-close{position:absolute;top:12px;left:12px;width:38px;height:38px;border:0;border-radius:50%;background:#fff;box-shadow:0 5px 18px rgba(0,0,0,.15);font-size:25px;cursor:pointer;z-index:2}
@media(max-width:650px){.alin-v77-modal-card{grid-template-columns:1fr}.alin-v77-modal-image{min-height:260px;height:260px}.alin-v77-modal-content{padding:22px}.alin-v77-card-actions{grid-template-columns:1fr}.alin-v77-modal-actions{flex-direction:column}.alin-v77-qty,.alin-v77-add{width:100%}}
`;
document.head.appendChild(alinV77Style);


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
      <span class="alin-v78-dot"></span>
      <div><b>${esc(n.title||'إشعار')}</b><p>${esc(n.message||'')}</p><small>${new Date(n.created_at||Date.now()).toLocaleString('ar-IQ')}</small></div>
    </button>`).join('')||'<div class="alin-v78-empty">لا توجد إشعارات حالياً</div>'}
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
const alinV78StoreBase=window.renderStore;
window.renderStore=renderStore=function(){
  try{ alinV78StoreBase(); }catch(e){}
  const host=document.querySelector('.alin-v72-top')||document.getElementById('storePage')||document.querySelector('.store-toolbar')||document.body;
  if(host && !host.querySelector('.alin-v78-store-notify')){
    const wrap=document.createElement('div');
    wrap.className='alin-v78-store-notify';
    wrap.innerHTML=alinV78ButtonHtml();
    if(host.classList.contains('alin-v72-top')) host.appendChild(wrap);
    else host.prepend(wrap);
  }
  alinV78RenderBadge();
};

/* Teacher notification button */
const alinV78TeacherBase=window.renderTeacher;
window.renderTeacher=renderTeacher=function(){
  try{ alinV78TeacherBase(); }catch(e){}
  const host=document.querySelector('#teacherPage h2, #teacherContent h2, .teacher-page h2')?.parentElement
    || document.getElementById('teacherContent')
    || document.getElementById('teacherPage');
  if(host && !host.querySelector('.alin-v78-teacher-notify')){
    const wrap=document.createElement('div');
    wrap.className='alin-v78-role-notify alin-v78-teacher-notify';
    wrap.innerHTML=alinV78ButtonHtml();
    host.prepend(wrap);
  }
  alinV78RenderBadge();
};

/* Library notification button */
const alinV78LibraryBase=window.renderLibrary;
window.renderLibrary=renderLibrary=function(){
  try{ alinV78LibraryBase(); }catch(e){}
  const host=document.getElementById('libraryPage')||document.getElementById('libraryHistory')?.parentElement||document.querySelector('.library-page');
  if(host && !host.querySelector('.alin-v78-library-notify')){
    const wrap=document.createElement('div');
    wrap.className='alin-v78-role-notify alin-v78-library-notify';
    wrap.innerHTML=alinV78ButtonHtml();
    host.prepend(wrap);
  }
  alinV78RenderBadge();
};

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
setInterval(alinV78EnsureButtons,2000);
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


/* ================= ALIN V79 SUPABASE PRODUCTS FIX ================= */
function alinV79ProductCategoryValue(p){
  return p.category_id || p.category || p.type || 'stationery';
}
function alinV79PublishedProduct(p){
  const st=String(p.status||'published').toLowerCase();
  return !p.deleted_at && !['hidden','archived','deleted','inactive'].includes(st);
}
function alinV79StoreTypeMatch(p){
  const selected=String(db.settings?.storeType||'stationery');
  const cat=String(alinV79ProductCategoryValue(p));
  if(selected==='product'||selected==='products') return true;
  if(selected==='stationery') return ['stationery','قرطاسية','products'].includes(cat);
  if(selected==='gifts') return ['gifts','هدايا'].includes(cat);
  return cat===selected || String(p.type||'')===selected;
}

/* Override store source so products saved in Supabase always appear */
window.storeItems = storeItems = function(){
  if(db.settings.storeType==='booklet'){
    return (db.booklets||[]).filter(x=>x.status==='published').map(x=>({
      kind:'booklet',id:x.id,title:x.title,subject:x.subject,grade:x.grade,
      teacher:teacherName(x.teacher_id),price:x.price,cover:x.cover_path,stock:null
    }));
  }
  return (db.products||[]).filter(p=>alinV79PublishedProduct(p)&&alinV79StoreTypeMatch(p)).map(p=>({
    kind:'product',
    id:p.id,
    title:p.name||p.title||'منتج',
    subject:p.category_name||p.category||'قرطاسية',
    grade:p.category_name||p.category||'قرطاسية',
    teacher:'',
    price:+p.price||0,
    cover:p.image_path||p.image_url||p.file_path||'',
    stock:+p.stock||0
  }));
};

/* Reliable product save/edit/delete against one Supabase schema */
async function alinV79UploadProductImage(file){
  if(!file)return '';
  try{
    if(typeof uploadFile==='function'){
      const result=await uploadFile('products',file,{type:'image'});
      return result?.path||result?.url||result||'';
    }
  }catch(e){console.warn('upload products bucket',e);}
  return '';
}
window.alinV73AddProduct = async function(){
  const category=(document.getElementById('alinV73ProductCategory')?.value||'stationery').trim();
  const name=(document.getElementById('alinV73ProductName')?.value||'').trim();
  const details=(document.getElementById('alinV73ProductDetails')?.value||'').trim();
  const price=Number(document.getElementById('alinV73ProductPrice')?.value||0);
  const stock=Number(document.getElementById('alinV73ProductStock')?.value||0);
  const file=document.getElementById('alinV73ProductFile')?.files?.[0];
  try{
    if(!name) throw new Error('اكتب اسم المنتج');
    if(price<0||stock<0) throw new Error('السعر أو المخزون غير صحيح');
    const image_path=file?await alinV79UploadProductImage(file):'';
    const row={
      id:uid('PR'),
      name,
      details,
      description:details,
      price,
      stock,
      category,
      category_id:category,
      type:category,
      image_path,
      status:'published',
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    await insert('products',row);
    db.products=db.products||[];
    db.products.unshift(row);
    await audit('product','إضافة المنتج '+name);
    alinV73ClearProductForm();
    renderProductsAdmin();
    renderStore();
    toast('تمت إضافة المنتج وظهر في المتجر');
  }catch(e){
    console.error('V79 add product',e);
    alert(e?.message||'تعذر حفظ المنتج');
  }
};
window.alinV73EditProduct = async function(id){
  const p=(db.products||[]).find(x=>String(x.id)===String(id)); if(!p)return;
  const name=prompt('اسم المنتج',p.name||p.title||''); if(name===null)return;
  const details=prompt('تفاصيل المنتج',p.details||p.description||''); if(details===null)return;
  const price=Number(prompt('السعر',p.price||0)); if(Number.isNaN(price))return alert('السعر غير صحيح');
  const stock=Number(prompt('المخزون',p.stock||0)); if(Number.isNaN(stock))return alert('المخزون غير صحيح');
  const payload={name,details,description:details,price,stock,updated_at:new Date().toISOString()};
  try{
    await update('products',payload,{id:p.id});
    Object.assign(p,payload);
    await audit('product','تعديل المنتج '+name);
    renderProductsAdmin(); renderStore();
    toast('تم تعديل المنتج');
  }catch(e){console.error(e);alert(e?.message||'تعذر تعديل المنتج');}
};
window.alinV73DeleteProduct = async function(id){
  const p=(db.products||[]).find(x=>String(x.id)===String(id)); if(!p)return;
  if(!confirm('حذف المنتج '+(p.name||p.title||'')+'؟'))return;
  try{
    await remove('products',{id:p.id});
    db.products=db.products.filter(x=>String(x.id)!==String(id));
    await audit('product','حذف المنتج '+(p.name||p.title||''));
    renderProductsAdmin(); renderStore();
    toast('تم حذف المنتج');
  }catch(e){console.error(e);alert(e?.message||'تعذر حذف المنتج');}
};

/* Force fresh products load from Supabase */
const alinV79LoadBase=window.load||load;
window.load=load=async function(){
  await alinV79LoadBase();
  try{
    db.products=await query('products');
  }catch(e){
    console.warn('تعذر تحميل المنتجات',e);
    db.products=db.products||[];
  }
  try{renderStore();}catch(e){}
};
