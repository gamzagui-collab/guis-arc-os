export const LOCATION_IMPORT_LIMITS=Object.freeze({
  compressedBytes:10*1024*1024,
  locations:5000,
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

export const SIMPLE_LOCATION_SHEET="01_위치목록";
export const SIMPLE_LOCATION_HEADERS=Object.freeze(["동/구역","층","호/공간","세부위치"]);
export const TEMPLATE_SHEETS=Object.freeze(["00_사용안내",SIMPLE_LOCATION_SHEET,"02_검토안내"]);
export const IMPORT_REQUIRED_SHEETS=Object.freeze([SIMPLE_LOCATION_SHEET]);

// Compatibility exports for internal callers. They represent the v2 user
// contract and do not re-enable the removed database-shaped workbook format.
export const LOCATION_HEADERS=SIMPLE_LOCATION_HEADERS;
export const ALIAS_HEADERS=Object.freeze([]);

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

export function normalizeLocationText(value){
  return String(value??"").normalize("NFC").trim().replace(/\s+/gu," ").replace(/(\d)\s+(동|층|호)\b/gu,"$1$2");
}

export const normalizeAlias=value=>normalizeLocationText(value).toLocaleLowerCase("und");
