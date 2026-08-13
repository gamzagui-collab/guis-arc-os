import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {extractLocationSpeech} from "../apps/web/assets/issue-speech.js";
import {issueCompletionEvidenceDecision} from "../worker/modules/issues.js";
import {issueActionVisibility} from "../apps/web/assets/issue-action-policy.js";

const read=file=>fs.readFileSync(file,"utf8");
const worker=read("worker/modules/issues.js"),ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css");

test("0034 preserves rows and adds non-unique media ordering",()=>{
 const db=new DatabaseSync(":memory:");
 db.exec("CREATE TABLE issue_media(id TEXT PRIMARY KEY,issue_id TEXT,media_role TEXT,action_id TEXT,status TEXT); INSERT INTO issue_media VALUES('m1','i1','CREATION',NULL,'ACTIVE')");
 db.exec(read("database/migrations/0034_issue_media_sort_order.sql"));
 assert.equal(db.prepare("SELECT sort_order FROM issue_media WHERE id='m1'").get().sort_order,0);
 assert.equal(db.prepare("SELECT [unique] FROM pragma_index_list('issue_media') WHERE name='idx_issue_media_issue_role_order'").get().unique,0);
});

test("new creation and action media use indexed order and creation-only representative",()=>{
 for(const token of["photoCount","photo_${index}","thumbnail_${index}","sortOrder:index","media.sortOrder","...media.map(value=>mediaStatement"] )assert.ok(worker.includes(token));
 assert.match(worker,/media_role='CREATION' ORDER BY m\.sort_order ASC,m\.created_at ASC LIMIT 1/);
 assert.match(worker,/sort_order ASC,created_at ASC/);
});

test("floor-scoped numbered stair is a ROOM and never a UNIT",()=>{
 const result=extractLocationSpeech("202동 16층 1번계단 알폼 반출 안 됨",{allowedBuildings:["202동"]});
 assert.equal(result.buildingLabel,"202동");
 assert.equal(result.floorLabel,"16층");
 assert.equal(result.unitLabel,null);
 assert.equal(result.roomLabel,"1번계단");
});

test("existing household unit parsing stays canonical",()=>{
 assert.equal(extractLocationSpeech("202동 1403호 거실",{allowedBuildings:["202동"]}).unitLabel,"1403호");
 assert.equal(extractLocationSpeech("202동 B101호 현관",{allowedBuildings:["202동"]}).unitLabel,"B101호");
});



