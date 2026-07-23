// === store/student-auth.js ===
/* ALIN v3.0.1 — secure optional student account backed by Supabase RPCs. */
(function(){
  'use strict';
  const SESSION_KEY='alin_student_secure_session_v3';
  const DEVICE_KEY='alin_device_id_v3';
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const moneyv=value=>typeof window.money==='function'?window.money(value):String(Number(value)||0);
  const client=()=>window.sb||window.AlinCloud?.client?.()||null;
  const cleanPhone=value=>String(value||'').trim().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9+]/g,'');
  function deviceId(){try{let v=localStorage.getItem(DEVICE_KEY);if(!v){v=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;localStorage.setItem(DEVICE_KEY,v)}return v}catch(_){return'browser-session'}}
  function readSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch(_){return null}}
  function writeSession(value){try{if(value)sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));else sessionStorage.removeItem(SESSION_KEY)}catch(_){}}
  function currentStudent(){return readSession()?.student||null}
  function token(){return readSession()?.token||''}
  function setCurrentStudent(student,sessionToken=token()){
    if(student&&sessionToken)writeSession({student,token:sessionToken});else writeSession(null);
    updateStudentAuthBar();window.dispatchEvent(new CustomEvent('alin:student-session',{detail:{student:student||null}}));
  }
  async function rpc(name,args){
    const c=client();if(!c?.rpc)throw new Error('خدمة حساب الطالب غير متاحة');
    const {data,error}=await c.rpc(name,args);if(error)throw error;return data;
  }
  function guardStudentAutofill(){const phone=document.getElementById('studentAuthPhone');if(phone&&cleanPhone(phone.value)!==phone.value)phone.value=cleanPhone(phone.value)}
  function scheduleStudentAutofillGuard(){[0,80,250,600].forEach(delay=>setTimeout(guardStudentAutofill,delay))}
  function updateStudentAuthBar(){
    const student=currentStudent(),button=document.getElementById('studentAuthBtn'),status=document.getElementById('studentAuthStatus');
    if(button){const small=button.querySelector('small');if(small)small.textContent=student?.name||'تسجيل الدخول';else button.textContent=student?'👤 حسابي':'👤 تسجيل دخول'}
    if(status)status.textContent=student?`مرحباً ${student.name}`:'التسجيل اختياري والطلب متاح للجميع';
  }
  function form(mode='login'){
    const create=mode==='create',edit=mode==='edit',student=currentStudent()||{};
    const submit=edit?'saveStudentEdit()':create?'studentCreate()':'studentLogin()';
    const html=`<h2>${edit?'تعديل حساب الطالب':create?'إنشاء حساب طالب':'تسجيل دخول الطالب'}</h2><p class="muted">الحساب اختياري. بيانات الدخول محفوظة في الخادم ولا تُخزن كلمة المرور داخل المتصفح.</p>${!edit?`<div class="auth-switch"><button type="button" class="${!create?'active':''}" onclick="showStudentAuthForm('login')">تسجيل دخول</button><button type="button" class="${create?'active':''}" onclick="showStudentAuthForm('create')">إنشاء حساب</button></div>`:''}<form class="form-grid" autocomplete="off" onsubmit="event.preventDefault();${submit}">${create||edit?`<input id="studentAuthName" autocomplete="name" placeholder="اسم الطالب" value="${escv(student.name||'')}">`:''}<input id="studentAuthPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="رقم الهاتف" value="${escv(cleanPhone(student.phone||''))}" oninput="this.value=this.value.replace(/[^0-9+]/g,'')"><input id="studentAuthPass" type="password" autocomplete="${create||edit?'new-password':'current-password'}" placeholder="الرمز السري — 6 أحرف أو أرقام على الأقل"><button type="submit">${edit?'حفظ التعديل':create?'إنشاء الحساب':'دخول'}</button></form><div id="studentAuthMsg"></div>`;
    scheduleStudentAutofillGuard();return html;
  }
  function message(text){const el=document.getElementById('studentAuthMsg');if(el)el.textContent=text}
  function openStudentAuth(mode='login'){
    const box=document.getElementById('studentAuthBox');if(!box)return;const student=currentStudent();
    box.innerHTML=student?`<h2>حساب الطالب</h2><div class="student-profile-box"><b>${escv(student.name)}</b><br><small>${escv(student.phone||'')}</small></div><div class="row-actions"><button onclick="showStudentOrders()">طلباتي</button><button class="secondary" onclick="showStudentAuthForm('edit')">تعديل البيانات</button><button class="danger" onclick="studentLogout()">تسجيل خروج</button></div><div id="studentOrdersBox"></div>`:form(mode);
    document.getElementById('studentAuthModal')?.classList.remove('hidden');
  }
  function closeStudentAuth(){document.getElementById('studentAuthModal')?.classList.add('hidden')}
  function showStudentAuthForm(mode){const box=document.getElementById('studentAuthBox');if(box)box.innerHTML=form(mode)}
  async function studentCreate(){try{
    const name=document.getElementById('studentAuthName')?.value.trim()||'',phone=cleanPhone(document.getElementById('studentAuthPhone')?.value),pin=document.getElementById('studentAuthPass')?.value||'';
    if(!name||!phone||!pin)throw new Error('أكمل الاسم ورقم الهاتف والرمز السري');if(pin.length<6)throw new Error('الرمز السري يجب أن يكون 6 أحرف أو أرقام على الأقل');
    const result=await rpc('alin_student_register',{p_name:name,p_phone:phone,p_pin:pin,p_device:deviceId()});
    setCurrentStudent(result?.student,result?.token);window.toast?.('تم إنشاء الحساب');openStudentAuth();
  }catch(error){message(error.message||'تعذر إنشاء الحساب')}}
  async function studentLogin(){try{
    const phone=cleanPhone(document.getElementById('studentAuthPhone')?.value),pin=document.getElementById('studentAuthPass')?.value||'';
    if(!phone||!pin)throw new Error('اكتب رقم الهاتف والرمز السري');
    const result=await rpc('alin_student_login',{p_phone:phone,p_pin:pin,p_device:deviceId()});
    setCurrentStudent(result?.student,result?.token);closeStudentAuth();window.toast?.('تم تسجيل الدخول');
  }catch(error){message(error.message||'تعذر تسجيل الدخول')}}
  async function saveStudentEdit(){try{
    if(!token())throw new Error('سجل دخول أولاً');const name=document.getElementById('studentAuthName')?.value.trim()||'',phone=cleanPhone(document.getElementById('studentAuthPhone')?.value),pin=document.getElementById('studentAuthPass')?.value||'';
    const student=await rpc('alin_student_update',{p_token:token(),p_device:deviceId(),p_name:name,p_phone:phone,p_pin:pin||null});
    setCurrentStudent(student,token());window.toast?.('تم حفظ التعديل');openStudentAuth();
  }catch(error){message(error.message||'تعذر حفظ التعديل')}}
  async function studentLogout(){
    const currentToken=token();writeSession(null);updateStudentAuthBar();closeStudentAuth();
    if(currentToken)rpc('alin_student_logout',{p_token:currentToken,p_device:deviceId()}).catch(()=>{});
    window.dispatchEvent(new CustomEvent('alin:student-session',{detail:{student:null}}));window.toast?.('تم تسجيل الخروج');
  }
  async function showStudentOrders(){
    const box=document.getElementById('studentOrdersBox');if(!box||!token())return;box.innerHTML='<p class="muted">جارٍ تحميل الطلبات...</p>';
    try{const orders=await rpc('alin_student_orders',{p_token:token(),p_device:deviceId()})||[];
      box.innerHTML='<h3>طلباتي</h3>'+(orders.length?orders.map(order=>`<div class="row"><div><b>${escv(order.order_number||order.id)}</b><small>${escv(order.item_name||'طلب')} — ${moneyv(order.total)} د.ع — ${escv(order.status||'')}</small></div><button onclick="closeStudentAuth();document.getElementById('trackOrderInput').value='${escv(order.order_number||order.id)}';trackOrder()">تتبع</button></div>`).join(''):window.emptyState?.('لا توجد طلبات بهذا الرقم')||'<div class="empty">لا توجد طلبات.</div>');
    }catch(error){box.innerHTML=`<div class="empty">${escv(error.message||'تعذر تحميل الطلبات')}</div>`}
  }
  async function restoreStudent(){
    const state=readSession();if(!state?.token)return updateStudentAuthBar();
    try{const student=await rpc('alin_student_profile',{p_token:state.token,p_device:deviceId()});if(student)setCurrentStudent(student,state.token);else setCurrentStudent(null,'')}catch(_){setCurrentStudent(null,'')}
  }
  Object.assign(window,{currentStudent,setCurrentStudent,updateStudentAuthBar,openStudentAuth,closeStudentAuth,showStudentAuthForm,studentCreate,studentLogin,saveStudentEdit,studentLogout,showStudentOrders});
  document.addEventListener('alin:cart-rendered',()=>{const student=currentStudent();if(!student)return;const name=document.getElementById('studentName'),phone=document.getElementById('studentPhone');if(name&&!name.value)name.value=student.name||'';if(phone&&!phone.value)phone.value=student.phone||''});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restoreStudent,{once:true});else restoreStudent();
  window.AlinStudentAuth=Object.freeze({current:currentStudent,set:setCurrentStudent,open:openStudentAuth,close:closeStudentAuth,restore:restoreStudent});
})();

;
