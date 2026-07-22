// === store/discovery-catalog.js ===
// Store catalog rendering, filters, categories, rails and public statistics.
(()=>{
  'use strict';
  const ctx=window.AlinStoreDiscovery;
  if(!ctx)throw new Error('AlinStoreDiscovery core must load before catalog');
  const {$,$$,esc,num,fmt,imageUrl,state,canonicalItems,activeDeal,effectivePrice,badges,isFavorite,statusVisible,isDesktop,isMobile,studentProfile,updateDesktopHeader,updateMobileHeader}=ctx;

  function card(item){
    const out=item.stock!==null&&item.stock<=0;
    const price=effectivePrice(item);
    return `<article class="v99-product-card" data-v99-item="${esc(ctx.stableKey(item.kind,item.id))}">
      <button class="v99-fav" type="button" data-v99-action="favorite" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}" aria-label="المفضلة">${isFavorite(item)?'♥':'♡'}</button>
      <button class="v99-product-media" type="button" data-v99-action="details" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}" aria-label="عرض تفاصيل ${esc(item.title)}">${item.image?`<img src="${esc(imageUrl(item.image))}" alt="" loading="lazy">`:'<span class="v99-placeholder" aria-hidden="true">آ</span>'}</button>
      <div class="v99-product-body"><div class="v99-badges">${badges(item).map(label=>`<span class="v99-badge ${label==='كمية محدودة'?'stock':''}">${esc(label)}</span>`).join('')}</div>
        <h3><button class="v99-title-button" type="button" data-v99-action="details" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">${esc(item.title)}</button></h3>
        <p>${esc([item.teacher,item.subject,item.grade].filter(Boolean).join(' • '))}</p>
        <div class="v99-card-meta"><span class="v99-stock ${out?'out':''}">${item.stock===null?'متاح':out?'نافد':`متوفر: ${fmt(item.stock)}`}</span><span>${item.prep?`تجهيز ${fmt(item.prep)} د`:'تجهيز حسب المكتبة'}</span></div>
        <div class="v99-card-price">${fmt(price)} د.ع ${activeDeal(item)?`<del>${fmt(item.price)}</del>`:''}</div>
        <div class="v99-actions"><button class="${out?'v99-alert-action':''}" data-v99-action="cart" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">${out?'أبلغني':'أضف للسلة'}</button><button class="v99-secondary" data-v99-action="details" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">التفاصيل</button></div>
      </div></article>`;
  }

  function matches(item){
    const filters=state.filters;
    const query=String($('#searchInput')?.value||'').trim().toLowerCase();
    const haystack=[item.title,item.teacher,item.subject,item.grade,item.category].join(' ').toLowerCase();
    return (!query||haystack.includes(query))
      &&(!filters.kind||item.kind===filters.kind||item.category===filters.kind)
      &&(!filters.grade||item.grade===filters.grade)
      &&(!filters.subject||item.subject===filters.subject)
      &&(!filters.teacher||String(item.teacherId)===filters.teacher)
      &&(!filters.min||effectivePrice(item)>=num(filters.min))
      &&(!filters.max||effectivePrice(item)<=num(filters.max))
      &&(!filters.available||(filters.available==='yes'?(item.stock===null||item.stock>0):item.stock===0))
      &&(!filters.badge||(filters.badge==='deal'?activeDeal(item):badges(item).includes(filters.badge)));
  }

  function sorted(rows){
    const mode=state.filters.sort;
    return rows.sort((a,b)=>mode==='newest'?String(b.created).localeCompare(String(a.created))
      :mode==='best'?b.sold-a.sold
      :mode==='priceAsc'?effectivePrice(a)-effectivePrice(b)
      :mode==='priceDesc'?effectivePrice(b)-effectivePrice(a)
      :(Number(activeDeal(b))-Number(activeDeal(a)))||(b.sold-a.sold));
  }

  function options(rows,key,label,value=item=>item[key]){
    const values=[...new Map(rows.map(item=>[String(value(item)||''),String(value(item)||'')])).values()].filter(Boolean).sort();
    return `<option value="">${label}</option>${values.map(item=>`<option value="${esc(item)}">${esc(item)}</option>`).join('')}`;
  }

  function renderFilters(){
    const root=$('#v99DiscoveryTools');
    if(!root)return;
    const rows=canonicalItems();
    const teachers=(window.db?.accounts?.teachers||[]).filter(row=>row.status==='active'||!row.status);
    const desktop=isDesktop(),mobile=isMobile();
    if(desktop||mobile){root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('tabindex','-1')}
    if(desktop)root.setAttribute('aria-labelledby','v99FilterDrawerTitle');
    if(mobile)root.setAttribute('aria-labelledby','v99MobileFilterDrawerTitle');
    const drawerHead=desktop
      ?'<div class="v99-drawer-head"><h2 id="v99FilterDrawerTitle">فلترة المنتجات</h2><button type="button" class="v99-drawer-close" data-v99-action="closeDesktopFilters" aria-label="إغلاق لوحة الفلاتر">×</button></div>'
      :mobile
        ?'<div class="v99-mobile-drawer-head"><h2 id="v99MobileFilterDrawerTitle">فلترة المنتجات</h2><button type="button" class="v99-mobile-drawer-close" data-v99-action="closeMobileFilters" aria-label="إغلاق لوحة الفلاتر">×</button></div>'
        :'<button class="v99-filter-toggle" type="button" data-v99-action="toggleFilters" aria-expanded="false"><span>تصفية وفرز المنتجات</span><span class="v99-toggle-mark" aria-hidden="true">+</span></button>';
    root.innerHTML=`${drawerHead}<div id="v99ActiveFilters" class="v99-active-filters" aria-live="polite"></div><div class="v99-filters" aria-label="عوامل التصفية">
      <label><span>النوع أو القسم</span><select data-filter="kind">${options(rows,'kind','الكل',item=>item.kind)}</select></label>
      <label><span>المرحلة الدراسية</span><select data-filter="grade">${options(rows,'grade','كل المراحل')}</select></label>
      <label><span>المادة</span><select data-filter="subject">${options(rows,'subject','كل المواد')}</select></label>
      <label><span>المدرس</span><select data-filter="teacher"><option value="">كل المدرسين</option>${teachers.map(teacher=>`<option value="${esc(teacher.id)}">${esc(teacher.name)}</option>`).join('')}</select></label>
      <fieldset class="v99-price-range"><legend>نطاق السعر</legend><label><span>من</span><input data-filter="min" type="number" min="0" inputmode="numeric" placeholder="0"></label><label><span>إلى</span><input data-filter="max" type="number" min="0" inputmode="numeric" placeholder="بدون حد"></label></fieldset>
      <label><span>حالة التوفر</span><select data-filter="available"><option value="">الكل</option><option value="yes">متوفر</option><option value="no">نافد</option></select></label>
      <label><span>الشارة أو العرض</span><select data-filter="badge"><option value="">الكل</option><option value="deal">عرض اليوم</option><option>جديد</option><option>الأكثر طلباً</option><option>كمية محدودة</option></select></label>
      <label class="v99-sort-control"><span>ترتيب النتائج</span><select data-filter="sort"><option value="recommended">الموصى بها</option><option value="newest">الأحدث</option><option value="best">الأكثر مبيعاً</option><option value="priceAsc">السعر: الأقل</option><option value="priceDesc">السعر: الأعلى</option></select></label>
      </div><div class="v99-filter-actions"><span class="v99-filter-summary" id="v99FilterSummary"></span><button type="button" class="v99-secondary" data-v99-action="clearFilters">مسح الكل</button></div>`;
    syncFilterControls();
    renderFilterChips();
  }

  function syncFilterControls(){
    $$('[data-filter]').forEach(element=>{element.value=state.filters[element.dataset.filter]||''});
  }

  function renderFilterChips(){
    const root=$('#v99ActiveFilters');
    const activeRows=Object.entries(state.filters).filter(([key,value])=>value&&!(key==='sort'&&value==='recommended'));
    if(root){
      const labels={kind:'النوع',grade:'المرحلة',subject:'المادة',teacher:'المدرس',min:'من',max:'إلى',available:'التوفر',badge:'العرض',sort:'الترتيب'};
      const visible=(key,value)=>{
        if(key==='min'||key==='max')return `${fmt(value)} د.ع`;
        const control=$(`[data-filter="${key}"]`);
        const option=[...(control?.options||[])].find(row=>row.value===String(value));
        return option?.textContent?.trim()||String(value);
      };
      root.innerHTML=activeRows.map(([key,value])=>`<button type="button" data-v99-action="removeFilter" data-filter-key="${esc(key)}" aria-label="إزالة فلتر ${esc(labels[key])}">${esc(labels[key])}: ${esc(visible(key,value))} <span aria-hidden="true">×</span></button>`).join('');
      root.hidden=!activeRows.length;
    }
    for(const id of ['v99DesktopFilterCount','v99MobileFilterCount']){
      const count=$(`#${id}`);
      if(count){count.textContent=fmt(activeRows.length);count.hidden=!activeRows.length}
    }
  }

  function miniCard(item){
    return `<article class="v99-mini-card"><div class="v99-mini-media">${item.image?`<img src="${esc(imageUrl(item.image))}" alt="">`:'<span class="v99-placeholder">آ</span>'}</div><div class="v99-mini-body"><div class="v99-badges">${badges(item).slice(0,2).map(label=>`<span class="v99-badge">${esc(label)}</span>`).join('')}</div><h3>${esc(item.title)}</h3><p>${esc([item.teacher,item.subject,item.grade].filter(Boolean).join(' • '))}</p><div class="v99-card-price">${fmt(effectivePrice(item))} د.ع</div><button data-v99-action="details" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">عرض</button></div></article>`;
  }

  function rail(rootSelector,title,subtitle,rows){
    const root=$(rootSelector);
    if(!root)return;
    if(!rows.length){root.innerHTML='';return}
    root.innerHTML=`<div class="v99-section-head"><div><h2>${esc(title)}</h2><small>${esc(subtitle)}</small></div></div><div class="v99-rail">${rows.map(miniCard).join('')}</div>`;
  }

  function renderStage(){
    const root=$('#v99Personalized');
    if(!root)return;
    if(isMobile()){root.replaceChildren();root.hidden=true;return}
    root.hidden=false;
    const profile=studentProfile();
    const grades=[...new Set(canonicalItems().map(item=>item.grade).filter(Boolean))];
    root.innerHTML=`<div class="v99-stage-strip"><div><h2>مواد تناسب مرحلتك</h2><p>${profile.grade?`نعرض لك اختيارات ${esc(profile.grade)} أولاً.`:'اختر مرحلتك لتحصل على اقتراحات أقرب لدراستك.'}</p></div><select id="v99GradeSelect" aria-label="المرحلة الدراسية"><option value="">كل المراحل</option>${grades.map(grade=>`<option ${grade===profile.grade?'selected':''}>${esc(grade)}</option>`).join('')}</select></div><div id="v99PersonalizedItems" class="v99-rail-root"></div>`;
  }

  function updateCountdowns(){
    $$('[data-deal-end]').forEach(element=>{
      const end=Date.parse(element.dataset.dealEnd);
      if(!end){element.textContent='لفترة محدودة';return}
      const remaining=Math.max(0,end-ctx.now());
      const hours=Math.floor(remaining/36e5),minutes=Math.floor((remaining%36e5)/6e4),seconds=Math.floor((remaining%6e4)/1000);
      element.textContent=remaining?`ينتهي خلال ${fmt(hours)}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`:'انتهى العرض';
    });
  }

  function renderDeal(){
    const root=$('#v99DailyDeals');
    if(!root)return;
    const item=canonicalItems().filter(activeDeal).sort((a,b)=>(b.price-b.dealPrice)-(a.price-a.dealPrice))[0];
    if(!item){root.innerHTML='';return}
    root.innerHTML=`<article class="v99-deal-feature"><div class="v99-deal-media">${item.image?`<img src="${esc(imageUrl(item.image))}" alt="${esc(item.title)}">`:'<span class="v99-placeholder">ALIN</span>'}</div><div class="v99-deal-copy"><span class="v99-kicker">عرض اليوم</span><h2>${esc(item.title)}</h2><p>${esc([item.teacher,item.subject,item.grade].filter(Boolean).join(' • '))}</p><div class="v99-price">${fmt(item.dealPrice)} د.ع <del>${fmt(item.price)}</del></div><div class="v99-countdown" data-deal-end="${esc(item.dealEnd||'')}"></div><div class="v99-actions"><button data-v99-action="cart" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">أضف للسلة</button><button class="v99-secondary" data-v99-action="share" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">مشاركة</button></div></div></article>`;
    updateCountdowns();
  }

  function publicTeachers(){
    return (window.db?.accounts?.teachers||[]).filter(teacher=>teacher.public_profile===false?false:(teacher.status==='active'||teacher.status==='approved'||!teacher.status));
  }

  function renderTeachers(){
    const root=$('#v99TeacherRail'),rows=publicTeachers();
    if(!root)return;
    if(isDesktop()||isMobile()){root.innerHTML='';root.hidden=true;return}
    if(!rows.length){root.innerHTML='';return}
    root.innerHTML=`<div class="v99-section-head"><div><h2>مدرسون مميزون</h2><small>تعرّف على المدرس وملزماته</small></div></div><div class="v99-rail">${rows.slice(0,10).map(teacher=>`<article class="v99-teacher-card" data-v99-action="teacher" data-id="${esc(teacher.id)}"><span class="v99-avatar">${teacher.avatar_path||teacher.image_path?`<img src="${esc(imageUrl(teacher.avatar_path||teacher.image_path))}" alt="">`:esc((teacher.name||'آ').slice(0,1))}</span><span><b>${esc(teacher.name)}</b><small>${esc(teacher.specialty||teacher.subject||'مدرس معتمد')}</small></span></article>`).join('')}</div>`;
  }

  function renderBundles(){
    const root=$('#v99Bundles');
    if(!root)return;
    const bundles=state.tables.bundles||[],items=state.tables.bundle_items||[];
    const active=bundles.filter(bundle=>bundle.active!==false&&statusVisible(bundle.status));
    if(!active.length){root.innerHTML='';return}
    root.innerHTML=`<div class="v99-section-head"><div><h2>حزم أوفر</h2><small>مجموعة مواد بسعر واحد</small></div></div><div class="v99-rail">${active.map(bundle=>{const count=items.filter(item=>String(item.bundle_id)===String(bundle.id)).length;return `<article class="v99-mini-card"><div class="v99-mini-body"><span class="v99-kicker">حزمة ${fmt(count)} مواد</span><h3>${esc(bundle.name||bundle.title)}</h3><p>${esc(bundle.description||'اختيار متكامل بسعر مخفّض')}</p><div class="v99-card-price">${fmt(bundle.bundle_price||bundle.price)} د.ع</div><button data-v99-action="bundle" data-id="${esc(bundle.id)}">عرض الحزمة</button></div></article>`}).join('')}</div>`;
  }

  function renderRails(){
    const rows=canonicalItems(),grade=studentProfile().grade;
    let newest=rows;
    if(isDesktop()||isMobile()){
      if(state.filters.badge==='deal')newest=newest.filter(activeDeal);
      else if(state.filters.kind)newest=newest.filter(item=>item.kind===state.filters.kind);
    }
    rail('#v99NewArrivals','وصل حديثاً','أحدث المواد المضافة',newest.filter(item=>item.created).sort((a,b)=>String(b.created).localeCompare(String(a.created))).slice(0,8));
    const bestBase=isDesktop()||isMobile()?rows.filter(item=>item.kind==='stationery'||item.kind==='gift'):rows;
    rail('#v99BestSellers','الأكثر طلباً','اختيارات الطلاب الأكثر رواجاً',[...bestBase].sort((a,b)=>b.sold-a.sold).filter(item=>item.sold>0).slice(0,8));
    renderTeachers();
    renderBundles();
    if(grade)rail('#v99PersonalizedItems','حسب مرحلتي','',rows.filter(item=>item.grade===grade).slice(0,8));
  }

  function visibleAccount(row){
    if(!row||row.deleted_at)return false;
    return !['inactive','disabled','suspended','rejected','deleted','archived'].includes(String(row.status||'active').trim().toLowerCase());
  }
  function uniqueVisibleCount(rows){
    const seen=new Set();
    for(const row of rows||[]){
      if(!visibleAccount(row))continue;
      const key=String(row.id||row.auth_user_id||row.username||row.phone||row.name||'').trim();
      if(key)seen.add(key);
    }
    return seen.size;
  }
  function renderStoreStats(){
    const booklets=(window.db?.booklets||[]).filter(row=>statusVisible(row.status)&&!row.deleted_at).length;
    const teachers=uniqueVisibleCount(window.db?.accounts?.teachers||[]);
    const libraries=uniqueVisibleCount(window.db?.accounts?.libraries||[]);
    const values={alinStatBooklets:booklets,alinStatTeachers:teachers,alinStatLibraries:libraries};
    for(const [id,value] of Object.entries(values)){const node=document.getElementById(id);if(node)node.textContent=fmt(value)}
    return values;
  }

  function syncCategoryUI(prefix){
    const active=state.filters.badge==='deal'?'deal':state.filters.kind||'';
    const labels={booklet:['الملازم','كل الملازم المتاحة'],stationery:['القرطاسية','منتجات القرطاسية'],gift:['الهدايا','هدايا مختارة'],deal:['العروض','العروض الفعالة الآن']};
    const copy=labels[active]||['كل المنتجات','الكتالوج الكامل'];
    $$('[data-v99-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.v99Category===active)));
    const title=$(`#${prefix}CatalogTitle`),kicker=$(`#${prefix}CatalogKicker`);
    if(title)title.textContent=copy[0];
    if(kicker)kicker.textContent=copy[1];
  }
  const syncDesktopCategoryUI=()=>{if(isDesktop())syncCategoryUI('v99')};
  const syncMobileCategoryUI=()=>{if(isMobile())syncCategoryUI('v99Mobile')};

  function renderEffectiveStore(){
    const grid=$('#storeGrid');
    if(!grid)return [];
    const rows=sorted(canonicalItems().filter(matches));
    grid.innerHTML=rows.map(card).join('')||'<div class="v99-empty"><b>لا توجد نتائج مطابقة</b><p>غيّر عوامل التصفية أو امسحها للعودة إلى جميع المواد.</p></div>';
    const summary=$('#v99FilterSummary');
    if(summary)summary.textContent=`${fmt(rows.length)} نتيجة`;
    renderFilterChips();
    syncDesktopCategoryUI();
    syncMobileCategoryUI();
    renderDeal();
    renderRails();
    updateDesktopHeader();
    updateMobileHeader();
    renderStoreStats();
    document.dispatchEvent(new CustomEvent('alin:store-rendered',{detail:{count:rows.length,source:'store-discovery'}}));
    return rows;
  }

  function normalizedStoreType(type){
    const value=String(type||'').trim().toLowerCase();
    if(['gift','gifts'].includes(value))return 'gift';
    if(['stationery','stationary'].includes(value))return 'stationery';
    if(['booklet','booklets'].includes(value))return 'booklet';
    return value;
  }
  function currentStoreItems(){
    const type=normalizedStoreType(window.db?.settings?.storeType||'');
    const rows=canonicalItems();
    if(!type)return rows;
    return rows.filter(item=>normalizedStoreType(item.kind)===type||normalizedStoreType(item.category)===type);
  }
  function renderStore(){
    const signature=`${(window.db?.booklets||[]).length}:${(window.db?.products||[]).length}:${(window.db?.accounts?.teachers||[]).length}`;
    if(state.catalogSignature!==signature){state.catalogSignature=signature;renderFilters();renderStage()}
    ctx.renderStudentHub?.();
    return renderEffectiveStore();
  }
  function setStoreType(type,button){
    const value=normalizedStoreType(type)||'booklet';
    window.db.settings=window.db.settings||{};
    window.db.settings.storeType=value;
    state.filters.kind=value;
    state.filters.badge='';
    if(button){document.querySelectorAll('[data-v99-category],.store-nav button').forEach(node=>node.classList.remove('active'));button.classList.add('active')}
    syncFilterControls();
    return renderStore();
  }

  Object.assign(ctx,{card,matches,sorted,renderFilters,syncFilterControls,renderFilterChips,miniCard,rail,renderStage,renderDeal,renderRails,renderStoreStats,syncDesktopCategoryUI,syncMobileCategoryUI,renderEffectiveStore,normalizedStoreType,currentStoreItems,renderStore,setStoreType,publicTeachers,renderTeachers,renderBundles,updateCountdowns});
  window.storeItems=currentStoreItems;
  window.renderStore=renderStore;
  window.setStoreType=setStoreType;
  window.AlinStorefront=Object.freeze({render:renderStore,items:canonicalItems,currentItems:currentStoreItems,setType:setStoreType,stats:renderStoreStats,openDetails:(kind,id)=>window.v99OpenDetails?.(kind,id)});
})();
