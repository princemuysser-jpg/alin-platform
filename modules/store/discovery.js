// === store/discovery.js ===
// Storefront event routing and startup. Rendering lives in the dedicated discovery modules.
(()=>{
  'use strict';
  const ctx=window.AlinStoreDiscovery;
  if(!ctx)throw new Error('Store discovery modules are not loaded');
  const {$,$$,num,state,isDesktop,isMobile,findItem,closeModal}=ctx;
  let initialized=false;

  function setDesktopFilterDrawer(open,restore=true){
    if(!isDesktop())return;
    const root=$('#v99DiscoveryTools'),backdrop=$('.desktop-filter-backdrop'),trigger=$('[data-desktop-control="filter"]');
    if(!root)return;
    const wasOpen=root.classList.contains('open');
    if(open&&!wasOpen){root.dataset.previousHtmlOverflow=document.documentElement.style.overflow||'';document.documentElement.style.overflow='hidden'}
    else if(!open&&wasOpen){document.documentElement.style.overflow=root.dataset.previousHtmlOverflow||'';delete root.dataset.previousHtmlOverflow}
    root.classList.toggle('open',open);
    document.body.classList.toggle('v99-desktop-filter-open',open);
    trigger?.setAttribute('aria-expanded',String(open));
    if(backdrop)backdrop.hidden=!open;
    if(open)requestAnimationFrame(()=>root.querySelector('.v99-drawer-close')?.focus());else if(restore)trigger?.focus();
  }

  function setMobileFilterDrawer(open,restore=true){
    if(!isMobile())return;
    const root=$('#v99DiscoveryTools'),backdrop=$('.mobile-filter-backdrop'),trigger=$('[data-mobile-control="filter"]');
    if(!root)return;
    const wasOpen=root.classList.contains('open');
    if(open&&!wasOpen){root.dataset.previousHtmlOverflow=document.documentElement.style.overflow||'';document.documentElement.style.overflow='hidden'}
    else if(!open&&wasOpen){document.documentElement.style.overflow=root.dataset.previousHtmlOverflow||'';delete root.dataset.previousHtmlOverflow}
    root.classList.toggle('open',open);
    document.body.classList.toggle('v99-mobile-filter-open',open);
    trigger?.setAttribute('aria-expanded',String(open));
    if(backdrop)backdrop.hidden=!open;
    if(open)requestAnimationFrame(()=>root.querySelector('.v99-mobile-drawer-close')?.focus());else if(restore)trigger?.focus();
  }

  function resetFilters(){
    state.filters={kind:'',grade:'',subject:'',teacher:'',min:'',max:'',available:'',badge:'',sort:'recommended'};
    ctx.syncFilterControls();
    ctx.renderEffectiveStore();
  }

  function handleAction(button){
    const action=button.dataset.v99Action;
    const item=findItem(button.dataset.kind,button.dataset.id);
    if(action==='close')closeModal();
    else if(action==='desktopFavorites'||action==='mobileFavorites')window.v99ShowFavorites?.();
    else if(action==='toggleFilters'){
      const root=$('#v99DiscoveryTools'),open=root?.classList.toggle('open');
      button.setAttribute('aria-expanded',String(!!open));
      const mark=button.querySelector('.v99-toggle-mark');
      if(mark)mark.textContent=open?'−':'+';
    }
    else if(action==='removeFilter'){
      state.filters[button.dataset.filterKey]=button.dataset.filterKey==='sort'?'recommended':'';
      ctx.syncFilterControls();ctx.renderEffectiveStore();
    }
    else if(action==='clearFilters')resetFilters();
    else if(action==='details'&&item)window.v99OpenDetails?.(item.kind,item.id);
    else if(action==='favorite'&&item)window.v99ToggleFavorite?.(item.kind,item.id);
    else if(action==='cart'&&item){if(item.stock!==null&&item.stock<=0)ctx.stockForm(item);else window.addToCart?.(item.kind,item.id)}
    else if(action==='cartQty'&&item){const quantity=Math.max(1,num($('#v99DetailQty')?.value));for(let index=0;index<quantity;index++)window.addToCart?.(item.kind,item.id);ctx.updateDesktopHeader();ctx.updateMobileHeader();window.toast?.('أضيفت الكمية إلى السلة')}
    else if(action==='buy'&&item){const quantity=Math.max(1,num($('#v99DetailQty')?.value));for(let index=0;index<quantity;index++)window.addToCart?.(item.kind,item.id);ctx.updateDesktopHeader();ctx.updateMobileHeader();closeModal(false);window.openCart?.()}
    else if(action==='share'&&item)ctx.shareItem(item);
    else if(action==='stockForm'&&item)ctx.stockForm(item);
    else if(action==='stockSubmit'&&item)ctx.stockSubmit(item);
    else if(action==='reviewForm'&&item)ctx.reviewForm(item);
    else if(action==='reviewSubmit'&&item)ctx.reviewSubmit(item);
    else if(action==='teacher'&&!isDesktop())ctx.teacherModal(button.dataset.id);
    else if(action==='bundle')ctx.bundleModal(button.dataset.id);
    else if(action==='bundleAdd'){ctx.addBundle(button.dataset.id);closeModal()}
    else if(action==='reorder')ctx.reorder(button.dataset.id);
    else if(action==='groupOrder'&&!isDesktop())ctx.groupOrder();
    else if(action==='groupCreate'&&!isDesktop())ctx.groupWrite('create');
    else if(action==='groupJoin'&&!isDesktop())ctx.groupWrite('join');
    else if(action==='handoff')ctx.handoff(button.dataset.id);
  }

  function trapFocus(event,root){
    if(event.key!=='Tab')return;
    const focusable=[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
    if(!focusable.length){event.preventDefault();root.focus();return}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }

  function selectCategory(category,clear=false){
    if(clear){state.filters.kind='';state.filters.badge=''}
    else if(category==='deal'){state.filters.kind='';state.filters.badge='deal'}
    else{state.filters.kind=category;state.filters.badge=''}
    ctx.syncFilterControls();
    ctx.renderEffectiveStore();
  }

  function installEventRouting(){
    document.addEventListener('click',event=>{
      if(event.target.classList.contains('v99-modal')){closeModal();return}
      const button=event.target.closest('[data-v99-action]');
      if(button)handleAction(button);
    });

    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&isDesktop()&&$('#v99DiscoveryTools')?.classList.contains('open')){setDesktopFilterDrawer(false);return}
      if(event.key==='Escape'&&isDesktop()&&!$('#studentAuthModal')?.classList.contains('hidden')){window.closeStudentAuth?.();return}
      const dialog=$('.v99-modal [role="dialog"]');
      if(!dialog)return;
      if(event.key==='Escape'){event.preventDefault();closeModal();return}
      trapFocus(event,dialog);
    });

    document.addEventListener('change',event=>{
      if(event.target.matches('[data-filter]')){state.filters[event.target.dataset.filter]=event.target.value;ctx.renderEffectiveStore()}
      if(event.target.id==='v99GradeSelect')ctx.saveGrade(event.target.value);
    });

    document.addEventListener('click',event=>{
      if(!isDesktop())return;
      const button=event.target.closest('[data-v99-action]');
      if(!button)return;
      const action=button.dataset.v99Action;
      if(!['desktopFavorites','browseProducts','closeDesktopFilters','toggleFilters'].includes(action))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(action==='desktopFavorites')window.v99ShowFavorites?.();
      else if(action==='browseProducts'){closeModal();$('#storeGrid')?.scrollIntoView({behavior:'smooth'})}
      else if(action==='closeDesktopFilters')setDesktopFilterDrawer(false);
      else setDesktopFilterDrawer(!$('#v99DiscoveryTools')?.classList.contains('open'));
    },true);

    document.addEventListener('click',event=>{
      if(!isDesktop())return;
      const category=event.target.closest('[data-v99-category]');
      const clear=event.target.closest('[data-v99-action="clearDesktopCategory"]');
      if(!category&&!clear)return;
      event.preventDefault();event.stopImmediatePropagation();
      selectCategory(category?.dataset.v99Category,!!clear);
      const heading=$('#v99CatalogHeading');
      heading?.scrollIntoView({behavior:'smooth',block:'start'});requestAnimationFrame(()=>heading?.focus());
    },true);

    document.addEventListener('keydown',event=>{
      if(!isDesktop()||!$('#v99DiscoveryTools')?.classList.contains('open'))return;
      const root=$('#v99DiscoveryTools');
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setDesktopFilterDrawer(false);return}
      trapFocus(event,root);
    },true);

    document.addEventListener('click',event=>{
      if(!isMobile())return;
      const actionButton=event.target.closest('[data-v99-action]');
      const category=event.target.closest('[data-v99-category]');
      if(!actionButton&&!category)return;
      const action=actionButton?.dataset.v99Action;
      if(!category&&!['mobileFavorites','browseProducts','toggleMobileFilters','closeMobileFilters','clearMobileCategory'].includes(action))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(action==='mobileFavorites')window.v99ShowFavorites?.();
      else if(action==='browseProducts'){closeModal();$('#storeGrid')?.scrollIntoView({behavior:'smooth'})}
      else if(action==='toggleMobileFilters')setMobileFilterDrawer(!$('#v99DiscoveryTools')?.classList.contains('open'));
      else if(action==='closeMobileFilters')setMobileFilterDrawer(false);
      else{
        selectCategory(category?.dataset.v99Category,action==='clearMobileCategory');
        const heading=$('#v99MobileCatalogHeading');
        heading?.scrollIntoView({behavior:'smooth',block:'start'});requestAnimationFrame(()=>heading?.focus());
      }
    },true);

    document.addEventListener('keydown',event=>{
      if(!isMobile()||!$('#v99DiscoveryTools')?.classList.contains('open'))return;
      const root=$('#v99DiscoveryTools');
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setMobileFilterDrawer(false);return}
      trapFocus(event,root);
    },true);
  }

  function installIntegrationEvents(){
    window.addEventListener('alin:data-refreshed',()=>{ctx.renderStoreStats();ctx.renderStore()});
    window.addEventListener('alin:cloud-mutation',event=>{if(['booklets','products','accounts','orders'].includes(String(event.detail?.table||'')))ctx.renderStoreStats()});
    document.addEventListener('alin:cart-changed',()=>{ctx.updateDesktopHeader();ctx.updateMobileHeader()});
    document.addEventListener('alin:cart-rendered',()=>{
      const close=$('#checkoutModal .x');
      if(close){close.textContent='إغلاق';close.setAttribute('aria-label','إغلاق السلة');close.classList.add(isMobile()?'mobile-cart-close':'desktop-cart-close')}
      ctx.updateDesktopHeader();ctx.updateMobileHeader();
    });
    document.addEventListener('alin:cart-closed',()=>{
      const close=$('#checkoutModal .x');
      if(close){close.textContent='×';close.setAttribute('aria-label','إغلاق');close.classList.remove('desktop-cart-close','mobile-cart-close')}
    });
    document.addEventListener('alin:order-created',event=>{
      const items=Array.isArray(event.detail?.items)?event.detail.items:[];
      if(items.length)localStorage.setItem('alin_v99_last_successful_cart',JSON.stringify({at:new Date().toISOString(),items}));
      ctx.renderStudentHub();
    });
    document.addEventListener('alin:tracking-rendered',ctx.enhanceTracking);
  }

  function init(){
    if(initialized)return;
    initialized=true;
    installEventRouting();
    installIntegrationEvents();
    if(window.ALIN_CONFIG?.authEnabled!==true&&(isDesktop()||isMobile())&&typeof window.openPage==='function')window.openPage('store');
    ctx.renderFilters();
    ctx.renderStage();
    ctx.renderStore();
    ctx.updateDesktopHeader();
    ctx.updateMobileHeader();
    ctx.loadGrowthData();
    if(!state.timer)state.timer=setInterval(ctx.updateCountdowns,1000);
    const item=new URLSearchParams(location.search).get('item')||location.hash.replace(/^#item=/,'');
    if(item){const [kind,...id]=decodeURIComponent(item).split(':');setTimeout(()=>window.v99OpenDetails?.(kind,id.join(':')),500)}
  }

  Object.assign(ctx,{setDesktopFilterDrawer,setMobileFilterDrawer,init});
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
