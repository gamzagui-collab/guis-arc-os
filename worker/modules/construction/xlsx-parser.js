import {unzipSync,strFromU8} from "fflate";
import {reconcileWorkforceTrades} from "./trade-matcher.js";

const COMPANY_WARNING="회사별 인원 정보가 원본 공사일보에 없습니다.";
const REQUIRED_HEADERS=["공종","출력현황","전일작업사항","금일작업예정사항"];
const decode=value=>String(value??"").replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const textNodes=xml=>[...String(xml||"").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(match=>decode(match[1])).join("");
const compact=value=>String(value??"").replace(/\s+/g,"").trim();
const colNumber=letters=>[...letters].reduce((sum,ch)=>sum*26+ch.charCodeAt(0)-64,0);
const colLetters=number=>{let result="";for(let value=number;value>0;value=Math.floor((value-1)/26))result=String.fromCharCode((value-1)%26+65)+result;return result};
const warning=(code,message,source={})=>({code,message,...source});
const trace=(cell,normalizedValue,warningCode=null)=>({
 sourceSheetName:cell?.sheetName||null,
 sourceRow:cell?.row||null,
 sourceCellRange:cell?.address||null,
 rawValue:cell?.value??null,
 normalizedValue,
 warningCode
});
const isoDateFromSerial=value=>{
 const number=Number(value);
 if(!Number.isFinite(number)||number<=0)return null;
 return new Date(Date.UTC(1899,11,30)+Math.round(number)*86400000).toISOString().slice(0,10);
};
const isoDateFromText=value=>{
 const text=String(value??"").trim();
 const match=/^(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/.exec(text)||/^(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(text);
 if(!match)return null;
 const year=Number(match[1])<100?2000+Number(match[1]):Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):null;
};
const addDays=(iso,days)=>{
 const date=new Date(`${iso}T00:00:00Z`);
 if(Number.isNaN(date.getTime()))return null;
 date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,10);
};

function cellsFromSheet(xml,shared,sheetName){
 const cells=new Map(),byRow=new Map();
 for(const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
  const attrs=match[1],reference=/\br="([A-Z]+)(\d+)"/.exec(attrs);if(!reference)continue;
  const address=`${reference[1]}${reference[2]}`,body=match[2]||"",type=/\bt="([^"]+)"/.exec(attrs)?.[1];
  const raw=/<v>([\s\S]*?)<\/v>/.exec(body)?.[1]??"",inline=/<is>([\s\S]*?)<\/is>/.exec(body)?.[1];
  const value=type==="s"?shared[Number(raw)]??"":type==="inlineStr"?textNodes(inline):decode(raw);
  const cell={address,value,formula:decode(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(body)?.[1]||""),row:Number(reference[2]),col:colNumber(reference[1]),sheetName};
  cells.set(address,cell);
  if(!byRow.has(cell.row))byRow.set(cell.row,[]);
  byRow.get(cell.row).push(cell);
 }
 return {cells,byRow};
}

function numberValue(cell,warnings,field){
 const raw=String(cell?.value??"").trim();
 if(raw==="")return {value:null,trace:trace(cell,null)};
 const value=Number(raw.replace(/,/g,""));
 if(Number.isFinite(value))return {value,trace:trace(cell,value)};
 warnings.push(warning("WORKFORCE_INVALID",`${field} 값을 숫자로 해석할 수 없습니다.`,trace(cell,null,"WORKFORCE_INVALID")));
 return {value:null,trace:trace(cell,null,"WORKFORCE_INVALID")};
}

