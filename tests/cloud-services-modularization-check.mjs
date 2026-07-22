import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const files={
  status:read('modules/core/cloud-status.js'),
  auth:read('modules/core/auth-service.js'),
  accounts:read('modules/core/account-admin-service.js'),
  checkout:read('modules/core/checkout-service.js'),
  backend:read('modules/core/backend-check.js'),
  tracking:read('modules/store/tracking.js'),
  boot:read('modules/core/cloud-status-ui.js')
};
const failures=[];let checks=0;
const check=(value,label)=>{checks++;if(!value)failures.push(label)};
check(Buffer.byteLength(files.boot)<2000,'boot-size');
check(files.status.includes("alin:cloud-status")&&files.status.includes('alin:data-refreshed'),'cloud-status-owner');
check(files.auth.includes('async function restoreSession()')&&files.auth.includes('async function login()'),'auth-session-owner');
check(files.auth.includes('window.ALINAuthRuntime=Object.freeze'),'auth-runtime-owner');
check(files.accounts.includes('async function createAccountFromAdmin()'),'account-create-owner');
check(files.accounts.includes('async function repairAuthLink(accountId)'),'account-repair-owner');
check(files.checkout.includes('function normalizeCheckoutItems(lines)'),'checkout-normalizer-owner');
check(files.checkout.includes('async function secureCheckout()'),'checkout-owner');
check(files.backend.includes('window.AlinBackendCheck=checkBackendReadiness'),'backend-check-owner');
check(files.tracking.includes('window.trackOrder=async function()'),'tracking-owner');
check(!files.boot.includes('async function restoreSession('),'boot-no-session-implementation');
check(!files.boot.includes('async function secureCheckout('),'boot-no-checkout-implementation');
check(!files.boot.includes('window.trackOrder=async function'),'boot-no-tracking-implementation');
check((files.auth.match(/async function restoreSession\(/g)||[]).length===1,'single-restore-definition');
check((files.checkout.match(/async function secureCheckout\(/g)||[]).length===1,'single-checkout-definition');
check((files.tracking.match(/window\.trackOrder=async function/g)||[]).length===1,'single-tracking-definition');
const order=JSON.parse(read('modules/module-order.json'));
const sequence=['modules/core/cloud-status.js','modules/core/auth-service.js','modules/core/account-admin-service.js','modules/core/checkout-service.js','modules/core/backend-check.js','modules/store/tracking.js','modules/core/cloud-status-ui.js'];
const positions=sequence.map(rel=>order.app.indexOf(rel));
check(positions.every(pos=>pos>=0),'module-order-presence');
check(positions.every((pos,index)=>index===0||pos>positions[index-1]),'module-order-sequence');
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=read(htmlName);
  const htmlPositions=sequence.map(rel=>html.indexOf(`./${rel}?v=2.4.2`));
  check(htmlPositions.every(pos=>pos>=0),`${htmlName}-presence`);
  check(htmlPositions.every((pos,index)=>index===0||pos>htmlPositions[index-1]),`${htmlName}-sequence`);
}
if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,bytes:Object.fromEntries(Object.entries(files).map(([key,value])=>[key,Buffer.byteLength(value)]))},null,2));
