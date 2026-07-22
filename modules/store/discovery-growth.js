// === store/discovery-growth.js ===
// Student hub, growth tables, group orders, merchandising and tracking extras.
(()=>{
  'use strict';
  const ctx=window.AlinStoreDiscovery;
  if(!ctx)throw new Error('AlinStoreDiscovery core must load before growth');
  const {$,$$,esc,num,fmt,state,canonicalItems,findItem,studentProfile,hasSb,openModal}=ctx;

  async function saveGrade(grade){
    const profile={...studentProfile(),grade};
    try{
      const student=typeof window.currentStudent==='function'?window.currentStudent():null;
      if(student){profile.phone=student.phone;profile.name=student.name}
    }catch(_){/* ignore */}
    localStorage.setItem('alin_v99_student_profile',JSON.stringify(profile));
    ctx.renderStage?.();
    ctx.renderEffectiveStore?.();
    if(profile.phone&&state.schema.student_profiles&&hasSb()){
      try{await window.sb.from('student_profiles').upsert({phone:profile.phone,name:profile.name||null,grade:profile.grade||null},{onConflict:'phone'})}catch(_){/* optional service */}
    }
  }

  function reorder(id){
    const order=(window.db?.orders||[]).find(row=>String(row.id)===String(id));
    if(!order||!order.item_id){alert('تفاصيل هذا الطلب القديم غير مكتملة');return}
    for(let index=0;index<Math.max(1,num(order.qty));index++)window.addToCart?.(order.kind,String(order.item_id));
    window.openCart?.();
  }

  function renderStudentHub(){
    const root=$('#v99StudentHub');
    if(!root)return;
    let student=null;
    try{student=typeof window.currentStudent==='function'?window.currentStudent():null}catch(_){/* ignore */}
    const orders=student?(window.db?.orders||[]).filter(order=>order.student_phone===student.phone).slice(0,5):[];
    if(ctx.isDesktop()||ctx.isMobile()){
      if(!student){root.innerHTML='';return}
      root.innerHTML=`<div class="v99-section-head"><div><h2>طلباتي الأخيرة</h2><small>إعادة الطلب أو متابعة حالته بسهولة</small></div></div><article class="v99-hub-card desktop-orders-card">${orders.map(order=>`<div class="v99-order-row"><div><b>${esc(order.title||order.order_number||order.id)}</b><small>${esc(order.status||'جديد')}${order.ready_eta?` • جاهز تقريباً ${esc(order.ready_eta)}`:''}</small></div><button data-v99-action="reorder" data-id="${esc(order.id)}">أعد الطلب</button></div>`).join('')||'<p>لا توجد طلبات سابقة.</p>'}</article>`;
      return;
    }
    const loyalty=(state.tables.loyalty_accounts||[]).find(row=>student&&row.phone===student.phone);
    root.innerHTML=`<div class="v99-section-head"><div><h2>مساحة الطالب</h2><small>طلباتك ومكافآتك وخيارات الطلب الجماعي</small></div></div><div class="v99-hub-grid"><article class="v99-hub-card"><h3>آخر الطلبات</h3>${student?(orders.map(order=>`<div class="v99-order-row"><div><b>${esc(order.title||order.order_number||order.id)}</b><small>${esc(order.status||'جديد')}${order.ready_eta?` • جاهز تقريباً ${esc(order.ready_eta)}`:''}</small></div><button data-v99-action="reorder" data-id="${esc(order.id)}">أعد الطلب</button></div>`).join('')||'<p>لا توجد طلبات سابقة.</p>'):'<p>سجل دخول الطالب لرؤية طلباتك.</p>'}</article><article class="v99-hub-card"><h3>نقاط آلين</h3>${loyalty?`<div class="v99-price">${fmt(loyalty.points_balance)} نقطة</div><p>يُحتسب الرصيد من النظام الآمن فقط.</p>`:'<div class="v99-notice">لا يوجد رصيد نقاط متاح. تظهر النقاط هنا بعد تفعيل نظام النقاط وربط الحساب.</div>'}</article><article class="v99-hub-card"><h3>طلب جماعي</h3><p>اجمع طلبات زملائك في مجموعة واحدة عندما تكون الخدمة مفعلة.</p><button data-v99-action="groupOrder">إنشاء أو انضمام</button></article></div>`;
  }

  function groupOrder(){
    const ready=state.schema.group_orders&&state.schema.group_order_members;
    openModal(`<h2>الطلب الجماعي</h2>${ready?'<p>أنشئ رمز مجموعة أو أدخل رمزاً موجوداً.</p>':'<div class="v99-notice error">الخدمة غير مفعلة على قاعدة البيانات.</div>'}<div class="v99-form"><input id="v99GroupCode" placeholder="رمز المجموعة"><button data-v99-action="groupJoin" ${ready?'':'disabled'}>انضمام للمجموعة</button><button data-v99-action="groupCreate" ${ready?'':'disabled'}>إنشاء مجموعة</button><div id="v99FormMsg"></div></div>`);
  }

  async function groupWrite(mode){
    const message=$('#v99FormMsg'),code=$('#v99GroupCode')?.value.trim().toUpperCase(),profile=studentProfile();
    if(!hasSb()){if(message)message.innerHTML='<div class="v99-notice error">الاتصال غير متاح.</div>';return}
    try{
      if(mode==='create'){
        const value=code||`ALIN-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
        const {data,error}=await window.sb.from('group_orders').insert({code:value,status:'open',owner_contact:profile.phone||null}).select().single();
        if(error)throw error;
        if(message)message.innerHTML=`<div class="v99-notice success">تم إنشاء المجموعة: <b>${esc(data.code)}</b></div>`;
      }else{
        if(!code)throw new Error('اكتب رمز المجموعة');
        const {data:group,error:findError}=await window.sb.from('group_orders').select('id,code').eq('code',code).eq('status','open').maybeSingle();
        if(findError)throw findError;
        if(!group)throw new Error('المجموعة غير موجودة');
        const {error}=await window.sb.from('group_order_members').insert({group_order_id:group.id,contact:profile.phone||null,name:profile.name||null});
        if(error)throw error;
        if(message)message.innerHTML='<div class="v99-notice success">تم الانضمام للمجموعة.</div>';
      }
    }catch(error){if(message)message.innerHTML=`<div class="v99-notice error">لم يتم الحفظ: ${esc(error.message||'تحقق من الصلاحيات')}</div>`}
  }

  async function safeTable(name){
    if(!hasSb())return null;
    try{
      const {data,error}=await window.sb.from(name).select('*').limit(100);
      if(error)throw error;
      state.schema[name]=true;
      return data||[];
    }catch(_){state.schema[name]=false;return null}
  }

  async function loadGrowthData(){
    const names=['student_profiles','bundles','bundle_items','product_reviews','stock_alerts','loyalty_accounts','loyalty_transactions','group_orders','group_order_members','group_order_items'];
    for(const name of names){state.tables[name]=(await safeTable(name))||[]}
    ctx.renderEffectiveStore?.();
    renderStudentHub();
    renderAdminGrowth();
  }

  function renderAdminGrowth(){
    $('#v99AdminPanel')?.remove();
  }

  async function editMerch(kind,id){
    const item=findItem(kind,id);
    if(!item)return;
    const deal=prompt('سعر العرض (اتركه فارغاً للإلغاء)',item.dealPrice||'');
    const start=prompt('بداية العرض ISO أو فارغ',item.dealStart||'');
    const end=prompt('نهاية العرض ISO أو فارغ',item.dealEnd||'');
    const badge=prompt('الشارة',item.badge||'');
    const prep=prompt('دقائق التجهيز',item.prep||'');
    if([deal,start,end,badge,prep].some(value=>value===null))return;
    try{
      await window.update(kind==='booklet'?'booklets':'products',{deal_price:deal?num(deal):null,deal_start:start||null,deal_end:end||null,badge:badge||null,prep_minutes:prep?num(prep):null},{id});
      await window.load();
      alert('تم حفظ بيانات العرض');
    }catch(error){alert(`تعذر الحفظ.\n${error.message||''}`)}
  }

  function decorateAdminRows(){
    if(!$('#adminContent'))return;
    for(const row of $$('#adminContent .row')){
      if(row.querySelector('[data-v99-merch]'))continue;
      const text=row.textContent;
      const item=canonicalItems().find(candidate=>text.includes(candidate.title));
      if(!item)continue;
      const button=document.createElement('button');
      button.type='button';button.dataset.v99Merch='1';button.textContent='إدارة العرض';
      button.onclick=()=>editMerch(item.kind,item.id);
      (row.querySelector('.row-actions')||row).appendChild(button);
    }
  }

  function handoff(id){
    const order=(window.db?.orders||[]).find(row=>String(row.id)===String(id));
    if(!order?.handoff_token)return;
    openModal(`<h2>رمز تسليم الطلب</h2><p>اعرض هذا الرمز للمكتبة. لا يؤكد التسليم وحده؛ التحقق يتم من النظام المصرّح.</p><div class="v99-print-token">${esc(order.handoff_token)}</div><button onclick="window.print()">طباعة الرمز</button>`);
  }

  function enhanceTracking(event){
    const box=$('#trackOrderResult');
    if(!box)return;
    const code=String(event.detail?.code||$('#trackOrderInput')?.value||'').trim();
    const order=(window.db?.orders||[]).find(row=>[row.id,row.order_number,row.tracking_code].map(String).includes(code));
    if(!order)return;
    const extras=[];
    if(order.ready_eta&&!String(box.textContent||'').includes('الجاهزية المتوقعة'))extras.push(`الجاهزية المتوقعة: ${esc(order.ready_eta)}`);
    if(order.handoff_token&&['ready','completed'].includes(order.status))extras.push(`<button data-v99-action="handoff" data-id="${esc(order.id)}">رمز الاستلام</button>`);
    if(extras.length)box.insertAdjacentHTML('beforeend',`<div class="v99-notice">${extras.join('<br>')}</div>`);
  }

  Object.assign(ctx,{saveGrade,reorder,renderStudentHub,groupOrder,groupWrite,safeTable,loadGrowthData,renderAdminGrowth,editMerch,decorateAdminRows,handoff,enhanceTracking});
  window.v99Reorder=reorder;
  window.v99EditMerch=editMerch;
})();
