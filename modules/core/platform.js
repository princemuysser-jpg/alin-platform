// === core/platform.js ===
/* ALIN v2.2.7 — small authoritative runtime core. Business features live in their own modules. */
(function(){
  'use strict';

  const config=window.ALIN_CONFIG||{};
  const emptyDb=()=>({
    accounts:{all:[],teachers:[],libraries:[],couriers:[],accountants:[]},
    booklets:[],products:[],categories:[],banners:[],coupons:[],notifications:[],orders:[],
    permits:[],ledger:[],withdrawals:[],audit:[],auditLogs:[],couriers:[],deliveryAreas:[],
    teacherRequests:[],teacherPayouts:[],orderItems:[],orderTimeline:[],financialEntries:[],
    financialPayouts:[],financialReturns:[],librarySettlements:[],teacherSettlements:[],
    courierSettlements:[],backupLogs:[],systemHealthLogs:[],settings:{storeType:'booklet'}
  });
  let stateDb=window.db&&typeof window.db==='object'?window.db:emptyDb();
  let stateCurrent=window.current||null;
  let statePendingRole=window.pendingRole||'';
  let stateCheckoutItem=window.checkoutItem||null;
  let stateClient=window.sb||null;

  function expose(name,getter,setter){
    const descriptor=Object.getOwnPropertyDescriptor(window,name);
    if(!descriptor||descriptor.configurable)Object.defineProperty(window,name,{configurable:true,enumerable:true,get:getter,set:setter});
  }
  expose('db',()=>stateDb,value=>{stateDb=value&&typeof value==='object'?value:emptyDb()});
  expose('current',()=>stateCurrent,value=>{stateCurrent=value||null});
  expose('pendingRole',()=>statePendingRole,value=>{statePendingRole=String(value||'')});
  expose('checkoutItem',()=>stateCheckoutItem,value=>{stateCheckoutItem=value||null});
  expose('sb',()=>stateClient,value=>{stateClient=value||null});
  expose('financialEntries',()=>stateDb.financialEntries||stateDb.financial_entries||[],value=>{stateDb.financialEntries=value||[];stateDb.financial_entries=value||[]});
  expose('financialPayouts',()=>stateDb.financialPayouts||stateDb.financial_payouts||[],value=>{stateDb.financialPayouts=value||[];stateDb.financial_payouts=value||[]});
  expose('librarySettlements',()=>stateDb.librarySettlements||stateDb.library_settlements||[],value=>{stateDb.librarySettlements=value||[];stateDb.library_settlements=value||[]});
  expose('courierSettlements',()=>stateDb.courierSettlements||stateDb.delegate_settlements||[],value=>{stateDb.courierSettlements=value||[];stateDb.delegate_settlements=value||[]});
  expose('couriers',()=>stateDb.couriers||stateDb.accounts?.couriers||[],value=>{stateDb.couriers=value||[]});

  function init(){
    if(stateClient)return true;
    if(!window.supabase||!config.supabaseUrl||!config.supabaseAnonKey)return false;
    stateClient=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return true;
  }
  function requireConnection(){
    if(init())return true;
    window.toast?.('تعذر الاتصال بخدمة المنصة');
    return false;
  }
  async function query(table){
    if(!requireConnection())return [];
    const {data,error}=await stateClient.from(table).select('*');if(error)throw error;return data||[];
  }
  async function insert(table,row){
    if(table==='orders'&&config.authEnabled===true)throw new Error('إنشاء الطلب المباشر متوقف؛ استخدم خدمة الطلب الآمنة');
    if(!requireConnection())throw new Error('الاتصال بالنظام غير متاح');
    const {data,error}=await stateClient.from(table).insert(row).select().single();if(error)throw error;return data;
  }
  async function update(table,values,match={}){
    if(!requireConnection())throw new Error('الاتصال بالنظام غير متاح');
    let request=stateClient.from(table).update(values);for(const [key,value] of Object.entries(match))request=request.eq(key,value);
    const {data,error}=await request.select();if(error)throw error;return data||[];
  }
  async function removeRow(table,match={}){
    if(!requireConnection())throw new Error('الاتصال بالنظام غير متاح');
    let request=stateClient.from(table).delete();for(const [key,value] of Object.entries(match))request=request.eq(key,value);
    const {error}=await request;if(error)throw error;return true;
  }
  async function audit(kind,text,meta={}){
    try{
      const row={id:window.uid?.('A')||`A${Date.now()}`,kind,text,meta,created_at:new Date().toISOString()};
      await window.insert('audit',row);stateDb.audit=Array.isArray(stateDb.audit)?stateDb.audit:[];stateDb.audit.unshift(row);
    }catch(error){console.warn('[ALIN audit]',error)}
  }
  function teacherName(id){return (stateDb.accounts?.teachers||[]).find(row=>String(row.id)===String(id))?.name||''}
  function libIsOpen(library){return !(library?.is_open===false||String(library?.is_open)==='false'||String(library?.open_status||'').toLowerCase()==='closed')}
  function libStatusText(library){return libIsOpen(library)?'مفتوح الآن':library?.open_note||'مغلق حالياً'}
  function activeLibraries(){return (stateDb.accounts?.libraries||[]).filter(library=>library.status==='active')}
  function deliveryFee(){return Number(stateDb.settings?.delivery_fee||0)}
  function isMissingTableError(error,table=''){
    const message=String(error?.message||error||'').toLowerCase();
    return (message.includes('does not exist')||message.includes('schema cache')||message.includes('not found'))&&(!table||message.includes(String(table).toLowerCase()));
  }
  async function usePermit(id){
    const permit=(stateDb.permits||[]).find(row=>String(row.id)===String(id));
    if(!permit||Number(permit.used||0)>=Number(permit.qty||0)){window.toast?.('إذن النسخ منتهي');return false}
    const used=Number(permit.used||0)+1,status=used>=Number(permit.qty||0)?'done':'active';
    await window.update('permits',{used,status},{id});Object.assign(permit,{used,status});await audit('copy',`استخدام إذن نسخة ${id}`);return true;
  }
  function renderAll(){
    try{window.applyBrand?.()}catch(error){console.warn('[ALIN brand]',error)}
    for(const name of ['renderStore','renderTeacher','renderLibrary','adminStatsRender']){
      try{if(typeof window[name]==='function')window[name]()}catch(error){console.warn(`[ALIN render ${name}]`,error)}
    }
    window.dispatchEvent(new CustomEvent('alin:rendered'));
  }
  async function load(){renderAll();return stateDb}
  async function seedData(){throw new Error('البيانات التجريبية معطلة في النسخة المستقرة')}

  Object.assign(window,{
    ALIN_VERSION:'2.2.7',init,requireConnection,query,insert,update,removeRow,audit,load,renderAll,seedData,
    teacherName,libIsOpen,libStatusText,activeLibraries,alinOpenLibraries:activeLibraries,
    alinLibOpen:libIsOpen,deliveryFee,isMissingTableError,usePermit
  });
  window.AlinRuntime=Object.freeze({version:'2.2.7',init,requireConnection,renderAll,getDb:()=>stateDb,getCurrent:()=>stateCurrent});

  /* PLATFORM STEP 1: coupons are owned by modules/store/coupons.js and modules/admin/coupons.js. */
  /* PLATFORM STEP 2: cart and order creation are owned by modules/store/cart.js and modules/store/order-routing.js. */
  /* PLATFORM STEP 3: navigation and session are owned by modules/core/navigation.js and modules/core/cloud-status-ui.js. */
  /* PLATFORM STEP 4: catalog administration is owned by modules/admin/products.js and modules/admin/booklets.js. */
  /* PLATFORM STEP 5: admin orders are owned by modules/admin/orders.js. */
  /* PLATFORM STEP 6/7: library and teacher roles are owned by their modules. */
  /* PLATFORM STEP 8: finance is owned by core/finance-runtime.js and modules/admin/finance.js. */
  /* PLATFORM STEP 9: admin routing is owned by modules/admin/shell.js. */
  /* PLATFORM STEP 9: account administration is owned by modules/admin/accounts.js. */
  /* PLATFORM STEP 10: storefront ownership moved to modules/store/discovery.js. */
  /* PLATFORM STEP 11: banner administration lives in store/banners.js. */
  /* PLATFORM STEP 11: notifications are owned by modules/core/notifications.js and role-specific views. */
  /* PLATFORM STEP 11: favorites are owned by modules/store/discovery.js. */
  /* PLATFORM STEP 12: UI, storage, settings, branding, backup and student profile are owned by dedicated modules. */

  document.addEventListener('DOMContentLoaded',()=>Promise.resolve(window.load?.()).catch(error=>console.error('[ALIN boot]',error)),{once:true});
})();

;
