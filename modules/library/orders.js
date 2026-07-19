// Alin module: library/orders.js | v2.0.3
/* ===== library/js/orders.js ===== */
/* V111: actual library code moved from core/js/platform-legacy.js */
window.AlinLibraryModules=window.AlinLibraryModules||{};
async function libraryOrderStatus(id,status){const o=db.orders.find(x=>x.id===id);const h=[...(o?.status_history||[]),{status,at:new Date().toISOString()}];await update('orders',{status,status_history:h},{id});await audit('order','المكتبة حدثت '+id+' إلى '+status);await load()}

libraryOrderStatus=async function(id,status){
  const o=db.orders.find(x=>x.id===id); if(!o)return;
  if(['processing','ready','completed'].includes(status)) await ensureOrderFinancials(o);
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h},{id});
  await audit('order','المكتبة حدثت '+id+' إلى '+status);
  await load();
};

libraryOrderStatus=async function(id,status){
  const o=db.orders.find(x=>x.id===id); if(!o)return;
  const h=[...(o.status_history||[]),{status,at:new Date().toISOString()}];
  await update('orders',{status,status_history:h},{id});
  o.status=status; o.status_history=h;
  if(status==='completed') await ensureOrderFinancials(o);
  await audit('order','المكتبة غيرت حالة الطلب '+(o.order_number||id)+' إلى '+status); await load(); renderLibrary();
};

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

function selectedLibraryLine(){ const lib=db.accounts.libraries.find(x=>x.id===libSelect?.value); if(!lib){libInfo.innerHTML='';return;} libInfo.innerHTML=`<div class="library-one-line"><b>${esc(lib.name)}</b><span class="${libIsOpen(lib)?'open-badge':'closed-badge'}">${libIsOpen(lib)?'مفتوح':'مغلق'}</span><small>${esc(lib.area||'')} ${lib.landmark?'— '+esc(lib.landmark):''}</small></div>`; }

function alinLibraryOptions(){
  return alinOpenLibraries().map(x=>`<option value="${x.id}" ${alinLibOpen(x)?'':'disabled'}>${esc(x.name)} - ${alinLibOpen(x)?'مفتوح':'مغلق'}</option>`).join('');
}
window.AlinLibraryModules['libraryOrderStatus']=typeof libraryOrderStatus==='function'?libraryOrderStatus:window['libraryOrderStatus'];window['libraryOrderStatus']=window.AlinLibraryModules['libraryOrderStatus'];
window.AlinLibraryModules['openLibraryBookletPdf']=typeof openLibraryBookletPdf==='function'?openLibraryBookletPdf:window['openLibraryBookletPdf'];window['openLibraryBookletPdf']=window.AlinLibraryModules['openLibraryBookletPdf'];
window.AlinLibraryModules['selectedLibraryLine']=typeof selectedLibraryLine==='function'?selectedLibraryLine:window['selectedLibraryLine'];window['selectedLibraryLine']=window.AlinLibraryModules['selectedLibraryLine'];
window.AlinLibraryModules['alinLibraryOptions']=typeof alinLibraryOptions==='function'?alinLibraryOptions:window['alinLibraryOptions'];window['alinLibraryOptions']=window.AlinLibraryModules['alinLibraryOptions'];


;

