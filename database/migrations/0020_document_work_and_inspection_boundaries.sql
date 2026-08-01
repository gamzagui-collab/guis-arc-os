PRAGMA foreign_keys = ON;

INSERT INTO board_definitions(id,board_key,module_key,display_name,contains_sensitive_data,is_active) VALUES
 ('board-construction-inspection','CONSTRUCTION_INSPECTION','construction','공정별 시공 검측',0,1),
 ('board-quality-legal-obligation','QUALITY_LEGAL_OBLIGATION','quality','법정 품질업무',0,1)
ON CONFLICT(board_key) DO UPDATE SET display_name=excluded.display_name,is_active=1,updated_at=CURRENT_TIMESTAMP;

ALTER TABLE periodic_task_definitions ADD COLUMN document_type TEXT NOT NULL DEFAULT 'SAFETY_CHECK_SHEET';
ALTER TABLE periodic_task_definitions ADD COLUMN basis_type TEXT NOT NULL DEFAULT 'SITE_PLAN'
 CHECK(basis_type IN ('LEGAL_VERIFIED','APPROVED_SAFETY_PLAN','SITE_PLAN','CONTRACT','CONFIRMATION_REQUIRED'));
ALTER TABLE periodic_task_definitions ADD COLUMN basis_name TEXT;
ALTER TABLE periodic_task_definitions ADD COLUMN basis_reference TEXT;
ALTER TABLE periodic_task_definitions ADD COLUMN required_attachment_count INTEGER NOT NULL DEFAULT 0 CHECK(required_attachment_count>=0);
ALTER TABLE periodic_task_instances ADD COLUMN period_start TEXT;
ALTER TABLE periodic_task_instances ADD COLUMN period_end TEXT;
ALTER TABLE periodic_task_documents ADD COLUMN document_title TEXT;
ALTER TABLE periodic_task_documents ADD COLUMN review_result TEXT
 CHECK(review_result IN ('APPROVED','REVISION_REQUESTED'));
ALTER TABLE periodic_task_documents ADD COLUMN review_note TEXT;
ALTER TABLE periodic_task_documents ADD COLUMN approved_by_user_id TEXT REFERENCES users(id);
ALTER TABLE periodic_task_documents ADD COLUMN approved_at TEXT;

