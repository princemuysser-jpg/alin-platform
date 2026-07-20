// === core/cloud-status-ui.js ===
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

/* ALIN 2.0.12 - hardened Supabase Auth and admin account adapter. */
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
  const friendlyAdminMessage=value=>{const text=String(value||'');if(/already (?:been )?registered|already exists|email.*registered/i.test(text))return 'الحساب موجود مسبقاً وسيتم ربطه بدلاً من إنشائه من جديد';if(/duplicate key.*username|اسم الدخول مستخدم/i.test(text))return 'اسم الدخول مستخدم مسبقاً';return text};
  const invalidSessionMessage=value=>/جلسة الدخول غير صالحة|انتهت جلسة|invalid(?:\s+)?jwt|jwt(?:\s+)?expired|session|user from sub claim/i.test(String(value||''));
  async function adminSession(forceRefresh=false){
    const c=client();if(!c?.auth)throw new Error('خدمة تسجيل الدخول غير متاحة');
    let response=forceRefresh?await c.auth.refreshSession():await c.auth.getSession();
    let session=response?.data?.session||null;
    if(!session&&!forceRefresh){response=await c.auth.refreshSession();session=response?.data?.session||null}
    if(!session?.access_token)throw new Error('انتهت جلسة المدير. سجل الخروج ثم ادخل مرة ثانية');
    const check=await c.auth.getUser(session.access_token);
    if(check?.error||!check?.data?.user){
      if(!forceRefresh)return adminSession(true);
      throw new Error('انتهت جلسة المدير. سجل الخروج ثم ادخل مرة ثانية');
    }
    return session;
  }
  async function invokeAdmin(name,body){
    const c=client();if(!c?.functions)throw new Error('خدمة الإدارة الآمنة غير متاحة');
    let lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      const session=await adminSession(attempt===1);
      const {data,error}=await c.functions.invoke(name,{body,headers:{Authorization:`Bearer ${session.access_token}`}});
      if(error){lastError=await invokeError(error,'تعذر تنفيذ العملية');lastError=new Error(friendlyAdminMessage(lastError.message));if(attempt===0&&invalidSessionMessage(lastError.message))continue;throw lastError}
      if(!data?.ok){lastError=new Error(friendlyAdminMessage(data?.error||'تعذر تنفيذ العملية'));if(attempt===0&&invalidSessionMessage(lastError.message))continue;throw lastError}
      return data;
    }
    throw lastError||new Error('تعذر تنفيذ العملية');
  }

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
    if(typeof window.openPage==='function')window.openPage(targetPage,{render:false});
    if(account.role==='accountant')setTimeout(()=>{try{window.adminTab?.('finance');document.querySelectorAll('.admin-tabs button').forEach(b=>b.style.display=(b.textContent||'').includes('الأرباح')?'':'none')}catch(_){}},80);
    const passEl=window.loginPass||document.getElementById('loginPass');if(passEl)passEl.value='';
    return account;
  }


  let restorePromise=null,logoutPromise=null,explicitSignOut=false;
  function finishAuthBoot(){
    try{document.documentElement?.removeAttribute?.('data-alin-auth-boot')}catch(_){}
  }
  function showSignedOut(){
    if(window.current)return;
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('login')?.classList.remove('hidden');
  }
  function accountState(account,user){
    return {role:account.role,id:account.id,name:account.name,username:account.username,auth_user_id:user.id};
  }
  async function openPublicStore(){
    try{window.AlinCloud?.loadCachedSnapshot?.()}catch(_){}
    try{if(typeof window.load==='function')await window.load()}catch(error){console.warn('[ALIN public data refresh]',error)}
    if(typeof window.openPage==='function')window.openPage('store',{render:false});
    finishAuthBoot();
    return false;
  }
  async function restoreSession(){
    if(!enabled()){if(typeof window.openPage==='function')window.openPage('store');finishAuthBoot();return false}
    if(restorePromise)return restorePromise;
    restorePromise=(async()=>{
      const c=client();
      if(!c?.auth)return openPublicStore();
      const response=await c.auth.getSession();
      const session=response?.data?.session||null;
      if(response?.error||!session?.user)return openPublicStore();
      const account=await accountForUser(session.user);
      if(!account||account.status!=='active'){
        explicitSignOut=true;
        try{await c.auth.signOut()}catch(_){}
        explicitSignOut=false;
        window.current=null;showSignedOut();finishAuthBoot();return false;
      }
      window.current=accountState(account,session.user);
      try{window.AlinCloud?.loadCachedSnapshot?.()}catch(_){}
      try{if(typeof window.load==='function')await window.load()}catch(error){console.warn('[ALIN session data refresh]',error)}
      const target=account.role==='accountant'?'admin':account.role;
      if(typeof window.openPage==='function')window.openPage(target,{render:false});
      if(account.role==='library')window.AlinLibraryModules?.showLibraryPage?.();
      if(account.role==='accountant')setTimeout(()=>{try{window.adminTab?.('finance')}catch(_){}},50);
      finishAuthBoot();
      window.dispatchEvent(new CustomEvent('alin:auth-restored',{detail:{account}}));
      return true;
    })().catch(error=>{
      console.error('[ALIN auth restore]',error);
      window.current=null;showSignedOut();finishAuthBoot();return false;
    }).finally(()=>{restorePromise=null});
    return restorePromise;
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
      if(box){
        const copyTrackingCode=async(code,button)=>{
          let copied=false;
          try{
            if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(code);copied=true}
          }catch(_){}
          if(!copied){
            const field=document.createElement('textarea');
            field.value=code;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
            document.body.appendChild(field);field.select();
            try{copied=document.execCommand('copy')}catch(_){}
            field.remove();
          }
          if(!copied){window.prompt('انسخ رقم التتبع',code);return}
          const label=button.querySelector('span');
          button.classList.add('is-copied');
          if(label)label.textContent='تم النسخ';
          if(typeof window.toast==='function')window.toast('تم نسخ رقم التتبع');
          setTimeout(()=>{button.classList.remove('is-copied');if(label)label.textContent='نسخ'},1800);
        };
        box.replaceChildren();
        const success=document.createElement('section');success.className='alin-order-success';
        const icon=document.createElement('div');icon.className='alin-order-success__icon';icon.setAttribute('aria-hidden','true');icon.textContent='✓';
        const h=document.createElement('h2');h.textContent='تم استلام طلبك';
        const note=document.createElement('p');note.textContent='احتفظ برقم التتبع لمتابعة حالة طلبك.';
        const codes=document.createElement('div');codes.className='alin-order-success__codes';
        numbers.forEach(number=>{
          const row=document.createElement('div');row.className='alin-tracking-code';
          const code=document.createElement('b');code.dir='ltr';code.textContent=number;code.title='رقم التتبع';
          const copy=document.createElement('button');copy.type='button';copy.className='alin-copy-tracking';copy.setAttribute('aria-label',`نسخ رقم التتبع ${number}`);copy.title='نسخ رقم التتبع';
          copy.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg><span>نسخ</span>';
          copy.addEventListener('click',()=>copyTrackingCode(number,copy));
          code.addEventListener('click',()=>copyTrackingCode(number,copy));code.tabIndex=0;code.setAttribute('role','button');code.setAttribute('aria-label',`نسخ رقم التتبع ${number}`);
          code.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();copyTrackingCode(number,copy)}});
          row.append(code,copy);codes.append(row);
        });
        const close=document.createElement('button');close.type='button';close.className='alin-order-success__close';close.textContent='إغلاق';close.addEventListener('click',()=>window.closeCheckout?.());
        success.append(icon,h,note,codes,close);box.append(success);
      }
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

  async function repairAuthLink(accountId){
    const c=client();if(!c?.rpc||!accountId)return 0;
    const {data,error}=await c.rpc('alin_repair_auth_links',{p_account_id:String(accountId)});
    if(error){
      const text=String(error.message||'');
      if(/PGRST202|Could not find the function|schema cache/i.test(text))throw new Error('تحديث ربط الحسابات غير منفذ. شغّل ملف RUN_ON_SUPABASE_v2_0_12_COMPLETE.sql مرة واحدة');
      throw error;
    }
    return Number(data||0);
  }
  async function updateAccountFromAdmin(payload){
    if(payload?.password&&payload?.account_id)await repairAuthLink(payload.account_id);
    const data=await invokeAdmin('admin-update-account',payload);
    if(typeof load==='function')await load();
    return data.account;
  }
  async function resetPasswordFromAdmin(accountId,password){
    if(String(password||'').length<8)throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');
    await repairAuthLink(accountId);
    return invokeAdmin('admin-reset-password',{account_id:accountId,password});
  }
  async function deleteAccountFromAdmin(accountId){return invokeAdmin('admin-delete-account',{account_id:accountId})}

  function install(){
    if(!enabled()){window.ALIN_AUTH_MODE='disabled';finishAuthBoot();return}
    window.ALIN_AUTH_MODE='supabase';
    window.doLogin=async function(){try{msg('جارٍ التحقق...');await login();msg('')}catch(e){msg(e.message||'تعذر تسجيل الدخول')}finally{finishAuthBoot()}};
    window.confirmCartCheckout=secureCheckout;
    window.addAccount=createAccountFromAdmin;
    const oldLogout=window.logout;
    window.logout=function(){
      if(logoutPromise)return logoutPromise;
      const args=arguments,ctx=this;
      logoutPromise=(async()=>{
        explicitSignOut=true;
        try{await client()?.auth?.signOut()}catch(_){}
        window.current=null;
        const result=typeof oldLogout==='function'?oldLogout.apply(ctx,args):showSignedOut();
        finishAuthBoot();
        return result;
      })().finally(()=>{explicitSignOut=false;logoutPromise=null});
      return logoutPromise;
    };
    client()?.auth?.onAuthStateChange?.((event)=>{if(event==='SIGNED_OUT'&&!explicitSignOut){window.current=null;showSignedOut();finishAuthBoot()}});
    restoreSession();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ALINAuth=Object.freeze({enabled,emailFor,login,restoreSession,accountForUser,secureCheckout,createAccount,createAccountFromAdmin,updateAccountFromAdmin,resetPasswordFromAdmin,repairAuthLink,deleteAccountFromAdmin,ensureAdminSession:()=>adminSession(false)});
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


/* ALIN v2.0.6 — secure public order tracking through RPC. */
(function(){
  'use strict';
  const labels={pending:'تم استلام الطلب',new:'تم استلام الطلب',payment_pending:'بانتظار التأكيد',processing:'قيد التجهيز',ready:'جاهز بالمكتبة',out_delivery:'خرج للتوصيل',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي'};
  const steps=['pending','processing','ready','out_delivery','completed'];
  const clean=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.trackOrder=async function(){
    const input=document.getElementById('trackOrderInput');
    const box=document.getElementById('trackOrderResult');
    if(!box)return;
    const code=String(input?.value||'').trim();
    box.className='track-result show';
    if(code.length<6){box.textContent='اكتب رقم الطلب الكامل أولاً';return}
    box.textContent='جارٍ التحقق من حالة الطلب...';
    try{
      const c=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());
      if(!c?.rpc)throw new Error('خدمة التتبع غير متاحة');
      const {data,error}=await c.rpc('alin_track_order',{p_order_number:code});
      if(error)throw error;
      if(!data?.found){box.textContent='لم يتم العثور على الطلب. تأكد من رقم التتبع.';return}
      const status=String(data.status||'new');
      const normalized=status==='delivered'?'completed':status;
      const reached=steps.indexOf(normalized);
      box.innerHTML=`<b>${clean(data.order_number)} — ${clean(data.title||'طلب منصة آلين')}</b>${data.ready_eta?`<br><small>الجاهزية المتوقعة: ${clean(data.ready_eta)}</small>`:''}<div class="timeline v31">${steps.map((step,index)=>`<span class="${index<=Math.max(0,reached)?'done':''}">${labels[step]}</span>`).join('')}</div>`;
    }catch(error){
      console.error('[ALIN tracking]',error);
      box.textContent='تعذر التحقق الآن. أعد المحاولة بعد قليل.';
    }
  };
})();
