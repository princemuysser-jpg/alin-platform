import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];const required=[
  'index.html','store-desktop.html','store-mobile.html','service-worker.js','VERSION','package.json',
  'ALIN_V3_PRODUCTION_MASTER.sql','dist/alin-core.v3.js','dist/alin-app-desktop.v3.js','dist/alin-app-mobile.v3.js',
  'modules/core/config.js','modules/core/platform.js','modules/core/supabase.js','modules/core/auth-service.js',
  'modules/store/student-auth.js','modules/admin/backup.js','modules/admin/accounts-advanced.js',
  'supabase/functions/_shared/admin.ts','supabase/functions/_shared/cors.ts'
];
for(const rel of required)if(!fs.existsSync(path.join(root,rel)))failures.push(`missing:${rel}`);
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();if(version!=='3.0.1-performance-unified')failures.push(`version:${version}`);
for(const name of ['store-desktop.html','store-mobile.html']){
  const html=fs.readFileSync(path.join(root,name),'utf8');
  if(!html.includes('v3.0.1'))failures.push(`html-version:${name}`);
  for(const match of html.matchAll(/(?:src|href)="(\.\/?[^"#?]+)(?:\?[^\"]*)?"/g)){
    const rel=match[1].replace(/^\.\//,'');if(!fs.existsSync(path.join(root,rel)))failures.push(`asset:${name}:${rel}`);
  }
}
const sql=fs.readFileSync(path.join(root,'ALIN_V3_PRODUCTION_MASTER.sql'),'utf8');
if((sql.match(/\bbegin\s*;/gi)||[]).length!==(sql.match(/\bcommit\s*;/gi)||[]).length)failures.push('sql:transaction-count');
if(!sql.includes("'3.0.0-production-unified'"))failures.push('sql:version-marker');
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,version,required:required.length},null,2));
