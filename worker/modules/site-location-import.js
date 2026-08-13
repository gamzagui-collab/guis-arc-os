import {AwsClient} from "aws4fetch";
import {ApiError,json,parseJson,requestId} from "../core/response.js";
import {authenticate,context} from "../core/session.js";
import {requireBoardAccess} from "../core/board-access.js";
import {LOCATION_IMPORT_LIMITS} from "./site-location-import/contracts.js";
import {parseSiteLocationWorkbook} from "./site-location-import/xlsx-parser.js";
import {validateLocationImport} from "./site-location-import/validation.js";
import {buildLocationImportDiff} from "./site-location-import/diff.js";
import * as defaultRepository from "./site-location-import/repository.js";
import {applyLocationImport} from "./site-location-import/apply.js";

const MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TEMPLATE="GUI_Arc_?꾩옣?꾩튂留덉뒪??湲곕낯?쒖떇_v1.xlsx";
const safeName=value=>String(value||"").replace(/[^0-9A-Za-z._\\u3131-\\uD79D]/g,"_").slice(0,160);
const hex=buffer=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,"0")).join("");
const hash=async bytes=>hex(await crypto.subtle.digest("SHA-256",bytes));

async function authorize(request,env,{required="VIEW",write=false}={}){
  const row=await authenticate(request,env,{csrf:write}),ctx=await context(env,row),siteId=ctx.selectedSiteId;
  if(!siteId)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","?꾩옣???좏깮??二쇱꽭??");
  if(write&&Number(request.headers.get("x-context-version"))!==ctx.contextVersion)throw new ApiError(409,"CONTEXT_VERSION_STALE","?붾㈃???덈줈怨좎묠??二쇱꽭??");
  const membership=await env.DB.prepare("SELECT 1 allowed FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE' AND approval_status='APPROVED'").bind(row.user_id,siteId).first();
  if(!membership)throw new ApiError(403,"ADMIN_SITE_SCOPE_DENIED","?쒖꽦 ?꾩옣 媛?낆씠 ?꾩슂?⑸땲??");
  await requireBoardAccess(env,{userId:row.user_id,siteId,boardKey:"ADMINISTRATION",required,requestId:requestId(request)});
  return {siteId,userId:row.user_id,contextVersion:ctx.contextVersion};
}

