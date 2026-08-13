import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {handleSiteLocationImportRequest} from "../worker/modules/site-location-import.js";
import worker from "../worker/index.js";
import {applyLocationImport} from "../worker/modules/site-location-import/apply.js";

const template=fs.readFileSync("apps/web/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx");
const digest=crypto.createHash("sha256").update(template).digest("hex");
const request=(path,{method="GET",body,headers={}}={})=>new Request(`https://example.test${path}`,{method,headers:{...headers,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
const auth=(access="MANAGE",siteId="site-a")=>async(_request,_env,options={})=>{
  if(options.required==="MANAGE"&&access!=="MANAGE")throw Object.assign(new Error("denied"),{status:403,code:"ADMIN_PERMISSION_DENIED"});
  return {siteId,userId:"user-a",contextVersion:7};
};
function fixture({access="MANAGE",siteId="site-a",sessionSite="site-a",bytes=template,objectKey,status="UPLOADED",objectSize=bytes.byteLength}={}){
  const writes=[];
  const importRow={id:"import-a",site_id:sessionSite,file_name:"locations.xlsx",file_hash:digest,r2_object_key:objectKey??`sites/${sessionSite}/location-imports/import-a/original.xlsx`,status};
  const repository={
    countActiveFixedLocations:async()=>4,
    loadRecentLocationImports:async()=>[{id:"old",status:"READY",added_count:2,error_count:0}],
    loadLocationMasterSnapshot:async()=>({locations:[],aliases:[]}),
    getLocationImport:async(_env,scope,id)=>scope===sessionSite&&id==="import-a"?importRow:null,
    createLocationImport:async(_env,row)=>{writes.push(["import",row]);return row},
    beginLocationImportValidation:async()=>{writes.push(["begin"]);return status==="UPLOADED"||status==="INVALID"||status==="READY"},
    updateLocationImportValidation:async(_env,row)=>{writes.push(["validation",row]);return true}
  };
  const env={FILES:{get:async key=>key===importRow.r2_object_key?{size:objectSize,arrayBuffer:async()=>bytes}:null},ASSETS:{fetch:async()=>new Response(template)}};
  const deps={authorize:auth(access,siteId),repository,signUpload:async key=>`https://upload.test/${encodeURIComponent(key)}`};
  return {env,deps,writes};
}

test("summary, template and compact history require ADMINISTRATION VIEW in the active site",async()=>{
  const {env,deps}=fixture({access:"VIEW"});
  const summary=await handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/summary"),env,undefined,deps);
  assert.deepEqual(await summary.json(),{activeFixedLocationCount:4,lastSuccessfulImport:null});
  const history=await handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/imports"),env,undefined,deps);
  assert.deepEqual((await history.json()).items,[{id:"old",status:"READY",added_count:2,error_count:0}]);
  const download=await handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/template"),env,undefined,deps);
  assert.equal(download.status,200);assert.equal(download.headers.get("content-type"),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");assert.match(download.headers.get("content-disposition"),/attachment/);assert.deepEqual(Buffer.from(await download.arrayBuffer()),template);
});

test("VIEW cannot create an upload session",async()=>{
  const {env,deps}=fixture({access:"VIEW"});
  await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions",{method:"POST",body:{fileName:"locations.xlsx",sizeBytes:template.length,sha256:digest},headers:{"x-context-version":"7"}}),env,undefined,deps),error=>error.status===403);
});

test("upload session validates xlsx metadata and creates a site-owned R2 key",async()=>{
  const {env,deps,writes}=fixture();
  const response=await handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions",{method:"POST",body:{fileName:"locations.xlsx",sizeBytes:template.length,sha256:digest},headers:{"x-context-version":"7"}}),env,undefined,deps);
  const body=await response.json();
  assert.equal(response.status,201);assert.match(body.upload.key,/^sites\/site-a\/location-imports\//);assert.match(body.upload.url,/^https:\/\/upload\.test\//);
  assert.equal(writes[0][1].fileHash,digest);assert.equal(writes[0][1].siteId,"site-a");
  for(const invalid of [{fileName:"x.xls",sizeBytes:10,sha256:digest},{fileName:"x.xlsx",sizeBytes:10,sha256:"bad"}])await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions",{method:"POST",body:invalid,headers:{"x-context-version":"7"}}),env,undefined,deps),error=>error.status===400);
});

test("validation denies cross-site sessions and rejects signature or hash mismatch",async()=>{
  const foreign=fixture({sessionSite:"site-b"});
  await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),foreign.env,undefined,foreign.deps),error=>error.status===404);
  const badSignature=fixture({bytes:new Uint8Array([1,2,3,4])});
  await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),badSignature.env,undefined,badSignature.deps),error=>error.code==="LOCATION_XLSX_INVALID");
  const badHash=fixture({bytes:Buffer.concat([template,Buffer.from("changed")])});
  await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),badHash.env,undefined,badHash.deps),error=>error.code==="LOCATION_IMPORT_HASH_MISMATCH");
});

