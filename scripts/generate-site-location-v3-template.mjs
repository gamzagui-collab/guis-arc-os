import fs from "node:fs";
import {strToU8,zipSync} from "fflate";

const escape=value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const sheet=rows=>`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>`<c r="${String.fromCharCode(65+columnIndex)}${rowIndex+1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
const workbook=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="00_사용안내" sheetId="1" r:id="rId1"/><sheet name="01_위치목록" sheetId="2" r:id="rId2"/></sheets></workbook>`;
const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`;
const bytes=zipSync({
  "xl/workbook.xml":strToU8(workbook),
  "xl/_rels/workbook.xml.rels":strToU8(rels),
  "xl/worksheets/sheet1.xml":strToU8(sheet([["건물/구역, 층, 호/공간만 입력하세요."],["세부 위치는 이슈 등록에서 선택하거나 직접 입력합니다."]])),
  "xl/worksheets/sheet2.xml":strToU8(sheet([["건물/구역","층","호/공간"],["101동","3층","301호"],["관리동","1층","관리사무소"],["지하주차장","B1","A구역"],["외부","",""]]))
});
fs.writeFileSync("apps/web/templates/GUI_Arc_현장위치목록_기본서식_v3.xlsx",bytes);
