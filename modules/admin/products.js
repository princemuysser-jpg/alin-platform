// ALIN Admin Products & Categories — single implementation (v2.2.2)
(function(){
  'use strict';

  const state={q:'',type:'',status:'',stock:'',sort:'newest'};
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Number(value||0).toLocaleString('ar-IQ');
  const products=()=>Array.isArray(window.db?.products)?window.db.products:[];
  const categories=()=>Array.isArray(window.db?.categories)?window.db.categories:[];
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const root=()=>window.adminContent||document.getElementById('adminContent');
  const normalizeType=value=>{
    const type=String(value||'stationery').trim().toLowerCase();
    if(type==='gift'||type==='gifts')return 'gift';
    if(type==='stationary'||type==='stationery')return 'stationery';
    return type||'stationery';
  };
  const typeLabel=value=>normalizeType(value)==='gift'?'هدايا':'قرطاسية';
  const statusLabel=value=>({published:'منشور',hidden:'مخفي',draft:'مسودة',archived:'مؤرشف',inactive:'غير فعال'}[String(value||'published').toLowerCase()]||'منشور');
  const categoryList=type=>categories().filter(item=>normalizeType(item.type)===normalizeType(type)&&String(item.status||'active')==='active');
  const uploadImage=async file=>{
    if(!file||!file.name)return '';
    const uploader=window.uploadFileV52||window.uploadFile;
    if(typeof uploader!=='function')throw new Error('خدمة رفع الصور غير متاحة');
    return uploader('products',file,{type:'image'});
  };
  const imageUrl=item=>{
    const value=item?.image_path||item?.image_url||item?.image||'';
    if(!value)return '';
    try{return typeof window.mediaUrl==='function'?window.mediaUrl(value):value}catch(_){return value}
  };
  const lowStockLimit=item=>Number(item?.low_stock_limit||window.db?.settings?.low_stock_default||5);
  const linkedOrders=id=>orders().filter(order=>{
    const itemId=order.item_id||order.product_id||order.item?.id;
    const kind=String(order.kind||order.item_kind||order.item_type||'product').toLowerCase();
    return String(itemId)===String(id)&&kind!=='booklet';
  });

  async function reloadAndRender(renderFn){
    if(typeof window.load==='function')await window.load();
    if(typeof renderFn==='function')renderFn();
  }

  function filteredProducts(){
    let list=[...products()];
    const q=state.q.trim().toLowerCase();
    if(q)list=list.filter(item=>[item.name,item.title,item.category,item.description,item.details].some(value=>String(value||'').toLowerCase().includes(q)));
    if(state.type)list=list.filter(item=>normalizeType(item.type||item.category_id)===state.type);
    if(state.status)list=list.filter(item=>String(item.status||'published')===state.status);
    if(state.stock==='available')list=list.filter(item=>Number(item.stock)>lowStockLimit(item));
    if(state.stock==='low')list=list.filter(item=>Number(item.stock)>0&&Number(item.stock)<=lowStockLimit(item));
    if(state.stock==='out')list=list.filter(item=>Number(item.stock)<=0);
    if(state.sort==='name')list.sort((a,b)=>String(a.name||a.title||'').localeCompare(String(b.name||b.title||''),'ar'));
    else if(state.sort==='priceAsc')list.sort((a,b)=>Number(a.price)-Number(b.price));
    else if(state.sort==='priceDesc')list.sort((a,b)=>Number(b.price)-Number(a.price));
    else if(state.sort==='stock')list.sort((a,b)=>Number(a.stock)-Number(b.stock));
    else list.sort((a,b)=>String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||'')));
    return list;
  }

  function categoryOptions(type,selected=''){
    const list=categoryList(type);
    const options=list.map(item=>`<option value="${escv(item.name)}" ${String(selected)===String(item.name)?'selected':''}>${escv(item.name)}</option>`).join('');
    return options||`<option value="${escv(selected||'عام')}">${escv(selected||'عام')}</option>`;
  }

  function productForm(item={}){
    const editing=Boolean(item.id);
    const type=normalizeType(item.type||item.category_id||'stationery');
    return `<form id="alinProductEditorForm" class="form-grid admin-product-editor" data-id="${escv(item.id||'')}">
      <select name="type" id="alinProductType" onchange="refreshProductCategories()"><option value="stationery" ${type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${type==='gift'?'selected':''}>هدايا</option></select>
      <input name="name" value="${escv(item.name||item.title||'')}" placeholder="اسم المنتج" required>
      <select name="category" id="alinProductCategory">${categoryOptions(type,item.category||'')}</select>
      <input name="price" type="number" min="0" value="${Number(item.price||0)}" placeholder="السعر" required>
      <input name="stock" type="number" min="0" value="${Number(item.stock||0)}" placeholder="المخزون" required>
      <input name="lowStockLimit" type="number" min="0" value="${Number(item.low_stock_limit||window.db?.settings?.low_stock_default||5)}" placeholder="حد تنبيه المخزون">
      <textarea name="description" rows="3" placeholder="تفاصيل المنتج">${escv(item.description||item.details||'')}</textarea>
      <label>صورة المنتج<input name="image" type="file" accept="image/*"></label>
      <div class="row-actions"><button type="button" onclick="saveProduct()">${editing?'حفظ التعديل':'إضافة المنتج'}</button><button type="button" class="secondary" onclick="closeProductEditor()">إلغاء</button></div>
    </form>`;
  }

  function ensureEditor(){
    let modal=document.getElementById('alinProductEditorModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='alinProductEditorModal';
    modal.className='modal hidden';
    modal.innerHTML='<div class="modal-card"><button class="x" type="button" onclick="closeProductEditor()">×</button><div id="alinProductEditorBody"></div></div>';
    document.body.appendChild(modal);
    return modal;
  }

  function openProductEditor(id=''){
    const item=id?products().find(row=>String(row.id)===String(id)):{};
    if(id&&!item)return;
    const modal=ensureEditor();
    modal.querySelector('#alinProductEditorBody').innerHTML=`<h2>${id?'تعديل المنتج':'إضافة منتج جديد'}</h2>${productForm(item||{})}`;
    modal.classList.remove('hidden');
    modal.hidden=false;
  }

  function closeProductEditor(){
    const modal=document.getElementById('alinProductEditorModal');
    if(!modal)return;
    modal.classList.add('hidden');
    modal.hidden=true;
  }

  async function saveProduct(){
    const form=document.getElementById('alinProductEditorForm');
    if(!form)return;
    const data=new FormData(form);
    const id=String(form.dataset.id||'');
    const existing=id?products().find(item=>String(item.id)===id):null;
    const name=String(data.get('name')||'').trim();
    const type=normalizeType(data.get('type'));
    const category=String(data.get('category')||'عام').trim()||'عام';
    const price=Number(data.get('price')||0);
    const stock=Number(data.get('stock')||0);
    const lowStockLimit=Number(data.get('lowStockLimit')||5);
    const description=String(data.get('description')||'').trim();
    if(!name)return alert('اكتب اسم المنتج');
    if(!Number.isFinite(price)||price<0)return alert('السعر غير صحيح');
    if(!Number.isFinite(stock)||stock<0)return alert('المخزون غير صحيح');
    try{
      const imageFile=data.get('image');
      const uploaded=imageFile&&imageFile.name?await uploadImage(imageFile):'';
      const payload={
        name,title:name,type,category,category_id:category,price,stock,
        low_stock_limit:Math.max(0,lowStockLimit||0),description,details:description,
        status:existing?.status||'published',updated_at:new Date().toISOString()
      };
      if(uploaded)payload.image_path=uploaded;
      if(existing){
        await window.update('products',payload,{id});
        if(typeof window.audit==='function')await window.audit('product',`تعديل المنتج ${name}`);
      }else{
        payload.id=typeof window.uid==='function'?window.uid('PR'):`PR-${Date.now()}`;
        payload.created_at=new Date().toISOString();
        await window.insert('products',payload);
        if(typeof window.audit==='function')await window.audit('product',`إضافة المنتج ${name}`);
      }
      closeProductEditor();
      await reloadAndRender(renderProductsAdmin);
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(existing?'تم تعديل المنتج':'تمت إضافة المنتج وظهر في المتجر');
    }catch(error){
      console.error('[ALIN products save]',error);
      alert(error?.message||'تعذر حفظ المنتج');
    }
  }

  async function setProductStatus(id,status){
    const item=products().find(row=>String(row.id)===String(id));
    if(!item)return;
    try{
      await window.update('products',{status,updated_at:new Date().toISOString()},{id:item.id});
      if(typeof window.audit==='function')await window.audit('product',`تغيير حالة المنتج ${item.name||item.id} إلى ${statusLabel(status)}`);
      await reloadAndRender(renderProductsAdmin);
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(status==='published'?'تم إظهار المنتج':'تم إخفاء المنتج');
    }catch(error){alert(error?.message||'تعذر تغيير حالة المنتج')}
  }

  async function deleteProduct(id){
    const item=products().find(row=>String(row.id)===String(id));
    if(!item)return;
    const linked=linkedOrders(id);
    if(linked.length){
      if(confirm(`هذا المنتج مرتبط بـ ${linked.length} طلب ولا يمكن حذفه. هل تريد إخفاءه من المتجر؟`))await setProductStatus(id,'hidden');
      return;
    }
    if(!confirm(`حذف المنتج ${item.name||''} نهائيًا؟`))return;
    try{
      await window.removeRow('products',{id:item.id});
      if(typeof window.audit==='function')await window.audit('product',`حذف المنتج ${item.name||item.id}`);
      await reloadAndRender(renderProductsAdmin);
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast('تم حذف المنتج');
    }catch(error){alert(error?.message||'تعذر حذف المنتج')}
  }

  function productCard(item){
    const image=imageUrl(item);
    const status=String(item.status||'published');
    const stock=Number(item.stock||0);
    const low=lowStockLimit(item);
    const stockClass=stock<=0?'out':stock<=low?'low':'ok';
    const stockText=stock<=0?'نافد':stock<=low?'مخزون قليل':'متوفر';
    return `<article class="admin-product-v129-card">
      <div class="admin-product-v129-image">${image?`<img src="${escv(image)}" alt="${escv(item.name||'منتج')}">`:`<span>${normalizeType(item.type)==='gift'?'🎁':'✏️'}</span>`}<em class="status ${escv(status)}">${statusLabel(status)}</em></div>
      <div class="admin-product-v129-body">
        <div class="admin-product-v129-title"><div><small>${typeLabel(item.type)} • ${escv(item.category||'عام')}</small><h3>${escv(item.name||item.title||'منتج')}</h3></div><strong>${moneyv(item.price)} د.ع</strong></div>
        <p>${escv(item.description||item.details||'')}</p>
        <div class="admin-product-v129-meta"><span class="stock ${stockClass}">${stockText}: ${moneyv(stock)}</span><span>الرمز: ${escv(item.id||'—')}</span></div>
        <div class="admin-product-v129-actions"><button type="button" class="secondary" onclick="editProduct('${escv(item.id)}')">تعديل</button><button type="button" onclick="setProductStatus('${escv(item.id)}','${status==='published'?'hidden':'published'}')">${status==='published'?'إخفاء':'نشر'}</button><button type="button" class="danger" onclick="deleteProduct('${escv(item.id)}')">حذف</button></div>
      </div>
    </article>`;
  }

  function renderProductsAdmin(){
    const container=root();if(!container)return;
    const list=filteredProducts();
    const all=products();
    const published=all.filter(item=>String(item.status||'published')==='published').length;
    const hidden=all.filter(item=>String(item.status)==='hidden').length;
    const low=all.filter(item=>Number(item.stock)>0&&Number(item.stock)<=lowStockLimit(item)).length;
    const out=all.filter(item=>Number(item.stock)<=0).length;
    container.innerHTML=`<section class="admin-products-v129">
      <header class="admin-products-v129-head"><div><h2>إدارة المنتجات</h2><p>إدارة القرطاسية والهدايا والمخزون من تنفيذ واحد مستقل عن platform.js.</p></div><button type="button" onclick="addProduct()">إضافة منتج</button></header>
      <section class="admin-products-v129-stats"><article><small>الإجمالي</small><strong>${all.length}</strong></article><article><small>المنشورة</small><strong>${published}</strong></article><article><small>المخفية</small><strong>${hidden}</strong></article><article class="warn"><small>قليل المخزون</small><strong>${low}</strong></article><article class="danger"><small>النافدة</small><strong>${out}</strong></article></section>
      <section class="admin-products-v129-tools"><input id="alinProductSearch" value="${escv(state.q)}" placeholder="بحث بالاسم أو القسم"><select id="alinProductFilterType"><option value="">كل الأنواع</option><option value="stationery" ${state.type==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.type==='gift'?'selected':''}>هدايا</option></select><select id="alinProductFilterStatus"><option value="">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشور</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفي</option></select><select id="alinProductFilterStock"><option value="">كل المخزون</option><option value="available" ${state.stock==='available'?'selected':''}>متوفر</option><option value="low" ${state.stock==='low'?'selected':''}>قليل</option><option value="out" ${state.stock==='out'?'selected':''}>نافد</option></select><select id="alinProductSort"><option value="newest" ${state.sort==='newest'?'selected':''}>الأحدث</option><option value="name" ${state.sort==='name'?'selected':''}>الاسم</option><option value="priceAsc" ${state.sort==='priceAsc'?'selected':''}>السعر تصاعدي</option><option value="priceDesc" ${state.sort==='priceDesc'?'selected':''}>السعر تنازلي</option><option value="stock" ${state.sort==='stock'?'selected':''}>الأقل مخزونًا</option></select></section>
      <section class="admin-products-v129-grid">${list.length?list.map(productCard).join(''):'<div class="empty">لا توجد منتجات مطابقة.</div>'}</section>
    </section>`;
    const bind=(id,key,event='change')=>document.getElementById(id)?.addEventListener(event,eventObject=>{state[key]=eventObject.target.value;renderProductsAdmin()});
    bind('alinProductSearch','q','input');bind('alinProductFilterType','type');bind('alinProductFilterStatus','status');bind('alinProductFilterStock','stock');bind('alinProductSort','sort');
  }

  function refreshProductCategories(){
    const type=document.getElementById('alinProductType')?.value||'stationery';
    const select=document.getElementById('alinProductCategory');
    if(!select)return;
    const previous=select.value;
    select.innerHTML=categoryOptions(type,previous);
  }

  function renderCategoriesAdmin(){
    const container=root();if(!container)return;
    const labels={booklet:'ملازم',stationery:'قرطاسية',gift:'هدايا'};
    container.innerHTML=`<section class="admin-categories"><header><h2>إدارة الأقسام</h2><p>الأقسام المستخدمة في المتجر ونماذج المنتجات.</p></header><form id="alinCategoryForm" class="form-grid"><select name="type"><option value="booklet">ملازم</option><option value="stationery">قرطاسية</option><option value="gift">هدايا</option></select><input name="name" placeholder="اسم القسم" required><button type="button" onclick="addCategory()">إضافة قسم</button></form>${categories().length?categories().map(item=>`<div class="row"><div><b>${escv(item.name)}</b><small>${labels[normalizeType(item.type)]||labels[item.type]||escv(item.type)}</small></div><div class="row-actions"><button type="button" class="secondary" onclick="editCategory('${escv(item.id)}')">تعديل</button><button type="button" onclick="toggleCategory('${escv(item.id)}','${String(item.status||'active')==='active'?'hidden':'active'}')">${String(item.status||'active')==='active'?'إخفاء':'إظهار'}</button><button type="button" class="danger" onclick="deleteCategory('${escv(item.id)}')">حذف</button></div></div>`).join(''):'<div class="empty">لا توجد أقسام.</div>'}</section>`;
  }

  async function addCategory(){
    const form=document.getElementById('alinCategoryForm');if(!form)return;
    const data=new FormData(form),name=String(data.get('name')||'').trim(),type=normalizeType(data.get('type'));
    if(!name)return alert('اكتب اسم القسم');
    if(categories().some(item=>normalizeType(item.type)===type&&String(item.name||'').trim().toLowerCase()===name.toLowerCase()))return alert('هذا القسم موجود مسبقًا');
    try{
      await window.insert('categories',{id:typeof window.uid==='function'?window.uid('C'):`C-${Date.now()}`,type,name,status:'active',created_at:new Date().toISOString()});
      if(typeof window.audit==='function')await window.audit('category',`إضافة القسم ${name}`);
      await reloadAndRender(renderCategoriesAdmin);
      if(typeof window.toast==='function')window.toast('تمت إضافة القسم');
    }catch(error){alert(error?.message||'تعذر إضافة القسم')}
  }

  async function editCategory(id){
    const item=categories().find(row=>String(row.id)===String(id));if(!item)return;
    const name=prompt('اسم القسم',item.name||'');if(name===null||!name.trim())return;
    try{await window.update('categories',{name:name.trim(),updated_at:new Date().toISOString()},{id:item.id});if(typeof window.audit==='function')await window.audit('category',`تعديل القسم ${item.name} إلى ${name.trim()}`);await reloadAndRender(renderCategoriesAdmin);if(typeof window.toast==='function')window.toast('تم تعديل القسم')}catch(error){alert(error?.message||'تعذر تعديل القسم')}
  }

  async function toggleCategory(id,status){
    try{await window.update('categories',{status,updated_at:new Date().toISOString()},{id});await reloadAndRender(renderCategoriesAdmin)}catch(error){alert(error?.message||'تعذر تغيير حالة القسم')}
  }

  async function deleteCategory(id){
    const item=categories().find(row=>String(row.id)===String(id));if(!item)return;
    const linked=products().filter(product=>String(product.category||'')===String(item.name||''));
    if(linked.length)return alert(`لا يمكن حذف القسم لأنه مرتبط بـ ${linked.length} منتج. أخفِ القسم بدلًا من حذفه.`);
    if(!confirm(`حذف القسم ${item.name||''}؟`))return;
    try{await window.removeRow('categories',{id:item.id});if(typeof window.audit==='function')await window.audit('category',`حذف القسم ${item.name||item.id}`);await reloadAndRender(renderCategoriesAdmin);if(typeof window.toast==='function')window.toast('تم حذف القسم')}catch(error){alert(error?.message||'تعذر حذف القسم')}
  }

  window.renderProductsAdmin=renderProductsAdmin;
  window.renderCategoriesAdmin=renderCategoriesAdmin;
  window.refreshProductCategories=refreshProductCategories;
  window.addProduct=()=>openProductEditor('');
  window.editProduct=openProductEditor;
  window.saveProduct=saveProduct;
  window.closeProductEditor=closeProductEditor;
  window.setProductStatus=setProductStatus;
  window.deleteProduct=deleteProduct;
  window.addCategory=addCategory;
  window.editCategory=editCategory;
  window.toggleCategory=toggleCategory;
  window.deleteCategory=deleteCategory;
  // Compatibility aliases point to the same implementation, not wrappers.
  window.alinV73AddProduct=window.addProduct;
  window.alinV73EditProduct=window.editProduct;
  window.alinV73DeleteProduct=window.deleteProduct;
  window.alinV79ToggleProduct=id=>{const item=products().find(row=>String(row.id)===String(id));return item?setProductStatus(id,String(item.status||'published')==='published'?'hidden':'published'):undefined};
  window.AlinAdminModules?.register?.('products',renderProductsAdmin);
  window.AlinAdminModules?.register?.('categories',renderCategoriesAdmin);
})();
