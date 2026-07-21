import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const platform=fs.readFileSync(path.join(root,'modules/core/platform.js'),'utf8');
const products=fs.readFileSync(path.join(root,'modules/admin/products.js'),'utf8');
const booklets=fs.readFileSync(path.join(root,'modules/admin/booklets.js'),'utf8');
const order=JSON.parse(fs.readFileSync(path.join(root,'modules/module-order.json'),'utf8'));
const failures=[];
const removed=[
  'renderProductsAdmin','renderCategoriesAdmin','addProduct','setProductStatus','editProduct','deleteProduct','refreshProductCategories',
  'addCategory','editCategory','toggleCategory','deleteCategory',
  'renderBookletsAdmin','uploadBooklet','setBookStatus','editBooklet','deleteBooklet','archiveBooklet',
  'alinV73AddProduct','alinV73EditProduct','alinV73DeleteProduct','alinV79ToggleProduct'
];
for(const name of removed){
  const patterns=[
    new RegExp(`function\\s+${name}\\s*\\(`),
    new RegExp(`(?:window\\.)?${name}\\s*=\\s*(?:${name}\\s*=\\s*)?(?:async\\s+)?function\\b`),
    new RegExp(`(?:window\\.)?${name}\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>`)
  ];
  if(patterns.some(pattern=>pattern.test(platform)))failures.push(`platform:${name}`);
}
for(const token of [
  'window.renderProductsAdmin=renderProductsAdmin','window.renderCategoriesAdmin=renderCategoriesAdmin','window.saveProduct=saveProduct',
  'window.setProductStatus=setProductStatus','window.deleteProduct=deleteProduct','window.addCategory=addCategory',
  "window.AlinAdminModules?.register?.('products',renderProductsAdmin)","window.AlinAdminModules?.register?.('categories',renderCategoriesAdmin)",
  'linkedOrders','low_stock_limit','خدمة رفع الصور غير متاحة'
])if(!products.includes(token))failures.push(`products:${token}`);
for(const token of [
  'window.renderBookletsAdmin=renderBookletsAdmin','window.saveBooklet=saveBooklet','window.setBookStatus=setBookStatus',
  'window.deleteBooklet=deleteBooklet',"window.AlinAdminModules?.register?.('booklets',renderBookletsAdmin)",
  'teacher_share_percent','ملف PDF مطلوب','orderCount'
])if(!booklets.includes(token))failures.push(`booklets:${token}`);
const app=order.app;
if(app.indexOf('modules/admin/booklets.js')<0||app.indexOf('modules/admin/products.js')<0)failures.push('module-order:catalog');
if(Buffer.byteLength(platform,'utf8')>=400000)failures.push(`platform:size:${Buffer.byteLength(platform,'utf8')}`);
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:removed.length+22,platformBytes:Buffer.byteLength(platform,'utf8'),productsBytes:Buffer.byteLength(products,'utf8'),bookletsBytes:Buffer.byteLength(booklets,'utf8')},null,2));
