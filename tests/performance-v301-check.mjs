import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const failures=[];let checks=0;const check=(value,label)=>{checks++;if(!value)failures.push(label)};
const cloud=read('modules/core/supabase.js');
check(cloud.includes('const PUBLIC_TABLES=['),'cloud:public-table-set');
check(cloud.includes('const ROLE_TABLES={'),'cloud:role-table-set');
check(cloud.includes('function tablesForRole('),'cloud:role-table-selector');
check(cloud.includes("role:role||'public'"),'cloud:status-role');
check(cloud.includes('selectedTables.map'),'cloud:selected-only-load');
check(!cloud.includes('Promise.all(TABLES.map'),'cloud:no-all-table-public-load');
check(cloud.includes('const TABLE_LIMITS={'),'cloud:large-table-limits');
const auth=read('modules/core/auth-service.js');
const publicOpen=auth.indexOf("window.openPage('store',{render:true})");
const publicLoad=auth.indexOf("window.load({reason:'public-boot'})");
check(publicOpen>=0&&publicLoad>publicOpen,'auth:cached-store-first');
check(auth.includes("window.load({reason:'session-boot'})"),'auth:role-load-reason');
const sw=read('service-worker.js');
check(sw.includes("alin-v3.0.1-performance"),'sw:version');
check(sw.includes('staleWhileRevalidate'),'sw:stale-while-revalidate');
check(sw.includes('fetchWithTimeout'),'sw:navigation-timeout');
const coreBlock=sw.match(/const CORE=\[([\s\S]*?)\];/)?.[1]||'';
check(!coreBlock.includes('alin-app-desktop'),'sw:no-desktop-app-precache');
check(!coreBlock.includes('alin-app-mobile'),'sw:no-mobile-app-precache');
check(!coreBlock.includes('desktop.bundle.css'),'sw:no-desktop-css-precache');
check(!coreBlock.includes('mobile.bundle.css'),'sw:no-mobile-css-precache');
for(const html of ['store-desktop.html','store-mobile.html']){
  const src=read(html);
  check(src.includes('v3.0.1'),`${html}:version`);
  check(src.includes('3500'),`${html}:boot-fallback`);
  check(src.includes('rel="preconnect" href="https://cdn.jsdelivr.net"'),`${html}:cdn-preconnect`);
}
if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,version:'3.0.1',checks},null,2));
