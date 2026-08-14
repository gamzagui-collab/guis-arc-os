import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {extractLocationSpeech,finalizeIssueSpeechCandidates} from "../apps/web/assets/issue-speech.js";
import {issueLocationSubmission,resolveIssueDescriptionLocation} from "../apps/web/assets/issue-location-resolver.js";
import {issueShareDisplay} from "../apps/web/assets/issue-share-watermark.js";

const parse=text=>extractLocationSpeech(text,{allowedBuildings:["201동"]});
const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));

test("SST v3 separates structural location, detail location, and issue content",()=>{
  assert.deepEqual(pick(parse("201동 1903호 욕실 타일 깨짐"),["buildingLabel","unitLabel","detailCandidate","contentCandidate"]),{buildingLabel:"201동",unitLabel:"1903호",detailCandidate:"욕실",contentCandidate:"타일 깨짐"});
  assert.deepEqual(pick(parse("201동 1903호 거실 창가쪽 벽면 균열"),["detailCandidate","contentCandidate"]),{detailCandidate:"거실 창가쪽 벽면",contentCandidate:"균열"});
  assert.deepEqual(pick(parse("201동 1903호 엘리베이터 앞 도장 불량"),["detailCandidate","contentCandidate"]),{detailCandidate:"엘리베이터 앞",contentCandidate:"도장 불량"});
  assert.deepEqual(pick(parse("201동 1903호 누수"),["detailCandidate","contentCandidate"]),{detailCandidate:"",contentCandidate:"누수"});
  assert.deepEqual(pick(parse("201동 1903호 거실 벽면 면갈이"),["detailCandidate","contentCandidate"]),{detailCandidate:"거실 벽면",contentCandidate:"면갈이"});
  assert.deepEqual(pick(parse("201동 1903호 거실 벽면 명가리"),["detailCandidate","contentCandidate"]),{detailCandidate:"거실 벽면",contentCandidate:"명가리"});
  assert.deepEqual(pick(parse("201동 1902호 거실 벽면 활성"),["detailCandidate","contentCandidate"]),{detailCandidate:"거실 벽면",contentCandidate:"활성"});
});

test("SST v3 preserves uncertain remainder as content",()=>{
  assert.deepEqual(pick(parse("201동 1903호 알 수 없는 작업"),["detailCandidate","contentCandidate"]),{detailCandidate:"",contentCandidate:"알 수 없는 작업"});
});

test("resolver projects a unit through its actual parent floor without arithmetic",()=>{
  const locations=[
    {id:"b201",parent_id:null,location_type:"BUILDING",display_name:"201동"},
    {id:"f18",parent_id:"b201",location_type:"FLOOR",display_name:"18층"},
    {id:"f19",parent_id:"b201",location_type:"FLOOR",display_name:"19층"},
    {id:"u1902",parent_id:"f19",location_type:"UNIT",display_name:"1902호"},
  ];
  const result=resolveIssueDescriptionLocation("201동 1902호 거실 벽면 활성",{locations,aliases:[]});
  assert.deepEqual(result.path,{buildingId:"b201",floorId:"f19",unitId:"u1902",roomId:null});
});

test("unresolved structural-looking tokens stay in final content without canonical inference",()=>{
  const locations=[
    {id:"b201",parent_id:null,location_type:"BUILDING",display_name:"201동"},
    {id:"f19",parent_id:"b201",location_type:"FLOOR",display_name:"19층"},
    {id:"u1903",parent_id:"f19",location_type:"UNIT",display_name:"1903호"},
  ];
  const raw=parse("201동 1902호 거실 벽면 활석");
  const resolution=resolveIssueDescriptionLocation(raw.normalized,{locations,aliases:[]});
  const result=finalizeIssueSpeechCandidates(raw,resolution);
  assert.deepEqual(resolution.path,{buildingId:"b201",floorId:null,unitId:null,roomId:null});
  assert.deepEqual(result,{detailCandidate:"거실 벽면",contentCandidate:"1902호 활석",unresolvedStructuralLabels:["1902호"]});
  const submission=issueLocationSubmission({mode:"CANONICAL",canonicalText:"201동",detailText:result.detailCandidate,canonical:{buildingLocationId:"b201"}});
  assert.deepEqual(submission,{location:"201동 / 거실 벽면",buildingLocationId:"b201",buildingType:"BUILDING",floorLocationId:"",unitLocationId:"",roomLocationId:""});
  assert.deepEqual(issueShareDisplay({...submission,description:result.contentCandidate}),{location:"201동",content:"거실 벽면 1902호 활석"});
});