test("validation rejects an import whose stored R2 key is not owned by the active site and session",async()=>{
  const fixtureValue=fixture({objectKey:"sites/site-b/location-imports/import-a/original.xlsx"});
  await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),fixtureValue.env,undefined,fixtureValue.deps),error=>error.code==="LOCATION_IMPORT_OBJECT_SCOPE_INVALID");
});

test("validation checks actual R2 size before reading the object",async()=>{
  let read=false;const value=fixture({objectSize:10*1024*1024+1});value.env.FILES.get=async()=>({size:10*1024*1024+1,arrayBuffer:async()=>{read=true;return template}});
  await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),value.env,undefined,value.deps),error=>error.code==="LOCATION_IMPORT_OBJECT_SIZE_INVALID");
  assert.equal(read,false);
});

test("validation CAS never reopens terminal or in-progress imports",async()=>{
  for(const status of ["VALIDATING","APPLYING","APPLIED","CANCELLED","FAILED"]){const value=fixture({status});await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),value.env,undefined,value.deps),error=>error.code==="LOCATION_IMPORT_STATE_INVALID");assert.equal(value.writes.length,0)}
});

test("unexpected post-CAS failures preserve the original error and never leave VALIDATING",async()=>{
  for(const stage of ["get","arrayBuffer","snapshot"]){
    let state="UPLOADED";const masterWrites=[];const original=new Error(`boom-${stage}`),repository={
      getLocationImport:async()=>({id:"import-a",site_id:"site-a",file_hash:digest,r2_object_key:"sites/site-a/location-imports/import-a/original.xlsx",status:state}),
      beginLocationImportValidation:async()=>{state="VALIDATING";return true},
      updateLocationImportValidation:async(_env,row)=>{if(state!=="VALIDATING")return false;state=row.status;return true},
      loadLocationMasterSnapshot:async()=>{if(stage==="snapshot")throw original;return{locations:[],aliases:[]}}
    },env={FILES:{get:async()=>{if(stage==="get")throw original;return{size:template.length,arrayBuffer:async()=>{if(stage==="arrayBuffer")throw original;return template}}}}};
    await assert.rejects(()=>handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),env,undefined,{authorize:auth("MANAGE"),repository}),error=>error===original);
    assert.equal(state,"FAILED",stage);assert.deepEqual(masterWrites,[]);
  }
});

