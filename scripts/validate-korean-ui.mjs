import fs from "node:fs";
import path from "node:path";
const roots=["apps/web/assets","packages/permissions"];
const allowedFiles=new Set(["apps/web/assets/qrcode-vendor.js","apps/web/assets/issue-speech.js","apps/web/assets/i18n/ko.js"]);
const allowedTerms=/\b(?:GUI|Arc|Today|PWA|API|QR|PIN|URL|HTTP|CSRF|Git|Cloudflare|Pages|Workers|D1|R2|KST|Web Speech API)\b/g;
const forbidden=/\b(?:Today|Workforce|Request failed|Pending approvals?|No records?|Full screen|Connecting|Ready|Present|Latest check-in|Check in|Unassigned|Worker|Company|Trade|Implementation Status)\b/;
const files=roots.flatMap(root=>fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith(".js")).map(entry=>path.join(entry.parentPath,entry.name).replaceAll("\\","/"))).filter(file=>!allowedFiles.has(file));
const failures=[];
for(const file of files){const lines=fs.readFileSync(file,"utf8").split(/\r?\n/);lines.forEach((line,index)=>{const visible=line.replace(allowedTerms,"").replace(/(?:value|code|path|href|method|status|class|id|name|type|data-[\w-]+)\s*[:=]\s*["'`][^"'`]+["'`]/g,"");if(forbidden.test(visible))failures.push(`${file}:${index+1}: ${line.trim().slice(0,180)}`);forbidden.lastIndex=0})}
if(failures.length){console.error("사용자 화면 영어 잔존 문자열을 확인해 주세요.\n"+failures.join("\n"));process.exit(1)}
console.log(`한국어 UI 검사 통과: ${files.length}개 파일`);
