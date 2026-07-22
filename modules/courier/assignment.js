// === courier/assignment.js ===
/* ALIN v2.4.2 — delivery order assignment and admin workflow only. */
(function(){
  'use strict';
  const core=window.AlinCourierCore;if(!core)throw new Error('AlinCourierCore is required before courier/assignment.js');
  const {$,escv,moneyv,notify,now,allOrders,active,done,matchingCouriers,allCouriers,mapLink,orderState,statusLabel,statusOf,activeLoad,workflowValues,friendlyOrderError}=core;
  function deliveryOrders(){return allOrders().filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area)}
  function renderDeliveryOrdersAdmin(){const rows=deliveryOrders();adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>توزيع الطلبات</small><h2>طلبات التوصيل</h2><p>اختيار المندوب حسب المنطقة مع عرض الطالب ونقطة الدلالة والموقع.</p></div><button onclick="renderCouriersAdmin()">إدارة المندوبين</button></header><section class="v164-admin-metrics"><article><small>كل طلبات التوصيل</small><strong>${rows.length}</strong></article><article><small>بانتظار التعيين</small><strong>${rows.filter(o=>!o.courier_id&&!o.delegate_id).length}</strong></article><article><small>قيد التوصيل</small><strong>${rows.filter(o=>active(o)&&(o.courier_id||o.delegate_id)).length}</strong></article><article><small>مكتملة</small><strong>${rows.filter(done).length}</strong></article></section><div class="v164-delivery-admin-list">${rows.map(deliveryAdminCard).join('')||'<div class="empty">لا توجد طلبات توصيل.</div>'}</div></section>`}
  function deliveryAdminCard(o){const area=window.alinNormalizeDeliveryArea(o.delivery_area)||'غير محددة',matches=matchingCouriers(area),assigned=allCouriers().find(c=>String(c.id)===String(o.courier_id||o.delegate_id||'')),map=mapLink(o);return `<article class="v164-delivery-admin-card"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span>${escv(area)}</span></header>${o.delivery_note?`<div class="v164-issue">ملاحظة المندوب: ${escv(o.delivery_note)}</div>`:''}<div class="v164-order-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(o.student_phone||'—')}</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div><div><small>المبلغ</small><b>${moneyv(o.total)} د.ع</b></div><div><small>الحالة</small><b>${escv(orderState(o.status))}</b></div></div>${map?`<a class="v164-map-btn" href="${escv(map)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`:''}<div class="v164-match-list"><h4>المندوبون المطابقون للمنطقة (${matches.length})</h4>${matches.map(c=>`<label><input type="radio" name="v216assign_${escv(o.id)}" value="${escv(c.id)}" ${assigned&&String(assigned.id)===String(c.id)?'checked':''}><span><b>${escv(c.name)}</b><small>${statusLabel(statusOf(c))} • ${activeLoad(c)} طلب حالي • ${escv(c.phone||'')}</small></span></label>`).join('')||'<p class="warning-text">لا يوجد مندوب مرتبط بهذه المنطقة.</p>'}</div><footer><button ${!matches.length?'disabled':''} onclick="alinV164Assign('${escv(o.id)}')">${assigned?'إعادة تحويل':'تحويل للمندوب'}</button>${assigned?`<span>المندوب الحالي: <b>${escv(assigned.name)}</b></span>`:'<span>لم يتم تعيين مندوب</span>'}</footer></article>`}
  window.alinV164Assign=async function(id){
    const selected=document.querySelector(`input[name="v216assign_${CSS.escape(String(id))}"]:checked`)?.value;
    if(!selected)return notify('اختر مندوباً أولاً');
    try{
      await update('orders',{courier_id:selected,delegate_id:selected,...workflowValues('assigned'),delivery_note:null},{id});
      if(typeof audit==='function')await audit('courier',`تحويل الطلب ${id} إلى المندوب ${selected}`);
      if(typeof load==='function')await load();
      renderDeliveryOrdersAdmin();
      notify('تم تحويل الطلب للمندوب');
      return true;
    }catch(error){console.error('[ALIN assign courier]',error);notify(friendlyOrderError(error));return false}
  };
  window.alinV161AssignOrder=window.alinV164Assign;
  async function assignCourier(id){
    const selected=$(`#assign_${CSS.escape(String(id))}`)?.value||null;
    try{
      const values=selected?{courier_id:selected,delegate_id:selected,...workflowValues('assigned')}:{courier_id:null,delegate_id:null,assignment_status:'pending_admin',status:'pending_admin',assigned_at:null,updated_at:now()};
      await update('orders',values,{id});
      if(typeof load==='function')await load();
      if(typeof renderCourierSettlementsAdmin==='function')renderCourierSettlementsAdmin();
      return true;
    }catch(error){console.error('[ALIN assign courier legacy screen]',error);notify(friendlyOrderError(error));return false}
  }
  async function courierOrderStatus(id,status){
    try{
      await update('orders',workflowValues(status),{id});
      if(typeof load==='function')await load();
      if(typeof renderCourierSettlementsAdmin==='function')renderCourierSettlementsAdmin();
      return true;
    }catch(error){console.error('[ALIN courier status admin]',error);notify(friendlyOrderError(error));return false}
  }


  window.renderDeliveryOrdersAdmin=renderDeliveryOrdersAdmin;
  window.assignCourier=assignCourier;
  window.courierOrderStatus=courierOrderStatus;
  Object.assign(window.AlinCourierModules,{assignCourier,courierOrderStatus,renderDeliveryOrdersAdmin});
  window.AlinAdminModules?.register?.('deliveryOrders',renderDeliveryOrdersAdmin);
})();

;
