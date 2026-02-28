/*
 * game.js — Marice & Cats House Adventure — Full Game Engine
 *
 * Pure HTML5 Canvas game with grid movement, collision, interaction,
 * inventory, dialogue overlay, and localStorage save/load.
 */

// ======================== GLOBALS ========================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const CANVAS_W = MAP_COLS * TILE_SIZE; // 480
const CANVAS_H = MAP_ROWS * TILE_SIZE; // 360

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Scale canvas for display
function resizeCanvas() {
  const maxW = window.innerWidth - 10;
  const maxH = window.innerHeight - 180;
  const scaleW = maxW / CANVAS_W;
  const scaleH = maxH / CANVAS_H;
  const scale = Math.min(scaleW, scaleH, 3);
  canvas.style.width = (CANVAS_W * scale) + 'px';
  canvas.style.height = (CANVAS_H * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ======================== GAME STATE ========================

let gameState = {
  currentFloor: 'outside',
  player: { row: outsideStart.row, col: outsideStart.col, facing: 'down' },
  inventory: [],          // array of item ID strings
  flags: {
    alice_fed: false,
    olive_fed: false,
    beatrice_fed: false,
    has_basement_key: false,
    basement_unlocked: false,
    has_laundry_basket: false,
    laundry_cleared: false,
    sofa_searched: false,
    game_complete: false,
    front_door_unlocked: false,
    cat_toys_found: []   // array of toy IDs collected
  },
  // Smooth movement animation
  moving: false,
  moveProgress: 0,
  moveFrom: null,
  moveTo: null,
};

// Movement speed (pixels per frame at 60fps)
const MOVE_SPEED = 3; // tiles take ~8 frames = ~133ms

// Walk animation frame counter
let walkFrame = 0;
let walkFrameTimer = 0;
const WALK_FRAME_INTERVAL = 8; // swap legs every 8 frames

// Global animation timer (for cat idle animations, light flicker, etc.)
let animTimer = 0;

// Screen shake state
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeTimer = 0;

function triggerScreenShake(intensity, duration) {
  var shakeCheckbox = document.getElementById('screen-shake');
  if (!shakeCheckbox || !shakeCheckbox.checked) return;
  shakeIntensity = intensity;
  shakeDuration = duration;
  shakeTimer = duration;
}

function updateScreenShake() {
  if (shakeTimer > 0) {
    shakeTimer--;
  }
}

function getShakeOffset() {
  if (shakeTimer <= 0) return { x: 0, y: 0 };
  var progress = shakeTimer / shakeDuration;
  var currentIntensity = shakeIntensity * progress; // dampen over time
  return {
    x: (Math.random() - 0.5) * 2 * currentIntensity,
    y: (Math.random() - 0.5) * 2 * currentIntensity
  };
}

// ======================== AUDIO SYSTEM (Web Audio API) ========================

let audioCtx = null;
let musicGainNode = null;
let sfxGainNode = null;
let currentMusic = null;
let musicPlaying = false;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGainNode = audioCtx.createGain();
    musicGainNode.connect(audioCtx.destination);
    sfxGainNode = audioCtx.createGain();
    sfxGainNode.connect(audioCtx.destination);
    updateAudioVolumes();
  } catch (e) {
    // Web Audio not supported
  }
}

function updateAudioVolumes() {
  if (!audioCtx) return;
  var sfxSlider = document.getElementById('sfx-volume');
  var musicSlider = document.getElementById('music-volume');
  var sfxVol = sfxSlider ? parseInt(sfxSlider.value) / 100 : 0.7;
  var musicVol = musicSlider ? parseInt(musicSlider.value) / 100 : 0.5;
  sfxGainNode.gain.setValueAtTime(sfxVol, audioCtx.currentTime);
  musicGainNode.gain.setValueAtTime(musicVol * 0.3, audioCtx.currentTime); // music quieter
}

// --- SFX: procedural chiptune sounds ---

function playSfx(type) {
  if (!audioCtx) return;
  updateAudioVolumes();
  switch (type) {
    case 'footstep': sfxFootstep(); break;
    case 'interact': sfxInteract(); break;
    case 'item_pickup': sfxItemPickup(); break;
    case 'door_unlock': sfxDoorUnlock(); break;
    case 'cat_meow': sfxCatMeow(); break;
    case 'cat_fed': sfxCatFed(); break;
    case 'numpad_beep': sfxNumpadBeep(); break;
    case 'error': sfxError(); break;
    case 'typewriter': sfxTypewriter(); break;
  }
}

function sfxFootstep() {
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120 + Math.random() * 40, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.08);
}

function sfxInteract() {
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, audioCtx.currentTime);
  osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}

function sfxItemPickup() {
  // Rising arpeggio
  [0, 0.08, 0.16].forEach(function (delay, i) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime([523, 659, 784][i], audioCtx.currentTime + delay);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.15);
    osc.connect(gain);
    gain.connect(sfxGainNode);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + 0.15);
  });
}

function sfxDoorUnlock() {
  // Click + low thud
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.25);

  // Click sound
  var osc2 = audioCtx.createOscillator();
  var gain2 = audioCtx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc2.connect(gain2);
  gain2.connect(sfxGainNode);
  osc2.start(audioCtx.currentTime);
  osc2.stop(audioCtx.currentTime + 0.05);
}

function sfxCatMeow() {
  // Frequency sweep mimicking a meow
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';
  var t = audioCtx.currentTime;
  osc.frequency.setValueAtTime(500 + Math.random() * 100, t);
  osc.frequency.linearRampToValueAtTime(700 + Math.random() * 150, t + 0.1);
  osc.frequency.linearRampToValueAtTime(400 + Math.random() * 100, t + 0.3);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.setValueAtTime(0.15, t + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(t);
  osc.stop(t + 0.35);
}

function sfxCatFed() {
  // Happy jingle
  var notes = [523, 659, 784, 1047];
  notes.forEach(function (freq, i) {
    var delay = i * 0.1;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.2);
    osc.connect(gain);
    gain.connect(sfxGainNode);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + 0.2);
  });
}

function sfxNumpadBeep() {
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.06);
}

function sfxError() {
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.setValueAtTime(150, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.2);
}

function sfxTypewriter() {
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(600 + Math.random() * 200, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.03);
}

// --- MUSIC: simple looping chiptune melodies per floor ---

var musicLoopTimer = null;
var musicNoteIndex = 0;

var MUSIC_DATA = {
  outside: {
    notes: [262, 294, 330, 349, 392, 349, 330, 294],
    tempo: 300, type: 'sine'
  },
  main: {
    notes: [330, 392, 440, 392, 349, 330, 294, 330],
    tempo: 350, type: 'triangle'
  },
  basement: {
    notes: [196, 220, 196, 175, 165, 175, 196, 220],
    tempo: 400, type: 'sine'
  },
  upstairs: {
    notes: [392, 440, 494, 523, 494, 440, 392, 349],
    tempo: 380, type: 'triangle'
  }
};

function startMusic(floorId) {
  if (!audioCtx) return;
  stopMusic();
  var data = MUSIC_DATA[floorId];
  if (!data) return;
  musicNoteIndex = 0;
  currentMusic = floorId;
  musicPlaying = true;
  playMusicNote(data);
}

function playMusicNote(data) {
  if (!musicPlaying || !audioCtx) return;
  updateAudioVolumes();

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = data.type;
  var freq = data.notes[musicNoteIndex % data.notes.length];
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  var dur = data.tempo / 1000;
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime + dur * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur * 0.95);
  osc.connect(gain);
  gain.connect(musicGainNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + dur);

  musicNoteIndex++;
  musicLoopTimer = setTimeout(function () {
    playMusicNote(data);
  }, data.tempo);
}

function stopMusic() {
  musicPlaying = false;
  if (musicLoopTimer) {
    clearTimeout(musicLoopTimer);
    musicLoopTimer = null;
  }
  currentMusic = null;
}

// ======================== PORTRAIT CACHE ========================

const portraits = {};
const portraitPaths = {
  alice: 'assets/portraits/alice_portrait_512.png',
  olive: 'assets/portraits/olive_portrait_512.png',
  beatrice: 'assets/portraits/beatrice_portrait_512.png',
  marice: 'assets/portraits/marice_portrait_512.png'
};

function preloadPortraits() {
  for (const [key, path] of Object.entries(portraitPaths)) {
    const img = new Image();
    img.src = path;
    portraits[key] = img;
  }
}
preloadPortraits();

// ======================== DIALOGUE SYSTEM ========================

let dialogueActive = false;
let dialogueQueue = [];
let dialogueIndex = 0;
let dialogueCat = null; // which cat's portrait to show
let dialogueCallback = null; // called when dialogue ends

// Typewriter effect state
let typewriterText = '';
let typewriterIndex = 0;
let typewriterTimer = null;
let typewriterDone = false;
const TYPEWRITER_SPEED = 30; // ms per character

const dialogueOverlay = document.getElementById('dialogue-overlay');
const dialoguePortraits = document.getElementById('dialogue-portraits');
const dialoguePortraitCat = document.getElementById('dialogue-portrait-cat');
const dialoguePortraitMarice = document.getElementById('dialogue-portrait-marice');
const dialogueSpeaker = document.getElementById('dialogue-speaker');
const dialogueText = document.getElementById('dialogue-text');
const dialogueAdvance = document.getElementById('dialogue-advance');

function startDialogue(dialogueKey, catName, callback) {
  const messages = DIALOGUE[dialogueKey];
  if (!messages || messages.length === 0) return;

  dialogueQueue = messages;
  dialogueIndex = 0;
  dialogueCat = catName;
  dialogueCallback = callback || null;
  dialogueActive = true;

  // Cat meow when talking to a cat
  if (catName) {
    playSfx('cat_meow');
  }

  showDialogueMessage();
  dialogueOverlay.classList.add('active');
}

function showDialogueMessage() {
  const msg = dialogueQueue[dialogueIndex];
  if (!msg) return;

  // Show cat + Marice portraits together during cat dialogues
  const hasCatPortrait = dialogueCat && portraits[dialogueCat];
  if (hasCatPortrait && portraits.marice) {
    dialoguePortraitCat.src = portraits[dialogueCat].src;
    dialoguePortraitMarice.src = portraits.marice.src;
    dialoguePortraits.style.display = 'flex';
  } else {
    dialoguePortraits.style.display = 'none';
  }

  dialogueSpeaker.textContent = msg.speaker;
  // Color-code speaker name
  if (msg.speaker === 'Marice') {
    dialogueSpeaker.style.color = '#ff9ecf';
  } else {
    dialogueSpeaker.style.color = '#ffd700';
  }

  // Start typewriter effect
  startTypewriter(msg.text);
}

function startTypewriter(text) {
  if (typewriterTimer) clearInterval(typewriterTimer);
  typewriterText = text;
  typewriterIndex = 0;
  typewriterDone = false;
  dialogueText.textContent = '';
  dialogueAdvance.style.visibility = 'hidden';

  typewriterTimer = setInterval(function () {
    typewriterIndex++;
    dialogueText.textContent = typewriterText.substring(0, typewriterIndex);
    // Play tick sound for visible characters (not spaces)
    if (typewriterText[typewriterIndex - 1] !== ' ') {
      playSfx('typewriter');
    }
    if (typewriterIndex >= typewriterText.length) {
      finishTypewriter();
    }
  }, TYPEWRITER_SPEED);
}

function finishTypewriter() {
  if (typewriterTimer) clearInterval(typewriterTimer);
  typewriterTimer = null;
  typewriterIndex = typewriterText.length;
  dialogueText.textContent = typewriterText;
  typewriterDone = true;
  dialogueAdvance.style.visibility = 'visible';
}

function advanceDialogue() {
  if (!dialogueActive) return;

  // If typewriter is still running, complete it instantly
  if (!typewriterDone) {
    finishTypewriter();
    return;
  }

  dialogueIndex++;
  if (dialogueIndex >= dialogueQueue.length) {
    closeDialogue();
    return;
  }
  showDialogueMessage();
}

function closeDialogue() {
  dialogueActive = false;
  dialogueOverlay.classList.remove('active');

  // Clean up typewriter
  if (typewriterTimer) clearInterval(typewriterTimer);
  typewriterTimer = null;
  typewriterDone = false;

  if (dialogueCallback) {
    const cb = dialogueCallback;
    dialogueCallback = null;
    cb();
  }
}

// Force dialogue UI/state closed without running callbacks.
// Used by hard resets (new game/restart) to avoid stale state.
function hideDialogue() {
  dialogueActive = false;
  dialogueQueue = [];
  dialogueIndex = 0;
  dialogueCat = null;
  dialogueCallback = null;
  dialogueOverlay.classList.remove('active');

  if (typewriterTimer) clearInterval(typewriterTimer);
  typewriterTimer = null;
  typewriterText = '';
  typewriterIndex = 0;
  typewriterDone = false;
  dialogueText.textContent = '';
  dialogueAdvance.style.visibility = 'hidden';
}

// ======================== TOAST SYSTEM ========================

const toastEl = document.getElementById('toast');
let toastTimer = null;
const IDLE_HINT_DELAY_MS = 20000;
const IDLE_HINT_CHECK_INTERVAL_MS = 1000;
const IDLE_HINT_COOLDOWN_MS = 15000;
let idleHintTimer = null;
let lastPlayerActionAt = Date.now();
let lastHintAt = 0;

function showToast(text, duration) {
  duration = duration || 2000;
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, duration);
}

function markPlayerActivity() {
  lastPlayerActionAt = Date.now();
}

function getNextTaskHint() {
  if (gameState.flags.game_complete) return null;

  if (!gameState.flags.front_door_unlocked) {
    return 'Check the house plaque outside for the front door code.';
  }
  if (!gameState.flags.alice_fed) {
    return hasItem('purrpops')
      ? 'Find Alice and give her the Purrpops.'
      : 'Search the kitchen cupboards for Purrpops for Alice.';
  }
  if (!gameState.flags.has_basement_key && !gameState.flags.basement_unlocked) {
    return 'Alice gave a clue—check under the sofa blanket.';
  }
  if (!gameState.flags.basement_unlocked) {
    return hasItem('basement_key')
      ? 'Use the Basement Key on the basement door.'
      : 'Look for the Basement Key near the sofa.';
  }
  if (!gameState.flags.olive_fed) {
    return hasItem('purrpops')
      ? 'Find Olive in the basement and feed her.'
      : 'Grab more Purrpops from the kitchen, then visit Olive downstairs.';
  }
  if (!gameState.flags.laundry_cleared) {
    return hasItem('laundry_basket')
      ? 'Take the Laundry Basket to the blocked stairs on the main floor.'
      : 'Talk to Olive in the basement to get help with the blocked stairs.';
  }
  if (!gameState.flags.beatrice_fed) {
    return hasItem('feast_plate')
      ? 'Find Beatrice upstairs and give her the feast plate.'
      : 'Find a Shrimp & Salmon Feast plate in the kitchen cupboards.';
  }
  return null;
}

