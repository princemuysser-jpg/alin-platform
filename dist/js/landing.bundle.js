// Alin landing bundle

/* ===== store/js/delivery-gps-v162.js ===== */
/* V162: student GPS point for delivery + map actions for admin/courier */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const areas=()=>Array.isArray(window.ALIN_KIRKUK_AREAS)&&window.ALIN_KIRKUK_AREAS.length?window.ALIN_KIRKUK_AREAS:[];
  const mapUrl=(lat,lng)=>lat&&lng?`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`:'';

  function areaOptions(selected=''){
    return `<option value="">اختر منطقة التوصيل في كركوك</option>`+areas().map(a=>`<option value="${esc(a)}" ${String(a)===String(selected)?'selected':''}>${esc(a)}</option>`).join('');
  }
  function gpsMarkup(){
    return `<section class="v162-gps-box" id="v162GpsBox">
      <div class="v162-gps-head"><div><b>نقطة موقع التوصيل GPS</b><small>تساعد المدير والمندوب على الوصول للعنوان بدقة.</small></div><span id="v162GpsStatus" class="v162-gps-status">غير محدد</span></div>
      <div class="v162-gps-actions">
        <button type="button" class="v162-gps-primary" onclick="alinV162UseCurrentLocation()"><span aria-hidden="true">⌖</span> استخدام موقعي الحالي</button>
        <button type="button" id="v162OpenMapBtn" class="secondary" onclick="alinV162OpenSelectedMap()" disabled>فتح الموقع على الخريطة</button>
        <button type="button" id="v162ClearGpsBtn" class="secondary" onclick="alinV162ClearGps()" hidden>مسح الموقع</button>
      </div>
      <div id="v162GpsDetails" class="v162-gps-details" hidden></div>
      <input type="hidden" id="deliveryLatitude"><input type="hidden" id="deliveryLongitude"><input type="hidden" id="deliveryLocationUrl"><input type="hidden" id="deliveryLocationAccuracy">
      <p class="v162-gps-note">يلزم السماح للموقع من المتصفح. إذا تعذر تحديد GPS، اكتب العنوان الكامل وأقرب نقطة دالة بدقة.</p>
    </section>`;
  }
  function enhanceDeliveryFields(){
    const root=$('#checkoutBox'); if(!root)return;
    const fields=$('#deliveryFields',root); if(!fields)return;
    const oldArea=$('#deliveryArea',root);
    if(oldArea && oldArea.tagName!=='SELECT'){
      const select=document.createElement('select');select.id='deliveryArea';select.required=true;select.innerHTML=areaOptions(oldArea.value);
      oldArea.replaceWith(select);
    } else if(oldArea && oldArea.tagName==='SELECT' && oldArea.options.length<2){ oldArea.innerHTML=areaOptions(oldArea.value); }
    const courier=$('#courierSelect',root); if(courier) courier.closest('label')?.remove(),courier.remove();
    if(!$('#v162GpsBox',root)){
      const grid=$('.form-grid',fields);
      if(grid) grid.insertAdjacentHTML('afterend',gpsMarkup()); else fields.insertAdjacentHTML('beforeend',gpsMarkup());
    }
    restoreGpsState();
  }
  const stateKey='alin_v162_checkout_gps';
  function saveGpsState(data){try{sessionStorage.setItem(stateKey,JSON.stringify(data))}catch(_){}}
  function readGpsState(){try{return JSON.parse(sessionStorage.getItem(stateKey)||'null')}catch(_){return null}}
  function restoreGpsState(){const s=readGpsState();if(s?.lat&&s?.lng)setGps(s.lat,s.lng,s.accuracy,false)}
  function setGps(lat,lng,accuracy,store=true){
    const la=$('#deliveryLatitude'),lo=$('#deliveryLongitude'),url=$('#deliveryLocationUrl'),acc=$('#deliveryLocationAccuracy');if(!la||!lo)return;
    la.value=Number(lat).toFixed(7);lo.value=Number(lng).toFixed(7);url.value=mapUrl(la.value,lo.value);if(acc)acc.value=Math.round(Number(accuracy||0));
    const status=$('#v162GpsStatus'),details=$('#v162GpsDetails'),open=$('#v162OpenMapBtn'),clear=$('#v162ClearGpsBtn');
    if(status){status.textContent='تم تحديد الموقع';status.classList.add('is-set')}
    if(details){details.hidden=false;details.innerHTML=`<span>خط العرض: <b>${esc(la.value)}</b></span><span>خط الطول: <b>${esc(lo.value)}</b></span>${accuracy?`<span>الدقة التقريبية: <b>${Math.round(accuracy)} متر</b></span>`:''}`}
    if(open)open.disabled=false;if(clear)clear.hidden=false;if(store)saveGpsState({lat:la.value,lng:lo.value,accuracy:Number(accuracy||0)});
  }
  window.alinV162UseCurrentLocation=function(){
    const status=$('#v162GpsStatus');
    if(!navigator.geolocation){if(status)status.textContent='المتصفح لا يدعم GPS';return}
    if(status){status.textContent='جاري تحديد الموقع...';status.classList.remove('is-set')}
    navigator.geolocation.getCurrentPosition(p=>setGps(p.coords.latitude,p.coords.longitude,p.coords.accuracy),e=>{
      if(status)status.textContent=e.code===1?'لم يتم السماح بالموقع':'تعذر تحديد الموقع';
      if(typeof toast==='function')toast('تعذر تحديد GPS. اسمح للموقع أو اكتب العنوان ونقطة الدلالة بدقة.');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  };
  window.alinV162OpenSelectedMap=function(){const u=$('#deliveryLocationUrl')?.value;if(u)window.open(u,'_blank','noopener')};
  window.alinV162ClearGps=function(){['deliveryLatitude','deliveryLongitude','deliveryLocationUrl','deliveryLocationAccuracy'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});try{sessionStorage.removeItem(stateKey)}catch(_){};const st=$('#v162GpsStatus'),dt=$('#v162GpsDetails'),op=$('#v162OpenMapBtn'),cl=$('#v162ClearGpsBtn');if(st){st.textContent='غير محدد';st.classList.remove('is-set')}if(dt)dt.hidden=true;if(op)op.disabled=true;if(cl)cl.hidden=true};

  function installCartHook(){
    if(typeof window.openCart==='function'){
      const old=window.openCart;window.openCart=function(){const r=old.apply(this,arguments);setTimeout(enhanceDeliveryFields,0);return r};
    }
    if(typeof window.toggleDeliveryFields==='function'){
      const oldToggle=window.toggleDeliveryFields;window.toggleDeliveryFields=function(){const r=oldToggle.apply(this,arguments);setTimeout(enhanceDeliveryFields,0);return r};
    }
    document.addEventListener('change',e=>{if(e.target?.name==='fulfillment')setTimeout(enhanceDeliveryFields,0)});
  }

  function orderMapLink(o){
    const lat=o.delivery_latitude||o.latitude||o.delivery_lat,lng=o.delivery_longitude||o.longitude||o.delivery_lng;
    return o.delivery_location_url||o.location_url||mapUrl(lat,lng);
  }
  function decorateAdminDelivery(){
    const rows=(window.db?.orders||[]).filter(o=>o.fulfillment_type==='home_delivery'||o.delivery_area);
    $$('.v161-delivery-card').forEach((card,i)=>{const o=rows[i];if(!o)return;const url=orderMapLink(o);if(!url||$('.v162-map-link',card))return;const actions=$('.v161-delivery-actions',card)||card;actions.insertAdjacentHTML('afterbegin',`<a class="v162-map-link" href="${esc(url)}" target="_blank" rel="noopener">فتح موقع الطالب GPS</a>`)});
  }
  function decorateCourierOrders(){
    const currentId=window.current?.id;
    const rows=(window.db?.orders||[]).filter(o=>String(o.courier_id||o.delegate_id||'')===String(currentId));
    $$('.v161-courier-orders>article').forEach(card=>{
      const numText=$('small',card)?.textContent||'';const o=rows.find(x=>String(x.order_number||x.id)===numText.trim());if(!o)return;const url=orderMapLink(o);if(!url||$('.v162-map-link',card))return;const target=$('.v161-courier-order-actions',card)||card;target.insertAdjacentHTML('afterbegin',`<a class="v162-map-link" href="${esc(url)}" target="_blank" rel="noopener">فتح موقع الطالب</a>`)});
  }
  function installDashboardHooks(){
    if(typeof window.renderDeliveryOrdersAdmin==='function'){const old=window.renderDeliveryOrdersAdmin;window.renderDeliveryOrdersAdmin=function(){const r=old.apply(this,arguments);setTimeout(decorateAdminDelivery,0);return r}}
    if(typeof window.renderCourierDashboard==='function'){const old=window.renderCourierDashboard;window.renderCourierDashboard=function(){const r=old.apply(this,arguments);setTimeout(decorateCourierOrders,0);return r}}
  }
  function install(){installCartHook();installDashboardHooks();setTimeout(enhanceDeliveryFields,100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


/* ===== admin/js/admin-courier-account-link-v163.js ===== */
(function(){
  'use strict';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const escx = v => typeof esc==='function' ? esc(v) : String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const oldAddAccount = window.addAccount;
  const oldRenderAccounts = window.renderAccountsAdmin;
  const oldAdminTab = window.adminTab;

  function areaRows(){
    const rows = Array.isArray(window.db?.delivery_areas) ? window.db.delivery_areas.filter(x=>x.active!==false) : [];
    if(rows.length) return rows.map(x=>({id:x.id||x.name,name:x.name}));
    return ['القادسية','الحرية','الإسكان','عرفة','رحيم آوه','شوراو','طريق بغداد','الواسطي','دوميز','بنجا علي','تسعين','حي النصر','حي النداء','الخضراء','المصلى','القورية','الشورجة','واحد حزيران','الحي العسكري','حي المعلمين','حي الجامعة','حي عدن','حي الزوراء'].map((name,i)=>({id:'K'+i,name}));
  }

  function patchAccountForm(){
    const form = $('#v131AccountForm');
    const role = $('#aRole');
    if(!form || !role) return;

    if(!role.querySelector('option[value="courier"]')){
      const option=document.createElement('option');
      option.value='courier';
      option.textContent='مندوب';
      role.appendChild(option);
    }

    const grid=form.querySelector('.form-grid');
    if(grid && !$('#v163CourierAccountFields')){
      const box=document.createElement('div');
      box.id='v163CourierAccountFields';
      box.className='v163-courier-account-fields';
      box.hidden=true;
      box.innerHTML=`
        <div class="v163-courier-fields-title">
          <div><b>بيانات المندوب</b><small>الحساب يُربط مباشرة بصفحة المندوب ونظام طلبات التوصيل.</small></div>
          <span>صفحة المندوب</span>
        </div>
        <div class="form-grid v163-courier-fields-grid">
          <input id="v163CourierPhone" inputmode="tel" placeholder="رقم هاتف المندوب">
          <select id="v163CourierAvailability">
            <option value="available">متاح</option>
            <option value="busy">مشغول</option>
            <option value="offline">غير متصل</option>
          </select>
        </div>
        <h4>مناطق العمل في كركوك</h4>
        <div id="v163CourierAreaPicker" class="v163-area-picker">
          ${areaRows().map(a=>`<label><input type="checkbox" value="${escx(a.name)}"><span>${escx(a.name)}</span></label>`).join('')}
        </div>
        <p class="v163-account-note">بعد الحفظ يستطيع المندوب تسجيل الدخول من صفحة المندوب بنفس اسم المستخدم والرقم السري.</p>`;
      grid.insertAdjacentElement('afterend',box);
    }

    const sync=()=>{
      const courier=role.value==='courier';
      const courierBox=$('#v163CourierAccountFields');
      if(courierBox) courierBox.hidden=!courier;
      const area=$('#aArea'), landmark=$('#aLandmark');
      if(area){ area.hidden=courier; area.required=!courier; }
      if(landmark){ landmark.hidden=courier; landmark.required=false; }
      const title=form.querySelector('h3');
      if(title) title.textContent=courier?'إضافة حساب مندوب':'إضافة حساب';
    };
    role.onchange=sync;
    sync();
  }

  async function saveCourierFromAccount(){
    try{
      const name=$('#aName')?.value.trim()||'';
      const username=$('#aUser')?.value.trim()||'';
      const password=$('#aPass')?.value.trim()||'';
      const phone=$('#v163CourierPhone')?.value.trim()||'';
      const availability=$('#v163CourierAvailability')?.value||'available';
      const areas=$$('#v163CourierAreaPicker input:checked').map(x=>x.value);
      if(!name || !username || !password) throw new Error('أكمل اسم المندوب واسم الدخول والرقم السري');
      if(!phone) throw new Error('أدخل رقم هاتف المندوب');
      if(!areas.length) throw new Error('اختر منطقة عمل واحدة على الأقل');
      const duplicate=[...(window.couriers||[]),...(window.db?.accounts?.teachers||[]),...(window.db?.accounts?.libraries||[])].some(x=>String(x.username||'').trim().toLowerCase()===username.toLowerCase());
      if(duplicate) throw new Error('اسم الدخول مستخدم مسبقاً');
      const id=typeof uid==='function'?uid('C'):'C'+Date.now();
      const payload={id,name,phone,username,password_hash:password,areas,area:areas[0],availability,status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      if(typeof insert!=='function') throw new Error('تعذر الوصول إلى قاعدة البيانات');
      await insert('couriers',payload);
      if(typeof audit==='function') await audit('courier','إضافة حساب مندوب '+name+' من إدارة الحسابات');
      if(typeof load==='function') await load();
      if(typeof toast==='function') toast('تم إنشاء حساب المندوب وربطه بصفحة المندوب');
      else if(typeof notify==='function') notify('تم إنشاء حساب المندوب وربطه بصفحة المندوب');
      if(typeof window.renderAccountsAdmin==='function') window.renderAccountsAdmin();
      patchAccountForm();
    }catch(e){ alert(e?.message||'تعذر حفظ حساب المندوب'); }
  }

  window.addAccount=async function(){
    if($('#aRole')?.value==='courier') return saveCourierFromAccount();
    if(typeof oldAddAccount==='function') return oldAddAccount.apply(this,arguments);
  };

  window.renderAccountsAdmin=function(){
    const r=typeof oldRenderAccounts==='function'?oldRenderAccounts.apply(this,arguments):undefined;
    patchAccountForm();
    return r;
  };

  window.adminTab=function(tab){
    const r=typeof oldAdminTab==='function'?oldAdminTab.apply(this,arguments):undefined;
    if(tab==='accounts') patchAccountForm();
    return r;
  };

  document.addEventListener('click',e=>{
    const b=e.target.closest('.v131-add-account');
    if(b) setTimeout(patchAccountForm,0);
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patchAccountForm);
  else patchAccountForm();
})();


/* ===== core/js/auth-security-v167.js ===== */
/* ALIN V167 — login throttling, session expiry, and role guards. */
(function(){
  'use strict';
  const KEY='alin_security_login_attempts_v167';
  const SESSION='alin_secure_session_v167';
  const MAX_ATTEMPTS=5;
  const LOCK_MS=10*60*1000;
  const IDLE_BY_ROLE={admin:15,accountant:15,teacher:30,library:30,courier:30,student:60,store:60};
  const WARN_MS=2*60*1000;
  let idleTimer=null, warningTimer=null, lastActivity=Date.now(), warningBox=null;

  function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(_){return fallback}}
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
  function cleanId(value){return String(value||'').trim().toLowerCase().slice(0,80)}
  function attemptKey(role,user){return cleanId(role)+':'+cleanId(user)}
  function attempts(){return readJSON(KEY,{})}
  function getState(role,user){const all=attempts(),k=attemptKey(role,user),s=all[k]||{count:0,first:0,lockedUntil:0};if(s.lockedUntil&&s.lockedUntil<=Date.now()){delete all[k];writeJSON(KEY,all);return {count:0,first:0,lockedUntil:0}}return s}
  function remainingMs(role,user){return Math.max(0,Number(getState(role,user).lockedUntil||0)-Date.now())}
  function registerFailure(role,user){const all=attempts(),k=attemptKey(role,user),now=Date.now(),old=all[k]||{count:0,first:now,lockedUntil:0};if(now-old.first>LOCK_MS){old.count=0;old.first=now}old.count+=1;if(old.count>=MAX_ATTEMPTS)old.lockedUntil=now+LOCK_MS;all[k]=old;writeJSON(KEY,all);return old}
  function clearFailures(role,user){const all=attempts();delete all[attemptKey(role,user)];writeJSON(KEY,all)}
  function formatTime(ms){const sec=Math.ceil(ms/1000),m=Math.floor(sec/60),s=sec%60;return m?`${m} دقيقة و${s} ثانية`:`${s} ثانية`}
  function loginElements(){return {u:window.loginU||document.getElementById('loginU'),p:window.loginPass||document.getElementById('loginPass'),msg:window.loginMsg||document.getElementById('loginMsg')}}
  function roleNow(){try{return String(window.pendingRole||'')}catch(_){return ''}}
  function currentNow(){try{return window.current||null}catch(_){return null}}

  function setSession(user){
    if(!user||!user.role)return;
    const data={role:user.role,id:user.id||'',username:user.username||'',startedAt:Date.now(),lastActivity:Date.now()};
    try{sessionStorage.setItem(SESSION,JSON.stringify(data))}catch(_){}
    lastActivity=Date.now();scheduleIdle();
  }
  function clearSession(){try{sessionStorage.removeItem(SESSION)}catch(_){};clearTimers();hideWarning()}
  function clearTimers(){if(idleTimer)clearTimeout(idleTimer);if(warningTimer)clearTimeout(warningTimer);idleTimer=warningTimer=null}
  function idleLimit(){const role=String(currentNow()?.role||'');return (IDLE_BY_ROLE[role]||30)*60*1000}
  function touch(){if(!currentNow())return;lastActivity=Date.now();try{const d=JSON.parse(sessionStorage.getItem(SESSION)||'{}');d.lastActivity=lastActivity;sessionStorage.setItem(SESSION,JSON.stringify(d))}catch(_){};hideWarning();scheduleIdle()}
  function scheduleIdle(){
    clearTimers();if(!currentNow())return;
    const limit=idleLimit(),elapsed=Date.now()-lastActivity,remain=Math.max(0,limit-elapsed);
    if(remain<=0){expireSession();return}
    warningTimer=setTimeout(showWarning,Math.max(0,remain-WARN_MS));
    idleTimer=setTimeout(expireSession,remain);
  }
  function showWarning(){
    if(!currentNow())return;
    if(!warningBox){warningBox=document.createElement('div');warningBox.className='alin-session-warning';warningBox.innerHTML='<strong>ستنتهي الجلسة قريباً</strong><span>اضغط استمرار حتى تبقى داخل الحساب.</span><button type="button">استمرار</button>';warningBox.querySelector('button').addEventListener('click',touch);document.body.appendChild(warningBox)}
    warningBox.hidden=false;
  }
  function hideWarning(){if(warningBox)warningBox.hidden=true}
  function expireSession(){
    if(!currentNow())return;clearSession();
    try{if(typeof window.toast==='function')window.toast('انتهت الجلسة لعدم النشاط')}catch(_){}
    try{window.logout()}catch(_){location.reload()}
  }

  const allowed={
    admin:new Set(['admin']),accountant:new Set(['admin']),teacher:new Set(['teacher']),library:new Set(['library']),courier:new Set(['courier']),student:new Set(['store']),store:new Set(['store'])
  };
  function canOpen(page){const c=currentNow();if(page==='store')return true;if(!c)return false;return (allowed[c.role]||new Set()).has(page)}

  function install(){
    const oldLogin=window.doLogin;
    if(typeof oldLogin==='function'){
      window.doLogin=async function(){
        const el=loginElements(),role=roleNow(),user=cleanId(el.u?.value),left=remainingMs(role,user);
        if(left>0){if(el.msg)el.msg.textContent='تم إيقاف المحاولات مؤقتاً. حاول بعد '+formatTime(left);return}
        const before=currentNow();
        try{await oldLogin.apply(this,arguments)}catch(e){if(el.msg)el.msg.textContent=e?.message||'تعذّر تسجيل الدخول'}
        const after=currentNow();
        if(after&&after!==before){clearFailures(role,user);if(el.p)el.p.value='';setSession(after);return}
        const state=registerFailure(role,user),tries=Math.max(0,MAX_ATTEMPTS-state.count);
        if(el.msg){el.msg.textContent=state.lockedUntil>Date.now()?'تم إيقاف المحاولات لمدة 10 دقائق بسبب تكرار الخطأ.':`بيانات الدخول غير صحيحة. المحاولات المتبقية: ${tries}`}
        if(el.p)el.p.value='';
      };
    }
    const oldLogout=window.logout;
    if(typeof oldLogout==='function')window.logout=function(){clearSession();const el=loginElements();if(el.p)el.p.value='';return oldLogout.apply(this,arguments)};
    const oldOpen=window.openPage;
    if(typeof oldOpen==='function')window.openPage=function(page){if(!canOpen(page)){try{if(typeof window.toast==='function')window.toast('ليس لديك صلاحية لفتح هذه الصفحة');else alert('ليس لديك صلاحية لفتح هذه الصفحة')}catch(_){};return}const r=oldOpen.apply(this,arguments);if(currentNow())setSession(currentNow());return r};

    ['click','keydown','touchstart','pointerdown'].forEach(ev=>document.addEventListener(ev,touch,{passive:true}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)touch()});
    if(currentNow())setSession(currentNow());
    window.ALINSecureSession=Object.freeze({version:'167.1',touch,expire:expireSession,remainingMs});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();


/* ===== core/js/file-security-v168.js ===== */
/* ALIN V168 — file upload and URL safety without changing current auth. */
(function(){
  'use strict';
  const RULES={
    image:{ext:['png','jpg','jpeg','webp'],mime:['image/png','image/jpeg','image/webp'],max:8*1024*1024},
    pdf:{ext:['pdf'],mime:['application/pdf'],max:50*1024*1024},
    word:{ext:['docx'],mime:['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'],max:50*1024*1024}
  };
  const BLOCKED=['exe','msi','bat','cmd','com','scr','ps1','js','mjs','html','htm','svg','php','jar','apk','sh','dll'];
  const safeName=v=>String(v||'file').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'file';
  const ext=n=>{const s=String(n||'').toLowerCase().split('.');return s.length>1?s.pop():''};
  function kindFor(input){
    const a=String(input.getAttribute('accept')||'').toLowerCase(),id=(input.id+' '+input.name+' '+input.className).toLowerCase();
    if(a.includes('pdf')||id.includes('pdf'))return 'pdf';
    if(a.includes('word')||a.includes('docx')||id.includes('word')||id.includes('source_file'))return 'word';
    if(a.includes('image')||id.includes('image')||id.includes('cover')||id.includes('logo')||id.includes('icon'))return 'image';
    return '';
  }
  function signatureOK(file,kind){
    return file.slice(0,8).arrayBuffer().then(b=>{
      const x=[...new Uint8Array(b)];
      if(kind==='pdf')return x[0]===0x25&&x[1]===0x50&&x[2]===0x44&&x[3]===0x46;
      if(kind==='word')return x[0]===0x50&&x[1]===0x4b&&x[2]===0x03&&x[3]===0x04;
      if(kind==='image')return (x[0]===0x89&&x[1]===0x50&&x[2]===0x4e&&x[3]===0x47)||(x[0]===0xff&&x[1]===0xd8&&x[2]===0xff)||(x[0]===0x52&&x[1]===0x49&&x[2]===0x46&&x[3]===0x46);
      return true;
    }).catch(()=>false);
  }
  async function validate(file,kind){
    const e=ext(file.name);
    if(BLOCKED.includes(e))return {ok:false,msg:'هذا النوع من الملفات محظور لأسباب أمنية.'};
    const rule=RULES[kind];
    if(!rule)return {ok:true,name:safeName(file.name)};
    if(!rule.ext.includes(e))return {ok:false,msg:'صيغة الملف غير مسموحة في هذا الحقل.'};
    if(file.size<=0||file.size>rule.max)return {ok:false,msg:`حجم الملف غير مسموح. الحد الأعلى ${Math.round(rule.max/1024/1024)} MB.`};
    if(file.type&&!rule.mime.includes(file.type))return {ok:false,msg:'نوع الملف لا يطابق الصيغة المطلوبة.'};
    if(!(await signatureOK(file,kind)))return {ok:false,msg:'محتوى الملف لا يطابق امتداده وقد يكون غير آمن.'};
    return {ok:true,name:safeName(file.name)};
  }
  function notify(msg){try{if(typeof window.toast==='function')return window.toast(msg)}catch(_){};alert(msg)}
  async function onFile(e){
    const input=e.target;if(!(input instanceof HTMLInputElement)||input.type!=='file'||!input.files?.length)return;
    const kind=kindFor(input),files=[...input.files];
    for(const file of files){const r=await validate(file,kind);if(!r.ok){input.value='';notify(r.msg);input.setCustomValidity(r.msg);return}}
    input.setCustomValidity('');input.dataset.alinValidated='true';
  }
  function safeURL(value){
    try{
      const u=new URL(value,location.href);
      if(!['https:','http:','blob:','data:'].includes(u.protocol))return false;
      if(u.protocol==='data:'&&!String(value).startsWith('data:image/'))return false;
      return true;
    }catch(_){return false}
  }
  function harden(root){
    (root||document).querySelectorAll('a[href]').forEach(a=>{if(!safeURL(a.href)){a.removeAttribute('href');a.setAttribute('aria-disabled','true')}});
    (root||document).querySelectorAll('iframe[src]').forEach(f=>{if(!safeURL(f.src)){f.removeAttribute('src')}f.setAttribute('referrerpolicy','no-referrer');if(!f.hasAttribute('sandbox'))f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals')});
  }
  function install(){
    document.addEventListener('change',onFile,true);harden(document);
    window.ALINFileSecurity=Object.freeze({version:'168.1',validate,safeName,safeURL,harden});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* ===== core/js/sensitive-operations-v169.js ===== */
(function(){
  'use strict';

  const state = {
    lastActionAt: new Map(),
    pending: new Set()
  };

  const now = () => Date.now();
  const safeText = value => String(value == null ? '' : value).replace(/[<>]/g, '');
  const getCurrentRole = () => {
    try {
      if (window.current && current.role) return String(current.role);
      if (window.currentUser && currentUser.role) return String(currentUser.role);
      const raw = sessionStorage.getItem('alin_current_user') || localStorage.getItem('alin_current_user');
      if (raw) return String(JSON.parse(raw)?.role || '');
    } catch (_) {}
    return '';
  };

  const toastMessage = message => {
    if (typeof window.toast === 'function') return window.toast(message);
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = safeText(message);
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2800);
  };

  function rateLimit(key, milliseconds){
    const last = state.lastActionAt.get(key) || 0;
    if (now() - last < milliseconds) return false;
    state.lastActionAt.set(key, now());
    return true;
  }

  function requireRole(allowed){
    const role = getCurrentRole();
    if (!allowed.includes(role)) {
      toastMessage('هذه العملية غير مسموحة لهذا الحساب.');
      return false;
    }
    return true;
  }

  function confirmSensitiveAction(options){
    const title = safeText(options?.title || 'تأكيد العملية');
    const message = safeText(options?.message || 'هل أنت متأكد من تنفيذ هذه العملية؟');
    const phrase = safeText(options?.phrase || 'تأكيد');
    const input = window.prompt(`${title}\n\n${message}\n\nاكتب كلمة: ${phrase}`);
    return input === phrase;
  }

  async function guardedOperation(options, operation){
    const key = safeText(options?.key || 'operation');
    const allowedRoles = Array.isArray(options?.roles) ? options.roles : ['admin'];
    const cooldown = Number(options?.cooldown || 1500);

    if (!requireRole(allowedRoles)) return { ok:false, reason:'role' };
    if (!rateLimit(key, cooldown)) {
      toastMessage('انتظر قليلاً قبل تكرار العملية.');
      return { ok:false, reason:'rate_limit' };
    }
    if (state.pending.has(key)) {
      toastMessage('العملية قيد التنفيذ حالياً.');
      return { ok:false, reason:'pending' };
    }
    if (options?.confirm && !confirmSensitiveAction(options.confirm)) {
      return { ok:false, reason:'cancelled' };
    }

    state.pending.add(key);
    try {
      const result = await operation();
      return { ok:true, result };
    } catch (error) {
      console.error('[V169 guarded operation]', error);
      toastMessage('تعذّر إكمال العملية بأمان.');
      return { ok:false, reason:'error', error };
    } finally {
      state.pending.delete(key);
    }
  }

  function hardenDangerousButtons(){
    document.addEventListener('click', function(event){
      const button = event.target.closest('button,[role="button"]');
      if (!button) return;
      const text = (button.textContent || '').trim();
      const dangerous = /حذف نهائي|تصفية الحساب|تثبيت التسوية|إلغاء الطلب|تغيير النسب|تحويل للمندوب|إيقاف الحساب/.test(text);
      if (!dangerous) return;
      button.setAttribute('data-sensitive-operation', 'true');
      button.setAttribute('autocomplete', 'off');
    }, true);
  }

  function protectForms(){
    document.addEventListener('submit', function(event){
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.submitting === '1') {
        event.preventDefault();
        return;
      }
      form.dataset.submitting = '1';
      setTimeout(() => { form.dataset.submitting = '0'; }, 1800);
    }, true);
  }

  window.AlinSecurityV169 = Object.freeze({
    guardedOperation,
    requireRole,
    rateLimit,
    confirmSensitiveAction,
    getCurrentRole
  });

  hardenDangerousButtons();
  protectForms();
})();


/* ===== core/js/legacy-auth-stabilizer-v173.js ===== */
(function(){
  "use strict";
  // V173: keep the proven username/password login until final Supabase migration.
  // This intentionally prevents experimental email-auth adapters from replacing legacy handlers.
  const legacyDoLogin = window.doLogin;
  const legacyLogout = window.logout;
  if (typeof legacyDoLogin === "function") window.doLogin = legacyDoLogin;
  if (typeof legacyLogout === "function") window.logout = legacyLogout;
  window.ALIN_AUTH_MODE = "legacy";
})();


/* ===== core/design/design-system.js ===== */
(function(){
  document.documentElement.classList.add('alin-design-v175');
  function ready(){document.body?.classList.add('alin-ui-ready')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;b.classList.add('alin-click');setTimeout(()=>b.classList.remove('alin-click'),180)});
})();
