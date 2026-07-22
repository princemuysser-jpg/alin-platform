import fs from 'node:fs';
const platform=fs.readFileSync('modules/core/platform.js','utf8');
const cart=fs.readFileSync('modules/store/cart.js','utf8');
const routing=fs.readFileSync('modules/store/order-routing.js','utf8');
const courier=fs.readFileSync('modules/courier/dashboard.js','utf8');
const delivery=fs.readFileSync('modules/store/delivery.js','utf8');
const cloud=fs.readFileSync('modules/core/checkout-service.js','utf8');
const failures=[];
const names=['openCart','openCheckout','addToCart','cartSave','cartQty','cartRemove','renderCartBadge','confirmCartCheckout','alinOrderExtra','toggleDeliveryFields'];
for(const name of names){
  const patterns=[new RegExp(`function\\s+${name}\\b`),new RegExp(`window\\.${name}\\s*=`),new RegExp(`^\\s*${name}\\s*=\\s*(?:async\\s+)?function`,'m')];
  if(patterns.some(pattern=>pattern.test(platform)))failures.push(`platform:${name}`);
}
for(const name of ['openCart','openCheckout','addToCart','cartSave','cartQty','cartRemove','renderCartBadge','toggleDeliveryFields']){
  if(!new RegExp(`function\\s+${name}\\b`).test(cart))failures.push(`cart:missing:${name}`);
}
for(const name of ['confirmCartCheckout','alinOrderExtra']){
  if(!new RegExp(`function\\s+${name}\\b`).test(routing))failures.push(`routing:missing:${name}`);
}
if(/window\.alinOrderExtra\s*=/.test(courier))failures.push('courier:route-override');
if(/window\.openCart\s*=|window\.toggleDeliveryFields\s*=/.test(delivery))failures.push('delivery:cart-wrapper');
if(/window\.confirmCartCheckout\s*=secureCheckout/.test(cloud))failures.push('cloud:checkout-override');
if(!cart.includes("dispatch('alin:cart-rendered'")||!routing.includes("CustomEvent('alin:order-created'"))failures.push('events:missing');
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,platformBytes:Buffer.byteLength(platform),cartBytes:Buffer.byteLength(cart),routingBytes:Buffer.byteLength(routing),functions:names.length},null,2));
