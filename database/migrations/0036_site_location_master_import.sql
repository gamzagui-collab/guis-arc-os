PRAGMA foreign_keys = ON;

ALTER TABLE site_locations ADD COLUMN canonical_key TEXT;
ALTER TABLE site_locations ADD COLUMN source TEXT NOT NULL DEFAULT 'LEGACY'
  CHECK(source IN ('LEGACY','MANUAL','IMPORT'));

CREATE TRIGGER site_locations_import_canonical_key_insert
BEFORE INSERT ON site_locations
WHEN NEW.source='IMPORT' AND trim(COALESCE(NEW.canonical_key,''))=''
BEGIN SELECT RAISE(ABORT,'SITE_LOCATION_IMPORT_CANONICAL_KEY_REQUIRED'); END;

CREATE TRIGGER site_locations_import_canonical_key_update
BEFORE UPDATE OF canonical_key,source ON site_locations
WHEN NEW.source='IMPORT' AND trim(COALESCE(NEW.canonical_key,''))=''
BEGIN SELECT RAISE(ABORT,'SITE_LOCATION_IMPORT_CANONICAL_KEY_REQUIRED'); END;

CREATE UNIQUE INDEX idx_site_locations_site_canonical_key
ON site_locations(site_id,canonical_key)
WHERE canonical_key IS NOT NULL;

CREATE UNIQUE INDEX idx_site_locations_site_id ON site_locations(site_id,id);
CREATE TABLE site_location_master_revisions (site_id TEXT PRIMARY KEY REFERENCES sites(id),revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0));
INSERT INTO site_location_master_revisions(site_id,revision) SELECT id,0 FROM sites;
CREATE TRIGGER sites_location_master_revision_insert AFTER INSERT ON sites BEGIN INSERT INTO site_location_master_revisions(site_id,revision) VALUES(NEW.id,0) ON CONFLICT(site_id) DO NOTHING; END;

CREATE TABLE site_location_import_apply_guards (id TEXT PRIMARY KEY,guard_value TEXT NOT NULL);
CREATE TRIGGER site_location_import_apply_guard_reject BEFORE INSERT ON site_location_import_apply_guards WHEN NEW.guard_value<>'VALID' BEGIN SELECT RAISE(ABORT,'LOCATION_IMPORT_PREVIEW_STALE'); END;
CREATE TRIGGER site_location_import_apply_guard_cleanup AFTER INSERT ON site_location_import_apply_guards BEGIN DELETE FROM site_location_import_apply_guards WHERE id=NEW.id; END;

CREATE TABLE site_location_aliases (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  location_id TEXT NOT NULL,
  alias_text TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL
    CHECK(alias_type IN ('OFFICIAL_VARIANT','FIELD_NAME','LEGACY_NAME')),
  source TEXT NOT NULL DEFAULT 'IMPORT'
    CHECK(source IN ('LEGACY','MANUAL','IMPORT')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id,normalized_alias),
  FOREIGN KEY(site_id,location_id) REFERENCES site_locations(site_id,id)
);

CREATE INDEX idx_site_location_aliases_site_location_active
ON site_location_aliases(site_id,location_id,is_active);

CREATE TABLE site_location_imports (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  r2_object_key TEXT,
  artifact_object_key TEXT,
  template_version TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK(status IN ('UPLOADED','VALIDATING','INVALID','READY','APPLYING','APPLIED','FAILED','CANCELLED')),
  base_master_fingerprint TEXT,
  preview_hash TEXT,
  base_master_revision INTEGER,
  post_master_fingerprint TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TEXT,
  applied_at TEXT,
  added_count INTEGER NOT NULL DEFAULT 0 CHECK(added_count >= 0),
  updated_count INTEGER NOT NULL DEFAULT 0 CHECK(updated_count >= 0),
  unchanged_count INTEGER NOT NULL DEFAULT 0 CHECK(unchanged_count >= 0),
  inactivated_count INTEGER NOT NULL DEFAULT 0 CHECK(inactivated_count >= 0),
  alias_added_count INTEGER NOT NULL DEFAULT 0 CHECK(alias_added_count >= 0),
  alias_updated_count INTEGER NOT NULL DEFAULT 0 CHECK(alias_updated_count >= 0),
  alias_inactivated_count INTEGER NOT NULL DEFAULT 0 CHECK(alias_inactivated_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK(error_count >= 0)
);

CREATE INDEX idx_site_location_imports_site_created
ON site_location_imports(site_id,created_at DESC);

CREATE TABLE site_location_import_idempotency (site_id TEXT NOT NULL REFERENCES sites(id),import_id TEXT NOT NULL REFERENCES site_location_imports(id),user_id TEXT NOT NULL REFERENCES users(id),idempotency_key TEXT NOT NULL,payload_hash TEXT NOT NULL,response_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,PRIMARY KEY(site_id,import_id,user_id,idempotency_key));
CREATE TRIGGER site_locations_revision_insert AFTER INSERT ON site_locations BEGIN INSERT INTO site_location_master_revisions(site_id,revision) VALUES(NEW.site_id,1) ON CONFLICT(site_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER site_locations_site_id_immutable BEFORE UPDATE OF site_id ON site_locations WHEN NEW.site_id<>OLD.site_id BEGIN SELECT RAISE(ABORT,'SITE_LOCATION_SITE_ID_IMMUTABLE'); END;
CREATE TRIGGER site_locations_revision_update AFTER UPDATE ON site_locations BEGIN INSERT INTO site_location_master_revisions(site_id,revision) VALUES(NEW.site_id,1) ON CONFLICT(site_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER site_locations_revision_delete AFTER DELETE ON site_locations BEGIN INSERT INTO site_location_master_revisions(site_id,revision) VALUES(OLD.site_id,1) ON CONFLICT(site_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER site_location_aliases_revision_insert AFTER INSERT ON site_location_aliases BEGIN INSERT INTO site_location_master_revisions(site_id,revision) VALUES(NEW.site_id,1) ON CONFLICT(site_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER site_location_aliases_site_id_immutable BEFORE UPDATE OF site_id ON site_location_aliases WHEN NEW.site_id<>OLD.site_id BEGIN SELECT RAISE(ABORT,'SITE_LOCATION_ALIAS_SITE_ID_IMMUTABLE'); END;
CREATE TRIGGER site_location_aliases_revision_update AFTER UPDATE ON site_location_aliases BEGIN INSERT INTO site_location_master_revisions(site_id,revision) VALUES(NEW.site_id,1) ON CONFLICT(site_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER site_location_aliases_revision_delete AFTER DELETE ON site_location_aliases BEGIN INSERT INTO site_location_master_revisions(site_id,revision) VALUES(OLD.site_id,1) ON CONFLICT(site_id) DO UPDATE SET revision=revision+1; END;
