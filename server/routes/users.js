// routes/users.js — create or identify an anonymous user session
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// POST /api/users — create a new anonymous user profile
router.post('/', (req, res) => {
  const id = uuidv4();
  const name = (req.body && req.body.name) || 'You';

  db.prepare(`
    INSERT INTO profiles (id, name, age, city, title, bio, tags, img, photos)
    VALUES (?, ?, 25, 'NYC', 'App User', 'Just browsing!', '[]', '', '[]')
  `).run(id, name);

  // Mock: ~60% of existing profiles auto-like new users so matches are likely during testing
  const existing = db.prepare('SELECT id FROM profiles WHERE id != ?').all(id);
  const insertLike = db.prepare(
    'INSERT OR IGNORE INTO swipe_actions (id, actor_id, target_id, action) VALUES (?, ?, ?, ?)'
  );
  const seedLikes = db.transaction((profiles) => {
    for (const p of profiles) {
      if (Math.random() < 0.6) insertLike.run(uuidv4(), p.id, id, 'like');
    }
  });
  seedLikes(existing);

  res.status(201).json({ userId: id });
});

module.exports = router;
