/* ALIN v2.0.9 — authoritative order finance and settlements runtime. */
(function(){
  'use strict';

  const arr=value=>Array.isArray(value)?value:[];
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const same=(a,b)=>String(a??'')===String(b??'');
  const now=()=>new Date().toISOString();
  const deliveredStatus=value=>['completed','delivered','done','received','تم التسليم'].includes(String(value||'').toLowerCase());
  const cancelledStatus=value=>['cancelled','canceled','rejected','ملغي','إلغاء'].some(x=>String(value||'').toLowerCase().includes(x));
  const db=()=>window.db||{};
  const money=value=>typeof window.money==='function'?window.money(value):Math.round(num(value)).toLocaleString('ar-IQ');
  const escapeHtml=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=(name)=>typeof window[name]==='function'?window[name]:null;

  function ratios(){
    const settings=db().settings||{};
    const clamp=value=>Math.max(0,Math.min(100,num(value)));
    return {
      admin:clamp(settings.admin_profit_percent ?? 20),
      teacher:clamp(settings.teacher_profit_percent ?? 50)
    };
  }

  function deliveryType(order){
    const value=String(order?.fulfillment_type||order?.delivery_type||order?.delivery_method||'').toLowerCase();
    if(/delegate|courier|مندوب/.test(value))return 'delegate';
    if(/library|pickup|مكتبة/.test(value))return 'library';
    return order?.library_id?'library':'delegate';
  }

  function bookletFor(order){
    return arr(db().booklets).find(booklet=>same(booklet.id,order?.item_id||order?.booklet_id))||null;
  }

  function shares(order){
    const total=Math.max(0,Math.round(num(order?.total)));
    const percentage=ratios();
    const admin=Math.min(total,Math.max(0,Math.round(total*percentage.admin/100)));
    const teacherRaw=order?.kind==='booklet'?Math.round(total*percentage.teacher/100):0;
    const teacher=Math.min(Math.max(0,total-admin),Math.max(0,teacherRaw));
    const remainder=Math.max(0,total-admin-teacher);
    const delivery=deliveryType(order);
    return {
      total,admin,teacher,
      library:delivery==='library'?remainder:0,
      delegate:delivery==='delegate'?remainder:0,
      delivery
    };
  }

  function orderForLedger(row){
    return arr(db().orders).find(order=>same(order.id,row?.order_id)||same(order.order_number,row?.order_number||row?.order_id))||null;
  }

  function canonicalLedger(){
    const map=new Map();
    for(const row of arr(db().ledger)){
      const order=orderForLedger(row);
      if(cancelledStatus(row?.settlement_status)||cancelledStatus(order?.status)||order?.settlement_cancelled)continue;
      if(order&&!deliveredStatus(order.status)&&!order.settlement_done)continue;
      const key=String(row?.order_id||row?.order_number||row?.id||'');
      if(!key)continue;
      const previous=map.get(key);
      const currentDate=String(row?.settled_at||row?.updated_at||row?.created_at||'');
      const previousDate=String(previous?.settled_at||previous?.updated_at||previous?.created_at||'');
      if(!previous||currentDate>=previousDate)map.set(key,row);
    }
    return [...map.values()];
  }

  function settlementsForLibrary(libraryId){
    const seen=new Set();
    return arr(db().library_settlements).filter(row=>{
      if(!same(row.library_id,libraryId))return false;
      const key=String(row.id||row.receipt_number||`${row.library_id}-${row.created_at}-${row.amount}`);
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  function settlementValue(row){
    const status=String(row?.status||'').toLowerCase();
    if(status==='reversal')return -Math.abs(num(row.amount));
    if(['received','paid','completed','settled'].includes(status))return Math.abs(num(row.amount));
    return 0;
  }

  function librarySummary(libraryId){
    const rows=canonicalLedger().filter(row=>same(row.library_id,libraryId)&&deliveryType(row)==='library').map(row=>{
      const order=orderForLedger(row)||{};
      const gross=Math.max(0,num(row.total)||num(order.total)||num(row.admin||row.alin)+num(row.teacher)+num(row.library)+num(row.delegate));
      const libraryProfit=Math.max(0,num(row.library||row.library_amount));
      return {...row,order,gross,libraryProfit,debt:Math.max(0,gross-libraryProfit),created_at:row.settled_at||row.created_at||order.delivered_at||order.updated_at||order.created_at||''};
    });
    const settlements=settlementsForLibrary(libraryId);
    const gross=rows.reduce((sum,row)=>sum+row.gross,0);
    const libraryProfit=rows.reduce((sum,row)=>sum+row.libraryProfit,0);
    const debtTotal=rows.reduce((sum,row)=>sum+row.debt,0);
    const settled=Math.max(0,settlements.reduce((sum,row)=>sum+settlementValue(row),0));
    const month=new Date().toISOString().slice(0,7);
    const monthProfit=rows.filter(row=>String(row.created_at).slice(0,7)===month).reduce((sum,row)=>sum+row.libraryProfit,0);
    return {rows,settlements,gross,libraryProfit,profit:libraryProfit,debtTotal,settled,debtRemaining:Math.max(0,debtTotal-settled),remaining:Math.max(0,debtTotal-settled),monthProfit};
  }

  function teacherPayoutValue(row){
    return ['paid','completed','settled'].includes(String(row?.status||'').toLowerCase())?Math.max(0,num(row.amount)):0;
  }

  function teacherSummary(teacherId){
    const rows=canonicalLedger().filter(row=>same(row.teacher_id,teacherId));
    const payouts=[
      ...arr(db().teacherPayouts).filter(row=>same(row.teacher_id,teacherId)),
      ...arr(db().teacher_payouts).filter(row=>same(row.teacher_id,teacherId)),
      ...arr(db().withdrawals).filter(row=>String(row.role||'').toLowerCase()==='teacher'&&same(row.account_id||row.user_id,teacherId))
    ];
    const seen=new Set();
    const uniquePayouts=payouts.filter(row=>{const key=String(row.id||`${teacherId}-${row.created_at}-${row.amount}`);if(seen.has(key))return false;seen.add(key);return true});
    const earned=rows.reduce((sum,row)=>sum+Math.max(0,num(row.teacher)),0);
    const paid=uniquePayouts.reduce((sum,row)=>sum+teacherPayoutValue(row),0);
    return {rows,payouts:uniquePayouts,earned,paid,remaining:Math.max(0,earned-paid)};
  }

  async function persistPermit(order){
    if(order?.kind!=='booklet'||!order.library_id)return;
    if(arr(db().permits).some(row=>same(row.order_id,order.id)))return;
    const insert=api('insert');if(!insert)return;
    const row={id:api('uid')?window.uid('P'):`P-${Date.now()}`,order_id:order.id,booklet_id:order.item_id||order.booklet_id,library_id:order.library_id,qty:Math.max(1,num(order.qty)||1),used:0,status:'active'};
    await insert('permits',row);
    db().permits=db().permits||[];db().permits.unshift(row);
  }

  async function persistLedger(order){
    const insert=api('insert'),update=api('update');
    if(!insert||!update)throw new Error('خدمة الحسابات غير جاهزة');
    const split=shares(order);
    if(split.total<=0)throw new Error('مبلغ الطلب غير صالح للحسابات');
    const book=bookletFor(order);
    const matches=arr(db().ledger).filter(row=>same(row.order_id,order.id));
    const existing=matches[0]||null;
    const base={
      order_id:order.id,order_number:order.order_number||order.id,
      alin:split.admin,admin:split.admin,teacher:split.teacher,teacher_id:book?.teacher_id||order.teacher_id||'',
      library:split.library,library_id:order.library_id||'',delegate:split.delegate,delegate_id:order.delegate_id||order.courier_id||'',
      total:split.total,delivery_type:split.delivery,settlement_status:'pending',updated_at:now()
    };
    let row;
    if(existing){
      await update('ledger',base,{id:existing.id});
      Object.assign(existing,base);row=existing;
    }else{
      row={id:api('uid')?window.uid('LG'):`LG-${Date.now()}`,...base,created_at:now()};
      await insert('ledger',row);
      db().ledger=db().ledger||[];db().ledger.unshift(row);
    }
    // Remove duplicate in-memory rows; the saved row is the single source used by the UI.
    db().ledger=arr(db().ledger).filter((item,index,list)=>!same(item.order_id,order.id)||item===row||list.find(x=>same(x.order_id,order.id))===item);
    await persistPermit(order);
    return {row,split};
  }

  async function finalizeDelivered(order,status){
    const update=api('update');if(!update)throw new Error('خدمة تحديث الطلب غير جاهزة');
    const history=[...arr(order.status_history),{status,at:now()}];
    const {row,split}=await persistLedger(order);
    const orderPayload={
      status,payment_status:'paid',status_history:history,delivered_at:order.delivered_at||now(),
      settlement_done:true,settlement_cancelled:false,settlement_at:now(),
      platform_profit:split.admin,teacher_profit:split.teacher,library_profit:split.library,delegate_profit:split.delegate,
      settlement_party:split.delivery,
      ...(split.delivery==='library'?{cash_collected_by:'library',cash_collected_at:now(),library_cash_collected:split.total}:{})
    };
    await update('orders',orderPayload,{id:order.id});
    Object.assign(order,orderPayload);
    await update('ledger',{settlement_status:'settled',settled_at:now(),updated_at:now()},{id:row.id});
    Object.assign(row,{settlement_status:'settled',settled_at:now()});
  }

  async function cancelOrderFinance(order,status='cancelled',reason=''){
    const update=api('update');if(!update)throw new Error('خدمة تحديث الطلب غير جاهزة');
    const history=[...arr(order.status_history),{status:'cancelled',at:now(),note:reason||'إلغاء بدون احتساب مبلغ'}];
    const orderPayload={status:'cancelled',status_history:history,cancel_reason:reason||order.cancel_reason||'',settlement_done:false,settlement_cancelled:true,payment_status:'cancelled'};
    await update('orders',orderPayload,{id:order.id});Object.assign(order,orderPayload);
    for(const row of arr(db().ledger).filter(item=>same(item.order_id,order.id))){
      const payload={settlement_status:'cancelled',alin:0,admin:0,teacher:0,library:0,delegate:0,total:0,note:'إلغاء بدون احتساب مبلغ',updated_at:now()};
      await update('ledger',payload,{id:row.id});Object.assign(row,payload);
    }
  }

  async function setOrderStatus(id,status,source='admin'){
    const order=arr(db().orders).find(row=>same(row.id,id));
    if(!order)throw new Error('الطلب غير موجود');
    const normalized=String(status||'').toLowerCase();
    if(cancelledStatus(normalized)){
      let reason='';
      if(typeof window.prompt==='function')reason=window.prompt('اكتب سبب الإلغاء','')||'';
      if(!reason&&source==='library')return false;
      await cancelOrderFinance(order,'cancelled',reason);
    }else if(deliveredStatus(normalized)){
      await finalizeDelivered(order,normalized==='delivered'?'delivered':'completed');
    }else{
      const update=api('update');if(!update)throw new Error('خدمة تحديث الطلب غير جاهزة');
      const history=[...arr(order.status_history),{status,at:now()}];
      await update('orders',{status,status_history:history},{id:order.id});Object.assign(order,{status,status_history:history});
    }
    if(api('audit'))await window.audit('order',`${source==='library'?'المكتبة':'الإدارة'} حدثت الطلب ${order.order_number||order.id} إلى ${status}`);
    if(api('load'))await window.load();
    if(source==='library'&&api('renderLibrary'))window.renderLibrary();
    if(source==='admin'&&api('renderOrdersAdmin'))window.renderOrdersAdmin();
    if(api('toast'))window.toast('تم تحديث الطلب والحسابات');
    return true;
  }

  async function settleLibrary(libraryId){
    if(String(window.current?.role||'').toLowerCase()!=='admin'&&String(window.current?.role||'').toLowerCase()!=='accountant')return alert('هذا الإجراء متاح للإدارة فقط');
    const summary=librarySummary(libraryId);
    if(summary.debtRemaining<=0)return alert('حساب المكتبة مصفّى ولا توجد ذمة متبقية');
    const library=arr(db().accounts?.libraries).find(row=>same(row.id,libraryId))||{};
    const raw=window.prompt(`المتبقي بذمة ${library.name||'المكتبة'} هو ${money(summary.debtRemaining)} د.ع\nاكتب المبلغ المستلم`,String(summary.debtRemaining));
    if(raw===null)return;
    const amount=num(String(raw).replace(/[,،]/g,''));
    if(amount<=0||amount>summary.debtRemaining)return alert('مبلغ التسوية غير صحيح');
    const row={id:api('uid')?window.uid('LS'):`LS-${Date.now()}`,receipt_number:`LS-${Date.now()}`,library_id:libraryId,amount,payment_method:'نقدي',status:'received',note:'تسوية ذمة مكتبة من لوحة الإدارة',created_at:now()};
    const insert=api('insert');if(!insert)throw new Error('خدمة حفظ التسوية غير جاهزة');
    await insert('library_settlements',row);
    db().library_settlements=db().library_settlements||[];db().library_settlements.unshift(row);
    if(api('audit'))await window.audit('settlement',`تسوية مكتبة ${library.name||libraryId} بمبلغ ${amount}`);
    if(api('load'))await window.load();
    alert(amount===summary.debtRemaining?'تمت التصفية وأصبحت ذمة المكتبة صفراً':'تم تسجيل التسوية وتحديث المتبقي');
    renderAdminFinance();
  }

  async function settleTeacher(teacherId){
    if(String(window.current?.role||'').toLowerCase()!=='admin'&&String(window.current?.role||'').toLowerCase()!=='accountant')return alert('هذا الإجراء متاح للإدارة فقط');
    const summary=teacherSummary(teacherId);
    if(summary.remaining<=0)return alert('لا توجد أرباح متبقية لهذا المدرس');
    const teacher=arr(db().accounts?.teachers).find(row=>same(row.id,teacherId))||{};
    const raw=window.prompt(`رصيد ${teacher.name||'المدرس'} هو ${money(summary.remaining)} د.ع\nاكتب مبلغ التسديد`,String(summary.remaining));
    if(raw===null)return;
    const amount=num(String(raw).replace(/[,،]/g,''));
    if(amount<=0||amount>summary.remaining)return alert('مبلغ التسديد غير صحيح');
    const row={id:api('uid')?window.uid('TP'):`TP-${Date.now()}`,teacher_id:teacherId,amount,note:'تسديد من الإدارة',status:'paid',created_at:now()};
    const insert=api('insert');if(!insert)throw new Error('خدمة حفظ التسديد غير جاهزة');
    await insert('teacher_payouts',row);
    db().teacherPayouts=db().teacherPayouts||[];db().teacherPayouts.unshift(row);
    if(api('audit'))await window.audit('payout',`تسديد أرباح المدرس ${teacher.name||teacherId} بمبلغ ${amount}`);
    if(api('load'))await window.load();
    alert(amount===summary.remaining?'تم تسديد كامل الرصيد وأصبح المتبقي صفراً':'تم تسجيل الدفعة وتحديث الرصيد');
    renderAdminFinance();
  }

  function renderAdminFinance(){
    const root=document.getElementById('adminContent');if(!root)return;
    const ledger=canonicalLedger();
    const totals=ledger.reduce((out,row)=>{out.admin+=num(row.admin||row.alin);out.teacher+=num(row.teacher);out.library+=num(row.library);out.delegate+=num(row.delegate);out.sales+=num(row.total);return out},{admin:0,teacher:0,library:0,delegate:0,sales:0});
    const teachers=arr(db().accounts?.teachers).map(teacher=>({teacher,summary:teacherSummary(teacher.id)}));
    const libraries=arr(db().accounts?.libraries).map(library=>({library,summary:librarySummary(library.id)}));
    root.innerHTML=`<section class="alin-finance-v207"><div class="admin-v120-head"><div><h2>الحسابات والتسويات</h2><p>تُحتسب الأرباح مرة واحدة فقط بعد تسليم الطلب، ويُلغى الاحتساب عند إلغاء التسليم.</p></div></div><div class="stats"><div><b>المبيعات المسلّمة</b><span>${money(totals.sales)} د.ع</span></div><div><b>ربح المنصة</b><span>${money(totals.admin)} د.ع</span></div><div><b>أرباح المدرسين</b><span>${money(totals.teacher)} د.ع</span></div><div><b>أرباح المكتبات</b><span>${money(totals.library)} د.ع</span></div></div><h3>تسديد أرباح المدرسين</h3>${teachers.map(({teacher,summary})=>`<div class="row"><div><b>${escapeHtml(teacher.name||'مدرس')}</b><small>المستحق ${money(summary.earned)} — المدفوع ${money(summary.paid)} — المتبقي ${money(summary.remaining)} د.ع</small></div><button ${summary.remaining<=0?'disabled':''} onclick="AlinFinanceV207.settleTeacher('${escapeHtml(teacher.id)}')">${summary.remaining<=0?'الرصيد مصفّر':'تسجيل تسديد'}</button></div>`).join('')||'<div class="empty">لا يوجد مدرسون</div>'}<h3>تسويات ذمم المكتبات</h3>${libraries.map(({library,summary})=>`<div class="row"><div><b>${escapeHtml(library.name||'مكتبة')}</b><small>الذمة ${money(summary.debtTotal)} — المسدد ${money(summary.settled)} — المتبقي ${money(summary.debtRemaining)} د.ع</small></div><button ${summary.debtRemaining<=0?'disabled':''} onclick="AlinFinanceV207.settleLibrary('${escapeHtml(library.id)}')">${summary.debtRemaining<=0?'الحساب مصفّى':'تثبيت التسوية'}</button></div>`).join('')||'<div class="empty">لا توجد مكتبات</div>'}<h3>آخر الحركات المحتسبة</h3>${ledger.slice().sort((a,b)=>String(b.settled_at||b.created_at||'').localeCompare(String(a.settled_at||a.created_at||''))).slice(0,30).map(row=>`<div class="row"><div><b>${escapeHtml(row.order_number||row.order_id)}</b><small>منصة ${money(row.admin||row.alin)} — مدرس ${money(row.teacher)} — مكتبة ${money(row.library)} — مندوب ${money(row.delegate)}</small></div><span>مسلّم</span></div>`).join('')||'<div class="empty">لا توجد طلبات مسلّمة</div>'}</section>`;
  }

  function renderTeacherFinance(){
    const root=document.getElementById('teacherContent');if(!root)return;
    const teacherId=window.current?.role==='teacher'?window.current.id:'';
    const summary=teacherSummary(teacherId);
    root.innerHTML=`<div class="teacher-v154-shell"><div class="teacher-v154-head"><div><h3>الأرباح والتسويات</h3><p>تظهر هنا أرباح الطلبات المسلّمة فقط بعد خصم الدفعات المسجلة.</p></div></div><div class="teacher-v154-summary"><div class="teacher-v154-stat gold"><small>إجمالي الأرباح</small><b>${money(summary.earned)} د.ع</b></div><div class="teacher-v154-stat"><small>المبلغ المدفوع</small><b>${money(summary.paid)} د.ع</b></div><div class="teacher-v154-stat gold"><small>الرصيد الحالي</small><b>${money(summary.remaining)} د.ع</b></div></div><section><div class="teacher-v154-ledger"><table class="teacher-v154-table"><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>ربح المدرس</th><th>الحالة</th></tr></thead><tbody>${summary.rows.map(row=>`<tr><td>${escapeHtml(row.order_number||row.order_id)}</td><td>${escapeHtml(String(row.settled_at||row.created_at||'').slice(0,10))}</td><td>${money(row.teacher)} د.ع</td><td>تم التسليم</td></tr>`).join('')||'<tr><td colspan="4">لا توجد أرباح مسجلة.</td></tr>'}</tbody></table></div></section></div>`;
  }

  function install(){
    window.libraryOrderStatus=(id,status)=>setOrderStatus(id,status,'library').catch(error=>{console.error('[ALIN finance] library status',error);alert(error?.message||'تعذر تحديث الطلب والحسابات')});
    window.orderStatus=(id,status)=>setOrderStatus(id,status,'admin').catch(error=>{console.error('[ALIN finance] admin status',error);alert(error?.message||'تعذر تحديث الطلب والحسابات')});
    window.ensureOrderFinancials=async order=>deliveredStatus(order?.status)?persistLedger(order):null;
    window.alinV57SettleOrder=async order=>finalizeDelivered(order,deliveredStatus(order?.status)?order.status:'completed');
    window.addTeacherPayoutPrompt=settleTeacher;
    if(window.AlinTeacherModules)window.AlinTeacherModules.addTeacherPayoutPrompt=settleTeacher;
    window.AlinV120Finance={summary:librarySummary,settle:settleLibrary};

    const previousAdminTab=window.adminTab;
    if(typeof previousAdminTab==='function'&&!previousAdminTab.__financeV207){
      const wrapped=function(tab){if(tab==='finance'){window.activeAdminTab=tab;renderAdminFinance();return}return previousAdminTab.apply(this,arguments)};
      wrapped.__financeV207=true;window.adminTab=wrapped;
    }
    const previousTeacherTab=window.teacherTab;
    if(typeof previousTeacherTab==='function'&&!previousTeacherTab.__financeV207){
      const wrapped=function(tab){if(tab==='finance'){renderTeacherFinance();return}return previousTeacherTab.apply(this,arguments)};
      wrapped.__financeV207=true;window.teacherTab=wrapped;
    }
  }

  window.AlinFinanceV207=Object.freeze({shares,canonicalLedger,librarySummary,teacherSummary,setOrderStatus,settleLibrary,settleTeacher,renderAdminFinance,renderTeacherFinance});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
