import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const platform = read('modules/core/platform.js');
const discovery = read('modules/store/discovery.js');
const banners = read('store/banners.js');
const features = read('modules/core/features.js');
const desktop = read('store-desktop.html');
const mobile = read('store-mobile.html');

const failures = [];
const check = (ok, label) => { if (!ok) failures.push(label); };

check(Buffer.byteLength(platform) < 120000, 'platform-size-not-reduced');
check(!/function\s+(renderStore|storeItems|setStoreType)\s*\(/.test(platform), 'platform-function-owner-remains');
check(!/window\.(renderStore|storeItems|setStoreType)\s*=/.test(platform), 'platform-window-owner-remains');
check(!/(^|[^\w.])(renderStore|storeItems|setStoreType)\s*=\s*(?:async\s*)?(?:function|\()/.test(platform), 'platform-assignment-owner-remains');
check(!platform.includes('ALIN V72 MODERN STUDENT STOREFRONT'), 'legacy-v72-remains');
check(!platform.includes('ALIN V76 REAL STORE CARD FIX'), 'legacy-v76-remains');
check(!platform.includes('ALIN V77 CART-FIRST STORE FLOW'), 'legacy-v77-remains');
check(!platform.includes('ALIN V88 REAL BOOKLET MODAL FIX'), 'legacy-v88-remains');
check(!platform.includes('ALIN V90 REAL STORE STATISTICS FIX'), 'legacy-v90-remains');
check(!platform.includes('ALIN V97 FAVORITE HEART SYNC FIX'), 'legacy-v97-remains');

check((discovery.match(/window\.renderStore\s*=\s*renderStore/g) || []).length === 1, 'render-owner-count');
check((discovery.match(/window\.storeItems\s*=\s*currentStoreItems/g) || []).length === 1, 'items-owner-count');
check((discovery.match(/window\.setStoreType\s*=\s*setStoreType/g) || []).length === 1, 'type-owner-count');
check(discovery.includes('window.AlinStorefront=Object.freeze'), 'storefront-service-missing');
check(discovery.includes("new CustomEvent('alin:store-rendered'"), 'store-render-event-missing');
check(discovery.includes("data-v99-action=\"details\""), 'details-action-missing');
check(discovery.includes('function matches(x)'), 'search-filter-missing');
check(discovery.includes('function sorted(rows)'), 'sort-missing');
check(discovery.includes('window.v99OpenDetails='), 'details-owner-missing');

check(!/window\.renderStore\s*=/.test(banners), 'banner-render-wrapper-remains');
check(banners.includes("alin:store-rendered"), 'banner-render-event-missing');
check(!/window\.renderStore\s*=/.test(features), 'features-render-wrapper-remains');

for (const [name, html] of [['desktop', desktop], ['mobile', mobile]]) {
  check(html.includes('./modules/store/discovery.js?v=2.3.4'), `${name}-discovery-version`);
  check(html.indexOf('./modules/core/platform.js?v=2.3.4') < html.indexOf('./modules/store/discovery.js?v=2.3.4'), `${name}-load-order`);
  check(html.includes('oninput="renderStore()"'), `${name}-search-hook`);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  checks: 27,
  platformBytes: Buffer.byteLength(platform),
  discoveryBytes: Buffer.byteLength(discovery),
  renderOwners: 1
}, null, 2));
