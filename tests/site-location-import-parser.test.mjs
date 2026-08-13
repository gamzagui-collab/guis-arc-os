import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  ALIAS_HEADERS,
  LOCATION_HEADERS,
  LOCATION_IMPORT_LIMITS,
  REQUIRED_SHEETS,
  normalizeAlias
} from "../worker/modules/site-location-import/contracts.js";
import { parseSiteLocationWorkbook } from "../worker/modules/site-location-import/xlsx-parser.js";

const templatePath="apps/web/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx";
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const column=index=>{let value="";for(let n=index+1;n;n=Math.floor((n-1)/26))value=String.fromCharCode(65+(n-1)%26)+value;return value};
const worksheet=rows=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>`<c r="${column(columnIndex)}${rowIndex+1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
function workbook({locations=[],aliases=[],review="IMPORT 미사용",locationHeaders=LOCATION_HEADERS,aliasHeaders=ALIAS_HEADERS,extraEntries={}}={}){
  const sheets=[
    [REQUIRED_SHEETS[0],[[review]]],
    [REQUIRED_SHEETS[1],[locationHeaders,...locations]],
    [REQUIRED_SHEETS[2],[aliasHeaders,...aliases]],
    [REQUIRED_SHEETS[3],[[review]]],
    [REQUIRED_SHEETS[4],[[review]]],
    [REQUIRED_SHEETS[5],[[review]]]
  ];
  const workbookXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name],index)=>`<sheet name="${name}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join("")}</sheets></workbook>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join("")}</Relationships>`;
  return zipSync({"xl/workbook.xml":strToU8(workbookXml),"xl/_rels/workbook.xml.rels":strToU8(rels),...Object.fromEntries(sheets.map(([,rows],index)=>[`xl/worksheets/sheet${index+1}.xml`,strToU8(worksheet(rows))])),...extraEntries});
}
const sampleLocation=["loc-1","","SITE","현장/본관","본관",0];
const sampleAlias=["alias-1","loc-1"," 본관  1층 ","FIELD_NAME"];
const rejectCode=async(bytes,code)=>assert.rejects(Promise.resolve().then(()=>parseSiteLocationWorkbook(bytes)),error=>error.code===code);
const replaceEntry=(bytes,name,value)=>zipSync({...unzipSync(bytes),[name]:strToU8(value)});
const declaredExpansion=(bytes,size)=>{
  const copy=new Uint8Array(bytes),view=new DataView(copy.buffer,copy.byteOffset,copy.byteLength);
  for(let offset=0;offset<=copy.length-46;offset++)if(view.getUint32(offset,true)===0x02014b50){view.setUint32(offset+24,size,true);break}
  return copy;
};

