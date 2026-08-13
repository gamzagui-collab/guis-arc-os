import { strFromU8, unzipSync } from "fflate";
import {
  ALIAS_HEADERS,
  LOCATION_HEADERS,
  LOCATION_IMPORT_ERROR_CODES as CODES,
  LOCATION_IMPORT_LIMITS as LIMITS,
  REQUIRED_SHEETS,
  normalizeAlias
} from "./contracts.js";

const fail=(code,message)=>{throw Object.assign(new Error(message),{code})};
const decode=value=>String(value??"").replace(/&(?:#x([0-9a-f]+)|#(\d+)|amp|lt|gt|quot|apos);/gi,(token,hex,decimal)=>{
  if(hex)return String.fromCodePoint(Number.parseInt(hex,16));
  if(decimal)return String.fromCodePoint(Number(decimal));
  return {"&amp;":"&","&lt;":"<","&gt;":">","&quot;":"\"","&apos;":"'"}[token.toLowerCase()]??token;
});
const textNodes=xml=>decode([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(match=>match[1]).join(""));
const CONTROL_CHARACTER=/[\u0000-\u001F\u007F]/u;
const normalizeCell=value=>String(value??"").normalize("NFC").trim().replace(/\s+/gu," ");
const resolvePath=target=>`xl/${target.replace(/^\/?xl\//,"").replace(/^\.\//,"")}`.replace("xl//","xl/");

function zipPreflight(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),minimum=Math.max(0,bytes.length-65557);
  let eocd=-1;
  for(let offset=bytes.length-22;offset>=minimum;offset--)if(view.getUint32(offset,true)===0x06054b50){eocd=offset;break}
  if(eocd<0)fail(CODES.INVALID,"ZIP 중앙 디렉터리가 없습니다.");
  const count=view.getUint16(eocd+10,true),directorySize=view.getUint32(eocd+12,true),directoryOffset=view.getUint32(eocd+16,true);
  if(count===0xffff||directorySize===0xffffffff||directoryOffset===0xffffffff)fail(CODES.INVALID,"ZIP64 XLSX는 지원하지 않습니다.");
  if(directoryOffset+directorySize>eocd)fail(CODES.INVALID,"ZIP 중앙 디렉터리가 손상되었습니다.");
  let offset=directoryOffset,expanded=0,worksheets=0;
  const names=new Set(),decoder=new TextDecoder();
  for(let index=0;index<count;index++){
    if(offset+46>eocd||view.getUint32(offset,true)!==0x02014b50)fail(CODES.INVALID,"ZIP 중앙 디렉터리 항목이 손상되었습니다.");
    const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),compressed=view.getUint32(offset+20,true),original=view.getUint32(offset+24,true);
    const nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),end=offset+46+nameLength+extraLength+commentLength;
    if(end>eocd||compressed===0xffffffff||original===0xffffffff)fail(CODES.INVALID,"지원하지 않는 ZIP 항목입니다.");
    if(flags&1||![0,8].includes(method))fail(CODES.UNSAFE_CONTENT,"암호화되거나 지원하지 않는 압축 항목입니다.");
    const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength));
    if(names.has(name))fail(CODES.INVALID,"중복 ZIP 항목은 허용되지 않습니다.");
    names.add(name);expanded+=original;
    if(expanded>LIMITS.expandedXmlBytes)fail(CODES.EXPANDED_LIMIT,"선언된 압축 해제 크기 제한을 초과했습니다.");
    if(/^xl\/worksheets\/[^/]+\.xml$/i.test(name)){
      worksheets++;
      if(worksheets>LIMITS.worksheets)fail(CODES.WORKSHEET_LIMIT,"워크시트 수 제한을 초과했습니다.");
      if(original>LIMITS.worksheetBytes)fail(CODES.WORKSHEET_BYTES_LIMIT,"워크시트 크기 제한을 초과했습니다.");
    }
    if(/^xl\/sharedStrings\.xml$/i.test(name)&&original>LIMITS.sharedStringBytes)fail(CODES.SHARED_STRING_BYTES_LIMIT,"공유 문자열 크기 제한을 초과했습니다.");
    offset=end;
  }
  if(offset!==directoryOffset+directorySize)fail(CODES.INVALID,"ZIP 중앙 디렉터리 크기가 일치하지 않습니다.");
}

