PRAGMA foreign_keys = ON;

CREATE TABLE engine_registry (
  engine_name TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  definition_hash TEXT NOT NULL,
  registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(engine_name,engine_version)
);

CREATE TABLE engine_history (
  execution_id TEXT PRIMARY KEY,
  engine_name TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  site_id TEXT,
  entity_revision INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result_json TEXT NOT NULL CHECK(length(result_json)<=8192),
  success INTEGER NOT NULL CHECK(success IN (0,1)),
  requires_review INTEGER NOT NULL DEFAULT 0 CHECK(requires_review IN (0,1)),
  actor_user_id TEXT REFERENCES users(id),
  operation_id TEXT,
  idempotency_key TEXT NOT NULL,
  error_code TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(engine_name,idempotency_key),
  FOREIGN KEY(engine_name,engine_version) REFERENCES engine_registry(engine_name,engine_version)
);
CREATE INDEX idx_engine_history_entity ON engine_history(entity_type,entity_id,created_at DESC);
CREATE INDEX idx_engine_history_site_engine ON engine_history(site_id,engine_name,created_at DESC);
CREATE INDEX idx_engine_history_version_event ON engine_history(engine_name,engine_version,event_type,created_at DESC);

CREATE TABLE engine_metrics (
  engine_name TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  evaluation_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  decision_count INTEGER NOT NULL DEFAULT 0,
  override_count INTEGER NOT NULL DEFAULT 0,
  duration_ms_total INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(engine_name,engine_version,metric_date,event_type),
  FOREIGN KEY(engine_name,engine_version) REFERENCES engine_registry(engine_name,engine_version)
);

ALTER TABLE issue_department_recommendations ADD COLUMN latest_engine_execution_id TEXT REFERENCES engine_history(execution_id);
CREATE INDEX idx_issue_department_execution ON issue_department_recommendations(latest_engine_execution_id);
