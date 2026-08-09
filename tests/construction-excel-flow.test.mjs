import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import {strToU8,zipSync} from "fflate";
import {aggregateMajorWorks,constructionProvider} from "../worker/modules/today/providers/construction-provider.js";
import {analyzeUrbanTreeWorkbook,parseUrbanTreeWorkbook} from "../worker/modules/construction/xlsx-parser.js";
import {canonicalDailyContent,canonicalContentHash,comparableDailyContent,compareDailyConstructionContent,constructionTradeIdentity,contentDiff,isBlankDailyBlock,isExplicitRestDay,normalizeCanonicalSnapshot,normalizeConstructionDescription,normalizeStoredConstructionRevision,restoreLegacyFallbackItems} from "../worker/modules/construction/daily-content.js";
import {applyComparedDates,assertConstructionAnalysisPayloadSize,constructionAnalysisStoragePayload,constructionConfirmDiagnostic,constructionD1WriteDiagnostic,persistConstructionAnalysis,refreshStoredComparison} from "../worker/modules/construction.js";
import {matchTradeNames,normalizeTradeName,parseCompositeTrade,reconcileWorkforceTrades,resolveCanonicalTrade} from "../worker/modules/construction/trade-matcher.js";
import {isAutoMatchAlias,SITE_TRADE_CONFLICTS,SITE_TRADE_DICTIONARY,validateSiteTradeData} from "../worker/modules/construction/trade-data/index.js";
import {bindConfirmationSelectionChanges,bindIndividualConfirmationButtons,captureConfirmationViewState,confirmationAvailability,confirmationPreviewHtml,monthlyWorkLabel,monthlyWorkRows,partitionConfirmationDates,plannedWorkItemsDiffHtml,restoreConfirmationViewState,singleConfirmationExecution,submitConfirmationGroups} from "../apps/web/assets/construction.js";
import {constructionWorkItemHtml,constructionWorkforceText} from "../apps/web/assets/construction-work-item.js";
import {CONFIRMATION,FINAL_CONFIRMATION,assertInteractiveExecution,auditRemoteSql,deletionSql,executeVerifiedRemoteSql,isFinalConfirmation,parseResetArguments,printResetPlan,validateConstructionKeys,writeVerifiedRemoteSql} from "../scripts/reset-construction-test-data.mjs";

const read=path=>fs.readFileSync(path,"utf8");
const currentKstWorkDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const workChanges=(before,after)=>compareDailyConstructionContent(canonicalDailyContent("site-1",{plannedWorkItems:before}),canonicalDailyContent("site-1",{plannedWorkItems:after})).changes;
const escape=value=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const cell=(address,value)=>`<c r="${address}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`;
const numberCell=(address,value)=>`<c r="${address}"><v>${value}</v></c>`;
const formulaCell=(address,formula,cached)=>`<c r="${address}"><f>${escape(formula)}</f>${cached===undefined?"":`<v>${cached}</v>`}</c>`;
const row=(number,cells)=>`<row r="${number}">${cells.join("")}</row>`;
const testDatabase=()=>{const db=new DatabaseSync(":memory:");for(const name of fs.readdirSync("database/migrations").sort())db.exec(read(`database/migrations/${name}`));return db};
const d1=(db,{maxStringBytes=Infinity,failStatement=null}={})=>{
 const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}}}});
 return {prepare:sql=>statement(sql),async batch(statements){db.exec("BEGIN");try{const results=statements.map(item=>{if(item.args.some(value=>typeof value==="string"&&new TextEncoder().encode(value).byteLength>=maxStringBytes))throw new Error("D1_ERROR: string or blob too big: SQLITE_TOOBIG");if(failStatement?.(item.sql,item.args))throw new Error("의도한 statement 실패");const result=db.prepare(item.sql).run(...item.args);return {success:true,meta:{changes:Number(result.changes)}}});db.exec("COMMIT");return results}catch(error){db.exec("ROLLBACK");throw error}}};
};

function block(start,{dateCell,tradeCount="5",title="▶ 형틀공(직영-5)",detail="- 101동 3층 벽체 거푸집 설치",sourceTotal="999"}={}){
 const titleRow=start,siteRow=start+3,dateRow=start+4,headerRow=start+5,subHeaderRow=start+6,dataRow=start+7,totalRow=start+9;
 return [
  row(titleRow,[cell(`C${titleRow}`,"공사일보")]),
  row(siteRow,[cell(`C${siteRow}`,"현장명"),cell(`D${siteRow}`,": 테스트 현장")]),
  row(dateRow,[cell(`C${dateRow}`,"일자"),dateCell(dateRow),cell(`H${dateRow}`,"날씨 :"),cell(`I${dateRow}`,"맑음"),cell(`K${dateRow}`,"최저 :"),numberCell(`L${dateRow}`,"21"),cell(`M${dateRow}`,"최고 :"),numberCell(`N${dateRow}`,"30")]),
  row(headerRow,[cell(`C${headerRow}`,"공 종"),cell(`E${headerRow}`,"출력현황"),cell(`H${headerRow}`,"전일 작업사항"),cell(`M${headerRow}`,"금일 작업예정사항"),cell(`R${headerRow}`,"비고")]),
  row(subHeaderRow,[cell(`E${subHeaderRow}`,"전일"),cell(`F${subHeaderRow}`,"금일"),cell(`G${subHeaderRow}`,"누계")]),
  row(dataRow,[cell(`C${dataRow}`,"형틀공"),numberCell(`E${dataRow}`,"0"),tradeCount===""?cell(`F${dataRow}`,""):Number.isNaN(Number(tradeCount))?cell(`F${dataRow}`,tradeCount):numberCell(`F${dataRow}`,tradeCount),numberCell(`G${dataRow}`,"12"),cell(`H${dataRow}`,"전일 작업 원문"),cell(`M${dataRow}`,title)]),
  row(dataRow+1,[cell(`M${dataRow+1}`,detail),cell(`R${dataRow+1}`,"비고 원문")]),
  row(totalRow,[cell(`C${totalRow}`,"소계"),numberCell(`F${totalRow}`,sourceTotal)])
 ].join("");
}

function workbookFixture({secondFormulaCached=true,invalidWorkforce=false,sourceTotal="999"}={}){
 const firstStart=2,secondStart=80;
 const rows=[
  block(firstStart,{dateCell:rowNumber=>numberCell(`D${rowNumber}`,"46204"),tradeCount:invalidWorkforce?"오류":"5",sourceTotal}),
  block(secondStart,{dateCell:rowNumber=>formulaCell(`D${rowNumber}`,secondFormulaCached?"D6+1":"D6+2",secondFormulaCached?"46205":undefined),tradeCount:"0",title:"▶ 형틀공",detail:"- 자유서술 작업"})
 ].join("");
 return zipSync({
  "[Content_Types].xml":strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  "xl/workbook.xml":strToU8('<?xml version="1.0"?><workbook><sheets><sheet name="2026.07" sheetId="1" r:id="rId1"/><sheet name="결재란" sheetId="2" r:id="rId2"/></sheets></workbook>'),
  "xl/_rels/workbook.xml.rels":strToU8('<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>'),
  "xl/worksheets/sheet1.xml":strToU8(`<worksheet><dimension ref="A1:S100"/><sheetData>${rows}</sheetData><mergeCells><mergeCell ref="C2:Q2"/></mergeCells></worksheet>`),
  "xl/worksheets/sheet2.xml":strToU8('<worksheet><dimension ref="A1:J3"/><sheetData/></worksheet>')
 });
}

function largeMonthlyAnalysis(dayCount=31){
 const seed=analyzeUrbanTreeWorkbook(workbookFixture()).blocks[0],blocks=Array.from({length:dayCount},(_,day)=>{
  const plannedWorkItems=Array.from({length:12},(_,index)=>({...seed.plannedWorkItems[0],trade:`공종 ${index+1}`,description:`${day+1}일 101동 ${index+1}층 ${"긴 작업 원문 ".repeat(28)}`,rawText:`원문 ${"현장 상세 작업 ".repeat(28)}`,sourceCellRange:`M${day*67+index}:M${day*67+index+1}`,tradeMatch:{canonicalTradeId:`TRADE_${index+1}`,matchType:"SITE_ALIAS",confidence:0.98,evidence:[`현장 공종 ${index+1}`,`원본 셀 M${day*67+index}`]}}));
  const trades=Array.from({length:24},(_,index)=>({...seed.trades[0],trade:`공종 ${index+1}`,rawTrade:`공종 ${index+1}`}));
  const warnings=Array.from({length:12},(_,index)=>({code:"WORK_TEXT_UNCERTAIN",message:`확인 경고 ${index+1} ${"추적정보 ".repeat(20)}`,sourceCellRange:`M${day*67+index}`}));
  return {...seed,workDate:`2026-07-${String(day+1).padStart(2,"0")}`,plannedWorkItems,trades,warnings,sourceRow:day*67+2,sourceCellRange:`C${day*67+2}:S${day*67+68}`};
 });
 return {templateCode:"URBANTREE_DAILY_V2",sheets:[{name:"2026.07",state:"visible"}],blockCount:blocks.length,dates:blocks.map(block=>({workDate:block.workDate,status:block.status,sourceSheetName:block.sourceSheetName,sourceRow:block.sourceRow,warnings:block.warnings})),blocks};
}

test("parser discovers monthly blocks by title and header signatures instead of a fixed row stride",()=>{
 const analysis=analyzeUrbanTreeWorkbook(workbookFixture());
 assert.deepEqual(analysis.sheets.map(sheet=>sheet.name),["2026.07","결재란"]);
 assert.equal(analysis.blockCount,2);
 assert.deepEqual(analysis.blocks.map(block=>block.sourceRow),[2,80]);
 assert.deepEqual(analysis.blocks.map(block=>block.workDate),["2026-07-01","2026-07-02"]);
});

test("selected-date parser preserves raw work text, traces, zero values, and excludes totals",()=>{
 const result=parseUrbanTreeWorkbook(workbookFixture(),"2026-07-02");
 assert.equal(result.templateCode,"URBANTREE_DAILY_V2");
 assert.equal(result.siteName,"테스트 현장");
 assert.equal(result.weather,"맑음");
 assert.equal(result.minimumCelsius,21);
 assert.equal(result.maximumCelsius,30);
 assert.equal(result.trades.length,1);
 assert.equal(result.trades[0].plannedWorkforce,0);
 assert.equal(result.trades[0].previousWorkforce,0);
 assert.equal(result.items[0].workforceCount,0);
 assert.equal(result.items[0].companyConnectionStatus,"NOT_PROVIDED");
 assert.equal(result.items[0].companyNameSnapshot,null);
 assert.equal(result.items[0].locationText,null);
 assert.match(result.items[0].rawText,/자유서술 작업/);
 assert.equal(result.items[0].sourceCellRange,"M87:M88");
 assert.equal(result.companyBreakdownAvailable,false);
 assert.ok(result.warnings.some(item=>item.code==="WORK_TEXT_UNCERTAIN"));
 assert.ok(result.warnings.some(item=>item.code==="COMPANY_BREAKDOWN_UNAVAILABLE"));
 assert.equal(result.totalWorkforce,0);
});

test("invalid workforce becomes null with a warning instead of forced zero",()=>{
 const result=parseUrbanTreeWorkbook(workbookFixture({invalidWorkforce:true}),"2026-07-01");
 assert.equal(result.trades[0].plannedWorkforce,null);
 assert.equal(result.items[0].workforceCount,null);
 const warning=result.warnings.find(item=>item.code==="WORKFORCE_INVALID"&&item.sourceCellRange==="F9");
 assert.ok(warning);
 assert.equal(warning.rawValue,"오류");
});

