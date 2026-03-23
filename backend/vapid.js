'use strict';

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const KEYS_PATH = process.env.VAPID_KEYS_PATH || path.join(__dirname, 'vapid_keys.json');

function loadOrGenerateKeys() {
  // Prefer keys supplied via env vars (avoids filesystem access in CI/containers)
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }
  if (fs.existsSync(KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8'));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));
  return keys;
}

let vapidKeysCache = null;

function getVapidKeys() {
  if (!vapidKeysCache) {
    vapidKeysCache = loadOrGenerateKeys();
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      vapidKeysCache.publicKey,
      vapidKeysCache.privateKey
    );
  }
  return vapidKeysCache;
}

module.exports = {
  webpush,
  get vapidKeys() { return getVapidKeys(); },
};
