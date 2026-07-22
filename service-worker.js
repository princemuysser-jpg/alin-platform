const VERSION='alin-v3.0.0-production-unified';
const STATIC_CACHE=`${VERSION}-static`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const CORE=[
  './','./index.html','./store-desktop.html','./store-mobile.html',
  './manifest-desktop.webmanifest','./manifest-mobile.webmanifest',
  './styles/alin-splash.css','./core/splash.js',
  './assets/images/alin-splash-desktop.webp','./assets/images/alin-splash-mobile.webp',
  './dist/css/desktop.bundle.css','./dist/css/mobile.bundle.css',
  './styles/alin-tokens.css','./styles/alin-shared.css','./styles/alin-i18n.css','./styles/alin-desktop.css','./styles/alin-mobile.css','./styles/alin-branding.css',
  './dist/alin-core.v3.js','./dist/alin-app-desktop.v3.js','./dist/alin-app-mobile.v3.js',
  './store/banners.css','./store/mobile-navigation.css',
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
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
async function networkFirst(req){
  const cache=await caches.open(RUNTIME_CACHE);
  try{const response=await fetch(req,{cache:'no-store'});if(response.ok)await cache.put(req,response.clone());return response}
  catch(_){return (await cache.match(req))||(await caches.match(req))||Response.error()}
}
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);
  if(url.hostname.includes('supabase.co'))return;
  if(req.mode==='navigate'){event.respondWith(networkFirst(req).then(async response=>response&&response.type!=='error'?response:(await caches.match(req))||(await caches.match('./index.html'))));return}
  if(url.origin===self.location.origin){
    const codeAsset=['script','style','worker'].includes(req.destination)||/\.(?:html?|css|js|json|webmanifest)$/i.test(url.pathname);
    if(codeAsset){event.respondWith(networkFirst(req));return}
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok)caches.open(RUNTIME_CACHE).then(cache=>cache.put(req,res.clone()));return res})));return;
  }
  if(url.hostname==='cdn.jsdelivr.net')event.respondWith(caches.open(RUNTIME_CACHE).then(async cache=>{const hit=await cache.match(req);const network=fetch(req).then(res=>{if(res.ok)cache.put(req,res.clone());return res});return hit||network.catch(()=>Response.error())}));
});
