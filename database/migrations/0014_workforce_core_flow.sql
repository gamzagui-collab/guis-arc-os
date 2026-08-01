PRAGMA foreign_keys = ON;

CREATE TABLE workforce_teams (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 company_id TEXT NOT NULL REFERENCES companies(id),
 trade_id TEXT NOT NULL REFERENCES trade_master(id),
 team_name TEXT NOT NULL,
 manager_user_id TEXT REFERENCES users(id),
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_by_user_id TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revision INTEGER NOT NULL DEFAULT 1,
 UNIQUE(site_id,company_id,team_name)
);

ALTER TABLE workforce_site_enrollments ADD COLUMN team_id TEXT REFERENCES workforce_teams(id);
ALTER TABLE workforce_site_enrollments ADD COLUMN role_code TEXT;
ALTER TABLE workforce_site_enrollments ADD COLUMN join_method TEXT NOT NULL DEFAULT 'INVITATION';
ALTER TABLE workforce_site_enrollments ADD COLUMN rejection_reason TEXT;
ALTER TABLE workforce_site_enrollments ADD COLUMN reviewed_at TEXT;

ALTER TABLE workforce_attendance ADD COLUMN team_id TEXT REFERENCES workforce_teams(id);
ALTER TABLE workforce_attendance ADD COLUMN qr_session_id TEXT REFERENCES workforce_qr_sessions(id);
ALTER TABLE workforce_attendance ADD COLUMN approval_status_snapshot TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE workforce_attendance ADD COLUMN cancelled_at TEXT;
ALTER TABLE workforce_attendance ADD COLUMN cancelled_by_user_id TEXT REFERENCES users(id);
ALTER TABLE workforce_attendance ADD COLUMN correction_reason TEXT;

ALTER TABLE invitations ADD COLUMN workforce_trade_id TEXT REFERENCES trade_master(id);
ALTER TABLE invitations ADD COLUMN workforce_team_id TEXT REFERENCES workforce_teams(id);

CREATE TABLE daily_output_reports (
 id TEXT PRIMARY KEY,
 site_id TEXT NOT NULL REFERENCES sites(id),
 work_date_kst TEXT NOT NULL,
 company_id TEXT NOT NULL REFERENCES companies(id),
 trade_id TEXT NOT NULL REFERENCES trade_master(id),
 team_id TEXT REFERENCES workforce_teams(id),
 team_scope TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','REVISION_REQUESTED','APPROVED','CANCELLED')),
 work_description TEXT NOT NULL DEFAULT '',
 building_location_id TEXT REFERENCES site_locations(id),
 unit_location_id TEXT REFERENCES site_locations(id),
 room_location_id TEXT REFERENCES site_locations(id),
 note TEXT NOT NULL DEFAULT '',
 difference_reason TEXT NOT NULL DEFAULT '',
 submitted_by_user_id TEXT REFERENCES users(id),
 submitted_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(site_id,work_date_kst,company_id,trade_id,team_scope)
);

CREATE TABLE daily_output_report_workers (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES daily_output_reports(id),
 attendance_id TEXT NOT NULL REFERENCES workforce_attendance(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 included INTEGER NOT NULL DEFAULT 1 CHECK(included IN (0,1)),
 exclusion_reason TEXT,
 work_description TEXT,
 location_id TEXT REFERENCES site_locations(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(report_id,attendance_id)
);

CREATE TABLE daily_output_report_revisions (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL REFERENCES daily_output_reports(id),
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 changed_by_user_id TEXT NOT NULL REFERENCES users(id),
 change_type TEXT NOT NULL,
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(report_id,revision)
);

CREATE INDEX idx_workforce_team_scope ON workforce_teams(site_id,company_id,trade_id,is_active);
CREATE INDEX idx_workforce_enrollment_team ON workforce_site_enrollments(site_id,team_id,approval_status);
CREATE INDEX idx_workforce_attendance_team ON workforce_attendance(site_id,work_date,team_id,attendance_status);
CREATE INDEX idx_daily_output_scope ON daily_output_reports(site_id,work_date_kst,company_id,status);
CREATE INDEX idx_daily_output_workers ON daily_output_report_workers(report_id,included);

INSERT OR IGNORE INTO board_definitions(id,board_key,module_key,display_name,contains_sensitive_data,is_active) VALUES
 ('board-workforce-approval','WORKFORCE_APPROVAL','workforce','가입 승인',1,1),
 ('board-workforce-daily-output','WORKFORCE_DAILY_OUTPUT','workforce','출력일보',1,1);

UPDATE board_definitions SET display_name=CASE board_key
 WHEN 'WORKFORCE_PROFILE' THEN '근로자 관리'
 WHEN 'WORKFORCE_APPROVAL' THEN '가입 승인'
 WHEN 'WORKFORCE_ATTENDANCE' THEN '출역 현황'
 WHEN 'WORKFORCE_DAILY_OUTPUT' THEN '출력일보'
 ELSE display_name END
WHERE board_key LIKE 'WORKFORCE_%';

INSERT OR IGNORE INTO permissions(id,code,module_code) VALUES
 ('perm-workforce-profile-edit','workforce.profile.edit','workforce'),
 ('perm-workforce-team-manage','workforce.team.manage','workforce'),
 ('perm-workforce-output-read','workforce.output.read','workforce'),
 ('perm-workforce-output-edit','workforce.output.edit','workforce'),
 ('perm-workforce-output-manage','workforce.output.manage','workforce');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.module_code='workforce'
WHERE r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
 ('module.workforce.access','workforce.read','workforce.view_statistics','workforce.output.read','workforce.output.edit','workforce.profile.edit')
WHERE r.code IN ('CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
 ('module.workforce.access','workforce.read','workforce.view_statistics','workforce.output.read','workforce.output.edit')
WHERE r.code IN ('GENERAL_CONTRACTOR_FOREMAN','CONTRACTOR_FOREMAN');

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,'MANAGE',m.user_id
FROM memberships m
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
JOIN board_definitions b ON b.board_key IN ('WORKFORCE_PROFILE','WORKFORCE_APPROVAL','WORKFORCE_ATTENDANCE','WORKFORCE_DAILY_OUTPUT')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL;

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,
 CASE b.board_key
  WHEN 'WORKFORCE_PROFILE' THEN 'EDIT'
  WHEN 'WORKFORCE_APPROVAL' THEN 'VIEW'
  WHEN 'WORKFORCE_ATTENDANCE' THEN 'VIEW'
  ELSE 'EDIT' END,
 NULL
FROM memberships m
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER')
JOIN board_definitions b ON b.board_key IN ('WORKFORCE_PROFILE','WORKFORCE_APPROVAL','WORKFORCE_ATTENDANCE','WORKFORCE_DAILY_OUTPUT')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL;

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,
 CASE WHEN b.board_key='WORKFORCE_DAILY_OUTPUT' THEN 'EDIT' ELSE 'VIEW' END,
 NULL
FROM memberships m
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('GENERAL_CONTRACTOR_FOREMAN','CONTRACTOR_FOREMAN')
JOIN board_definitions b ON b.board_key IN ('WORKFORCE_PROFILE','WORKFORCE_ATTENDANCE','WORKFORCE_DAILY_OUTPUT')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL;

INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json)
VALUES(lower(hex(randomblob(16))),NULL,'WORKFORCE_CORE_MIGRATED','ALLOWED','migration-0014',
 json_object('boards',4,'dynamicQr',1,'dailyOutput',1,'gps',0));