function dateValue(cell,cells,warnings,visiting=new Set()){
 if(!cell)return {value:null,trace:trace(cell,null,"FORMULA_DATE_UNRESOLVED")};
 const cached=isoDateFromSerial(cell.value)||isoDateFromText(cell.value);
 if(cached)return {value:cached,trace:trace(cell,cached)};
 const formula=String(cell.formula||"").trim().replace(/^=/,"");
 if(!formula)return {value:null,trace:trace(cell,null,"FORMULA_DATE_UNRESOLVED")};
 if(visiting.has(cell.address))return {value:null,trace:trace(cell,null,"FORMULA_DATE_UNRESOLVED")};
 const simple=/^\$?([A-Z]+)\$?(\d+)\s*\+\s*1$/.exec(formula);
 if(simple){
  visiting.add(cell.address);
  const previous=dateValue(cells.get(`${simple[1]}${simple[2]}`),cells,warnings,visiting);
  visiting.delete(cell.address);
  if(previous.value){
   const value=addDays(previous.value,1);
   return {value,trace:trace(cell,value)};
  }
 }
 const item=warning("FORMULA_DATE_UNRESOLVED","수식 날짜의 저장된 계산값이 없어 날짜를 확정할 수 없습니다.",trace(cell,null,"FORMULA_DATE_UNRESOLVED"));
 if(!warnings.some(value=>value.code===item.code&&value.sourceCellRange===item.sourceCellRange))warnings.push(item);
 return {value:null,trace:trace(cell,null,"FORMULA_DATE_UNRESOLVED")};
}

function findHeader(byRow,titleRow,nextTitleRow){
 const end=Math.min(nextTitleRow?nextTitleRow-1:titleRow+16,titleRow+16);
 for(let row=titleRow;row<=end;row++){
  const texts=(byRow.get(row)||[]).map(cell=>compact(cell.value));
  if(REQUIRED_HEADERS.every(header=>texts.some(text=>text===header||text.includes(header))))return row;
 }
 return null;
}

function headerColumn(byRow,row,label,fallback){
 const cell=(byRow.get(row)||[]).find(value=>compact(value.value).includes(label));
 return cell?.col||fallback;
}

function nearestValueCell(rowCells,labelCell){
 return rowCells.filter(cell=>cell.col>labelCell.col&&(String(cell.value??"").trim()!==""||String(cell.formula||"").trim()!=="")).sort((a,b)=>a.col-b.col)[0]||null;
}

function labeledCell(byRow,startRow,endRow,label){
 for(let row=startRow;row<=endRow;row++){
  const rowCells=byRow.get(row)||[];
  const labelCell=rowCells.find(cell=>compact(cell.value).replace(/[:：]/g,"").includes(label));
  if(labelCell)return nearestValueCell(rowCells,labelCell);
 }
 return null;
}

function collectMergedRaw(byRow,startRow,endRow,startCol,endCol){
 const values=[];
 for(let row=startRow;row<=endRow;row++){
  for(const cell of byRow.get(row)||[]){
   const text=String(cell.value??"").trim();
   if(cell.col>=startCol&&cell.col<=endCol&&text!=="")values.push({row,cell,text});
  }
 }
 return values;
}

