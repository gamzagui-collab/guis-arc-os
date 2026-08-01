import crypto from "node:crypto";

export const INTERNAL_TEST_ACCOUNT_KEYS=Object.freeze(["site_manager","safety_manager","construction_manager","gc_foreman","gc_staff","contractor_manager","contractor_site_manager","contractor_foreman","contractor_b_manager","contractor_assignee","no_access","field_worker"]);

export function validateInternalTestPin(pin){
 if(!/^[0-9]{8}$/.test(String(pin||"")))throw new Error("공통 8자리 숫자 시험 PIN이 필요합니다.");
 return String(pin);
}

export function createInternalTestCredentials(pin,randomBytes=crypto.randomBytes){
 const validated=validateInternalTestPin(pin);
 return Object.fromEntries(INTERNAL_TEST_ACCOUNT_KEYS.map(key=>{
  const salt=randomBytes(16).toString("base64url"),credentialHash=crypto.pbkdf2Sync(validated,salt,100000,32,"sha256").toString("hex");
  return [key,{identifier:`e2e-v021-${key.replaceAll("_","-")}@integration.invalid`,credentialHash,credentialSalt:salt,credentialIterations:100000}];
 }));
}