function setupIdleHints() {
  if (idleHintTimer) clearInterval(idleHintTimer);
  idleHintTimer = setInterval(() => {
    if (dialogueActive) return;
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen && window.getComputedStyle(titleScreen).display !== 'none') return;
    if (document.getElementById('ending-overlay').classList.contains('active')) return;
    if (document.getElementById('numpad-overlay').classList.contains('active')) return;

    const now = Date.now();
    if (now - lastPlayerActionAt < IDLE_HINT_DELAY_MS) return;
    if (now - lastHintAt < IDLE_HINT_COOLDOWN_MS) return;

    const hint = getNextTaskHint();
    if (!hint) return;
    showToast(`Hint: ${hint}`, 3500);
    lastHintAt = now;
    lastPlayerActionAt = now;
  }, IDLE_HINT_CHECK_INTERVAL_MS);
}

// ======================== PARTICLE SYSTEM ========================

let particles = [];

class Particle {
  constructor(x, y, color, text) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = -Math.random() * 3 - 1;
    this.life = 60;
    this.maxLife = 60;
    this.color = color;
    this.text = text;
    this.size = text ? 12 : 4;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1; // gravity
    this.life--;
  }

  draw() {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;

    if (this.text) {
      ctx.fillStyle = this.color;
      ctx.font = 'bold ' + this.size + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.x, this.y);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  isDead() {
    return this.life <= 0;
  }
}

function spawnParticles(x, y, count, color) {
  const particleEffects = document.getElementById('particle-effects');
  if (!particleEffects || !particleEffects.checked) return;

  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function spawnTextParticle(x, y, text, color) {
  const particleEffects = document.getElementById('particle-effects');
  if (!particleEffects || !particleEffects.checked) return;

  particles.push(new Particle(x, y, color, text));
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  for (const particle of particles) {
    particle.draw();
  }
}

// ======================== QUEST TRACKING ========================

function updateQuestCounter() {
  const counter = document.getElementById('quest-counter');
  const fed = [
    gameState.flags.alice_fed,
    gameState.flags.olive_fed,
    gameState.flags.beatrice_fed
  ].filter(Boolean).length;
  counter.textContent = `Objectives: ${fed}/3 cats fed`;
}

function updateQuestList() {
  const quests = document.querySelectorAll('.quest-item');

  // Alice quest
  const aliceStatus = quests[0].querySelector('.quest-status');
  if (gameState.flags.alice_fed) {
    aliceStatus.textContent = '✅';
    aliceStatus.classList.remove('pending');
    aliceStatus.classList.add('complete');
  } else {
    aliceStatus.textContent = '⏳';
    aliceStatus.classList.remove('complete');
    aliceStatus.classList.add('pending');
  }

  // Olive quest
  const oliveStatus = quests[1].querySelector('.quest-status');
  if (gameState.flags.olive_fed) {
    oliveStatus.textContent = '✅';
    oliveStatus.classList.remove('pending');
    oliveStatus.classList.add('complete');
  } else {
    oliveStatus.textContent = '⏳';
    oliveStatus.classList.remove('complete');
    oliveStatus.classList.add('pending');
  }

  // Beatrice quest
  const beatriceStatus = quests[2].querySelector('.quest-status');
  if (gameState.flags.beatrice_fed) {
    beatriceStatus.textContent = '✅';
    beatriceStatus.classList.remove('pending');
    beatriceStatus.classList.add('complete');
  } else {
    beatriceStatus.textContent = '⏳';
    beatriceStatus.classList.remove('complete');
    beatriceStatus.classList.add('pending');
  }
}

// ======================== INVENTORY ========================

function addItem(itemId) {
  gameState.inventory.push(itemId);
  renderInventory();
  saveGame();

  // Spawn particles at player location
  const px = gameState.player.col * TILE_SIZE + TILE_SIZE / 2;
  const py = gameState.player.row * TILE_SIZE + TILE_SIZE / 2;
  spawnParticles(px, py, 8, '#ffd700');
  spawnTextParticle(px, py - 20, '+', '#ffd700');

  // Light screen shake on item pickup
  triggerScreenShake(3, 10);
  playSfx('item_pickup');
}

function hasItem(itemId) {
  return gameState.inventory.includes(itemId);
}

function removeItem(itemId) {
  const idx = gameState.inventory.indexOf(itemId);
  if (idx >= 0) {
    gameState.inventory.splice(idx, 1);
    renderInventory();
    saveGame();
  }
}

// Update quest tracking when cats are fed
function markCatFed(catName) {
  updateQuestCounter();
  updateQuestList();

  // Spawn heart particles at player location
  const px = gameState.player.col * TILE_SIZE + TILE_SIZE / 2;
  const py = gameState.player.row * TILE_SIZE + TILE_SIZE / 2;
  spawnParticles(px, py, 12, '#ff69b4');
  spawnTextParticle(px, py - 25, '❤️', '#ff1493');

  // Strong screen shake for cat fed celebration
  triggerScreenShake(5, 15);
  playSfx('cat_fed');
}

const ITEM_DISPLAY = {
  purrpops: { icon: '\uD83C\uDF6A', name: 'Purrpops' },
  feast_plate: { icon: '\uD83C\uDF7D\uFE0F', name: 'Shrimp & Salmon Feast' },
  basement_key: { icon: '\uD83D\uDD11', name: 'Basement Key' },
  laundry_basket: { icon: '\uD83E\uDDFA', name: 'Laundry Basket' }
};

function renderInventory() {
  const bar = document.getElementById('inventory-bar');
  bar.innerHTML = '';
  gameState.inventory.forEach(id => {
    const info = ITEM_DISPLAY[id] || { icon: '?', name: id };
    const el = document.createElement('div');
    el.className = 'inv-item';
    el.innerHTML = '<span class="inv-icon">' + info.icon + '</span> ' + info.name;
    bar.appendChild(el);
  });
}

// ======================== FLOOR MANAGEMENT ========================

function getCurrentFloor() {
  return FLOORS[gameState.currentFloor];
}

function changeFloor(newFloor) {
  var overlay = document.getElementById('transition-overlay');
  var label = document.getElementById('transition-label');
  var floorNames = {
    outside: 'Front Entry',
    main: 'Main Floor',
    basement: 'Basement',
    upstairs: 'Upstairs'
  };

  label.textContent = floorNames[newFloor] || newFloor;
  overlay.classList.add('active');

  setTimeout(function () {
    // Switch floor while screen is black
    gameState.currentFloor = newFloor;
    var floor = FLOORS[newFloor];
    gameState.player.row = floor.start.row;
    gameState.player.col = floor.start.col;
    gameState.player.facing = 'down';
    updateFloorLabel();
    saveGame();
    startMusic(newFloor);

    // Fade back in
    setTimeout(function () {
      overlay.classList.remove('active');
    }, 400);
  }, 350);
}

// Change floor with custom spawn position (used by stair returns)
function changeFloorTo(newFloor, row, col, facing) {
  var overlay = document.getElementById('transition-overlay');
  var label = document.getElementById('transition-label');
  var floorNames = {
    outside: 'Front Entry',
    main: 'Main Floor',
    basement: 'Basement',
    upstairs: 'Upstairs'
  };

  label.textContent = floorNames[newFloor] || newFloor;
  overlay.classList.add('active');

  setTimeout(function () {
    gameState.currentFloor = newFloor;
    gameState.player.row = row;
    gameState.player.col = col;
    gameState.player.facing = facing || 'down';
    updateFloorLabel();
    saveGame();
    startMusic(newFloor);

    setTimeout(function () {
      overlay.classList.remove('active');
    }, 400);
  }, 350);
}

function updateFloorLabel() {
  document.getElementById('floor-label').textContent = getCurrentFloor().name;
}

// ======================== COLLISION & MOVEMENT ========================

function isTileBlocked(floor, row, col) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
  const tile = floor.grid[row][col];
  if (tile === T.WALL || tile === T.FURNITURE || tile === T.COUNTER) return true;

  // Check if an interactable blocks this tile (cats, etc.)
  for (const obj of floor.interactables) {
    if (obj.row === row && obj.col === col) return true;
  }

  return false;
}

function getFacingTile() {
  const p = gameState.player;
  let tr = p.row, tc = p.col;
  switch (p.facing) {
    case 'up': tr--; break;
    case 'down': tr++; break;
    case 'left': tc--; break;
    case 'right': tc++; break;
  }
  return { row: tr, col: tc };
}

function getInteractableAt(row, col) {
  const floor = getCurrentFloor();
  for (const obj of floor.interactables) {
    if (obj.row === row && obj.col === col) return obj;
  }
  return null;
}

function getCatPosition(catName) {
  const floor = getCurrentFloor();
  for (const obj of floor.interactables) {
    if (obj.type === 'cat_' + catName) return obj;
  }
  return null;
}

function tryMove(dir) {
  if (gameState.moving || dialogueActive) return;
  markPlayerActivity();

  const p = gameState.player;
  p.facing = dir;

  let nr = p.row, nc = p.col;
  switch (dir) {
    case 'up': nr--; break;
    case 'down': nr++; break;
    case 'left': nc--; break;
    case 'right': nc++; break;
  }

  const floor = getCurrentFloor();

  // Check stair transitions
  if (floor.grid[nr] && floor.grid[nr][nc] === T.STAIRS) {
    if (handleStairTransition(nr, nc)) return;
  }

  if (isTileBlocked(floor, nr, nc)) return;

  // Start smooth movement
  gameState.moving = true;
  gameState.moveFrom = { row: p.row, col: p.col };
  gameState.moveTo = { row: nr, col: nc };
  gameState.moveProgress = 0;
  playSfx('footstep');
  checkHideControlsHint();
}

function handleStairTransition(row, col) {
  const floorId = gameState.currentFloor;

  if (floorId === 'main') {
    // Check if stepping on upstairs stairs
    const s = FLOORS.main.stairs.toUpstairs;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      if (!gameState.flags.laundry_cleared) {
        if (hasItem('laundry_basket')) {
          // Player walked into the laundry pile while carrying the basket — clear it
          removeItem('laundry_basket');
          gameState.flags.laundry_cleared = true;
          startDialogue('laundry_pile_clear', null, function () {
            triggerScreenShake(4, 12);
            showToast('Stairway cleared!');
            saveGameImmediate();
            changeFloor('upstairs');
          });
        } else {
          startDialogue('laundry_pile_blocked', null, null);
        }
        return true;
      }
      changeFloor('upstairs');
      return true;
    }
  } else if (floorId === 'basement') {
    const s = FLOORS.basement.stairs.toMain;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      // Return to main floor, place near basement door
      changeFloorTo('main', 7, 17, 'left');
      return true;
    }
  } else if (floorId === 'upstairs') {
    const s = FLOORS.upstairs.stairs.toMain;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      // Return to main floor, place near central stairs
      changeFloorTo('main', 8, 10, 'down');
      return true;
    }
  }

  return false;
}

function updateMovement() {
  if (!gameState.moving) return;

  gameState.moveProgress += MOVE_SPEED;
  if (gameState.moveProgress >= TILE_SIZE) {
    gameState.player.row = gameState.moveTo.row;
    gameState.player.col = gameState.moveTo.col;
    gameState.moving = false;
    gameState.moveProgress = 0;
    gameState.moveFrom = null;
    gameState.moveTo = null;
    saveGame();
  }
}

// ======================== INTERACTION SYSTEM ========================

function tryInteract() {
  markPlayerActivity();
  if (dialogueActive) {
    advanceDialogue();
    return;
  }
  if (gameState.moving) return;

  const facing = getFacingTile();
  const obj = getInteractableAt(facing.row, facing.col);

  if (obj) {
    playSfx('interact');
    handleInteraction(obj);
  }
}

