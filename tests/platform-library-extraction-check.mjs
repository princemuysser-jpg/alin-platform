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

const updateCalls=[];
const auditCalls=[];
const context={
  console,Date,
  current:{role:'library',id:'L1',name:'مكتبة آلين'},
  db:{orders:[{id:'O1',order_number:'AL-1',library_id:'L1',status:'new',status_history:[],total:5000}]},
  update:async(table,payload,where)=>{updateCalls.push({table,payload,where});Object.assign(context.db.orders[0],payload)},
  audit:async(...args)=>auditCalls.push(args),
  load:async()=>{},
  ensureOrderFinancials:async()=>{context.financials=(context.financials||0)+1},
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
check(context.financials===1,'library financials not recorded once');
check(updateCalls.length===3,'library workflow wrote unexpected number of updates');
check(auditCalls.length===3,'library workflow audit incomplete');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:19,platformBytes:Buffer.byteLength(platform,'utf8'),libraryDashboardBytes:Buffer.byteLength(dashboard,'utf8'),updates:updateCalls.length},null,2));