async function signUpload(env,key){
  if(!env.R2_ACCOUNT_ID||!env.R2_BUCKET_NAME||!env.R2_ACCESS_KEY_ID||!env.R2_SECRET_ACCESS_KEY)throw new ApiError(503,"LOCATION_IMPORT_UPLOAD_UNAVAILABLE","?낅줈???ㅼ젙???뺤씤?섍퀬 ?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??");
  const signer=new AwsClient({accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY,service:"s3",region:"auto"});
  const url=new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key.split("/").map(encodeURIComponent).join("/")}`);url.searchParams.set("X-Amz-Expires","900");
  return (await signer.sign(new Request(url,{method:"PUT",headers:{"content-type":MIME}}),{aws:{signQuery:true}})).url;
}

export async function handleSiteLocationImportRequest(request,env,url=new URL(request.url),dependencies={}){
  const path=url.pathname,method=request.method;if(!path.startsWith("/api/v1/admin/site-locations"))return null;
  const repository=dependencies.repository??defaultRepository,authorizeRequest=dependencies.authorize??authorize,uploadSigner=dependencies.signUpload??((key)=>signUpload(env,key));
  if(method==="GET"&&path==="/api/v1/admin/site-locations/summary"){
    const auth=await authorizeRequest(request,env,{required:"VIEW"}),[count,history]=await Promise.all([repository.countActiveFixedLocations(env,auth.siteId),repository.loadRecentLocationImports(env,auth.siteId,20)]);
    return json({activeFixedLocationCount:count,lastSuccessfulImport:history.find(item=>item.status==="APPLIED")??null});
  }
  if(method==="GET"&&path==="/api/v1/admin/site-locations/imports"){
    const auth=await authorizeRequest(request,env,{required:"VIEW"});return json({items:await repository.loadRecentLocationImports(env,auth.siteId,20)});
  }
  const applyMatch=path.match(/^\/api\/v1\/admin\/site-locations\/imports\/([^/]+)\/apply$/);
  if(method==="POST"&&applyMatch){
    const auth=await authorizeRequest(request,env,{required:"MANAGE",write:true}),body=await parseJson(request),idempotencyKey=String(request.headers.get("idempotency-key")||"").trim();
    if(!idempotencyKey||idempotencyKey.length>120)throw new ApiError(400,"IDEMPOTENCY_KEY_REQUIRED","A valid Idempotency-Key is required.");
    const row=await repository.getLocationImport(env,auth.siteId,applyMatch[1]);if(!row)throw new ApiError(404,"LOCATION_IMPORT_NOT_FOUND","The import was not found in the active site.");
    const previewHash=String(body.previewHash||""),baseMasterFingerprint=String(body.baseMasterFingerprint||"");
    const payloadHash=await hash(new TextEncoder().encode(JSON.stringify({importId:row.id,siteId:auth.siteId,previewHash,baseMasterFingerprint})).buffer);
    const replay=await repository.getApplyReplay(env,{siteId:auth.siteId,userId:auth.userId,importId:row.id,idempotencyKey});
    if(replay){if(replay.payload_hash!==payloadHash)throw new ApiError(409,"IDEMPOTENCY_PAYLOAD_MISMATCH","The Idempotency-Key was already used with a different payload.");return json(replay.response)}
    if(row.status!=="READY")throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","The import is not ready to apply.");
    if(!String(row.r2_object_key||"").startsWith(`sites/${auth.siteId}/location-imports/${row.id}/`))throw new ApiError(409,"LOCATION_IMPORT_OBJECT_SCOPE_INVALID","The uploaded object is outside the active site.");
    const object=await env.FILES.get(row.r2_object_key);if(!object)throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The preview file no longer exists.");
    const bytes=await object.arrayBuffer(),fileHash=await hash(bytes);if(fileHash!==row.file_hash)throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The preview file changed.");
    let workbook;try{workbook=parseSiteLocationWorkbook(bytes)}catch{throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The preview file can no longer be parsed.")}
    const [current,identityGuards]=await Promise.all([repository.loadLocationMasterSnapshot(env,auth.siteId),repository.loadLocationImportIdentityGuards?.(env,auth.siteId,workbook)??{}]),checked=validateLocationImport({siteId:auth.siteId,workbook,current,identityGuards}),diff=buildLocationImportDiff({siteId:auth.siteId,normalized:checked.normalized,current});
    if(checked.errors.length||diff.counts.error||previewHash!==row.preview_hash||baseMasterFingerprint!==row.base_master_fingerprint||Number(current.revision)!==Number(row.base_master_revision))throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The file, master, or preview changed.");
    return json(await applyLocationImport({env,repository,importRow:row,siteId:auth.siteId,userId:auth.userId,idempotencyKey,payloadHash,diff,fileHash,requestId:requestId(request),currentSnapshot:current}));
  }
  if(method==="GET"&&path==="/api/v1/admin/site-locations/template"){
    await authorizeRequest(request,env,{required:"VIEW"});if(!env.ASSETS?.fetch)throw new ApiError(503,"LOCATION_IMPORT_TEMPLATE_UNAVAILABLE","湲곕낯?쒖떇??遺덈윭?????놁뒿?덈떎.");
    const assetUrl=new URL(request.url);assetUrl.pathname=`/templates/${encodeURIComponent(TEMPLATE)}`;assetUrl.search="";
    const asset=await env.ASSETS.fetch(new Request(assetUrl,{method:"GET"}));if(!asset.ok)throw new ApiError(503,"LOCATION_IMPORT_TEMPLATE_UNAVAILABLE","湲곕낯?쒖떇??遺덈윭?????놁뒿?덈떎.");
    const headers=new Headers(asset.headers);headers.set("content-type",MIME);headers.set("content-disposition",`attachment; filename*=UTF-8''${encodeURIComponent(TEMPLATE)}`);headers.set("cache-control","private, no-store");
    return new Response(asset.body,{status:asset.status,headers});
  }
  if(method==="POST"&&path==="/api/v1/admin/site-locations/upload-sessions"){
    const auth=await authorizeRequest(request,env,{required:"MANAGE",write:true}),body=await parseJson(request),fileName=safeName(body.fileName),sizeBytes=Number(body.sizeBytes),fileHash=String(body.sha256||"").toLowerCase();
    if(!/\.xlsx$/i.test(fileName)||!Number.isInteger(sizeBytes)||sizeBytes<=0||sizeBytes>LOCATION_IMPORT_LIMITS.compressedBytes||!/^[a-f0-9]{64}$/.test(fileHash))throw new ApiError(400,"LOCATION_IMPORT_UPLOAD_INVALID","10MiB ?댄븯???щ컮瑜?.xlsx ?뚯씪???좏깮??二쇱꽭??");
    const id=crypto.randomUUID(),key=`sites/${auth.siteId}/location-imports/${id}/${fileName}`,uploadUrl=await uploadSigner(key);
    await repository.createLocationImport(env,{id,siteId:auth.siteId,fileName,fileHash,r2ObjectKey:key,createdBy:auth.userId});
    return json({upload:{id,key,url:uploadUrl,method:"PUT",contentType:MIME,expiresInSeconds:900}},201);
  }
  const validation=path.match(/^\/api\/v1\/admin\/site-locations\/upload-sessions\/([^/]+)\/validate$/);
  if(method==="POST"&&validation){
    const auth=await authorizeRequest(request,env,{required:"MANAGE",write:true}),row=await repository.getLocationImport(env,auth.siteId,validation[1]);
    if(!row)throw new ApiError(404,"LOCATION_IMPORT_NOT_FOUND","?꾩옱 ?꾩옣???낅줈?쒕? 李얠쓣 ???놁뒿?덈떎.");
    if(!["UPLOADED","INVALID","READY"].includes(row.status))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","?꾩옱 ?곹깭?먯꽌???ㅼ떆 寃利앺븷 ???놁뒿?덈떎.");
    if(!String(row.r2_object_key||"").startsWith(`sites/${auth.siteId}/location-imports/${row.id}/`))throw new ApiError(409,"LOCATION_IMPORT_OBJECT_SCOPE_INVALID","?낅줈???뚯씪???꾩옣 踰붿쐞媛 ?щ컮瑜댁? ?딆뒿?덈떎.");
    if(!await repository.beginLocationImportValidation(env,auth.siteId,row.id))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","?낅줈???곹깭媛 蹂寃쎈릺?덉뒿?덈떎. ?덈줈怨좎묠??二쇱꽭??");
    try{
    const object=await env.FILES.get(row.r2_object_key);if(!object){await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});throw new ApiError(409,"LOCATION_IMPORT_OBJECT_MISSING","?낅줈???뚯씪??李얠쓣 ???놁뒿?덈떎.");}
    const objectSize=Number(object.size);if(!Number.isInteger(objectSize)||objectSize<=0||objectSize>LOCATION_IMPORT_LIMITS.compressedBytes){await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});throw new ApiError(413,"LOCATION_IMPORT_OBJECT_SIZE_INVALID","?낅줈?쒕맂 ?뚯씪 ?ш린媛 ?덉슜 踰붿쐞瑜?踰쀬뼱?ъ뒿?덈떎.");}
    const bytes=await object.arrayBuffer(),signature=new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
    if(bytes.byteLength!==objectSize||signature[0]!==0x50||signature[1]!==0x4b||signature[2]!==0x03||signature[3]!==0x04){await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});throw new ApiError(400,"LOCATION_XLSX_INVALID","?щ컮瑜?XLSX ?뚯씪???꾨떃?덈떎.");}
    if(await hash(bytes)!==row.file_hash){await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});throw new ApiError(409,"LOCATION_IMPORT_HASH_MISMATCH","?낅줈???뚯씪 ?뺤씤媛믪씠 ?쇱튂?섏? ?딆뒿?덈떎.");}
    let workbook;try{workbook=parseSiteLocationWorkbook(bytes)}catch(error){await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"INVALID",counts:{error:1}});throw new ApiError(400,error.code||"LOCATION_XLSX_INVALID",error.message)}
    const [current,identityGuards]=await Promise.all([repository.loadLocationMasterSnapshot(env,auth.siteId),repository.loadLocationImportIdentityGuards?.(env,auth.siteId,workbook)??{}]),checked=validateLocationImport({siteId:auth.siteId,workbook,current,identityGuards}),diff=buildLocationImportDiff({siteId:auth.siteId,normalized:checked.normalized,current});
    const errors=[...checked.errors,...diff.operations.filter(item=>item.type==="ERROR")].slice(0,100);
    const counts={...diff.counts,error:checked.errors.length+diff.counts.error};
    const status=errors.length?"INVALID":"READY";
    if(!await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status,baseMasterFingerprint:diff.baseMasterFingerprint,baseMasterRevision:current.revision,previewHash:diff.previewHash,counts}))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","寃利?以??낅줈???곹깭媛 蹂寃쎈릺?덉뒿?덈떎.");
    return json({importId:row.id,status,applyAllowed:status==="READY",fileHash:row.file_hash,baseMasterFingerprint:diff.baseMasterFingerprint,baseMasterRevision:current.revision,previewHash:diff.previewHash,counts,operations:diff.operations.filter(item=>item.type!=="ERROR"),errors});
    }catch(error){try{await repository.updateLocationImportValidation(env,{id:row.id,siteId:auth.siteId,status:"FAILED",counts:{error:1}})}catch{}throw error}
  }
  return null;
}
