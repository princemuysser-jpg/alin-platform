import fs from 'node:fs';

const failures=[];
const assert=(ok,msg)=>{if(!ok)failures.push(msg)};
const files={
  core:'modules/courier/core.js',
  admin:'modules/courier/admin.js',
  areas:'modules/courier/areas.js',
  assignment:'modules/courier/assignment.js',
  dashboard:'modules/courier/dashboard.js'
};
const source=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,fs.readFileSync(path,'utf8')]));
const bytes=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,fs.statSync(path).size]));

for(const path of Object.values(files))assert(fs.existsSync(path),`missing:${path}`);
assert(bytes.dashboard<20000,'dashboard:size');
assert(bytes.core<15000,'core:size');
assert(bytes.admin<13000,'admin:size');
assert(bytes.assignment<8000,'assignment:size');
assert(bytes.areas<5000,'areas:size');

for(const token of ['function allCouriers','function areasOf','function workflowValues','function refreshCourierData','window.AlinCourierCore=Object.freeze'])assert(source.core.includes(token),`core:${token}`);
for(const token of ['function renderCouriersAdmin','window.alinV161SaveCourier','window.renderCouriersAdmin=renderCouriersAdmin'])assert(source.admin.includes(token),`admin:${token}`);
for(const token of ['function renderCourierAreasAdmin','window.alinV161AddArea','window.renderCourierAreasAdmin=renderCourierAreasAdmin'])assert(source.areas.includes(token),`areas:${token}`);
for(const token of ['function renderDeliveryOrdersAdmin','window.alinV164Assign','window.assignCourier=assignCourier'])assert(source.assignment.includes(token),`assignment:${token}`);
for(const token of ['function renderCourierDashboard','window.alinV164CourierStep','window.AlinCourierDashboard=Object.freeze'])assert(source.dashboard.includes(token),`dashboard:${token}`);

assert(!source.dashboard.includes('function renderCouriersAdmin'),'dashboard:no-admin');
assert(!source.dashboard.includes('function renderCourierAreasAdmin'),'dashboard:no-areas');
assert(!source.dashboard.includes('function renderDeliveryOrdersAdmin'),'dashboard:no-assignment');
assert(!source.admin.includes('function renderCourierDashboard'),'admin:no-dashboard');
assert(!source.assignment.includes('function renderCourierDashboard'),'assignment:no-dashboard');

const order=JSON.parse(fs.readFileSync('modules/module-order.json','utf8'));
const app=order.app;
const indexes=Object.values(files).map(path=>app.indexOf(path));
assert(indexes.every(index=>index>=0),'order:all-loaded');
assert(indexes.every((value,index)=>index===0||value>indexes[index-1]),'order:correct');
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(htmlName,'utf8');
  const positions=Object.values(files).map(path=>html.indexOf(`./${path}?v=2.3.9`));
  assert(positions.every(value=>value>=0),`html:${htmlName}:all-loaded`);
  assert(positions.every((value,index)=>index===0||value>positions[index-1]),`html:${htmlName}:order`);
}
const worker=fs.readFileSync('service-worker.js','utf8');
for(const path of Object.values(files))assert(worker.includes(`'./${path}'`),`pwa:${path}`);

if(failures.length){console.error(JSON.stringify({ok:false,failures,bytes},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:31,bytes},null,2));
