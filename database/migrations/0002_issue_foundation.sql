PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS issue_items (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_by_name_snapshot TEXT NOT NULL,
  contractor_company_id TEXT REFERENCES companies(id),
  contractor_name_snapshot TEXT,
  assigned_to_user_id TEXT REFERENCES users(id),
  assigned_to_name_snapshot TEXT,
  title TEXT NOT NULL,
  location_text TEXT NOT NULL,
  description TEXT NOT NULL,
  category_code TEXT NOT NULL,
  trade_code TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ASSIGNED','ACTION_IN_PROGRESS','COMPLETION_REQUESTED','COMPLETED','REWORK_REQUIRED','CANCELLED')),
  revision INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issue_assignments (
  id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id), assignee_user_id TEXT NOT NULL REFERENCES users(id),
  assigned_by_user_id TEXT NOT NULL REFERENCES users(id), assignee_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REPLACED','CANCELLED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS issue_actions (
  id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id), created_by_user_id TEXT NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL CHECK(action_type IN ('PROGRESS','CORRECTION','NOTE')),
  description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'RECORDED',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS issue_media (
  id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
  action_id TEXT REFERENCES issue_actions(id) ON DELETE CASCADE, site_id TEXT NOT NULL REFERENCES sites(id),
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id), media_role TEXT NOT NULL CHECK(media_role IN ('CREATION','ACTION','COMPLETION')),
  original_key TEXT NOT NULL UNIQUE, thumbnail_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL, original_size INTEGER NOT NULL, thumbnail_size INTEGER NOT NULL,
  width INTEGER, height INTEGER, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DELETED','ORPHANED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS issue_status_history (
  id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id), changed_by_user_id TEXT NOT NULL REFERENCES users(id),
  from_status TEXT, to_status TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issue_completion_requests (
  id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id), requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  reviewed_by_user_id TEXT REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REWORK_REQUIRED','CANCELLED')),
  request_note TEXT, review_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS issue_comments (
  id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id), author_user_id TEXT NOT NULL REFERENCES users(id),
  comment_type TEXT NOT NULL DEFAULT 'GENERAL' CHECK(comment_type IN ('GENERAL','PROGRESS','COMPLETION','REWORK')),
  body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS issue_idempotency (
  user_id TEXT NOT NULL REFERENCES users(id), idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL, resource_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,idempotency_key,operation)
);

CREATE INDEX IF NOT EXISTS idx_issue_items_site_status_created ON issue_items(site_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_items_site_assignee_status ON issue_items(site_id,assigned_to_user_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_items_site_trade_status ON issue_items(site_id,trade_code,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_actions_issue_created ON issue_actions(issue_id,action_type,created_at);
CREATE INDEX IF NOT EXISTS idx_issue_media_issue_created ON issue_media(issue_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_issue_history_issue_created ON issue_status_history(issue_id,created_at);
CREATE INDEX IF NOT EXISTS idx_issue_completion_issue_created ON issue_completion_requests(issue_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_created ON issue_comments(issue_id,created_at);

INSERT OR IGNORE INTO permissions(id,code,module_code) VALUES
 ('perm-issue-read','issue.read','issue'),('perm-issue-create','issue.create','issue'),
 ('perm-issue-assign','issue.assign','issue'),('perm-issue-act','issue.act','issue'),
 ('perm-issue-request-completion','issue.request_completion','issue'),('perm-issue-confirm-completion','issue.confirm_completion','issue'),
 ('perm-issue-rework','issue.rework','issue'),('perm-issue-cancel','issue.cancel','issue'),
 ('perm-issue-delete','issue.delete','issue'),('perm-issue-manage-all','issue.manage_all','issue'),
 ('perm-issue-view-statistics','issue.view_statistics','issue');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='INTEGRATED_OWNER' AND p.module_code='issue';
