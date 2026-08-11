import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=(file)=>fs.readFileSync(file,"utf8");

test("Codex startup files enforce minimal-scope work",()=>{
  const agents=read("AGENTS.md"),rules=read("DEVELOPMENT_RULES.md"),version=read("VERSION.md");
  for(const token of ["VERSION.md","AIOS/PROJECT_STATE.md","DEVELOPMENT_RULES.md","관련 파일만","Production"])assert.ok(agents.includes(token));
  for(const token of ["최소 범위 수정","저장소 전체 분석","수동 파일 병합","외부 Skill 안전정책"])assert.ok(rules.includes(token));
 assert.match(version,/GUI_Arc_Integrated_v0\.27\.1_Integrated\.zip/);
 assert.match(version,/GUI_Arc_Integrated_v0\.27\.1_Integrated\.zip\.sha256/);
});

test("official package includes startup rule files",()=>{
  const pack=read("scripts/package-integrated.mjs");
  for(const file of ["AGENTS.md","DEVELOPMENT_RULES.md","VERSION.md"])assert.ok(pack.includes(file));
});
