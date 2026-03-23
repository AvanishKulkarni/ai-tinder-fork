// tests/routes/swipes.test.js
// Equivalence partition tests for POST /api/swipes
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
const swipesRouter = require('../../routes/swipes');

const app = express();
app.use(express.json());
app.use('/api/swipes', swipesRouter);

function addProfile(id, name = 'Test') {
  db.prepare(
    "INSERT INTO profiles (id, name, age, tags, photos) VALUES (?, ?, 25, '[]', '[]')"
  ).run(id, name);
}

function addSwipe(id, actorId, targetId, action) {
  db.prepare(
    'INSERT INTO swipe_actions (id, actor_id, target_id, action) VALUES (?, ?, ?, ?)'
  ).run(id, actorId, targetId, action);
}

beforeEach(() => {
  db.exec('DELETE FROM swipe_actions; DELETE FROM matches; DELETE FROM profiles;');
});

describe('POST /api/swipes — equivalence partitions', () => {
  // ── Input validation partitions ──────────────────────────────────────────

  // P1: missing actorId
  test('P1: missing actorId returns 400', async () => {
    const res = await request(app)
      .post('/api/swipes')
      .send({ targetId: 'u2', action: 'like' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/actorId/);
  });

  // P2: missing targetId
  test('P2: missing targetId returns 400', async () => {
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', action: 'like' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetId/);
  });

  // P3: missing action
  test('P3: missing action returns 400', async () => {
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/action/);
  });

  // P4: actorId equals targetId (self-swipe)
  test('P4: actorId === targetId returns 400', async () => {
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u1', action: 'like' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/);
  });

  // P5: invalid action value
  test('P5: invalid action returns 400', async () => {
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'dislike' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/action must be/);
  });

  // P6: duplicate swipe (same actor+target pair)
  test('P6: duplicate swipe returns 409', async () => {
    addProfile('u1');
    addProfile('u2');
    addSwipe('sw1', 'u1', 'u2', 'like');
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'like' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Duplicate/);
    expect(res.body.swipeId).toBe('sw1');
  });

  // ── Match outcome partitions ─────────────────────────────────────────────

  // P7: nope action — never creates a match
  test('P7: nope action records swipe but returns no match', async () => {
    addProfile('u1');
    addProfile('u2');
    addSwipe('sw1', 'u2', 'u1', 'like'); // u2 already liked u1
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'nope' });
    expect(res.status).toBe(201);
    expect(res.body.match).toBeNull();
  });

  // P8: like with no reciprocal — no match
  test('P8: like with no reciprocal swipe returns no match', async () => {
    addProfile('u1');
    addProfile('u2');
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'like' });
    expect(res.status).toBe(201);
    expect(res.body.match).toBeNull();
    expect(res.body.swipeId).toBeTruthy();
  });

  // P9: like + reciprocal like → match, isSuperLike=false
  test('P9: mutual like creates a match with isSuperLike=false', async () => {
    addProfile('u1');
    addProfile('u2');
    addSwipe('sw1', 'u2', 'u1', 'like');
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'like' });
    expect(res.status).toBe(201);
    expect(res.body.match).not.toBeNull();
    expect(res.body.match.isSuperLike).toBe(false);
    expect(res.body.match.matchedUser.id).toBe('u2');
  });

  // P10: super_like + reciprocal like → match, isSuperLike=true
  test('P10: super_like over a reciprocal like creates match with isSuperLike=true', async () => {
    addProfile('u1');
    addProfile('u2');
    addSwipe('sw1', 'u2', 'u1', 'like');
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'super_like' });
    expect(res.status).toBe(201);
    expect(res.body.match.isSuperLike).toBe(true);
  });

  // P11: like over a reciprocal super_like → match, isSuperLike=true
  test('P11: like over a reciprocal super_like creates match with isSuperLike=true', async () => {
    addProfile('u1');
    addProfile('u2');
    addSwipe('sw1', 'u2', 'u1', 'super_like');
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'like' });
    expect(res.status).toBe(201);
    expect(res.body.match.isSuperLike).toBe(true);
  });

  // P12: both super_like each other → isSuperLike=true
  test('P12: mutual super_like creates match with isSuperLike=true', async () => {
    addProfile('u1');
    addProfile('u2');
    addSwipe('sw1', 'u2', 'u1', 'super_like');
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'super_like' });
    expect(res.status).toBe(201);
    expect(res.body.match.isSuperLike).toBe(true);
  });

  // NOTE — unreachable branch: the "belt-and-suspenders" blocked check (swipes.js:56-58)
  // guards against a reciprocal like + a nope from the same actor. The UNIQUE(actor_id,
  // target_id) schema constraint makes this state impossible via the HTTP API, so no
  // test can reach it through normal requests.

  // P13: valid swipe response shape
  test('P13: successful swipe returns 201 with a swipeId', async () => {
    addProfile('u1');
    addProfile('u2');
    const res = await request(app)
      .post('/api/swipes')
      .send({ actorId: 'u1', targetId: 'u2', action: 'like' });
    expect(res.status).toBe(201);
    expect(typeof res.body.swipeId).toBe('string');
    expect(res.body.swipeId.length).toBeGreaterThan(0);
  });
});
