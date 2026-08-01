INSERT OR IGNORE INTO board_definitions(id,board_key,module_key,display_name,contains_sensitive_data,is_active) VALUES
 ('board-quality-csi-preparation','QUALITY_CSI_PREPARATION','quality','CSI 입력 준비',0,1),
 ('board-quality-test-inspection','QUALITY_TEST_INSPECTION','quality','시험·검사 관리',0,1),
 ('board-quality-nonconformance','QUALITY_NONCONFORMANCE','quality','부적합·시정조치',0,1),
 ('board-quality-calibration','QUALITY_CALIBRATION','quality','시험장비·검교정',0,1);

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),g.site_id,b.id,g.user_id,g.access_level,g.granted_by_user_id
FROM board_access_grants g
JOIN board_definitions old ON old.id=g.board_id AND old.board_key='QUALITY_LEGAL_OBLIGATION'
JOIN board_definitions b ON b.board_key IN ('QUALITY_CSI_PREPARATION','QUALITY_TEST_INSPECTION','QUALITY_NONCONFORMANCE','QUALITY_CALIBRATION')
WHERE g.is_active=1;

CREATE TABLE quality_test_inspections (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 company_id TEXT NOT NULL REFERENCES companies(id),
 trade_id TEXT NOT NULL REFERENCES trade_master(id),
 location_id TEXT REFERENCES site_locations(id),
 basis_record_id TEXT REFERENCES quality_work_basis_records(id),
 title TEXT NOT NULL,
 test_target TEXT NOT NULL,
 scheduled_date TEXT NOT NULL,
 test_date TEXT,
 test_institution TEXT,
 test_manager_user_id TEXT REFERENCES users(id),
 equipment_id TEXT REFERENCES quality_test_equipment(id),
 equipment_exception_reason TEXT,
 test_method TEXT,
 acceptance_criteria TEXT,
 result_summary TEXT,
 judgment TEXT CHECK(judgment IN ('PASS','FAIL','PENDING')),
 status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','COLLECTING','TEST_COMPLETED','REVIEW_PENDING','REVISION_REQUIRED','READY_FOR_CSI','CSI_RECORDED','CANCELLED')),
 review_note TEXT,
 reviewed_by_user_id TEXT REFERENCES users(id),
 reviewed_at TEXT,
 ready_by_user_id TEXT REFERENCES users(id),
 ready_at TEXT,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_test_results (
 id TEXT PRIMARY KEY,
 test_inspection_id TEXT NOT NULL UNIQUE REFERENCES quality_test_inspections(id),
 measured_value TEXT NOT NULL,
 unit TEXT,
 result_detail TEXT NOT NULL,
 judgment TEXT NOT NULL CHECK(judgment IN ('PASS','FAIL')),
 entered_by_user_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_test_reports (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 report_number TEXT NOT NULL,
 test_name TEXT NOT NULL,
 test_institution TEXT NOT NULL,
 issued_date TEXT NOT NULL,
 test_target TEXT NOT NULL,
 material_reference TEXT,
 original_key TEXT NOT NULL,
 original_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 is_valid INTEGER NOT NULL DEFAULT 1 CHECK(is_valid IN (0,1)),
 note TEXT,
 uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(site_id,report_number)
);

CREATE TABLE quality_test_report_links (
 id TEXT PRIMARY KEY,
 test_inspection_id TEXT NOT NULL REFERENCES quality_test_inspections(id),
 test_report_id TEXT NOT NULL REFERENCES quality_test_reports(id),
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(test_inspection_id,test_report_id)
);

CREATE TABLE quality_test_media (
 id TEXT PRIMARY KEY,
 test_inspection_id TEXT NOT NULL REFERENCES quality_test_inspections(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 media_role TEXT NOT NULL CHECK(media_role IN ('RESULT_PHOTO','CSI_EVIDENCE')),
 original_key TEXT NOT NULL,
 original_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_nonconformances (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 test_inspection_id TEXT NOT NULL REFERENCES quality_test_inspections(id),
 title TEXT NOT NULL,
 impact_scope TEXT NOT NULL,
 location_reference TEXT,
 material_reference TEXT,
 trade_id TEXT REFERENCES trade_master(id),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ACTION_IN_PROGRESS','RETEST_REQUIRED','VERIFICATION_PENDING','CLOSED','CANCELLED')),
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 closed_by_user_id TEXT REFERENCES users(id),
 closed_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_corrective_actions (
 id TEXT PRIMARY KEY,
 nonconformance_id TEXT NOT NULL REFERENCES quality_nonconformances(id),
 action_detail TEXT NOT NULL,
 result_detail TEXT,
 retest_result TEXT CHECK(retest_result IN ('PASS','FAIL')),
 status TEXT NOT NULL DEFAULT 'ACTION_IN_PROGRESS' CHECK(status IN ('ACTION_IN_PROGRESS','VERIFICATION_PENDING','COMPLETED')),
 assigned_user_id TEXT REFERENCES users(id),
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 verified_by_user_id TEXT REFERENCES users(id),
 verified_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_test_equipment (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 equipment_name TEXT NOT NULL,
 management_number TEXT NOT NULL,
 manufacturer TEXT,
 model TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 note TEXT,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(site_id,management_number)
);

CREATE TABLE quality_calibration_records (
 id TEXT PRIMARY KEY,
 equipment_id TEXT NOT NULL REFERENCES quality_test_equipment(id),
 calibration_institution TEXT NOT NULL,
 calibrated_date TEXT NOT NULL,
 expires_date TEXT NOT NULL,
 certificate_report_id TEXT REFERENCES quality_test_reports(id),
 usable_status TEXT NOT NULL DEFAULT 'USABLE' CHECK(usable_status IN ('USABLE','EXPIRED','RESTRICTED')),
 exception_reason TEXT,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_csi_submission_records (
 id TEXT PRIMARY KEY,
 test_inspection_id TEXT NOT NULL UNIQUE REFERENCES quality_test_inspections(id),
 recorded_date TEXT NOT NULL,
 recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
 csi_reference_number TEXT NOT NULL,
 note TEXT,
 evidence_media_id TEXT REFERENCES quality_test_media(id),
 confirmed_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quality_tests_site_status ON quality_test_inspections(site_id,status,scheduled_date);
CREATE INDEX idx_quality_reports_site ON quality_test_reports(site_id,issued_date);
CREATE INDEX idx_quality_ncr_site_status ON quality_nonconformances(site_id,status);
CREATE INDEX idx_quality_equipment_site ON quality_test_equipment(site_id,is_active);
