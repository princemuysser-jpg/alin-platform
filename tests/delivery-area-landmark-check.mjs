import fs from 'node:fs';
import vm from 'node:vm';

const cart=fs.readFileSync('modules/store/cart.js','utf8');
const routing=fs.readFileSync('modules/store/order-routing.js','utf8');
const delivery=fs.readFileSync('modules/store/delivery.js','utf8');
const courierCore=fs.readFileSync('modules/courier/core.js','utf8');
const courierDashboard=fs.readFileSync('modules/courier/dashboard.js','utf8');
const courier=courierCore+'\n;\n'+courierDashboard;
const adminOrders=fs.readFileSync('modules/admin/orders.js','utf8');

const failures=[];
const assert=(ok,msg)=>{if(!ok)failures.push(msg)};

assert(cart.includes('<select id="deliveryArea" required>'),'cart:area-select');
assert(!cart.includes('id="deliveryAddress"'),'cart:address-field-removed');
assert(cart.includes('id="deliveryLandmark"'),'cart:landmark-field');
assert(routing.includes("const area=value('deliveryArea'),landmark=value('deliveryLandmark')"),'routing:area-landmark-only');
assert(!routing.includes("value('deliveryAddress')"),'routing:no-address-read');
assert(routing.includes('delivery_address:null'),'routing:null-address');
assert(routing.includes("delivery_location_source:latitude?'student_device':'landmark'"),'routing:location-source');
assert(!delivery.includes('العنوان الكامل'),'delivery:no-full-address-copy');
assert(delivery.includes("const oldAddress=$('#deliveryAddress',root);if(oldAddress)oldAddress.remove()"),'delivery:legacy-address-removal');
assert(courier.includes('window.alinNormalizeDeliveryArea'),'courier:area-normalizer');
assert(courier.includes('delivery_location_url||o.delivery_map_url'),'courier:gps-url');
assert(!courier.includes('<small>العنوان</small>'),'courier:no-address-label');
assert(!courier.includes('العنوان ونقطة الدلالة'),'courier:no-address-landmark-label');
assert(adminOrders.includes('<small>المنطقة</small>')&&adminOrders.includes('<small>أقرب نقطة دالة</small>'),'admin:area-landmark-details');

const helperMatch=courier.match(/window\.alinNormalizeDeliveryArea=window\.alinNormalizeDeliveryArea\|\|function\(value\)\{[\s\S]*?\n  \};/);
assert(Boolean(helperMatch),'courier:normalizer-source');
const helperContext={window:{}};
vm.createContext(helperContext);
if(helperMatch)vm.runInContext(helperMatch[0],helperContext);
assert(helperContext.window.alinNormalizeDeliveryArea('عرفة - العين دار — جامع نور الرحمن')==='عرفة','normalizer:legacy-combined-area');
assert(helperContext.window.alinNormalizeDeliveryArea('  عرفة   ')==='عرفة','normalizer:spaces');

const elements={
  deliveryArea:{value:'عرفة'},deliveryLandmark:{value:'قرب جامع نور الرحمن'},
  deliveryLatitude:{value:'35.46'},deliveryLongitude:{value:'44.39'},
  deliveryLocationUrl:{value:'https://maps.google.com/?q=35.46,44.39'},deliveryLocationAccuracy:{value:'12'},
  libSelect:{value:''}
};
const context={
  window:{cart:[{kind:'product'}],db:{settings:{delivery_fee:2000}}},
  document:{getElementById:id=>elements[id]||null,querySelector:()=>({value:'home_delivery'})},
  CustomEvent:class{},console
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(routing,context);
const route=context.window.alinOrderExtra();
assert(route.delivery_area==='عرفة','route:area');
assert(route.delivery_landmark==='قرب جامع نور الرحمن','route:landmark');
assert(route.delivery_address===null,'route:address-null');
assert(route.delivery_location_url.includes('maps.google.com'),'route:gps-kept');
assert(route.delivery_fee===2000,'route:delivery-fee');

elements.deliveryArea.value='';
let threw=false;try{context.window.alinOrderExtra()}catch(e){threw=String(e.message).includes('اختر منطقة التوصيل')}
assert(threw,'route:area-required');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:20},null,2));
