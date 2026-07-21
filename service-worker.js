const VERSION='alin-v2.2.2-library-teacher-extraction';
const STATIC_CACHE=`${VERSION}-static`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const CORE=[
  './','./index.html','./store-desktop.html','./store-mobile.html',
  './manifest-desktop.webmanifest','./manifest-mobile.webmanifest',
  './dist/css/landing.bundle.css','./dist/css/desktop.bundle.css','./dist/css/mobile.bundle.css',
  './styles/alin-tokens.css','./styles/alin-shared.css','./styles/alin-desktop.css','./styles/alin-mobile.css',
  './dist/js/landing.bundle.js',
  './modules/core/config.js',
  './modules/core/platform.js',
  './modules/core/navigation.js',
  './modules/core/supabase.js',
  './modules/store/coupons.js',
  './modules/admin/shell.js',
  './modules/admin/accounts.js',
  './modules/core/features.js',
  './modules/store/discovery.js',
  './modules/store/cart.js',
  './modules/teacher/shell.js',
  './modules/teacher/booklets.js',
  './modules/teacher/finance.js',
  './modules/teacher/dashboard.js',
  './modules/teacher/publishing.js',
  './modules/teacher/notifications.js',
  './modules/teacher/profile.js',
  './modules/library/dashboard.js',
  './modules/library/orders.js',
  './modules/library/finance.js',
  './modules/library/printing.js',
  './modules/store/order-routing.js',
  './modules/store/delivery.js',
  './modules/admin/dashboard.js',
  './modules/admin/orders.js',
  './modules/admin/booklets.js',
  './modules/admin/products.js',
  './modules/admin/accounts-advanced.js',
  './modules/admin/finance.js',
  './modules/admin/coupons.js',
  './modules/admin/marketing.js',
  './modules/admin/reports.js',
  './modules/admin/settings.js',
  './modules/admin/notifications.js',
  './modules/admin/couriers.js',
  './modules/courier/dashboard.js',
  './modules/courier/finance.js',
  './modules/core/security.js',
  './modules/core/design.js',
  './modules/admin/branding.js',
  './modules/admin/backup.js',
  './modules/admin/system-health.js',
  './modules/core/supabase-ui.js',
  './modules/core/cloud-status-ui.js',
  './core/lazy-libs.js','./core/finance-runtime.js','./core/pwa-register.js','./core/runtime-guard.js','./core/app-health.js','./core/v2-runtime.js','./options.js',
  './store/banners.css','./store/banners.js','./store/notifications.js',
  './store/mobile-navigation.css','./store/mobile-navigation.js',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './assets/images/hero-products-desktop.webp','./assets/images/hero-products-mobile.webp'
];

async function cacheCore(){
  const cache=await caches.open(STATIC_CACHE);
  const results=await Promise.allSettled(CORE.map(async path=>{
    const request=new Request(path,{cache:'reload'});
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)throw new Error(`${path}: ${response.status}`);
    await cache.put(request,response.clone());
  }));
  const failed=results.filter(x=>x.status==='rejected');
  if(failed.length)console.warn('ALIN PWA: some optional files were not cached',failed);
}

self.addEventListener('install',event=>event.waitUntil(cacheCore().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});

async function networkFirst(req){
  const cache=await caches.open(RUNTIME_CACHE);
  try{
    const response=await fetch(req,{cache:'no-store'});
    if(response.ok)await cache.put(req,response.clone());
    return response;
  }catch(error){
    return (await cache.match(req))||(await caches.match(req))||Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.includes('supabase.co'))return;

  if(req.mode==='navigate'){
    event.respondWith(networkFirst(req).then(async response=>{
      if(response && response.type!=='error')return response;
      return (await caches.match(req))||(await caches.match('./index.html'));
    }));
    return;
  }

  if(url.origin===self.location.origin){
    const codeAsset=['script','style','worker'].includes(req.destination)||/\.(?:html?|css|js|json|webmanifest)$/i.test(url.pathname);
    if(codeAsset){event.respondWith(networkFirst(req));return;}
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
      if(res.ok)caches.open(RUNTIME_CACHE).then(cache=>cache.put(req,res.clone()));
      return res;
    })));
    return;
  }

  if(url.hostname==='cdn.jsdelivr.net'){
    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache=>{
      const hit=await cache.match(req);
      const network=fetch(req).then(res=>{if(res.ok)cache.put(req,res.clone());return res});
      return hit||network.catch(()=>Response.error());
    }));
  }
});
