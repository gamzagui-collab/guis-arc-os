import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createInterface} from "node:readline/promises";

export const CONFIRMATION="DELETE-INTEGRATION-CONSTRUCTION-TEST-DATA";
export const FINAL_CONFIRMATION="DELETE-CONSTRUCTION-TEST-DATA";
export const CONFIG="wrangler.integration.toml";
export const BUCKET="guis-arc-integrated-files-dev";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

export function parseResetArguments(argv){
 const values=new Map(),flags=new Set();
 for(const arg of argv){
  if(arg.startsWith("--")&&arg.includes("=")){const [key,...rest]=arg.slice(2).split("=");values.set(key,rest.join("="));}
  else flags.add(arg);
 }
 const execute=flags.has("--execute");
 const target=values.get("target")||null;
 if(!target)throw new Error("--target=integration을 반드시 지정해야 합니다.");
 if(target!=="integration"||flags.has("--production"))throw new Error("Production에서는 이 초기화 도구를 실행할 수 없습니다.");
 if(execute&&values.get("confirm")!==CONFIRMATION)throw new Error(`실행하려면 --execute --confirm=${CONFIRMATION} --target=integration이 모두 필요합니다.`);
 if(execute&&!values.get("site"))throw new Error("실행하려면 --site=<현장 ID>를 반드시 지정해야 합니다.");
 return {execute,dryRun:!execute,target,siteId:values.get("site")||null};
}

export function validateConstructionKeys(siteId,keys){
 const prefix=`sites/${siteId}/construction/`;
 if(!Array.isArray(keys))throw new Error("R2 키 목록이 올바르지 않습니다.");
 for(const key of keys){
  if(typeof key!=="string"||!key)throw new Error("빈 R2 키가 감지되어 중단했습니다.");
  if(key.includes("..")||key.includes("\\")||key.includes("\0"))throw new Error(`비정상 R2 경로가 감지되어 중단했습니다: ${key}`);
  if(!key.startsWith(prefix))throw new Error(`공사일보 범위 밖의 R2 키가 감지되어 중단했습니다: ${key}`);
  if(key.startsWith(`sites/${siteId}/construction-reset-backups/`)||key.includes("/construction-reset-backups/"))throw new Error(`백업 Prefix가 삭제 대상에 포함되어 중단했습니다: ${key}`);
 }
 const unique=[...new Set(keys)];
 return unique;
}

export function assertInteractiveExecution({execute,stdin=process.stdin,env=process.env}){
 if(!execute)return;
 if(env.CI==="true"||env.GITHUB_ACTIONS==="true"||env.BUILD_BUILDID||env.DEPLOYMENT_ID)throw new Error("CI 또는 배포 파이프라인에서는 실제 초기화를 실행할 수 없습니다.");
 if(!stdin.isTTY)throw new Error("비대화형 환경에서는 실제 초기화를 실행할 수 없습니다. 사람이 직접 TTY 터미널에서 실행해 주세요.");
}

export async function requestFinalConfirmation({input=process.stdin,output=process.stdout}={}){
 const prompt=createInterface({input,output});
 try{
  const answer=await prompt.question(`최종 확인 문자열 ${FINAL_CONFIRMATION} 을(를) 정확히 입력하세요: `);
  if(!isFinalConfirmation(answer))throw new Error("최종 확인 문자열이 정확히 일치하지 않아 초기화를 취소했습니다. 대소문자와 앞뒤 공백도 일치해야 합니다.");
 }finally{prompt.close();}
}
export const isFinalConfirmation=value=>value===FINAL_CONFIRMATION;

export function maskSensitiveKey(key){
 return key
  .replace(/(?:01[016789])[- ]?\d{3,4}[- ]?\d{4}/g,"01*-****-****")
  .replace(/([A-Z0-9._%+-]{2})[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})/gi,"$1***$2");
}

export function deletionSql(siteId){
 const q=sqlText(siteId);
 return [
  "PRAGMA foreign_keys = ON;",
  `DELETE FROM construction_daily_report_imported_items WHERE upload_id IN (SELECT id FROM construction_daily_report_uploads WHERE site_id=${q});`,
  `DELETE FROM construction_daily_report_upload_actions WHERE site_id=${q} OR session_id IN (SELECT id FROM construction_daily_report_upload_sessions WHERE site_id=${q});`,
  `DELETE FROM construction_daily_report_upload_sessions WHERE site_id=${q};`,
  `DELETE FROM construction_daily_report_uploads WHERE site_id=${q};`
 ].join("\n");
}

