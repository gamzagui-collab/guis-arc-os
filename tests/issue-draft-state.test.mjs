import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
 buildDraftDisplay,
 buildDraftPayloadView,
 createIssueDraft,
 mergeSpeechCandidateIntoDraft,
 setDirectLocation,
 setManualBuilding,
 setManualContent,
 setManualDetail,
 setManualFloor,
 setManualUnit
} from "../apps/web/assets/issue-draft-state.js";

const location=(id,label,source="NONE")=>({id,label,source});
const candidate=(overrides={})=>({
 building:location("b201","201동","SPEECH"),floor:location("f19","19층","SPEECH"),unit:location("u1903","1903호","SPEECH"),
 detail:"거실 벽면",content:"활석",unresolvedStructural:[],rawTranscript:"201동 1903호 거실 벽면 활석",normalizedTranscript:"201동 1903호 거실 벽면 활석",parserSnapshot:{unit:"1903호"},appliedRuleIds:[],...overrides
});

test("manual location beats conflicting speech and emits a transient notice",()=>{
 let draft=createIssueDraft();
 draft=setManualBuilding(draft,location("b201","201동"));
 draft=setManualFloor(draft,location("f19","19층"));
 draft=setManualUnit(draft,location("u1903","1903호"));
 draft=mergeSpeechCandidateIntoDraft(draft,candidate({building:location("b202","202동","SPEECH"),floor:location("f18","18층","SPEECH"),unit:location("u1801","1801호","SPEECH"),detail:"거실 벽면",content:"할석"}));
 assert.deepEqual([draft.building,draft.floor,draft.unit].map(v=>[v.label,v.source]),[["201동","MANUAL"],["19층","MANUAL"],["1903호","MANUAL"]]);
 assert.equal(draft.detail.text,"거실 벽면");assert.equal(draft.content.text,"할석");assert.equal(draft.notice,"MANUAL_LOCATION_PRIORITY");
});

test("compatible speech fills empty lower levels below a manual building",()=>{
 let draft=setManualBuilding(createIssueDraft(),location("b201","201동"));
 draft=mergeSpeechCandidateIntoDraft(draft,candidate());
 assert.deepEqual([draft.building.source,draft.floor.source,draft.unit.source],["MANUAL","SPEECH","SPEECH"]);
});

test("manual parent conflict rejects speech descendants",()=>{
 let draft=setManualBuilding(createIssueDraft(),location("b201","201동"));
 draft=mergeSpeechCandidateIntoDraft(draft,candidate({building:location("b202","202동","SPEECH"),floor:location("f18","18층","SPEECH"),unit:location("u1801","1801호","SPEECH")}));
 assert.deepEqual([draft.building.id,draft.floor.id,draft.unit.id],["b201",null,null]);
});

test("speech-only apply preserves unresolved UNIT content and raw evidence",()=>{
 const draft=mergeSpeechCandidateIntoDraft(createIssueDraft(),candidate({floor:location(null,"","NONE"),unit:location(null,"","NONE"),content:"1902호 활석",unresolvedStructural:[{level:"unit",label:"1902호"}],rawTranscript:"201동 1902호 거실 벽면 활석"}));
 assert.deepEqual([draft.building.label,draft.floor.id,draft.unit.id,draft.content.text],["201동",null,null,"1902호 활석"]);
 assert.equal(draft.speech.rawTranscript,"201동 1902호 거실 벽면 활석");
});

test("missing building and descendants remain content",()=>{
 const draft=mergeSpeechCandidateIntoDraft(createIssueDraft(),candidate({building:location(null,"","NONE"),floor:location(null,"","NONE"),unit:location(null,"","NONE"),content:"203동 1001호 할석",unresolvedStructural:[{level:"building",label:"203동"},{level:"unit",label:"1001호"}]}));
 assert.equal(draft.building.id,null);assert.equal(draft.content.text,"203동 1001호 할석");
});

test("manual correction removes only the unresolved token for its level",()=>{
 let draft=mergeSpeechCandidateIntoDraft(createIssueDraft(),candidate({floor:location(null,"","NONE"),unit:location(null,"","NONE"),content:"99층 9901호 누수",unresolvedStructural:[{level:"floor",label:"99층"},{level:"unit",label:"9901호"}]}));
 draft=setManualFloor(draft,location("f19","19층"));
 assert.equal(draft.content.text,"9901호 누수");
});

