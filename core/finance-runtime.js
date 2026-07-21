/* ALIN v2.2.6 — authoritative finance, payouts and settlements runtime. */
(function(){
  'use strict';

  const arr=value=>Array.isArray(value)?value:[];
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const same=(a,b)=>String(a??'')===String(b??'');
  const now=()=>new Date().toISOString();
  const db=()=>window.db||{};
  const api=name=>typeof window[name]==='function'?window[name]:null;
  const money=value=>typeof window.money==='function'?window.money(value):Math.round(num(value)).toLocaleString('ar-IQ');
  const delivered=value=>['completed','delivered','done','received','settled','تم التسليم'].includes(String(value||'').toLowerCase());
  const cancelled=value=>['cancelled','canceled','rejected','ملغي','إلغاء'].some(token=>String(value||'').toLowerCase().includes(token));

  function ratios(){
    const settings=db().settings||{};
    const clamp=value=>Math.max(0,Math.min(100,num(value)));
    return {
      admin:clamp(settings.admin_profit_percent??20),
      teacher:clamp(settings.teacher_profit_percent??50)
    };
  }

  function deliveryType(order){
    const raw=String(order?.fulfillment_type||order?.delivery_type||order?.delivery_method||'').toLowerCase();
    if(/delegate|courier|مندوب/.test(raw))return 'delegate';
    if(/library|pickup|مكتبة/.test(raw))return 'library';
    return order?.library_id?'library':'delegate';
  }

  function booklet(order){
    return arr(db().booklets).find(row=>same(row.id,order?.item_id||order?.booklet_id))||null;
  }

  function shares(order){
    const total=Math.max(0,Math.round(num(order?.total)));
    const rate=ratios();
    const admin=Math.min(total,Math.max(0,Math.round(total*rate.admin/100)));
    const teacherRaw=String(order?.kind||'').toLowerCase()==='booklet'?Math.round(total*rate.teacher/100):0;
    const teacher=Math.min(Math.max(0,total-admin),Math.max(0,teacherRaw));
    const remainder=Math.max(0,total-admin-teacher);
    const delivery=deliveryType(order);
    return {total,admin,teacher,library:delivery==='library'?remainder:0,delegate:delivery==='delegate'?remainder:0,delivery};
  }

  function orderFor(row){
    return arr(db().orders).find(order=>same(order.id,row?.order_id)||same(order.order_number,row?.order_number||row?.order_id))||null;
  }

  function canonicalLedger(){
    const rows=new Map();
    for(const row of arr(db().ledger)){
      const order=orderFor(row);
      if(cancelled(row?.settlement_status)||cancelled(order?.status)||order?.settlement_cancelled)continue;
      if(order&&!delivered(order.status)&&!order.settlement_done)continue;
      const key=String(row?.order_id||row?.order_number||row?.id||'');
      if(!key)continue;
      const previous=rows.get(key);
      const currentAt=String(row?.settled_at||row?.updated_at||row?.created_at||'');
      const previousAt=String(previous?.settled_at||previous?.updated_at||previous?.created_at||'');
      if(!previous||currentAt>=previousAt)rows.set(key,row);
    }
    return [...rows.values()];
  }

  function payoutRows(){
    const rows=[
      ...arr(db().financial_payouts),
      ...arr(db().financialPayouts),
      ...arr(db().teacherPayouts),
      ...arr(db().teacher_payouts),
      ...arr(db().withdrawals).filter(row=>String(row.status||'').toLowerCase()==='paid')
    ];
    const seen=new Set();
    return rows.filter(row=>{
      const key=String(row.id||row.voucher_number||`${row.party_role||row.role}-${row.party_id||row.account_id||row.teacher_id}-${row.created_at}-${row.amount}`);
      if(!key||seen.has(key))return false;
      seen.add(key);return true;
    });
  }

  function payoutRole(row){
    return String(row.party_role||row.role||(row.teacher_id?'teacher':'')||'').toLowerCase().replace('courier','delegate');
  }

  function payoutParty(row){
    return row.party_id||row.account_id||row.user_id||row.teacher_id||row.library_id||row.delegate_id||row.courier_id||'';
  }

  function payoutValue(row){
    const status=String(row.status||'paid').toLowerCase();
    if(['cancelled','canceled','rejected','reversed'].includes(status))return 0;
    if(status==='reversal')return -Math.abs(num(row.amount));
    return Math.max(0,num(row.amount));
  }

  function settlementRows(libraryId){
    const seen=new Set();
    return [...arr(db().library_settlements),...arr(db().librarySettlements)].filter(row=>{
      if(!same(row.library_id,libraryId))return false;
      const key=String(row.id||row.receipt_number||`${row.library_id}-${row.created_at}-${row.amount}`);
      if(!key||seen.has(key))return false;
      seen.add(key);return true;
    });
  }

  function settlementValue(row){
    const status=String(row.status||'received').toLowerCase();
    if(['cancelled','canceled','rejected','reversed','pending'].includes(status))return 0;
    if(status==='reversal')return -Math.abs(num(row.amount));
    return Math.max(0,num(row.amount));
  }

  function earned(role,id){
    const key=String(role||'').toLowerCase().replace('courier','delegate');
    return canonicalLedger().reduce((sum,row)=>{
      if(key==='admin')return sum+Math.max(0,num(row.admin||row.alin));
      if(key==='teacher'&&same(row.teacher_id,id))return sum+Math.max(0,num(row.teacher||row.teacher_amount));
      if(key==='library'&&same(row.library_id,id))return sum+Math.max(0,num(row.library||row.library_amount));
      if(key==='delegate'&&same(row.delegate_id||row.courier_id,id))return sum+Math.max(0,num(row.delegate||row.courier||row.courier_amount));
      return sum;
    },0);
  }

  function paid(role,id){
    const key=String(role||'').toLowerCase().replace('courier','delegate');
    return Math.max(0,payoutRows().filter(row=>payoutRole(row)===key&&(key==='admin'||same(payoutParty(row),id))).reduce((sum,row)=>sum+payoutValue(row),0));
  }

  function balance(role,id){
    const totalEarned=earned(role,id),totalPaid=paid(role,id);
    return {earned:totalEarned,paid:totalPaid,remaining:Math.max(0,totalEarned-totalPaid)};
  }

  function librarySummary(libraryId){
    const rows=canonicalLedger().filter(row=>same(row.library_id,libraryId)&&deliveryType(row)==='library').map(row=>{
      const order=orderFor(row)||{};
      const gross=Math.max(0,num(row.total)||num(order.total)||num(row.admin||row.alin)+num(row.teacher)+num(row.library)+num(row.delegate));
      const profit=Math.max(0,num(row.library||row.library_amount));
      return {...row,order,gross,profit,libraryProfit:profit,debt:Math.max(0,gross-profit),at:row.settled_at||row.created_at||order.delivered_at||order.updated_at||order.created_at||''};
    });
    const settlements=settlementRows(libraryId);
    const gross=rows.reduce((sum,row)=>sum+row.gross,0);
    const profit=rows.reduce((sum,row)=>sum+row.profit,0);
    const debtTotal=rows.reduce((sum,row)=>sum+row.debt,0);
    const settled=Math.max(0,settlements.reduce((sum,row)=>sum+settlementValue(row),0));
    const month=new Date().toISOString().slice(0,7);
    const monthProfit=rows.filter(row=>String(row.at).slice(0,7)===month).reduce((sum,row)=>sum+row.profit,0);
    return {rows,settlements,gross,profit,libraryProfit:profit,debtTotal,settled,remaining:Math.max(0,debtTotal-settled),debtRemaining:Math.max(0,debtTotal-settled),monthProfit};
  }


  function teacherSummary(teacherId){
    const rows=canonicalLedger().filter(row=>same(row.teacher_id,teacherId));
    const summary=balance('teacher',teacherId);
    const month=new Date().toISOString().slice(0,7);
    const monthEarn=rows.filter(row=>String(row.settled_at||row.created_at||'').slice(0,7)===month).reduce((sum,row)=>sum+Math.max(0,num(row.teacher||row.teacher_amount)),0);
    return {...summary,rows,payouts:payoutRows().filter(row=>payoutRole(row)==='teacher'&&same(payoutParty(row),teacherId)),monthEarn};
  }

  function delegateSummary(delegateId){
    const rows=canonicalLedger().filter(row=>same(row.delegate_id||row.courier_id,delegateId));
    return {...balance('delegate',delegateId),rows,payouts:payoutRows().filter(row=>payoutRole(row)==='delegate'&&same(payoutParty(row),delegateId))};
  }
  function partySummary(role,id){
    if(String(role).toLowerCase()==='library'){
      const profit=balance('library',id);
      return {...profit,debt:librarySummary(id)};
    }
    return balance(role,id);
  }

  async function persistPermit(order){
    if(String(order?.kind||'').toLowerCase()!=='booklet'||!order.library_id)return;
    if(arr(db().permits).some(row=>same(row.order_id,order.id)))return;
    const insert=api('insert');if(!insert)return;
    const row={id:api('uid')?window.uid('P'):`P-${Date.now()}`,order_id:order.id,booklet_id:order.item_id||order.booklet_id,library_id:order.library_id,qty:Math.max(1,num(order.qty)||1),used:0,status:'active'};
    await insert('permits',row);
  }

  async function persistLedger(order){
    const insert=api('insert'),update=api('update');
    if(!insert||!update)throw new Error('خدمة الحسابات غير جاهزة');
    const split=shares(order);if(split.total<=0)throw new Error('مبلغ الطلب غير صالح للحسابات');
    const book=booklet(order),existing=arr(db().ledger).find(row=>same(row.order_id,order.id));
    const payload={
      order_id:order.id,order_number:order.order_number||order.id,
      alin:split.admin,admin:split.admin,teacher:split.teacher,teacher_id:book?.teacher_id||order.teacher_id||'',
      library:split.library,library_id:order.library_id||'',delegate:split.delegate,delegate_id:order.delegate_id||order.courier_id||'',
      total:split.total,delivery_type:split.delivery,settlement_status:'pending',updated_at:now()
    };
    let row;
    if(existing){await update('ledger',payload,{id:existing.id});Object.assign(existing,payload);row=existing}
    else{row={id:api('uid')?window.uid('LG'):`LG-${Date.now()}`,...payload,created_at:now()};await insert('ledger',row)}
    db().ledger=arr(db().ledger).filter((item,index,list)=>!same(item.order_id,order.id)||item===row||list.find(candidate=>same(candidate.order_id,order.id))===item);
    await persistPermit(order);
    return {row,split};
  }

  async function finalizeDelivered(order,status='completed'){
    const update=api('update');if(!update)throw new Error('خدمة تحديث الطلب غير جاهزة');
    const {row,split}=await persistLedger(order);
    const normalized=status==='delivered'?'delivered':'completed';
    const history=[...arr(order.status_history),{status:normalized,at:now()}];
    const payload={
      status:normalized,payment_status:'paid',status_history:history,delivered_at:order.delivered_at||now(),
      settlement_done:true,settlement_cancelled:false,settlement_at:now(),
      platform_profit:split.admin,teacher_profit:split.teacher,library_profit:split.library,delegate_profit:split.delegate,
      settlement_party:split.delivery,
      ...(split.delivery==='library'?{cash_collected_by:'library',cash_collected_at:now(),library_cash_collected:split.total}:{})
    };
    await update('orders',payload,{id:order.id});Object.assign(order,payload);
    await update('ledger',{settlement_status:'settled',settled_at:now(),updated_at:now()},{id:row.id});Object.assign(row,{settlement_status:'settled',settled_at:now()});
    return {order,row,split};
  }

  async function cancelOrder(order,reason=''){
    const update=api('update');if(!update)throw new Error('خدمة تحديث الطلب غير جاهزة');
    const history=[...arr(order.status_history),{status:'cancelled',at:now(),note:reason||'إلغاء بدون احتساب مبلغ'}];
    const payload={status:'cancelled',status_history:history,cancel_reason:reason||order.cancel_reason||'',settlement_done:false,settlement_cancelled:true,payment_status:'cancelled'};
    await update('orders',payload,{id:order.id});Object.assign(order,payload);
    for(const row of arr(db().ledger).filter(item=>same(item.order_id,order.id))){
      const zero={settlement_status:'cancelled',alin:0,admin:0,teacher:0,library:0,delegate:0,total:0,note:'إلغاء بدون احتساب مبلغ',updated_at:now()};
      await update('ledger',zero,{id:row.id});Object.assign(row,zero);
    }
  }

  async function setOrderStatus(id,status,source='admin'){
    const order=arr(db().orders).find(row=>same(row.id,id));if(!order)throw new Error('الطلب غير موجود');
    const normalized=String(status||'').toLowerCase();
    if(cancelled(normalized)){
      const reason=typeof window.prompt==='function'?(window.prompt('اكتب سبب الإلغاء','')||''):'';
      if(!reason&&source==='library')return false;
      await cancelOrder(order,reason);
    }else if(delivered(normalized))await finalizeDelivered(order,normalized==='delivered'?'delivered':'completed');
    else{
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

  function partyName(role,id){
    const accounts=db().accounts||{};
    if(role==='admin')return 'منصة آلين';
    const list=role==='teacher'?arr(accounts.teachers):role==='library'?arr(accounts.libraries):arr(db().delegates||accounts.couriers||db().couriers);
    return list.find(row=>same(row.id,id))?.name||id||role;
  }

  async function payBalance(role,id){
    const normalized=String(role||'').toLowerCase().replace('courier','delegate');
    const currentRole=String(window.current?.role||'').toLowerCase();
    if(!['admin','accountant'].includes(currentRole))return alert('هذا الإجراء متاح للإدارة فقط');
    const summary=balance(normalized,id);if(summary.remaining<=0)return alert('لا يوجد رصيد متبقٍ');
    const raw=window.prompt(`الرصيد المتبقي لـ ${partyName(normalized,id)} هو ${money(summary.remaining)} د.ع\nاكتب مبلغ التسديد`,String(summary.remaining));
    if(raw===null)return false;
    const amount=num(String(raw).replace(/[,،]/g,''));if(amount<=0||amount>summary.remaining)return alert('مبلغ التسديد غير صحيح');
    const method=window.prompt('طريقة الدفع','نقدي')||'نقدي';
    const row={id:api('uid')?window.uid('FP'):`FP-${Date.now()}`,voucher_number:`FP-${Date.now()}`,party_role:normalized,party_id:id||'admin',party_name:partyName(normalized,id),amount,payment_method:method,note:normalized==='admin'?'استلام ربح المنصة':'تسديد أرباح',status:'paid',created_at:now()};
    const insert=api('insert');if(!insert)throw new Error('خدمة حفظ السند غير جاهزة');
    await insert('financial_payouts',row);
    if(api('audit'))await window.audit('finance',`${row.note} ${row.party_name} بمبلغ ${amount}`);
    if(api('load'))await window.load();
    if(api('renderFinanceAdmin'))window.renderFinanceAdmin();
    if(api('toast'))window.toast(amount===summary.remaining?'تم تسديد كامل الرصيد':'تم تسجيل الدفعة');
    return row;
  }

  async function settleLibrary(libraryId){
    const currentRole=String(window.current?.role||'').toLowerCase();
    if(!['admin','accountant'].includes(currentRole))return alert('هذا الإجراء متاح للإدارة فقط');
    const summary=librarySummary(libraryId);if(summary.remaining<=0)return alert('حساب المكتبة مصفّى ولا توجد ذمة متبقية');
    const name=partyName('library',libraryId);
    const raw=window.prompt(`المتبقي بذمة ${name} هو ${money(summary.remaining)} د.ع\nاكتب المبلغ المستلم`,String(summary.remaining));
    if(raw===null)return false;
    const amount=num(String(raw).replace(/[,،]/g,''));if(amount<=0||amount>summary.remaining)return alert('مبلغ التسوية غير صحيح');
    const method=window.prompt('طريقة الاستلام','نقدي')||'نقدي';
    const row={id:api('uid')?window.uid('LS'):`LS-${Date.now()}`,receipt_number:`LS-${Date.now()}`,library_id:libraryId,amount,payment_method:method,status:'received',note:'تسوية ذمة مكتبة من لوحة الإدارة',created_at:now()};
    const insert=api('insert');if(!insert)throw new Error('خدمة حفظ التسوية غير جاهزة');
    await insert('library_settlements',row);
    if(api('audit'))await window.audit('finance',`تسوية مكتبة ${name} بمبلغ ${amount}`);
    if(api('load'))await window.load();
    if(api('renderFinanceAdmin'))window.renderFinanceAdmin();
    if(api('toast'))window.toast(amount===summary.remaining?'تمت تصفية ذمة المكتبة':'تم تسجيل التسوية');
    return row;
  }

  async function requestWithdraw(role){
    const id=window.current?.id;if(!id)return alert('سجل الدخول أولاً');
    const field=role==='teacher'?document.getElementById('teacherWithdrawAmount'):document.getElementById('libraryWithdrawAmount');
    const amount=num(field?.value);if(amount<=0)return alert('المبلغ غير صحيح');
    const row={id:api('uid')?window.uid('W'):`W-${Date.now()}`,role,account_id:id,amount,status:'pending',created_at:now()};
    const insert=api('insert');if(!insert)throw new Error('خدمة طلبات السحب غير جاهزة');
    await insert('withdrawals',row);
    if(api('audit'))await window.audit('withdrawal',`طلب سحب ${role} بمبلغ ${amount}`);
    if(api('toast'))window.toast('تم إرسال طلب السحب');
    return row;
  }

  async function updateWithdrawal(id,status){
    const update=api('update');if(!update)throw new Error('خدمة تحديث طلب السحب غير جاهزة');
    await update('withdrawals',{status,updated_at:now()},{id});
    const row=arr(db().withdrawals).find(item=>same(item.id,id));if(row)Object.assign(row,{status,updated_at:now()});
    if(api('audit'))await window.audit('withdrawal',`تحديث طلب السحب ${id} إلى ${status}`);
    if(api('load'))await window.load();
    if(api('renderFinanceAdmin'))window.renderFinanceAdmin();
  }

  const service=Object.freeze({ratios,deliveryType,shares,canonicalLedger,payoutRows,librarySummary,teacherSummary,delegateSummary,partySummary,balance,earned,paid,persistLedger,finalizeDelivered,cancelOrder,setOrderStatus,payBalance,settleLibrary,requestWithdraw,updateWithdrawal,partyName});
  window.AlinFinance=service;
  window.AlinFinanceV207=service;
  window.ensureOrderFinancials=async order=>delivered(order?.status)?persistLedger(order):null;
  window.alinV57SettleOrder=async order=>finalizeDelivered(order,delivered(order?.status)?order.status:'completed');
  window.maybeCreateFinancialEntry=async id=>{const order=arr(db().orders).find(row=>same(row.id,id));return order?finalizeDelivered(order,delivered(order.status)?order.status:'completed'):null};
  window.requestWithdraw=requestWithdraw;
  window.withdrawStatus=updateWithdrawal;
  window.alinV68Balance=balance;
  window.alinV65Balance=balance;
  window.alinV65Paid=paid;
  window.alinV65AllPayouts=payoutRows;
  window.alinV64LibraryDebt=librarySummary;
  window.alinV64AllSettlements=()=>arr(db().library_settlements).length?arr(db().library_settlements):arr(db().librarySettlements);
  window.alinV68PayBalance=payBalance;
  window.alinV65PayBalance=payBalance;
  window.alinV64AdminSettleLibrary=settleLibrary;
  window.addTeacherPayoutPrompt=id=>payBalance('teacher',id);
  window.AlinV120Finance={summary:librarySummary,settle:settleLibrary};
})();