function parseBlock(sheet,titleCell,nextTitleRow){
 const {cells,byRow}=sheet,headerRow=findHeader(byRow,titleCell.row,nextTitleRow),warnings=[];
 const baseSource={sourceSheetName:sheet.name,sourceRow:titleCell.row,sourceCellRange:titleCell.address};
 if(!headerRow)return {
  status:"REQUIRED_HEADER_MISSING",workDate:null,siteName:null,weather:null,minimumCelsius:null,maximumCelsius:null,
  trades:[],previousWorkRaw:[],plannedWorkRaw:[],plannedWorkItems:[],remarks:[],companyBreakdownAvailable:false,
  sourceSheetName:sheet.name,sourceRow:titleCell.row,sourceCellRange:titleCell.address,
  warnings:[warning("REQUIRED_HEADER_MISSING","공사일보 필수 헤더를 찾을 수 없습니다.",baseSource)]
 };
 const tradeCol=headerColumn(byRow,headerRow,"공종",3),previousWorkCol=headerColumn(byRow,headerRow,"전일작업사항",8),plannedWorkCol=headerColumn(byRow,headerRow,"금일작업예정사항",13),remarksCol=headerColumn(byRow,headerRow,"비고",18);
 const workforceHeaderCol=headerColumn(byRow,headerRow,"출력현황",5);
 const subHeaderRow=headerRow+1;
 const previousCountCol=(byRow.get(subHeaderRow)||[]).find(cell=>cell.col>=workforceHeaderCol&&cell.col<=workforceHeaderCol+3&&compact(cell.value)==="전일")?.col||workforceHeaderCol;
 const plannedCountCol=(byRow.get(subHeaderRow)||[]).find(cell=>cell.col>=workforceHeaderCol&&cell.col<=workforceHeaderCol+3&&compact(cell.value)==="금일")?.col||workforceHeaderCol+1;
 const cumulativeCountCol=(byRow.get(subHeaderRow)||[]).find(cell=>cell.col>=workforceHeaderCol&&cell.col<=workforceHeaderCol+3&&compact(cell.value)==="누계")?.col||workforceHeaderCol+2;
 const dateCell=labeledCell(byRow,titleCell.row,headerRow,"일자");
 const siteCell=labeledCell(byRow,titleCell.row,headerRow,"현장명")||(byRow.get(headerRow-2)||[]).find(cell=>cell.col>=4&&String(cell.value??"").trim());
 const weatherCell=labeledCell(byRow,titleCell.row,headerRow,"날씨");
 const minCell=labeledCell(byRow,titleCell.row,headerRow,"최저");
 const maxCell=labeledCell(byRow,titleCell.row,headerRow,"최고");
 const resolvedDate=dateValue(dateCell,cells,warnings);
 const startRow=headerRow+2,hardEnd=nextTitleRow?nextTitleRow-1:headerRow+60;
 let endRow=hardEnd,sourceTotalWorkforce=null;
 for(let row=startRow;row<=hardEnd;row++){
  const tradeText=compact(cells.get(`${colLetters(tradeCol)}${row}`)?.value);
  if(tradeText.includes("소계")||tradeText.includes("합계")||tradeText.includes("총계")||tradeText==="계"){sourceTotalWorkforce=numberValue(cells.get(`${colLetters(plannedCountCol)}${row}`),warnings,"원본 금일 총계").value;endRow=row-1;break}
  const rowText=(byRow.get(row)||[]).map(cell=>compact(cell.value)).join("|");
  if(row>startRow&&rowText.includes("자재명")&&rowText.includes("규격")){endRow=row-1;break}
 }
 const trades=[];
 for(let row=startRow;row<=endRow;row++){
  const tradeCell=cells.get(`${colLetters(tradeCol)}${row}`),trade=String(tradeCell?.value??"").trim();
  if(!trade||/소계|합계/.test(compact(trade)))continue;
  const previous=numberValue(cells.get(`${colLetters(previousCountCol)}${row}`),warnings,"전일 인원");
  const planned=numberValue(cells.get(`${colLetters(plannedCountCol)}${row}`),warnings,"금일 예정 인원");
  const cumulative=numberValue(cells.get(`${colLetters(cumulativeCountCol)}${row}`),warnings,"누계 인원");
  if(previous.value===null&&planned.value===null&&cumulative.value===null)continue;
  trades.push({trade,previousWorkforce:previous.value,plannedWorkforce:planned.value,cumulativeWorkforce:cumulative.value,
   sourceSheetName:sheet.name,sourceRow:row,sourceCellRange:`${colLetters(tradeCol)}${row}:${colLetters(cumulativeCountCol)}${row}`,
   trace:{trade:trace(tradeCell,trade),previousWorkforce:previous.trace,plannedWorkforce:planned.trace,cumulativeWorkforce:cumulative.trace}});
 }
 const previousRaw=collectMergedRaw(byRow,startRow,endRow,previousWorkCol,plannedWorkCol-1);
 const plannedRaw=collectMergedRaw(byRow,startRow,endRow,plannedWorkCol,remarksCol-1);
 const remarksRaw=collectMergedRaw(byRow,startRow,endRow,remarksCol,remarksCol+3);
 const plannedWorkItems=[];let current=null;
 const flush=()=>{
  if(!current)return;
  const details=current.details.map(value=>value.text).filter(Boolean),rawText=[current.heading.text,...current.details.map(value=>value.text)].join("\n");
  const headingText=current.heading.text.replace(/^[▶▷▸]\s*/,"").trim();
  const tradeName=headingText;
  if(details.length)warnings.push(warning("WORK_TEXT_UNCERTAIN","작업 문장에서 위치를 확실하게 분리할 수 없어 원문을 보존했습니다.",trace(current.heading.cell,rawText,"WORK_TEXT_UNCERTAIN")));
  plannedWorkItems.push({
   description:details.join(" / ")||tradeName,locationText:null,rawText,trade:tradeName,
   plannedWorkforce:null,companyName:null,companyBreakdownAvailable:false,
   sourceSheetName:sheet.name,sourceRow:current.heading.row,
   sourceCellRange:`${current.heading.cell.address}:${current.details.at(-1)?.cell.address||current.heading.cell.address}`,
   rawValue:rawText,normalizedValue:details.join(" / ")||tradeName,
   warningCode:details.length?"WORK_TEXT_UNCERTAIN":null
  });
  current=null;
 };
 for(const row of plannedRaw){
  if(/^[▶▷▸]/.test(row.text)){flush();current={heading:row,details:[]};continue}
  if(/^-\s*/.test(row.text)&&current)current.details.push({...row,text:row.text.replace(/^-\s*/,"").trim()});
 }
 flush();
 const workforce=reconcileWorkforceTrades(trades,plannedWorkItems);
 for(const item of workforce.workforceWarnings)warnings.push(warning(item.code,item.message,{...baseSource,...item}));
 const workforceTotalMatchesSource=sourceTotalWorkforce===null?null:sourceTotalWorkforce===workforce.todayWorkforceTotal;
 if(workforceTotalMatchesSource===false)warnings.push(warning("WORKFORCE_TOTAL_MISMATCH","원본 총계와 개별 출력인원 합계가 일치하지 않습니다.",{...baseSource,sourceTotalWorkforce,calculatedTotalWorkforce:workforce.todayWorkforceTotal}));
 warnings.push(warning("COMPANY_BREAKDOWN_UNAVAILABLE",COMPANY_WARNING,baseSource));
 const sourceEnd=Math.max(headerRow,endRow);
 const status=!resolvedDate.value?"DATE_UNRESOLVED":warnings.length?"PARSED_WITH_WARNINGS":"PARSED";
 return {
  status,workDate:resolvedDate.value,siteName:String(siteCell?.value??"").replace(/^[:：]\s*/,"").trim()||null,
  weather:String(weatherCell?.value??"").trim()||null,
  minimumCelsius:numberValue(minCell,warnings,"최저기온").value,
  maximumCelsius:numberValue(maxCell,warnings,"최고기온").value,
  trades,
  previousWorkRaw:previousRaw.map(value=>value.text),
  plannedWorkRaw:plannedRaw.map(value=>value.text),
  plannedWorkItems:workforce.plannedWorkItems,
  remarks:remarksRaw.map(value=>value.text),
  todayWorkforceTotal:workforce.todayWorkforceTotal,
  employeeWorkforce:workforce.employeeWorkforce,
  tradeWorkforceTotal:workforce.tradeWorkforceTotal,
  sourceTotalWorkforce,
  workforceTotalMatchesSource,
  workforceWarnings:workforce.workforceWarnings,
  companyBreakdownAvailable:false,
  sourceSheetName:sheet.name,sourceRow:titleCell.row,
  sourceCellRange:`${titleCell.address}:${colLetters(Math.max(remarksCol,19))}${sourceEnd}`,
  trace:{workDate:resolvedDate.trace,siteName:trace(siteCell,String(siteCell?.value??"").trim()||null),weather:trace(weatherCell,String(weatherCell?.value??"").trim()||null),minimumCelsius:trace(minCell,null),maximumCelsius:trace(maxCell,null)},
  warnings
 };
}

