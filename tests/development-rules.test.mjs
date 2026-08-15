import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=file=>fs.readFileSync(file,"utf8");
test("development rules encode lean error and risk contracts",()=>{const agents=read("AGENTS.md"),rules=read("DEVELOPMENT_RULES.md");for(const file of["AGENTS.md","VERSION.md","DEVELOPMENT_RULES.md"])assert.ok(agents.includes(file));for(const token of["재현 → 원인 확인 → 최소 수정 → 회귀 테스트 → 임시 규칙 폐기","위험도 기반 검증","static revision","Production","공식 release checkpoint"])assert.ok(rules.includes(token),token)});
test("syntax naming exposes compatibility alias",()=>{const scripts=JSON.parse(read("package.json")).scripts;assert.equal(scripts["check:syntax"],"node scripts/check-syntax.mjs");assert.equal(scripts.typecheck,"npm run check:syntax")});