export function auditRemoteSql(sql,{filePath="<메모리>",sourceFunction="deletionSql"}={}){
 const tokenSource=String(sql)
  .replace(/\/\*[\s\S]*?\*\//g," ")
  .replace(/--[^\r\n]*/g," ")
  .replace(/'(?:''|[^'])*'/g,"''");
 const forbidden=[...tokenSource.matchAll(/\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/gi)].map(match=>match[1].toUpperCase());
 const statements=tokenSource.split(";").map(value=>value.trim()).filter(Boolean);
 const tables=[...new Set([...tokenSource.matchAll(/\b(?:DELETE\s+FROM|UPDATE)\s+([a-z_][a-z0-9_]*)/gi)].map(match=>match[1]))];
 const audit={
  filePath,sha256:crypto.createHash("sha256").update(String(sql)).digest("hex"),
  statementCount:statements.length,
  deleteCount:statements.filter(value=>/^DELETE\b/i.test(value)).length,
  updateCount:statements.filter(value=>/^UPDATE\b/i.test(value)).length,
  forbiddenTokens:forbidden,tables,sourceFunction
 };
 if(forbidden.length)throw new Error(`원격 D1 SQL에 허용되지 않는 트랜잭션 명령이 포함되어 초기화를 시작하지 않았습니다.\n금지 토큰: ${[...new Set(forbidden)].join(", ")}\nSQL 파일: ${filePath}\n발생 함수: ${sourceFunction}\n실제 삭제 시작 여부: 아니요`);
 return audit;
}

export function writeVerifiedRemoteSql(file,sql,sourceFunction="deletionSql"){
 fs.writeFileSync(file,sql);
 return auditRemoteSql(fs.readFileSync(file,"utf8"),{filePath:file,sourceFunction});
}

export function executeVerifiedRemoteSql(file,expectedAudit,executor){
 const actual=auditRemoteSql(fs.readFileSync(file,"utf8"),{filePath:file,sourceFunction:expectedAudit.sourceFunction});
 if(actual.sha256!==expectedAudit.sha256)throw new Error(`검증 후 원격 D1 SQL 파일이 변경되어 실행하지 않았습니다.\nSQL 파일: ${file}\n실제 삭제 시작 여부: 아니요`);
 return executor(file);
}

const sqlText=value=>value===null||value===undefined?"NULL":`'${String(value).replaceAll("'","''")}'`;
const fileStamp=()=>new Date().toISOString().replaceAll(":","-").replaceAll(".","-");

