import {createInternalTestCredentials,INTERNAL_TEST_ACCOUNT_KEYS} from "./internal-test-auth.mjs";

const endpoint="https://guis-arc-integrated-api-dev.gamzagui.workers.dev/api/internal/integration/issue-e2e-provision";
const secret=process.env.GUI_ARC_E2E_PROVISIONING_SECRET;
const pinMap=JSON.parse(process.env.GUI_ARC_E2E_PINS||"{}");
const keys=INTERNAL_TEST_ACCOUNT_KEYS;
if(!secret||keys.some(key=>!/^[0-9]{4}$/.test(String(pinMap[key]||""))))throw new Error("Protected E2E input is missing.");
const credentials=Object.fromEntries(keys.map(key=>[key,createInternalTestCredentials(pinMap[key])[key]]));
let response,result;for(let attempt=0;attempt<20;attempt++){response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-provisioning-secret":secret},body:JSON.stringify({credentials})});result=await response.json().catch(()=>({error:"NON_JSON_RESPONSE"}));if(![403,404].includes(response.status))break;await new Promise(resolve=>setTimeout(resolve,1500))}
if(!response.ok)throw new Error(`Issue E2E fixture rejected: ${result.error||response.status}`);
if(result.verification?.users!==12||result.verification?.memberships!==13||result.verification?.roles!==13||result.verification?.issueEntitlements!==11)throw new Error("Issue E2E fixture read-back failed.");
console.log(JSON.stringify({status:"PROVISIONED",verification:result.verification,users:Object.keys(result.users||{})}));
