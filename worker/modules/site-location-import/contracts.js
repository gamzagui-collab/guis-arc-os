export const LOCATION_IMPORT_LIMITS=Object.freeze({
  compressedBytes:10*1024*1024,
  locations:5000,
  aliases:10000,
  cellChars:500,
  expandedXmlBytes:40*1024*1024,
  worksheets:16,
  rowsPerWorksheet:12000,
  columns:64,
  cells:100000,
  sharedStrings:20000,
  worksheetBytes:20*1024*1024,
  sharedStringBytes:10*1024*1024
});

export const REQUIRED_SHEETS=Object.freeze([
  "00_사용안내",
  "01_위치마스터",
  "02_위치별칭",
  "03_검증_확인필요",
  "04_도면근거",
  "05_ChatGPT작성규칙"
]);

export const LOCATION_HEADERS=Object.freeze(["location_id","parent_location_id","location_type","canonical_key","display_name","sort_order"]);
export const ALIAS_HEADERS=Object.freeze(["alias_id","location_id","alias_text","alias_type"]);

export const LOCATION_IMPORT_ERROR_CODES=Object.freeze({
  COMPRESSED_LIMIT:"LOCATION_XLSX_COMPRESSED_LIMIT",
  INVALID:"LOCATION_XLSX_INVALID",
  EXPANDED_LIMIT:"LOCATION_XLSX_EXPANDED_LIMIT",
  WORKSHEET_LIMIT:"LOCATION_XLSX_WORKSHEET_LIMIT",
  WORKSHEET_BYTES_LIMIT:"LOCATION_XLSX_WORKSHEET_BYTES_LIMIT",
  SHARED_STRING_LIMIT:"LOCATION_XLSX_SHARED_STRING_LIMIT",
  SHARED_STRING_BYTES_LIMIT:"LOCATION_XLSX_SHARED_STRING_BYTES_LIMIT",
  PHYSICAL_ROW_LIMIT:"LOCATION_XLSX_PHYSICAL_ROW_LIMIT",
  COLUMN_LIMIT:"LOCATION_XLSX_COLUMN_LIMIT",
  CELL_COUNT_LIMIT:"LOCATION_XLSX_CELL_COUNT_LIMIT",
  UNSAFE_CONTENT:"LOCATION_XLSX_UNSAFE_CONTENT",
  SHEET_MISSING:"LOCATION_XLSX_REQUIRED_SHEET_MISSING",
  HEADER_MISSING:"LOCATION_XLSX_REQUIRED_HEADER_MISSING",
  HEADER_DUPLICATE:"LOCATION_XLSX_DUPLICATE_HEADER",
  CELL_LIMIT:"LOCATION_XLSX_CELL_LIMIT",
  ROW_LIMIT:"LOCATION_XLSX_ROW_LIMIT"
});

export function normalizeAlias(value){
  return String(value??"").normalize("NFC").trim().replace(/\s+/gu," ").toLocaleLowerCase("und");
}
