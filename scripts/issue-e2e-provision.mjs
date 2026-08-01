import crypto from "node:crypto";

const endpoint="https://guis-arc-integrated-api-dev.gamzagui.workers.dev/api/internal/integration/issue-e2e-provision";
const secret=process.env.GUI_ARC_E2E_PROVISIONING_SECRET;
const pinMap=JSON.parse(process.env.GUI_ARC_E2E_PINS||"{}");
const keys=["site_manager","safety_manager","construction_manager","gc_foreman","gc_staff","contractor_manager","contractor_site_manager","contractor_foreman","contractor_b_manager","contractor_assignee","no_access","field_worker"];
if(!secret||keys.some(key=>!/^[0-9]{8}$/.test(String(pinMap[key]||""))))throw new Error("Protected E2E input is missing.");
const credentials={};
for(const key of keys){
 const salt=crypto.randomBytes(16).toString("base64url"),credentialHash=crypto.pbkdf2Sync(pinMap[key],salt,100000,32,"sha256").toString("hex");
 credentials[key]={identifier:`e2e-v021-${key.replaceAll("_","-")}@integration.invalid`,displayName:`E2E ${key}`,credentialHash,credentialSalt:salt,credentialIterations:100000};
}
let response,result;for(let attempt=0;attempt<20;attempt++){response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-provisioning-secret":secret},body:JSON.stringify({credentials})});result=await response.json().catch(()=>({error:"NON_JSON_RESPONSE"}));if(![403,404].includes(response.status))break;await new Promise(resolve=>setTimeout(resolve,1500))}
if(!response.ok)throw new Error(`Issue E2E fixture rejected: ${result.error||response.status}`);
if(result.verification?.users!==12||result.verification?.memberships!==13||result.verification?.issueEntitlements!==11)throw new Error("Issue E2E fixture read-back failed.");
console.log(JSON.stringify({status:"PROVISIONED",verification:result.verification,users:Object.keys(result.users||{})}));
