import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kstWorkDate } from "../worker/modules/today/today-policy.js";
import { placeholderProvider } from "../worker/modules/today/providers/placeholder-provider.js";
import { aggregateMajorWorks } from "../worker/modules/today/providers/construction-provider.js";

const read = (path) => fs.readFileSync(path, "utf8");

test("Today uses the Asia/Seoul work date at UTC boundaries", () => {
  assert.equal(kstWorkDate(new Date("2026-01-01T14:59:59Z")), "2026-01-01");
  assert.equal(kstWorkDate(new Date("2026-01-01T15:00:00Z")), "2026-01-02");
});

test("unconnected providers are explicit and never fabricate numeric data", async () => {
  const value = await placeholderProvider("weather", "날씨", "NOT_CONNECTED")();
  assert.deepEqual(value, { code: "weather", label: "날씨", implementationStatus: "NOT_CONNECTED", state: "NOT_IMPLEMENTED", message: "해당 모듈은 아직 준비 중입니다." });
  assert.equal("count" in value, false);
});

test("Today endpoint authenticates and aggregates through one API", () => {
  const route = read("worker/modules/today/today-route.js");
  const index = read("worker/index.js");
  const client = read("apps/web/assets/today.js");
  assert.match(route, /authenticate\(request,env\)/);
  assert.match(index, /GET"&&url\.pathname==="\/api\/v1\/today"/);
  assert.equal((client.match(/fetch\("\/api\/v1\/today"/g) || []).length, 2);
  assert.match(route, /server-timing/);
});

test("Today reuses site membership, roles, and Issue scope policy", () => {
  const policy = read("worker/modules/today/today-policy.js");
  assert.match(policy, /memberships WHERE user_id=\?1 AND site_id=\?2 AND status='ACTIVE'/);
  assert.match(policy, /user_site_roles/);
  assert.match(policy, /resolveIssueScope/);

  assert.doesNotMatch(policy, /TODAY_ADMIN_SCOPE_DENIED/);
});

test("Issue provider enforces entitlement, permission, company, and assignee scopes", () => {
  const provider = read("worker/modules/today/providers/issue-provider.js");
  assert.match(provider, /ctx\.modules\.includes\("issue"\)/);
  assert.match(provider, /issue\.read/);
  assert.match(provider, /contractor_company_id=\?3/);
  assert.match(provider, /assigned_to_user_id=\?4/);
  assert.match(provider, /status='COMPLETION_REQUESTED'/);
  assert.match(provider, /priority='URGENT'/);
  assert.match(provider, /location_text,created_at,due_at,assigned_to_name_snapshot,status,priority/);
  assert.match(provider, /urgentItems/);
  assert.match(provider, /LIMIT 5/);
});

test("employee PC Today prioritizes action, urgent details, site summaries, and permission-safe links", () => {
  const client = read("apps/web/assets/today.js");
  const css = read("apps/web/assets/today.css");
  const service = read("worker/modules/today/today-service.js");
  for (const token of ["today-route-start", "today-api-response", "today-first-usable", "승인 요청 중", "오늘 해야 할 일", "긴급·미조치 이슈", "오늘 주의·알림", "출역·교육 현황", "오늘 주요 공정", "예정 업무·검측", "업무 바로가기", "미완료 업무 현황"]) assert.ok(client.includes(token), token);
  for (const token of ["todayTasks", "urgentItems", "alerts", "analysis", "workforceSummary", "constructionSummary"]) assert.ok(service.includes(token), token);
  for (const link of ["/issues/new", "/issues/open", "/issues/review", "/issues"]) assert.match(read("worker/modules/today/today-service.js"), new RegExp(link.replace("?", "\\?")));
  assert.match(css, /min-height:44px/);
  assert.match(css, /@media\(max-width:1100px\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.match(client, /canEditIssue/);
  assert.match(client, /action\.href!=="\/issues\/new"/);
  assert.doesNotMatch(client, /안전점수|품질점수|종합점수/);
  assert.doesNotMatch(client, /Mock|mock/);
});

test("site summaries and notices use item-level inline accordions without navigation", () => {
  const client = read("apps/web/assets/today.js");
  const css = read("apps/web/assets/today.css");
  for (const token of ["현장 요약", "오늘 주의·알림", "모두 접기", "aria-expanded=\"false\"", "aria-controls", "확인할 상세 정보가 없습니다.", "today-inline-toggle", "today-notice-list"]) assert.ok(client.includes(token), token);
  assert.match(client, /setExpanded\(button,button\.getAttribute\("aria-expanded"\)!=="true"\)/);
  assert.match(client, /event\.key==="Enter"\|\|event\.key===" "\|\|event\.key==="Spacebar"/);
  assert.match(client, /today-inline-toggle\[aria-expanded='true'\]/);
  assert.match(client, /globalThis\.scrollY/);
  assert.match(client, /setInterval\(.+60000/s);
  assert.match(client, /state==="NO_PERMISSION"/);
  assert.match(client, /state==="ERROR"/);
  assert.doesNotMatch(client, /today-summary-detail|출역현황 자세히 보기|공사 업무 자세히 보기|예정 업무 전체 보기/);
  const inlineHelpers=client.slice(client.indexOf("const inlineItem"),client.indexOf("export async function renderTodayPage"));
  assert.doesNotMatch(inlineHelpers, /<a |location\.|window\.location|navigate\(/);
  assert.match(css, /\.today-summary-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.today-inline-toggle\{[^}]*width:100%[^}]*min-height:48px/);
  assert.match(css, /\.today-inline-content\[hidden\]\{display:none\}/);
});

test("Today Workforce summary fails closed without module and board access", () => {
  const provider = read("worker/modules/today/providers/workforce-provider.js");
  assert.match(provider, /ctx\.modules\.includes\("workforce"\)/);
  assert.match(provider, /WORKFORCE_ATTENDANCE/);
  assert.match(provider, /WORKFORCE_DAILY_OUTPUT/);
  assert.match(provider, /state:"NO_PERMISSION"/);
});

test("Today construction works group equal names and keep workforce totals equal to company sums", () => {
  const works=aggregateMajorWorks([
    {manager_summary:"102동 콘크리트 타설",location_name:"102동 5층",company_name:"대한건설",workforce_count:8},
    {manager_summary:"102동 콘크리트 타설",location_name:"102동 5층",company_name:"서울인력",workforce_count:6},
    {manager_summary:"102동 콘크리트 타설",location_name:"102동 5층",company_name:"한빛펌프카",workforce_count:4},
    {work_description:"외부 비계 설치",location_name:"외부",company_name:"대한건설",workforce_count:0},
    {work_description:"지하주차장 거푸집 설치",location_name:"지하주차장",company_name:"서울인력",workforce_count:3}
  ]);
  assert.equal(works.length,3);
  assert.equal(works[0].total,18);
  assert.deepEqual(works[0].companies.map(row=>row.count),[8,6,4]);
  for(const work of works)assert.equal(work.total,work.companies.reduce((sum,row)=>sum+row.count,0));
});

test("Today construction work UI stays inline and distinguishes report states", () => {
  const client=read("apps/web/assets/today.js"),css=read("apps/web/assets/today.css");
  for(const token of ["공사일보가 업데이트되지 않았습니다.","공사일보를 불러오지 못했습니다.","잠시 후 다시 시도해 주세요.","예정 인원 정보가 등록되지 않았습니다.","공사일보를 분석하고 있습니다.","공사일보 양식을 인식하지 못했습니다.","today-construction-works","today-work-toggle"])assert.ok(client.includes(token),token);
  assert.match(client,/construction\.reportStatus!=="FINALIZED"/);
  assert.match(client,/aria-expanded="false"/);
  assert.match(client,/constructionWorkItemHtml\(work\)/);
  assert.match(css,/\.today-work-toggle\{[^}]*font-weight:400/);
  assert.match(css,/\.today-work-toggle \.construction-work-item__trade\{font-weight:700\}/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(client,/\.today-inline-toggle,\.today-work-toggle/);
  assert.match(client,/globalThis\.scrollY/);
  const workRenderer=client.slice(client.indexOf("const constructionWorkRow"),client.indexOf("const buildConstructionWorks"));
  assert.equal((workRenderer.match(/<a /g)||[]).length,1,"approved v0.27.0 source action is the only work-row navigation");
  assert.match(workRenderer,/today-work-create-issue/);
  assert.doesNotMatch(workRenderer,/location\.|window\.location|navigate\(|dialog|modal|popup/i);
});

test("no mojibake replacement characters exist in Today sources", () => {
  for (const path of ["apps/web/assets/today.js", "worker/modules/today/today-service.js", "worker/modules/today/providers/issue-provider.js", "worker/modules/today/providers/placeholder-provider.js"]) {
    assert.doesNotMatch(read(path), /\uFFFD/);
  }
});
