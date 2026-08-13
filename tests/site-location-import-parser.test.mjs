import assert from "node:assert/strict";
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

test("build script preserves the exact template copy path",()=>{
  const build=fs.readFileSync("scripts/build.mjs","utf8");
  assert.match(build,/dist\/templates/);
});
