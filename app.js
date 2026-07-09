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
async function uploadFile(bucketPath, file, opts={}){
  const {required=false, type='any'} = opts;
  const isRealFile = file && typeof file === 'object' && file.name && file.size > 0;
  if(!isRealFile){
    if(required) throw new Error('الملف مطلوب ولم يتم اختياره بشكل صحيح');
    return null;
  }
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  if(type==='pdf' && ext !== 'pdf') throw new Error('اختر ملف PDF حقيقي فقط');
  if(type==='image' && !['jpg','jpeg','png','webp','gif'].includes(ext)) throw new Error('اختر صورة بصيغة JPG أو PNG أو WEBP');
  if(file.size < 10) throw new Error('الملف فارغ أو تالف، اختر الملف من جديد');
  const safeExt = ext || (type==='pdf'?'pdf':type==='image'?'png':'bin');
  const path=bucketPath+'/'+uid('F')+'.'+safeExt;
  const contentType = type==='pdf' ? 'application/pdf' : (file.type || undefined);
  const {error}=await sb.storage.from('alin-files').upload(path,file,{upsert:false, contentType});
  if(error){
    if(String(error.message||'').toLowerCase().includes('bucket')) throw new Error('مجلد التخزين alin-files غير موجود أو غير عام');
    throw error;
  }
  return path;
}
function mediaUrl(path){
  if(!path) return '';
  const {data}=sb.storage.from('alin-files').getPublicUrl(path);
  return data.publicUrl;
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
async function uploadBooklet(){ try{ const f=new FormData(bookForm); const cover=await uploadFile('covers',f.get('cover'),{type:'image'}); const ti=await uploadFile('teachers',f.get('teacherImage'),{type:'image'}); const pdfFile=f.get('bookletFile'); if(!pdfFile||!pdfFile.name)throw new Error('ملف PDF مطلوب'); const fp=await uploadFile('booklets',pdfFile,{required:true,type:'pdf'}); await insert('booklets',{id:uid('B'),title:f.get('title'),teacher_id:f.get('teacherId'),subject:f.get('subject'),grade:f.get('grade'),price:+f.get('price'),cover_path:cover,teacher_image_path:ti,file_path:fp,file_name:pdfFile.name,status:'published'}); await audit('booklet','نشر ملزمة '+f.get('title')); await load(); renderBookletsAdmin(); }catch(e){ alert(e.message); } }
async function setBookStatus(id,status){ await update('booklets',{status},{id}); await audit('booklet','تغيير حالة ملزمة '+id); await load(); renderBookletsAdmin(); }
async function deleteBooklet(id){
  try{
    const b=db.booklets.find(x=>x.id===id);
    const linkedOrders=db.orders.filter(o=>o.kind==='booklet'&&o.item_id===id).length;
    const msg=linkedOrders?`هذه الملزمة مرتبطة بـ ${linkedOrders} طلب. الأفضل أرشفتها بدل الحذف. هل تريد حذفها نهائياً؟`:'هل تريد حذف هذه الملزمة نهائياً؟';
    if(!confirm(msg))return;
    await removeRow('booklets',{id});
    await audit('booklet','حذف ملزمة '+(b?.title||id));
    await load();
    renderBookletsAdmin();
    toast('تم حذف الملزمة');
  }catch(e){
    alert('تعذر حذف الملزمة. إذا كانت مرتبطة بطلبات قديمة استخدم الأرشفة بدل الحذف.');
  }
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
function openTeacherPdf(bookletId){
  const b=db.booklets.find(x=>x.id===bookletId); if(!b?.file_path)return alert('لا يوجد ملف PDF');
  const url=mediaUrl(b.file_path)+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>مشاهدة الملزمة</h2><div class="print-only-note">المشاهدة مخصصة للمدرس صاحب الملزمة فقط. تم إخفاء أزرار التنزيل والطباعة.</div><div class="pdf-guard"><div class="watermark">${esc(current?.name||'منصة آلين')} — مشاهدة فقط</div><iframe src="${url}" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
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

function openLibraryBookletPdf(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId);
  if(!o || o.kind!=='booklet') return alert('هذا الطلب لا يحتوي ملزمة PDF');
  const b=(db.booklets||[]).find(x=>x.id===o.item_id);
  if(!b?.file_path) return alert('لا يوجد ملف PDF لهذه الملزمة');
  const url=mediaUrl(b.file_path)+'#toolbar=0&navpanes=0&scrollbar=1';
  checkoutBox.innerHTML=`<h2>PDF الملزمة للمكتبة</h2><div class="print-only-note">هذا الملف يظهر للمكتبة فقط لغرض الطباعة. لا يظهر في المتجر للطالب.</div><div class="pdf-viewer"><iframe id="pdfFrame" src="${url}" oncontextmenu="return false"></iframe></div><div class="row-actions no-print"><button onclick="printPdfFrame()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
  checkoutModal.classList.remove('hidden');
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
