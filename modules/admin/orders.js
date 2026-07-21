// === admin/orders.js ===
/* ===== admin/js/admin-orders-v126.js ===== */
(function(){
  'use strict';
  const escv=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const statusLabels={new:'جديد',payment_pending:'بانتظار الدفع',paid:'مدفوع',processing:'قيد التجهيز',printing:'قيد الطباعة',ready:'جاهز',completed:'مكتمل',delivered:'تم التسليم',cancelled:'ملغي'};
  const state={q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''};
  const storeKey='alin_admin_order_meta_v126';
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const libraries=()=>Array.isArray(window.db?.accounts?.libraries)?window.db.accounts.libraries:[];
  const couriers=()=>Array.isArray(window.db?.accounts?.couriers)?window.db.accounts.couriers:(Array.isArray(window.db?.couriers)?window.db.couriers:[]);
  const libName=id=>libraries().find(x=>String(x.id)===String(id))?.name||'غير محددة';
  const courierName=id=>couriers().find(x=>String(x.id)===String(id))?.name||'غير معيّن';
  const statusOf=o=>o.status||o.payment_status||'new';
  const labelOf=o=>statusLabels[statusOf(o)]||statusOf(o)||'غير محدد';
  const dateOf=o=>new Date(o.created_at||o.createdAt||Date.now());
  const dateText=o=>{const d=dateOf(o);return isNaN(d)?'—':d.toLocaleString('ar-IQ')};
  const metaLoad=()=>{try{return JSON.parse(localStorage.getItem(storeKey)||'{}')}catch(_){return {}}};
  const metaSave=x=>localStorage.setItem(storeKey,JSON.stringify(x));
  function orderMeta(id){return metaLoad()[String(id)]||{notes:[],history:[]}}
  function addMeta(id,patch){const all=metaLoad(),key=String(id),old=all[key]||{notes:[],history:[]};all[key]={...old,...patch};metaSave(all);return all[key]}
  function addHistory(id,action,details=''){
    const m=orderMeta(id),actor=(window.current?.name||window.current?.username||'المدير');
    m.history=[...(m.history||[]),{at:new Date().toISOString(),actor,action,details}];addMeta(id,m);
  }
  function range(){
    const now=new Date(),start=new Date(now),end=new Date(now);
    start.setHours(0,0,0,0);end.setHours(23,59,59,999);
    if(state.period==='today')return [start,end];
    if(state.period==='week'){start.setDate(start.getDate()-6);return [start,end]}
    if(state.period==='month'){start.setDate(1);return [start,end]}
    if(state.period==='custom'){
      const f=state.from?new Date(state.from+'T00:00:00'):null,t=state.to?new Date(state.to+'T23:59:59'):null;return [f,t]
    }
    return [null,null];
  }
  function filtered(){
    const q=state.q.trim().toLowerCase(),[from,to]=range();
    return orders().filter(o=>{
      const d=dateOf(o),hay=[o.order_number,o.id,o.title,o.student_name,o.student_phone,libName(o.library_id||o.pickup_library_id),courierName(o.courier_id),o.delivery_area,o.delivery_landmark].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!state.status||statusOf(o)===state.status)&&(!state.library||String(o.library_id||o.pickup_library_id||'')===state.library)&&(!state.courier||String(o.courier_id||'')===state.courier)&&(!state.kind||String(o.kind||'')===state.kind)&&(!from||d>=from)&&(!to||d<=to);
    }).sort((a,b)=>dateOf(b)-dateOf(a));
  }
  function overdue(o){const st=statusOf(o);return !['ready','completed','delivered','cancelled'].includes(st)&&Date.now()-dateOf(o).getTime()>24*60*60*1000}
  function render(){
    const content=document.getElementById('adminContent');if(!content)return;
    const all=orders(),list=filtered(),count=s=>all.filter(o=>statusOf(o)===s).length;
    const revenue=all.filter(o=>['completed','delivered'].includes(statusOf(o))).reduce((a,o)=>a+Number(o.total||0),0);
    content.innerHTML=`<section class="admin-orders-v126"><header class="admin-orders-v126-head"><div><h2>إدارة الطلبات</h2><p>متابعة كاملة للطلب، التعيين، السجل، الطباعة والتصدير.</p></div><div class="admin-orders-v126-head-actions"><button type="button" class="secondary" onclick="adminOrdersV126Export()">تصدير Excel</button><span>${list.length}</span></div></header>
    <section class="admin-orders-v126-stats"><article><small>كل الطلبات</small><strong>${all.length}</strong></article><article><small>جديدة</small><strong>${count('new')}</strong></article><article><small>قيد التنفيذ</small><strong>${count('processing')+count('printing')}</strong></article><article><small>متأخرة</small><strong>${all.filter(overdue).length}</strong></article><article><small>المبيعات المكتملة</small><strong>${moneyv(revenue)} د.ع</strong></article></section>
    <section class="admin-orders-v126-tools"><input id="adminOrderSearch" value="${escv(state.q)}" placeholder="رقم الطلب، اسم الطالب أو الهاتف"><select id="adminOrderStatus"><option value="">كل الحالات</option>${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${state.status===k?'selected':''}>${v}</option>`).join('')}</select><select id="adminOrderLibrary"><option value="">كل المكتبات</option>${libraries().map(x=>`<option value="${escv(x.id)}" ${state.library===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><select id="adminOrderCourier"><option value="">كل المندوبين</option>${couriers().map(x=>`<option value="${escv(x.id)}" ${state.courier===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><select id="adminOrderKind"><option value="">كل الأنواع</option><option value="booklet" ${state.kind==='booklet'?'selected':''}>ملازم</option><option value="stationery" ${state.kind==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.kind==='gift'?'selected':''}>هدايا</option><option value="product" ${state.kind==='product'?'selected':''}>منتج</option></select><select id="adminOrderPeriod"><option value="all" ${state.period==='all'?'selected':''}>كل التواريخ</option><option value="today" ${state.period==='today'?'selected':''}>اليوم</option><option value="week" ${state.period==='week'?'selected':''}>آخر 7 أيام</option><option value="month" ${state.period==='month'?'selected':''}>هذا الشهر</option><option value="custom" ${state.period==='custom'?'selected':''}>فترة مخصصة</option></select><input id="adminOrderFrom" type="date" value="${escv(state.from)}" ${state.period==='custom'?'':'hidden'}><input id="adminOrderTo" type="date" value="${escv(state.to)}" ${state.period==='custom'?'':'hidden'}><button type="button" onclick="adminOrdersV126Clear()">مسح</button></section>
    <section class="admin-orders-v126-list">${list.length?list.map(orderCard).join(''):'<div class="admin-orders-v126-empty">لا توجد طلبات مطابقة.</div>'}</section></section>`;
    bind();
  }
  function orderCard(o){
    const st=statusOf(o),late=overdue(o),m=orderMeta(o.id),notes=(m.notes||[]).length;
    return `<article class="admin-order-v126 ${late?'is-overdue':''}"><div class="admin-order-v126-main"><div class="admin-order-v126-title"><span>${escv(o.order_number||o.id)}</span><b>${escv(o.title||'طلب')} × ${Number(o.qty||1)}</b>${late?'<em>متأخر</em>':''}</div><small>${escv(o.student_name||'بدون اسم')} • ${escv(o.student_phone||'بدون هاتف')}</small></div><div class="admin-order-v126-meta"><span>المبلغ <b>${moneyv(o.total||0)} د.ع</b></span><span>المكتبة <b>${escv(libName(o.library_id||o.pickup_library_id))}</b></span><span>المندوب <b>${escv(courierName(o.courier_id))}</b></span></div><div class="admin-order-v126-state"><span class="pill ${escv(st)}">${escv(labelOf(o))}</span><small>${escv(dateText(o))}</small>${notes?`<small>ملاحظات الإدارة: ${notes}</small>`:''}</div><div class="admin-order-v126-actions"><button class="secondary" onclick="adminOrdersV126Details('${escv(o.id)}')">تفاصيل</button><button class="secondary" onclick="adminOrdersV126Print('${escv(o.id)}')">وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrdersV126Whatsapp('${escv(o.id)}')">واتساب</button>`:''}</div></article>`;
  }
  function bind(){
    const map={adminOrderSearch:['q','input'],adminOrderStatus:['status','change'],adminOrderLibrary:['library','change'],adminOrderCourier:['courier','change'],adminOrderKind:['kind','change'],adminOrderPeriod:['period','change'],adminOrderFrom:['from','change'],adminOrderTo:['to','change']};
    Object.entries(map).forEach(([id,[key,event]])=>{const el=document.getElementById(id);if(el)el.addEventListener(event,()=>{state[key]=el.value;render()})});
  }
  window.adminOrdersV126Clear=()=>{Object.assign(state,{q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''});render()};
  async function safeUpdate(id,patch){
    if(typeof update!=='function')throw new Error('دالة التحديث غير متاحة');
    try{await update('orders',patch,{id})}catch(e){
      const safe={};['status','library_id','pickup_library_id','courier_id'].forEach(k=>{if(k in patch)safe[k]=patch[k]});
      if(!Object.keys(safe).length)throw e;await update('orders',safe,{id});
    }
    if(typeof load==='function')await load();
  }
  window.adminOrdersV126Status=async(id,status,reason='')=>{try{await safeUpdate(id,{status,cancellation_reason:reason||null});addHistory(id,'تغيير الحالة',`${labelOf({status})}${reason?' — '+reason:''}`);if(typeof audit==='function')await audit('order',`تحديث الطلب ${id} إلى ${status}${reason?' بسبب: '+reason:''}`);render();if(typeof toast==='function')toast('تم تحديث حالة الطلب')}catch(e){alert('تعذر تحديث الطلب: '+e.message)}};
  window.adminOrdersV126Assign=async(id)=>{const lib=document.getElementById('v126AssignLibrary')?.value||null,courier=document.getElementById('v126AssignCourier')?.value||null;try{await safeUpdate(id,{library_id:lib,pickup_library_id:lib,courier_id:courier});addHistory(id,'تعيين الطلب',`المكتبة: ${libName(lib)}، المندوب: ${courierName(courier)}`);if(typeof audit==='function')await audit('order',`تعيين الطلب ${id}`);render();adminOrdersV126Details(id);if(typeof toast==='function')toast('تم حفظ التعيين')}catch(e){alert('تعذر حفظ التعيين: '+e.message)}};
  window.adminOrdersV126AddNote=id=>{const input=document.getElementById('v126AdminNote'),text=input?.value.trim();if(!text)return alert('اكتب الملاحظة أولاً');const m=orderMeta(id);m.notes=[...(m.notes||[]),{at:new Date().toISOString(),actor:window.current?.name||'المدير',text}];addMeta(id,m);addHistory(id,'ملاحظة إدارية',text);if(input)input.value='';adminOrdersV126Details(id)};
  window.adminOrdersV126Cancel=id=>{const reason=prompt('اكتب سبب إلغاء الطلب:');if(reason===null)return;if(!reason.trim())return alert('سبب الإلغاء مطلوب');adminOrdersV126Status(id,'cancelled',reason.trim());document.getElementById('adminOrderDetailsModal')?.classList.add('hidden')};
  window.adminOrdersV126Whatsapp=id=>{const o=orders().find(x=>String(x.id)===String(id));if(!o?.student_phone)return alert('لا يوجد رقم هاتف');let phone=String(o.student_phone).replace(/\D/g,'');if(phone.startsWith('0'))phone='964'+phone.slice(1);const text=encodeURIComponent(`مرحباً ${o.student_name||''}، بخصوص طلبك رقم ${o.order_number||o.id} في منصة آلين، حالته الحالية: ${labelOf(o)}.`);window.open(`https://wa.me/${phone}?text=${text}`,'_blank','noopener')};
  window.adminOrdersV126Print=id=>{const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const w=window.open('','_blank','width=760,height=900');if(!w)return alert('اسمح بالنوافذ المنبثقة للطباعة');w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>وصل طلب ${escv(o.order_number||o.id)}</title><style>body{font-family:Tahoma;padding:36px;color:#102b50}.receipt{max-width:680px;margin:auto;border:1px solid #dbe3ed;border-radius:24px;padding:28px}.brand{text-align:center;border-bottom:2px solid #d9a72d;padding-bottom:16px}.brand h1{margin:0}.row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px dashed #dbe3ed}.total{font-size:22px;font-weight:bold;color:#96680f}.note{margin-top:20px;color:#667085;text-align:center}@media print{button{display:none}}</style></head><body><div class="receipt"><div class="brand"><h1>منصة آلين</h1><p>وصل طلب</p></div><div class="row"><span>رقم الطلب</span><b>${escv(o.order_number||o.id)}</b></div><div class="row"><span>الطالب</span><b>${escv(o.student_name||'—')}</b></div><div class="row"><span>الهاتف</span><b>${escv(o.student_phone||'—')}</b></div><div class="row"><span>العنصر</span><b>${escv(o.title||'—')} × ${Number(o.qty||1)}</b></div><div class="row"><span>المكتبة</span><b>${escv(libName(o.library_id||o.pickup_library_id))}</b></div><div class="row"><span>المندوب</span><b>${escv(courierName(o.courier_id))}</b></div><div class="row"><span>الحالة</span><b>${escv(labelOf(o))}</b></div><div class="row total"><span>الإجمالي</span><b>${moneyv(o.total||0)} د.ع</b></div><p class="note">تاريخ الطباعة: ${new Date().toLocaleString('ar-IQ')}</p><button onclick="print()">طباعة</button></div></body></html>`);w.document.close();w.focus()};
  window.adminOrdersV126Export=()=>{const list=filtered(),rows=[['رقم الطلب','الطالب','الهاتف','العنصر','الكمية','الإجمالي','الحالة','المكتبة','المندوب','التاريخ'],...list.map(o=>[o.order_number||o.id,o.student_name||'',o.student_phone||'',o.title||'',o.qty||1,o.total||0,labelOf(o),libName(o.library_id||o.pickup_library_id),courierName(o.courier_id),dateText(o)])];const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`alin-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)};
  window.adminOrdersV126Details=id=>{
    const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const m=orderMeta(id);
    let modal=document.getElementById('adminOrderDetailsModal');if(!modal){modal=document.createElement('div');modal.id='adminOrderDetailsModal';modal.className='modal hidden';modal.innerHTML='<div class="modal-card"><button class="x" onclick="document.getElementById(\'adminOrderDetailsModal\').classList.add(\'hidden\')">×</button><div id="adminOrderDetailsBox"></div></div>';document.body.appendChild(modal)}
    const box=document.getElementById('adminOrderDetailsBox');
    box.innerHTML=`<div class="v126-detail-head"><div><small>رقم الطلب</small><h2>${escv(o.order_number||o.id)}</h2></div><span class="pill ${escv(statusOf(o))}">${escv(labelOf(o))}</span></div><section class="v126-detail-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(o.student_phone||'—')}</b></div><div><small>العنصر</small><b>${escv(o.title||'—')}</b></div><div><small>الكمية</small><b>${Number(o.qty||1)}</b></div><div><small>الإجمالي</small><b>${moneyv(o.total||0)} د.ع</b></div><div><small>طريقة الاستلام</small><b>${escv(o.fulfillment_type||o.delivery_type||'استلام من المكتبة')}</b></div><div><small>المنطقة</small><b>${escv(o.delivery_area||'—')}</b></div><div><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div><div><small>ملاحظات الطالب</small><b>${escv(o.notes||'—')}</b></div></section><section class="v126-assign"><h3>تعيين الطلب</h3><select id="v126AssignLibrary"><option value="">بدون مكتبة</option>${libraries().map(x=>`<option value="${escv(x.id)}" ${String(o.library_id||o.pickup_library_id||'')===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><select id="v126AssignCourier"><option value="">بدون مندوب</option>${couriers().map(x=>`<option value="${escv(x.id)}" ${String(o.courier_id||'')===String(x.id)?'selected':''}>${escv(x.name)}</option>`).join('')}</select><button onclick="adminOrdersV126Assign('${escv(o.id)}')">حفظ التعيين</button></section><section class="v126-notes"><h3>ملاحظات الإدارة</h3><div class="v126-note-form"><textarea id="v126AdminNote" placeholder="اكتب ملاحظة داخلية على الطلب"></textarea><button onclick="adminOrdersV126AddNote('${escv(o.id)}')">إضافة</button></div>${(m.notes||[]).slice().reverse().map(n=>`<article><b>${escv(n.actor||'المدير')}</b><small>${escv(new Date(n.at).toLocaleString('ar-IQ'))}</small><p>${escv(n.text)}</p></article>`).join('')||'<p class="muted">لا توجد ملاحظات إدارية.</p>'}</section><section class="v126-history"><h3>سجل حركة الطلب</h3>${(m.history||[]).slice().reverse().map(h=>`<article><b>${escv(h.action)}</b><span>${escv(h.actor||'المدير')}</span><small>${escv(new Date(h.at).toLocaleString('ar-IQ'))}</small><p>${escv(h.details||'')}</p></article>`).join('')||'<p class="muted">لا توجد حركة مسجلة بعد.</p>'}</section><div class="v126-detail-actions"><button onclick="adminOrdersV126Status('${escv(o.id)}','processing')">قيد التجهيز</button><button onclick="adminOrdersV126Status('${escv(o.id)}','ready')">جاهز</button><button onclick="adminOrdersV126Status('${escv(o.id)}','completed')">مكتمل</button><button class="secondary" onclick="adminOrdersV126Print('${escv(o.id)}')">طباعة وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrdersV126Whatsapp('${escv(o.id)}')">واتساب</button>`:''}<button class="danger" onclick="adminOrdersV126Cancel('${escv(o.id)}')">إلغاء مع سبب</button></div>`;
    modal.classList.remove('hidden');
  };
  const boot=()=>{window.renderOrdersAdmin=render;const oldTab=window.adminTab;if(typeof oldTab==='function'&&!oldTab.__v126){const wrapped=function(t){if(t==='orders'){if(typeof markAdminTab==='function')markAdminTab(t);if(typeof adminStatsRender==='function')adminStatsRender();return render()}return oldTab.apply(this,arguments)};wrapped.__v126=true;window.adminTab=wrapped}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;
