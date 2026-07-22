import fs from 'node:fs';
import vm from 'node:vm';

const coreSource=fs.readFileSync('modules/courier/core.js','utf8');
const assignmentSource=fs.readFileSync('modules/courier/assignment.js','utf8');
const dashboardSource=fs.readFileSync('modules/courier/dashboard.js','utf8');
const source=coreSource+'\n;\n'+assignmentSource+'\n;\n'+dashboardSource;
const sql=fs.readFileSync('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql','utf8');
const check=fs.readFileSync('CHECK_SUPABASE_READINESS_v2_1_8.sql','utf8');
const code=source;
const failures=[];
const assert=(ok,msg)=>{if(!ok)failures.push(msg)};

const document={readyState:'complete',querySelector(){return null},querySelectorAll(){return[]},addEventListener(){}};
const window={db:{accounts:{all:[],couriers:[]},couriers:[],orders:[],notifications:[]},couriers:[],courierSettlements:[],addEventListener(){}};
const context={window,document,console,setTimeout,clearTimeout,setInterval,clearInterval,confirm:()=>true,prompt:()=>'',alert:()=>{},navigator:{onLine:true},CustomEvent:class{}};
context.globalThis=context;context.db=window.db;context.current=null;
vm.createContext(context);vm.runInContext(code,context);
const api=context.window.AlinCourierDashboard;
assert(api?.version==='2.3.9','api:version');
for(const [status,column] of [['assigned','assigned_at'],['accepted','accepted_at'],['picked_up','picked_up_at'],['out_for_delivery','out_for_delivery_at'],['completed','delivered_at'],['rejected','rejected_at']]){
  const values=api.workflowValues(status);
  assert(values.status===status,`payload:${status}:status`);
  assert(Boolean(values[column]),`payload:${status}:${column}`);
  assert(Boolean(values.updated_at),`payload:${status}:updated_at`);
}
assert(api.workflowValues('assigned').assignment_status==='assigned','payload:assignment-status');
assert(api.workflowValues('accepted').assignment_status==='accepted','payload:accepted-status');
assert(api.workflowValues('completed').assignment_status==='completed','payload:completed-status');
let invalid=false;try{api.workflowValues('bad_status')}catch{invalid=true}
assert(invalid,'payload:invalid-rejected');
for(const token of ['drop constraint if exists orders_status_valid','add constraint orders_status_valid','orders_assignment_status_valid','انتقال حالة الطلب غير مسموح للمندوب','assigned_at timestamptz','accepted_at timestamptz','picked_up_at timestamptz','out_for_delivery_at timestamptz','rejected_at timestamptz'])assert(sql.includes(token),`sql:${token}`);
const migrationDrop=sql.indexOf('drop trigger if exists alin_orders_protect_update on public.orders;',sql.indexOf('-- v2.1.8: ترقية آمنة لجدول الطلبات.'));
const firstOrderDataUpdate=sql.indexOf('update public.orders',migrationDrop);
const triggerRestore=sql.indexOf('create trigger alin_orders_protect_update before update on public.orders',firstOrderDataUpdate);
assert(migrationDrop>=0,'sql:migration-trigger-drop');
assert(firstOrderDataUpdate>migrationDrop,'sql:trigger-dropped-before-data-update');
assert(triggerRestore>firstOrderDataUpdate,'sql:trigger-restored-after-data-update');
for(const token of ['assignment_status','assigned_at','accepted_at','picked_up_at','out_for_delivery_at','rejected_at','orders_status_valid(v2.1.8)'])assert(check.includes(token),`check:${token}`);
assert(!source.includes("alert(error.message||'تعذر تحويل الطلب')"),'ui:no-raw-assign-error');
assert(!source.includes("alert(error.message||'تعذر تحديث الطلب')"),'ui:no-raw-status-error');


// Execute the real admin assignment and courier acceptance handlers and inspect their database payloads.
{
  const calls=[];
  const order={id:'O1',status:'new',delivery_area:'عرفة',fulfillment_type:'home_delivery',title:'طلب',total:8000};
  const adminContent={innerHTML:''};
  const document2={
    readyState:'complete',
    querySelector(selector){
      if(selector.includes('input[name="v216assign_O1"]:checked'))return {value:'C1'};
      return null;
    },
    querySelectorAll(){return[]},
    addEventListener(){}
  };
  const window2={
    current:{role:'admin',id:'A1'},
    db:{accounts:{all:[{id:'C1',role:'courier',name:'علي',areas:['عرفة'],status:'active'}],couriers:[{id:'C1',role:'courier',name:'علي',areas:['عرفة'],status:'active'}]},couriers:[],orders:[order],notifications:[]},
    couriers:[],courierSettlements:[],addEventListener(){}
  };
  const context2={window:window2,document:document2,console,setTimeout,clearTimeout,setInterval,clearInterval,confirm:()=>true,prompt:()=>'',alert:()=>{},navigator:{onLine:true},CustomEvent:class{},CSS:{escape:value=>String(value)},adminContent,esc:value=>String(value??''),money:value=>String(value??0),toast(){},audit:async()=>{},load:async()=>{},update:async(table,values,where)=>{calls.push({table,values,where});Object.assign(order,values)}};
  context2.globalThis=context2;context2.db=window2.db;context2.current=window2.current;
  vm.createContext(context2);vm.runInContext(code,context2);
  const assignedOk=await context2.window.alinV164Assign('O1');
  assert(assignedOk===true,'handler:assign-success');
  assert(calls[0]?.values?.status==='assigned','handler:assign-status');
  assert(calls[0]?.values?.assigned_at,'handler:assign-time');
  assert(calls[0]?.values?.courier_id==='C1','handler:assign-courier');
  const acceptedOk=await context2.window.alinV164CourierStep('O1','accepted');
  assert(acceptedOk===true,'handler:accept-success');
  assert(calls[1]?.values?.status==='accepted','handler:accept-status');
  assert(calls[1]?.values?.accepted_at,'handler:accept-time');
}

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:44},null,2));
