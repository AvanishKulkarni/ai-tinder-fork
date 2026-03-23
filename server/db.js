// db.js — SQLite database setup and schema
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'tinder.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    age      INTEGER NOT NULL,
    city     TEXT,
    title    TEXT,
    bio      TEXT,
    tags     TEXT DEFAULT '[]',
    img      TEXT,
    photos   TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS swipe_actions (
    id         TEXT PRIMARY KEY,
    actor_id   TEXT NOT NULL,
    target_id  TEXT NOT NULL,
    action     TEXT NOT NULL CHECK(action IN ('like', 'nope', 'super_like')),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(actor_id, target_id)
  );

  CREATE TABLE IF NOT EXISTS matches (
    id           TEXT PRIMARY KEY,
    user1_id     TEXT NOT NULL,
    user2_id     TEXT NOT NULL,
    is_super_like INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_swipes_actor  ON swipe_actions(actor_id);
  CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipe_actions(target_id);
  CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user1_id, user2_id);
`);

module.exports = db;
