import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const platform=read('modules/core/platform.js');
const ui=read('modules/core/ui.js');
const storage=read('modules/core/storage.js');
const settings=read('modules/admin/settings.js');
const branding=read('modules/admin/branding.js');
const backup=read('modules/admin/backup.js');
const student=read('modules/store/student-auth.js');
const health=read('modules/admin/system-health.js');
const order=JSON.parse(read('modules/module-order.json'));
const sw=read('service-worker.js');
const failures=[];let checks=0;
const check=(value,label)=>{checks++;if(!value)failures.push(label)};

check(Buffer.byteLength(platform,'utf8')<20000,'platform-not-small-core');
for(const pattern of [
  /function\s+(?:uploadFile|ensureStorageReady|mediaUrl|checkPublicFile|safeFileName)\s*\(/,
  /function\s+(?:renderSettingsAdmin|settingsSet|saveAdminSecurity)\s*\(/,
  /function\s+(?:applyBrand|applyBrandV28|uploadBrandFile)\s*\(/,
  /function\s+(?:currentStudent|studentLogin|studentCreate)\s*\(/,
  /alinV71Backup|adminPassOk|manualPayInfoHtml|ALIN V81|ALIN V92|ALIN V93/
])check(!pattern.test(platform),`platform-legacy:${pattern}`);
for(const token of ['window.AlinRuntime=Object.freeze','function init()','function renderAll()','function requireConnection()','PLATFORM STEP 12'])check(platform.includes(token),`platform-core:${token}`);

for(const [source,tokens,prefix] of [
  [ui,['window.AlinUI=Object.freeze','esc:escapeHtml','money:formatMoney','copyText'],'ui'],
  [storage,['window.AlinStorage=Object.freeze','async function uploadFile(','async function alinResolveStoredFile(','Object.assign(window,{ensureStorageReady'],'storage'],
  [settings,["register?.('settings',render)",'ALINAuth.updateAccountFromAdmin','ALINAuth.resetPasswordFromAdmin','async function settingsSet'],'settings'],
  [branding,["register?.('brandIdentity',render)",'async function saveIdentity(','async function uploadBrandFile(','window.AlinBrand=Object.freeze'],'branding'],
  [backup,["register?.('backup',render)",'async function restoreSafe(','const RESTORABLE=','window.AlinBackup=Object.freeze'],'backup'],
  [student,['window.AlinStudentAuth=Object.freeze','function currentStudent()','function openStudentAuth('],'student']
])for(const token of tokens)check(source.includes(token),`${prefix}:${token}`);

for(const source of [settings,branding,backup,health])check(!/(?:const|let|var)\s+(?:base|previous|oldAdminTab)\s*=\s*window\.adminTab|window\.adminTab\s*=/.test(source),'admin-router-wrapper-remains');
check(!branding.includes("};sync();"),'branding-recursive-preview');
check(!health.includes('jyavewwlgiaibtdqyzpd.supabase.co'),'health-hardcoded-url');
check(health.includes('window.ALIN_CONFIG?.supabaseUrl'),'health-central-config');

const all=[...order.early,...order.app];
for(const rel of ['modules/core/ui.js','modules/core/storage.js','modules/store/student-auth.js'])check(all.includes(rel),`module-order:${rel}`);
check(all.indexOf('modules/core/ui.js')<all.indexOf('modules/core/platform.js'),'ui-before-platform');
check(all.indexOf('modules/core/platform.js')<all.indexOf('modules/core/storage.js'),'platform-before-storage');
check(all.indexOf('modules/core/storage.js')<all.indexOf('modules/admin/branding.js'),'storage-before-branding');
for(const rel of ['modules/core/ui.js','modules/core/storage.js','modules/store/student-auth.js'])check(sw.includes(`'./${rel}'`),`service-worker:${rel}`);

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,platformBytes:Buffer.byteLength(platform,'utf8'),modules:all.length},null,2));
