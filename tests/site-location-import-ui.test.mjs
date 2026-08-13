import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ACTION_STATES,
  beginLocationImportAction,
  canApplyLocationImport,
  confirmationMessage,
  finishLocationImportAction,
  visiblePreviewItems
} from "../apps/web/assets/site-location-import.js";

const read=file=>fs.readFileSync(file,"utf8");

test("admin route is reachable from the site information navigation and loads without a revision bump",()=>{
  const app=read("apps/web/assets/app.js"),admin=read("apps/web/assets/integrated-admin.js"),html=read("apps/web/index.html");
  assert.match(app,/현장정보/);
  assert.match(app,/\/admin\/site-locations/);
  assert.match(app,/import\("\.\/site-location-import\.js"\)/);
  assert.match(admin,/renderSiteLocationImportPage/);
  assert.match(html,/\/assets\/site-location-import\.css"/);
  assert.doesNotMatch(html,/site-location-import\.css\?v=/);
});

test("state machine allows only exact transitions and blocks duplicate requests",()=>{
  let state={phase:ACTION_STATES.IDLE,busy:null};
  state=beginLocationImportAction(state,"upload");
  assert.deepEqual(state,{phase:ACTION_STATES.UPLOADING,busy:"upload"});
  assert.throws(()=>beginLocationImportAction(state,"upload"),/ACTION_IN_PROGRESS/);
  state=finishLocationImportAction(state,"upload",ACTION_STATES.VALIDATING);
  assert.equal(state.phase,ACTION_STATES.VALIDATING);
  state=beginLocationImportAction(state,"validate");
  assert.throws(()=>finishLocationImportAction(state,"validate",ACTION_STATES.APPLIED),/STATE_TRANSITION_INVALID/);
  state=finishLocationImportAction(state,"validate",ACTION_STATES.READY);
  state=beginLocationImportAction(state,"apply");
  assert.equal(state.phase,ACTION_STATES.APPLYING);
  state=finishLocationImportAction(state,"apply",ACTION_STATES.APPLIED);
  assert.equal(state.phase,ACTION_STATES.APPLIED);
});

test("Apply requires a server-ready zero-error preview and remains disabled for Error",()=>{
  const ready={status:"READY",applyAllowed:true,counts:{error:0}};
  assert.equal(canApplyLocationImport({phase:ACTION_STATES.READY,busy:null,preview:ready}),true);
  assert.equal(canApplyLocationImport({phase:ACTION_STATES.READY,busy:null,preview:{...ready,counts:{error:1}}}),false);
  assert.equal(canApplyLocationImport({phase:ACTION_STATES.READY,busy:"apply",preview:ready}),false);
  assert.equal(canApplyLocationImport({phase:ACTION_STATES.INVALID,busy:null,preview:ready}),false);
});

test("preview exposes changed rows and errors but keeps UNCHANGED count-only",()=>{
  const preview={operations:[{type:"ADD",id:"a"},{type:"UPDATE",id:"b"},{type:"UNCHANGED",id:"c"},{type:"INACTIVE",id:"d"},{type:"ALIAS_ADD",id:"e"}],errors:[{type:"ERROR",code:"BAD_ROW"}]};
  assert.deepEqual(visiblePreviewItems(preview).map(item=>item.type),["ADD","UPDATE","INACTIVE","ALIAS_ADD","ERROR"]);
});

test("confirmation repeats location and alias change counts",()=>{
  const message=confirmationMessage({added:3,updated:2,inactivated:1,aliasAdded:4,aliasUpdated:5,aliasInactivated:6});
  for(const text of ["추가 3건","변경 2건","비활성 예정 1건","별칭 추가 4건","별칭 변경 5건","별칭 비활성 예정 6건"])assert.match(message,new RegExp(text));
});

test("screen contract provides visible action feedback, accessible errors and mobile-safe controls",()=>{
  const ui=read("apps/web/assets/site-location-import.js"),css=read("apps/web/assets/site-location-import.css");
  for(const text of ["현재 등록 위치 수","마지막 Import","기본서식 다운로드","Excel 가져오기","검증 결과","변경 Preview","적용","최근 Import 결과","비활성 예정"])assert.match(ui,new RegExp(text));
  assert.match(ui,/role="status"/);
  assert.match(ui,/role="alert"/);
  assert.match(ui,/aria-busy/);
  assert.match(ui,/disabled/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/overflow-x:auto/);
  assert.match(css,/@media\(max-width:760px\)/);
});
