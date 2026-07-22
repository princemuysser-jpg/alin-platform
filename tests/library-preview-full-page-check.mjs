import fs from 'node:fs';
const js=fs.readFileSync('modules/library/printing.js','utf8');
const css=fs.readFileSync('styles/alin-shared.css','utf8');
const checks=[
  ['preview creates aspect-ratio surface',js.includes("surface.className='alin-print-v119-surface'")],
  ['surface preserves PDF page ratio',js.includes('surface.style.aspectRatio=')],
  ['canvas is nested inside surface',js.includes('surface.appendChild(canvas)')],
  ['loading status is forcibly hidden',js.includes("status.style.display='none'")],
  ['grid rows keep full page height',css.includes('grid-auto-rows:max-content!important')],
  ['surface has relative layout',css.includes('.alin-print-v119-surface{')&&css.includes('position:relative!important')],
  ['canvas fills full surface',css.includes('.alin-print-v119-surface canvas{')&&css.includes('height:100%!important')],
  ['hidden status override exists',css.includes('.alin-print-v119-status[hidden]{display:none!important}')]
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length)process.exit(1);
console.log(`Library preview full-page checks passed: ${checks.length}`);
