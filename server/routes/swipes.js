// routes/swipes.js — POST /api/swipes
// Records a swipe action and performs mutual-match detection.
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

const VALID_ACTIONS = new Set(['like', 'nope', 'super_like']);

router.post('/', (req, res) => {
  const { actorId, targetId, action } = req.body ?? {};

  if (!actorId || !targetId || !action) {
    return res.status(400).json({ error: 'actorId, targetId, and action are required.' });
  }
  if (actorId === targetId) {
    return res.status(400).json({ error: 'actorId and targetId must be different.' });
  }
  if (!VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'action must be one of: like, nope, super_like.' });
  }

  // Reject duplicate swipe for the same pair
  const existing = db
    .prepare('SELECT id FROM swipe_actions WHERE actor_id = ? AND target_id = ?')
    .get(actorId, targetId);
  if (existing) {
    return res.status(409).json({ error: 'Duplicate swipe.', swipeId: existing.id });
  }

  const swipeId = uuidv4();
  db.prepare(
    'INSERT INTO swipe_actions (id, actor_id, target_id, action) VALUES (?, ?, ?, ?)'
  ).run(swipeId, actorId, targetId, action);

  const target = db.prepare('SELECT name FROM profiles WHERE id = ?').get(targetId);
  console.log(`[swipe] ${new Date().toISOString()} | actor=${actorId.slice(0, 8)} | action=${action.padEnd(10)} | target=${targetId.slice(0, 8)} (${target?.name ?? 'unknown'})`);

  // Match check — only likes / super_likes can produce a match
  let match = null;
  if (action === 'like' || action === 'super_like') {
    const reciprocal = db
      .prepare(`
        SELECT id, action FROM swipe_actions
        WHERE actor_id = ? AND target_id = ? AND action IN ('like', 'super_like')
      `)
      .get(targetId, actorId);

    if (reciprocal) {
      // Also make sure the target hasn't noped the actor (belt-and-suspenders)
      const blocked = db
        .prepare(
          `SELECT 1 FROM swipe_actions WHERE actor_id = ? AND target_id = ? AND action = 'nope'`
        )
        .get(targetId, actorId);

      if (!blocked) {
        const matchId = uuidv4();
        const isSuperLike =
          action === 'super_like' || reciprocal.action === 'super_like' ? 1 : 0;

        db.prepare(
          'INSERT INTO matches (id, user1_id, user2_id, is_super_like) VALUES (?, ?, ?, ?)'
        ).run(matchId, actorId, targetId, isSuperLike);

        const matchedUser = db
          .prepare('SELECT id, name, img FROM profiles WHERE id = ?')
          .get(targetId);

        match = { matchId, matchedUser, isSuperLike: Boolean(isSuperLike) };
        console.log(`[match] ${new Date().toISOString()} | matchId=${matchId.slice(0, 8)} | u1=${actorId.slice(0, 8)} ↔ u2=${targetId.slice(0, 8)} | superLike=${Boolean(isSuperLike)}`);
      }
    }
  }

  res.status(201).json({ swipeId, match });
});

module.exports = router;
