PRAGMA foreign_keys = ON;

CREATE TABLE construction_monthly_plans (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  trade_key TEXT NOT NULL,
  trade_label TEXT NOT NULL,
  contractor_company_id TEXT REFERENCES companies(id),
  contractor_company_name_snapshot TEXT,
  location_text TEXT,
  work_description TEXT NOT NULL,
  planned_workforce INTEGER CHECK(planned_workforce IS NULL OR planned_workforce >= 0),
  start_time TEXT,
  end_time TEXT,
  caution_text TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK(status IN ('SCHEDULED','CHANGED','CANCELLED')),
  revision INTEGER NOT NULL DEFAULT 1,
  client_request_id TEXT,
  client_payload_hash TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  updated_by_user_id TEXT NOT NULL REFERENCES users(id),
  cancelled_by_user_id TEXT REFERENCES users(id),
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(end_date >= start_date),
  UNIQUE(site_id,created_by_user_id,client_request_id)
);

CREATE INDEX idx_construction_monthly_plans_site_start
  ON construction_monthly_plans(site_id,start_date);
CREATE INDEX idx_construction_monthly_plans_site_end
  ON construction_monthly_plans(site_id,end_date);
CREATE INDEX idx_construction_monthly_plans_site_status
  ON construction_monthly_plans(site_id,status);
CREATE INDEX idx_construction_monthly_plans_company
  ON construction_monthly_plans(contractor_company_id)
  WHERE contractor_company_id IS NOT NULL;
