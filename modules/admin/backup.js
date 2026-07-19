// Alin module: admin/backup.js | v2.0.3
/* ===== admin/js/admin-backup-rc1.js ===== */
(function(){
  const VERSION='RC1';
  const LOG_KEY='alin_backup_log_rc1';
  let pending=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const size=x=>{const n=Number(x||0);if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'};
  const nowName=()=>`Alin_Backup_${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.json`;
  const clone=v=>JSON.parse(JSON.stringify(v??{}));
  function logs(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch(_){return[]}}
  function saveLogs(rows){localStorage.setItem(LOG_KEY,JSON.stringify(rows.slice(0,20)))}
  function snapshot(){
    const data=clone(window.db||{});
    const local={};
    Object.keys(localStorage).filter(k=>k.startsWith('alin_')||k.startsWith('ALIN_')).forEach(k=>{if(k!==LOG_KEY)local[k]=localStorage.getItem(k)});
    return {app:'ALIN',backup_version:VERSION,created_at:new Date().toISOString(),source_version:'V177',data,local_settings:local};
  }
  function downloadObject(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return blob.size}
  function addLog(name,bytes,type='manual'){const rows=logs();rows.unshift({id:Date.now(),name,size:bytes,created_at:new Date().toISOString(),type});saveLogs(rows)}
  function stats(){const d=window.db||{};return {orders:(d.orders||[]).length,accounts:[...(d.accounts?.teachers||[]),...(d.accounts?.libraries||[])].length,booklets:(d.booklets||[]).length,products:(d.products||[]).length}}
  function render(){
    const root=document.getElementById('adminContent');if(!root)return;
    const s=stats(),l=logs();
    root.dataset.adminModule='backup';
    root.innerHTML=`<section class="admin-backup-rc1"><header class="admin-backup-head"><div><h2>النسخ الاحتياطي والاستعادة</h2><p>حفظ نسخة محلية من بيانات المنصة واستعادتها عند الحاجة.</p></div><span class="status">${VERSION}</span></header><section class="admin-backup-summary"><article class="admin-backup-stat"><small>الطلبات</small><b>${s.orders}</b></article><article class="admin-backup-stat"><small>الحسابات</small><b>${s.accounts}</b></article><article class="admin-backup-stat"><small>الملازم</small><b>${s.booklets}</b></article><article class="admin-backup-stat"><small>المنتجات</small><b>${s.products}</b></article></section><section class="admin-backup-grid"><article class="admin-backup-card"><h3>إنشاء نسخة احتياطية</h3><p>تنزيل ملف JSON يحتوي على البيانات والإعدادات المحلية الحالية.</p><div class="admin-backup-actions"><button onclick="alinCreateBackup()">إنشاء وتنزيل النسخة</button></div></article><article class="admin-backup-card"><h3>استعادة نسخة</h3><p>اختر ملف نسخة آلين، افحصه ثم نفّذ الاستعادة بعد التأكيد.</p><div class="admin-backup-file"><input id="alinBackupFile" type="file" accept=".json,application/json" onchange="alinReadBackup(this.files[0])"><div id="alinBackupStatus" class="admin-backup-warning">لم يتم اختيار ملف.</div><div id="alinBackupPreview"></div><div class="admin-backup-actions"><button id="alinRestoreBtn" class="admin-backup-danger" disabled onclick="alinRestoreBackup()">استعادة البيانات</button></div></div></article></section><article class="admin-backup-card"><h3>سجل النسخ</h3><div class="admin-backup-log">${l.length?l.map(x=>`<article><div><b>${esc(x.name)}</b><small>${new Date(x.created_at).toLocaleString('ar-IQ')} — ${size(x.size)}</small></div><span>${x.type==='auto'?'تلقائية':'يدوية'}</span></article>`).join(''):'<p class="muted">لا توجد نسخ مسجلة بعد.</p>'}</div></article></section>`;
  }
  window.alinCreateBackup=function(){const obj=snapshot(),name=nowName(),bytes=downloadObject(obj,name);addLog(name,bytes);render();if(typeof toast==='function')toast('تم إنشاء النسخة الاحتياطية')};
  window.alinReadBackup=async function(file){pending=null;const status=document.getElementById('alinBackupStatus'),preview=document.getElementById('alinBackupPreview'),btn=document.getElementById('alinRestoreBtn');if(!file){status.textContent='لم يتم اختيار ملف.';btn.disabled=true;return}try{const text=await file.text();const obj=JSON.parse(text);if(obj.app!=='ALIN'||!obj.data||typeof obj.data!=='object')throw new Error('الملف ليس نسخة احتياطية صالحة لمنصة آلين');pending=obj;status.className='admin-backup-ok';status.textContent=`الملف صالح — ${file.name} — ${size(file.size)}`;preview.innerHTML=`<pre class="admin-backup-preview">${esc(JSON.stringify({created_at:obj.created_at,backup_version:obj.backup_version,orders:(obj.data.orders||[]).length,booklets:(obj.data.booklets||[]).length,products:(obj.data.products||[]).length},null,2))}</pre>`;btn.disabled=false}catch(e){status.className='admin-backup-warning';status.textContent=e.message||'تعذر قراءة الملف';preview.innerHTML='';btn.disabled=true}};
  window.alinRestoreBackup=function(){if(!pending)return alert('اختر نسخة صالحة أولاً');if(!confirm('سيتم استبدال البيانات الحالية بالنسخة المختارة. هل تريد المتابعة؟'))return;try{const auto=snapshot(),name='Alin_Auto_Before_Restore_'+Date.now()+'.json',bytes=downloadObject(auto,name);addLog(name,bytes,'auto');window.db=clone(pending.data);Object.entries(pending.local_settings||{}).forEach(([k,v])=>localStorage.setItem(k,String(v)));if(typeof renderAll==='function')renderAll();render();alert('تمت الاستعادة. أعد تحميل الصفحة لتطبيق كل البيانات.')}catch(e){alert('تعذرت الاستعادة: '+(e.message||e))}};
  function addButton(){document.querySelectorAll('#adminPage .admin-tabs').forEach(tabs=>{if(tabs.querySelector('[data-admin-tab="backup"],button[onclick*="backup"]'))return;const b=document.createElement('button');b.textContent='النسخ الاحتياطي';b.dataset.adminTab='backup';b.setAttribute('onclick',"adminTab('backup')");const settings=[...tabs.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').includes("'settings'"));settings?tabs.insertBefore(b,settings):tabs.appendChild(b)})}
  function install(){addButton();const base=window.adminTab;if(typeof base==='function'&&!base.__backupRC1){const wrapped=function(tab){window.activeAdminTab=tab;if(tab==='backup'){render();document.querySelectorAll('#adminPage .admin-tabs button').forEach(b=>b.classList.toggle('active-admin-tab',b.dataset.adminTab==='backup'||(b.getAttribute('onclick')||'').includes("'backup'")));return}return base.apply(this,arguments)};wrapped.__backupRC1=true;window.adminTab=wrapped}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


;