function handleInteraction(obj) {
  switch (obj.type) {

    // ---- CUPBOARDS ----
    case 'fridge':
      startDialogue('fridge', null, null);
      break;
    case 'riddle_board':
      startDialogue('outside_riddle_board', null, null);
      break;
    case 'front_door':
      if (gameState.flags.front_door_unlocked) {
        changeFloor('main');
        break;
      }
      startDialogue('front_door_locked', null, function () {
        showNumpad(function (code) {
          if (code === '3134') {
            gameState.flags.front_door_unlocked = true;
            triggerScreenShake(4, 12);
            playSfx('door_unlock');
            showToast('Front door unlocked!');
            changeFloor('main');
          } else {
            playSfx('error');
            showToast('Incorrect code. Hint: the code is in the house plaque.');
          }
        });
      });
      break;
    case 'stove':
      startDialogue('stove', null, null);
      break;
    case 'kitchen_sink':
      startDialogue('kitchen_sink', null, null);
      break;
    case 'coffee_station':
      startDialogue('coffee_station', null, null);
      break;
    case 'dining_table':
      startDialogue('dining_table', null, null);
      break;
    case 'cupboard_empty':
      startDialogue('cupboard_empty', null, null);
      break;

    case 'cupboard_purrpops':
      // Cupboard is empty once both cats that need purrpops have been fed,
      // or if the player is already carrying purrpops
      if (gameState.flags.alice_fed && gameState.flags.olive_fed) {
        startDialogue('cupboard_empty', null, null);
      } else if (hasItem('purrpops')) {
        startDialogue('cupboard_empty', null, null);
      } else {
        startDialogue('cupboard_purrpops', null, function () {
          addItem('purrpops');
          showToast('Got Purrpops!');
        });
      }
      break;

    case 'cupboard_feast':
      // Cupboard is empty once Beatrice has been fed, or if already carrying the plate
      if (gameState.flags.beatrice_fed || hasItem('feast_plate')) {
        startDialogue('cupboard_empty', null, null);
      } else {
        startDialogue('cupboard_feast', null, function () {
          addItem('feast_plate');
          showToast('Got Shrimp & Salmon Feast plate!');
        });
      }
      break;

    // ---- ALICE ----
    case 'cat_alice':
      if (gameState.flags.alice_fed) {
        startDialogue('alice_done', 'alice', null);
      } else if (hasItem('feast_plate') && !hasItem('purrpops')) {
        // Only has feast, offer wrong item
        startDialogue('alice_wrong_item', 'alice', null);
      } else if (hasItem('purrpops')) {
        // Give purrpops to Alice
        removeItem('purrpops');
        gameState.flags.alice_fed = true;
        startDialogue('alice_after', 'alice', function () {
          showToast('Alice hints about the sofa!');
          markCatFed('alice');
          saveGameImmediate();
        });
      } else {
        startDialogue('alice_before', 'alice', null);
      }
      break;

    // ---- SOFA ----
    case 'sofa_blanket':
      if (gameState.flags.sofa_searched || gameState.flags.has_basement_key || !gameState.flags.alice_fed) {
        startDialogue('sofa_blanket_empty', null, null);
      } else {
        gameState.flags.sofa_searched = true;
        gameState.flags.has_basement_key = true;
        startDialogue('sofa_blanket', null, function () {
          addItem('basement_key');
          showToast('Got Basement Key!');
        });
      }
      break;

    // ---- BASEMENT DOOR ----
    case 'basement_door':
      if (gameState.flags.basement_unlocked) {
        changeFloor('basement');
      } else if (hasItem('basement_key')) {
        removeItem('basement_key');
        gameState.flags.basement_unlocked = true;
        startDialogue('basement_door_unlock', null, function () {
          triggerScreenShake(5, 15);
          playSfx('door_unlock');
          showToast('Basement unlocked!');
          changeFloor('basement');
        });
      } else {
        startDialogue('basement_door_locked', null, null);
      }
      break;

    // ---- OLIVE ----
    case 'cat_olive':
      if (gameState.flags.olive_fed) {
        startDialogue('olive_done', 'olive', null);
      } else if (hasItem('feast_plate') && !hasItem('purrpops')) {
        startDialogue('olive_wrong_item', 'olive', null);
      } else if (hasItem('purrpops')) {
        removeItem('purrpops');
        gameState.flags.olive_fed = true;
        startDialogue('olive_after', 'olive', function () {
          addItem('laundry_basket');
          gameState.flags.has_laundry_basket = true;
          showToast('Got Laundry Basket!');
          markCatFed('olive');
          saveGameImmediate();
        });
      } else {
        startDialogue('olive_before', 'olive', null);
      }
      break;

    // ---- BEATRICE ----
    case 'cat_beatrice':
      if (gameState.flags.beatrice_fed) {
        showEnding();
      } else if (hasItem('purrpops') && !hasItem('feast_plate')) {
        startDialogue('beatrice_wrong_item', 'beatrice', null);
      } else if (hasItem('feast_plate')) {
        removeItem('feast_plate');
        gameState.flags.beatrice_fed = true;
        gameState.flags.game_complete = true;
        startDialogue('beatrice_after', 'beatrice', function () {
          markCatFed('beatrice');
          saveGameImmediate();
          showEnding();
        });
      } else {
        startDialogue('beatrice_before', 'beatrice', null);
      }
      break;

    // ---- SLIDING DOOR ----
    case 'sliding_door':
      startDialogue('sliding_door', null, null);
      break;

    // ---- LIVING ROOM ----
    case 'tv':
      startDialogue('tv', null, null);
      break;
    case 'floor_lamp':
      startDialogue('floor_lamp', null, null);
      break;
    case 'coffee_table':
      startDialogue('coffee_table', null, null);
      break;
    case 'bookshelf':
      startDialogue('bookshelf', null, null);
      break;

    // ---- FUTON ----
    case 'futon':
      startDialogue('futon', null, null);
      break;

    // ---- NEW MAIN FLOOR INTERACTABLES ----
    case 'microwave':
      startDialogue('microwave', null, null);
      break;
    case 'trash_can':
      startDialogue('trash_can', null, null);
      break;
    case 'spice_rack':
      startDialogue('spice_rack', null, null);
      break;
    case 'china_cabinet':
      startDialogue('china_cabinet', null, null);
      break;
    case 'plant':
      startDialogue('plant', null, null);
      break;
    case 'game_console':
      startDialogue('game_console', null, null);
      break;
    case 'side_table':
      startDialogue('side_table', null, null);
      break;
    case 'reading_chair':
      startDialogue('reading_chair', null, null);
      break;
    case 'bathroom_mirror':
      startDialogue('bathroom_mirror', null, null);
      break;
    case 'towel_rack':
      startDialogue('towel_rack', null, null);
      break;
    case 'rug':
      startDialogue('rug', null, null);
      break;
    case 'wall_art':
      startDialogue('wall_art', null, null);
      break;
    case 'coat_rack':
      startDialogue('coat_rack', null, null);
      break;

    // ---- NEW BASEMENT INTERACTABLES ----
    case 'weights':
      startDialogue('weights', null, null);
      break;
    case 'exercise_bike':
      startDialogue('exercise_bike', null, null);
      break;
    case 'yoga_mat':
      startDialogue('yoga_mat', null, null);
      break;
    case 'storage_box':
      startDialogue('storage_box', null, null);
      break;
    case 'washer':
      startDialogue('washer', null, null);
      break;
    case 'dryer':
      startDialogue('dryer', null, null);
      break;
    case 'laundry_basket_storage':
      startDialogue('laundry_basket_storage', null, null);
      break;
    case 'cleaning_supplies':
      startDialogue('cleaning_supplies', null, null);
      break;
    case 'pool_table':
      startDialogue('pool_table', null, null);
      break;
    case 'mini_fridge':
      startDialogue('mini_fridge', null, null);
      break;
    case 'gaming_setup':
      startDialogue('gaming_setup', null, null);
      break;
    case 'bath_mat':
      startDialogue('bath_mat', null, null);
      break;
    case 'bathroom_cabinet':
      startDialogue('bathroom_cabinet', null, null);
      break;
    case 'tool_bench':
      startDialogue('tool_bench', null, null);
      break;
    case 'water_heater':
      startDialogue('water_heater', null, null);
      break;
    case 'bookshelf_basement':
      startDialogue('bookshelf_basement', null, null);
      break;

    // ---- NEW UPSTAIRS INTERACTABLES ----
    case 'nightstand':
      startDialogue('nightstand', null, null);
      break;
    case 'dresser':
      startDialogue('dresser', null, null);
      break;
    case 'guest_dresser':
      startDialogue('guest_dresser', null, null);
      break;
    case 'jewelry_box':
      startDialogue('jewelry_box', null, null);
      break;
    case 'wardrobe':
      startDialogue('wardrobe', null, null);
      break;
    case 'bedside_lamp':
      startDialogue('bedside_lamp', null, null);
      break;
    case 'reading_nook':
      startDialogue('reading_nook', null, null);
      break;
    case 'filing_cabinet':
      startDialogue('filing_cabinet', null, null);
      break;
    case 'office_chair':
      startDialogue('office_chair', null, null);
      break;
    case 'printer':
      startDialogue('printer', null, null);
      break;
    case 'bookcase':
      startDialogue('bookcase', null, null);
      break;
    case 'bathroom_scale':
      startDialogue('bathroom_scale', null, null);
      break;
    case 'medicine_cabinet':
      startDialogue('medicine_cabinet', null, null);
      break;
    case 'towel_warmer':
      startDialogue('towel_warmer', null, null);
      break;
    case 'hallway_table':
      startDialogue('hallway_table', null, null);
      break;
    case 'plant_hallway':
      startDialogue('plant_hallway', null, null);
      break;
    case 'family_photos':
      startDialogue('family_photos', null, null);
      break;
    case 'coat_hooks':
      startDialogue('coat_hooks', null, null);
      break;
    case 'ceiling_fan':
      startDialogue('ceiling_fan', null, null);
      break;
    case 'linen_closet':
      startDialogue('linen_closet', null, null);
      break;

    // ---- CAT TOYS (collectibles) ----
    case 'cat_toy':
      if (gameState.flags.cat_toys_found && gameState.flags.cat_toys_found.includes(obj.toyId)) {
        startDialogue('cat_toy_found', null, null);
      } else {
        if (!gameState.flags.cat_toys_found) gameState.flags.cat_toys_found = [];
        gameState.flags.cat_toys_found.push(obj.toyId);
        var toyNames = { jingle_ball: 'Jingle Ball', feather_wand: 'Feather Wand', laser_pointer: 'Laser Pointer' };
        var toyName = toyNames[obj.toyId] || 'Cat Toy';
        var total = gameState.flags.cat_toys_found.length;
        startDialogue('cat_toy_' + obj.toyId, null, function () {
          showToast('Found ' + toyName + '! (' + total + '/3 cat toys)');
          triggerScreenShake(3, 10);
          var px = gameState.player.col * TILE_SIZE + TILE_SIZE / 2;
          var py = gameState.player.row * TILE_SIZE + TILE_SIZE / 2;
          spawnParticles(px, py, 10, '#ff69b4');
          spawnTextParticle(px, py - 20, '🐾', '#ff69b4');
          playSfx('item_pickup');
          saveGameImmediate();
        });
      }
      break;

    // ---- OUTSIDE INTERACTABLES ----
    case 'welcome_mat':
      startDialogue('welcome_mat', null, null);
      break;
    case 'porch_light':
      startDialogue('porch_light', null, null);
      break;
    case 'flower_bed':
      startDialogue('flower_bed', null, null);
      break;
    case 'bird_bath':
      startDialogue('bird_bath', null, null);
      break;
    case 'mailbox':
      startDialogue('mailbox', null, null);
      break;
    case 'garden_gnome':
      startDialogue('garden_gnome', null, null);
      break;
    case 'garden_bench':
      startDialogue('garden_bench', null, null);
      break;
  }
}

// Check stair-step for laundry clearing (when player tries to go upstairs)
function checkLaundryInteraction() {
  if (gameState.currentFloor !== 'main') return false;
  if (gameState.flags.laundry_cleared) return false;

  const p = gameState.player;
  const s = FLOORS.main.stairs.toUpstairs;

  // Check if adjacent to stairs and facing them
  const facing = getFacingTile();
  if (s.rows.includes(facing.row) && s.cols.includes(facing.col)) {
    if (hasItem('laundry_basket')) {
      removeItem('laundry_basket');
      gameState.flags.laundry_cleared = true;
      startDialogue('laundry_pile_clear', null, function () {
        showToast('Stairway cleared!');
        saveGame();
      });
      return true;
    }
  }
  return false;
}

// ======================== INTERACT PROMPT ========================

function updateInteractPrompt() {
  const prompt = document.getElementById('interact-prompt');
  if (dialogueActive || gameState.moving) {
    prompt.classList.remove('visible');
    // Keep mobile interact button enabled during dialogue so users can tap to advance
    if (dialogueActive) {
      document.getElementById('btn-interact').disabled = false;
    }
    return;
  }

  const facing = getFacingTile();
  const obj = getInteractableAt(facing.row, facing.col);

  // Also check stairs for laundry interaction
  const floor = getCurrentFloor();
  let isStairInteract = false;
  if (gameState.currentFloor === 'main' && !gameState.flags.laundry_cleared) {
    const s = FLOORS.main.stairs.toUpstairs;
    if (s.rows.includes(facing.row) && s.cols.includes(facing.col)) {
      isStairInteract = true;
    }
  }

  if (obj || isStairInteract) {
    const label = obj ? obj.label : 'Stairs';
    prompt.textContent = 'E: ' + label;
    prompt.classList.add('visible');

    // Enable interact button
    document.getElementById('btn-interact').disabled = false;
  } else {
    prompt.classList.remove('visible');
    document.getElementById('btn-interact').disabled = true;
  }
}

// ======================== RENDERING ========================