test("formula date uses cached value and unresolved formulas are not guessed",()=>{
 const cached=analyzeUrbanTreeWorkbook(workbookFixture()).blocks[1];
 assert.equal(cached.workDate,"2026-07-02");
 const unresolved=analyzeUrbanTreeWorkbook(workbookFixture({secondFormulaCached:false})).blocks[1];
 assert.equal(unresolved.workDate,null);
 assert.equal(unresolved.status,"DATE_UNRESOLVED");
 assert.ok(unresolved.warnings.some(item=>item.code==="FORMULA_DATE_UNRESOLVED"));
});

test("construction Excel parser rejects a selected/document date mismatch",()=>{
 assert.throws(()=>parseUrbanTreeWorkbook(workbookFixture(),"2026-07-03"),error=>error.code==="CONSTRUCTION_XLSX_DATE_MISMATCH");
});

test("Today does not fabricate a company and keeps planned total independent",()=>{
 const works=aggregateMajorWorks([{work_description:"형틀 설치",workforce_count:5,company_name:null,company_name_snapshot:null,trade_name_snapshot:"형틀공",location_text:null}]);
 assert.equal(works[0].total,5);
 assert.deepEqual(works[0].companies,[]);
 assert.equal(works[0].companyBreakdownAvailable,false);
});

test("construction screen distinguishes permission denial from server failure",()=>{
 const ui=read("apps/web/assets/construction.js");
 assert.match(ui,/error\?\.status===403\?"공사일보 열람 권한이 필요합니다\.":"공사일보 정보를 불러오지 못했습니다\."/);
 assert.match(ui,/catch\(error\)\{content\.innerHTML=constructionErrorView\(error\)\}/);
});

test("direct upload session contract keeps the monthly original out of the Worker API body",()=>{
 const worker=read("worker/modules/construction.js"),ui=read("apps/web/assets/construction.js"),migration=read("database/migrations/0019_construction_direct_upload_sessions.sql");
 for(const token of ["CONSTRUCTION_XLSX_MAX_BYTES=50*1024*1024","daily-report-upload-sessions","new AwsClient","X-Amz-Expires","env.FILES.head","CONSTRUCTION_XLSX_SIGNATURE_INVALID","crypto.subtle.digest","uploadResultFromAnalysis","idempotency-key"])assert.ok(worker.includes(token),token);
 assert.match(worker,/daily-report-uploads\/analyze"\)\{throw new ApiError\(410/);
 for(const token of ["fetch(created.upload.url","파일 크기가 너무 큽니다. 50MB 이하의 .xlsx 파일을 선택해 주세요.","전체 선택","선택 날짜 확정","확인 후 확정 권장","if(button?.isConnected)button.disabled=false"])assert.ok(ui.includes(token),token);
 for(const token of ["construction_daily_report_upload_sessions","confirmation_key","analysis_json","expires_at"])assert.ok(migration.includes(token),token);
});

test("v0.18.4 stores a complete large monthly analysis below D1 limits without duplicating preview dates",async()=>{
 const seed=analyzeUrbanTreeWorkbook(workbookFixture()).blocks[0],blocks=Array.from({length:32},(_,day)=>{
  const workDate=`2026-${day===0?"06-30":`07-${String(day).padStart(2,"0")}`}`;
  const plannedWorkItems=Array.from({length:12},(_,index)=>({...seed.plannedWorkItems[0],trade:`공종 ${index}`,description:`101동 ${index}층 작업 ${"상세작업 ".repeat(28)}`,rawText:`원문 ${"현장작업 ".repeat(28)}`,sourceCellRange:`M${day*67+index}:M${day*67+index+1}`}));
  const trades=Array.from({length:28},(_,index)=>({...seed.trades[0],trade:`공종 ${index}`,rawTrade:`공종 ${index}`}));
  const warnings=Array.from({length:13},(_,index)=>({code:"WORK_TEXT_UNCERTAIN",message:`확인 경고 ${index} ${"추적정보 ".repeat(20)}`,sourceCellRange:`M${day*67+index}`}));
  return {...seed,workDate,plannedWorkItems,trades,warnings,sourceRow:day*67+2,sourceCellRange:`C${day*67+2}:S${day*67+68}`};
 });
 const analysis={templateCode:"URBANTREE_DAILY_V2",sheets:[{name:"2026.07",state:"visible"}],blockCount:blocks.length,dates:blocks.map(block=>({workDate:block.workDate,status:block.status,sourceSheetName:block.sourceSheetName,sourceRow:block.sourceRow,warnings:block.warnings})),blocks};
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>null})})}},dates=[];
 for(const block of blocks)dates.push((await refreshStoredComparison(env,"site-1",{analysis:{blocks:[block]}})).preview.dates[0]);
 const counts={NEW:32,UNCHANGED:0,CHANGED:0,REVIEW_REQUIRED:0,WARNING:0,INVALID:0,FUTURE:0},preview={templateCode:analysis.templateCode,blockCount:analysis.blockCount,dates,counts,companyBreakdownAvailable:false,warning:"회사별 인원 정보가 원본 공사일보에 없습니다."};
 const oldJson=JSON.stringify({analysis,preview}),stored=constructionAnalysisStoragePayload(analysis,preview),newJson=JSON.stringify(stored);
 assert.ok(Buffer.byteLength(oldJson)>2_000_000);
 assert.ok(Buffer.byteLength(newJson)<2_000_000);
 assert.deepEqual(stored.analysis,analysis);
 assert.equal(stored.preview.dates,undefined);
 assert.deepEqual(stored.preview.counts,counts);
 const refreshed=await refreshStoredComparison(env,"site-1",stored);
 assert.equal(refreshed.preview.dates.length,32);
 assert.ok(refreshed.preview.dates.filter(date=>date.workDate<="2026-07-31").every(date=>date.comparisonStatus==="NEW"&&date.nextRevision===1));
 assert.equal(refreshed.analysis.blocks.reduce((sum,block)=>sum+block.plannedWorkItems.length,0),384);
 const diagnostic=constructionD1WriteDiagnostic({statement:"upload-session-analysis-update",table:"construction_daily_report_upload_sessions",operation:"UPDATE",sql:"UPDATE construction_daily_report_upload_sessions SET analysis_json=?3 WHERE id=?1",bindings:[{name:"session_id",value:"session-1"},{name:"r2_key",value:"sites/site-1/construction/monthly-originals/session-1/report.xlsx"},{name:"analysis_json",value:newJson,json:true}]});
 assert.equal(diagnostic.bindings[2].bytes,Buffer.byteLength(newJson));
 assert.deepEqual(diagnostic.bindings[2].topLevelKeys,["analysis","preview"]);
 assert.equal(assertConstructionAnalysisPayloadSize(newJson),Buffer.byteLength(newJson));
 assert.throws(()=>assertConstructionAnalysisPayloadSize("가".repeat(700_000)),error=>error.code==="CONSTRUCTION_ANALYSIS_PAYLOAD_TOO_LARGE"&&error.message==="공사일보 분석 데이터의 크기가 처리 한도를 초과했습니다. 관리자에게 문의해 주세요.");
});

test("v0.18.4 analysis persistence keeps the retry source on D1 failure and cleans it only after success",async()=>{
 const makeEnv=fail=>{const events=[];return {events,FILES:{put:async key=>events.push(["put",key]),delete:async key=>events.push(["delete",key])},DB:{prepare:sql=>({bind:(...bindings)=>({sql,bindings})}),batch:async statements=>{events.push(["batch",statements.length]);if(fail)throw new Error("D1_ERROR: string or blob too big: SQLITE_TOOBIG")}}}};
 const input={session:{r2_key:"temporary.xlsx"},auth:{siteId:"site-1",userId:"user-1"},id:"session-1",buffer:new ArrayBuffer(8),digest:"a".repeat(64),verifiedKey:"verified.xlsx",storedJson:'{"analysis":{},"preview":{}}',diagnostic:{statement:"upload-session-analysis-update"},counts:{NEW:1},requestIdValue:"request-1",updateSql:"UPDATE construction_daily_report_upload_sessions SET analysis_json=?3 WHERE id=?1"};
 const success=makeEnv(false);await persistConstructionAnalysis({env:success,...input});
 assert.deepEqual(success.events.map(event=>event.slice(0,2)),[["put","verified.xlsx"],["batch",2],["delete","temporary.xlsx"]]);
 const failure=makeEnv(true),originalError=console.error;console.error=()=>{};
 try{await assert.rejects(()=>persistConstructionAnalysis({env:failure,...input}),error=>error.code==="CONSTRUCTION_ANALYSIS_SAVE_FAILED"&&error.message==="공사일보 분석 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");}finally{console.error=originalError}
 assert.deepEqual(failure.events.map(event=>event.slice(0,2)),[["put","verified.xlsx"],["batch",2],["delete","verified.xlsx"]]);
 assert.ok(!failure.events.some(event=>event[1]==="temporary.xlsx"));
});

test("v0.15 upload policy accepts the real 21MB range and rejects more than 50MB",()=>{
 const worker=read("worker/modules/construction.js"),ui=read("apps/web/assets/construction.js");
 assert.ok(21*1024*1024<50*1024*1024);
 assert.match(worker,/sizeBytes>CONSTRUCTION_XLSX_MAX_BYTES/);
 assert.match(ui,/file\.size>50\*1024\*1024/);
 assert.ok(read("r2-cors.integration.json").includes("https://guis-arc-integrated-dev.pages.dev"));
});

test("v0.14 construction migration stays unchanged and v0.15 adds upload sessions non-destructively",()=>{
 const migration=read("database/migrations/0018_construction_excel_and_output_archive.sql");
 for(const token of ["construction_daily_report_uploads","construction_daily_report_imported_items","construction_output_sheet_documents","construction_output_sheet_media","SUPERSEDED","INVALIDATED"])assert.ok(migration.includes(token),token);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM daily_output_reports/i);
});

test("canonical daily hash is stable for whitespace but preserves null and zero",async()=>{
 const base={workDate:"2026-07-01",siteName:" 테스트  현장 ",weather:"맑음",trades:[{trade:"형틀공",previousWorkforce:null,plannedWorkforce:0,cumulativeWorkforce:5}],previousWorkRaw:[" 전일  작업\r\n완료 "],plannedWorkRaw:["금일 작업"],remarks:null,plannedWorkItems:[{trade:"형틀공",description:"벽체  설치",rawText:"벽체 설치",plannedWorkforce:0}]};
 const normalized={...base,siteName:"테스트 현장",previousWorkRaw:["전일 작업\n완료"],plannedWorkItems:[{...base.plannedWorkItems[0],description:"벽체 설치"}]};
 const first=canonicalDailyContent("site-1",base),second=canonicalDailyContent("site-1",normalized);
 assert.equal(await canonicalContentHash(first),await canonicalContentHash(second));
 assert.equal(first.trades[0].previousWorkforce,null);
 assert.equal(first.trades[0].plannedWorkforce,0);
 assert.notEqual(await canonicalContentHash(first),await canonicalContentHash({...first,trades:[{...first.trades[0],plannedWorkforce:null}]}));
});

