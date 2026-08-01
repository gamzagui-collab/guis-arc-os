import { kstWorkDate } from "./today-policy.js";
import { coreProvider } from "./providers/core-provider.js";
import { issueProvider } from "./providers/issue-provider.js";
import { workforceProvider } from "./providers/workforce-provider.js";
import { constructionProvider } from "./providers/construction-provider.js";
import { safetyProvider } from "./providers/safety-provider.js";
import { qualityProvider } from "./providers/quality-provider.js";
import { materialsProvider } from "./providers/materials-provider.js";
import { equipmentProvider } from "./providers/equipment-provider.js";
import { weatherProvider } from "./providers/weather-provider.js";

const providerContracts = [
  ["workforce", workforceProvider],
  ["construction", constructionProvider],
  ["safety", safetyProvider],
  ["quality", qualityProvider],
  ["materials", materialsProvider],
  ["equipment", equipmentProvider],
  ["weather", weatherProvider]
];

const timed = async (name, provider, input) => {
  const started = performance.now();
  try {
    const value = await provider(input);
    return { name, duration: performance.now() - started, value };
  } catch {
    return {
      name,
      duration: performance.now() - started,
      value: { code:name, implementationStatus: "ERROR", state: "ERROR", message: "데이터를 불러오지 못했습니다." }
    };
  }
};

export async function buildToday(env, row, ctx, scope, instant = new Date()) {
  const results = await Promise.all([
    timed("core", coreProvider, { env, row, ctx, scope }),
    timed("issue", issueProvider, { env, row, ctx, scope }),
    ...providerContracts.map(([code, provider]) => timed(code, provider, { env, row, ctx, scope }))
  ]);
  const [core, issue, ...providers] = results;
  const permissions = new Set(ctx.permissions);
  const canIssue = issue.value.state !== "NO_PERMISSION";
  const construction=providers.find(value=>value.name==="construction")?.value;
  const workforce=providers.find(value=>value.name==="workforce")?.value;
  const canConstructionEdit=["EDIT","MANAGE"].includes(ctx.boardAccess?.CONSTRUCTION_DAILY_REPORT?.accessLevel);
  const actions = [
    core.value.approvalStatus==="APPROVED"
      ? {code:"WORKFORCE_CHECK_IN",label:"출역 QR 스캔",href:"/pwa/workforce/check-in"}
      : null,
    canConstructionEdit&&construction?.state!=="NO_PERMISSION"
      ? {code:"CONSTRUCTION_DAILY_REPORT",label:construction.reportStatus?"공사일보 확인":"공사일보 작성",href:"/construction/daily"}
      : null,
    ...(canIssue ? [
    permissions.has("issue.create") || permissions.has("issue.manage_all")
      ? { code: "CREATE_ISSUE", label: "이슈 등록", href: "/issues/new" }
      : null,
    { code: "OPEN_ISSUES", label: "미조치 이슈 보기", href: "/issues/open" },
    { code: "REVIEW_ISSUES", label: "완료 확인", href: "/issues/review" },
    { code: "ALL_ISSUES", label: "전체 이슈", href: "/issues" }
    ]:[])
  ].filter(Boolean).slice(0,5);
  const moduleValues=providers.map(value=>value.value);
  const actionable=moduleValues
    .flatMap(module=>(module.cards||[]).map(card=>({...card,module:module.code,moduleLabel:module.label})))
    .filter(card=>Number(card.count)>0)
    .sort((a,b)=>({A:0,B:1,C:2}[a.priority]??3)-({A:0,B:1,C:2}[b.priority]??3)||Number(b.count)-Number(a.count));
  const todayTasks=[
    ...(issue.value.cards||[]).filter(card=>["ASSIGNED_TO_ME","COMPLETION_REQUESTED","UNHANDLED"].includes(card.code)&&Number(card.count)>0).map(card=>({...card,module:"issue",moduleLabel:"이슈"})),
    ...actionable
  ].filter((card,index,items)=>items.findIndex(value=>value.code===card.code)===index).slice(0,10);
  const alerts=moduleValues
    .filter(module=>module.state==="ERROR"||module.state==="NO_PERMISSION"||module.state==="NOT_IMPLEMENTED")
    .map(module=>({code:module.code,label:module.label,state:module.state,message:module.message||"연결 상태를 확인해 주세요.",href:module.href||null}));
  const analysis=[
    ...(issue.value.cards||[]).filter(card=>["UNHANDLED","COMPLETION_REQUESTED"].includes(card.code)).map(card=>({group:"이슈",label:card.label,value:Number(card.count||0),href:card.href})),
    ...actionable.filter(card=>["safety","quality","construction"].includes(card.module)).slice(0,6).map(card=>({group:card.moduleLabel,label:card.label,value:Number(card.count||0),href:card.href}))
  ];

  return {
    payload: {
      workDate: kstWorkDate(instant),
      context: core.value,
      actions,
      sections: {
        urgent: issue.value.cards?.filter((card) => card.priority === "A") || [],
        urgentItems: issue.value.urgentItems||[],
        myWork: issue.value.cards?.filter((card) => card.code === "ASSIGNED_TO_ME") || [],
        siteStatus: issue.value.cards?.filter((card) => card.code === "RECENT_COMPLETED") || [],
        modules: moduleValues,
        todayTasks,
        alerts,
        analysis,
        workforceSummary:workforce?.summary||null,
        constructionSummary:construction?.state==="NO_PERMISSION"?null:construction||null
      },
      providers: {
        core: core.value.implementationStatus,
        issue: issue.value.implementationStatus,
        ...Object.fromEntries(providers.map((value) => [value.name, value.value.implementationStatus]))
      }
    },
    timing: Object.fromEntries(results.map((value) => [value.name, value.duration]))
  };
}
