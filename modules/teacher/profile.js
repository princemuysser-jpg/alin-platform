// Alin module: teacher/profile.js | v2.0.1
/* ===== teacher/js/teacher-profile-v156.js ===== */
(function(){
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const cur=()=>typeof current!=='undefined'?current:(window.current||{});
  const database=()=>typeof db!=='undefined'?db:(window.db||{});
  const teacher=()=>{
    const c=cur(),d=database();
    return (d.accounts?.teachers||[]).find(x=>String(x.id)===String(c.id))||c||{};
  };
  const avatarUrl=t=>{const p=t.avatar_path||t.avatar||t.photo||'';if(!p)return'';try{return typeof mediaUrl==='function'?mediaUrl(p):p}catch(_){return p}};
  function stats(){
    const c=cur(),d=database(),books=(d.booklets||[]).filter(x=>String(x.teacher_id)===String(c.id));
    const ids=new Set(books.map(x=>String(x.id))),orders=(d.orders||[]).filter(x=>x.kind==='booklet'&&ids.has(String(x.item_id)));
    return {books:books.length,orders:orders.length,sales:orders.reduce((a,x)=>a+(+x.qty||0),0)};
  }
  function render(){
    const host=document.getElementById('teacherContent');if(!host)return;
    const t=teacher(),s=stats(),avatar=avatarUrl(t),initial=(t.name||'م').trim().charAt(0)||'م';
    host.innerHTML=`<section class="teacher-v156-profile"><header class="teacher-v156-hero"><div class="teacher-v156-hero-info"><div class="teacher-v156-avatar">${avatar?`<img src="${escx(avatar)}" alt="صورة المدرس">`:escx(initial)}</div><div><h2>${escx(t.name||'ملف المدرس')}</h2><p>${escx(t.specialty||'مدرس في منصة آلين')}</p></div></div><span class="teacher-v156-status">الحساب فعال</span></header><div class="teacher-v156-grid"><article class="teacher-v156-card"><h3>البيانات الشخصية</h3><div class="teacher-v156-form"><div class="teacher-v156-field"><label>الاسم</label><input value="${escx(t.name||'')}" disabled></div><div class="teacher-v156-field"><label>اسم الدخول</label><input id="v156Username" value="${escx(t.username||'')}" disabled title="يُغيّر اسم الدخول من الإدارة الآمنة"></div><div class="teacher-v156-field"><label>رقم الهاتف</label><input id="v156Phone" value="${escx(t.phone||t.mobile||'')}" placeholder="07xxxxxxxxx"></div><div class="teacher-v156-field"><label>المنطقة</label><input id="v156Area" value="${escx(t.area||'')}" placeholder="المنطقة"></div><div class="teacher-v156-field full"><label>الاختصاص</label><input id="v156Specialty" value="${escx(t.specialty||'')}" placeholder="مثال: مدرس رياضيات"></div><div class="teacher-v156-field full"><label>نبذة قصيرة</label><textarea id="v156Bio" placeholder="نبذة تظهر في ملفك">${escx(t.bio||'')}</textarea></div><div class="teacher-v156-field full"><label>الصورة الشخصية</label><div class="teacher-v156-upload"><div id="v156AvatarPreview" class="teacher-v156-upload-preview">${avatar?`<img src="${escx(avatar)}" alt="">`:'📷'}</div><input id="v156Avatar" type="file" accept="image/png,image/jpeg,image/webp" onchange="v156PreviewAvatar(this)"></div></div></div><div class="teacher-v156-actions"><button class="teacher-v156-save" onclick="v156SaveTeacherProfile()">حفظ التعديلات</button></div></article><aside class="teacher-v156-card"><h3>ملخص الحساب</h3><div class="teacher-v156-stat-list"><div class="teacher-v156-stat"><span>الملازم</span><b>${s.books}</b></div><div class="teacher-v156-stat"><span>الطلبات</span><b>${s.orders}</b></div><div class="teacher-v156-stat"><span>النسخ المباعة</span><b>${s.sales}</b></div></div><h3 style="margin-top:20px">الأمان</h3><div class="teacher-v156-security"><input id="v156NewPassword" type="password" placeholder="كلمة المرور الجديدة"><input id="v156ConfirmPassword" type="password" placeholder="تأكيد كلمة المرور"><button onclick="v156ChangeTeacherPassword()">تغيير كلمة المرور</button></div><div class="teacher-v156-note">اسم المدرس وربط الملازم يبقى من صلاحية الإدارة، بينما تستطيع تعديل بيانات التواصل والصورة وكلمة المرور.</div><div class="teacher-v156-danger"><button onclick="logout()">تسجيل الخروج</button></div></aside></div></section>`;
  }
  window.v156PreviewAvatar=function(input){const f=input?.files?.[0],box=document.getElementById('v156AvatarPreview');if(!f||!box)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return alert('اختر صورة PNG أو JPG أو WEBP');const r=new FileReader();r.onload=()=>box.innerHTML=`<img src="${r.result}" alt="معاينة">`;r.readAsDataURL(f)};
  window.v156SaveTeacherProfile=async function(){
    const c=cur(),t=teacher();if(!c?.id)return alert('تعذر تحديد حساب المدرس');
    const payload={phone:document.getElementById('v156Phone')?.value.trim()||'',area:document.getElementById('v156Area')?.value.trim()||'',specialty:document.getElementById('v156Specialty')?.value.trim()||'',bio:document.getElementById('v156Bio')?.value.trim()||'',updated_at:new Date().toISOString()};
    try{
      const file=document.getElementById('v156Avatar')?.files?.[0];if(file)payload.avatar_path=await uploadFile('teachers',file,{type:'image'});
      await update('accounts',payload,{id:c.id});if(typeof audit==='function')await audit('teacher_profile','تحديث ملف المدرس');if(typeof load==='function')await load();
      if(typeof current!=='undefined')current.name=t.name||current.name;
      if(typeof toast==='function')toast('تم حفظ الملف الشخصي');render();
    }catch(e){alert('تعذر حفظ الملف: '+e.message)}
  };
  window.v156ChangeTeacherPassword=async function(){
    const c=cur(),p=document.getElementById('v156NewPassword')?.value||'',p2=document.getElementById('v156ConfirmPassword')?.value||'';
    if(p.length<4)return alert('كلمة المرور يجب أن تكون 4 أحرف أو أرقام على الأقل');if(p!==p2)return alert('كلمتا المرور غير متطابقتين');
    try{const client=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());if(!client?.auth)throw new Error('خدمة الدخول الآمن غير متاحة');const {error}=await client.auth.updateUser({password:p});if(error)throw error;if(typeof audit==='function')await audit('teacher_security','تغيير كلمة مرور المدرس');document.getElementById('v156NewPassword').value='';document.getElementById('v156ConfirmPassword').value='';if(typeof toast==='function')toast('تم تغيير كلمة المرور')}catch(e){alert('تعذر تغيير كلمة المرور: '+e.message)}
  };
  const oldTab=window.teacherTab;
  window.teacherTab=function(tab){if(tab==='profile'){window.activeTeacherTab='profile';document.querySelectorAll('#teacherPage .teacher-tabs button').forEach(b=>b.classList.toggle('active-teacher-tab',(b.getAttribute('onclick')||'').includes("'profile'")));render();return;}return typeof oldTab==='function'?oldTab(tab):undefined};
  window.AlinTeacherModules=window.AlinTeacherModules||{};window.AlinTeacherModules.teacherTab=window.teacherTab;window.renderTeacherProfileV156=render;
})();


;