// Sprite drawing functions (simple pixel art using canvas primitives)
const SPRITES = {
  // Player (Marice) - animated character
  player: function (x, y, facing, isMoving) {
    // Walking bob offset
    var bobY = 0;
    if (isMoving) {
      bobY = (walkFrame % 2 === 0) ? -1 : 1;
    }
    var by = y + bobY;

    // Body
    ctx.fillStyle = '#ff9ecf'; // pink
    ctx.fillRect(x + 6, by + 4, 12, 14);
    // Head
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(x + 7, by + 1, 10, 8);
    // Hair
    ctx.fillStyle = '#5c3317';
    ctx.fillRect(x + 6, by, 12, 4);
    // Eyes (based on facing)
    ctx.fillStyle = '#333';
    if (facing === 'down') {
      ctx.fillRect(x + 9, by + 4, 2, 2);
      ctx.fillRect(x + 13, by + 4, 2, 2);
    } else if (facing === 'up') {
      // Back of head, show hair
      ctx.fillStyle = '#5c3317';
      ctx.fillRect(x + 7, by + 1, 10, 7);
    } else if (facing === 'left') {
      ctx.fillRect(x + 8, by + 4, 2, 2);
    } else {
      ctx.fillRect(x + 14, by + 4, 2, 2);
    }

    // Feet — animated walk cycle
    ctx.fillStyle = '#6b4226';
    if (isMoving) {
      if (facing === 'left' || facing === 'right') {
        // Side view: stride forward/back
        var stride = (walkFrame % 2 === 0) ? -2 : 2;
        ctx.fillRect(x + 8 + stride, y + 18, 4, 3);
        ctx.fillRect(x + 12 - stride, y + 18, 4, 3);
      } else {
        // Front/back view: feet apart then together
        var spread = (walkFrame % 2 === 0) ? 2 : 0;
        ctx.fillRect(x + 7 - spread, y + 18, 4, 3);
        ctx.fillRect(x + 13 + spread, y + 18, 4, 3);
      }
    } else {
      // Standing still — feet centered
      ctx.fillRect(x + 7, y + 18, 4, 3);
      ctx.fillRect(x + 13, y + 18, 4, 3);
    }
  },

  // Cat sprite (generic, colored per cat) — with idle animations
  cat: function (x, y, color, accentColor) {
    // Idle animation state
    var blinkCycle = animTimer % 180; // blink every ~3 seconds at 60fps
    var isBlinking = blinkCycle > 170;
    var tailPhase = Math.sin(animTimer * 0.08);
    var earFlick = (animTimer % 240) > 230;
    var breathe = Math.sin(animTimer * 0.04) * 0.5;

    // Shadow under cat for depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x + 5, y + 19, 15, 2);

    // Body (loaf shape) — subtle breathing
    var bodyY = y + Math.round(breathe);
    var earOffset = earFlick ? -1 : 0;

    // Dark outline so cats stand out against any floor colour
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x + 6, bodyY + 1 + earOffset, 5, 4);   // left ear outline
    ctx.fillRect(x + 13, bodyY + 1 + earOffset, 5, 4);  // right ear outline
    ctx.fillRect(x + 5, bodyY + 2, 14, 10);             // head outline
    ctx.fillRect(x + 4, bodyY + 9, 16, 10);             // body outline

    ctx.fillStyle = color;
    ctx.fillRect(x + 5, bodyY + 10, 14, 8);
    ctx.fillRect(x + 6, bodyY + 9, 12, 1);
    ctx.fillRect(x + 7, bodyY + 8, 10, 1);

    // Chest/front (lighter)
    ctx.fillStyle = accentColor || '#ffb6c1';
    ctx.fillRect(x + 8, bodyY + 12, 8, 5);

    // Head (rounder)
    ctx.fillStyle = color;
    ctx.fillRect(x + 7, bodyY + 4, 10, 6);
    ctx.fillRect(x + 6, bodyY + 5, 12, 4);
    ctx.fillRect(x + 8, bodyY + 3, 8, 1);

    // Ears (triangular) — with occasional flick
    ctx.fillRect(x + 7, bodyY + 2 + earOffset, 3, 3);
    ctx.fillRect(x + 14, bodyY + 2 + earOffset, 3, 3);
    // Inner ears
    ctx.fillStyle = accentColor || '#ffb6c1';
    ctx.fillRect(x + 8, bodyY + 3 + earOffset, 1, 1);
    ctx.fillRect(x + 15, bodyY + 3 + earOffset, 1, 1);

    // Eyes — blink animation
    if (isBlinking) {
      // Closed eyes (lines)
      ctx.fillStyle = '#333';
      ctx.fillRect(x + 9, bodyY + 7, 2, 1);
      ctx.fillRect(x + 13, bodyY + 7, 2, 1);
    } else {
      // Open eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 9, bodyY + 6, 2, 2);
      ctx.fillRect(x + 13, bodyY + 6, 2, 2);
      // Pupils
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 10, bodyY + 7, 1, 1);
      ctx.fillRect(x + 14, bodyY + 7, 1, 1);
    }

    // Nose
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect(x + 11, bodyY + 8, 2, 1);

    // Mouth (cute smile)
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 11, bodyY + 9, 1, 1);
    ctx.fillRect(x + 12, bodyY + 9, 1, 1);

    // Whiskers
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 7, bodyY + 7);
    ctx.lineTo(x + 4, bodyY + 6);
    ctx.moveTo(x + 7, bodyY + 8);
    ctx.lineTo(x + 4, bodyY + 8);
    ctx.moveTo(x + 17, bodyY + 7);
    ctx.lineTo(x + 20, bodyY + 6);
    ctx.moveTo(x + 17, bodyY + 8);
    ctx.lineTo(x + 20, bodyY + 8);
    ctx.stroke();

    // Tail — animated swish
    var tailSwish = Math.round(tailPhase * 2);
    ctx.fillStyle = color;
    ctx.fillRect(x + 18, bodyY + 10, 3, 4);
    ctx.fillRect(x + 19 + tailSwish, bodyY + 8, 2, 2);
    ctx.fillRect(x + 20 + tailSwish, bodyY + 7, 1, 1);

    // Front paws (visible)
    ctx.fillStyle = color;
    ctx.fillRect(x + 7, y + 17, 2, 2);
    ctx.fillRect(x + 15, y + 17, 2, 2);
  },

  // Cupboard
  cupboard: function (x, y, variant) {
    ctx.fillStyle = '#9b7a55';
    ctx.fillRect(x + 1, y + 1, 22, 22);
    ctx.fillStyle = '#7c5b36';
    ctx.fillRect(x + 2, y + 3, 20, 18);
    ctx.fillStyle = '#b08c63';
    ctx.fillRect(x + 3, y + 4, 18, 16);
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 5, 7, 14);
    ctx.strokeRect(x + 13, y + 5, 7, 14);
    // Handles
    ctx.fillStyle = '#ffe6a7';
    ctx.fillRect(x + 9, y + 10, 2, 3);
    ctx.fillRect(x + 13, y + 10, 2, 3);
    // Top shine
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 2, y + 2, 20, 3);

    if (variant === 'treat' || variant === 'feast') {
      const accent = variant === 'treat' ? '#7fff7f' : '#ff9ecf';
      ctx.fillStyle = accent;
      ctx.fillRect(x + 5, y + 3, 14, 2);
      // Paw/plate hint
      ctx.fillRect(x + 10, y + 7, 2, 2);
      ctx.fillRect(x + 9, y + 9, 4, 2);
      ctx.fillRect(x + 10, y + 11, 2, 2);
    }
  },

  // Sofa
  sofa: function (x, y) {
    // Shadow base
    ctx.fillStyle = '#251912';
    ctx.fillRect(x + 2, y + 19, 20, 4);
    // Frame
    ctx.fillStyle = '#3b2a21';
    ctx.fillRect(x + 1, y + 7, 22, 14);
    // Back cushion
    ctx.fillStyle = '#c48f6b';
    ctx.fillRect(x + 3, y + 5, 18, 8);
    ctx.fillStyle = '#ad7957';
    ctx.fillRect(x + 3, y + 6, 18, 6);
    // Seat cushions
    ctx.fillStyle = '#d19c79';
    ctx.fillRect(x + 3, y + 12, 18, 8);
    ctx.fillStyle = '#c18a6a';
    ctx.fillRect(x + 3, y + 13, 18, 3);
    // Divider seam + stitch
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(x + 13, y + 12);
    ctx.lineTo(x + 13, y + 20);
    ctx.moveTo(x + 5, y + 16);
    ctx.lineTo(x + 19, y + 16);
    ctx.stroke();
    // Armrests
    ctx.fillStyle = '#8b5f45';
    ctx.fillRect(x + 1, y + 8, 5, 12);
    ctx.fillRect(x + 18, y + 8, 5, 12);
    ctx.fillStyle = '#744c38';
    ctx.fillRect(x + 2, y + 9, 3, 10);
    ctx.fillRect(x + 19, y + 9, 3, 10);
    // Cushy highlight
    ctx.fillStyle = 'rgba(255, 230, 210, 0.25)';
    ctx.fillRect(x + 4, y + 6, 16, 2);
    ctx.fillRect(x + 4, y + 14, 16, 1);
    // Legs
    ctx.fillStyle = '#2a1812';
    ctx.fillRect(x + 5, y + 21, 3, 3);
    ctx.fillRect(x + 16, y + 21, 3, 3);
  },

  // Wide 3-seat sofa (spans 3 tiles = 72px wide)
  sofaWide: function (x, y) {
    const W = TILE_SIZE * 3;
    // Shadow base
    ctx.fillStyle = '#251912';
    ctx.fillRect(x + 2, y + 19, W - 4, 4);
    // Main frame
    ctx.fillStyle = '#3b2a21';
    ctx.fillRect(x + 1, y + 7, W - 2, 14);
    // Back cushion
    ctx.fillStyle = '#c48f6b';
    ctx.fillRect(x + 3, y + 5, W - 6, 8);
    ctx.fillStyle = '#ad7957';
    ctx.fillRect(x + 3, y + 6, W - 6, 6);
    // Seat cushions (3 cushions)
    ctx.fillStyle = '#d19c79';
    ctx.fillRect(x + 3, y + 12, W - 6, 8);
    ctx.fillStyle = '#c18a6a';
    ctx.fillRect(x + 3, y + 13, W - 6, 3);
    // Cushion dividers (two vertical seams separating the 3 seat cushions)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE, y + 12);    // y+12 = seat cushion top
    ctx.lineTo(x + TILE_SIZE, y + 20);
    ctx.moveTo(x + TILE_SIZE * 2, y + 12);
    ctx.lineTo(x + TILE_SIZE * 2, y + 20);
    ctx.moveTo(x + 5, y + 16);            // y+16 = horizontal stitch midline
    ctx.lineTo(x + W - 5, y + 16);
    ctx.stroke();
    // Armrests
    ctx.fillStyle = '#8b5f45';
    ctx.fillRect(x + 1, y + 8, 5, 12);
    ctx.fillRect(x + W - 6, y + 8, 5, 12);
    ctx.fillStyle = '#744c38';
    ctx.fillRect(x + 2, y + 9, 3, 10);
    ctx.fillRect(x + W - 5, y + 9, 3, 10);
    // Cushy highlight
    ctx.fillStyle = 'rgba(255,230,210,0.25)';
    ctx.fillRect(x + 4, y + 6, W - 8, 2);
    ctx.fillRect(x + 4, y + 14, W - 8, 1);
    // Legs
    ctx.fillStyle = '#2a1812';
    ctx.fillRect(x + 5, y + 21, 3, 3);
    ctx.fillRect(x + W - 8, y + 21, 3, 3);
  },

  // Armchair / reading chair
  armchair: function (x, y) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 3, y + 20, 18, 3);
    // Main frame
    ctx.fillStyle = '#5a3a28';
    ctx.fillRect(x + 2, y + 7, 20, 14);
    // Back cushion
    ctx.fillStyle = '#b87d5a';
    ctx.fillRect(x + 4, y + 4, 16, 10);
    ctx.fillStyle = '#a06a48';
    ctx.fillRect(x + 4, y + 5, 16, 8);
    // Seat cushion
    ctx.fillStyle = '#c88c68';
    ctx.fillRect(x + 4, y + 13, 16, 7);
    ctx.fillStyle = '#b07858';
    ctx.fillRect(x + 4, y + 14, 16, 3);
    // Armrests
    ctx.fillStyle = '#7a4f35';
    ctx.fillRect(x + 2, y + 8, 4, 11);
    ctx.fillRect(x + 18, y + 8, 4, 11);
    ctx.fillStyle = '#6a3f25';
    ctx.fillRect(x + 3, y + 9, 2, 9);
    ctx.fillRect(x + 19, y + 9, 2, 9);
    // Highlight
    ctx.fillStyle = 'rgba(255,220,190,0.2)';
    ctx.fillRect(x + 5, y + 5, 14, 2);
    // Legs
    ctx.fillStyle = '#2a1812';
    ctx.fillRect(x + 5, y + 21, 3, 2);
    ctx.fillRect(x + 16, y + 21, 3, 2);
  },

  fridge: function (x, y) {
    ctx.fillStyle = '#d8e2ec';
    ctx.fillRect(x + 2, y + 1, 20, 22);
    ctx.fillStyle = '#b7c7d6';
    ctx.fillRect(x + 2, y + 11, 20, 12);
    ctx.fillStyle = '#7a8a9a';
    ctx.fillRect(x + 17, y + 4, 2, 7);
    ctx.fillRect(x + 17, y + 14, 2, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 3, y + 3, 7, 1);
  },

  stove: function (x, y) {
    ctx.fillStyle = '#5d5d5d';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.fillStyle = '#777';
    ctx.fillRect(x + 3, y + 3, 18, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 6, y + 12, 12, 8);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(x + 6, y + 13, 12, 2);
    ctx.fillStyle = '#88c0ff';
    ctx.fillRect(x + 6, y + 16, 12, 2);
    // Burners
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(x + 5, y + 4, 4, 4);
    ctx.fillRect(x + 15, y + 4, 4, 4);
    ctx.fillRect(x + 5, y + 8, 4, 4);
    ctx.fillRect(x + 15, y + 8, 4, 4);
  },

  kitchenSink: function (x, y) {
    ctx.fillStyle = '#c49b72';
    ctx.fillRect(x + 1, y + 1, 22, 22);
    ctx.fillStyle = '#e7d8c4';
    ctx.fillRect(x + 3, y + 3, 18, 16);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 6, y + 6, 12, 10);
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(x + 11, y + 2, 3, 6);
  },

  coffeeStation: function (x, y) {
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(x + 3, y + 10, 18, 10);
    ctx.fillStyle = '#2f241b';
    ctx.fillRect(x + 5, y + 6, 14, 8);
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(x + 6, y + 7, 4, 6);
    ctx.fillStyle = '#d1b38a';
    ctx.fillRect(x + 12, y + 8, 6, 4);
    // Cup
    ctx.fillStyle = '#f5f1e8';
    ctx.fillRect(x + 8, y + 16, 6, 4);
    ctx.fillStyle = '#9e8362';
    ctx.fillRect(x + 9, y + 17, 4, 2);
  },

  diningTable: function (x, y) {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x + 1, y + 6, 22, 12);
    ctx.fillStyle = '#a06f3e';
    ctx.fillRect(x + 3, y + 8, 18, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x + 4, y + 9, 16, 2);
    // Placemats
    ctx.fillStyle = '#d7c4a1';
    ctx.fillRect(x + 4, y + 12, 6, 3);
    ctx.fillRect(x + 14, y + 12, 6, 3);
  },

  coffeeTable: function (x, y) {
    ctx.fillStyle = '#6f4c32';
    ctx.fillRect(x + 3, y + 10, 18, 6);
    ctx.fillStyle = '#8a6645';
    ctx.fillRect(x + 4, y + 11, 16, 3);
    ctx.fillStyle = '#3b281c';
    ctx.fillRect(x + 6, y + 15, 12, 2);
  },

  floorLamp: function (x, y) {
    ctx.fillStyle = '#d7c4a1';
    ctx.fillRect(x + 9, y + 2, 6, 6);
    ctx.fillRect(x + 10, y + 8, 4, 12);
    ctx.fillStyle = '#3b2a21';
    ctx.fillRect(x + 11, y + 20, 2, 3);
    ctx.fillRect(x + 7, y + 22, 10, 1);
  },

  tv: function (x, y) {
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 2, y + 2, 20, 14);
    ctx.fillStyle = '#2d8cff';
    ctx.fillRect(x + 4, y + 4, 16, 10);
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 10, y + 16, 4, 4);
  },

  bookshelf: function (x, y) {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.fillStyle = '#6d4220';
    ctx.fillRect(x + 3, y + 5, 18, 2);
    ctx.fillRect(x + 3, y + 11, 18, 2);
    ctx.fillRect(x + 3, y + 17, 18, 2);
    ctx.fillStyle = '#d97f6f';
    ctx.fillRect(x + 4, y + 7, 4, 6);
    ctx.fillStyle = '#6fc0d9';
    ctx.fillRect(x + 10, y + 7, 4, 10);
    ctx.fillStyle = '#f2d46f';
    ctx.fillRect(x + 16, y + 7, 3, 8);
  },

  // Door (basement)
  door: function (x, y, locked) {
    // Door frame
    ctx.fillStyle = '#e0d5c5';
    ctx.fillRect(x + 2, y, 20, TILE_SIZE);
    // Door body
    ctx.fillStyle = locked ? '#6b3a1f' : '#4a7c59';
    ctx.fillRect(x + 4, y + 1, 16, 22);
    // Panel detail (upper and lower panels)
    ctx.fillStyle = locked ? '#5a2f18' : '#3a6c49';
    ctx.fillRect(x + 6, y + 3, 12, 7);
    ctx.fillRect(x + 6, y + 13, 12, 8);
    // Panel inset shadows
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + 7, y + 4, 10, 5);
    ctx.fillRect(x + 7, y + 14, 10, 6);
    // Small window at top of door
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 8, y + 2, 8, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 8, y + 2, 3, 2);
    // Door handle
    ctx.fillStyle = locked ? '#b8860b' : '#ffd700';
    ctx.fillRect(x + 15, y + 12, 3, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 15, y + 12, 1, 1);
    // Lock indicator
    if (locked) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(x + 15, y + 15, 2, 2);
    }
    // Frame shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + 3, y, 1, TILE_SIZE);
    ctx.fillRect(x + 20, y, 1, TILE_SIZE);
  },

  // Sliding door
  slidingDoor: function (x, y) {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, 10, 20);
    ctx.strokeRect(x + 12, y + 2, 10, 20);
  },

  // Stairs
  stairs: function (x, y, hasLaundry) {
    // Side rails for depth
    ctx.fillStyle = '#5a3316';
    ctx.fillRect(x + 1, y + 2, 2, TILE_SIZE - 4);
    ctx.fillRect(x + TILE_SIZE - 3, y + 2, 2, TILE_SIZE - 4);

    // Stair steps with highlights
    const stepColors = ['#c07a42', '#ad6936', '#98572d', '#824726'];
    let offsetY = y + 3;
    for (let i = 0; i < stepColors.length; i++) {
      const inset = i * 2;
      const stepHeight = 5;
      const stepWidth = TILE_SIZE - 6 - inset * 2;
      const startX = x + 3 + inset;

      ctx.fillStyle = stepColors[i];
      ctx.fillRect(startX, offsetY, stepWidth, stepHeight);

      // Top lip highlight
      ctx.fillStyle = 'rgba(255, 230, 210, 0.25)';
      ctx.fillRect(startX, offsetY, stepWidth, 1);
      // Shadow at tread edge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(startX, offsetY + stepHeight - 1, stepWidth, 1);

      offsetY += stepHeight;
    }

    // Landing shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 2, y + TILE_SIZE - 5, TILE_SIZE - 4, 3);

    if (hasLaundry) {
      // Laundry pile on stairs
      ctx.fillStyle = '#ddd';
      ctx.fillRect(x + 5, y + 2, 14, 9);
      ctx.fillStyle = '#bbb';
      ctx.fillRect(x + 6, y + 6, 12, 8);
      ctx.fillStyle = '#e88';
      ctx.fillRect(x + 8, y + 4, 4, 4);
      ctx.fillStyle = '#88e';
      ctx.fillRect(x + 13, y + 6, 5, 4);
    } else {
      // Soft runner down the middle
      ctx.fillStyle = 'rgba(255, 219, 172, 0.25)';
      ctx.fillRect(x + 9, y + 3, 6, TILE_SIZE - 8);
    }
  },

  // Treadmill (for Olive)
  treadmill: function (x, y) {
    ctx.fillStyle = '#555';
    ctx.fillRect(x + 2, y + 10, 20, 8);
    ctx.fillStyle = '#777';
    ctx.fillRect(x + 4, y + 12, 16, 4);
    // Handle bars
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 3, y + 2, 2, 10);
    ctx.fillRect(x + 19, y + 2, 2, 10);
    ctx.fillRect(x + 3, y + 2, 18, 2);
  },

  // Futon
  futon: function (x, y) {
    ctx.fillStyle = '#4a6741';
    ctx.fillRect(x + 1, y + 6, 22, 14);
    ctx.fillStyle = '#5a7751';
    ctx.fillRect(x + 3, y + 8, 18, 10);
  },

  // Furniture (generic blocked)
  furniture: function (x, y) {
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 3, y + 3, 18, 18);
    ctx.fillStyle = '#7a5c10';
    ctx.fillRect(x + 5, y + 5, 14, 14);
  },

  // Cat tree (for Alice's position indicator)
  catTree: function (x, y) {
    // Post
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 10, y + 8, 4, 14);
    // Platform
    ctx.fillStyle = '#a08060';
    ctx.fillRect(x + 4, y + 6, 16, 4);
    // Top platform
    ctx.fillStyle = '#a08060';
    ctx.fillRect(x + 6, y + 1, 12, 3);
  },

  // Bed
  bed: function (x, y, withBlanket) {
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 1, y + 2, 22, 20);
    ctx.fillStyle = '#f5f5dc';
    ctx.fillRect(x + 3, y + 4, 18, 14);
    // Pillow
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 5, y + 4, 14, 4);
    if (withBlanket) {
      ctx.fillStyle = '#6b5b95';
      ctx.fillRect(x + 3, y + 10, 18, 8);
    }
  },

  // Toilet
  toilet: function (x, y) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y + 6, 12, 14);
    ctx.fillStyle = '#eee';
    ctx.fillRect(x + 7, y + 3, 10, 5);
  },

  // Sink
  sink: function (x, y) {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(x + 4, y + 8, 16, 10);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 6, y + 10, 12, 6);
    // Faucet
    ctx.fillStyle = '#999';
    ctx.fillRect(x + 10, y + 4, 4, 6);
  },

  // Desk
  desk: function (x, y) {
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + 2, y + 6, 20, 14);
    ctx.fillStyle = '#7a6345';
    ctx.fillRect(x + 4, y + 8, 16, 10);
    // Monitor
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 7, y + 2, 10, 7);
    ctx.fillStyle = '#4488ff';
    ctx.fillRect(x + 8, y + 3, 8, 5);
  },

  // Shower/Tub
  shower: function (x, y) {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 4, y + 4, 16, 16);
    // Showerhead
    ctx.fillStyle = '#999';
    ctx.fillRect(x + 10, y + 1, 4, 3);
  },

  // Microwave
  microwave: function (x, y) {
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(x + 2, y + 6, 20, 14);
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 4, y + 8, 12, 10);
    ctx.fillStyle = '#1a3a2a';
    ctx.fillRect(x + 5, y + 9, 10, 8);
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 17, y + 10, 2, 6);
    ctx.fillStyle = '#7fff7f';
    ctx.fillRect(x + 18, y + 9, 1, 1);
  },

  // Trash can
  trashCan: function (x, y) {
    ctx.fillStyle = '#555';
    ctx.fillRect(x + 6, y + 6, 12, 14);
    ctx.fillStyle = '#666';
    ctx.fillRect(x + 5, y + 5, 14, 3);
    ctx.fillStyle = '#777';
    ctx.fillRect(x + 7, y + 3, 10, 3);
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 10, y + 2, 4, 2);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + 7, y + 11, 10, 1);
    ctx.fillRect(x + 7, y + 15, 10, 1);
  },

  // Potted plant
  plant: function (x, y) {
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(x + 7, y + 14, 10, 8);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(x + 6, y + 13, 12, 3);
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x + 8, y + 14, 8, 2);
    ctx.fillStyle = '#228b22';
    ctx.fillRect(x + 8, y + 6, 8, 8);
    ctx.fillRect(x + 6, y + 8, 12, 4);
    ctx.fillStyle = '#32cd32';
    ctx.fillRect(x + 9, y + 4, 6, 4);
    ctx.fillRect(x + 10, y + 2, 4, 3);
  },

  // Washer
  washer: function (x, y) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(x + 3, y + 3, 18, 4);
    ctx.fillStyle = '#87ceeb';
    ctx.beginPath();
    ctx.arc(x + 12, y + 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6ab7d9';
    ctx.beginPath();
    ctx.arc(x + 12, y + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#999';
    ctx.fillRect(x + 5, y + 4, 2, 2);
    ctx.fillRect(x + 9, y + 4, 2, 2);
  },

  // Dryer
  dryer: function (x, y) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(x + 3, y + 3, 18, 4);
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(x + 12, y + 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(x + 12, y + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6347';
    ctx.fillRect(x + 15, y + 4, 2, 2);
  },

  // Pool table
  poolTable: function (x, y) {
    ctx.fillStyle = '#5c3317';
    ctx.fillRect(x + 3, y + 19, 3, 4);
    ctx.fillRect(x + 18, y + 19, 3, 4);
    ctx.fillStyle = '#654321';
    ctx.fillRect(x + 2, y + 5, 20, 16);
    ctx.fillStyle = '#228b22';
    ctx.fillRect(x + 4, y + 7, 16, 12);
    ctx.fillStyle = '#4a7c3a';
    ctx.fillRect(x + 4, y + 7, 16, 1);
    ctx.fillRect(x + 4, y + 18, 16, 1);
    ctx.fillRect(x + 4, y + 7, 1, 12);
    ctx.fillRect(x + 19, y + 7, 1, 12);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8, y + 12, 2, 2);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x + 13, y + 10, 2, 2);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(x + 15, y + 14, 2, 2);
  },

  // Gaming setup
  gamingSetup: function (x, y) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 2, y + 12, 20, 10);
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 5, y + 2, 14, 11);
    ctx.fillStyle = '#9b59b6';
    ctx.fillRect(x + 6, y + 3, 12, 9);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 10, y + 13, 4, 2);
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 5, y + 16, 14, 4);
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(x + 6, y + 17, 3, 1);
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(x + 11, y + 17, 3, 1);
  },

  // Exercise bike
  exerciseBike: function (x, y) {
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 4, y + 18, 16, 4);
    ctx.fillStyle = '#ff4500';
    ctx.fillRect(x + 10, y + 6, 3, 14);
    ctx.fillStyle = '#555';
    ctx.fillRect(x + 6, y + 4, 12, 3);
    ctx.fillRect(x + 6, y + 4, 2, 5);
    ctx.fillRect(x + 16, y + 4, 2, 5);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 8, y + 8, 8, 3);
    ctx.fillStyle = '#666';
    ctx.fillRect(x + 7, y + 16, 6, 4);
  },

  // Weights / dumbbells
  weights: function (x, y) {
    ctx.fillStyle = '#555';
    ctx.fillRect(x + 3, y + 4, 2, 18);
    ctx.fillRect(x + 19, y + 4, 2, 18);
    ctx.fillRect(x + 3, y + 4, 18, 2);
    ctx.fillStyle = '#708090';
    ctx.fillRect(x + 6, y + 8, 4, 4);
    ctx.fillRect(x + 14, y + 8, 4, 4);
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 9, y + 9, 6, 2);
    ctx.fillStyle = '#708090';
    ctx.fillRect(x + 6, y + 15, 4, 4);
    ctx.fillRect(x + 14, y + 15, 4, 4);
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 9, y + 16, 6, 2);
  },

  // Riddle / notice board
  riddleBoard: function (x, y) {
    ctx.fillStyle = '#5c3317';
    ctx.fillRect(x + 10, y + 12, 4, 10);
    ctx.fillStyle = '#c79c4c';
    ctx.fillRect(x + 3, y + 2, 18, 12);
    ctx.fillStyle = '#a07830';
    ctx.fillRect(x + 4, y + 3, 16, 10);
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(x + 6, y + 4, 12, 8);
    ctx.fillStyle = '#555';
    ctx.fillRect(x + 7, y + 5, 10, 1);
    ctx.fillRect(x + 7, y + 7, 8, 1);
    ctx.fillRect(x + 7, y + 9, 9, 1);
  },

  // Mirror
  mirror: function (x, y) {
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(x + 5, y + 2, 14, 18);
    ctx.fillStyle = '#add8e6';
    ctx.fillRect(x + 6, y + 3, 12, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 7, y + 4, 4, 8);
  },

  // Wall art / painting
  wallArt: function (x, y) {
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(x + 4, y + 3, 16, 14);
    ctx.fillStyle = '#2a1f14';
    ctx.fillRect(x + 5, y + 4, 14, 12);
    ctx.fillStyle = '#4a8fc7';
    ctx.fillRect(x + 6, y + 5, 12, 5);
    ctx.fillStyle = '#228b22';
    ctx.fillRect(x + 6, y + 10, 12, 5);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(x + 14, y + 6, 3, 3);
  },

  // Generic item renderer (fallback)
  genericItem: function (x, y, color1, color2) {
    ctx.fillStyle = color1;
    ctx.fillRect(x + 4, y + 4, 16, 16);
    ctx.fillStyle = color2;
    ctx.fillRect(x + 6, y + 6, 12, 12);
  }
};

