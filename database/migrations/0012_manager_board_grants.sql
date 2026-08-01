PRAGMA foreign_keys = ON;

-- Record only grants that are missing or below MANAGE before repairing them.
INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json)
SELECT lower(hex(randomblob(16))),m.user_id,'BOARD_MANAGER_GRANT_REPAIRED','ALLOWED',
       'migration-0012',
       json_object('siteId',m.site_id,'boardKey',b.board_key,'previousAccess',COALESCE(g.access_level,'NONE'))
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
JOIN board_definitions b ON b.is_active=1
LEFT JOIN board_access_grants g
  ON g.site_id=m.site_id AND g.board_id=b.id AND g.user_id=m.user_id AND g.is_active=1
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
  AND COALESCE(g.access_level,'NONE')<>'MANAGE';

UPDATE board_access_grants
SET access_level='MANAGE',revision=revision+1
WHERE is_active=1
  AND EXISTS (
    SELECT 1
    FROM memberships m
    JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
    JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
    WHERE m.status='ACTIVE'
      AND m.user_id=board_access_grants.user_id
      AND m.site_id=board_access_grants.site_id
  )
  AND board_id IN (SELECT id FROM board_definitions WHERE is_active=1)
  AND access_level<>'MANAGE';

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,'MANAGE',m.user_id
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
JOIN board_definitions b ON b.is_active=1
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
GROUP BY m.site_id,b.id,m.user_id;

UPDATE users
SET context_version=context_version+1
WHERE id IN (
  SELECT DISTINCT usr.user_id
  FROM user_site_roles usr
  JOIN roles r ON r.id=usr.role_id
  WHERE usr.status='ACTIVE' AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
);

-- New manager roles receive explicit grants; this is persisted authorization, not a runtime bypass.
CREATE TRIGGER board_grants_after_manager_role_insert
AFTER INSERT ON user_site_roles
WHEN NEW.status='ACTIVE'
 AND EXISTS (
   SELECT 1 FROM roles r
   WHERE r.id=NEW.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
 )
BEGIN
  INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
  SELECT lower(hex(randomblob(16))),NEW.site_id,b.id,NEW.user_id,'MANAGE',NEW.user_id
  FROM board_definitions b
  WHERE b.is_active=1 AND NEW.site_id IS NOT NULL;
END;

-- Newly introduced or newly activated boards receive explicit manager grants.
CREATE TRIGGER board_grants_after_definition_insert
AFTER INSERT ON board_definitions
WHEN NEW.is_active=1
BEGIN
  INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
  SELECT lower(hex(randomblob(16))),m.site_id,NEW.id,m.user_id,'MANAGE',m.user_id
  FROM memberships m
  JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
  JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
  JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
  WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL;
END;

CREATE TRIGGER board_grants_after_definition_activation
AFTER UPDATE OF is_active ON board_definitions
WHEN OLD.is_active=0 AND NEW.is_active=1
BEGIN
  INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
  SELECT lower(hex(randomblob(16))),m.site_id,NEW.id,m.user_id,'MANAGE',m.user_id
  FROM memberships m
  JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
  JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
  JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
  WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL;
END;
