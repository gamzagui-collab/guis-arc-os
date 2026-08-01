import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=file=>fs.readFileSync(file,"utf8");
const skills=["guis-arc-review","guis-arc-implement","guis-arc-verify","guis-arc-deploy","guis-arc-package"];

test("AGENTS routes current truth through project state and minimal rules",()=>{
 const agents=read("AGENTS.md"),rules=read("DEVELOPMENT_RULES.md");
 for(const token of["AIOS/PROJECT_STATE.md","DEVELOPMENT_RULES.md","전체 `docs/`를 읽지",".agents/skills","현재 사용자의 명시적 요청","VERSION.md`와 실제 코드"])assert.ok(agents.includes(token),token);
 for(const token of["외부 Skill 안전정책","Secret","환경변수","파일 삭제","네트워크 전송","Integration 또는 Production"])assert.ok(rules.includes(token),token);
});

test("project state records current baseline modules historical conflicts and gaps",()=>{
 const state=read("AIOS/PROJECT_STATE.md");
 for(const token of["v0.24.4 `DEPLOYED`","GUI_Arc_Integrated_v0.24.4_Integrated.zip","455A993C035AD55722DEC5D71324158894159E11BEB3860BD3F98BDBD5560BA8","0027_issue_assignment_type.sql","OPERATIONAL_VERIFICATION_PENDING","현재 모듈 상태","폐기되었거나 더 이상 기준이 아닌 내용","알려진 제한과 검증 공백","문서 충돌 및 정리 필요 항목","다음 작업"])assert.ok(state.includes(token),token);
 for(const module of["인증·계정·권한","Today","Issue","Workforce","Construction","Safety","Quality","Admin","R2 업로드","월간 공사일보","월간계획","공사 Today 카드","Construction Engine"])assert.ok(state.includes(`| ${module} |`),module);
 assert.match(state,/Quality \| `PARTIAL`/);
 assert.match(state,/Browser E2E \| .*`NOT_EXECUTED`/);
});

test("historical AIOS and handoff files cannot present themselves as current truth",()=>{
 for(const file of["AIOS/00_PROJECT.md","AIOS/12_NEXT_CHAT.md","docs/98_NEXT_CHAT_HANDOFF.md","docs/99_START_NEXT_CHAT.md"]){
  const value=read(file);
  assert.match(value,/^# HISTORICAL — 현재 기준 아님/);
  assert.match(value,/PROJECT_STATE\.md|NEXT_TASK\.md|AGENTS\.md/);
 }
 const next=read("AIOS/NEXT_TASK.md");
 assert.match(next,/직영 단건 배정 검증/);
 assert.match(next,/Revision·Idempotency·Audit 실제 원격 검증/);
 assert.match(next,/신규 Codex 세션에서 Skill Trigger 자동 선택 검증/);
 assert.match(next,/새 릴리스나 다음 작업이 확정되면 전체 내용을 현재 사실로 교체/);
});

test("five project skills contain trigger exclusions workflow guardrails completion and reporting",()=>{
 for(const name of skills){
  const path=`.agents/skills/${name}/SKILL.md`;
  assert.equal(fs.existsSync(path),true,path);
  const value=read(path);
  assert.match(value,new RegExp(`^---\\nname: ${name}\\ndescription: .+\\n---`));
  for(const heading of["## 사용하지 않는 경우","## 먼저 읽기","## 절차","## 금지사항","## 완료 조건","## 결과 보고"])assert.ok(value.includes(heading),`${name}: ${heading}`);
  assert.ok(value.includes("AGENTS.md"),name);
  assert.ok(value.includes("DEVELOPMENT_RULES.md"),name);
 }
});

test("official package includes project knowledge and skill roots",()=>{
 const pack=read("scripts/package-integrated.mjs");
 assert.match(pack,/"AIOS"/);
 assert.match(pack,/"\.agents"/);
});
