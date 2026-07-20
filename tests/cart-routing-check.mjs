import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'modules/core/cloud-status-ui.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'RUN_ON_SUPABASE_v2_1_1_COMPLETE.sql'),'utf8');
const failures=[];

for(const token of [
  'function normalizeCheckoutItems(lines)',
  "gifts:'product'",
  "stationary:'product'",
  "const items=normalizeCheckoutItems(cart)",
  "line.id=id;line.kind=canonical"
]) if(!app.includes(token)) failures.push(`client:${token}`);

for(const token of [
  "when 'gifts' then 'gift'",
  "when 'stationary' then 'stationery'",
  "العنصر المطلوب غير موجود أو حُذف من المتجر",
  "select to_jsonb(x) from public.products x where x.id::text=$1 limit 1 for update"
]) if(!sql.includes(token)) failures.push(`sql:${token}`);

if(sql.includes("v_kind not in ('booklet','product','stationery','gift')")) failures.push('sql:legacy-kind-whitelist');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,cases:['gift','gifts','stationery','stationary','product','booklet','reversed-legacy-cart']},null,2));
