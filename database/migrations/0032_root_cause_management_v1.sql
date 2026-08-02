PRAGMA foreign_keys = ON;

CREATE TABLE root_cause_categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category_scope TEXT NOT NULL DEFAULT 'SYSTEM' CHECK(category_scope IN ('SYSTEM','SITE')),
  site_id TEXT REFERENCES sites(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((category_scope='SYSTEM' AND site_id IS NULL) OR (category_scope='SITE' AND site_id IS NOT NULL))
);

CREATE TABLE issue_root_cause_analyses (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL UNIQUE REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id),
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','DRAFT','CONFIRMED')),
  prevention_note TEXT,
  confirmed_by_user_id TEXT REFERENCES users(id),
  confirmed_at TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  updated_by_user_id TEXT NOT NULL REFERENCES users(id),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((status='CONFIRMED' AND confirmed_by_user_id IS NOT NULL AND confirmed_at IS NOT NULL) OR status!='CONFIRMED')
);

CREATE TABLE issue_root_causes (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES issue_root_cause_analyses(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL REFERENCES issue_items(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id),
  cause_category_id TEXT NOT NULL REFERENCES root_cause_categories(id),
  cause_level TEXT NOT NULL CHECK(cause_level IN ('DIRECT','CONTRIBUTING','ROOT')),
  note TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(analysis_id,cause_category_id,cause_level)
);

CREATE INDEX idx_root_cause_analysis_site_status ON issue_root_cause_analyses(site_id,status,confirmed_at);
CREATE INDEX idx_root_causes_site_level_category ON issue_root_causes(site_id,cause_level,cause_category_id);

INSERT INTO root_cause_categories(id,code,display_name,description,sort_order) VALUES
 ('rc-system-work-plan','WORK_PLAN','작업 계획','작업 순서·준비·계획의 미흡',10),
 ('rc-system-procedure','PROCEDURE','절차 및 기준','절차·기준의 부재 또는 불명확',20),
 ('rc-system-communication','COMMUNICATION','의사소통','인계·전달·협의 과정의 미흡',30),
 ('rc-system-training','TRAINING','교육 및 숙련','교육·훈련·숙련 지원의 미흡',40),
 ('rc-system-supervision','SUPERVISION','점검 및 관리','확인·점검·관리 과정의 미흡',50),
 ('rc-system-resource','RESOURCE','인력 및 자원','필요 인력·시간·자원 확보의 미흡',60),
 ('rc-system-material','MATERIAL_CONTROL','자재 관리','자재 선정·보관·공급 관리의 미흡',70),
 ('rc-system-equipment','EQUIPMENT_CONTROL','장비 및 도구 관리','장비·도구 선정·점검 관리의 미흡',80),
 ('rc-system-interface','WORK_INTERFACE','공정 간 연계','공정·업체·작업 간 연계의 미흡',90),
 ('rc-system-change','CHANGE_CONTROL','변경 관리','설계·조건·계획 변경 관리의 미흡',100),
 ('rc-system-environment','WORK_ENVIRONMENT','작업 환경','접근·공간·조도 등 작업 환경의 미흡',110),
 ('rc-system-verification','VERIFICATION','검증 및 확인','검사·측정·완료 확인 과정의 미흡',120);
