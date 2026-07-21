import fs from 'node:fs';
import vm from 'node:vm';

const platform=fs.readFileSync('modules/core/platform.js','utf8');
const ordersModule=fs.readFileSync('modules/admin/orders.js','utf8');
const failures=[];
const check=(condition,label)=>{if(!condition)failures.push(label)};

for(const pattern of [
  /function\s+renderOrdersAdmin\s*\(/,
  /(?:window\.)?renderOrdersAdmin\s*=\s*(?:renderOrdersAdmin\s*=\s*)?function/,
  /function\s+orderStatus\s*\(/,
  /(?:window\.)?orderStatus\s*=\s*(?:orderStatus\s*=\s*)?(?:async\s+)?function/,
  /function\s+devPay\s*\(/,
  /function\s+viewPaymentReceipt\s*\(/,
  /alinV71RenderOrdersAdminBase/,
  /_renderOrdersAdminV(?:25|29)/
])check(!pattern.test(platform),`platform legacy remains: ${pattern}`);

for(const token of [
  'window.renderOrdersAdmin=render',
  'window.adminOrderStatus=changeStatus',
  'window.orderStatus=changeStatus',
  'window.adminOrderAssign=assign',
  'window.adminOrderDetails=details',
  "statusPatch(order,'assigned')",
  'assigned_at',
  'assignment_status',
  'status_history',
  'deductStockOnce',
  'ensureOrderFinancials',
  'alinV57SettleOrder',
  'matchingCouriers',
  'delivery_landmark',
  'adminOrdersExport'
])check(ordersModule.includes(token),`orders module missing: ${token}`);
check(!/(oldTab|baseAdminTab|wrapped=function|window\.adminTab\s*=)/.test(ordersModule),'orders module wraps adminTab');
check(platform.length<370000,`platform remains too large: ${platform.length}`);

const elements=new Map();
const adminContent={innerHTML:'',dataset:{}};
const modalClassList={add(){},remove(){}};
elements.set('adminContent',adminContent);
elements.set('adminOrderDetailsModal',{classList:modalClassList});
elements.set('adminOrderDetailsBox',{innerHTML:''});
const document={
  getElementById:id=>elements.get(id)||null,
  querySelectorAll:()=>[],
  querySelector:()=>null,
  createElement:tag=>({tagName:tag.toUpperCase(),className:'',id:'',innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){}},appendChild(){},remove(){},click(){}}),
  body:{appendChild(el){if(el.id)elements.set(el.id,el)}}
};
const updateCalls=[];
const auditCalls=[];
const context={
  console,document,localStorage:{getItem(){return null},setItem(){}},setTimeout,clearTimeout,
  Blob:class{},URL:{createObjectURL(){return'blob:test'},revokeObjectURL(){}},
  alert:message=>{throw new Error(`unexpected alert: ${message}`)},prompt:()=>null,confirm:()=>true,
  db:{
    orders:[{id:'O1',order_number:'AL-1',kind:'product',item_id:'P1',title:'هدية',student_name:'محمد',student_phone:'0770',qty:2,total:8000,status:'new',status_history:[],fulfillment_type:'home_delivery',delivery_area:'عرفة',delivery_landmark:'جامع',delivery_fee:1000}],
    products:[{id:'P1',name:'هدية',stock:10}],
    accounts:{libraries:[{id:'L1',name:'مكتبة'}],couriers:[{id:'C1',name:'مندوب عرفة',status:'active',areas:['عرفة']}]},couriers:[]
  },
  current:{name:'المدير'},money:v=>String(v),
  update:async(table,patch,where)=>{updateCalls.push({table,patch,where});const row=context.db[table]?.find?.(x=>String(x.id)===String(where.id));if(row)Object.assign(row,patch)},
  load:async()=>{},audit:async(...args)=>auditCalls.push(args),toast:()=>{},
  ensureOrderFinancials:async()=>{},alinV57SettleOrder:async()=>{},
  window:null
};
context.window=context;
vm.runInNewContext(ordersModule,context,{filename:'modules/admin/orders.js'});
check(typeof context.renderOrdersAdmin==='function','renderOrdersAdmin not exported');
context.renderOrdersAdmin();
check(adminContent.innerHTML.includes('إدارة الطلبات'),'orders page did not render');
check(adminContent.innerHTML.includes('AL-1'),'sample order missing from render');
await context.adminOrderStatus('O1','processing');
check(updateCalls.some(x=>x.table==='orders'&&x.patch.status==='processing'),'processing status not written');
check(updateCalls.some(x=>x.table==='products'&&x.patch.stock===8),'stock not deducted once');
elements.set('v220AssignLibrary',{value:''});
elements.set('v220AssignCourier',{value:'C1'});
await context.adminOrderAssign('O1');
check(updateCalls.some(x=>x.table==='orders'&&x.patch.courier_id==='C1'&&x.patch.delegate_id==='C1'&&x.patch.status==='assigned'&&x.patch.assignment_status==='assigned'&&x.patch.assigned_at),'courier assignment payload incomplete');
check(auditCalls.length>=2,'order audit not recorded');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:26,platformBytes:platform.length,ordersBytes:ordersModule.length,updates:updateCalls.length},null,2));
