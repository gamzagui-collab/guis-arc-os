import {createInternalTestCredentials} from "./internal-test-auth.mjs";

const allowed=new Set(["plan","apply","show","disable","enable"]),action=String(process.argv[2]||"plan").toLowerCase();
if(!allowed.has(action))throw new Error("사용법: npm run internal-test:manage -- plan|apply|show|disable|enable");
if(process.env.GUI_ARC_TARGET==="production")throw new Error("Production target is forbidden.");
if(process.env.GUI_ARC_TARGET!=="integration")throw new Error("GUI_ARC_TARGET=integration 확인이 필요합니다.");
const secret=process.env.GUI_ARC_E2E_PROVISIONING_SECRET;
if(!secret)throw new Error("Integration provisioning secret이 필요합니다.");
const body={action:action.toUpperCase()};
if(action==="apply"){
 body.credentials=createInternalTestCredentials(process.env.GUI_ARC_INTERNAL_TEST_PIN);
}
const response=await fetch("https://guis-arc-integrated-api-dev.gamzagui.workers.dev/api/internal/integration/internal-test-site",{method:"POST",headers:{"content-type":"application/json","x-provisioning-secret":secret},body:JSON.stringify(body)}),result=await response.json().catch(()=>({error:"NON_JSON_RESPONSE"}));
if(!response.ok)throw new Error(`Internal test site ${action} rejected: ${result.error||response.status}`);
console.log(JSON.stringify({action:result.action,current:result.current,verification:result.result?.verification||null}));
