// === library/finance.js ===
/* ===== library/js/finance.js ===== */
/* V111: actual library code moved from core/js/platform-legacy.js */
window.AlinLibraryModules=window.AlinLibraryModules||{};
async function recordLibrarySettlement(libraryId){
  const lib=(db.accounts.libraries||[]).find(x=>x.id===libraryId); if(!lib)return;
  const d=libDebt(libraryId);
  const amount=+(prompt('المتبقي على '+lib.name+' هو '+money(d.remaining)+' د.ع\nاكتب مبلغ التسوية المستلم من المكتبة')||0);
  if(amount<=0||amount>d.remaining)return alert('المبلغ غير صحيح أو أكبر من المتبقي');
  const method=prompt('طريقة الاستلام: نقدي / تحويل / زين كاش / آسيا حوالة','نقدي')||'نقدي';
  const periodFrom=prompt('من تاريخ اختياري YYYY-MM-DD','')||'';
  const periodTo=prompt('إلى تاريخ اختياري YYYY-MM-DD','')||'';
  const note=prompt('تفاصيل','')||'';
  const receipt=settlementNo();
  await insert('library_settlements',{id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,payment_method:method,period_from:periodFrom||null,period_to:periodTo||null,note,status:'received'});
  await audit('settlement','سند قبض تسوية مكتبة '+receipt);
  await load(); renderFinanceAdmin(); alert('تم تسجيل سند القبض '+receipt);
}

async function reverseLibrarySettlement(id){
  const s=librarySettlements.find(x=>x.id===id); if(!s||s.status==='reversed'||!confirm('إنشاء قيد عكسي لسند القبض؟'))return;
  await update('library_settlements',{status:'reversed'},{id});
  await insert('library_settlements',{id:uid('LS'),receipt_number:'RV-'+Date.now(),library_id:s.library_id,amount:s.amount,payment_method:s.payment_method,period_from:s.period_from,period_to:s.period_to,note:'قيد عكسي للسند '+s.receipt_number,status:'reversal',reversal_of:s.id});
  await audit('settlement','عكس سند قبض '+s.receipt_number);
  await load(); renderFinanceAdmin();
}

