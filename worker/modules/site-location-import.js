import {AwsClient} from "aws4fetch";
import {ApiError,json,parseJson,requestId} from "../core/response.js";
import {authenticate,context} from "../core/session.js";
import {requireBoardAccess} from "../core/board-access.js";
import {LOCATION_IMPORT_LIMITS} from "./site-location-import/contracts.js";
import {parseSiteLocationWorkbook} from "./site-location-import/xlsx-parser.js";
import {validateLocationImport} from "./site-location-import/validation.js";
import {buildLocationImportDiff} from "./site-location-import/diff.js";
import * as defaultRepository from "./site-location-import/repository.js";
import {applyLocationImport,assessLocationImportApplyCapacity} from "./site-location-import/apply.js";

const MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TEMPLATE="GUI_Arc_현장위치마스터_기본서식_v1.xlsx";
const safeName=value=>String(value||"").replace(/[^0-9A-Za-z._\u3131-\uD79D]/g,"_").slice(0,160);
const uploadObjectKey=(siteId,importId)=>`sites/${siteId}/location-imports/${importId}/original.xlsx`;
const artifactObjectKey=(siteId,importId,fileHash)=>`sites/${siteId}/location-imports/${importId}/artifacts/${fileHash}.xlsx`;
const hex=buffer=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,"0")).join("");
const hash=async bytes=>hex(await crypto.subtle.digest("SHA-256",bytes));

async function authorize(request,env,{required="VIEW",write=false}={}){
  const row=await authenticate(request,env,{csrf:write}),ctx=await context(env,row),siteId=ctx.selectedSiteId;
  if(!siteId)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","현장을 선택해 주세요.");
  if(write&&Number(request.headers.get("x-context-version"))!==ctx.contextVersion)throw new ApiError(409,"CONTEXT_VERSION_STALE","화면을 새로고침해 주세요.");
  const membership=await env.DB.prepare("SELECT 1 allowed FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE' AND approval_status='APPROVED'").bind(row.user_id,siteId).first();
  if(!membership)throw new ApiError(403,"ADMIN_SITE_SCOPE_DENIED","활성 현장 가입이 필요합니다.");
  await requireBoardAccess(env,{userId:row.user_id,siteId,boardKey:"ADMINISTRATION",required,requestId:requestId(request)});
  return {siteId,userId:row.user_id,contextVersion:ctx.contextVersion};
}