function wrangler(parts,{capture=true}={}){
 const cli=path.join(ROOT,"node_modules","wrangler","bin","wrangler.js");
 const result=spawnSync(process.execPath,[cli,...parts,"--config",CONFIG],{cwd:ROOT,encoding:"utf8",stdio:capture?"pipe":"inherit",shell:false,maxBuffer:100*1024*1024});
 if(result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout||"Wrangler 실행에 실패했습니다.");
 return result.stdout||"";
}
function query(sql){
 const parsed=JSON.parse(wrangler(["d1","execute","DB","--remote","--command",sql,"--json"]));
 return parsed.flatMap(batch=>batch.results||[]);
}
function executeFile(file){wrangler(["d1","execute","DB","--remote","--file",file],{capture:false});}
function tableRows(table,where="1=1"){return query(`SELECT * FROM ${table} WHERE ${where}`);}
function insertSql(table,rows){
 return rows.map(row=>{
  const cols=Object.keys(row);
  return `INSERT OR REPLACE INTO ${table}(${cols.join(",")}) VALUES(${cols.map(col=>sqlText(row[col])).join(",")});`;
 }).join("\n");
}
function snapshot(siteId){
 const q=sqlText(siteId);
 return query(`SELECT
  (SELECT COUNT(*) FROM construction_daily_report_uploads WHERE site_id=${q}) uploads,
  (SELECT COUNT(*) FROM construction_daily_report_uploads WHERE site_id=${q} AND parse_status='CONFIRMED') revisions,
  (SELECT COUNT(*) FROM construction_daily_report_imported_items WHERE upload_id IN (SELECT id FROM construction_daily_report_uploads WHERE site_id=${q})) items,
  (SELECT COUNT(*) FROM construction_daily_report_upload_sessions WHERE site_id=${q}) sessions,
  (SELECT COUNT(*) FROM construction_daily_report_upload_actions WHERE site_id=${q}) actions,
  (SELECT COUNT(*) FROM construction_daily_report_upload_sessions WHERE site_id=${q} AND analysis_json IS NOT NULL) previews,
  (SELECT MIN(work_date_kst) FROM construction_daily_report_uploads WHERE site_id=${q}) first_date,
  (SELECT MAX(work_date_kst) FROM construction_daily_report_uploads WHERE site_id=${q}) last_date,
  (SELECT COUNT(*) FROM users) retained_users,
  (SELECT COUNT(*) FROM companies) retained_companies,
  (SELECT COUNT(*) FROM sites) retained_sites,
  (SELECT COUNT(*) FROM roles) retained_roles,
  (SELECT COUNT(*) FROM permissions) retained_permissions,
  (SELECT COUNT(*) FROM role_permissions) retained_role_permissions,
  (SELECT COUNT(*) FROM board_access_grants) retained_board_grants,
  (SELECT COUNT(*) FROM sessions) retained_auth_sessions,
  (SELECT COUNT(*) FROM issue_items) retained_issues,
  (SELECT COUNT(*) FROM safety_cases) retained_safety_cases,
  (SELECT COUNT(*) FROM quality_test_inspections) retained_quality_inspections,
  (SELECT COUNT(*) FROM construction_output_sheet_documents) retained_output_documents,
  (SELECT COUNT(*) FROM construction_output_sheet_media) retained_output_media`)[0];
}
function discoverSite(requested){
 if(requested)return requested;
 const rows=query(`SELECT site_id FROM construction_daily_report_uploads UNION SELECT site_id FROM construction_daily_report_upload_sessions`);
 if(rows.length!==1)throw new Error(rows.length?"여러 현장의 데이터가 있습니다. --site=<현장 ID>를 지정해 주세요.":"초기화할 공사일보 테스트 데이터가 없습니다. --site=<현장 ID>로 빈 상태를 확인할 수 있습니다.");
 return rows[0].site_id;
}
function inventory(siteId){
 const q=sqlText(siteId);
 const uploads=tableRows("construction_daily_report_uploads",`site_id=${q}`);
 const sessions=tableRows("construction_daily_report_upload_sessions",`site_id=${q}`);
 const uploadIds=uploads.map(row=>sqlText(row.id)).join(",")||"NULL";
 const sessionIds=sessions.map(row=>sqlText(row.id)).join(",")||"NULL";
 return {
  uploads,sessions,
  items:tableRows("construction_daily_report_imported_items",`upload_id IN (${uploadIds})`),
  actions:tableRows("construction_daily_report_upload_actions",`site_id=${q} OR session_id IN (${sessionIds})`)
 };
}
function writeRestoreSql(file,data){
 const sql=["PRAGMA foreign_keys = ON;",
  insertSql("construction_daily_report_uploads",data.uploads),
  insertSql("construction_daily_report_imported_items",data.items),
  insertSql("construction_daily_report_upload_sessions",data.sessions),
  insertSql("construction_daily_report_upload_actions",data.actions)].filter(Boolean).join("\n");
 return writeVerifiedRemoteSql(file,sql,"writeRestoreSql");
}
function getObject(key,file){wrangler(["r2","object","get",`${BUCKET}/${key}`,"--remote","--file",file],{capture:false});}
function putObject(key,file){wrangler(["r2","object","put",`${BUCKET}/${key}`,"--remote","--file",file],{capture:false});}
function deleteObject(key){wrangler(["r2","object","delete",`${BUCKET}/${key}`,"--remote"],{capture:false});}

function backupPlan(siteId,runId){
 const relative=path.join("artifacts","construction-test-data-reset",runId);
 return {
  runId,
  backupDir:path.join(ROOT,relative),
  displayDir:relative,
  d1Json:path.join(relative,"d1-backup.json"),
  deleteSql:path.join(relative,"delete.sql"),
  restoreSql:path.join(relative,"restore.sql"),
  r2KeysJson:path.join(relative,"r2-keys.json"),
  reportJson:path.join(relative,"reset-result.json"),
  r2Prefix:`sites/${siteId}/construction-reset-backups/${runId}/`
 };
}

