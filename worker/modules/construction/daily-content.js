import {reconcileWorkforceTrades,resolveCanonicalTrade} from "./trade-matcher.js";

function text(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .join("\n")
    .trim();
  return normalized || null;
}

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rawLines(values) {
  return (Array.isArray(values) ? values : []).map(text);
}

export function constructionTradeIdentity(item) {
  const trade=text(item?.trade)||"공종 미기재";
  const resolved=resolveCanonicalTrade(trade);
  const matchedId=item?.canonicalTradeId
    ||item?.tradeMatch?.canonicalWorkTradeId
    ||item?.tradeMatch?.canonicalOutputTradeId
    ||resolved.canonicalTradeId;
  const canonicalTradeId=matchedId&&matchedId!=="UNKNOWN"?matchedId:null;
  const baseTradeNormalized=resolved.baseTradeNormalized||trade;
  return {
    displayTrade:text(resolved.baseTradeRaw)||trade,
    tradeComparisonKey:canonicalTradeId?`CANONICAL:${canonicalTradeId}`:`BASE:${baseTradeNormalized}`,
    tradeDetailsRaw:text(resolved.detailsRaw),
    canonicalTradeId,
  };
}

export function canonicalDailyContent(siteId, block) {
  return {
    comparisonVersion: number(block?.comparisonVersion)??3,
    siteId: text(siteId),
    workDate: text(block?.workDate),
    siteName: text(block?.siteName),
    weather: text(block?.weather),
    minTemperature: number(block?.minTemperature),
    maxTemperature: number(block?.maxTemperature),
    trades: (Array.isArray(block?.trades) ? block.trades : []).map((trade, order) => ({
      order,
      trade: text(trade?.trade),
      previousWorkforce: number(trade?.previousWorkforce),
      plannedWorkforce: number(trade?.plannedWorkforce),
      cumulativeWorkforce: number(trade?.cumulativeWorkforce),
    })),
    previousWorkRaw: rawLines(block?.previousWorkRaw),
    plannedWorkRaw: rawLines(block?.plannedWorkRaw),
    remarks: text(block?.remarks),
    todayWorkforceTotal: number(block?.todayWorkforceTotal),
    employeeWorkforce: number(block?.employeeWorkforce),
    tradeWorkforceTotal: number(block?.tradeWorkforceTotal),
    plannedWorkItems: (Array.isArray(block?.plannedWorkItems) ? block.plannedWorkItems : []).map((item, order) => {
      const identity=constructionTradeIdentity(item);
      return {
        order,
        trade: text(item?.trade),
        ...identity,
        description: text(item?.description),
        rawText: text(item?.rawText),
        plannedWorkforce: number(item?.plannedWorkforce),
        isFallbackWorkItem: Boolean(item?.isFallbackWorkItem),
        workDescriptionSource: text(item?.workDescriptionSource),
      };
    }),
  };
}

export function restoreLegacyFallbackItems({revision=null,plannedWorkItems=[],workforceRows=[],employeeWorkforce=null,comparisonVersion=null}={}) {
  const items=Array.isArray(plannedWorkItems)?plannedWorkItems:[];
  const rows=Array.isArray(workforceRows)?[...workforceRows]:[];
  const legacyStructure=number(comparisonVersion)===null||number(comparisonVersion)<3||items.some(item=>!Object.prototype.hasOwnProperty.call(item,"isFallbackWorkItem")||!Object.prototype.hasOwnProperty.call(item,"workDescriptionSource"));
  if(!legacyStructure)return {plannedWorkItems:items,restoredItems:[],unresolvedItems:[],evidence:[]};
  const evidence=[];
  const hasStaffEvidence=rows.some(row=>constructionTradeIdentity(row).canonicalTradeId==="STAFF"&&number(row?.plannedWorkforce)!==null);
  const hasStaffItem=items.some(item=>constructionTradeIdentity(item).canonicalTradeId==="STAFF");
  if(!hasStaffEvidence&&!hasStaffItem&&number(employeeWorkforce)!==null){
    rows.push({trade:"직원",plannedWorkforce:number(employeeWorkforce),comparisonEvidenceSource:"employee_workforce"});
    evidence.push({trade:"직원",plannedWorkforce:number(employeeWorkforce),source:"employee_workforce"});
  }
  for(const row of rows){
    const workforce=number(row?.plannedWorkforce);
    if(workforce!==null&&row?.comparisonEvidenceSource!=="employee_workforce")evidence.push({trade:text(row?.trade),plannedWorkforce:workforce,source:"workforce_row"});
  }
  const reconciled=reconcileWorkforceTrades(rows,items);
  const existingKeys=new Set(items.map(item=>constructionTradeIdentity(item).tradeComparisonKey));
  const restoredItems=reconciled.plannedWorkItems.filter(item=>item.isFallbackWorkItem&&!existingKeys.has(constructionTradeIdentity(item).tradeComparisonKey));
  return {plannedWorkItems:reconciled.plannedWorkItems,restoredItems,unresolvedItems:[],evidence,revision};
}

