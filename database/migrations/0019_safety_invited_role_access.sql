INSERT OR IGNORE INTO board_access_grants(
  id,site_id,board_id,user_id,access_level,granted_by_user_id
)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,
 CASE
  WHEN r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER') THEN 'MANAGE'
  WHEN r.code IN ('CONSTRUCTION_MANAGER','GENERAL_CONTRACTOR_FOREMAN') THEN
   CASE WHEN b.board_key IN ('SAFETY_CASE','SAFETY_CORRECTIVE_ACTION') THEN 'EDIT' ELSE 'VIEW' END
  WHEN r.code IN ('CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','CONTRACTOR_FOREMAN') THEN
   CASE WHEN b.board_key IN ('SAFETY_CASE','SAFETY_CORRECTIVE_ACTION','SAFETY_PERIODIC_TASK') THEN 'EDIT' ELSE 'VIEW' END
  ELSE 'VIEW'
 END,
 m.user_id
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id
JOIN board_definitions b ON b.board_key IN (
 'SAFETY_CASE','SAFETY_RISK_ASSESSMENT','SAFETY_CORRECTIVE_ACTION',
 'SAFETY_ROOT_CAUSE','SAFETY_DASHBOARD','SAFETY_PERIODIC_TASK'
)
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
 AND r.code IN (
  'PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER',
  'CONSTRUCTION_MANAGER','GENERAL_CONTRACTOR_FOREMAN',
  'CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','CONTRACTOR_FOREMAN'
 )
GROUP BY m.site_id,b.id,m.user_id;

INSERT OR IGNORE INTO module_entitlements(id,user_id,module_code,status)
SELECT lower(hex(randomblob(16))),g.user_id,'safety','ACTIVE'
FROM board_access_grants g
JOIN board_definitions b ON b.id=g.board_id
WHERE g.is_active=1 AND b.module_key='safety';

UPDATE users SET context_version=context_version+1
WHERE id IN (
 SELECT DISTINCT g.user_id
 FROM board_access_grants g
 JOIN board_definitions b ON b.id=g.board_id
 WHERE g.is_active=1 AND b.module_key='safety'
);