// ============ OUTSIDE TILE RENDERING ============

// Deterministic hash for tile-position-based consistent pseudo-randomness
function tileSeed(r, c, s) {
  var n = r * 73 + c * 137 + (s || 0) * 53 + 7;
  n = ((n + 0x6D2B79F5) | 0);
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

// Dispatch outside tile rendering
function drawOutsideTile(tile, x, y, row, col) {
  if (tile === T.COUNTER) {
    drawLawnTile(x, y, row, col);
  } else if (tile === T.WALL) {
    drawFacadeTile(x, y, row, col);
  } else if (tile === T.FLOOR) {
    drawConcreteTile(x, y, row, col);
  } else if (tile === T.DOOR) {
    drawFacadeTile(x, y, row, col);
  } else if (tile === T.INTERACT) {
    if (row >= 12) {
      drawAsphaltTile(x, y, row, col);
    } else {
      drawPorchTile(x, y, row, col);
    }
  } else {
    ctx.fillStyle = '#888';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.03)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

// Grass lawn tile with variation, blades, and flowers
function drawLawnTile(x, y, row, col) {
  var v1 = tileSeed(row, col, 0);
  var v2 = tileSeed(row, col, 1);
  var r = 55 + Math.floor(v1 * 22);
  var g = 125 + Math.floor(v2 * 35);
  var b = 42 + Math.floor(v1 * 18);
  ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Darker patches
  for (var i = 0; i < 4; i++) {
    var px = Math.floor(tileSeed(row, col, i + 10) * 18);
    var py = Math.floor(tileSeed(row, col, i + 20) * 18);
    ctx.fillStyle = 'rgba(30, 85, 30, 0.2)';
    ctx.fillRect(x + px, y + py, 4, 3);
  }
  // Lighter highlights
  for (var j = 0; j < 3; j++) {
    var hx = Math.floor(tileSeed(row, col, j + 40) * 20);
    var hy = Math.floor(tileSeed(row, col, j + 50) * 20);
    ctx.fillStyle = 'rgba(110, 190, 70, 0.2)';
    ctx.fillRect(x + hx, y + hy, 3, 2);
  }
  // Grass blades
  ctx.fillStyle = 'rgba(35, 100, 35, 0.3)';
  for (var k = 0; k < 5; k++) {
    var bx = Math.floor(tileSeed(row, col, k + 60) * 21);
    var by = Math.floor(tileSeed(row, col, k + 70) * 14);
    ctx.fillRect(x + bx, y + by, 1, 3 + Math.floor(tileSeed(row, col, k + 80) * 4));
  }
  // Occasional small flower
  if (v1 > 0.82) {
    var colors = ['#fff44f', '#ff69b4', '#fff', '#e040fb'];
    var ci = Math.floor(v2 * colors.length);
    ctx.fillStyle = colors[ci];
    var fx = 6 + Math.floor(v1 * 10);
    var fy = 5 + Math.floor(tileSeed(row, col, 5) * 12);
    ctx.fillRect(x + fx, y + fy, 2, 2);
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(x + fx, y + fy + 2, 1, 3);
  }
}

// House facade tile — roof, siding, windows
function drawFacadeTile(x, y, row, col) {
  if (row === 0) {
    // Roof shingles
    ctx.fillStyle = '#5a3520';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    for (var sr = 0; sr < TILE_SIZE; sr += 6) {
      var sOff = (sr % 12 < 6) ? 0 : 4;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(x, y + sr + 5, TILE_SIZE, 1);
      for (var sc = sOff; sc < TILE_SIZE; sc += 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x + sc, y + sr, 1, 6);
      }
    }
    // Eave trim at bottom
    ctx.fillStyle = '#4a2512';
    ctx.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 1);
  } else if (row === 1 || row === 2) {
    // Siding
    ctx.fillStyle = '#c9b08a';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    for (var sl = 3; sl < TILE_SIZE; sl += 5) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x, y + sl, TILE_SIZE, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, y + sl + 1, TILE_SIZE, 1);
    }
    // Windows on row 1
    if (row === 1 && (col === 6 || col === 7 || col === 12 || col === 13)) {
      // Window frame
      ctx.fillStyle = '#e0d8cc';
      ctx.fillRect(x + 3, y + 3, 18, 18);
      // Glass
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(x + 5, y + 5, 14, 14);
      // Cross divider
      ctx.fillStyle = '#e0d8cc';
      ctx.fillRect(x + 11, y + 5, 2, 14);
      ctx.fillRect(x + 5, y + 11, 14, 2);
      // Glass reflection
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 6, y + 6, 4, 4);
      // Shutters
      ctx.fillStyle = '#3d5c3a';
      ctx.fillRect(x, y + 3, 3, 18);
      ctx.fillRect(x + 21, y + 3, 3, 18);
    }
    // Foundation strip at bottom of row 2
    if (row === 2) {
      ctx.fillStyle = '#8a7a6a';
      ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
    }
  } else if (row === 3) {
    // Porch level
    ctx.fillStyle = '#c9b896';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    if (col === 4 || col === 15) {
      // Porch columns
      ctx.fillStyle = '#ece4d4';
      ctx.fillRect(x + 7, y, 10, TILE_SIZE);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(x + 7, y, 1, TILE_SIZE);
      ctx.fillRect(x + 16, y, 1, TILE_SIZE);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x + 10, y, 3, TILE_SIZE);
      // Column cap and base
      ctx.fillStyle = '#d5cbb8';
      ctx.fillRect(x + 6, y, 12, 3);
      ctx.fillRect(x + 6, y + TILE_SIZE - 3, 12, 3);
    } else {
      // Siding at porch level
      for (var pl = 3; pl < TILE_SIZE; pl += 5) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y + pl, TILE_SIZE, 1);
      }
    }
  }
}

