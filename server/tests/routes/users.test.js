// tests/routes/users.test.js
// Equivalence partition tests for POST /api/users
const request = require('supertest');
const express = require('express');

jest.mock('../../db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL,
      city TEXT, title TEXT, bio TEXT,
      tags TEXT DEFAULT '[]', img TEXT, photos TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS swipe_actions (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, target_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('like', 'nope', 'super_like')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(actor_id, target_id)
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY, user1_id TEXT NOT NULL, user2_id TEXT NOT NULL,
      is_super_like INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
});

const db = require('../../db');
const usersRouter = require('../../routes/users');

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

beforeEach(() => {
  db.exec('DELETE FROM swipe_actions; DELETE FROM matches; DELETE FROM profiles;');
});

describe('POST /api/users — equivalence partitions', () => {
  // P1: no body — defaults to name='You'
  test('P1: no request body creates user with default name "You"', async () => {
    const res = await request(app).post('/api/users').send({});
    expect(res.status).toBe(201);
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(res.body.userId);
    expect(row.name).toBe('You');
  });

  // P2: body with name — uses provided name
  test('P2: name in body creates user with that name', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Alice' });
    expect(res.status).toBe(201);
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(res.body.userId);
    expect(row.name).toBe('Alice');
  });

  // P3: response shape — 201 with a userId string
  test('P3: response is 201 with a non-empty userId string', async () => {
    const res = await request(app).post('/api/users').send({});
    expect(res.status).toBe(201);
    expect(typeof res.body.userId).toBe('string');
    expect(res.body.userId.length).toBeGreaterThan(0);
  });

  // P4: each call produces a unique userId
  test('P4: two consecutive calls produce different userIds', async () => {
    const r1 = await request(app).post('/api/users').send({});
    const r2 = await request(app).post('/api/users').send({});
    expect(r1.body.userId).not.toBe(r2.body.userId);
  });

  // P5: profile is persisted to the database
  test('P5: created user profile exists in the profiles table', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Bob' });
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(res.body.userId);
    expect(row).not.toBeNull();
    expect(row.age).toBe(25);
    expect(row.city).toBe('NYC');
  });

  // P8: hardcoded default fields (title, bio) are persisted correctly
  test('P8: created profile has hardcoded title and bio defaults', async () => {
    const res = await request(app).post('/api/users').send({});
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(res.body.userId);
    expect(row.title).toBe('App User');
    expect(row.bio).toBe('Just browsing!');
  });

  // P6: new user with existing profiles — some auto-likes are seeded
  test('P6: existing profiles auto-like the new user (seeding)', async () => {
    // Insert 10 profiles that will potentially auto-like new user
    for (let i = 0; i < 10; i++) {
      db.prepare(
        "INSERT INTO profiles (id, name, age, tags, photos) VALUES (?, ?, 25, '[]', '[]')"
      ).run(`existing-${i}`, `User${i}`);
    }
    const res = await request(app).post('/api/users').send({});
    const { userId } = res.body;
    const likeCount = db
      .prepare("SELECT COUNT(*) AS cnt FROM swipe_actions WHERE target_id = ? AND action = 'like'")
      .get(userId).cnt;
    // With ~60% probability and 10 profiles, we expect at least 1 auto-like
    // (probabilistic but extremely unlikely to get 0 from 10 with p=0.6)
    expect(likeCount).toBeGreaterThan(0);
  });

  // P7: new user with no existing profiles — no auto-likes seeded
  test('P7: new user with no existing profiles has zero auto-likes', async () => {
    const res = await request(app).post('/api/users').send({});
    const { userId } = res.body;
    const likeCount = db
      .prepare("SELECT COUNT(*) AS cnt FROM swipe_actions WHERE target_id = ?")
      .get(userId).cnt;
    expect(likeCount).toBe(0);
  });
});
