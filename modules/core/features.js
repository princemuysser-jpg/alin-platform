// === core/features.js ===
/* ===== core/js/platform-features.js ===== */

(function(){
  const FAV_KEY='alin_v98_favorites';

  const $=sel=>document.querySelector(sel);
  const $$=sel=>[...document.querySelectorAll(sel)];
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function favs(){
    try{
      const x=JSON.parse(localStorage.getItem(FAV_KEY)||'[]');
      return Array.isArray(x)?x.map(String):[];
    }catch(_){return[]}
  }
  function favKey(kind,id){return `${kind}:${id}`}
  function isFav(kind,id){return favs().includes(favKey(kind,id))}
  function saveFavs(rows){localStorage.setItem(FAV_KEY,JSON.stringify(rows))}

  window.alin98ToggleFavorite=function(kind,id){
    const key=favKey(kind,id);
    let rows=favs();
    rows=rows.includes(key)?rows.filter(x=>x!==key):[...rows,key];
    saveFavs(rows);
    syncHearts();
    if(typeof toast==='function')toast(rows.includes(key)?'تمت الإضافة إلى المفضلة':'تمت الإزالة من المفضلة');
  };

  function rawItem(kind,id){
    return kind==='booklet'
      ? (db.booklets||[]).find(x=>String(x.id)===String(id))
      : (db.products||[]).find(x=>String(x.id)===String(id));
  }
  function titleOf(x){return x?.title||x?.name||'مادة'}
  function coverOf(x){return x?.cover_path||x?.image_path||x?.image_url||x?.cover||x?.image||''}
  function categoryOf(x){return String(x?.subject||x?.grade||x?.category||x?.category_id||x?.type||'').toLowerCase()}

  function syncHearts(){
    $$('.alin98-heart[data-kind][data-id]').forEach(btn=>{
      const active=isFav(btn.dataset.kind,btn.dataset.id);
      btn.classList.toggle('active',active);
      btn.textContent=active?'♥':'♡';
    });
  }

  function decorateCards(){
    $$('#storeGrid .alin-v76-card').forEach(card=>{
      const open=card.querySelector('[onclick*="alinV77OpenDetails"]')?.getAttribute('onclick')||'';
      const m=open.match(/alinV77OpenDetails\('([^']+)','([^']+)'\)/);
      if(!m)return;
      const [,kind,id]=m;
      let btn=card.querySelector('.alin98-heart');
      if(!btn){
        btn=document.createElement('button');
        btn.type='button';
        btn.className='alin98-heart';
        btn.dataset.kind=kind;
        btn.dataset.id=id;
        btn.onclick=e=>{e.preventDefault();e.stopPropagation();alin98ToggleFavorite(kind,id)};
        card.appendChild(btn);
      }
    });
    syncHearts();
  }

  window.alin98ShowFavorites=function(){
    const rows=favs().map(k=>{
      const [kind,...r]=k.split(':');
      const id=r.join(':');
      const x=rawItem(kind,id);
      return x?{kind,id,x}:null;
    }).filter(Boolean);

    const m=document.createElement('div');
    m.className='alin-v85-overlay';
    m.innerHTML=`<div class="alin-v85-sheet">
      <button class="alin-v85-close" onclick="this.closest('.alin-v85-overlay').remove()">×</button>
      <h2>❤️ المفضلة</h2>
      <div class="alin-v85-favgrid">
        ${rows.map(r=>`<article>
          <div>${coverOf(r.x)?`<img src="${mediaUrl(coverOf(r.x))}">`:'<span>آ</span>'}</div>
          <b>${escHtml(titleOf(r.x))}</b>
          <small>${money(+r.x.price||0)} د.ع</small>
          <button onclick="this.closest('.alin-v85-overlay').remove();alinV77OpenDetails('${r.kind}','${r.id}')">عرض</button>
        </article>`).join('')||'<p>لا توجد مواد محفوظة.</p>'}
      </div>
    </div>`;
    document.body.appendChild(m);
  };

  function related(kind,id){
    const source=rawItem(kind,id);
    if(!source)return[];
    const cat=categoryOf(source);
    return [
      ...(db.booklets||[]).filter(x=>x.status==='published').map(x=>({kind:'booklet',raw:x})),
      ...(db.products||[]).filter(x=>!['hidden','inactive','deleted','archived'].includes(String(x.status||'published'))).map(x=>({kind:'product',raw:x}))
    ].filter(x=>!(x.kind===kind&&String(x.raw.id)===String(id)))
     .map(x=>({...x,score:(categoryOf(x.raw)===cat?5:0)+(x.kind===kind?1:0)}))
     .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
  }

  const oldOpen=window.alinV77OpenDetails;
  if(typeof oldOpen==='function'){
    window.alinV77OpenDetails=function(kind,id){
      const r=oldOpen.apply(this,arguments);
      setTimeout(()=>{
        const modal=$('.alin-v77-modal:last-of-type');
        const content=modal?.querySelector('.alin-v77-modal-content');
        if(!content)return;

        if(!content.querySelector('.alin98-modal-fav')){
          content.insertAdjacentHTML('afterbegin',`<button class="alin98-modal-fav" onclick="alin98ToggleFavorite('${kind}','${id}')">${isFav(kind,id)?'♥ محفوظ في المفضلة':'♡ أضف للمفضلة'}</button>`);
        }

        if(!content.querySelector('.alin98-related')){
          const rows=related(kind,id);
          content.insertAdjacentHTML('beforeend',`<section class="alin98-related">
            <h3>مواد ذات صلة</h3>
            <div class="alin98-related-grid">
              ${rows.map(x=>`<article onclick="this.closest('.alin-v77-modal').remove();alinV77OpenDetails('${x.kind}','${x.raw.id}')">
                ${coverOf(x.raw)?`<img src="${mediaUrl(coverOf(x.raw))}">`:'<span>آ</span>'}
                <b>${escHtml(titleOf(x.raw))}</b>
                <small>${money(+x.raw.price||0)} د.ع</small>
              </article>`).join('')||'<p>لا توجد مواد مشابهة حالياً.</p>'}
            </div>
          </section>`);
        }
      },0);
      return r;
    };
  }

  function activeBanners(){
    const today=new Date().toISOString().slice(0,10);
    return (db.banners||[]).filter(b=>{
      const active=!(b.active===false||String(b.active)==='false'||b.status==='hidden');
      return active&&(!b.start_date||b.start_date<=today)&&(!b.end_date||b.end_date>=today);
    });
  }

  function renderBanners(){
    const box=$('#bannerBox');
    if(!box)return;
    const rows=activeBanners();
    box.innerHTML=rows.map(b=>`<article class="alin98-banner ${b.link_url?'clickable':''}" ${b.link_url?`onclick="window.open('${String(b.link_url).replace(/'/g,"\\'")}','_blank')"`:''}>
      ${coverOf(b)?`<img src="${mediaUrl(coverOf(b))}">`:''}
      <div><small>إعلان منصة آلين</small><h2>${escHtml(b.title||'')}</h2><p>${escHtml(b.text||'')}</p></div>
    </article>`).join('');
    box.style.display=rows.length?'grid':'none';
  }

  window.alin98WhatsAppOrder=function(orderId){
    const o=(db.orders||[]).find(x=>String(x.id)===String(orderId));
    if(!o)return alert('الطلب غير موجود');
    const lib=(db.accounts?.libraries||[]).find(x=>String(x.id)===String(o.library_id));
    const phone=String(lib?.whatsapp||lib?.phone||db.settings?.whatsapp||'').replace(/\D/g,'');
    if(!phone)return alert('رقم واتساب غير محدد');
    const msg=encodeURIComponent(`السلام عليكم، بخصوص طلبي في منصة آلين\nرقم الطلب: ${o.order_number||o.id}\nالطلب: ${o.title||''}`);
    window.open(`https://wa.me/${phone}?text=${msg}`,'_blank');
  };

  function notificationCount(){
    try{
      const seen=JSON.parse(localStorage.getItem('alin98_seen_notifications')||'[]').map(String);
      const role=current?.role||'student';
      return (db.notifications||[]).filter(n=>['all',role].includes(n.target_role||n.audience||'all')&&!seen.includes(String(n.id))).length;
    }catch(_){return 0}
  }
  window.alin98MarkAllRead=function(){
    localStorage.setItem('alin98_seen_notifications',JSON.stringify((db.notifications||[]).map(n=>String(n.id))));
    updateNotificationCount();
  };
  function updateNotificationCount(){
    const n=notificationCount();
    $$('.alin98-notify-count').forEach(x=>{x.textContent=n;x.hidden=!n});
  }

  function decorateNotificationButton(){
    const buttons=$$('.alin-v78-notify-btn,.alin-v94-notification-button');
    if(!buttons.length)return;
    const primary=buttons[0];
    buttons.slice(1).forEach(x=>x.remove());
    primary.classList.add('alin98-notify');
  }

  document.addEventListener('alin:store-rendered',()=>{
    setTimeout(()=>{decorateCards();renderBanners();updateNotificationCount()},0);
  });

  document.addEventListener('DOMContentLoaded',()=>{
    decorateNotificationButton();
    updateNotificationCount();
    $$('.alin98-bottom button').forEach(btn=>btn.addEventListener('click',()=>{
      $$('.alin98-bottom button').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
    }));
  });

  window.addEventListener('load',()=>{
    setTimeout(()=>{decorateCards();renderBanners();decorateNotificationButton();updateNotificationCount()},600);
  });
})();


;
