import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const js=fs.readFileSync("apps/web/assets/issues.js","utf8");
const css=fs.readFileSync("apps/web/assets/issues.css","utf8");

test("Issue 사진 슬라이드는 한 이슈 단위 메타데이터와 썸네일을 재사용한다",()=>{
  assert.match(js,/function issueSlideView/);
  assert.match(js,/bindIssueSlides/);
  assert.match(js,/issue\.thumbnailUrl/);
  assert.match(js,/new Image\(\)\.src/);
  assert.doesNotMatch(js,/move=.*api\(/);
});

test("모바일은 슬라이드 기본, PC는 목록 기본이며 보기 전환을 지원한다",()=>{
  assert.match(js,/matchMedia\("\(max-width:760px\)"\)\.matches\?"slide":"list"/);
  assert.match(js,/sessionStorage\.removeItem\("guis-arc-issue-view"\)/);
  assert.match(js,/issue-view-slide/);
  assert.match(js,/issue-view-list/);
  assert.match(js,/issue-view-back/);
});

test("사진은 화면을 채우고 하단 오버레이는 기본 펼침과 접기 상태 유지를 지원한다",()=>{
  assert.match(css,/height:calc\(100dvh - var\(--header-height\) - var\(--mobile-nav-height\)\)/);
  assert.match(css,/object-fit:contain/);
  assert.match(css,/issue-slide-overlay/);
  assert.match(css,/height:25%/);
  assert.match(css,/max-height:35%/);
  assert.match(css,/issue-slide-overlay\.collapsed/);
  assert.match(js,/guis-arc-issue-overlay-expanded/);
  assert.match(js,/aria-label=\"이슈 정보 접기\"/);
});

test("슬라이드에 위치 내용 상태 번호와 주요 조치 링크를 제공한다",()=>{
  for(const token of ["issue-slide-count","issue-slide-status","issue-slide-location","issue-slide-description","issue-slide-action"]) assert.match(js,new RegExp(token));
  assert.match(js,/좌우로 밀어 이전 또는 다음 이슈 보기/);
  assert.match(js,/조치하기/);
});

test("v0.22.0 Viewer는 썸네일에서 시작하고 확대할 때만 원본을 불러온다",()=>{
  assert.match(js,/dataset\.original=`\/api\/v1\/issues\/\$\{issue\.id\}\/media\/original`/);
  assert.match(js,/viewer-original/);
  assert.match(js,/원본 보기/);
  assert.match(js,/ondblclick=openPhoto/);
  assert.match(js,/Date\.now\(\)/);
  assert.match(css,/viewer-stage img\.zoomed/);
  assert.match(css,/touch-action:pinch-zoom/);
});

test("v0.22.0 상단과 Overlay는 사진을 줄이지 않고 접근 가능한 제어를 제공한다",()=>{
  for(const label of ["이전 화면으로 돌아가기","목록 보기","사진 확대","이슈 정보 접기","이슈 상세 보기"])assert.ok(js.includes(label),label);
  assert.match(css,/position:absolute/);
  assert.match(css,/overflow:auto/);
  assert.match(css,/transition:height/);
});
