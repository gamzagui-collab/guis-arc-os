PRAGMA foreign_keys = ON;

INSERT INTO board_definitions(id,board_key,module_key,display_name,contains_sensitive_data,is_active)
VALUES
 ('board-construction-daily-report','CONSTRUCTION_DAILY_REPORT','construction','공사일보',0,1),
 ('board-construction-output-status','CONSTRUCTION_OUTPUT_STATUS','construction','출력일보 제출 현황',0,1)
ON CONFLICT(board_key) DO UPDATE SET
 module_key=excluded.module_key,
 display_name=excluded.display_name,
 is_active=1,
 updated_at=CURRENT_TIMESTAMP;

CREATE TABLE construction_daily_reports (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 work_date_kst TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT'
  CHECK(status IN ('DRAFT','SUBMITTED','REVISION_REQUESTED','RESUBMITTED','FINALIZED','CANCELLED')),
 weather_summary TEXT,
 min_temperature REAL,
 max_temperature REAL,
 precipitation_note TEXT,
 yesterday_summary TEXT,
 today_summary TEXT,
 tomorrow_plan TEXT,
 special_notes TEXT,
 missing_output_reason TEXT,
 difference_reason TEXT,
 workforce_snapshot_json TEXT,
 output_snapshot_json TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 submitted_by_user_id TEXT REFERENCES users(id),
 submitted_at TEXT,
 finalized_by_user_id TEXT REFERENCES users(id),
 finalized_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(site_id,work_date_kst)
);

CREATE TABLE construction_daily_report_items (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES construction_daily_reports(id),
 company_id TEXT NOT NULL REFERENCES companies(id),
 trade_id TEXT NOT NULL REFERENCES trade_master(id),
 location_id TEXT REFERENCES site_locations(id),
 team_id TEXT REFERENCES workforce_teams(id),
 workforce_count INTEGER NOT NULL DEFAULT 0 CHECK(workforce_count>=0),
 source_output_report_id TEXT NOT NULL REFERENCES daily_output_reports(id),
 source_output_revision INTEGER NOT NULL,
 work_description TEXT NOT NULL,
 manager_summary TEXT,
 notes TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(report_id,source_output_report_id)
);

CREATE TABLE construction_daily_report_materials (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES construction_daily_reports(id),
 material_reference_id TEXT,
 material_name TEXT NOT NULL,
 specification TEXT,
 quantity REAL NOT NULL CHECK(quantity>=0),
 unit TEXT NOT NULL,
 received INTEGER NOT NULL DEFAULT 0 CHECK(received IN (0,1)),
 supplier_company_id TEXT REFERENCES companies(id),
 location_id TEXT REFERENCES site_locations(id),
 source_type TEXT,
 source_id TEXT,
 notes TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE construction_daily_report_equipment (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES construction_daily_reports(id),
 equipment_reference_id TEXT,
 equipment_name TEXT NOT NULL,
 specification TEXT,
 quantity REAL NOT NULL CHECK(quantity>=0),
 operating_hours REAL CHECK(operating_hours IS NULL OR operating_hours>=0),
 company_id TEXT REFERENCES companies(id),
 location_id TEXT REFERENCES site_locations(id),
 notes TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE construction_daily_report_media (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES construction_daily_reports(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 media_id TEXT NOT NULL REFERENCES files(id),
 source_media_id TEXT,
 location_id TEXT REFERENCES site_locations(id),
 description TEXT,
 original_key TEXT NOT NULL UNIQUE,
 thumbnail_key TEXT NOT NULL UNIQUE,
 original_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 original_size INTEGER NOT NULL,
 thumbnail_size INTEGER NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0,
 uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DELETED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE construction_daily_report_revisions (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES construction_daily_reports(id),
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 changed_by_user_id TEXT NOT NULL REFERENCES users(id),
 change_type TEXT NOT NULL,
 change_reason TEXT,
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(report_id,revision)
);

CREATE TABLE construction_daily_report_revision_requests (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES construction_daily_reports(id),
 requested_revision INTEGER NOT NULL,
 request_text TEXT NOT NULL,
 target_section TEXT,
 due_date TEXT,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED','CANCELLED')),
 requested_by_user_id TEXT NOT NULL REFERENCES users(id),
 requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resolved_by_user_id TEXT REFERENCES users(id),
 resolved_at TEXT
);

CREATE INDEX idx_construction_reports_site_date ON construction_daily_reports(site_id,work_date_kst,status);
CREATE INDEX idx_construction_items_report ON construction_daily_report_items(report_id,sort_order);
CREATE INDEX idx_construction_items_source ON construction_daily_report_items(source_output_report_id,source_output_revision);
CREATE INDEX idx_construction_materials_report ON construction_daily_report_materials(report_id,sort_order);
CREATE INDEX idx_construction_equipment_report ON construction_daily_report_equipment(report_id,sort_order);
CREATE INDEX idx_construction_media_report ON construction_daily_report_media(report_id,status,sort_order);
CREATE INDEX idx_construction_revisions_report ON construction_daily_report_revisions(report_id,revision);
CREATE INDEX idx_construction_revision_requests ON construction_daily_report_revision_requests(report_id,status);

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,
 CASE
  WHEN r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER') THEN 'MANAGE'
  WHEN r.code IN ('CONSTRUCTION_MANAGER') THEN 'EDIT'
  WHEN r.code IN ('GENERAL_CONTRACTOR_FOREMAN') AND b.board_key='CONSTRUCTION_DAILY_REPORT' THEN 'EDIT'
  WHEN r.code IN ('GENERAL_CONTRACTOR_FOREMAN') THEN 'VIEW'
  WHEN r.code IN ('SAFETY_MANAGER','QUALITY_MANAGER') AND b.board_key='CONSTRUCTION_DAILY_REPORT' THEN 'VIEW'
  ELSE 'VIEW'
 END,
 m.user_id
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id
JOIN board_definitions b ON b.board_key IN ('CONSTRUCTION_DAILY_REPORT','CONSTRUCTION_OUTPUT_STATUS')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
 AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','CONSTRUCTION_MANAGER','GENERAL_CONTRACTOR_FOREMAN','SAFETY_MANAGER','QUALITY_MANAGER')
GROUP BY m.site_id,b.id,m.user_id;

INSERT OR IGNORE INTO module_entitlements(id,user_id,module_code,status)
SELECT lower(hex(randomblob(16))),g.user_id,'construction','ACTIVE'
FROM board_access_grants g
JOIN board_definitions b ON b.id=g.board_id
WHERE g.is_active=1 AND b.board_key IN ('CONSTRUCTION_DAILY_REPORT','CONSTRUCTION_OUTPUT_STATUS');

UPDATE users SET context_version=context_version+1
WHERE id IN (
 SELECT DISTINCT user_id FROM board_access_grants g
 JOIN board_definitions b ON b.id=g.board_id
 WHERE g.is_active=1 AND b.board_key IN ('CONSTRUCTION_DAILY_REPORT','CONSTRUCTION_OUTPUT_STATUS')
);
