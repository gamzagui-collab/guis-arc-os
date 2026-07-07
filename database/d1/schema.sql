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
