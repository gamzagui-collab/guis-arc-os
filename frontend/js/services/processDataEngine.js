import { PROCESS_INTEGRATION_DB, getProcessById, findProcessByText } from "../data/processIntegrationDatabase.js";

export const PROCESS_SCHEMA_VERSION = 1;

export function resolveProcess(record = {}){
  if(!record || typeof record !== "object") return null;
  return getProcessById(record.processId) || findProcessByText([
    record.subProcess, record.subTrade, record.title, record.trade, record.description, record.detail
  ].filter(Boolean).join(" "));
}

export function enrichWorkRecord(record = {}){
  const process = resolveProcess(record);
  if(!process) return { ...record, processId:record.processId || null, knowledge:null };
  return {
    ...record,
    processId:process.id,
    category:record.category || process.category,
    trade:record.trade || process.trade,
    subProcess:record.subProcess || record.subTrade || process.subProcess,
    knowledge:{
      riskLevel:process.riskLevel,
      highRisk:Boolean(process.highRisk),
      safetyRisks:[...(process.safetyRisks || [])],
      preventiveActions:[...(process.preventiveActions || [])],
      documents:[...(process.documents || [])],
      tbmPoints:[...(process.tbmPoints || [])],
      qualityActions:[...(process.qualityActions || [])],
      constructionActions:[...(process.constructionActions || [])],
      materialsEquipment:[...(process.materialsEquipment || [])],
      weatherRules:{...(process.weatherRules || {})}
    }
  };
}

export function processDatabaseSummary(){
  return { schemaVersion:PROCESS_SCHEMA_VERSION, count:PROCESS_INTEGRATION_DB.length, processIds:PROCESS_INTEGRATION_DB.map(x=>x.id) };
}
