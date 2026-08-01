const MODULES=["today","workforce","construction","issue","safety","quality","materials","equipment","documents","admin"];
const permissionCode=module=>`module.${module}.access`;

export async function provisionAdministrator(repository,input){
 if(await repository.findUser(input.identifier))throw new Error("ADMIN_IDENTIFIER_EXISTS");
 const companies=await repository.findCompanies(input.companyName);if(companies.length>1)throw new Error("AMBIGUOUS_COMPANY_NAME");
 const company=companies[0]||{id:crypto.randomUUID(),name:input.companyName,isNew:true};
 let site=null;if(input.siteName){const sites=await repository.findSites(company.id,input.siteName);if(sites.length>1)throw new Error("AMBIGUOUS_SITE_NAME");site=sites[0]||{id:crypto.randomUUID(),companyId:company.id,name:input.siteName,isNew:true}}
 const role=await repository.findRole(input.roleCode)||{id:crypto.randomUUID(),code:input.roleCode,name:"Integrated Administrator",rank:1000,isNew:true};
 const permissions=[];for(const module of MODULES){const code=permissionCode(module),existing=await repository.findPermission(code);if(existing&&existing.moduleCode!==module)throw new Error("PERMISSION_MODULE_MISMATCH");permissions.push(existing||{id:crypto.randomUUID(),code,moduleCode:module,isNew:true})}
 const user={id:crypto.randomUUID(),identifier:input.identifier,displayName:input.displayName,credentialHash:input.credentialHash,credentialSalt:input.credentialSalt,credentialIterations:input.credentialIterations};
 await repository.atomicCreate({user,company,site,role,permissions,modules:MODULES,requestId:input.requestId});
 const verification=await repository.readBack(user.id,input.requestId);if(!verification.user||!verification.company||Boolean(input.siteName)!==verification.site||!verification.membership||!verification.role||verification.permissions!==10||verification.entitlements!==10||!verification.audit)throw new Error("PROVISIONING_READBACK_FAILED");
 return {userId:user.id,companyId:company.id,siteId:site?.id||null,roleCode:role.code,verification};
}

export function d1ProvisioningRepository(db){
 const all=async(statement,...values)=>(await db.prepare(statement).bind(...values).all()).results||[];
 const first=async(statement,...values)=>db.prepare(statement).bind(...values).first();
 return {
  findUser:identifier=>first("SELECT id FROM users WHERE login_identifier=?1",identifier),
  findCompanies:name=>all("SELECT id,name FROM companies WHERE name=?1 AND status='ACTIVE'",name),
  findSites:(companyId,name)=>all("SELECT id,company_id AS companyId,name FROM sites WHERE company_id=?1 AND name=?2 AND status='ACTIVE'",companyId,name),
  findRole:async code=>{const row=await first("SELECT id,code,name,rank FROM roles WHERE code=?1",code);return row||null},
  findPermission:async code=>{const row=await first("SELECT id,code,module_code AS moduleCode FROM permissions WHERE code=?1",code);return row||null},
  async atomicCreate(data){const q=(sql,...values)=>db.prepare(sql).bind(...values),statements=[];if(data.company.isNew)statements.push(q("INSERT INTO companies(id,name) VALUES(?1,?2)",data.company.id,data.company.name));if(data.site?.isNew)statements.push(q("INSERT INTO sites(id,company_id,name) VALUES(?1,?2,?3)",data.site.id,data.company.id,data.site.name));if(data.role.isNew)statements.push(q("INSERT INTO roles(id,code,name,rank) VALUES(?1,?2,?3,?4)",data.role.id,data.role.code,data.role.name,data.role.rank));for(const permission of data.permissions)if(permission.isNew)statements.push(q("INSERT INTO permissions(id,code,module_code) VALUES(?1,?2,?3)",permission.id,permission.code,permission.moduleCode));statements.push(q("INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations) VALUES(?1,?2,?3,?4,?5,?6)",data.user.id,data.user.identifier,data.user.displayName,data.user.credentialHash,data.user.credentialSalt,data.user.credentialIterations),q("INSERT INTO memberships(id,user_id,company_id,site_id) VALUES(?1,?2,?3,?4)",crypto.randomUUID(),data.user.id,data.company.id,data.site?.id||null));for(const permission of data.permissions)statements.push(q("INSERT OR IGNORE INTO role_permissions(role_id,permission_id) VALUES(?1,?2)",data.role.id,permission.id));for(const module of data.modules)statements.push(q("INSERT INTO module_entitlements(id,user_id,module_code) VALUES(?1,?2,?3)",crypto.randomUUID(),data.user.id,module));statements.push(q("INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id) VALUES(?1,?2,?3,?4,?5)",crypto.randomUUID(),data.user.id,data.role.id,data.company.id,data.site?.id||null),q("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,'ADMIN_PROVISIONED','ALLOWED',?3,?4)",crypto.randomUUID(),data.user.id,data.requestId,JSON.stringify({roleCode:data.role.code,companyReused:!data.company.isNew,siteReused:Boolean(data.site&&!data.site.isNew)})));await db.batch(statements)},
  async readBack(userId,requestId){const row=await first("SELECT EXISTS(SELECT 1 FROM users WHERE id=?1) AS user,EXISTS(SELECT 1 FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=?1) AS company,EXISTS(SELECT 1 FROM memberships m JOIN sites s ON s.id=m.site_id WHERE m.user_id=?1) AS site,EXISTS(SELECT 1 FROM memberships WHERE user_id=?1) AS membership,EXISTS(SELECT 1 FROM user_site_roles WHERE user_id=?1) AS role,(SELECT COUNT(*) FROM role_permissions rp JOIN user_site_roles usr ON usr.role_id=rp.role_id WHERE usr.user_id=?1) AS permissions,(SELECT COUNT(*) FROM module_entitlements WHERE user_id=?1 AND status='ACTIVE') AS entitlements,EXISTS(SELECT 1 FROM audit_logs WHERE actor_user_id=?1 AND request_id=?2 AND action='ADMIN_PROVISIONED') AS audit",userId,requestId);return {user:Boolean(row.user),company:Boolean(row.company),site:Boolean(row.site),membership:Boolean(row.membership),role:Boolean(row.role),permissions:Number(row.permissions),entitlements:Number(row.entitlements),audit:Boolean(row.audit)}}
 };
}

export const ADMIN_MODULE_COUNT=MODULES.length;
