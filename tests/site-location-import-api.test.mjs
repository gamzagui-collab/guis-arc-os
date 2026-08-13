import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {handleSiteLocationImportRequest} from "../worker/modules/site-location-import.js";

const template=fs.readFileSync("apps/web/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx");
const digest=crypto.createHash("sha256").update(template).digest("hex");
const request=(path,{method="GET",body,headers={}}={})=>new Request(`https://example.test${path}`,{method,headers:{...headers,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
const auth=(access="MANAGE",siteId="site-a")=>async(_request,_env,options={})=>{
  if(options.required==="MANAGE"&&access!=="MANAGE")throw Object.assign(new Error("denied"),{status:403,code:"ADMIN_PERMISSION_DENIED"});
  return {siteId,userId:"user-a",contextVersion:7};
};
function fixture({access="MANAGE",siteId="site-a",sessionSite="site-a",bytes=template,objectKey}={}){
  const writes=[];
  const importRow={id:"import-a",site_id:sessionSite,file_name:"locations.xlsx",file_hash:digest,r2_object_key:objectKey??`sites/${sessionSite}/location-imports/import-a/original.xlsx`,status:"UPLOADED"};
  const repository={
    countActiveFixedLocations:async()=>4,
    loadRecentLocationImports:async()=>[{id:"old",status:"READY",added_count:2,error_count:0}],
    loadLocationMasterSnapshot:async()=>({locations:[],aliases:[]}),
    getLocationImport:async(_env,scope,id)=>scope===sessionSite&&id==="import-a"?importRow:null,
    createLocationImport:async(_env,row)=>{writes.push(["import",row]);return row},
    updateLocationImportValidation:async(_env,row)=>{writes.push(["validation",row])}
  };
  const env={FILES:{get:async key=>key===importRow.r2_object_key?{arrayBuffer:async()=>bytes}:null}};
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
  assert.equal(download.status,302);assert.match(download.headers.get("content-disposition"),/attachment/);assert.match(download.headers.get("location"),/templates\/GUI_Arc_/);
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

test("validation returns bounded preview and writes compact metadata only",async()=>{
  const {env,deps,writes}=fixture();
  const before=writes.filter(([kind])=>kind==="master").length;
  const response=await handleSiteLocationImportRequest(request("/api/v1/admin/site-locations/upload-sessions/import-a/validate",{method:"POST",headers:{"x-context-version":"7"}}),env,undefined,deps);
  const body=await response.json();
  assert.equal(response.status,200);assert.equal(typeof body.applyAllowed,"boolean");assert.ok(body.counts);assert.ok(Array.isArray(body.operations));assert.ok(Array.isArray(body.errors));assert.ok(body.errors.length<=100);
  assert.equal(writes.filter(([kind])=>kind==="master").length,before);assert.equal(writes.at(-1)[0],"validation");assert.equal("operations" in writes.at(-1)[1],false);
});