test("v0.17.2 monthly work labels show trade official workforce and fallback context",()=>{
 assert.equal(monthlyWorkLabel({trade:"형틀공",plannedWorkforce:27,description:"벽체 설치"}),"형틀공(27명) - 벽체 설치");
 assert.equal(monthlyWorkLabel({trade:"내장공",plannedWorkforce:null,description:"먹매김"}),"내장공(인원 확인 필요) - 먹매김");
 assert.equal(monthlyWorkLabel({trade:"철근공",plannedWorkforce:0,description:"자재 정리"}),"철근공(0명) - 자재 정리");
 assert.equal(monthlyWorkLabel({trade:"직원",plannedWorkforce:7,description:"노코멘트",isFallbackWorkItem:true}),"직원(7명) - 노코멘트");
 assert.equal(monthlyWorkLabel({trade:"T/C 조종사",plannedWorkforce:1,description:"노코멘트",isFallbackWorkItem:true}),"T/C 조종사(1명) - 노코멘트");
});

test("v0.17.3 construction work HTML emphasizes only trade and workforce",()=>{
 const html=constructionWorkItemHtml({trade:"형틀공",plannedWorkforce:20,description:"현장정리, 세대청소"});
 assert.match(html,/<strong class="construction-work-item__trade">형틀공\(20명\)<\/strong>/);
 assert.match(html,/<span class="construction-work-item__description">현장정리, 세대청소<\/span>/);
 assert.doesNotMatch(html,/<strong[^>]*>[^<]*현장정리/);
 assert.equal(constructionWorkforceText(null),"인원 확인 필요");
 assert.equal(constructionWorkforceText(undefined),"인원 확인 필요");
 assert.equal(constructionWorkforceText(0),"0명");
 assert.equal(constructionWorkforceText(7),"7명");
 assert.equal(constructionWorkforceText("잘못된 값"),"인원 확인 필요");
 const fallback=monthlyWorkRows([{trade:"직원",plannedWorkforce:7,description:"노코멘트",isFallbackWorkItem:true},{trade:"T/C 조종사",plannedWorkforce:1,isFallbackWorkItem:true}]);
 assert.match(fallback,/<strong[^>]*>직원\(7명\)<\/strong>.*<span class="construction-work-item__description">노코멘트<\/span>/);
 assert.match(fallback,/<strong[^>]*>T\/C 조종사\(1명\)<\/strong>/);
 assert.doesNotMatch(fallback,/<strong[^>]*>노코멘트<\/strong>/);
});

