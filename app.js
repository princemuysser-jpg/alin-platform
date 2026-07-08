let SYSTEM_URL = localStorage.getItem('ALIN_SYSTEM_URL') || '';
let SUPABASE_ANON_KEY = localStorage.getItem('ALIN_SUPABASE_ANON_KEY') || '';
let sb = null;

let db = {accounts:{teachers:[],libraries:[]},booklets:[],products:[],categories:[],banners:[],orders:[],permits:[],ledger:[],withdrawals:[],audit:[],settings:{storeType:'booklet'}};
let current = null, pendingRole = '', checkoutItem = null;
const money = n => (+n || 0).toLocaleString('ar-IQ');
const teacherName = id => db.accounts.teachers.find(x => x.id === id)?.name || '';
const uid = p => p + Math.random().toString(16).slice(2,10) + Date.now().toString(16).slice(-6);

function init(){
  if(!SYSTEM_URL || !SUPABASE_ANON_KEY || !window.supabase){ return false; }
  sb = window.supabase.createClient(SYSTEM_URL, SUPABASE_ANON_KEY);
  return true;
}
function openSystemSettings(){ renderSettingsAdmin(); }
async function saveSystemSettings(){ SYSTEM_URL=systemUrl.value.trim(); SUPABASE_ANON_KEY=systemKey.value.trim(); localStorage.setItem('ALIN_SYSTEM_URL',SYSTEM_URL); localStorage.setItem('ALIN_SUPABASE_ANON_KEY',SUPABASE_ANON_KEY); if(!init()){ systemMsg.textContent='أكمل بيانات النظام'; return; } systemMsg.textContent='تم حفظ إعدادات النظام'; await load(); renderSettingsAdmin(); }
async function query(table){ const {data,error}=await sb.from(table).select('*'); if(error)throw error; return data||[]; }
async function insert(table,row){ const {data,error}=await sb.from(table).insert(row).select().single(); if(error)throw error; return data; }
async function update(table,values,match){ let q=sb.from(table).update(values); Object.entries(match).forEach(([k,v])=>q=q.eq(k,v)); const {error}=await q; if(error)throw error; }
async function removeRow(table,match){ let q=sb.from(table).delete(); Object.entries(match).forEach(([k,v])=>q=q.eq(k,v)); const {error}=await q; if(error)throw error; }

async function audit(kind,text){ try{ await insert('audit',{id:uid('A'),kind,text}); }catch(e){} }
async function uploadFile(bucketPath, file){
  if(!file) return null;
  const ext=(file.name.split('.').pop()||'bin').toLowerCase();
  const path=bucketPath+'/'+uid('F')+'.'+ext;
  const {error}=await sb.storage.from('alin-files').upload(path,file,{upsert:false});
  if(error) throw error;
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
  }catch(e){ console.error(e); if(current?.role==='admin') alert('تعذر تحميل بيانات النظام: '+e.message); }
}
async function seedData(){
  await insert('accounts',{id:'T1',role:'teacher',name:'ميسر صلاح الدين',username:'0770',password_hash:'1234',area:'كركوك',landmark:'',status:'active'});
  await insert('accounts',{id:'L1',role:'library',name:'مكتبة آلين',username:'LIB1',password_hash:'1234',area:'كركوك',landmark:'قرب المركز',status:'active'});
  await insert('booklets',{id:'B1',title:'ملزمة الفيزياء',teacher_id:'T1',subject:'الفيزياء',grade:'السادس الإعدادي',price:10000,status:'published'});
  await insert('banners',{id:'AD1',title:'أهلاً بكم في منصة آلين',text:'تصاميم وملازم وقرطاسية في مكان واحد',active:1});
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
function openPage(page){ login.classList.add('hidden'); app.classList.remove('hidden'); document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); const el=document.getElementById(page+'Page'); if(el)el.classList.remove('hidden'); activeNav.innerHTML=`<button>${{store:'المتجر',teacher:'المدرس',library:'المكتبة',admin:'الإدارة'}[page]||page}</button>`; renderAll(); }
function logout(){ current=null; app.classList.add('hidden'); login.classList.remove('hidden'); loginForm.classList.add('hidden'); }
async function setStoreType(type,btn){ db.settings.storeType=type; document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); if(btn)btn.classList.add('active'); renderStore(); }

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

