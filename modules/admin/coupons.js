// === admin/coupons.js ===
/* ALIN v2.1.0: single admin coupon implementation. */

let alinEditingCouponId = null;
let alinCouponSaving = false;

function alinCouponAdminEscape(value){
  return typeof window.esc === 'function' ? window.esc(value) : String(value ?? '');
}
function alinCouponAdminMoney(value){
  return typeof window.money === 'function' ? window.money(value) : Number(value || 0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
}
function alinCouponAdminDate(value){
  if(!value) return 'غير محدد';
  try{return new Date(value).toLocaleDateString(window.AlinI18n?.locale?.()||'ar-IQ')}catch(_){return String(value)}
}
function alinCouponAdminRows(){
  return Array.isArray(window.db?.coupons) ? window.db.coupons : [];
}
function alinCouponUsed(coupon){return Number(coupon.used_count ?? coupon.usage_count ?? 0)}
function alinCouponLimit(coupon){return Number(coupon.max_uses ?? coupon.usage_limit ?? 0)}
function alinCouponIsActive(coupon){
  return String(coupon.status || 'active') === 'active' && (!coupon.expires_at || new Date(coupon.expires_at).getTime() >= Date.now());
}
function alinCouponDuplicate(rows, code, ignoreId = null){
  return rows.find(coupon => window.AlinCoupons.normalizeCode(coupon.code) === code && String(coupon.id) !== String(ignoreId ?? ''));
}
function alinCouponDuplicateMessage(){
  return 'هذا كود الخصم موجود مسبقًا. اختره من القائمة واضغط تعديل بدل إضافته مرة ثانية.';
}
function alinCouponRowsHtml(rows){
  if(!rows.length) return '<div class="admin-v140-empty">لا توجد كوبونات</div>';
  return rows.map(coupon => {
    const limit = alinCouponLimit(coupon);
    const used = alinCouponUsed(coupon);
    const active = alinCouponIsActive(coupon);
    const code = alinCouponAdminEscape(coupon.code);
    const value = coupon.discount_type === 'fixed'
      ? `${alinCouponAdminMoney(coupon.discount_value)} د.ع`
      : `${alinCouponAdminMoney(coupon.discount_value)}%`;
    return `<div class="admin-v140-item coupon-v140-item" data-search="${code}"><div><h4 class="coupon-code">${code}</h4><p>${value} خصم — ${alinCouponAdminEscape(coupon.applies_to || 'كل المتجر')}</p><div class="admin-v140-meta"><span class="admin-v140-pill ${active?'active':'off'}">${active?'نشط':'متوقف/منتهي'}</span><span class="admin-v140-pill">استخدام ${used}/${limit || '∞'}</span><span class="admin-v140-pill">ينتهي ${alinCouponAdminDate(coupon.expires_at)}</span></div></div><div class="admin-v140-item-actions"><button class="coupon-copy" onclick="copyCoupon('${code}')">نسخ</button><button class="secondary" onclick="editCoupon('${alinCouponAdminEscape(coupon.id)}')">تعديل</button><button onclick="toggleCoupon('${alinCouponAdminEscape(coupon.id)}','${String(coupon.status || 'active') === 'active' ? 'disabled' : 'active'}')">${String(coupon.status || 'active') === 'active' ? 'إيقاف' : 'تشغيل'}</button><button class="danger" onclick="deleteCoupon('${alinCouponAdminEscape(coupon.id)}')">حذف</button></div></div>`;
  }).join('');
}

function renderCouponsAdmin(){
  const rows = alinCouponAdminRows();
  const active = rows.filter(alinCouponIsActive).length;
  const used = rows.reduce((sum,coupon)=>sum+alinCouponUsed(coupon),0);
  const expired = rows.filter(coupon=>coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()).length;
  const content = document.getElementById('adminContent');
  if(!content) return;
  content.innerHTML = `<section class="admin-v140"><header class="admin-v140-head"><div><h2>العروض والكوبونات</h2><p>إنشاء أكواد خصم وتحديد القيمة، عدد الاستخدامات، القسم المستهدف وتاريخ الانتهاء.</p></div></header><div class="admin-v140-stats"><div class="admin-v140-stat"><span>${rows.length}</span><small>إجمالي الكوبونات</small></div><div class="admin-v140-stat"><span>${active}</span><small>نشطة</small></div><div class="admin-v140-stat"><span>${used}</span><small>مرات الاستخدام</small></div><div class="admin-v140-stat"><span>${expired}</span><small>منتهية</small></div></div><div class="admin-v140-grid"><article class="admin-v140-card"><h3>${alinEditingCouponId?'تعديل الكوبون':'إضافة كوبون'}</h3><form class="admin-v140-form" onsubmit="return false"><label>كود الخصم<input id="couponAdminCode" placeholder="ALIN20" maxlength="24"></label><div class="admin-v140-form-row"><label>نوع الخصم<select id="couponAdminType"><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select></label><label>قيمة الخصم<input id="couponAdminValue" type="number" min="1"></label></div><div class="admin-v140-form-row"><label>عدد الاستخدامات<input id="couponAdminLimit" type="number" min="0" placeholder="0 = بلا حد"></label><label>تاريخ الانتهاء<input id="couponAdminExpiry" type="date"></label></div><label>يطبق على<select id="couponAdminApplies"><option value="all">كل المتجر</option><option value="booklet">الملازم</option><option value="stationery">القرطاسية</option><option value="gift">الهدايا</option></select></label><label>الحالة<select id="couponAdminStatus"><option value="active">نشط</option><option value="disabled">متوقف</option></select></label><div class="admin-v140-actions"><button id="couponAdminSave" onclick="saveCoupon()">${alinEditingCouponId?'حفظ التعديل':'إضافة الكوبون'}</button>${alinEditingCouponId?'<button class="secondary" onclick="cancelCouponEdit()">إلغاء</button>':''}</div></form></article><article class="admin-v140-card"><div class="admin-v140-toolbar"><h3>قائمة الكوبونات</h3><input id="couponAdminSearch" placeholder="بحث بالكود" oninput="filterCoupons()"></div><div id="couponAdminList" class="admin-v140-list">${alinCouponRowsHtml(rows)}</div></article></div></section>`;
  if(alinEditingCouponId){
    const coupon = rows.find(row=>String(row.id)===String(alinEditingCouponId));
    if(coupon){
      document.getElementById('couponAdminCode').value = coupon.code || '';
      document.getElementById('couponAdminType').value = coupon.discount_type || 'percent';
      document.getElementById('couponAdminValue').value = coupon.discount_value || 0;
      document.getElementById('couponAdminLimit').value = coupon.max_uses ?? coupon.usage_limit ?? 0;
      document.getElementById('couponAdminExpiry').value = String(coupon.expires_at || '').slice(0,10);
      document.getElementById('couponAdminApplies').value = coupon.applies_to || 'all';
      document.getElementById('couponAdminStatus').value = coupon.status || 'active';
    }
  }
}

function filterCoupons(){
  const queryText = String(document.getElementById('couponAdminSearch')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#couponAdminList .admin-v140-item').forEach(item=>{
    item.hidden = !String(item.dataset.search || '').toLowerCase().includes(queryText);
  });
}
async function copyCoupon(code){
  try{await navigator.clipboard.writeText(code); if(typeof window.toast==='function')window.toast('تم نسخ الكود')}
  catch(_){window.prompt('انسخ الكود',code)}
}
function editCoupon(id){
  alinEditingCouponId = id;
  renderCouponsAdmin();
  document.getElementById('adminContent')?.scrollIntoView({behavior:'smooth'});
}
function cancelCouponEdit(){
  alinEditingCouponId = null;
  renderCouponsAdmin();
}
async function saveCoupon(){
  if(alinCouponSaving) return;
  const button = document.getElementById('couponAdminSave');
  try{
    alinCouponSaving = true;
    if(button){button.disabled=true;button.textContent='جارٍ الحفظ...'}
    const codeInput = document.getElementById('couponAdminCode');
    const code = window.AlinCoupons.normalizeCode(codeInput?.value || '');
    const value = Number(document.getElementById('couponAdminValue')?.value || 0);
    if(codeInput) codeInput.value = code;
    if(!code || value <= 0) throw new Error('أكمل كود وقيمة الخصم');
    if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(code)) throw new Error('كود الخصم يقبل حروفًا وأرقامًا وشرطة فقط، بدون مسافات');
    let rows = alinCouponAdminRows();
    try{rows = await window.AlinCoupons.refresh()}catch(error){console.warn('[ALIN coupons] pre-save refresh failed',error)}
    if(alinCouponDuplicate(rows,code,alinEditingCouponId)) throw new Error(alinCouponDuplicateMessage());
    const payload = {
      code,
      discount_type: document.getElementById('couponAdminType')?.value || 'percent',
      discount_value: value,
      max_uses: Number(document.getElementById('couponAdminLimit')?.value || 0),
      usage_limit: Number(document.getElementById('couponAdminLimit')?.value || 0),
      expires_at: document.getElementById('couponAdminExpiry')?.value ? new Date(document.getElementById('couponAdminExpiry').value+'T23:59:59').toISOString() : null,
      applies_to: document.getElementById('couponAdminApplies')?.value || 'all',
      status: document.getElementById('couponAdminStatus')?.value || 'active',
    };
    const editedId = alinEditingCouponId;
    if(editedId) await window.update('coupons',payload,{id:editedId});
    else await window.insert('coupons',{id:window.uid('CP'),used_count:0,usage_count:0,...payload});
    if(typeof window.audit === 'function') await window.audit('coupon',(editedId?'تعديل':'إضافة')+' كوبون '+code);
    await window.AlinCoupons.refresh();
    alinEditingCouponId = null;
    renderCouponsAdmin();
    if(typeof window.toast === 'function') window.toast('تم حفظ الكوبون وظهر في القائمة');
  }catch(error){
    const message = String(error?.message || error || 'تعذر حفظ الكوبون');
    window.alert(/coupons_code_key|duplicate key|23505/i.test(message) ? alinCouponDuplicateMessage() : message);
  }finally{
    alinCouponSaving = false;
    if(button && document.body.contains(button)){
      button.disabled = false;
      button.textContent = alinEditingCouponId ? 'حفظ التعديل' : 'إضافة الكوبون';
    }
  }
}
async function toggleCoupon(id,status){
  try{
    await window.update('coupons',{status},{id});
    await window.AlinCoupons.refresh();
    renderCouponsAdmin();
  }catch(error){window.alert(error?.message || 'تعذر تحديث الكوبون')}
}
async function deleteCoupon(id){
  if(!window.confirm('حذف الكوبون؟')) return;
  try{
    await window.removeRow('coupons',{id});
    await window.AlinCoupons.refresh();
    renderCouponsAdmin();
    if(typeof window.toast === 'function') window.toast('تم حذف الكوبون');
  }catch(error){window.alert(error?.message || 'تعذر حذف الكوبون')}
}

window.renderCouponsAdmin = renderCouponsAdmin;
window.filterCoupons = filterCoupons;
window.copyCoupon = copyCoupon;
window.editCoupon = editCoupon;
window.cancelCouponEdit = cancelCouponEdit;
window.saveCoupon = saveCoupon;
window.toggleCoupon = toggleCoupon;
window.deleteCoupon = deleteCoupon;
