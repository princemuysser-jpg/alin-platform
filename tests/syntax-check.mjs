import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folders=['modules','core','store'];
const files=[];
for(const folder of folders){
  const base=path.join(root,folder);
  const walk=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())walk(full);
      else if(entry.name.endsWith('.js'))files.push(full);
    }
  };
  walk(base);
}
const failures=[];
for(const file of files){
  try{new Function(fs.readFileSync(file,'utf8'));}
  catch(error){failures.push({file:path.relative(root,file),error:error.message});}
}
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,files:files.length}));