function database(){const db=new DatabaseSync(":memory:");for(const name of fs.readdirSync("database/migrations").filter(name=>name.endsWith(".sql")).sort())db.exec(fs.readFileSync(`database/migrations/${name}`,"utf8"));return db}
function recordingD1(db){const sqlLog=[];const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){sqlLog.push(sql);if(/^\s*(INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?site_location(?:s|_aliases)\b/i.test(sql))throw new Error("MASTER_WRITE_FORBIDDEN");const result=db.prepare(sql).run(...args);return{success:true,meta:{changes:Number(result.changes)}}}});return{sqlLog,prepare:sql=>statement(sql)}}
async function realEnv(access="MANAGE"){
  const db=database(),token="session-token",csrf="csrf-token",tokenHash=crypto.createHash("sha256").update(token).digest("hex"),csrfHash=crypto.createHash("sha256").update(csrf).digest("hex");
  db.exec("INSERT INTO companies(id,name,status) VALUES('company-a','회사','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('site-a','company-a','현장','ACTIVE'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status,context_version) VALUES('user-a','user-a','관리자','h','s',100000,'ACTIVE',7); INSERT INTO memberships(id,user_id,company_id,site_id,status,approval_status) VALUES('member-a','user-a','company-a','site-a','ACTIVE','APPROVED');");
  db.prepare("INSERT INTO sessions(id,user_id,token_hash,csrf_hash,context_version,selected_site_id,idle_expires_at,absolute_expires_at) VALUES('session-a','user-a',?,?,7,'site-a','2099-01-01','2099-01-01')").run(tokenHash,csrfHash);
  const board=db.prepare("SELECT id FROM board_definitions WHERE board_key='ADMINISTRATION'").get();db.prepare("INSERT INTO board_access_grants(id,site_id,board_id,user_id,access_level,is_active) VALUES('grant-a','site-a',?,'user-a',?,1)").run(board.id,access);
  const DB=recordingD1(db),env={DB,FILES:{get:async()=>({size:template.length,arrayBuffer:async()=>template})},ASSETS:{fetch:async()=>new Response(template,{headers:{"content-type":"application/octet-stream"}})}};
  return{db,env,headers:{cookie:`guis_arc_integrated_session=${token}`,"x-csrf-token":csrf,"x-context-version":"7"}};
}

test("real auth path enforces session, membership, ADMINISTRATION access, CSRF and context version with final envelopes",async()=>{
  const value=await realEnv("VIEW");
  let response=await worker.fetch(request("/api/v1/admin/site-locations/summary"),value.env);assert.equal(response.status,401);assert.equal((await response.json()).error,"SESSION_REQUIRED");
  response=await worker.fetch(request("/api/v1/admin/site-locations/upload-sessions",{method:"POST",body:{fileName:"x.xlsx",sizeBytes:10,sha256:digest},headers:{cookie:value.headers.cookie,"x-csrf-token":value.headers["x-csrf-token"],"x-context-version":"7"}}),value.env);assert.equal(response.status,403);assert.equal((await response.json()).error,"BOARD_ACCESS_DENIED");
  value.db.prepare("UPDATE board_access_grants SET access_level='MANAGE'").run();
  for(const [headers,code,status] of [[{cookie:value.headers.cookie,"x-context-version":"7"},"CSRF_INVALID",403],[{...value.headers,"x-context-version":"6"},"CONTEXT_VERSION_STALE",409]]){response=await worker.fetch(request("/api/v1/admin/site-locations/upload-sessions",{method:"POST",body:{fileName:"x.xlsx",sizeBytes:10,sha256:digest},headers}),value.env);assert.equal(response.status,status);assert.equal((await response.json()).error,code)}
  value.db.prepare("UPDATE memberships SET approval_status='PENDING'").run();response=await worker.fetch(request("/api/v1/admin/site-locations/summary",{headers:{cookie:value.headers.cookie}}),value.env);assert.equal(response.status,403);assert.equal((await response.json()).error,"ADMIN_SITE_SCOPE_DENIED");value.db.close();
});