// Concrete walkway tile
function drawConcreteTile(x, y, row, col) {
  ctx.fillStyle = '#c4baa6';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  var wv = tileSeed(row, col, 0);
  ctx.fillStyle = 'rgba(0,0,0,' + (0.02 + wv * 0.03) + ')';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Score lines
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
  ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
  // Edge highlights
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, TILE_SIZE, 1);
  ctx.fillRect(x, y, 1, TILE_SIZE);
  // Subtle crack
  if (wv > 0.7) {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + Math.floor(wv * 14) + 4, y + 4, 1, TILE_SIZE - 8);
  }
}

// Porch floor tile (wooden deck)
function drawPorchTile(x, y, row, col) {
  ctx.fillStyle = '#c4a87c';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Wood grain lines
  for (var pl = 0; pl < TILE_SIZE; pl += 6) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y + pl, TILE_SIZE, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y + pl + 1, TILE_SIZE, 1);
  }
  // Vertical plank divider
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(x + 11, y, 1, TILE_SIZE);
}

// Asphalt street tile with lane markings
function drawAsphaltTile(x, y, row, col) {
  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Asphalt texture
  for (var i = 0; i < 5; i++) {
    var gx = Math.floor(tileSeed(row, col, i + 10) * 20);
    var gy = Math.floor(tileSeed(row, col, i + 20) * 20);
    ctx.fillStyle = tileSeed(row, col, i + 5) > 0.5 ? 'rgba(55,55,55,0.4)' : 'rgba(30,30,30,0.3)';
    ctx.fillRect(x + gx, y + gy, 2, 2);
  }
  // Yellow center dashed line on row 13
  if (row === 13) {
    if (col % 3 !== 0) {
      ctx.fillStyle = '#e8b830';
      ctx.fillRect(x, y + 10, TILE_SIZE, 3);
      ctx.fillStyle = '#c89820';
      ctx.fillRect(x, y + 12, TILE_SIZE, 1);
    }
  }
  // Curb at top of street (row 12)
  if (row === 12) {
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(x, y, TILE_SIZE, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, TILE_SIZE, 1);
  }
}

