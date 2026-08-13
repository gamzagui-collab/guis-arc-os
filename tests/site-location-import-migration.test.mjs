import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const read = path => fs.readFileSync(path, "utf8");
const migrationPath = "database/migrations/0036_site_location_master_import.sql";

const databaseThrough0035 = () => {
  const db = new DatabaseSync(":memory:");
  for (const name of fs.readdirSync("database/migrations")
    .filter(name => name.endsWith(".sql") && name < "0036")
    .sort()) {
    db.exec(read(`database/migrations/${name}`));
  }
  db.exec(`
    INSERT INTO companies(id,name) VALUES('company-1','Company');
    INSERT INTO sites(id,company_id,name) VALUES('site-1','company-1','Site'),('site-2','company-1','Other site');
    INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations)
      VALUES('user-1','user-1','User','hash','salt',100000);
    INSERT INTO site_locations(id,site_id,parent_id,location_type,code,name,display_name,is_active)
      VALUES
        ('legacy-parent','site-1',NULL,'FLOOR','LEGACY_FLOOR','Legacy floor','Legacy floor',1),
        ('legacy-room','site-1','legacy-parent','ROOM','LEGACY_ROOM','Legacy room','Legacy room',0),
        ('other-room','site-2',NULL,'ROOM','OTHER_ROOM','Other room','Other room',1);
    INSERT INTO issue_items(id,site_id,created_by_user_id,created_by_name_snapshot,title,location_text,description,category_code,room_location_id)
      VALUES('issue-1','site-1','user-1','User','Issue','Legacy room','Description','CONSTRUCTION','legacy-room');
  `);
  return db;
};

