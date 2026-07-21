import fs from 'node:fs';
import vm from 'node:vm';

const platform=fs.readFileSync('modules/core/platform.js','utf8');
const runtime=fs.readFileSync('core/finance-runtime.js','utf8');
const admin=fs.readFileSync('modules/admin/finance.js','utf8');
const teacher=fs.readFileSync('modules/teacher/finance.js','utf8');
const library=fs.readFileSync('modules/library/finance.js','utf8');
const order=JSON.parse(fs.readFileSync('modules/module-order.json','utf8'));
const failures=[];
const check=(value,label)=>{if(!value)failures.push(label)};

for(const pattern of [
  /function\s+renderFinanceAdmin\s*\(/,
  /window\.renderFinanceAdmin\s*=\s*(?:async\s+)?function/,
  /function\s+ensureOrderFinancials\s*\(/,
  /window\.ensureOrderFinancials\s*=/,
  /function\s+requestWithdraw\s*\(/,
  /window\.requestWithdraw\s*=/,
  /alinApplySettlementV55/,
  /function\s+alinV6[458](?:Balance|Paid|PayBalance|LibraryDebt|AdminSettleLibrary)/,
  /window\.maybeCreateFinancialEntry\s*=/,
  /window\.renderCourierSettlementsAdmin\s*=/
])check(!pattern.test(platform),`platform finance remains: ${pattern}`);

check(order.early.includes('core/finance-runtime.js'),'finance runtime not in early module order');
check(order.early.indexOf('core/finance-runtime.js')>order.early.indexOf('modules/core/supabase.js'),'finance runtime must load after supabase');
check(order.early.indexOf('core/finance-runtime.js')<order.early.indexOf('modules/store/coupons.js'),'finance runtime must load before feature modules');
for(const token of ['canonicalLedger','librarySummary','teacherSummary','delegateSummary','persistLedger','finalizeDelivered','cancelOrder','payBalance','settleLibrary','requestWithdraw','updateWithdrawal'])check(runtime.includes(token),`finance runtime missing: ${token}`);
check((runtime.match(/window\.AlinFinance=service/g)||[]).length===1,'finance service must have one owner');
check((admin.match(/window\.renderFinanceAdmin=renderFinanceAdmin/g)||[]).length===1,'admin finance renderer must have one owner');
check(!/(oldRender|baseRender|previousRender|window\.adminTab\s*=)/.test(admin),'admin finance wrapper chain remains');
check(teacher.includes('finance()?.teacherSummary'),'teacher finance does not use finance service');
check(library.includes('finance()?.librarySummary'),'library finance does not use finance service');
check(!/function\s+alinV64LibraryDebt\s*\(/.test(library),'library redefines debt calculation');
check(!/window\.AlinV120Finance\s*=\s*\{/.test(library),'library replaces finance service facade');
check(Buffer.byteLength(platform,'utf8')<250000,`platform remains too large: ${Buffer.byteLength(platform,'utf8')}`);

const db={settings:{admin_profit_percent:20,teacher_profit_percent:50},accounts:{teachers:[{id:'T1',name:'مدرس'}],libraries:[{id:'L1',name:'مكتبة'}]},booklets:[{id:'B1',teacher_id:'T1'}],orders:[{id:'O1',order_number:'A1',kind:'booklet',item_id:'B1',library_id:'L1',total:10000,status:'completed',settlement_done:true}],ledger:[{id:'LG1',order_id:'O1',order_number:'A1',teacher_id:'T1',library_id:'L1',admin:2000,teacher:5000,library:3000,delegate:0,total:10000,settlement_status:'settled',created_at:new Date().toISOString()}],financial_payouts:[],library_settlements:[],withdrawals:[]};
const context={console,Date,Math,Object,Array,String,Number,JSON,Map,Set,RegExp,Error,Promise,window:null,document:{getElementById(){return null}},alert(){},prompt(){return null}};
context.window=context;context.db=db;context.money=String;context.uid=prefix=>`${prefix}1`;context.insert=async()=>{};context.update=async()=>{};
vm.runInNewContext(runtime,context,{filename:'core/finance-runtime.js'});
check(context.AlinFinance.teacherSummary('T1').remaining===5000,'teacher runtime balance incorrect');
check(context.AlinFinance.librarySummary('L1').debtRemaining===7000,'library runtime debt incorrect');
check(context.AlinFinance.partySummary('admin','admin').earned===2000,'admin runtime profit incorrect');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:31,platformBytes:Buffer.byteLength(platform,'utf8'),earlyModules:order.early.length}));