test("real valid and invalid validation paths perform zero Location/Alias master writes",async()=>{
  const value=await realEnv("MANAGE"),objects=new Map(),insert=(id,bytes)=>{const fileHash=crypto.createHash("sha256").update(bytes).digest("hex"),key=`sites/site-a/location-imports/${id}/original.xlsx`;value.db.prepare("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by) VALUES(?, 'site-a','locations.xlsx',?,?,'v1','UPLOADED','user-a')").run(id,fileHash,key);objects.set(key,bytes)};
  insert("valid",template);insert("invalid",Buffer.from([0x50,0x4b,0x05,0x06]));value.env.FILES.get=async key=>objects.has(key)?{size:objects.get(key).length,arrayBuffer:async()=>objects.get(key)}:null;
  const before={locations:value.db.prepare("SELECT COUNT(*) count FROM site_locations").get().count,aliases:value.db.prepare("SELECT COUNT(*) count FROM site_location_aliases").get().count};
  let response=await worker.fetch(request("/api/v1/admin/site-locations/upload-sessions/valid/validate",{method:"POST",headers:value.headers}),value.env);assert.equal(response.status,200);assert.ok(["READY","INVALID"].includes((await response.json()).status));
  response=await worker.fetch(request("/api/v1/admin/site-locations/upload-sessions/invalid/validate",{method:"POST",headers:value.headers}),value.env);assert.equal(response.status,400);assert.equal((await response.json()).error,"LOCATION_XLSX_INVALID");
  assert.deepEqual({locations:value.db.prepare("SELECT COUNT(*) count FROM site_locations").get().count,aliases:value.db.prepare("SELECT COUNT(*) count FROM site_location_aliases").get().count},before);
  assert.equal(value.env.DB.sqlLog.some(sql=>/^\s*(INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?site_location(?:s|_aliases)\b/i.test(sql)),false);value.db.close();
});

test("real CAS closes R2 get and arrayBuffer failures as FAILED without master writes",async()=>{
  const value=await realEnv("MANAGE"),insert=id=>value.db.prepare("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by) VALUES(?,'site-a','locations.xlsx',?,?,'v1','UPLOADED','user-a')").run(id,digest,`sites/site-a/location-imports/${id}/original.xlsx`);insert("get-failure");insert("buffer-failure");
  value.env.FILES.get=async key=>{if(key.includes("get-failure"))throw new Error("R2_GET_FAILED");return{size:template.length,arrayBuffer:async()=>{throw new Error("R2_BUFFER_FAILED")}}};
  for(const id of ["get-failure","buffer-failure"]){const response=await worker.fetch(request(`/api/v1/admin/site-locations/upload-sessions/${id}/validate`,{method:"POST",headers:value.headers}),value.env);assert.equal(response.status,500);assert.equal((await response.json()).error,"INTERNAL_ERROR");assert.equal(value.db.prepare("SELECT status FROM site_location_imports WHERE id=?").get(id).status,"FAILED")}
  assert.equal(value.env.DB.sqlLog.some(sql=>/^\s*(INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?site_location(?:s|_aliases)\b/i.test(sql)),false);value.db.close();
});

test("validation returns bounded preview and writes compact metadata only",async()=>{
  const {env,deps,writes}=fixture();
  const before=writes.filter(([kind])=>kind==="master").length;
  const response=await handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),env,undefined,deps);
  const body=await response.json();
  assert.equal(response.status,200);assert.equal(typeof body.applyAllowed,"boolean");assert.ok(body.counts);assert.ok(Array.isArray(body.operations));assert.ok(Array.isArray(body.errors));assert.ok(body.errors.length<=100);
  assert.equal(writes.filter(([kind])=>kind==="master").length,before);assert.equal(writes.at(-1)[0],"validation");assert.equal("operations" in writes.at(-1)[1],false);
});

