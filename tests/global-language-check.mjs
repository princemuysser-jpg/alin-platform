import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const checks=[];
const check=(value,name)=>{if(!value)throw new Error(name);checks.push(name)};
const store=new Map([['alin_language_v110','ar']]);
const html={lang:'ar',dir:'rtl',dataset:{}};
const body={dir:'rtl',classList:{toggle(){}}};
const context={
  console,
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},
  document:{readyState:'loading',documentElement:html,body,addEventListener(){},createTreeWalker:null},
  MutationObserver:undefined,
  CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},
  alert(){},confirm(){return true},prompt(){return null},
  addEventListener(){},dispatchEvent(){},setTimeout,clearTimeout
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'modules/core/i18n.js'),'utf8'),context);
const i18n=context.AlinI18n;
check(i18n&&typeof i18n.t==='function','service-export');
check(i18n.t('الإعدادات','en')==='Settings','admin-settings-en');
check(i18n.t('الإعدادات','ku')==='ڕێکخستنەکان','admin-settings-ku');
check(i18n.t('لوحة المدرس','en')==='Teacher dashboard','teacher-page-en');
check(i18n.t('لوحة المكتبة','ku')==='داشبۆردی کتێبخانە','library-page-ku');
check(i18n.t('صفحة المندوب','en')==='Courier page','courier-page-en');
check(i18n.t('المالية','ku')==='دارایی','finance-ku');
check(i18n.t('طلبات التوصيل','en')==='Delivery orders','delivery-orders-en');
check(i18n.t('5 طلبات','en').includes('orders'),'dynamic-order-count');
check(i18n.formatMoney(12500,'en').includes('IQD'),'money-en');
check(i18n.direction('en')==='ltr'&&i18n.direction('ku')==='rtl','directions');
i18n.setLanguage('en',{emit:false});
check(html.lang==='en'&&html.dir==='ltr','document-language-en');
i18n.setLanguage('ku',{emit:false});
check(html.lang==='ckb'&&html.dir==='rtl','document-language-ku');
check(Object.keys(i18n.dictionaries.en).length>200,'dictionary-coverage-en');
check(Object.keys(i18n.dictionaries.ku).length>200,'dictionary-coverage-ku');
const order=JSON.parse(fs.readFileSync(path.join(root,'modules/module-order.json'),'utf8'));
check(order.early.includes('modules/core/i18n.js'),'module-order');
for(const htmlName of ['store-desktop.html','store-mobile.html']){
  const source=fs.readFileSync(path.join(root,htmlName),'utf8');
  check(source.includes('./modules/core/i18n.js?v=2.3.5'),`${htmlName}-script`);
  check(source.includes('./styles/alin-i18n.css?v=2.3.5'),`${htmlName}-style`);
  check(source.indexOf('modules/core/i18n.js')<source.indexOf('modules/core/ui.js'),`${htmlName}-early-load`);
}
const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
check(serviceWorker.includes("'./modules/core/i18n.js'")&&serviceWorker.includes("'./styles/alin-i18n.css'"),'pwa-cache');
const source=fs.readFileSync(path.join(root,'modules/core/i18n.js'),'utf8');
for(const role of ['لوحة المدير','لوحة المدرس','لوحة المكتبة','صفحة المندوب','المحاسب'])check(source.includes(`'${role}'`),`role-${role}`);
console.log(JSON.stringify({ok:true,checks:checks.length,version:'2.3.5'},null,2));
