import { buildDailyDecisionBriefing } from "./dailyDecisionBriefing.js";
import { buildRoleExecutionDashboard } from "./roleExecutionDashboard.js";
import { buildOsDashboard } from "./osCore.js";

function unique(items=[]){ return [...new Set(items.filter(Boolean))]; }

export function buildExecutiveDashboard(){
  const briefing=buildDailyDecisionBriefing();
  const roleDashboard=buildRoleExecutionDashboard(briefing.date);
  const os=buildOsDashboard();
  const total=briefing.ranked.length;
  const urgent=briefing.urgent.length;
  const caution=briefing.caution.length;
  const normal=briefing.normal.length;
  const directorItems=roleDashboard.roles.find(x=>x.role==="현장소장")?.items||[];
  const score=Math.max(0,Math.min(100,Math.round(briefing.averageReadiness-(urgent*5)-(caution*2))));
  const grade=score>=85?"양호":score>=70?"관리":score>=50?"주의":"비상";
  const delayRisks=briefing.ranked.filter(({work,evaluation})=>{
    const reasons=(evaluation.reasons||[]).join(" ");
    return /자원 미준비|장비 미점검|검측 미완료|공시체 계획 없음|공사 상태 중지|시작시간/.test(reasons);
  }).slice(0,5);
  const weatherRisks=(os.critical||[]).map(x=>({title:x.title,text:x.text,level:x.level}));
  const aiRecommendations=unique([
    ...(briefing.top?.evaluation?.reasons||[]).slice(0,3).map(x=>`${briefing.top.work.subProcess||briefing.top.work.title}: ${x} 우선 조치`),
    ...(briefing.actions||[]).slice(0,4).map(x=>`${x.owner}: ${x.reason} ${x.count}건 확인`),
    ...(os.critical||[]).filter(x=>x.level==="danger").map(x=>x.text)
  ]).slice(0,6);
  return {briefing,roleDashboard,os,total,urgent,caution,normal,directorItems,score,grade,delayRisks,weatherRisks,aiRecommendations};
}
