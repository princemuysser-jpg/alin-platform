import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../modules/admin/marketing.js',import.meta.url),'utf8');

function makeContext(initialCoupons=[]){
  const state={alerts:[],toasts:[],insertCalls:0,updateCalls:0,rows:[...initialCoupons]};
  const button={disabled:false,textContent:'إضافة الكوبون'};
  const context={
    console,
    window:null,
    document:{
      getElementById:id=>id==='v140CouponSaveBtn'?button:null,
      body:{contains:node=>node===button},
      querySelectorAll:()=>[],
    },
    adminContent:{innerHTML:'',scrollIntoView(){}},
    db:{banners:[]},
    v19Coupons:state.rows,
    esc:v=>String(v??''),
    money:v=>String(v??0),
    uid:()=>`CP-${Date.now()}`,
    alert:msg=>state.alerts.push(String(msg)),
    confirm:()=>true,
    prompt:()=>'',
    toast:msg=>state.toasts.push(String(msg)),
    audit:async()=>{},
    load:async()=>{},
    query:async table=>table==='coupons'?[...state.rows]:[],
    insert:async(_table,row)=>{state.insertCalls+=1;state.rows.push(row);context.v19Coupons=state.rows;return row;},
    update:async(_table,payload,filter)=>{state.updateCalls+=1;const row=state.rows.find(x=>String(x.id)===String(filter.id));if(row)Object.assign(row,payload);return row;},
    removeRow:async()=>{},
    uploadFile:async()=>'',
    mediaUrl:v=>v,
    adminTab:()=>{},
    markAdminTab:()=>{},
    navigator:{clipboard:{writeText:async()=>{}}},
    v140CpCode:{value:''},
    v140CpValue:{value:'10'},
    v140CpType:{value:'percent'},
    v140CpLimit:{value:'0'},
    v140CpExpiry:{value:''},
    v140CpApplies:{value:'all'},
    v140CpStatus:{value:'active'},
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'marketing.js'});
  return {context,state,button};
}

{
  const {context,state}=makeContext([{id:'CP-1',code:'ALIN20'}]);
  context.v140CpCode.value=' alin20 ';
  await context.saveCouponV140();
  assert.equal(state.insertCalls,0,'duplicate coupon must not insert');
  assert.match(state.alerts.at(-1)||'',/موجود مسبقًا/,'duplicate must show Arabic message');
}

{
  const {context,state}=makeContext([]);
  context.v140CpCode.value=' NEW 20 ';
  await Promise.all([context.saveCouponV140(),context.saveCouponV140()]);
  assert.equal(state.insertCalls,1,'double click must create one coupon only');
  assert.equal(state.rows[0].code,'NEW20','coupon code must be normalized');
}

{
  const {context,state}=makeContext([{id:'CP-1',code:'ALIN20',discount_type:'percent',discount_value:10,status:'active'}]);
  context.editCouponV140('CP-1');
  context.v140CpCode.value='alin20';
  context.v140CpValue.value='15';
  await context.saveCouponV140();
  assert.equal(state.updateCalls,1,'editing the same coupon code must update');
  assert.equal(state.insertCalls,0,'editing must not insert');
}

console.log('Coupon admin checks passed: duplicate prevention, normalization, single-save guard, edit flow.');
