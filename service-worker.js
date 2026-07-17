const VERSION='alin-v1.1.9';
const STATIC_CACHE=`${VERSION}-static`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const CORE=[
  './','./index.html','./store-desktop.html','./store-mobile.html',
  './dist/css/landing.bundle.css','./dist/js/landing.bundle.js',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './assets/images/hero-products-desktop.webp','./assets/images/hero-products-mobile.webp'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.hostname.includes('supabase.co')) return; // never cache live API data
  if(url.origin===self.location.origin){
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
      const copy=res.clone(); caches.open(RUNTIME_CACHE).then(c=>c.put(req,copy)); return res;
    }).catch(()=>req.mode==='navigate'?caches.match('./index.html'):Response.error())));
    return;
  }
  if(url.hostname==='cdn.jsdelivr.net'){
    event.respondWith(caches.open(RUNTIME_CACHE).then(async c=>{
      const hit=await c.match(req);
      const net=fetch(req).then(res=>{ if(res.ok)c.put(req,res.clone()); return res; }).catch(()=>hit);
      return hit||net;
    }));
  }
});
