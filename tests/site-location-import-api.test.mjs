import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {handleSiteLocationImportRequest} from "../worker/modules/site-location-import.js";
import worker from "../worker/index.js";

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

test("validation returns bounded preview and writes compact metadata only",async()=>{
  const {env,deps,writes}=fixture();
  const before=writes.filter(([kind])=>kind==="master").length;
  const response=await handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),env,undefined,deps);
  const body=await response.json();
  assert.equal(response.status,200);assert.equal(typeof body.applyAllowed,"boolean");assert.ok(body.counts);assert.ok(Array.isArray(body.operations));assert.ok(Array.isArray(body.errors));assert.ok(body.errors.length<=100);
  assert.equal(writes.filter(([kind])=>kind==="master").length,before);assert.equal(writes.at(-1)[0],"validation");assert.equal("operations" in writes.at(-1)[1],false);
});
