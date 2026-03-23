// routes/swipes.js — POST /api/swipes
// Records a swipe action and performs mutual-match detection.
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

const VALID_ACTIONS = new Set(['like', 'nope', 'super_like']);

router.post('/', (req, res) => {
  let { actorId, targetId, action } = req.body ?? {};

  if (!actorId || !targetId || !action) {
    return res.status(400).json({ error: 'actorId, targetId, and action are required.' });
  }
  if (typeof actorId !== 'string' || typeof targetId !== 'string') {
    return res.status(400).json({ error: 'actorId and targetId must be non-empty strings.' });
  }
  actorId = actorId.trim();
  targetId = targetId.trim();
  if (!actorId || !targetId) {
    return res.status(400).json({ error: 'actorId and targetId must be non-empty strings.' });
  }
  if (actorId === targetId) {
    return res.status(400).json({ error: 'actorId and targetId must be different.' });
  }
  if (!VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'action must be one of: like, nope, super_like.' });
  }

  // Use INSERT OR IGNORE so concurrent duplicate requests don't race past the SELECT
  const swipeId = uuidv4();
  const insertResult = db.prepare(
    'INSERT OR IGNORE INTO swipe_actions (id, actor_id, target_id, action) VALUES (?, ?, ?, ?)'
  ).run(swipeId, actorId, targetId, action);

  if (insertResult.changes === 0) {
    const existingConcurrent = db
      .prepare('SELECT id FROM swipe_actions WHERE actor_id = ? AND target_id = ?')
      .get(actorId, targetId);
    return res.status(409).json({ error: 'Duplicate swipe.', swipeId: existingConcurrent?.id });
  }

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
        const isSuperLike =
          action === 'super_like' || reciprocal.action === 'super_like' ? 1 : 0;

        // Canonicalize user ordering to prevent duplicate matches from concurrent swipes
        const user1Id = actorId < targetId ? actorId : targetId;
        const user2Id = actorId < targetId ? targetId : actorId;

        const existingMatch = db
          .prepare('SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?')
          .get(user1Id, user2Id);

        const matchId = existingMatch
          ? existingMatch.id
          : (() => {
              const id = uuidv4();
              db.prepare(
                'INSERT INTO matches (id, user1_id, user2_id, is_super_like) VALUES (?, ?, ?, ?)'
              ).run(id, user1Id, user2Id, isSuperLike);
              return id;
            })();

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
