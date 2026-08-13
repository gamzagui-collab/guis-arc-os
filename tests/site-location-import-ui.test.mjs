import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  ACTION_STATES,
  beginLocationImportAction,
  canApplyLocationImport,
  confirmationMessage,
  ensureApplyIntent,
  finishLocationImportAction,
  hasLocationImportManageAccess,
  replaceLocationImportPreview,
  visiblePreviewItems
} from "../apps/web/assets/site-location-import.js";

const read=file=>fs.readFileSync(file,"utf8");

test("admin route keeps its existing shell and loads the location import module",()=>{
  const app=read("apps/web/assets/app.js"),admin=read("apps/web/assets/integrated-admin.js"),html=read("apps/web/index.html");
  assert.match(app,/\/admin\/site-locations/);
  assert.match(admin,/site-location-import\.js\?v=0\.27\.1-r19/);
  assert.match(html,/site-location-import\.css\?v=0\.27\.1-r19/);
});

test("state machine blocks duplicate requests and Apply needs a clean READY preview",()=>{
  let state={phase:ACTION_STATES.IDLE,busy:null};
  state=beginLocationImportAction(state,"upload");
  assert.throws(()=>beginLocationImportAction(state,"upload"),/ACTION_IN_PROGRESS/);
  state=finishLocationImportAction(state,"upload",ACTION_STATES.VALIDATING);
  state=beginLocationImportAction(state,"validate");
  state=finishLocationImportAction(state,"validate",ACTION_STATES.READY);
  state=replaceLocationImportPreview(state,{status:"READY",applyAllowed:true,counts:{error:0}});
  assert.equal(canApplyLocationImport(state),true);
  assert.equal(canApplyLocationImport({...state,busy:"apply"}),false);
  assert.equal(hasLocationImportManageAccess({boardAccess:{ADMINISTRATION:{accessLevel:"MANAGE"}}}),true);
});

test("preview hides aliases, exposes rename candidates, and binds decisions into the Apply intent",()=>{
  const preview={importId:"import-1",previewHash:"preview-1",status:"READY",applyAllowed:true,counts:{error:0},operations:[{type:"ADD",id:"add"},{type:"UNCHANGED",id:"same"},{type:"ALIAS_ADD",id:"forbidden"},{type:"RENAME_CANDIDATE",id:"rename"}],errors:[{code:"BAD"}]};
  assert.deepEqual(visiblePreviewItems(preview).map(item=>item.type),["ADD","RENAME_CANDIDATE","ERROR"]);
  const state=ensureApplyIntent({...replaceLocationImportPreview({phase:"IDLE",busy:null},preview),renameDecisions:[{fromId:"old",toId:"new",decision:"SAME_LOCATION"}]},()=>"key");
  assert.match(state.applyIntent.fingerprint,/SAME_LOCATION/);
  const message=confirmationMessage({added:3,updated:2,inactivated:1,aliasAdded:9});
  assert.match(message,/위치 추가 3건/);
  assert.doesNotMatch(message,/별칭/);
});

test("Apply stays blocked until every rename candidate has an explicit valid decision",()=>{
  const preview={status:"READY",applyAllowed:true,counts:{error:0,renameCandidates:2},operations:[
    {type:"RENAME_CANDIDATE",from:{id:"old-a"},to:{id:"new-a"}},
    {type:"RENAME_CANDIDATE",from:{id:"old-b"},to:{id:"new-b"}}
  ]};
  const state=replaceLocationImportPreview({phase:"IDLE",busy:null},preview);
  assert.equal(canApplyLocationImport(state),false);
  assert.equal(canApplyLocationImport({...state,renameDecisions:[{fromId:"old-a",toId:"new-a",decision:"NEW_LOCATION"}]}),false);
  assert.equal(canApplyLocationImport({...state,renameDecisions:[
    {fromId:"old-a",toId:"new-a",decision:"NEW_LOCATION"},
    {fromId:"old-b",toId:"new-b",decision:"SAME_LOCATION"}
  ]}),true);
});

test("v2 UI explains four human columns and contains no alias mutation action",()=>{
  const ui=read("apps/web/assets/site-location-import.js"),css=read("apps/web/assets/site-location-import.css");
  for(const text of ["동/구역, 층, 호/공간, 세부위치","이름 변경 후보","기본서식 다운로드","role=\"status\"","aria-busy"])assert.match(ui,new RegExp(text));
  assert.doesNotMatch(ui,/ALIAS_ADD|ALIAS_UPDATE|ALIAS_INACTIVE|별칭 추가/);
  assert.match(css,/rename-choice/);
  assert.match(css,/min-height:44px/);
});
