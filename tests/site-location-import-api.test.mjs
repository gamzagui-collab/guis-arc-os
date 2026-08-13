import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {handleSiteLocationImportRequest} from "../worker/modules/site-location-import.js";
import worker from "../worker/index.js";
import {applyLocationImport,buildLocationImportApplyStatements} from "../worker/modules/site-location-import/apply.js";
import * as locationRepository from "../worker/modules/site-location-import/repository.js";
import {fingerprintLocationMaster} from "../worker/modules/site-location-import/diff.js";
import {strToU8,unzipSync,zipSync} from "fflate";
import {ALIAS_HEADERS,LOCATION_HEADERS,LOCATION_IMPORT_LIMITS,REQUIRED_SHEETS} from "../worker/modules/site-location-import/contracts.js";

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
function recordingD1(db){const sqlLog=[];const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){sqlLog.push(sql);if(/^\s*(INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?site_location(?:s|_aliases)\b/i.test(sql))throw new Error("MASTER_WRITE_FORBIDDEN");const result=db.prepare(sql).run(...args);return{success:true,meta:{changes:Number(result.changes)}}}});return{sqlLog,prepare:sql=>statement(sql),async batch(statements){return statements.map(item=>({results:db.prepare(item.sql).all(...item.args)}))}}}
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
    markLocationImportApplyFailed:async()=>{status="FAILED"},
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

function transactionalD1(db,{failAt=0}={}){
  let batchCalls=0;
  const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return{success:true,meta:{changes:Number(result.changes)}}}});
  return {prepare:sql=>statement(sql),async batch(statements){batchCalls++;db.exec("BEGIN");try{const output=[];for(const [index,item] of statements.entries()){if(failAt&&index+1===failAt)throw new Error("FORCED_MIDDLE_SQL_FAILURE");const prepared=db.prepare(item.sql);output.push(/^\s*(SELECT|PRAGMA)\b/i.test(item.sql)?{results:prepared.all(...item.args)}:prepared.run(...item.args))}db.exec("COMMIT");return output}catch(error){db.exec("ROLLBACK");throw error}},get batchCalls(){return batchCalls}};
}

test("location master snapshot reads locations aliases and revision in one D1 batch",async()=>{
  let batches=0,individualReads=0;const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values)},async all(){individualReads++;throw new Error("INDEPENDENT_READ")},async first(){individualReads++;throw new Error("INDEPENDENT_READ")}}),env={DB:{prepare:sql=>statement(sql),async batch(statements){batches++;assert.equal(statements.length,3);return[{results:[{id:"l",site_id:"site-a"}]},{results:[{id:"a",site_id:"site-a"}]},{results:[{revision:7}]}]}}};
  const snapshot=await locationRepository.loadLocationMasterSnapshot(env,"site-a");assert.equal(batches,1);assert.equal(individualReads,0);assert.equal(snapshot.locations[0].id,"l");assert.equal(snapshot.aliases[0].id,"a");assert.equal(snapshot.revision,7);
});

const xmlEscape=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const xlsxColumn=index=>{let value="";for(let n=index+1;n;n=Math.floor((n-1)/26))value=String.fromCharCode(65+(n-1)%26)+value;return value};
const xlsxSheet=rows=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>`<c r="${xlsxColumn(columnIndex)}${rowIndex+1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
function routeWorkbook(locations,aliases=[]){const sheets=[[REQUIRED_SHEETS[0],[["review"]]],[REQUIRED_SHEETS[1],[LOCATION_HEADERS,...locations]],[REQUIRED_SHEETS[2],[ALIAS_HEADERS,...aliases]],[REQUIRED_SHEETS[3],[["review"]]],[REQUIRED_SHEETS[4],[["review"]]],[REQUIRED_SHEETS[5],[["review"]]]],workbookXml=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name],index)=>`<sheet name="${name}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join("")}</sheets></workbook>`,rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join("")}</Relationships>`;return zipSync({"xl/workbook.xml":strToU8(workbookXml),"xl/_rels/workbook.xml.rels":strToU8(rels),...Object.fromEntries(sheets.map(([,rows],index)=>[`xl/worksheets/sheet${index+1}.xml`,strToU8(xlsxSheet(rows))]))})}

