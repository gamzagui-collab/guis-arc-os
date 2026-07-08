export function concreteDecision({maxRain, maxWind, maxApparent}){
  const checks = [];

  if(maxRain >= 10){
    checks.push({level:"danger", title:"타설 연기 권장", text:"3시간 강수량이 높습니다. 콘크리트 표면 빗물 유입, 물시멘트비 변화, 마감 불량 위험이 큽니다."});
  }else if(maxRain >= 5){
    checks.push({level:"warning", title:"타설 주의", text:"보양재, 배수로, 감리 협의, 레미콘 대기시간 조정이 필요합니다."});
  }else if(maxRain > 0){
    checks.push({level:"watch", title:"약한 강수 가능", text:"타설 전 바닥 고임수와 보양재 준비상태를 확인합니다."});
  }else{
    checks.push({level:"normal", title:"강수 위험 낮음", text:"일반 타설관리 기준을 적용합니다."});
  }

  if(maxWind >= 10){
    checks.push({level:"danger", title:"양중·펌프카 주의", text:"붐대 흔들림, 낙하, 장비 전도 위험을 검토합니다."});
  }else if(maxWind >= 7){
    checks.push({level:"warning", title:"풍속 주의", text:"신호수, 작업반경, 아웃트리거 받침판을 확인합니다."});
  }

  if(maxApparent >= 35){
    checks.push({level:"danger", title:"온열질환 위험", text:"11~15시 휴식, 수분, 그늘, 관리자 순회가 필요합니다."});
  }

  const worst = checks.some(x=>x.level==="danger") ? "위험" :
    checks.some(x=>x.level==="warning") ? "주의" :
    checks.some(x=>x.level==="watch") ? "관찰" : "정상";

  return {overall: worst, checks};
}

export function workWindowRecommendation(hourly){
  const safe = hourly.filter(h => Number(h.hour) >= 7 && Number(h.hour) <= 17 && h.rain3h < 5 && h.wind < 8 && h.apparent < 35);
  if(!safe.length){
    return "07~17시 중 명확한 안전 작업시간이 없습니다. 작업순서 조정 또는 추가 확인이 필요합니다.";
  }
  const first = safe[0].hour;
  const last = safe[safe.length - 1].hour;
  return `${first}시~${last}시 사이가 비교적 유리합니다. 단, 실제 현장 상황과 최신 예보를 다시 확인하세요.`;
}
