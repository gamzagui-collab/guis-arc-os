DROP TABLE IF EXISTS sites;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS site_logs;

CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_code TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,
  site_name TEXT NOT NULL,
  site_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  schedule_type TEXT NOT NULL,
  title TEXT NOT NULL,
  schedule_date TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(site_id) REFERENCES sites(id)
);

CREATE TABLE site_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  role TEXT,
  message TEXT NOT NULL,
  read_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(site_id) REFERENCES sites(id)
);


DROP TABLE IF EXISTS site_profiles;
DROP TABLE IF EXISTS daily_work_items;

CREATE TABLE site_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  client_name TEXT,
  contractor_name TEXT,
  supervisor_name TEXT,
  start_date TEXT,
  end_date TEXT,
  project_amount TEXT,
  scale_text TEXT,
  payload TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(site_id) REFERENCES sites(id)
);

CREATE TABLE daily_work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  role TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  is_done INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(site_id) REFERENCES sites(id)
);

DROP TABLE IF EXISTS trade_knowledge;

CREATE TABLE trade_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id TEXT UNIQUE NOT NULL,
  trade_name TEXT NOT NULL,
  category TEXT,
  summary TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

DROP TABLE IF EXISTS accident_briefings;
DROP TABLE IF EXISTS construction_news;

CREATE TABLE accident_briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  accident_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  accident_type TEXT,
  trade TEXT,
  occurred_at TEXT,
  region TEXT,
  severity TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE construction_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  published_at TEXT,
  payload TEXT,
  created_at TEXT NOT NULL
);

DROP TABLE IF EXISTS ai_briefings;

CREATE TABLE ai_briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER,
  briefing_date TEXT NOT NULL,
  input_payload TEXT,
  output_payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
