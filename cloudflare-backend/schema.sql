-- D1 schema for the allneeds backend

CREATE TABLE IF NOT EXISTS users (
  did TEXT PRIMARY KEY,
  handle TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_did TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  need_ids TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_did) REFERENCES users(did)
);

CREATE TABLE IF NOT EXISTS user_settings (
  did TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT,
  PRIMARY KEY (did, key),
  FOREIGN KEY (did) REFERENCES users(did)
);

CREATE TABLE IF NOT EXISTS journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  title TEXT,
  body TEXT,
  FOREIGN KEY (did) REFERENCES users(did)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (did) REFERENCES users(did)
);
