// === library/orders.js ===
/* ALIN v2.2.5 — authoritative library order workflow. */
(function(){
  'use strict';
  const modules=window.AlinLibraryModules=window.AlinLibraryModules||{};
  const allowed={
    new:['processing','cancelled'],
    pending:['processing','cancelled'],
    accepted:['processing','cancelled'],
    processing:['ready','cancelled'],
    printing:['ready','cancelled'],
    ready:['completed','delivered','cancelled'],
    completed:[],
    delivered:[],
    cancelled:[],
    canceled:[]
  };
  const normalize=status=>String(status||'new').toLowerCase()==='canceled'?'cancelled':String(status||'new').toLowerCase();

  function findOrder(id){return (window.db?.orders||[]).find(row=>String(row.id)===String(id));}
  function currentLibraryId(){return String(window.current?.role==='library'?(window.current.id||window.current.library_id||''):'');}
  function ownsOrder(order){
    const id=currentLibraryId();
    if(!id)return false;
    return [order?.library_id,order?.pickup_library_id,order?.assigned_library_id].some(value=>String(value||'')===id);
  }
  function canMove(from,to){
    const source=normalize(from),target=normalize(to);
    return source===target||Boolean(allowed[source]?.includes(target));
  }

  async function libraryOrderStatus(id,status){
    const order=findOrder(id);
    if(!order)throw new Error('الطلب غير موجود');
    if(window.current?.role==='library'&&!ownsOrder(order))throw new Error('هذا الطلب غير مسند إلى مكتبتك');
    const target=normalize(status),source=normalize(order.status);
    if(!canMove(source,target))throw new Error('لا يمكن نقل الطلب من '+source+' إلى '+target);
    if(source===target)return order;

    const now=new Date().toISOString();
    const history=[...(Array.isArray(order.status_history)?order.status_history:[]),{status:target,at:now,by:window.current?.id||'library'}];
    const payload={status:target,status_history:history,updated_at:now};
    if(target==='processing')payload.processing_at=now;
    if(target==='ready')payload.ready_at=now;
    if(['completed','delivered'].includes(target)){
      payload.completed_at=order.completed_at||now;
      payload.delivered_at=order.delivered_at||now;
      payload.payment_status='paid';
    }
    if(target==='cancelled')payload.cancelled_at=now;

    await update('orders',payload,{id:order.id});
    Object.assign(order,payload);
    if(['completed','delivered'].includes(target)&&typeof ensureOrderFinancials==='function')await ensureOrderFinancials(order);
    if(typeof audit==='function')await audit('order',`المكتبة حدثت الطلب ${order.order_number||order.id} من ${source} إلى ${target}`);
    if(typeof load==='function')await load();
    else modules.renderLibrary?.();
    return order;
  }

  async function cancelLibraryOrder(id,reason){
    const text=String(reason||'').trim();
    if(!text)throw new Error('اكتب سبب الإلغاء');
    const order=findOrder(id);
    if(!order)throw new Error('الطلب غير موجود');
    const now=new Date().toISOString();
    const history=[...(Array.isArray(order.status_history)?order.status_history:[]),{status:'cancelled',at:now,by:window.current?.id||'library',reason:text}];
    const payload={status:'cancelled',cancel_reason:text,cancelled_at:now,status_history:history,updated_at:now};
    await update('orders',payload,{id:order.id});
    Object.assign(order,payload);
    if(typeof audit==='function')await audit('order',`المكتبة ألغت الطلب ${order.order_number||order.id}: ${text}`);
    if(typeof load==='function')await load();
    else modules.renderLibrary?.();
  }

  function selectedLibraryLine(){
    const select=document.getElementById('libSelect');
    const info=document.getElementById('libInfo');
    if(!select||!info)return;
    const library=(window.db?.accounts?.libraries||[]).find(row=>String(row.id)===String(select.value));
    if(!library){info.innerHTML='';return;}
    const open=typeof libIsOpen==='function'?libIsOpen(library):library.is_open!==false;
    const escape=value=>typeof esc==='function'?esc(value):String(value??'');
    info.innerHTML=`<div class="library-one-line"><b>${escape(library.name)}</b><span class="${open?'open-badge':'closed-badge'}">${open?'مفتوح':'مغلق'}</span><small>${escape(library.area||'')}${library.landmark?' — '+escape(library.landmark):''}</small></div>`;
  }

  function alinLibraryOptions(){
    const libraries=typeof alinOpenLibraries==='function'?alinOpenLibraries():(window.db?.accounts?.libraries||[]).filter(row=>row.status!=='disabled'&&row.is_open!==false);
    const escape=value=>typeof esc==='function'?esc(value):String(value??'');
    return libraries.map(row=>`<option value="${escape(row.id)}">${escape(row.name)} - مفتوح</option>`).join('');
  }

  window.libraryOrderStatus=libraryOrderStatus;
  window.cancelLibraryOrder=cancelLibraryOrder;
  window.selectedLibraryLine=selectedLibraryLine;
  window.alinLibraryOptions=alinLibraryOptions;
  modules.libraryOrderStatus=libraryOrderStatus;
  modules.cancelLibraryOrder=cancelLibraryOrder;
  modules.selectedLibraryLine=selectedLibraryLine;
  modules.alinLibraryOptions=alinLibraryOptions;
})();