test("manual content and detail edits survive speech reapply",()=>{
 let draft=mergeSpeechCandidateIntoDraft(createIssueDraft(),candidate({content:"1903호 명가리"}));
 draft=setManualContent(setManualDetail(draft,"거실 창가쪽 벽면"),"면갈이");
 draft=mergeSpeechCandidateIntoDraft(draft,candidate({detail:"거실 벽면",content:"명가리"}));
 assert.deepEqual([draft.detail.text,draft.detail.source,draft.content.text,draft.content.source],["거실 창가쪽 벽면","MANUAL","면갈이","MANUAL"]);
});

test("manual cascade resets stale descendants",()=>{
 let draft=mergeSpeechCandidateIntoDraft(createIssueDraft(),candidate());
 draft=setManualBuilding(draft,location("b202","202동"));
 assert.deepEqual([draft.floor.id,draft.unit.id],[null,null]);
 draft=setManualFloor(draft,location("f18","18층"));draft=setManualUnit(draft,location("u1801","1801호"));
 draft=setManualFloor(draft,location("f19","19층"));assert.equal(draft.unit.id,null);
});

test("draft display and payload are save-identical",()=>{
 const draft=mergeSpeechCandidateIntoDraft(createIssueDraft(),candidate());
 const display=buildDraftDisplay(draft),payload=buildDraftPayloadView(draft);
 assert.deepEqual(display,{location:"201동 / 19층 / 1903호",detail:"거실 벽면",content:"활석",notice:""});
 assert.deepEqual(payload,{location:"201동 / 19층 / 1903호 / 거실 벽면",description:"활석",buildingLocationId:"b201",buildingType:"BUILDING",floorLocationId:"f19",unitLocationId:"u1903",roomLocationId:"",speech:draft.speech});
});

test("direct mode preview and payload are equivalent and speech cannot disable it",()=>{
 let draft=setDirectLocation(createIssueDraft(),true,"옥상 물탱크실 옆");
 draft=setManualContent(draft,"누수 확인");draft=mergeSpeechCandidateIntoDraft(draft,candidate());
 assert.equal(draft.directLocation.enabled,true);
 assert.equal(buildDraftDisplay(draft).location,"옥상 물탱크실 옆");
 assert.deepEqual(buildDraftPayloadView(draft),{location:"옥상 물탱크실 옆",description:"누수 확인",buildingLocationId:"",buildingType:"BUILDING",floorLocationId:"",unitLocationId:"",roomLocationId:"",speech:draft.speech});
});

test("draft module has no Location Master mutation path",()=>{
 const source=fs.readFileSync(new URL("../apps/web/assets/issue-draft-state.js",import.meta.url),"utf8");
 assert.doesNotMatch(source,/fetch\(|\/site-locations|addAndSelect|POST|PATCH|DELETE/);
});

test("Issue form renders live preview and builds submit payload from the same Draft",()=>{
 const source=fs.readFileSync(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8"),flow=source.slice(source.indexOf("async function createV3"),source.indexOf("async function detail"));
 assert.match(flow,/최종 등록 미리보기/);assert.match(flow,/renderDraftPreview/);assert.match(flow,/buildDraftDisplay\(issueDraft\)/);assert.match(flow,/buildDraftPayloadView\(issueDraft\)/);
 assert.match(flow,/setManualBuilding/);assert.match(flow,/setManualFloor/);assert.match(flow,/setManualUnit/);assert.match(flow,/setManualDetail/);assert.match(flow,/setManualContent/);
 const recognition=flow.slice(flow.indexOf("recognition.onresult"),flow.indexOf("recognition.onerror"));
 assert.match(recognition,/speechCandidate=/);assert.doesNotMatch(recognition,/description\.value=|detailLocation\.value=/);
 assert.match(flow,/mergeSpeechCandidateIntoDraft/);assert.match(flow,/payload\.set\("description",draftPayload\.description\)/);
 assert.match(flow,/!rawParsed\.buildingLabel&&issueDraft\.building\.source==="MANUAL"/);
 assert.match(fs.readFileSync(new URL("../apps/web/service-worker.js",import.meta.url),"utf8"),/issue-draft-state\.js\?v=0\.27\.1-r33/);
});
