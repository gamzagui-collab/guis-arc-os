import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {strToU8,zipSync} from "fflate";
import {IMPORT_REQUIRED_SHEETS,SIMPLE_LOCATION_HEADERS,TEMPLATE_SHEETS} from "../worker/modules/site-location-import/contracts.js";
import {parseSiteLocationWorkbook} from "../worker/modules/site-location-import/xlsx-parser.js";
import {validateLocationImport} from "../worker/modules/site-location-import/validation.js";

const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const xml=rows=>`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,r)=>`<row r="${r+1}">${row.map((value,c)=>`<c r="${String.fromCharCode(65+c)}${r+1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
const book=rows=>zipSync({
  "xl/workbook.xml":strToU8(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="00_사용안내" sheetId="1" r:id="rId1"/><sheet name="01_위치목록" sheetId="2" r:id="rId2"/></sheets></workbook>`),
  "xl/_rels/workbook.xml.rels":strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`),
  "xl/worksheets/sheet1.xml":strToU8(xml([["건물/구역, 층, 호/공간만 입력하세요."]])),
  "xl/worksheets/sheet2.xml":strToU8(xml([["건물/구역","층","호/공간"],...rows]))
});

test("v3 contract exposes only two sheets and three editable columns",()=>{
  assert.deepEqual(TEMPLATE_SHEETS,["00_사용안내","01_위치목록"]);
  assert.deepEqual(IMPORT_REQUIRED_SHEETS,["01_위치목록"]);
  assert.deepEqual(SIMPLE_LOCATION_HEADERS,["건물/구역","층","호/공간"]);
});

test("v3 importer builds BUILDING FLOOR UNIT and never a canonical ROOM",()=>{
  const parsed=parseSiteLocationWorkbook(book([["202동","14층","1402호"],["외부","",""]]));
  assert.equal(parsed.workbookMeta.templateVersion,"SIMPLE_LOCATION_MASTER_V3");
  assert.deepEqual(parsed.locations.map(({area,floor,space})=>({area,floor,space})),[
    {area:"202동",floor:"14층",space:"1402호"},{area:"외부",floor:"",space:""}
  ]);
  const checked=validateLocationImport({siteId:"site-a",workbook:parsed,current:{locations:[],aliases:[]}});
  assert.equal(checked.applyAllowed,true,JSON.stringify(checked.errors));
  assert.deepEqual(checked.normalized.locations.filter(row=>row.displayName!=="외부").map(row=>row.locationType),["BUILDING","FLOOR","UNIT"]);
  assert.equal(checked.normalized.locations.filter(row=>row.locationType==="ROOM").length,0);
});

test("shipping v3 template has no editable detail column",()=>{
  const path="apps/web/templates/GUI_Arc_현장위치목록_기본서식_v3.xlsx";
  assert.equal(fs.existsSync(path),true);
  const parsed=parseSiteLocationWorkbook(fs.readFileSync(path));
  assert.deepEqual(parsed.workbookMeta.sheetNames,["00_사용안내","01_위치목록"]);
  assert.equal(parsed.workbookMeta.templateVersion,"SIMPLE_LOCATION_MASTER_V3");
});
