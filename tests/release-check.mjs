import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const pages = ["index.html", "store-desktop.html", "store-mobile.html"];

for (const page of pages) {
  const text = fs.readFileSync(path.join(root, page), "utf8");
  for (const match of text.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)) {
    const ref = match[1];
    if (/^(https?:|data:|mailto:|tel:|\/\/)/.test(ref)) continue;
    const cleanRef = ref.split(/[?#]/, 1)[0];
    if (!fs.existsSync(path.resolve(root, cleanRef))) failures.push(`${page}: missing ${ref}`);
  }
}

for (const page of ["store-desktop.html", "store-mobile.html"]) {
  const text = fs.readFileSync(path.join(root, page), "utf8");
  if (text.includes("shared.early.bundle.js") || text.includes("shared.app.bundle.js")) {
    failures.push(`${page}: old bundle reference`);
  }
  if (!text.includes("./modules/core/config.js")) failures.push(`${page}: modules not loaded`);
  if (!text.includes("v=2.0.3")) failures.push(`${page}: stale cache-buster version`);
}

const scripts = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file);
    else if (file.endsWith(".js")) scripts.push(file);
  }
}
walk(root);

for (const file of scripts) {
  try {
    // Browser files are loaded as classic scripts, so parse them using classic-script semantics.
    new Function(fs.readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`${path.relative(root, file)}: syntax error: ${error.message}`);
  }
}

const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (version !== "2.0.3" || pkg.version !== version) failures.push("VERSION and package.json are inconsistent");

console.log(JSON.stringify({
  version,
  modules: scripts.filter(file => file.includes(`${path.sep}modules${path.sep}`)).length,
  scriptsChecked: scripts.length,
  failures,
}, null, 2));
process.exit(failures.length ? 1 : 0);