CREATE TABLE construction_inspection_types (
 id TEXT PRIMARY KEY,
 type_key TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 description TEXT,
 checklist_template_json TEXT NOT NULL DEFAULT '[]',
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO construction_inspection_types(id,type_key,title,description,checklist_template_json) VALUES
 ('inspection-type-rebar','REBAR_INSTALLATION','철근 배근','철근 배근 간격·피복 등 시공 상태 확인','["도면·시방 기준 확인","배근 간격 확인","피복 두께 확인","매립물 간섭 확인"]'),
 ('inspection-type-form','FORMWORK','거푸집','거푸집 시공 상태 확인','["도면 기준 확인","치수·수직도 확인","지지·고정 상태 확인"]'),
 ('inspection-type-embedded','EMBEDDED_PIPE','매립 배관','다음 공정 전 매립 배관 상태 확인','["도면 위치 확인","고정 상태 확인","손상·누락 확인"]'),
 ('inspection-type-waterproof','WATERPROOFING','방수','방수 시공 완료 상태 확인','["바탕면 확인","시공 범위 확인","마감·보호 상태 확인"]'),
 ('inspection-type-window','WINDOW_INSTALLATION','창호 설치','창호 설치 상태 확인','["위치·치수 확인","고정 상태 확인","주변 충전·마감 확인"]'),
 ('inspection-type-finish','FINISH_WORK','마감 시공','마감 공정 상태 확인','["시공 범위 확인","표면 상태 확인","보양 상태 확인"]'),
 ('inspection-type-equipment','FACILITY_INSTALLATION','설비 시공 상태','설비 시공 상태 확인','["도면 위치 확인","고정·접속 상태 확인","다음 공정 간섭 확인"]'),
 ('inspection-type-next','BEFORE_NEXT_PROCESS','다음 공정 착수 전 확인','후속 공정 착수 조건 확인','["선행 공정 완료 확인","보완사항 해소 확인","후속 공정 간섭 확인"]')
ON CONFLICT(type_key) DO NOTHING;

CREATE TABLE construction_inspections (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 work_date_kst TEXT NOT NULL,
 company_id TEXT NOT NULL REFERENCES companies(id),
 trade_id TEXT NOT NULL REFERENCES trade_master(id),
 location_id TEXT REFERENCES site_locations(id),
 construction_daily_report_item_id TEXT REFERENCES construction_daily_report_items(id),
 inspection_type_id TEXT NOT NULL REFERENCES construction_inspection_types(id),
 title TEXT NOT NULL,
 description TEXT,
 drawing_reference TEXT,
 specification_reference TEXT,
 status TEXT NOT NULL DEFAULT 'DRAFT'
  CHECK(status IN ('DRAFT','REQUESTED','UNDER_REVIEW','REVISION_REQUESTED','RESUBMITTED','APPROVED','CANCELLED')),
 requested_by_user_id TEXT REFERENCES users(id),
 requested_at TEXT,
 reviewed_by_user_id TEXT REFERENCES users(id),
 reviewed_at TEXT,
 external_reviewer_name TEXT,
 external_reviewed_at TEXT,
 external_review_document_reference TEXT,
 external_review_registered_by_user_id TEXT REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE construction_inspection_items (
 id TEXT PRIMARY KEY,
 inspection_id TEXT NOT NULL REFERENCES construction_inspections(id),
 checklist_item_key TEXT NOT NULL,
 checklist_label TEXT NOT NULL,
 result TEXT NOT NULL DEFAULT 'UNCONFIRMED'
  CHECK(result IN ('APPROPRIATE','INAPPROPRIATE','NOT_APPLICABLE','UNCONFIRMED')),
 note TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(inspection_id,checklist_item_key)
);

CREATE TABLE construction_inspection_media (
 id TEXT PRIMARY KEY,
 inspection_id TEXT NOT NULL REFERENCES construction_inspections(id),
 media_id TEXT REFERENCES files(id),
 source_media_id TEXT,
 media_role TEXT NOT NULL CHECK(media_role IN ('REQUEST','REVISION','APPROVAL','EXTERNAL_REVIEW')),
 description TEXT,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE construction_inspection_reviews (
 id TEXT PRIMARY KEY,
 inspection_id TEXT NOT NULL REFERENCES construction_inspections(id),
 result TEXT NOT NULL CHECK(result IN ('REVISION_REQUESTED','APPROVED')),
 review_note TEXT NOT NULL,
 reviewed_by_user_id TEXT NOT NULL REFERENCES users(id),
 reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revision INTEGER NOT NULL
);

CREATE TABLE quality_legal_obligations (
 id TEXT PRIMARY KEY,
 obligation_key TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 legal_source_type TEXT NOT NULL,
 legal_source_name TEXT NOT NULL,
 legal_article TEXT,
 legal_source_version TEXT NOT NULL,
 effective_from TEXT NOT NULL,
 effective_to TEXT,
 applicability_json TEXT NOT NULL DEFAULT '{}',
 required_record_type TEXT NOT NULL,
 recurrence_rule TEXT,
 retention_rule TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 verified_at TEXT NOT NULL,
 verified_by_user_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_site_obligations (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 obligation_id TEXT NOT NULL REFERENCES quality_legal_obligations(id),
 applicability_status TEXT NOT NULL CHECK(applicability_status IN ('APPLICABLE','NOT_APPLICABLE','CONFIRMATION_REQUIRED')),
 applicability_reason TEXT NOT NULL,
 approved_by_user_id TEXT REFERENCES users(id),
 approved_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(site_id,obligation_id)
);

CREATE TABLE quality_work_basis_records (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 basis_type TEXT NOT NULL CHECK(basis_type IN ('LEGAL_OBLIGATION','APPROVED_QUALITY_MANAGEMENT_PLAN','APPROVED_QUALITY_TEST_PLAN','APPLICABLE_STANDARD','APPLICABLE_SPECIFICATION')),
 obligation_id TEXT REFERENCES quality_legal_obligations(id),
 basis_document_reference TEXT NOT NULL,
 basis_article TEXT,
 applicability_reason TEXT NOT NULL,
 approved_by_user_id TEXT NOT NULL REFERENCES users(id),
 approved_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE legacy_work_classification_reports (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 source_module TEXT NOT NULL,
 source_type TEXT NOT NULL,
 source_id TEXT NOT NULL,
 source_title TEXT NOT NULL,
 classification TEXT NOT NULL CHECK(classification IN ('CONSTRUCTION_INSPECTION','QUALITY_LEGAL_WORK','CONFIRMATION_REQUIRED','DISPOSAL_CANDIDATE')),
 reason TEXT NOT NULL,
 confirmed_by_user_id TEXT REFERENCES users(id),
 confirmed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(site_id,source_module,source_type,source_id)
);

CREATE INDEX idx_construction_inspections_site_status ON construction_inspections(site_id,status,work_date_kst DESC);
CREATE INDEX idx_construction_inspection_items_parent ON construction_inspection_items(inspection_id,result);
CREATE INDEX idx_quality_site_obligations_site ON quality_site_obligations(site_id,applicability_status);
CREATE INDEX idx_legacy_classification_site ON legacy_work_classification_reports(site_id,classification);

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,'MANAGE',m.user_id
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
JOIN board_definitions b ON b.board_key IN ('CONSTRUCTION_INSPECTION','QUALITY_LEGAL_OBLIGATION')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL;

-- Preserve existing Construction participants' scope for inspection requests.
INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),g.site_id,'board-construction-inspection',g.user_id,
 CASE WHEN g.access_level='MANAGE' THEN 'MANAGE' ELSE 'EDIT' END,g.granted_by_user_id
FROM board_access_grants g
JOIN board_definitions b ON b.id=g.board_id AND b.board_key='CONSTRUCTION_DAILY_REPORT'
WHERE g.is_active=1;
