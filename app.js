// app.js — Tinder-style swipe interactions
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
function sampleN(arr, n) {
  const shuffled = arr.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function pickTags() { return Array.from(new Set(Array.from({length:4}, ()=>sample(TAGS)))); }
function imgFor(seed) {
  return `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;
}

function generateProfiles(count = 12) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    const photos = sampleN(UNSPLASH_SEEDS, 3 + Math.floor(Math.random() * 3));
    profiles.push({
      id: `p_${i}_${Date.now().toString(36)}`,
      name: sample(FIRST_NAMES),
      age: 18 + Math.floor(Math.random() * 22),
      city: sample(CITIES),
      title: sample(JOBS),
      bio: sample(BIOS),
      tags: pickTags(),
      img: imgFor(photos[0]),
      photos: photos.map(imgFor),
    });
  }
  return profiles;
}

// -------------------
// DOM refs
// -------------------
const deckEl = document.getElementById("deck");
const shuffleBtn = document.getElementById("shuffleBtn");
const likeBtn = document.getElementById("likeBtn");
const nopeBtn = document.getElementById("nopeBtn");
const superLikeBtn = document.getElementById("superLikeBtn");
const galleryOverlay = document.getElementById("galleryOverlay");
const galleryTrack = document.getElementById("galleryTrack");
const galleryDots = document.getElementById("galleryDots");
const galleryClose = document.getElementById("galleryClose");

let profiles = [];
let busy = false; // prevents overlapping swipes

// -------------------
// Rendering
// -------------------
function renderDeck() {
  deckEl.setAttribute("aria-busy", "true");
  deckEl.innerHTML = "";

  // Only render top 3 cards (stacked)
  profiles.slice(0, 3).forEach((p, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.index = idx;

    // Stamp overlays
    ["like", "nope", "super"].forEach((type) => {
      const stamp = document.createElement("span");
      stamp.className = `card__stamp card__stamp--${type}`;
      stamp.textContent = type === "super" ? "Super Like" : type;
      card.appendChild(stamp);
    });

    const img = document.createElement("img");
    img.className = "card__media";
    img.src = p.img;
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

  // Attach gestures to the top card
  const topCard = deckEl.firstElementChild;
  if (topCard) attachGestures(topCard);

  deckEl.removeAttribute("aria-busy");
}

function resetDeck() {
  profiles = generateProfiles(12);
  renderDeck();
}

// -------------------
// Card dismissal
// -------------------
function dismissCard(direction) {
  if (busy || profiles.length === 0) return;
  busy = true;

  const topCard = deckEl.firstElementChild;
  if (!topCard) { busy = false; return; }

  const classMap = { right: "card--fly-right", left: "card--fly-left", up: "card--fly-up" };
  const labelMap = { right: "Like", left: "Nope", up: "Super Like" };

  // Flash the stamp
  const stampClass = direction === "up" ? "super" : direction === "right" ? "like" : "nope";
  const stamp = topCard.querySelector(`.card__stamp--${stampClass}`);
  if (stamp) stamp.style.opacity = "1";

  topCard.classList.add(classMap[direction]);
  console.log(`${labelMap[direction]}: ${profiles[0]?.name}`);

  // Idempotent finalizer — safe to call from both animationend and fallback
  let finalized = false;
  let fallbackTimer = null;

  function finalizeDismiss() {
    if (finalized) return;
    finalized = true;
    clearTimeout(fallbackTimer);
    profiles.shift();
    renderDeck();
    busy = false;
  }

  topCard.addEventListener("animationend", finalizeDismiss, { once: true });
  fallbackTimer = setTimeout(finalizeDismiss, 700);
}

// -------------------
// Gesture handling (touch + mouse)
// -------------------
function attachGestures(card) {
  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
  let lastTap = 0;

  const THRESHOLD = 80; // px to trigger swipe

  function pointerStart(e) {
    if (busy) return;
    // Prevent browser image drag / text selection so mousemove keeps firing
    if (!e.touches) e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX;
    startY = pt.clientY;
    dx = 0;
    dy = 0;
    dragging = true;
    card.classList.add("dragging");

    // Attach move/up on document only while dragging, then clean up
    if (!e.touches) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
  }

  function pointerMove(e) {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    dx = pt.clientX - startX;
    dy = pt.clientY - startY;

    const rotation = dx * 0.08;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;

    // Update stamp opacity based on drag distance
    const likeStamp = card.querySelector(".card__stamp--like");
    const nopeStamp = card.querySelector(".card__stamp--nope");
    const superStamp = card.querySelector(".card__stamp--super");

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (likeStamp) likeStamp.style.opacity = dx > 0 ? Math.min(absX / THRESHOLD, 1) : 0;
    if (nopeStamp) nopeStamp.style.opacity = dx < 0 ? Math.min(absX / THRESHOLD, 1) : 0;
    if (superStamp) superStamp.style.opacity = dy < 0 ? Math.min(absY / THRESHOLD, 1) : 0;

    e.preventDefault();
  }

  function pointerEnd() {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging");

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Prioritise upward swipe when strong vertical component
    if (dy < -THRESHOLD && absY > absX) {
      dismissCard("up");
    } else if (dx > THRESHOLD) {
      dismissCard("right");
    } else if (dx < -THRESHOLD) {
      dismissCard("left");
    } else {
      // Snap back
      card.style.transform = "";
      card.querySelectorAll(".card__stamp").forEach((s) => (s.style.opacity = "0"));
    }
  }

  // Double-tap detection
  function handleTap() {
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return; // was a drag, not a tap
    const now = Date.now();
    if (now - lastTap < 350) {
      openGallery(profiles[0]);
    }
    lastTap = now;
  }

  // Mouse: add move/up only during drag, then remove
  function onMouseMove(e) { pointerMove(e); }
  function onMouseUp(e) {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    pointerEnd();
    handleTap();
  }

  card.addEventListener("mousedown", pointerStart);

  // Touch events
  card.addEventListener("touchstart", pointerStart, { passive: true });
  card.addEventListener("touchmove", pointerMove, { passive: false });
  card.addEventListener("touchend", () => { pointerEnd(); handleTap(); });
}

// -------------------
// Photo gallery (double-tap)
// -------------------
function openGallery(profile) {
  if (!profile || !profile.photos) return;
  galleryTrack.innerHTML = "";
  galleryDots.innerHTML = "";

  profile.photos.forEach((src, i) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${profile.name} photo ${i + 1}`;
    galleryTrack.appendChild(img);

    const dot = document.createElement("button");
    dot.className = "gallery__dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Photo ${i + 1}`);
    dot.addEventListener("click", () => {
      galleryTrack.children[i].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    });
    galleryDots.appendChild(dot);
  });

  // Sync dots on scroll
  galleryTrack.onscroll = () => {
    const scrollLeft = galleryTrack.scrollLeft;
    const width = galleryTrack.clientWidth;
    const idx = Math.round(scrollLeft / width);
    galleryDots.querySelectorAll(".gallery__dot").forEach((d, i) => {
      d.classList.toggle("active", i === idx);
    });
  };

  galleryOverlay.classList.add("open");
}

function closeGallery() {
  galleryOverlay.classList.remove("open");
}

galleryClose.addEventListener("click", closeGallery);
galleryOverlay.addEventListener("click", (e) => {
  if (e.target === galleryOverlay) closeGallery();
});

// -------------------
// Action buttons
// -------------------
nopeBtn.addEventListener("click", () => dismissCard("left"));
likeBtn.addEventListener("click", () => dismissCard("right"));
superLikeBtn.addEventListener("click", () => dismissCard("up"));
shuffleBtn.addEventListener("click", resetDeck);

// Boot
resetDeck();
