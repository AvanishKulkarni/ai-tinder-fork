# ai-tinder
AI-generated tinder frontend.

## Running locally

```bash
cd server
npm install       # first time only
npm run dev       # starts server with auto-reload on file changes
```

Then open **http://localhost:3000** in your browser.

**Requirements:** Node.js v20 or later. If you're on an older version, upgrade via [nvm](https://github.com/nvm-sh/nvm) or [Homebrew](https://brew.sh/).

## Testing matches

The app polls the backend every 10 seconds for new matches.

1. **Force a new user** — open DevTools → Application → Local Storage → delete `tinderUserId`. This creates a fresh user with mock likes already seeded.
2. **Swipe right** on profiles — ~60% of profiles auto-like new users, so most right-swipes will immediately trigger a match modal.
3. **Watch the poll** — in the Network tab you'll see `GET /api/matches?userId=...&since=...` fire every 10 seconds. Any new matches found will pop up as modals automatically.
