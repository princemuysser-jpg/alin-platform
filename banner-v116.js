/* ALIN 1.1.6 - standalone public storefront banner */
(function(){
  'use strict';
  const URL='https://jyavewwlgiaibtdqyzpd.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5YXZld3dsZ2lhaWJ0ZHF5enBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTczMzcsImV4cCI6MjA5ODk5MzMzN30.fcjx4JrNdwd5Xrm_Nn1CaWWJoJLF6_DyYGakFPuGwGQ';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid=b=>{
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const d=`${parts.year}-${parts.month}-${parts.day}`;
    return (b.active===true||b.active===1||String(b.active).toLowerCase()==='true')
      && (!b.start_date||String(b.start_date).slice(0,10)<=d)
      && (!b.end_date||String(b.end_date).slice(0,10)>=d);
  };
  function host(){
    let h=document.getElementById('alinStoreBannersV115');
    if(h)return h;
    h=document.createElement('section');h.id='alinStoreBannersV115';h.className='alin-store-banners-v115';h.hidden=true;
    const anchor=document.querySelector('.alin98-hero,.alin-hero,.hero,#bannerBox,.store-hero');
    if(anchor?.parentNode)anchor.parentNode.insertBefore(h,anchor);
    else (document.querySelector('main,#storePage')||document.body).prepend(h);
    return h;
  }
  function imageCandidates(path){
    const raw=String(path||'').trim(); if(!raw)return [];
    if(/^https?:\/\//i.test(raw))return [raw];
    const clean=raw.replace(/^\/+/,'');
    const name=clean.replace(/^banners\//i,'');
    return [
      `${URL}/storage/v1/object/public/banners/${encodeURIComponent(name)}`,
      `${URL}/storage/v1/object/public/alin-files/${clean.split('/').map(encodeURIComponent).join('/')}`,
      `${URL}/storage/v1/object/public/alin-files/banners/${encodeURIComponent(name)}`
    ];
  }
  window.alinBanner116Fallback=function(img){
    const list=JSON.parse(img.dataset.sources||'[]'),n=(Number(img.dataset.index)||0)+1;
    if(n<list.length){img.dataset.index=String(n);img.src=list[n]}else img.remove();
  };
  async function refresh(){
    const h=host();
    try{
      const response=await fetch(`${URL}/rest/v1/banners?select=*&order=created_at.desc`,{
        headers:{apikey:KEY,Authorization:`Bearer ${KEY}`},cache:'no-store'
      });
      if(!response.ok)throw new Error(`banners ${response.status}`);
      const b=(await response.json()).find(valid);
      if(!b){h.hidden=true;h.innerHTML='';return}
      const images=imageCandidates(b.image_path||b.image_url);
      const sources=esc(JSON.stringify(images));
      h.innerHTML=`<article class="alin-store-banner-v115">${images.length?`<img src="${esc(images[0])}" data-sources='${sources}' data-index="0" onerror="window.alinBanner116Fallback(this)" alt="${esc(b.title||'إعلان منصة آلين')}">`:''}<div class="alin-store-banner-v115__copy"><span>إعلان منصة آلين</span><h2>${esc(b.title||'')}</h2>${b.text?`<p>${esc(b.text)}</p>`:''}</div></article>`;
      h.hidden=false;
    }catch(e){console.warn('[Alin banner 1.1.6]',e)}
  }
  function start(){refresh();setTimeout(refresh,1500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
