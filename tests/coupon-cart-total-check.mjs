import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function storage(){
  const data=new Map();
  return {getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),clear:()=>data.clear()};
}

const elements=new Map();
const listeners=new Map();
const document={
  readyState:'complete',
  getElementById:id=>elements.get(id)||null,
  addEventListener:(name,handler)=>{const list=listeners.get(name)||[];list.push(handler);listeners.set(name,list)},
  dispatchEvent:event=>{for(const handler of listeners.get(event.type)||[])handler(event)},
  querySelector:()=>null,
  querySelectorAll:()=>[],
};
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const context={console,document,CustomEvent,localStorage:storage(),sessionStorage:storage(),setTimeout,clearTimeout,alert:()=>{}};
context.window=context;
context.db={
  booklets:[{id:'B1',title:'ملزمة اختبار',price:5000,status:'published'}],
  products:[],accounts:{libraries:[]},settings:{},
  coupons:[{id:'CP1',code:'ALIN20',discount_type:'percent',discount_value:20,status:'active',used_count:0,max_uses:0}],
};
context.money=value=>Number(value||0).toLocaleString('en-US');
context.esc=value=>String(value??'');
context.toast=()=>{};
context.query=async table=>table==='coupons'?context.db.coupons:[];
vm.createContext(context);
for(const file of ['modules/store/coupons.js','modules/store/cart.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}

assert.equal(context.addToCart('booklet','B1',2),true);
for(const id of ['cartSubtotalValue','cartDiscountValue','cartFinalValue','couponMsg'])elements.set(id,{textContent:'',value:'',hidden:false});
elements.set('cartDiscountRow',{hidden:true});
elements.set('couponInput',{value:'alin20',textContent:'',hidden:false});
await context.checkCoupon();

assert.equal(context.cartPricing().subtotal,10000);
assert.equal(context.cartPricing().discount,2000);
assert.equal(context.cartPricing().total,8000);
assert.match(elements.get('cartSubtotalValue').textContent,/10,000/);
assert.match(elements.get('cartDiscountValue').textContent,/2,000/);
assert.match(elements.get('cartFinalValue').textContent,/8,000/);
assert.equal(elements.get('cartDiscountRow').hidden,false);
assert.match(elements.get('couponMsg').textContent,/الخصم 2,000 د\.ع/);
context.cart[0].qty=3;context.cartSave();context.renderCartPricing();
assert.equal(context.cartPricing().subtotal,15000);
assert.equal(context.cartPricing().discount,3000);
assert.equal(context.cartPricing().total,12000);
elements.get('couponInput').value='INVALID';await context.checkCoupon();
assert.equal(context.cartPricing().discount,0);
assert.equal(context.cartPricing().total,15000);
console.log('Coupon cart totals: 12 checks passed.');
