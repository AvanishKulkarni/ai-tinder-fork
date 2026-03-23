// tests/routes/matches.test.js
// Equivalence partition tests for GET /api/matches
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
const matchesRouter = require('../../routes/matches');

const app = express();
app.use(express.json());
app.use('/api/matches', matchesRouter);

function addProfile(id, name = 'Test') {
  db.prepare(
    "INSERT INTO profiles (id, name, age, tags, photos, img) VALUES (?, ?, 25, '[]', '[]', 'pic.jpg')"
  ).run(id, name);
}

function addMatch(id, user1Id, user2Id, isSuperLike = 0, createdAt = null) {
  if (createdAt) {
    db.prepare(
      'INSERT INTO matches (id, user1_id, user2_id, is_super_like, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, user1Id, user2Id, isSuperLike, createdAt);
  } else {
    db.prepare(
      'INSERT INTO matches (id, user1_id, user2_id, is_super_like) VALUES (?, ?, ?, ?)'
    ).run(id, user1Id, user2Id, isSuperLike);
  }
}

beforeEach(() => {
  db.exec('DELETE FROM swipe_actions; DELETE FROM matches; DELETE FROM profiles;');
});

describe('GET /api/matches — equivalence partitions', () => {
  // P1: missing userId
  test('P1: missing userId returns 400', async () => {
    const res = await request(app).get('/api/matches');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId/);
  });

  // P2: valid userId, no matches at all
  test('P2: valid userId with no matches returns empty array', async () => {
    addProfile('u1');
    const res = await request(app).get('/api/matches?userId=u1');
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(0);
  });

  // P3: user is user1 in a match — returns user2's profile info
  test('P3: user as user1_id returns matched user2 info', async () => {
    addProfile('u1', 'Alice');
    addProfile('u2', 'Bob');
    addMatch('m1', 'u1', 'u2');
    const res = await request(app).get('/api/matches?userId=u1');
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].userId).toBe('u2');
    expect(res.body.matches[0].name).toBe('Bob');
  });

  // P4: user is user2 in a match — returns user1's profile info
  test('P4: user as user2_id returns matched user1 info', async () => {
    addProfile('u1', 'Alice');
    addProfile('u2', 'Bob');
    addMatch('m1', 'u1', 'u2');
    const res = await request(app).get('/api/matches?userId=u2');
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].userId).toBe('u1');
    expect(res.body.matches[0].name).toBe('Alice');
  });

  // P5: isSuperLike=false for regular match
  test('P5: regular match has isSuperLike=false', async () => {
    addProfile('u1');
    addProfile('u2');
    addMatch('m1', 'u1', 'u2', 0);
    const res = await request(app).get('/api/matches?userId=u1');
    expect(res.body.matches[0].isSuperLike).toBe(false);
  });

  // P6: isSuperLike=true for super-like match
  test('P6: super-like match has isSuperLike=true', async () => {
    addProfile('u1');
    addProfile('u2');
    addMatch('m1', 'u1', 'u2', 1);
    const res = await request(app).get('/api/matches?userId=u1');
    expect(res.body.matches[0].isSuperLike).toBe(true);
  });

  // P7: with `since` filter — only returns matches after that timestamp
  test('P7: since filter excludes matches created before the timestamp', async () => {
    addProfile('u1');
    addProfile('u2');
    addProfile('u3');
    addMatch('m1', 'u1', 'u2', 0, '2024-01-01 00:00:00');
    addMatch('m2', 'u1', 'u3', 0, '2025-06-01 00:00:00');
    const res = await request(app).get(
      '/api/matches?userId=u1&since=2025-01-01 00:00:00'
    );
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].matchId).toBe('m2');
  });

  // P8: without `since` filter returns all matches
  test('P8: without since filter all matches are returned', async () => {
    addProfile('u1');
    addProfile('u2');
    addProfile('u3');
    addMatch('m1', 'u1', 'u2', 0, '2024-01-01 00:00:00');
    addMatch('m2', 'u1', 'u3', 0, '2025-06-01 00:00:00');
    const res = await request(app).get('/api/matches?userId=u1');
    expect(res.body.matches).toHaveLength(2);
  });

  // P9: matches sorted by created_at descending (newest first)
  test('P9: matches are returned newest first', async () => {
    addProfile('u1');
    addProfile('u2');
    addProfile('u3');
    addMatch('m1', 'u1', 'u2', 0, '2024-01-01 00:00:00');
    addMatch('m2', 'u1', 'u3', 0, '2025-06-01 00:00:00');
    const res = await request(app).get('/api/matches?userId=u1');
    expect(res.body.matches[0].matchId).toBe('m2');
    expect(res.body.matches[1].matchId).toBe('m1');
  });

  // P11: since filter with all matches before threshold → empty result
  test('P11: since filter returns empty when all matches pre-date the threshold', async () => {
    addProfile('u1');
    addProfile('u2');
    addMatch('m1', 'u1', 'u2', 0, '2020-01-01 00:00:00');
    const res = await request(app).get('/api/matches?userId=u1&since=2025-01-01 00:00:00');
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(0);
  });

  // P12: since uses strict > not >= — exact timestamp is excluded
  test('P12: since filter excludes a match with created_at equal to the threshold', async () => {
    addProfile('u1');
    addProfile('u2');
    addMatch('m1', 'u1', 'u2', 0, '2024-06-15 12:00:00');
    const res = await request(app).get(
      '/api/matches?userId=u1&since=2024-06-15 12:00:00'
    );
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(0);
  });

  // P10: unrelated matches not returned
  test('P10: matches belonging to other users are not returned', async () => {
    addProfile('u1');
    addProfile('u2');
    addProfile('u3');
    addMatch('m1', 'u2', 'u3'); // match between u2 and u3, not u1
    const res = await request(app).get('/api/matches?userId=u1');
    expect(res.body.matches).toHaveLength(0);
  });
});
