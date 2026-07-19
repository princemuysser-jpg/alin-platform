// Alin module: core/cloud-status-ui.js | v2.0.1
/* ===== core/js/cloud-status-ui-rc5-3.js ===== */
(function(){
  function mount(){
    if(document.getElementById('alinCloudRc53'))return;
    const el=document.createElement('div');el.id='alinCloudRc53';el.className='alin-cloud-rc53';el.dataset.status=navigator.onLine?'loading':'offline';el.textContent=navigator.onLine?'جاري ربط البيانات':'غير متصل';document.body.appendChild(el);
    const set=(s,t)=>{el.dataset.status=s;el.textContent=t};
    window.addEventListener('alin:cloud-status',e=>{const s=e.detail?.status||'loading';const map={online:'متصل ومزامن',realtime:'تحديث مباشر',loading:'جاري تحميل البيانات',syncing:'جاري المزامنة',offline:'غير متصل',error:'خطأ في الربط','offline-queued':'محفوظ للمزامنة'};set(s,map[s]||'حالة الاتصال: '+s)});
    window.addEventListener('alin:data-refreshed',e=>set(e.detail?.errors?.length?'error':'online',e.detail?.errors?.length?'اتصال جزئي':'متصل ومزامن'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


;

/* ALIN 2.0.1 - hardened Supabase Auth and admin account adapter. */
(function(){
  'use strict';
  const ATTEMPT_KEY='alin_auth_attempts_v139',MAX_ATTEMPTS=5,LOCK_MS=10*60*1000;
  const cfg=()=>window.ALIN_CONFIG||{};
  const enabled=()=>cfg().authEnabled===true;
  const client=()=>window.sb||(window.AlinCloud&&window.AlinCloud.client?.())||null;
  const emailFor=value=>{
    const raw=String(value||'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,'-');
    if(raw.includes('@'))return raw;
    const ascii=raw.replace(/[^a-z0-9._-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'user';
    let hash=2166136261;for(const byte of new TextEncoder().encode(raw))hash=Math.imul(hash^byte,16777619);
    const key=`${ascii.slice(0,38)}-${(hash>>>0).toString(36)}`;
    return `${key}@${cfg().authEmailDomain||'users.alin.local'}`;
  };
  const msg=text=>{const el=window.loginMsg||document.getElementById('loginMsg');if(el)el.textContent=text};
  const readAttempts=()=>{try{return JSON.parse(localStorage.getItem(ATTEMPT_KEY)||'{}')}catch(_){return{}}};
  const writeAttempts=x=>{try{localStorage.setItem(ATTEMPT_KEY,JSON.stringify(x))}catch(_){}};
  const attemptId=(role,user)=>`${String(role||'').toLowerCase()}:${String(user||'').trim().toLowerCase()}`;
  function lockRemaining(role,user){const all=readAttempts(),x=all[attemptId(role,user)];if(!x)return 0;if(x.lockedUntil<=Date.now()){delete all[attemptId(role,user)];writeAttempts(all);return 0}return x.lockedUntil-Date.now()}
  function failAttempt(role,user){const all=readAttempts(),k=attemptId(role,user),now=Date.now(),x=all[k]||{count:0,first:now,lockedUntil:0};if(now-x.first>LOCK_MS){x.count=0;x.first=now}x.count++;if(x.count>=MAX_ATTEMPTS)x.lockedUntil=now+LOCK_MS;all[k]=x;writeAttempts(all);return x}
  function clearAttempts(role,user){const all=readAttempts();delete all[attemptId(role,user)];writeAttempts(all)}
  const invokeError=async(error,fallback)=>{let message=error?.message||fallback;try{message=(await error?.context?.json())?.error||message}catch(_){}return new Error(message||fallback)};
  async function invokeAdmin(name,body){const c=client();if(!c?.functions)throw new Error('خدمة الإدارة الآمنة غير متاحة');const {data,error}=await c.functions.invoke(name,{body});if(error)throw await invokeError(error,'تعذر تنفيذ العملية');if(!data?.ok)throw new Error(data?.error||'تعذر تنفيذ العملية');return data}

  async function accountForUser(user){
    const c=client();if(!c||!user)return null;
    const {data,error}=await c.from('accounts').select('id,role,name,username,status,auth_user_id').eq('auth_user_id',user.id).maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function login(){
    const c=client();if(!c)throw new Error('خدمة تسجيل الدخول غير متاحة');
    const username=(window.loginU||document.getElementById('loginU'))?.value||'';
    const password=(window.loginPass||document.getElementById('loginPass'))?.value||'';
    const requested=String(window.pendingRole||'');
    if(!username.trim()||!password)throw new Error('اكتب اسم الدخول وكلمة المرور');
    const left=lockRemaining(requested,username);
    if(left>0)throw new Error(`تم إيقاف المحاولات مؤقتاً. حاول بعد ${Math.ceil(left/60000)} دقيقة`);
    const {data,error}=await c.auth.signInWithPassword({email:emailFor(username),password});
    if(error){const state=failAttempt(requested,username);const remain=Math.max(0,MAX_ATTEMPTS-state.count);throw new Error(state.lockedUntil>Date.now()?'تم إيقاف المحاولات لمدة 10 دقائق بسبب تكرار الخطأ':`بيانات الدخول غير صحيحة. المحاولات المتبقية: ${remain}`)}
    const account=await accountForUser(data.user);
    if(!account||account.status!=='active'){
      await c.auth.signOut();failAttempt(requested,username);throw new Error('الحساب غير مربوط أو غير فعال');
    }
    if(requested&&requested!=='store'&&account.role!==requested&&account.role!=='admin'){
      await c.auth.signOut();failAttempt(requested,username);throw new Error('نوع الحساب لا يطابق البوابة المختارة');
    }
    clearAttempts(requested,username);
    window.current={role:account.role,id:account.id,name:account.name,username:account.username,auth_user_id:data.user.id};
    if(typeof window.load==='function')await window.load();
    const targetPage=account.role==='accountant'?'admin':account.role;
    if(typeof window.openPage==='function')window.openPage(targetPage);
    if(account.role==='accountant')setTimeout(()=>{try{window.adminTab?.('finance');document.querySelectorAll('.admin-tabs button').forEach(b=>b.style.display=(b.textContent||'').includes('الأرباح')?'':'none')}catch(_){}},80);
    const passEl=window.loginPass||document.getElementById('loginPass');if(passEl)passEl.value='';
    return account;
  }

  let checkoutPending=false;
  async function secureCheckout(){
    if(checkoutPending)return;
    const button=document.querySelector('[onclick*="confirmCartCheckout"],#confirmCheckoutButton,[data-confirm-checkout]');
    try{
      checkoutPending=true;
      if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.dataset.originalText=button.textContent;button.textContent='جارٍ إرسال الطلب...'}
      const c=client();if(!c?.rpc)throw new Error('تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجدداً');
      if(typeof cart==='undefined'||!Array.isArray(cart)||!cart.length)throw new Error('السلة فارغة');
      const name=(document.getElementById('studentName')?.value||'').trim();
      const phone=(document.getElementById('studentPhone')?.value||'').trim().replace(/\s+/g,'');
      if(name.length<2)throw new Error('اكتب اسم الطالب بصورة صحيحة');
      if(!/^\+?[0-9٠-٩]{7,15}$/.test(phone))throw new Error('اكتب رقم هاتف صحيح');
      const fulfillment=typeof alinOrderExtra==='function'?alinOrderExtra():{};
      const coupon=(document.getElementById('couponInput')?.value||'').trim();
      const items=cart.map(x=>({kind:String(x.kind||''),id:String(x.id||''),qty:Math.max(1,Math.min(100,Number(x.qty)||1))}));
      const {data,error}=await c.rpc('alin_create_store_orders',{p_items:items,p_customer:{name,phone},p_fulfillment:fulfillment,p_coupon_code:coupon||null});
      if(error)throw error;
      const numbers=Array.isArray(data)?data.map(x=>String(x.order_number||'')).filter(Boolean):[];
      if(!numbers.length)throw new Error('لم يرجع الخادم رقم تتبع للطلب');
      cart=[];if(typeof cartSave==='function')cartSave();
      if(typeof load==='function')await load();
      const box=window.checkoutBox||document.getElementById('checkoutBox');
      if(box){box.replaceChildren();const h=document.createElement('h2');h.textContent='تم استلام طلبك';const p=document.createElement('p');p.textContent='أرقام التتبع: '+numbers.join(' — ');const close=document.createElement('button');close.type='button';close.textContent='إغلاق';close.addEventListener('click',()=>window.closeCheckout?.());box.append(h,p,close)}
    }catch(e){alert(e?.message||'تعذر إنشاء الطلب')}
    finally{checkoutPending=false;if(button){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=button.dataset.originalText||'تأكيد الطلب'}}
  }

  async function createAccount(payload){
    if(!payload?.name||!payload?.username||!payload?.password)throw new Error('أكمل الاسم واسم الدخول وكلمة المرور');
    if(String(payload.password).length<8)throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');
    const data=await invokeAdmin('admin-create-account',payload);
    if(typeof load==='function')await load();
    return data.account;
  }

  async function createAccountFromAdmin(){
    try{
      const role=document.getElementById('aRole')?.value||'';
      const payload={
        role,
        name:document.getElementById('aName')?.value?.trim()||'',
        username:document.getElementById('aUser')?.value?.trim()||'',
        password:document.getElementById('aPass')?.value||'',
        area:document.getElementById('aArea')?.value?.trim()||'',
        landmark:document.getElementById('aLandmark')?.value?.trim()||'',
        phone:document.getElementById('v163CourierPhone')?.value?.trim()||'',
        availability:document.getElementById('v163CourierAvailability')?.value||'available',
        areas:[...document.querySelectorAll('#v163CourierAreaPicker input:checked')].map(x=>x.value),
        status:'active'
      };
      if(role==='courier'&&!payload.areas.length)throw new Error('اختر منطقة عمل واحدة على الأقل');
      if(role==='courier'&&!payload.phone)throw new Error('أدخل رقم هاتف المندوب');
      const account=await createAccount(payload);
      const pass=document.getElementById('aPass');if(pass)pass.value='';
      if(typeof renderAccountsAdmin==='function')renderAccountsAdmin();
      if(typeof toast==='function')toast(`تم إنشاء الحساب: ${account.username}`);else alert(`تم إنشاء الحساب بنجاح: ${account.username}`);
      return account;
    }catch(e){alert(e.message||'تعذر إنشاء الحساب');throw e}
  }

  async function updateAccountFromAdmin(payload){
    const data=await invokeAdmin('admin-update-account',payload);
    if(typeof load==='function')await load();
    return data.account;
  }
  async function resetPasswordFromAdmin(accountId,password){
    if(String(password||'').length<8)throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');
    return invokeAdmin('admin-reset-password',{account_id:accountId,password});
  }
  async function deleteAccountFromAdmin(accountId){return invokeAdmin('admin-delete-account',{account_id:accountId})}

  function install(){
    if(!enabled()){window.ALIN_AUTH_MODE='disabled';return}
    window.ALIN_AUTH_MODE='supabase';
    window.doLogin=async function(){try{msg('جارٍ التحقق...');await login();msg('')}catch(e){msg(e.message||'تعذر تسجيل الدخول')}};
    window.confirmCartCheckout=secureCheckout;
    window.addAccount=createAccountFromAdmin;
    const oldLogout=window.logout;
    window.logout=async function(){try{await client()?.auth?.signOut()}catch(_){};window.current=null;return typeof oldLogout==='function'?oldLogout.apply(this,arguments):location.reload()};
    client()?.auth?.onAuthStateChange?.((event)=>{if(event==='SIGNED_OUT')window.current=null});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ALINAuth=Object.freeze({enabled,emailFor,login,accountForUser,secureCheckout,createAccount,createAccountFromAdmin,updateAccountFromAdmin,resetPasswordFromAdmin,deleteAccountFromAdmin});
})();


/* ALIN 2.0.1 — backend readiness diagnostics */
(function(){
  'use strict';
  async function checkBackendReadiness(){
    const result={ok:true,auth:false,accounts:false,orderRpc:false,issues:[]};
    try{
      const c=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());
      if(!c){result.ok=false;result.issues.push('Supabase client unavailable');return result}
      result.auth=!!c.auth;
      const probe=await c.from('accounts').select('id',{head:true,count:'exact'}).limit(1);
      if(probe.error){result.ok=false;result.issues.push('accounts: '+probe.error.message)}else result.accounts=true;
      const rpc=await c.rpc('alin_create_store_orders',{p_items:[],p_customer:{name:'',phone:''},p_fulfillment:{},p_coupon_code:null});
      if(!rpc.error){result.orderRpc=true}
      else{
        const text=String(rpc.error.message||'')+' '+String(rpc.error.code||'');
        if(/PGRST202|Could not find the function|schema cache/i.test(text)){
          result.ok=false;result.issues.push('alin_create_store_orders RPC missing');
        }else result.orderRpc=true;
      }
    }catch(error){result.ok=false;result.issues.push(error?.message||String(error))}
    window.__ALIN_BACKEND_STATUS__=result;
    return result;
  }
  window.AlinBackendCheck=checkBackendReadiness;
})();