export function printResetPlan({siteId,before,keys,plan,sqlAudit,dryRun,write=console.log}){
 const row=(label,value,unit="건")=>write(`${label.padEnd(24," ")} ${value}${unit}`);
 write("\n[실행 대상]\n");
 write("환경:\nIntegration\n");
 write(`현장 ID:\n${siteId}\n`);
 write(`모드:\n${dryRun?"Dry Run":"실행 직전 확인"}\n`);
 write(`실제 삭제:\n${dryRun?"아니요":"최종 확인 후 실행"}\n`);
 write("Production 차단:\n활성");
 write("\n[삭제 대상 현황]\n");
 row("공사일보 업로드 메타데이터",before.uploads);
 row("월간 업로드 세션",before.sessions);
 row("공식 Revision",before.revisions);
 row("파생 작업 항목",before.items);
 row("비교·승인 작업 기록",before.actions);
 row("분석 Preview",before.previews);
 row("공사일보 Today 파생 데이터",0);
 row("고유 R2 원본 객체",keys.length,"개");
 write(`\n대상 작업일:\n${before.first_date||"-"}\n~\n${before.last_date||"-"}`);
 write("\n[삭제 후 예상 상태]\n");
 for(const label of ["공사일보 업로드 메타데이터","월간 업로드 세션","공식 Revision","파생 작업 항목","비교·승인 작업 기록","분석 Preview","공사일보 Today 파생 데이터"])row(label,0);
 row("연결 R2 원본 객체",0,"개");
 write("\n상태:\n공사일보를 한 번도 업로드하지 않은 최초 상태");
 write("\n[유지 대상]\n");
 row("사용자",before.retained_users,"명");
 row("회사",before.retained_companies,"개");
 row("현장",before.retained_sites,"개");
 for(const value of ["현재 대상 현장","역할·권한","인증·세션","Issue 데이터","Safety 데이터","Quality 데이터","출력일보 문서","출력일보 사진","공종 엔진","Parser","다른 R2 객체"])write(`${value}:\n유지`);
 write("\n[R2 삭제 대상]\n");
 write(`총 ${keys.length}개\n`);
 keys.forEach((key,index)=>write(`${index+1}. ${maskSensitiveKey(key)}`));
 write("\n[백업 계획]\n");
 write(`D1 JSON 백업:\n${plan.d1Json}\n`);
 write(`D1 복구 SQL:\n${plan.restoreSql}\n`);
 write(`R2 원본 백업 Prefix:\n${plan.r2Prefix}\n`);
 write(`삭제 대상 R2 key 목록:\n${plan.r2KeysJson}\n`);
 write(`감사 보고서:\n${plan.reportJson}\n`);
 write("\n[Remote D1 삭제 SQL 감사]\n");
 write(`SQL 파일 경로:\n${plan.deleteSql}\n`);
 write(`SHA-256:\n${sqlAudit.sha256}\n`);
 write(`SQL 문 개수:\n${sqlAudit.statementCount}개\n`);
 write(`DELETE 문 개수:\n${sqlAudit.deleteCount}개\n`);
 write(`UPDATE 문 개수:\n${sqlAudit.updateCount}개\n`);
 write(`금지 transaction 토큰:\n${sqlAudit.forbiddenTokens.length}건\n`);
 write(`대상 테이블:\n${sqlAudit.tables.join(", ")}`);
 if(dryRun)write("Dry Run에서는 백업 경로만 계획하며 실제 백업은 만들지 않습니다.");
}

