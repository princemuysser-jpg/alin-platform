import fs from 'node:fs';
import vm from 'node:vm';

const platform=fs.readFileSync('modules/core/platform.js','utf8');
const dashboard=fs.readFileSync('modules/library/dashboard.js','utf8');
const orders=fs.readFileSync('modules/library/orders.js','utf8');
const finance=fs.readFileSync('modules/library/finance.js','utf8');
const printing=fs.readFileSync('modules/library/printing.js','utf8');
const failures=[];
const check=(ok,label)=>{if(!ok)failures.push(label)};

for(const pattern of [
  /function\s+renderLibrary\s*\(/,
  /(?:window\.)?renderLibrary\s*=\s*(?:renderLibrary\s*=\s*)?(?:async\s+)?function/,
  /function\s+libraryOrderStatus\s*\(/,
  /(?:window\.)?libraryOrderStatus\s*=\s*(?:libraryOrderStatus\s*=\s*)?(?:async\s+)?function/,
  /function\s+openLibraryBookletPdf\s*\(/,
  /(?:window\.)?openLibraryBookletPdf\s*=\s*(?:openLibraryBookletPdf\s*=\s*)?(?:async\s+)?function/,
  /alinV71RenderLibraryBase/,
  /ALIN V86 — library dashboard fix/i,
  /ALIN V95 — library settlement/i
])check(!pattern.test(platform),`platform legacy library remains: ${pattern}`);

check((dashboard.match(/window\.renderLibrary=render/g)||[]).length===1,'library render must have one owner');
check((orders.match(/window\.libraryOrderStatus=libraryOrderStatus/g)||[]).length===1,'library order status must have one owner');
check(!finance.includes('window.libraryOrderStatus='),'finance overrides library order status');
check(printing.includes('window.openLibraryBookletPdf=openPreview'),'printing service not exported directly');
check(printing.includes('window.AlinLibraryModules.openLibraryBookletPdf=openPreview'),'printing module registry missing');
check(Buffer.byteLength(platform,'utf8')<330000,`platform remains too large: ${Buffer.byteLength(platform,'utf8')}`);

const rpcCalls=[];
const auditCalls=[];
const context={
  console,Date,
  current:{role:'library',id:'L1',name:'مكتبة آلين'},
  db:{orders:[{id:'O1',order_number:'AL-1',library_id:'L1',status:'new',status_history:[],total:5000}]},
  sb:{async rpc(name,args){
    rpcCalls.push({name,args});
    const order=context.db.orders[0];
    order.status=args.p_status;
    if(args.p_status==='completed')order.payment_status='paid';
    return {data:{ok:true,order:{...order},finance:args.p_status==='completed'?{gross:5000,library:1500,debt:3500}:null},error:null};
  }},
  audit:async(...args)=>auditCalls.push(args),
  load:async()=>{},
  window:null,
  document:{getElementById(){return null}}
};
context.window=context;
vm.runInNewContext(orders,context,{filename:'modules/library/orders.js'});
check(typeof context.libraryOrderStatus==='function','libraryOrderStatus not exported');
await context.libraryOrderStatus('O1','processing');
await context.libraryOrderStatus('O1','ready');
await context.libraryOrderStatus('O1','completed');
check(context.db.orders[0].status==='completed','library workflow did not complete');
check(context.db.orders[0].payment_status==='paid','library completion did not mark paid');
check(rpcCalls.length===3,'library workflow must use one RPC per transition');
check(rpcCalls.every(call=>call.name==='alin_library_set_order_status'),'unexpected library workflow RPC');
check(auditCalls.length===3,'library workflow audit incomplete');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:19,platformBytes:Buffer.byteLength(platform,'utf8'),libraryDashboardBytes:Buffer.byteLength(dashboard,'utf8'),rpcCalls:rpcCalls.length},null,2));
