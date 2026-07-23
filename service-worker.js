const VERSION='alin-v3.0.1-performance';
const STATIC_CACHE=`${VERSION}-static`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const CORE=[
  './','./index.html','./manifest-desktop.webmanifest','./manifest-mobile.webmanifest',
  './styles/alin-splash.css','./core/device-router.js','./core/runtime-guard.js','./core/splash.js','./core/pwa-register.js',
  './assets/images/alin-splash-desktop.webp','./assets/images/alin-splash-mobile.webp',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png'
];

async function cacheCore(){
  const cache=await caches.open(STATIC_CACHE);
  const results=await Promise.allSettled(CORE.map(async path=>{
    const request=new Request(path,{cache:'reload'});
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)throw new Error(`${path}: ${response.status}`);
    await cache.put(request,response.clone());
  }));
  const failed=results.filter(item=>item.status==='rejected');
  if(failed.length)console.warn('ALIN PWA: optional boot assets were not cached',failed);
}

self.addEventListener('install',event=>event.waitUntil(cacheCore().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>!key.startsWith(VERSION)).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});

async function fetchWithTimeout(request,timeoutMs=3500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{cache:'no-store',signal:controller.signal})}
  finally{clearTimeout(timer)}
}

async function networkFirst(request){
  const cache=await caches.open(RUNTIME_CACHE);
  try{
    const response=await fetchWithTimeout(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch(_){
    return (await cache.match(request,{ignoreSearch:true}))||(await caches.match(request,{ignoreSearch:true}))||Response.error();
  }
}

async function staleWhileRevalidate(request,event){
  const cache=await caches.open(STATIC_CACHE);
  const cached=await cache.match(request,{ignoreSearch:true});
  const refresh=fetch(request,{cache:'no-store'}).then(async response=>{
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(event&&cached)event.waitUntil(refresh);
  return cached||(await refresh)||Response.error();
}

async function cacheFirstRuntime(request){
  const cache=await caches.open(RUNTIME_CACHE);
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok)await cache.put(request,response.clone());
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.hostname.includes('supabase.co'))return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request).then(async response=>
      response&&response.type!=='error'?response:
      (await caches.match(request,{ignoreSearch:true}))||(await caches.match('./index.html'))
    ));
    return;
  }

  if(url.origin===self.location.origin){
    const codeAsset=['script','style','worker'].includes(request.destination)||/\.(?:html?|css|js|json|webmanifest)$/i.test(url.pathname);
    if(codeAsset){event.respondWith(staleWhileRevalidate(request,event));return;}
    event.respondWith(cacheFirstRuntime(request));
    return;
  }

  if(url.hostname==='cdn.jsdelivr.net'){
    event.respondWith(cacheFirstRuntime(request));
  }
});
