INSERT OR REPLACE INTO sites(site_code, pin, site_name, site_type, created_at)
VALUES('DEMO-001', '1234', '김제 샘플현장', '학교', datetime('now'));

INSERT INTO schedules(site_id, schedule_type, title, schedule_date, payload, created_at)
SELECT id, '타설', '3층 슬래브 타설', date('now'), '{"pumpSize":"52M","roadClear":true}', datetime('now')
FROM sites WHERE site_code='DEMO-001';