test("v0.17.3 planned work comparison is semantic Korean UI without JSON fields",()=>{
 const before=[{order:0,trade:"형틀공",plannedWorkforce:18,description:"현장정리",rawText:"원문",warningCode:"X"},{order:1,trade:"미장공",plannedWorkforce:4,description:"초벌"}];
 const after=[{order:9,trade:"형틀공",plannedWorkforce:20,description:"현장정리",rawText:"  원문  ",warningCode:"Y"},{trade:"도장공",plannedWorkforce:3,description:"계단실 도장"}];
 const changes=workChanges(before,after);
 assert.deepEqual(changes.map(item=>item.type),["공종 추가","인원 변경","공종 삭제"]);
 assert.deepEqual(workChanges([{...before[0],order:0,rawText:"A",matchType:"A"}],[{...before[0],order:99,rawText:"B",matchType:"B"}]),[]);
 assert.equal(workChanges(before,[{...before[0],description:"현장정리 및 청소"},before[1]])[0].type,"작업내용 변경");
 assert.equal(workChanges(before,[{...before[0],plannedWorkforce:21,description:"현장정리 및 청소"},before[1]])[0].type,"인원 및 작업내용 변경");
 const html=plannedWorkItemsDiffHtml(changes);
 for(const hidden of ['"order":','"rawText":','"plannedWorkforce":','"isFallbackWorkItem":',"[","]","{","}"])assert.doesNotMatch(html,new RegExp(hidden.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
 assert.match(html,/공종 추가/);
 assert.match(html,/공종 삭제/);
 assert.match(html,/인원 변경/);
 assert.match(html,/>기존</);
 assert.match(html,/>업로드</);
});

test("v0.17.3 comparison content ignores work order raw text and metadata only",async()=>{
 const first=canonicalDailyContent("site-1",{workDate:"2026-07-08",plannedWorkRaw:["▶ 형틀공 - 현장정리"],plannedWorkItems:[
  {trade:"형틀공",plannedWorkforce:20,description:"현장정리",rawText:"원문 A",workDescriptionSource:"ORIGINAL_WORK_PLAN"},
  {trade:"직원",plannedWorkforce:7,description:"노코멘트",rawText:null,isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"}
 ]});
 const reordered=canonicalDailyContent("site-1",{workDate:"2026-07-08",plannedWorkRaw:["기호가 다른 원문"],plannedWorkItems:[
  {trade:"직원",plannedWorkforce:7,description:"노코멘트",rawText:"메타 변경",isFallbackWorkItem:true,workDescriptionSource:"CHANGED_METADATA"},
  {trade:"형틀공",plannedWorkforce:20,description:"현장정리",rawText:"원문 B",workDescriptionSource:"ORIGINAL_WORK_PLAN"}
 ]});
 assert.equal(await canonicalContentHash(comparableDailyContent(first)),await canonicalContentHash(comparableDailyContent(reordered)));
 assert.deepEqual(contentDiff(first,reordered),[]);
 const changed=canonicalDailyContent("site-1",{...reordered,plannedWorkItems:reordered.plannedWorkItems.map(item=>item.trade==="형틀공"?{...item,plannedWorkforce:21}:item)});
 assert.notEqual(await canonicalContentHash(comparableDailyContent(first)),await canonicalContentHash(comparableDailyContent(changed)));
 assert.deepEqual(contentDiff(first,changed).map(item=>item.field),["금일 주요 작업"]);
});

test("v0.17.4 composite details use the canonical base trade for comparison and display",async()=>{
 const examples=[
  ["기계설비공","기계설비공(배관-5)","기계설비공"],
  ["소방설비공","소방설비공(전기-2, 기계-3)","소방설비공"],
  ["형틀공","형틀공(직영-5, 형틀-5, 알폼-2)","형틀공"],
  ["견출공","견출공(면처리-1, 할석-3)","견출공"],
 ];
 for(const [plain,composite,displayTrade] of examples){
  const beforeIdentity=constructionTradeIdentity({trade:plain}),afterIdentity=constructionTradeIdentity({trade:composite});
  assert.equal(beforeIdentity.tradeComparisonKey,afterIdentity.tradeComparisonKey);
  assert.equal(afterIdentity.displayTrade,displayTrade);
  const before={trade:plain,...beforeIdentity,plannedWorkforce:5,description:"동일 작업"};
  const after={trade:composite,...afterIdentity,plannedWorkforce:5,description:"동일 작업"};
  assert.deepEqual(workChanges([before],[after]),[]);
  const html=constructionWorkItemHtml(after);
  assert.match(html,new RegExp(`${displayTrade}\\(5명\\)`));
  assert.doesNotMatch(html,/\)\(5명\)/);
 }
 const first=canonicalDailyContent("site-1",{workDate:"2026-07-08",trades:[{trade:"기계설비공",plannedWorkforce:5}],plannedWorkItems:[{trade:"기계설비공",plannedWorkforce:5,description:"동일 작업"}]});
 const detailed=canonicalDailyContent("site-1",{workDate:"2026-07-08",trades:[{trade:"기계설비공(배관-5)",plannedWorkforce:5}],plannedWorkItems:[{trade:"기계설비공(배관-5)",plannedWorkforce:5,description:"동일 작업"}]});
 assert.equal(await canonicalContentHash(comparableDailyContent(first)),await canonicalContentHash(comparableDailyContent(detailed)));
 assert.deepEqual(contentDiff(first,detailed),[]);
});

test("v0.17.4 same-trade rows match by description then workforce without order dependence",()=>{
 const identity=constructionTradeIdentity({trade:"기계설비공"});
 const before=[
  {trade:"기계설비공",...identity,description:"A 작업",plannedWorkforce:3},
  {trade:"기계설비공",...identity,description:"B 작업",plannedWorkforce:5},
 ];
 const after=[
  {trade:"기계설비공(배관-3, 환기-2)",...identity,description:"B 작업",plannedWorkforce:7},
  {trade:"기계설비공(배관-3)",...identity,description:"A 작업",plannedWorkforce:3},
 ];
 assert.deepEqual(workChanges(before,after).map(item=>item.type),["인원 변경"]);
 const ambiguous=workChanges(
  before.map(item=>({...item,description:"같은 작업",plannedWorkforce:null})),
  after.map(item=>({...item,description:"다른 작업",plannedWorkforce:1})),
 );
 assert.deepEqual(ambiguous.map(item=>item.type),["확인 필요"]);
});

test("v0.17.5 normalizes real work descriptions without hiding meaningful numbers",()=>{
 assert.equal(normalizeConstructionDescription("1동 12층 PVC 입상 배관"),normalizeConstructionDescription("▶ 1동 12층 PVC입상배관"));
 assert.equal(normalizeConstructionDescription("현장정리, 세대청소"),normalizeConstructionDescription("• 현장정리 ,  세대청소"));
 assert.notEqual(normalizeConstructionDescription("1동 12층 PVC 입상 배관"),normalizeConstructionDescription("1동 13층 PVC 입상 배관"));
});

test("v0.17.5 Integration fixtures use one Worker comparison result for status and UI",()=>{
 const fixtures=[
  [{trade:"기계설비공",plannedWorkforce:5,description:"1동 12층 입상배관, 2동 12층 PVC 입상 배관"},{trade:"기계설비공(배관-5)",plannedWorkforce:5,description:"▶ 1동 12층 입상배관, 2동 12층 PVC입상배관"},null],
  [{trade:"소방설비공",plannedWorkforce:5,description:"동일 작업내용"},{trade:"소방설비공(전기-2, 기계-3)",plannedWorkforce:5,description:"동일 작업내용"},null],
  [{trade:"형틀공",plannedWorkforce:9,description:"동일 작업내용"},{trade:"형틀공(직영-5, 형틀-4)",plannedWorkforce:9,description:"동일 작업내용"},null],
  [{trade:"형틀공",plannedWorkforce:9,description:"동일 작업내용"},{trade:"형틀공(직영-5, 형틀-5, 알폼-2)",plannedWorkforce:12,description:"동일 작업내용"},"인원 변경"],
  [{trade:"기계설비공",plannedWorkforce:5,description:"1동 12층 배관"},{trade:"기계설비공(배관-5)",plannedWorkforce:5,description:"1동 13층 배관"},"작업내용 변경"],
 ];
 for(const [beforeItem,afterItem,expectedType] of fixtures){
  const result=compareDailyConstructionContent(canonicalDailyContent("site-1",{plannedWorkItems:[beforeItem]}),canonicalDailyContent("site-1",{plannedWorkItems:[afterItem]}));
  assert.equal(result.changed,result.changes.length>0);
  assert.equal(result.changes[0]?.type||null,expectedType);
  assert.equal(result.changes.some(item=>["공종 삭제","공종 추가"].includes(item.type)),false);
  assert.equal(result.comparisonVersion,2);
 }
});

test("v0.17.5 does not match conflicting trades only because work text is equal",()=>{
 const pairs=[["미장공","견출공"],["기계설비공","소방설비공"],["직원","직영"],["형틀공","내장목공사"]];
 for(const [beforeTrade,afterTrade] of pairs){
  const changes=workChanges([{trade:beforeTrade,plannedWorkforce:5,description:"동일 작업"}],[{trade:afterTrade,plannedWorkforce:5,description:"동일 작업"}]);
  assert.deepEqual(new Set(changes.map(item=>item.type)),new Set(["공종 삭제","공종 추가"]));
 }
});

test("v0.17.5 identical duplicate work rows remain unchanged when reordered",()=>{
 const before=[
  {trade:"형틀공",plannedWorkforce:9,description:"1동 벽체"},
  {trade:"형틀공",plannedWorkforce:9,description:"1동 벽체"},
  {trade:"철근공",plannedWorkforce:4,description:"2동 배근"},
 ];
 const after=[before[2],{...before[1],rawText:"다른 원문"},{...before[0],order:99}];
 const result=compareDailyConstructionContent(canonicalDailyContent("site-1",{plannedWorkItems:before}),canonicalDailyContent("site-1",{plannedWorkItems:after}));
 assert.equal(result.changed,false);
 assert.deepEqual(result.changes,[]);
 assert.equal(result.unchangedMatches.length,3);
});

test("v0.17.2 canonical content uses reconciled workforce and includes fallback items",()=>{
 const reconciled=reconcileWorkforceTrades(
  [{trade:"내장목공사",plannedWorkforce:4},{trade:"T/C 조종사",plannedWorkforce:1},{trade:"직원",plannedWorkforce:7}],
  [{trade:"내장공",description:"먹매김",rawText:"▶ 내장공\n- 먹매김"}],
 );
 const snapshot=canonicalDailyContent("site-1",{workDate:"2026-07-08",trades:[{trade:"내장목공사",plannedWorkforce:4},{trade:"T/C 조종사",plannedWorkforce:1},{trade:"직원",plannedWorkforce:7}],plannedWorkItems:reconciled.plannedWorkItems});
 assert.deepEqual(snapshot.plannedWorkItems.map(item=>[item.trade,item.plannedWorkforce,item.isFallbackWorkItem,item.workDescriptionSource]),[
  ["내장공",4,false,"ORIGINAL_WORK_PLAN"],["T/C 조종사",1,true,"OUTPUT_WORKFORCE_FALLBACK"],["직원",7,true,"OUTPUT_WORKFORCE_FALLBACK"]
 ]);
});

test("v0.17.2 legacy canonical snapshots normalize without a false changed result",async()=>{
 const trades=[{order:0,trade:"내장목공사",previousWorkforce:null,plannedWorkforce:4,cumulativeWorkforce:null},{order:1,trade:"직원",previousWorkforce:null,plannedWorkforce:7,cumulativeWorkforce:null}];
 const legacy={siteId:"site-1",workDate:"2026-07-08",siteName:null,weather:null,minTemperature:null,maxTemperature:null,trades,previousWorkRaw:[],plannedWorkRaw:[],remarks:null,plannedWorkItems:[{order:0,trade:"내장공",description:"먹매김",rawText:"▶ 내장공\n- 먹매김",plannedWorkforce:4}]};
 const current=normalizeCanonicalSnapshot(legacy);
 assert.deepEqual(current.plannedWorkItems.map(item=>[item.trade,item.plannedWorkforce,item.isFallbackWorkItem]),[["내장공",4,false],["직원",7,true]]);
 assert.equal(await canonicalContentHash(current),await canonicalContentHash(normalizeCanonicalSnapshot(current)));
 const changed=canonicalDailyContent("site-1",{...current,plannedWorkItems:current.plannedWorkItems.map(item=>item.trade==="내장공"?{...item,plannedWorkforce:5}:item)});
 assert.notEqual(await canonicalContentHash(current),await canonicalContentHash(changed));
});

test("v0.17.6 restores missing legacy staff and tower-crane fallbacks only from official workforce evidence",()=>{
 const legacy={siteId:"site-1",workDate:"2026-07-17",todayWorkforceTotal:8,employeeWorkforce:7,tradeWorkforceTotal:1,trades:[{trade:"T/C 조종사",plannedWorkforce:1}],plannedWorkItems:[]};
 const original=JSON.stringify(legacy);
 const normalized=normalizeCanonicalSnapshot(legacy);
 assert.deepEqual(normalized.plannedWorkItems.map(item=>[item.trade,item.plannedWorkforce,item.description,item.isFallbackWorkItem]),[
  ["T/C 조종사",1,"노코멘트",true],["직원",7,"노코멘트",true]
 ]);
 assert.equal(JSON.stringify(legacy),original);
});

test("v0.17.6 treats the July 17 legacy fallback shape as unchanged",()=>{
 const legacy={siteId:"site-1",workDate:"2026-07-17",todayWorkforceTotal:8,employeeWorkforce:7,tradeWorkforceTotal:1,trades:[{trade:"T/C 조종사",plannedWorkforce:1}],plannedWorkItems:[]};
 const uploaded={...legacy,plannedWorkItems:[
  {trade:"직원",plannedWorkforce:7,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"},
  {trade:"T/C 조종사",plannedWorkforce:1,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"}
 ]};
 const result=compareDailyConstructionContent(legacy,canonicalDailyContent("site-1",uploaded));
 assert.equal(result.changed,false);
 assert.deepEqual(result.changes,[]);
});

test("v0.17.6 keeps real fallback workforce changes additions and deletions visible",()=>{
 const staffSeven={siteId:"site-1",todayWorkforceTotal:7,employeeWorkforce:7,tradeWorkforceTotal:0,trades:[],plannedWorkItems:[]};
 const staffEight=canonicalDailyContent("site-1",{todayWorkforceTotal:8,employeeWorkforce:8,tradeWorkforceTotal:0,plannedWorkItems:[{trade:"직원",plannedWorkforce:8,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"}]});
 assert.deepEqual(compareDailyConstructionContent(staffSeven,staffEight).changes.map(change=>change.type),["인원 변경"]);
 const withCrane=canonicalDailyContent("site-1",{todayWorkforceTotal:8,employeeWorkforce:7,tradeWorkforceTotal:1,trades:[{trade:"T/C 조종사",plannedWorkforce:1}],plannedWorkItems:[{trade:"직원",plannedWorkforce:7,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"},{trade:"T/C 조종사",plannedWorkforce:1,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"}]});
 assert.ok(compareDailyConstructionContent(staffSeven,withCrane).changes.some(change=>change.type==="공종 추가"&&change.after.trade==="T/C 조종사"));
 assert.ok(compareDailyConstructionContent(withCrane,staffEight).changes.some(change=>change.type==="공종 삭제"&&change.before.trade==="T/C 조종사"));
});

test("v0.17.6 does not infer fallback trades from an aggregate total",()=>{
 const aggregateOnly={siteId:"site-1",todayWorkforceTotal:8,trades:[],plannedWorkItems:[]};
 const uploaded=canonicalDailyContent("site-1",{todayWorkforceTotal:8,employeeWorkforce:7,tradeWorkforceTotal:1,plannedWorkItems:[{trade:"직원",plannedWorkforce:7,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"},{trade:"T/C 조종사",plannedWorkforce:1,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"}]});
 const result=compareDailyConstructionContent(aggregateOnly,uploaded);
 assert.equal(result.changed,true);
 assert.equal(result.changes.every(change=>change.type==="확인 필요"),true);
 assert.equal(result.reviewItems.length,2);
});

test("v0.17.7 maps the actual D1 snake_case revision boundary without losing zero or workforce evidence",()=>{
 const snapshot={siteId:"site-1",workDate:"2026-07-17",trades:[{trade:"T/C 조종사",plannedWorkforce:1},{trade:"직원",plannedWorkforce:7}],plannedWorkItems:[]};
 const normalized=normalizeStoredConstructionRevision({revision:1,today_workforce_total:8,employee_workforce:7,trade_workforce_total:1,content_snapshot_json:JSON.stringify(snapshot)});
 assert.equal(normalized.revision,1);
 assert.equal(normalized.todayWorkforceTotal,8);
 assert.equal(normalized.employeeWorkforce,7);
 assert.equal(normalized.tradeWorkforceTotal,1);
 assert.equal(normalized.plannedWorkItems.length,0);
 assert.equal(normalized.trades.length,2);
 assert.equal(normalizeStoredConstructionRevision({employee_workforce:0,content_snapshot_json:"{}"}).employeeWorkforce,0);
});

test("v0.17.7 restores legacy fallbacks with explicit evidence and never duplicates an existing item",()=>{
 const restored=restoreLegacyFallbackItems({revision:1,comparisonVersion:null,employeeWorkforce:7,workforceRows:[{trade:"T/C 조종사",plannedWorkforce:1}],plannedWorkItems:[]});
 assert.deepEqual(restored.restoredItems.map(item=>[item.trade,item.plannedWorkforce]),[["T/C 조종사",1],["직원",7]]);
 assert.deepEqual(restored.evidence.map(item=>item.source).sort(),["employee_workforce","workforce_row"]);
 const existing=restoreLegacyFallbackItems({comparisonVersion:null,employeeWorkforce:7,plannedWorkItems:[{trade:"직원",plannedWorkforce:7,description:"노코멘트"}]});
 assert.equal(existing.plannedWorkItems.filter(item=>constructionTradeIdentity(item).canonicalTradeId==="STAFF").length,1);
});

test("v0.17.7 refreshes a stored pre-fix API preview against the actual July 17 D1 row shape",async()=>{
 const previousSnapshot={siteId:"site-1",workDate:"2026-07-17",trades:[{trade:"T/C 조종사",plannedWorkforce:1},{trade:"직원",plannedWorkforce:7}],plannedWorkItems:[]};
 const latest={id:"upload-1",revision:1,content_hash:"legacy-hash",content_snapshot_json:JSON.stringify(previousSnapshot),today_workforce_total:8,employee_workforce:7,trade_workforce_total:1};
 const uploadedBlock={siteId:"site-1",workDate:"2026-07-17",status:"PARSED_WITH_WARNINGS",trades:previousSnapshot.trades,todayWorkforceTotal:8,employeeWorkforce:7,tradeWorkforceTotal:1,plannedWorkItems:[{trade:"직원",plannedWorkforce:7,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"},{trade:"T/C 조종사",plannedWorkforce:1,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"}],warnings:[],workforceWarnings:[]};
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>latest})})}};
 const stale={analysis:{blocks:[uploadedBlock]},preview:{dates:[{workDate:"2026-07-17",comparisonStatus:"CHANGED",changes:[{type:"공종 추가"},{type:"공종 추가"}]}]}};
 const refreshed=await refreshStoredComparison(env,"site-1",stale);
 assert.equal(refreshed.preview.dates[0].comparisonStatus,"UNCHANGED");
 assert.deepEqual(refreshed.preview.dates[0].changes,[]);
 assert.equal(refreshed.preview.dates[0].existingRevision,1);
});

test("v0.17.7 returns review-required instead of a confirmed fallback addition without trade evidence",()=>{
 const before={siteId:"site-1",todayWorkforceTotal:8,plannedWorkItems:[],trades:[]};
 const after=canonicalDailyContent("site-1",{todayWorkforceTotal:8,employeeWorkforce:7,tradeWorkforceTotal:1,plannedWorkItems:[{trade:"T/C 조종사",plannedWorkforce:1,description:"노코멘트",isFallbackWorkItem:true,workDescriptionSource:"OUTPUT_WORKFORCE_FALLBACK"}]});
 const result=compareDailyConstructionContent(before,after);
 assert.equal(result.reviewItems.length,1);
 assert.equal(result.reviewItems[0].type,"확인 필요");
 assert.match(result.reviewItems[0].explanationKo,/공종명이 저장되지 않아/);
});

test("changed fields are limited to canonical business fields",()=>{
 const before=canonicalDailyContent("site-1",{workDate:"2026-07-01",weather:"맑음",plannedWorkRaw:["벽체 설치"]});
 const after=canonicalDailyContent("site-1",{workDate:"2026-07-01",weather:"비",plannedWorkRaw:["벽체 설치"]});
 assert.deepEqual(contentDiff(before,after).map(item=>item.field),["날씨"]);
});

test("explicit rest day is valid while a truly blank daily block is guarded",()=>{
 assert.equal(isExplicitRestDay({plannedWorkRaw:["현장 휴무"]}),true);
 assert.equal(isBlankDailyBlock({plannedWorkItems:[],plannedWorkRaw:[],trades:[],remarks:null}),true);
 assert.equal(isBlankDailyBlock({plannedWorkItems:[],plannedWorkRaw:["현장 휴무"],trades:[],remarks:null}),false);
});

test("v0.16 comparison contract stores hashes and separates automatic and approved revisions",()=>{
 const worker=read("worker/modules/construction.js"),migration=read("database/migrations/0020_construction_daily_content_hash.sql"),ui=read("apps/web/assets/construction.js");
 for(const token of ["comparisonStatus","latestConfirmedContentHash","AUTO_NEW","CONFIRM_CHANGED","CONSTRUCTION_UPLOAD_COMPARISON_STALE","statusCounts","legacyWorkbookCache","content_hash IS NULL"])assert.ok(worker.includes(token),token);
 for(const token of ["content_hash","content_snapshot_json","construction_daily_report_upload_actions","UNIQUE(session_id, idempotency_key)"])assert.ok(migration.includes(token),token);
 for(const token of ["NEW:\"신규\"","UNCHANGED:\"동일\"","CHANGED:\"변경\"","WARNING:\"확인 필요\"","INVALID:\"분석 불가\"","FUTURE:\"미래 날짜\"","최근 월간 업로드"])assert.ok(ui.includes(token),token);
});

test("v0.19.4 confirmation UI classifies and partitions only selectable dates",()=>{
 assert.deepEqual(confirmationAvailability("NEW"),{selectable:true,label:"확정 가능"});
 assert.deepEqual(confirmationAvailability("CHANGED"),{selectable:true,label:"확인 후 확정 권장"});
 for(const status of ["UNCHANGED","REVIEW_REQUIRED","WARNING","INVALID","FUTURE"])assert.deepEqual(confirmationAvailability(status),{selectable:false,label:"확정 불가"});
 assert.deepEqual(partitionConfirmationDates([
  {workDate:"2026-07-01",comparisonStatus:"NEW"},
  {workDate:"2026-07-02",comparisonStatus:"CHANGED"},
  {workDate:"2026-07-03",comparisonStatus:"UNCHANGED"}
 ]),{newDates:["2026-07-01"],changedDates:["2026-07-02"]});
});

test("v0.19.5 common preview renders editable existing sessions and hides actions for view-only users",()=>{
 const dates=["NEW","CHANGED","UNCHANGED","REVIEW_REQUIRED","WARNING","INVALID","FUTURE"].map((comparisonStatus,index)=>({workDate:`2026-07-${String(index+1).padStart(2,"0")}`,comparisonStatus,existingRevision:comparisonStatus==="UNCHANGED"?1:0,workCount:1,tradeCount:1,totalWorkforce:1,warningCount:0,items:[]}));
 const preview={dates,counts:{NEW:1,CHANGED:1,UNCHANGED:1,REVIEW_REQUIRED:1,WARNING:1,INVALID:1,FUTURE:1}};
 const editable=confirmationPreviewHtml({preview,editable:true,title:"기존 세션 날짜별 내용"});
 assert.match(editable,/전체 선택/);
 assert.match(editable,/전체 해제/);
 assert.match(editable,/선택 날짜 확정/);
 assert.equal((editable.match(/data-confirm-date=/g)||[]).length,7);
 assert.match(editable,/data-confirm-date="2026-07-01"[^>]*aria-label/);
 assert.match(editable,/data-confirm-date="2026-07-03"[^>]*disabled/);
 assert.match(editable,/Revision 1 · 확정됨 · 출처 확정 공사일보/);
 const readOnly=confirmationPreviewHtml({preview,editable:false,title:"기존 세션 날짜별 내용"});
 assert.doesNotMatch(readOnly,/data-confirm-date=|data-confirm-selected-dates|전체 선택|전체 해제/);
 assert.match(readOnly,/작업 원문 확인/);
});

test("v0.19.5 common submitter separates NEW and CHANGED and preserves partial failure",async()=>{
 const calls=[],keys=["key-new","key-changed"];
 const request=async(path,options)=>{
  calls.push({path,options,body:JSON.parse(options.body)});
  if(calls.length===1)return {results:[{workDate:"2026-07-30",revision:1}]};
  throw Object.assign(new Error("stale"),{code:"CONSTRUCTION_UPLOAD_COMPARISON_STALE"});
 };
 const outcome=await submitConfirmationGroups({
  sessionId:"existing-session",
  rows:[{workDate:"2026-07-30",comparisonStatus:"NEW"},{workDate:"2026-07-31",comparisonStatus:"CHANGED"}],
  request,keyFactory:()=>keys.shift()
 });
 assert.deepEqual(calls.map(call=>call.path),["/daily-report-upload-sessions/existing-session/confirm","/daily-report-upload-sessions/existing-session/confirm"]);
 assert.deepEqual(calls.map(call=>call.body),[{action:"AUTO_NEW",dates:["2026-07-30"]},{action:"CONFIRM_CHANGED",dates:["2026-07-31"]}]);
 assert.deepEqual(calls.map(call=>call.options.headers["idempotency-key"]),["key-new","key-changed"]);
 assert.deepEqual(outcome.results,[{workDate:"2026-07-30",revision:1}]);
 assert.deepEqual(outcome.failures.map(item=>item.dates),[["2026-07-31"]]);
});

test("v0.19.5 confirmation execution guard blocks a concurrent duplicate click",async()=>{
 const execute=singleConfirmationExecution();
 let calls=0,release;
 const pending=new Promise(resolve=>{release=resolve});
 const first=execute(async()=>{calls++;await pending});
 const duplicate=await execute(async()=>{calls++});
 assert.equal(duplicate,false);
 assert.equal(calls,1);
 release();
 assert.equal(await first,true);
 assert.equal(await execute(async()=>{calls++}),true);
 assert.equal(calls,2);
});

test("v0.19.7 confirmation UI shows individual actions only for NEW and CHANGED dates",()=>{
 const dates=["NEW","CHANGED","UNCHANGED","REVIEW_REQUIRED","WARNING","INVALID","FUTURE"].map((comparisonStatus,index)=>({workDate:`2026-07-${String(index+1).padStart(2,"0")}`,comparisonStatus,workCount:1,tradeCount:1,totalWorkforce:1,warningCount:0,items:[]}));
 const html=confirmationPreviewHtml({preview:{dates,counts:{}},editable:true,title:"날짜 확정"});
 assert.equal((html.match(/data-confirm-one-date=/g)||[]).length,2);
 assert.match(html,/data-confirm-one-date="2026-07-01"[^>]*aria-label="2026년 7월 1일 확정"/);
 assert.match(html,/data-confirm-one-date="2026-07-02"/);
 assert.doesNotMatch(confirmationPreviewHtml({preview:{dates,counts:{}},editable:false,title:"날짜 확정"}),/data-confirm-one-date=/);
 assert.match(html,/data-selected-date-count[^>]*>선택 0일</);
});

test("v0.19.7 checkbox change event updates selected count and bulk availability",()=>{
 const listeners={},input={checked:false,dataset:{confirmDate:"2026-07-01"},addEventListener:(name,listener)=>{listeners[name]=listener}},count={textContent:""},button={disabled:true};
 const container={
  querySelectorAll:selector=>selector.startsWith("[data-confirm-date]")?[input]:[],
  querySelector:selector=>selector==="[data-selected-date-count]"?count:selector==="[data-confirm-selected-dates]"?button:null
 };
 assert.equal(bindConfirmationSelectionChanges(container),0);
 input.checked=true;listeners.change();
 assert.equal(count.textContent,"선택 1일");
 assert.equal(button.disabled,false);
 input.checked=false;listeners.change();
 assert.equal(count.textContent,"선택 0일");
 assert.equal(button.disabled,true);
});

test("v0.19.7 view state restores selections details and scroll without a jump",()=>{
 const inputA={checked:true,dataset:{confirmDate:"2026-07-01"}},inputB={checked:false,dataset:{confirmDate:"2026-07-02"}};
 const detailA={open:true,dataset:{confirmDetail:"date-list"}},detailB={open:false,dataset:{confirmDetail:"2026-07-02:source"}};
 const count={textContent:""},button={disabled:true},viewport={scrollY:684,scrollTo:options=>{viewport.restored=options}};
 const container={
  querySelectorAll:selector=>selector==="[data-confirm-date]:not(:disabled)"?[inputA,inputB]:selector==="details[data-confirm-detail][open]"?[detailA]:selector==="details[data-confirm-detail]"?[detailA,detailB]:[],
  querySelector:selector=>selector==="[data-selected-date-count]"?count:selector==="[data-confirm-selected-dates]"?button:null
 };
 const state=captureConfirmationViewState(container,viewport);
 inputA.checked=false;inputB.checked=true;detailA.open=false;detailB.open=true;viewport.scrollY=0;
 restoreConfirmationViewState(container,state,viewport);
 assert.deepEqual(state,{scrollY:684,checkedDates:["2026-07-01"],openDetails:["date-list"]});
 assert.equal(inputA.checked,true);
 assert.equal(inputB.checked,false);
 assert.equal(detailA.open,true);
 assert.equal(detailB.open,false);
 assert.deepEqual(viewport.restored,{top:684,left:0,behavior:"auto"});
});

test("v0.19.7 individual confirmation reuses the shared grouped submitter for one date",async()=>{
 const calls=[];
 const outcome=await submitConfirmationGroups({
  sessionId:"session-one",
  rows:[{workDate:"2026-07-31",comparisonStatus:"CHANGED"}],
  request:async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return {results:[{workDate:"2026-07-31",revision:2}]}},
  keyFactory:()=>"individual-key"
 });
 assert.deepEqual(calls,[{path:"/daily-report-upload-sessions/session-one/confirm",body:{action:"CONFIRM_CHANGED",dates:["2026-07-31"]}}]);
 assert.deepEqual(outcome,{results:[{workDate:"2026-07-31",revision:2}],failures:[]});
});

test("v0.19.7 individual button click dispatches exactly its date row",()=>{
 let listener,received;
 const button={dataset:{confirmOneDate:"2026-07-30"},addEventListener:(name,callback)=>{assert.equal(name,"click");listener=callback}};
 const container={querySelectorAll:selector=>selector==="[data-confirm-one-date]"?[button]:[]};
 const preview={dates:[{workDate:"2026-07-29",comparisonStatus:"NEW"},{workDate:"2026-07-30",comparisonStatus:"CHANGED"}]};
 bindIndividualConfirmationButtons(container,preview,rows=>{received=rows});
 listener();
 assert.deepEqual(received,[{workDate:"2026-07-30",comparisonStatus:"CHANGED"}]);
});

test("v0.19.7 sticky toolbar stays below desktop and mobile shell headers",()=>{
 const css=read("apps/web/assets/construction.css");
 assert.match(css,/\.construction-confirm-controls\{[^}]*position:sticky[^}]*top:calc\(var\(--header-height\) \+ 8px\)[^}]*z-index:4[^}]*background:#fff/);
 assert.match(css,/\.construction-confirm-controls\{top:80px;display:grid;grid-template-columns:1fr;padding:10px\}/);
 assert.match(css,/construction-confirm-controls__actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("v0.19.5 existing-session API exposes status and reuses the existing revision actions",()=>{
 const worker=read("worker/modules/construction.js");
 assert.ok(worker.includes("SELECT id,status,original_file_name,analysis_json"));
 assert.ok(worker.includes("status:row.status"));
 assert.ok(worker.includes('date.comparisonStatus==="NEW"&&(!requestedDates.length||requestedDates.includes(date.workDate))'));
 assert.ok(worker.includes("Number(latest?.revision||0)+1"));
 assert.ok(worker.includes("SET status='SUPERSEDED'"));
});

test("v0.19.5 existing analyzed sessions create Revision 1 then supersede it with Revision 2",async()=>{
 const db=testDatabase();
 db.exec(`INSERT INTO companies(id,name,status) VALUES('company-1','현장회사','ACTIVE');
  INSERT INTO sites(id,company_id,name,status) VALUES('site-1','company-1','현장 1','ACTIVE');
  INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES('user-1','01000000000','관리자','hash','salt',1,'ACTIVE');`);
 const env={DB:d1(db)},auth={siteId:"site-1",userId:"user-1"};
 const insertSession=(id,analysis)=>{
  const stored=constructionAnalysisStoragePayload(analysis,{templateCode:analysis.templateCode,blockCount:analysis.blockCount,counts:{NEW:analysis.blockCount},companyBreakdownAvailable:false,warning:"회사별 인원 정보가 원본 공사일보에 없습니다."});
  db.prepare(`INSERT INTO construction_daily_report_upload_sessions(id,site_id,user_id,original_file_name,mime_type,size_bytes,sha256_hex,r2_key,status,analysis_json,expires_at)
   VALUES(?1,'site-1','user-1','월간공사일보.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',100,?2,?3,'ANALYZED',?4,'2099-01-01')`).run(id,"a".repeat(64),`sites/site-1/${id}.xlsx`,JSON.stringify(stored));
 };
 const request=(action,dates,key)=>new Request("https://example.test/api/v1/construction/daily-report-upload-sessions/session/confirm",{method:"POST",headers:{"content-type":"application/json","idempotency-key":key,"x-request-id":key},body:JSON.stringify({action,dates})});
 const todayWorkDate=currentKstWorkDate(),firstAnalysis=analyzeUrbanTreeWorkbook(workbookFixture());
 firstAnalysis.blocks[0].workDate=todayWorkDate;
 insertSession("session-1",firstAnalysis);
 const first=await applyComparedDates(request("AUTO_NEW",[todayWorkDate],"confirm-new"),env,auth,"session-1");
 assert.equal(first.status,200);
 assert.equal((await first.json()).results[0].revision,1);
 let active=db.prepare("SELECT id,revision,status,parse_status FROM construction_daily_report_uploads WHERE site_id='site-1' AND work_date_kst=?1").get(todayWorkDate);
 assert.deepEqual({revision:active.revision,status:active.status,parseStatus:active.parse_status},{revision:1,status:"ACTIVE",parseStatus:"CONFIRMED"});
 assert.ok(db.prepare("SELECT COUNT(*) count FROM construction_daily_report_imported_items WHERE upload_id=?1").get(active.id).count>0);
 const changedAnalysis=structuredClone(firstAnalysis);
 changedAnalysis.blocks[0].plannedWorkItems[0].description="101동 3층 벽체 거푸집 변경 설치";
 insertSession("session-2",changedAnalysis);
 const second=await applyComparedDates(request("CONFIRM_CHANGED",[todayWorkDate],"confirm-changed"),env,auth,"session-2");
 assert.equal((await second.json()).results[0].revision,2);
 const revisions=db.prepare("SELECT revision,status,parse_status FROM construction_daily_report_uploads WHERE site_id='site-1' AND work_date_kst=?1 ORDER BY revision").all(todayWorkDate).map(row=>({...row}));
 assert.deepEqual(revisions,[{revision:1,status:"SUPERSEDED",parse_status:"CONFIRMED"},{revision:2,status:"ACTIVE",parse_status:"CONFIRMED"}]);
 const latestActive=db.prepare("SELECT id FROM construction_daily_report_uploads WHERE site_id='site-1' AND work_date_kst=?1 AND status='ACTIVE'").get(todayWorkDate);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action IN ('CONSTRUCTION_MONTHLY_NEW_AUTO_APPLIED','CONSTRUCTION_MONTHLY_CHANGED_CONFIRMED')").get().count,2);
 const today=await constructionProvider({env,ctx:{boardAccess:{CONSTRUCTION_DAILY_REPORT:{accessLevel:"EDIT"}}},scope:{siteId:"site-1"}});
 assert.equal(today.schedule.today.source,"CONFIRMED_DAILY_REPORT");
 assert.equal(today.schedule.today.entries[0].sourceContext.sourceType,"CONSTRUCTION_DAILY_REPORT");
 assert.equal(today.schedule.today.entries[0].sourceContext.sourceId,latestActive.id);
 assert.equal(today.schedule.today.entries[0].sourceContext.sourceRevision,2);
 assert.ok(today.schedule.today.entries[0].sourceContext.sourceItemRefs.every(ref=>ref.itemId&&!ref.itemId.startsWith("construction-work-")));
 assert.match(today.schedule.today.notice,/확정 공사일보 기준/);
 db.close();
});

test("v0.19.6 confirms one date from a 31-day legacy analysis and keeps the other dates available",async()=>{
 const db=testDatabase();
 db.exec(`INSERT INTO companies(id,name,status) VALUES('company-1','현장회사','ACTIVE');
  INSERT INTO sites(id,company_id,name,status) VALUES('site-1','company-1','현장 1','ACTIVE');
  INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES('user-1','01000000000','관리자','hash','salt',1,'ACTIVE');`);
 const analysis=largeMonthlyAnalysis(),stored=constructionAnalysisStoragePayload(analysis,{templateCode:analysis.templateCode,blockCount:31,counts:{NEW:31},companyBreakdownAvailable:false,warning:"회사별 인원 정보가 원본 공사일보에 없습니다."}),sessionJson=JSON.stringify(stored);
 db.prepare(`INSERT INTO construction_daily_report_upload_sessions(id,site_id,user_id,original_file_name,mime_type,size_bytes,sha256_hex,r2_key,status,analysis_json,expires_at)
  VALUES('single-large','site-1','user-1','7월 월간공사일보.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',100,?1,'sites/site-1/single-large.xlsx','ANALYZED',?2,'2099-01-01')`).run("d".repeat(64),sessionJson);
 const env={DB:d1(db,{maxStringBytes:2_000_000})},auth={siteId:"site-1",userId:"user-1"},request=new Request("https://example.test/api",{method:"POST",headers:{"content-type":"application/json","idempotency-key":"single-july","x-request-id":"single-july"},body:JSON.stringify({action:"AUTO_NEW",dates:["2026-07-31"]})});
 const body=await (await applyComparedDates(request,env,auth,"single-large")).json();
 assert.deepEqual(body.results.map(result=>({workDate:result.workDate,revision:result.revision})),[{workDate:"2026-07-31",revision:1}]);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_daily_report_imported_items").get().count,12);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_NEW_AUTO_APPLIED'").get().count,1);
 assert.equal(db.prepare("SELECT analysis_json FROM construction_daily_report_upload_sessions WHERE id='single-large'").get().analysis_json,sessionJson);
 const reopened=await refreshStoredComparison(env,"site-1",JSON.parse(sessionJson));
 assert.equal(reopened.preview.dates.find(date=>date.workDate==="2026-07-31").comparisonStatus,"UNCHANGED");
 assert.equal(reopened.preview.dates.filter(date=>date.comparisonStatus==="NEW").length,30);
 db.close();
});

