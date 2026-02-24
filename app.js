// app.js
// Plain global JS, no modules.

// -------------------
// Data generator
// -------------------
const TAGS = [
  "Coffee","Hiking","Movies","Live Music","Board Games","Cats","Dogs","Traveler",
  "Foodie","Tech","Art","Runner","Climbing","Books","Yoga","Photography"
];
const FIRST_NAMES = [
  "Alex","Sam","Jordan","Taylor","Casey","Avery","Riley","Morgan","Quinn","Cameron",
  "Jamie","Drew","Parker","Reese","Emerson","Rowan","Shawn","Harper","Skyler","Devon"
];
const CITIES = [
  "Brooklyn","Manhattan","Queens","Jersey City","Hoboken","Astoria",
  "Williamsburg","Bushwick","Harlem","Lower East Side"
];
const JOBS = [
  "Product Designer","Software Engineer","Data Analyst","Barista","Teacher",
  "Photographer","Architect","Chef","Nurse","Marketing Manager","UX Researcher"
];
const BIOS = [
  "Weekend hikes and weekday lattes.",
  "Dog parent. Amateur chef. Karaoke enthusiast.",
  "Trying every taco in the city — for science.",
  "Bookstore browser and movie quote machine.",
  "Gym sometimes, Netflix always.",
  "Looking for the best slice in town.",
  "Will beat you at Mario Kart.",
  "Currently planning the next trip."
];

const UNSPLASH_SEEDS = [
  "1515462277126-2b47b9fa09e6",
  "1520975916090-3105956dac38",
  "1519340241574-2cec6aef0c01",
  "1554151228-14d9def656e4",
  "1548142813-c348350df52b",
  "1517841905240-472988babdf9",
  "1535713875002-d1d0cf377fde",
  "1545996124-0501ebae84d0",
  "1524504388940-b1c1722653e1",
  "1531123897727-8f129e1688ce",
];

function sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickTags() { return Array.from(new Set(Array.from({length:4}, ()=>sample(TAGS)))); }
function imgFor(seed) {
  return `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;
}

function generateProfiles(count = 12) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    // Give each profile multiple photos for the gallery
    const photos = Array.from(new Set(
      Array.from({length: 3 + Math.floor(Math.random() * 3)}, () => sample(UNSPLASH_SEEDS))
    )).map(imgFor);
    profiles.push({
      id: `p_${i}_${Date.now().toString(36)}`,
      name: sample(FIRST_NAMES),
      age: 18 + Math.floor(Math.random() * 22),
      city: sample(CITIES),
      title: sample(JOBS),
      bio: sample(BIOS),
      tags: pickTags(),
      img: photos[0],
      photos,
      photoIndex: 0,
    });
  }
  return profiles;
}

// -------------------
// UI rendering
// -------------------
const deckEl = document.getElementById("deck");
const shuffleBtn = document.getElementById("shuffleBtn");
const likeBtn = document.getElementById("likeBtn");
const nopeBtn = document.getElementById("nopeBtn");
const superLikeBtn = document.getElementById("superLikeBtn");

let profiles = [];

function renderDeck() {
  deckEl.setAttribute("aria-busy", "true");
  deckEl.innerHTML = "";

  profiles.forEach((p, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.profileId = p.id;

    // Photo gallery dots
    if (p.photos.length > 1) {
      const dots = document.createElement("div");
      dots.className = "card__dots";
      p.photos.forEach((_, i) => {
        const dot = document.createElement("span");
        dot.className = "card__dot" + (i === p.photoIndex ? " card__dot--active" : "");
        dots.appendChild(dot);
      });
      card.appendChild(dots);
    }

    // Stamp overlays
    ["like", "nope", "super"].forEach((type) => {
      const stamp = document.createElement("span");
      stamp.className = `card__stamp card__stamp--${type}`;
      stamp.textContent = type === "super" ? "SUPER LIKE" : type.toUpperCase();
      card.appendChild(stamp);
    });

    const img = document.createElement("img");
    img.className = "card__media";
    img.src = p.photos[p.photoIndex];
    img.alt = `${p.name} — profile photo`;
    img.draggable = false;

    const body = document.createElement("div");
    body.className = "card__body";

    const titleRow = document.createElement("div");
    titleRow.className = "title-row";
    titleRow.innerHTML = `
      <h2 class="card__title">${p.name}</h2>
      <span class="card__age">${p.age}</span>
    `;

    const meta = document.createElement("div");
    meta.className = "card__meta";
    meta.textContent = `${p.title} • ${p.city}`;

    const chips = document.createElement("div");
    chips.className = "card__chips";
    p.tags.forEach((t) => {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = t;
      chips.appendChild(c);
    });

    body.appendChild(titleRow);
    body.appendChild(meta);
    body.appendChild(chips);

    card.appendChild(img);
    card.appendChild(body);

    deckEl.appendChild(card);
  });

  attachSwipeHandlers();
  deckEl.removeAttribute("aria-busy");
}

function resetDeck() {
  profiles = generateProfiles(12);
  renderDeck();
}

// -------------------
// Card dismissal
// -------------------
function getTopCard() {
  return deckEl.querySelector(".card:first-child");
}

function dismissTopCard(action) {
  const card = getTopCard();
  if (!card || card.classList.contains("swipe-left") ||
      card.classList.contains("swipe-right") || card.classList.contains("swipe-up")) return;

  const classMap = { like: "swipe-right", nope: "swipe-left", superlike: "swipe-up" };
  const stampMap = { like: "like", nope: "nope", superlike: "super" };

  // Flash the stamp
  const stamp = card.querySelector(`.card__stamp--${stampMap[action]}`);
  if (stamp) stamp.style.opacity = 1;

  card.classList.add(classMap[action]);

  card.addEventListener("transitionend", () => {
    card.remove();
    profiles.shift();
    if (profiles.length === 0) resetDeck();
    else attachSwipeHandlers();
  }, { once: true });
}

// -------------------
// Action buttons
// -------------------
likeBtn.addEventListener("click", () => dismissTopCard("like"));
nopeBtn.addEventListener("click", () => dismissTopCard("nope"));
superLikeBtn.addEventListener("click", () => dismissTopCard("superlike"));
shuffleBtn.addEventListener("click", resetDeck);

// -------------------
// Swipe gestures & double-tap
// -------------------
const SWIPE_THRESHOLD = 80;
const SWIPE_UP_THRESHOLD = 60;

function attachSwipeHandlers() {
  const card = getTopCard();
  if (!card) return;

  let startX, startY, currentX, currentY, isDragging = false;
  let lastTapTime = 0;

  card.addEventListener("pointerdown", onPointerDown);

  function onPointerDown(e) {
    // Double-tap detection
    const now = Date.now();
    if (now - lastTapTime < 300) {
      cyclePhoto();
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    currentX = 0;
    currentY = 0;
    card.classList.add("dragging");
    card.setPointerCapture(e.pointerId);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;

    const rotate = currentX * 0.08;
    card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;

    // Update stamp opacity based on direction
    const likeStamp = card.querySelector(".card__stamp--like");
    const nopeStamp = card.querySelector(".card__stamp--nope");
    const superStamp = card.querySelector(".card__stamp--super");

    const xRatio = Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1);
    const yRatio = Math.min(Math.abs(currentY) / SWIPE_UP_THRESHOLD, 1);

    if (likeStamp) likeStamp.style.opacity = currentX > 0 ? xRatio : 0;
    if (nopeStamp) nopeStamp.style.opacity = currentX < 0 ? xRatio : 0;
    if (superStamp) superStamp.style.opacity = currentY < 0 ? yRatio : 0;
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    card.classList.remove("dragging");

    if (currentY < -SWIPE_UP_THRESHOLD && Math.abs(currentY) > Math.abs(currentX)) {
      dismissTopCard("superlike");
    } else if (currentX > SWIPE_THRESHOLD) {
      dismissTopCard("like");
    } else if (currentX < -SWIPE_THRESHOLD) {
      dismissTopCard("nope");
    } else {
      // Snap back
      card.style.transform = "";
      card.querySelectorAll(".card__stamp").forEach(s => s.style.opacity = 0);
    }
  }

  function cyclePhoto() {
    const profile = profiles[0];
    if (!profile || profile.photos.length <= 1) return;
    profile.photoIndex = (profile.photoIndex + 1) % profile.photos.length;

    const img = card.querySelector(".card__media");
    if (img) img.src = profile.photos[profile.photoIndex];

    // Update dots
    const dots = card.querySelectorAll(".card__dot");
    dots.forEach((dot, i) => {
      dot.classList.toggle("card__dot--active", i === profile.photoIndex);
    });
  }
}

// Boot
resetDeck();
