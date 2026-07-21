// === courier/finance.js ===
/* ===== courier/js/settlements.js ===== */
/* V111: actual courier code moved from core/js/platform-legacy.js */
window.AlinCourierModules=window.AlinCourierModules||{};
function renderCourierSettlementsAdmin(){
  const deliveryOrders=(db.orders||[]).filter(o=>o.fulfillment_type==='home_delivery');
  adminContent.innerHTML='<h2>تسويات المندوبين</h2><p class="muted">المندوب يستلم مبلغ الطلب من الطالب عند التسليم، ثم يسلم المبلغ للإدارة بسند قبض.</p>'+deliveryOrders.map(o=>`<div class="row"><div><b>${esc(o.order_number||o.id)} — ${esc(o.title)}</b><small>الطالب: ${esc(o.student_name)} • المنطقة: ${esc(o.delivery_area||'')} • أقرب نقطة: ${esc(o.delivery_landmark||'')} • المبلغ ${money(o.total)} د.ع • الحالة ${esc(o.status||'')}</small></div><div class="row-actions"><select id="assign_${o.id}"><option value="">مندوب</option>${couriers.map(c=>`<option value="${c.id}" ${o.courier_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button onclick="assignCourier('${o.id}')">حفظ</button><button onclick="courierOrderStatus('${o.id}','out_for_delivery')">قيد التوصيل</button><button onclick="courierOrderStatus('${o.id}','completed')">تم التسليم</button></div></div>`).join('')+(deliveryOrders.length?'':'لا توجد طلبات توصيل')+'<h3>سندات تسوية المندوبين</h3>'+(courierSettlements.map(s=>`<div class="row"><b>${esc(s.receipt_number)}</b><span>${money(s.amount)} د.ع</span></div>`).join('')||emptyState('لا توجد تسويات'));
}

async function recordCourierSettlementForOrder(orderId){
  const o=(db.orders||[]).find(x=>x.id===orderId); if(!o)return;
  const amount=+(prompt('مبلغ تسوية المندوب', String(o.total||0))||0); if(amount<=0)return alert('المبلغ غير صحيح');
  const method=prompt('طريقة التسوية','نقدي')||'نقدي';
  const receipt='CR-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  await insert('courier_settlements',{id:uid('CS'),receipt_number:receipt,courier_id:o.courier_id||'',amount,payment_method:method,note:'تسوية طلب '+(o.order_number||o.id),status:'received'});
  await audit('courier','تسوية مندوب للطلب '+(o.order_number||o.id)); await load(); renderCourierSettlementsAdmin();
}
window.AlinCourierModules['renderCourierSettlementsAdmin']=typeof renderCourierSettlementsAdmin==='function'?renderCourierSettlementsAdmin:window['renderCourierSettlementsAdmin'];window['renderCourierSettlementsAdmin']=window.AlinCourierModules['renderCourierSettlementsAdmin'];
window.AlinCourierModules['recordCourierSettlementForOrder']=typeof recordCourierSettlementForOrder==='function'?recordCourierSettlementForOrder:window['recordCourierSettlementForOrder'];window['recordCourierSettlementForOrder']=window.AlinCourierModules['recordCourierSettlementForOrder'];


;
