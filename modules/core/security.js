// === core/security.js ===
/* ===== core/js/auth-security-v214.js ===== */
/* ALIN V214 — idle-session protection without replacing navigation or auth functions. */
(function(){
  'use strict';
  const SESSION='alin_secure_session_v214';
  const IDLE_BY_ROLE={admin:15,accountant:15,teacher:30,library:30,courier:30,student:60,store:60};
  const WARN_MS=2*60*1000;
  let idleTimer=null,warningTimer=null,lastActivity=Date.now(),warningBox=null;
  const currentNow=()=>{try{return window.current||null}catch(_){return null}};
  function setSession(user){
    if(!user?.role)return;
    const data={role:user.role,id:user.id||'',username:user.username||'',startedAt:Date.now(),lastActivity:Date.now()};
    try{sessionStorage.setItem(SESSION,JSON.stringify(data))}catch(_){}
    lastActivity=Date.now();scheduleIdle();
  }
  function clearTimers(){if(idleTimer)clearTimeout(idleTimer);if(warningTimer)clearTimeout(warningTimer);idleTimer=warningTimer=null}
  function hideWarning(){if(warningBox)warningBox.hidden=true}
  function clearSession(){try{sessionStorage.removeItem(SESSION)}catch(_){}clearTimers();hideWarning()}
  function idleLimit(){return (IDLE_BY_ROLE[String(currentNow()?.role||'')]||30)*60*1000}
  function touch(){
    if(!currentNow())return;
    lastActivity=Date.now();
    try{const data=JSON.parse(sessionStorage.getItem(SESSION)||'{}');data.lastActivity=lastActivity;sessionStorage.setItem(SESSION,JSON.stringify(data))}catch(_){}
    hideWarning();scheduleIdle();
  }
  function scheduleIdle(){
    clearTimers();if(!currentNow())return;
    const remain=Math.max(0,idleLimit()-(Date.now()-lastActivity));
    if(remain<=0)return expireSession();
    warningTimer=setTimeout(showWarning,Math.max(0,remain-WARN_MS));
    idleTimer=setTimeout(expireSession,remain);
  }
  function showWarning(){
    if(!currentNow())return;
    if(!warningBox){warningBox=document.createElement('div');warningBox.className='alin-session-warning';warningBox.innerHTML='<strong>ستنتهي الجلسة قريباً</strong><span>اضغط استمرار حتى تبقى داخل الحساب.</span><button type="button">استمرار</button>';warningBox.querySelector('button').addEventListener('click',touch);document.body.appendChild(warningBox)}
    warningBox.hidden=false;
  }
  function expireSession(){
    if(!currentNow())return;clearSession();
    try{window.toast?.('انتهت الجلسة لعدم النشاط')}catch(_){}
    Promise.resolve(window.logout?.()).catch(error=>console.error('[ALIN idle logout]',error));
  }
  function install(){
    window.addEventListener('alin:auth-login',event=>setSession(event.detail?.account||currentNow()));
    window.addEventListener('alin:auth-restored',event=>setSession(event.detail?.account||currentNow()));
    window.addEventListener('alin:page-open',()=>{if(currentNow())setSession(currentNow())});
    window.addEventListener('alin:logout',clearSession);
    ['click','keydown','touchstart','pointerdown'].forEach(ev=>document.addEventListener(ev,touch,{passive:true}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)touch()});
    if(currentNow())setSession(currentNow());
    window.ALINSecureSession=Object.freeze({version:'214.1',touch,expire:expireSession,clear:clearSession});
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

/* Legacy auth stabilizer removed: navigation and Supabase Auth now have single owners. */



;
