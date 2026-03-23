// routes/matches.js — GET /api/matches?userId=...
// Returns all matches for the given user, with matched user info.
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { userId, since } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query param is required.' });

  const params = { userId };
  let sinceClause = '';
  if (since) {
    sinceClause = 'AND m.created_at > :since';
    params.since = since;
  }

  const rows = db
    .prepare(`
      SELECT
        m.id          AS matchId,
        m.is_super_like AS isSuperLike,
        m.created_at  AS createdAt,
        p.id          AS userId,
        p.name,
        p.img
      FROM matches m
      JOIN profiles p
        ON p.id = CASE WHEN m.user1_id = :userId THEN m.user2_id ELSE m.user1_id END
      WHERE (m.user1_id = :userId OR m.user2_id = :userId)
        ${sinceClause}
      ORDER BY m.created_at DESC
    `)
    .all(params);

  res.json({
    matches: rows.map((r) => ({ ...r, isSuperLike: Boolean(r.isSuperLike) })),
  });
});

module.exports = router;
