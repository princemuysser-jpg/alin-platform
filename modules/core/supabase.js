// === core/supabase.js ===
/* ===== core/js/supabase-final-integration-rc5.js ===== */
/* منصة آلين RC5 - طبقة الربط النهائي مع Supabase
   - تحافظ على التوافق مع الواجهة الحالية.
   - تضيف مزامنة سحابية، إعادة محاولة، قائمة انتظار محلية، Realtime، وفحص المخطط.
*/
(function(){
  'use strict';

  const RC5_TABLES = [
    'settings','accounts','delivery_areas','couriers','courier_areas','categories',
    'booklets','teacher_requests','teacher_request_versions','products','orders',
    'order_items','order_timeline','permits','ledger','financial_entries',
    'financial_payouts','withdrawals','library_settlements','teacher_settlements',
    'delegate_settlements','admin_settlements','notifications','banners','coupons',
    'student_profiles','product_reviews','stock_alerts','bundles','bundle_items',
    'audit','backup_logs','system_health_logs'
  ];
  const REQUIRED_TABLES = ['settings','accounts','booklets','products','orders','notifications','audit'];
  const QUEUE_KEY = 'alin_rc5_offline_queue';
  const DEAD_QUEUE_KEY = 'alin_rc5_failed_queue';
  const CRITICAL_TABLES = new Set([
    'orders','order_items','order_timeline','coupons','products','ledger',
    'financial_entries','financial_payouts','withdrawals','library_settlements',
    'teacher_settlements','delegate_settlements','admin_settlements'
  ]);
  const SNAPSHOT_KEY = 'alin_rc5_last_cloud_snapshot';
  const STATUS_EVENT = 'alin:cloud-status';
  let realtimeChannel = null;
  let reloadTimer = null;
  let flushing = false;

  function nowIso(){ return new Date().toISOString(); }
  function readQueue(){ try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]')}catch(_){return []} }
  function writeQueue(q){ localStorage.setItem(QUEUE_KEY,JSON.stringify(q.slice(-500))); }
  function readDeadQueue(){ try{return JSON.parse(localStorage.getItem(DEAD_QUEUE_KEY)||'[]')}catch(_){return []} }
  function writeDeadQueue(q){ localStorage.setItem(DEAD_QUEUE_KEY,JSON.stringify(q.slice(-500))); }
  function emit(status,detail={}){
    window.AlinCloudStatus={status,at:nowIso(),...detail};
    window.dispatchEvent(new CustomEvent(STATUS_EVENT,{detail:window.AlinCloudStatus}));
  }
  function client(){
    try{
      if(typeof init==='function') init();
      return window.sb || (typeof sb!=='undefined'?sb:null);
    }catch(_){return null}
  }
  function connected(){ return !!client() && navigator.onLine; }
  function safeId(prefix='ID'){ return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`; }
  function normalizeError(e){ return e?.message || String(e||'خطأ غير معروف'); }

  async function tableExists(table){
    const c=client(); if(!c) return false;
    const {error}=await c.from(table).select('*',{head:true,count:'exact'}).limit(1);
    if(!error) return true;
    const m=String(error.message||'').toLowerCase();
    return !(m.includes('does not exist')||m.includes('schema cache')||m.includes('not found'));
  }

  async function schemaCheck(){
    const result={ok:true,tables:{},missing:[],checked_at:nowIso()};
    if(!client()){result.ok=false;result.error='Supabase client غير متوفر';return result;}
    for(const t of REQUIRED_TABLES){
      try{ const ok=await tableExists(t); result.tables[t]=ok; if(!ok) result.missing.push(t); }
      catch(e){result.tables[t]=false;result.missing.push(t);}
    }
    result.ok=result.missing.length===0;
    return result;
  }

  async function selectAll(table,opts={}){
    const c=client(); if(!c) throw new Error('Supabase غير متصل');
    let q=c.from(table).select(opts.columns||'*');
    if(opts.orderBy) q=q.order(opts.orderBy,{ascending:!!opts.ascending});
    if(opts.limit) q=q.limit(opts.limit);
    const {data,error}=await q;
    if(error) throw error;
    return data||[];
  }

  async function selectAccountsForCurrentSession(){
    const c=client(); if(!c) return [];
    if(window.ALIN_CONFIG?.authEnabled!==true) return selectAll('accounts');
    const {data:{user}}=await c.auth.getUser();
    if(!user){
      const {data,error}=await c.from('alin_public_accounts').select('*');
      if(error)throw error; return data||[];
    }
    const {data:own,error:ownError}=await c.from('accounts').select('*').eq('auth_user_id',user.id);
    if(ownError)throw ownError;
    if((own||[]).some(x=>x.role==='admin'))return selectAll('accounts');
    const {data:visible,error}=await c.from('alin_public_accounts').select('*');
    if(error)throw error;
    const map=new Map((visible||[]).map(x=>[x.id,x]));(own||[]).forEach(x=>map.set(x.id,x));
    return [...map.values()];
  }

  async function selectSettingsForCurrentSession(){
    const c=client(); if(!c) return [];
    if(window.ALIN_CONFIG?.authEnabled!==true) return selectAll('settings');
    const {data:{user}}=await c.auth.getUser();
    if(user){
      const {data:own}=await c.from('accounts').select('role').eq('auth_user_id',user.id).maybeSingle();
      if(own?.role==='admin')return selectAll('settings');
    }
    const {data,error}=await c.from('alin_public_settings').select('*');
    if(error)throw error;return data||[];
  }

  function queueMutation(type,table,payload,match){
    const q=readQueue();
    q.push({id:safeId('Q'),type,table,payload,match,created_at:nowIso(),attempts:0});
    writeQueue(q); emit('offline-queued',{queued:q.length});
  }

  async function cloudInsert(table,row){
    const c=client(); if(!c||!navigator.onLine){
      if(CRITICAL_TABLES.has(table)) throw new Error('لا يمكن حفظ الطلب أو العملية المالية بدون اتصال. لم تُمسح بياناتك؛ أعد المحاولة بعد عودة الإنترنت.');
      queueMutation('insert',table,row);return {...row,_queued:true};
    }
    const {data,error}=await c.from(table).insert(row).select().single();
    if(error) throw error;
    return data;
  }
  async function cloudUpdate(table,values,match){
    const c=client(); if(!c||!navigator.onLine){
      if(CRITICAL_TABLES.has(table)) throw new Error('لا يمكن تعديل الطلب أو العملية المالية بدون اتصال. أعد المحاولة بعد عودة الإنترنت.');
      queueMutation('update',table,values,match);return {_queued:true};
    }
    let q=c.from(table).update(values); Object.entries(match||{}).forEach(([k,v])=>q=q.eq(k,v));
    const {data,error}=await q.select(); if(error) throw error; return data||[];
  }
  async function cloudDelete(table,match){
    const c=client(); if(!c||!navigator.onLine){
      if(CRITICAL_TABLES.has(table)) throw new Error('لا يمكن حذف الطلب أو العملية المالية بدون اتصال. أعد المحاولة بعد عودة الإنترنت.');
      queueMutation('delete',table,null,match);return {_queued:true};
    }
    let q=c.from(table).delete(); Object.entries(match||{}).forEach(([k,v])=>q=q.eq(k,v));
    const {error}=await q; if(error) throw error; return true;
  }

  async function flushQueue(){
    if(flushing||!connected()) return;
    flushing=true; let q=readQueue(); const remain=[];
    emit('syncing',{queued:q.length});
    for(const item of q){
      try{
        if(item.type==='insert') await cloudInsert(item.table,item.payload);
        else if(item.type==='update') await cloudUpdate(item.table,item.payload,item.match);
        else if(item.type==='delete') await cloudDelete(item.table,item.match);
      }catch(e){
        item.attempts=(item.attempts||0)+1;
        item.last_error=normalizeError(e);
        if(item.attempts<5) remain.push(item);
        else {
          item.failed_at=nowIso();
          const dead=readDeadQueue();
          dead.push(item);
          writeDeadQueue(dead);
          emit('sync-failed',{failed:dead.length,table:item.table});
        }
      }
    }
    writeQueue(remain); flushing=false;
    emit(remain.length?'sync-partial':'online',{queued:remain.length});
  }

  function mapCloudToLegacy(rows){
    const accounts=rows.accounts||[];
    const snapshot={
      accounts:{
        teachers:accounts.filter(x=>x.role==='teacher'&&!x.deleted_at),
        libraries:accounts.filter(x=>x.role==='library'&&!x.deleted_at)
      },
      booklets:(rows.booklets||[]).filter(x=>!x.deleted_at),
      products:(rows.products||[]).filter(x=>!x.deleted_at),
      categories:rows.categories||[], banners:rows.banners||[], orders:rows.orders||[],
      permits:rows.permits||[], ledger:rows.ledger||[], withdrawals:rows.withdrawals||[],
      audit:rows.audit||[], settings:{storeType:'booklet'},
      couriers:(rows.couriers||[]).filter(x=>!x.deleted_at),
      deliveryAreas:rows.delivery_areas||[], notifications:rows.notifications||[],
      teacherRequests:rows.teacher_requests||[], orderItems:rows.order_items||[],
      orderTimeline:rows.order_timeline||[], financialEntries:rows.financial_entries||[],
      financialPayouts:rows.financial_payouts||[], librarySettlements:rows.library_settlements||[],
      teacherSettlements:rows.teacher_settlements||[], courierSettlements:rows.delegate_settlements||[],
      coupons:rows.coupons||[], backupLogs:rows.backup_logs||[], systemHealthLogs:rows.system_health_logs||[]
    };
    const settingsRows=rows.settings||[];
    settingsRows.forEach(s=>{
      if(s.id==='main') Object.assign(snapshot.settings,s.data||{},s);
      else if(s.key) snapshot.settings[s.key]=s.value;
    });
    return snapshot;
  }

  async function loadCloudSnapshot(){
    const c=client();
    if(!c){ emit('offline',{reason:'no-client'}); return null; }
    emit('loading');
    const rows={};
    await Promise.all(RC5_TABLES.map(async t=>{
      try{ rows[t]=t==='accounts'?await selectAccountsForCurrentSession():t==='settings'?await selectSettingsForCurrentSession():await selectAll(t,{orderBy:['orders','notifications','audit','order_timeline'].includes(t)?'created_at':undefined,ascending:false}); }
      catch(e){ rows[t]=[]; console.warn('[RC5]',t,normalizeError(e)); }
    }));
    const snapshot=mapCloudToLegacy(rows);
    localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({at:nowIso(),snapshot}));
    window.db=snapshot;
    try{ if(typeof renderAll==='function') renderAll(); }catch(e){console.warn(e);}
    emit('online',{tables:Object.keys(rows).length});
    return snapshot;
  }

  function loadCachedSnapshot(){
    try{const x=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null'); if(x?.snapshot){window.db=x.snapshot;return x.snapshot}}catch(_){}
    return null;
  }

  function scheduleReload(){ clearTimeout(reloadTimer); reloadTimer=setTimeout(()=>loadCloudSnapshot().catch(()=>{}),700); }
  function startRealtime(){
    const c=client(); if(!c?.channel||realtimeChannel) return;
    realtimeChannel=c.channel('alin-rc5-live');
    ['orders','notifications','booklets','products','accounts','couriers','ledger','financial_entries'].forEach(t=>{
      realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:t},scheduleReload);
    });
    realtimeChannel.subscribe(status=>emit(status==='SUBSCRIBED'?'realtime':'realtime-wait',{realtime:status}));
  }

  function installLegacyBridge(){
    window.query=async function(table){ return selectAll(table); };
    window.insert=async function(table,row){ return cloudInsert(table,row); };
    window.update=async function(table,values,match){ return cloudUpdate(table,values,match); };
    window.removeRow=async function(table,match){ return cloudDelete(table,match); };

    const legacyLoad=window.load;
    window.load=async function(){
      try{
        const snap=await loadCloudSnapshot();
        if(snap) return snap;
      }catch(e){ console.error('[RC5 load]',e); emit('error',{message:normalizeError(e)}); }
      loadCachedSnapshot();
      if(typeof legacyLoad==='function') return legacyLoad.apply(this,arguments);
    };
  }

  async function health(){
    const started=performance.now();
    const schema=await schemaCheck();
    return {
      ok:schema.ok,
      latency_ms:Math.round(performance.now()-started),
      online:navigator.onLine,
      queue:readQueue().length,
      schema,
      version:'RC5',
      checked_at:nowIso()
    };
  }

  window.AlinCloud={
    version:'RC5', client, connected, selectAll, insert:cloudInsert, update:cloudUpdate,
    remove:cloudDelete, flushQueue, loadCloudSnapshot, loadCachedSnapshot,
    schemaCheck, health, startRealtime, queueSize:()=>readQueue().length,
    failedQueueSize:()=>readDeadQueue().length
  };

  installLegacyBridge();
  window.addEventListener('online',()=>{flushQueue();startRealtime();loadCloudSnapshot().catch(()=>{});});
  window.addEventListener('offline',()=>emit('offline'));
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!navigator.onLine) loadCachedSnapshot();
    try{ await flushQueue(); startRealtime(); }catch(e){console.warn('[RC5 init]',e);}
  });
})();

/* ===== core/js/cloud-status-ui-rc5.js ===== */
(function(){
  const labels={online:'متصل بـ Supabase',offline:'غير متصل',loading:'جاري تحميل البيانات',syncing:'جاري مزامنة البيانات','offline-queued':'تم حفظ العملية للمزامنة','sync-partial':'بعض العمليات بانتظار المزامنة',error:'خطأ في الاتصال',realtime:'التحديث الفوري يعمل'};
  let el,timer;
  function show(d){
    if(!el){el=document.createElement('div');el.className='alin-cloud-status';document.body.appendChild(el)}
    const s=d?.status||'online'; el.className=`alin-cloud-status show ${s}`; el.textContent=labels[s]||s;
    clearTimeout(timer); timer=setTimeout(()=>el.classList.remove('show'),s==='error'?6000:2800);
  }
  window.addEventListener('alin:cloud-status',e=>show(e.detail));
})();


;
