import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const accounts=read('modules/admin/accounts.js');
const advanced=read('modules/admin/accounts-advanced.js');
const cloud=read('modules/core/account-admin-service.js');
const courierBridge=read('modules/admin/couriers.js');
const createFn=read('supabase/functions/admin-create-account/index.ts');
const updateFn=read('supabase/functions/admin-update-account/index.ts');
const sql=read('RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql');
const check=read('CHECK_SUPABASE_READINESS_v2_1_8.sql');
const failures=[];
const expect=(condition,name)=>{if(!condition)failures.push(name)};

expect(accounts.includes('id="v163CourierAreaPicker"'),'add picker');
expect(accounts.includes('onchange="v131SyncAccountRole()"'),'role switch');
expect(accounts.includes('v131CourierAreasSelectAll'),'select all');
expect(accounts.includes('اختر منطقة عمل واحدة على الأقل')===false,'validation remains centralized');
expect(advanced.includes('id="v132CourierAreaPicker"'),'edit picker');
expect(advanced.includes("areas:role==='courier'?selectedAreas:undefined"),'edit payload areas');
expect(advanced.includes("area:role==='courier'?(selectedAreas[0]||'')"),'edit primary area');
expect(cloud.includes('const selectedAreas=['),'create selected areas');
expect(cloud.includes('areas:selectedAreas'),'create payload areas');
expect(cloud.includes("if(role==='courier'&&!payload.areas.length)"),'create validation');
expect(!courierBridge.includes('oldAddAccount'),'no addAccount wrapper');
expect(!courierBridge.includes('oldRenderAccounts'),'no render wrapper');
expect(createFn.includes('const requestedAreas'),'edge create areas');
expect(createFn.includes('area: primaryArea'),'edge account primary area');
expect(updateFn.includes('const requestedAreas'),'edge update areas');
expect(updateFn.includes('areas,'),'edge courier update areas');
expect(sql.includes("add column areas text[]"),'database areas column');
expect(sql.includes("v_jwt_role='service_role'"),'service role trigger support');
expect(check.includes('column:public.couriers.areas'),'readiness column check');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:19},null,2));
