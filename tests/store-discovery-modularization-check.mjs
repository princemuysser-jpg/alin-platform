import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const files={
  core:read('modules/store/discovery-core.js'),
  catalog:read('modules/store/discovery-catalog.js'),
  details:read('modules/store/discovery-details.js'),
  growth:read('modules/store/discovery-growth.js'),
  orchestrator:read('modules/store/discovery.js'),
  tracking:read('modules/store/tracking.js')
};
const failures=[];let checks=0;
const check=(value,label)=>{checks++;if(!value)failures.push(label)};
check(Buffer.byteLength(files.orchestrator)<15000,'orchestrator-size');
check(files.core.includes('window.AlinStoreDiscovery=api'),'shared-context-owner');
check((files.catalog.match(/window\.renderStore=renderStore/g)||[]).length===1,'render-store-owner');
check((files.catalog.match(/window\.storeItems=currentStoreItems/g)||[]).length===1,'store-items-owner');
check((files.catalog.match(/window\.setStoreType=setStoreType/g)||[]).length===1,'store-type-owner');
check((files.details.match(/window\.v99OpenDetails=openDetails/g)||[]).length===1,'details-owner');
check((files.core.match(/window\.v99ToggleFavorite=/g)||[]).length===1,'favorite-owner');
check((files.core.match(/window\.v99ShowFavorites=/g)||[]).length===1,'favorite-page-owner');
check(files.growth.includes('function renderStudentHub()'),'student-hub-owner');
check(files.growth.includes('function loadGrowthData()'),'growth-data-owner');
check(files.orchestrator.includes('function installEventRouting()'),'event-router-owner');
check(files.orchestrator.includes('function installIntegrationEvents()'),'integration-events-owner');
check(!files.orchestrator.includes('function renderStore('),'no-render-in-orchestrator');
check(!files.orchestrator.includes('function openDetails('),'no-details-in-orchestrator');
check(!files.orchestrator.includes('oldTrack')&&!files.orchestrator.includes('apply(this,arguments)'),'no-tracking-wrapper');
check(files.tracking.includes("new CustomEvent('alin:tracking-rendered'"),'tracking-event-source');
check(files.orchestrator.includes("document.addEventListener('alin:tracking-rendered',ctx.enhanceTracking)"),'tracking-event-consumer');
const order=JSON.parse(read('modules/module-order.json'));
const sequence=['modules/store/discovery-core.js','modules/store/discovery-catalog.js','modules/store/discovery-details.js','modules/store/discovery-growth.js','modules/store/discovery.js'];
const positions=sequence.map(rel=>order.early.indexOf(rel));
check(positions.every(pos=>pos>=0),'module-order-presence');
check(positions.every((pos,index)=>index===0||pos>positions[index-1]),'module-order-sequence');
if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,bytes:Object.fromEntries(Object.entries(files).slice(0,5).map(([key,value])=>[key,Buffer.byteLength(value)]))},null,2));
