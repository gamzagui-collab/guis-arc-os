PRAGMA foreign_keys = ON;

INSERT INTO board_definitions(id,board_key,module_key,display_name,contains_sensitive_data,is_active)
VALUES
 ('board-safety-case','SAFETY_CASE','safety','위험·개선조치',0,1),
 ('board-safety-risk-assessment','SAFETY_RISK_ASSESSMENT','safety','위험성평가',0,1),
 ('board-safety-corrective-action','SAFETY_CORRECTIVE_ACTION','safety','개선조치',0,1),
 ('board-safety-root-cause','SAFETY_ROOT_CAUSE','safety','반복 원인',0,1),
 ('board-safety-dashboard','SAFETY_DASHBOARD','safety','안전 현황',0,1),
 ('board-safety-periodic-task','SAFETY_PERIODIC_TASK','safety','안전 정기 업무',0,1),
 ('board-quality-periodic-task','QUALITY_PERIODIC_TASK','quality','품질 정기 업무',0,0)
ON CONFLICT(board_key) DO UPDATE SET
 module_key=excluded.module_key,
 display_name=excluded.display_name,
 is_active=excluded.is_active,
 updated_at=CURRENT_TIMESTAMP;

CREATE TABLE safety_risk_categories (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_root_cause_categories (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_root_cause_groups (
 id TEXT PRIMARY KEY,
 category_id TEXT NOT NULL REFERENCES safety_root_cause_categories(id),
 code TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_root_causes (
 id TEXT PRIMARY KEY,
 group_id TEXT NOT NULL REFERENCES safety_root_cause_groups(id),
 code TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 guidance TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_cases (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 primary_source_type TEXT NOT NULL DEFAULT 'DIRECT' CHECK(primary_source_type IN ('DIRECT','ISSUE','CONSTRUCTION_DAILY_REPORT','SAFETY_PERIODIC_TASK')),
 primary_source_id TEXT,
 primary_source_revision INTEGER,
 primary_issue_id TEXT REFERENCES issue_items(id),
 company_id TEXT REFERENCES companies(id),
 trade_id TEXT REFERENCES trade_master(id),
 location_id TEXT REFERENCES site_locations(id),
 work_date_kst TEXT NOT NULL,
 discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 discovered_by_user_id TEXT NOT NULL REFERENCES users(id),
 risk_category_id TEXT NOT NULL REFERENCES safety_risk_categories(id),
 risk_category_note TEXT,
 root_cause_id TEXT REFERENCES safety_root_causes(id),
 root_cause_note TEXT,
 status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK(status IN ('DISCOVERED','CONTROL_IN_PROGRESS','ASSESSMENT_REQUIRED','ACTION_IN_PROGRESS','REVIEW_PENDING','RECHECK_REQUIRED','FINALIZED','REWORK_REQUIRED','CANCELLED')),
 immediate_control_required INTEGER NOT NULL DEFAULT 0 CHECK(immediate_control_required IN (0,1)),
 immediate_control_completed INTEGER NOT NULL DEFAULT 0 CHECK(immediate_control_completed IN (0,1)),
 immediate_control_description TEXT,
 immediate_control_owner_user_id TEXT REFERENCES users(id),
 immediate_control_at TEXT,
 work_stopped INTEGER NOT NULL DEFAULT 0 CHECK(work_stopped IN (0,1)),
 access_restricted INTEGER NOT NULL DEFAULT 0 CHECK(access_restricted IN (0,1)),
 hazard_zone_marked INTEGER NOT NULL DEFAULT 0 CHECK(hazard_zone_marked IN (0,1)),
 owner_user_id TEXT REFERENCES users(id),
 due_date TEXT,
 budget_required INTEGER NOT NULL DEFAULT 0 CHECK(budget_required IN (0,1)),
 budget_amount REAL CHECK(budget_amount IS NULL OR budget_amount>=0),
 budget_status TEXT,
 budget_approved_by_user_id TEXT REFERENCES users(id),
 budget_note TEXT,
 review_result TEXT CHECK(review_result IS NULL OR review_result IN ('APPROPRIATE','REVISION_REQUIRED','RECHECK_REQUIRED','FINALIZABLE')),
 finalized_by_user_id TEXT REFERENCES users(id),
 finalized_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_case_sources (
 id TEXT PRIMARY KEY,
 safety_case_id TEXT NOT NULL REFERENCES safety_cases(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 source_type TEXT NOT NULL CHECK(source_type IN ('ISSUE','CONSTRUCTION_DAILY_REPORT','CONSTRUCTION_DAILY_REPORT_ITEM','SAFETY_PERIODIC_TASK')),
 source_id TEXT NOT NULL,
 source_item_id TEXT,
 source_revision INTEGER NOT NULL,
 source_snapshot_json TEXT NOT NULL DEFAULT '{}',
 is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(safety_case_id,source_type,source_id,source_item_id)
);

CREATE TABLE safety_case_media (
 id TEXT PRIMARY KEY,
 safety_case_id TEXT NOT NULL REFERENCES safety_cases(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 media_role TEXT NOT NULL CHECK(media_role IN ('DISCOVERY','CONTROL','BEFORE','AFTER','RECHECK')),
 source_type TEXT CHECK(source_type IS NULL OR source_type IN ('ISSUE_MEDIA','CONSTRUCTION_MEDIA','SAFETY_MEDIA')),
 source_media_id TEXT,
 original_key TEXT,
 thumbnail_key TEXT,
 original_name TEXT,
 mime_type TEXT,
 description TEXT,
 location_id TEXT REFERENCES site_locations(id),
 uploaded_by_user_id TEXT REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DELETED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(source_media_id IS NOT NULL OR (original_key IS NOT NULL AND thumbnail_key IS NOT NULL)),
 UNIQUE(safety_case_id,source_type,source_media_id,media_role)
);

CREATE TABLE safety_risk_assessments (
 id TEXT PRIMARY KEY,
 safety_case_id TEXT NOT NULL UNIQUE REFERENCES safety_cases(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 work_name TEXT NOT NULL,
 company_id TEXT REFERENCES companies(id),
 trade_id TEXT REFERENCES trade_master(id),
 location_id TEXT REFERENCES site_locations(id),
 hazard_factor TEXT NOT NULL,
 current_controls TEXT NOT NULL,
 likelihood INTEGER NOT NULL CHECK(likelihood BETWEEN 1 AND 5),
 severity INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 5),
 risk_score INTEGER NOT NULL CHECK(risk_score BETWEEN 1 AND 25),
 risk_level TEXT NOT NULL CHECK(risk_level IN ('LOW','MEDIUM','HIGH','VERY_HIGH')),
 acceptable INTEGER NOT NULL CHECK(acceptable IN (0,1)),
 additional_measures TEXT,
 status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('DRAFT','CONFIRMED','SUPERSEDED')),
 assessed_by_user_id TEXT NOT NULL REFERENCES users(id),
 assessed_on TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_risk_assessment_revisions (
 id TEXT PRIMARY KEY,
 assessment_id TEXT NOT NULL REFERENCES safety_risk_assessments(id),
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 changed_by_user_id TEXT NOT NULL REFERENCES users(id),
 change_reason TEXT,
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(assessment_id,revision)
);

CREATE TABLE safety_corrective_actions (
 id TEXT PRIMARY KEY,
 safety_case_id TEXT NOT NULL REFERENCES safety_cases(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 action_type TEXT NOT NULL CHECK(action_type IN ('IMMEDIATE_CORRECTION','FACILITY_IMPROVEMENT','METHOD_CHANGE','TRAINING','PPE','EQUIPMENT_REPAIR','MATERIAL_CHANGE','PLAN_CHANGE','STAFFING','ACCESS_CONTROL','OTHER')),
 description TEXT NOT NULL,
 owner_user_id TEXT NOT NULL REFERENCES users(id),
 owner_company_id TEXT NOT NULL REFERENCES companies(id),
 due_date TEXT NOT NULL,
 budget_required INTEGER NOT NULL DEFAULT 0 CHECK(budget_required IN (0,1)),
 budget_amount REAL CHECK(budget_amount IS NULL OR budget_amount>=0),
 status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN ('ASSIGNED','IN_PROGRESS','COMPLETION_REQUESTED','COMPLETED','REWORK_REQUIRED','CANCELLED')),
 completed_at TEXT,
 completed_by_user_id TEXT REFERENCES users(id),
 review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','APPROVED','REWORK_REQUIRED','RECHECK_REQUIRED')),
 revision INTEGER NOT NULL DEFAULT 1,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_corrective_action_media (
 id TEXT PRIMARY KEY,
 action_id TEXT NOT NULL REFERENCES safety_corrective_actions(id),
 safety_case_id TEXT NOT NULL REFERENCES safety_cases(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 media_role TEXT NOT NULL CHECK(media_role IN ('BEFORE','AFTER','RECHECK')),
 source_type TEXT CHECK(source_type IS NULL OR source_type IN ('ISSUE_MEDIA','SAFETY_MEDIA')),
 source_media_id TEXT,
 original_key TEXT,
 thumbnail_key TEXT,
 original_name TEXT,
 mime_type TEXT,
 description TEXT,
 uploaded_by_user_id TEXT REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DELETED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(source_media_id IS NOT NULL OR (original_key IS NOT NULL AND thumbnail_key IS NOT NULL)),
 UNIQUE(action_id,source_type,source_media_id,media_role)
);

CREATE TABLE safety_case_reviews (
 id TEXT PRIMARY KEY,
 safety_case_id TEXT NOT NULL REFERENCES safety_cases(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 review_result TEXT NOT NULL CHECK(review_result IN ('APPROPRIATE','REVISION_REQUIRED','RECHECK_REQUIRED','FINALIZABLE')),
 review_note TEXT NOT NULL,
 target_action_id TEXT REFERENCES safety_corrective_actions(id),
 rework_owner_user_id TEXT REFERENCES users(id),
 rework_due_date TEXT,
 reviewed_by_user_id TEXT NOT NULL REFERENCES users(id),
 reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_case_revisions (
 id TEXT PRIMARY KEY,
 safety_case_id TEXT NOT NULL REFERENCES safety_cases(id),
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 change_type TEXT NOT NULL,
 change_reason TEXT,
 changed_by_user_id TEXT NOT NULL REFERENCES users(id),
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(safety_case_id,revision)
);

CREATE TABLE periodic_checklist_templates (
 id TEXT PRIMARY KEY,
 module_key TEXT NOT NULL CHECK(module_key IN ('safety','quality')),
 template_key TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT,
 is_system INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN (0,1)),
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 created_by_user_id TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(module_key,template_key)
);

CREATE TABLE periodic_checklist_items (
 id TEXT PRIMARY KEY,
 template_id TEXT NOT NULL REFERENCES periodic_checklist_templates(id),
 item_key TEXT NOT NULL,
 prompt TEXT NOT NULL,
 guidance TEXT,
 requires_photo INTEGER NOT NULL DEFAULT 0 CHECK(requires_photo IN (0,1)),
 requires_followup_on_fail INTEGER NOT NULL DEFAULT 1 CHECK(requires_followup_on_fail IN (0,1)),
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(template_id,item_key)
);

CREATE TABLE periodic_task_definitions (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 module_key TEXT NOT NULL CHECK(module_key IN ('safety','quality')),
 board_key TEXT NOT NULL,
 task_key TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT,
 recurrence_type TEXT NOT NULL CHECK(recurrence_type IN ('DAILY','WEEKLY','MONTHLY','QUARTERLY','SEMIANNUAL','YEARLY','SPECIFIC_DATE','PROCESS_BEFORE','PROCESS_AFTER','MANUAL')),
 recurrence_rule TEXT NOT NULL DEFAULT '{}',
 start_date TEXT NOT NULL,
 due_time TEXT NOT NULL,
 assignee_type TEXT NOT NULL DEFAULT 'USER' CHECK(assignee_type IN ('USER','ROLE')),
 assignee_user_id TEXT REFERENCES users(id),
 assignee_role_key TEXT,
 reviewer_user_id TEXT REFERENCES users(id),
 document_template_id TEXT,
 checklist_template_id TEXT NOT NULL REFERENCES periodic_checklist_templates(id),
 issue_creation_policy TEXT NOT NULL DEFAULT 'REVIEW' CHECK(issue_creation_policy IN ('ISSUE','SAFETY_CASE','REVIEW')),
 is_mandatory INTEGER NOT NULL DEFAULT 1 CHECK(is_mandatory IN (0,1)),
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(site_id,module_key,task_key)
);

CREATE TABLE periodic_task_instances (
 id TEXT PRIMARY KEY,
 definition_id TEXT NOT NULL REFERENCES periodic_task_definitions(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 scheduled_date_kst TEXT NOT NULL,
 due_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('SCHEDULED','AVAILABLE','IN_PROGRESS','SUBMISSION_PENDING','REVIEW_PENDING','REVISION_REQUESTED','COMPLETED','OVERDUE','MISSED','CANCELLED')),
 assigned_user_id TEXT REFERENCES users(id),
 started_at TEXT,
 completed_at TEXT,
 submitted_at TEXT,
 reviewed_at TEXT,
 reviewed_by_user_id TEXT REFERENCES users(id),
 source_revision INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(definition_id,scheduled_date_kst)
);

CREATE TABLE periodic_task_checklist_results (
 id TEXT PRIMARY KEY,
 task_instance_id TEXT NOT NULL REFERENCES periodic_task_instances(id),
 checklist_item_id TEXT NOT NULL REFERENCES periodic_checklist_items(id),
 result TEXT NOT NULL CHECK(result IN ('APPROPRIATE','INAPPROPRIATE','NOT_APPLICABLE','UNCONFIRMED')),
 value TEXT,
 note TEXT,
 location_id TEXT REFERENCES site_locations(id),
 company_id TEXT REFERENCES companies(id),
 trade_id TEXT REFERENCES trade_master(id),
 revision INTEGER NOT NULL DEFAULT 1,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(task_instance_id,checklist_item_id)
);

CREATE TABLE periodic_task_documents (
 id TEXT PRIMARY KEY,
 task_instance_id TEXT NOT NULL UNIQUE REFERENCES periodic_task_instances(id),
 document_template_id TEXT,
 document_data_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 submitted_by_user_id TEXT REFERENCES users(id),
 submitted_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE periodic_task_findings (
 id TEXT PRIMARY KEY,
 task_instance_id TEXT NOT NULL REFERENCES periodic_task_instances(id),
 checklist_result_id TEXT NOT NULL REFERENCES periodic_task_checklist_results(id),
 finding_type TEXT NOT NULL CHECK(finding_type IN ('ISSUE','SAFETY_CASE','CORRECTIVE_ACTION','REVIEW')),
 description TEXT NOT NULL,
 severity TEXT,
 issue_id TEXT REFERENCES issue_items(id),
 safety_case_id TEXT REFERENCES safety_cases(id),
 quality_case_id TEXT,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','LINKED','RESOLVED','WAIVED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(checklist_result_id,finding_type)
);

CREATE TABLE periodic_task_instance_media (
 id TEXT PRIMARY KEY,
 task_instance_id TEXT NOT NULL REFERENCES periodic_task_instances(id),
 checklist_result_id TEXT REFERENCES periodic_task_checklist_results(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 original_key TEXT NOT NULL UNIQUE,
 thumbnail_key TEXT NOT NULL UNIQUE,
 original_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 description TEXT,
 uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE periodic_task_revisions (
 id TEXT PRIMARY KEY,
 task_instance_id TEXT NOT NULL REFERENCES periodic_task_instances(id),
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 change_type TEXT NOT NULL,
 change_reason TEXT,
 changed_by_user_id TEXT NOT NULL REFERENCES users(id),
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(task_instance_id,revision)
);

INSERT INTO safety_risk_categories(id,code,display_name,sort_order) VALUES
 ('risk-fall','FALL','추락',10),('risk-falling-object','FALLING_OBJECT','낙하·비래',20),('risk-collapse','COLLAPSE','붕괴',30),
 ('risk-entanglement','ENTANGLEMENT','끼임',40),('risk-collision','COLLISION','충돌',50),('risk-overturn','OVERTURN','전도',60),
 ('risk-electric','ELECTRIC_SHOCK','감전',70),('risk-fire','FIRE_EXPLOSION','화재·폭발',80),('risk-asphyxia','ASPHYXIA','질식',90),
 ('risk-heavy','HEAVY_OBJECT','중량물',100),('risk-lifting','LIFTING','양중',110),('risk-machinery','CONSTRUCTION_MACHINERY','건설기계',120),
 ('risk-temporary','TEMPORARY_FACILITY','가설시설',130),('risk-excavation','EXCAVATION','굴착',140),('risk-confined','CONFINED_SPACE','밀폐공간',150),
 ('risk-chemical','CHEMICAL','화학물질',160),('risk-environment','WORK_ENVIRONMENT','작업환경',170),('risk-ppe','PPE','보호구',180),
 ('risk-housekeeping','HOUSEKEEPING','정리정돈',190),('risk-procedure','WORK_PROCEDURE','작업절차',200),('risk-management','EDUCATION_MANAGEMENT','교육·관리',210),
 ('risk-other','OTHER','기타',999)
ON CONFLICT(code) DO NOTHING;

INSERT INTO safety_root_cause_categories(id,code,display_name,sort_order) VALUES
 ('root-cat-management','MANAGEMENT','관리',10),('root-cat-human','HUMAN','인적 행동',20),('root-cat-method','METHOD','작업방법',30),
 ('root-cat-facility','FACILITY','시설·구조',40),('root-cat-equipment','EQUIPMENT','장비·도구',50),('root-cat-material','MATERIAL','자재',60),
 ('root-cat-environment','ENVIRONMENT','작업환경',70),('root-cat-ppe','PPE','보호구',80),('root-cat-communication','COMMUNICATION','교육·소통',90),
 ('root-cat-other','OTHER','기타',999)
ON CONFLICT(code) DO NOTHING;

INSERT INTO safety_root_cause_groups(id,category_id,code,display_name,sort_order) VALUES
 ('root-group-education','root-cat-management','MANAGEMENT_EDUCATION','교육·전달',10),
 ('root-group-planning','root-cat-management','MANAGEMENT_PLANNING','작업계획',20),
 ('root-group-housekeeping','root-cat-environment','ENVIRONMENT_HOUSEKEEPING','정리정돈',30),
 ('root-group-guardrail','root-cat-facility','FACILITY_TEMPORARY','가설시설',40),
 ('root-group-method','root-cat-method','METHOD_PROCEDURE','작업방법',50),
 ('root-group-inspection','root-cat-equipment','EQUIPMENT_INSPECTION','점검',60)
ON CONFLICT(code) DO NOTHING;

INSERT INTO safety_root_causes(id,group_id,code,display_name,sort_order) VALUES
 ('root-cause-briefing-missed','root-group-education','BRIEFING_MISSED','작업 전 안전사항 전달 누락',10),
 ('root-cause-plan-missing','root-group-planning','WORK_PLAN_MISSING','작업계획서 미작성',20),
 ('root-cause-material-in-path','root-group-housekeeping','MATERIAL_IN_PATH','통로 자재 적치',30),
 ('root-cause-guardrail-missing','root-group-guardrail','GUARDRAIL_MISSING','안전난간 미설치',40),
 ('root-cause-arbitrary-method','root-group-method','ARBITRARY_METHOD','임의 작업 절차 사용',50),
 ('root-cause-inspection-missed','root-group-inspection','PREWORK_INSPECTION_MISSED','작업 전 점검 미실시',60)
ON CONFLICT(code) DO NOTHING;

INSERT INTO periodic_checklist_templates(id,module_key,template_key,title,description,is_system)
VALUES('periodic-template-safety-daily','safety','SAFETY_DAILY_DEFAULT','일일 현장 안전점검','현장별로 적용·보완하는 기본 안전 점검표',1)
ON CONFLICT(module_key,template_key) DO NOTHING;

INSERT INTO periodic_checklist_items(id,template_id,item_key,prompt,guidance,requires_photo,sort_order) VALUES
 ('periodic-item-housekeeping','periodic-template-safety-daily','HOUSEKEEPING','통로와 작업구역이 정리되어 있습니까?','자재 적치와 이동 통로를 확인합니다.',0,10),
 ('periodic-item-guardrail','periodic-template-safety-daily','GUARDRAIL','개구부와 안전난간이 고정되어 있습니까?','추락 위험 구역을 확인합니다.',1,20),
 ('periodic-item-electric','periodic-template-safety-daily','TEMP_ELECTRIC','가설전기 상태가 안전합니까?','분전반과 임시 배선을 확인합니다.',0,30),
 ('periodic-item-ppe','periodic-template-safety-daily','PPE','보호구 착용 상태가 적정합니까?','작업별 보호구를 확인합니다.',0,40)
ON CONFLICT(template_id,item_key) DO NOTHING;

CREATE INDEX idx_safety_cases_site_status ON safety_cases(site_id,status,created_at DESC);
CREATE INDEX idx_safety_cases_company_status ON safety_cases(site_id,company_id,status);
CREATE INDEX idx_safety_cases_root_cause ON safety_cases(site_id,root_cause_id,status);
CREATE INDEX idx_safety_sources_source ON safety_case_sources(site_id,source_type,source_id);
CREATE INDEX idx_safety_actions_case_status ON safety_corrective_actions(safety_case_id,status,due_date);
CREATE INDEX idx_safety_media_case ON safety_case_media(safety_case_id,status,created_at);
CREATE INDEX idx_safety_reviews_case ON safety_case_reviews(safety_case_id,reviewed_at);
CREATE INDEX idx_periodic_definitions_site ON periodic_task_definitions(site_id,module_key,is_active);
CREATE INDEX idx_periodic_instances_site_date ON periodic_task_instances(site_id,scheduled_date_kst,status);
CREATE INDEX idx_periodic_instances_assignee ON periodic_task_instances(site_id,assigned_user_id,status,due_at);
CREATE INDEX idx_periodic_results_instance ON periodic_task_checklist_results(task_instance_id,result);
CREATE INDEX idx_periodic_findings_instance ON periodic_task_findings(task_instance_id,status);

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,
 CASE
  WHEN r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER') THEN 'MANAGE'
  WHEN r.code IN ('CONSTRUCTION_MANAGER','GENERAL_CONTRACTOR_FOREMAN') THEN CASE WHEN b.board_key IN ('SAFETY_CASE','SAFETY_CORRECTIVE_ACTION') THEN 'EDIT' ELSE 'VIEW' END
  WHEN r.code IN ('CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','CONTRACTOR_FOREMAN') THEN CASE WHEN b.board_key IN ('SAFETY_CASE','SAFETY_CORRECTIVE_ACTION','SAFETY_PERIODIC_TASK') THEN 'EDIT' ELSE 'VIEW' END
  ELSE 'VIEW'
 END,
 m.user_id
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id
JOIN board_definitions b ON b.board_key IN ('SAFETY_CASE','SAFETY_RISK_ASSESSMENT','SAFETY_CORRECTIVE_ACTION','SAFETY_ROOT_CAUSE','SAFETY_DASHBOARD','SAFETY_PERIODIC_TASK')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
 AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER','CONSTRUCTION_MANAGER','GENERAL_CONTRACTOR_FOREMAN','CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','CONTRACTOR_FOREMAN')
GROUP BY m.site_id,b.id,m.user_id;

INSERT OR IGNORE INTO module_entitlements(id,user_id,module_code,status)
SELECT lower(hex(randomblob(16))),g.user_id,'safety','ACTIVE'
FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id
WHERE g.is_active=1 AND b.module_key='safety';

UPDATE users SET context_version=context_version+1
WHERE id IN (
 SELECT DISTINCT g.user_id FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id
 WHERE g.is_active=1 AND b.module_key='safety'
);
