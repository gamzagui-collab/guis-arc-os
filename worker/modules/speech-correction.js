const FIELD_KEYS={LOCATION_BUILDING:"building",LOCATION_FLOOR:"floor",LOCATION_UNIT:"unit",LOCATION_ROOM:"room",CONTENT_TERM:"content"};
export const normalizeSpeechCorrection=value=>String(value||"").normalize("NFKC").replace(/\s+/g," ").trim().toLocaleLowerCase("ko-KR");
const bounded=(value,max)=>String(value||"").slice(0,max);
const parseObject=value=>{try{return typeof value==="string"?JSON.parse(value):value||{}}catch{return {}}};
const similarity=(left,right)=>{const a=normalizeSpeechCorrection(left),b=normalizeSpeechCorrection(right);if(!a||!b)return 0;const shorter=Math.min(a.length,b.length),longer=Math.max(a.length,b.length);let same=0;for(const token of new Set(a.split(/\s+/)))if(b.includes(token))same+=token.length;return Math.max(shorter/longer,same/longer)};

export function dominantSpeechCorrection(rows){
 const candidates=[...rows].filter(row=>row.status==="ACTIVE"&&Number(row.evidence_count)>=3),total=[...rows].reduce((sum,row)=>sum+Number(row.evidence_count||0),0);
 candidates.sort((a,b)=>(Number(b.evidence_count)-Number(b.negative_evidence_count))-(Number(a.evidence_count)-Number(a.negative_evidence_count))||String(b.last_seen_at||"").localeCompare(String(a.last_seen_at||"")));
 const first=candidates[0],second=candidates[1];if(!first||!total)return null;const probability=Number(first.evidence_count)/total,secondProbability=second?Number(second.evidence_count)/total:0;
 return probability>=.7&&probability-secondProbability>=.2&&Number(first.evidence_count)>Number(first.negative_evidence_count)?{...first,probability}:null;
}

