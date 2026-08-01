const IDS=Object.freeze({company:"e2e-v021-company",contractorA:"e2e-v021-contractor-a",contractorB:"e2e-v021-contractor-b",siteA:"e2e-v021-site-a",siteB:"e2e-v021-site-b"});
const PRINCIPALS=Object.freeze({
 site_manager:{role:"SITE_MANAGER",company:IDS.company,sites:[IDS.siteA,IDS.siteB],issue:true},
 gc_staff:{role:"GENERAL_CONTRACTOR_STAFF",company:IDS.company,sites:[IDS.siteA],issue:true},
 contractor_manager:{role:"CONTRACTOR_MANAGER",company:IDS.contractorA,sites:[IDS.siteA],issue:true},
 contractor_b_manager:{role:"CONTRACTOR_MANAGER",company:IDS.contractorB,sites:[IDS.siteA],issue:true},
 contractor_assignee:{role:"CONTRACTOR_ASSIGNEE",company:IDS.contractorA,sites:[IDS.siteA],issue:true},
 no_access:{role:"NO_ISSUE_ACCESS",company:IDS.company,sites:[IDS.siteA],issue:false},
 field_worker:{role:"FIELD_WORKER",company:IDS.contractorA,sites:[IDS.siteA],issue:true}
});

export async function provisionIssueE2EFixture(db,input,requestId){
 const credentials=input?.credentials;
 if(!credentials||Object.keys(PRINCIPALS).some(key=>!credentials[key]))throw new Error("E2E_FIXTURE_INPUT_INVALID");
 const identifiers=Object.values(credentials).map(value=>String(value.identifier||"").toLowerCase());
 if(new Set(identifiers).size!==identifiers.length||identifiers.some(value=>!value.startsWith("e2e-v021-")))throw new Error("E2E_FIXTURE_IDENTIFIER_INVALID");
 const roles=(await db.prepare("SELECT id,code FROM roles WHERE code IN ('SITE_MANAGER','GENERAL_CONTRACTOR_STAFF','CONTRACTOR_MANAGER','CONTRACTOR_ASSIGNEE','NO_ISSUE_ACCESS','FIELD_WORKER')").all()).results||[],roleMap=Object.fromEntries(roles.map(role=>[role.code,role.id]));
 if(Object.values(PRINCIPALS).some(principal=>!roleMap[principal.role]))throw new Error("E2E_FIXTURE_ROLE_MISSING");
 const q=(sql,...values)=>db.prepare(sql).bind(...values),statements=[
  q("INSERT OR IGNORE INTO companies(id,name,status) VALUES(?1,'E2E v0.2.1 General Contractor','ACTIVE')",IDS.company),
  q("INSERT OR IGNORE INTO companies(id,name,status) VALUES(?1,'E2E v0.2.1 Contractor A','ACTIVE')",IDS.contractorA),
  q("INSERT OR IGNORE INTO companies(id,name,status) VALUES(?1,'E2E v0.2.1 Contractor B','ACTIVE')",IDS.contractorB),
  q("INSERT OR IGNORE INTO sites(id,company_id,name,status) VALUES(?1,?2,'E2E v0.2.1 Site A','ACTIVE')",IDS.siteA,IDS.company),
  q("INSERT OR IGNORE INTO sites(id,company_id,name,status) VALUES(?1,?2,'E2E v0.2.1 Site B','ACTIVE')",IDS.siteB,IDS.company),
  q("INSERT OR IGNORE INTO company_site_contracts(id,company_id,site_id,contractor_type,trade_code,status) VALUES('e2e-v021-contract-a',?1,?2,'SUBCONTRACTOR','E2E_TRADE_A','ACTIVE')",IDS.contractorA,IDS.siteA),
  q("INSERT OR IGNORE INTO company_site_contracts(id,company_id,site_id,contractor_type,trade_code,status) VALUES('e2e-v021-contract-b',?1,?2,'SUBCONTRACTOR','E2E_TRADE_B','ACTIVE')",IDS.contractorB,IDS.siteA)
 ];
 const result={sites:{siteA:IDS.siteA,siteB:IDS.siteB},companies:{general:IDS.company,contractorA:IDS.contractorA,contractorB:IDS.contractorB},users:{}};
 for(const [key,principal] of Object.entries(PRINCIPALS)){
  const credential=credentials[key],userId=`e2e-v021-user-${key.replaceAll("_","-")}`;
  if(!/^[a-f0-9]{64}$/.test(String(credential.credentialHash||""))||!credential.credentialSalt||Number(credential.credentialIterations)!==100000)throw new Error("E2E_FIXTURE_CREDENTIAL_INVALID");
  statements.push(q("INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES(?1,?2,?3,?4,?5,100000,'ACTIVE') ON CONFLICT(id) DO UPDATE SET credential_hash=excluded.credential_hash,credential_salt=excluded.credential_salt,credential_iterations=excluded.credential_iterations,status='ACTIVE',context_version=context_version+1",userId,String(credential.identifier).toLowerCase(),String(credential.displayName||key),credential.credentialHash,credential.credentialSalt));
  for(const siteId of principal.sites){const suffix=`${key.replaceAll("_","-")}-${siteId.endsWith("-b")?"b":"a"}`;statements.push(q("INSERT INTO memberships(id,user_id,company_id,site_id,status) VALUES(?1,?2,?3,?4,'ACTIVE') ON CONFLICT(user_id,company_id,site_id) DO UPDATE SET status='ACTIVE'",`e2e-v021-membership-${suffix}`,userId,principal.company,siteId),q("INSERT OR REPLACE INTO user_site_roles(id,user_id,role_id,company_id,site_id,status) VALUES(?1,?2,?3,?4,?5,'ACTIVE')",`e2e-v021-role-${suffix}`,userId,roleMap[principal.role],principal.company,siteId))}
  if(principal.issue)statements.push(q("INSERT INTO module_entitlements(id,user_id,module_code,status) VALUES(?1,?2,'issue','ACTIVE') ON CONFLICT(user_id,module_code) DO UPDATE SET status='ACTIVE'",`e2e-v021-entitlement-${key.replaceAll("_","-")}`,userId));
  result.users[key]=userId;
 }
 statements.push(q("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,NULL,'ISSUE_E2E_FIXTURE_PROVISIONED','ALLOWED',?2,?3)",crypto.randomUUID(),requestId,JSON.stringify({namespace:"e2e-v021",principalCount:Object.keys(PRINCIPALS).length})));
 await db.batch(statements);
 const readBack=await db.prepare("SELECT COUNT(*) AS users,(SELECT COUNT(*) FROM memberships WHERE user_id LIKE 'e2e-v021-user-%') AS memberships,(SELECT COUNT(*) FROM module_entitlements WHERE user_id LIKE 'e2e-v021-user-%' AND module_code='issue' AND status='ACTIVE') AS issue_entitlements FROM users WHERE id LIKE 'e2e-v021-user-%'").first();
 if(Number(readBack.users)!==7||Number(readBack.memberships)!==8||Number(readBack.issue_entitlements)!==6)throw new Error("E2E_FIXTURE_READBACK_FAILED");
 return {...result,verification:{users:7,memberships:8,issueEntitlements:6,audit:true}};
}