export function normalizeStoredConstructionRevision(row) {
  if(!row)return null;
  let snapshot={};
  try{snapshot=typeof row.content_snapshot_json==="string"?JSON.parse(row.content_snapshot_json):row.contentSnapshot||row.content_snapshot_json||{}}catch{snapshot={}}
  return {
    ...snapshot,
    revision:number(row.revision),
    comparisonVersion:number(snapshot.comparisonVersion??row.comparison_version),
    todayWorkforceTotal:number(snapshot.todayWorkforceTotal??row.today_workforce_total),
    employeeWorkforce:number(snapshot.employeeWorkforce??row.employee_workforce),
    tradeWorkforceTotal:number(snapshot.tradeWorkforceTotal??row.trade_workforce_total),
    plannedWorkItems:Array.isArray(snapshot.plannedWorkItems)?snapshot.plannedWorkItems:[],
    trades:Array.isArray(snapshot.trades)?snapshot.trades:[],
  };
}

export function normalizeCanonicalSnapshot(snapshot) {
  if (!snapshot) return null;
  const items=Array.isArray(snapshot.plannedWorkItems)?snapshot.plannedWorkItems:[];
  const restored=restoreLegacyFallbackItems({revision:snapshot.revision,plannedWorkItems:items,workforceRows:snapshot.trades,employeeWorkforce:snapshot.employeeWorkforce,comparisonVersion:snapshot.comparisonVersion});
  return canonicalDailyContent(snapshot.siteId,{...snapshot,plannedWorkItems:restored.plannedWorkItems});
}

export function comparableDailyContent(snapshot) {
  const normalized=normalizeCanonicalSnapshot(snapshot);
  if(!normalized)return null;
  const plannedWorkItems=normalized.plannedWorkItems
    .map(item=>({trade:item.displayTrade,tradeComparisonKey:item.tradeComparisonKey,description:item.description,plannedWorkforce:item.plannedWorkforce,isFallbackWorkItem:item.isFallbackWorkItem}))
    .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),"ko"));
  const trades=normalized.trades
    .map(item=>{
      const identity=constructionTradeIdentity(item);
      return {trade:identity.displayTrade,tradeComparisonKey:identity.tradeComparisonKey,previousWorkforce:item.previousWorkforce,plannedWorkforce:item.plannedWorkforce,cumulativeWorkforce:item.cumulativeWorkforce};
    })
    .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),"ko"));
  return {...normalized,trades,plannedWorkRaw:plannedWorkItems.length?[]:normalized.plannedWorkRaw,plannedWorkItems};
}

export function normalizeConstructionDescription(value) {
  return String(value??"")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\r\n?/g,"\n")
    .split("\n")
    .map(line=>line.replace(/^\s*[▶▷▸◆◇•·\-–—]+\s*/,"").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s*([,/，])\s*/g,"$1")
    .replace(/\s+/g,"")
    .trim();
}

