PRAGMA foreign_keys = ON;

ALTER TABLE companies ADD COLUMN company_type TEXT CHECK(company_type IN ('GENERAL_CONTRACTOR','SUBCONTRACTOR'));
ALTER TABLE companies ADD COLUMN contact_masked TEXT;
ALTER TABLE companies ADD COLUMN updated_at TEXT;
UPDATE companies SET company_type=CASE WHEN id IN (SELECT company_id FROM sites) THEN 'GENERAL_CONTRACTOR' ELSE 'SUBCONTRACTOR' END,
 updated_at=COALESCE(updated_at,created_at);

ALTER TABLE company_site_contracts ADD COLUMN participation_start_date TEXT;
ALTER TABLE company_site_contracts ADD COLUMN participation_end_date TEXT;
ALTER TABLE company_site_contracts ADD COLUMN site_manager_user_id TEXT REFERENCES users(id);
ALTER TABLE company_site_contracts ADD COLUMN updated_at TEXT;
UPDATE company_site_contracts SET updated_at=CURRENT_TIMESTAMP WHERE updated_at IS NULL;

ALTER TABLE invitations ADD COLUMN display_name TEXT;
ALTER TABLE invitations ADD COLUMN company_role_code TEXT;
ALTER TABLE invitations ADD COLUMN site_role_code TEXT;
ALTER TABLE invitations ADD COLUMN display_code TEXT;
ALTER TABLE invitations ADD COLUMN display_code_hash TEXT;
ALTER TABLE invitations ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
ALTER TABLE invitations ADD COLUMN cancelled_by_user_id TEXT REFERENCES users(id);
ALTER TABLE invitations ADD COLUMN cancelled_at TEXT;
ALTER TABLE invitations ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX idx_invitations_display_code_hash ON invitations(display_code_hash);
CREATE INDEX idx_invitations_admin_list ON invitations(site_id,company_id,status,created_at DESC);

CREATE TABLE invitation_acceptances (
  invitation_id TEXT PRIMARY KEY REFERENCES invitations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO roles(id,code,name,rank) VALUES
 ('role-general-contractor-foreman','GENERAL_CONTRACTOR_FOREMAN','General Contractor Foreman',450),
 ('role-contractor-employee','CONTRACTOR_EMPLOYEE','Contractor Employee',250);

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN
 ('module.issue.access','issue.read','issue.create','issue.act','issue.request_completion')
WHERE r.code IN ('GENERAL_CONTRACTOR_FOREMAN','CONTRACTOR_EMPLOYEE');
