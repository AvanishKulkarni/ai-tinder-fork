// tests/routes/deck.test.js
// Equivalence partition tests for GET /api/deck
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
const deckRouter = require('../../routes/deck');

const app = express();
app.use(express.json());
app.use('/api/deck', deckRouter);

function addProfile(id, name = 'Test', tags = '[]', photos = '[]') {
  db.prepare(
    'INSERT INTO profiles (id, name, age, tags, photos) VALUES (?, ?, 25, ?, ?)'
  ).run(id, name, tags, photos);
}

function addSwipe(id, actorId, targetId, action) {
  db.prepare(
    'INSERT INTO swipe_actions (id, actor_id, target_id, action) VALUES (?, ?, ?, ?)'
  ).run(id, actorId, targetId, action);
}

beforeEach(() => {
  db.exec('DELETE FROM swipe_actions; DELETE FROM matches; DELETE FROM profiles;');
});

describe('GET /api/deck — equivalence partitions', () => {
  // P1: invalid input — missing required param
  test('P1: missing userId returns 400', async () => {
    const res = await request(app).get('/api/deck');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId/);
  });

  // P2: valid userId, no other profiles in DB
  test('P2: valid userId with no other profiles returns empty deck', async () => {
    addProfile('u1');
    const res = await request(app).get('/api/deck?userId=u1');
    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(0);
  });

  // P3: own profile is excluded
  test("P3: user's own profile is excluded from deck", async () => {
    addProfile('u1', 'Me');
    addProfile('u2', 'Other');
    const res = await request(app).get('/api/deck?userId=u1');
    const ids = res.body.profiles.map((p) => p.id);
    expect(ids).not.toContain('u1');
    expect(ids).toContain('u2');
  });

  // P4: previously swiped profiles are excluded
  test('P4: profiles already swiped by user are excluded', async () => {
    addProfile('u1');
    addProfile('u2', 'Swiped');
    addProfile('u3', 'Unswiped');
    addSwipe('sw1', 'u1', 'u2', 'like');
    const res = await request(app).get('/api/deck?userId=u1');
    const ids = res.body.profiles.map((p) => p.id);
    expect(ids).not.toContain('u2');
    expect(ids).toContain('u3');
  });

  // P5: profiles that super-liked the viewer sort first with superLikedBy=true
  test('P5: super-liked profiles float to top and have superLikedBy=true', async () => {
    addProfile('u1');
    addProfile('u2', 'Regular');
    addProfile('u3', 'SuperFan');
    addSwipe('sw1', 'u3', 'u1', 'super_like');
    const res = await request(app).get('/api/deck?userId=u1');
    expect(res.status).toBe(200);
    expect(res.body.profiles[0].id).toBe('u3');
    expect(res.body.profiles[0].superLikedBy).toBe(true);
  });

  // P6: profiles that did not super-like viewer have superLikedBy=false
  test('P6: normal profiles have superLikedBy=false', async () => {
    addProfile('u1');
    addProfile('u2', 'Normal');
    const res = await request(app).get('/api/deck?userId=u1');
    expect(res.body.profiles[0].superLikedBy).toBe(false);
  });

  // P7: a regular like (non-super) by another profile does NOT set superLikedBy
  test('P7: a plain like by another profile does not set superLikedBy=true', async () => {
    addProfile('u1');
    addProfile('u2', 'Liker');
    addSwipe('sw1', 'u2', 'u1', 'like');
    const res = await request(app).get('/api/deck?userId=u1');
    expect(res.body.profiles[0].superLikedBy).toBe(false);
  });

  // P8: tags and photos are deserialized from JSON strings into arrays
  test('P8: tags and photos are returned as parsed arrays', async () => {
    addProfile('u1');
    addProfile('u2', 'Tagged', '["hiking","coffee"]', '["img1.jpg","img2.jpg"]');
    const res = await request(app).get('/api/deck?userId=u1');
    const p = res.body.profiles.find((x) => x.id === 'u2');
    expect(Array.isArray(p.tags)).toBe(true);
    expect(p.tags).toEqual(['hiking', 'coffee']);
    expect(Array.isArray(p.photos)).toBe(true);
    expect(p.photos).toHaveLength(2);
  });

  // P4b: nope swipe by actor also excludes the profile
  test('P4b: profile swiped nope by actor is excluded from deck', async () => {
    addProfile('u1');
    addProfile('u2', 'Noped');
    addProfile('u3', 'Unswiped');
    addSwipe('sw1', 'u1', 'u2', 'nope');
    const res = await request(app).get('/api/deck?userId=u1');
    const ids = res.body.profiles.map((p) => p.id);
    expect(ids).not.toContain('u2');
    expect(ids).toContain('u3');
  });

  // P4c: super_like swipe by actor also excludes the profile
  test('P4c: profile super-liked by actor is excluded from deck', async () => {
    addProfile('u1');
    addProfile('u2', 'SuperLiked');
    addProfile('u3', 'Unswiped');
    addSwipe('sw1', 'u1', 'u2', 'super_like');
    const res = await request(app).get('/api/deck?userId=u1');
    const ids = res.body.profiles.map((p) => p.id);
    expect(ids).not.toContain('u2');
    expect(ids).toContain('u3');
  });

  // P9: deck is capped at 20 profiles
  test('P9: deck returns at most 20 profiles', async () => {
    addProfile('viewer');
    for (let i = 0; i < 25; i++) addProfile(`u${i}`, `User${i}`);
    const res = await request(app).get('/api/deck?userId=viewer');
    expect(res.body.profiles.length).toBeLessThanOrEqual(20);
  });
});
