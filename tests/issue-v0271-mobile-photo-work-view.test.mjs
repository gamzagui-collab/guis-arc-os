import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const js = fs.readFileSync("apps/web/assets/issues.js", "utf8");
const css = fs.readFileSync("apps/web/assets/issues.css", "utf8");
const appJs = fs.readFileSync("apps/web/assets/app.js", "utf8");
const appCss = fs.readFileSync("apps/web/assets/app.css", "utf8");

test("v0.27.1 mobile status group constants", () => {
  assert.match(js, /const issueStatusGroups=\{/);
  assert.match(js, /UNHANDLED:\["OPEN","ASSIGNED","ACTION_IN_PROGRESS","REWORK_REQUIRED"\]/);
  assert.match(js, /REVIEW:\["COMPLETION_REQUESTED"\]/);
  assert.match(js, /COMPLETED:\["COMPLETED","CANCELLED"\]/);
  assert.match(js, /ISSUE_ALL:\[\]/);
});

test("v0.27.1 mobile department/filter session constants", () => {
  assert.match(js, /const issueDepartments=\["CONSTRUCTION","SAFETY","QUALITY","ADMINISTRATION","UNCLASSIFIED"\]/);
  assert.match(js, /const issueSessionKeys=/);
  assert.match(js, /view:"guis-arc-issue-view"/);
  assert.match(js, /page:"guis-arc-issue-page"/);
  assert.match(js, /query:"guis-arc-issue-query"/);
  assert.match(js, /status:"guis-arc-issue-status"/);
  assert.match(js, /department:"guis-arc-issue-department"/);
  assert.match(js, /index:"guis-arc-issue-slide-index"/);
  assert.match(js, /overlay:"guis-arc-issue-overlay-expanded"/);
  assert.match(js, /sessionStorage\.setItem\(issueSessionKeys\.page,String\(apiPage\)\);/);
  assert.match(js, /sessionStorage\.setItem\(issueSessionKeys\.overlay,String\(expanded\)\)/);
  assert.match(js, /sessionStorage\.setItem\(issueSessionKeys\.status,selectedStatus\)/);
  assert.match(js, /sessionStorage\.setItem\(issueSessionKeys\.department,selectedDepartment\)/);
});

test("v0.27.1 mobile list should use pagination append with page size 50", () => {
  assert.match(js, /pageSize:"50"/);
  assert.match(js, /load=async\(\{append=false\}=\{\}\)=/);
  assert.match(js, /labelsForStatusGroup\(selectedStatus\)/);
  assert.ok(js.includes('if(append){const currentIssueIds=new Set(currentIssues.map(value=>value.id));currentIssues=[...currentIssues,...(data.issues||[]).filter(issue=>!currentIssueIds.has(issue.id))]}'));
  assert.match(js, /apiPage=append\?Math\.max\(1,Number\(sessionStorage\.getItem\(issueSessionKeys\.page\)\|\|1\)\+1\):1/);
});

test("v0.27.1 mobile list keeps stateful status and department chips", () => {
  assert.match(js, /issue-status-chips/);
  assert.match(js, /data-issue-status/);
  assert.match(js, /department-chip/);
  assert.match(js, /data-issue-department/);
  assert.match(js, /event\.target\.matches\(".*status-chip/);
  assert.match(js, /event\.target\.matches\(".*department-chip/);
  assert.match(js, /selectedStatus=event\.target\.dataset\.issueStatus\|\|"ALL"/);
  assert.match(js, /selectedDepartment=event\.target\.dataset\.issueDepartment\|\|""/);
});

test("v0.27.1 issue slide supports gesture + viewer interactions", () => {
  assert.match(js, /photo\.addEventListener\("pointerup"/);
  assert.match(js, /move\(dx<0\?1:-1\)/);
  assert.match(js, /photo\.ondblclick=openPhoto/);
  assert.match(js, /photo\.onkeydown=event=>\{if\(event\.key==="ArrowLeft"\)move\(-1\);/);
  assert.match(js, /openPhoto=\(\)=>\{const issue=issues\[index\],dialog=imageViewer\(\);/);
  assert.match(js, /dataset\.original=`\/api\/v1\/issues\/\$\{issue\.id\}\/media\/original`/);
});

test("v0.27.1 overlay and list/photo mode classes exist in CSS", () => {
  assert.match(js, /issue-view-list/);
  assert.match(js, /issue-view-back/);
  assert.match(js, /issue-photo-mode/);
  assert.match(css, /issue-status-chips/);
  assert.match(css, /department-chip/);
  assert.match(css, /issue-pagination/);
  assert.match(css, /issue-load-more/);
  assert.match(css, /body\.issue-photo-mode/);
  assert.match(css, /issue-slide-overlay\.collapsed/);
});

test("v0.27.1 mobile UNHANDLED status should request UNHANDLED in photo mode", () => {
  assert.match(js, /mode==="slide"&&selectedStatus==="UNHANDLED"\)\{params\.set\("status","UNHANDLED"\);\}/);
});

test("v0.27.1 mobile list append should dedupe by issue id", () => {
  assert.match(js, /const currentIssueIds=new Set\(currentIssues\.map\(value=>value\.id\)\)/);
  assert.match(js, /\.filter\(issue=>!currentIssueIds\.has\(issue\.id\)\)/);
});

test("v0.27.1 /issues/review and /issues/completed routes should map to list modes", () => {
  assert.ok(js.includes('else if(path==="/issues/review")await list("review")'));
  assert.ok(js.includes('else if(path==="/issues/completed")await list("completed")'));
  assert.ok(js.includes('mode=matchMedia("(max-width:760px)").matches&&(group==="UNHANDLED")?"slide":"list"'));
});


test("photo work always resets to UNHANDLED and refreshes server data",()=>{
  assert.match(js,/if\(mode==="slide"\)selectedStatus="UNHANDLED"/);
  assert.match(js,/selectedStatus="UNHANDLED";sessionStorage\.setItem\(issueSessionKeys\.status,selectedStatus\)/);
  assert.match(js,/sessionStorage\.setItem\(issueSessionKeys\.index,"0"\)/);
  assert.match(js,/params\.set\("status","UNHANDLED"\)/);
});
test("photo work reuses the common header menu without a dedicated hamburger",()=>{
 assert.doesNotMatch(js,/class="issue-photo-menu-toggle secondary"/);assert.doesNotMatch(js,/querySelector\("\.issue-photo-menu-toggle"\)/);assert.equal((appJs.match(/id="mobile-more-button"/g)||[]).length,1);assert.match(appJs,/mobile-site-menu/);assert.match(appCss,/grid-template-columns:minmax\(0,1fr\) 46px/);
});
test("share photo is a temporary client JPEG with location and description only",()=>{
  assert.match(js,/async function createSharePhoto/);assert.match(js,/canvas\.toBlob/);assert.match(js,/navigator\.share\(\{files:\[file\]\}\)/);assert.match(js,/download="GUI-Arc-share-photo\.jpg"/);assert.match(js,/공유사진을 만들지 못했습니다/);
});
test("photo slide requests the next page near the loaded edge without replacing loaded slides",()=>{assert.match(js,/onNeedMore:\(\)=>currentIssues\.length<currentTotal&&load\(\{append:true\}\)/);assert.match(js,/index>=issues\.length-3/);assert.match(js,/requestedMore/);});

test("service worker revision invalidates stale shell and all changed asset URLs",()=>{
  const sw=fs.readFileSync("apps/web/service-worker.js","utf8"),html=fs.readFileSync("apps/web/index.html","utf8"),app=fs.readFileSync("apps/web/assets/app.js","utf8"),issues=fs.readFileSync("apps/web/assets/issues.js","utf8");
  assert.match(sw,/guis-arc-integrated-v0\.27\.1-r1-shell/);
  assert.match(sw,/key\.startsWith\("guis-arc-integrated-"\)&&key!==CACHE/);
  for(const asset of ["app.js","issues.js","issues.css","app.css","manifest.webmanifest"])assert.match(sw,new RegExp(asset.replace(".","\\.")+"\\?v=0\\.27\\.1-r1"));for(const asset of ["issue-speech.js","integrated-admin.js","version.js"])assert.match(sw,new RegExp(asset.replace(".","\\.")+"\\?v=0\\.27\\.1-r1"));
  assert.match(html,/issues\.css\?v=0\.27\.1-r1/);assert.match(html,/app\.js\?v=0\.27\.1-r1/);
  assert.match(app,/version\.js\?v=0\.27\.1-r1/);assert.match(app,/issues\.js\?v=0\.27\.1-r1/);assert.match(app,/integrated-admin\.js\?v=0\.27\.1-r1/);
  assert.match(issues,/issue-speech\.js\?v=0\.27\.1-r1/);
});


test("photo work collapsed sheet keeps two summary lines fixed over the photo",()=>{
 assert.match(js,/issue-slide-location-collapsed/);assert.match(js,/issue-slide-description-collapsed/);assert.match(js,/querySelector\("\.issue-slide-description-collapsed"\)\.textContent=/);assert.match(css,/body\.issue-photo-mode\{overflow:hidden;background:#111\}/);assert.match(css,/\.issue-slide-overlay\.collapsed\{height:86px;max-height:86px/);assert.match(css,/\.issue-overlay-collapsed\{display:grid/);assert.match(css,/\.issue-slide-description-collapsed\{font-size:/);
});

test("expanded photo work sheet exposes action and share without nested scrolling",()=>{
 assert.match(js,/issue-slide-actions/);assert.match(js,/issue-share-photo/);assert.match(css,/\.issue-slide-overlay\{position:absolute;[^}]*overflow:hidden/);assert.match(css,/\.issue-slide-actions\{grid-template-columns:minmax\(0,1fr\) minmax\(104px,\.62fr\)/);assert.match(css,/\.issue-slide-description\{[^}]*-webkit-line-clamp:2/);
});

test("photo work common hamburger matches every mobile route and has no duplicate",()=>{
 assert.doesNotMatch(js,/issue-photo-menu-toggle secondary/);assert.match(appJs,/id="mobile-site-button"/);assert.match(appJs,/id="mobile-more-button" class="mobile-header-menu"/);assert.match(appJs,/event\.target\.closest\?\.\("#mobile-more,#mobile-more-button"\)/);assert.match(appCss,/\.mobile-header-menu\{display:grid/);assert.match(appCss,/width:min\(66vw,280px\)/);assert.match(appJs,/class="mobile-more-accent" aria-hidden="true">GUI's Arc<\/span>/);
});

test("mobile header icons do not depend on fragile text glyphs",()=>{
 assert.doesNotMatch(appJs,/aria-controls="mobile-more">\?<\/button>/);assert.match(appJs,/class="mobile-hamburger-icon"/);assert.match(appCss,/\.mobile-hamburger-icon span/);assert.doesNotMatch(appCss,/#mobile-site-button::after\{content:"\?"/);assert.match(appCss,/#mobile-site-button::after\{[^}]*border-right:/);
});

test("install action is discoverable in browsers and hidden in standalone mode",()=>{
 assert.match(appJs,/const isStandalone=/);assert.match(appJs,/isStandalone\(\)\?"":'<button id="mobile-install" class="secondary">/);assert.ok(appJs.indexOf('id="mobile-install"')<appJs.indexOf('id="mobile-logout"'));assert.match(appJs,/mobileInstallPrompt\.prompt\(\)/);assert.match(appJs,/choice\.outcome==="accepted"/);assert.match(appJs,/navigator\.userAgent/);assert.match(appJs,/홈 화면에 추가/);
});

test("photo work menu owns vertical touch scrolling without triggering photo swipe",()=>{
 assert.match(appCss,/\.mobile-more-scroll\{[^}]*overflow-y:auto;[^}]*touch-action:pan-y/);assert.match(appCss,/\.mobile-more\{[^}]*grid-template-columns:20px minmax\(0,1fr\);[^}]*overflow:hidden/);assert.match(appCss,/\.mobile-more-accent\{[^}]*align-self:stretch/);assert.match(css,/body\.issue-photo-mode \.mobile-more-scroll\{[^}]*max-height:/);assert.match(appJs,/mobileMenu\?\.addEventListener\("pointerdown",stopMenuGesture\)/);assert.match(appJs,/mobileMenu\?\.addEventListener\("pointermove",stopMenuGesture\)/);assert.match(appJs,/mobileMenu\?\.addEventListener\("touchmove",stopMenuGesture/);
});

test("photo work bottom sheet renders only the active state content",()=>{
 assert.match(css,/\.issue-overlay-collapsed\[hidden\],\.issue-overlay-content\[hidden\]\{display:none!important\}/);assert.match(js,/view\.querySelector\("\.issue-overlay-content"\)\.hidden=!expanded/);assert.match(js,/view\.querySelector\("\.issue-overlay-collapsed"\)\.hidden=expanded/);
});