test("unresolved BUILDING FLOOR and UNIT labels are all preserved in speech order",()=>{
  const parsed={buildingLabel:"999동",floorLabel:"20층",unitLabel:"2001호",detailCandidate:"옥상",contentCandidate:"누수"};
  const result=finalizeIssueSpeechCandidates(parsed,{path:{buildingId:null,floorId:null,unitId:null,roomId:null},labels:{}});
  assert.deepEqual(result,{detailCandidate:"옥상",contentCandidate:"999동 20층 2001호 누수",unresolvedStructuralLabels:["999동","20층","2001호"]});
});

test("resolved structural tokens are consumed from final content",()=>{
  const locations=[
    {id:"b201",parent_id:null,location_type:"BUILDING",display_name:"201동"},
    {id:"f19",parent_id:"b201",location_type:"FLOOR",display_name:"19층"},
    {id:"u1903",parent_id:"f19",location_type:"UNIT",display_name:"1903호"},
  ];
  const raw=parse("201동 1903호 거실 벽면 명가리");
  const resolution=resolveIssueDescriptionLocation(raw.normalized,{locations,aliases:[]});
  assert.deepEqual(finalizeIssueSpeechCandidates(raw,resolution),{detailCandidate:"거실 벽면",contentCandidate:"명가리",unresolvedStructuralLabels:[]});
});

test("create flow keeps raw speech evidence in the candidate and submits Draft content",()=>{
  const ui=fs.readFileSync(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");
  const flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));
  const speech=flow.slice(flow.indexOf("recognition.onresult"),flow.indexOf("recognition.onerror"));
  assert.match(speech,/speechCandidate=makeSpeechCandidate\(rawTranscript\)/);
  assert.doesNotMatch(speech,/description\.value=|detailLocation\.value=/);
  assert.doesNotMatch(speech,/description\.value=rawTranscript/);
  assert.match(flow,/speechRawTranscript/);
  assert.match(flow,/speechNormalizedTranscript/);
  assert.match(flow,/speechParserSnapshotJson/);
  assert.match(flow,/speechAppliedRuleIdsJson/);
  assert.match(flow,/payload\.set\("title",draftPayload\.description/);
  assert.match(flow,/buildDraftPayloadView\(issueDraft\)/);
});

test("canonical save joins only selected structure and parsed detail",()=>{
  const parsed=parse("201동 1903호 거실 벽면 면갈이");
  const submission=issueLocationSubmission({mode:"CANONICAL",canonicalText:"201동 / 19층 / 1903호",detailText:parsed.detailCandidate,canonical:{buildingLocationId:"b201",floorLocationId:"f19",unitLocationId:"u1903"}});
  assert.equal(submission.location,"201동 / 19층 / 1903호 / 거실 벽면");
  assert.equal(parsed.contentCandidate,"면갈이");
});

test("new SST v3 issues share cleanly while r29 historical defense remains",()=>{
  const current=issueShareDisplay({location:"201동 / 19층 / 1903호 / 거실 벽면",description:"면갈이",buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u"});
  assert.deepEqual(current,{location:"201동 / 19층 / 1903호",content:"거실 벽면 면갈이"});
  assert.doesNotMatch(current.content,/명가리/);
  const historical=issueShareDisplay({location:"201동 / 19층 / 1903호 / 거실 벽면",description:"201동 19층 1903호 거실 벽면 면갈이",buildingLocationId:"b",floorLocationId:"f",unitLocationId:"u",roomLocationId:"historical-room"});
  assert.equal(historical.location,"201동 / 19층 / 1903호 / 거실 벽면");
  assert.equal(historical.content,"면갈이");
});

test("SST v3 frontend surfaces use the r33 static revision",()=>{
  const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
  assert.match(read("apps/web/index.html"),/app\.js\?v=0\.27\.1-r33/);
  assert.match(read("apps/web/assets/app.js"),/issues\.js\?v=0\.27\.1-r33/);
  assert.match(read("apps/web/assets/issues.js"),/issue-speech\.js\?v=0\.27\.1-r33/);
  assert.match(read("apps/web/service-worker.js"),/guis-arc-integrated-v0\.27\.1-r33-shell/);
});
