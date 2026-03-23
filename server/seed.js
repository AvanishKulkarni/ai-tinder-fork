// seed.js — populate the profiles table on first run
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const TAGS = [
  'Coffee','Hiking','Movies','Live Music','Board Games','Cats','Dogs','Traveler',
  'Foodie','Tech','Art','Runner','Climbing','Books','Yoga','Photography',
];
const FIRST_NAMES = [
  'Alex','Sam','Jordan','Taylor','Casey','Avery','Riley','Morgan','Quinn','Cameron',
  'Jamie','Drew','Parker','Reese','Emerson','Rowan','Shawn','Harper','Skyler','Devon',
];
const CITIES = [
  'Brooklyn','Manhattan','Queens','Jersey City','Hoboken','Astoria',
  'Williamsburg','Bushwick','Harlem','Lower East Side',
];
const JOBS = [
  'Product Designer','Software Engineer','Data Analyst','Barista','Teacher',
  'Photographer','Architect','Chef','Nurse','Marketing Manager','UX Researcher',
];
const BIOS = [
  'Weekend hikes and weekday lattes.',
  'Dog parent. Amateur chef. Karaoke enthusiast.',
  'Trying every taco in the city — for science.',
  'Bookstore browser and movie quote machine.',
  'Gym sometimes, Netflix always.',
  'Looking for the best slice in town.',
  'Will beat you at Mario Kart.',
  'Currently planning the next trip.',
];
const UNSPLASH_SEEDS = [
  '1515462277126-2b47b9fa09e6',
  '1520975916090-3105956dac38',
  '1519340241574-2cec6aef0c01',
  '1554151228-14d9def656e4',
  '1548142813-c348350df52b',
  '1517841905240-472988babdf9',
  '1535713875002-d1d0cf377fde',
  '1545996124-0501ebae84d0',
  '1524504388940-b1c1722653e1',
  '1531123897727-8f129e1688ce',
];

const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];
const imgFor = (seed) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;

function pickTags() {
  const set = new Set();
  while (set.size < 4) set.add(sample(TAGS));
  return Array.from(set);
}

function generateProfile() {
  const shuffled = [...UNSPLASH_SEEDS].sort(() => Math.random() - 0.5);
  const photoSeeds = shuffled.slice(0, 3 + Math.floor(Math.random() * 3));
  return {
    id: uuidv4(),
    name: sample(FIRST_NAMES),
    age: 18 + Math.floor(Math.random() * 22),
    city: sample(CITIES),
    title: sample(JOBS),
    bio: sample(BIOS),
    tags: JSON.stringify(pickTags()),
    img: imgFor(photoSeeds[0]),
    photos: JSON.stringify(photoSeeds.map(imgFor)),
  };
}

function seed(count = 20) {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM profiles').get().cnt;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO profiles (id, name, age, city, title, bio, tags, img, photos)
    VALUES (@id, @name, @age, @city, @title, @bio, @tags, @img, @photos)
  `);
  const insertMany = db.transaction((profiles) => {
    for (const p of profiles) insert.run(p);
  });

  const profiles = Array.from({ length: count }, generateProfile);
  insertMany(profiles);
  console.log(`Seeded ${profiles.length} profiles.`);
}

module.exports = { seed };
