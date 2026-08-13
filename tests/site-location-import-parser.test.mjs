import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {strToU8,zipSync} from "fflate";
import {IMPORT_REQUIRED_SHEETS,SIMPLE_LOCATION_HEADERS,SIMPLE_LOCATION_SHEET,TEMPLATE_SHEETS} from "../worker/modules/site-location-import/contracts.js";
import {parseSiteLocationWorkbook} from "../worker/modules/site-location-import/xlsx-parser.js";
import {validateLocationImport} from "../worker/modules/site-location-import/validation.js";

const templatePath="apps/web/templates/GUI_Arc_현장위치목록_기본서식_v2.xlsx";
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const sheet=rows=>`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,index)=>`<row r="${index+1}">${row.map((value,column)=>`<c r="${String.fromCharCode(65+column)}${index+1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
const book=({headers=SIMPLE_LOCATION_HEADERS,rows=[],formula=false}={})=>{
  const workbook=`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${SIMPLE_LOCATION_SHEET}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels=`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const xml=sheet([headers,...rows]).replace("</c>",formula?"<f>1+1</f></c>":"</c>");
  return zipSync({"xl/workbook.xml":strToU8(workbook),"xl/_rels/workbook.xml.rels":strToU8(rels),"xl/worksheets/sheet1.xml":strToU8(xml)});
};

test("shipping v2 template has the exact human workbook contract and validates with no errors",()=>{
  assert.deepEqual(IMPORT_REQUIRED_SHEETS,[SIMPLE_LOCATION_SHEET]);
  assert.deepEqual(SIMPLE_LOCATION_HEADERS,["동/구역","층","호/공간","세부위치"]);
  const parsed=parseSiteLocationWorkbook(fs.readFileSync(templatePath));
  assert.deepEqual(parsed.workbookMeta.sheetNames,TEMPLATE_SHEETS);
  assert.equal(parsed.workbookMeta.templateVersion,"SIMPLE_LOCATION_LIST_V2");
  assert.deepEqual(parsed.aliases,[]);
  assert.equal(validateLocationImport({siteId:"site-a",workbook:parsed,current:{locations:[],aliases:[]}}).errors.length,0);
});

test("parser accepts only the human sheet, ignores review sheets, and rejects missing headers or formulas",()=>{
  const parsed=parseSiteLocationWorkbook(book({rows:[["202 동","14 층","1401 호","거실"]]}));
  assert.deepEqual(parsed.locations[0],{area:"202 동",floor:"14 층",space:"1401 호",detail:"거실",sourceSheetName:"01_위치목록",sourceRow:2});
  assert.throws(()=>parseSiteLocationWorkbook(book({headers:SIMPLE_LOCATION_HEADERS.slice(0,-1)})),error=>error.code==="LOCATION_XLSX_REQUIRED_HEADER_MISSING");
  assert.throws(()=>parseSiteLocationWorkbook(book({formula:true})),error=>error.code==="LOCATION_XLSX_UNSAFE_CONTENT");
});

test("parser retains its XLSX bounds for a large simple list",()=>{
  const rows=Array.from({length:1700},(_,index)=>["202동",`${index+1}층`,`${index+1}호`,""]);
  const parsed=parseSiteLocationWorkbook(book({rows}));
  assert.equal(parsed.locations.length,1700);
  assert.throws(()=>parseSiteLocationWorkbook(book({rows:Array.from({length:5001},()=>["202동","1층","101호",""])})),error=>error.code==="LOCATION_XLSX_ROW_LIMIT");
});

test("build copies the shipping v2 template byte-for-byte",()=>{
  const build=spawnSync(process.execPath,["scripts/build.mjs"],{encoding:"utf8"});
  assert.equal(build.status,0,build.stderr);
  const digest=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  assert.equal(digest(templatePath),digest("dist/templates/GUI_Arc_현장위치목록_기본서식_v2.xlsx"));
});
