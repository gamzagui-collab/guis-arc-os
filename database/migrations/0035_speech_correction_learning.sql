PRAGMA foreign_keys = ON;

CREATE TABLE speech_correction_events (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  issue_id TEXT REFERENCES issue_items(id) ON DELETE SET NULL,
  raw_transcript TEXT NOT NULL CHECK(length(raw_transcript) BETWEEN 1 AND 4000),
  normalized_transcript TEXT NOT NULL CHECK(length(normalized_transcript) BETWEEN 1 AND 4000),
  parser_snapshot_json TEXT NOT NULL CHECK(json_valid(parser_snapshot_json) AND length(parser_snapshot_json) <= 8192),
  final_snapshot_json TEXT NOT NULL CHECK(json_valid(final_snapshot_json) AND length(final_snapshot_json) <= 8192),
  applied_rule_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(applied_rule_ids_json) AND length(applied_rule_ids_json) <= 4096),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_speech_correction_events_site_created
ON speech_correction_events(site_id, created_at);

CREATE TABLE speech_correction_rules (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL DEFAULT 'SITE' CHECK(scope_type = 'SITE'),
  site_id TEXT NOT NULL REFERENCES sites(id),
  field_type TEXT NOT NULL CHECK(field_type IN ('LOCATION_BUILDING','LOCATION_FLOOR','LOCATION_UNIT','LOCATION_ROOM','CONTENT_TERM')),
  raw_normalized TEXT NOT NULL CHECK(length(raw_normalized) BETWEEN 1 AND 4000),
  corrected_value TEXT NOT NULL CHECK(length(corrected_value) BETWEEN 1 AND 4000),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(evidence_count >= 0),
  negative_evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(negative_evidence_count >= 0),
  confidence REAL NOT NULL DEFAULT 0 CHECK(confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'CANDIDATE' CHECK(status IN ('CANDIDATE','ACTIVE','DISABLED')),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, field_type, raw_normalized, corrected_value)
);

CREATE INDEX idx_speech_correction_rules_lookup
ON speech_correction_rules(site_id, field_type, status, raw_normalized);