function renderBookletsAdmin(){ adminContent.innerHTML=`<h2>الملازم</h2><form id="bookForm" class="form-grid"><input name="title" placeholder="اسم الملزمة"><select name="teacherId">${db.accounts.teachers.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select><input name="subject" placeholder="المادة"><input name="grade" placeholder="الصف"><input name="price" type="number" placeholder="السعر"><label>غلاف<input name="cover" type="file" accept="image/*"></label><label>صورة المدرس<input name="teacherImage" type="file" accept="image/*"></label><label>ملف PDF الحقيقي<input name="bookletFile" type="file" accept=".pdf" required></label><button type="button" onclick="uploadBooklet()">رفع ونشر</button></form>${db.booklets.map(x=>`<div class="row"><div><b>${x.title}</b><small>${teacherName(x.teacher_id)} — ${x.file_name||''} — ${x.status}</small></div><div class="row-actions"><button onclick="setBookStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button><button class="danger" onclick="setBookStatus('${x.id}','archived')">أرشفة</button></div></div>`).join('')}`; }
async function uploadBooklet(){ try{ const f=new FormData(bookForm); const cover=await uploadFile('covers',f.get('cover')); const ti=await uploadFile('teachers',f.get('teacherImage')); const pdfFile=f.get('bookletFile'); if(!pdfFile||!pdfFile.name)throw new Error('ملف PDF مطلوب'); const fp=await uploadFile('booklets',pdfFile); await insert('booklets',{id:uid('B'),title:f.get('title'),teacher_id:f.get('teacherId'),subject:f.get('subject'),grade:f.get('grade'),price:+f.get('price'),cover_path:cover,teacher_image_path:ti,file_path:fp,file_name:pdfFile.name,status:'published'}); await audit('booklet','نشر ملزمة '+f.get('title')); await load(); renderBookletsAdmin(); }catch(e){ alert(e.message); } }
async function setBookStatus(id,status){ await update('booklets',{status},{id}); await audit('booklet','تغيير حالة ملزمة '+id); await load(); renderBookletsAdmin(); }

function renderProductsAdmin(){ adminContent.innerHTML=`<h2>المنتجات</h2><form id="productForm" class="form-grid"><select name="type"><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input name="name" placeholder="اسم المنتج"><input name="category" placeholder="القسم"><input name="price" type="number" placeholder="السعر"><input name="stock" type="number" placeholder="المخزون"><label>صورة المنتج<input name="image" type="file" accept="image/*"></label><button type="button" onclick="addProduct()">إضافة المنتج</button></form>${db.products.map(x=>`<div class="row"><div><b>${x.name}</b><small>${x.category} — ${money(x.price)} د.ع — ${x.status}</small></div><button onclick="setProductStatus('${x.id}','${x.status==='published'?'hidden':'published'}')">${x.status==='published'?'إخفاء':'إظهار'}</button></div>`).join('')}`; }
async function addProduct(){ try{ const f=new FormData(productForm); const img=await uploadFile('products',f.get('image')); await insert('products',{id:uid('PR'),type:f.get('type'),name:f.get('name'),category:f.get('category'),price:+f.get('price'),stock:+f.get('stock')||0,image_path:img,status:'published'}); await audit('product','إضافة منتج '+f.get('name')); await load(); renderProductsAdmin(); }catch(e){ alert(e.message); } }
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

function renderSettingsAdmin(){ adminContent.innerHTML=`<h2>إعدادات النظام</h2><p>إعدادات خاصة بالإدارة.</p><div class="form-grid"><input id="systemUrl" value="${SYSTEM_URL}" placeholder="SYSTEM_URL"><input id="systemKey" type="password" value="${SUPABASE_ANON_KEY}" placeholder="مفتاح الربط"><button onclick="saveSystemSettings()">حفظ الإعدادات</button></div><div id="systemMsg"></div>`; }
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
addProduct = async function(){ try{ const f=new FormData(productForm); if(!String(f.get('name')||'').trim())throw new Error('اكتب اسم المنتج'); if(+f.get('price')<0||+f.get('stock')<0)throw new Error('السعر أو المخزون غير صحيح'); const img=await uploadFile('products',f.get('image')); await insert('products',{id:uid('PR'),type:f.get('type'),name:String(f.get('name')).trim(),category:f.get('category'),price:+f.get('price')||0,stock:+f.get('stock')||0,image_path:img,status:'published'}); await audit('product','إضافة منتج '+f.get('name')); await load(); renderProductsAdmin(); toast('تمت إضافة المنتج'); }catch(e){alert(e.message)} }
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
