/* ALIN 2.0.3 — storefront banner bridge */
(function(){
  'use strict';
  const state={rows:[],index:0,timer:null,installed:false};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const truthy=v=>v===true||v===1||v==='1'||String(v).toLowerCase()==='true';
  const today=()=>new Date().toISOString().slice(0,10);
  function client(){return window.sb||window.supabaseClient||window.AlinSupabase?.client?.()||null}
  function valid(b){
    const d=today();
    return truthy(b?.active) && b?.status!=='hidden' && (!b?.start_date||String(b.start_date).slice(0,10)<=d) && (!b?.end_date||String(b.end_date).slice(0,10)>=d);
  }
  function safeLink(v){
    try{const u=new URL(String(v||''),location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch(_){return ''}
  }
  function candidates(ref){
    if(!ref)return [];
    if(typeof ref==='object'&&ref.path)ref=ref.path;
    const raw=String(ref).trim();
    if(/^https?:\/\//i.test(raw))return [raw];
    const clean=raw.replace(/^\/+/, '');
    const noBanner=clean.replace(/^banners\//i,'');
    const c=client(); if(!c?.storage)return [];
    const urls=[];
    const add=url=>{if(url&&!urls.includes(url))urls.push(url)};
    const push=(bucket,path)=>{try{add(c.storage.from(bucket).getPublicUrl(path).data?.publicUrl)}catch(_){}};
    // Admin uploadFile stores banner images in alin-files/banners/... .
    // Try that canonical path first, then older bucket layouts as fallbacks.
    try{if(typeof window.mediaUrl==='function')add(window.mediaUrl(clean))}catch(_){}
    push('alin-files',clean);
    push('alin-files','banners/'+noBanner);
    push('banners',noBanner);
    push('banners',clean);
    return urls;
  }
  function imageHtml(b){
    const urls=candidates(b?.image_path||b?.image_url||b?.cover_path||'');
    if(!urls.length)return '';
    const list=esc(JSON.stringify(urls));
    return `<img class="alin-store-banner__image" src="${esc(urls[0])}" data-alin-sources='${list}' data-alin-source-index="0" alt="${esc(b?.title||'إعلان منصة آلين')}" onerror="window.alinBannerImageFallback(this)">`;
  }
  window.alinBannerImageFallback=function(img){
    try{const arr=JSON.parse(img.dataset.alinSources||'[]');const next=(Number(img.dataset.alinSourceIndex)||0)+1;if(next<arr.length){img.dataset.alinSourceIndex=String(next);img.src=arr[next]}else img.remove()}catch(_){img.remove()}
  };
  function ensureHost(){
    let host=document.getElementById('alinStoreBanners');
    if(host)return host;
    host=document.createElement('section');host.id='alinStoreBanners';host.className='alin-store-banners';host.hidden=true;
    const anchor=document.querySelector('#bannerTopAnchor,.alin98-hero,.alin-hero,.hero,.store-hero,#bannerBox');
    if(anchor?.parentNode)anchor.parentNode.insertBefore(host,anchor);
    else (document.querySelector('#storePage main,main,#storePage')||document.body).prepend(host);
    return host;
  }
  function render(){
    const host=ensureHost();
    const rows=state.rows.filter(valid).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    if(!rows.length){host.innerHTML='';host.hidden=true;return}
    state.index=Math.min(state.index,rows.length-1);
    const b=rows[state.index],link=safeLink(b.link_url);
    host.hidden=false;
    host.innerHTML=`<article class="alin-store-banner ${link?'is-clickable':''}" ${link?`role="link" tabindex="0" data-link="${esc(link)}"`:''}>
      ${imageHtml(b)}
      <div class="alin-store-banner__content"><span class="alin-store-banner__label">إعلان منصة آلين</span><h2>${esc(b.title||'')}</h2>${b.text?`<p>${esc(b.text)}</p>`:''}</div>
    </article>${rows.length>1?`<div class="alin-store-banner__dots">${rows.map((_,i)=>`<button type="button" class="${i===state.index?'active':''}" data-index="${i}" aria-label="الإعلان ${i+1}"></button>`).join('')}</div>`:''}`;
    const card=host.querySelector('.alin-store-banner[data-link]');
    if(card){const open=()=>window.open(card.dataset.link,'_blank','noopener,noreferrer');card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})}
    host.querySelectorAll('[data-index]').forEach(x=>x.addEventListener('click',()=>{state.index=Number(x.dataset.index)||0;render();restart()}));
  }
  function restart(){clearInterval(state.timer);if(state.rows.filter(valid).length>1)state.timer=setInterval(()=>{state.index=(state.index+1)%state.rows.filter(valid).length;render()},6500)}
  async function refresh(){
    let rows=Array.isArray(window.db?.banners)?window.db.banners:[];
    const c=client();
    if(c){
      try{const {data,error}=await c.from('banners').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});if(!error&&Array.isArray(data)){rows=data;if(window.db)window.db.banners=data}}catch(e){console.warn('[Alin banners]',e)}
    }
    state.rows=rows||[];render();restart();
  }
  function install(){
    if(state.installed)return;state.installed=true;
    const old=window.renderStore;
    if(typeof old==='function')window.renderStore=function(){const r=old.apply(this,arguments);setTimeout(refresh,30);return r};
    window.addEventListener('alin:data-mutated',e=>{if(e.detail?.table==='banners')refresh()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    setTimeout(refresh,150);setTimeout(refresh,1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.alinRefreshStoreBanners=refresh;
})();
