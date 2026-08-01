export const SITE_TRADE_CONFLICTS = [
  {leftCanonicalTradeId:"ELECTRICAL_COMMUNICATION",rightCanonicalTradeId:"FIRE_PROTECTION",reasonKo:"일반 전기·통신과 소방 전기는 서로 다른 공종입니다.",scope:"SITE"},
  {leftCanonicalTradeId:"MECHANICAL",rightCanonicalTradeId:"FIRE_PROTECTION",reasonKo:"일반 기계설비와 소방기계는 서로 다른 공종입니다.",scope:"SITE"},
  {leftCanonicalTradeId:"PLASTER",rightCanonicalTradeId:"SURFACE_FINISH",reasonKo:"미장과 견출은 현재 현장에서 별도 공종으로 관리합니다.",scope:"SITE"},
  {leftCanonicalTradeId:"STAFF",rightCanonicalTradeId:"DIRECT_LABOR",reasonKo:"직원과 직영 작업자는 같은 분류로 자동 연결하지 않습니다.",scope:"SITE"},
  {leftCanonicalTradeId:"FORMWORK",rightCanonicalTradeId:"INTERIOR_CARPENTRY",reasonKo:"골조 형틀과 내장목공은 서로 다른 공종입니다.",scope:"SITE"},
  {leftCanonicalTradeId:"FORMWORK",rightCanonicalTradeId:"WOODEN_DOOR",reasonKo:"골조 형틀과 목창호는 서로 다른 공종입니다.",scope:"SITE"},
  {leftCanonicalTradeId:"TOWER_CRANE_OPERATOR",rightCanonicalTradeId:"FORMWORK",reasonKo:"타워크레인 조종원은 형틀공이 아닙니다.",scope:"SITE"},
  {leftCanonicalTradeId:"TOWER_CRANE_OPERATOR",rightCanonicalTradeId:"REBAR",reasonKo:"타워크레인 조종원은 철근공이 아닙니다.",scope:"SITE"},
];