function seedAtomicApply(){
  const db=database();
  db.exec("INSERT INTO companies(id,name,status) VALUES('apply-company','Company','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('apply-site','apply-company','Site','ACTIVE'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status,context_version) VALUES('apply-user','apply-user','User','h','s',100000,'ACTIVE',1);");
  db.exec("INSERT INTO site_locations(id,site_id,parent_id,location_type,code,name,display_name,canonical_key,source,is_active) VALUES('old','apply-site',NULL,'BUILDING','old','Old','Old','key/old','IMPORT',1),('legacy','apply-site',NULL,'BUILDING','legacy','Legacy','Legacy',NULL,'LEGACY',1)");
  const revision=db.prepare("SELECT revision FROM site_location_master_revisions WHERE site_id='apply-site'").get().revision;
  db.prepare("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,base_master_fingerprint,preview_hash,base_master_revision,created_by) VALUES('atomic-import','apply-site','x.xlsx','file','v1','READY','base','preview',?,'apply-user')").run(revision);
  return {db,revision};
}

test("real SQLite atomic apply orders parents first, supplies code/name, stores exact fingerprint and replays exact response",async()=>{
  const {db,revision}=seedAtomicApply(),DB=transactionalD1(db),env={DB};
  const child=location("child",{siteId:"apply-site",parentId:"parent",locationType:"ROOM",canonicalKey:"key/child"}),parent=location("parent",{siteId:"apply-site",locationType:"BUILDING",canonicalKey:"key/parent"});
  const diff={...applyDiff([{type:"ADD",id:"child",after:child},{type:"ADD",id:"parent",after:parent},{type:"INACTIVE",id:"old",after:location("old",{siteId:"apply-site",locationType:"BUILDING",canonicalKey:"key/old",isActive:0})}]),baseMasterFingerprint:"base",previewHash:"preview"};
  const expectedSnapshot={locations:[location("legacy",{siteId:"apply-site",locationType:"BUILDING",canonicalKey:null,source:"LEGACY"}),location("old",{siteId:"apply-site",locationType:"BUILDING",canonicalKey:"key/old",isActive:0}),parent,child],aliases:[]};
  const expectedFingerprint=fingerprintLocationMaster("apply-site",expectedSnapshot);
  const result=await applyLocationImport({env,repository:locationRepository,importRow:{id:"atomic-import",file_hash:"file",base_master_fingerprint:"base",preview_hash:"preview",base_master_revision:revision},siteId:"apply-site",userId:"apply-user",idempotencyKey:"atomic-key",payloadHash:"payload",diff,fileHash:"file",requestId:"request",postApplySnapshot:expectedSnapshot});
  assert.equal(DB.batchCalls,1);assert.equal(result.newMasterFingerprint,expectedFingerprint);
  const rows=db.prepare("SELECT id,parent_id,code,name,is_active FROM site_locations WHERE site_id='apply-site' ORDER BY id").all();
  assert.equal(rows.find(row=>row.id==="parent").code,"parent");assert.equal(rows.find(row=>row.id==="parent").name,"parent");assert.equal(rows.findIndex(row=>row.id==="parent")>=0,true);assert.equal(rows.find(row=>row.id==="child").parent_id,"parent");
  const stored=db.prepare("SELECT status,post_master_fingerprint FROM site_location_imports WHERE id='atomic-import'").get();assert.deepEqual({...stored},{status:"APPLIED",post_master_fingerprint:expectedFingerprint});
  const replay=await applyLocationImport({env,repository:locationRepository,importRow:{id:"atomic-import",file_hash:"file",base_master_fingerprint:"base",preview_hash:"preview",base_master_revision:revision},siteId:"apply-site",userId:"apply-user",idempotencyKey:"atomic-key",payloadHash:"payload",diff,fileHash:"file",requestId:"request",postApplySnapshot:expectedSnapshot});
  assert.deepEqual(replay,result);assert.equal(DB.batchCalls,1);db.close();
});

