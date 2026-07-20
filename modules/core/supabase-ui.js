// === core/supabase-ui.js ===
/* ===== core/js/supabase-ui-binding-rc5-3.js ===== */
/* منصة آلين RC5.3 - ربط الواجهة النهائي مع Supabase
   هذه الطبقة تُحمّل بعد جميع وحدات المنصة حتى تكون آخر طبقة مسؤولة عن:
   1) مزامنة البيانات السحابية مع نموذج db المستخدم في الواجهات القديمة.
   2) تحديث الواجهة بعد الإضافة والتعديل والحذف.
   3) توحيد رفع الملفات والروابط.
   4) منع الرجوع الصامت إلى بيانات تجريبية عند نجاح الاتصال.
*/
(function(){
  'use strict';

  const VERSION='RC5.3';
  const ESSENTIAL_TABLES=[
    'settings','accounts','delivery_areas','couriers','courier_areas','categories',
    'booklets','teacher_requests','teacher_request_versions','products','orders',
    'order_items','order_timeline','financial_entries','financial_payouts',
    'library_settlements','teacher_settlements','delegate_settlements','notifications',
    'banners','coupons','audit','backup_logs','system_health_logs'
  ];
  const REFRESH_EVENT='alin:data-refreshed';
  const MUTATION_EVENT='alin:cloud-mutation';
  let refreshTimer=null;
  let refreshing=null;
  let installed=false;

  const now=()=>new Date().toISOString();
  const uid=(p='ID')=>`${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2,9)}`;
  const errText=e=>e?.message||String(e||'خطأ غير معروف');
  const client=()=>window.AlinCloud?.client?.()||window.sb||null;
  const online=()=>navigator.onLine&&!!client();

  function ensureDb(){
    if(!window.db||typeof window.db!=='object') window.db={};
    const d=window.db;
    d.accounts=d.accounts||{teachers:[],libraries:[]};
    d.accounts.teachers=d.accounts.teachers||[];
    d.accounts.libraries=d.accounts.libraries||[];
    ['booklets','products','categories','banners','orders','permits','ledger','withdrawals','audit','couriers','deliveryAreas','notifications','teacherRequests','orderItems','orderTimeline','financialEntries','financialPayouts','librarySettlements','teacherSettlements','courierSettlements','coupons','backupLogs','systemHealthLogs'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
    d.settings=d.settings||{storeType:'booklet'};
    return d;
  }

  function settingsToObject(rows){
    const out={storeType:'booklet'};
    (rows||[]).forEach(s=>{
      if(s.id==='main'||s.key==='__main__'){
        if(s.data&&typeof s.data==='object') Object.assign(out,s.data);
        ['platform_name','platform_phone','hero_title','hero_text','version'].forEach(k=>{if(s[k]!=null)out[k]=s[k]});
      }
      if(s.key&&s.key!=='__main__') out[s.key]=s.value;
    });
    return out;
  }

  function rowsToDb(rows){
    const d=ensureDb();
    const accounts=(rows.accounts||[]).filter(x=>!x.deleted_at);
    d.accounts.teachers=accounts.filter(x=>x.role==='teacher');
    d.accounts.libraries=accounts.filter(x=>x.role==='library');
    d.accounts.all=accounts;
    d.booklets=(rows.booklets||[]).filter(x=>!x.deleted_at);
    d.products=(rows.products||[]).filter(x=>!x.deleted_at);
    d.categories=rows.categories||[];
    d.banners=rows.banners||[];
    d.orders=(rows.orders||[]).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    d.audit=(rows.audit||[]).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    d.settings={...d.settings,...settingsToObject(rows.settings||[])};
    d.couriers=(rows.couriers||[]).filter(x=>!x.deleted_at);
    d.deliveryAreas=rows.delivery_areas||[];
    d.courierAreas=rows.courier_areas||[];
    d.notifications=rows.notifications||[];
    d.teacherRequests=rows.teacher_requests||[];
    d.teacherRequestVersions=rows.teacher_request_versions||[];
    d.orderItems=rows.order_items||[];
    d.orderTimeline=rows.order_timeline||[];
    d.financialEntries=rows.financial_entries||[];
    d.financialPayouts=rows.financial_payouts||[];
    d.librarySettlements=rows.library_settlements||[];
    d.teacherSettlements=rows.teacher_settlements||[];
    d.courierSettlements=rows.delegate_settlements||[];
    d.coupons=rows.coupons||[];
    d.backupLogs=rows.backup_logs||[];
    d.systemHealthLogs=rows.system_health_logs||[];
    return d;
  }

  async function fetchTable(table){
    const c=client();
    if(!c) throw new Error('اتصال Supabase غير متوفر');
    let q=c.from(table).select('*');
    if(['orders','notifications','audit','order_timeline','financial_entries'].includes(table)) q=q.order('created_at',{ascending:false});
    const {data,error}=await q;
    if(error) throw error;
    return data||[];
  }

  async function refresh(options={}){
    if(refreshing&&!options.force) return refreshing;
    refreshing=(async()=>{
      const rows={},errors=[];
      if(!online()) throw new Error('لا يوجد اتصال فعّال بقاعدة البيانات');
      await Promise.all(ESSENTIAL_TABLES.map(async table=>{
        try{rows[table]=await fetchTable(table)}catch(e){rows[table]=[];errors.push({table,error:errText(e)})}
      }));
      const d=rowsToDb(rows);
      localStorage.setItem('alin_rc5_3_snapshot',JSON.stringify({at:now(),db:d}));
      window.dispatchEvent(new CustomEvent(REFRESH_EVENT,{detail:{version:VERSION,errors,at:now()}}));
      try{ if(typeof window.renderAll==='function') window.renderAll(); }catch(e){console.warn('[RC5.3 renderAll]',e)}
      return {db:d,errors};
    })();
    try{return await refreshing}finally{refreshing=null}
  }

  function scheduleRefresh(delay=350){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>refresh({force:true}).catch(e=>console.warn('[RC5.3 refresh]',e)),delay);
  }

  function collectionFor(table){
    const d=ensureDb();
    const map={
      booklets:'booklets',products:'products',categories:'categories',banners:'banners',orders:'orders',audit:'audit',
      couriers:'couriers',delivery_areas:'deliveryAreas',notifications:'notifications',teacher_requests:'teacherRequests',
      teacher_request_versions:'teacherRequestVersions',order_items:'orderItems',order_timeline:'orderTimeline',
      financial_entries:'financialEntries',financial_payouts:'financialPayouts',library_settlements:'librarySettlements',
      teacher_settlements:'teacherSettlements',delegate_settlements:'courierSettlements',coupons:'coupons',
      backup_logs:'backupLogs',system_health_logs:'systemHealthLogs'
    };
    if(table==='accounts') return d.accounts.all||(d.accounts.all=[]);
    const k=map[table]; return k?(d[k]||(d[k]=[])):null;
  }

  function applyLocalInsert(table,row){
    if(!row)return;
    if(table==='settings'){
      if(row.key&&row.key!=='__main__') ensureDb().settings[row.key]=row.value;
      if(row.data&&typeof row.data==='object')Object.assign(ensureDb().settings,row.data);
      return;
    }
    const list=collectionFor(table); if(!list)return;
    const i=list.findIndex(x=>String(x.id)===String(row.id));
    if(i>=0) list[i]={...list[i],...row}; else list.unshift(row);
    if(table==='accounts') rowsToDb({accounts:list});
  }
  function applyLocalUpdate(table,values,match){
    if(table==='settings'){
      if(match?.key)ensureDb().settings[match.key]=values.value;
      if(values.data&&typeof values.data==='object')Object.assign(ensureDb().settings,values.data);
      return;
    }
    const list=collectionFor(table); if(!list)return;
    list.forEach((x,i)=>{if(Object.entries(match||{}).every(([k,v])=>String(x[k])===String(v)))list[i]={...x,...values}});
    if(table==='accounts') rowsToDb({accounts:list});
  }
  function applyLocalDelete(table,match){
    const list=collectionFor(table);if(!list)return;
    for(let i=list.length-1;i>=0;i--)if(Object.entries(match||{}).every(([k,v])=>String(list[i][k])===String(v)))list.splice(i,1);
    if(table==='accounts')rowsToDb({accounts:list});
  }

  function installMutationBridge(){
    const previous={insert:window.insert,update:window.update,removeRow:window.removeRow,query:window.query};
    if(typeof previous.query==='function') window.query=async function(table){
      if(online())try{return await fetchTable(table)}catch(e){console.warn('[RC5.3 query]',table,e)}
      return typeof previous.query==='function'?previous.query.apply(this,arguments):[];
    };
    if(typeof previous.insert==='function') window.insert=async function(table,row){
      const payload={...row};
      if(!payload.id&&table!=='settings'&&table!=='courier_areas')payload.id=uid(table.slice(0,2).toUpperCase());
      const result=await previous.insert.call(this,table,payload);
      applyLocalInsert(table,result||payload);
      window.dispatchEvent(new CustomEvent(MUTATION_EVENT,{detail:{type:'insert',table,row:result||payload}}));
      scheduleRefresh();
      return result||payload;
    };
    if(typeof previous.update==='function') window.update=async function(table,values,match){
      const result=await previous.update.call(this,table,values,match);
      applyLocalUpdate(table,values,match);
      window.dispatchEvent(new CustomEvent(MUTATION_EVENT,{detail:{type:'update',table,values,match}}));
      scheduleRefresh();
      return result;
    };
    if(typeof previous.removeRow==='function') window.removeRow=async function(table,match){
      const result=await previous.removeRow.call(this,table,match);
      applyLocalDelete(table,match);
      window.dispatchEvent(new CustomEvent(MUTATION_EVENT,{detail:{type:'delete',table,match}}));
      scheduleRefresh();
      return result;
    };
  }

  const BUCKET_BY_KIND={
    teacherWord:'teacher-word',finalPdf:'final-pdf',productImage:'product-images',banner:'banners',logo:'logos',profile:'profile-images',backup:'backups',generic:'alin-files'
  };
  async function upload(kind,file,folder=''){
    if(!file?.name)throw new Error('اختر ملفاً أولاً');
    const c=client();if(!c)throw new Error('Supabase غير متصل');
    const bucket=BUCKET_BY_KIND[kind]||kind||'alin-files';
    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';
    const safeFolder=String(folder||'').replace(/[^a-z0-9_\-/]/gi,'').replace(/^\/+|\/+$/g,'');
    const path=`${safeFolder?safeFolder+'/':''}${Date.now()}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}.${ext}`;
    const {data,error}=await c.storage.from(bucket).upload(path,file,{upsert:false,cacheControl:'3600',contentType:file.type||undefined});
    if(error)throw error;
    return {bucket,path:data?.path||path};
  }
  async function fileUrl(ref,expires=900){
    if(!ref)return '';
    if(/^https?:\/\//i.test(String(ref)))return String(ref);
    const bucket=ref.bucket||'alin-files',path=ref.path||String(ref);
    const c=client();if(!c)return '';
    const {data,error}=await c.storage.from(bucket).createSignedUrl(path,expires);
    if(!error&&data?.signedUrl)return data.signedUrl;
    return c.storage.from(bucket).getPublicUrl(path).data?.publicUrl||'';
  }

  async function verify(){
    const report={version:VERSION,at:now(),online:navigator.onLine,client:!!client(),tables:{},ok:true};
    if(!client()){report.ok=false;report.error='Supabase client غير متوفر';return report}
    for(const t of ['settings','accounts','orders','booklets','products','notifications']){
      try{const c=await fetchTable(t);report.tables[t]={ok:true,count:c.length}}catch(e){report.tables[t]={ok:false,error:errText(e)};report.ok=false}
    }
    return report;
  }

  function install(){
    if(installed)return;installed=true;
    ensureDb();
    installMutationBridge();
    window.AlinRepository={version:VERSION,refresh,verify,fetchTable,online};
    window.AlinStorage={version:VERSION,upload,fileUrl,buckets:{...BUCKET_BY_KIND}};
    window.ALIN_CONFIG={...(window.ALIN_CONFIG||{}),version:VERSION,databaseVersion:'RC5.2'};
    window.addEventListener('online',()=>refresh({force:true}).catch(()=>{}));
    if(online()) setTimeout(()=>refresh({force:true}).catch(e=>console.warn('[RC5.3 startup]',e)),250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();


;
