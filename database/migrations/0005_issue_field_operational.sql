PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
 ('module.issue.access','issue.read','issue.create')
WHERE r.code='FIELD_WORKER';

CREATE INDEX IF NOT EXISTS idx_issue_items_site_creator_status
ON issue_items(site_id,created_by_user_id,status,created_at DESC);