function packageParts(buffer){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  if(bytes.byteLength>LIMITS.compressedBytes)fail(CODES.COMPRESSED_LIMIT,"압축 파일 크기 제한을 초과했습니다.");
  if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b)fail(CODES.INVALID,"올바른 XLSX 파일이 아닙니다.");
  zipPreflight(bytes);
  let files;
  let declaredExpanded=0;
  try{files=unzipSync(bytes,{filter:file=>{declaredExpanded+=file.originalSize;if(declaredExpanded>LIMITS.expandedXmlBytes)fail(CODES.EXPANDED_LIMIT,"압축 해제 크기 제한을 초과했습니다.");return true}})}catch(error){if(error?.code&&String(error.code).startsWith("LOCATION_"))throw error;fail(CODES.INVALID,"올바른 XLSX OpenXML 패키지가 아닙니다.")}
  let expanded=0;
  for(const [name,data] of Object.entries(files)){
    expanded+=data.byteLength;
    if(expanded>LIMITS.expandedXmlBytes)fail(CODES.EXPANDED_LIMIT,"압축 해제 크기 제한을 초과했습니다.");
    if(/(^|\/)(vbaProject\.bin|externalLinks\/|embeddings\/|activeX\/)/i.test(name))fail(CODES.UNSAFE_CONTENT,"외부 링크, 매크로 또는 삽입 개체는 허용되지 않습니다.");
  }
  const get=name=>files[name]?strFromU8(files[name]):"";
  const workbook=get("xl/workbook.xml"),rels=get("xl/_rels/workbook.xml.rels");
  if(!workbook||!rels)fail(CODES.INVALID,"필수 XLSX 구성 요소가 없습니다.");
  const relationships=Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(match=>[match[1],resolvePath(match[2]) ]));
  const sheets=[...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?\s*>/g)].map(match=>({name:decode(match[1]),path:relationships[match[2]]}));
  if(sheets.length>LIMITS.worksheets)fail(CODES.WORKSHEET_LIMIT,"워크시트 수 제한을 초과했습니다.");
  const sharedXml=get("xl/sharedStrings.xml");
  if(files["xl/sharedStrings.xml"]?.byteLength>LIMITS.sharedStringBytes)fail(CODES.SHARED_STRING_BYTES_LIMIT,"공유 문자열 크기 제한을 초과했습니다.");
  const shared=[];for(const match of sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){if(shared.length>=LIMITS.sharedStrings)fail(CODES.SHARED_STRING_LIMIT,"공유 문자열 개수 제한을 초과했습니다.");shared.push(textNodes(match[1]))}
  return {files,get,sheets,shared};
}

function rowsFromSheet(xml,shared,counter){
  if(/<(?:[\w.-]+:)?f\b/i.test(xml))fail(CODES.UNSAFE_CONTENT,"수식 셀은 허용되지 않습니다.");
  const rows=[];
  for(const rowMatch of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
    if(rows.length>=LIMITS.rowsPerWorksheet)fail(CODES.PHYSICAL_ROW_LIMIT,"워크시트 물리 행 수 제한을 초과했습니다.");
    const row={};
    for(const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const address=/\br="([A-Z]+)\d+"/.exec(cellMatch[1])?.[1];
      if(!address)continue;
      let column=0;for(const character of address)column=column*26+character.charCodeAt(0)-64;column--;
      if(column>=LIMITS.columns)fail(CODES.COLUMN_LIMIT,"워크시트 열 제한을 초과했습니다.");
      counter.cells++;if(counter.cells>LIMITS.cells)fail(CODES.CELL_COUNT_LIMIT,"워크북 셀 수 제한을 초과했습니다.");
      const type=/\bt="([^"]+)"/.exec(cellMatch[1])?.[1];
      const body=cellMatch[2],raw=/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1]??"";
      const value=type==="s"?shared[Number(raw)]??"":type==="inlineStr"?textNodes(body):decode(raw);
      if(CONTROL_CHARACTER.test(value))fail(CODES.UNSAFE_CONTENT,"셀에 허용되지 않는 제어문자가 있습니다.");
      const normalized=normalizeCell(value);
      if(normalized.length>LIMITS.cellChars)fail(CODES.CELL_LIMIT,"셀 문자열 길이 제한을 초과했습니다.");
      row[column]=normalized;
    }
    rows.push({number:Number(rowMatch[1]),values:row});
  }
  return rows;
}

