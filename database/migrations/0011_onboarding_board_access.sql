PRAGMA foreign_keys = ON;

ALTER TABLE companies ADD COLUMN business_registration_number TEXT;
CREATE UNIQUE INDEX idx_companies_business_registration_number
ON companies(business_registration_number)
WHERE business_registration_number IS NOT NULL;

ALTER TABLE memberships ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'APPROVED'
CHECK(approval_status IN ('PENDING','APPROVED','REJECTED'));

CREATE TABLE trade_master (
  id TEXT PRIMARY KEY,
  trade_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  parent_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_trades (
  company_id TEXT NOT NULL REFERENCES companies(id),
  trade_id TEXT NOT NULL REFERENCES trade_master(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(company_id,trade_id)
);

ALTER TABLE company_site_contract_trades ADD COLUMN trade_id TEXT REFERENCES trade_master(id);

INSERT INTO trade_master(id,trade_key,display_name,parent_category,status,sort_order) VALUES
 ('trade-architecture','ARCHITECTURE','건축','건축','ACTIVE',10),
 ('trade-civil','CIVIL','토목','토목','ACTIVE',20),
 ('trade-rebar','REBAR','철근','골조','ACTIVE',30),
 ('trade-formwork','FORMWORK','형틀','골조','ACTIVE',40),
 ('trade-concrete','CONCRETE','콘크리트','골조','ACTIVE',50),
 ('trade-masonry','MASONRY','조적','건축','ACTIVE',60),
 ('trade-plaster','PLASTER','미장','건축','ACTIVE',70),
 ('trade-waterproof','WATERPROOF','방수','건축','ACTIVE',80),
 ('trade-tile','TILE','타일','건축','ACTIVE',90),
 ('trade-paint','PAINT','도장','건축','ACTIVE',100),
 ('trade-interior','INTERIOR','수장','건축','ACTIVE',110),
 ('trade-window','WINDOW','창호','건축','ACTIVE',120),
 ('trade-metal','METAL','금속','건축','ACTIVE',130),
 ('trade-stone','STONE','석공','건축','ACTIVE',140),
 ('trade-mechanical','MECHANICAL','기계설비','설비','ACTIVE',150),
 ('trade-electrical','ELECTRICAL','전기','설비','ACTIVE',160),
 ('trade-communication','COMMUNICATION','통신','설비','ACTIVE',170),
 ('trade-fire','FIRE_PROTECTION','소방','설비','ACTIVE',180),
 ('trade-landscape','LANDSCAPE','조경','외부','ACTIVE',190),
 ('trade-temporary','TEMPORARY','가설','공통','ACTIVE',200),
 ('trade-demolition','DEMOLITION','철거','공통','ACTIVE',210),
 ('trade-cleaning','CLEANING','청소','공통','ACTIVE',220),
 ('trade-direct','DIRECT','직영','공통','ACTIVE',230),
 ('trade-other','OTHER','기타','공통','ACTIVE',240);

UPDATE company_site_contract_trades
SET trade_id=(SELECT id FROM trade_master WHERE trade_key=company_site_contract_trades.trade_code)
WHERE trade_id IS NULL;

INSERT OR IGNORE INTO company_trades(company_id,trade_id,status)
SELECT sc.company_id,cst.trade_id,cst.status
FROM company_site_contract_trades cst
JOIN company_site_contracts sc ON sc.id=cst.site_contract_id
WHERE cst.trade_id IS NOT NULL;

INSERT OR IGNORE INTO board_definitions(id,board_key,module_key,display_name,contains_sensitive_data,is_active) VALUES
 ('board-workforce-daily-output','WORKFORCE_DAILY_OUTPUT','workforce','출력일보',1,1),
 ('board-administration','ADMINISTRATION','admin','통합 관리',1,1);

INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
SELECT lower(hex(randomblob(16))),m.site_id,b.id,m.user_id,'MANAGE',m.user_id
FROM memberships m
JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
JOIN roles r ON r.id=usr.role_id AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER')
JOIN board_definitions b ON b.board_key IN ('WORKFORCE_DAILY_OUTPUT','ADMINISTRATION')
WHERE m.status='ACTIVE' AND m.site_id IS NOT NULL
GROUP BY m.site_id,b.id,m.user_id;

UPDATE board_definitions SET display_name=CASE board_key
 WHEN 'ISSUE' THEN '현장 이슈'
 WHEN 'WORKFORCE_PROFILE' THEN '근로자 정보'
 WHEN 'WORKFORCE_ATTENDANCE' THEN '출역 현황'
 ELSE display_name END;

INSERT OR IGNORE INTO roles(id,code,name,rank) VALUES
 ('role-construction-manager','CONSTRUCTION_MANAGER','공사 담당자',420),
 ('role-safety-manager','SAFETY_MANAGER','안전 담당자',410),
 ('role-quality-manager','QUALITY_MANAGER','품질 담당자',400),
 ('role-materials-manager','MATERIALS_MANAGER','자재 담당자',390),
 ('role-equipment-manager','EQUIPMENT_MANAGER','장비 담당자',380),
 ('role-contractor-site-manager','CONTRACTOR_SITE_MANAGER','협력업체 현장소장',330),
 ('role-contractor-foreman','CONTRACTOR_FOREMAN','반장',300);