test("real SQLite guard and injected middle SQL failure roll back status and every master write",async()=>{
  for(const mode of ["stale-guard","middle-failure"]){const {db,revision}=seedAtomicApply();if(mode==="stale-guard")db.exec("UPDATE site_locations SET display_name='concurrent' WHERE id='old'");const DB=transactionalD1(db,{failAt:mode==="middle-failure"?4:0}),env={DB},before=db.prepare("SELECT id,display_name,is_active FROM site_locations WHERE site_id='apply-site' ORDER BY id").all(),diff={...applyDiff([{type:"ADD",id:"new",after:location("new",{siteId:"apply-site",locationType:"BUILDING"})}]),baseMasterFingerprint:"base",previewHash:"preview"};
    await assert.rejects(()=>applyLocationImport({env,repository:locationRepository,importRow:{id:"atomic-import",file_hash:"file",base_master_fingerprint:"base",preview_hash:"preview",base_master_revision:revision},siteId:"apply-site",userId:"apply-user",idempotencyKey:`key-${mode}`,payloadHash:"payload",diff,fileHash:"file",requestId:"request",postApplySnapshot:{locations:[],aliases:[]}}));
    assert.deepEqual(db.prepare("SELECT id,display_name,is_active FROM site_locations WHERE site_id='apply-site' ORDER BY id").all(),before);assert.notEqual(db.prepare("SELECT status FROM site_location_imports WHERE id='atomic-import'").get().status,"APPLYING");db.close()}
});

test("future empty site can atomically apply its first location at master revision zero",async()=>{
  const db=database();db.exec("INSERT INTO companies(id,name,status) VALUES('future-company','Company','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('future-site','future-company','Future','ACTIVE'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status,context_version) VALUES('future-user','future-user','User','h','s',100000,'ACTIVE',1);");
  assert.equal(db.prepare("SELECT revision FROM site_location_master_revisions WHERE site_id='future-site'").get().revision,0);
  db.exec("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,base_master_fingerprint,preview_hash,base_master_revision,created_by) VALUES('future-import','future-site','x.xlsx','file','v1','READY','base','preview',0,'future-user')");
  const env={DB:transactionalD1(db)},root=location("future-root",{siteId:"future-site",locationType:"BUILDING"}),diff={...applyDiff([{type:"ADD",id:root.id,after:root}]),baseMasterFingerprint:"base",previewHash:"preview"};
  const result=await applyLocationImport({env,repository:locationRepository,importRow:{id:"future-import",file_hash:"file",base_master_fingerprint:"base",preview_hash:"preview",base_master_revision:0},siteId:"future-site",userId:"future-user",idempotencyKey:"future-key",payloadHash:"payload",diff,fileHash:"file",requestId:"request",currentSnapshot:{locations:[],aliases:[],revision:0}});
  assert.equal(result.status,"APPLIED");assert.equal(db.prepare("SELECT code FROM site_locations WHERE id='future-root'").get().code,"future-root");db.close();
});

test("DB revision guard failure maps to stable stale-preview 409 and remains retry-ready",async()=>{
  const {db,revision}=seedAtomicApply();db.exec("UPDATE site_locations SET display_name='concurrent' WHERE id='old'");const env={DB:transactionalD1(db)},diff={...applyDiff([{type:"ADD",id:"new",after:location("new",{siteId:"apply-site",locationType:"BUILDING"})}]),baseMasterFingerprint:"base",previewHash:"preview"};
  await assert.rejects(()=>applyLocationImport({env,repository:locationRepository,importRow:{id:"atomic-import",file_hash:"file",base_master_fingerprint:"base",preview_hash:"preview",base_master_revision:revision},siteId:"apply-site",userId:"apply-user",idempotencyKey:"stale-guard-key",payloadHash:"payload",diff,fileHash:"file",requestId:"request",currentSnapshot:{locations:[],aliases:[],revision}}),error=>error.status===409&&error.code==="LOCATION_IMPORT_PREVIEW_STALE");
  assert.equal(db.prepare("SELECT status FROM site_location_imports WHERE id='atomic-import'").get().status,"READY");assert.equal(db.prepare("SELECT COUNT(*) count FROM site_locations WHERE id='new'").get().count,0);db.close();
});

