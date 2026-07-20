import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const storeSource=fs.readFileSync(new URL('../modules/store/coupons.js',import.meta.url),'utf8');
const adminSource=fs.readFileSync(new URL('../modules/admin/coupons.js',import.meta.url),'utf8');

function makeElement(value=''){
  return {value,disabled:false,textContent:'',innerHTML:'',dataset:{},hidden:false,scrollIntoView(){}};
}
function makeContext(initialCoupons=[]){
  const state={alerts:[],toasts:[],insertCalls:0,updateCalls:0,rows:initialCoupons.map(x=>({...x}))};
  const elements={
    adminContent:makeElement(),couponAdminCode:makeElement(),couponAdminType:makeElement('percent'),couponAdminValue:makeElement('10'),
    couponAdminLimit:makeElement('0'),couponAdminExpiry:makeElement(''),couponAdminApplies:makeElement('all'),couponAdminStatus:makeElement('active'),
    couponAdminSave:makeElement(),couponAdminSearch:makeElement(),couponAdminList:makeElement(),couponInput:makeElement(),couponMsg:makeElement(),
  };
  const context={
    console,window:null,Date,setTimeout,clearTimeout,
    document:{getElementById:id=>elements[id]||null,querySelectorAll:()=>[],body:{contains:()=>true}},
    navigator:{clipboard:{writeText:async()=>{}}},
    db:{coupons:state.rows},
    esc:v=>String(v??''),money:v=>String(v??0),uid:()=>`CP-${Date.now()}`,
    alert:msg=>state.alerts.push(String(msg)),confirm:()=>true,prompt:()=>'',toast:msg=>state.toasts.push(String(msg)),audit:async()=>{},
    query:async table=>table==='coupons'?state.rows.map(x=>({...x})):[],
    insert:async(_table,row)=>{state.insertCalls++;state.rows.push({...row});return row},
    update:async(_table,payload,filter)=>{state.updateCalls++;const row=state.rows.find(x=>String(x.id)===String(filter.id));if(row)Object.assign(row,payload);return row},
    removeRow:async(_table,filter)=>{state.rows=state.rows.filter(x=>String(x.id)!==String(filter.id));context.db.coupons=state.rows},
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(storeSource,context,{filename:'store/coupons.js'});
  vm.runInContext(adminSource,context,{filename:'admin/coupons.js'});
  return {context,state,elements};
}

{
  const {context,state,elements}=makeContext([{id:'CP-1',code:'ALIN20',status:'active'}]);
  context.renderCouponsAdmin();elements.couponAdminCode.value=' alin20 ';elements.couponAdminValue.value='10';
  await context.saveCoupon();
  assert.equal(state.insertCalls,0);assert.match(state.alerts.at(-1)||'',/موجود مسبقًا/);
}
{
  const {context,state,elements}=makeContext([]);
  context.renderCouponsAdmin();elements.couponAdminCode.value=' NEW 20 ';elements.couponAdminValue.value='10';
  await Promise.all([context.saveCoupon(),context.saveCoupon()]);
  assert.equal(state.insertCalls,1);assert.equal(state.rows[0].code,'NEW20');assert.equal(context.db.coupons.some(c=>c.code==='NEW20'),true);
  assert.match(elements.adminContent.innerHTML,/NEW20/);
}
{
  const {context,elements}=makeContext([{id:'CP-1',code:'SAVE10',discount_type:'percent',discount_value:10,status:'active',used_count:0,max_uses:0}]);
  assert.equal(context.validCoupon(' save10 ')?.id,'CP-1');
  elements.couponInput.value='save10';await context.checkCoupon();assert.match(elements.couponMsg.textContent,/تم تطبيق كوبون/);
}
console.log('Coupon checks passed: single store service, admin save, duplicate prevention, list refresh.');