test("static workbook has exactly six sheets and exact import headers",()=>{
  assert.deepEqual(LOCATION_HEADERS,["location_id","parent_location_id","location_type","canonical_key","display_name","sort_order"]);
  assert.deepEqual(ALIAS_HEADERS,["alias_id","location_id","alias_text","alias_type"]);
  const bytes=fs.readFileSync(templatePath),files=unzipSync(bytes);
  const workbookXml=strFromU8(files["xl/workbook.xml"]);
  const names=[...workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(names,REQUIRED_SHEETS);
  const parsed=parseSiteLocationWorkbook(bytes);
  assert.ok(parsed.workbookMeta.templateVersion==="LOCATION_MASTER_V1");
});

test("parser reads only sheets 01 and 02 and never returns a site target",()=>{
  const first=parseSiteLocationWorkbook(workbook({locations:[sampleLocation],aliases:[sampleAlias],review:"site_id=foreign-site"}));
  const changed=parseSiteLocationWorkbook(workbook({locations:[sampleLocation],aliases:[sampleAlias],review:"changed formulas and arbitrary review data"}));
  assert.deepEqual(first.locations,changed.locations);
  assert.deepEqual(first.aliases,changed.aliases);
  assert.equal(JSON.stringify(first).includes("site_id"),false);
  assert.equal(first.aliases[0].normalizedAlias,"본관 1층");
  assert.equal(normalizeAlias("  AＢＣ  Hall  "),"aｂｃ hall");
});

test("parser accepts Korean text and 1,700 location rows",()=>{
  const locations=Array.from({length:1700},(_,index)=>[`loc-${index}`,"","SITE",`현장/구역-${index}`,`구역 ${index}`,index]);
  const result=parseSiteLocationWorkbook(workbook({locations}));
  assert.equal(result.locations.length,1700);
  assert.equal(result.locations[1699].displayName,"구역 1699");
});

test("parser rejects invalid packages, formulas, and contract violations with stable codes",async()=>{
  await rejectCode(strToU8("not an xlsx"),"LOCATION_XLSX_INVALID");
  await rejectCode(workbook({locationHeaders:[...LOCATION_HEADERS,"location_id"]}),"LOCATION_XLSX_DUPLICATE_HEADER");
  await rejectCode(workbook({locationHeaders:LOCATION_HEADERS.slice(0,-1)}),"LOCATION_XLSX_REQUIRED_HEADER_MISSING");
  await rejectCode(workbook({locations:[sampleLocation],extraEntries:{"xl/externalLinks/externalLink1.xml":strToU8("<externalLink/>")}}),"LOCATION_XLSX_UNSAFE_CONTENT");
  const formulaSheet=strToU8(worksheet([LOCATION_HEADERS,sampleLocation]).replace("</c>","<f>1+1</f></c>"));
  const formulaBook=workbook({locations:[sampleLocation],extraEntries:{"xl/worksheets/sheet2.xml":formulaSheet}});
  await rejectCode(formulaBook,"LOCATION_XLSX_UNSAFE_CONTENT");
});

test("parser enforces compressed, expanded XML, cell, and row limits",async()=>{
  await rejectCode(new Uint8Array(LOCATION_IMPORT_LIMITS.compressedBytes+1),"LOCATION_XLSX_COMPRESSED_LIMIT");
  await rejectCode(workbook({locations:[["x".repeat(LOCATION_IMPORT_LIMITS.cellChars+1),"","SITE","key","name",0]]}),"LOCATION_XLSX_CELL_LIMIT");
  const tooMany=Array.from({length:LOCATION_IMPORT_LIMITS.locations+1},(_,index)=>[`loc-${index}`,"","SITE",`key-${index}`,`name-${index}`,index]);
  await rejectCode(workbook({locations:tooMany}),"LOCATION_XLSX_ROW_LIMIT");
  await rejectCode(workbook({extraEntries:{"xl/unused.xml":strToU8("x".repeat(LOCATION_IMPORT_LIMITS.expandedXmlBytes+1))}}),"LOCATION_XLSX_EXPANDED_LIMIT");
});

test("central-directory expansion is rejected before corrupt compressed data is inflated",async()=>{
  const bytes=declaredExpansion(workbook({locations:[sampleLocation]}),LOCATION_IMPORT_LIMITS.expandedXmlBytes+1);
  bytes[40]^=0xff;
  await rejectCode(bytes,"LOCATION_XLSX_EXPANDED_LIMIT");
});

test("parser bounds aliases, blank physical rows, columns, cells, worksheets, and XML parts",async()=>{
  const aliases=Array.from({length:LOCATION_IMPORT_LIMITS.aliases+1},(_,index)=>[`alias-${index}`,"loc-1",`별칭 ${index}`,"FIELD_NAME"]);
  await rejectCode(workbook({aliases}),"LOCATION_XLSX_ROW_LIMIT");
  const blankRows=Array.from({length:LOCATION_IMPORT_LIMITS.rowsPerWorksheet},()=>[]);
  await rejectCode(replaceEntry(workbook(),"xl/worksheets/sheet2.xml",worksheet([LOCATION_HEADERS,...blankRows])),"LOCATION_XLSX_PHYSICAL_ROW_LIMIT");
  await rejectCode(workbook({locations:[[...sampleLocation,...Array.from({length:LOCATION_IMPORT_LIMITS.columns},()=>"x")]]}),"LOCATION_XLSX_COLUMN_LIMIT");
  const denseRows=Array.from({length:Math.ceil(LOCATION_IMPORT_LIMITS.cells/LOCATION_IMPORT_LIMITS.columns)+1},()=>Array.from({length:LOCATION_IMPORT_LIMITS.columns},()=>"x"));
  await rejectCode(replaceEntry(workbook(),"xl/worksheets/sheet2.xml",worksheet(denseRows)),"LOCATION_XLSX_CELL_COUNT_LIMIT");
  const extraSheets=Array.from({length:LOCATION_IMPORT_LIMITS.worksheets+1},(_,index)=>`<sheet name="extra-${index}" sheetId="${index+10}" r:id="extra${index}"/>`).join("");
  const base=unzipSync(workbook()),workbookXml=strFromU8(base["xl/workbook.xml"]).replace("</sheets>",`${extraSheets}</sheets>`);
  await rejectCode(zipSync({...base,"xl/workbook.xml":strToU8(workbookXml)}),"LOCATION_XLSX_WORKSHEET_LIMIT");
  await rejectCode(replaceEntry(workbook(),"xl/worksheets/sheet2.xml","x".repeat(LOCATION_IMPORT_LIMITS.worksheetBytes+1)),"LOCATION_XLSX_WORKSHEET_BYTES_LIMIT");
  const shared=`<sst>${Array.from({length:LOCATION_IMPORT_LIMITS.sharedStrings+1},()=>"<si><t>x</t></si>").join("")}</sst>`;
  await rejectCode(workbook({extraEntries:{"xl/sharedStrings.xml":strToU8(shared)}}),"LOCATION_XLSX_SHARED_STRING_LIMIT");
  await rejectCode(workbook({extraEntries:{"xl/sharedStrings.xml":strToU8(`<sst><si><t>${"x".repeat(LOCATION_IMPORT_LIMITS.sharedStringBytes+1)}</t></si></sst>`)}}),"LOCATION_XLSX_SHARED_STRING_BYTES_LIMIT");
});

test("parser rejects namespace-qualified formulas",async()=>{
  const namespaced=worksheet([LOCATION_HEADERS,sampleLocation]).replace("</c>","<x:f>1+1</x:f></c>");
  await rejectCode(replaceEntry(workbook({locations:[sampleLocation]}),"xl/worksheets/sheet2.xml",namespaced),"LOCATION_XLSX_UNSAFE_CONTENT");
});

test("build produces a byte-identical template at the exact path",()=>{
  const build=fs.readFileSync("scripts/build.mjs","utf8");
  assert.match(build,/copyFileSync\("apps\/web\/templates\/GUI_Arc_현장위치마스터_기본서식_v1\.xlsx", "dist\/templates\/GUI_Arc_현장위치마스터_기본서식_v1\.xlsx"\)/);
  const result=spawnSync(process.execPath,["scripts/build.mjs"],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  const digest=path=>crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
  assert.equal(digest(templatePath),digest("dist/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx"));
});
