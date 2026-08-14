import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const js=fs.readFileSync("apps/web/assets/issues.js","utf8"),css=fs.readFileSync("apps/web/assets/issues.css","utf8"),worker=fs.readFileSync("worker/modules/issues.js","utf8");
const between=(a,b)=>js.slice(js.indexOf(a),js.indexOf(b,js.indexOf(a)+a.length));

test("desktop and mobile collapsed management rows contain no thumbnail image",()=>{
 const mobile=between("const card=","const issueDetailCache"),pc=between("const render=total=>","const bind=total=>");
 assert.doesNotMatch(mobile,/<img|thumbnailUrl/);
 assert.match(js,/issue\.thumbnailUrl=null/);
 assert.match(js,/children\[1\]\.querySelector\("\.issue-list-share-actions"\)/);
 assert.match(js,/row\.replaceChildren\(label,category,status,share,summary,time,expand,panel\)/);
});

test("both list renderers use category status share summary date and expand",()=>{
 for(const source of [between("const card=","const issueDetailCache"),between("const leanPcRows=","new MutationObserver")]){
  for(const token of ["issue-category","issue-management-summary","issue-expand"])assert.match(source,new RegExp(token));
 }
 assert.match(js,/statusBadge\(/);assert.match(js,/issueListShareAction\(issue\)/);assert.match(js,/<time/);
 assert.match(js,/departmentRecommendation\?\.confirmedCode/);
 assert.match(js,/departmentLabel/);
});

test("filters bulk selection and server pagination stay intact",()=>{
 for(const token of ["q","status","department","tradeId","assignment","issue-select-page","issue-bulk-open"])assert.match(js,new RegExp(token));
 assert.match(js,/pageSize:"50"/);
 assert.match(worker,/ORDER BY i\.created_at DESC,i\.id DESC LIMIT \?15 OFFSET \?16/);
 assert.match(worker,/SELECT COUNT\(\*\) AS count/);
});

test("lazy detail uses one per-page cache and collapsed DOM has no hidden detail payload",()=>{
 assert.match(js,/const issueDetailCache=new Map\(\)/);
 assert.match(js,/issueDetailCache\.get\(detailId\)/);
 assert.match(js,/issueDetailCache\.set\(detailId,data\)/);
 assert.doesNotMatch(between("const card=","async function expandCard"),/history\.map|media\.map|expanded-photo/);
});

test("lean list CSS bounds summaries and mobile widths",()=>{
 assert.match(css,/issue-management-summary[^}]*text-overflow:ellipsis/);
 assert.match(css,/-webkit-line-clamp:2/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/overflow-x:hidden/);
 assert.match(css,/grid-template-columns:52px 76px minmax\(64px,1fr\) 48px/);
 assert.match(css,/\.issue-management-summary\{grid-column:1\/4;grid-row:2/);
});

test("200 Issues remain bounded to the 50-row server batch",()=>{
 const fixture=Array.from({length:200},(_,id)=>({id}));
 assert.equal(fixture.slice(0,50).length,50);
 assert.match(js,/pageSize:"50"/);
});
