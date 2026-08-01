PRAGMA foreign_keys = ON;

CREATE TABLE construction_daily_report_upload_sessions (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 original_file_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=52428800),
 sha256_hex TEXT NOT NULL,
 r2_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'CREATED'
  CHECK(status IN ('CREATED','ANALYZED','CONFIRMED','FAILED','EXPIRED')),
 analysis_json TEXT,
 failure_code TEXT,
 confirmation_key TEXT,
 confirmation_result_json TEXT,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 analyzed_at TEXT,
 confirmed_at TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_construction_upload_session_owner
 ON construction_daily_report_upload_sessions(site_id,user_id,status,expires_at);
