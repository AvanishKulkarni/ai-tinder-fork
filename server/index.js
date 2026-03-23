// index.js — Express entry point
const express = require('express');
const cors = require('cors');
const path = require('path');

const { seed } = require('./seed');
const swipesRouter = require('./routes/swipes');
const deckRouter = require('./routes/deck');
const matchesRouter = require('./routes/matches');
const usersRouter = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

// Serve the vanilla-JS frontend from the repo root
app.use(express.static(path.join(__dirname, '..')));

app.use('/api/swipes', swipesRouter);
app.use('/api/deck', deckRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/users', usersRouter);

// Seed profiles on startup (no-op if already seeded)
seed();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Tinder-clone server running → http://localhost:${PORT}`)
);
