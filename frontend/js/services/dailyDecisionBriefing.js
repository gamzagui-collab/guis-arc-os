import { workInstancesForDate, todayYmd } from "./workInstanceDatabase.js";
import { rankWorks } from "./workPriorityEngine.js";

const LEVEL_ORDER = {"긴급":3,"주의":2,"확인":1,"정상":0};

function ownerFromReason(reason=""){
  if(/TBM|위험성|작업허가/.test(reason)) return "안전관리";
  if(/검측/.test(reason)) return "공사관리";
  if(/공시체|품질/.test(reason)) return "품질관리";
  if(/장비|자원|자재/.test(reason)) return "자재·장비";
  if(/공사|시공|도면|인수인계/.test(reason)) return "공사관리";
  return "현장소장";
}

export function buildDailyDecisionBriefing(date=todayYmd()){
  const ranked = rankWorks(workInstancesForDate(date));
  const urgent = ranked.filter(x => x.evaluation.level === "긴급");
  const caution = ranked.filter(x => x.evaluation.level === "주의");
  const normal = ranked.filter(x => x.evaluation.level === "정상");
  const averageReadiness = ranked.length ? Math.round(ranked.reduce((sum,x)=>sum+x.evaluation.readiness,0)/ranked.length) : 100;
  const actionMap = new Map();

  ranked.forEach(({work,evaluation}, index) => {
    (evaluation.reasons || []).slice(0,4).forEach(reason => {
      const owner = ownerFromReason(reason);
      const key = `${owner}:${reason}`;
      if(!actionMap.has(key)) actionMap.set(key,{owner,reason,count:0,highestLevel:evaluation.level,works:[]});
      const item = actionMap.get(key);
      item.count += 1;
      item.works.push({workId:work.workId,title:work.subProcess||work.title,priority:index+1});
      if(LEVEL_ORDER[evaluation.level] > LEVEL_ORDER[item.highestLevel]) item.highestLevel=evaluation.level;
    });
  });

  const actions = [...actionMap.values()]
    .sort((a,b)=>LEVEL_ORDER[b.highestLevel]-LEVEL_ORDER[a.highestLevel] || b.count-a.count)
    .slice(0,6);
  const top = ranked[0];
  const headline = !ranked.length
    ? "오늘 등록된 작업이 없습니다. 일정 또는 오늘업무에서 작업을 등록하세요."
    : urgent.length
      ? `긴급 작업 ${urgent.length}건이 있습니다. ${top.work.subProcess||top.work.title}부터 조치하세요.`
      : caution.length
        ? `주의 작업 ${caution.length}건이 있습니다. 준비도 낮은 작업부터 확인하세요.`
        : "오늘 작업은 대체로 준비되었습니다. 현장 변동사항을 계속 확인하세요.";

  return {date, ranked, urgent, caution, normal, averageReadiness, actions, headline, top};
}