// Outside overlay — roof gable, chimney, porch beam, curb
function drawOutsideOverlay() {
  if (gameState.currentFloor !== 'outside') return;
  var houseL = 4 * TILE_SIZE;
  var houseR = 16 * TILE_SIZE;
  var houseW = houseR - houseL;
  var houseCenter = houseL + houseW / 2;

  // Triangular roof gable
  ctx.fillStyle = '#4d2815';
  ctx.beginPath();
  ctx.moveTo(houseL - 4, TILE_SIZE);
  ctx.lineTo(houseCenter, -4);
  ctx.lineTo(houseR + 4, TILE_SIZE);
  ctx.closePath();
  ctx.fill();

  // Roof edge outline
  ctx.strokeStyle = '#3a1808';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(houseL - 4, TILE_SIZE);
  ctx.lineTo(houseCenter, -4);
  ctx.lineTo(houseR + 4, TILE_SIZE);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Eave overhang shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(houseL - 4, TILE_SIZE, houseW + 8, 3);

  // Chimney
  var chimX = houseR - 2.5 * TILE_SIZE;
  ctx.fillStyle = '#7a4a2e';
  ctx.fillRect(chimX, -2, 14, 16);
  ctx.fillStyle = '#8b5a3e';
  ctx.fillRect(chimX - 1, -2, 16, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(chimX, 13, 14, 1);

  // House number on facade (row 2, left of door)
  ctx.fillStyle = '#f5f0e0';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('742', houseL + 16, 2 * TILE_SIZE + 14);
  ctx.textAlign = 'left';

  // Porch overhang beam
  ctx.fillStyle = '#8b6f50';
  ctx.fillRect(houseL, 3 * TILE_SIZE - 2, houseW, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(houseL, 3 * TILE_SIZE - 2, houseW, 1);

  // Porch shadow on porch floor
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(houseL, 3 * TILE_SIZE, houseW, TILE_SIZE);

  // Porch steps (row 4, between porch and walkway)
  var stepsX = 8 * TILE_SIZE;
  var stepsY = 4 * TILE_SIZE;
  ctx.fillStyle = '#b0a490';
  ctx.fillRect(stepsX, stepsY, 3 * TILE_SIZE, 4);
  ctx.fillStyle = '#a09480';
  ctx.fillRect(stepsX, stepsY + 4, 3 * TILE_SIZE, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(stepsX, stepsY + 7, 3 * TILE_SIZE, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(stepsX, stepsY, 3 * TILE_SIZE, 1);

  // Sidewalk curb (between sidewalk and street)
  ctx.fillStyle = '#999';
  ctx.fillRect(0, 12 * TILE_SIZE - 2, CANVAS_W, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, 12 * TILE_SIZE - 2, CANVAS_W, 1);

  // Walkway edge detail (subtle border between concrete and lawn)
  ctx.fillStyle = 'rgba(100,90,80,0.15)';
  for (var wr = 5; wr <= 10; wr++) {
    ctx.fillRect(9 * TILE_SIZE - 1, wr * TILE_SIZE, 1, TILE_SIZE);
    ctx.fillRect(11 * TILE_SIZE, wr * TILE_SIZE, 1, TILE_SIZE);
  }
}

function drawTile(floor, row, col) {
  const tile = floor.grid[row][col];
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const palette = floor.palette;

  // Outside floor uses custom detailed rendering
  if (gameState.currentFloor === 'outside') {
    drawOutsideTile(tile, x, y, row, col);
    return;
  }

  // Base tile color
  ctx.fillStyle = palette[tile] || palette[T.FLOOR];
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Draw wall detail
  if (tile === T.WALL) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
  }

  // Draw counter detail
  if (tile === T.COUNTER) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  // Draw furniture blocks
  if (tile === T.FURNITURE) {
    drawFurnitureBlock(floor, row, col, x, y);
  }

  // Draw stairs
  if (tile === T.STAIRS) {
    const hasLaundry = (gameState.currentFloor === 'main' && !gameState.flags.laundry_cleared &&
      FLOORS.main.stairs.toUpstairs.rows.includes(row) &&
      FLOORS.main.stairs.toUpstairs.cols.includes(col));
    SPRITES.stairs(x, y, hasLaundry);
  }

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

function drawFurnitureBlock(floor, row, col, x, y) {
  const floorId = gameState.currentFloor;

  // Context-based furniture rendering
  if (floorId === 'main') {
    if (row === 2 && col === 18) SPRITES.furniture(x, y); // dining room cabinet
    else if (row === 6 && (col === 3)) SPRITES.sofa(x, y);
    else if (row === 7 && (col === 3)) SPRITES.sofa(x, y);
    else if (row === 10 && col === 1) SPRITES.toilet(x, y);
    else if (row === 11 && col === 1) SPRITES.sink(x, y);
    else if (row === 10 && (col === 12 || col === 13)) SPRITES.furniture(x, y); // chairs
    else SPRITES.furniture(x, y);
  } else if (floorId === 'basement') {
    if (row === 9 && col === 3) SPRITES.toilet(x, y);
    else if (row === 9 && col === 6) SPRITES.sink(x, y);
    else if (row === 11 && col === 1) SPRITES.shower(x, y);
    else if (row === 11 && col === 7) SPRITES.shower(x, y);
    else if (row === 7 && col === 16) SPRITES.furniture(x, y);
    else SPRITES.furniture(x, y);
  } else if (floorId === 'upstairs') {
    if (row === 2 && (col === 2 || col === 3)) SPRITES.bed(x, y, false);
    else if (row === 2 && col === 16) SPRITES.bed(x, y, true); // Beatrice's bed
    else if (row === 3 && col === 7) SPRITES.furniture(x, y); // dresser
    else if (row === 8 && col === 3) SPRITES.desk(x, y);
    else if (row === 9 && col === 3) SPRITES.desk(x, y);
    else if (row === 8 && col === 17) SPRITES.toilet(x, y);
    else if (row === 10 && col === 14) SPRITES.sink(x, y);
    else if (row === 11 && col === 16) SPRITES.shower(x, y);
    else SPRITES.furniture(x, y);
  } else {
    SPRITES.furniture(x, y);
  }
}

function drawInteractables(floor) {
  for (const obj of floor.interactables) {
    const x = obj.col * TILE_SIZE;
    const y = obj.row * TILE_SIZE;

    switch (obj.type) {
      case 'cupboard_empty':
      case 'cupboard_purrpops':
      case 'cupboard_feast':
        SPRITES.cupboard(
          x,
          y,
          obj.type === 'cupboard_purrpops' ? 'treat' :
            obj.type === 'cupboard_feast' ? 'feast' : null
        );
        break;
      case 'fridge':
        SPRITES.fridge(x, y);
        break;
      case 'stove':
        SPRITES.stove(x, y);
        break;
      case 'kitchen_sink':
        SPRITES.kitchenSink(x, y);
        break;
      case 'coffee_station':
        SPRITES.coffeeStation(x, y);
        break;
      case 'dining_table':
        SPRITES.diningTable(x, y);
        break;
      case 'cat_alice':
        SPRITES.catTree(x, y);
        SPRITES.cat(x, y - 4, '#c8722e', '#f0c070'); // richer orange-tan coat from portrait
        break;
      case 'front_door':
        SPRITES.door(x, y, !gameState.flags.front_door_unlocked);
        break;
      case 'cat_olive':
        SPRITES.treadmill(x, y);
        SPRITES.cat(x, y - 2, '#6b92c8', '#c2d8f0'); // cool blue coat from portrait
        break;
      case 'cat_beatrice':
        SPRITES.bed(x, y, true);
        // Beatrice is always visible, sitting on top of the bed
        SPRITES.cat(x + 2, y + 6, '#21211f', '#5d5e53'); // charcoal coat from portrait
        break;
      case 'sofa_blanket':
        // Draw wide 3-seat sofa: interactive tile is the rightmost cushion (col 5),
        // so offset left by 2 tiles so the sofa spans cols 3-4-5.
        SPRITES.sofaWide(x - 2 * TILE_SIZE, y);
        if (!gameState.flags.sofa_searched) {
          // Blanket on sofa (right cushion, at the interactive tile position)
          ctx.fillStyle = '#f4d05e';
          ctx.fillRect(x + 5, y + 8, 14, 9);
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 5.5, y + 8.5, 13, 8);
          // Only show the key-hint glow after Alice has told the player about it
          if (gameState.flags.alice_fed) {
            ctx.fillStyle = 'rgba(255, 215, 64, 0.65)';
            ctx.fillRect(x + 10, y + 7, 3, 3);
          }
        }
        break;
      case 'basement_door':
        SPRITES.door(x, y, !gameState.flags.basement_unlocked);
        break;
      case 'sliding_door':
        SPRITES.slidingDoor(x, y);
        break;
      case 'tv':
        SPRITES.tv(x, y);
        break;
      case 'floor_lamp':
        SPRITES.floorLamp(x, y);
        break;
      case 'coffee_table':
        SPRITES.coffeeTable(x, y);
        break;
      case 'bookshelf':
      case 'bookshelf_basement':
        SPRITES.bookshelf(x, y);
        break;
      case 'futon':
        SPRITES.futon(x, y);
        break;

      // Upgraded sprites
      case 'microwave':
        SPRITES.microwave(x, y);
        break;
      case 'trash_can':
        SPRITES.trashCan(x, y);
        break;
      case 'spice_rack':
        SPRITES.genericItem(x, y, '#d2691e', '#8b4513');
        break;
      case 'china_cabinet':
        SPRITES.genericItem(x, y, '#8b7355', '#d4a574');
        break;
      case 'plant':
      case 'plant_hallway':
        SPRITES.plant(x, y);
        break;
      case 'game_console':
        SPRITES.genericItem(x, y, '#000', '#4169e1');
        break;
      case 'riddle_board':
        SPRITES.riddleBoard(x, y);
        break;
      case 'side_table':
        SPRITES.genericItem(x, y, '#8b6914', '#daa520');
        break;
      case 'reading_chair':
        SPRITES.armchair(x, y);
        break;
      case 'bathroom_mirror':
        SPRITES.mirror(x, y);
        break;
      case 'towel_rack':
        SPRITES.genericItem(x, y, '#c0c0c0', '#fff');
        break;
      case 'rug':
        SPRITES.genericItem(x, y, '#8b0000', '#dc143c');
        break;
      case 'wall_art':
        SPRITES.wallArt(x, y);
        break;
      case 'coat_rack':
        SPRITES.genericItem(x, y, '#654321', '#8b4513');
        break;

      // Basement items
      case 'weights':
        SPRITES.weights(x, y);
        break;
      case 'exercise_bike':
        SPRITES.exerciseBike(x, y);
        break;
      case 'yoga_mat':
        SPRITES.genericItem(x, y, '#9370db', '#8a2be2');
        break;
      case 'storage_box':
        SPRITES.genericItem(x, y, '#d2691e', '#8b4513');
        break;
      case 'washer':
        SPRITES.washer(x, y);
        break;
      case 'dryer':
        SPRITES.dryer(x, y);
        break;
      case 'laundry_basket_storage':
        SPRITES.genericItem(x, y, '#deb887', '#d2691e');
        break;
      case 'cleaning_supplies':
        SPRITES.genericItem(x, y, '#ffff00', '#32cd32');
        break;
      case 'pool_table':
        SPRITES.poolTable(x, y);
        break;
      case 'mini_fridge':
        SPRITES.genericItem(x, y, '#c0c0c0', '#000');
        break;
      case 'gaming_setup':
        SPRITES.gamingSetup(x, y);
        break;
      case 'bath_mat':
        SPRITES.genericItem(x, y, '#fff', '#e6e6fa');
        break;
      case 'bathroom_cabinet':
        SPRITES.genericItem(x, y, '#fff', '#d3d3d3');
        break;
      case 'tool_bench':
        SPRITES.genericItem(x, y, '#8b4513', '#696969');
        break;
      case 'water_heater':
        SPRITES.genericItem(x, y, '#c0c0c0', '#ff4500');
        break;

      // Upstairs items
      case 'nightstand':
        SPRITES.genericItem(x, y, '#8b6914', '#cd853f');
        break;
      case 'dresser':
      case 'guest_dresser':
        SPRITES.genericItem(x, y, '#8b4513', '#a0522d');
        break;
      case 'jewelry_box':
        SPRITES.genericItem(x, y, '#ffd700', '#daa520');
        break;
      case 'wardrobe':
        SPRITES.genericItem(x, y, '#654321', '#8b4513');
        break;
      case 'bedside_lamp':
        SPRITES.genericItem(x, y, '#ffffe0', '#ffd700');
        break;
      case 'reading_nook':
        SPRITES.genericItem(x, y, '#8b7355', '#d2b48c');
        break;
      case 'filing_cabinet':
        SPRITES.genericItem(x, y, '#708090', '#2f4f4f');
        break;
      case 'office_chair':
        SPRITES.genericItem(x, y, '#000', '#4169e1');
        break;
      case 'printer':
        SPRITES.genericItem(x, y, '#c0c0c0', '#000');
        break;
      case 'bookcase':
        SPRITES.genericItem(x, y, '#8b4513', '#cd853f');
        break;
      case 'bathroom_scale':
        SPRITES.genericItem(x, y, '#c0c0c0', '#696969');
        break;
      case 'medicine_cabinet':
        SPRITES.genericItem(x, y, '#fff', '#add8e6');
        break;
      case 'towel_warmer':
        SPRITES.genericItem(x, y, '#c0c0c0', '#ffa500');
        break;
      case 'hallway_table':
        SPRITES.genericItem(x, y, '#8b6914', '#daa520');
        break;
      case 'family_photos':
        SPRITES.genericItem(x, y, '#000', '#ffd700');
        break;
      case 'coat_hooks':
        SPRITES.genericItem(x, y, '#654321', '#8b4513');
        break;
      case 'ceiling_fan':
        SPRITES.genericItem(x, y, '#c0c0c0', '#696969');
        break;
      case 'linen_closet':
        SPRITES.genericItem(x, y, '#fff', '#e6e6fa');
        break;

      // Cat toy collectible
      case 'cat_toy':
        if (!gameState.flags.cat_toys_found || !gameState.flags.cat_toys_found.includes(obj.toyId)) {
          // Glowing paw print indicator
          var glowAlpha = 0.4 + Math.sin(animTimer * 0.1) * 0.2;
          ctx.fillStyle = 'rgba(255,105,180,' + glowAlpha + ')';
          ctx.fillRect(x + 6, y + 6, 12, 12);
          ctx.fillStyle = '#ff69b4';
          ctx.fillRect(x + 8, y + 8, 3, 3);
          ctx.fillRect(x + 13, y + 8, 3, 3);
          ctx.fillRect(x + 9, y + 12, 6, 4);
        }
        break;

      // Outside items
      case 'welcome_mat':
        // Doormat
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(x + 3, y + 14, 18, 6);
        ctx.fillStyle = '#a07830';
        ctx.fillRect(x + 4, y + 15, 16, 4);
        break;
      case 'porch_light':
        // Wall sconce
        ctx.fillStyle = '#888';
        ctx.fillRect(x + 9, y + 4, 6, 4);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(x + 10, y + 8, 4, 5);
        ctx.fillStyle = 'rgba(255,240,150,0.3)';
        ctx.fillRect(x + 6, y + 6, 12, 10);
        break;
      case 'flower_bed':
        SPRITES.plant(x, y);
        // Extra flowers
        ctx.fillStyle = '#ff69b4';
        ctx.fillRect(x + 5, y + 3, 3, 3);
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(x + 16, y + 5, 3, 3);
        break;
      case 'bird_bath':
        // Pedestal
        ctx.fillStyle = '#999';
        ctx.fillRect(x + 8, y + 12, 8, 10);
        ctx.fillRect(x + 10, y + 18, 4, 4);
        // Basin
        ctx.fillStyle = '#bbb';
        ctx.fillRect(x + 5, y + 8, 14, 5);
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(x + 7, y + 9, 10, 3);
        break;
      case 'mailbox':
        // Post
        ctx.fillStyle = '#654321';
        ctx.fillRect(x + 10, y + 10, 4, 12);
        // Box
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 5, y + 4, 14, 8);
        ctx.fillStyle = '#555';
        ctx.fillRect(x + 6, y + 5, 12, 6);
        // Flag
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x + 18, y + 4, 2, 6);
        break;
      case 'garden_gnome':
        // Body
        ctx.fillStyle = '#4169e1';
        ctx.fillRect(x + 8, y + 10, 8, 8);
        // Face
        ctx.fillStyle = '#ffe0bd';
        ctx.fillRect(x + 9, y + 6, 6, 5);
        // Hat
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x + 8, y + 2, 8, 5);
        ctx.fillRect(x + 10, y + 0, 4, 3);
        break;
      case 'garden_bench':
        // Legs
        ctx.fillStyle = '#555';
        ctx.fillRect(x + 3, y + 16, 2, 6);
        ctx.fillRect(x + 19, y + 16, 2, 6);
        // Seat
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(x + 2, y + 13, 20, 4);
        // Back
        ctx.fillStyle = '#654321';
        ctx.fillRect(x + 2, y + 7, 20, 7);
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(x + 3, y + 8, 18, 5);
        break;
    }
  }
}

function drawPlayer() {
  const p = gameState.player;
  let px, py;

  if (gameState.moving) {
    const fromX = gameState.moveFrom.col * TILE_SIZE;
    const fromY = gameState.moveFrom.row * TILE_SIZE;
    const toX = gameState.moveTo.col * TILE_SIZE;
    const toY = gameState.moveTo.row * TILE_SIZE;
    const t = gameState.moveProgress / TILE_SIZE;
    px = fromX + (toX - fromX) * t;
    py = fromY + (toY - fromY) * t;

    // Advance walk animation frame
    walkFrameTimer++;
    if (walkFrameTimer >= WALK_FRAME_INTERVAL) {
      walkFrameTimer = 0;
      walkFrame++;
    }
  } else {
    px = p.col * TILE_SIZE;
    py = p.row * TILE_SIZE;
    walkFrameTimer = 0;
  }

  SPRITES.player(px, py, p.facing, gameState.moving);
}

function drawRoomLabels(floorId) {
  const labels = ROOM_LABELS[floorId];
  if (!labels) return;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';

  for (const label of labels) {
    const x = label.col * TILE_SIZE + TILE_SIZE / 2;
    const y = label.row * TILE_SIZE - 2;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(label.text, x, y);
  }
  ctx.textAlign = 'left';
}

// ======================== DYNAMIC LIGHTING ========================

// Ambient tint per floor (rgba overlay)
var FLOOR_AMBIENT = {
  outside: { r: 255, g: 180, b: 100, a: 0.08 },  // warm sunset
  main: { r: 255, g: 220, b: 170, a: 0.05 },      // warm interior
  basement: { r: 220, g: 230, b: 255, a: 0.05 },     // cool fluorescent
  upstairs: { r: 255, g: 230, b: 200, a: 0.06 }    // soft warm
};

// Light source definitions per floor: {row, col, radius, color, flicker}
var FLOOR_LIGHTS = {
  outside: [
    { row: 3, col: 11, radius: 48, color: '255,240,180', flicker: true },
    { row: 3, col: 7, radius: 36, color: '255,240,180', flicker: false },
  ],
  main: [
    { row: 6, col: 6, radius: 72, color: '255,240,200', flicker: true },  // floor lamp
    { row: 6, col: 15, radius: 60, color: '100,160,255', flicker: true }, // TV
    { row: 3, col: 5, radius: 40, color: '255,180,80', flicker: false },  // stove
  ],
  basement: [
    { row: 2, col: 2, radius: 72, color: '220,230,255', flicker: false },  // lobby / stairwell light
    { row: 7, col: 6, radius: 80, color: '220,230,255', flicker: false },  // washroom / center-left light
    { row: 7, col: 10, radius: 80, color: '200,200,255', flicker: false }, // center overhead light
    { row: 4, col: 15, radius: 80, color: '220,230,255', flicker: false }, // rec room right light
    { row: 11, col: 5, radius: 72, color: '220,230,255', flicker: false }, // storage area light
    { row: 11, col: 14, radius: 72, color: '220,230,255', flicker: false }, // bottom-right light
  ],
  upstairs: [
    { row: 2, col: 4, radius: 72, color: '255,240,200', flicker: false },  // main bedroom light
    { row: 3, col: 13, radius: 56, color: '255,240,200', flicker: true },  // guest bedroom bedside lamp
    { row: 7, col: 8, radius: 72, color: '255,240,200', flicker: false },  // hallway center light
    { row: 9, col: 3, radius: 64, color: '255,240,200', flicker: false },  // office light
    { row: 3, col: 17, radius: 56, color: '255,240,200', flicker: false }, // upstairs washroom light
  ]
};

var lightFlickerTime = 0;