function importRows(parts,sheetName,requiredHeaders,limit,mapper){
  const metadata=parts.sheets.find(sheet=>sheet.name===sheetName);
  if(!metadata?.path||!parts.files[metadata.path])fail(CODES.SHEET_MISSING,`${sheetName} 시트가 없습니다.`);
  const dataBytes=parts.files[metadata.path];
  if(dataBytes.byteLength>LIMITS.worksheetBytes)fail(CODES.WORKSHEET_BYTES_LIMIT,"워크시트 크기 제한을 초과했습니다.");
  const rows=rowsFromSheet(parts.get(metadata.path),parts.shared,parts.counter),header=rows[0]?.values??{};
  const headerEntries=Object.entries(header);
  for(const required of requiredHeaders){
    const count=headerEntries.filter(([,value])=>value===required).length;
    if(count===0)fail(CODES.HEADER_MISSING,`${sheetName} 시트에 ${required} 헤더가 없습니다.`);
    if(count>1)fail(CODES.HEADER_DUPLICATE,`${sheetName} 시트에 ${required} 헤더가 중복되었습니다.`);
  }
  const indexes=Object.fromEntries(requiredHeaders.map(name=>[name,Number(headerEntries.find(([,value])=>value===name)[0])]));
  const data=rows.slice(1).filter(row=>requiredHeaders.some(name=>row.values[indexes[name]]));
  if(data.length>limit)fail(CODES.ROW_LIMIT,`${sheetName} 행 수 제한을 초과했습니다.`);
  return data.map(row=>mapper(row,indexes));
}

export function parseSiteLocationWorkbook(buffer){
  const parts=packageParts(buffer);
  parts.counter={cells:0};
  for(const name of REQUIRED_SHEETS)if(!parts.sheets.some(sheet=>sheet.name===name))fail(CODES.SHEET_MISSING,`${name} 시트가 없습니다.`);
  const locations=importRows(parts,REQUIRED_SHEETS[1],LOCATION_HEADERS,LIMITS.locations,(row,indexes)=>({
    locationId:row.values[indexes.location_id]??"",
    parentLocationId:row.values[indexes.parent_location_id]??"",
    locationType:row.values[indexes.location_type]??"",
    canonicalKey:row.values[indexes.canonical_key]??"",
    displayName:row.values[indexes.display_name]??"",
    sortOrder:row.values[indexes.sort_order]===""||row.values[indexes.sort_order]===undefined?null:Number(row.values[indexes.sort_order]),
    sourceSheetName:REQUIRED_SHEETS[1],sourceRow:row.number
  }));
  const aliases=importRows(parts,REQUIRED_SHEETS[2],ALIAS_HEADERS,LIMITS.aliases,(row,indexes)=>({
    aliasId:row.values[indexes.alias_id]??"",
    locationId:row.values[indexes.location_id]??"",
    aliasText:row.values[indexes.alias_text]??"",
    aliasType:row.values[indexes.alias_type]??"",
    normalizedAlias:normalizeAlias(row.values[indexes.alias_text]),
    sourceSheetName:REQUIRED_SHEETS[2],sourceRow:row.number
  }));
  return {locations,aliases,workbookMeta:{templateVersion:"LOCATION_MASTER_V1",sheetNames:parts.sheets.map(sheet=>sheet.name)},diagnostics:[]};
}
