import fs from "node:fs";
import path from "node:path";
const root=path.join(process.cwd(),".agents","skills"),expected=["guis-arc-work","guis-arc-debug","guis-arc-data-change","guis-arc-deploy","guis-arc-release"].sort();
const actual=fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(root,entry.name,"SKILL.md"))).map(entry=>entry.name).sort();
if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`Expected five project skills, found: ${actual.join(", ")}`);
for(const name of expected){const text=fs.readFileSync(path.join(root,name,"SKILL.md"),"utf8"),match=text.match(/^---\r?\nname:\s*([^\r\n]+)\r?\ndescription:\s*([^\r\n]+)\r?\n---/);if(!match||match[1]!==name||!match[2].startsWith("Use when "))throw new Error(`Invalid skill metadata: ${name}`);if(/[A-Z]:\\Users\\|\/Users\/|\/home\//i.test(text))throw new Error(`Personal path in ${name}`);if(/git\s+reset\s+--hard|rm\s+-rf/i.test(text))throw new Error(`Destructive command in ${name}`)}
console.log("Skill validation PASS: 5");
