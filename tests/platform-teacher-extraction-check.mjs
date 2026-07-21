import fs from 'node:fs';
import vm from 'node:vm';

const platform=fs.readFileSync('modules/core/platform.js','utf8');
const files=['shell','booklets','finance','dashboard','publishing','notifications','profile'];
const sources=Object.fromEntries(files.map(name=>[name,fs.readFileSync(`modules/teacher/${name}.js`,'utf8')]));
const failures=[];
const check=(ok,label)=>{if(!ok)failures.push(label)};

for(const pattern of [
  /function\s+renderTeacher\s*\(/,
  /(?:window\.)?renderTeacher\s*=\s*(?:renderTeacher\s*=\s*)?(?:async\s+)?function/,
  /function\s+teacherTab\s*\(/,
  /(?:window\.)?teacherTab\s*=\s*(?:teacherTab\s*=\s*)?(?:async\s+)?function/,
  /alinV\d+RenderTeacher/,
  /alinV\d+TeacherTab/
])check(!pattern.test(platform),`platform legacy teacher remains: ${pattern}`);

check((sources.shell.match(/window\.renderTeacher=render/g)||[]).length===1,'teacher render must have one owner');
check((sources.shell.match(/window\.teacherTab=setTab/g)||[]).length===1,'teacher tab must have one owner');
const otherSources=files.filter(x=>x!=='shell').map(x=>sources[x]).join('\n');
check(!/window\.renderTeacher\s*=/.test(otherSources),'teacher module overrides renderTeacher');
check(!/window\.teacherTab\s*=/.test(otherSources),'teacher module overrides teacherTab');
check(!/(previousTab|oldTeacherTab|previousRender|baseRenderTeacher)/.test(otherSources),'teacher wrapper chain remains');
for(const tab of ['dashboard','booklets','orders','finance','requests','review','notifications','profile']){
  check(otherSources.includes(`registerTab('${tab}'`),`teacher tab missing: ${tab}`);
}
check(sources.booklets.includes('async function approveTeacherBooklet'),'teacher approval implementation missing');
check(sources.booklets.includes('async function publishTeacherBooklet'),'teacher publish implementation missing');
check(sources.publishing.includes('window.renderTeacherRequestsAdmin=renderAdminReview'),'admin teacher review not direct');
check(Buffer.byteLength(platform,'utf8')<330000,`platform remains too large: ${Buffer.byteLength(platform,'utf8')}`);

const fakeNode=()=>({innerHTML:'',dataset:{},hidden:false,value:'',classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return[]},getAttribute(){return''},insertBefore(){},appendChild(){},remove(){},click(){}});
const nodes=new Map([
  ['teacherContent',fakeNode()],['teacherStats',fakeNode()],['teacherPage',fakeNode()],['adminContent',fakeNode()],['teacherNotificationsBadgeV160',fakeNode()]
]);
nodes.get('teacherPage').querySelector=()=>null;
const document={
  readyState:'complete',body:{contains(){return true},appendChild(){}},
  getElementById:id=>nodes.get(id)||null,
  querySelector(){return null},querySelectorAll(){return[]},
  createElement(){return fakeNode()},
  addEventListener(){},
};
const local=new Map();
const context={
  console,document,Date,Intl,Map,Set,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
  requestAnimationFrame:fn=>fn(),queueMicrotask:fn=>fn(),setTimeout,clearTimeout,
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v))},
  navigator:{clipboard:{writeText:async()=>{}}},
  URL:{createObjectURL(){return'blob:test'},revokeObjectURL(){}},Blob:class{},FormData:class{},FileReader:class{},
  alert(){},confirm(){return true},prompt(){return null},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),
  esc:v=>String(v??''),money:v=>String(v??0),mediaUrl:v=>v,uid:()=> 'X1',
  update:async()=>{},insert:async()=>{},audit:async()=>{},load:async()=>{},toast(){},uploadFile:async()=>'',
  isMissingTableError:()=>false,checkPublicFile:async()=>true,closeCheckout(){},logout(){},
  current:null,db:{accounts:{teachers:[],libraries:[]},booklets:[],orders:[],ledger:[],teacherPayouts:[],withdrawals:[],teacherRequests:[],notifications:[]},
  checkoutBox:fakeNode(),checkoutModal:fakeNode(),teacherContent:nodes.get('teacherContent'),adminContent:nodes.get('adminContent'),
  window:null
};
context.window=context;
context.addEventListener=()=>{};
context.dispatchEvent=()=>{};
for(const name of files)vm.runInNewContext(sources[name],context,{filename:`modules/teacher/${name}.js`});
const tabs=[...context.TeacherApp.tabs.keys()];
for(const tab of ['dashboard','booklets','orders','finance','requests','review','notifications','profile'])check(tabs.includes(tab),`runtime teacher tab missing: ${tab}`);
check(typeof context.renderTeacher==='function','runtime renderTeacher missing');
check(typeof context.teacherTab==='function','runtime teacherTab missing');
check(typeof context.approveTeacherBooklet==='function','runtime approval missing');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:28,platformBytes:Buffer.byteLength(platform,'utf8'),teacherTabs:tabs},null,2));