test("v0.19.6 confirms all 31 dates without rebinding the oversized refreshed session JSON",async()=>{
 const db=testDatabase();
 db.exec(`INSERT INTO companies(id,name,status) VALUES('company-1','현장회사','ACTIVE');
  INSERT INTO sites(id,company_id,name,status) VALUES('site-1','company-1','현장 1','ACTIVE');
  INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES('user-1','01000000000','관리자','hash','salt',1,'ACTIVE');`);
 const analysis=largeMonthlyAnalysis(),stored=constructionAnalysisStoragePayload(analysis,{templateCode:analysis.templateCode,blockCount:31,counts:{NEW:31},companyBreakdownAvailable:false,warning:"회사별 인원 정보가 원본 공사일보에 없습니다."}),sessionJson=JSON.stringify(stored);
 db.prepare(`INSERT INTO construction_daily_report_upload_sessions(id,site_id,user_id,original_file_name,mime_type,size_bytes,sha256_hex,r2_key,status,analysis_json,expires_at)
  VALUES('large-session','site-1','user-1','7월 월간공사일보.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',100,?1,'sites/site-1/large.xlsx','ANALYZED',?2,'2099-01-01')`).run("b".repeat(64),sessionJson);
 const env={DB:d1(db,{maxStringBytes:2_000_000})},auth={siteId:"site-1",userId:"user-1"};
 const refreshed=await refreshStoredComparison(env,"site-1",stored),eligible=refreshed.preview.dates.filter(date=>date.comparisonStatus==="NEW");
 const diagnostic=constructionConfirmDiagnostic({sessionAnalysisJson:sessionJson,stored:refreshed,dates:eligible,response:{ok:true,results:eligible.map(date=>({workDate:date.workDate,revision:1}))},auditMetadata:eligible.map(date=>({workDate:date.workDate,revision:1})),batchStatementCount:eligible.reduce((sum,date)=>sum+3+(date.items||[]).length,3)});
 assert.ok(diagnostic.sessionAnalysisJsonBytes<2_000_000,diagnostic);
 assert.ok(diagnostic.refreshedStoredJsonBytes>=2_000_000,diagnostic);
 assert.ok(diagnostic.maxPersistedJsonBindingBytes<2_000_000,diagnostic);
 assert.equal(diagnostic.dateCount,31);
 assert.equal(diagnostic.itemCount,372);
 const dates=analysis.blocks.map(block=>block.workDate),request=new Request("https://example.test/api",{method:"POST",headers:{"content-type":"application/json","idempotency-key":"all-july","x-request-id":"all-july"},body:JSON.stringify({action:"AUTO_NEW",dates})});
 const response=await applyComparedDates(request,env,auth,"large-session"),body=await response.json();
 assert.equal(body.results.length,31);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_daily_report_uploads WHERE status='ACTIVE' AND parse_status='CONFIRMED'").get().count,31);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_daily_report_imported_items").get().count,372);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_daily_report_upload_actions").get().count,1);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_NEW_AUTO_APPLIED'").get().count,31);
 const session=db.prepare("SELECT status,analysis_json FROM construction_daily_report_upload_sessions WHERE id='large-session'").get();
 assert.equal(session.status,"CONFIRMED");
 assert.equal(session.analysis_json,sessionJson);
 const reopened=await refreshStoredComparison(env,"site-1",JSON.parse(session.analysis_json));
 assert.ok(reopened.preview.dates.every(date=>date.comparisonStatus==="UNCHANGED"&&date.existingRevision===1));
 db.prepare("UPDATE construction_daily_report_uploads SET work_date_kst=?1 WHERE work_date_kst=(SELECT MAX(work_date_kst) FROM construction_daily_report_uploads)").run(currentKstWorkDate());
 const today=await constructionProvider({env,ctx:{boardAccess:{CONSTRUCTION_DAILY_REPORT:{accessLevel:"EDIT"}}},scope:{siteId:"site-1"}});
 assert.equal(today.schedule.today.source,"CONFIRMED_DAILY_REPORT");
 db.close();
});

