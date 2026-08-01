PRAGMA foreign_keys = ON;

UPDATE board_definitions SET display_name='출력일보 보관함',updated_at=CURRENT_TIMESTAMP
WHERE board_key='CONSTRUCTION_OUTPUT_STATUS';

CREATE TABLE construction_daily_report_uploads (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 work_date_kst TEXT NOT NULL,
 revision INTEGER NOT NULL,
 original_file_key TEXT NOT NULL,
 original_file_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes>0),
 workbook_template_code TEXT,
 source_sheet_name TEXT,
 document_site_name TEXT,
 parse_status TEXT NOT NULL CHECK(parse_status IN ('ANALYZING','ANALYZED','FAILED','CONFIRMED')),
 parse_error_code TEXT,
 uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 confirmed_by_user_id TEXT REFERENCES users(id),
 confirmed_at TEXT,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUPERSEDED','INVALIDATED')),
 UNIQUE(site_id,work_date_kst,revision)
);

CREATE TABLE construction_daily_report_imported_items (
 id TEXT PRIMARY KEY,
 upload_id TEXT NOT NULL REFERENCES construction_daily_report_uploads(id),
 work_date_kst TEXT NOT NULL,
 section_type TEXT NOT NULL CHECK(section_type IN ('YESTERDAY_WORK','TODAY_PLAN')),
 company_id TEXT REFERENCES companies(id),
 company_name_snapshot TEXT,
 company_connection_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK(company_connection_status IN ('CONNECTED','NEEDS_REVIEW','NOT_PROVIDED')),
 trade_name_snapshot TEXT,
 location_text TEXT,
 work_description TEXT NOT NULL,
 workforce_count INTEGER CHECK(workforce_count IS NULL OR workforce_count>=0),
 source_sheet_name TEXT NOT NULL,
 source_cell_range TEXT NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_construction_upload_date ON construction_daily_report_uploads(site_id,work_date_kst,status,revision);
CREATE INDEX idx_construction_import_upload ON construction_daily_report_imported_items(upload_id,section_type,sort_order);

CREATE TABLE construction_output_sheet_documents (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 work_date_kst TEXT NOT NULL,
 company_id TEXT NOT NULL REFERENCES companies(id),
 note TEXT,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INVALIDATED')),
 uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 invalidated_by_user_id TEXT REFERENCES users(id),
 invalidated_at TEXT,
 invalidation_reason TEXT
);

CREATE TABLE construction_output_sheet_media (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL REFERENCES construction_output_sheet_documents(id),
 original_key TEXT NOT NULL UNIQUE,
 thumbnail_key TEXT NOT NULL UNIQUE,
 original_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 original_size INTEGER NOT NULL,
 thumbnail_size INTEGER NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_construction_output_archive ON construction_output_sheet_documents(site_id,work_date_kst,company_id,status);

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,'EDIT',m.user_id
FROM memberships m
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id
JOIN board_definitions b ON b.board_key='CONSTRUCTION_OUTPUT_STATUS'
WHERE m.status='ACTIVE' AND r.code IN ('CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','GENERAL_CONTRACTOR_FOREMAN','CONSTRUCTION_MANAGER');

UPDATE board_access_grants SET access_level='EDIT',revision=revision+1
WHERE is_active=1 AND board_id=(SELECT id FROM board_definitions WHERE board_key='CONSTRUCTION_OUTPUT_STATUS')
 AND EXISTS (
  SELECT 1 FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id
  WHERE usr.user_id=board_access_grants.user_id AND usr.site_id=board_access_grants.site_id AND usr.status='ACTIVE'
   AND r.code IN ('CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','GENERAL_CONTRACTOR_FOREMAN','CONSTRUCTION_MANAGER')
 );

INSERT OR IGNORE INTO module_entitlements(id,user_id,module_code,status)
SELECT lower(hex(randomblob(16))),g.user_id,'construction','ACTIVE'
FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id
WHERE g.is_active=1 AND b.board_key='CONSTRUCTION_OUTPUT_STATUS';
