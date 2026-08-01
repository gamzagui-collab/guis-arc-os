import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),skillsRoot=path.join(root,".agents","skills");
const requiredSections=["목적","사용 조건","사용하지 않는 경우","먼저 읽을 문서","예상 문제·부작용·충돌","입력","절차","변경 허용 범위","금지사항","테스트 및 검증","완료 조건","결과 보고 형식","NOT_EXECUTED 기준"];
const failures=[],warnings=[],records=[];
const fail=message=>failures.push(message),warn=message=>warnings.push(message);
const normalize=value=>value.toLowerCase().replace(/[^0-9a-z가-힣]+/g," ").trim();
const similarity=(a,b)=>{const left=new Set(normalize(a).split(" ").filter(Boolean)),right=new Set(normalize(b).split(" ").filter(Boolean));const intersection=[...left].filter(value=>right.has(value)).length,union=new Set([...left,...right]).size;return union?intersection/union:0};

if(!fs.existsSync(skillsRoot))fail("Skill root가 없습니다: .agents/skills");
else for(const entry of fs.readdirSync(skillsRoot,{withFileTypes:true}).filter(value=>value.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
 const folder=entry.name,dir=path.join(skillsRoot,folder),files=fs.readdirSync(dir),skillNames=files.filter(value=>value.toLowerCase()==="skill.md");
 if(!files.includes("SKILL.md"))fail(`${folder}: 정확한 SKILL.md가 없습니다.`);
 if(skillNames.length!==1)fail(`${folder}: SKILL.md 대소문자 또는 개수가 잘못되었습니다.`);
 if(!files.includes("SKILL.md"))continue;
 const text=fs.readFileSync(path.join(dir,"SKILL.md"),"utf8");
 const frontmatter=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);if(!frontmatter){fail(`${folder}: YAML frontmatter가 유효하지 않습니다.`);continue}
 const name=frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim(),description=frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
 if(!name)fail(`${folder}: name이 없습니다.`);if(!description)fail(`${folder}: description이 비어 있습니다.`);if(name!==folder)fail(`${folder}: name과 폴더명이 다릅니다: ${name||"없음"}`);
 if(/^[a-z0-9-]+$/.test(folder)===false)fail(`${folder}: 폴더명 형식이 잘못되었습니다.`);
 for(const section of requiredSections)if(!new RegExp(`^#{1,3}\\s+${section.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*$`,`m`).test(text))fail(`${folder}: 필수 구역 '${section}'이 없습니다.`);
 if(/[A-Z]:\\Users\\|\/Users\/[^/]+|\/home\/[^/]+/i.test(text))fail(`${folder}: 개인 사용자 절대경로가 있습니다.`);
 if(/(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_\-]{8,}/i.test(text))fail(`${folder}: Secret 형태의 값이 있습니다.`);
 if(/\brm\s+-rf\b|Remove-Item\s+[^\r\n]*-Recurse|git\s+reset\s+--hard/i.test(text))fail(`${folder}: 위험한 삭제 명령이 있습니다.`);
 if(/Production[^\r\n]{0,40}(?:자동\s*배포|deploy)/i.test(text)&&!/금지|하지 않는다|없는 Production/i.test(text))fail(`${folder}: Production 자동 배포 지시가 있습니다.`);
 for(const match of text.matchAll(/Required (file|script):\s*`([^`]+)`/g)){const target=path.resolve(root,match[2]);if(!fs.existsSync(target))fail(`${folder}: 명시적 ${match[1]} 참조가 없습니다: ${match[2]}`)}
 records.push({folder,name,description});
}

for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
 const left=records[i],right=records[j];if(left.name===right.name)fail(`중복 name: ${left.name}`);if(left.description===right.description)fail(`완전히 동일한 description: ${left.folder}, ${right.folder}`);else{const score=similarity(left.description,right.description);if(score>=0.65)warn(`높은 description 유사도 ${(score*100).toFixed(0)}%: ${left.folder}, ${right.folder}`);if(normalize(left.description).split(" ").slice(0,5).join(" ")===normalize(right.description).split(" ").slice(0,5).join(" "))warn(`동일 Trigger 표현 반복: ${left.folder}, ${right.folder}`)}}

for(const message of warnings)console.warn(`WARNING ${message}`);
if(failures.length){for(const message of failures)console.error(`FAIL ${message}`);process.exitCode=1}else console.log(`Skill validation PASS: ${records.length}개, WARNING ${warnings.length}개`);