test("v0.19.6 rolls back a changed date when an imported item statement fails",async()=>{
 const db=testDatabase();
 db.exec(`INSERT INTO companies(id,name,status) VALUES('company-1','현장회사','ACTIVE');
  INSERT INTO sites(id,company_id,name,status) VALUES('site-1','company-1','현장 1','ACTIVE');
  INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES('user-1','01000000000','관리자','hash','salt',1,'ACTIVE');`);
 const auth={siteId:"site-1",userId:"user-1"},insertSession=(id,analysis)=>{
  const stored=constructionAnalysisStoragePayload(analysis,{templateCode:analysis.templateCode,blockCount:analysis.blockCount,counts:{NEW:analysis.blockCount},companyBreakdownAvailable:false,warning:""});
  db.prepare(`INSERT INTO construction_daily_report_upload_sessions(id,site_id,user_id,original_file_name,mime_type,size_bytes,sha256_hex,r2_key,status,analysis_json,expires_at)
   VALUES(?1,'site-1','user-1','월간.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',100,?2,?3,'ANALYZED',?4,'2099-01-01')`).run(id,"c".repeat(64),`sites/site-1/${id}.xlsx`,JSON.stringify(stored));
 },makeRequest=(action,key)=>new Request("https://example.test/api",{method:"POST",headers:{"content-type":"application/json","idempotency-key":key,"x-request-id":key},body:JSON.stringify({action,dates:["2026-07-31"]})});
 const first=analyzeUrbanTreeWorkbook(workbookFixture());first.blocks[0].workDate="2026-07-31";insertSession("rollback-1",first);
 await applyComparedDates(makeRequest("AUTO_NEW","rollback-new"),{DB:d1(db)},auth,"rollback-1");
 const changed=structuredClone(first);changed.blocks[0].plannedWorkItems[0].description="실패 검증 변경 작업";insertSession("rollback-2",changed);
 const failingEnv={DB:d1(db,{failStatement:sql=>sql.includes("INSERT INTO construction_daily_report_imported_items")})},originalError=console.error;console.error=()=>{};
 try{await assert.rejects(()=>applyComparedDates(makeRequest("CONFIRM_CHANGED","rollback-changed"),failingEnv,auth,"rollback-2"),error=>error.code==="CONSTRUCTION_CONFIRM_SAVE_FAILED"&&error.message.includes("선택한 날짜는 확정되지 않았습니다."))}
 finally{console.error=originalError}
 const revisions=db.prepare("SELECT revision,status FROM construction_daily_report_uploads WHERE work_date_kst='2026-07-31' ORDER BY revision").all().map(row=>({...row}));
 assert.deepEqual(revisions,[{revision:1,status:"ACTIVE"}]);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_daily_report_imported_items").get().count,1);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_daily_report_upload_actions").get().count,1);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_CHANGED_CONFIRMED'").get().count,0);
 assert.equal(db.prepare("SELECT status FROM construction_daily_report_upload_sessions WHERE id='rollback-2'").get().status,"ANALYZED");
 db.close();
});

