import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const platform=read('modules/core/platform.js');
const core=read('modules/store/discovery-core.js');
const catalog=read('modules/store/discovery-catalog.js');
const details=read('modules/store/discovery-details.js');
const growth=read('modules/store/discovery-growth.js');
const discovery=read('modules/store/discovery.js');
const banners=read('store/banners.js');
const features=read('modules/core/features.js');
const desktop=read('store-desktop.html');
const mobile=read('store-mobile.html');
const failures=[];
const check=(ok,label)=>{if(!ok)failures.push(label)};

check(Buffer.byteLength(platform)<120000,'platform-size-not-reduced');
check(Buffer.byteLength(discovery)<18000,'discovery-orchestrator-too-large');
check(!/function\s+(renderStore|storeItems|setStoreType)\s*\(/.test(platform),'platform-function-owner-remains');
check(!/window\.(renderStore|storeItems|setStoreType)\s*=/.test(platform),'platform-window-owner-remains');
for(const legacy of ['ALIN V72 MODERN STUDENT STOREFRONT','ALIN V76 REAL STORE CARD FIX','ALIN V77 CART-FIRST STORE FLOW','ALIN V88 REAL BOOKLET MODAL FIX','ALIN V90 REAL STORE STATISTICS FIX','ALIN V97 FAVORITE HEART SYNC FIX'])check(!platform.includes(legacy),`legacy:${legacy}`);

check((catalog.match(/window\.renderStore\s*=\s*renderStore/g)||[]).length===1,'render-owner-count');
check((catalog.match(/window\.storeItems\s*=\s*currentStoreItems/g)||[]).length===1,'items-owner-count');
check((catalog.match(/window\.setStoreType\s*=\s*setStoreType/g)||[]).length===1,'type-owner-count');
check(catalog.includes('window.AlinStorefront=Object.freeze'),'storefront-service-missing');
check(catalog.includes("new CustomEvent('alin:store-rendered'"),'store-render-event-missing');
check(catalog.includes('data-v99-action="details"'),'details-action-missing');
check(catalog.includes('function matches(item)'),'search-filter-missing');
check(catalog.includes('function sorted(rows)'),'sort-missing');
check(details.includes('window.v99OpenDetails=openDetails'),'details-owner-missing');
check(core.includes('window.AlinStoreDiscovery=api'),'shared-context-missing');
check(growth.includes("document.dispatchEvent")===false,'growth-must-not-own-startup-events');
check(discovery.includes("document.addEventListener('DOMContentLoaded',init"),'orchestrator-init-missing');
check(!discovery.includes('window.renderStore='),'orchestrator-store-owner');

check(!/window\.renderStore\s*=/.test(banners),'banner-render-wrapper-remains');
check(banners.includes('alin:store-rendered'),'banner-render-event-missing');
check(!/window\.renderStore\s*=/.test(features),'features-render-wrapper-remains');

const moduleNames=['discovery-core.js','discovery-catalog.js','discovery-details.js','discovery-growth.js','discovery.js'];
for(const [name,html] of [['desktop',desktop],['mobile',mobile]]){
  let previous=html.indexOf('./modules/core/platform.js?v=2.4.2');
  for(const file of moduleNames){
    const pos=html.indexOf(`./modules/store/${file}?v=2.4.2`);
    check(pos>previous,`${name}-load-order:${file}`);
    previous=pos;
  }
  check(html.includes('oninput="renderStore()"'),`${name}-search-hook`);
}

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:31,platformBytes:Buffer.byteLength(platform),orchestratorBytes:Buffer.byteLength(discovery),catalogBytes:Buffer.byteLength(catalog)},null,2));
