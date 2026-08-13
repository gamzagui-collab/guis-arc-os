PRAGMA foreign_keys = ON;

ALTER TABLE site_locations ADD COLUMN canonical_key TEXT;
ALTER TABLE site_locations ADD COLUMN source TEXT NOT NULL DEFAULT 'LEGACY'
  CHECK(source IN ('LEGACY','MANUAL','IMPORT'));

CREATE UNIQUE INDEX idx_site_locations_site_canonical_key
ON site_locations(site_id,canonical_key)
WHERE canonical_key IS NOT NULL;

CREATE TABLE site_location_aliases (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  location_id TEXT NOT NULL REFERENCES site_locations(id),
  alias_text TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL
    CHECK(alias_type IN ('OFFICIAL_VARIANT','FIELD_NAME','LEGACY_NAME')),
  source TEXT NOT NULL DEFAULT 'IMPORT'
    CHECK(source IN ('LEGACY','MANUAL','IMPORT')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id,normalized_alias)
);

CREATE INDEX idx_site_location_aliases_site_location_active
ON site_location_aliases(site_id,location_id,is_active);

CREATE TABLE site_location_imports (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  r2_object_key TEXT,
  template_version TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK(status IN ('UPLOADED','VALIDATING','INVALID','READY','APPLYING','APPLIED','FAILED','CANCELLED')),
  base_master_fingerprint TEXT,
  preview_hash TEXT,
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
