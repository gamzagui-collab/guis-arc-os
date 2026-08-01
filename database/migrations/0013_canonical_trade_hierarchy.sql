PRAGMA foreign_keys = ON;

CREATE TABLE trade_categories (
  id TEXT PRIMARY KEY, category_key TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE trade_groups (
  id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES trade_categories(id),
  group_key TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE trade_master ADD COLUMN group_id TEXT REFERENCES trade_groups(id);
ALTER TABLE trade_master ADD COLUMN short_name TEXT;
ALTER TABLE trade_master ADD COLUMN description TEXT;
ALTER TABLE trade_master ADD COLUMN is_selectable INTEGER NOT NULL DEFAULT 1 CHECK(is_selectable IN (0,1));
ALTER TABLE issue_items ADD COLUMN trade_id TEXT REFERENCES trade_master(id);
CREATE INDEX idx_trade_master_group_active ON trade_master(group_id,status,is_selectable,sort_order);
CREATE INDEX idx_issue_items_trade_id ON issue_items(site_id,trade_id,status,updated_at DESC);
CREATE TABLE work_functions (
 id TEXT PRIMARY KEY, function_key TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), sort_order INTEGER NOT NULL
);
INSERT INTO work_functions(id,function_key,display_name,sort_order) VALUES
('wf-construction','CONSTRUCTION_MANAGEMENT','공사관리',10),('wf-safety','SAFETY_MANAGEMENT','안전관리',20),
('wf-quality','QUALITY_MANAGEMENT','품질관리',30),('wf-materials','MATERIALS_MANAGEMENT','자재관리',40),
('wf-equipment','EQUIPMENT_MANAGEMENT','장비관리',50),('wf-site','SITE_MANAGEMENT','현장관리',60),
('wf-direct','DIRECT_WORK','직영공사',70),('wf-inspection','INSPECTION','검측',80),
('wf-test','TESTING','시험',90),('wf-repair','REPAIR','보수',100),('wf-cleanup','HOUSEKEEPING','정리정돈',110);
CREATE TABLE trade_addition_requests (
 id TEXT PRIMARY KEY, requested_name TEXT NOT NULL, requested_by_user_id TEXT NOT NULL REFERENCES users(id),
 site_id TEXT REFERENCES sites(id), status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','LINKED','CREATED','REJECTED')),
 resolved_trade_id TEXT REFERENCES trade_master(id), reviewed_by_user_id TEXT REFERENCES users(id),
 review_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
);

INSERT INTO trade_categories(id,category_key,display_name,sort_order) VALUES
('tc-common','COMMON_TEMPORARY','공통·가설',10),('tc-civil','CIVIL','토목',20),('tc-structure','STRUCTURE','골조',30),
('tc-finish','ARCH_FINISH','건축 마감',40),('tc-exterior','EXTERIOR','외장',50),('tc-window-metal','WINDOW_METAL','창호·금속',60),
('tc-mechanical','MECHANICAL','기계설비',70),('tc-electric','ELECTRIC','전기',80),('tc-communication','COMMUNICATION','통신',90),
('tc-fire','FIRE','소방',100),('tc-landscape','LANDSCAPE','조경',110),('tc-demolition','DEMOLITION_WASTE','해체·폐기물',120),
('tc-support','DIRECT_SUPPORT','직영·지원',130),('tc-other','OTHER','기타',140);

INSERT INTO trade_groups(id,category_id,group_key,display_name,sort_order) VALUES
('tg-temporary','tc-common','TEMPORARY_WORK','가설공사',10),('tg-survey','tc-common','SURVEY_INVESTIGATION','측량·조사',20),('tg-lifting','tc-common','LIFTING_TRANSPORT','양중·운반',30),
('tg-earth','tc-civil','EARTHWORK','토공사',10),('tg-foundation','tc-civil','EARTH_RETAINING_FOUNDATION','흙막이·기초',20),('tg-drainage','tc-civil','DRAINAGE_PIPE','배수·관로',30),('tg-road','tc-civil','ROAD_PAVING','도로·포장',40),('tg-civil-structure','tc-civil','CIVIL_STRUCTURE','구조물',50),
('tg-rebar','tc-structure','REBAR_WORK','철근공사',10),('tg-formwork','tc-structure','FORMWORK','거푸집공사',20),('tg-concrete','tc-structure','CONCRETE_WORK','콘크리트공사',30),('tg-steel','tc-structure','STEEL_STRUCTURE','철골공사',40),('tg-pc','tc-structure','PRECAST','PC·프리캐스트',50),
('tg-masonry','tc-finish','MASONRY','조적공사',10),('tg-plaster','tc-finish','PLASTER','미장공사',20),('tg-waterproof','tc-finish','WATERPROOF','방수공사',30),('tg-tile','tc-finish','TILE','타일공사',40),('tg-paint','tc-finish','PAINT','도장공사',50),('tg-interior','tc-finish','INTERIOR_FINISH','수장공사',60),('tg-carpentry','tc-finish','CARPENTRY','목공사',70),('tg-stone','tc-finish','STONE','석공사',80),
('tg-exterior-wall','tc-exterior','EXTERIOR_WALL','외벽공사',10),('tg-panel','tc-exterior','EXTERIOR_PANEL','외장패널',20),('tg-curtain','tc-exterior','CURTAIN_WALL','커튼월',30),('tg-roof','tc-exterior','ROOF','지붕공사',40),
('tg-window','tc-window-metal','WINDOW','창호공사',10),('tg-door','tc-window-metal','DOOR','문공사',20),('tg-metal','tc-window-metal','METAL','금속공사',30),
('tg-sanitary','tc-mechanical','SANITARY','위생설비',10),('tg-hvac','tc-mechanical','HVAC','냉난방설비',20),('tg-duct','tc-mechanical','VENTILATION_DUCT','환기·덕트',30),('tg-piping','tc-mechanical','MECHANICAL_PIPING','기계실·배관',40),('tg-gas','tc-mechanical','GAS','가스설비',50),
('tg-power','tc-electric','POWER','전력설비',10),('tg-light','tc-electric','LIGHTING_OUTLET','조명·전열',20),('tg-electric-test','tc-electric','ELECTRIC_TEST','전기시험',30),
('tg-info','tc-communication','INFORMATION_COMMUNICATION','정보통신',10),('tg-broadcast','tc-communication','BROADCAST_VIDEO','방송·영상',20),('tg-access','tc-communication','ACCESS_HOME_NETWORK','출입·홈네트워크',30),
('tg-fire-mechanical','tc-fire','FIRE_MECHANICAL','소방기계',10),('tg-fire-electric','tc-fire','FIRE_ELECTRIC','소방전기',20),
('tg-planting','tc-landscape','PLANTING','식재공사',10),('tg-landscape-facility','tc-landscape','LANDSCAPE_FACILITY','조경시설물',20),('tg-landscape-paving','tc-landscape','LANDSCAPE_PAVING','조경포장',30),('tg-irrigation','tc-landscape','IRRIGATION_DRAINAGE','관수·배수',40),
('tg-demolition','tc-demolition','DEMOLITION','해체공사',10),('tg-waste','tc-demolition','WASTE','폐기물',20),
('tg-direct','tc-support','DIRECT_WORK','직영공사',10),('tg-support','tc-support','SITE_SUPPORT','현장지원',20),('tg-test','tc-support','TEST_INSPECTION','시험·검측',30),
('tg-other','tc-other','OTHER','기타공종',10);

-- 기존 24개 ID는 그대로 두고 넓은 공종을 해당 "일반" 그룹에 연결한다.
UPDATE trade_master SET group_id=CASE trade_key
 WHEN 'REBAR' THEN 'tg-rebar' WHEN 'FORMWORK' THEN 'tg-formwork' WHEN 'CONCRETE' THEN 'tg-concrete'
 WHEN 'MASONRY' THEN 'tg-masonry' WHEN 'PLASTER' THEN 'tg-plaster' WHEN 'WATERPROOF' THEN 'tg-waterproof'
 WHEN 'TILE' THEN 'tg-tile' WHEN 'PAINT' THEN 'tg-paint' WHEN 'INTERIOR' THEN 'tg-interior'
 WHEN 'WINDOW' THEN 'tg-window' WHEN 'METAL' THEN 'tg-metal' WHEN 'STONE' THEN 'tg-stone'
 WHEN 'MECHANICAL' THEN 'tg-piping' WHEN 'ELECTRICAL' THEN 'tg-power' WHEN 'COMMUNICATION' THEN 'tg-info'
 WHEN 'FIRE_PROTECTION' THEN 'tg-fire-mechanical' WHEN 'LANDSCAPE' THEN 'tg-landscape-facility'
 WHEN 'TEMPORARY' THEN 'tg-temporary' WHEN 'DEMOLITION' THEN 'tg-demolition' WHEN 'CLEANING' THEN 'tg-support'
 WHEN 'DIRECT' THEN 'tg-direct' WHEN 'CIVIL' THEN 'tg-earth' WHEN 'ARCHITECTURE' THEN 'tg-other' ELSE 'tg-other' END,
 display_name=CASE trade_key
 WHEN 'REBAR' THEN '철근공사 일반' WHEN 'FORMWORK' THEN '거푸집공사 일반' WHEN 'CONCRETE' THEN '콘크리트공사 일반'
 WHEN 'MASONRY' THEN '조적공사 일반' WHEN 'PLASTER' THEN '미장공사 일반' WHEN 'WATERPROOF' THEN '방수공사 일반'
 WHEN 'TILE' THEN '타일공사 일반' WHEN 'PAINT' THEN '도장공사 일반' WHEN 'INTERIOR' THEN '수장공사 일반'
 WHEN 'WINDOW' THEN '창호공사 일반' WHEN 'METAL' THEN '금속공사 일반' WHEN 'STONE' THEN '석공사 일반'
 WHEN 'MECHANICAL' THEN '기계설비 일반' WHEN 'ELECTRICAL' THEN '전기공사 일반' WHEN 'COMMUNICATION' THEN '통신공사 일반'
 WHEN 'FIRE_PROTECTION' THEN '소방공사 일반' WHEN 'LANDSCAPE' THEN '조경공사 일반' WHEN 'TEMPORARY' THEN '가설공사 일반'
 WHEN 'DEMOLITION' THEN '해체공사 일반' WHEN 'CLEANING' THEN '현장청소 일반' WHEN 'DIRECT' THEN '직영공사 일반'
 WHEN 'CIVIL' THEN '토목공사 일반' WHEN 'ARCHITECTURE' THEN '건축공사 일반' ELSE display_name END,
 short_name=display_name,description='v0.6 기존 공종을 일반 공종으로 보존',updated_at=CURRENT_TIMESTAMP;

-- 요청서의 세부 공종을 canonical leaf로 생성한다. key는 그룹 key와 UTF-8 표시명의 hex 조합으로 전역 고유하다.
WITH seed(group_id,names) AS (VALUES
('tg-temporary','["가설울타리","가설사무실","가설창고","가설화장실","가설전기","가설급배수","가설도로","가설통로","안전통로","낙하물방지망","수직보호망","방호선반","안전난간","개구부방호","안전시설물","비계설치","비계해체","시스템비계","이동식비계","작업발판","동바리","시스템동바리","거푸집동바리"]'),
('tg-survey','["측량","먹매김","지반조사","구조물조사","현황조사"]'),('tg-lifting','["타워크레인","이동식크레인","호이스트","자재양중","인력운반","현장내운반"]'),
('tg-earth','["벌개제근","표토제거","터파기","되메우기","성토","절토","잔토처리","흙운반","지반정지","사면정리"]'),
('tg-foundation','["흙막이","CIP","SCW","H파일","어스앵커","띠장","버팀보","계측관리","파일공사","PHC파일","강관파일","현장타설말뚝","지반개량"]'),
('tg-drainage','["우수관","오수관","상수관","맨홀","측구","집수정","배수로","암거","유공관","관로시험"]'),
('tg-road','["쇄석포장","아스콘포장","콘크리트포장","보도블록","경계석","도로표지","차선도색","방지턱"]'),
('tg-civil-structure','["옹벽","보강토옹벽","석축","토목콘크리트","지하구조물","교량구조물","지하차도"]'),
('tg-rebar','["철근가공","철근조립","철근배근","철근이음","기계식이음","용접이음","철근검측"]'),
('tg-formwork','["재래식거푸집","알폼","갱폼","유로폼","시스템거푸집","데크플레이트","거푸집설치","거푸집해체","거푸집정리"]'),
('tg-concrete','["버림콘크리트","기초콘크리트","벽체콘크리트","슬래브콘크리트","기둥콘크리트","계단콘크리트","무근콘크리트","콘크리트타설","콘크리트압송","콘크리트다짐","콘크리트양생","콘크리트면처리","콘크리트보수"]'),
('tg-steel','["철골제작","철골설치","철골용접","철골볼트체결","데크설치","내화피복","철골도장","철골검사"]'),('tg-pc','["PC제작","PC운반","PC설치","PC접합","그라우팅"]'),
('tg-masonry','["벽돌쌓기","블록쌓기","ALC블록","경량블록","인방설치","조적보강"]'),('tg-plaster','["시멘트미장","견출","방통미장","바닥미장","셀프레벨링","단열몰탈","미장보수"]'),
('tg-waterproof','["액체방수","도막방수","우레탄방수","시트방수","아스팔트방수","침투방수","벤토나이트방수","실링","코킹","방수보수","담수시험"]'),
('tg-tile','["벽타일","바닥타일","외부타일","포세린타일","대형타일","타일줄눈","타일보수"]'),('tg-paint','["수성페인트","유성페인트","에폭시도장","우레탄도장","내화도장","무늬코트","탄성코트","퍼티","도장보수"]'),
('tg-interior','["경량벽체","석고보드","천장틀","천장마감","흡음재","단열재","도배","장판","시트지","카펫","바닥재","걸레받이","몰딩"]'),
('tg-carpentry','["일반목공","문틀","목문","가구설치","주방가구","붙박이장","목재마감"]'),('tg-stone','["외부석재","내부석재","바닥석재","계단석재","석재건식","석재습식","석재코킹","석재보수"]'),
('tg-exterior-wall','["외단열","단열재부착","미장마감","드라이비트","스타코","외벽도장"]'),('tg-panel','["알루미늄패널","복합패널","징크패널","금속패널","샌드위치패널","루버","캐노피"]'),
('tg-curtain','["알루미늄커튼월","유리커튼월","커튼월프레임","구조실리콘","커튼월코킹","커튼월보수"]'),('tg-roof','["금속지붕","슁글","지붕방수","지붕판넬","홈통","우수관"]'),
('tg-window','["PVC창호","알루미늄창호","시스템창호","방화창호","창호유리","창호철물","창호코킹","창호보수"]'),('tg-door','["방화문","철제문","자동문","강화유리문","세대현관문","문틀","도어하드웨어"]'),
('tg-metal','["금속난간","유리난간","계단난간","핸드레일","그레이팅","점검구","트렌치","금속마감","잡철물","사다리","방음벽"]'),
('tg-sanitary','["급수배관","급탕배관","오수배관","배수배관","통기관","위생기구","욕실기구","주방설비","펌프설치","저수조","급수시험","배수시험"]'),
('tg-hvac','["냉매배관","냉온수배관","보일러","냉동기","실외기","실내기","바닥난방","난방코일","열교환기"]'),('tg-duct','["급기덕트","배기덕트","환기덕트","주방덕트","댐퍼","송풍기","환기팬","덕트보온"]'),
('tg-piping','["기계실배관","소방배관","강관배관","동관배관","스테인리스배관","PVC배관","배관보온","배관지지대","밸브","압력시험","수압시험"]'),('tg-gas','["도시가스배관","가스계량기","가스밸브","가스시험"]'),
('tg-power','["수변전설비","변압기","발전기","분전반","배전반","케이블트레이","전력케이블","간선공사","전선관","배선","접지","피뢰설비"]'),('tg-light','["조명기구","비상조명","콘센트","스위치","전열설비","세대전기","공용부전기","외부조명"]'),('tg-electric-test','["절연저항시험","접지저항시험","통전시험","시운전"]'),
('tg-info','["통신배관","통신배선","단자함","네트워크","광케이블","전화설비","인터넷설비"]'),('tg-broadcast','["방송설비","비상방송","CCTV","영상설비","주차관제"]'),('tg-access','["출입통제","인터폰","홈네트워크","세대통신","공동현관기"]'),
('tg-fire-mechanical','["스프링클러","옥내소화전","옥외소화전","소방펌프","소방배관","소화기","제연설비","연결송수관","소방수압시험"]'),('tg-fire-electric','["감지기","발신기","수신기","비상방송","유도등","비상콘센트","소방배선","소방연동시험"]'),
('tg-planting','["교목식재","관목식재","초화식재","잔디식재","식재기반","수목이식"]'),('tg-landscape-facility','["놀이터","운동시설","벤치","파고라","조경석","수경시설","펜스","안내시설"]'),('tg-landscape-paving','["투수블록","판석포장","목재데크","고무칩포장","마사토포장"]'),('tg-irrigation','["관수설비","조경배수","조경전기"]'),
('tg-demolition','["구조물해체","내부철거","마감철거","설비철거","전기철거","컷팅","코어천공","브레이커작업"]'),('tg-waste','["건설폐기물","폐콘크리트","폐목재","폐금속","폐합성수지","폐기물분리","폐기물반출","지정폐기물"]'),
('tg-direct','["직영인력","직영목공","직영미장","직영철거","직영보수","직영정리"]'),('tg-support','["현장청소","준공청소","양수","살수","신호수","유도원","안전도우미","자재정리","정리정돈","보양","동절기보양","해빙"]'),('tg-test','["품질시험","재료시험","검측지원","시험실","계측","비파괴검사"]'),
('tg-other','["기타 공종"]')
), expanded AS (
 SELECT group_id,j.value display_name,j.key position FROM seed,json_each(seed.names) j
)
INSERT INTO trade_master(id,trade_key,display_name,parent_category,status,sort_order,group_id,short_name,description,is_selectable)
SELECT 'trade-v070-'||lower(hex(group_id||':'||display_name)),
       upper(replace(group_id,'tg-',''))||'_'||upper(hex(display_name)),display_name,'계층형 공종','ACTIVE',
       1000+(SELECT sort_order FROM trade_groups WHERE id=group_id)*100+position,group_id,display_name,NULL,1
FROM expanded;

-- 기존 계약의 비표준 코드는 추측하지 않고 "기타 / 기존 공종 일반" leaf로 보존한다.
INSERT OR IGNORE INTO trade_master(id,trade_key,display_name,parent_category,status,sort_order,group_id,short_name,description,is_selectable)
SELECT 'trade-legacy-'||lower(hex(cst.trade_code)),'LEGACY_'||upper(hex(cst.trade_code)),
       cst.trade_code||' 일반','기타','ACTIVE',9000,'tg-other',cst.trade_code||' 일반','기존 계약 문자열을 손실 없이 보존',1
FROM company_site_contract_trades cst
WHERE cst.trade_id IS NULL AND cst.trade_code IS NOT NULL;
UPDATE company_site_contract_trades SET trade_id=(
 SELECT tm.id FROM trade_master tm WHERE tm.trade_key='LEGACY_'||upper(hex(company_site_contract_trades.trade_code))
) WHERE trade_id IS NULL AND trade_code IS NOT NULL;
INSERT OR IGNORE INTO company_trades(company_id,trade_id,status)
SELECT sc.company_id,cst.trade_id,cst.status FROM company_site_contract_trades cst
JOIN company_site_contracts sc ON sc.id=cst.site_contract_id WHERE cst.trade_id IS NOT NULL;

UPDATE issue_items SET trade_id=(SELECT id FROM trade_master tm WHERE tm.trade_key=issue_items.trade_code)
WHERE trade_id IS NULL AND trade_code IS NOT NULL;
UPDATE issue_items SET trade_id=(SELECT cst.trade_id FROM company_site_contract_trades cst
 WHERE cst.trade_code=issue_items.trade_code AND cst.trade_id IS NOT NULL LIMIT 1)
WHERE trade_id IS NULL AND trade_code IS NOT NULL;

CREATE TABLE trade_migration_reports (
 id TEXT PRIMARY KEY, migration_key TEXT NOT NULL UNIQUE, automatic_mapping_count INTEGER NOT NULL,
 general_preserved_count INTEGER NOT NULL, manual_review_count INTEGER NOT NULL, unmapped_count INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO trade_migration_reports(id,migration_key,automatic_mapping_count,general_preserved_count,manual_review_count,unmapped_count)
SELECT 'tmr-v070','V0_7_0_HIERARCHY',
 (SELECT COUNT(*) FROM issue_items WHERE trade_code IS NOT NULL AND trade_id IS NOT NULL),24,
 (SELECT COUNT(*) FROM issue_items WHERE trade_code IS NOT NULL AND trade_id IS NULL),
 (SELECT COUNT(*) FROM trade_master WHERE group_id IS NULL);

INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json)
VALUES('audit-trade-hierarchy-v070',NULL,'TRADE_HIERARCHY_MIGRATED','ALLOWED','migration-0013',
json_object('legacyTradeCount',24,'policy','PRESERVE_AS_GENERAL',
'automaticMappingCount',(SELECT automatic_mapping_count FROM trade_migration_reports WHERE id='tmr-v070'),
'manualReviewCount',(SELECT manual_review_count FROM trade_migration_reports WHERE id='tmr-v070'),
'unmappedCount',(SELECT unmapped_count FROM trade_migration_reports WHERE id='tmr-v070')));
