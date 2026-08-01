import crypto from "node:crypto";
import {validateFourDigitPin} from "../worker/core/pin-policy.js";

export const INTERNAL_TEST_ACCOUNT_KEYS=Object.freeze(["site_manager","safety_manager","construction_manager","gc_foreman","gc_staff","contractor_manager","contractor_site_manager","contractor_foreman","contractor_b_manager","contractor_assignee","no_access","field_worker"]);

export function validateInternalTestPin(pin){
 try{return validateFourDigitPin(pin)}catch(error){throw new Error(`공통 시험 PIN: ${error.message}`)}
}

export function createInternalTestCredentials(pin,randomBytes=crypto.randomBytes){
 const validated=validateInternalTestPin(pin);
 return Object.fromEntries(INTERNAL_TEST_ACCOUNT_KEYS.map(key=>{
  const salt=randomBytes(16).toString("base64url"),credentialHash=crypto.pbkdf2Sync(validated,salt,100000,32,"sha256").toString("hex");
  return [key,{identifier:`e2e-v021-${key.replaceAll("_","-")}@integration.invalid`,credentialHash,credentialSalt:salt,credentialIterations:100000}];
 }));
}