function printLibrarySettlement(id){
  const s=librarySettlements.find(x=>x.id===id); if(!s)return;
  const lib=(db.accounts.libraries||[]).find(x=>x.id===s.library_id)||{};
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px"><h2>سند قبض تسوية مكتبة</h2><p><b>رقم السند:</b> ${esc(s.receipt_number)}</p><p><b>المكتبة:</b> ${esc(lib.name||'')}</p><p><b>المبلغ:</b> ${money(s.amount)} د.ع</p><p><b>طريقة الاستلام:</b> ${esc(s.payment_method||'')}</p><p><b>الفترة:</b> ${esc(s.period_from||'-')} إلى ${esc(s.period_to||'-')}</p><p><b>تفاصيل:</b> ${esc(s.note||'')}</p><hr><p>توقيع الإدارة: ____________</p><p>توقيع المكتبة: ____________</p></div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}

function settlementRowsForLibrary(id){
  const entries=financialEntries.filter(x=>x.library_id===id);
  const gross=entries.reduce((a,x)=>a+(+x.gross||0),0);
  const libShare=entries.reduce((a,x)=>a+(+x.library_amount||0),0);
  const platform=entries.reduce((a,x)=>a+(+x.platform_amount||0),0);
  const teacher=entries.reduce((a,x)=>a+(+x.teacher_amount||0),0);
  const d=libDebt(id);
  return {gross,libShare,platform,teacher,owed:d.owed,paid:d.paid,remaining:d.remaining};
}

function printLibraryStatement(libraryId){
  const lib=(db.accounts.libraries||[]).find(x=>x.id===libraryId)||{};
  const r=settlementRowsForLibrary(libraryId);
  const rows=financialEntries.filter(x=>x.library_id===libraryId).map(x=>`<tr><td>${esc(x.order_number||x.order_id)}</td><td>${esc(x.title||'')}</td><td>${money(x.gross)}</td><td>${money(x.platform_amount)}</td><td>${money(x.teacher_amount)}</td><td>${money(x.library_amount)}</td></tr>`).join('');
  const html=`<div dir="rtl" style="font-family:Arial;padding:24px"><h2>كشف تسوية مكتبة</h2><p><b>المكتبة:</b> ${esc(lib.name||'')}</p><p><b>إجمالي المبيعات:</b> ${money(r.gross)} د.ع</p><p><b>حصة المكتبة:</b> ${money(r.libShare)} د.ع</p><p><b>المطلوب تسليمه:</b> ${money(r.owed)} د.ع | <b>المدفوع:</b> ${money(r.paid)} د.ع | <b>المتبقي:</b> ${money(r.remaining)} د.ع</p><table border="1" cellspacing="0" cellpadding="6" width="100%"><thead><tr><th>رقم الطلب</th><th>المادة</th><th>المبلغ</th><th>آلين</th><th>المدرس</th><th>المكتبة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}

function alinV63LibraryDebt(libraryId){
  const ledgerRows=(db.ledger||[]).filter(x=>x.library_id===libraryId && x.settlement_status!=='cancelled');
  const owed=ledgerRows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0)+(+x.delegate||0),0);
  let paid=0;
  try{
    if(typeof librarySettlements!=='undefined'){
      paid=(librarySettlements||[]).filter(x=>x.library_id===libraryId && (x.status==='received'||x.status==='paid')).reduce((a,x)=>a+(+x.amount||0),0);
    }
  }catch(e){}
  try{
    const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');
    paid += local.filter(x=>x.library_id===libraryId && x.status==='received').reduce((a,x)=>a+(+x.amount||0),0);
  }catch(e){}
  return {owed,paid,remaining:Math.max(0,owed-paid)};
}

async function alinV63PayLibrarySettlement(libraryId){
  const d=alinV63LibraryDebt(libraryId);
  if(d.remaining<=0) return toast('لا يوجد مبلغ بذمة المكتبة');
  const amount=+(prompt('المبلغ بذمة المكتبة: '+money(d.remaining)+' د.ع\nاكتب مبلغ التسوية المستلم من المكتبة', d.remaining)||0);
  if(!amount || amount<=0 || amount>d.remaining) return alert('المبلغ غير صحيح');
  const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,status:'received',payment_method:'نقدي',created_at:new Date().toISOString(),note:'تسوية مكتبة من صفحة المكتبة'};
  let saved=false;
  try{
    await insert('library_settlements',row);
    if(typeof librarySettlements!=='undefined') librarySettlements.unshift(row);
    saved=true;
  }catch(e){
    try{
      const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');
      local.unshift(row);
      localStorage.setItem('alin_v63_library_settlements',JSON.stringify(local));
      saved=true;
    }catch(_){}
  }
  await audit('finance','استلام تسوية مكتبة '+receipt+' بمبلغ '+amount);
  toast(saved?'تم تثبيت التسوية':'تعذر حفظ التسوية');
  await load();
  renderLibrary();
}

function alinV64LibraryDebt(libraryId){
  const ledgerRows=(db.ledger||[]).filter(x=>x.library_id===libraryId && x.settlement_status!=='cancelled');
  const owed=ledgerRows.reduce((a,x)=>a+(+x.admin||+x.alin||0)+(+x.teacher||0)+(+x.delegate||0),0);
  const paid=alinV64AllSettlements().filter(x=>x.library_id===libraryId && (x.status==='received'||x.status==='paid')).reduce((a,x)=>a+(+x.amount||0),0);
  return {owed,paid,remaining:Math.max(0,owed-paid)};
}

async function alinV64AdminSettleLibrary(libraryId){
  const lib=(db.accounts?.libraries||[]).find(x=>x.id===libraryId)||{};
  const d=alinV64LibraryDebt(libraryId);
  if(d.remaining<=0) return toast('لا يوجد مبلغ بذمة هذه المكتبة');
  const amount=+(prompt('تسوية مكتبة: '+(lib.name||'')+'\nالمتبقي بذمتها: '+money(d.remaining)+' د.ع\nاكتب المبلغ المستلم', d.remaining)||0);
  if(!amount || amount<=0 || amount>d.remaining) return alert('المبلغ غير صحيح');
  const method=prompt('طريقة الاستلام','نقدي')||'نقدي';
  const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const row={id:uid('LS'),receipt_number:receipt,library_id:libraryId,amount,status:'received',payment_method:method,note:'تثبيت تسوية من لوحة المدير',created_at:new Date().toISOString()};
  try{
    await insert('library_settlements',row);
    if(typeof librarySettlements!=='undefined') librarySettlements.unshift(row);
  }catch(e){
    const local=alinV64LocalSettlements();
    local.unshift(row);
    alinV64SaveLocalSettlements(local);
  }
  await audit('finance','تثبيت تسوية مكتبة '+(lib.name||libraryId)+' سند '+receipt+' مبلغ '+amount);
  toast('تم تثبيت التسوية وتحديث حساب المكتبة');
  await load();
  renderFinanceAdmin();
}

function alinV67SumLibraryProfitBalances(){
  return (db.accounts?.libraries||[]).reduce((a,l)=>a+(+alinV65Balance('library',l.id).remaining||0),0);
}

function alinV67SumLibrarySettlementDebt(){
  return (db.accounts?.libraries||[]).reduce((a,l)=>a+(+alinV64LibraryDebt(l.id).remaining||0),0);
}

function alinV67LibrarySettlementRows(){
  const libs=(db.accounts?.libraries||[]);
  return libs.map(l=>{
    const d=alinV64LibraryDebt(l.id);
    return `<div class="row settlement-row"><div><b>${esc(l.name||'مكتبة')}</b>
      <small>إجمالي المطلوب ${money(d.owed)} د.ع — المسدد ${money(d.paid)} د.ع — المتبقي ${money(d.remaining)} د.ع</small></div>
      <div class="row-actions"><button ${d.remaining<=0?'disabled':''} onclick="alinV64AdminSettleLibrary('${l.id}')">تثبيت تسوية</button></div></div>`;
  }).join('') || emptyState('لا توجد مكتبات');
}
window.AlinLibraryModules['recordLibrarySettlement']=typeof recordLibrarySettlement==='function'?recordLibrarySettlement:window['recordLibrarySettlement'];window['recordLibrarySettlement']=window.AlinLibraryModules['recordLibrarySettlement'];
window.AlinLibraryModules['reverseLibrarySettlement']=typeof reverseLibrarySettlement==='function'?reverseLibrarySettlement:window['reverseLibrarySettlement'];window['reverseLibrarySettlement']=window.AlinLibraryModules['reverseLibrarySettlement'];
window.AlinLibraryModules['printLibrarySettlement']=typeof printLibrarySettlement==='function'?printLibrarySettlement:window['printLibrarySettlement'];window['printLibrarySettlement']=window.AlinLibraryModules['printLibrarySettlement'];
window.AlinLibraryModules['settlementRowsForLibrary']=typeof settlementRowsForLibrary==='function'?settlementRowsForLibrary:window['settlementRowsForLibrary'];window['settlementRowsForLibrary']=window.AlinLibraryModules['settlementRowsForLibrary'];
window.AlinLibraryModules['printLibraryStatement']=typeof printLibraryStatement==='function'?printLibraryStatement:window['printLibraryStatement'];window['printLibraryStatement']=window.AlinLibraryModules['printLibraryStatement'];
window.AlinLibraryModules['alinV63LibraryDebt']=typeof alinV63LibraryDebt==='function'?alinV63LibraryDebt:window['alinV63LibraryDebt'];window['alinV63LibraryDebt']=window.AlinLibraryModules['alinV63LibraryDebt'];
window.AlinLibraryModules['alinV63PayLibrarySettlement']=typeof alinV63PayLibrarySettlement==='function'?alinV63PayLibrarySettlement:window['alinV63PayLibrarySettlement'];window['alinV63PayLibrarySettlement']=window.AlinLibraryModules['alinV63PayLibrarySettlement'];
window.AlinLibraryModules['alinV64LibraryDebt']=typeof alinV64LibraryDebt==='function'?alinV64LibraryDebt:window['alinV64LibraryDebt'];window['alinV64LibraryDebt']=window.AlinLibraryModules['alinV64LibraryDebt'];
window.AlinLibraryModules['alinV64AdminSettleLibrary']=typeof alinV64AdminSettleLibrary==='function'?alinV64AdminSettleLibrary:window['alinV64AdminSettleLibrary'];window['alinV64AdminSettleLibrary']=window.AlinLibraryModules['alinV64AdminSettleLibrary'];
window.AlinLibraryModules['alinV67SumLibraryProfitBalances']=typeof alinV67SumLibraryProfitBalances==='function'?alinV67SumLibraryProfitBalances:window['alinV67SumLibraryProfitBalances'];window['alinV67SumLibraryProfitBalances']=window.AlinLibraryModules['alinV67SumLibraryProfitBalances'];
window.AlinLibraryModules['alinV67SumLibrarySettlementDebt']=typeof alinV67SumLibrarySettlementDebt==='function'?alinV67SumLibrarySettlementDebt:window['alinV67SumLibrarySettlementDebt'];window['alinV67SumLibrarySettlementDebt']=window.AlinLibraryModules['alinV67SumLibrarySettlementDebt'];
window.AlinLibraryModules['alinV67LibrarySettlementRows']=typeof alinV67LibrarySettlementRows==='function'?alinV67LibrarySettlementRows:window['alinV67LibrarySettlementRows'];window['alinV67LibrarySettlementRows']=window.AlinLibraryModules['alinV67LibrarySettlementRows'];

/* ===== library/js/library-finance-v120.js ===== */
/* V120 - library collected cash, profit, debt and admin settlement */
(function(){
  const arr=v=>Array.isArray(v)?v:[];
  const n=v=>Number(v||0);
  const eq=(a,b)=>String(a??'')===String(b??'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');

  function dbx(){return window.db||{accounts:{libraries:[]},orders:[],ledger:[]}}
  function allSettlements(){
    let rows=[];
    try{ if(typeof librarySettlements!=='undefined' && Array.isArray(librarySettlements)) rows=rows.concat(librarySettlements); }catch(_){ }
    rows=rows.concat(arr(dbx().library_settlements));
    try{ rows=rows.concat(JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]')); }catch(_){ }
    const seen=new Set();
    return rows.filter(x=>{const k=String(x.id||x.receipt_number||JSON.stringify(x));if(seen.has(k))return false;seen.add(k);return true});
  }
  function validSettlementAmount(x){
    const s=String(x.status||'received').toLowerCase();
    if(['reversed','cancelled','rejected'].includes(s))return 0;
    if(s==='reversal')return -Math.abs(n(x.amount));
    if(['received','paid','completed','approved'].includes(s))return Math.abs(n(x.amount));
    return 0;
  }
  function isLibraryPickupLedger(row){
    const o=arr(dbx().orders).find(x=>eq(x.id,row.order_id));
    const f=String(o?.fulfillment_type||row.delivery_type||'pickup').toLowerCase();
    return !['delivery','home_delivery','courier','delegate'].includes(f);
  }
  function rowGross(row){
    if(n(row.total)>0)return n(row.total);
    return n(row.gross)||n(row.admin||row.alin)+n(row.teacher)+n(row.library||row.library_amount)+n(row.delegate);
  }
  function rowLibraryProfit(row){return n(row.library||row.library_amount)}
  function rowDebt(row){return Math.max(0,rowGross(row)-rowLibraryProfit(row))}

  function summary(libraryId){
    const rows=arr(dbx().ledger)
      .filter(x=>eq(x.library_id,libraryId)&&String(x.settlement_status||'')!=='cancelled'&&isLibraryPickupLedger(x))
      .map(x=>{
        const order=arr(dbx().orders).find(o=>eq(o.id,x.order_id))||{};
        return {...x,title:x.title||order.title||'',gross:rowGross(x),libraryProfit:rowLibraryProfit(x),debt:rowDebt(x),created_at:x.created_at||order.updated_at||order.created_at||''};
      })
      .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const settlements=allSettlements().filter(x=>eq(x.library_id,libraryId));
    const gross=rows.reduce((a,x)=>a+x.gross,0);
    const libraryProfit=rows.reduce((a,x)=>a+x.libraryProfit,0);
    const debtTotal=rows.reduce((a,x)=>a+x.debt,0);
    const settled=Math.max(0,settlements.reduce((a,x)=>a+validSettlementAmount(x),0));
    const month=new Date().toISOString().slice(0,7);
    const monthProfit=rows.filter(x=>String(x.created_at||'').slice(0,7)===month).reduce((a,x)=>a+x.libraryProfit,0);
    return {gross,libraryProfit,debtTotal,settled,debtRemaining:Math.max(0,debtTotal-settled),monthProfit,rows,settlements:settlements.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))};
  }

  async function settleLibrary(libraryId){
    const lib=arr(dbx().accounts?.libraries).find(x=>eq(x.id,libraryId))||{};
    const f=summary(libraryId);
    if(f.debtRemaining<=0)return alert('لا يوجد مبلغ بذمة هذه المكتبة');
    const raw=prompt(`المتبقي بذمة ${lib.name||'المكتبة'} هو ${moneyx(f.debtRemaining)} د.ع\nاكتب مبلغ التسوية المستلم`,String(f.debtRemaining));
    if(raw===null)return;
    const amount=n(String(raw).replace(/[,،]/g,''));
    if(amount<=0||amount>f.debtRemaining)return alert('المبلغ غير صحيح أو أكبر من المتبقي');
    const method=prompt('طريقة الاستلام','نقدي')||'نقدي';
    const receipt='LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
    const row={id:typeof uid==='function'?uid('LS'):'LS-'+Date.now(),receipt_number:receipt,library_id:libraryId,amount,payment_method:method,status:'received',note:'تصفية ذمة مكتبة من لوحة المدير',created_at:new Date().toISOString()};
    let saved=false;
    try{ if(typeof insert==='function'){await insert('library_settlements',row);saved=true;} }catch(e){console.warn('library_settlements insert failed',e)}
    if(!saved){
      try{const local=JSON.parse(localStorage.getItem('alin_v63_library_settlements')||'[]');local.unshift(row);localStorage.setItem('alin_v63_library_settlements',JSON.stringify(local));saved=true;}catch(_){ }
    }
    try{if(typeof librarySettlements!=='undefined'&&Array.isArray(librarySettlements))librarySettlements.unshift(row)}catch(_){ }
    dbx().library_settlements=dbx().library_settlements||[];dbx().library_settlements.unshift(row);
    if(typeof audit==='function')await audit('finance',`تصفية مكتبة ${lib.name||libraryId} بمبلغ ${amount} — سند ${receipt}`);
    if(typeof load==='function')try{await load()}catch(_){ }
    alert(amount===f.debtRemaining?'تمت تصفية الحساب وأصبحت ذمة المكتبة صفراً':'تم تسجيل التسوية وتحديث المبلغ المتبقي');
    if(typeof renderFinanceAdmin==='function')renderFinanceAdmin();
  }


  function adminSection(){
    const libs=arr(dbx().accounts?.libraries);
    return `<section class="admin-v120-library-settlements"><div class="admin-v120-head"><div><h3>تسويات ذمم المكتبات</h3><p>عند تسليم الطلب تحتفظ المكتبة بربحها، ويبقى باقي المبلغ بذمتها حتى تثبيت التصفية.</p></div></div><div class="admin-v120-settlement-list">${libs.map(l=>{const f=summary(l.id);return `<article><div><b>${escx(l.name||'مكتبة')}</b><small>مبيعات مستلمة ${moneyx(f.gross)} د.ع — ربح المكتبة ${moneyx(f.libraryProfit)} د.ع</small></div><div class="admin-v120-values"><span>الذمة الأصلية <b>${moneyx(f.debtTotal)}</b></span><span>المسدد <b>${moneyx(f.settled)}</b></span><span class="remain">المتبقي <b>${moneyx(f.debtRemaining)}</b></span></div><button ${f.debtRemaining<=0?'disabled':''} onclick="AlinV120Finance.settle('${escx(l.id)}')">${f.debtRemaining<=0?'الحساب مصفّى':'تصفية الحساب'}</button></article>`}).join('')||'<div class="empty">لا توجد مكتبات</div>'}</div></section>`;
  }

  const oldRenderFinance=window.renderFinanceAdmin;
  if(typeof oldRenderFinance==='function'){
    window.renderFinanceAdmin=renderFinanceAdmin=function(){
      oldRenderFinance.apply(this,arguments);
      const root=document.getElementById('adminContent');
      if(root&&!root.querySelector('.admin-v120-library-settlements'))root.insertAdjacentHTML('beforeend',adminSection());
    };
  }

  window.AlinV120Finance={summary,settle:settleLibrary};
  window.AlinLibraryModules=window.AlinLibraryModules||{};
})();

/* ===== library/js/library-finance-v121.js ===== */

/* V121 - complete library finance suite */
(function(){
  const arr=v=>Array.isArray(v)?v:[]; const n=v=>Number(v||0); const eq=(a,b)=>String(a??'')===String(b??'');
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyx=v=>typeof money==='function'?money(v):n(v).toLocaleString('ar-IQ'); const dbx=()=>window.db||{};
  const localGet=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d}};
  const localSet=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function settlements(){const rows=[...arr(dbx().library_settlements),...localGet('alin_v63_library_settlements')];const seen=new Set();return rows.filter(x=>{const k=String(x.id||x.receipt_number);if(seen.has(k))return false;seen.add(k);return true})}
  function ledgerRows(libraryId){return arr(dbx().ledger).filter(x=>eq(x.library_id,libraryId)&&String(x.settlement_status||'')!=='cancelled').map(x=>{const o=arr(dbx().orders).find(y=>eq(y.id,x.order_id))||{};const gross=n(x.total)||n(x.gross)||n(x.admin||x.alin)+n(x.teacher)+n(x.library||x.library_amount)+n(x.delegate);const profit=n(x.library||x.library_amount);const reversal=n(x.reversal_amount||0);return {...x,order:o,gross,profit,debt:Math.max(0,gross-profit),reversal,at:x.created_at||o.updated_at||o.created_at||''}}).sort((a,b)=>String(b.at).localeCompare(String(a.at)))}
  function settlementValue(s){const st=String(s.status||'received').toLowerCase();if(['cancelled','rejected','reversed'].includes(st))return 0;if(st==='reversal')return -Math.abs(n(s.amount));return Math.abs(n(s.amount))}
  function summary(libraryId,period='all'){
    let rows=ledgerRows(libraryId); const now=new Date(); if(period==='day')rows=rows.filter(x=>String(x.at).slice(0,10)===now.toISOString().slice(0,10)); if(period==='month')rows=rows.filter(x=>String(x.at).slice(0,7)===now.toISOString().slice(0,7));
    const ss=settlements().filter(x=>eq(x.library_id,libraryId));const gross=rows.reduce((a,x)=>a+x.gross-x.reversal,0),profit=rows.reduce((a,x)=>a+x.profit-Math.min(x.profit,x.reversal),0),debt=rows.reduce((a,x)=>a+x.debt-Math.max(0,x.reversal-Math.min(x.profit,x.reversal)),0),paid=ss.reduce((a,x)=>a+settlementValue(x),0);return {rows,settlements:ss,gross,profit,debtTotal:Math.max(0,debt),settled:Math.max(0,paid),remaining:Math.max(0,debt-paid)}
  }
  function libraryId(){try{const c=window.current||{};const libs=arr(dbx().accounts?.libraries);const l=libs.find(x=>eq(x.id,c.library_id||c.id)||eq(x.username,c.username));return l?.id||c.library_id||c.id||''}catch(_){return''}}
  function libraryName(id){return arr(dbx().accounts?.libraries).find(x=>eq(x.id,id))?.name||'المكتبة'}
  function threshold(){return Math.max(0,n(localStorage.getItem('alin_v121_debt_threshold')||500000))}
  function auditLocal(action,details,meta={}){const rows=localGet('alin_v121_finance_audit');rows.unshift({id:'FA-'+Date.now(),action,details,actor:window.alinAccountantSession?'المحاسب':(window.current?.name||window.current?.role||'مستخدم'),created_at:new Date().toISOString(),...meta});localSet('alin_v121_finance_audit',rows.slice(0,1000));try{if(typeof audit==='function')audit('finance',details)}catch(_){}}
  function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},400)}
  function exportExcel(id,period='all'){const f=summary(id,period), rows=[['رقم الطلب','التاريخ','المبلغ المستلم','ربح المكتبة','الذمة','الحالة']];f.rows.forEach(x=>rows.push([x.order.order_number||x.order_id,x.at,x.gross,x.profit,x.debt,x.order.status||'']));rows.push([]);rows.push(['إجمالي المستلم',f.gross]);rows.push(['إجمالي الربح',f.profit]);rows.push(['الذمة',f.debtTotal]);rows.push(['المسدد',f.settled]);rows.push(['المتبقي',f.remaining]);const html='<html><meta charset="utf-8"><table>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+escx(c)+'</td>').join('')+'</tr>').join('')+'</table></html>';download('كشف-حساب-'+libraryName(id)+'.xls',html,'application/vnd.ms-excel;charset=utf-8');auditLocal('export_excel','تصدير كشف حساب Excel للمكتبة '+libraryName(id),{library_id:id})}
  function printReport(id,period='all'){const f=summary(id,period),w=window.open('','_blank','width=900,height=800');if(!w)return alert('اسمح بالنوافذ المنبثقة للطباعة');w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>كشف حساب</title><style>body{font-family:Tahoma;padding:30px}h1{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}.sum{margin-top:20px;padding:15px;border:2px solid #111}</style></head><body><h1>كشف حساب ${escx(libraryName(id))}</h1><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المستلم</th><th>الربح</th><th>الذمة</th></tr></thead><tbody>${f.rows.map(x=>`<tr><td>${escx(x.order.order_number||x.order_id)}</td><td>${escx(x.at)}</td><td>${moneyx(x.gross)}</td><td>${moneyx(x.profit)}</td><td>${moneyx(x.debt)}</td></tr>`).join('')}</tbody></table><div class="sum">الإجمالي المستلم: ${moneyx(f.gross)} د.ع<br>ربح المكتبة: ${moneyx(f.profit)} د.ع<br>المتبقي بذمتها: ${moneyx(f.remaining)} د.ع</div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();auditLocal('export_pdf','طباعة/حفظ PDF لكشف حساب المكتبة '+libraryName(id),{library_id:id})}
  function receiptHtml(row){const remain=summary(row.library_id).remaining;return `<div class="v121-receipt"><div class="v121-receipt-head"><h2>منصة آلين</h2><p>سند قبض تسوية مكتبة</p></div><div class="v121-receipt-grid"><div class="v121-receipt-line"><span>رقم السند</span><b>${escx(row.receipt_number)}</b></div><div class="v121-receipt-line"><span>التاريخ</span><b>${escx(new Date(row.created_at).toLocaleString('ar-IQ'))}</b></div><div class="v121-receipt-line"><span>المكتبة</span><b>${escx(libraryName(row.library_id))}</b></div><div class="v121-receipt-line"><span>طريقة الاستلام</span><b>${escx(row.payment_method||'نقدي')}</b></div></div><div class="v121-receipt-line"><span>المبلغ المستلم</span><b>${moneyx(row.amount)} د.ع</b></div><div class="v121-receipt-line"><span>الرصيد المتبقي</span><b>${moneyx(remain)} د.ع</b></div><p>${escx(row.note||'تسوية ذمة المكتبة')}</p><button class="no-print" onclick="window.print()">طباعة السند</button></div>`}
  function showReceipt(row){if(window.checkoutBox&&window.checkoutModal){checkoutBox.innerHTML=receiptHtml(row);checkoutModal.classList.remove('hidden')}}
  async function settle(id){const f=summary(id);if(f.remaining<=0)return alert('لا توجد ذمة مستحقة');const raw=prompt(`المتبقي ${moneyx(f.remaining)} د.ع\nاكتب مبلغ التسوية الجزئية أو الكاملة`,String(f.remaining));if(raw===null)return;const amount=n(String(raw).replace(/[,،]/g,''));if(amount<=0||amount>f.remaining)return alert('المبلغ غير صحيح');const method=prompt('طريقة الاستلام','نقدي')||'نقدي';const row={id:'LS-'+Date.now(),receipt_number:'LS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),library_id:id,amount,payment_method:method,status:'received',note:'تسوية '+(amount===f.remaining?'كاملة':'جزئية')+' لذمة المكتبة',created_at:new Date().toISOString()};let saved=false;try{if(typeof insert==='function'){await insert('library_settlements',row);saved=true}}catch(e){console.warn(e)}if(!saved){const ls=localGet('alin_v63_library_settlements');ls.unshift(row);localSet('alin_v63_library_settlements',ls)}dbx().library_settlements=dbx().library_settlements||[];dbx().library_settlements.unshift(row);auditLocal('settlement',`تسوية ${libraryName(id)} بمبلغ ${amount}`,{library_id:id,amount,receipt_number:row.receipt_number});showReceipt(row);try{if(typeof load==='function')await load()}catch(_){}}
  function reverseOrder(id,reason){const o=arr(dbx().orders).find(x=>eq(x.id,id));if(!o)return;const rows=arr(dbx().ledger).filter(x=>eq(x.order_id,id));if(!rows.length)return;rows.forEach(x=>{if(x.reversal_amount)return;const rev={...x,id:'REV-'+Date.now()+'-'+Math.random().toString(36).slice(2,5),gross:-Math.abs(n(x.gross||x.total)),total:-Math.abs(n(x.total||x.gross)),admin:-Math.abs(n(x.admin||x.alin)),alin:-Math.abs(n(x.alin||x.admin)),teacher:-Math.abs(n(x.teacher)),library:-Math.abs(n(x.library||x.library_amount)),library_amount:-Math.abs(n(x.library_amount||x.library)),delegate:-Math.abs(n(x.delegate)),settlement_status:'reversal',reversal_of:x.id,note:'عكس مالي بسبب إلغاء/استرجاع: '+reason,created_at:new Date().toISOString()};dbx().ledger.push(rev);try{if(typeof insert==='function')insert('ledger',rev)}catch(_){}});auditLocal('reversal','عكس مالي للطلب '+(o.order_number||id)+' — '+reason,{order_id:id})}
  function enhanceLibrary(){const root=document.getElementById('libraryV116Content');if(!root||!root.querySelector('.library-v120-finance-cards')||root.querySelector('.v121-toolbar'))return;const id=libraryId(),f=summary(id),limit=threshold();const alert=f.remaining>=limit&&limit>0?`<div class="v121-alert">تنبيه: ذمة المكتبة بلغت ${moneyx(f.remaining)} د.ع وتجاوزت الحد المحدد ${moneyx(limit)} د.ع.</div>`:`<div class="v121-alert v121-ok">الوضع المالي ضمن الحد المحدد.</div>`;const rows=f.rows.map(x=>`<tr><td>${escx(x.order.order_number||x.order_id)}</td><td>${escx(String(x.at).slice(0,10))}</td><td>${moneyx(x.gross)}</td><td class="v121-positive">${moneyx(x.profit)}</td><td class="v121-negative">${moneyx(x.debt)}</td><td>${escx(x.order.status||'')}</td></tr>`).join('');root.insertAdjacentHTML('afterbegin',`<div class="v121-toolbar"><div><b>كشف الحساب المالي</b><small> تفاصيل كل طلب وتسوية محفوظة</small></div><div class="actions"><button onclick="AlinV121.exportExcel('${escx(id)}')">تصدير Excel</button><button onclick="AlinV121.printReport('${escx(id)}')">طباعة / PDF</button></div></div>${alert}<section class="library-v116-panel"><h3>كشف حساب مفصل</h3><div class="v121-statement"><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المستلم</th><th>ربح المكتبة</th><th>الذمة</th><th>الحالة</th></tr></thead><tbody>${rows||'<tr><td colspan="6">لا توجد حركات</td></tr>'}</tbody></table></div></section>`)}
  function adminSuite(){const root=document.getElementById('adminContent');if(!root||root.querySelector('.v121-admin-suite'))return;const libs=arr(dbx().accounts?.libraries),limit=threshold();const warnings=libs.filter(l=>summary(l.id).remaining>=limit&&limit>0);const auditRows=localGet('alin_v121_finance_audit').slice(0,30);root.insertAdjacentHTML('beforeend',`<section class="v121-admin-suite"><div class="v121-admin-card"><h3>إعدادات الذمم والتنبيهات</h3>${warnings.length?`<div class="v121-alert">${warnings.length} مكتبة تجاوزت حد الذمة المحدد.</div>`:'<div class="v121-alert v121-ok">لا توجد مكتبات متجاوزة للحد.</div>'}<div class="v121-setting-row"><label>حد تنبيه ذمة المكتبة<input id="v121Threshold" type="number" value="${limit}"></label><button onclick="AlinV121.saveThreshold()">حفظ الحد</button></div></div><div class="v121-admin-card"><h3>تقارير المكتبات</h3><div class="v121-statement"><table><thead><tr><th>المكتبة</th><th>اليوم</th><th>الشهر</th><th>الذمة الحالية</th><th>الإجراءات</th></tr></thead><tbody>${libs.map(l=>{const d=summary(l.id,'day'),m=summary(l.id,'month'),a=summary(l.id);return `<tr><td>${escx(l.name)}</td><td>${moneyx(d.gross)}</td><td>${moneyx(m.gross)}</td><td class="${a.remaining? 'v121-negative':'v121-positive'}">${moneyx(a.remaining)}</td><td><button onclick="AlinV121.settle('${escx(l.id)}')">تسوية جزئية</button> <button onclick="AlinV121.exportExcel('${escx(l.id)}')">Excel</button> <button onclick="AlinV121.printReport('${escx(l.id)}')">PDF</button></td></tr>`}).join('')}</tbody></table></div></div><div class="v121-admin-card"><h3>صلاحية المحاسب</h3><p class="v121-accountant-note">يُنشأ حساب المحاسب من قسم إدارة الحسابات بنظام الدخول الآمن، وتقتصر صلاحياته على المالية والتسويات والتقارير.</p><button onclick="adminTab('accounts')">فتح إدارة الحسابات</button></div><div class="v121-admin-card"><h3>سجل التدقيق المالي</h3><div class="v121-audit-list">${auditRows.map(x=>`<div class="v121-audit-row"><div><b>${escx(x.details)}</b><small>${escx(x.actor)} — ${escx(x.created_at)}</small></div><span>${escx(x.action)}</span></div>`).join('')||'لا توجد حركات بعد'}</div></div></section>`)}
  function saveThreshold(){const el=document.getElementById('v121Threshold');localStorage.setItem('alin_v121_debt_threshold',String(Math.max(0,n(el?.value))));auditLocal('settings','تحديث حد تنبيه ذمة المكتبات');alert('تم حفظ الحد');if(typeof renderFinanceAdmin==='function')renderFinanceAdmin()}
  function saveAccountant(){alert('أنشئ أو عدّل حساب المحاسب من قسم إدارة الحسابات الآمن')}
  function accountantLogin(){pendingRole='accountant';loginForm.classList.remove('hidden');loginMsg.textContent='';loginU.value='';loginPass.value='';loginU.focus()}
  function install(){
    document.querySelectorAll('.login-actions').forEach(box=>{if(!box.querySelector('[data-v121-accountant]')){const b=document.createElement('button');b.type='button';b.dataset.v121Accountant='1';b.textContent='دخول المحاسب';b.onclick=accountantLogin;box.appendChild(b)}});
    const oldRF=window.renderFinanceAdmin;if(typeof oldRF==='function')window.renderFinanceAdmin=function(){oldRF.apply(this,arguments);adminSuite()};
    if(window.AlinV120Finance)window.AlinV120Finance.settle=settle;
    if(window.AlinLibraryV116?.cancel){const old=window.AlinLibraryV116.cancel;window.AlinLibraryV116.cancel=async function(id){const o=arr(dbx().orders).find(x=>eq(x.id,id));const before=String(o?.status||'');await old(id);if(['completed','delivered'].includes(before)&&String(o?.status)==='cancelled')reverseOrder(id,o.cancel_reason||'إلغاء طلب')}}
    document.addEventListener('click',e=>{if(e.target.closest('[data-library-tab]'))setTimeout(enhanceLibrary,60)});setTimeout(enhanceLibrary,100);
  }
  window.AlinV121={summary,settle,exportExcel,printReport,showReceipt,saveThreshold,saveAccountant,accountantLogin,reverseOrder};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;
