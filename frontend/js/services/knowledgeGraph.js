import { TRADE_KNOWLEDGE } from "./knowledgeBase.js";
import { QUALITY_KNOWLEDGE } from "./qualityKnowledge.js";
export function getKnowledgeNodes(){
 return [{id:"concrete",title:"콘크리트 타설",summary:"타설량, 공시체, 슬럼프, 펌프카, 강우, 양생을 통합 관리",tags:["품질","안전","날씨","장비"],five:["공시체 수량 산정","펌프카 전도 방지","강우 보양·양생 확인"],quality:["공시체","슬럼프","공기량","염화물","콘크리트 온도","양생"],safety:["펌프카 아웃트리거","레미콘 차량 동선","타설구간 추락·미끄럼"],photo:["송장","슬럼프","공시체 라벨","다짐","보양"],refs:QUALITY_KNOWLEDGE.concrete.standards},
 ...TRADE_KNOWLEDGE.map(t=>({id:t.id,title:t.name,summary:t.summary,tags:["공종","품질","안전"],five:[t.keyPoint,t.safetyTop5?.[0],t.qualityTop3?.[0]].filter(Boolean),quality:t.qualityTop3||[],safety:t.safetyTop5||[],photo:t.checklist||[],refs:[...(t.kcs||[]),...(t.laws||[])]}))];
}
export function searchKnowledge(q=""){const query=q.trim().toLowerCase();const nodes=getKnowledgeNodes();if(!query)return nodes;return nodes.filter(n=>[n.title,n.summary,...n.tags,...n.five,...n.quality,...n.safety].join(" ").toLowerCase().includes(query));}
