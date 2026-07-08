export const WEATHER_MODELS = [
  {
    id: "kma",
    name: "KMA",
    label: "한국기상청",
    desc: "국내 단기예보와 초단기예보 기준",
    status: "planned"
  },
  {
    id: "ecmwf",
    name: "ECMWF",
    label: "유럽중기예보",
    desc: "중기 강수 경향 판단에 유용",
    status: "demo"
  },
  {
    id: "gfs",
    name: "GFS",
    label: "미국예보",
    desc: "장기 강수 패턴 보조 판단",
    status: "demo"
  },
  {
    id: "jma",
    name: "JMA",
    label: "일본기상청",
    desc: "동아시아 기압계 비교",
    status: "demo"
  }
];

export function getModelLabel(id){
  const found = WEATHER_MODELS.find(m => m.id === id);
  return found ? `${found.name} (${found.label})` : id;
}