export function applySpeechCorrections(raw,rules=[],parserSnapshot={}){
 const normalized=normalizeSpeechCorrection(raw),fieldValues={},appliedRuleIds=[];let content=null;
 const groups=new Map();for(const rule of rules){const key=`${rule.field_type}:${rule.raw_normalized}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(rule)}
 for(const [fieldType,key] of Object.entries(FIELD_KEYS)){const source=fieldType==="CONTENT_TERM"?normalized:normalizeSpeechCorrection(parserSnapshot[key]);if(!source)continue;const winner=dominantSpeechCorrection(groups.get(`${fieldType}:${source}`)||[]);if(!winner)continue;if(fieldType==="CONTENT_TERM")content=winner.corrected_value;else fieldValues[key]=winner.corrected_value;appliedRuleIds.push(winner.id)}
 return {text:String(raw||""),content,fieldValues,appliedRuleIds};
}

async function refreshGroup(db,siteId,fieldType,rawNormalized){
 const result=await db.prepare("SELECT * FROM speech_correction_rules WHERE site_id=?1 AND field_type=?2 AND raw_normalized=?3").bind(siteId,fieldType,rawNormalized).all(),rows=result.results||[],total=rows.reduce((sum,row)=>sum+Number(row.evidence_count||0),0),ranked=[...rows].sort((a,b)=>(Number(b.evidence_count)-Number(b.negative_evidence_count))-(Number(a.evidence_count)-Number(a.negative_evidence_count))||String(b.last_seen_at).localeCompare(String(a.last_seen_at)));
 const statements=rows.map(row=>{const probability=total?Number(row.evidence_count)/total:0,lead=probability-(ranked[0]?.id===row.id?(ranked[1]?Number(ranked[1].evidence_count)/total:0):Number(ranked[0]?.evidence_count||0)/Math.max(1,total)),active=ranked[0]?.id===row.id&&Number(row.evidence_count)>=3&&probability>=.7&&lead>=.2&&Number(row.evidence_count)>Number(row.negative_evidence_count),disabled=Number(row.negative_evidence_count)>=Number(row.evidence_count)&&Number(row.negative_evidence_count)>=3;return db.prepare("UPDATE speech_correction_rules SET confidence=?2,status=?3 WHERE id=?1").bind(row.id,Math.max(0,Math.min(1,probability)),disabled?"DISABLED":active?"ACTIVE":"CANDIDATE")});
 if(statements.length)await db.batch(statements);
}

async function positive(db,{siteId,fieldType,rawNormalized,correctedValue}){const raw=normalizeSpeechCorrection(rawNormalized),corrected=bounded(correctedValue,4000);if(!raw||!corrected||raw===normalizeSpeechCorrection(corrected))return;await db.prepare("INSERT INTO speech_correction_rules(id,scope_type,site_id,field_type,raw_normalized,corrected_value,evidence_count) VALUES(?1,'SITE',?2,?3,?4,?5,1) ON CONFLICT(site_id,field_type,raw_normalized,corrected_value) DO UPDATE SET evidence_count=evidence_count+1,last_seen_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(),siteId,fieldType,raw,corrected).run();await refreshGroup(db,siteId,fieldType,raw)}

export async function listSpeechCorrections(db,siteId){const result=await db.prepare("SELECT id,field_type,raw_normalized,corrected_value,evidence_count,negative_evidence_count,confidence,status,last_seen_at FROM speech_correction_rules WHERE site_id=?1 AND status='ACTIVE' ORDER BY field_type,raw_normalized,evidence_count DESC,last_seen_at DESC LIMIT 300").bind(siteId).all();return result.results||[]}

export async function recordConfirmedSpeechCorrection(db,{siteId,userId,issueId,rawTranscript,normalizedTranscript,parserSnapshot,finalSnapshot,appliedRuleIds=[]}){
 const raw=bounded(rawTranscript,4000),normalized=bounded(normalizedTranscript||normalizeSpeechCorrection(raw),4000);if(!raw.trim()||!normalized)return false;const parser=parseObject(parserSnapshot),final=parseObject(finalSnapshot),ids=Array.isArray(appliedRuleIds)?appliedRuleIds.slice(0,100):[];
 await db.prepare("INSERT INTO speech_correction_events(id,site_id,user_id,issue_id,raw_transcript,normalized_transcript,parser_snapshot_json,final_snapshot_json,applied_rule_ids_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(crypto.randomUUID(),siteId,userId,issueId,raw,normalized,bounded(JSON.stringify(parser),8192),bounded(JSON.stringify(final),8192),bounded(JSON.stringify(ids),4096)).run();
 const applied=ids.length?(await db.prepare(`SELECT * FROM speech_correction_rules WHERE site_id=?1 AND id IN (${ids.map((_,index)=>`?${index+2}`).join(",")})`).bind(siteId,...ids).all()).results||[]:[],pairs=new Map();
 for(const rule of applied){const key=FIELD_KEYS[rule.field_type],finalValue=final[key];if(finalValue&&normalizeSpeechCorrection(finalValue)!==normalizeSpeechCorrection(rule.corrected_value)){await db.prepare("UPDATE speech_correction_rules SET negative_evidence_count=negative_evidence_count+1,last_seen_at=CURRENT_TIMESTAMP WHERE id=?1").bind(rule.id).run();pairs.set(`${rule.field_type}:${rule.raw_normalized}:${finalValue}`,{fieldType:rule.field_type,rawNormalized:rule.raw_normalized,correctedValue:finalValue});await refreshGroup(db,siteId,rule.field_type,rule.raw_normalized)}}
 for(const [fieldType,key] of Object.entries(FIELD_KEYS)){if(fieldType==="CONTENT_TERM")continue;const before=parser[key],after=final[key];if(before&&after&&normalizeSpeechCorrection(before)!==normalizeSpeechCorrection(after))pairs.set(`${fieldType}:${before}:${after}`,{fieldType,rawNormalized:before,correctedValue:after})}
 if(final.content&&normalizeSpeechCorrection(raw)!==normalizeSpeechCorrection(final.content)&&similarity(raw,final.content)>=.45)pairs.set(`CONTENT_TERM:${normalized}:${final.content}`,{fieldType:"CONTENT_TERM",rawNormalized:normalized,correctedValue:final.content});
 for(const pair of pairs.values())await positive(db,{siteId,...pair});return true;
}
