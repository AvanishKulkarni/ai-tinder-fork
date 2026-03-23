# Backend — Tinder Clone

Node.js / Express API backed by SQLite (`better-sqlite3`).

## Quick Start

```bash
cd server
npm install
npm start          # or: npm run dev  (uses --watch)
# → http://localhost:3000
```

The server also serves the vanilla-JS frontend from the repo root, so opening `http://localhost:3000` shows the app.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users` | Create an anonymous user session → `{ userId }` |
| `GET` | `/api/deck?userId=` | Fetch unswiped profiles, super-liked ones first |
| `POST` | `/api/swipes` | Record a swipe (`like` / `nope` / `super_like`) → `{ swipeId, match }` |
| `GET` | `/api/matches?userId=` | List all matches for a user |

### `POST /api/swipes` body

```json
{ "actorId": "uuid", "targetId": "uuid", "action": "like|nope|super_like" }
```

Returns `{ swipeId, match: null }` or `{ swipeId, match: { matchId, matchedUser, isSuperLike } }` when a mutual match is created.

## Data Models

- **profiles** — id, name, age, city, title, bio, tags (JSON), img, photos (JSON)
- **swipe_actions** — id, actor_id, target_id, action, created_at · UNIQUE(actor_id, target_id)
- **matches** — id, user1_id, user2_id, is_super_like, created_at

## Frontend Integration

On boot, `app.js`:
1. Reads / creates `tinderUserId` in `localStorage` via `POST /api/users`
2. Loads the deck from `GET /api/deck`
3. After each swipe animation, fires `POST /api/swipes`
4. Displays a match modal when the response contains a match object
5. Shows a toast on network errors
