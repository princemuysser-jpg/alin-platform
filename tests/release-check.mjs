import fs from "node:fs";
import path from "node:path";
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const failures=[];
const pages=["index.html","store-desktop.html","store-mobile.html"];
for(const page of pages){const text=fs.readFileSync(path.join(root,page),"utf8");for(const m of text.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)){const ref=m[1];if(/^(https?:|data:|mailto:|tel:|\/\/)/.test(ref))continue;const target=path.resolve(root,ref);if(!fs.existsSync(target))failures.push(`${page}: missing ${ref}`);}}
for(const p of ["store-desktop.html","store-mobile.html"]){const t=fs.readFileSync(path.join(root,p),"utf8");if(t.includes("shared.early.bundle.js")||t.includes("shared.app.bundle.js"))failures.push(`${p}: old bundle reference`);if(!t.includes("./modules/core/config.js"))failures.push(`${p}: modules not loaded`);}
const mods=[];function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);const st=fs.statSync(p);st.isDirectory()?walk(p):p.endsWith('.js')&&mods.push(p)}}walk(path.join(root,'modules'));
if(mods.length<20)failures.push(`module count too low: ${mods.length}`);
console.log(JSON.stringify({version:'2.0.1',modules:mods.length,failures},null,2));process.exit(failures.length?1:0);
