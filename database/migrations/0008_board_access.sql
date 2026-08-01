PRAGMA foreign_keys = ON;

CREATE TABLE board_definitions (
  id TEXT PRIMARY KEY,
  board_key TEXT NOT NULL UNIQUE,
  module_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  contains_sensitive_data INTEGER NOT NULL DEFAULT 0 CHECK(contains_sensitive_data IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE board_access_grants (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  board_id TEXT NOT NULL REFERENCES board_definitions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  access_level TEXT NOT NULL CHECK(access_level IN ('VIEW','EDIT','MANAGE')),
  granted_by_user_id TEXT REFERENCES users(id),
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_by_user_id TEXT REFERENCES users(id),
  revoked_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_board_access_active_user
ON board_access_grants(site_id,board_id,user_id) WHERE is_active=1;
CREATE INDEX idx_board_access_lookup
ON board_access_grants(user_id,site_id,board_id,is_active);
CREATE INDEX idx_board_access_history
ON board_access_grants(site_id,board_id,user_id,granted_at);

INSERT INTO board_definitions(id,board_key,module_key,display_name,contains_sensitive_data,is_active) VALUES
 ('board-issue','ISSUE','issue','Issue',0,1),
 ('board-workforce-profile','WORKFORCE_PROFILE','workforce','Workforce 근로자',1,1),
 ('board-workforce-attendance','WORKFORCE_ATTENDANCE','workforce','Workforce 출역기록',1,1),
 ('board-construction','CONSTRUCTION','construction','Construction',0,0),
 ('board-safety','SAFETY','safety','Safety',0,0),
 ('board-quality','QUALITY','quality','Quality',0,0),
 ('board-materials','MATERIALS','materials','Materials',0,0),
 ('board-equipment','EQUIPMENT','equipment','Equipment',0,0),
 ('board-documents','DOCUMENTS','documents','Documents',1,0);

-- Masters and site managers receive explicit MANAGE grants only for their active sites.
INSERT INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,'MANAGE',m.user_id
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
JOIN board_definitions b ON b.is_active=1
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
GROUP BY m.site_id,b.id,m.user_id;

-- Preserve confirmed Issue access without broadening the existing role policy.
INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,'board-issue',m.user_id,
 CASE WHEN MAX(CASE WHEN p.code='issue.manage_all' THEN 1 ELSE 0 END)=1 THEN 'MANAGE'
      WHEN MAX(CASE WHEN p.code IN ('issue.create','issue.assign','issue.act','issue.request_completion','issue.confirm_completion','issue.rework','issue.cancel') THEN 1 ELSE 0 END)=1 THEN 'EDIT'
      ELSE 'VIEW' END,
 NULL
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN module_entitlements me ON me.user_id=m.user_id AND me.module_code='issue' AND me.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN role_permissions rp ON rp.role_id=usr.role_id
JOIN permissions p ON p.id=rp.permission_id AND p.code LIKE 'issue.%'
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
GROUP BY m.site_id,m.user_id;

-- Preserve only confirmed Workforce access; existing self/company/site policy remains mandatory.
INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,
 CASE WHEN MAX(CASE WHEN p.code IN ('workforce.enroll','workforce.approve','workforce.reject','workforce.check_in','workforce.adjust','workforce.manage_devices') THEN 1 ELSE 0 END)=1 THEN 'EDIT'
      ELSE 'VIEW' END,
 NULL
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN module_entitlements me ON me.user_id=m.user_id AND me.module_code='workforce' AND me.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN role_permissions rp ON rp.role_id=usr.role_id
JOIN permissions p ON p.id=rp.permission_id AND p.code LIKE 'workforce.%'
JOIN board_definitions b ON b.board_key IN ('WORKFORCE_PROFILE','WORKFORCE_ATTENDANCE')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
GROUP BY m.site_id,b.id,m.user_id;
