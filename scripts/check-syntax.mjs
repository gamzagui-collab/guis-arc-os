import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const roots=["worker","apps","packages","scripts","tests"];
const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(/\.(m?js)$/.test(file))files.push(file);
  }
}
for(const root of roots)walk(root);
for(const file of files){
  const result=spawnSync(process.execPath,["--check",file],{stdio:"inherit"});
  if(result.status)process.exit(result.status);
}
console.log(`Syntax checked ${files.length} modules.`);