function workbookParts(bytes){
 let files;
 try{files=unzipSync(new Uint8Array(bytes))}catch{throw Object.assign(new Error("공사일보 엑셀 파일을 인식하지 못했습니다."),{code:"CONSTRUCTION_XLSX_INVALID"})}
 const get=name=>files[name]?strFromU8(files[name]):"";
 const workbook=get("xl/workbook.xml"),rels=get("xl/_rels/workbook.xml.rels");
 const shared=[...get("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match=>textNodes(match[1]));
 const relationships=Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(match=>[match[1],match[2]]));
 const sheets=[...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g)].map(match=>({
  name:decode(match[1]),state:/\bstate="([^"]+)"/.exec(match[0])?.[1]||"visible",
  path:`xl/${relationships[match[2]]||""}`.replace("xl//","xl/")
 }));
 return {get,shared,sheets};
}

export function analyzeUrbanTreeWorkbook(bytes){
 const {get,shared,sheets}=workbookParts(bytes),blocks=[];
 for(const metadata of sheets.filter(value=>value.state==="visible")){
  const xml=get(metadata.path);if(!xml)continue;
  const parsed=cellsFromSheet(xml,shared,metadata.name);
  const titleCells=[...parsed.cells.values()].filter(cell=>compact(cell.value).includes("공사일보")).sort((a,b)=>a.row-b.row);
  const sheet={...metadata,...parsed,mergeRanges:[...xml.matchAll(/<mergeCell\b[^>]*ref="([^"]+)"/g)].map(match=>match[1])};
  titleCells.forEach((title,index)=>blocks.push(parseBlock(sheet,title,titleCells[index+1]?.row||null)));
 }
 if(!blocks.length)throw Object.assign(new Error("등록된 공사일보 양식과 일치하지 않습니다."),{code:"CONSTRUCTION_XLSX_TEMPLATE_MISMATCH"});
 return {
  templateCode:"URBANTREE_DAILY_V2",
  sheets:sheets.map(({name,state})=>({name,state})),
  blockCount:blocks.length,
  dates:blocks.filter(block=>block.workDate).map(block=>({workDate:block.workDate,status:block.status,sourceSheetName:block.sourceSheetName,sourceRow:block.sourceRow,warnings:block.warnings})),
  blocks
 };
}

export function uploadResultFromAnalysis(analysis,selectedDate){
 const block=analysis.blocks.find(value=>value.workDate===selectedDate);
 if(!block)throw Object.assign(new Error("엑셀 파일의 날짜가 선택한 날짜와 다릅니다."),{code:"CONSTRUCTION_XLSX_DATE_MISMATCH",analysis});
 if(block.status==="DATE_UNRESOLVED"||block.status==="REQUIRED_HEADER_MISSING"||block.status==="INVALID_BLOCK")throw Object.assign(new Error("선택한 날짜의 공사일보를 안전하게 저장할 수 없습니다."),{code:"CONSTRUCTION_XLSX_BLOCK_INVALID",analysis});
 const items=block.plannedWorkItems.map((item,index)=>({
  sectionType:"TODAY_PLAN",companyNameSnapshot:null,companyConnectionStatus:"NOT_PROVIDED",
  tradeNameSnapshot:item.trade,locationText:item.locationText,workDescription:item.description,
  workforceCount:item.plannedWorkforce,sourceSheetName:item.sourceSheetName,
  sourceCellRange:item.sourceCellRange,sortOrder:index,rawText:item.rawText,
  warningCode:item.warningCode,companyBreakdownAvailable:false,
  workDescriptionSource:item.workDescriptionSource,isFallbackWorkItem:item.isFallbackWorkItem,
  tradeMatch:item.tradeMatch
 }));
 return {
  templateCode:analysis.templateCode,sheetName:block.sourceSheetName,documentDate:block.workDate,
  workDate:block.workDate,siteName:block.siteName,weather:block.weather,
  minimumCelsius:block.minimumCelsius,maximumCelsius:block.maximumCelsius,
  trades:block.trades,previousWorkRaw:block.previousWorkRaw,plannedWorkRaw:block.plannedWorkRaw,
  plannedWorkItems:block.plannedWorkItems,remarks:block.remarks,
  todayWorkforceTotal:block.todayWorkforceTotal,employeeWorkforce:block.employeeWorkforce,
  tradeWorkforceTotal:block.tradeWorkforceTotal,sourceTotalWorkforce:block.sourceTotalWorkforce,
  workforceTotalMatchesSource:block.workforceTotalMatchesSource,workforceWarnings:block.workforceWarnings,
  sourceSheetName:block.sourceSheetName,sourceRow:block.sourceRow,sourceCellRange:block.sourceCellRange,
  warnings:block.warnings,status:block.status,companyBreakdownAvailable:false,
  dates:analysis.dates,blockCount:analysis.blockCount,items,
  totalWorkforce:block.todayWorkforceTotal
 };
}

export function parseUrbanTreeWorkbook(bytes,selectedDate){
 return uploadResultFromAnalysis(analyzeUrbanTreeWorkbook(bytes),selectedDate);
}
