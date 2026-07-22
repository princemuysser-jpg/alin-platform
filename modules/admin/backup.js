// === admin/backup.js ===
/* ALIN v2.3.8 — authoritative backup owner. No admin router wrapping. */
(function(){
  'use strict';
  const VERSION='2.3.8';
  const LOG_KEY='alin_backup_log_v227';
  const RESTORABLE=['categories','products','booklets','banners','coupons'];
  let pending=null;
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'');
  const clone=value=>JSON.parse(JSON.stringify(value??{}));
  const bytesLabel=value=>{const n=Number(value||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`};
  const filename=()=>`Alin_Backup_${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.json`;
  const rows=value=>Array.isArray(value)?value:[];
  function logs(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch(_){return[]}}
  function saveLogs(value){localStorage.setItem(LOG_KEY,JSON.stringify(rows(value).slice(0,30)))}
  function addLog(name,size,type='manual',status='created'){
    const value=logs();value.unshift({id:`B${Date.now()}`,name,size,type,status,created_at:new Date().toISOString()});saveLogs(value);
  }
  function snapshot(){
    const data=clone(window.db||{});
    return {
      app:'ALIN',format:'alin-cloud-backup',backup_version:VERSION,created_at:new Date().toISOString(),
      schema:'catalog-settings-v1',
      counts:{orders:rows(data.orders).length,accounts:rows(data.accounts?.all).length,booklets:rows(data.booklets).length,products:rows(data.products).length},
      data
    };
  }
  function downloadObject(object,name){
    const blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json;charset=utf-8'}),link=document.createElement('a');
    link.href=URL.createObjectURL(blob);link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);return blob.size;
  }
  function validate(object){
    if(!object||object.app!=='ALIN'||object.format!=='alin-cloud-backup'||!object.data||typeof object.data!=='object')throw new Error('الملف ليس نسخة احتياطية صالحة لمنصة آلين');
    if(!object.backup_version)throw new Error('نسخة الاحتياط غير معروفة الإصدار');
    return object;
  }
  function cleanRow(row){
    const result={};for(const [key,value] of Object.entries(row||{})){if(key.startsWith('_')||value===undefined)continue;result[key]=value}return result;
  }
  async function cloudUpsert(table,value){
    const list=rows(value).map(cleanRow);if(!list.length)return 0;
    const client=window.sb;if(!client)throw new Error('الاتصال بـ Supabase غير متاح');
    const {error}=await client.from(table).upsert(list);if(error)throw new Error(`تعذر استعادة ${table}: ${error.message||error}`);return list.length;
  }
  async function restoreSettings(settings){
    if(!settings||typeof settings!=='object')return 0;let count=0;
    for(const [key,value] of Object.entries(settings)){
      if(key==='storeType'||value===undefined||value===null||typeof value==='object')continue;
      await window.settingsSet(key,String(value));count++;
    }
    return count;
  }
  async function restoreSafe(object){
    validate(object);if(!window.current||window.current.role!=='admin')throw new Error('الاستعادة متاحة للمدير فقط');
    const result={settings:0};result.settings=await restoreSettings(object.data.settings||{});
    for(const table of RESTORABLE)result[table]=await cloudUpsert(table,object.data[table]);
    if(typeof window.audit==='function')await window.audit('backup_restore',`استعادة آمنة للكتالوج والإعدادات من نسخة ${object.created_at||''}`);
    if(typeof window.load==='function')await window.load();
    return result;
  }
  function render(){
    const root=document.getElementById('adminContent');if(!root)return;const data=window.db||{},history=logs();
    root.dataset.adminModule='backup';
    root.innerHTML=`<section class="admin-backup-rc1"><header class="admin-backup-head"><div><h2>النسخ الاحتياطي والاستعادة</h2><p>نسخة سحابية قابلة للفحص. الاستعادة الآمنة تشمل الإعدادات والمنتجات والملازم والأقسام والإعلانات والكوبونات، ولا تستبدل الطلبات أو الحسابات أو القيود المالية.</p></div><span class="status">v${VERSION}</span></header>
      <section class="admin-backup-summary"><article class="admin-backup-stat"><small>الطلبات</small><b>${rows(data.orders).length}</b></article><article class="admin-backup-stat"><small>الحسابات</small><b>${rows(data.accounts?.all).length}</b></article><article class="admin-backup-stat"><small>الملازم</small><b>${rows(data.booklets).length}</b></article><article class="admin-backup-stat"><small>المنتجات</small><b>${rows(data.products).length}</b></article></section>
      <section class="admin-backup-grid"><article class="admin-backup-card"><h3>إنشاء نسخة</h3><p>ينزّل ملف JSON من البيانات المحمّلة حاليًا من Supabase.</p><div class="admin-backup-actions"><button type="button" onclick="alinCreateBackup()">إنشاء وتنزيل النسخة</button></div></article>
      <article class="admin-backup-card"><h3>استعادة آمنة</h3><p>لا يتم المساس بالطلبات والحسابات والمالية أثناء الاستعادة.</p><div class="admin-backup-file"><input id="alinBackupFile" type="file" accept=".json,application/json" onchange="alinReadBackup(this.files[0])"><div id="alinBackupStatus" class="admin-backup-warning">لم يتم اختيار ملف.</div><div id="alinBackupPreview"></div><div class="admin-backup-actions"><button id="alinRestoreBtn" class="admin-backup-danger" disabled type="button" onclick="alinRestoreBackup()">استعادة الكتالوج والإعدادات</button></div></div></article></section>
      <article class="admin-backup-card"><h3>سجل النسخ</h3><div class="admin-backup-log">${history.length?history.map(item=>`<article><div><b>${escv(item.name)}</b><small>${new Date(item.created_at).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')} — ${bytesLabel(item.size)}</small></div><span>${item.type==='restore'?'استعادة':'نسخة'}</span></article>`).join(''):'<p class="muted">لا توجد عمليات مسجلة بعد.</p>'}</div></article></section>`;
  }
  function alinCreateBackup(){
    try{const object=snapshot(),name=filename(),size=downloadObject(object,name);addLog(name,size);render();window.toast?.('تم إنشاء النسخة الاحتياطية')}catch(error){alert(error.message||'تعذر إنشاء النسخة')}
  }
  async function alinReadBackup(file){
    pending=null;const status=document.getElementById('alinBackupStatus'),preview=document.getElementById('alinBackupPreview'),button=document.getElementById('alinRestoreBtn');if(!status||!preview||!button)return;
    if(!file){status.textContent='لم يتم اختيار ملف.';button.disabled=true;return}
    try{const object=validate(JSON.parse(await file.text()));pending=object;status.className='admin-backup-ok';status.textContent=`الملف صالح — ${file.name} — ${bytesLabel(file.size)}`;preview.innerHTML=`<pre class="admin-backup-preview">${escv(JSON.stringify({created_at:object.created_at,version:object.backup_version,settings:Object.keys(object.data.settings||{}).length,booklets:rows(object.data.booklets).length,products:rows(object.data.products).length,banners:rows(object.data.banners).length,coupons:rows(object.data.coupons).length},null,2))}</pre>`;button.disabled=false}catch(error){status.className='admin-backup-warning';status.textContent=error.message||'تعذر قراءة الملف';preview.innerHTML='';button.disabled=true}
  }
  async function alinRestoreBackup(){
    if(!pending)return alert('اختر نسخة صالحة أولاً');if(!confirm('سيتم تحديث الكتالوج والإعدادات من النسخة المختارة. الطلبات والحسابات والمالية لن تتغير. متابعة؟'))return;
    const status=document.getElementById('alinBackupStatus'),button=document.getElementById('alinRestoreBtn');if(button)button.disabled=true;if(status){status.className='admin-backup-warning';status.textContent='جارٍ الاستعادة الآمنة...'}
    try{const result=await restoreSafe(pending);addLog(`Restore_${Date.now()}.json`,0,'restore','completed');if(status){status.className='admin-backup-ok';status.textContent=`تمت الاستعادة: ${Object.values(result).reduce((sum,n)=>sum+Number(n||0),0)} سجل`};window.toast?.('تمت الاستعادة الآمنة');render()}catch(error){if(status){status.className='admin-backup-warning';status.textContent=error.message||'تعذرت الاستعادة'};if(button)button.disabled=false}
  }
  function addButton(){
    document.querySelectorAll('#adminPage .admin-tabs').forEach(tabs=>{let button=tabs.querySelector('[data-admin-tab="backup"]');if(button)return;button=document.createElement('button');button.type='button';button.textContent='النسخ الاحتياطي';button.dataset.adminTab='backup';button.setAttribute('onclick',"adminTab('backup')");const settings=tabs.querySelector('[data-admin-tab="settings"],button[onclick*="settings"]');settings?tabs.insertBefore(button,settings):tabs.appendChild(button)})
  }
  function install(){addButton();window.AlinAdminModules?.register?.('backup',render)}
  Object.assign(window,{alinCreateBackup,alinReadBackup,alinRestoreBackup});
  window.AlinBackup=Object.freeze({snapshot,validate,restoreSafe,render});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

;