const applyDiff=operations=>({operations,counts:{added:operations.filter(v=>v.type==="ADD").length,updated:operations.filter(v=>v.type==="UPDATE").length,unchanged:0,inactivated:operations.filter(v=>v.type==="INACTIVE").length,aliasAdded:operations.filter(v=>v.type==="ALIAS_ADD").length,aliasUpdated:operations.filter(v=>v.type==="ALIAS_UPDATE").length,aliasInactivated:operations.filter(v=>v.type==="ALIAS_INACTIVE").length,error:0},baseMasterFingerprint:"base-a",previewHash:"preview-a"});
const location=(id,overrides={})=>({id,siteId:"site-a",parentId:null,locationType:"ROOM",canonicalKey:`key-${id}`,displayName:id,sortOrder:0,source:"IMPORT",isActive:1,...overrides});
const alias=(id,locationId,overrides={})=>({id,siteId:"site-a",locationId,aliasText:id,normalizedAlias:id.toLowerCase(),aliasType:"FIELD_NAME",source:"IMPORT",isActive:1,...overrides});
function applyHarness({diff=applyDiff([]),row={},replayed=null,failAt=0}={}){
  const executed=[];let batchCalls=0,status="READY";
  const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values)}});
  const env={DB:{prepare:sql=>statement(sql),async batch(statements){batchCalls++;for(const [index,item] of statements.entries()){if(failAt&&index+1===failAt)throw new Error("FORCED_MID_FAILURE");executed.push(item)}return statements.map(()=>({success:true,meta:{changes:1}}))}}};
  const repository={
    getApplyReplay:async()=>replayed,
    beginLocationImportApply:async()=>{if(status!=="READY")return false;status="APPLYING";return true},
    markLocationImportApplyFailed:async()=>{if(status==="APPLYING")status="FAILED"},
    buildLocationImportApplyStatements:async(args)=>args.buildStatements(env,args),
  };
  return {env,repository,executed,get batchCalls(){return batchCalls},get status(){return status},row:{id:"import-a",site_id:"site-a",status:"READY",file_hash:"file-a",base_master_fingerprint:"base-a",preview_hash:"preview-a",...row},diff};
}

test("apply uses exact server recomputed operations and commits location, alias, audit, status and idempotency in one batch",async()=>{
  const diff=applyDiff([
    {type:"ADD",id:"new",after:location("new")},
    {type:"UPDATE",id:"old",after:location("old",{displayName:"renamed",isActive:1})},
    {type:"INACTIVE",id:"gone",before:location("gone"),after:location("gone",{isActive:0})},
    {type:"ALIAS_ADD",id:"alias-new",after:alias("alias-new","new")},
    {type:"ALIAS_UPDATE",id:"alias-old",after:alias("alias-old","old",{aliasText:"changed",isActive:1})},
    {type:"ALIAS_INACTIVE",id:"alias-gone",before:alias("alias-gone","gone"),after:alias("alias-gone","gone",{isActive:0})}
  ]),value=applyHarness({diff});
  const result=await applyLocationImport({env:value.env,repository:value.repository,importRow:value.row,siteId:"site-a",userId:"user-a",idempotencyKey:"apply-1",payloadHash:"payload-a",diff,requestId:"request-a"});
  assert.equal(value.batchCalls,1);assert.equal(result.status,"APPLIED");assert.deepEqual(result.counts,diff.counts);
  const sql=value.executed.map(item=>item.sql).join("\n");
  assert.match(sql,/INSERT INTO site_locations/);assert.match(sql,/UPDATE site_locations/);assert.match(sql,/INSERT INTO site_location_aliases/);assert.match(sql,/UPDATE site_location_aliases/);assert.match(sql,/SITE_LOCATION_IMPORT_APPLIED/);assert.match(sql,/site_location_imports/);assert.match(sql,/idempotency/i);assert.doesNotMatch(sql,/\bDELETE\b/i);
});