test("v0.18.3 Construction reset generates and executes only verified Remote D1 SQL files",()=>{
 const script=read("scripts/reset-construction-test-data.mjs"),pkg=JSON.parse(read("package.json"));
 for(const token of ["--execute",CONFIRMATION,FINAL_CONFIRMATION,"--target=integration","Production에서는","construction_daily_report_imported_items","construction_daily_report_upload_actions","construction-reset-backups","d1-backup.json","r2-keys.json","reset-result.json","restore.sql","auditRemoteSql","출력일보","초기화 실패","부분 복구 실패"])assert.ok(script.includes(token),token);
 assert.match(script,/DELETE FROM construction_daily_report_uploads/);
 assert.match(script,/DELETE FROM construction_daily_report_upload_sessions/);
 const sql=deletionSql("site-1");
 assert.doesNotMatch(sql,/construction_output_sheet_(?:documents|media)/);
 assert.doesNotMatch(sql,/\b(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i);
 for(const table of ["construction_daily_report_imported_items","construction_daily_report_upload_actions","construction_daily_report_upload_sessions","construction_daily_report_uploads"])assert.match(sql,new RegExp(`DELETE FROM ${table}`));
 const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),"guis-arc-reset-sql-test-")),sqlFile=path.join(tempDir,"delete.sql");
 const audit=writeVerifiedRemoteSql(sqlFile,sql,"deletionSql");
 assert.equal(audit.forbiddenTokens.length,0);
 assert.equal(audit.deleteCount,4);
 assert.deepEqual(audit.tables,["construction_daily_report_imported_items","construction_daily_report_upload_actions","construction_daily_report_upload_sessions","construction_daily_report_uploads"]);
 let executedFile=null;
 executeVerifiedRemoteSql(sqlFile,audit,file=>{executedFile=file;});
 assert.equal(executedFile,sqlFile);
 for(const token of ["BEGIN","SAVEPOINT","COMMIT"]){
  fs.writeFileSync(sqlFile,`${sql}\n${token};`);
  let called=false;
  assert.throws(()=>executeVerifiedRemoteSql(sqlFile,audit,()=>{called=true;}),/허용되지 않는 트랜잭션 명령/);
  assert.equal(called,false);
 }
 fs.rmSync(tempDir,{recursive:true,force:true});
 assert.equal(parseResetArguments(["--target=integration"]).dryRun,true);
 assert.throws(()=>parseResetArguments([]),/target/);
 assert.throws(()=>parseResetArguments(["--execute","--target=integration"]),/confirm/);
 assert.throws(()=>parseResetArguments(["--execute",`--confirm=${CONFIRMATION}`,"--target=integration"]),/site/);
 assert.throws(()=>parseResetArguments(["--execute",`--confirm=${CONFIRMATION}`,"--target=production"]),/Production/);
 assert.deepEqual(validateConstructionKeys("site-1",["sites/site-1/construction/a.xlsx","sites/site-1/construction/a.xlsx"]),["sites/site-1/construction/a.xlsx"]);
 assert.throws(()=>validateConstructionKeys("site-1",["sites/site-1/issues/photo.jpg"]),/범위 밖/);
 assert.throws(()=>validateConstructionKeys("site-1",[""]),/빈 R2/);
 assert.throws(()=>validateConstructionKeys("site-1",["sites/site-1/construction/../issues/a"]),/비정상/);
 assert.throws(()=>validateConstructionKeys("site-1",["sites/site-1/construction-reset-backups/run/a"]),/범위 밖|백업/);
 assert.equal(isFinalConfirmation(FINAL_CONFIRMATION),true);
 assert.equal(isFinalConfirmation(` ${FINAL_CONFIRMATION}`),false);
 assert.throws(()=>assertInteractiveExecution({execute:true,stdin:{isTTY:false},env:{}}),/비대화형/);
 assert.throws(()=>assertInteractiveExecution({execute:true,stdin:{isTTY:true},env:{CI:"true"}}),/CI/);
 const output=[];
 printResetPlan({siteId:"site-1",before:{uploads:1,sessions:1,revisions:1,items:2,actions:0,previews:1,first_date:"2026-07-01",last_date:"2026-07-02",retained_users:18,retained_companies:8,retained_sites:3},keys:["sites/site-1/construction/a.xlsx"],plan:{d1Json:"d1-backup.json",deleteSql:"delete.sql",restoreSql:"restore.sql",r2Prefix:"sites/site-1/construction-reset-backups/run/",r2KeysJson:"r2-keys.json",reportJson:"reset-result.json"},sqlAudit:auditRemoteSql(sql),dryRun:true,write:value=>output.push(value)});
 const report=output.join("\n");
 for(const token of ["[실행 대상]","[삭제 대상 현황]","[삭제 후 예상 상태]","[유지 대상]","[R2 삭제 대상]","[백업 계획]","[Remote D1 삭제 SQL 감사]","금지 transaction 토큰:","0건","2026-07-01","2026-07-02","공사일보를 한 번도 업로드하지 않은 최초 상태","Dry Run에서는 백업 경로만 계획"])assert.ok(report.includes(token),token);
 assert.equal(pkg.scripts["admin:reset-construction-test-data"],"node scripts/reset-construction-test-data.mjs");
});

test("construction engine starts from an empty official revision set",async()=>{
 const revisions=new Map();
 const first=canonicalDailyContent("site-1",{workDate:"2026-07-17",plannedWorkItems:[{trade:"직원",plannedWorkforce:3,description:"현장 관리"}]});
 assert.equal(revisions.has(first.workDate),false);
 revisions.set(first.workDate,{revision:1,hash:await canonicalContentHash(first),snapshot:first});
 assert.equal(revisions.get(first.workDate).revision,1);
 assert.equal(await canonicalContentHash(first),revisions.get(first.workDate).hash);
 const changed=canonicalDailyContent("site-1",{workDate:"2026-07-17",plannedWorkItems:[{trade:"직원",plannedWorkforce:3,description:"안전 점검"}]});
 assert.equal(compareDailyConstructionContent(first,changed).changed,true);
});

test("trade aliases match electric communication workforce without a fallback duplicate",()=>{
 const result=reconcileWorkforceTrades([{trade:"전기통신설비공",plannedWorkforce:5}],[{trade:"전기통신공",description:"세대 배관 및 통신 배선 작업"}]);
 assert.equal(result.plannedWorkItems.length,1);
 assert.equal(result.plannedWorkItems[0].plannedWorkforce,5);
 assert.equal(result.plannedWorkItems[0].tradeMatch.matchType,"CONFIRMED_ALIAS");
 assert.equal(result.plannedWorkItems[0].isFallbackWorkItem,false);
});

test("one generic equipment keyword never cross-matches mechanical and electrical trades",()=>{
 const match=matchTradeNames("기계설비공","전기설비공");
 assert.equal(match.matched,false);
 assert.equal(match.matchType,"CONFLICT");
});

test("v0.17 site trade normalization preserves raw text and parses composite evidence",()=>{
 assert.equal(normalizeTradeName(" ▸ 전기 통신공 "),"전기통신공");
 const composite=parseCompositeTrade("▶ 기계설비공(배관-7, 환기-2, 덕트-7)");
 assert.equal(composite.baseTradeRaw,"기계설비공");
 assert.deepEqual(composite.detailTokens.map(item=>[item.nameRaw,item.numberRaw]),[["배관","7"],["환기","2"],["덕트","7"]]);
 assert.equal(resolveCanonicalTrade("내장공").canonicalTradeId,"INTERIOR_CARPENTRY");
});

test("v0.17.1 official site trade data validates once with explicit fields",()=>{
 assert.equal(validateSiteTradeData(),true);
 assert.ok(SITE_TRADE_DICTIONARY.every(trade=>trade.canonicalTradeId&&trade.displayNameKo&&trade.category&&trade.scope==="SITE"&&Array.isArray(trade.aliases)&&Array.isArray(trade.keywords)));
 assert.ok(SITE_TRADE_DICTIONARY.flatMap(trade=>trade.aliases).every(alias=>alias.value&&["CONFIRMED","REGISTERED","REVIEW_REQUIRED"].includes(alias.status)));
});

