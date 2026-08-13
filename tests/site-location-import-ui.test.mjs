import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ACTION_STATES,
  beginLocationImportAction,
  canApplyLocationImport,
  completeAppliedState,
  confirmationMessage,
  ensureApplyIntent,
  finishLocationImportAction,
  hasLocationImportManageAccess,
  recoverApplyFailure,
  replaceLocationImportPreview,
  visiblePreviewItems
} from "../apps/web/assets/site-location-import.js";

const read=file=>fs.readFileSync(file,"utf8");

test("admin route has one loader and uses the established revision without incrementing it",()=>{
  const app=read("apps/web/assets/app.js"),admin=read("apps/web/assets/integrated-admin.js"),html=read("apps/web/index.html");
  assert.match(app,/현장정보/);
  assert.match(app,/\/admin\/site-locations/);
  assert.doesNotMatch(app,/import\("\.\/site-location-import\.js/);
  assert.match(admin,/import\("\.\/site-location-import\.js\?v=0\.27\.1-r2"\)/);
  assert.match(admin,/renderSiteLocationImportPage/);
  assert.match(html,/\/assets\/site-location-import\.css\?v=0\.27\.1-r2"/);
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

test("mutation controls require ADMINISTRATION MANAGE from context",()=>{
  assert.equal(hasLocationImportManageAccess({boardAccess:{ADMINISTRATION:{accessLevel:"MANAGE"}}}),true);
  assert.equal(hasLocationImportManageAccess({boardAccess:{ADMINISTRATION:{accessLevel:"VIEW"}}}),false);
  assert.equal(hasLocationImportManageAccess({boardAccess:{}}),false);
});

test("confirmed apply intent keeps one idempotency key across ambiguous retries",()=>{
  const preview={importId:"import-1",previewHash:"preview-1",status:"READY",applyAllowed:true,counts:{error:0}};
  let state=replaceLocationImportPreview({phase:"VALIDATING",busy:null,applyIntent:null},preview);
  state=ensureApplyIntent(state,()=>"stable-key");
  assert.equal(state.applyIntent.key,"stable-key");
  state=recoverApplyFailure({...state,phase:"APPLYING",busy:"apply"},new TypeError("network failed"));
  assert.equal(state.phase,"READY");
  assert.equal(state.applyIntent.key,"stable-key");
  assert.equal(ensureApplyIntent(state,()=>"wrong-new-key").applyIntent.key,"stable-key");
});

test("retryable Apply failures retain the confirmed idempotency key",()=>{
  const base={phase:"APPLYING",busy:"apply",applyIntent:{key:"stable",fingerprint:"i:p"},preview:{importId:"i",previewHash:"p",status:"READY",applyAllowed:true,counts:{error:0}}};
  for(const [label,error] of [
    ["network",new TypeError("network failed")],
    ["408",Object.assign(new Error("timeout"),{status:408,code:"REQUEST_TIMEOUT"})],
    ["425",Object.assign(new Error("too early"),{status:425,code:"TOO_EARLY"})],
    ["429",Object.assign(new Error("rate limited"),{status:429,code:"RATE_LIMITED"})],
    ["500",Object.assign(new Error("server failed"),{status:500,code:"INTERNAL_ERROR"})]
  ]){
    const recovered=recoverApplyFailure(base,error);
    assert.equal(recovered.phase,"READY",label);
    assert.equal(recovered.applyIntent.key,"stable",label);
  }
});

test("definitive contract failures clear the confirmed idempotency key",()=>{
  const base={phase:"APPLYING",busy:"apply",applyIntent:{key:"stable",fingerprint:"i:p"},preview:{importId:"i",previewHash:"p",status:"READY",applyAllowed:true,counts:{error:0}}};
  for(const [status,code] of [[400,"LOCATION_IMPORT_REQUEST_INVALID"],[403,"BOARD_ACCESS_DENIED"]]){
    const recovered=recoverApplyFailure(base,Object.assign(new Error(code),{status,code}));
    assert.equal(recovered.phase,"READY");
    assert.equal(recovered.applyIntent,null,code);
  }
  const stale=recoverApplyFailure(base,Object.assign(new Error("stale"),{status:409,code:"LOCATION_IMPORT_PREVIEW_STALE"}));
  assert.equal(stale.applyIntent,null);
  assert.equal(stale.preview.applyAllowed,false);
});

test("stale apply rejects the preview and explicitly requires re-preview",()=>{
  const state={phase:"APPLYING",busy:"apply",applyIntent:{key:"old",previewHash:"p"},preview:{status:"READY",applyAllowed:true,counts:{error:0}}};
  const recovered=recoverApplyFailure(state,Object.assign(new Error("stale"),{status:409,code:"LOCATION_IMPORT_PREVIEW_STALE"}));
  assert.equal(recovered.phase,"READY");
  assert.equal(recovered.preview.applyAllowed,false);
  assert.equal(recovered.applyIntent,null);
  assert.match(recovered.error,/다시 업로드.*검증/);
});

test("committed Apply remains APPLIED when nonfatal refresh later fails",()=>{
  const committed=completeAppliedState({phase:"APPLYING",busy:"apply",applyIntent:{key:"k"},preview:{status:"READY"}},{status:"APPLIED",counts:{added:1}});
  assert.equal(committed.phase,"APPLIED");
  assert.equal(committed.applyIntent,null);
  assert.equal(committed.preview.status,"APPLIED");
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
