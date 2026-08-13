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
    INSERT INTO sites(id,company_id,name) VALUES('site-1','company-1','Site');
    INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations)
      VALUES('user-1','user-1','User','hash','salt',100000);
    INSERT INTO site_locations(id,site_id,location_type,code,name,display_name)
      VALUES('legacy-room','site-1','ROOM','LEGACY_ROOM','Legacy room','Legacy room');
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
  assert.equal(db.prepare("SELECT source FROM site_locations WHERE id='legacy-room'").get().source, "LEGACY");
  assert.equal(db.prepare("SELECT room_location_id FROM issue_items WHERE id='issue-1'").get().room_location_id, "legacy-room");
  assert.ok(tableExists("site_location_aliases"));
  assert.ok(tableExists("site_location_imports"));
  assert.equal(sql.includes("last_import_id"), false);

  assert.throws(() => db.exec("UPDATE site_locations SET source='UNKNOWN' WHERE id='legacy-room'"), /CHECK/);
  db.exec("UPDATE site_locations SET canonical_key='site/legacy-room' WHERE id='legacy-room'");
  assert.throws(() => db.exec("INSERT INTO site_locations(id,site_id,location_type,code,name,display_name,canonical_key) VALUES('duplicate-room','site-1','ROOM','DUPLICATE_ROOM','Duplicate','Duplicate','site/legacy-room')"), /UNIQUE/);
  const canonicalIndex = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_site_locations_site_canonical_key'").get().sql;
  assert.match(canonicalIndex, /UNIQUE[\s\S]*\(site_id,\s*canonical_key\)[\s\S]*WHERE canonical_key IS NOT NULL/i);

  db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-1','site-1','legacy-room','Legacy','legacy','LEGACY_NAME')");
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-2','site-1','legacy-room','Legacy 2','legacy','FIELD_NAME')"), /UNIQUE/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-bad-type','site-1','legacy-room','Bad','bad','UNKNOWN')"), /CHECK/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type,source) VALUES('alias-bad-source','site-1','legacy-room','Bad source','bad-source','FIELD_NAME','UNKNOWN')"), /CHECK/);
  assert.throws(() => db.exec("INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type) VALUES('alias-orphan','site-1','missing','Missing','missing','FIELD_NAME')"), /FOREIGN KEY/);
  const aliasForeignKeys = db.prepare("PRAGMA foreign_key_list(site_location_aliases)").all();
  assert.ok(aliasForeignKeys.some(row => row.table === "sites" && row.from === "site_id"));
  assert.ok(aliasForeignKeys.some(row => row.table === "site_locations" && row.from === "location_id"));

  const countColumns = ["added_count", "updated_count", "unchanged_count", "inactivated_count", "alias_added_count", "alias_updated_count", "alias_inactivated_count", "error_count"];
  assert.deepEqual(columns("site_location_imports").filter(name => countColumns.includes(name)), countColumns);
  assert.throws(() => db.exec("INSERT INTO site_location_imports(id,site_id,file_name,file_hash,template_version,status,created_by) VALUES('import-bad','site-1','x.xlsx','hash','v1','UNKNOWN','user-1')"), /CHECK/);
  const importForeignKeys = db.prepare("PRAGMA foreign_key_list(site_location_imports)").all();
  assert.ok(importForeignKeys.some(row => row.table === "sites" && row.from === "site_id"));
  assert.ok(importForeignKeys.some(row => row.table === "users" && row.from === "created_by"));
  db.close();
});