export function normalizeConstructionComparisonItem(item,originalIndex=0) {
  const identity=constructionTradeIdentity(item);
  return {
    originalIndex,
    tradeRaw:text(item?.trade)||"공종 미기재",
    displayTrade:identity.displayTrade,
    canonicalTradeId:identity.canonicalTradeId,
    baseTradeNormalized:identity.tradeComparisonKey,
    compositeDetailsRaw:identity.tradeDetailsRaw,
    normalizedDescription:normalizeConstructionDescription(item?.description),
    description:text(item?.description)||"작업내용 미기재",
    plannedWorkforce:number(item?.plannedWorkforce),
    isFallbackWorkItem:Boolean(item?.isFallbackWorkItem),
  };
}

const comparisonView=item=>item?({
  trade:item.displayTrade,
  displayTrade:item.displayTrade,
  tradeComparisonKey:item.baseTradeNormalized,
  description:item.description,
  plannedWorkforce:item.plannedWorkforce,
  isFallbackWorkItem:item.isFallbackWorkItem,
}):null;

function comparePlannedWorkItems(before=[],after=[]) {
  const previous=(Array.isArray(before)?before:[]).map(normalizeConstructionComparisonItem);
  const uploaded=(Array.isArray(after)?after:[]).map(normalizeConstructionComparisonItem);
  const keys=[...new Set([...previous,...uploaded].map(item=>item.baseTradeNormalized))].sort((a,b)=>a.localeCompare(b,"ko"));
  const changes=[],unchangedMatches=[],reviewItems=[];
  for(const key of keys){
    const oldRemaining=new Set(previous.filter(item=>item.baseTradeNormalized===key));
    const newRemaining=new Set(uploaded.filter(item=>item.baseTradeNormalized===key));
    const pairs=[];
    const exactSignatures=[...new Set([...oldRemaining,...newRemaining].map(item=>`${item.normalizedDescription}\u0000${item.plannedWorkforce===null?"NULL":item.plannedWorkforce}`))].sort();
    for(const signature of exactSignatures){
      const oldItems=[...oldRemaining].filter(item=>`${item.normalizedDescription}\u0000${item.plannedWorkforce===null?"NULL":item.plannedWorkforce}`===signature).sort((a,b)=>a.originalIndex-b.originalIndex);
      const newItems=[...newRemaining].filter(item=>`${item.normalizedDescription}\u0000${item.plannedWorkforce===null?"NULL":item.plannedWorkforce}`===signature).sort((a,b)=>a.originalIndex-b.originalIndex);
      for(let index=0;index<Math.min(oldItems.length,newItems.length);index++){
        pairs.push([oldItems[index],newItems[index]]);oldRemaining.delete(oldItems[index]);newRemaining.delete(newItems[index]);
      }
    }
    const pairUnique=predicate=>{
      for(const oldItem of [...oldRemaining]){
        const candidates=[...newRemaining].filter(newItem=>predicate(oldItem,newItem));
        if(candidates.length!==1)continue;
        const reverse=[...oldRemaining].filter(candidate=>predicate(candidate,candidates[0]));
        if(reverse.length===1){pairs.push([oldItem,candidates[0]]);oldRemaining.delete(oldItem);newRemaining.delete(candidates[0])}
      }
    };
    pairUnique((oldItem,newItem)=>oldItem.normalizedDescription===newItem.normalizedDescription);
    pairUnique((oldItem,newItem)=>oldItem.plannedWorkforce===newItem.plannedWorkforce);
    if(oldRemaining.size===1&&newRemaining.size===1){
      pairs.push([[...oldRemaining][0],[...newRemaining][0]]);oldRemaining.clear();newRemaining.clear();
    }
    for(const [oldItem,newItem] of pairs){
      const workforceChanged=oldItem.plannedWorkforce!==newItem.plannedWorkforce;
      const descriptionChanged=oldItem.normalizedDescription!==newItem.normalizedDescription;
      if(!workforceChanged&&!descriptionChanged)unchangedMatches.push({before:comparisonView(oldItem),after:comparisonView(newItem),matchReason:"SAME_BASE_TRADE_SAME_WORK_SAME_WORKFORCE"});
      else changes.push({field:"금일 주요 작업",type:workforceChanged&&descriptionChanged?"인원 및 작업내용 변경":workforceChanged?"인원 변경":"작업내용 변경",before:comparisonView(oldItem),after:comparisonView(newItem)});
    }
    if(oldRemaining.size&&newRemaining.size){
      const review={field:"금일 주요 작업",type:"확인 필요",before:[...oldRemaining].map(comparisonView),after:[...newRemaining].map(comparisonView)};
      changes.push(review);reviewItems.push(review);
    }else{
      changes.push(...[...oldRemaining].map(item=>({field:"금일 주요 작업",type:"공종 삭제",before:comparisonView(item),after:null})));
      changes.push(...[...newRemaining].map(item=>({field:"금일 주요 작업",type:"공종 추가",before:null,after:comparisonView(item)})));
    }
  }
  return {changes,unchangedMatches,reviewItems};
}

