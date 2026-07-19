const VERSION='alin-v2.0.4';
const STATIC_CACHE=`${VERSION}-static`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const CORE=[
  './','./index.html','./store-desktop.html','./store-mobile.html',
  './manifest-desktop.webmanifest','./manifest-mobile.webmanifest',
  './dist/css/landing.bundle.css','./dist/css/desktop.bundle.css','./dist/css/mobile.bundle.css',
  './styles/alin-tokens.css','./styles/alin-shared.css','./styles/alin-desktop.css','./styles/alin-mobile.css',
  './dist/js/landing.bundle.js',
  './modules/admin/accounts-advanced.js',
  './modules/admin/accounts.js',
  './modules/admin/backup.js',
  './modules/admin/booklets.js',
  './modules/admin/branding.js',
  './modules/admin/couriers.js',
  './modules/admin/dashboard.js',
  './modules/admin/finance.js',
  './modules/admin/marketing.js',
  './modules/admin/notifications.js',
  './modules/admin/orders.js',
  './modules/admin/products.js',
  './modules/admin/reports.js',
  './modules/admin/settings.js',
  './modules/admin/shell.js',
  './modules/admin/system-health.js',
  './modules/core/cloud-status-ui.js',
  './modules/core/config.js',
  './modules/core/design.js',
  './modules/core/features.js',
  './modules/core/platform.js',
  './modules/core/security.js',
  './modules/core/supabase-ui.js',
  './modules/core/supabase.js',
  './modules/courier/dashboard.js',
  './modules/courier/finance.js',
  './modules/library/dashboard.js',
  './modules/library/finance.js',
  './modules/library/orders.js',
  './modules/library/printing.js',
  './modules/store/cart.js',
  './modules/store/delivery.js',
  './modules/store/discovery.js',
  './modules/store/order-routing.js',
  './modules/teacher/booklets.js',
  './modules/teacher/dashboard.js',
  './modules/teacher/finance.js',
  './modules/teacher/notifications.js',
  './modules/teacher/profile.js',
  './modules/teacher/publishing.js',
  './modules/teacher/shell.js',
  './core/lazy-libs.js','./core/pwa-register.js','./core/runtime-guard.js','./core/app-health.js','./options.js',
  './store/banners-final.css','./store/banners-final.js','./store/notifications.js',
  './store/mobile-navigation.css','./store/mobile-navigation.js',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './assets/images/hero-products-desktop.webp','./assets/images/hero-products-mobile.webp'
];

async function cacheCore(){
  const cache=await caches.open(STATIC_CACHE);
  const results=await Promise.allSettled(CORE.map(async path=>{
    const request=new Request(path,{cache:'reload'});
    const response=await fetch(request);
    if(!response.ok)throw new Error(`${path}: ${response.status}`);
    await cache.put(request,response);
  }));
  const failed=results.filter(x=>x.status==='rejected');
  if(failed.length)console.warn('ALIN PWA: some optional files were not cached',failed);
}

self.addEventListener('install',event=>{
  event.waitUntil(cacheCore().then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.includes('supabase.co'))return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req)
        .then(res=>{if(res.ok)caches.open(RUNTIME_CACHE).then(c=>c.put(req,res.clone()));return res})
        .catch(async()=>await caches.match(req)||await caches.match('./index.html'))
    );
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(req).then(async hit=>{
        const network=fetch(req).then(res=>{if(res.ok)caches.open(RUNTIME_CACHE).then(c=>c.put(req,res.clone()));return res});
        return hit||network;
      })
    );
    return;
  }

  if(url.hostname==='cdn.jsdelivr.net'){
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async cache=>{
        const hit=await cache.match(req);
        const network=fetch(req).then(res=>{if(res.ok)cache.put(req,res.clone());return res});
        return hit||network.catch(()=>Response.error());
      })
    );
  }
});
