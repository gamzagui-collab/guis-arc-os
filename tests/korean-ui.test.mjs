import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const read=file=>fs.readFileSync(file,"utf8");
test("공통 한국어 표시 사전은 canonical 값을 변경하지 않고 화면 라벨을 제공한다",()=>{
 const ko=read("apps/web/assets/i18n/ko.js");
 for(const token of["ROLE_LABELS","MODULE_LABELS","STATUS_LABELS","ACCESS_LABELS","COMPANY_TYPE_LABELS","errorMessage"])assert.match(ko,new RegExp(token));
 assert.match(ko,/FIELD_WORKER:"현장 근로자"/);
 assert.match(read("apps/web/assets/integrated-admin.js"),/roleLabel\(role\)/);
});
test("사용자 화면 영어 잔존 검사가 파일과 줄 번호를 보고하며 현재 소스는 통과한다",()=>{
 const result=spawnSync(process.execPath,["scripts/validate-korean-ui.mjs"],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/한국어 UI 검사 통과/);
});
