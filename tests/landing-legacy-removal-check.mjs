import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];
let checks=0;
const check=(condition,label)=>{checks++;if(!condition)failures.push(label)};
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const router=fs.readFileSync(path.join(root,'core/device-router.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');

check(!fs.existsSync(path.join(root,'dist/js/landing.bundle.js')),'legacy-js-deleted');
check(!fs.existsSync(path.join(root,'dist/css/landing.bundle.css')),'legacy-css-deleted');
check(!index.includes('landing.bundle.js'),'index-no-legacy-js');
check(!index.includes('landing.bundle.css'),'index-no-legacy-css');
check(index.includes('./core/device-router.js?v=2.4.2'),'index-device-router');
check(router.includes("current.pathname=current.pathname.replace(/[^/]*$/,'')+(chosen==='mobile'?'store-mobile.html':'store-desktop.html')"),'router-targets');
check(router.includes('window.AlinEntryRoute=Object.freeze'),'router-exposes-entry-route');
check(router.includes('location.replace(destination)'),'router-replace-on-go');
check(!router.includes('window.doLogin')&&!router.includes('window.logout')&&!router.includes('window.addAccount'),'router-no-auth-wrappers');
check(!sw.includes('landing.bundle.js')&&!sw.includes('landing.bundle.css'),'pwa-no-legacy-assets');
check(sw.includes("'./core/device-router.js'"),'pwa-device-router');

function runRouter({href='https://alin.test/index.html',width=1200,userAgent='Desktop',saved='',forcedMatches={}}={}){
  let replaced='';
  const storage=new Map(saved?[['alin_device_view',saved]]:[]);
  const location={href,search:new URL(href).search,hash:new URL(href).hash,replace(value){replaced=String(value)}};
  const window={innerWidth:width,visualViewport:{width},dispatchEvent(){}};
  const context={
    URL,location,window,
    innerWidth:width,innerHeight:800,
    document:{documentElement:{clientWidth:width,dataset:{}}},
    navigator:{userAgent,maxTouchPoints:forcedMatches.touch?1:0,userAgentData:{mobile:!!forcedMatches.mobileHint}},
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
    matchMedia:query=>({matches:query.includes('coarse')?!!forcedMatches.coarse:query.includes('hover')?!!forcedMatches.hoverNone:query.includes('portrait')?!!forcedMatches.portrait:false}),
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    console
  };
  context.globalThis=context;
  vm.runInNewContext(router,context,{filename:'core/device-router.js'});
  return {get replaced(){return replaced},storage,route:window.AlinEntryRoute,dataset:context.document.documentElement.dataset};
}

const desktop=runRouter();
check(desktop.replaced==='','runtime-does-not-skip-splash');
check(desktop.route.target.includes('/store-desktop.html'),'runtime-desktop-target');
desktop.route.go();
check(desktop.replaced.includes('/store-desktop.html'),'runtime-desktop-go');
const mobile=runRouter({width:390,userAgent:'Android Mobile',forcedMatches:{coarse:true,hoverNone:true,touch:true,mobileHint:true}});
check(mobile.route.target.includes('/store-mobile.html')&&mobile.dataset.alinEntryView==='mobile','runtime-mobile-target');
mobile.route.go();
check(mobile.replaced.includes('/store-mobile.html'),'runtime-mobile-go');
const forced=runRouter({href:'https://alin.test/index.html?view=mobile&campaign=1#x'});
check(forced.route.target.includes('/store-mobile.html?campaign=1#x')&&!forced.route.target.includes('view='),'runtime-forced-route-preserves-query');

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,version:'2.4.2'},null,2));
