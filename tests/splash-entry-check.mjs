import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];
let checks=0;
const check=(condition,label)=>{checks++;if(!condition)failures.push(label)};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const index=read('index.html');
const css=read('styles/alin-splash.css');
const js=read('core/splash.js');
const router=read('core/device-router.js');
const sw=read('service-worker.js');
const mobileManifest=JSON.parse(read('manifest-mobile.webmanifest'));
const desktopManifest=JSON.parse(read('manifest-desktop.webmanifest'));

for(const rel of ['styles/alin-splash.css','core/splash.js','assets/images/alin-splash-desktop.webp','assets/images/alin-splash-mobile.webp']){
  check(fs.existsSync(path.join(root,rel)),`asset:${rel}`);
}
check(index.includes('id="alinSplash"')&&index.includes('جار دخول منصة آلين'),'index-splash-markup');
check(index.includes('./styles/alin-splash.css?v=2.4.1'),'index-splash-css');
check(index.includes('./core/splash.js?v=2.4.1'),'index-splash-js');
check(index.indexOf('device-router.js')<index.indexOf('splash.js'),'index-router-before-splash');
check(css.includes('@keyframes alinSplashLogo')&&css.includes('.alin-splash__logo-motion'),'css-logo-animation');
check(css.includes('@media (prefers-reduced-motion:reduce)'),'css-reduced-motion');
check(css.includes('alin-splash-mobile.webp')&&css.includes('alin-splash-desktop.webp'),'css-responsive-images');
check(js.includes('const minVisible=reduced?650:1550'),'js-bounded-duration');
check(js.includes("prefetch.rel='prefetch'")&&js.includes("prefetch.as='document'"),'js-store-prefetch');
check(js.includes("root.classList.add('is-leaving')")&&js.includes('window.setTimeout(route.go,exitDuration)'),'js-smooth-handoff');
check(router.includes('window.AlinEntryRoute=Object.freeze'),'router-api');
check(mobileManifest.start_url==='./?view=mobile','manifest-mobile-entry');
check(desktopManifest.start_url==='./?view=desktop','manifest-desktop-entry');
for(const rel of ['./styles/alin-splash.css','./core/splash.js','./assets/images/alin-splash-desktop.webp','./assets/images/alin-splash-mobile.webp']){
  check(sw.includes(`'${rel}'`),`pwa-cache:${rel}`);
}
const desktopBytes=fs.statSync(path.join(root,'assets/images/alin-splash-desktop.webp')).size;
const mobileBytes=fs.statSync(path.join(root,'assets/images/alin-splash-mobile.webp')).size;
check(desktopBytes<100_000&&mobileBytes<100_000,`images-lightweight:${desktopBytes}:${mobileBytes}`);
check(!js.includes('setInterval(')&&!css.includes('video'),'no-heavy-animation-runtime');

if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks,version:'2.4.1',assets:{desktopBytes,mobileBytes}},null,2));
