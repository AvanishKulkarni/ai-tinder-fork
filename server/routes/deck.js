// routes/deck.js — GET /api/deck?userId=...
// Returns profiles the user hasn't swiped on yet.
// Super-liked profiles (where the viewer was super-liked by that profile) float to the top.
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query param is required.' });

  // Exclude the user's own profile and any profile already swiped on by this user.
  // Profiles that super-liked the viewer sort first.
  const rows = db
    .prepare(`
      SELECT p.*,
        CASE WHEN sl.id IS NOT NULL THEN 1 ELSE 0 END AS super_liked_by
      FROM profiles p
      LEFT JOIN swipe_actions sa
        ON sa.actor_id = :userId AND sa.target_id = p.id
      LEFT JOIN swipe_actions sl
        ON sl.actor_id = p.id AND sl.target_id = :userId AND sl.action = 'super_like'
      WHERE p.id != :userId
        AND sa.id IS NULL
      ORDER BY super_liked_by DESC, p.created_at ASC
      LIMIT 20
    `)
    .all({ userId });

  const profiles = rows.map((r) => ({
    ...r,
    tags: JSON.parse(r.tags || '[]'),
    photos: JSON.parse(r.photos || '[]'),
    superLikedBy: Boolean(r.super_liked_by),
    super_liked_by: undefined,
  }));

  res.json({ profiles });
});

module.exports = router;
