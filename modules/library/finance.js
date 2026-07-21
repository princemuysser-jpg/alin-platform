/* ALIN v2.2.5 — library finance views backed only by AlinFinance. */
(function(){
  'use strict';
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  const arr=value=>Array.isArray(value)?value:[];
  const same=(a,b)=>String(a??'')===String(b??'');
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Math.round(Number(value)||0).toLocaleString('ar-IQ');
  const database=()=>window.db||{};
  const finance=()=>window.AlinFinance;

  function currentLibraryId(){
    const account=window.current||{};
    const libraries=arr(database().accounts?.libraries);
    const row=libraries.find(item=>[account.id,account.library_id,account.account_id,account.user_id].filter(Boolean).some(id=>same(item.id,id)||same(item.account_id,id)||same(item.user_id,id)))
      ||libraries.find(item=>account.username&&same(item.username,account.username));
    return String(row?.id||account.library_id||account.id||'');
  }

  function summary(libraryId=currentLibraryId()){
    return finance()?.librarySummary?.(libraryId)||{rows:[],settlements:[],gross:0,profit:0,libraryProfit:0,debtTotal:0,settled:0,remaining:0,debtRemaining:0,monthProfit:0};
  }

  function libraryName(id){return arr(database().accounts?.libraries).find(row=>same(row.id,id))?.name||window.current?.name||'المكتبة'}

  function statementRows(id){
    return summary(id).rows.map(row=>`<tr><td>${escv(row.order?.order_number||row.order_number||row.order_id)}</td><td>${escv(String(row.at||'').slice(0,10)||'-')}</td><td>${moneyv(row.gross)} د.ع</td><td>${moneyv(row.profit)} د.ع</td><td>${moneyv(row.debt)} د.ع</td></tr>`).join('')||'<tr><td colspan="5">لا توجد حركات مالية.</td></tr>';
  }

  function printLibraryStatement(libraryId=currentLibraryId()){
    const data=summary(libraryId);
    const html=`<div class="receipt"><h2>كشف حساب المكتبة</h2><p>${escv(libraryName(libraryId))}</p><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المبلغ</th><th>ربح المكتبة</th><th>الذمة</th></tr></thead><tbody>${statementRows(libraryId)}</tbody></table><h3>ربح المكتبة: ${moneyv(data.libraryProfit)} د.ع</h3><h3>المسدد: ${moneyv(data.settled)} د.ع</h3><h3>المتبقي بذمة المكتبة: ${moneyv(data.debtRemaining)} د.ع</h3></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    if(window.checkoutBox&&window.checkoutModal){window.checkoutBox.innerHTML=html;window.checkoutModal.classList.remove('hidden');return true}
    return false;
  }

  function exportLibraryStatement(libraryId=currentLibraryId()){
    const data=summary(libraryId);
    const rows=[['رقم الطلب','التاريخ','المبلغ','ربح المكتبة','الذمة'],...data.rows.map(row=>[row.order?.order_number||row.order_number||row.order_id,String(row.at||'').slice(0,10),row.gross,row.profit,row.debt]),[],['ربح المكتبة',data.libraryProfit],['المسدد',data.settled],['المتبقي',data.debtRemaining]];
    const csv='\ufeff'+rows.map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download=`library-finance-${libraryId}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }

  function printLibrarySettlement(id){
    const row=summary().settlements.find(item=>same(item.id,id)||same(item.receipt_number,id));if(!row)return false;
    const html=`<div class="receipt"><h2>منصة آلين</h2><h3>سند قبض تسوية مكتبة</h3><p>رقم السند: ${escv(row.receipt_number||row.id)}</p><p>المكتبة: ${escv(libraryName(row.library_id))}</p><p>المبلغ: ${moneyv(row.amount)} د.ع</p><p>طريقة الاستلام: ${escv(row.payment_method||'نقدي')}</p><p>التاريخ: ${escv(String(row.created_at||'').slice(0,10))}</p></div><div class="row-actions no-print"><button onclick="window.print()">طباعة</button><button class="secondary" onclick="closeCheckout()">إغلاق</button></div>`;
    if(window.checkoutBox&&window.checkoutModal){window.checkoutBox.innerHTML=html;window.checkoutModal.classList.remove('hidden');return true}return false;
  }

  async function reverseLibrarySettlement(id){
    const row=summary().settlements.find(item=>same(item.id,id)||same(item.receipt_number,id));
    if(!row||!window.confirm('إلغاء أثر سند التسوية؟'))return false;
    if(typeof window.update!=='function')throw new Error('خدمة تحديث التسوية غير جاهزة');
    await window.update('library_settlements',{status:'reversed',updated_at:new Date().toISOString()},{id:row.id});
    if(typeof window.audit==='function')await window.audit('finance',`عكس سند تسوية ${row.receipt_number||row.id}`);
    if(typeof window.load==='function')await window.load();
    return true;
  }

  function renderLibraryFinance(){
    const root=document.getElementById('libraryV116Content')||document.getElementById('libraryContent');if(!root)return false;
    const id=currentLibraryId(),data=summary(id);
    root.innerHTML=`<section class="library-v116-finance"><div class="library-v116-finance-cards"><article><small>المبيعات المستلمة</small><b>${moneyv(data.gross)} د.ع</b></article><article><small>ربح المكتبة</small><b>${moneyv(data.libraryProfit)} د.ع</b></article><article><small>المسدد للإدارة</small><b>${moneyv(data.settled)} د.ع</b></article><article><small>المتبقي بذمة المكتبة</small><b>${moneyv(data.debtRemaining)} د.ع</b></article></div><div class="row-actions"><button onclick="printLibraryStatement('${escv(id)}')">طباعة كشف الحساب</button><button class="secondary" onclick="exportLibraryStatement('${escv(id)}')">تصدير CSV</button></div><div class="library-v116-panel"><h3>تفاصيل الحركات</h3><table><thead><tr><th>الطلب</th><th>التاريخ</th><th>المبلغ</th><th>ربح المكتبة</th><th>الذمة</th></tr></thead><tbody>${statementRows(id)}</tbody></table></div></section>`;
    return true;
  }

  window.printLibraryStatement=printLibraryStatement;
  window.exportLibraryStatement=exportLibraryStatement;
  window.printLibrarySettlement=printLibrarySettlement;
  window.reverseLibrarySettlement=reverseLibrarySettlement;
  window.renderLibraryFinance=renderLibraryFinance;
  window.AlinLibraryModules.printLibraryStatement=printLibraryStatement;
  window.AlinLibraryModules.renderLibraryFinance=renderLibraryFinance;
  window.AlinV120Finance=window.AlinV120Finance||{summary,settle:id=>finance()?.settleLibrary?.(id)};
})();
