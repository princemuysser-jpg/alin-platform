/* ALIN v2.8.0 Stage 5 — server-authoritative atomic finance runtime. */
(function(){
  'use strict';

  const arr=value=>Array.isArray(value)?value:[];
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const same=(a,b)=>String(a??'')===String(b??'');
  const now=()=>new Date().toISOString();
  const db=()=>window.db||{};
  const api=name=>typeof window[name]==='function'?window[name]:null;
  const client=()=>window.ALINAuthRuntime?.client?.()||window.sb||window.AlinCloud?.client?.()||null;
  const money=value=>typeof window.money==='function'?window.money(value):Math.round(num(value)).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const delivered=value=>['completed','delivered','done','received','settled','تم التسليم'].includes(String(value||'').toLowerCase());
  const cancelled=value=>['cancelled','canceled','rejected','ملغي','إلغاء'].some(token=>String(value||'').toLowerCase().includes(token));

  function ratios(){
    const settings=db().settings||{};
    const clamp=value=>Math.max(0,Math.min(100,num(value)));
    return {
      admin:clamp(settings.admin_profit_percent??20),
      teacher:clamp(settings.teacher_profit_percent??50),
      library:clamp(settings.library_profit_percent??30),
      delegate:clamp(settings.delegate_profit_percent??30)
    };
  }

  function deliveryType(order){
    const raw=String(order?.fulfillment_type||order?.delivery_type||order?.delivery_method||'').toLowerCase();
    if(/home_delivery|delivery|delegate|courier|مندوب/.test(raw)||order?.delegate_id||order?.courier_id)return 'delegate';
    return 'library';
  }

  function booklet(order){return arr(db().booklets).find(row=>same(row.id,order?.item_id||order?.booklet_id))||null}

  function shares(order){
    const total=Math.max(0,Math.round(num(order?.total)));
    const deliveryFee=Math.min(total,Math.max(0,Math.round(num(order?.delivery_fee))));
    const merchandise=Math.max(0,total-deliveryFee);
    const rate=ratios(),book=booklet(order),isBooklet=/booklet|ملزمة|ملازم/.test(String(order?.kind||order?.item_kind||'').toLowerCase());
    const teacherPct=Math.max(0,Math.min(100,num(book?.teacher_share_percent??rate.teacher)));
    const libraryPct=Math.max(0,Math.min(100,num(book?.library_share_percent??rate.library)));
    const delivery=deliveryType(order);
    const teacher=isBooklet?Math.min(merchandise,Math.max(0,Math.round(merchandise*teacherPct/100))):0;
    const library=delivery==='library'?Math.min(Math.max(0,merchandise-teacher),Math.max(0,Math.round(merchandise*libraryPct/100))):0;
    const delegate=delivery==='delegate'?Math.min(deliveryFee,Math.max(0,Math.round(deliveryFee*rate.delegate/100))):0;
    const admin=Math.max(0,total-teacher-library-delegate);
    const collectorId=delivery==='library'?(order?.library_id||order?.pickup_library_id||order?.assigned_library_id||''):(order?.delegate_id||order?.courier_id||'');
    const collectorProfit=delivery==='library'?library:delegate;
    return {total,merchandise,deliveryFee,admin,teacher,library,delegate,delivery,collectorId,debt:Math.max(0,total-collectorProfit)};
  }

  function orderFor(row){return arr(db().orders).find(order=>same(order.id,row?.order_id)||same(order.order_number,row?.order_number||row?.order_id))||null}

  function canonicalLedger(){
    const rows=new Map();
    for(const row of arr(db().ledger)){
      if(row?.is_current===false)continue;
      const order=orderFor(row);
      if(cancelled(row?.settlement_status)||cancelled(order?.status)||order?.settlement_cancelled)continue;
      if(order&&!delivered(order.status)&&!order.settlement_done)continue;
      const key=String(row?.order_id||row?.order_number||row?.id||'');if(!key)continue;
      const previous=rows.get(key),currentAt=String(row?.settled_at||row?.updated_at||row?.created_at||''),previousAt=String(previous?.settled_at||previous?.updated_at||previous?.created_at||'');
      if(!previous||currentAt>=previousAt)rows.set(key,row);
    }
    return [...rows.values()];
  }

  function payoutRows(){
    const rows=[...arr(db().financial_payouts),...arr(db().financialPayouts),...arr(db().teacherPayouts),...arr(db().teacher_payouts),...arr(db().withdrawals).filter(row=>String(row.status||'').toLowerCase()==='paid')];
    const seen=new Set();
    return rows.filter(row=>{const key=String(row.id||row.voucher_number||`${row.party_role||row.role}-${row.party_id||row.account_id||row.teacher_id}-${row.created_at}-${row.amount}`);if(!key||seen.has(key))return false;seen.add(key);return true});
  }
  const payoutRole=row=>String(row.party_role||row.role||(row.teacher_id?'teacher':'')||'').toLowerCase().replace('courier','delegate');
  const payoutParty=row=>row.party_id||row.account_id||row.user_id||row.teacher_id||row.library_id||row.delegate_id||row.courier_id||'';
  function payoutValue(row){const status=String(row.status||'paid').toLowerCase();if(['cancelled','canceled','rejected','reversed','pending'].includes(status))return 0;return status==='reversal'?-Math.abs(num(row.amount)):Math.max(0,num(row.amount))}

  function librarySettlementRows(id){
    const seen=new Set();return [...arr(db().library_settlements),...arr(db().librarySettlements)].filter(row=>{if(!same(row.library_id,id))return false;const key=String(row.id||row.receipt_number||`${id}-${row.created_at}-${row.amount}`);if(!key||seen.has(key))return false;seen.add(key);return true});
  }
  function delegateSettlementRows(id){
    const seen=new Set();return [...arr(db().delegate_settlements),...arr(db().courierSettlements),...arr(window.courierSettlements)].filter(row=>{if(!same(row.delegate_id||row.courier_id||row.party_id,id))return false;const key=String(row.id||row.receipt_number||`${id}-${row.created_at}-${row.amount}`);if(!key||seen.has(key))return false;seen.add(key);return true});
  }
  function settlementValue(row){const status=String(row.status||'received').toLowerCase();if(['cancelled','canceled','rejected','reversed','pending'].includes(status))return 0;return status==='reversal'?-Math.abs(num(row.amount)):Math.max(0,num(row.amount))}

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
  function paid(role,id){const key=String(role||'').toLowerCase().replace('courier','delegate');return Math.max(0,payoutRows().filter(row=>payoutRole(row)===key&&(key==='admin'||same(payoutParty(row),id))).reduce((sum,row)=>sum+payoutValue(row),0))}
  function balance(role,id){const totalEarned=earned(role,id),totalPaid=paid(role,id);return {earned:totalEarned,paid:totalPaid,remaining:Math.max(0,totalEarned-totalPaid)}}

  function librarySummary(libraryId){
    const rows=canonicalLedger().filter(row=>same(row.library_id,libraryId)&&String(row.collector_role||row.delivery_type||'library')==='library').map(row=>{const order=orderFor(row)||{},gross=Math.max(0,num(row.total)||num(order.total)),profit=Math.max(0,num(row.library||row.library_amount)),debt=Math.max(0,num(row.collector_debt)||gross-profit);return {...row,order,gross,profit,libraryProfit:profit,debt,at:row.settled_at||row.created_at||order.delivered_at||order.updated_at||order.created_at||''}});
    const settlements=librarySettlementRows(libraryId),gross=rows.reduce((sum,row)=>sum+row.gross,0),profit=rows.reduce((sum,row)=>sum+row.profit,0),debtTotal=rows.reduce((sum,row)=>sum+row.debt,0),settled=Math.max(0,settlements.reduce((sum,row)=>sum+settlementValue(row),0)),month=new Date().toISOString().slice(0,7),monthProfit=rows.filter(row=>String(row.at).slice(0,7)===month).reduce((sum,row)=>sum+row.profit,0);
    return {rows,settlements,gross,profit,libraryProfit:profit,debtTotal,settled,remaining:Math.max(0,debtTotal-settled),debtRemaining:Math.max(0,debtTotal-settled),monthProfit};
  }
  function teacherSummary(teacherId){const rows=canonicalLedger().filter(row=>same(row.teacher_id,teacherId)),summary=balance('teacher',teacherId),month=new Date().toISOString().slice(0,7),monthEarn=rows.filter(row=>String(row.settled_at||row.created_at||'').slice(0,7)===month).reduce((sum,row)=>sum+Math.max(0,num(row.teacher||row.teacher_amount)),0);return {...summary,rows,payouts:payoutRows().filter(row=>payoutRole(row)==='teacher'&&same(payoutParty(row),teacherId)),monthEarn}}
  function delegateSummary(delegateId){
    const rows=canonicalLedger().filter(row=>same(row.delegate_id||row.courier_id,delegateId)&&String(row.collector_role||row.delivery_type)==='delegate');
    const collected=rows.reduce((sum,row)=>sum+Math.max(0,num(row.total)),0),earnings=rows.reduce((sum,row)=>sum+Math.max(0,num(row.delegate||row.courier_amount)),0),debtTotal=rows.reduce((sum,row)=>sum+Math.max(0,num(row.collector_debt)||num(row.total)-num(row.delegate)),0),settlements=delegateSettlementRows(delegateId),settled=Math.max(0,settlements.reduce((sum,row)=>sum+settlementValue(row),0));
    return {earned:earnings,earnings,collected,debtTotal,paid:settled,settled,remaining:Math.max(0,debtTotal-settled),debt:Math.max(0,debtTotal-settled),rows,settlements,payouts:payoutRows().filter(row=>payoutRole(row)==='delegate'&&same(payoutParty(row),delegateId))};
  }
  function partySummary(role,id){if(String(role).toLowerCase()==='library'){const profit=balance('library',id);return {...profit,debt:librarySummary(id)}}if(['courier','delegate'].includes(String(role).toLowerCase()))return delegateSummary(id);return balance(role,id)}

  function financeError(error){
    const message=String(error?.message||error||'').trim();
    if(/alin_order_transition_atomic|schema cache|function .* does not exist/i.test(message))return new Error('خدمة الحسابات الذرية غير محدثة. نفّذ ملف المرحلة الخامسة ثم حدّث الصفحة.');
    return error instanceof Error?error:new Error(message||'تعذر تنفيذ العملية المالية');
  }
  async function rpc(name,args){const c=client();if(!c?.rpc)throw new Error('خدمة Supabase غير متاحة');const {data,error}=await c.rpc(name,args);if(error)throw financeError(error);return data}

  async function transitionOrder(id,status,reason=''){
    const data=await rpc('alin_order_transition_atomic',{p_order_id:String(id),p_status:String(status),p_reason:reason||null});
    if(!data?.ok)throw new Error('لم يؤكد الخادم تحديث الطلب');
    const order=arr(db().orders).find(row=>same(row.id,id));if(order&&data.order)Object.assign(order,data.order);
    if(api('load'))await window.load({force:true,reason:'atomic-order-finance'});
    return data;
  }
  async function persistLedger(order){if(!order?.id)throw new Error('الطلب غير موجود');const data=await transitionOrder(order.id,'completed');return {row:data.finance,split:data.finance}}
  async function finalizeDelivered(order,status='completed'){if(!order?.id)throw new Error('الطلب غير موجود');const data=await transitionOrder(order.id,status);return {order:data.order,row:data.finance,split:data.finance}}
  async function cancelOrder(order,reason=''){if(!order?.id)throw new Error('الطلب غير موجود');return transitionOrder(order.id,'cancelled',reason)}
  async function setOrderStatus(id,status,source='admin',reason=''){
    const data=await transitionOrder(id,status,reason);
    const order=data.order||arr(db().orders).find(row=>same(row.id,id));
    if(api('audit'))await window.audit('order',`${source==='library'?'المكتبة':source==='courier'?'المندوب':'الإدارة'} حدثت الطلب ${order?.order_number||id} إلى ${status}`);
    if(source==='library'&&api('renderLibrary'))window.renderLibrary();if(source==='admin'&&api('renderOrdersAdmin'))window.renderOrdersAdmin();if(api('toast'))window.toast('تم تحديث الطلب والحسابات');
    return true;
  }

  function partyName(role,id){const accounts=db().accounts||{};if(role==='admin')return 'منصة آلين';const list=role==='teacher'?arr(accounts.teachers):role==='library'?arr(accounts.libraries):arr(db().delegates||accounts.couriers||db().couriers);return list.find(row=>same(row.id,id))?.name||id||role}
  async function recordSettlement(role,id,amount,method,note){return rpc('alin_finance_record_settlement',{p_role:role,p_party_id:String(id||role),p_amount:Number(amount),p_method:method||'نقدي',p_note:note||null})}
  async function payBalance(role,id){
    const normalized=String(role||'').toLowerCase().replace('courier','delegate'),currentRole=String(window.current?.role||'').toLowerCase();if(!['admin','accountant'].includes(currentRole))return alert('هذا الإجراء متاح للإدارة فقط');
    const summary=balance(normalized,id);if(summary.remaining<=0)return alert('لا يوجد رصيد متبقٍ');
    const raw=window.prompt(`الرصيد المتبقي لـ ${partyName(normalized,id)} هو ${money(summary.remaining)} د.ع\nاكتب مبلغ التسديد`,String(summary.remaining));if(raw===null)return false;
    const amount=num(String(raw).replace(/[,،]/g,''));if(amount<=0||amount>summary.remaining)return alert('مبلغ التسديد غير صحيح');
    const method=window.prompt('طريقة الدفع','نقدي')||'نقدي',data=await recordSettlement(normalized,id,amount,method,normalized==='admin'?'استلام ربح المنصة':'تسديد أرباح');
    if(api('load'))await window.load({force:true,reason:'finance-payout'});if(api('renderFinanceAdmin'))window.renderFinanceAdmin();if(api('toast'))window.toast('تم تسجيل السند');return data;
  }
  async function settleLibrary(libraryId){
    const currentRole=String(window.current?.role||'').toLowerCase();if(!['admin','accountant'].includes(currentRole))return alert('هذا الإجراء متاح للإدارة فقط');
    const summary=librarySummary(libraryId);if(summary.remaining<=0)return alert('حساب المكتبة مصفّى ولا توجد ذمة متبقية');
    const raw=window.prompt(`المتبقي بذمة ${partyName('library',libraryId)} هو ${money(summary.remaining)} د.ع\nاكتب المبلغ المستلم`,String(summary.remaining));if(raw===null)return false;
    const amount=num(String(raw).replace(/[,،]/g,''));if(amount<=0||amount>summary.remaining)return alert('مبلغ التسوية غير صحيح');
    const data=await recordSettlement('library',libraryId,amount,window.prompt('طريقة الاستلام','نقدي')||'نقدي','تسوية ذمة مكتبة من لوحة الإدارة');
    if(api('load'))await window.load({force:true,reason:'library-settlement'});if(api('renderFinanceAdmin'))window.renderFinanceAdmin();if(api('toast'))window.toast('تم تسجيل تسوية المكتبة');return data;
  }
  async function settleDelegate(delegateId){
    const currentRole=String(window.current?.role||'').toLowerCase();if(!['admin','accountant'].includes(currentRole))return alert('هذا الإجراء متاح للإدارة فقط');
    const summary=delegateSummary(delegateId);if(summary.remaining<=0)return alert('ذمة المندوب مصفّاة');
    const raw=window.prompt(`المتبقي بذمة ${partyName('delegate',delegateId)} هو ${money(summary.remaining)} د.ع\nاكتب المبلغ المستلم`,String(summary.remaining));if(raw===null)return false;
    const amount=num(String(raw).replace(/[,،]/g,''));if(amount<=0||amount>summary.remaining)return alert('مبلغ التسوية غير صحيح');
    const data=await recordSettlement('delegate',delegateId,amount,window.prompt('طريقة الاستلام','نقدي')||'نقدي','تسوية ذمة مندوب من لوحة الإدارة');
    if(api('load'))await window.load({force:true,reason:'delegate-settlement'});if(api('renderFinanceAdmin'))window.renderFinanceAdmin();if(api('toast'))window.toast('تم تسجيل تسوية المندوب');return data;
  }

  async function reverseSettlement(role,id,reason){
    const text=String(reason||'').trim();if(!text)throw new Error('اكتب سبب عكس السند');
    const data=await rpc('alin_finance_reverse_settlement',{p_role:role,p_settlement_id:String(id),p_reason:text});
    if(api('load'))await window.load({force:true,reason:'finance-reversal'});return data;
  }

  async function requestWithdraw(role){const id=window.current?.id;if(!id)return alert('سجل الدخول أولاً');const field=role==='teacher'?document.getElementById('teacherWithdrawAmount'):document.getElementById('libraryWithdrawAmount'),amount=num(field?.value);if(amount<=0)return alert('المبلغ غير صحيح');const row={id:api('uid')?window.uid('W'):`W-${Date.now()}`,role,account_id:id,amount,status:'pending',created_at:now()},insert=api('insert');if(!insert)throw new Error('خدمة طلبات السحب غير جاهزة');await insert('withdrawals',row);if(api('toast'))window.toast('تم إرسال طلب السحب');return row}
  async function updateWithdrawal(id,status){const update=api('update');if(!update)throw new Error('خدمة تحديث طلب السحب غير جاهزة');await update('withdrawals',{status,updated_at:now()},{id});if(api('load'))await window.load();if(api('renderFinanceAdmin'))window.renderFinanceAdmin()}

  const service=Object.freeze({ratios,deliveryType,shares,canonicalLedger,payoutRows,librarySummary,teacherSummary,delegateSummary,partySummary,balance,earned,paid,transitionOrder,persistLedger,finalizeDelivered,cancelOrder,setOrderStatus,recordSettlement,payBalance,settleLibrary,settleDelegate,reverseSettlement,requestWithdraw,updateWithdrawal,partyName});
  window.AlinFinance=service;window.AlinFinanceV207=service;
  window.ensureOrderFinancials=async order=>delivered(order?.status)?transitionOrder(order.id,'completed'):null;
  window.alinV57SettleOrder=async order=>transitionOrder(order.id,'completed');
  window.maybeCreateFinancialEntry=async id=>transitionOrder(id,'completed');
  window.requestWithdraw=requestWithdraw;window.withdrawStatus=updateWithdrawal;window.alinV68Balance=balance;window.alinV65Balance=balance;window.alinV65Paid=paid;window.alinV65AllPayouts=payoutRows;window.alinV64LibraryDebt=librarySummary;window.alinV64AllSettlements=()=>arr(db().library_settlements).length?arr(db().library_settlements):arr(db().librarySettlements);window.alinV68PayBalance=payBalance;window.alinV65PayBalance=payBalance;window.alinV64AdminSettleLibrary=settleLibrary;window.addTeacherPayoutPrompt=id=>payBalance('teacher',id);window.AlinV120Finance={summary:librarySummary,settle:settleLibrary};
})();
