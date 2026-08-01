import crypto from "node:crypto";
import {validateFourDigitPin} from "../worker/core/pin-policy.js";

export const INTERNAL_TEST_ACCOUNT_KEYS=Object.freeze(["site_manager","safety_manager","construction_manager","gc_foreman","gc_staff","contractor_manager","contractor_site_manager","contractor_foreman","contractor_b_manager","contractor_assignee","no_access","field_worker"]);

export function internalTestIdentifier(key){
 const index=INTERNAL_TEST_ACCOUNT_KEYS.indexOf(key);
 if(index<0)throw new Error("Unknown internal test account key.");
 return `0102408${String(index+1).padStart(4,"0")}`;
}

export function validateInternalTestPin(pin){
 try{return validateFourDigitPin(pin)}catch(error){throw new Error(`공통 시험 PIN: ${error.message}`)}
}

export function createInternalTestCredentials(pin,randomBytes=crypto.randomBytes){
 const validated=validateInternalTestPin(pin);
 return Object.fromEntries(INTERNAL_TEST_ACCOUNT_KEYS.map(key=>{
  const salt=randomBytes(16).toString("base64url"),credentialHash=crypto.pbkdf2Sync(validated,salt,100000,32,"sha256").toString("hex");
  return [key,{identifier:internalTestIdentifier(key),credentialHash,credentialSalt:salt,credentialIterations:100000}];
 }));
}
