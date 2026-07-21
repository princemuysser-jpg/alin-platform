import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../core/finance-runtime.js',import.meta.url),'utf8');
const calls=[];
const db={
  settings:{admin_profit_percent:20,teacher_profit_percent:50},
  accounts:{libraries:[{id:'L1',name:'مكتبة الاختبار'}],teachers:[{id:'T1',name:'مدرس الاختبار'}]},
  booklets:[{id:'B1',teacher_id:'T1'}],
  orders:[{id:'O1',order_number:'AL-1',kind:'booklet',item_id:'B1',library_id:'L1',qty:2,total:10000,status:'new',status_history:[]}],
  ledger:[],permits:[],library_settlements:[],teacherPayouts:[],teacher_payouts:[],withdrawals:[]
};
let serial=0;
const window={
  db,current:{role:'admin',id:'A1'},
  uid(prefix){serial++;return `${prefix}-${serial}`},
  async insert(table,row){calls.push(['insert',table,structuredClone(row)]);const map={permits:'permits',ledger:'ledger',financial_payouts:'financialPayouts',library_settlements:'librarySettlements',withdrawals:'withdrawals'};const key=map[table];if(key){db[key]=db[key]||[];if(!db[key].some(x=>String(x.id)===String(row.id)))db[key].unshift(row)}return row},
  async update(table,payload,where){calls.push(['update',table,structuredClone(payload),structuredClone(where)]);const list=table==='orders'?db.orders:table==='ledger'?db.ledger:[];const row=list.find(x=>String(x.id)===String(where.id));if(row)Object.assign(row,payload);return row},
  async audit(){},async load(){},renderLibrary(){},renderOrdersAdmin(){},toast(){},
  money(v){return String(v)},esc(v){return String(v)},
  prompt(){return null},alert(){},
  adminTab(){},teacherTab(){}
};
const document={readyState:'complete',addEventListener(){},getElementById(){return null},querySelectorAll(){return []}};
const context=vm.createContext({window,document,console,alert:window.alert,setTimeout,clearTimeout,structuredClone,Date,Math,Object,Array,String,Number,JSON,Map,Set,RegExp,Error,Promise});
vm.runInContext(source,context,{filename:'finance-runtime.js'});
const finance=window.AlinFinanceV207;
assert.ok(finance,'finance runtime exported');

await finance.setOrderStatus('O1','processing','admin');
assert.equal(db.ledger.length,0,'processing must not create finance ledger');

await finance.setOrderStatus('O1','completed','admin');
assert.equal(db.ledger.length,1,'completed order creates one ledger row');
assert.equal(db.permits.length,1,'booklet delivery creates one print permit');
assert.equal(db.orders[0].settlement_done,true,'order settlement flag saved');
assert.equal(db.ledger[0].settlement_status,'settled','ledger finalized');
assert.equal(db.ledger[0].admin+db.ledger[0].teacher+db.ledger[0].library+db.ledger[0].delegate,10000,'shares equal order total');

await finance.setOrderStatus('O1','completed','admin');
assert.equal(db.ledger.length,1,'repeated completion does not duplicate ledger');
assert.equal(db.permits.length,1,'repeated completion does not duplicate permit');

let library=finance.librarySummary('L1');
assert.equal(library.debtTotal,7000,'library debt excludes its own profit');
assert.equal(library.debtRemaining,7000,'initial library debt is outstanding');

db.library_settlements.push({id:'S-pending',library_id:'L1',amount:7000,status:'pending'});
library=finance.librarySummary('L1');
assert.equal(library.debtRemaining,7000,'pending settlement must not reduce debt');

db.library_settlements.push({id:'S-paid',library_id:'L1',amount:7000,status:'received'});
library=finance.librarySummary('L1');
assert.equal(library.debtRemaining,0,'received settlement clears debt');

let teacher=finance.teacherSummary('T1');
assert.equal(teacher.earned,5000,'teacher earns only from delivered ledger');
assert.equal(teacher.remaining,5000,'teacher current balance is correct');

db.teacherPayouts.push({id:'TP1',teacher_id:'T1',amount:5000,status:'paid'});
teacher=finance.teacherSummary('T1');
assert.equal(teacher.remaining,0,'teacher payout clears current balance');

window.prompt=()=> 'اختبار الإلغاء';
await finance.setOrderStatus('O1','cancelled','admin');
assert.equal(db.ledger[0].settlement_status,'cancelled','cancelled delivery cancels ledger');
assert.equal(db.ledger[0].total,0,'cancelled delivery removes financial total');
assert.equal(finance.teacherSummary('T1').earned,0,'cancelled delivery is excluded from teacher earnings');
assert.equal(finance.librarySummary('L1').debtTotal,0,'cancelled delivery is excluded from library debt');

console.log(JSON.stringify({ok:true,checks:18,calls:calls.length}));
