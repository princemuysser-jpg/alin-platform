import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve(new URL('..',import.meta.url).pathname);let failures=[];
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(root).filter(f=>!f.includes('/.git/'));
for(const f of files.filter(f=>f.endsWith('.html'))){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)){const u=m[1];if(/^(https?:|\/\/|data:|mailto:|tel:)/.test(u))continue;const target=path.resolve(path.dirname(f),u);if(!fs.existsSync(target))failures.push(`Missing ${u} from ${path.relative(root,f)}`)}}
for(const f of files.filter(f=>f.endsWith('.js')&&!f.endsWith('shared.early.bundle.js'))){try{new Function(fs.readFileSync(f,'utf8'))}catch(e){failures.push(`JS syntax ${path.relative(root,f)}: ${e.message}`)}}
const desktop=fs.readFileSync(path.join(root,'store-desktop.html'),'utf8');
const mobile=fs.readFileSync(path.join(root,'store-mobile.html'),'utf8');
for(const [name,html] of [['desktop',desktop],['mobile',mobile]]){
  if(!html.includes('id="alinStoreBanners"'))failures.push(`${name}: banner host missing`);
  if(!html.includes('./store/banners.js?v=2.0.1.3'))failures.push(`${name}: canonical banner JS missing`);
  if(!html.includes('./store/banners.css?v=2.0.1.3'))failures.push(`${name}: canonical banner CSS missing`);
  if(html.indexOf('id="alinStoreBanners"')>html.indexOf('class="alin98-cats"'))failures.push(`${name}: banner host is not above categories`);
}
if(fs.existsSync(path.join(root,'store/banners-final.js'))||fs.existsSync(path.join(root,'store/banners-final.css')))failures.push('obsolete banner-final files still exist');
const legacy=fs.readFileSync(path.join(root,'dist/js/shared.early.bundle.js'),'utf8');
if(legacy.includes('ALIN V96 ADMIN BANNER UPLOAD')||legacy.includes('alinV96SaveBanner'))failures.push('legacy V96 banner patch still present');

const bannerJs=fs.readFileSync(path.join(root,'store/banners.js'),'utf8');
const bannerCss=fs.readFileSync(path.join(root,'store/banners.css'),'utf8');
for(const required of ['alin-store-banner__media','alin-store-banner__content','alin-store-banner__copy'])if(!bannerJs.includes(required))failures.push(`responsive banner markup missing: ${required}`);
if(bannerJs.indexOf('alin-store-banner__media')>bannerJs.indexOf('alin-store-banner__content'))failures.push('banner text is not rendered below image');
for(const required of ['aspect-ratio:16/5','aspect-ratio:16/9','flex-direction:column','white-space:pre-line'])if(!bannerCss.includes(required))failures.push(`responsive banner CSS missing: ${required}`);
if(/\.alin-store-banner__image\{[^}]*position:absolute/s.test(bannerCss))failures.push('banner image still uses overlay layout');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');if(!sw.includes('alin-v2.0.1-step1.3'))failures.push('service worker version mismatch');if(sw.includes('banners-final'))failures.push('service worker still caches obsolete banner files');
const sql=fs.readFileSync(path.join(root,'RUN_ON_SUPABASE_v2_0_1_COMPLETE.sql'),'utf8');
for(const required of ['alin-files','alin_banners_admin_insert','banners_public_read','image_path','sort_order'])if(!sql.includes(required))failures.push(`SQL banner/storage setup missing: ${required}`);
if(/grant select on public\.coupons to anon/i.test(sql))failures.push('coupon table exposed to anon');if(!sql.includes('alin_validate_coupon'))failures.push('coupon validation RPC missing');if(!/drop policy if exists coupons_admin_read on public\.coupons;/i.test(sql))failures.push('coupons_admin_read policy is not idempotent');
const out={version:'2.0.1-step1.3',files:files.length,sha256:crypto.createHash('sha256').update(files.map(f=>path.relative(root,f)).sort().join('\n')).digest('hex'),failures};console.log(JSON.stringify(out,null,2));process.exit(failures.length?1:0);