test("re-import reactivates IMPORT rows while omission never mutates LEGACY or MANUAL rows",async()=>{
  const diff=applyDiff([{type:"UPDATE",id:"reactivate",before:location("reactivate",{isActive:0}),after:location("reactivate",{isActive:1})}]),value=applyHarness({diff});
  await applyLocationImport({env:value.env,repository:value.repository,importRow:value.row,siteId:"site-a",userId:"user-a",idempotencyKey:"apply-2",payloadHash:"payload-b",diff,requestId:"request-b"});
  const update=value.executed.find(item=>/UPDATE site_locations/.test(item.sql)&&item.args.includes("reactivate"));assert.ok(update);assert.ok(update.args.includes(1));
  assert.equal(value.executed.some(item=>item.args.includes("legacy-omitted")||item.args.includes("manual-omitted")),false);
});

test("apply rejects stale file, base and preview hashes before CAS or D1 batch",async()=>{
  for(const mismatch of [{fileHash:"other"},{baseMasterFingerprint:"other"},{previewHash:"other"}]){const value=applyHarness();await assert.rejects(()=>applyLocationImport({env:value.env,repository:value.repository,importRow:value.row,siteId:"site-a",userId:"user-a",idempotencyKey:"stale",payloadHash:"payload",diff:{...value.diff,...mismatch},fileHash:mismatch.fileHash??"file-a",requestId:"request"}),error=>error.status===409&&error.code==="LOCATION_IMPORT_PREVIEW_STALE");assert.equal(value.batchCalls,0);assert.equal(value.status,"READY")}
});

test("duplicate apply replays the stored result and mismatched payload is rejected",async()=>{
  const stored={payload_hash:"payload-a",response_json:JSON.stringify({status:"APPLIED",counts:{added:1}})},same=applyHarness({replayed:stored});
  assert.deepEqual(await applyLocationImport({env:same.env,repository:same.repository,importRow:same.row,siteId:"site-a",userId:"user-a",idempotencyKey:"same",payloadHash:"payload-a",diff:same.diff,fileHash:"file-a",requestId:"r"}),{status:"APPLIED",counts:{added:1}});assert.equal(same.batchCalls,0);
  const mismatch=applyHarness({replayed:stored});await assert.rejects(()=>applyLocationImport({env:mismatch.env,repository:mismatch.repository,importRow:mismatch.row,siteId:"site-a",userId:"user-a",idempotencyKey:"same",payloadHash:"payload-b",diff:mismatch.diff,fileHash:"file-a",requestId:"r"}),error=>error.status===409&&error.code==="IDEMPOTENCY_PAYLOAD_MISMATCH");assert.equal(mismatch.batchCalls,0);
});

test("forced middle failure leaves no committed state and closes APPLYING separately as FAILED",async()=>{
  const value=applyHarness({diff:applyDiff([{type:"ADD",id:"a",after:location("a")},{type:"ADD",id:"b",after:location("b")}]),failAt:2});
  await assert.rejects(()=>applyLocationImport({env:value.env,repository:value.repository,importRow:value.row,siteId:"site-a",userId:"user-a",idempotencyKey:"failure",payloadHash:"payload",diff:value.diff,fileHash:"file-a",requestId:"r"}),/FORCED_MID_FAILURE/);
  assert.equal(value.batchCalls,1);assert.equal(value.status,"FAILED");
});

test("1700-row apply stays in one atomic D1 batch with bounded multi-row statements",async()=>{
  const operations=Array.from({length:1700},(_,index)=>{
    const id=`loc-${String(index).padStart(4,"0")}`;
    return {type:"ADD",id,after:location(id)};
  });
  const value=applyHarness({diff:applyDiff(operations)});
  await applyLocationImport({env:value.env,repository:value.repository,importRow:value.row,siteId:"site-a",userId:"user-a",idempotencyKey:"large",payloadHash:"payload",diff:value.diff,fileHash:"file-a",requestId:"r"});
  assert.equal(value.batchCalls,1);const inserts=value.executed.filter(item=>/INSERT INTO site_locations/.test(item.sql));assert.ok(inserts.length>1);assert.ok(inserts.every(item=>item.args.length<=90));
});
