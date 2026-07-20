import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const failures=[];
const platform=read('modules/core/platform.js');
const auth=read('modules/core/cloud-status-ui.js');
const discovery=read('modules/store/discovery.js');
const pwa=read('core/pwa-register.js');
if(!platform.includes('function openPage(page,options)')||!platform.includes("if(options?.render!==false)renderAll()"))failures.push('openPage:render-control');
if(!auth.includes("window.openPage(targetPage,{render:false})")||!auth.includes("window.openPage(target,{render:false})"))failures.push('auth:single-render-open');
if(!auth.includes('logoutPromise')||!auth.includes('explicitSignOut')||!auth.includes("event==='SIGNED_OUT'&&!explicitSignOut"))failures.push('logout:single-transition-guard');
if(!auth.includes("await window.load()")||!auth.includes("window.openPage('store',{render:false})"))failures.push('public-store:load-before-open');
if(!discovery.includes("window.ALIN_CONFIG?.authEnabled!==true")||discovery.includes("setupWrappers();if((isDesktop()||isMobile())&&typeof openPage==='function')openPage('store')"))failures.push('discovery:auth-race');
if(pwa.includes('location.reload')||pwa.includes("addEventListener('controllerchange'"))failures.push('pwa:forced-reload');
if(platform.includes('ALIN V97 RESCUE: observer-free stabilization'))failures.push('startup:obsolete-rescue');
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:7},null,2));
