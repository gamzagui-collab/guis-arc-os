import fs from "node:fs";
const read=file=>fs.readFileSync(file,"utf8");
const required=["AGENTS.md","VERSION.md","DEVELOPMENT_RULES.md","README.md","AIOS/PROJECT_STATE.md","AIOS/NEXT_TASK.md",...["work","debug","data-change","deploy","release"].map(name=>`.agents/skills/guis-arc-${name}/SKILL.md`)];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
for(const file of["AIOS/00_PROJECT.md","AIOS/12_NEXT_CHAT.md","docs/98_NEXT_CHAT_HANDOFF.md","docs/99_START_NEXT_CHAT.md"])if(fs.existsSync(file))throw new Error(`Retired startup file remains: ${file}`);
for(const [file,token] of[["package.json",'"version": "0.27.1"'],["package-lock.json",'"version": "0.27.1"'],["wrangler.integration.toml",'APP_VERSION = "0.27.1"'],["worker/version.js",'VERSION="0.27.1"'],["apps/web/assets/version.js",'VERSION="0.27.1"'],["apps/web/assets/app.js","issues.js?v=0.27.1-r38"],["apps/web/index.html","v0.27.1"],["apps/web/service-worker.js","guis-arc-integrated-v0.27.1-r38-shell"]])if(!read(file).includes(token))throw new Error(`Version surface mismatch: ${file}`);
if(JSON.parse(read("apps/web/manifest.webmanifest")).version!=="0.27.1")throw new Error("PWA manifest version mismatch");
for(const [file,max] of[["AGENTS.md",50],["DEVELOPMENT_RULES.md",80],["AIOS/PROJECT_STATE.md",30],["AIOS/NEXT_TASK.md",15]])if(read(file).split(/\r?\n/).length>max)throw new Error(`${file} exceeds ${max} lines`);
console.log("Integrated v0.27.1 lean validation passed.");
