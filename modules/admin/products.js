// === admin/products.js ===
/* ===== admin/js/admin-products-v129.js ===== */
(function(){
  const state={q:'',type:'',status:'',stock:'',price:'',sort:'newest'};
  const $=s=>document.querySelector(s);
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const products=()=>Array.isArray(window.db?.products)?window.db.products:(typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]);
  const categories=()=>Array.isArray(window.db?.categories)?window.db.categories:(typeof db!=='undefined'&&Array.isArray(db.categories)?db.categories:[]);
  const statusLabel=s=>({published:'منشور',hidden:'مخفي',draft:'مسودة',inactive:'غير فعال',archived:'مؤرشف'}[String(s||'published').toLowerCase()]||'منشور');
  const typeLabel=t=>String(t)==='gift'?'هدايا':'قرطاسية';
  const imageUrl=p=>{const x=p?.image_path||p?.image_url||p?.image||'';try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x}catch(_){return x}};
  const lowLimit=p=>Number(p?.low_stock_limit||window.db?.settings?.low_stock_default||5);
  function filterList(){
    let list=[...products()];
    const q=state.q.trim().toLowerCase();
    if(q)list=list.filter(p=>[p.name,p.title,p.category,p.description].some(v=>String(v||'').toLowerCase().includes(q)));
    if(state.type)list=list.filter(p=>String(p.type||'stationery')===state.type);
    if(state.status)list=list.filter(p=>String(p.status||'published')===state.status);
    if(state.stock==='out')list=list.filter(p=>Number(p.stock)<=0);
    if(state.stock==='low')list=list.filter(p=>Number(p.stock)>0&&Number(p.stock)<=lowLimit(p));
    if(state.stock==='available')list=list.filter(p=>Number(p.stock)>lowLimit(p));
    if(state.price==='under10')list=list.filter(p=>Number(p.price)<10000);
    if(state.price==='10to25')list=list.filter(p=>Number(p.price)>=10000&&Number(p.price)<=25000);
    if(state.price==='over25')list=list.filter(p=>Number(p.price)>25000);
    if(state.sort==='name')list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
    else if(state.sort==='priceAsc')list.sort((a,b)=>Number(a.price)-Number(b.price));
    else if(state.sort==='priceDesc')list.sort((a,b)=>Number(b.price)-Number(a.price));
    else if(state.sort==='stock')list.sort((a,b)=>Number(a.stock)-Number(b.stock));
    else list.sort((a,b)=>String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||'')));
    return list;
  }
  function stats(){const all=products();return {all:all.length,published:all.filter(x=>String(x.status||'published')==='published').length,hidden:all.filter(x=>String(x.status)==='hidden').length,out:all.filter(x=>Number(x.stock)<=0).length,low:all.filter(x=>Number(x.stock)>0&&Number(x.stock)<=lowLimit(x)).length}}
  function stockClass(p){const n=Number(p.stock);return n<=0?'out':n<=lowLimit(p)?'low':'ok'}
  function productCard(p){
    const img=imageUrl(p),st=stockClass(p),published=String(p.status||'published')==='published';
    return `<article class="admin-product-v129-card">
      <div class="admin-product-v129-image">${img?`<img src="${escv(img)}" alt="${escv(p.name||'منتج')}">`:`<span>${String(p.type)==='gift'?'🎁':'✏️'}</span>`}<em class="status ${escv(String(p.status||'published'))}">${statusLabel(p.status)}</em></div>
      <div class="admin-product-v129-body">
        <div class="admin-product-v129-title"><div><small>${typeLabel(p.type)} • ${escv(p.category||'عام')}</small><h3>${escv(p.name||p.title||'منتج')}</h3></div><strong>${moneyv(p.price)} د.ع</strong></div>
        <div class="admin-product-v129-meta"><span class="stock ${st}">${st==='out'?'نافد':st==='low'?'مخزون قليل':'متوفر'}: ${moneyv(p.stock||0)}</span><span>الرمز: ${escv(p.id||'—')}</span></div>
        <div class="admin-product-v129-actions">
          <button type="button" class="secondary" onclick="adminProductsV129Preview('${escv(p.id)}')">معاينة</button>
          <button type="button" class="secondary" onclick="editProduct('${escv(p.id)}')">تعديل</button>
          <button type="button" onclick="setProductStatus('${escv(p.id)}','${published?'hidden':'published'}')">${published?'إخفاء':'نشر'}</button>
          <button type="button" class="danger" onclick="deleteProduct('${escv(p.id)}')">حذف</button>
        </div>
      </div>
    </article>`;
  }
  function existingForm(){
    return `<details class="admin-products-v129-add"><summary>إضافة منتج جديد</summary><form id="productForm" class="form-grid"><select name="type" id="productType" onchange="refreshProductCategories()"><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input name="name" placeholder="اسم المنتج"><select name="category" id="productCategory"></select><input name="price" type="number" min="0" placeholder="السعر"><input name="stock" type="number" min="0" placeholder="المخزون"><label>صورة المنتج<input name="image" type="file" accept="image/*"></label><button type="button" onclick="addProduct()">إضافة المنتج</button></form></details>`;
  }
  function render(){
    const root=document.getElementById('adminContent');if(!root)return;
    const s=stats(),list=filterList();
    root.innerHTML=`<section class="admin-products-v129">
      <header class="admin-products-v129-head"><div><h2>إدارة المنتجات</h2><p>متابعة القرطاسية والهدايا والمخزون وحالة ظهورها في المتجر.</p></div><span>${list.length} منتج</span></header>
      <section class="admin-products-v129-stats"><article><small>إجمالي المنتجات</small><strong>${s.all}</strong></article><article><small>المنشورة</small><strong>${s.published}</strong></article><article><small>المخفية</small><strong>${s.hidden}</strong></article><article class="warn"><small>قليل المخزون</small><strong>${s.low}</strong></article><article class="danger"><small>النافدة</small><strong>${s.out}</strong></article></section>
      <section class="admin-products-v129-tools"><input id="adminProductSearch" value="${escv(state.q)}" placeholder="ابحث باسم المنتج أو القسم"><select id="adminProductType"><option value="">كل الأقسام</option><option value="stationery" ${state.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.type==='gift'?'selected':''}>هدايا</option></select><select id="adminProductStatus"><option value="">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشور</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفي</option><option value="draft" ${state.status==='draft'?'selected':''}>مسودة</option></select><select id="adminProductStock"><option value="">كل المخزون</option><option value="available" ${state.stock==='available'?'selected':''}>متوفر</option><option value="low" ${state.stock==='low'?'selected':''}>قليل المخزون</option><option value="out" ${state.stock==='out'?'selected':''}>نافد</option></select><select id="adminProductPrice"><option value="">كل الأسعار</option><option value="under10" ${state.price==='under10'?'selected':''}>أقل من 10 آلاف</option><option value="10to25" ${state.price==='10to25'?'selected':''}>10–25 ألف</option><option value="over25" ${state.price==='over25'?'selected':''}>أكثر من 25 ألف</option></select><select id="adminProductSort"><option value="newest" ${state.sort==='newest'?'selected':''}>الأحدث</option><option value="name" ${state.sort==='name'?'selected':''}>الاسم</option><option value="priceAsc" ${state.sort==='priceAsc'?'selected':''}>السعر تصاعدي</option><option value="priceDesc" ${state.sort==='priceDesc'?'selected':''}>السعر تنازلي</option><option value="stock" ${state.sort==='stock'?'selected':''}>الأقل مخزوناً</option></select><button type="button" onclick="adminProductsV129Clear()">مسح</button></section>
      ${existingForm()}
      <section class="admin-products-v129-grid">${list.length?list.map(productCard).join(''):'<div class="admin-products-v129-empty">لا توجد منتجات مطابقة للفلاتر الحالية.</div>'}</section>
    </section>`;
    try{if(typeof refreshProductCategories==='function')refreshProductCategories()}catch(_){ }
    ['adminProductSearch','adminProductType','adminProductStatus','adminProductStock','adminProductPrice','adminProductSort'].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener(id==='adminProductSearch'?'input':'change',()=>{state[{adminProductSearch:'q',adminProductType:'type',adminProductStatus:'status',adminProductStock:'stock',adminProductPrice:'price',adminProductSort:'sort'}[id]]=el.value;render()})});
  }
  window.adminProductsV129Clear=function(){Object.assign(state,{q:'',type:'',status:'',stock:'',price:'',sort:'newest'});render()};
  window.adminProductsV129Preview=function(id){const p=products().find(x=>String(x.id)===String(id));if(!p)return;const img=imageUrl(p);const html=`<div class="admin-products-v129-preview"><div class="preview-image">${img?`<img src="${escv(img)}" alt="${escv(p.name)}">`:'<span>🛍️</span>'}</div><div><small>${typeLabel(p.type)} • ${escv(p.category||'عام')}</small><h2>${escv(p.name||'منتج')}</h2><p>${escv(p.description||'لا يوجد وصف مضاف لهذا المنتج.')}</p><div class="preview-grid"><span>السعر <b>${moneyv(p.price)} د.ع</b></span><span>المخزون <b>${moneyv(p.stock||0)}</b></span><span>الحالة <b>${statusLabel(p.status)}</b></span></div></div></div>`;if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=html;checkoutModal.classList.remove('hidden')}else alert((p.name||'منتج')+' — '+moneyv(p.price)+' د.ع')};
  function install(){window.renderProductsAdmin=render;try{if(window.AlinAdminModules)AlinAdminModules.register('products',render)}catch(_){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* ===== admin/js/admin-products-v130.js ===== */
(function(){
  const state={editing:null,images:[],removed:[]};
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const products=()=>Array.isArray(window.db?.products)?window.db.products:(typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]);
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:(typeof db!=='undefined'&&Array.isArray(db.orders)?db.orders:[]);
  const cats=()=>Array.isArray(window.db?.categories)?window.db.categories:(typeof db!=='undefined'&&Array.isArray(db.categories)?db.categories:[]);
  const media=x=>{try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x}catch(_){return x||''}};
  const historyKey=id=>'alin_product_history_'+id;
  function history(id){try{return JSON.parse(localStorage.getItem(historyKey(id))||'[]')}catch(_){return []}}
  function addHistory(id,action,details=''){const rows=history(id);rows.unshift({at:new Date().toISOString(),action,details,user:(window.current?.name||window.current?.username||'المدير')});localStorage.setItem(historyKey(id),JSON.stringify(rows.slice(0,100)))}
  function field(p,n,fallback=''){return p&&p[n]!=null?p[n]:fallback}
  function imagesFor(p){let a=[];if(Array.isArray(p?.image_paths))a=p.image_paths;else if(typeof p?.image_paths==='string'){try{a=JSON.parse(p.image_paths)}catch(_){a=[]}}if(p?.image_path&&!a.includes(p.image_path))a.unshift(p.image_path);return a.filter(Boolean)}
  function categoryOptions(type,current){const list=cats().filter(c=>String(c.type||'stationery')===String(type)&&String(c.status||'active')==='active');return (list.length?list:[{name:'عام'}]).map(c=>`<option value="${escv(c.name)}" ${String(c.name)===String(current)?'selected':''}>${escv(c.name)}</option>`).join('')}
  function editorHtml(p){const edit=!!p,type=field(p,'type','stationery'),imgs=imagesFor(p);state.images=[...imgs];state.removed=[];return `<section id="adminProductV130Editor" class="admin-products-v130-editor">
    <header class="admin-products-v130-editor-head"><div><h3>${edit?'تعديل المنتج':'إضافة منتج جديد'}</h3><p>أدخل التفاصيل والصور والسعر والمخزون، ثم احفظ المنتج.</p></div><button type="button" class="admin-products-v130-close" onclick="adminProductV130Close()">إغلاق</button></header>
    <form id="adminProductV130Form" class="admin-products-v130-form" onsubmit="return adminProductV130Save(event)">
      <label>نوع المنتج<select name="type" id="adminProductV130Type" onchange="adminProductV130RefreshCategories()"><option value="stationery" ${type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${type==='gift'?'selected':''}>هدايا</option></select></label>
      <label class="span-2">اسم المنتج<input name="name" value="${escv(field(p,'name',field(p,'title','')))}" required placeholder="اسم واضح للمنتج"></label>
      <label>القسم<select name="category" id="adminProductV130Category">${categoryOptions(type,field(p,'category','عام'))}</select></label>
      <label>السعر الأساسي<input name="price" type="number" min="0" value="${Number(field(p,'price',0))}" required></label>
      <label>سعر العرض<input name="discount_price" type="number" min="0" value="${Number(field(p,'discount_price',field(p,'sale_price',0))||0)}" placeholder="اختياري"></label>
      <label>المخزون<input name="stock" type="number" min="0" value="${Number(field(p,'stock',0))}" required></label>
      <label>حد تنبيه المخزون<input name="low_stock_limit" type="number" min="0" value="${Number(field(p,'low_stock_limit',5))}"><span class="field-note">يظهر تنبيه عند الوصول لهذا العدد.</span></label>
      <label>حالة الظهور<select name="status"><option value="published" ${field(p,'status','published')==='published'?'selected':''}>منشور</option><option value="hidden" ${field(p,'status')==='hidden'?'selected':''}>مخفي</option><option value="draft" ${field(p,'status')==='draft'?'selected':''}>مسودة</option></select></label>
      <label class="span-4">وصف المنتج<textarea name="description" placeholder="اكتب وصفاً مرتباً ومختصراً">${escv(field(p,'description',''))}</textarea></label>
      <label class="span-2">صور المنتج<input id="adminProductV130Images" type="file" accept="image/*" multiple onchange="adminProductV130PreviewFiles(this)"><span class="field-note">يمكن اختيار عدة صور، وأول صورة تكون الرئيسية.</span></label>
      <div class="admin-products-v130-gallery"><b>معرض الصور</b><div id="adminProductV130Gallery" class="admin-products-v130-gallery-grid">${imgs.map((x,i)=>galleryItem(x,i)).join('')||'<span class="field-note">لم تتم إضافة صور بعد.</span>'}</div></div>
      <div class="admin-products-v130-form-actions"><button type="button" class="secondary" onclick="adminProductV130Close()">إلغاء</button><button type="submit" class="admin-products-v130-save">${edit?'حفظ التعديلات':'إضافة المنتج'}</button></div>
    </form></section>`}
  function galleryItem(x,i,local=false){const src=local?x:media(x);return `<div class="admin-products-v130-gallery-item"><img src="${escv(src)}" alt="صورة المنتج"><button type="button" onclick="adminProductV130RemoveImage(${i})">×</button>${i===0?'<span class="admin-products-v130-primary">الرئيسية</span>':''}</div>`}
  function appendEditor(p){const root=document.querySelector('.admin-products-v129');if(!root)return;document.getElementById('adminProductV130Editor')?.remove();root.querySelector('.admin-products-v129-tools')?.insertAdjacentHTML('afterend',editorHtml(p));document.querySelector('.admin-products-v129-add')?.setAttribute('hidden','');document.getElementById('adminProductV130Editor')?.scrollIntoView({behavior:'smooth',block:'start'})}
  window.adminProductV130Open=function(id){state.editing=id||null;appendEditor(id?products().find(x=>String(x.id)===String(id)):null)};
  window.adminProductV130Close=function(){state.editing=null;document.getElementById('adminProductV130Editor')?.remove();document.querySelector('.admin-products-v129-add')?.removeAttribute('hidden')};
  window.adminProductV130RefreshCategories=function(){const t=document.getElementById('adminProductV130Type'),c=document.getElementById('adminProductV130Category');if(c)c.innerHTML=categoryOptions(t?.value||'stationery','')};
  window.adminProductV130PreviewFiles=function(input){const files=[...(input.files||[])];const gallery=document.getElementById('adminProductV130Gallery');if(!gallery)return;const old=state.images.map((x,i)=>galleryItem(x,i)).join('');Promise.all(files.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.readAsDataURL(f)}))).then(previews=>{gallery.innerHTML=old+previews.map((x,j)=>galleryItem(x,state.images.length+j,true)).join('')})};
  window.adminProductV130RemoveImage=function(i){if(i<state.images.length){state.removed.push(state.images[i]);state.images.splice(i,1)}const gallery=document.getElementById('adminProductV130Gallery');if(gallery)gallery.innerHTML=state.images.map((x,j)=>galleryItem(x,j)).join('')||'<span class="field-note">لم تتم إضافة صور بعد.</span>'};
  async function uploadNewFiles(){const input=document.getElementById('adminProductV130Images'),files=[...(input?.files||[])],out=[];for(const f of files){if(!f.size)continue;out.push(await uploadFile('products',f,{type:'image'}))}return out.filter(Boolean)}
  async function safeInsert(payload){try{return await insert('products',payload)}catch(e){const basic={id:payload.id,type:payload.type,name:payload.name,category:payload.category,price:payload.price,stock:payload.stock,image_path:payload.image_path,status:payload.status};return await insert('products',basic)}}
  async function safeUpdate(id,payload){try{return await update('products',payload,{id})}catch(e){const basic={type:payload.type,name:payload.name,category:payload.category,price:payload.price,stock:payload.stock,image_path:payload.image_path,status:payload.status};return await update('products',basic,{id})}}
  window.adminProductV130Save=async function(ev){ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),name=String(fd.get('name')||'').trim(),price=Number(fd.get('price')||0),stock=Number(fd.get('stock')||0),discount=Number(fd.get('discount_price')||0);if(!name)return alert('اكتب اسم المنتج');if(price<0||stock<0||discount<0)return alert('تحقق من السعر والمخزون');if(discount&&discount>=price)return alert('سعر العرض يجب أن يكون أقل من السعر الأساسي');const btn=form.querySelector('[type=submit]');btn.disabled=true;btn.textContent='جاري الحفظ...';try{const uploaded=await uploadNewFiles(),all=[...state.images,...uploaded];const id=state.editing||uid('PR');const payload={id,type:fd.get('type'),name,category:fd.get('category')||'عام',price,discount_price:discount||null,sale_price:discount||null,stock,low_stock_limit:Number(fd.get('low_stock_limit')||5),description:String(fd.get('description')||'').trim(),image_path:all[0]||null,image_paths:all,status:fd.get('status')||'published',updated_at:new Date().toISOString()};if(state.editing){delete payload.id;await safeUpdate(id,payload);addHistory(id,'تعديل المنتج',`السعر ${price}، المخزون ${stock}`);await audit?.('product','تعديل منتج '+id)}else{payload.created_at=new Date().toISOString();await safeInsert(payload);addHistory(id,'إضافة المنتج',name);await audit?.('product','إضافة منتج '+name)}await load();state.editing=null;renderProductsAdmin();toast?.(state.editing?'تم حفظ التعديلات':'تم حفظ المنتج')}catch(e){alert(e.message||'تعذر حفظ المنتج')}finally{btn.disabled=false;btn.textContent=state.editing?'حفظ التعديلات':'إضافة المنتج'}};
  window.editProduct=function(id){adminProductV130Open(id)};
  window.addProduct=function(){adminProductV130Open(null)};
  window.adminProductV130History=function(id){const p=products().find(x=>String(x.id)===String(id)),rows=history(id);const html=`<h2>سجل تعديلات المنتج</h2><p>${escv(p?.name||'المنتج')}</p><div class="admin-products-v130-history">${rows.length?rows.map(r=>`<article><b>${escv(r.action)}</b><small>${new Date(r.at).toLocaleString('ar-IQ')} • ${escv(r.user)}</small>${r.details?`<p>${escv(r.details)}</p>`:''}</article>`).join(''):'<div class="empty">لا يوجد سجل تعديلات بعد.</div>'}</div>`;if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=html;checkoutModal.classList.remove('hidden')}};
  window.deleteProduct=async function(id){const p=products().find(x=>String(x.id)===String(id));if(!p)return;const linked=orders().filter(o=>String(o.item_id||o.product_id||'')===String(id)&&(String(o.kind||o.item_kind||'product')!=='booklet'));if(linked.length){if(confirm(`هذا المنتج مرتبط بـ ${linked.length} طلب ولا يمكن حذفه. هل تريد إخفاءه من المتجر بدلاً من الحذف؟`)){await setProductStatus(id,'hidden');addHistory(id,'إخفاء بدل الحذف',`مرتبط بـ ${linked.length} طلب`)}return}if(!confirm('هل تريد حذف المنتج نهائياً؟'))return;try{await removeRow('products',{id});await audit?.('product','حذف منتج '+id);await load();renderProductsAdmin();toast?.('تم حذف المنتج')}catch(e){alert(e.message||'تعذر حذف المنتج')}};
  function patchCards(){document.querySelectorAll('.admin-product-v129-card').forEach(card=>{const edit=card.querySelector('button[onclick^="editProduct"]');if(!edit)return;const id=(edit.getAttribute('onclick').match(/'([^']+)'/)||[])[1];if(!id)return;edit.setAttribute('onclick',`adminProductV130Open('${id}')`);const actions=card.querySelector('.admin-product-v129-actions');if(actions&&!actions.querySelector('.history-btn'))actions.insertAdjacentHTML('beforeend',`<button type="button" class="history-btn" onclick="adminProductV130History('${id}')">السجل</button>`)});const details=document.querySelector('.admin-products-v129-add');if(details){details.innerHTML='<summary onclick="setTimeout(()=>adminProductV130Open(null),0)">إضافة منتج جديد</summary>';details.removeAttribute('open')}}
  const oldRender=window.renderProductsAdmin;
  function install(){if(typeof oldRender==='function')window.renderProductsAdmin=function(){const r=oldRender.apply(this,arguments);setTimeout(patchCards,0);return r};try{if(window.AlinAdminModules)AlinAdminModules.register('products',()=>setTimeout(patchCards,0))}catch(_){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* ===== admin/js/admin-products-visible-v134.js ===== */
(function(){
  function renderProducts(){
    try{
      if(typeof window.adminStatsRender==='function') window.adminStatsRender();
      if(typeof window.markAdminTab==='function') window.markAdminTab('products');
      window.activeAdminTab='products';
      if(typeof window.renderProductsAdmin==='function'){
        const result=window.renderProductsAdmin();
        document.getElementById('adminContent')?.setAttribute('data-admin-products-visible','v134');
        return result;
      }
    }catch(error){
      console.error('تعذر عرض إدارة المنتجات',error);
      const root=document.getElementById('adminContent');
      if(root) root.innerHTML='<div class="notice">تعذر تحميل واجهة المنتجات الجديدة. أعد تحميل الصفحة.</div>';
    }
  }
  function install(){
    if(typeof window.adminTab!=='function') return;
    if(window.adminTab.__productsVisibleV134) return;
    const previous=window.adminTab;
    const wrapped=function(tab){
      if(tab==='products') return renderProducts();
      return previous.apply(this,arguments);
    };
    wrapped.__productsVisibleV134=true;
    window.adminTab=wrapped;
    if(window.AlinAdminModules && typeof window.AlinAdminModules.register==='function'){
      window.AlinAdminModules.register('products',renderProducts);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();

/* ===== admin/js/admin-products-v135.js ===== */

(function(){
  const state={q:'',type:'',status:'',stock:'',sort:'newest',editing:null};
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const list=()=>Array.isArray(window.db?.products)?window.db.products:(typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]);
  const limit=p=>Number(p.low_stock_limit||window.db?.settings?.low_stock_default||5);
  const statusLabel=s=>({published:'منشور',hidden:'مخفي',draft:'مسودة'}[String(s||'published')]||'منشور');
  const img=p=>{const x=p.image_path||p.image_url||p.image||'';try{return x&&typeof mediaUrl==='function'?mediaUrl(x):x}catch(_){return x}};
  function filtered(){let a=[...list()];const q=state.q.trim().toLowerCase();if(q)a=a.filter(p=>[p.name,p.title,p.category,p.description].some(v=>String(v||'').toLowerCase().includes(q)));if(state.type)a=a.filter(p=>String(p.type||'stationery')===state.type);if(state.status)a=a.filter(p=>String(p.status||'published')===state.status);if(state.stock==='low')a=a.filter(p=>+p.stock>0&&+p.stock<=limit(p));if(state.stock==='out')a=a.filter(p=>+p.stock<=0);if(state.stock==='ok')a=a.filter(p=>+p.stock>limit(p));if(state.sort==='name')a.sort((x,y)=>String(x.name||'').localeCompare(String(y.name||''),'ar'));else if(state.sort==='price')a.sort((x,y)=>+x.price-+y.price);else if(state.sort==='stock')a.sort((x,y)=>+x.stock-+y.stock);else a.sort((x,y)=>String(y.created_at||y.id||'').localeCompare(String(x.created_at||x.id||'')));return a}
  function editor(p){return `<section class="admin-products-v135-editor" id="adminProductsV135Editor"><h3>${p?'تعديل المنتج':'إضافة منتج جديد'}</h3><form class="form-grid" onsubmit="adminProductsV135Save(event)"><select name="type"><option value="stationery" ${p?.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${p?.type==='gift'?'selected':''}>هدايا</option></select><input name="name" value="${escv(p?.name||'')}" placeholder="اسم المنتج" required><input name="category" value="${escv(p?.category||'')}" placeholder="القسم"><input name="price" type="number" min="0" value="${Number(p?.price||0)}" placeholder="السعر"><input name="stock" type="number" min="0" value="${Number(p?.stock||0)}" placeholder="المخزون"><input name="low_stock_limit" type="number" min="0" value="${Number(p?.low_stock_limit||5)}" placeholder="حد التنبيه"><select name="status"><option value="published" ${String(p?.status||'published')==='published'?'selected':''}>منشور</option><option value="hidden" ${p?.status==='hidden'?'selected':''}>مخفي</option><option value="draft" ${p?.status==='draft'?'selected':''}>مسودة</option></select><label>صورة المنتج<input name="image" type="file" accept="image/*"></label><textarea class="full" name="description" placeholder="تفاصيل المنتج">${escv(p?.description||'')}</textarea><div class="editor-actions full"><button type="button" class="secondary" onclick="adminProductsV135Close()">إلغاء</button><button type="submit">${p?'حفظ التعديلات':'إضافة المنتج'}</button></div></form></section>`}
  function card(p){const n=+p.stock||0,sc=n<=0?'out':n<=limit(p)?'low':'ok',photo=img(p);return `<article class="admin-product-v135-card"><div class="admin-product-v135-image">${photo?`<img src="${escv(photo)}" alt="${escv(p.name||'منتج')}">`:`<span>${p.type==='gift'?'🎁':'🛍️'}</span>`}<em class="admin-product-v135-status ${escv(p.status||'published')}">${statusLabel(p.status)}</em></div><div class="admin-product-v135-body"><small class="admin-product-v135-kicker">${p.type==='gift'?'هدايا':'قرطاسية'} • ${escv(p.category||'عام')}</small><div class="admin-product-v135-title"><h3>${escv(p.name||p.title||'منتج')}</h3><strong>${moneyv(p.price)} د.ع</strong></div><div class="admin-product-v135-meta"><span class="${sc}">${sc==='out'?'نافد':sc==='low'?'قليل المخزون':'متوفر'}: ${moneyv(n)}</span><span>${statusLabel(p.status)}</span></div><div class="admin-product-v135-actions"><button class="secondary" onclick="adminProductsV135Edit('${escv(p.id)}')">تعديل</button><button onclick="adminProductsV135Toggle('${escv(p.id)}','${String(p.status||'published')==='published'?'hidden':'published'}')">${String(p.status||'published')==='published'?'إخفاء':'نشر'}</button><button class="secondary" onclick="adminProductsV129Preview?.('${escv(p.id)}')">معاينة</button><button class="danger" onclick="adminProductsV135Delete('${escv(p.id)}')">حذف</button></div></div></article>`}
  function cleanup(){document.querySelectorAll('.alin-v84-admin-shortcuts,.alin-v85-shortcuts,.alin-v98-admin-shortcuts,[class*="admin-shortcuts"]').forEach(x=>x.remove());document.querySelectorAll('#adminContent button').forEach(b=>{const t=(b.textContent||'').trim();if(t.includes('مركز تشغيل المتجر')||t==='التقارير'||t.includes('📊 التقارير'))b.remove()})}
  function render(){const root=document.getElementById('adminContent');if(!root)return;const all=list(),a=filtered(),published=all.filter(x=>String(x.status||'published')==='published').length,hidden=all.filter(x=>String(x.status)==='hidden').length,low=all.filter(x=>+x.stock>0&&+x.stock<=limit(x)).length,out=all.filter(x=>+x.stock<=0).length;root.dataset.adminModule='products';root.innerHTML=`<section class="admin-products-v135"><header class="admin-products-v135-head"><div><h2>إدارة المنتجات</h2><p>إدارة القرطاسية والهدايا والأسعار والمخزون من مكان واحد.</p></div><button onclick="adminProductsV135Add()">+ إضافة منتج</button></header><section class="admin-products-v135-stats"><article><small>إجمالي المنتجات</small><strong>${all.length}</strong></article><article><small>المنشورة</small><strong>${published}</strong></article><article><small>المخفية</small><strong>${hidden}</strong></article><article class="warn"><small>قليل المخزون</small><strong>${low}</strong></article><article class="danger"><small>النافدة</small><strong>${out}</strong></article></section><section class="admin-products-v135-tools"><input id="v135ProductQ" value="${escv(state.q)}" placeholder="ابحث باسم المنتج أو القسم"><select id="v135ProductType"><option value="">كل الأنواع</option><option value="stationery" ${state.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.type==='gift'?'selected':''}>هدايا</option></select><select id="v135ProductStatus"><option value="">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشور</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفي</option><option value="draft" ${state.status==='draft'?'selected':''}>مسودة</option></select><select id="v135ProductStock"><option value="">كل المخزون</option><option value="ok" ${state.stock==='ok'?'selected':''}>متوفر</option><option value="low" ${state.stock==='low'?'selected':''}>قليل المخزون</option><option value="out" ${state.stock==='out'?'selected':''}>نافد</option></select><select id="v135ProductSort"><option value="newest" ${state.sort==='newest'?'selected':''}>الأحدث</option><option value="name" ${state.sort==='name'?'selected':''}>الاسم</option><option value="price" ${state.sort==='price'?'selected':''}>السعر</option><option value="stock" ${state.sort==='stock'?'selected':''}>المخزون</option></select><button onclick="adminProductsV135Clear()">مسح</button></section>${state.editing!==null?editor(state.editing?all.find(x=>String(x.id)===String(state.editing)):null):''}<section class="admin-products-v135-grid">${a.length?a.map(card).join(''):'<div class="admin-products-v135-empty">لا توجد منتجات مطابقة.</div>'}</section></section>`;cleanup();const map={v135ProductQ:'q',v135ProductType:'type',v135ProductStatus:'status',v135ProductStock:'stock',v135ProductSort:'sort'};Object.keys(map).forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==='v135ProductQ'?'input':'change',()=>{state[map[id]]=el.value;render()})})}
  window.adminProductsV135Add=()=>{state.editing='';render();setTimeout(()=>document.getElementById('adminProductsV135Editor')?.scrollIntoView({behavior:'smooth'}),0)};
  window.adminProductsV135Edit=id=>{state.editing=id;render();setTimeout(()=>document.getElementById('adminProductsV135Editor')?.scrollIntoView({behavior:'smooth'}),0)};
  window.adminProductsV135Close=()=>{state.editing=null;render()};
  window.adminProductsV135Clear=()=>{Object.assign(state,{q:'',type:'',status:'',stock:'',sort:'newest'});render()};
  window.adminProductsV135Toggle=async(id,status)=>{try{await update('products',{status},{id});await load();render()}catch(e){alert(e.message||'تعذر تغيير الحالة')}};
  window.adminProductsV135Delete=async id=>{if(typeof window.deleteProduct==='function')return window.deleteProduct(id);if(!confirm('حذف المنتج؟'))return;await removeRow('products',{id});await load();render()};
  window.adminProductsV135Save=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget),p=list().find(x=>String(x.id)===String(state.editing));try{let image=p?.image_path||null;const file=f.get('image');if(file&&file.size)image=await uploadFile('products',file,{type:'image'});const payload={type:f.get('type'),name:String(f.get('name')||'').trim(),category:String(f.get('category')||'عام'),price:+f.get('price')||0,stock:+f.get('stock')||0,low_stock_limit:+f.get('low_stock_limit')||5,status:f.get('status')||'published',description:String(f.get('description')||''),image_path:image,updated_at:new Date().toISOString()};if(state.editing){await update('products',payload,{id:state.editing})}else{payload.id=uid('PR');payload.created_at=new Date().toISOString();await insert('products',payload)}await load();state.editing=null;render();toast?.('تم حفظ المنتج')}catch(e){alert(e.message||'تعذر حفظ المنتج')}};
  function install(){window.renderProductsAdmin=render;const base=window.adminTab;if(typeof base==='function'&&!base.__v135){const wrap=function(t){if(t==='products')return render();return base.apply(this,arguments)};wrap.__v135=true;window.adminTab=wrap}window.AlinAdminModules?.register?.('products',render);cleanup()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;