export async function canonicalContentHash(snapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const LABELS = {
  siteName: "현장명",
  weather: "날씨",
  minTemperature: "최저기온",
  maxTemperature: "최고기온",
  trades: "공종 및 예정 인원",
  previousWorkRaw: "전일 작업",
  plannedWorkRaw: "금일 작업",
  remarks: "비고",
  plannedWorkItems: "금일 주요 작업",
};

export function compareDailyConstructionContent(previous,current) {
  if(!previous)return {changed:true,changes:[{field:"기존 저장본",before:null,after:"이전 버전 저장본으로 항목별 비교 정보가 없습니다."}],unchangedMatches:[],reviewItems:[],comparisonVersion:2};
  const comparablePrevious=comparableDailyContent(previous),comparableCurrent=comparableDailyContent(current);
  const workComparison=comparePlannedWorkItems(comparablePrevious.plannedWorkItems,comparableCurrent.plannedWorkItems);
  const previousHasDetailedWorkforceEvidence=(Array.isArray(previous?.trades)&&previous.trades.some(row=>number(row?.plannedWorkforce)!==null))||number(previous?.employeeWorkforce)!==null;
  if(!previousHasDetailedWorkforceEvidence&&number(previous?.todayWorkforceTotal)!==null){
    workComparison.changes=workComparison.changes.map(change=>change.type==="공종 추가"&&change.after?.isFallbackWorkItem
      ?{...change,type:"확인 필요",explanationKo:`기존 Revision에는 기타 인원이 있었지만 공종명이 저장되지 않아 업로드의 ${change.after.trade} ${change.after.plannedWorkforce}명과 같은 인원인지 자동으로 확정할 수 없습니다.`}
      :change);
    workComparison.reviewItems.push(...workComparison.changes.filter(change=>change.type==="확인 필요"&&!workComparison.reviewItems.includes(change)));
  }
  const changes=Object.keys(LABELS).filter(key=>key!=="plannedWorkItems").flatMap((key) => {
    const before = comparablePrevious[key] ?? null;
    const after = comparableCurrent[key] ?? null;
    return JSON.stringify(before) === JSON.stringify(after)
      ? []
      : [{ field: LABELS[key], before, after }];
  });
  changes.push(...workComparison.changes);
  return {changed:changes.length>0,changes,unchangedMatches:workComparison.unchangedMatches,reviewItems:workComparison.reviewItems,comparisonVersion:2};
}

export function contentDiff(previous,current) {
  return compareDailyConstructionContent(previous,current).changes;
}

export function isExplicitRestDay(block) {
  const source = [
    ...(Array.isArray(block?.plannedWorkRaw) ? block.plannedWorkRaw : []),
    ...(Array.isArray(block?.previousWorkRaw) ? block.previousWorkRaw : []),
    block?.remarks,
  ].filter(Boolean).join(" ");
  return /(휴무|휴일|작업\s*없음|공사\s*없음)/.test(source);
}

export function isBlankDailyBlock(block) {
  const hasWork = Array.isArray(block?.plannedWorkItems) && block.plannedWorkItems.length > 0;
  const hasRaw = (Array.isArray(block?.plannedWorkRaw) ? block.plannedWorkRaw : []).some((value) => text(value));
  const hasPeople = (Array.isArray(block?.trades) ? block.trades : []).some((trade) => (number(trade?.plannedWorkforce) ?? 0) > 0);
  return !hasWork && !hasRaw && !hasPeople && !text(block?.remarks);
}
