// === admin/orders.js ===
// Authoritative admin order management. No adminTab wrapping and no legacy fallbacks.
(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyText=v=>typeof window.money==='function'?window.money(v):Number(v||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const arr=v=>Array.isArray(v)?v:[];
  const now=()=>new Date().toISOString();
  const dbx=()=>window.db||{};
  const orders=()=>arr(dbx().orders);
  const libraries=()=>arr(dbx().accounts?.libraries);
  const couriers=()=>arr(dbx().accounts?.couriers).length?arr(dbx().accounts?.couriers):arr(dbx().couriers);
  const products=()=>arr(dbx().products);
  const statusLabels={
    pending:'قيد الانتظار',new:'جديد',pending_admin:'بانتظار الإدارة',payment_pending:'بانتظار الدفع',paid:'مدفوع',
    assigned:'محول للمندوب',accepted:'مقبول من المندوب',picked_up:'استلمه المندوب',out_for_delivery:'قيد التوصيل',out_delivery:'قيد التوصيل',
    processing:'قيد التجهيز',printing:'قيد الطباعة',ready:'جاهز',completed:'مكتمل',delivered:'تم التسليم',cancelled:'ملغي',rejected:'مرفوض',receipt_rejected:'وصل مرفوض'
  };
  const state={q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''};
  const metaKey='alin_admin_order_meta_v220';
  let busy=false;

  function normalizeArea(value){
    if(typeof window.alinNormalizeDeliveryArea==='function')return window.alinNormalizeDeliveryArea(value);
    return String(value||'').trim().replace(/\s+/g,' ').split(/[-–—]/)[0].trim().toLowerCase();
  }
  function courierAreas(c){
    let raw=c?.areas??c?.area_ids??c?.area??[];
    if(typeof raw==='string'){try{const parsed=JSON.parse(raw);raw=Array.isArray(parsed)?parsed:raw.split(/[,،|]/)}catch(_){raw=raw.split(/[,،|]/)}}
    return arr(raw).map(x=>typeof x==='object'?(x.name||x.area||x.id||''):x).map(x=>String(x).trim()).filter(Boolean);
  }
  function matchingCouriers(area){
    const target=normalizeArea(area);
    if(!target)return couriers().filter(c=>String(c.status||'active')!=='inactive');
    return couriers().filter(c=>String(c.status||'active')!=='inactive'&&courierAreas(c).some(a=>normalizeArea(a)===target));
  }
  function libraryName(id){return libraries().find(x=>String(x.id)===String(id))?.name||'غير محددة'}
  function courierName(id){return couriers().find(x=>String(x.id)===String(id))?.name||'غير معيّن'}
  function statusOf(o){return String(o?.status||o?.payment_status||'new')}
  function labelOf(value){const s=typeof value==='object'?statusOf(value):String(value||'new');return statusLabels[s]||s}
  function orderDate(o){const d=new Date(o?.created_at||o?.createdAt||Date.now());return Number.isNaN(d.getTime())?new Date(0):d}
  function dateText(o){const d=orderDate(o);return d.getTime()?d.toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'):'—'}
  function homeDelivery(o){return ['home_delivery','delivery','courier'].includes(String(o?.fulfillment_type||o?.delivery_type||''))}
  function metaLoad(){try{return JSON.parse(localStorage.getItem(metaKey)||'{}')}catch(_){return {}}}
  function metaSave(value){try{localStorage.setItem(metaKey,JSON.stringify(value))}catch(_){}}
  function orderMeta(id){return metaLoad()[String(id)]||{notes:[],history:[]}}
  function saveMeta(id,value){const all=metaLoad();all[String(id)]=value;metaSave(all)}
  function addHistory(id,action,details=''){
    const m=orderMeta(id);m.history=[...(m.history||[]),{at:now(),actor:window.current?.name||window.current?.username||'المدير',action,details}];saveMeta(id,m);
  }
  function notify(message,type='success'){
    if(typeof window.toast==='function')return window.toast(message);
    const old=document.querySelector('.alin-order-toast');if(old)old.remove();
    const el=document.createElement('div');el.className=`toast alin-order-toast ${type}`;el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2500);
  }
  function friendlyError(error){
    const text=String(error?.message||error||'');
    if(text.includes('orders_status_valid'))return 'حالة الطلب غير مسموحة في قاعدة البيانات.';
    if(text.includes('schema cache'))return 'قاعدة البيانات تحتاج تحديث المخطط ثم إعادة المحاولة.';
    if(text.includes('غير مسموح بتعديل الطلب'))return 'الحساب الحالي لا يملك صلاحية تعديل هذا الطلب.';
    if(text.includes('تم منع تعديل بيانات حساسة'))return 'تم منع تعديل حقول حساسة في الطلب.';
    return text||'تعذر تنفيذ العملية.';
  }
  function range(){
    const end=new Date();end.setHours(23,59,59,999);const start=new Date(end);start.setHours(0,0,0,0);
    if(state.period==='today')return[start,end];
    if(state.period==='week'){start.setDate(start.getDate()-6);return[start,end]}
    if(state.period==='month'){start.setDate(1);return[start,end]}
    if(state.period==='custom')return[state.from?new Date(state.from+'T00:00:00'):null,state.to?new Date(state.to+'T23:59:59'):null];
    return[null,null];
  }
  function filtered(){
    const q=state.q.trim().toLowerCase(),[from,to]=range();
    return orders().filter(o=>{
      const d=orderDate(o),hay=[o.order_number,o.id,o.title,o.student_name,o.student_phone,libraryName(o.library_id||o.pickup_library_id),courierName(o.courier_id||o.delegate_id),o.delivery_area,o.delivery_landmark].join(' ').toLowerCase();
      return(!q||hay.includes(q))&&(!state.status||statusOf(o)===state.status)&&(!state.library||String(o.library_id||o.pickup_library_id||'')===state.library)&&(!state.courier||String(o.courier_id||o.delegate_id||'')===state.courier)&&(!state.kind||String(o.kind||'')===state.kind)&&(!from||d>=from)&&(!to||d<=to);
    }).sort((a,b)=>orderDate(b)-orderDate(a));
  }
  function overdue(o){return !['ready','completed','delivered','cancelled','rejected'].includes(statusOf(o))&&Date.now()-orderDate(o).getTime()>86400000}
  function markTab(){
    window.activeAdminTab='orders';
    if(typeof window.markAdminTab==='function')window.markAdminTab('orders');
    document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/adminTab\('([^']+)'\)/);b.classList.toggle('active-admin-tab',m?.[1]==='orders')});
  }
  function render(){
    const content=$('adminContent');if(!content)return;
    markTab();if(typeof window.adminStatsRender==='function')window.adminStatsRender();
    const all=orders(),list=filtered(),count=s=>all.filter(o=>statusOf(o)===s).length;
    const revenue=all.filter(o=>['completed','delivered'].includes(statusOf(o))).reduce((a,o)=>a+Number(o.total||0),0);
    content.dataset.adminModule='orders';
    content.innerHTML=`<section class="admin-orders-v126"><header class="admin-orders-v126-head"><div><h2>إدارة الطلبات</h2><p>متابعة الطلب من إنشائه إلى التحويل والتسليم.</p></div><div class="admin-orders-v126-head-actions"><button type="button" class="secondary" onclick="adminOrdersExport()">تصدير Excel</button><span>${list.length}</span></div></header>
    <section class="admin-orders-v126-stats"><article><small>كل الطلبات</small><strong>${all.length}</strong></article><article><small>جديدة</small><strong>${count('new')+count('pending_admin')}</strong></article><article><small>قيد التنفيذ</small><strong>${count('processing')+count('printing')+count('assigned')+count('accepted')+count('picked_up')+count('out_for_delivery')}</strong></article><article><small>متأخرة</small><strong>${all.filter(overdue).length}</strong></article><article><small>المبيعات المكتملة</small><strong>${moneyText(revenue)} د.ع</strong></article></section>
    <section class="admin-orders-v126-tools"><input id="adminOrderSearch" value="${esc(state.q)}" placeholder="رقم الطلب، اسم الطالب أو الهاتف"><select id="adminOrderStatus"><option value="">كل الحالات</option>${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${state.status===k?'selected':''}>${v}</option>`).join('')}</select><select id="adminOrderLibrary"><option value="">كل المكتبات</option>${libraries().map(x=>`<option value="${esc(x.id)}" ${state.library===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select><select id="adminOrderCourier"><option value="">كل المندوبين</option>${couriers().map(x=>`<option value="${esc(x.id)}" ${state.courier===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select><select id="adminOrderKind"><option value="">كل الأنواع</option><option value="booklet" ${state.kind==='booklet'?'selected':''}>ملازم</option><option value="stationery" ${state.kind==='stationery'?'selected':''}>قرطاسية</option><option value="gift" ${state.kind==='gift'?'selected':''}>هدايا</option><option value="product" ${state.kind==='product'?'selected':''}>منتج</option></select><select id="adminOrderPeriod"><option value="all" ${state.period==='all'?'selected':''}>كل التواريخ</option><option value="today" ${state.period==='today'?'selected':''}>اليوم</option><option value="week" ${state.period==='week'?'selected':''}>آخر 7 أيام</option><option value="month" ${state.period==='month'?'selected':''}>هذا الشهر</option><option value="custom" ${state.period==='custom'?'selected':''}>فترة مخصصة</option></select><input id="adminOrderFrom" type="date" value="${esc(state.from)}" ${state.period==='custom'?'':'hidden'}><input id="adminOrderTo" type="date" value="${esc(state.to)}" ${state.period==='custom'?'':'hidden'}><button type="button" onclick="adminOrdersClear()">مسح</button></section>
    <section class="admin-orders-v126-list">${list.length?list.map(orderCard).join(''):'<div class="admin-orders-v126-empty">لا توجد طلبات مطابقة.</div>'}</section></section>`;
    bind();
  }
  function orderCard(o){
    const st=statusOf(o),late=overdue(o),m=orderMeta(o.id),assigned=o.courier_id||o.delegate_id;
    return `<article class="admin-order-v126 ${late?'is-overdue':''}"><div class="admin-order-v126-main"><div class="admin-order-v126-title"><span>${esc(o.order_number||o.id)}</span><b>${esc(o.title||'طلب')} × ${Number(o.qty||1)}</b>${late?'<em>متأخر</em>':''}</div><small>${esc(o.student_name||'بدون اسم')} • ${esc(o.student_phone||'بدون هاتف')}</small></div><div class="admin-order-v126-meta"><span>المبلغ <b>${moneyText(o.total||0)} د.ع</b></span><span>${homeDelivery(o)?'المنطقة':'المكتبة'} <b>${esc(homeDelivery(o)?(normalizeArea(o.delivery_area)||'غير محددة'):libraryName(o.library_id||o.pickup_library_id))}</b></span><span>المندوب <b>${esc(courierName(assigned))}</b></span></div><div class="admin-order-v126-state"><span class="pill ${esc(st)}">${esc(labelOf(st))}</span><small>${esc(dateText(o))}</small>${(m.notes||[]).length?`<small>ملاحظات الإدارة: ${(m.notes||[]).length}</small>`:''}</div><div class="admin-order-v126-actions"><button class="secondary" onclick="adminOrderDetails('${esc(o.id)}')">تفاصيل</button><button class="secondary" onclick="adminOrderPrint('${esc(o.id)}')">وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrderWhatsapp('${esc(o.id)}')">واتساب</button>`:''}</div></article>`;
  }
  function bind(){
    const map={adminOrderSearch:['q','input'],adminOrderStatus:['status','change'],adminOrderLibrary:['library','change'],adminOrderCourier:['courier','change'],adminOrderKind:['kind','change'],adminOrderPeriod:['period','change'],adminOrderFrom:['from','change'],adminOrderTo:['to','change']};
    Object.entries(map).forEach(([id,[key,event]])=>{const el=$(id);if(el)el.addEventListener(event,()=>{state[key]=el.value;render()})});
  }
  async function updateOrder(id,patch){
    if(busy)throw new Error('العملية قيد التنفيذ');busy=true;
    try{
      if(typeof window.update!=='function')throw new Error('دالة تحديث الطلب غير متاحة');
      await window.update('orders',{...patch,updated_at:now()},{id});
      if(typeof window.load==='function')await window.load();
    }finally{busy=false}
  }
  function statusPatch(order,status,reason=''){
    const history=[...arr(order.status_history),{status,at:now(),by:window.current?.name||window.current?.username||'المدير'}];
    const patch={status,status_history:history};
    if(status==='cancelled'){patch.assignment_status='cancelled';patch.cancelled_at=now();patch.cancellation_reason=reason||null}
    if(status==='assigned'){patch.assignment_status='assigned';patch.assigned_at=order.assigned_at||now()}
    if(status==='accepted'){patch.assignment_status='accepted';patch.accepted_at=now()}
    if(status==='picked_up')patch.picked_up_at=now();
    if(status==='out_for_delivery')patch.out_for_delivery_at=now();
    if(status==='completed'||status==='delivered'){patch.assignment_status='completed';patch.completed_at=now();patch.delivered_at=now()}
    return patch;
  }
  async function changeStatus(id,status,reason=''){
    const order=orders().find(x=>String(x.id)===String(id));if(!order)return alert('الطلب غير موجود');
    try{
      if(!window.AlinFinance?.transitionOrder)throw new Error('خدمة الانتقال الذري غير جاهزة');
      await window.AlinFinance.transitionOrder(id,status,reason);
      addHistory(id,'تغيير الحالة',`${labelOf(status)}${reason?' — '+reason:''}`);
      if(typeof window.audit==='function')await window.audit('order',`تحديث الطلب ${order.order_number||id} إلى ${status}${reason?' بسبب: '+reason:''}`);
      if((status==='completed'||status==='delivered')&&window.AlinNotifications?.send)await window.AlinNotifications.send({role:'admin',title:'طلب مسلّم',message:`تم تسليم الطلب ${order.order_number||id}`});
      render();notify('تم تحديث حالة الطلب والحسابات');
    }catch(error){alert('تعذر تحديث الطلب: '+friendlyError(error))}
  }
  async function assign(id){
    const order=orders().find(x=>String(x.id)===String(id));if(!order)return;
    const libraryId=$('v220AssignLibrary')?.value||null,courierId=$('v220AssignCourier')?.value||null;
    if(homeDelivery(order)&&!courierId)return alert('اختر مندوبًا مطابقًا للمنطقة');
    try{
      const patch={library_id:libraryId,pickup_library_id:libraryId,courier_id:courierId,delegate_id:courierId};
      if(courierId){Object.assign(patch,statusPatch(order,'assigned'))}else{patch.assignment_status='pending_admin';patch.assigned_at=null}
      await updateOrder(id,patch);
      addHistory(id,'تعيين الطلب',`المكتبة: ${libraryName(libraryId)}، المندوب: ${courierName(courierId)}`);
      if(typeof window.audit==='function')await window.audit('order',`تعيين الطلب ${order.order_number||id}`);
      render();details(id);notify('تم حفظ التعيين');
    }catch(error){alert('تعذر حفظ التعيين: '+friendlyError(error))}
  }
  function details(id){
    const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const m=orderMeta(id),matches=homeDelivery(o)?matchingCouriers(o.delivery_area):couriers(),assigned=String(o.courier_id||o.delegate_id||'');
    if(assigned&&!matches.some(c=>String(c.id)===assigned)){const current=couriers().find(c=>String(c.id)===assigned);if(current)matches.unshift(current)}
    let modal=$('adminOrderDetailsModal');if(!modal){modal=document.createElement('div');modal.id='adminOrderDetailsModal';modal.className='modal hidden';modal.innerHTML='<div class="modal-card"><button class="x" onclick="document.getElementById(\'adminOrderDetailsModal\').classList.add(\'hidden\')">×</button><div id="adminOrderDetailsBox"></div></div>';document.body.appendChild(modal)}
    $('adminOrderDetailsBox').innerHTML=`<div class="v126-detail-head"><div><small>رقم الطلب</small><h2>${esc(o.order_number||o.id)}</h2></div><span class="pill ${esc(statusOf(o))}">${esc(labelOf(o))}</span></div><section class="v126-detail-grid"><div><small>الطالب</small><b>${esc(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${esc(o.student_phone||'—')}</b></div><div><small>العنصر</small><b>${esc(o.title||'—')}</b></div><div><small>الكمية</small><b>${Number(o.qty||1)}</b></div><div><small>المجموع الفرعي</small><b>${moneyText(Number(o.total||0)+Number(o.discount||0)-Number(o.delivery_fee||0))} د.ع</b></div><div><small>الخصم</small><b>${moneyText(o.discount||0)} د.ع</b></div><div><small>أجرة التوصيل</small><b>${moneyText(o.delivery_fee||0)} د.ع</b></div><div><small>الإجمالي</small><b>${moneyText(o.total||0)} د.ع</b></div><div><small>طريقة الاستلام</small><b>${homeDelivery(o)?'عن طريق المندوب':'استلام من المكتبة'}</b></div><div><small>المنطقة</small><b>${esc(normalizeArea(o.delivery_area)||'—')}</b></div><div><small>أقرب نقطة دالة</small><b>${esc(o.delivery_landmark||'—')}</b></div><div><small>ملاحظات الطالب</small><b>${esc(o.notes||'—')}</b></div></section><section class="v126-assign"><h3>تعيين الطلب</h3><select id="v220AssignLibrary" ${homeDelivery(o)?'disabled':''}><option value="">بدون مكتبة</option>${libraries().map(x=>`<option value="${esc(x.id)}" ${String(o.library_id||o.pickup_library_id||'')===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select><select id="v220AssignCourier" ${homeDelivery(o)?'':'disabled'}><option value="">بدون مندوب</option>${matches.map(x=>`<option value="${esc(x.id)}" ${assigned===String(x.id)?'selected':''}>${esc(x.name)}${courierAreas(x).length?' — '+esc(courierAreas(x).join('، ')):''}</option>`).join('')}</select><button onclick="adminOrderAssign('${esc(o.id)}')">حفظ التعيين</button>${homeDelivery(o)?`<small>المندوبون المطابقون لمنطقة ${esc(normalizeArea(o.delivery_area)||'غير محددة')}: ${matches.length}</small>`:''}</section><section class="v126-notes"><h3>ملاحظات الإدارة</h3><div class="v126-note-form"><textarea id="v220AdminNote" placeholder="اكتب ملاحظة داخلية على الطلب"></textarea><button onclick="adminOrderAddNote('${esc(o.id)}')">إضافة</button></div>${arr(m.notes).slice().reverse().map(n=>`<article><b>${esc(n.actor||'المدير')}</b><small>${esc(new Date(n.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'))}</small><p>${esc(n.text)}</p></article>`).join('')||'<p class="muted">لا توجد ملاحظات إدارية.</p>'}</section><section class="v126-history"><h3>سجل حركة الطلب</h3>${[...arr(o.status_history).map(h=>({at:h.at,actor:h.by||'النظام',action:'حالة الطلب',details:labelOf(h.status)})),...arr(m.history)].sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).map(h=>`<article><b>${esc(h.action)}</b><span>${esc(h.actor||'المدير')}</span><small>${esc(h.at?new Date(h.at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ'):'—')}</small><p>${esc(h.details||'')}</p></article>`).join('')||'<p class="muted">لا توجد حركة مسجلة بعد.</p>'}</section><div class="v126-detail-actions"><button onclick="adminOrderStatus('${esc(o.id)}','processing')">قيد التجهيز</button><button onclick="adminOrderStatus('${esc(o.id)}','ready')">جاهز</button><button onclick="adminOrderStatus('${esc(o.id)}','completed')">مكتمل</button><button class="secondary" onclick="adminOrderPrint('${esc(o.id)}')">طباعة وصل</button>${o.student_phone?`<button class="whatsapp" onclick="adminOrderWhatsapp('${esc(o.id)}')">واتساب</button>`:''}<button class="danger" onclick="adminOrderCancel('${esc(o.id)}')">إلغاء مع سبب</button></div>`;
    modal.classList.remove('hidden');
  }
  function printOrder(id){
    const o=orders().find(x=>String(x.id)===String(id));if(!o)return;const w=window.open('','_blank','width=760,height=900');if(!w)return alert('اسمح بالنوافذ المنبثقة للطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>وصل طلب ${esc(o.order_number||o.id)}</title><style>body{font-family:Tahoma;padding:36px;color:#102b50}.receipt{max-width:680px;margin:auto;border:1px solid #dbe3ed;border-radius:24px;padding:28px}.brand{text-align:center;border-bottom:2px solid #d9a72d;padding-bottom:16px}.row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px dashed #dbe3ed}.total{font-size:22px;font-weight:bold;color:#96680f}.note{margin-top:20px;color:#667085;text-align:center}@media print{button{display:none}}</style></head><body><div class="receipt"><div class="brand"><h1>منصة آلين</h1><p>وصل طلب</p></div><div class="row"><span>رقم الطلب</span><b>${esc(o.order_number||o.id)}</b></div><div class="row"><span>الطالب</span><b>${esc(o.student_name||'—')}</b></div><div class="row"><span>الهاتف</span><b>${esc(o.student_phone||'—')}</b></div><div class="row"><span>العنصر</span><b>${esc(o.title||'—')} × ${Number(o.qty||1)}</b></div><div class="row"><span>المنطقة/المكتبة</span><b>${esc(homeDelivery(o)?(normalizeArea(o.delivery_area)||'—'):libraryName(o.library_id||o.pickup_library_id))}</b></div><div class="row"><span>المندوب</span><b>${esc(courierName(o.courier_id||o.delegate_id))}</b></div><div class="row"><span>الخصم</span><b>${moneyText(o.discount||0)} د.ع</b></div><div class="row"><span>أجرة التوصيل</span><b>${moneyText(o.delivery_fee||0)} د.ع</b></div><div class="row"><span>الحالة</span><b>${esc(labelOf(o))}</b></div><div class="row total"><span>الإجمالي</span><b>${moneyText(o.total||0)} د.ع</b></div><p class="note">تاريخ الطباعة: ${new Date().toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')}</p><button onclick="print()">طباعة</button></div></body></html>`);w.document.close();w.focus();
  }

  window.renderOrdersAdmin=render;
  window.adminOrdersClear=()=>{Object.assign(state,{q:'',status:'',library:'',courier:'',kind:'',period:'all',from:'',to:''});render()};
  window.adminOrderStatus=changeStatus;
  window.orderStatus=changeStatus;
  window.adminOrderAssign=assign;
  window.adminOrderDetails=details;
  window.adminOrderAddNote=id=>{const input=$('v220AdminNote'),text=input?.value.trim();if(!text)return alert('اكتب الملاحظة أولاً');const m=orderMeta(id);m.notes=[...arr(m.notes),{at:now(),actor:window.current?.name||'المدير',text}];saveMeta(id,m);addHistory(id,'ملاحظة إدارية',text);details(id)};
  window.adminOrderCancel=id=>{const reason=prompt('اكتب سبب إلغاء الطلب:');if(reason===null)return;if(!reason.trim())return alert('سبب الإلغاء مطلوب');changeStatus(id,'cancelled',reason.trim());$('adminOrderDetailsModal')?.classList.add('hidden')};
  window.adminOrderWhatsapp=id=>{const o=orders().find(x=>String(x.id)===String(id));if(!o?.student_phone)return alert('لا يوجد رقم هاتف');let phone=String(o.student_phone).replace(/\D/g,'');if(phone.startsWith('0'))phone='964'+phone.slice(1);const text=encodeURIComponent(`مرحباً ${o.student_name||''}، بخصوص طلبك رقم ${o.order_number||o.id} في منصة آلين، حالته الحالية: ${labelOf(o)}.`);window.open(`https://wa.me/${phone}?text=${text}`,'_blank','noopener')};
  window.adminOrderPrint=printOrder;
  window.adminOrdersExport=()=>{const rows=[['رقم الطلب','الطالب','الهاتف','العنصر','الكمية','الإجمالي','الخصم','أجرة التوصيل','الحالة','المكتبة','المندوب','المنطقة','التاريخ'],...filtered().map(o=>[o.order_number||o.id,o.student_name||'',o.student_phone||'',o.title||'',o.qty||1,o.total||0,o.discount||0,o.delivery_fee||0,labelOf(o),libraryName(o.library_id||o.pickup_library_id),courierName(o.courier_id||o.delegate_id),normalizeArea(o.delivery_area),dateText(o)])];const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`alin-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),250)};
})();
