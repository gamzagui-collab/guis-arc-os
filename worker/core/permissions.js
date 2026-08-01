export const MODULES=Object.freeze(["today","workforce","construction","issue","safety","quality","materials","equipment","documents","admin"]);
export const MODULE_IMPLEMENTATION=Object.freeze({
 today:"READY",
 workforce:"READY",
 construction:"READY",
 issue:"READY",
 safety:"READY",
 quality:"READY",
 materials:"PLANNED",
 equipment:"PLANNED",
 documents:"PLANNED",
 admin:"READY"
});
const FULL_MENU_ROLES=new Set(["PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER"]);
export const MODULE_PERMISSION=Object.freeze(Object.fromEntries(MODULES.map(code=>[code,`module.${code}.access`])));
export function visibleModulesFromBoards(boardAccess={}){
 const modules=new Set(["today"]);
 for(const [boardKey,value] of Object.entries(boardAccess)){
  if(!value?.accessLevel)continue;
  if(boardKey==="ISSUE")modules.add("issue");
  if(boardKey.startsWith("WORKFORCE_"))modules.add("workforce");
  if(boardKey==="CONSTRUCTION"||boardKey.startsWith("CONSTRUCTION_"))modules.add("construction");
  if(boardKey==="SAFETY"||boardKey.startsWith("SAFETY_"))modules.add("safety");
  if(boardKey==="QUALITY"||boardKey.startsWith("QUALITY_"))modules.add("quality");
  if(boardKey==="MATERIALS")modules.add("materials");
  if(boardKey==="EQUIPMENT")modules.add("equipment");
  if(boardKey==="DOCUMENTS")modules.add("documents");
  if(boardKey==="ADMINISTRATION"||boardKey.startsWith("ADMIN_"))modules.add("admin");
 }
 return MODULES.filter(code=>modules.has(code));
}
export function menuModulesForRoles(modules=[],roleCodes=[]){
 return roleCodes.some(code=>FULL_MENU_ROLES.has(code))?[...MODULES]:[...modules];
}
export function visibleModules(permissions=[],entitlements=[]){const granted=new Set(permissions),allowed=new Set(entitlements);return MODULES.filter(code=>granted.has(MODULE_PERMISSION[code])&&allowed.has(code))}
const MODULE_ROUTES=Object.freeze({issue:"/issues"});
export const defaultRoute=modules=>modules.includes("today")?"/today":modules.includes("workforce")?"/workforce":modules.includes("admin")?"/admin":modules[0]?(MODULE_ROUTES[modules[0]]||`/${modules[0]}`):null;
