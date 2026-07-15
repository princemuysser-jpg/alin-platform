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

