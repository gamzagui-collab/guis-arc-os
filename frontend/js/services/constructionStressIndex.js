export const CSI_RULES = {
  "version": "8.4",
  "name": "Construction Stress Index",
  "description": "건설현장 작업 체감위험도 산출용 초기 규칙",
  "riskLevels": [
    {
      "min": 0,
      "max": 24,
      "level": "정상",
      "label": "작업 가능",
      "action": "일반 수분섭취와 기본 순회점검"
    },
    {
      "min": 25,
      "max": 49,
      "level": "주의",
      "label": "주의 필요",
      "action": "수분섭취 안내, 그늘 휴식, 고령·기저질환자 확인"
    },
    {
      "min": 50,
      "max": 74,
      "level": "위험",
      "label": "작업 조정",
      "action": "휴식 확대, 고강도 작업 시간 조정, 관리자 순회 강화"
    },
    {
      "min": 75,
      "max": 100,
      "level": "매우위험",
      "label": "중지 검토",
      "action": "고강도 옥외작업 중지 또는 시간 변경 검토"
    }
  ],
  "workTypes": [
    {
      "id": "rebar",
      "name": "철근공사",
      "intensity": 1.25,
      "ppe": 1.12,
      "note": "중량물·자세부하·금속 복사열"
    },
    {
      "id": "formwork",
      "name": "거푸집공사",
      "intensity": 1.2,
      "ppe": 1.1,
      "note": "고소·자재운반·반복작업"
    },
    {
      "id": "concrete",
      "name": "콘크리트 타설",
      "intensity": 1.3,
      "ppe": 1.15,
      "note": "연속작업·레미콘·펌프카 주변"
    },
    {
      "id": "crane",
      "name": "크레인작업",
      "intensity": 0.9,
      "ppe": 1.05,
      "note": "신호수·장비반경·풍속 영향"
    },
    {
      "id": "waterproof",
      "name": "방수공사",
      "intensity": 1.25,
      "ppe": 1.18,
      "note": "옥상·용제·복사열"
    },
    {
      "id": "masonry",
      "name": "조적·미장",
      "intensity": 1.15,
      "ppe": 1.08,
      "note": "반복작업·분진·실내 습도"
    },
    {
      "id": "inspection",
      "name": "관리자 순회",
      "intensity": 0.75,
      "ppe": 1.0,
      "note": "이동·점검 중심"
    }
  ],
  "locations": [
    {
      "id": "outdoor",
      "name": "옥외",
      "factor": 1.1
    },
    {
      "id": "roof",
      "name": "옥상·슬래브",
      "factor": 1.2
    },
    {
      "id": "indoor",
      "name": "실내",
      "factor": 0.9
    },
    {
      "id": "basement",
      "name": "지하",
      "factor": 0.95
    },
    {
      "id": "enclosed",
      "name": "밀폐·환기불량",
      "factor": 1.25
    }
  ]
};

export function getWorkType(idOrName){
  return CSI_RULES.workTypes.find(x => x.id === idOrName || x.name === idOrName) || CSI_RULES.workTypes[0];
}

export function getLocation(id){
  return CSI_RULES.locations.find(x => x.id === id) || CSI_RULES.locations[0];
}

export function heatIndexSimple(temp, humidity){
  // 현장용 간이 체감온도. 실제 서비스에서는 KMA/Open-Meteo 제공값 우선 사용.
  const t = Number(temp);
  const rh = Number(humidity);
  if(t < 27) return t;
  return +(t + (rh - 40) * 0.08 + Math.max(0, t - 30) * 0.7).toFixed(1);
}

export function windChillSimple(temp, wind){
  const t = Number(temp);
  const v = Math.max(0, Number(wind));
  if(t > 10 || v < 1.3) return t;
  return +(13.12 + 0.6215*t - 11.37*Math.pow(v*3.6,0.16) + 0.3965*t*Math.pow(v*3.6,0.16)).toFixed(1);
}

export function calculateCSI({
  temp = 30,
  humidity = 70,
  wind = 1,
  rain = 0,
  workType = "rebar",
  location = "outdoor",
  directSun = true
} = {}){
  const wt = getWorkType(workType);
  const loc = getLocation(location);
  const apparent = temp >= 20 ? heatIndexSimple(temp, humidity) : windChillSimple(temp, wind);

  let score = 0;
  score += Math.max(0, apparent - 24) * 4.2;
  score += Math.max(0, humidity - 60) * 0.35;
  score += directSun ? 8 : 0;
  score += rain > 0 ? Math.min(8, rain * 1.2) : 0;
  score -= Math.min(12, wind * 1.6);

  score = score * wt.intensity * wt.ppe * loc.factor;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = CSI_RULES.riskLevels.find(x => score >= x.min && score <= x.max) || CSI_RULES.riskLevels[0];
  return {
    score,
    apparent,
    level: level.level,
    label: level.label,
    action: level.action,
    workType: wt,
    location: loc,
    feeling: buildFeeling(apparent, humidity, wind, wt.name),
    hydration: hydrationGuide(score),
    rest: restGuide(score),
    checklist: checklistGuide(score, wt.name)
  };
}

function buildFeeling(apparent, humidity, wind, workName){
  if(apparent >= 38) return `${workName} 기준, 덜 마른 작업복을 입고 사우나 입구에서 일하는 느낌입니다.`;
  if(apparent >= 35) return `${workName} 기준, 햇볕 아래에서 숨이 답답하고 땀이 마르지 않는 느낌입니다.`;
  if(apparent >= 32) return `${workName} 기준, 작업 시작 후 금방 땀이 차고 휴식이 필요한 느낌입니다.`;
  if(apparent <= 0) return `${workName} 기준, 손끝 감각 저하와 바람에 의한 한랭 스트레스가 우려됩니다.`;
  return `${workName} 기준, 일반적인 작업 부담 수준입니다.`;
}

function hydrationGuide(score){
  if(score >= 75) return "물 500mL 이상/시간 + 전해질 보충, 고위험자는 작업 배제 검토";
  if(score >= 50) return "물 300~500mL/시간, 식염포도당 또는 전해질 음료 권장";
  if(score >= 25) return "물 250~300mL/시간, 작업 전후 상태 확인";
  return "일반 수분섭취";
}

function restGuide(score){
  if(score >= 75) return "20분 작업 / 20분 이상 휴식 또는 시간대 변경";
  if(score >= 50) return "40분 작업 / 20분 휴식 권장";
  if(score >= 25) return "매시간 10분 이상 그늘 휴식";
  return "일반 휴식";
}

function checklistGuide(score, workName){
  const base = ["작업 전 TBM에서 온열·한랭 위험 공유", "음수대·그늘·휴식장소 확인", "관리자 순회자 지정"];
  if(score >= 50) base.push("고령·기저질환·신규근로자 상태 확인", `${workName} 고강도 작업 시간 조정`);
  if(score >= 75) base.push("옥외 고강도 작업 중지 검토", "응급연락체계와 체온측정 준비");
  return base;
}
