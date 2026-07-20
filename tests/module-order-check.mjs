import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const order=JSON.parse(fs.readFileSync(path.join(root,'modules/module-order.json'),'utf8'));
const files=[...order.early,...order.app];
const source=files.map(rel=>fs.readFileSync(path.join(root,rel),'utf8')).join('\n;\n');
new Function(source);
console.log(JSON.stringify({ok:true,modules:files.length,bytes:Buffer.byteLength(source)}));
