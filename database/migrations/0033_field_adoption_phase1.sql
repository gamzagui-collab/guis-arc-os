-- GUI's Arc v0.27.0 Field Adoption Phase 1

PRAGMA foreign_keys=ON;

CREATE TABLE issue_source_references(
 issue_id TEXT PRIMARY KEY REFERENCES issue_items(id) ON DELETE CASCADE,
 site_id TEXT NOT NULL REFERENCES sites(id),
 source_type TEXT NOT NULL CHECK(source_type IN ('CONSTRUCTION_DAILY_REPORT','CONSTRUCTION_MONTHLY_PLAN')),
 source_id TEXT NOT NULL,
 source_revision INTEGER NOT NULL CHECK(source_revision>=1),
 work_date TEXT NOT NULL,
 source_item_refs_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(source_item_refs_json) AND length(source_item_refs_json)<=16384),
 source_snapshot_json TEXT NOT NULL CHECK(json_valid(source_snapshot_json) AND length(source_snapshot_json)<=8192),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_issue_source_site_type_id
 ON issue_source_references(site_id,source_type,source_id);

CREATE TABLE issue_assignee_responses(
 id TEXT PRIMARY KEY,
 issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
 site_id TEXT NOT NULL REFERENCES sites(id),
 response TEXT NOT NULL CHECK(response IN ('ACKNOWLEDGED','NOT_MY_RESPONSIBILITY','DUE_DATE_DISCUSSION','BLOCKED')),
 note TEXT CHECK(note IS NULL OR length(note)<=500),
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 response_revision INTEGER NOT NULL CHECK(response_revision>=1),
 responded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(issue_id,response_revision)
);

CREATE INDEX idx_issue_assignee_response_latest
 ON issue_assignee_responses(issue_id,response_revision DESC);

CREATE INDEX idx_issue_assignee_response_attention
 ON issue_assignee_responses(site_id,response,response_revision DESC);
