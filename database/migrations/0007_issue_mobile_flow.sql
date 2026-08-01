PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions(id,code,module_code)
VALUES('perm-issue-manage-locations','issue.manage_locations','issue');

INSERT OR IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code='issue.manage_locations'
WHERE r.code='SITE_MANAGER';

CREATE TABLE IF NOT EXISTS company_site_contract_trades (
  id TEXT PRIMARY KEY,
  site_contract_id TEXT NOT NULL REFERENCES company_site_contracts(id),
  trade_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_contract_id,trade_code)
);

CREATE INDEX IF NOT EXISTS idx_contract_trades_active
ON company_site_contract_trades(site_contract_id,status,trade_code);

INSERT OR IGNORE INTO company_site_contracts(id,company_id,site_id,contractor_type,trade_code,status)
SELECT 'gc-contract-'||s.id,s.company_id,s.id,'GENERAL_CONTRACTOR','DIRECT','ACTIVE'
FROM sites s
WHERE NOT EXISTS (
  SELECT 1 FROM company_site_contracts c
  WHERE c.site_id=s.id AND c.company_id=s.company_id
);

INSERT OR IGNORE INTO company_site_contract_trades(id,site_contract_id,trade_code,status)
SELECT 'trade-'||id||'-'||replace(coalesce(trade_code,'DIRECT'),' ','_'),
       id,coalesce(trade_code,'DIRECT'),'ACTIVE'
FROM company_site_contracts
WHERE status='ACTIVE';
