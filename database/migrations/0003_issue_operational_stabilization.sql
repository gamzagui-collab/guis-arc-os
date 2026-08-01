PRAGMA foreign_keys = ON;

ALTER TABLE issue_idempotency ADD COLUMN payload_hash TEXT;
ALTER TABLE issue_idempotency ADD COLUMN expires_at TEXT;

INSERT OR IGNORE INTO roles(id,code,name,rank) VALUES
 ('role-site-manager','SITE_MANAGER','Site Manager',800),
 ('role-general-contractor-staff','GENERAL_CONTRACTOR_STAFF','General Contractor Staff',500),
 ('role-contractor-manager','CONTRACTOR_MANAGER','Contractor Manager',400),
 ('role-contractor-assignee','CONTRACTOR_ASSIGNEE','Contractor Assignee',300),
 ('role-no-issue-access','NO_ISSUE_ACCESS','No Issue Access',100),
 ('role-field-worker','FIELD_WORKER','Field Worker',50);

INSERT OR IGNORE INTO permissions(id,code,module_code)
VALUES('perm-module-issue-access','module.issue.access','issue');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.module_code='issue'
WHERE r.code='SITE_MANAGER';

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
 ('issue.read','issue.create','issue.assign','issue.act','issue.request_completion')
WHERE r.code='GENERAL_CONTRACTOR_STAFF';

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
 ('issue.read','issue.create','issue.assign','issue.act','issue.request_completion')
WHERE r.code='CONTRACTOR_MANAGER';

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
 ('issue.read','issue.act','issue.request_completion')
WHERE r.code='CONTRACTOR_ASSIGNEE';

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code='module.issue.access'
WHERE r.code IN ('SITE_MANAGER','GENERAL_CONTRACTOR_STAFF','CONTRACTOR_MANAGER','CONTRACTOR_ASSIGNEE');

CREATE INDEX IF NOT EXISTS idx_issue_idempotency_expiry
ON issue_idempotency(expires_at);