function protectedSnapshot(value){
 return {
  users:value.retained_users,companies:value.retained_companies,sites:value.retained_sites,
  roles:value.retained_roles,permissions:value.retained_permissions,rolePermissions:value.retained_role_permissions,
  boardGrants:value.retained_board_grants,authSessions:value.retained_auth_sessions,
  issues:value.retained_issues,safetyCases:value.retained_safety_cases,qualityInspections:value.retained_quality_inspections,
  outputDocuments:value.retained_output_documents,outputMedia:value.retained_output_media
 };
}
function resultCounts(value,r2Objects){
 return {uploads:Number(value.uploads),sessions:Number(value.sessions),revisions:Number(value.revisions),items:Number(value.items),actions:Number(value.actions),previews:Number(value.previews),r2Objects:Number(r2Objects)};
}
function printSuccess({siteId,before,after,keys,backupDir}){
 console.log("\n==================================================");
 console.log("Construction 공사일보 테스트 데이터 초기화 완료");
 console.log("==================================================");
 console.log(`\n환경:\nIntegration\n\n현장:\n${siteId}`);
 console.log("\n삭제 결과:");
 for(const [label,value,unit] of [["공사일보 업로드 메타데이터",before.uploads,"건"],["월간 업로드 세션",before.sessions,"건"],["공식 Revision",before.revisions,"건"],["파생 작업 항목",before.items,"건"],["비교·승인 기록",before.actions,"건"],["분석 Preview",before.previews,"건"],["R2 공사일보 원본",keys.length,"개"]])console.log(`${label}: ${value}${unit} 삭제`);
 console.log(`\n삭제 후 상태:\n업로드 ${after.uploads}건\n세션 ${after.sessions}건\nRevision ${after.revisions}건\n작업 항목 ${after.items}건\n비교 기록 ${after.actions}건\nPreview ${after.previews}건\nR2 원본 0개`);
 console.log("\n보호 확인:\n사용자 유지\n회사 유지\n현장 유지\n역할·권한 유지\nIssue 유지\n다른 R2 객체 유지");
 console.log("\n현재 시스템 상태:\n공사일보를 한 번도 업로드하지 않은 최초 상태입니다.");
 console.log("\n다음 단계:\n1. v0.18.2 Worker와 Pages 배포\n2. 공사일보 화면의 이전 내역 없음 확인\n3. 2026년 7월 공사일보 최초 업로드\n4. 모든 날짜 NEW 확인\n5. 확정 후 Revision 1 확인\n6. 같은 파일 재업로드 시 UNCHANGED 확인");
 console.log(`\n백업 위치:\n${backupDir}\n\n==================================================`);
}

