// === store/discovery-core.js ===
// Shared storefront state, data normalization, modal, favorites and header counters.
(()=>{
  'use strict';
  if(window.AlinStoreDiscovery)return;

  const FAV_KEY='alin_v99_favorites';
  const state={
    filters:{kind:'',grade:'',subject:'',teacher:'',min:'',max:'',available:'',badge:'',sort:'recommended'},
    tables:{},schema:{},timer:null,modalReturnFocus:null,catalogSignature:''
  };
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num=value=>Number(value)||0;
  const fmt=value=>new Intl.NumberFormat(window.AlinI18n?.locale?.()||'ar-IQ').format(num(value));
  const now=()=>Date.now();
  const imageUrl=path=>{try{return path?(typeof mediaUrl==='function'?mediaUrl(path):path):''}catch(_){return path||''}};
  const teacherBy=id=>(window.db?.accounts?.teachers||[]).find(row=>String(row.id)===String(id));
  const statusVisible=status=>!['hidden','inactive','deleted','archived','draft'].includes(String(status||'published'));
  const hasSb=()=>typeof window.sb!=='undefined'&&!!window.sb;
  const isDesktop=()=>document.body.classList.contains('store-desktop');
  const isMobile=()=>document.body.classList.contains('store-mobile');
  const stableKey=(kind,id)=>`${kind}:${id}`;

  function orderCounts(){
    const counts={};
    for(const order of window.db?.orders||[]){
      const key=`${order.kind}:${order.item_id}`;
      counts[key]=(counts[key]||0)+num(order.qty||1);
    }
    return counts;
  }

  function canonicalItems(){
    const counts=orderCounts();
    const booklets=(window.db?.booklets||[]).filter(row=>statusVisible(row.status)).map(row=>{
      const teacher=teacherBy(row.teacher_id)||{};
      return {
        kind:'booklet',id:String(row.id),raw:row,title:row.title||'ملزمة',teacher:teacher.name||'',teacherId:row.teacher_id||'',
        subject:row.subject||'',grade:row.grade||'',category:'ملازم',price:num(row.price),originalPrice:num(row.original_price),
        stock:row.stock==null?null:num(row.stock),image:row.cover_path||row.image_path||'',cover:row.cover_path||row.image_path||'',
        created:row.created_at||'',sold:num(row.sales_count)||counts[`booklet:${row.id}`]||0,badge:row.badge||'',prep:num(row.prep_minutes),
        dealPrice:num(row.deal_price),dealStart:row.deal_start,dealEnd:row.deal_end,description:row.description||'',status:row.status
      };
    });
    const products=(window.db?.products||[]).filter(row=>statusVisible(row.status)).map(row=>({
      kind:row.type||'product',id:String(row.id),raw:row,title:row.name||row.title||'منتج',teacher:row.teacher||'',teacherId:row.teacher_id||'',
      subject:row.subject||row.category||'',grade:row.grade||'',category:row.category||row.type||'',price:num(row.price),originalPrice:num(row.original_price),
      stock:row.stock==null?null:num(row.stock),image:row.image_path||row.cover_path||'',cover:row.image_path||row.cover_path||'',created:row.created_at||'',
      sold:num(row.sales_count)||counts[`${row.type||'product'}:${row.id}`]||counts[`product:${row.id}`]||0,badge:row.badge||'',prep:num(row.prep_minutes),
      dealPrice:num(row.deal_price),dealStart:row.deal_start,dealEnd:row.deal_end,description:row.description||'',status:row.status
    }));
    return [...booklets,...products];
  }

  function activeDeal(item){
    const time=now();
    const start=item.dealStart?Date.parse(item.dealStart):0;
    const end=item.dealEnd?Date.parse(item.dealEnd):0;
    return item.dealPrice>0&&item.dealPrice<item.price&&(!start||start<=time)&&(!end||end>=time);
  }
  const effectivePrice=item=>activeDeal(item)?item.dealPrice:item.price;
  const badges=item=>[
    item.badge,activeDeal(item)?'عرض اليوم':'',item.sold>=5?'الأكثر طلباً':'',
    item.created&&Date.now()-Date.parse(item.created)<30*864e5?'جديد':'',
    item.stock!==null&&item.stock>0&&item.stock<=5?'كمية محدودة':''
  ].filter(Boolean);

  function findItem(kind,id){
    const rows=canonicalItems();
    return rows.find(item=>item.kind===kind&&item.id===String(id))||rows.find(item=>item.id===String(id));
  }

  function favoriteKeys(){
    let rows=[];
    for(const key of [FAV_KEY,'alin_v98_favorites','alin_v85_favorites','ALIN_FAVORITES']){
      try{
        const parsed=JSON.parse(localStorage.getItem(key)||'[]');
        if(Array.isArray(parsed))rows.push(...parsed.map(value=>typeof value==='string'?value:stableKey(value.kind,value.id)));
      }catch(_){/* ignore malformed legacy storage */}
    }
    rows=[...new Set(rows.map(String).filter(Boolean))];
    localStorage.setItem(FAV_KEY,JSON.stringify(rows));
    try{localStorage.setItem('alin_v98_favorites',JSON.stringify(rows))}catch(_){/* ignore */}
    return rows;
  }
  const favoriteItems=()=>favoriteKeys().map(key=>{const [kind,...id]=key.split(':');return findItem(kind,id.join(':'))}).filter(Boolean);
  const isFavorite=item=>favoriteKeys().includes(stableKey(item.kind,item.id));

  function closeModal(restore=true){
    const modal=$('.v99-modal');
    if(!modal)return;
    modal.remove();
    document.body.classList.remove('v99-modal-open');
    if(restore&&state.modalReturnFocus?.isConnected)state.modalReturnFocus.focus();
    state.modalReturnFocus=null;
  }
  function openModal(html){
    const existing=$('.v99-modal');
    if(!existing)state.modalReturnFocus=document.activeElement;else existing.remove();
    const modal=document.createElement('div');
    modal.className='v99-modal';
    modal.setAttribute('role','presentation');
    modal.innerHTML=`<div class="v99-modal-card" role="dialog" aria-modal="true" tabindex="-1"><button class="v99-close" type="button" data-v99-action="close" aria-label="إغلاق النافذة">×</button>${html}</div>`;
    const title=modal.querySelector('h2');
    const dialog=modal.querySelector('[role="dialog"]');
    if(title){title.id='v99DialogTitle';dialog?.setAttribute('aria-labelledby','v99DialogTitle')}else dialog?.setAttribute('aria-label','نافذة متجر آلين');
    document.body.appendChild(modal);
    document.body.classList.add('v99-modal-open');
    requestAnimationFrame(()=>dialog?.focus());
    return modal;
  }

  function studentProfile(){
    try{return JSON.parse(localStorage.getItem('alin_v99_student_profile')||'{}')}catch(_){return{}}
  }

  function updateDesktopHeader(){
    if(!isDesktop())return;
    const favoriteCount=favoriteItems().length;
    const favoriteBadge=$('#v99DesktopFavoriteCount');
    if(favoriteBadge){favoriteBadge.textContent=fmt(favoriteCount);favoriteBadge.hidden=!favoriteCount}
    const cartCount=Array.isArray(window.cart)?window.cart.reduce((sum,item)=>sum+Math.max(1,num(item.qty)),0):0;
    const cartBadge=$('#desktopCartCount');
    if(cartBadge){cartBadge.textContent=fmt(cartCount);cartBadge.hidden=!cartCount}
    let student=null;
    try{student=typeof window.currentStudent==='function'?window.currentStudent():null}catch(_){/* ignore */}
    const button=$('#studentAuthBtn'),status=$('#studentAuthStatus');
    if(button)button.innerHTML=`<span class="desktop-account-icon" aria-hidden="true"></span><small>${esc(student?.name||'تسجيل الدخول')}</small>`;
    if(status)status.textContent=student?`مرحباً ${student.name}`:'التسجيل اختياري';
  }

  function updateMobileHeader(){
    if(!isMobile())return;
    const favoriteCount=favoriteItems().length;
    const favoriteBadge=$('#mobileFavoriteCount');
    if(favoriteBadge){favoriteBadge.textContent=fmt(favoriteCount);favoriteBadge.hidden=!favoriteCount}
    const cartCount=Array.isArray(window.cart)?window.cart.reduce((sum,item)=>sum+Math.max(1,num(item.qty)),0):0;
    const cartBadge=$('#mobileBottomCartCount')||$('#mobileCartCount');
    if(cartBadge){cartBadge.textContent=fmt(cartCount);cartBadge.hidden=!cartCount}
    let student=null;
    try{student=typeof window.currentStudent==='function'?window.currentStudent():null}catch(_){/* ignore */}
    const button=$('#studentAuthBtn'),status=$('#studentAuthStatus');
    if(button)button.innerHTML=`<span class="mobile-account-icon" aria-hidden="true"></span><small>${esc(student?.name||'الحساب')}</small>`;
    if(status)status.textContent=student?`مرحباً ${student.name}`:'التسجيل اختياري';
  }

  const api={FAV_KEY,state,$,$$,esc,num,fmt,now,imageUrl,teacherBy,statusVisible,hasSb,isDesktop,isMobile,stableKey,canonicalItems,activeDeal,effectivePrice,badges,findItem,favoriteKeys,favoriteItems,isFavorite,openModal,closeModal,studentProfile,updateDesktopHeader,updateMobileHeader};
  window.AlinStoreDiscovery=api;

  window.v99ToggleFavorite=(kind,id)=>{
    const key=stableKey(kind,id);
    let rows=favoriteKeys();
    rows=rows.includes(key)?rows.filter(row=>row!==key):[...rows,key];
    localStorage.setItem(FAV_KEY,JSON.stringify(rows));
    try{localStorage.setItem('alin_v98_favorites',JSON.stringify(rows))}catch(_){/* ignore */}
    api.renderEffectiveStore?.();
    updateDesktopHeader();
    updateMobileHeader();
    if(typeof window.toast==='function')window.toast(rows.includes(key)?'تمت الإضافة إلى المفضلة':'تمت الإزالة من المفضلة');
  };

  window.v99ShowFavorites=()=>{
    const rows=favoriteItems();
    const cards=rows.map(item=>api.miniCard?.(item)||'').join('');
    openModal(`<section class="v99-desktop-favorites"><h2>المفضلة</h2>${rows.length?`<p class="muted">${fmt(rows.length)} مادة محفوظة للعودة إليها بسهولة.</p><div class="v99-rail">${cards}</div>`:`<div class="v99-favorites-empty"><span aria-hidden="true">آ</span><h3>مفضلتك جاهزة لاختياراتك</h3><p>احفظ المواد والمنتجات التي تهمك لتجدها هنا في أي وقت.</p><button type="button" data-v99-action="browseProducts">تصفح المنتجات</button></div>`}</section>`);
  };
})();
