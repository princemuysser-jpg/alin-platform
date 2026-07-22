import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const platform=read('modules/core/platform.js');
const navigation=read('modules/core/navigation.js');
const auth=read('modules/core/auth-service.js');
const security=read('modules/core/security.js');
const courier=read('modules/courier/dashboard.js');
const adminDashboard=read('modules/admin/dashboard.js');
const failures=[];

for(const token of ['function openPage(','function logout(','function showLogin(','function doLogin(','oldOpenPage','_openPageV']){
  if(platform.includes(token))failures.push(`platform:${token}`);
}
for(const token of ['function openPage(page,options={})','function logout()','function showLogin(role)','async function doLogin()','window.openPage=openPage','window.logout=logout','window.doLogin=doLogin','window.showLogin=showLogin','alin:page-open','alin:logout']){
  if(!navigation.includes(token))failures.push(`navigation:${token}`);
}
if(/window\.(?:openPage|logout|doLogin)\s*=(?!=)/.test(auth))failures.push('auth:replaces-global-handler');
if(/oldOpen|oldLogout|oldLogin|window\.openPage\s*=(?!=)|window\.logout\s*=(?!=)|window\.doLogin\s*=(?!=)/.test(security))failures.push('security:wraps-navigation');
if(/openPage\s*=\s*function|window\.openPage\s*=/.test(courier))failures.push('courier:wraps-open-page');
if(/wrappedOpen|window\.openPage\s*=/.test(adminDashboard))failures.push('admin-dashboard:wraps-open-page');

const moduleFiles=[];
for(const entry of fs.readdirSync(path.join(root,'modules'),{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  for(const file of fs.readdirSync(path.join(root,'modules',entry.name))){if(file.endsWith('.js'))moduleFiles.push(path.join(root,'modules',entry.name,file));}
}
const allModules=moduleFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
for(const [name,regex] of [
  ['openPage',/window\.openPage\s*=(?!=)/g],['logout',/window\.logout\s*=(?!=)/g],['doLogin',/window\.doLogin\s*=(?!=)/g],['showLogin',/window\.showLogin\s*=(?!=)/g]
]){
  const count=(allModules.match(regex)||[]).length;
  if(count!==1)failures.push(`global-owner:${name}:${count}`);
}

const makeClassList=(initial=[])=>{const set=new Set(initial);return {add(...x){x.forEach(v=>set.add(v))},remove(...x){x.forEach(v=>set.delete(v))},toggle(v,on){if(on===undefined){if(set.has(v))set.delete(v);else set.add(v)}else if(on)set.add(v);else set.delete(v)},contains(v){return set.has(v)}}};
const elements={
  login:{classList:makeClassList()},loginForm:{classList:makeClassList(['hidden'])},loginMsg:{textContent:''},loginU:{value:'abc',focus(){}},loginPass:{value:'secret'},
  app:{classList:makeClassList(['hidden'])},activeNav:{innerHTML:''},storePage:{classList:makeClassList(['page','hidden'])},libraryPage:{classList:makeClassList(['page','hidden'])},courierPage:{classList:makeClassList(['page','hidden'])},adminPage:{classList:makeClassList(['page','hidden'])}
};
let rendered=0,courierRendered=0,signedOut=0,events=[],toasts=[];
const pages=[elements.storePage,elements.libraryPage,elements.courierPage,elements.adminPage];
const window={
  current:{role:'library',id:'L1'},pendingRole:'',db:{settings:{platform_name:'منصة آلين'}},ALIN_CONFIG:{authEnabled:true},
  renderAll(){rendered++},renderCourierDashboard(){courierRendered++},toast(message){toasts.push(message)},
  ALINAuth:{async loginFromUI(){return true},async signOut(){signedOut++}},dispatchEvent(event){events.push(event.type)}
};
const document={
  title:'',getElementById(id){return elements[id]||null},querySelectorAll(selector){if(selector==='.page')return pages;if(selector==='.version-badge')return [];return []}
};
const context=vm.createContext({window,document,console,alert(message){toasts.push(message)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},Promise,setTimeout,clearTimeout});
vm.runInContext(navigation,context,{filename:'navigation.js'});
window.showLogin('library');
assert.equal(window.pendingRole,'library');
assert.equal(elements.loginForm.classList.contains('hidden'),false);
assert.equal(window.openPage('library',{render:false}),true);
assert.equal(elements.libraryPage.classList.contains('hidden'),false);
assert.equal(rendered,0);
assert.equal(window.openPage('admin'),false);
assert.ok(toasts.includes('ليس لديك صلاحية لفتح هذه الصفحة'));
window.current={role:'courier',id:'C1'};
assert.equal(window.openPage('courier'),true);
assert.equal(courierRendered,1);
assert.equal(rendered,1);
await window.logout();
assert.equal(signedOut,1);
assert.equal(window.current,null);
assert.equal(elements.app.classList.contains('hidden'),true);
assert.ok(events.includes('alin:page-open'));
assert.ok(events.includes('alin:logout'));

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:26,platformBytes:Buffer.byteLength(platform),navigationBytes:Buffer.byteLength(navigation)},null,2));
