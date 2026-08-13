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
const normalizeCell=value=>String(value??"").normalize("NFC").trim().replace(/\s+/gu," ");
const resolvePath=target=>`xl/${target.replace(/^\/?xl\//,"").replace(/^\.\//,"")}`.replace("xl//","xl/");

function packageParts(buffer){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  if(bytes.byteLength>LIMITS.compressedBytes)fail(CODES.COMPRESSED_LIMIT,"압축 파일 크기 제한을 초과했습니다.");
  if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b)fail(CODES.INVALID,"올바른 XLSX 파일이 아닙니다.");
  let files;
  try{files=unzipSync(bytes)}catch{fail(CODES.INVALID,"올바른 XLSX OpenXML 패키지가 아닙니다.")}
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
  const shared=[...get("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match=>textNodes(match[1]));
  return {files,get,sheets,shared};
}

function rowsFromSheet(xml,shared){
  if(/<f\b/i.test(xml))fail(CODES.UNSAFE_CONTENT,"수식 셀은 허용되지 않습니다.");
  const rows=[];
  for(const rowMatch of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
    const row=[];
    for(const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const address=/\br="([A-Z]+)\d+"/.exec(cellMatch[1])?.[1];
      if(!address)continue;
      let column=0;for(const character of address)column=column*26+character.charCodeAt(0)-64;column--;
      const type=/\bt="([^"]+)"/.exec(cellMatch[1])?.[1];
      const body=cellMatch[2],raw=/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1]??"";
      const value=type==="s"?shared[Number(raw)]??"":type==="inlineStr"?textNodes(body):decode(raw);
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
  const rows=rowsFromSheet(parts.get(metadata.path),parts.shared),header=rows[0]?.values??[];
  for(const required of requiredHeaders){
    const count=header.filter(value=>value===required).length;
    if(count===0)fail(CODES.HEADER_MISSING,`${sheetName} 시트에 ${required} 헤더가 없습니다.`);
    if(count>1)fail(CODES.HEADER_DUPLICATE,`${sheetName} 시트에 ${required} 헤더가 중복되었습니다.`);
  }
  const indexes=Object.fromEntries(requiredHeaders.map(name=>[name,header.indexOf(name)]));
  const data=rows.slice(1).filter(row=>requiredHeaders.some(name=>row.values[indexes[name]]));
  if(data.length>limit)fail(CODES.ROW_LIMIT,`${sheetName} 행 수 제한을 초과했습니다.`);
  return data.map(row=>mapper(row,indexes));
}

export function parseSiteLocationWorkbook(buffer){
  const parts=packageParts(buffer);
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
