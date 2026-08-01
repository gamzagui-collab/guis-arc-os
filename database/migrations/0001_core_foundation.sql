PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, login_identifier TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  credential_hash TEXT NOT NULL, credential_salt TEXT NOT NULL, credential_iterations INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','LOCKED')),
  context_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ACTIVE',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ACTIVE',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS company_site_contracts (id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),site_id TEXT NOT NULL REFERENCES sites(id),contractor_type TEXT NOT NULL,trade_code TEXT,status TEXT NOT NULL DEFAULT 'ACTIVE',UNIQUE(company_id,site_id));
CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),company_id TEXT NOT NULL REFERENCES companies(id),site_id TEXT REFERENCES sites(id),status TEXT NOT NULL DEFAULT 'ACTIVE',UNIQUE(user_id,company_id,site_id));
CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,rank INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,module_code TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id),permission_id TEXT NOT NULL REFERENCES permissions(id),PRIMARY KEY(role_id,permission_id));
CREATE TABLE IF NOT EXISTS user_site_roles (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),role_id TEXT NOT NULL REFERENCES roles(id),company_id TEXT NOT NULL REFERENCES companies(id),site_id TEXT REFERENCES sites(id),status TEXT NOT NULL DEFAULT 'ACTIVE');
CREATE TABLE IF NOT EXISTS module_entitlements (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),module_code TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ACTIVE',UNIQUE(user_id,module_code));
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),token_hash TEXT NOT NULL UNIQUE,csrf_hash TEXT NOT NULL,context_version INTEGER NOT NULL,selected_site_id TEXT REFERENCES sites(id),idle_expires_at TEXT NOT NULL,absolute_expires_at TEXT NOT NULL,revoked_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY,identifier TEXT NOT NULL,company_id TEXT REFERENCES companies(id),site_id TEXT REFERENCES sites(id),role_code TEXT,module_codes_json TEXT NOT NULL DEFAULT '[]',token_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'PENDING',expires_at TEXT NOT NULL,accepted_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY,actor_user_id TEXT,action TEXT NOT NULL,outcome TEXT NOT NULL,request_id TEXT NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY,owner_module TEXT NOT NULL,owner_record_id TEXT NOT NULL,r2_key TEXT NOT NULL UNIQUE,content_type TEXT,size_bytes INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rate_limits (key_hash TEXT PRIMARY KEY,count INTEGER NOT NULL,window_started_at TEXT NOT NULL,blocked_until TEXT);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id,revoked_at,idle_expires_at);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id,status);
CREATE INDEX IF NOT EXISTS idx_roles_user_site ON user_site_roles(user_id,site_id,status);