test("0036 adds the minimal import schema while preserving legacy location identity", () => {
  const db = databaseThrough0035();
  const sql = read(migrationPath);
  db.exec(sql);
  const columns = table => db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  const tableExists = name => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));

  assert.deepEqual(columns("site_locations").filter(name => ["canonical_key", "source"].includes(name)), ["canonical_key", "source"]);
  assert.equal(columns("site_locations").includes("last_import_id"), false);
  assert.equal(columns("site_location_aliases").includes("last_import_id"), false);
  assert.equal(db.prepare("SELECT source FROM site_locations WHERE id='legacy-room'").get().source, "LEGACY");
  assert.deepEqual(
    db.prepare("SELECT id,parent_id,is_active FROM site_locations WHERE id IN ('legacy-parent','legacy-room') ORDER BY id").all().map(row => ({ ...row })),
    [
      { id: "legacy-parent", parent_id: null, is_active: 1 },
      { id: "legacy-room", parent_id: "legacy-parent", is_active: 0 }
    ]
  );
  assert.equal(db.prepare("SELECT room_location_id FROM issue_items WHERE id='issue-1'").get().room_location_id, "legacy-room");
  assert.ok(tableExists("site_location_aliases"));
  assert.ok(tableExists("site_location_imports"));
  assert.ok(tableExists("site_location_master_revisions"));
  assert.ok(tableExists("site_location_import_idempotency"));
  assert.equal(sql.includes("last_import_id"), false);

  assert.throws(() => db.exec("UPDATE site_locations SET source='UNKNOWN' WHERE id='legacy-room'"), /CHECK/);
  assert.throws(() => db.exec("UPDATE site_locations SET site_id='site-2' WHERE id='legacy-room'"), /SITE_LOCATION_SITE_ID_IMMUTABLE/);
  db.exec("UPDATE site_locations SET canonical_key='site/legacy-room' WHERE id='legacy-room'");
  assert.throws(() => db.exec("INSERT INTO site_locations(id,site_id,location_type,code,name,display_name,canonical_key) VALUES('duplicate-room','site-1','ROOM','DUPLICATE_ROOM','Duplicate','Duplicate','site/legacy-room')"), /UNIQUE/);
  db.exec("UPDATE site_locations SET canonical_key='site/legacy-room' WHERE id='other-room'");
  const canonicalIndex = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_site_locations_site_canonical_key'").get().sql;
  assert.match(canonicalIndex, /UNIQUE[\s\S]*\(site_id,\s*canonical_key\)[\s\S]*WHERE canonical_key IS NOT NULL/i);

  db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-1','site-1','legacy-room','Legacy','legacy','LEGACY_NAME')");
  assert.throws(() => db.exec("UPDATE site_location_aliases SET site_id='site-2' WHERE id='alias-1'"), /SITE_LOCATION_ALIAS_SITE_ID_IMMUTABLE/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-2','site-1','legacy-room','Legacy 2','legacy','FIELD_NAME')"), /UNIQUE/);
  db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-other-site','site-2','other-room','Legacy','legacy','LEGACY_NAME')");
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-cross-site','site-1','other-room','Cross','cross','FIELD_NAME')"), /FOREIGN KEY/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-bad-type','site-1','legacy-room','Bad','bad','UNKNOWN')"), /CHECK/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type,source) VALUES('alias-bad-source','site-1','legacy-room','Bad source','bad-source','FIELD_NAME','UNKNOWN')"), /CHECK/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type,is_active) VALUES('alias-bad-active','site-1','legacy-room','Bad active','bad-active','FIELD_NAME',2)"), /CHECK/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-orphan','site-1','missing','Missing','missing','FIELD_NAME')"), /FOREIGN KEY/);
  const aliasForeignKeys = db.prepare("PRAGMA foreign_key_list(site_location_aliases)").all();
  assert.ok(aliasForeignKeys.some(row => row.table === "sites" && row.from === "site_id"));
  assert.ok(aliasForeignKeys.some(row => row.table === "site_locations" && row.from === "location_id"));
  assert.ok(aliasForeignKeys.some(row => row.table === "site_locations" && row.from === "site_id"));
  const aliasIndex = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_site_location_aliases_site_location_active'").get();
  assert.match(aliasIndex.sql, /ON site_location_aliases\s*\(site_id,\s*location_id,\s*is_active\)/i);
  assert.deepEqual(db.prepare("PRAGMA index_info(idx_site_location_aliases_site_location_active)").all().map(row => row.name), ["site_id", "location_id", "is_active"]);

  const countColumns = ["added_count", "updated_count", "unchanged_count", "inactivated_count", "alias_added_count", "alias_updated_count", "alias_inactivated_count", "error_count"];
  assert.deepEqual(columns("site_location_imports").filter(name => countColumns.includes(name)), countColumns);
  assert.ok(columns("site_location_imports").includes("base_master_revision"));
  assert.ok(columns("site_location_imports").includes("post_master_fingerprint"));
  assert.ok(columns("site_location_imports").includes("artifact_object_key"));
  assert.ok(columns("site_location_imports").includes("validation_claim_token"));
  assert.ok(columns("site_location_imports").includes("validation_claimed_at"));
  assert.ok(columns("site_location_imports").includes("apply_claim_token"));
  assert.ok(columns("site_location_imports").includes("apply_claimed_at"));
  assert.throws(() => db.exec("INSERT INTO site_locations(id,site_id,location_type,code,name,display_name,canonical_key,source) VALUES('import-empty-key','site-1','ROOM','EMPTY','Empty','Empty','','IMPORT')"), /SITE_LOCATION_IMPORT_CANONICAL_KEY_REQUIRED/);
  assert.throws(() => db.exec("UPDATE site_locations SET source='IMPORT',canonical_key=NULL WHERE id='legacy-room'"), /SITE_LOCATION_IMPORT_CANONICAL_KEY_REQUIRED/);
  db.exec("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,created_by) VALUES('import-one','site-1','x.xlsx','h','v1','READY','user-1'),('import-two','site-1','x.xlsx','h','v1','READY','user-1')");
  assert.throws(() => db.exec("UPDATE site_location_imports SET validation_claim_token='owner-without-time' WHERE id='import-one'"), /CHECK/);
  assert.throws(() => db.exec("UPDATE site_location_imports SET apply_claim_token='owner-without-time' WHERE id='import-one'"), /CHECK/);
  db.exec("INSERT INTO site_location_import_idempotency(site_id,import_id,user_id,idempotency_key,payload_hash,response_json,expires_at) VALUES('site-1','import-one','user-1','shared-key','one','{}','2099-01-01'),('site-1','import-two','user-1','shared-key','two','{}','2099-01-01')");
  assert.equal(db.prepare("SELECT COUNT(*) count FROM site_location_import_idempotency WHERE user_id='user-1' AND idempotency_key='shared-key'").get().count,2);
  const revisionBefore=db.prepare("SELECT revision FROM site_location_master_revisions WHERE site_id='site-1'").get().revision;
  db.exec("UPDATE site_locations SET display_name='Changed' WHERE id='legacy-room'");
  assert.equal(db.prepare("SELECT revision FROM site_location_master_revisions WHERE site_id='site-1'").get().revision,revisionBefore+1);
  db.exec("INSERT INTO sites(id,company_id,name) VALUES('future-empty-site','company-1','Future empty site')");
  assert.deepEqual({...db.prepare("SELECT site_id,revision FROM site_location_master_revisions WHERE site_id='future-empty-site'").get()},{site_id:"future-empty-site",revision:0});
  assert.throws(() => db.exec("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,created_by) VALUES('import-bad','site-1','x.xlsx','hash','v1','UNKNOWN','user-1')"), /CHECK/);
  for (const countColumn of countColumns) {
    assert.throws(() => db.exec(`INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,created_by,${countColumn}) VALUES('import-negative-${countColumn}','site-1','x.xlsx','hash','v1','UPLOADED','user-1',-1)`), /CHECK/, countColumn);
  }
  const importForeignKeys = db.prepare("PRAGMA foreign_key_list(site_location_imports)").all();
  assert.ok(importForeignKeys.some(row => row.table === "sites" && row.from === "site_id"));
  assert.ok(importForeignKeys.some(row => row.table === "users" && row.from === "created_by"));
  const importIndex = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_site_location_imports_site_created'").get();
  assert.match(importIndex.sql, /ON site_location_imports\s*\(site_id,\s*created_at DESC\)/i);
  assert.deepEqual(db.prepare("PRAGMA index_info(idx_site_location_imports_site_created)").all().map(row => row.name), ["site_id", "created_at"]);
  db.close();
});
