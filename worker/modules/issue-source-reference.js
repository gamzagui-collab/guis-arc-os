export const ISSUE_SOURCE_ITEM_MAX_COUNT=100;
export const ISSUE_SOURCE_ITEM_MAX_BYTES=16*1024;
export const ISSUE_SOURCE_DETACHED_WARNING="원본 작업 연결을 확인하지 못해 일반 이슈로 등록했습니다.";

const normalized=value=>String(value||"").trim().replace(/\s+/g," ");

export function buildSourceMatchKey(item={}){
 return [normalized(item.section_type).toUpperCase(),normalized(item.source_sheet_name),normalized(item.source_cell_range).replace(/\s+/g,"").toUpperCase()].join("|");
}

export function normalizeSourceItemRefs(items=[]){
 const refs=[];
 for(const item of items){
  const itemId=normalized(item.id||item.itemId),matchKey=item.matchKey||buildSourceMatchKey(item);
  if(!itemId||matchKey.split("|").some(part=>!part))return {ok:false,refs:[]};
  refs.push({itemId,matchKey});
 }
 const size=new TextEncoder().encode(JSON.stringify(refs)).byteLength;
 return refs.length<=ISSUE_SOURCE_ITEM_MAX_COUNT&&size<=ISSUE_SOURCE_ITEM_MAX_BYTES?{ok:true,refs}:{ok:false,refs:[]};
}
