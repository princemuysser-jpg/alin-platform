// === admin/marketing.js ===
/* ALIN v2.1.0: banner administration only. Coupons live in admin/coupons.js. */
(function(){
  let editingBannerId=null;
  const E=v=>typeof esc==='function'?esc(v):String(v??'');
  const D=v=>{if(!v)return 'غير محدد';try{return new Date(v).toLocaleDateString('ar-IQ')}catch(_){return v}};
  const banners=()=>Array.isArray(db?.banners)?db.banners:[];
  const activeBanner=b=>b.active===true||b.active===1||b.active==='1';

  function bannerPreviewSync(){
    const box=document.getElementById('v140BannerPreview');if(!box)return;
    const title=document.getElementById('v140AdTitle')?.value||'عنوان الإعلان';
    const text=document.getElementById('v140AdText')?.value||'سيظهر نص الإعلان هنا';
    const file=document.getElementById('v140AdImage')?.files?.[0];
    box.querySelector('b').textContent=title;box.querySelector('span').textContent=text;
    const old=box.querySelector('img');if(old)old.remove();
    if(file){const img=document.createElement('img');img.src=URL.createObjectURL(file);box.prepend(img)}
  }
  function bannerRowsHtml(rows){return rows.length?rows.map(b=>`<div class="admin-v140-item" data-search="${E((b.title||'')+' '+(b.text||''))}"><div class="admin-v140-thumb">${b.image_path?`<img src="${E(typeof mediaUrl==='function'?mediaUrl(b.image_path):b.image_path)}" alt="">`:'📣'}</div><div><h4>${E(b.title||'بدون عنوان')}</h4><p>${E(b.text||'')}</p><div class="admin-v140-meta"><span class="admin-v140-pill ${activeBanner(b)?'active':'off'}">${activeBanner(b)?'نشط':'متوقف'}</span><span class="admin-v140-pill">${D(b.start_date)} — ${D(b.end_date)}</span></div></div><div class="admin-v140-item-actions"><button class="secondary" onclick="editBannerV140('${E(b.id)}')">تعديل</button><button onclick="toggleBannerV140('${E(b.id)}',${activeBanner(b)?0:1})">${activeBanner(b)?'إيقاف':'تشغيل'}</button><button class="danger" onclick="deleteBannerV140('${E(b.id)}')">حذف</button></div></div>`).join(''):'<div class="admin-v140-empty">لا توجد إعلانات حتى الآن</div>'}

  window.renderAdsAdminV140=function(){
    const rows=banners(), active=rows.filter(activeBanner).length;
    adminContent.innerHTML=`<section class="admin-v140"><header class="admin-v140-head"><div><h2>الإعلانات والبنرات</h2><p>إدارة البنرات التي تظهر في المتجر، مع تحديد فترة العرض والرابط وحالة النشر.</p></div><div class="admin-v140-badges"><span class="admin-v140-badge">${rows.length} إعلان</span><span class="admin-v140-badge">${active} نشط</span></div></header><div class="admin-v140-grid"><article class="admin-v140-card"><h3>${editingBannerId?'تعديل الإعلان':'إضافة إعلان جديد'}</h3><div class="admin-v140-preview" id="v140BannerPreview"><div class="admin-v140-preview-copy"><b>عنوان الإعلان</b><span>سيظهر نص الإعلان هنا</span></div></div><form id="v140BannerForm" class="admin-v140-form" onsubmit="return false"><label>عنوان الإعلان<input id="v140AdTitle" required placeholder="مثال: عروض العودة للمدارس" oninput="bannerPreviewSyncV140()"></label><label>النص المختصر<textarea id="v140AdText" placeholder="اكتب وصفاً مختصراً" oninput="bannerPreviewSyncV140()"></textarea></label><label>صورة البنر<input id="v140AdImage" type="file" accept="image/*" onchange="bannerPreviewSyncV140()"></label><label>رابط عند الضغط<input id="v140AdLink" type="url" placeholder="https://..."></label><div class="admin-v140-form-row"><label>بداية العرض<input id="v140AdStart" type="date"></label><label>نهاية العرض<input id="v140AdEnd" type="date"></label></div><label>الحالة<select id="v140AdActive"><option value="1">نشط</option><option value="0">متوقف</option></select></label><div class="admin-v140-actions"><button onclick="saveBannerV140()">${editingBannerId?'حفظ التعديل':'إضافة الإعلان'}</button>${editingBannerId?'<button class="secondary" onclick="cancelBannerEditV140()">إلغاء التعديل</button>':''}</div></form></article><article class="admin-v140-card"><div class="admin-v140-toolbar"><h3>الإعلانات الحالية</h3><input id="v140AdSearch" placeholder="بحث بالعنوان" oninput="filterAdsV140()"></div><div id="v140AdsList" class="admin-v140-list">${bannerRowsHtml(rows)}</div></article></div></section>`;
    if(editingBannerId){const b=rows.find(x=>String(x.id)===String(editingBannerId));if(b){v140AdTitle.value=b.title||'';v140AdText.value=b.text||'';v140AdLink.value=b.link_url||'';v140AdStart.value=(b.start_date||'').slice(0,10);v140AdEnd.value=(b.end_date||'').slice(0,10);v140AdActive.value=activeBanner(b)?'1':'0';bannerPreviewSync()}}
  };
  window.bannerPreviewSyncV140=bannerPreviewSync;
  window.filterAdsV140=function(){const q=(v140AdSearch.value||'').trim().toLowerCase();document.querySelectorAll('#v140AdsList .admin-v140-item').forEach(x=>x.hidden=!x.dataset.search.toLowerCase().includes(q))};
  window.editBannerV140=id=>{editingBannerId=id;renderAdsAdminV140();adminContent.scrollIntoView({behavior:'smooth'})};
  window.cancelBannerEditV140=()=>{editingBannerId=null;renderAdsAdminV140()};
  window.saveBannerV140=async function(){try{const title=v140AdTitle.value.trim();if(!title)throw Error('اكتب عنوان الإعلان');const file=v140AdImage.files?.[0];let image=null;if(file&&file.name)image=await uploadFile('banners',file,{type:'image'});const payload={title,text:v140AdText.value.trim(),link_url:v140AdLink.value.trim()||null,start_date:v140AdStart.value||null,end_date:v140AdEnd.value||null,active:v140AdActive.value==='1',updated_at:new Date().toISOString()};if(image)payload.image_path=image;if(editingBannerId)await update('banners',payload,{id:editingBannerId});else await insert('banners',{id:uid('AD'),...payload});if(typeof audit==='function')await audit('banner',(editingBannerId?'تعديل':'إضافة')+' إعلان '+title);editingBannerId=null;await load();renderAdsAdminV140();toast('تم حفظ الإعلان')}catch(e){alert(e.message)}};
  window.toggleBannerV140=async(id,on)=>{await update('banners',{active:!!on,updated_at:new Date().toISOString()},{id});await load();renderAdsAdminV140()};
  window.deleteBannerV140=async id=>{if(!confirm('حذف الإعلان نهائياً؟'))return;try{await removeRow('banners',{id});await load();renderAdsAdminV140();toast('تم حذف الإعلان')}catch(e){alert(e.message)}};

  const oldAdminTab=window.adminTab;
  window.adminTab=function(t){if(t==='ads'){if(typeof markAdminTab==='function')markAdminTab(t);return renderAdsAdminV140()}return oldAdminTab.apply(this,arguments)};
})();
