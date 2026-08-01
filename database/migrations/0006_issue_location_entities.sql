PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_location_settings (
  site_id TEXT PRIMARY KEY REFERENCES sites(id),
  building_number_mode TEXT NOT NULL DEFAULT 'STANDARD'
    CHECK(building_number_mode IN ('STANDARD','PHASE_PREFIX')),
  phase_prefix TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_locations (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  parent_id TEXT REFERENCES site_locations(id),
  location_type TEXT NOT NULL CHECK(location_type IN
    ('BUILDING','PARKING','COMMERCIAL','COMMON','FACILITY','EXTERIOR','FLOOR','UNIT','ROOM','OTHER')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id,location_type,code)
);

ALTER TABLE issue_items ADD COLUMN building_location_id TEXT REFERENCES site_locations(id);
ALTER TABLE issue_items ADD COLUMN floor_location_id TEXT REFERENCES site_locations(id);
ALTER TABLE issue_items ADD COLUMN unit_location_id TEXT REFERENCES site_locations(id);
ALTER TABLE issue_items ADD COLUMN room_location_id TEXT REFERENCES site_locations(id);

CREATE INDEX IF NOT EXISTS idx_site_locations_site_type_active
ON site_locations(site_id,location_type,is_active,sort_order);

CREATE INDEX IF NOT EXISTS idx_issue_items_location_category_status
ON issue_items(site_id,building_location_id,room_location_id,category_code,status);

INSERT OR IGNORE INTO site_location_settings(site_id)
SELECT id FROM sites;

WITH RECURSIVE numbers(value) AS (
  SELECT 1 UNION ALL SELECT value+1 FROM numbers WHERE value<15
)
INSERT OR IGNORE INTO site_locations(id,site_id,location_type,code,name,display_name,sort_order)
SELECT s.id||':building:'||numbers.value,s.id,'BUILDING','BUILDING_'||numbers.value,
       numbers.value||'동',numbers.value||'동',numbers.value
FROM sites s CROSS JOIN numbers;

WITH v(type,code,name,sort_order) AS (VALUES
  ('COMMERCIAL','COMMERCIAL','상가동',101),('FACILITY','MANAGEMENT','관리동',102),
  ('FACILITY','COMMUNITY','커뮤니티센터',103),('FACILITY','SECURITY','경비실',104),
  ('FACILITY','MECHANICAL','기계실',105),('FACILITY','ELECTRICAL','전기실',106),
  ('PARKING','PARKING_B1','지하1층 주차장',107),('PARKING','PARKING_B2','지하2층 주차장',108),
  ('PARKING','PARKING_B3','지하3층 주차장',109),('PARKING','PARKING_GROUND','지상주차장',110),
  ('EXTERIOR','EXTERIOR','외부',111),('COMMON','COMMON','공용부',112),('OTHER','OTHER','기타',999)
)
INSERT OR IGNORE INTO site_locations(id,site_id,location_type,code,name,display_name,sort_order)
SELECT s.id||':zone:'||v.code,s.id,v.type,v.code,v.name,v.name,v.sort_order FROM sites s CROSS JOIN v;

WITH RECURSIVE floors(value) AS (
  SELECT -3 UNION ALL SELECT value+1 FROM floors WHERE value<50
)
INSERT OR IGNORE INTO site_locations(id,site_id,location_type,code,name,display_name,sort_order)
SELECT s.id||':floor:'||floors.value,s.id,'FLOOR','FLOOR_'||floors.value,
       CASE WHEN floors.value<0 THEN '지하'||abs(floors.value)||'층'
            WHEN floors.value=0 THEN '지상층'
            ELSE floors.value||'층' END,
       CASE WHEN floors.value<0 THEN '지하'||abs(floors.value)||'층'
            WHEN floors.value=0 THEN '지상층'
            ELSE floors.value||'층' END,
       floors.value+10
FROM sites s CROSS JOIN floors;

WITH RECURSIVE units(value) AS (
  SELECT 1 UNION ALL SELECT value+1 FROM units WHERE value<10
)
INSERT OR IGNORE INTO site_locations(id,site_id,location_type,code,name,display_name,sort_order)
SELECT s.id||':unit:'||units.value,s.id,'UNIT','UNIT_'||units.value,
       units.value||'호',units.value||'호',units.value
FROM sites s CROSS JOIN units;

WITH v(code,name,sort_order) AS (VALUES
  ('ENTRANCE','현관',1),('LIVING','거실',2),('KITCHEN','주방',3),
  ('BEDROOM_1','침실1',4),('BEDROOM_2','침실2',5),('BEDROOM_3','침실3',6),('BEDROOM_4','침실4',7),
  ('MASTER_BATH','부부욕실',8),('COMMON_BATH','공용욕실',9),('BATH_1','욕실1',10),('BATH_2','욕실2',11),
  ('BALCONY','발코니',12),('UTILITY','다용도실',13),('DRESS_ROOM','드레스룸',14),('CORRIDOR','복도',15),
  ('STAIR','계단실',16),('ELEVATOR_HALL','엘리베이터홀',17),('PARKING_AREA','주차구역',18),
  ('RAMP','램프',19),('MECHANICAL','기계실',20),('ELECTRICAL','전기실',21),('COMMON','공용부',22),
  ('EXTERIOR','외부',23),('ROOF','옥상',24),('UNDERGROUND','지하',25),('OTHER','기타',999)
)
INSERT OR IGNORE INTO site_locations(id,site_id,location_type,code,name,display_name,sort_order)
SELECT s.id||':room:'||v.code,s.id,'ROOM',v.code,v.name,v.name,v.sort_order FROM sites s CROSS JOIN v;
