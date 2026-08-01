import test from "node:test";
import assert from "node:assert/strict";
import {validateCompanyCreateInput} from "../worker/modules/integrated-admin.js";
import {validateCompanyRegistration} from "../apps/web/assets/integrated-admin.js";
import {formatBusinessNumber,canonicalBusinessNumber} from "../apps/web/assets/format.js";

const valid={name:"테스트 건설",companyType:"GENERAL_CONTRACTOR",businessRegistrationNumber:"1234567890",tradeIds:["trade-1"]};
const serverError=(input,code)=>assert.throws(()=>validateCompanyCreateInput(input),error=>error.code===code);

test("server company validation returns a distinct canonical error for each field",()=>{
 serverError({...valid,name:"   "},"COMPANY_NAME_REQUIRED");
 serverError({...valid,name:"가".repeat(121)},"COMPANY_NAME_TOO_LONG");
 serverError({...valid,companyType:""},"COMPANY_TYPE_REQUIRED");
 serverError({...valid,companyType:"UNKNOWN"},"COMPANY_TYPE_INVALID");
 serverError({...valid,businessRegistrationNumber:""},"BUSINESS_NUMBER_REQUIRED");
 serverError({...valid,businessRegistrationNumber:"123456789"},"BUSINESS_NUMBER_INVALID_LENGTH");
 serverError({...valid,businessRegistrationNumber:"12345A7890"},"BUSINESS_NUMBER_INVALID_FORMAT");
 serverError({...valid,tradeIds:[]},"COMPANY_TRADES_REQUIRED");
});

test("business number UI formats ten digits and sends digits only",()=>{
 assert.equal(formatBusinessNumber("1234567890"),"123-45-67890");
 assert.equal(formatBusinessNumber("12345678901"),"123-45-67890");
 assert.equal(formatBusinessNumber("12345A67890"),"123-45-67890");
 assert.equal(canonicalBusinessNumber("123-45-67890"),"1234567890");
});

test("frontend exposes all company field errors together without changing values",()=>{
 const input={name:"",companyType:"",businessRegistrationNumber:"123456789",tradeIds:[]};
 const snapshot=structuredClone(input),errors=validateCompanyRegistration(input);
 assert.deepEqual(Object.keys(errors),["name","companyType","businessRegistrationNumber","tradeIds"]);
 assert.match(errors.businessRegistrationNumber,/현재 9자리/);
 assert.deepEqual(input,snapshot);
 assert.deepEqual(validateCompanyRegistration(valid),{});
});
