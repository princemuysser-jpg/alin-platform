// === store/student-auth.js ===
/* ALIN v2.3.9 — student phone login without email autofill. */
(function(){
  'use strict';
  const ACCOUNTS_KEY='ALIN_STUDENT_ACCOUNTS_V2';
  const SESSION_KEY='ALIN_STUDENT_SESSION_V2';
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const moneyv=value=>typeof window.money==='function'?window.money(value):String(Number(value)||0);
  const rows=()=>{try{return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||'[]')}catch(_){return[]}};
  const saveRows=value=>localStorage.setItem(ACCOUNTS_KEY,JSON.stringify((value||[]).map(({password,...row})=>row)));
  const cleanPhone=value=>{const raw=String(value||'').trim();if(!raw||raw.includes('@')||/[A-Za-z]/.test(raw))return '';return raw.replace(/[^0-9+]/g,'')};
  function guardStudentAutofill(){
    const phone=document.getElementById('studentAuthPhone');
    if(phone&&cleanPhone(phone.value)!==phone.value)phone.value=cleanPhone(phone.value);
  }
  function scheduleStudentAutofillGuard(){[0,80,250,600].forEach(delay=>setTimeout(guardStudentAutofill,delay))}
  function currentStudent(){try{const row=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(row&&row.phone&&!cleanPhone(row.phone)){row.phone='';localStorage.setItem(SESSION_KEY,JSON.stringify(row))}return row}catch(_){return null}}
  function setCurrentStudent(student){if(student)localStorage.setItem(SESSION_KEY,JSON.stringify(student));else localStorage.removeItem(SESSION_KEY);updateStudentAuthBar();window.dispatchEvent(new CustomEvent('alin:student-session',{detail:{student:student||null}}))}
  function updateStudentAuthBar(){
    const student=currentStudent(),button=document.getElementById('studentAuthBtn'),status=document.getElementById('studentAuthStatus');
    if(button){const small=button.querySelector('small');if(small)small.textContent=student?.name||'تسجيل الدخول';else button.textContent=student?'👤 حسابي':'👤 تسجيل دخول'}
    if(status)status.textContent=student?`مرحباً ${student.name}`:'التسجيل اختياري والطلب متاح للجميع';
  }
  async function passwordHash(value){const bytes=new TextEncoder().encode(String(value||'')),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  function form(mode='login'){
    const create=mode==='create',edit=mode==='edit',student=currentStudent()||{};
    const safePhone=cleanPhone(student.phone||'');
    const submit=edit?'saveStudentEdit()':create?'studentCreate()':'studentLogin()';
    const passwordAutocomplete=create?'new-password':edit?'new-password':'current-password';
    const html=`<h2>${edit?'تعديل حساب الطالب':create?'إنشاء حساب طالب':'تسجيل دخول الطالب'}</h2><p class="muted">الحساب اختياري ويعتمد رقم الهاتف فقط، ويمكن إتمام الطلب بدون تسجيل.</p>${!edit?`<div class="auth-switch"><button type="button" class="${!create?'active':''}" onclick="showStudentAuthForm('login')">تسجيل دخول</button><button type="button" class="${create?'active':''}" onclick="showStudentAuthForm('create')">إنشاء حساب</button></div>`:''}<form class="form-grid" autocomplete="off" onsubmit="event.preventDefault();${submit}">${create||edit?`<input id="studentAuthName" name="alin_student_name" autocomplete="name" placeholder="اسم الطالب" value="${escv(student.name||'')}">`:''}<input id="studentAuthPhone" name="alin_student_phone" type="tel" inputmode="numeric" autocomplete="tel" data-lpignore="true" data-1p-ignore="true" placeholder="رقم الهاتف" value="${escv(safePhone)}" oninput="this.value=this.value.replace(/[^0-9+]/g,'')"><input id="studentAuthPass" name="alin_student_pin" type="password" inputmode="numeric" autocomplete="${passwordAutocomplete}" data-lpignore="true" data-1p-ignore="true" placeholder="الرمز السري"><button type="submit">${edit?'حفظ التعديل':create?'إنشاء الحساب':'دخول'}</button></form><div id="studentAuthMsg"></div>`;
    scheduleStudentAutofillGuard();
    return html;
  }
  function message(text){const element=document.getElementById('studentAuthMsg');if(element)element.textContent=text}
  function openStudentAuth(mode='login'){
    const box=document.getElementById('studentAuthBox');if(!box)return;
    const student=currentStudent();
    box.innerHTML=student?`<h2>حساب الطالب</h2><div class="student-profile-box"><b>${escv(student.name)}</b><br><small>${escv(student.phone||'')}</small></div><div class="row-actions"><button onclick="showStudentOrders()">طلباتي</button><button class="secondary" onclick="showStudentAuthForm('edit')">تعديل البيانات</button><button class="danger" onclick="studentLogout()">تسجيل خروج</button></div><div id="studentOrdersBox"></div>`:form(mode);
    document.getElementById('studentAuthModal')?.classList.remove('hidden');
  }
  function closeStudentAuth(){document.getElementById('studentAuthModal')?.classList.add('hidden')}
  function showStudentAuthForm(mode){const box=document.getElementById('studentAuthBox');if(box)box.innerHTML=form(mode)}
  async function studentCreate(){try{
    const name=document.getElementById('studentAuthName')?.value.trim()||'',phone=cleanPhone(document.getElementById('studentAuthPhone')?.value),password=document.getElementById('studentAuthPass')?.value.trim()||'';
    if(!name||!phone||!password)throw new Error('أكمل الاسم ورقم الهاتف والرمز السري');if(password.length<4)throw new Error('الرمز السري قصير');
    const list=rows();if(list.some(item=>item.phone===phone))throw new Error('هذا الرقم مسجل مسبقاً');
    const account={id:typeof window.uid==='function'?window.uid('S'):`S${Date.now()}`,name,phone,password_hash:await passwordHash(password),created_at:new Date().toISOString()};list.push(account);saveRows(list);setCurrentStudent({id:account.id,name,phone});window.toast?.('تم إنشاء الحساب');openStudentAuth();
  }catch(error){message(error.message)}}
  async function studentLogin(){try{
    const phone=cleanPhone(document.getElementById('studentAuthPhone')?.value),password=document.getElementById('studentAuthPass')?.value.trim()||'';
    const list=rows(),hash=await passwordHash(password);let account=list.find(item=>item.phone===phone&&item.password_hash===hash);if(!account){const legacy=list.find(item=>item.phone===phone&&item.password===password);if(legacy){legacy.password_hash=hash;delete legacy.password;saveRows(list);account=legacy}}if(!account)throw new Error('رقم الهاتف أو الرمز غير صحيح');setCurrentStudent({id:account.id,name:account.name,phone:account.phone});closeStudentAuth();window.toast?.('تم تسجيل الدخول');
  }catch(error){message(error.message)}}
  async function saveStudentEdit(){try{
    const student=currentStudent();if(!student)throw new Error('سجل دخول أولاً');const list=rows(),index=list.findIndex(item=>item.id===student.id);if(index<0)throw new Error('الحساب غير موجود');
    const name=document.getElementById('studentAuthName')?.value.trim()||'',phone=cleanPhone(document.getElementById('studentAuthPhone')?.value),password=document.getElementById('studentAuthPass')?.value.trim()||'';
    if(!name||!phone)throw new Error('أكمل الاسم ورقم الهاتف');if(list.some((item,i)=>i!==index&&item.phone===phone))throw new Error('هذا الرقم مستخدم بحساب آخر');
    list[index]={...list[index],name,phone};if(password)list[index].password_hash=await passwordHash(password);delete list[index].password;saveRows(list);setCurrentStudent({id:student.id,name,phone});window.toast?.('تم حفظ التعديل');openStudentAuth();
  }catch(error){message(error.message)}}
  function studentLogout(){setCurrentStudent(null);closeStudentAuth();window.toast?.('تم تسجيل الخروج')}
  function showStudentOrders(){
    const student=currentStudent(),box=document.getElementById('studentOrdersBox');if(!student||!box)return;
    const orders=(window.db?.orders||[]).filter(order=>String(order.student_phone||'')===String(student.phone)).slice(0,20);
    box.innerHTML='<h3>طلباتي</h3>'+(orders.length?orders.map(order=>`<div class="row"><div><b>${escv(order.order_number||order.tracking_code||order.id)}</b><small>${escv(order.title||'')} — ${moneyv(order.total)} د.ع — ${escv(order.status||'')}</small></div><button onclick="closeStudentAuth();document.getElementById('trackOrderInput').value='${escv(order.order_number||order.tracking_code||order.id)}';trackOrder()">تتبع</button></div>`).join(''):window.emptyState?.('لا توجد طلبات بهذا الرقم')||'<div class="empty">لا توجد طلبات.</div>');
  }

  Object.assign(window,{currentStudent,setCurrentStudent,updateStudentAuthBar,openStudentAuth,closeStudentAuth,showStudentAuthForm,studentCreate,studentLogin,saveStudentEdit,studentLogout,showStudentOrders});
  document.addEventListener('alin:cart-rendered',()=>{const student=currentStudent();if(!student)return;const name=document.getElementById('studentName'),phone=document.getElementById('studentPhone');if(name&&!name.value)name.value=student.name||'';if(phone&&!phone.value)phone.value=student.phone||''});
  document.addEventListener('alin:order-created',()=>{const student=currentStudent();if(student&&typeof window.audit==='function')Promise.resolve(window.audit('student_order',`طلب من حساب طالب ${student.phone}`)).catch(()=>{})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',updateStudentAuthBar,{once:true});else updateStudentAuthBar();
  window.AlinStudentAuth=Object.freeze({current:currentStudent,set:setCurrentStudent,open:openStudentAuth,close:closeStudentAuth});
})();

;