export async function run(argv=process.argv.slice(2)){
 const options=parseResetArguments(argv);
 assertInteractiveExecution(options);
 const siteId=discoverSite(options.siteId);
 const before=snapshot(siteId),data=inventory(siteId);
 const keys=validateConstructionKeys(siteId,[...data.uploads.map(row=>row.original_file_key),...data.sessions.map(row=>row.r2_key)]);
 const command=`npm.cmd run admin:reset-construction-test-data -- --execute --confirm=${CONFIRMATION} --target=integration --site=${siteId}`;
 const runId=`${fileStamp()}-${crypto.randomUUID()}`;
 const plan=backupPlan(siteId,runId);
 const plannedSqlAudit=auditRemoteSql(deletionSql(siteId),{filePath:plan.deleteSql,sourceFunction:"deletionSql"});
 printResetPlan({siteId,before,keys,plan,sqlAudit:plannedSqlAudit,dryRun:options.dryRun});
 console.log(`\n실제 실행 명령:\n${command}`);
 if(options.dryRun)return {siteId,before,keys,command,plan};
 await requestFinalConfirmation();

 const startedAt=new Date().toISOString();
 const backupDir=plan.backupDir;
 const objectDir=path.join(os.tmpdir(),`guis-arc-reset-${runId}`);
 fs.mkdirSync(backupDir,{recursive:true});fs.mkdirSync(objectDir,{recursive:true});
 const protectedBefore=protectedSnapshot(before);
 const objectMap=[];
 let failureStage="백업 생성",d1Restore="해당 없음",r2Restore="해당 없음";
 let d1Deleted=false,d1Attempted=false,r2DeletionStarted=false,restoreAudit=null;
 try{
  fs.writeFileSync(path.join(backupDir,"d1-backup.json"),JSON.stringify({environment:"integration",siteId,createdAt:startedAt,before,data},null,2));
  fs.writeFileSync(path.join(backupDir,"r2-keys.json"),JSON.stringify(keys,null,2));
  const restoreFile=path.join(backupDir,"restore.sql");restoreAudit=writeRestoreSql(restoreFile,data);
  const deleteFile=path.join(backupDir,"delete.sql");
  const deleteAudit=writeVerifiedRemoteSql(deleteFile,deletionSql(siteId),"deletionSql");
  if(deleteAudit.sha256!==plannedSqlAudit.sha256)throw new Error("Dry Run 계획과 실제 생성된 삭제 SQL의 SHA-256이 일치하지 않습니다.");
  failureStage="R2 백업 복사";
  for(const [index,key] of keys.entries()){
   const local=path.join(objectDir,`${String(index).padStart(4,"0")}-${crypto.createHash("sha256").update(key).digest("hex")}`);
   const backupKey=`${plan.r2Prefix}objects/${encodeURIComponent(key)}`;
   getObject(key,local);putObject(backupKey,local);
   objectMap.push({originalKey:key,backupKey,sha256:crypto.createHash("sha256").update(fs.readFileSync(local)).digest("hex"),local});
  }
  const manifest={runId,createdAt:new Date().toISOString(),environment:"integration",siteId,before,protectedBefore,r2Keys:objectMap.map(({local,...row})=>row),data};
  fs.writeFileSync(path.join(backupDir,"backup-manifest.json"),JSON.stringify(manifest,null,2));
  failureStage="D1 삭제";
  d1Attempted=true;
  executeVerifiedRemoteSql(deleteFile,deleteAudit,executeFile);
  d1Deleted=true;
  failureStage="R2 원본 삭제";
  for(const row of objectMap){r2DeletionStarted=true;deleteObject(row.originalKey);}
  failureStage="삭제 후 감사";
  const after=snapshot(siteId);
  const protectedAfter=protectedSnapshot(after);
  if([after.uploads,after.sessions,after.revisions,after.items,after.actions,after.previews].some(Number))throw new Error("삭제 후 Construction 잔여 데이터가 발견되었습니다.");
  if(JSON.stringify(protectedAfter)!==JSON.stringify(protectedBefore))throw new Error("보호 대상 수 변경이 감지되었습니다.");
  const result={version:"v0.18.2",environment:"integration",siteId,startedAt,completedAt:new Date().toISOString(),status:"SUCCESS",before:resultCounts(before,keys.length),deleted:resultCounts(before,keys.length),after:resultCounts(after,0),protectedDataVerified:true,backupLocation:backupDir};
  fs.writeFileSync(path.join(backupDir,"reset-result.json"),JSON.stringify(result,null,2));
  printSuccess({siteId,before,after,keys,backupDir});
  return {siteId,before,after,keys,backupDir,backupPrefix:plan.r2Prefix};
 }catch(error){
  console.error("\n초기화 실패");
  console.error(`\n실패 단계:\n${failureStage}`);
  console.error(`\n원인:\n${error.message}`);
  const restoreFile=path.join(backupDir,"restore.sql");
  if(d1Attempted&&!d1Deleted){
   try{
    const current=snapshot(siteId);
    d1Deleted=["uploads","sessions","revisions","items","actions","previews"].some(key=>Number(current[key])!==Number(before[key]));
   }catch(auditError){
    d1Deleted=true;
    d1Restore=`삭제 실패 후 감사 실패: ${auditError.message}`;
   }
  }
  if(d1Deleted&&fs.existsSync(restoreFile)){
   try{executeVerifiedRemoteSql(restoreFile,restoreAudit,executeFile);d1Restore="성공";}catch(restoreError){d1Restore=`실패: ${restoreError.message}`;}
  }else{
   d1Restore="불필요 — 삭제 후 감사 결과 변경 0건";
  }
  if(r2DeletionStarted){
   r2Restore="성공";
   for(const row of objectMap){
    try{putObject(row.originalKey,row.local);}catch(restoreError){r2Restore=`실패: ${restoreError.message}`;}
   }
  }else{
   r2Restore="불필요 — R2 원본 삭제 시작 전";
  }
  console.error(`\nD1 복구:\n${d1Restore}`);
  console.error(`\nR2 복구:\n${r2Restore}`);
  const recoveryOk=!d1Restore.startsWith("실패")&&!r2Restore.startsWith("실패");
  console.error(`\n현재 상태:\n${recoveryOk?"초기화 전 상태 유지 또는 복원됨":"부분 복구 실패 — 수동 확인 필요"}`);
  const result={version:"v0.18.2",environment:"integration",siteId,startedAt,completedAt:new Date().toISOString(),status:"FAILED",failureStage,error:error.message,d1Restore,r2Restore,before:resultCounts(before,keys.length),backupLocation:backupDir};
  try{fs.writeFileSync(path.join(backupDir,"reset-result.json"),JSON.stringify(result,null,2));}catch{}
  throw new Error(`초기화를 완료하지 못했습니다. 백업 위치: ${backupDir}`);
 }finally{
  fs.rmSync(objectDir,{recursive:true,force:true});
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 run().catch(error=>{console.error(error.message);process.exitCode=1;});
}