test("v0.17.1 alias status controls automatic matching eligibility",()=>{
 assert.equal(isAutoMatchAlias({status:"CONFIRMED"}),true);
 assert.equal(isAutoMatchAlias({status:"REGISTERED"}),true);
 assert.equal(isAutoMatchAlias({status:"REVIEW_REQUIRED"}),false);
});

test("v0.17.1 site trade validation rejects invalid IDs aliases and conflicts",()=>{
 const clone=()=>structuredClone(SITE_TRADE_DICTIONARY);
 const duplicateId=clone();duplicateId.push(structuredClone(duplicateId[0]));
 assert.throws(()=>validateSiteTradeData(duplicateId,SITE_TRADE_CONFLICTS),/표준 공종 ID/);
 const duplicateAlias=clone();duplicateAlias[1].aliases.push({value:duplicateAlias[0].aliases[0].value,status:"REGISTERED"});
 assert.throws(()=>validateSiteTradeData(duplicateAlias,SITE_TRADE_CONFLICTS),/정규화 별칭/);
 const emptyAlias=clone();emptyAlias[0].aliases.push({value:" ",status:"REGISTERED"});
 assert.throws(()=>validateSiteTradeData(emptyAlias,SITE_TRADE_CONFLICTS),/값이 비어/);
 const invalidStatus=clone();invalidStatus[0].aliases[0].status="UNKNOWN";
 assert.throws(()=>validateSiteTradeData(invalidStatus,SITE_TRADE_CONFLICTS),/허용되지/);
 assert.throws(()=>validateSiteTradeData(clone(),[...SITE_TRADE_CONFLICTS,{leftCanonicalTradeId:"STAFF",rightCanonicalTradeId:"STAFF",reasonKo:"자기 충돌",scope:"SITE"}]),/자기 자신/);
 assert.throws(()=>validateSiteTradeData(clone(),[...SITE_TRADE_CONFLICTS,structuredClone(SITE_TRADE_CONFLICTS[0])]),/중복/);
});

test("v0.17.1 matcher consumes conflict data without a new condition branch",()=>{
 const temporary={leftCanonicalTradeId:"REBAR",rightCanonicalTradeId:"MASONRY",reasonKo:"테스트용 충돌 관계입니다.",scope:"SITE"};
 SITE_TRADE_CONFLICTS.push(temporary);
 try{
  const match=matchTradeNames("철근공","조적공");
  assert.equal(match.matchType,"CONFLICT");
  assert.equal(match.matchReasonKo,temporary.reasonKo);
 }finally{SITE_TRADE_CONFLICTS.pop()}
});

test("v0.17 confirmed site aliases match only their canonical trade",()=>{
 const aliases=[
  ["전기통신설비공","전기통신공"],
  ["콘크리트공","콘크리공"],
  ["견출공","견출"],
  ["내장목공사","내장공"],
  ["난간대공","발코니 난간공"],
  ["도시가스공","도시가스"],
  ["목창호공","목호공"],
 ];
 for(const [output,work] of aliases){
  const match=matchTradeNames(output,work);
  assert.equal(match.matched,true,`${output} ↔ ${work}`);
  assert.equal(match.matchType,"CONFIRMED_ALIAS");
 }
});

test("v0.17 conflict pairs never auto match",()=>{
 for(const [output,work] of [["미장공","견출공"],["형틀공","내장공"],["직원","직영"],["T/C 조종사","철근공"],["기계설비공","전기설비공"]]){
  const match=matchTradeNames(output,work);
  assert.equal(match.matched,false,`${output} ↔ ${work}`);
  assert.equal(match.requiresReview,true);
 }
});

test("v0.17 composite parenthetical numbers are evidence and output workforce stays official",()=>{
 const result=reconcileWorkforceTrades(
  [{trade:"견출공",plannedWorkforce:5,sourceCellRange:"C10:G10"}],
  [{trade:"견출공(면처리-1, 할석-3)",description:"내벽 작업",rawText:"원문",sourceCellRange:"M10:M12"}],
 );
 const item=result.plannedWorkItems[0];
 assert.equal(item.plannedWorkforce,5);
 assert.equal(item.tradeMatch.matchType,"COMPOSITE_BASE");
 assert.equal(item.tradeMatch.sourceOutputCell,"C10:G10");
 assert.equal(item.tradeMatch.sourceWorkCell,"M10:M12");
 assert.ok(item.tradeMatch.evidence.some(value=>value.type==="PAREN_WORKFORCE_MISMATCH"));
 assert.ok(result.workforceWarnings.some(value=>value.code==="PAREN_WORKFORCE_MISMATCH"));
});

test("v0.17 global assignment uses each output row once and leaves an unresolved work item null",()=>{
 const result=reconcileWorkforceTrades(
  [{trade:"전기통신설비공",plannedWorkforce:4}],
  [{trade:"전기통신공",description:"입선"},{trade:"전기통신",description:"배관"}],
 );
 assert.deepEqual(result.plannedWorkItems.map(item=>item.plannedWorkforce),[4,null]);
 assert.equal(result.assignmentCount,1);
});

test("v0.17 Today aggregation does not turn missing workforce into zero",()=>{
 const [work]=aggregateMajorWorks([{work_description:"먹매김",trade_name_snapshot:"내장공",workforce_count:null}]);
 assert.equal(work.total,null);
 assert.equal(work.workforceRegistered,false);
});

test("unmatched output workforce becomes an explicit no-comment fallback",()=>{
 const result=reconcileWorkforceTrades([{trade:"방수공",plannedWorkforce:3}],[]);
 assert.deepEqual(result.plannedWorkItems.map(item=>[item.trade,item.description,item.plannedWorkforce,item.workDescriptionSource,item.isFallbackWorkItem]),[["방수공","노코멘트",3,"OUTPUT_WORKFORCE_FALLBACK",true]]);
});

test("work without an output workforce stays unregistered and borrows no other trade",()=>{
 const result=reconcileWorkforceTrades([{trade:"형틀공",plannedWorkforce:8}],[{trade:"조적공",description:"조적 작업"}]);
 const original=result.plannedWorkItems.find(item=>!item.isFallbackWorkItem);
 assert.equal(original.plannedWorkforce,null);
 assert.ok(result.workforceWarnings.some(item=>item.code==="WORK_WITHOUT_WORKFORCE"));
});

test("employee and trade rows produce the complete daily workforce total",()=>{
 const result=reconcileWorkforceTrades([
  {trade:"직원",plannedWorkforce:6},{trade:"형틀공",plannedWorkforce:20},{trade:"철근공",plannedWorkforce:15},{trade:"전기통신설비공",plannedWorkforce:5}
 ],[{trade:"형틀공",description:"형틀"},{trade:"철근공",description:"철근"},{trade:"전기통신공",description:"전기"}]);
 assert.equal(result.employeeWorkforce,6);
 assert.equal(result.tradeWorkforceTotal,40);
 assert.equal(result.todayWorkforceTotal,46);
});

test("source total is validation-only and mismatch keeps the calculated total",()=>{
 const matched=parseUrbanTreeWorkbook(workbookFixture(),"2026-07-01");
 assert.equal(matched.todayWorkforceTotal,5);
 assert.equal(matched.sourceTotalWorkforce,999);
 assert.equal(matched.workforceTotalMatchesSource,false);
 assert.ok(matched.warnings.some(item=>item.code==="WORKFORCE_TOTAL_MISMATCH"));
});

test("matching source total is recorded as verified without double-counting it",()=>{
 const result=parseUrbanTreeWorkbook(workbookFixture({sourceTotal:"5"}),"2026-07-01");
 assert.equal(result.todayWorkforceTotal,5);
 assert.equal(result.sourceTotalWorkforce,5);
 assert.equal(result.workforceTotalMatchesSource,true);
 assert.equal(result.totalWorkforce,5);
});

test("a trade workforce is applied once when one heading has several work descriptions",()=>{
 const result=reconcileWorkforceTrades([{trade:"형틀공",plannedWorkforce:20}],[{trade:"형틀공",description:"벽체"},{trade:"형틀공",description:"슬래브"}]);
 assert.deepEqual(result.plannedWorkItems.map(item=>item.plannedWorkforce),[20,null]);
 assert.equal(result.plannedWorkItems.reduce((sum,item)=>sum+(item.plannedWorkforce||0),0),20);
});

test("empty workforce and actual zero remain distinct without affecting totals",()=>{
 const result=reconcileWorkforceTrades([{trade:"형틀공",plannedWorkforce:null},{trade:"철근공",plannedWorkforce:0}],[]);
 assert.equal(result.todayWorkforceTotal,0);
 assert.equal(result.plannedWorkItems.length,1);
 assert.equal(result.plannedWorkItems[0].trade,"철근공");
 assert.equal(result.plannedWorkItems[0].plannedWorkforce,0);
});

test("v0.16.1 persists workforce matching provenance and exposes report totals in Today",()=>{
 const migration=read("database/migrations/0021_construction_workforce_matching.sql"),worker=read("worker/modules/construction.js"),provider=read("worker/modules/today/providers/construction-provider.js"),ui=read("apps/web/assets/today.js");
 for(const token of ["today_workforce_total","employee_workforce","trade_workforce_total","source_total_workforce","work_description_source","is_fallback_work_item","trade_match_json"])assert.ok(migration.includes(token),token);
 for(const token of ["workDescriptionSource","isFallbackWorkItem","tradeMatch"])assert.ok(worker.includes(token),token);
 for(const token of ["reconcileWorkforceTrades","todayWorkforceTotal","employeeWorkforce"])assert.ok(provider.includes(token),token);
 for(const token of ["금일 총 출력인원","공사일보 기준","노코멘트","예정 인원"])assert.ok(ui.includes(token),token);
});

test("construction UI exposes parser warnings and company-data absence without OCR claims",()=>{
 const constructionUi=read("apps/web/assets/construction.js"),todayUi=read("apps/web/assets/today.js"),menu=read("packages/permissions/modules.js"),worker=read("worker/modules/construction.js"),parser=read("worker/modules/construction/xlsx-parser.js");
 for(const token of ["엑셀 업로드·분석","공사일보를 분석하고 있습니다.","이 공사일보 확정","출력일보 보관함","사진 촬영","파일 선택","잘못 올린 자료 무효 처리"])assert.ok(constructionUi.includes(token),token);
 assert.ok(menu.includes('["출력일보 보관함","/construction/output-status"]'));
 assert.doesNotMatch(menu,/\["출력일보","\/workforce\/reports"\]/);
 assert.doesNotMatch(constructionUi,/OCR|AI 자동/);
 for(const token of ["CONSTRUCTION_XLSX_TYPE_INVALID","CONSTRUCTION_MONTHLY_DATE_CONFIRMED","CONSTRUCTION_OUTPUT_SHEET_INVALIDATED","analysis","preview"])assert.ok(worker.includes(token),token);
 for(const token of ["FORMULA_DATE_UNRESOLVED","WORK_TEXT_UNCERTAIN","COMPANY_BREAKDOWN_UNAVAILABLE"])assert.ok(parser.includes(token),token);
 assert.ok(todayUi.includes("회사별 인원 정보가 원본 공사일보에 없습니다."));
});
