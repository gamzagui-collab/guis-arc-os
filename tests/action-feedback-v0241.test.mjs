import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const rules=await readFile(new URL("../DEVELOPMENT_RULES.md",import.meta.url),"utf8");
const feedback=await readFile(new URL("../apps/web/assets/action-feedback.js",import.meta.url),"utf8");
const issues=await readFile(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");
const css=await readFile(new URL("../apps/web/assets/app.css",import.meta.url),"utf8");

test("v0.24.1 formalizes pending success error retry and duplicate prevention",()=>{
 for(const text of ["사용자 액션 피드백 원칙","처리 중","성공","실패","Revision 충돌","Idempotency","aria-busy"])assert.match(rules,new RegExp(text));
});

test("common action feedback exposes accessible pending success and error states",()=>{
 for(const name of ["setActionPending","clearActionPending","showActionSuccess","showActionError","withActionFeedback"])assert.match(feedback,new RegExp(`export (?:async )?function ${name}`));
 assert.match(feedback,/aria-live/);assert.match(feedback,/statusElement\(status,"alert"\)/);assert.match(feedback,/aria-busy/);assert.match(css,/action-spinner/);assert.match(css,/action-toast-region/);
});

test("PC dashboard shows list loading and bulk progress without duplicate submission",()=>{
 assert.match(issues,/이슈 목록을 불러오고 있습니다/);
 assert.match(issues,/건 변경 중/);
 assert.match(issues,/if\(!setActionPending/);
 assert.match(issues,/close\.disabled=true/);
 assert.match(issues,/idempotencyKey=crypto\.randomUUID/);
});

test("PC dashboard refreshes on success and preserves retry state on failure",()=>{
 assert.match(issues,/recentlyChanged=new Set/);
 assert.match(issues,/await load\(\);showActionSuccess/);
 assert.match(issues,/다른 사용자가 먼저 수정한 이슈/);
 assert.match(issues,/retryLabel:revision\?"목록 새로고침":"다시 시도"/);
 assert.match(issues,/finally\{close\.disabled=false;clearActionPending/);
});