async function signUpload(env,key){
  if(!env.R2_ACCOUNT_ID||!env.R2_BUCKET_NAME||!env.R2_ACCESS_KEY_ID||!env.R2_SECRET_ACCESS_KEY)throw new ApiError(503,"LOCATION_IMPORT_UPLOAD_UNAVAILABLE","업로드 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.");
  const signer=new AwsClient({accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY,service:"s3",region:"auto"});
  const url=new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key.split("/").map(encodeURIComponent).join("/")}`);url.searchParams.set("X-Amz-Expires","900");
  return (await signer.sign(new Request(url,{method:"PUT",headers:{"content-type":MIME}}),{aws:{signQuery:true}})).url;
}

async function removeUploadObject(env,row){if(!row?.r2_object_key||!env.FILES?.delete)return;try{await env.FILES.delete(row.r2_object_key)}catch{}}
export async function cleanupAbandonedLocationImportObjects(env,repository,siteId){if(!env.FILES?.delete||!repository.loadLocationImportCleanupCandidates||!repository.claimLocationImportUploadCleanup)return;const rows=await repository.loadLocationImportCleanupCandidates(env,siteId,20);for(const row of rows){const claimToken=crypto.randomUUID(),claim={siteId,importId:row.id,objectKey:row.r2_object_key,status:row.status,claimToken};if(!await repository.claimLocationImportUploadCleanup(env,claim))continue;const keys=[row.r2_object_key];if(row.status!=="APPLIED"&&row.file_hash)keys.push(artifactObjectKey(siteId,row.id,row.file_hash));try{await env.FILES.delete(keys.filter(Boolean));if(!await repository.completeLocationImportUploadCleanup(env,claim))await repository.releaseLocationImportUploadCleanup?.(env,claim)}catch{try{await repository.releaseLocationImportUploadCleanup?.(env,claim)}catch{}}}}
function assertUploadObject(row,siteId){if(row.r2_object_key!==uploadObjectKey(siteId,row.id))throw new ApiError(409,"LOCATION_IMPORT_OBJECT_SCOPE_INVALID","업로드 파일의 현장 범위가 올바르지 않습니다.")}
function assertObjectSize(object){const size=Number(object?.size);if(!Number.isInteger(size)||size<=0||size>LOCATION_IMPORT_LIMITS.compressedBytes)throw new ApiError(413,"LOCATION_IMPORT_OBJECT_SIZE_INVALID","업로드된 파일 크기가 허용 범위를 벗어났습니다.");return size}

export async function handleSiteLocationImportRequest(request,env,url=new URL(request.url),dependencies={}){
  const path=url.pathname,method=request.method;if(!path.startsWith("/api/v1/admin/site-locations"))return null;
  const repository=dependencies.repository??defaultRepository,authorizeRequest=dependencies.authorize??authorize,uploadSigner=dependencies.signUpload??((key)=>signUpload(env,key)),templateFetcher=dependencies.fetchTemplate??globalThis.fetch;
  if(method==="GET"&&path==="/api/v1/admin/site-locations/summary"){const auth=await authorizeRequest(request,env,{required:"VIEW"}),[count,history]=await Promise.all([repository.countActiveFixedLocations(env,auth.siteId),repository.loadRecentLocationImports(env,auth.siteId,20)]);return json({activeFixedLocationCount:count,lastSuccessfulImport:history.find(item=>item.status==="APPLIED")??null})}
  if(method==="GET"&&path==="/api/v1/admin/site-locations/imports"){const auth=await authorizeRequest(request,env,{required:"VIEW"});return json({items:await repository.loadRecentLocationImports(env,auth.siteId,20)})}
  const applyMatch=path.match(/^\/api\/v1\/admin\/site-locations\/imports\/([^/]+)\/apply$/);
  if(method==="POST"&&applyMatch){
    const auth=await authorizeRequest(request,env,{required:"MANAGE",write:true}),body=await parseJson(request),idempotencyKey=String(request.headers.get("idempotency-key")||"").trim();
    if(!idempotencyKey||idempotencyKey.length>120)throw new ApiError(400,"IDEMPOTENCY_KEY_REQUIRED","A valid Idempotency-Key is required.");
    const row=await repository.getLocationImport(env,auth.siteId,applyMatch[1]);if(!row)throw new ApiError(404,"LOCATION_IMPORT_NOT_FOUND","The import was not found in the active site.");
    const previewHash=String(body.previewHash||""),baseMasterFingerprint=String(body.baseMasterFingerprint||""),payloadHash=await hash(new TextEncoder().encode(JSON.stringify({importId:row.id,siteId:auth.siteId,previewHash,baseMasterFingerprint})).buffer);
    const replay=await repository.getApplyReplay(env,{siteId:auth.siteId,userId:auth.userId,importId:row.id,idempotencyKey});if(replay){if(replay.payload_hash!==payloadHash)throw new ApiError(409,"IDEMPOTENCY_PAYLOAD_MISMATCH","The Idempotency-Key was already used with a different payload.");return json(replay.response)}
    if(!["READY","APPLYING"].includes(row.status))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","The import is not ready to apply.");assertUploadObject(row,auth.siteId);
    const object=await env.FILES.get(row.r2_object_key);if(!object)throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The preview file no longer exists.");const objectSize=assertObjectSize(object),bytes=await object.arrayBuffer();if(bytes.byteLength!==objectSize)throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The preview file size changed.");const fileHash=await hash(bytes);if(fileHash!==row.file_hash)throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The preview file changed.");
    let workbook;try{workbook=parseSiteLocationWorkbook(bytes)}catch{throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The preview file can no longer be parsed.")}
    const [current,identityGuards]=await Promise.all([repository.loadLocationMasterSnapshot(env,auth.siteId),repository.loadLocationImportIdentityGuards?.(env,auth.siteId,workbook)??{}]),checked=validateLocationImport({siteId:auth.siteId,workbook,current,identityGuards}),diff=buildLocationImportDiff({siteId:auth.siteId,normalized:checked.normalized,current}),capacity=assessLocationImportApplyCapacity(diff);
    if(checked.errors.length||diff.counts.error||!capacity.allowed||previewHash!==row.preview_hash||baseMasterFingerprint!==row.base_master_fingerprint||Number(current.revision)!==Number(row.base_master_revision))throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The file, master, or preview changed.");
    return json(await applyLocationImport({env,repository,importRow:row,siteId:auth.siteId,userId:auth.userId,idempotencyKey,payloadHash,diff,fileHash,requestId:requestId(request),currentSnapshot:current,fileBytes:bytes,uploadObjectKey:row.r2_object_key,artifactObjectKey:artifactObjectKey(auth.siteId,row.id,fileHash)}));
  }
  if(method==="GET"&&path==="/api/v1/admin/site-locations/template"){
    await authorizeRequest(request,env,{required:"VIEW"});if(!env.PUBLIC_ORIGIN||typeof templateFetcher!=="function")throw new ApiError(503,"LOCATION_IMPORT_TEMPLATE_UNAVAILABLE","기본서식을 불러올 수 없습니다.");const assetUrl=new URL(`/templates/${encodeURIComponent(TEMPLATE)}`,env.PUBLIC_ORIGIN),asset=await templateFetcher(new Request(assetUrl,{method:"GET"}));if(!asset.ok)throw new ApiError(503,"LOCATION_IMPORT_TEMPLATE_UNAVAILABLE","기본서식을 불러올 수 없습니다.");const headers=new Headers(asset.headers);headers.set("content-type",MIME);headers.set("content-disposition",`attachment; filename*=UTF-8''${encodeURIComponent(TEMPLATE)}`);headers.set("cache-control","private, no-store");return new Response(asset.body,{status:200,headers});
  }
  if(method==="POST"&&path==="/api/v1/admin/site-locations/upload-sessions"){
    const auth=await authorizeRequest(request,env,{required:"MANAGE",write:true});await cleanupAbandonedLocationImportObjects(env,repository,auth.siteId);const body=await parseJson(request),fileName=safeName(body.fileName),sizeBytes=Number(body.sizeBytes),fileHash=String(body.sha256||"").toLowerCase();
    if(!/\.xlsx$/i.test(fileName)||!Number.isInteger(sizeBytes)||sizeBytes<=0||sizeBytes>LOCATION_IMPORT_LIMITS.compressedBytes||!/^[a-f0-9]{64}$/.test(fileHash))throw new ApiError(400,"LOCATION_IMPORT_UPLOAD_INVALID","10MiB 이하의 올바른 .xlsx 파일을 선택해 주세요.");
    const id=crypto.randomUUID(),key=uploadObjectKey(auth.siteId,id),uploadUrl=await uploadSigner(key);await repository.createLocationImport(env,{id,siteId:auth.siteId,fileName,fileHash,r2ObjectKey:key,createdBy:auth.userId});return json({upload:{id,key,url:uploadUrl,method:"PUT",contentType:MIME,expiresInSeconds:900}},201);
  }
  const validation=path.match(/^\/api\/v1\/admin\/site-locations\/upload-sessions\/([^/]+)\/validate$/);
  if(method==="POST"&&validation){
    const auth=await authorizeRequest(request,env,{required:"MANAGE",write:true}),row=await repository.getLocationImport(env,auth.siteId,validation[1]);if(!row)throw new ApiError(404,"LOCATION_IMPORT_NOT_FOUND","현재 현장의 업로드를 찾을 수 없습니다.");if(!["UPLOADED","INVALID","READY"].includes(row.status))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","현재 상태에서는 다시 검증할 수 없습니다.");assertUploadObject(row,auth.siteId);if(!await repository.beginLocationImportValidation(env,auth.siteId,row.id))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","업로드 상태가 변경되었습니다. 새로고침해 주세요.");
    let closed=false;const closeInvalid=async(errorCode)=>{closed=true;await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});await removeUploadObject(env,row);throw new ApiError(errorCode==="LOCATION_IMPORT_OBJECT_SIZE_INVALID"?413:errorCode==="LOCATION_IMPORT_HASH_MISMATCH"?409:400,errorCode,errorCode==="LOCATION_IMPORT_OBJECT_SIZE_INVALID"?"업로드된 파일 크기가 허용 범위를 벗어났습니다.":errorCode==="LOCATION_IMPORT_HASH_MISMATCH"?"업로드 파일 확인값이 일치하지 않습니다.":"올바른 XLSX 파일이 아닙니다.")};
    try{
      const object=await env.FILES.get(row.r2_object_key);if(!object){closed=true;await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});throw new ApiError(409,"LOCATION_IMPORT_OBJECT_MISSING","업로드 파일을 찾을 수 없습니다.")}let objectSize;try{objectSize=assertObjectSize(object)}catch{await closeInvalid("LOCATION_IMPORT_OBJECT_SIZE_INVALID")}const bytes=await object.arrayBuffer(),signature=new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));if(bytes.byteLength!==objectSize||signature[0]!==0x50||signature[1]!==0x4b||signature[2]!==0x03||signature[3]!==0x04)await closeInvalid("LOCATION_XLSX_INVALID");if(await hash(bytes)!==row.file_hash)await closeInvalid("LOCATION_IMPORT_HASH_MISMATCH");
      let workbook;try{workbook=parseSiteLocationWorkbook(bytes)}catch(error){closed=true;await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});await removeUploadObject(env,row);throw new ApiError(400,error.code||"LOCATION_XLSX_INVALID",error.message)}
      const [current,identityGuards]=await Promise.all([repository.loadLocationMasterSnapshot(env,auth.siteId),repository.loadLocationImportIdentityGuards?.(env,auth.siteId,workbook)??{}]),checked=validateLocationImport({siteId:auth.siteId,workbook,current,identityGuards}),diff=buildLocationImportDiff({siteId:auth.siteId,normalized:checked.normalized,current}),capacity=assessLocationImportApplyCapacity(diff),capacityErrors=capacity.allowed?[]:[{code:"LOCATION_IMPORT_APPLY_LIMIT",field:"workbook",sourceSheetName:null,sourceRow:null}],errors=[...checked.errors,...diff.operations.filter(item=>item.type==="ERROR"),...capacityErrors].slice(0,100),counts={...diff.counts,error:checked.errors.length+diff.counts.error+capacityErrors.length},status=counts.error?"INVALID":"READY";
      if(!await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status,baseMasterFingerprint:diff.baseMasterFingerprint,baseMasterRevision:current.revision,previewHash:diff.previewHash,counts}))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","검증 중 업로드 상태가 변경되었습니다.");closed=true;if(status==="INVALID")await removeUploadObject(env,row);return json({importId:row.id,status,applyAllowed:status==="READY",fileHash:row.file_hash,baseMasterFingerprint:diff.baseMasterFingerprint,baseMasterRevision:current.revision,previewHash:diff.previewHash,counts,operations:diff.operations.filter(item=>item.type!=="ERROR"),errors});
    }catch(error){if(!closed)try{await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"FAILED",counts:{error:1}})}catch{}throw error}
  }
  return null;
}