test("manual UNIT selection remains available while speech auto-location stays off",()=>{const manual=ui.slice(ui.indexOf("function selectCanonicalUnitParentChain"),ui.indexOf("function bindPhotoInputs")),createFlow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail")),onresult=createFlow.slice(createFlow.indexOf("recognition.onresult"),createFlow.indexOf("recognition.onerror"));assert.match(manual,/floorOption\.dataset\.parentId/);assert.match(manual,/form\.elements\.floor\.value=floorOption\.value/);assert.match(ui,/unit\.onchange=.*selectCanonicalUnitParentChain/);assert.doesNotMatch(onresult,/form\.elements\.(?:building|floor|unit|area)\.value/);assert.doesNotMatch(onresult,/addAndSelect\(/);assert.match(onresult,/description\.value=rawTranscript/)})

test("department evidence policy uses latest category semantics",()=>{
 assert.deepEqual(issueCompletionEvidenceDecision({department:"CONSTRUCTION",actionPhotoCount:0,siteVerifier:true,status:"OPEN"}),{allowed:true,method:"SITE_VERIFIED"});
 assert.deepEqual(issueCompletionEvidenceDecision({department:"ADMINISTRATION",actionPhotoCount:0,siteVerifier:true,status:"ASSIGNED"}),{allowed:true,method:"SITE_VERIFIED"});
 assert.equal(issueCompletionEvidenceDecision({department:"SAFETY",actionPhotoCount:0,siteVerifier:true,status:"OPEN"}).code,"ISSUE_COMPLETION_PHOTO_REQUIRED");
 assert.equal(issueCompletionEvidenceDecision({department:"QUALITY",actionPhotoCount:0,siteVerifier:true,status:"OPEN"}).code,"ISSUE_COMPLETION_PHOTO_REQUIRED");
 assert.deepEqual(issueCompletionEvidenceDecision({department:"QUALITY",actionPhotoCount:1,siteVerifier:true,status:"ACTION_IN_PROGRESS"}),{allowed:true,method:"PHOTO_VERIFIED"});
 assert.equal(issueCompletionEvidenceDecision({department:"CONSTRUCTION",actionPhotoCount:0,siteVerifier:false,status:"OPEN"}).allowed,false);
});

test("action photo actor is permission based and independent from assignee",()=>{
 const session={context:{selectedSiteId:"site-1",user:{id:"safety-manager"},permissions:["issue.act"],boardAccess:{ISSUE:{accessLevel:"EDIT"}}}},issue={siteId:"site-1",assigneeUserId:"contractor-worker",status:"ASSIGNED"};
 assert.equal(issueActionVisibility({session,issue}).showActionForm,true);
 assert.equal(issueActionVisibility({session:{context:{...session.context,permissions:[],boardAccess:{ISSUE:{accessLevel:"VIEW"}}}},issue}).showActionForm,false);
 assert.match(worker,/ISSUE_ACTION_PERMISSION_DENIED/);
 assert.doesNotMatch(worker,/Only the assignee or manager can act/);
 assert.match(worker,/created_by_user_id,action_type,description/);
 assert.match(worker,/uploaded_by_user_id/);
 assert.match(ui,/name="photo" type="file" accept="image\/\*" capture="environment" multiple required/);
 assert.match(ui,/appendMultiPhotoPayload\(form,actionPhotos\)/);
});

test("mobile queue and immediate multi-file share are wired without a new camera API",()=>{
 for(const token of["bindFieldPhotoQueue","capture-finish","photo-queue-thumbs","appendMultiPhotoPayload","renderCreateSuccess","navigator.share({files})","fieldMultiPhotoDraft"])assert.ok((ui+css).includes(token));
 assert.doesNotMatch(ui,/getUserMedia/);
 assert.match(ui,/draft\.photos\.length>=10/);
});

test("new Issue route binds the capture queue and renders direct list/photo actions",()=>{
 const flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));
 assert.match(flow,/photoQueue=bindFieldPhotoQueue\(form,editedPhoto\)/);
 assert.match(ui,/capture-finish/);
 assert.match(flow,/create-photo-navigation/);
 assert.ok(flow.indexOf("create-photo-navigation")<flow.indexOf("photo-actions"));
 assert.match(flow,/href="\/issues\?view=list">목록 보기/);
 assert.match(flow,/href="\/issues\?view=photo">사진 보기/);
 assert.match(css,/\.create-photo-navigation\{[^}]*grid-template-columns:repeat\(2,1fr\)/);
 assert.match(css,/\.create-photo-navigation \.action-link\{[^}]*background:#f8fafc[^}]*border:1px solid #cbd5e1/);
 assert.match(css,/\.camera-action\{background:#111;color:#fff/);
});

test("new Issue explicit view navigation overrides the saved Issue mode",()=>{
 assert.match(ui,/function explicitIssueViewMode\(\)\{const view=new URLSearchParams\(location\.search\)\.get\("view"\);if\(view==="list"\)return"list";if\(view==="photo"\|\|view==="slide"\)return"slide";return""\}/);
 assert.match(ui,/const explicitMode=explicitIssueViewMode\(\),saved=sessionStorage\.getItem\(issueSessionKeys\.view\);if\(explicitMode\)mode=explicitMode;else if\(saved\)mode=saved/);
 assert.match(ui,/if\(explicitMode\)sessionStorage\.setItem\(issueSessionKeys\.view,mode\)/);
 assert.match(ui,/href="\/issues\?view=list">목록 보기/);
 assert.match(ui,/href="\/issues\?view=photo">사진 보기/);
});

test("speech result preserves parser snapshot without selecting FLOOR or ROOM",()=>{const createFlow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail")),onresult=createFlow.slice(createFlow.indexOf("recognition.onresult"),createFlow.indexOf("recognition.onerror"));assert.match(onresult,/parserSnapshot=\{building:rawParsed\.buildingLabel,floor:rawParsed\.floorLabel,unit:rawParsed\.unitLabel,room:rawParsed\.roomLabel/);assert.doesNotMatch(onresult,/parsed\.floorLabel|addAndSelect|dispatchEvent/);assert.match(onresult,/description\.value=rawTranscript/)})

test("Issue create removes the r16 manual fallback and keeps canonical or empty location payloads",()=>{const createFlow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));assert.doesNotMatch(createFlow,/manualLocationText|manual-location|setManualLocationMode|leaveManualLocation/);assert.match(createFlow,/payload\.set\("location",canonicalLocationText\)/);for(const id of ["buildingLocationId","floorLocationId","unitLocationId"])assert.match(createFlow,new RegExp(`payload\\.set\\("${id}",canonicalLocationId`));assert.match(createFlow,/payload\.set\("roomLocationId",roomOption\?\.textContent==="기타"\?"":canonicalLocationId\(roomOption\)\)/);assert.match(worker,/const location=qText\(form\.get\("location"\),200,"LOCATION",false\)/);assert.match(worker,/validateIssueLocationSelection\(\{building,floor,unit,room\}\);const location=/)})

test("site verifier UI calls the dedicated evidence endpoint",()=>{
 assert.match(ui,/현장확인 완료/);
 assert.match(ui,/site-verify-completion/);
 assert.match(ui,/showSiteVerify/);
});

test("share rendering enlarges text and removes only leading location tokens",()=>{
 assert.match(ui,/locationSize=Math\.max\(56/);
 assert.match(ui,/descriptionSize=Math\.max\(40/);
 assert.match(ui,/value\.startsWith\(token\)/);
 assert.match(ui,/safeShareName/);
});

test("create success share shows prominent progress and prevents duplicate clicks",()=>{
 const flow=ui.slice(ui.indexOf("async function renderCreateSuccess"),ui.indexOf("function bindActionPhotoQueue"));
 assert.ok(flow.indexOf("share-created-status")<flow.indexOf("share-created-photos"));
 assert.match(flow,/shareButton\.disabled=true/);
 assert.match(flow,/if\(sharing\)return/);
 assert.match(flow,/setInterval/);
 assert.match(flow,/clearInterval/);
 assert.match(flow,/shareButton\.disabled=false/);
 assert.match(flow,/다시 시도할 수 있습니다/);
 assert.match(css,/\.share-created-status\.is-busy/);
 assert.match(css,/color:#b42318/);
});

test("remaining field workflow blockers are wired through existing contracts",()=>{
 for(const token of["creationMediaCount","COUNT(*) FROM issue_media","issue-create-from-photo","fieldDraftChoice","bindActionPhotoQueue","renderActionSuccess","조치사진","completionMethod:\"PHOTO_VERIFIED\""])assert.ok((worker+ui).includes(token),token);
 assert.match(worker,/media_role='CREATION'.*status='ACTIVE'/);
 assert.match(ui,/floorLocationId/);
 assert.match(ui,/floorLabel/);
 assert.match(worker,/roomParentId/);
 assert.match(ui,/action\.elements\.photo/);
});

test("Issue create has one active renderer and no legacy createV2 path",()=>{
 assert.match(ui,/if\(path==="\/issues\/new"\|\|path==="\/pwa\/issues\/new"\)await createV3\(\)/);
 assert.doesNotMatch(ui,/async function createV2\(/);
});
