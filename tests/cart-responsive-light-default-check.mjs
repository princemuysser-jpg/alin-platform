import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const cart=read('modules/store/cart.js');
const discovery=read('modules/store/discovery.js');
const options=read('options.js');
const mobile=read('store-mobile.html');
const desktop=read('store-desktop.html');
const mobileCss=read('styles/alin-mobile.css');
const desktopCss=read('styles/alin-desktop.css');
const checks=[];
const check=(value,name)=>{if(!value)throw new Error(name);checks.push(name)};

check(cart.includes('class="alin-cart-side-content"'),'cart-scroll-content-wrapper');
check(cart.includes("document.body?.classList.add('alin-cart-open')"),'cart-open-body-state');
check(cart.includes("document.body?.classList.remove('alin-cart-open')"),'cart-close-body-state');
check(cart.indexOf('alin-cart-side-content')<cart.indexOf('class="alin-cart-submit"'),'confirm-outside-scroll-content');

check(mobileCss.includes('body.store-mobile.alin-cart-open #checkoutModal'),'mobile-cart-modal-owner');
check(mobileCss.includes('z-index:12000!important'),'mobile-cart-above-navigation');
check(mobileCss.includes('height:calc(100dvh - 12px)!important'),'mobile-cart-viewport-height');
check(mobileCss.includes('.alin-cart-side-content{')&&mobileCss.includes('overflow:auto!important'),'mobile-cart-inner-scroll');
check(mobileCss.includes('.alin-cart-submit{')&&mobileCss.includes('flex:0 0 50px!important'),'mobile-confirm-always-visible');
check(mobileCss.includes('.alin-mobile-bottom-v103{display:none!important}'),'mobile-nav-hidden-during-cart');
check(desktopCss.includes('body.store-desktop.alin-cart-open #checkoutModal'),'desktop-cart-modal-owner');
check(desktopCss.includes('.alin-cart-side-content{flex:1 1 auto!important'),'desktop-cart-inner-scroll');
check(desktopCss.includes('.alin-cart-submit{flex:0 0 46px!important'),'desktop-confirm-fixed-area');

check(!mobile.includes('id="v99Personalized"'),'mobile-stage-section-removed');
check(!mobile.includes('مواد تناسب مرحلتك'),'mobile-stage-copy-removed');
check(desktop.includes('id="v99Personalized"'),'desktop-stage-preserved');
check(discovery.includes('if(isMobile()){root.replaceChildren();root.hidden=true;return}'),'mobile-stage-runtime-guard');

check(options.includes("const validThemes = ['light', 'dark'];"),'theme-only-light-dark');
check(options.includes(": 'light';")&&options.includes("mode = 'light';"),'light-default-and-fallback');
check(!options.includes('data-theme="system"'),'system-theme-control-removed');
check(!options.includes("prefers-color-scheme: dark"),'system-theme-listener-removed');
for(const [name,html] of [['mobile',mobile],['desktop',desktop]]){
  check(html.includes('data-alin-theme="light" data-alin-theme-mode="light"'),`${name}-light-html-default`);
  check(html.includes("localStorage.getItem('alin_theme_v234')==='dark'?'dark':'light'"),`${name}-early-theme-bootstrap`);
  check(html.includes('<meta content="#f8f3e8" name="theme-color"/>'),`${name}-light-theme-color`);
  check(html.includes('version-badge">v2.3.5'),`${name}-version-badge`);
}

console.log(JSON.stringify({ok:true,checks:checks.length,version:'2.3.5'},null,2));
