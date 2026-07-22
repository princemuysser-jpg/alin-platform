// === core/account-admin-service.js ===
/* ALIN v2.3.9 — secure account administration adapter. */
(function(){
  'use strict';
  const runtime=()=>window.ALINAuthRuntime||{};
  const client=()=>runtime().client?.()||window.sb||window.AlinCloud?.client?.()||null;
  const invokeAdmin=(name,body)=>{
    const invoke=runtime().invokeAdmin;
    if(typeof invoke!=='function')throw new Error('خدمة إدارة الحسابات غير جاهزة');
    return invoke(name,body);
  };
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
      const selectedAreas=[...document.querySelectorAll('#v163CourierAreaPicker input:checked')].map(x=>String(x.value||'').trim()).filter(Boolean);
      const payload={
        role,
        name:document.getElementById('aName')?.value?.trim()||'',
        username:document.getElementById('aUser')?.value?.trim()||'',
        password:document.getElementById('aPass')?.value||'',
        area:role==='courier'?(selectedAreas[0]||''):(document.getElementById('aArea')?.value?.trim()||''),
        landmark:role==='courier'?'':(document.getElementById('aLandmark')?.value?.trim()||''),
        phone:document.getElementById('v163CourierPhone')?.value?.trim()||'',
        availability:document.getElementById('v163CourierAvailability')?.value||'available',
        areas:selectedAreas,
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
      if(/PGRST202|Could not find the function|schema cache/i.test(text))throw new Error('تحديث ربط الحسابات غير منفذ. شغّل ملف RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql مرة واحدة');
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
  window.ALINAuth=Object.assign(window.ALINAuth||{},
    {createAccount,createAccountFromAdmin,updateAccountFromAdmin,resetPasswordFromAdmin,repairAuthLink,deleteAccountFromAdmin});
  window.ALINAccountAdmin=Object.freeze({createAccount,createAccountFromAdmin,updateAccountFromAdmin,resetPasswordFromAdmin,repairAuthLink,deleteAccountFromAdmin});
})();
