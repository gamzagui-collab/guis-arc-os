ALTER TABLE construction_daily_report_uploads
ADD COLUMN content_hash TEXT;

ALTER TABLE construction_daily_report_uploads
ADD COLUMN content_snapshot_json TEXT;

CREATE INDEX IF NOT EXISTS idx_construction_daily_report_uploads_content
ON construction_daily_report_uploads(site_id, work_date_kst, status, content_hash);

CREATE TABLE IF NOT EXISTS construction_daily_report_upload_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('AUTO_NEW', 'CONFIRM_CHANGED')),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES construction_daily_report_upload_sessions(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(session_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_construction_daily_report_upload_actions_session
ON construction_daily_report_upload_actions(session_id, created_at DESC);