test("status CAS guard is load-bearing and every prepared statement remains below D1 parameter cap",()=>{
  const value=applyHarness({diff:applyDiff(Array.from({length:1700},(_,index)=>({type:"ADD",id:`x-${index}`,after:location(`x-${index}`)})))}),response={newMasterFingerprint:"post"};
  const statements=buildLocationImportApplyStatements(value.env,{importRow:{id:"import-a",base_master_revision:0},siteId:"site-a",userId:"user-a",idempotencyKey:"key",payloadHash:"payload",diff:value.diff,requestId:"request",response});
  assert.match(statements[0].sql,/status='READY'/);assert.match(statements[1].sql,/site_location_import_apply_guards/);assert.ok(statements.every(item=>item.args.length<=90));
});

test("production route fingerprint equals the committed canonical DB snapshot",async()=>{
  const value=await realEnv("MANAGE"),bytes=routeWorkbook([["route-root","","BUILDING","site/route-root","Route Root",0],["route-room","route-root","ROOM","site/route-root/room","Route Room",1]],[ ["route-alias","route-room","Route field","FIELD_NAME"] ]),fileHash=crypto.createHash("sha256").update(bytes).digest("hex"),key="sites/site-a/location-imports/route-import/original.xlsx";
  value.db.prepare("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by) VALUES('route-import','site-a','route.xlsx',?,?,'v1','UPLOADED','user-a')").run(fileHash,key);value.env.DB=transactionalD1(value.db);value.env.FILES.get=async objectKey=>objectKey===key?{size:bytes.length,arrayBuffer:async()=>bytes}:null;
  let response=await worker.fetch(request("/api/v1/admin/site-locations/upload-sessions/route-import/validate",{method:"POST",headers:value.headers}),value.env),preview=await response.json();assert.equal(response.status,200);assert.equal(preview.status,"READY");
  response=await worker.fetch(request("/api/v1/admin/site-locations/imports/route-import/apply",{method:"POST",body:{previewHash:preview.previewHash,baseMasterFingerprint:preview.baseMasterFingerprint,operations:[{type:"ADD",id:"forged"}]},headers:{...value.headers,"idempotency-key":"route-key"}}),value.env);const applied=await response.json();assert.equal(response.status,200,JSON.stringify(applied));
  const committed=await locationRepository.loadLocationMasterSnapshot(value.env,"site-a"),actual=fingerprintLocationMaster("site-a",committed),stored=value.db.prepare("SELECT post_master_fingerprint FROM site_location_imports WHERE id='route-import'").get().post_master_fingerprint;
  assert.equal(applied.newMasterFingerprint,actual);assert.equal(stored,actual);assert.equal(value.db.prepare("SELECT COUNT(*) count FROM site_locations WHERE id='forged'").get().count,0);value.db.close();
});

test("same user and idempotency key are scoped independently by import",async()=>{
  const db=database();db.exec("INSERT INTO companies(id,name,status) VALUES('idem-company','Company','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('idem-site','idem-company','Site','ACTIVE'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status,context_version) VALUES('idem-user','idem-user','User','h','s',100000,'ACTIVE',1); INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,created_by) VALUES('idem-one','idem-site','x','h','v1','APPLIED','idem-user'),('idem-two','idem-site','x','h','v1','APPLIED','idem-user'); INSERT INTO site_location_import_idempotency(site_id,import_id,user_id,idempotency_key,payload_hash,response_json,expires_at) VALUES('idem-site','idem-one','idem-user','same','one','{\"importId\":\"idem-one\"}','2099-01-01'),('idem-site','idem-two','idem-user','same','two','{\"importId\":\"idem-two\"}','2099-01-01')");const env={DB:transactionalD1(db)};
  assert.equal((await locationRepository.getApplyReplay(env,{siteId:"idem-site",importId:"idem-one",userId:"idem-user",idempotencyKey:"same"})).response.importId,"idem-one");assert.equal((await locationRepository.getApplyReplay(env,{siteId:"idem-site",importId:"idem-two",userId:"idem-user",idempotencyKey:"same"})).response.importId,"idem-two");db.close();
});

