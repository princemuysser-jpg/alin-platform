// === courier/dashboard.js ===
/* ALIN v2.1.8 — direct courier workflow with database-backed assignment timestamps and valid statuses. */
(function(){
  'use strict';

  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const arr=v=>Array.isArray(v)?v:[];
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyv=v=>typeof money==='function'?money(v):Number(v||0).toLocaleString('ar-IQ');
  const now=()=>new Date().toISOString();
  const notify=m=>typeof toast==='function'?toast(m):alert(m);
  const currentAccount=()=>{try{return window.current||current||null}catch(_){return window.current||null}};
  const dbx=()=>window.db||{};
  const DEFAULT_AREAS=['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء','حي الحسين','حي العمل الشعبي','غرناطة','المنصور','البلديات','الشرطة','النداء'];
  let refreshPromise=null,lastRefresh=0,renderSerial=0;

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
  function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString('ar-IQ')}catch(_){return String(v)}}
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

  // ---------------- Admin: courier accounts ----------------
  function renderCouriersAdmin(){
    const rows=allCouriers(),areas=[...new Set([...areaRows().map(x=>x.name),...rows.flatMap(areasOf)])];
    const debt=rows.reduce((sum,c)=>sum+financials(c).debt,0);
    adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>نظام التوصيل</small><h2>إدارة المندوبين</h2><p>الحسابات والمناطق والحالة والطلبات والذمم من مكان واحد.</p></div><div><button onclick="adminTab('deliveryOrders')">طلبات التوصيل</button><button onclick="adminTab('courierAreas')">إدارة المناطق</button><button onclick="alinV161CourierForm()">+ إضافة مندوب</button></div></header><section class="v164-admin-metrics"><article><small>إجمالي المندوبين</small><strong>${rows.length}</strong></article><article><small>فعالون</small><strong>${rows.filter(c=>c.status!=='inactive').length}</strong></article><article><small>متاحون</small><strong>${rows.filter(c=>statusOf(c)==='available').length}</strong></article><article><small>طلبات جارية</small><strong>${rows.reduce((sum,c)=>sum+activeLoad(c),0)}</strong></article><article><small>إجمالي الذمم</small><strong>${moneyv(debt)} د.ع</strong></article></section><section class="v164-admin-tools"><input id="v216CourierQ" placeholder="بحث بالاسم أو الهاتف أو المنطقة" oninput="alinV216FilterCouriers()"><select id="v216CourierStatus" onchange="alinV216FilterCouriers()"><option value="">كل الحالات</option><option value="available">متاح</option><option value="busy">مشغول</option><option value="offline">خارج الخدمة</option><option value="inactive">موقوف</option></select><select id="v216CourierArea" onchange="alinV216FilterCouriers()"><option value="">كل المناطق</option>${areas.map(a=>`<option value="${escv(a)}">${escv(a)}</option>`).join('')}</select></section><div class="v164-admin-grid" id="v216CourierGrid">${rows.map(adminCourierCard).join('')||'<div class="empty">لا يوجد مندوبون بعد.</div>'}</div></section>`;
  }
  function adminCourierCard(c){const status=c.status==='inactive'?'inactive':statusOf(c),areas=areasOf(c),f=financials(c);return `<article class="v164-admin-card" data-search="${escv(((c.name||'')+' '+(c.phone||'')+' '+(c.username||'')+' '+areas.join(' ')).toLowerCase())}" data-status="${status}" data-areas="${escv(areas.join('|'))}"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h3>${escv(c.name||'مندوب')}</h3><p>${escv(c.phone||'بدون هاتف')} • ${escv(c.username||'بدون اسم دخول')}</p></div><span class="v161-status ${status}">${statusLabel(status)}</span></header><div class="v164-card-metrics"><div><small>الطلبات الحالية</small><b>${activeLoad(c)}</b></div><div><small>مكتملة اليوم</small><b>${todayDone(c)}</b></div><div><small>الذمة</small><b>${moneyv(f.debt)} د.ع</b></div></div><div class="v161-area-chips">${areas.map(a=>`<span>${escv(a)}</span>`).join('')||'<span>غير مرتبط بمنطقة</span>'}</div><footer><button onclick="alinV164CourierDetails('${escv(c.id)}')">التفاصيل</button><button onclick="alinV161CourierForm('${escv(c.id)}')">تعديل</button><button class="secondary" onclick="alinV164AdminStatus('${escv(c.id)}')">تغيير الحالة</button><button class="danger" onclick="alinV161ToggleCourier('${escv(c.id)}')">${c.status==='inactive'?'تفعيل':'إيقاف'}</button></footer></article>`}
  window.alinV216FilterCouriers=function(){const q=String($('#v216CourierQ')?.value||'').toLowerCase(),status=$('#v216CourierStatus')?.value||'',area=$('#v216CourierArea')?.value||'';$$('#v216CourierGrid .v164-admin-card').forEach(card=>card.hidden=!((!q||card.dataset.search.includes(q))&&(!status||card.dataset.status===status)&&(!area||card.dataset.areas.split('|').includes(area))))};
  window.alinV161CourierForm=function(id=''){
    const c=allCouriers().find(x=>String(x.id)===String(id))||{},selected=areasOf(c),box=window.checkoutBox||$('#checkoutBox'),modal=window.checkoutModal||$('#checkoutModal');if(!box||!modal)return;
    box.innerHTML=`<div class="v161-form"><h2>${id?'تعديل المندوب':'إضافة مندوب'}</h2><div class="form-grid"><input id="v161CourierName" value="${escv(c.name||'')}" placeholder="اسم المندوب"><input id="v161CourierPhone" value="${escv(c.phone||'')}" placeholder="رقم الهاتف"><input id="v161CourierUsername" value="${escv(c.username||'')}" placeholder="اسم المستخدم"><input id="v161CourierPassword" type="password" autocomplete="new-password" placeholder="${id?'كلمة مرور جديدة (اختياري)':'كلمة المرور'}"><select id="v161CourierAvailability"><option value="available" ${statusOf(c)==='available'?'selected':''}>متاح</option><option value="busy" ${statusOf(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${statusOf(c)==='offline'?'selected':''}>خارج الخدمة</option></select></div><h3>مناطق العمل</h3><div class="v161-area-picker">${areaRows().map(a=>`<label><input type="checkbox" value="${escv(a.name)}" ${selected.includes(a.name)?'checked':''}> ${escv(a.name)}</label>`).join('')}</div><button onclick="alinV161SaveCourier('${escv(id)}')">حفظ المندوب</button></div>`;modal.classList.remove('hidden');
  };
  window.alinV161SaveCourier=async function(id=''){
    try{
      const name=$('#v161CourierName')?.value.trim()||'',phone=$('#v161CourierPhone')?.value.trim()||'',username=$('#v161CourierUsername')?.value.trim()||'',password=$('#v161CourierPassword')?.value||'',availability=$('#v161CourierAvailability')?.value||'available',areas=$$('.v161-area-picker input:checked').map(x=>x.value);
      if(!name||!username||(!id&&!password))throw new Error('أكمل الاسم واسم المستخدم وكلمة المرور');if(!phone)throw new Error('أدخل رقم هاتف المندوب');if(!areas.length)throw new Error('اختر منطقة عمل واحدة على الأقل');if(password&&password.length<8)throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف أو أرقام');
      const api=window.ALINAuth;if(!api)throw new Error('خدمة الحسابات الآمنة غير جاهزة');
      const payload={role:'courier',name,username,phone,area:areas[0],areas,availability,status:'active'};if(password)payload.password=password;
      if(id)await api.updateAccountFromAdmin({account_id:id,...payload});else await api.createAccount(payload);
      if(typeof audit==='function')await audit('courier',`${id?'تعديل':'إضافة'} مندوب ${name}`);if(typeof load==='function')await load();if(typeof closeCheckout==='function')closeCheckout();renderCouriersAdmin();notify('تم حفظ حساب المندوب ومناطق عمله');
    }catch(error){alert(error.message||'تعذر حفظ المندوب')}
  };
  window.alinV161ToggleCourier=async function(id){const c=allCouriers().find(x=>String(x.id)===String(id));if(!c)return;const next=c.status==='inactive'?'active':'inactive';try{const api=window.ALINAuth;if(api?.updateAccountFromAdmin)await api.updateAccountFromAdmin({account_id:id,role:'courier',status:next,name:c.name,username:c.username,phone:c.phone,area:areasOf(c)[0]||'',areas:areasOf(c),availability:statusOf(c)});else await update('couriers',{status:next,updated_at:now()},{id});if(typeof load==='function')await load();renderCouriersAdmin()}catch(error){alert(error.message||'تعذر تحديث الحساب')}};
  window.alinV164AdminStatus=async function(id){const c=allCouriers().find(x=>String(x.id)===String(id));if(!c)return;const value=prompt('الحالة: available أو busy أو offline',statusOf(c));if(!['available','busy','offline'].includes(String(value)))return;try{await update('couriers',{availability:value,updated_at:now()},{id});if(typeof load==='function')await load();renderCouriersAdmin()}catch(error){alert(error.message||'تعذر تحديث الحالة')}};
  window.alinV164CourierDetails=function(id){const c=allCouriers().find(x=>String(x.id)===String(id)),box=window.checkoutBox||$('#checkoutBox'),modal=window.checkoutModal||$('#checkoutModal');if(!c||!box||!modal)return;const rows=myOrders(c),f=financials(c);box.innerHTML=`<section class="v164-details"><header><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name||'مندوب')}</h2><p>${escv(c.phone||'')} • ${escv(c.username||'')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></header><div class="v164-admin-metrics"><article><small>طلبات حالية</small><strong>${rows.filter(active).length}</strong></article><article><small>طلبات مكتملة</small><strong>${rows.filter(done).length}</strong></article><article><small>أرباحه</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>ذمته</small><strong>${moneyv(f.debt)} د.ع</strong></article></div><h3>مناطق العمل</h3><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')}</div><h3>آخر الطلبات</h3><div class="v164-mini-orders">${rows.slice(0,8).map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${escv(o.delivery_area||'')}</span><b>${moneyv(o.total)} د.ع</b><small>${escv(orderState(o.status))}</small></div>`).join('')||'<p class="empty">لا توجد طلبات.</p>'}</div></section>`;modal.classList.remove('hidden')};

  // ---------------- Admin: delivery areas ----------------
  function renderCourierAreasAdmin(){const rows=areaRows();adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>مناطق التوصيل</small><h2>إدارة المناطق</h2><p>هذه القائمة تظهر للطالب وعند تحديد مناطق عمل المندوب.</p></div><button onclick="alinV161AddArea()">+ إضافة منطقة</button></header><div class="v161-area-admin">${rows.map(a=>{const count=allCouriers().filter(c=>areasOf(c).includes(a.name)).length;return `<article><div><h3>${escv(a.name)}</h3><p>مرتبطة بـ ${count} مندوب</p></div><div><button onclick="alinV161EditArea('${escv(a.id)}','${escv(a.name)}')">تعديل</button><button class="danger" onclick="alinV161DeleteArea('${escv(a.id)}','${escv(a.name)}')">حذف</button></div></article>`}).join('')}</div></section>`}
  window.alinV161AddArea=async function(){const name=(prompt('اسم المنطقة الجديدة')||'').trim();if(!name)return;try{await insert('delivery_areas',{id:typeof uid==='function'?uid('A'):`A${Date.now()}`,name,city:'كركوك',status:'active',sort_order:areaRows().length+1});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تمت إضافة المنطقة')}catch(error){alert(error.message||'تعذر إضافة المنطقة')}};
  window.alinV161EditArea=async function(id,oldName){const name=(prompt('تعديل اسم المنطقة',oldName)||'').trim();if(!name||name===oldName)return;try{await update('delivery_areas',{name},{id});for(const c of allCouriers()){const areas=areasOf(c);if(areas.includes(oldName))await update('couriers',{areas:areas.map(x=>x===oldName?name:x),area:c.area===oldName?name:c.area,updated_at:now()},{id:c.id})}if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم تعديل المنطقة')}catch(error){alert(error.message||'تعذر تعديل المنطقة')}};
  window.alinV161DeleteArea=async function(id,name){if(allCouriers().some(c=>areasOf(c).includes(name)))return alert('لا يمكن حذف منطقة مرتبطة بمندوب');if(!confirm(`حذف منطقة ${name}؟`))return;try{await update('delivery_areas',{status:'inactive'},{id});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم حذف المنطقة')}catch(error){alert(error.message||'تعذر حذف المنطقة')}};

  // ---------------- Admin: delivery assignment ----------------
  function deliveryOrders(){return allOrders().filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area)}
  function renderDeliveryOrdersAdmin(){const rows=deliveryOrders();adminContent.innerHTML=`<section class="v164-admin-couriers"><header class="v164-admin-head"><div><small>توزيع الطلبات</small><h2>طلبات التوصيل</h2><p>اختيار المندوب حسب المنطقة مع عرض الطالب ونقطة الدلالة والموقع.</p></div><button onclick="renderCouriersAdmin()">إدارة المندوبين</button></header><section class="v164-admin-metrics"><article><small>كل طلبات التوصيل</small><strong>${rows.length}</strong></article><article><small>بانتظار التعيين</small><strong>${rows.filter(o=>!o.courier_id&&!o.delegate_id).length}</strong></article><article><small>قيد التوصيل</small><strong>${rows.filter(o=>active(o)&&(o.courier_id||o.delegate_id)).length}</strong></article><article><small>مكتملة</small><strong>${rows.filter(done).length}</strong></article></section><div class="v164-delivery-admin-list">${rows.map(deliveryAdminCard).join('')||'<div class="empty">لا توجد طلبات توصيل.</div>'}</div></section>`}
  function deliveryAdminCard(o){const area=window.alinNormalizeDeliveryArea(o.delivery_area)||'غير محددة',matches=matchingCouriers(area),assigned=allCouriers().find(c=>String(c.id)===String(o.courier_id||o.delegate_id||'')),map=mapLink(o);return `<article class="v164-delivery-admin-card"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span>${escv(area)}</span></header>${o.delivery_note?`<div class="v164-issue">ملاحظة المندوب: ${escv(o.delivery_note)}</div>`:''}<div class="v164-order-grid"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(o.student_phone||'—')}</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div><div><small>المبلغ</small><b>${moneyv(o.total)} د.ع</b></div><div><small>الحالة</small><b>${escv(orderState(o.status))}</b></div></div>${map?`<a class="v164-map-btn" href="${escv(map)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`:''}<div class="v164-match-list"><h4>المندوبون المطابقون للمنطقة (${matches.length})</h4>${matches.map(c=>`<label><input type="radio" name="v216assign_${escv(o.id)}" value="${escv(c.id)}" ${assigned&&String(assigned.id)===String(c.id)?'checked':''}><span><b>${escv(c.name)}</b><small>${statusLabel(statusOf(c))} • ${activeLoad(c)} طلب حالي • ${escv(c.phone||'')}</small></span></label>`).join('')||'<p class="warning-text">لا يوجد مندوب مرتبط بهذه المنطقة.</p>'}</div><footer><button ${!matches.length?'disabled':''} onclick="alinV164Assign('${escv(o.id)}')">${assigned?'إعادة تحويل':'تحويل للمندوب'}</button>${assigned?`<span>المندوب الحالي: <b>${escv(assigned.name)}</b></span>`:'<span>لم يتم تعيين مندوب</span>'}</footer></article>`}
  window.alinV164Assign=async function(id){
    const selected=document.querySelector(`input[name="v216assign_${CSS.escape(String(id))}"]:checked`)?.value;
    if(!selected)return notify('اختر مندوباً أولاً');
    try{
      await update('orders',{courier_id:selected,delegate_id:selected,...workflowValues('assigned'),delivery_note:null},{id});
      if(typeof audit==='function')await audit('courier',`تحويل الطلب ${id} إلى المندوب ${selected}`);
      if(typeof load==='function')await load();
      renderDeliveryOrdersAdmin();
      notify('تم تحويل الطلب للمندوب');
      return true;
    }catch(error){console.error('[ALIN assign courier]',error);notify(friendlyOrderError(error));return false}
  };
  window.alinV161AssignOrder=window.alinV164Assign;
  async function assignCourier(id){
    const selected=$(`#assign_${CSS.escape(String(id))}`)?.value||null;
    try{
      const values=selected?{courier_id:selected,delegate_id:selected,...workflowValues('assigned')}:{courier_id:null,delegate_id:null,assignment_status:'pending_admin',status:'pending_admin',assigned_at:null,updated_at:now()};
      await update('orders',values,{id});
      if(typeof load==='function')await load();
      if(typeof renderCourierSettlementsAdmin==='function')renderCourierSettlementsAdmin();
      return true;
    }catch(error){console.error('[ALIN assign courier legacy screen]',error);notify(friendlyOrderError(error));return false}
  }
  async function courierOrderStatus(id,status){
    try{
      await update('orders',workflowValues(status),{id});
      if(typeof load==='function')await load();
      if(typeof renderCourierSettlementsAdmin==='function')renderCourierSettlementsAdmin();
      return true;
    }catch(error){console.error('[ALIN courier status admin]',error);notify(friendlyOrderError(error));return false}
  }

  // ---------------- Courier page ----------------
  function ensureTabs(){const nav=$('.courier-v161-tabs');if(!nav)return;const wanted=[['home','الرئيسية'],['current','طلبات التوصيل'],['completed','المكتملة'],['finance','الحسابات'],['notifications','الإشعارات'],['profile','حسابي']];nav.innerHTML=wanted.map(([key,label])=>`<button type="button" data-courier-tab="${key}" onclick="renderCourierDashboard('${key}')">${label}${key==='current'?'<span id="courierCurrentBadge" hidden>0</span>':''}${key==='notifications'?'<span id="courierNotifyBadge" hidden>0</span>':''}</button>`).join('')}
  function notificationsFor(c){return arr(dbx().notifications).filter(n=>String(n.courier_id||n.user_id||n.recipient_id||n.target_id||'')===String(c?.id)||['courier','delegate','all'].includes(String(n.target_role||n.role||n.audience||''))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
  function setHeader(c,tab){const name=$('#courierV161Name'),areas=$('#courierV161Areas');if(name)name.textContent=c?.name||currentAccount()?.name||'المندوب';if(areas)areas.textContent=areasOf(c).join('، ')||'غير محددة';$$('.courier-v161-tabs [data-courier-tab]').forEach(b=>b.classList.toggle('active',b.dataset.courierTab===tab));const cb=$('#courierCurrentBadge'),nb=$('#courierNotifyBadge'),activeCount=myOrders(c).filter(active).length,unread=notificationsFor(c).filter(n=>!(n.read_at||n.is_read)).length;if(cb){cb.textContent=activeCount;cb.hidden=!activeCount}if(nb){nb.textContent=unread;nb.hidden=!unread}}
  function summary(c,rows){const f=financials(c);return `<section class="v174-metrics"><article><small>طلبات جديدة</small><strong>${rows.filter(o=>['assigned','new'].includes(String(o.status||''))).length}</strong></article><article><small>قيد التوصيل</small><strong>${rows.filter(o=>['accepted','picked_up','out_for_delivery','processing'].includes(String(o.status||''))).length}</strong></article><article><small>تم التسليم اليوم</small><strong>${rows.filter(o=>done(o)&&today(o)).length}</strong></article><article><small>كل المكتملة</small><strong>${rows.filter(done).length}</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article class="debt"><small>ذمتك للإدارة</small><strong>${moneyv(f.debt)} د.ع</strong></article></section>`}
  function homeHtml(c,rows){const currentRows=rows.filter(active).slice(0,5),notes=notificationsFor(c).slice(0,4);return `${summary(c,rows)}<section class="v174-home-grid"><article class="v174-panel"><header><div><small>حالة العمل</small><h2>${statusLabel(statusOf(c))}</h2></div><span class="v174-status ${statusOf(c)}"></span></header><div class="v174-status-actions"><button onclick="alinV174QuickStatus('available')">متاح</button><button onclick="alinV174QuickStatus('busy')">مشغول</button><button onclick="alinV174QuickStatus('offline')">خارج الخدمة</button></div><p>مناطق العمل: ${escv(areasOf(c).join('، ')||'غير محددة')}</p></article><article class="v174-panel"><header><div><small>طلبات تحتاج متابعة</small><h2>طلباتك الحالية</h2></div><button onclick="renderCourierDashboard('current')">عرض الكل</button></header><div class="v174-mini-list">${currentRows.map(o=>`<button onclick="renderCourierDashboard('current')"><b>${escv(o.order_number||o.id)}</b><span>${escv(window.alinNormalizeDeliveryArea(o.delivery_area)||'—')}</span><small>${escv(orderState(String(o.status||'')))}</small></button>`).join('')||'<p class="empty">لا توجد طلبات حالياً.</p>'}</div></article><article class="v174-panel wide"><header><div><small>آخر الإشعارات</small><h2>تنبيهات المندوب</h2></div><button onclick="renderCourierDashboard('notifications')">عرض الإشعارات</button></header><div class="v174-mini-list">${notes.map(n=>`<div><b>${escv(n.title||'إشعار')}</b><span>${escv(n.message||n.body||'')}</span><small>${escv(fmtDate(n.created_at))}</small></div>`).join('')||'<p class="empty">لا توجد إشعارات جديدة.</p>'}</div></article></section>`}
  function orderCard(o,actions=true){const st=String(o.status||'assigned'),phone=o.student_phone||'',map=mapLink(o),first=['assigned','new'].includes(st),accepted=st==='accepted',picked=st==='picked_up',moving=['out_for_delivery','processing'].includes(st);return `<article class="v174-order"><header><div><small>${escv(o.order_number||o.id)}</small><h3>${escv(o.title||'طلب توصيل')}</h3></div><span class="v174-order-state ${escv(st)}">${escv(orderState(st))}</span></header><div class="v174-order-data"><div><small>الطالب</small><b>${escv(o.student_name||'—')}</b></div><div><small>الهاتف</small><b>${escv(phone||'—')}</b></div><div><small>المنطقة</small><b>${escv(window.alinNormalizeDeliveryArea(o.delivery_area)||'—')}</b></div><div><small>المبلغ المطلوب</small><b>${moneyv(o.total)} د.ع</b></div><div><small>أجرة التوصيل</small><b>${moneyv(o.courier_profit||o.delivery_fee||0)} د.ع</b></div><div class="wide"><small>أقرب نقطة دالة</small><b>${escv(o.delivery_landmark||'—')}</b></div></div><div class="v174-links">${phone?`<a href="${phoneLink(phone)}">اتصال</a><a href="${waLink(phone)}" target="_blank" rel="noopener">واتساب</a>`:''}${map?`<a class="map" href="${escv(map)}" target="_blank" rel="noopener">فتح الموقع GPS</a>`:''}</div>${actions?`<div class="v174-actions">${first?`<button onclick="alinV164CourierStep('${escv(o.id)}','accepted')">قبول الطلب</button><button class="reject" onclick="alinV174Reject('${escv(o.id)}')">رفض الطلب</button>`:''}${accepted?`<button onclick="alinV164CourierStep('${escv(o.id)}','picked_up')">استلمت الطلب</button>`:''}${picked?`<button onclick="alinV164CourierStep('${escv(o.id)}','out_for_delivery')">بدء التوصيل</button>`:''}${moving?`<button class="success" onclick="alinV164CourierComplete('${escv(o.id)}')">تم التسليم واستلام المبلغ</button>`:''}<button class="secondary" onclick="alinV164ReportIssue('${escv(o.id)}')">إرسال ملاحظة للإدارة</button></div>`:`<footer>تم التسليم: ${escv(fmtDate(o.delivered_at||o.completed_at||o.updated_at))}</footer>`}</article>`}
  function ordersHtml(c,rows,completed=false){const list=rows.filter(completed?done:active);return `${summary(c,rows)}<section class="v174-head"><div><small>${completed?'سجل الإنجاز':'طلبات التوصيل'}</small><h2>${completed?'الطلبات المكتملة':'طلباتك الحالية'}</h2></div><span>${list.length}</span></section><div class="v174-orders">${list.map(o=>orderCard(o,!completed)).join('')||`<div class="empty">${completed?'لا توجد طلبات مكتملة بعد.':'لا توجد طلبات مسندة إليك حالياً.'}</div>`}</div>`}
  function financeHtml(c,rows){const f=financials(c),doneRows=rows.filter(done);return `${summary(c,rows)}<section class="v164-finance-grid"><article><small>المبالغ المستلمة</small><strong>${moneyv(f.collected)} د.ع</strong></article><article><small>أرباح التوصيل</small><strong>${moneyv(f.earnings)} د.ع</strong></article><article><small>المسدّد للإدارة</small><strong>${moneyv(f.paid)} د.ع</strong></article><article class="debt"><small>المبلغ بذمتك</small><strong>${moneyv(f.debt)} د.ع</strong></article></section><section class="v164-table-card"><h2>كشف الطلبات المالية</h2><div class="v164-finance-list">${doneRows.map(o=>`<div><span>${escv(o.order_number||o.id)}</span><span>${moneyv(o.total)} د.ع</span><span>أجرة التوصيل ${moneyv(o.courier_profit||o.delivery_fee||0)} د.ع</span><span>${escv(fmtDate(o.delivered_at||o.updated_at))}</span></div>`).join('')||'<p class="empty">لا توجد حركات مالية بعد.</p>'}</div></section>`}
  function notificationsHtml(c,rows){const notes=notificationsFor(c);return `${summary(c,rows)}<section class="v164-section-head"><div><h2>إشعارات المندوب</h2><p>الطلبات الجديدة ورسائل الإدارة والتسويات.</p></div><button onclick="alinV164CourierReadAll()">تحديد الكل كمقروء</button></section><div class="v164-notifications">${notes.map(n=>`<article class="${n.read_at||n.is_read?'read':''}"><div><h3>${escv(n.title||'إشعار')}</h3><p>${escv(n.message||n.body||'')}</p><small>${escv(fmtDate(n.created_at))}</small></div>${n.read_at||n.is_read?'':`<button onclick="alinV164CourierRead('${escv(n.id)}')">مقروء</button>`}</article>`).join('')||'<div class="empty">لا توجد إشعارات.</div>'}</div>`}
  function profileHtml(c,rows){return `${summary(c,rows)}<section class="v164-profile"><div class="v164-profile-head"><div class="v161-avatar">${escv((c.name||'م').slice(0,1))}</div><div><h2>${escv(c.name||'مندوب')}</h2><p>${escv(c.phone||currentAccount()?.phone||'بدون هاتف')}</p></div><span class="v161-status ${statusOf(c)}">${statusLabel(statusOf(c))}</span></div><div class="v164-profile-fields"><label>حالة العمل<select id="v161MyAvailability"><option value="available" ${statusOf(c)==='available'?'selected':''}>متاح</option><option value="busy" ${statusOf(c)==='busy'?'selected':''}>مشغول</option><option value="offline" ${statusOf(c)==='offline'?'selected':''}>خارج الخدمة</option></select></label><div><small>مناطق العمل</small><div class="v161-area-chips">${areasOf(c).map(a=>`<span>${escv(a)}</span>`).join('')||'<span>غير محددة</span>'}</div></div></div><button onclick="alinV161SaveMyStatus()">حفظ الحالة</button></section>`}
  function unavailableHtml(){return `<section class="v174-panel"><h2>تعذر ربط صفحة المندوب بالحساب</h2><p>اضغط إعادة المحاولة. إذا استمرت الحالة افتح حساب المندوب من لوحة المدير واحفظه مرة واحدة.</p><button onclick="alinRefreshCourierPage()">إعادة تحميل بيانات المندوب</button></section>`}
  async function renderCourierDashboard(tab='home',options={}){const serial=++renderSerial,box=$('#courierV161Content');if(!box)return false;ensureTabs();let c=resolveCourier();setHeader(c,tab);if(!c){box.innerHTML=unavailableHtml();return false}let rows=myOrders(c);const paint=()=>{if(serial!==renderSerial)return;setHeader(c,tab);if(tab==='home')box.innerHTML=homeHtml(c,rows);else if(tab==='current')box.innerHTML=ordersHtml(c,rows,false);else if(tab==='completed')box.innerHTML=ordersHtml(c,rows,true);else if(tab==='finance')box.innerHTML=financeHtml(c,rows);else if(tab==='notifications')box.innerHTML=notificationsHtml(c,rows);else box.innerHTML=profileHtml(c,rows)};paint();if(options.refresh!==false){c=await refreshCourierData(Boolean(options.force));if(serial!==renderSerial)return true;if(!c){box.innerHTML=unavailableHtml();return false}rows=myOrders(c);paint()}return true}
  async function updateOrder(id,values,message){try{await update('orders',values,{id});const row=allOrders().find(x=>String(x.id)===String(id));if(row)Object.assign(row,values);await refreshCourierData(true);await renderCourierDashboard('current',{refresh:false});notify(message);return true}catch(error){console.error('[ALIN courier order]',error);notify(friendlyOrderError(error));return false}}
  window.alinV164CourierStep=async function(id,status){return updateOrder(id,workflowValues(status),'تم تحديث حالة الطلب')};
  window.alinV164CourierComplete=async function(id){if(!confirm('تأكيد تسليم الطلب واستلام المبلغ من الطالب؟'))return false;const ok=await updateOrder(id,workflowValues('completed'),'تم تسجيل تسليم الطلب');if(ok&&typeof maybeCreateFinancialEntry==='function'){try{await maybeCreateFinancialEntry(id)}catch(error){console.warn('[ALIN courier finance entry]',error)}}return ok};
  window.alinV164ReportIssue=async function(id){const note=(prompt('اكتب الملاحظة أو المشكلة لإرسالها إلى الإدارة')||'').trim();if(!note)return false;return updateOrder(id,{delivery_note:note,updated_at:now()},'تم إرسال الملاحظة للإدارة')};
  window.alinV174Reject=async function(id){const reason=(prompt('اكتب سبب رفض الطلب')||'').trim();if(!reason)return false;if(!confirm('تأكيد رفض الطلب؟'))return false;return updateOrder(id,{...workflowValues('rejected'),delivery_note:reason},'تم رفض الطلب وإبلاغ الإدارة')};
  window.alinV174QuickStatus=async function(value){const c=resolveCourier();if(!c)return false;try{await update('couriers',{availability:value,updated_at:now()},{id:c.id});c.availability=value;await refreshCourierData(true);await renderCourierDashboard('home',{refresh:false});notify('تم تحديث حالة المندوب');return true}catch(error){alert(error.message||'تعذر تحديث الحالة');return false}};
  window.alinV161SaveMyStatus=async function(){return window.alinV174QuickStatus($('#v161MyAvailability')?.value||'available')};
  window.alinV161CourierStatus=window.alinV164CourierStep;
  window.alinV164CourierRead=async function(id){try{await update('notifications',{is_read:true,read_at:now()},{id});const n=arr(dbx().notifications).find(x=>String(x.id)===String(id));if(n){n.is_read=true;n.read_at=now()}await renderCourierDashboard('notifications',{refresh:false})}catch(error){alert(error.message||'تعذر تحديث الإشعار')}};
  window.alinV164CourierReadAll=async function(){const c=resolveCourier(),rows=notificationsFor(c).filter(n=>!(n.read_at||n.is_read));for(const n of rows){try{await update('notifications',{is_read:true,read_at:now()},{id:n.id});n.is_read=true;n.read_at=now()}catch(error){console.warn(error)}}await renderCourierDashboard('notifications',{refresh:false})};
  window.alinRefreshCourierPage=async function(){lastRefresh=0;const box=$('#courierV161Content');if(box)box.innerHTML='<div class="empty">جاري تحميل بيانات المندوب والطلبات...</div>';await refreshCourierData(true);return renderCourierDashboard('home',{refresh:false})};

  // Public/legacy exports.
  window.renderCourierDashboard=renderCourierDashboard;
  window.renderCouriersAdmin=renderCouriersAdmin;
  window.renderCourierAreasAdmin=renderCourierAreasAdmin;
  window.renderDeliveryOrdersAdmin=renderDeliveryOrdersAdmin;
  window.activeCouriers=activeCouriers;
  window.alinCouriersOptions=alinCouriersOptions;
  window.assignCourier=assignCourier;
  window.courierOrderStatus=courierOrderStatus;
  window.addCourier=()=>window.alinV161CourierForm();
  window.toggleCourier=window.alinV161ToggleCourier;
  Object.assign(window.AlinCourierModules,{activeCouriers,renderCouriersAdmin,addCourier:window.addCourier,toggleCourier:window.toggleCourier,assignCourier,courierOrderStatus,alinCouriersOptions});
  window.AlinCourierDashboard=Object.freeze({version:'2.1.8',allCouriers,resolveCourier,myOrders,workflowValues,refreshCourierData,render:renderCourierDashboard});

  // Add the two courier-specific admin routes once.
  const baseAdminTab=window.adminTab;
  if(typeof baseAdminTab==='function'&&!baseAdminTab.__alinCourier217){
    const routed=function(tab){if(tab==='courierAreas')return renderCourierAreasAdmin();if(tab==='deliveryOrders')return renderDeliveryOrdersAdmin();return baseAdminTab.apply(this,arguments)};
    routed.__alinCourier217=true;window.adminTab=routed;
  }

  window.addEventListener('alin:page-open',event=>{if(event.detail?.page==='courier')renderCourierDashboard('home',{force:true})});
  window.addEventListener('alin:data-refreshed',()=>{if($('#courierPage:not(.hidden)'))renderCourierDashboard($('.courier-v161-tabs .active')?.dataset.courierTab||'home',{refresh:false})});
  window.addEventListener('alin:auth-login',event=>{if(event.detail?.account?.role==='courier')setTimeout(()=>renderCourierDashboard('home',{force:true}),0)});
  window.addEventListener('alin:auth-restored',event=>{if(event.detail?.account?.role==='courier')setTimeout(()=>renderCourierDashboard('home',{force:true}),0)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureTabs,{once:true});else ensureTabs();
})();

;
