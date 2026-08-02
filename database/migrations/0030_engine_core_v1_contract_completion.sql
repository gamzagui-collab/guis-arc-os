PRAGMA foreign_keys = ON;

ALTER TABLE engine_registry ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE engine_registry ADD COLUMN rule_version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE engine_registry ADD COLUMN schema_version TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE engine_registry ADD COLUMN status TEXT NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE engine_registry ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1));

-- Keep the original non-null value without rebuilding the FK target table.
ALTER TABLE engine_history RENAME COLUMN entity_revision TO legacy_entity_revision;
ALTER TABLE engine_history ADD COLUMN entity_revision INTEGER;
UPDATE engine_history SET entity_revision=legacy_entity_revision;
ALTER TABLE engine_history ADD COLUMN rule_version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE engine_history ADD COLUMN schema_version TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE engine_history ADD COLUMN recommendation_json TEXT CHECK(recommendation_json IS NULL OR length(recommendation_json)<=8192);
ALTER TABLE engine_history ADD COLUMN match_score INTEGER;
ALTER TABLE engine_history ADD COLUMN match_level TEXT;
ALTER TABLE engine_history ADD COLUMN candidate_json TEXT CHECK(candidate_json IS NULL OR length(candidate_json)<=8192);
ALTER TABLE engine_history ADD COLUMN reason_json TEXT CHECK(reason_json IS NULL OR length(reason_json)<=8192);
ALTER TABLE engine_history ADD COLUMN conflict INTEGER NOT NULL DEFAULT 0 CHECK(conflict IN (0,1));
ALTER TABLE engine_history ADD COLUMN result TEXT NOT NULL DEFAULT 'SUCCEEDED';
UPDATE engine_history SET result=CASE WHEN success=1 THEN 'SUCCEEDED' ELSE 'FAILED' END;
ALTER TABLE engine_history ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN (0,1));
ALTER TABLE engine_history ADD COLUMN override INTEGER NOT NULL DEFAULT 0 CHECK(override IN (0,1));
ALTER TABLE engine_history ADD COLUMN confirmed_by_user_id TEXT REFERENCES users(id);
ALTER TABLE engine_history ADD COLUMN confirmed_at TEXT;
ALTER TABLE engine_history ADD COLUMN override_reason TEXT;
ALTER TABLE engine_history ADD COLUMN override_note TEXT;
ALTER TABLE engine_history ADD COLUMN linked_execution_id TEXT REFERENCES engine_history(execution_id);
ALTER TABLE engine_history ADD COLUMN evaluated_at TEXT;
UPDATE engine_history SET evaluated_at=created_at WHERE evaluated_at IS NULL;

CREATE INDEX idx_engine_history_engine_evaluated ON engine_history(engine_name,evaluated_at DESC);
CREATE INDEX idx_engine_history_site_evaluated ON engine_history(site_id,evaluated_at DESC);
CREATE INDEX idx_engine_history_input_hash ON engine_history(input_hash);
CREATE INDEX idx_engine_history_linked_execution ON engine_history(linked_execution_id);
CREATE INDEX idx_engine_history_entity_evaluated ON engine_history(entity_type,entity_id,evaluated_at DESC);

ALTER TABLE engine_metrics ADD COLUMN execution_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_metrics ADD COLUMN total_execution_time_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_metrics ADD COLUMN last_execution_time_ms INTEGER;
ALTER TABLE engine_metrics ADD COLUMN last_evaluated_at TEXT;
