/* ALIN v2.3.9 — Supabase authentication, session restore and login attempt protection. */
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
    const {data,error}=await c.from('accounts').select('id,role,name,username,status,auth_user_id,area,phone,landmark').eq('auth_user_id',user.id).maybeSingle();
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
    window.current={role:account.role,id:account.id,name:account.name,username:account.username,auth_user_id:data.user.id,area:account.area||'',phone:account.phone||'',landmark:account.landmark||''};
    if(typeof window.load==='function')await window.load();
    const targetPage=account.role==='accountant'?'admin':account.role;
    if(typeof window.openPage==='function')window.openPage(targetPage,{render:false});
    const passEl=window.loginPass||document.getElementById('loginPass');if(passEl)passEl.value='';
    window.dispatchEvent(new CustomEvent('alin:auth-login',{detail:{account}}));
    return account;
  }


  let restorePromise=null,logoutPromise=null,explicitSignOut=false;
  function finishAuthBoot(){
    try{document.documentElement?.removeAttribute?.('data-alin-auth-boot')}catch(_){}
  }
  function showSignedOut(){
    if(window.current)return;
    if(window.ALINNavigation?.showSignedOut)return window.ALINNavigation.showSignedOut();
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('login')?.classList.remove('hidden');
  }
  function accountState(account,user){
    return {role:account.role,id:account.id,name:account.name,username:account.username,auth_user_id:user.id,area:account.area||'',phone:account.phone||'',landmark:account.landmark||''};
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
      finishAuthBoot();
      window.dispatchEvent(new CustomEvent('alin:auth-restored',{detail:{account}}));
      return true;
    })().catch(error=>{
      console.error('[ALIN auth restore]',error);
      window.current=null;showSignedOut();finishAuthBoot();return false;
    }).finally(()=>{restorePromise=null});
    return restorePromise;
  }

  async function loginFromUI(){
    try{msg('جارٍ التحقق...');const account=await login();msg('');return account}
    catch(error){msg(error?.message||'تعذر تسجيل الدخول');throw error}
    finally{finishAuthBoot()}
  }
  async function signOut(){
    if(logoutPromise)return logoutPromise;
    logoutPromise=(async()=>{
      explicitSignOut=true;
      try{await client()?.auth?.signOut()}finally{explicitSignOut=false}
      finishAuthBoot();
      return true;
    })().finally(()=>{logoutPromise=null});
    return logoutPromise;
  }
  function install(){
    if(!enabled()){window.ALIN_AUTH_MODE='disabled';finishAuthBoot();return}
    window.ALIN_AUTH_MODE='supabase';
    if(typeof window.ALINAuth?.createAccountFromAdmin==='function')window.addAccount=window.ALINAuth.createAccountFromAdmin;
    client()?.auth?.onAuthStateChange?.((event)=>{
      if(event==='SIGNED_OUT'&&!explicitSignOut){window.current=null;showSignedOut();finishAuthBoot();window.dispatchEvent(new CustomEvent('alin:logout',{detail:{source:'external'}}))}
    });
    restoreSession();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  window.ALINAuthRuntime=Object.freeze({client,invokeAdmin,adminSession,finishAuthBoot,showSignedOut});
  window.ALINAuth=Object.assign(window.ALINAuth||{},{
    enabled,emailFor,login,loginFromUI,signOut,restoreSession,accountForUser,
    ensureAdminSession:()=>adminSession(false)
  });
})();