function drawLighting(floor) {
  var floorId = gameState.currentFloor;
  lightFlickerTime++;

  // 1. Apply ambient tint
  var ambient = FLOOR_AMBIENT[floorId];
  if (ambient) {
    ctx.fillStyle = 'rgba(' + ambient.r + ',' + ambient.g + ',' + ambient.b + ',' + ambient.a + ')';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // 2. Draw light sources using additive-style radial gradients
  var lights = FLOOR_LIGHTS[floorId];
  if (lights && lights.length > 0) {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < lights.length; i++) {
      var light = lights[i];
      var cx = light.col * TILE_SIZE + TILE_SIZE / 2;
      var cy = light.row * TILE_SIZE + TILE_SIZE / 2;
      var radius = light.radius;

      // Subtle flicker
      if (light.flicker) {
        radius += Math.sin(lightFlickerTime * 0.15 + i * 2) * 4;
      }

      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(' + light.color + ',0.12)');
      grad.addColorStop(0.5, 'rgba(' + light.color + ',0.06)');
      grad.addColorStop(1, 'rgba(' + light.color + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

}

// ======================== MINIMAP ========================

function drawMinimap() {
  var floor = getCurrentFloor();
  var grid = floor.grid;
  var dotSize = 2;
  var padding = 4;
  var mapW = MAP_COLS * dotSize;
  var mapH = MAP_ROWS * dotSize;
  var offsetX = CANVAS_W - mapW - padding - 2;
  var offsetY = padding + 2;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(offsetX - 2, offsetY - 2, mapW + 4, mapH + 4);
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(offsetX - 2, offsetY - 2, mapW + 4, mapH + 4);

  // Draw tiles
  for (var r = 0; r < MAP_ROWS; r++) {
    for (var c = 0; c < MAP_COLS; c++) {
      var tile = grid[r][c];
      var dx = offsetX + c * dotSize;
      var dy = offsetY + r * dotSize;
      if (tile === T.WALL) {
        ctx.fillStyle = 'rgba(100, 80, 60, 0.9)';
      } else if (tile === T.FURNITURE || tile === T.COUNTER) {
        ctx.fillStyle = 'rgba(139, 105, 20, 0.6)';
      } else if (tile === T.DOOR) {
        ctx.fillStyle = 'rgba(74, 124, 89, 0.8)';
      } else if (tile === T.STAIRS) {
        ctx.fillStyle = 'rgba(160, 82, 45, 0.8)';
      } else {
        ctx.fillStyle = 'rgba(180, 160, 130, 0.3)';
      }
      ctx.fillRect(dx, dy, dotSize, dotSize);
    }
  }

  // Draw interactable markers (cats show as colored dots)
  for (var i = 0; i < floor.interactables.length; i++) {
    var obj = floor.interactables[i];
    if (obj.type === 'cat_alice' || obj.type === 'cat_olive' || obj.type === 'cat_beatrice') {
      var catColor = obj.type === 'cat_alice' ? '#c8722e' :
        obj.type === 'cat_olive' ? '#6b92c8' : '#21211f';
      ctx.fillStyle = catColor;
      ctx.fillRect(offsetX + obj.col * dotSize, offsetY + obj.row * dotSize, dotSize, dotSize);
    }
  }

  // Draw player (blinking dot)
  var blink = Math.sin(animTimer * 0.15) > 0;
  if (blink) {
    var p = gameState.player;
    ctx.fillStyle = '#ff9ecf';
    ctx.fillRect(offsetX + p.col * dotSize, offsetY + p.row * dotSize, dotSize, dotSize);
  }
}

function render() {
  const floor = getCurrentFloor();

  // Clear
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Apply screen shake offset
  var shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Draw tiles
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      drawTile(floor, r, c);
    }
  }

  // Draw room labels
  drawRoomLabels(gameState.currentFloor);

  // Draw outside overlay (roof, chimney, porch beam, curb)
  drawOutsideOverlay();

  // Draw interactables
  drawInteractables(floor);

  // Draw player
  drawPlayer();

  // Draw particles on top
  drawParticles();

  // Draw facing indicator (small arrow)
  if (!gameState.moving && !dialogueActive) {
    const facing = getFacingTile();
    const obj = getInteractableAt(facing.row, facing.col);

    // Check stairs interaction too
    let isStairInteract = false;
    if (gameState.currentFloor === 'main' && !gameState.flags.laundry_cleared) {
      const s = FLOORS.main.stairs.toUpstairs;
      if (s.rows.includes(facing.row) && s.cols.includes(facing.col)) {
        isStairInteract = true;
      }
    }

    if (obj || isStairInteract) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
      ctx.fillRect(facing.col * TILE_SIZE, facing.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // Draw dynamic lighting
  drawLighting(floor);

  // Draw minimap
  drawMinimap();

  // Restore from screen shake before vignette
  ctx.restore();

  // Draw subtle vignette effect (not affected by shake)
  const gradient = ctx.createRadialGradient(
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.3,
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// ======================== GAME LOOP ========================

let keysDown = {};

function gameLoop() {
  // Handle continuous input
  if (!dialogueActive && !gameState.moving) {
    if (keysDown['ArrowUp'] || keysDown['KeyW']) tryMove('up');
    else if (keysDown['ArrowDown'] || keysDown['KeyS']) tryMove('down');
    else if (keysDown['ArrowLeft'] || keysDown['KeyA']) tryMove('left');
    else if (keysDown['ArrowRight'] || keysDown['KeyD']) tryMove('right');
  }

  animTimer++;
  updateMovement();
  updateParticles();
  updateScreenShake();
  updateInteractPrompt();
  render();
  requestAnimationFrame(gameLoop);
}

// ======================== INPUT HANDLING ========================

document.addEventListener('keydown', function (e) {
  // Block game input while code entry overlay is open
  if (document.getElementById('numpad-overlay').classList.contains('active')) {
    return;
  }

  keysDown[e.code] = true;

  // Interact / advance dialogue
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (dialogueActive) {
      advanceDialogue();
    } else {
      // Check laundry first, then normal interact
      if (!checkLaundryInteraction()) {
        tryInteract();
      }
    }
  }
});

document.addEventListener('keyup', function (e) {
  keysDown[e.code] = false;
});

window.addEventListener('blur', function () {
  Object.keys(keysDown).forEach(function (key) { keysDown[key] = false; });
});

// Mobile D-Pad
function setupMobileControls() {
  const dirs = {
    'btn-up': 'up',
    'btn-down': 'down',
    'btn-left': 'left',
    'btn-right': 'right'
  };

  for (const [id, dir] of Object.entries(dirs)) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    let interval = null;

    function startMove(e) {
      e.preventDefault();
      tryMove(dir);
      interval = setInterval(function () { tryMove(dir); }, 150);
    }

    function stopMove(e) {
      e.preventDefault();
      if (interval) { clearInterval(interval); interval = null; }
    }

    btn.addEventListener('touchstart', startMove, { passive: false });
    btn.addEventListener('mousedown', startMove);
    btn.addEventListener('touchend', stopMove, { passive: false });
    btn.addEventListener('touchcancel', stopMove, { passive: false });
    btn.addEventListener('mouseup', stopMove);
    btn.addEventListener('mouseleave', stopMove);
  }

  // Interact button
  const interactBtn = document.getElementById('btn-interact');
  if (interactBtn) {
    function doInteract(e) {
      e.preventDefault();
      if (dialogueActive) {
        advanceDialogue();
      } else {
        if (!checkLaundryInteraction()) {
          tryInteract();
        }
      }
    }
    interactBtn.addEventListener('touchstart', doInteract, { passive: false });
    interactBtn.addEventListener('click', doInteract);
  }
}

// ======================== SAVE / LOAD ========================

const SAVE_KEY = 'marice_cats_adventure_save';
const SETTINGS_KEY = 'marice_cats_settings';
var saveDebounceTimer = null;
var saveIndicatorTimer = null;

function saveGame() {
  // Debounce saves — wait 500ms of inactivity before writing
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(doSaveGame, 500);
}

function saveGameImmediate() {
  // For critical moments (floor changes, quest progress)
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  doSaveGame();
}

function doSaveGame() {
  const data = {
    currentFloor: gameState.currentFloor,
    player: { row: gameState.player.row, col: gameState.player.col, facing: gameState.player.facing },
    inventory: gameState.inventory,
    flags: gameState.flags
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    showSaveIndicator();
  } catch (e) {
    // localStorage might be unavailable
  }
}

function showSaveIndicator() {
  var el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('visible');
  if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(function () {
    el.classList.remove('visible');
  }, 1200);
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    gameState.currentFloor = data.currentFloor || 'outside';
    gameState.player.row = data.player.row;
    gameState.player.col = data.player.col;
    gameState.player.facing = data.player.facing || 'down';
    gameState.inventory = data.inventory || [];
    gameState.flags = Object.assign(gameState.flags, data.flags || {});

    return true;
  } catch (e) {
    return false;
  }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
}

// ======================== SETTINGS PERSISTENCE ========================

function saveSettings() {
  var settings = {
    sfxVolume: document.getElementById('sfx-volume').value,
    musicVolume: document.getElementById('music-volume').value,
    screenShake: document.getElementById('screen-shake').checked,
    particleEffects: document.getElementById('particle-effects').checked
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { }
}

function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    var settings = JSON.parse(raw);

    var sfxSlider = document.getElementById('sfx-volume');
    var musicSlider = document.getElementById('music-volume');
    var sfxValue = document.getElementById('sfx-value');
    var musicValue = document.getElementById('music-value');
    var screenShake = document.getElementById('screen-shake');
    var particleEffects = document.getElementById('particle-effects');

    if (settings.sfxVolume !== undefined) {
      sfxSlider.value = settings.sfxVolume;
      sfxValue.textContent = settings.sfxVolume + '%';
    }
    if (settings.musicVolume !== undefined) {
      musicSlider.value = settings.musicVolume;
      musicValue.textContent = settings.musicVolume + '%';
    }
    if (settings.screenShake !== undefined) {
      screenShake.checked = settings.screenShake;
    }
    if (settings.particleEffects !== undefined) {
      particleEffects.checked = settings.particleEffects;
    }
  } catch (e) { }
}

// ======================== NUMPAD ========================

let numpadCallback = null;

function showNumpad(onSubmit) {
  numpadCallback = onSubmit;
  const input = document.getElementById('numpad-input');
  input.value = '';
  document.getElementById('numpad-error').textContent = '';
  document.getElementById('numpad-overlay').classList.add('active');
  setTimeout(function () { input.focus(); }, 50);
}

function hideNumpad() {
  document.getElementById('numpad-overlay').classList.remove('active');
  numpadCallback = null;
  document.getElementById('numpad-input').value = '';
}

function numpadSubmit() {
  const code = document.getElementById('numpad-input').value.trim();
  if (code.length < 4) {
    document.getElementById('numpad-error').textContent = 'Enter all 4 digits.';
    return;
  }
  const cb = numpadCallback;
  hideNumpad();
  if (cb) {
    cb(code);
  }
}

function setupNumpad() {
  const overlay = document.getElementById('numpad-overlay');
  const input = document.getElementById('numpad-input');

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hideNumpad();
  });

  input.addEventListener('input', function () {
    input.value = input.value.replace(/[^0-9]/g, '');
    document.getElementById('numpad-error').textContent = '';
    if (input.value.length > 0) {
      playSfx('numpad_beep');
    }
    if (input.value.length === 4) {
      numpadSubmit();
    }
  });

  input.addEventListener('keydown', function (e) {
    if (e.code === 'Enter') {
      e.preventDefault();
      numpadSubmit();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      hideNumpad();
    }
  });

  document.getElementById('numpad-btn-enter').addEventListener('click', numpadSubmit);
  document.getElementById('numpad-btn-cancel').addEventListener('click', hideNumpad);
}

// ======================== TITLE SCREEN ========================

function showTitleScreen() {
  document.getElementById('title-screen').style.display = 'flex';
}

function hideTitleScreen() {
  document.getElementById('title-screen').style.display = 'none';
}

function startNewGame() {
  initAudio();
  markPlayerActivity();
  clearSave();
  // Reset transient runtime state so restart/new game is always clean.
  moveCount = 0;
  dialogueActive = false;
  dialogueQueue = [];
  gameState.moving = false;
  gameState.moveProgress = 0;
  gameState.moveFrom = null;
  gameState.moveTo = null;
  Object.keys(keysDown).forEach(function (key) { keysDown[key] = false; });
  hideNumpad();
  hideDialogue();
  document.getElementById('quest-panel').classList.remove('active');
  document.getElementById('settings-panel').classList.remove('active');

  gameState.currentFloor = 'outside';
  gameState.player = { row: outsideStart.row, col: outsideStart.col, facing: 'down' };
  gameState.inventory = [];
  gameState.flags = {
    alice_fed: false,
    olive_fed: false,
    beatrice_fed: false,
    has_basement_key: false,
    basement_unlocked: false,
    has_laundry_basket: false,
    laundry_cleared: false,
    sofa_searched: false,
    game_complete: false,
    front_door_unlocked: false,
    cat_toys_found: []
  };
  renderInventory();
  updateFloorLabel();
  updateQuestCounter();
  updateQuestList();
  hideTitleScreen();
  startMusic('outside');

  // Show controls hint
  var hint = document.getElementById('controls-hint');
  if (hint) hint.classList.remove('hidden');

  // Show intro dialogue after a short delay
  setTimeout(function () {
    startDialogue('intro', null, null);
  }, 500);
}

// Hide controls hint after first few movements
var moveCount = 0;
function checkHideControlsHint() {
  moveCount++;
  if (moveCount === 5) {
    var hint = document.getElementById('controls-hint');
    if (hint) hint.classList.add('hidden');
  }
}

function continueGame() {
  initAudio();
  markPlayerActivity();
  renderInventory();
  updateFloorLabel();
  updateQuestCounter();
  updateQuestList();
  hideTitleScreen();
  startMusic(gameState.currentFloor);

  // Hide controls hint for returning players
  var hint = document.getElementById('controls-hint');
  if (hint) hint.classList.add('hidden');
}

// ======================== ENDING SCREEN ========================

function showEnding() {
  document.getElementById('ending-overlay').classList.add('active');
}

function hideEnding() {
  document.getElementById('ending-overlay').classList.remove('active');
}

function restartGame() {
  hideEnding();
  startNewGame();
}

// ======================== INIT ========================

function init() {
  showTitleScreen();
  setupMobileControls();
  setupNumpad();
  setupIdleHints();
  loadSettings();

  // Title screen buttons
  document.getElementById('btn-new-game').addEventListener('click', function () {
    startNewGame();
  });

  const continueBtn = document.getElementById('btn-continue');
  if (loadGame()) {
    continueBtn.style.display = 'inline-block';
    continueBtn.addEventListener('click', function () {
      continueGame();
    });
  } else {
    continueBtn.style.display = 'none';
  }

  // Ending screen restart
  document.getElementById('btn-restart').addEventListener('click', function () {
    restartGame();
  });

  // Dialogue overlay click to advance
  dialogueOverlay.addEventListener('click', function () {
    advanceDialogue();
  });

  // Quest panel toggle
  const questPanel = document.getElementById('quest-panel');
  const btnToggleQuest = document.getElementById('btn-toggle-quest');
  const btnCloseQuest = document.getElementById('btn-close-quest');

  btnToggleQuest.addEventListener('click', function () {
    questPanel.classList.toggle('active');
    // Close settings if open
    document.getElementById('settings-panel').classList.remove('active');
  });

  btnCloseQuest.addEventListener('click', function () {
    questPanel.classList.remove('active');
  });

  // Settings panel toggle
  const settingsPanel = document.getElementById('settings-panel');
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  btnToggleSettings.addEventListener('click', function () {
    settingsPanel.classList.toggle('active');
    // Close quest if open
    questPanel.classList.remove('active');
  });

  btnCloseSettings.addEventListener('click', function () {
    settingsPanel.classList.remove('active');
  });

  // Settings volume sliders
  const sfxVolume = document.getElementById('sfx-volume');
  const sfxValue = document.getElementById('sfx-value');
  const musicVolume = document.getElementById('music-volume');
  const musicValue = document.getElementById('music-value');

  sfxVolume.addEventListener('input', function () {
    sfxValue.textContent = this.value + '%';
    updateAudioVolumes();
  });

  musicVolume.addEventListener('input', function () {
    musicValue.textContent = this.value + '%';
    updateAudioVolumes();
  });

  document.getElementById('btn-save-settings').addEventListener('click', function () {
    saveSettings();
    showToast('Settings saved!', 1500);
    settingsPanel.classList.remove('active');
  });

  // Start game loop
  requestAnimationFrame(gameLoop);
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', init);
