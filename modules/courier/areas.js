// === courier/areas.js ===
/* ALIN v2.4.2 — delivery area administration only. */
(function(){
  'use strict';
  const core=window.AlinCourierCore;if(!core)throw new Error('AlinCourierCore is required before courier/areas.js');
  const {escv,notify,now,allCouriers,areasOf,areaRows}=core;
  function renderCourierAreasAdmin(){const rows=areaRows();adminContent.innerHTML=`<section class="v161-admin"><header class="v161-title"><div><small>مناطق التوصيل</small><h2>إدارة المناطق</h2><p>هذه القائمة تظهر للطالب وعند تحديد مناطق عمل المندوب.</p></div><button onclick="alinV161AddArea()">+ إضافة منطقة</button></header><div class="v161-area-admin">${rows.map(a=>{const count=allCouriers().filter(c=>areasOf(c).includes(a.name)).length;return `<article><div><h3>${escv(a.name)}</h3><p>مرتبطة بـ ${count} مندوب</p></div><div><button onclick="alinV161EditArea('${escv(a.id)}','${escv(a.name)}')">تعديل</button><button class="danger" onclick="alinV161DeleteArea('${escv(a.id)}','${escv(a.name)}')">حذف</button></div></article>`}).join('')}</div></section>`}
  window.alinV161AddArea=async function(){const name=(prompt('اسم المنطقة الجديدة')||'').trim();if(!name)return;try{await insert('delivery_areas',{id:typeof uid==='function'?uid('A'):`A${Date.now()}`,name,city:'كركوك',status:'active',sort_order:areaRows().length+1});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تمت إضافة المنطقة')}catch(error){alert(error.message||'تعذر إضافة المنطقة')}};
  window.alinV161EditArea=async function(id,oldName){const name=(prompt('تعديل اسم المنطقة',oldName)||'').trim();if(!name||name===oldName)return;try{await update('delivery_areas',{name},{id});for(const c of allCouriers()){const areas=areasOf(c);if(areas.includes(oldName))await update('couriers',{areas:areas.map(x=>x===oldName?name:x),area:c.area===oldName?name:c.area,updated_at:now()},{id:c.id})}if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم تعديل المنطقة')}catch(error){alert(error.message||'تعذر تعديل المنطقة')}};
  window.alinV161DeleteArea=async function(id,name){if(allCouriers().some(c=>areasOf(c).includes(name)))return alert('لا يمكن حذف منطقة مرتبطة بمندوب');if(!confirm(`حذف منطقة ${name}؟`))return;try{await update('delivery_areas',{status:'inactive'},{id});if(typeof load==='function')await load();renderCourierAreasAdmin();notify('تم حذف المنطقة')}catch(error){alert(error.message||'تعذر حذف المنطقة')}};


  window.renderCourierAreasAdmin=renderCourierAreasAdmin;
  window.AlinAdminModules?.register?.('courierAreas',renderCourierAreasAdmin);
})();

;