const repackTemplate=mutate=>{const entries=unzipSync(template),copy=Object.fromEntries(Object.entries(entries).map(([name,bytes])=>[name,new Uint8Array(bytes)]));mutate(copy);return zipSync(copy)};
const locationSheetEntry=entries=>Object.keys(entries).find(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)&&Buffer.from(entries[name]).toString("utf8").includes("location_id"));
const apiXmlEscape=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const apiColumn=index=>{let value="";for(let n=index+1;n;n=Math.floor((n-1)/26))value=String.fromCharCode(65+(n-1)%26)+value;return value};
const apiWorksheet=rows=>`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>`<c r="${apiColumn(columnIndex)}${rowIndex+1}" t="inlineStr"><is><t>${apiXmlEscape(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
function apiWorkbook({locations=[],aliases=[],extraEntries={}}={}){const rows=[[["guide"]],[LOCATION_HEADERS,...locations],[ALIAS_HEADERS,...aliases],[["review"]],[["drawings"]],[["rules"]]],workbookXml=`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${REQUIRED_SHEETS.map((name,index)=>`<sheet name="${name}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join("")}</sheets></workbook>`,rels=`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${REQUIRED_SHEETS.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join("")}</Relationships>`;return zipSync({"xl/workbook.xml":strToU8(workbookXml),"xl/_rels/workbook.xml.rels":strToU8(rels),...Object.fromEntries(rows.map((value,index)=>[`xl/worksheets/sheet${index+1}.xml`,strToU8(apiWorksheet(value))])),...extraEntries})}
const corruptDeclaredExpansion=(bytes,size)=>{const copy=new Uint8Array(bytes),view=new DataView(copy.buffer,copy.byteOffset,copy.byteLength);for(let offset=0;offset<=copy.length-46;offset++)if(view.getUint32(offset,true)===0x02014b50){view.setUint32(offset+24,size,true);copy[offset+46]^=0xff;break}return copy};

test("malformed and adversarial XLSX payloads return stable 4xx errors with zero master writes",async()=>{
  const valid=apiWorkbook({locations:[["loc-1","","BUILDING","site/root","Root",0]]}),formula=repackTemplate(entries=>{const name=locationSheetEntry(entries),xml=Buffer.from(entries[name]).toString("utf8");entries[name]=strToU8(xml.replace("</c>","<f>1+1</f></c>"))}),external=apiWorkbook({extraEntries:{"xl/externalLinks/externalLink1.xml":strToU8("<externalLink/>")}}),shared=apiWorkbook({extraEntries:{"xl/sharedStrings.xml":strToU8(`<sst>${"<si><t>x</t></si>".repeat(LOCATION_IMPORT_LIMITS.sharedStrings+1)}</sst>`)}}),expanded=apiWorkbook({extraEntries:{"xl/unused.xml":strToU8("x".repeat(LOCATION_IMPORT_LIMITS.expandedXmlBytes+1))}}),control=repackTemplate(entries=>{const name=locationSheetEntry(entries),xml=Buffer.from(entries[name]).toString("utf8");entries[name]=strToU8(xml.replace("location_id","location_\u0001id"))}),overlong=apiWorkbook({locations:[["loc-long","","BUILDING","site/long","x".repeat(LOCATION_IMPORT_LIMITS.cellChars+1),0]]}),corrupt=valid.slice(0,-12),central=corruptDeclaredExpansion(valid,LOCATION_IMPORT_LIMITS.expandedXmlBytes+1);
  for(const [id,bytes,expected] of [["corrupt-central",corrupt,"LOCATION_XLSX_INVALID"],["declared-central",central,"LOCATION_XLSX_EXPANDED_LIMIT"],["expanded-valid-headers",expanded,"LOCATION_XLSX_EXPANDED_LIMIT"],["shared-strings",shared,"LOCATION_XLSX_SHARED_STRING_LIMIT"],["control",control,"LOCATION_XLSX_REQUIRED_HEADER_MISSING"],["overlong",overlong,"LOCATION_XLSX_CELL_LIMIT"],["formula",formula,"LOCATION_XLSX_UNSAFE_CONTENT"],["external",external,"LOCATION_XLSX_UNSAFE_CONTENT"]]){
    const value=await realEnv("MANAGE"),hash=crypto.createHash("sha256").update(bytes).digest("hex"),key=`sites/site-a/location-imports/${id}/original.xlsx`;
    value.db.prepare("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by) VALUES(?,'site-a','locations.xlsx',?,?,'v1','UPLOADED','user-a')").run(id,hash,key);
    value.env.FILES.get=async()=>({size:bytes.length,arrayBuffer:async()=>bytes});
    const before=value.db.prepare("SELECT (SELECT COUNT(*) FROM site_locations) locations,(SELECT COUNT(*) FROM site_location_aliases) aliases").get();
    const response=await worker.fetch(request(`/api/v1/admin/site-locations/upload-sessions/${id}/validate`,{method:"POST",headers:value.headers}),value.env),body=await response.json();
    assert.ok(response.status>=400&&response.status<500,`${id}: ${response.status}`);assert.equal(body.error,expected,id);
    assert.deepEqual(value.db.prepare("SELECT (SELECT COUNT(*) FROM site_locations) locations,(SELECT COUNT(*) FROM site_location_aliases) aliases").get(),before,id);
    value.db.close();
  }
  const value=await realEnv("MANAGE"),key="sites/site-a/location-imports/hash-mismatch/original.xlsx";value.db.prepare("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by) VALUES('hash-mismatch','site-a','locations.xlsx',?,?,'v1','UPLOADED','user-a')").run("0".repeat(64),key);value.env.FILES.get=async()=>({size:valid.length,arrayBuffer:async()=>valid});const response=await worker.fetch(request("/api/v1/admin/site-locations/upload-sessions/hash-mismatch/validate",{method:"POST",headers:value.headers}),value.env);assert.equal(response.status,409);assert.equal((await response.json()).error,"LOCATION_IMPORT_HASH_MISMATCH");assert.equal(value.db.prepare("SELECT COUNT(*) count FROM site_locations").get().count,0);value.db.close();
});

test("production diff/apply inactivates an imported location while Issue detail preserves snapshot and form options omit it",async()=>{
  const value=await realEnv("MANAGE"),bytes=apiWorkbook(),hash=crypto.createHash("sha256").update(bytes).digest("hex"),key="sites/site-a/location-imports/history-import/original.xlsx";value.env.DB=transactionalD1(value.db);value.env.FILES.get=async objectKey=>objectKey===key?{size:bytes.length,arrayBuffer:async()=>bytes}:null;
  value.db.exec("INSERT INTO site_locations(id,site_id,location_type,code,name,display_name,sort_order,is_active,canonical_key,source) VALUES('history-room','site-a','ROOM','ROOM_HISTORY','기존 위치명','기존 위치명',1,1,'history/room','IMPORT'); INSERT INTO issue_items(id,site_id,created_by_user_id,created_by_name_snapshot,title,location_text,description,category_code,priority,status,room_location_id) VALUES('history-issue','site-a','user-a','관리자','Issue','기존 위치명','Description','UNCLASSIFIED','NORMAL','OPEN','history-room');");
  value.db.prepare("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by) VALUES('history-import','site-a','locations.xlsx',?,?,'v1','UPLOADED','user-a')").run(hash,key);
  let response=await worker.fetch(request("/api/v1/admin/site-locations/upload-sessions/history-import/validate",{method:"POST",headers:value.headers}),value.env),preview=await response.json();assert.equal(response.status,200);assert.equal(preview.counts.inactivated,1);
  response=await worker.fetch(request("/api/v1/admin/site-locations/imports/history-import/apply",{method:"POST",body:{previewHash:preview.previewHash,baseMasterFingerprint:preview.baseMasterFingerprint},headers:{...value.headers,"idempotency-key":"history-apply"}}),value.env);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  const issueBoard=value.db.prepare("SELECT id FROM board_definitions WHERE board_key='ISSUE'").get(),role=value.db.prepare("SELECT id FROM roles WHERE code='SITE_MANAGER'").get();value.db.prepare("INSERT INTO board_access_grants(id,site_id,board_id,user_id,access_level,is_active) VALUES('issue-grant','site-a',?,'user-a','MANAGE',1)").run(issueBoard.id);value.db.prepare("INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id,status) VALUES('issue-role','user-a',?,'company-a','site-a','ACTIVE')").run(role.id);
  response=await worker.fetch(request("/api/v1/issues/history-issue",{headers:{cookie:value.headers.cookie}}),value.env);const detail=await response.json();assert.equal(response.status,200);assert.equal(detail.issue.roomLocationId,"history-room");assert.equal(detail.issue.location,"기존 위치명");
  response=await worker.fetch(request("/api/v1/issues/form-options",{headers:{cookie:value.headers.cookie}}),value.env);const options=await response.json(),location=value.db.prepare("SELECT id,is_active,display_name FROM site_locations WHERE id='history-room'").get();assert.equal(response.status,200);assert.equal(location.is_active,0);assert.equal(value.db.prepare("SELECT room_location_id FROM issue_items WHERE id='history-issue'").get().room_location_id,location.id);assert.equal(options.locationOptions.areas.some(row=>row.id===location.id),false);value.db.close();
});

test("foreign import IDs and repository rows are invisible to validate, apply, history, summary, and master snapshots",async()=>{const value=await realEnv("MANAGE");value.db.exec("INSERT INTO sites(id,company_id,name,status) VALUES('site-b','company-a','Foreign','ACTIVE'); INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,created_by) VALUES('foreign-import','site-b','foreign.xlsx','hash','v1','READY','user-a'); INSERT INTO site_locations(id,site_id,location_type,code,name,display_name,canonical_key,source) VALUES('foreign-location','site-b','BUILDING','FOREIGN','Foreign','Foreign','shared/key','IMPORT'); INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type,source) VALUES('foreign-alias','site-b','foreign-location','Shared','shared','FIELD_NAME','IMPORT');");for(const path of ["/api/v1/admin/site-locations/upload-sessions/foreign-import/validate","/api/v1/admin/site-locations/imports/foreign-import/apply"]){const response=await worker.fetch(request(path,{method:"POST",body:path.endsWith("apply")?{previewHash:"x",baseMasterFingerprint:"x"}:undefined,headers:{...value.headers,...(path.endsWith("apply")?{"idempotency-key":"foreign"}:{})}}),value.env);assert.equal(response.status,404,path)}const history=await (await worker.fetch(request("/api/v1/admin/site-locations/imports",{headers:{cookie:value.headers.cookie}}),value.env)).json();assert.equal(history.items.some(row=>row.id==="foreign-import"),false);const summary=await (await worker.fetch(request("/api/v1/admin/site-locations/summary",{headers:{cookie:value.headers.cookie}}),value.env)).json();assert.equal(summary.activeFixedLocationCount,0);const snapshot=await locationRepository.loadLocationMasterSnapshot(value.env,"site-a");assert.equal(snapshot.locations.some(row=>row.id==="foreign-location"),false);assert.equal(snapshot.aliases.some(row=>row.id==="foreign-alias"),false);value.db.close()});
