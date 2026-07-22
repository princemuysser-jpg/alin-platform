// === courier/core.js ===
/* ALIN v2.3.9 — single courier data, areas, workflow, and refresh service. */
(function(){
  'use strict';

  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const arr=v=>Array.isArray(v)?v:[];
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ');
  const now=()=>new Date().toISOString();
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const currentAccount=()=>{try{return window.current||current||null}catch(_){return window.current||null}};
  const dbx=()=>window.db||{};
  const DEFAULT_AREAS=['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء','حي الحسين','حي العمل الشعبي','غرناطة','المنصور','البلديات','الشرطة','النداء'];
  let refreshPromise=null,lastRefresh=0;

  window.AlinCourierModules=window.AlinCourierModules||{};
  window.ALIN_KIRKUK_AREAS=DEFAULT_AREAS.slice();
  window.alinNormalizeDeliveryArea=window.alinNormalizeDeliveryArea||function(value){
    return String(value||'').replace(/[ـً-ٰٟ]/g,'').replace(/\s+/g,' ').trim().split(/\s*[—–-]\s*/)[0].trim();
  };

  function keyOf(row){return String(row?.id||row?.account_id||row?.auth_user_id||row?.username||'')}
  function allCouriers(){
    const database=dbx(),accounts=database.accounts||{};
    const sources=[...arr(accounts.couriers),...arr(accounts.all).filter(x=>x.role==='courier'),...arr(database.couriers),...arr(window.couriers)];
    const map=new Map();
    for(const row of sources){const key=keyOf(row);if(key)map.set(key,{...(map.get(key)||{}),...row,role:'courier'})}
    return [...map.values()];
  }
  function areasOf(c){
    if(!c)return[];let raw=c.areas||c.area_ids||c.area||[];
    if(Array.isArray(raw))return [...new Set(raw.map(String).map(x=>x.trim()).filter(Boolean))];
    if(typeof raw==='string'){
      try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return [...new Set(parsed.map(String).map(x=>x.trim()).filter(Boolean))]}catch(_){ }
      return [...new Set(raw.split(/[,،|]/).map(x=>x.trim()).filter(Boolean))];
    }
    return[];
  }
  function areaRows(){
    const rows=arr(dbx().delivery_areas||dbx().deliveryAreas).filter(x=>x.active!==false&&String(x.status||'active')!=='inactive');
    return rows.length?rows:DEFAULT_AREAS.map((name,index)=>({id:`KA${index+1}`,name,status:'active',sort_order:index+1}));
  }
  function statusOf(c){if(!c||c.status==='inactive')return'inactive';const s=String(c.availability||c.work_status||'available');return ['available','busy','offline'].includes(s)?s:'available'}
  function statusLabel(s){return({available:'متاح',busy:'مشغول',offline:'خارج الخدمة',inactive:'موقوف',active:'فعال'})[s]||s}
  function resolveCourier(){
    const me=currentAccount();if(!me||String(me.role)!=='courier')return null;
    const rows=allCouriers();
    const found=rows.find(c=>String(c.id||c.account_id||'')===String(me.id))
      ||rows.find(c=>me.auth_user_id&&String(c.auth_user_id||'')===String(me.auth_user_id))
      ||rows.find(c=>me.username&&String(c.username||'').toLowerCase()===String(me.username).toLowerCase());
    const merged={...me,...(found||{}),id:found?.id||me.id,role:'courier'};
    if(!merged.areas&&merged.area)merged.areas=[merged.area];
    return merged;
  }
  function allOrders(){return arr(dbx().orders)}
  function myOrders(c=resolveCourier()){
    if(!c)return[];
    const ids=new Set([c.id,c.account_id,currentAccount()?.id].filter(Boolean).map(String));
    return allOrders().filter(o=>ids.has(String(o.courier_id||o.delegate_id||o.courier_account_id||'')))
      .sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')));
  }
  function settlements(){return arr(window.courierSettlements).length?arr(window.courierSettlements):arr(dbx().courierSettlements||dbx().delegate_settlements)}
  function done(o){return ['completed','delivered'].includes(String(o.status||''))}
  function cancelled(o){return ['cancelled','rejected','assignment_expired'].includes(String(o.status||''))}
  function active(o){return !done(o)&&!cancelled(o)}
  function activeLoad(c){return myOrders(c).filter(active).length}
  function today(o){const x=o.delivered_at||o.completed_at||o.updated_at||o.created_at||'';return String(x).slice(0,10)===new Date().toISOString().slice(0,10)}
  function todayDone(c){return myOrders(c).filter(o=>done(o)&&today(o)).length}
  function financials(c){
    const rows=myOrders(c).filter(done),collected=rows.reduce((a,o)=>a+(+o.total||0),0),earnings=rows.reduce((a,o)=>a+(+o.courier_profit||+o.delivery_fee||0),0);
    const paid=settlements().filter(s=>String(s.courier_id||s.delegate_id||s.party_id||'')===String(c.id)&&String(s.status||'paid')!=='cancelled').reduce((a,s)=>a+(+s.amount||0),0);
    return{collected,earnings,paid,debt:Math.max(0,collected-earnings-paid),balance:Math.max(0,earnings-paid)};
  }
  const ORDER_STATUSES=Object.freeze({pending:'pending',new:'new',pending_admin:'pending_admin',assigned:'assigned',accepted:'accepted',picked_up:'picked_up',out_for_delivery:'out_for_delivery',processing:'processing',ready:'ready',completed:'completed',delivered:'delivered',cancelled:'cancelled',rejected:'rejected'});
  function orderState(st){return({pending:'جديد',pending_admin:'بانتظار التعيين',assigned:'بانتظار القبول',new:'طلب جديد',accepted:'مقبول',picked_up:'تم استلام الطلب',out_for_delivery:'في الطريق',out_delivery:'في الطريق',processing:'قيد التنفيذ',ready:'جاهز',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي',rejected:'مرفوض'})[st]||st||'جديد'}
  function workflowValues(status){
    const value=String(status||'').trim();
    if(!Object.values(ORDER_STATUSES).includes(value))throw new Error('حالة الطلب المطلوبة غير معتمدة');
    const stamp=now(),values={status:value,updated_at:stamp};
    if(value==='assigned'){values.assignment_status='assigned';values.assigned_at=stamp}
    if(value==='accepted'){values.assignment_status='accepted';values.accepted_at=stamp}
    if(value==='picked_up'){values.picked_up_at=stamp}
    if(value==='out_for_delivery'){values.out_for_delivery_at=stamp}
    if(value==='completed'||value==='delivered'){values.assignment_status='completed';values.completed_at=stamp;values.delivered_at=stamp}
    if(value==='rejected'){values.assignment_status='rejected';values.rejected_at=stamp}
    if(value==='cancelled'){values.assignment_status='cancelled';values.cancelled_at=stamp}
    return values;
  }
  function friendlyOrderError(error){
    const msg=String(error?.message||error||'');
    if(msg.includes('orders_status_valid'))return 'تعذر تحديث الطلب لأن حالات الطلب في قاعدة البيانات تحتاج تحديث v2.1.8.';
    if(msg.includes("assigned_at")||msg.includes("accepted_at")||msg.includes("picked_up_at")||msg.includes("rejected_at"))return 'قاعدة البيانات تحتاج تشغيل تحديث طلبات المندوب v2.1.8.';
    if(msg.includes('schema cache'))return 'تم تحديث البرنامج لكن مخطط Supabase لم يتحدث بعد. شغّل ملف SQL v2.1.8 مرة واحدة.';
    return 'تعذر تحديث طلب المندوب. تحقق من الاتصال ثم أعد المحاولة.';
  }
  function mapLink(o){const lat=o.delivery_latitude||o.delivery_lat||o.latitude,lng=o.delivery_longitude||o.delivery_lng||o.longitude;return o.delivery_location_url||o.delivery_map_url||o.gps_url||(lat&&lng?`https://maps.google.com/?q=${lat},${lng}`:'')}
  function phoneLink(p){p=String(p||'').replace(/\D/g,'');return p?`tel:+${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function waLink(p){p=String(p||'').replace(/\D/g,'');return p?`https://wa.me/${p.startsWith('964')?p:'964'+p.replace(/^0/,'')}`:'#'}
  function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')}catch(_){return String(v)}}
  function matchingCouriers(area){const target=window.alinNormalizeDeliveryArea(area);return allCouriers().filter(c=>c.status!=='inactive'&&areasOf(c).some(name=>window.alinNormalizeDeliveryArea(name)===target)).sort((a,b)=>activeLoad(a)-activeLoad(b))}
  function activeCouriers(){return allCouriers().filter(c=>c.status!=='inactive')}
  function alinCouriersOptions(){return activeCouriers().map(c=>`<option value="${escv(c.id)}">${escv(c.name||'مندوب')}${areasOf(c).length?' — '+escv(areasOf(c).join('، ')):''}</option>`).join('')}

  function mergeOwnRows(courierRow,orderRows){
    const database=dbx();
    if(courierRow){
      const rows=allCouriers().filter(x=>String(x.id)!==String(courierRow.id));rows.push(courierRow);
      database.couriers=rows;database.accounts=database.accounts||{};database.accounts.couriers=rows;
      try{window.couriers=rows}catch(_){ }
    }
    if(Array.isArray(orderRows)){
      const ownId=String(currentAccount()?.id||''),freshIds=new Set(orderRows.map(x=>String(x.id)));
      const retained=allOrders().filter(x=>!freshIds.has(String(x.id))&&String(x.courier_id||x.delegate_id||'')!==ownId);
      database.orders=[...orderRows,...retained];
    }
  }
  async function refreshCourierData(force=false){
    const me=currentAccount();if(!me||me.role!=='courier')return null;
    if(!force&&Date.now()-lastRefresh<2500)return resolveCourier();
    if(refreshPromise)return refreshPromise;
    refreshPromise=(async()=>{
      const client=window.sb||window.AlinCloud?.client?.();if(!client)return resolveCourier();
      const [courierResult,ordersResult]=await Promise.all([
        client.from('couriers').select('*').eq('id',me.id).maybeSingle(),
        client.from('orders').select('*').or(`courier_id.eq.${me.id},delegate_id.eq.${me.id}`).order('created_at',{ascending:false})
      ]);
      if(courierResult.error)console.warn('[ALIN courier row]',courierResult.error);
      if(ordersResult.error)console.warn('[ALIN courier orders]',ordersResult.error);
      mergeOwnRows(courierResult.data||null,ordersResult.error?null:(ordersResult.data||[]));lastRefresh=Date.now();return resolveCourier();
    })().catch(error=>{console.error('[ALIN courier refresh]',error);return resolveCourier()}).finally(()=>{refreshPromise=null});
    return refreshPromise;
  }


  function resetRefresh(){lastRefresh=0}

  window.AlinCourierCore=Object.freeze({
    $, $$, arr, escv, moneyv, now, notify, currentAccount, dbx,
    allCouriers, areasOf, areaRows, statusOf, statusLabel, resolveCourier,
    allOrders, myOrders, settlements, done, cancelled, active, activeLoad, today, todayDone, financials,
    orderState, workflowValues, friendlyOrderError, mapLink, phoneLink, waLink, fmtDate,
    matchingCouriers, activeCouriers, alinCouriersOptions, refreshCourierData, resetRefresh
  });
})();

;
