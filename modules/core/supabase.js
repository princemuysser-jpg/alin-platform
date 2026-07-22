// === core/supabase.js ===
/* ALIN v2.3.9 — authoritative Supabase data service.
   This file is the only owner of query/insert/update/removeRow/load and cloud snapshots.
*/
(function(){
  'use strict';

  const VERSION='2.3.9';
  const TABLES=[
    'settings','accounts','delivery_areas','couriers','courier_areas','categories',
    'booklets','teacher_requests','teacher_request_versions','products','orders',
    'order_items','order_timeline','permits','ledger','financial_entries',
    'financial_payouts','withdrawals','library_settlements','teacher_settlements',
    'delegate_settlements','admin_settlements','notifications','banners','coupons',
    'student_profiles','product_reviews','stock_alerts','bundles','bundle_items',
    'audit','backup_logs','system_health_logs'
  ];
  const REQUIRED_TABLES=['settings','accounts','booklets','products','orders','notifications','audit'];
  const SORTED_TABLES=new Set(['orders','notifications','audit','order_timeline','financial_entries']);
  const CRITICAL_TABLES=new Set([
    'orders','order_items','order_timeline','coupons','products','ledger','financial_entries',
    'financial_payouts','withdrawals','library_settlements','teacher_settlements',
    'delegate_settlements','admin_settlements'
  ]);
  const NO_CLIENT_ID=new Set(['settings','courier_areas']);
  const QUEUE_KEY='alin_rc5_offline_queue';
  const DEAD_QUEUE_KEY='alin_rc5_failed_queue';
  const SNAPSHOT_KEY='alin_rc5_last_cloud_snapshot';
  const STATUS_EVENT='alin:cloud-status';
  const REFRESH_EVENT='alin:data-refreshed';
  const MUTATION_EVENT='alin:cloud-mutation';
  const TABLE_TO_DB={
    booklets:'booklets',products:'products',categories:'categories',banners:'banners',orders:'orders',
    permits:'permits',ledger:'ledger',withdrawals:'withdrawals',audit:'audit',couriers:'couriers',
    delivery_areas:'deliveryAreas',courier_areas:'courierAreas',notifications:'notifications',
    teacher_requests:'teacherRequests',teacher_request_versions:'teacherRequestVersions',
    order_items:'orderItems',order_timeline:'orderTimeline',financial_entries:'financialEntries',
    financial_payouts:'financialPayouts',library_settlements:'librarySettlements',
    teacher_settlements:'teacherSettlements',delegate_settlements:'courierSettlements',
    admin_settlements:'adminSettlements',coupons:'coupons',student_profiles:'studentProfiles',
    product_reviews:'productReviews',stock_alerts:'stockAlerts',bundles:'bundles',bundle_items:'bundleItems',
    backup_logs:'backupLogs',system_health_logs:'systemHealthLogs'
  };

  let realtimeChannel=null;
  let reloadTimer=null;
  let snapshotPromise=null;
  let flushing=false;
  let lastRefreshErrors=[];

  const nowIso=()=>new Date().toISOString();
  const normalizeError=error=>error?.message||String(error||'خطأ غير معروف');
  const safeId=(prefix='ID')=>`${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,9)}`;
  const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch(_){return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}};
  const readQueue=()=>readJson(QUEUE_KEY,[]);
  const writeQueue=queue=>writeJson(QUEUE_KEY,(queue||[]).slice(-500));
  const readDeadQueue=()=>readJson(DEAD_QUEUE_KEY,[]);
  const writeDeadQueue=queue=>writeJson(DEAD_QUEUE_KEY,(queue||[]).slice(-500));

  function emit(status,detail={}){
    window.AlinCloudStatus={status,at:nowIso(),...detail};
    window.dispatchEvent(new CustomEvent(STATUS_EVENT,{detail:window.AlinCloudStatus}));
  }
  function client(){
    try{
      if(typeof window.init==='function')window.init();
      return window.sb||null;
    }catch(_){return null}
  }
  const connected=()=>!!client()&&navigator.onLine;

  function syncAliases(d){
    d.financial_entries=d.financialEntries;d.financial_payouts=d.financialPayouts;
    d.library_settlements=d.librarySettlements;d.teacher_settlements=d.teacherSettlements;
    d.delegate_settlements=d.courierSettlements;
    return d;
  }
  function ensureDb(){
    if(!window.db||typeof window.db!=='object')window.db={};
    const d=window.db;
    d.accounts=d.accounts&&typeof d.accounts==='object'?d.accounts:{};
    for(const role of ['all','teachers','libraries','couriers','accountants'])if(!Array.isArray(d.accounts[role]))d.accounts[role]=[];
    for(const key of Object.values(TABLE_TO_DB))if(!Array.isArray(d[key]))d[key]=[];
    d.settings=d.settings&&typeof d.settings==='object'?d.settings:{storeType:'booklet'};
    if(!d.settings.storeType)d.settings.storeType='booklet';
    return syncAliases(d);
  }
  function deriveAccounts(accounts){
    const clean=(accounts||[]).filter(row=>!row?.deleted_at);
    return {
      all:clean,
      teachers:clean.filter(row=>row.role==='teacher'),
      libraries:clean.filter(row=>row.role==='library'),
      couriers:clean.filter(row=>row.role==='courier'),
      accountants:clean.filter(row=>row.role==='accountant')
    };
  }
  function settingsToObject(rows,base={}){
    const out={storeType:'booklet',...(base||{})};
    for(const row of rows||[]){
      if(row.id==='main'||row.key==='__main__'){
        if(row.data&&typeof row.data==='object')Object.assign(out,row.data);
        for(const key of ['platform_name','platform_phone','hero_title','hero_text','version'])if(row[key]!=null)out[key]=row[key];
      }
      if(row.key&&row.key!=='__main__')out[row.key]=row.value;
    }
    return out;
  }
  function currentRows(table,d=ensureDb()){
    if(table==='accounts')return d.accounts.all||[];
    if(table==='settings')return [];
    const key=TABLE_TO_DB[table];
    return key&&Array.isArray(d[key])?d[key]:[];
  }
  function rowsOrCurrent(rows,table,d){return Array.isArray(rows[table])?rows[table]:currentRows(table,d)}
  function sortNewest(rows){return (rows||[]).slice().sort((a,b)=>String(b?.created_at||'').localeCompare(String(a?.created_at||'')))}
  function mapCloudToDb(rows){
    const previous=ensureDb();
    const next={...previous,accounts:{...previous.accounts},settings:{...previous.settings}};
    next.accounts=deriveAccounts(rowsOrCurrent(rows,'accounts',previous));
    for(const [table,key] of Object.entries(TABLE_TO_DB)){
      let values=rowsOrCurrent(rows,table,previous);
      if(['booklets','products','couriers'].includes(table))values=values.filter(row=>!row?.deleted_at);
      if(SORTED_TABLES.has(table))values=sortNewest(values);
      next[key]=values;
    }
    if(Array.isArray(rows.settings))next.settings=settingsToObject(rows.settings,previous.settings);
    if(!Array.isArray(next.couriers)||!next.couriers.length)next.couriers=next.accounts.couriers||[];
    return syncAliases(next);
  }

  async function selectAll(table,options={}){
    const c=client();if(!c)throw new Error('Supabase غير متصل');
    let request=c.from(table).select(options.columns||'*');
    if(options.orderBy)request=request.order(options.orderBy,{ascending:!!options.ascending});
    if(options.limit)request=request.limit(options.limit);
    const {data,error}=await request;
    if(error)throw error;
    return data||[];
  }
  async function selectAccountsForCurrentSession(){
    const c=client();if(!c)return [];
    if(window.ALIN_CONFIG?.authEnabled!==true)return selectAll('accounts');
    const {data:{user}}=await c.auth.getUser();
    if(!user){
      const {data,error}=await c.from('alin_public_accounts').select('*');
      if(error)throw error;return data||[];
    }
    const {data:own,error:ownError}=await c.from('accounts').select('*').eq('auth_user_id',user.id);
    if(ownError)throw ownError;
    if((own||[]).some(row=>row.role==='admin'))return selectAll('accounts');
    const {data:visible,error}=await c.from('alin_public_accounts').select('*');
    if(error)throw error;
    const map=new Map((visible||[]).map(row=>[String(row.id),row]));
    for(const row of own||[])map.set(String(row.id),row);
    return [...map.values()];
  }
  async function selectSettingsForCurrentSession(){
    const c=client();if(!c)return [];
    if(window.ALIN_CONFIG?.authEnabled!==true)return selectAll('settings');
    const {data:{user}}=await c.auth.getUser();
    if(user){
      const {data:own}=await c.from('accounts').select('role').eq('auth_user_id',user.id).maybeSingle();
      if(own?.role==='admin')return selectAll('settings');
    }
    const {data,error}=await c.from('alin_public_settings').select('*');
    if(error)throw error;return data||[];
  }
  async function fetchTable(table,options={}){
    if(table==='accounts')return selectAccountsForCurrentSession();
    if(table==='settings')return selectSettingsForCurrentSession();
    return selectAll(table,{...options,orderBy:options.orderBy||(SORTED_TABLES.has(table)?'created_at':undefined),ascending:options.ascending??false});
  }
  async function query(table,options={}){return fetchTable(table,options)}

  function collectionFor(table){
    const d=ensureDb();
    if(table==='accounts')return d.accounts.all;
    const key=TABLE_TO_DB[table];return key?d[key]:null;
  }
  const matches=(row,match={})=>Object.entries(match||{}).every(([key,value])=>String(row?.[key]??'')===String(value??''));
  function refreshAccountGroups(){const d=ensureDb();d.accounts=deriveAccounts(d.accounts.all||[])}
  function applyLocalInsert(table,row){
    if(!row)return;
    const d=ensureDb();
    if(table==='settings'){
      if(row.key&&row.key!=='__main__')d.settings[row.key]=row.value;
      if(row.data&&typeof row.data==='object')Object.assign(d.settings,row.data);
      return;
    }
    const list=collectionFor(table);if(!list)return;
    const index=row.id==null?-1:list.findIndex(item=>String(item?.id)===String(row.id));
    if(index>=0)list[index]={...list[index],...row};else list.unshift(row);
    if(table==='accounts')refreshAccountGroups();
  }
  function applyLocalUpdate(table,values,match){
    const d=ensureDb();
    if(table==='settings'){
      if(match?.key)d.settings[match.key]=values?.value;
      if(values?.data&&typeof values.data==='object')Object.assign(d.settings,values.data);
      return;
    }
    const list=collectionFor(table);if(!list)return;
    for(let index=0;index<list.length;index++)if(matches(list[index],match))list[index]={...list[index],...(values||{})};
    if(table==='accounts')refreshAccountGroups();
  }
  function applyLocalDelete(table,match){
    const list=collectionFor(table);if(!list)return;
    for(let index=list.length-1;index>=0;index--)if(matches(list[index],match))list.splice(index,1);
    if(table==='accounts')refreshAccountGroups();
  }
  function emitMutation(type,table,detail={}){
    window.dispatchEvent(new CustomEvent(MUTATION_EVENT,{detail:{type,table,at:nowIso(),...detail}}));
  }

  function queueMutation(type,table,payload,match){
    const queue=readQueue();
    queue.push({id:safeId('Q'),type,table,payload,match,created_at:nowIso(),attempts:0});
    writeQueue(queue);emit('offline-queued',{queued:queue.length});
  }
  async function executeInsert(table,row){
    const c=client();if(!c)throw new Error('Supabase غير متصل');
    const {data,error}=await c.from(table).insert(row).select().single();
    if(error)throw error;return data;
  }
  async function executeUpdate(table,values,match={}){
    const c=client();if(!c)throw new Error('Supabase غير متصل');
    let request=c.from(table).update(values);
    for(const [key,value] of Object.entries(match||{}))request=request.eq(key,value);
    const {data,error}=await request.select();if(error)throw error;return data||[];
  }
  async function executeDelete(table,match={}){
    const c=client();if(!c)throw new Error('Supabase غير متصل');
    let request=c.from(table).delete();
    for(const [key,value] of Object.entries(match||{}))request=request.eq(key,value);
    const {error}=await request;if(error)throw error;return true;
  }
  function scheduleReload(delay=450){
    clearTimeout(reloadTimer);
    reloadTimer=setTimeout(()=>loadCloudSnapshot({force:true,reason:'mutation'}).catch(error=>console.warn('[ALIN cloud refresh]',error)),delay);
  }
  async function insert(table,row){
    if(table==='orders'&&window.ALIN_CONFIG?.authEnabled===true)throw new Error('إنشاء الطلب المباشر متوقف؛ استخدم خدمة الطلب الآمنة');
    const payload={...(row||{})};
    if(payload.id==null&&!NO_CLIENT_ID.has(table))payload.id=safeId(String(table||'ID').slice(0,2).toUpperCase());
    let result;
    if(!connected()){
      if(CRITICAL_TABLES.has(table))throw new Error('لا يمكن حفظ الطلب أو العملية المالية بدون اتصال. لم تُمسح بياناتك؛ أعد المحاولة بعد عودة الإنترنت.');
      queueMutation('insert',table,payload);result={...payload,_queued:true};
    }else result=await executeInsert(table,payload);
    applyLocalInsert(table,result||payload);emitMutation('insert',table,{row:result||payload});
    if(connected())scheduleReload();
    return result||payload;
  }
  async function update(table,values,match={}){
    let result;
    if(!connected()){
      if(CRITICAL_TABLES.has(table))throw new Error('لا يمكن تعديل الطلب أو العملية المالية بدون اتصال. أعد المحاولة بعد عودة الإنترنت.');
      queueMutation('update',table,values,match);result={_queued:true};
    }else result=await executeUpdate(table,values,match);
    applyLocalUpdate(table,values,match);emitMutation('update',table,{values,match,rows:result});
    if(connected())scheduleReload();
    return result;
  }
  async function removeRow(table,match={}){
    let result;
    if(!connected()){
      if(CRITICAL_TABLES.has(table))throw new Error('لا يمكن حذف الطلب أو العملية المالية بدون اتصال. أعد المحاولة بعد عودة الإنترنت.');
      queueMutation('delete',table,null,match);result={_queued:true};
    }else result=await executeDelete(table,match);
    applyLocalDelete(table,match);emitMutation('delete',table,{match});
    if(connected())scheduleReload();
    return result;
  }

  async function flushQueue(){
    if(flushing||!connected())return;
    flushing=true;
    const queue=readQueue(),remain=[];
    emit('syncing',{queued:queue.length});
    for(const item of queue){
      try{
        if(item.type==='insert')await executeInsert(item.table,item.payload);
        else if(item.type==='update')await executeUpdate(item.table,item.payload,item.match);
        else if(item.type==='delete')await executeDelete(item.table,item.match);
      }catch(error){
        item.attempts=(item.attempts||0)+1;item.last_error=normalizeError(error);
        if(item.attempts<5)remain.push(item);
        else{item.failed_at=nowIso();const dead=readDeadQueue();dead.push(item);writeDeadQueue(dead);emit('sync-failed',{failed:dead.length,table:item.table})}
      }
    }
    writeQueue(remain);flushing=false;
    emit(remain.length?'sync-partial':'online',{queued:remain.length});
    if(queue.length!==remain.length)scheduleReload(100);
  }

  async function loadCloudSnapshot(options={}){
    if(snapshotPromise&&!options.force)return snapshotPromise;
    clearTimeout(reloadTimer);
    snapshotPromise=(async()=>{
      const c=client();
      if(!c){emit('offline',{reason:'no-client'});return loadCachedSnapshot()||ensureDb()}
      if(options.status!==false)emit('loading',{reason:options.reason||'load'});
      const rows={},errors=[];
      await Promise.all(TABLES.map(async table=>{
        try{rows[table]=await fetchTable(table)}
        catch(error){errors.push({table,error:normalizeError(error)});console.warn('[ALIN cloud]',table,normalizeError(error))}
      }));
      const snapshot=mapCloudToDb(rows);
      window.db=snapshot;
      try{window.couriers=snapshot.couriers||snapshot.accounts?.couriers||[]}catch(_){ }
      try{window.courierSettlements=snapshot.courierSettlements||[]}catch(_){ }
      writeJson(SNAPSHOT_KEY,{at:nowIso(),snapshot});
      lastRefreshErrors=errors;
      window.dispatchEvent(new CustomEvent(REFRESH_EVENT,{detail:{version:VERSION,errors,at:nowIso(),reason:options.reason||'load'}}));
      if(options.render!==false){try{window.renderAll?.()}catch(error){console.warn('[ALIN renderAll]',error)}}
      emit(errors.length?'sync-partial':'online',{tables:TABLES.length,errors:errors.length});
      return snapshot;
    })();
    try{return await snapshotPromise}finally{snapshotPromise=null}
  }
  function loadCachedSnapshot(){
    const cached=readJson(SNAPSHOT_KEY,null);
    if(cached?.snapshot){window.db=cached.snapshot;const restored=ensureDb();restored.accounts=deriveAccounts(restored.accounts.all||[]);return syncAliases(restored)}
    return null;
  }
  async function refresh(options={}){const db=await loadCloudSnapshot({...options,force:options.force??true});return {db,errors:lastRefreshErrors}}

  async function tableExists(table){
    const c=client();if(!c)return false;
    const {error}=await c.from(table).select('*',{head:true,count:'exact'}).limit(1);
    if(!error)return true;
    const message=String(error.message||'').toLowerCase();
    return !(message.includes('does not exist')||message.includes('schema cache')||message.includes('not found'));
  }
  async function schemaCheck(){
    const result={ok:true,tables:{},missing:[],checked_at:nowIso()};
    if(!client()){result.ok=false;result.error='Supabase client غير متوفر';return result}
    for(const table of REQUIRED_TABLES){
      try{const ok=await tableExists(table);result.tables[table]=ok;if(!ok)result.missing.push(table)}
      catch(_){result.tables[table]=false;result.missing.push(table)}
    }
    result.ok=result.missing.length===0;return result;
  }
  async function verify(){
    const report={version:VERSION,at:nowIso(),online:navigator.onLine,client:!!client(),tables:{},ok:true};
    if(!client()){report.ok=false;report.error='Supabase client غير متوفر';return report}
    for(const table of REQUIRED_TABLES){
      try{const data=await fetchTable(table,{limit:1});report.tables[table]={ok:true,count:data.length}}
      catch(error){report.tables[table]={ok:false,error:normalizeError(error)};report.ok=false}
    }
    return report;
  }
  async function health(){
    const started=performance.now(),schema=await schemaCheck();
    return {ok:schema.ok,latency_ms:Math.round(performance.now()-started),online:navigator.onLine,queue:readQueue().length,schema,version:VERSION,checked_at:nowIso()};
  }

  function startRealtime(){
    const c=client();if(!c?.channel||realtimeChannel)return;
    realtimeChannel=c.channel('alin-live-v229');
    for(const table of ['orders','notifications','booklets','products','accounts','couriers','ledger','financial_entries']){
      realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table},()=>scheduleReload(300));
    }
    realtimeChannel.subscribe(status=>emit(status==='SUBSCRIBED'?'realtime':'realtime-wait',{realtime:status}));
  }

  Object.assign(window,{query,insert,update,removeRow,load:loadCloudSnapshot});
  window.AlinCloud=Object.freeze({
    version:VERSION,client,connected,selectAll,query,insert,update,remove:removeRow,
    flushQueue,loadCloudSnapshot,loadCachedSnapshot,refresh,schemaCheck,verify,health,startRealtime,
    queueSize:()=>readQueue().length,failedQueueSize:()=>readDeadQueue().length
  });
  window.AlinRepository=Object.freeze({version:VERSION,client,online:connected,fetchTable,refresh,verify,schemaCheck,health});

  window.addEventListener('online',()=>{flushQueue();startRealtime();if(window.ALIN_CONFIG?.authEnabled!==true)loadCloudSnapshot({force:true,reason:'online'}).catch(()=>{})});
  window.addEventListener('offline',()=>emit('offline'));
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!navigator.onLine)loadCachedSnapshot();
    try{
      await flushQueue();startRealtime();
      if(window.ALIN_CONFIG?.authEnabled!==true)await loadCloudSnapshot({reason:'boot'});
    }catch(error){console.warn('[ALIN cloud init]',error)}
  },{once:true});
})();

;
