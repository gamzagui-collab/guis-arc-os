PRAGMA foreign_keys = ON;

CREATE TABLE construction_departments (
  code TEXT PRIMARY KEY CHECK(code IN ('CONSTRUCTION','SAFETY','QUALITY','ADMINISTRATION','UNCLASSIFIED')),
  display_name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
);

INSERT OR IGNORE INTO construction_departments(code,display_name,sort_order) VALUES
 ('CONSTRUCTION','공사',10),('SAFETY','안전',20),('QUALITY','품질',30),
 ('ADMINISTRATION','관리',40),('UNCLASSIFIED','미분류',50);

CREATE TABLE construction_department_rules (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id),
  department_code TEXT NOT NULL REFERENCES construction_departments(code),
  rule_name TEXT NOT NULL,
  include_keywords_json TEXT NOT NULL DEFAULT '[]',
  exclude_keywords_json TEXT NOT NULL DEFAULT '[]',
  trade_id TEXT REFERENCES trade_master(id),
  priority INTEGER NOT NULL DEFAULT 100,
  base_confidence INTEGER NOT NULL CHECK(base_confidence BETWEEN 0 AND 100),
  source TEXT NOT NULL CHECK(source IN ('SYSTEM','SITE','MANUAL')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_department_rules_scope_active_priority ON construction_department_rules(site_id,is_active,priority DESC);
CREATE INDEX idx_department_rules_trade_active ON construction_department_rules(trade_id,is_active);

CREATE TABLE issue_department_recommendations (
  issue_id TEXT PRIMARY KEY REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id),
  recommended_department_code TEXT NOT NULL REFERENCES construction_departments(code),
  confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 100),
  confidence_label TEXT NOT NULL CHECK(confidence_label IN ('HIGH','REVIEW_REQUIRED','UNCLASSIFIED')),
  conflict INTEGER NOT NULL DEFAULT 0 CHECK(conflict IN (0,1)),
  reason_json TEXT NOT NULL DEFAULT '[]',
  rule_ids_json TEXT NOT NULL DEFAULT '[]',
  candidate_departments_json TEXT NOT NULL DEFAULT '[]',
  input_hash TEXT NOT NULL,
  evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_department_code TEXT REFERENCES construction_departments(code),
  confirmed_by_user_id TEXT REFERENCES users(id),
  confirmed_at TEXT,
  manual_override INTEGER NOT NULL DEFAULT 0 CHECK(manual_override IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_issue_department_site_recommended ON issue_department_recommendations(site_id,recommended_department_code,evaluated_at DESC);
CREATE INDEX idx_issue_department_site_confirmed ON issue_department_recommendations(site_id,confirmed_department_code,confirmed_at DESC);

INSERT OR IGNORE INTO construction_department_rules(id,department_code,rule_name,include_keywords_json,exclude_keywords_json,priority,base_confidence,source) VALUES
 ('sys-dept-safety-guardrail-missing','SAFETY','안전난간 미설치','["안전난간","미설치"]','["도장 불량"]',900,95,'SYSTEM'),
 ('sys-dept-safety-fall-prevention','SAFETY','추락방지 미설치','["추락방지","미설치"]','[]',900,95,'SYSTEM'),
 ('sys-dept-safety-form-fall','SAFETY','형틀 추락 위험','["형틀","추락"]','[]',880,92,'SYSTEM'),
 ('sys-dept-safety-strong-fall','SAFETY','추락 위험','["추락"]','[]',700,80,'SYSTEM'),
 ('sys-dept-quality-concrete-strength','QUALITY','콘크리트 압축강도','["콘크리트","압축강도"]','[]',880,92,'SYSTEM'),
 ('sys-dept-quality-test-report','QUALITY','시험성적서 미제출','["시험성적서","미제출"]','[]',850,90,'SYSTEM'),
 ('sys-dept-quality-inspection','QUALITY','검측 또는 품질시험','["검측"]','[]',700,78,'SYSTEM'),
 ('sys-dept-construction-wall-chipping','CONSTRUCTION','벽면 할석','["벽면","할석"]','[]',850,90,'SYSTEM'),
 ('sys-dept-construction-form-defect','CONSTRUCTION','형틀 시공 불량','["형틀","시공 불량"]','["추락"]',820,88,'SYSTEM'),
 ('sys-dept-construction-crack','CONSTRUCTION','일반 균열','["균열"]','["압축강도","시험"]',700,78,'SYSTEM'),
 ('sys-dept-construction-guardrail-paint','CONSTRUCTION','난간 도장 불량','["난간","도장 불량"]','["미설치","추락"]',840,88,'SYSTEM'),
 ('sys-dept-administration-contract-doc','ADMINISTRATION','계약서류 미제출','["계약","서류"]','[]',820,88,'SYSTEM'),
 ('sys-dept-administration-document-submit','ADMINISTRATION','문서 제출','["문서","제출"]','[]',700,76,'SYSTEM');
