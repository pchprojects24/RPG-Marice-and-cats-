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
    front_door_unlocked: false
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
  [0, 0.08, 0.16].forEach(function(delay, i) {
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
  notes.forEach(function(freq, i) {
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
  musicLoopTimer = setTimeout(function() {
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

  typewriterTimer = setInterval(function() {
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

// ======================== TOAST SYSTEM ========================

const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(text, duration) {
  duration = duration || 2000;
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, duration);
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
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
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
  }

  // Olive quest
  const oliveStatus = quests[1].querySelector('.quest-status');
  if (gameState.flags.olive_fed) {
    oliveStatus.textContent = '✅';
    oliveStatus.classList.remove('pending');
    oliveStatus.classList.add('complete');
  }

  // Beatrice quest
  const beatriceStatus = quests[2].querySelector('.quest-status');
  if (gameState.flags.beatrice_fed) {
    beatriceStatus.textContent = '✅';
    beatriceStatus.classList.remove('pending');
    beatriceStatus.classList.add('complete');
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
    outside: 'Front Yard',
    main: 'Main Floor',
    basement: 'Basement',
    upstairs: 'Upstairs'
  };

  label.textContent = floorNames[newFloor] || newFloor;
  overlay.classList.add('active');

  setTimeout(function() {
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
    setTimeout(function() {
      overlay.classList.remove('active');
    }, 400);
  }, 350);
}

// Change floor with custom spawn position (used by stair returns)
function changeFloorTo(newFloor, row, col, facing) {
  var overlay = document.getElementById('transition-overlay');
  var label = document.getElementById('transition-label');
  var floorNames = {
    outside: 'Front Yard',
    main: 'Main Floor',
    basement: 'Basement',
    upstairs: 'Upstairs'
  };

  label.textContent = floorNames[newFloor] || newFloor;
  overlay.classList.add('active');

  setTimeout(function() {
    gameState.currentFloor = newFloor;
    gameState.player.row = row;
    gameState.player.col = col;
    gameState.player.facing = facing || 'down';
    updateFloorLabel();
    saveGame();
    startMusic(newFloor);

    setTimeout(function() {
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

function tryMove(dir) {
  if (gameState.moving || dialogueActive) return;

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
          startDialogue('laundry_pile_clear', null, function() {
            triggerScreenShake(4, 12);
            showToast('Stairway cleared!');
            saveGame();
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
      startDialogue('front_door_locked', null, function() {
        showNumpad(function(code) {
          if (code === '3134') {
            gameState.flags.front_door_unlocked = true;
            triggerScreenShake(4, 12);
            playSfx('door_unlock');
            showToast('Front door unlocked!');
            changeFloor('main');
          } else {
            playSfx('error');
            showToast('Incorrect code. Hint: the code is in the riddle.');
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
        startDialogue('cupboard_purrpops', null, function() {
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
        startDialogue('cupboard_feast', null, function() {
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
        startDialogue('alice_after', 'alice', function() {
          showToast('Alice hints about the sofa!');
          markCatFed('alice');
          saveGame();
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
        startDialogue('sofa_blanket', null, function() {
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
        startDialogue('basement_door_unlock', null, function() {
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
        startDialogue('olive_after', 'olive', function() {
          addItem('laundry_basket');
          gameState.flags.has_laundry_basket = true;
          showToast('Got Laundry Basket!');
          markCatFed('olive');
          saveGame();
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
        startDialogue('beatrice_after', 'beatrice', function() {
          markCatFed('beatrice');
          saveGame();
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
    case 'guest_dresser':
      startDialogue('dresser', null, null);
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
      startDialogue('laundry_pile_clear', null, function() {
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
  player: function(x, y, facing, isMoving) {
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

  // Cat sprite (generic, colored per cat)
  cat: function(x, y, color, accentColor) {
    // Shadow under cat for depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x + 5, y + 19, 15, 2);

    // Body (loaf shape)
    ctx.fillStyle = color;
    ctx.fillRect(x + 5, y + 10, 14, 8);
    ctx.fillRect(x + 6, y + 9, 12, 1);
    ctx.fillRect(x + 7, y + 8, 10, 1);

    // Chest/front (lighter)
    ctx.fillStyle = accentColor || '#ffb6c1';
    ctx.fillRect(x + 8, y + 12, 8, 5);

    // Head (rounder)
    ctx.fillStyle = color;
    ctx.fillRect(x + 7, y + 4, 10, 6);
    ctx.fillRect(x + 6, y + 5, 12, 4);
    ctx.fillRect(x + 8, y + 3, 8, 1);

    // Ears (triangular)
    ctx.fillRect(x + 7, y + 2, 3, 3);
    ctx.fillRect(x + 14, y + 2, 3, 3);
    // Inner ears
    ctx.fillStyle = accentColor || '#ffb6c1';
    ctx.fillRect(x + 8, y + 3, 1, 1);
    ctx.fillRect(x + 15, y + 3, 1, 1);

    // Eyes (bigger, more expressive)
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 9, y + 6, 2, 2);
    ctx.fillRect(x + 13, y + 6, 2, 2);
    // Pupils
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 10, y + 7, 1, 1);
    ctx.fillRect(x + 14, y + 7, 1, 1);

    // Nose
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect(x + 11, y + 8, 2, 1);

    // Mouth (cute smile)
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 11, y + 9, 1, 1);
    ctx.fillRect(x + 12, y + 9, 1, 1);

    // Whiskers
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    // Left whiskers
    ctx.moveTo(x + 7, y + 7);
    ctx.lineTo(x + 4, y + 6);
    ctx.moveTo(x + 7, y + 8);
    ctx.lineTo(x + 4, y + 8);
    // Right whiskers
    ctx.moveTo(x + 17, y + 7);
    ctx.lineTo(x + 20, y + 6);
    ctx.moveTo(x + 17, y + 8);
    ctx.lineTo(x + 20, y + 8);
    ctx.stroke();

    // Tail (curved)
    ctx.fillStyle = color;
    ctx.fillRect(x + 18, y + 10, 3, 4);
    ctx.fillRect(x + 19, y + 8, 2, 2);
    ctx.fillRect(x + 20, y + 7, 1, 1);

    // Front paws (visible)
    ctx.fillStyle = color;
    ctx.fillRect(x + 7, y + 17, 2, 2);
    ctx.fillRect(x + 15, y + 17, 2, 2);
  },

  // Cupboard
  cupboard: function(x, y, variant) {
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
  sofa: function(x, y) {
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
  sofaWide: function(x, y) {
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
  armchair: function(x, y) {
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

  fridge: function(x, y) {
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

  stove: function(x, y) {
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

  kitchenSink: function(x, y) {
    ctx.fillStyle = '#c49b72';
    ctx.fillRect(x + 1, y + 1, 22, 22);
    ctx.fillStyle = '#e7d8c4';
    ctx.fillRect(x + 3, y + 3, 18, 16);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 6, y + 6, 12, 10);
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(x + 11, y + 2, 3, 6);
  },

  coffeeStation: function(x, y) {
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

  diningTable: function(x, y) {
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

  coffeeTable: function(x, y) {
    ctx.fillStyle = '#6f4c32';
    ctx.fillRect(x + 3, y + 10, 18, 6);
    ctx.fillStyle = '#8a6645';
    ctx.fillRect(x + 4, y + 11, 16, 3);
    ctx.fillStyle = '#3b281c';
    ctx.fillRect(x + 6, y + 15, 12, 2);
  },

  floorLamp: function(x, y) {
    ctx.fillStyle = '#d7c4a1';
    ctx.fillRect(x + 9, y + 2, 6, 6);
    ctx.fillRect(x + 10, y + 8, 4, 12);
    ctx.fillStyle = '#3b2a21';
    ctx.fillRect(x + 11, y + 20, 2, 3);
    ctx.fillRect(x + 7, y + 22, 10, 1);
  },

  tv: function(x, y) {
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 2, y + 2, 20, 14);
    ctx.fillStyle = '#2d8cff';
    ctx.fillRect(x + 4, y + 4, 16, 10);
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 10, y + 16, 4, 4);
  },

  bookshelf: function(x, y) {
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
  door: function(x, y, locked) {
    ctx.fillStyle = locked ? '#8B4513' : '#4a7c59';
    ctx.fillRect(x + 4, y + 1, 16, 22);
    ctx.fillStyle = locked ? '#654321' : '#3a6c49';
    ctx.fillRect(x + 6, y + 3, 12, 18);
    // Handle
    ctx.fillStyle = locked ? '#888' : '#ffd700';
    ctx.fillRect(x + 15, y + 10, 2, 4);
    // Lock indicator
    if (locked) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(x + 10, y + 8, 4, 4);
    }
  },

  // Sliding door
  slidingDoor: function(x, y) {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, 10, 20);
    ctx.strokeRect(x + 12, y + 2, 10, 20);
  },

  // Stairs
  stairs: function(x, y, hasLaundry) {
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
  treadmill: function(x, y) {
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
  futon: function(x, y) {
    ctx.fillStyle = '#4a6741';
    ctx.fillRect(x + 1, y + 6, 22, 14);
    ctx.fillStyle = '#5a7751';
    ctx.fillRect(x + 3, y + 8, 18, 10);
  },

  // Furniture (generic blocked)
  furniture: function(x, y) {
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 3, y + 3, 18, 18);
    ctx.fillStyle = '#7a5c10';
    ctx.fillRect(x + 5, y + 5, 14, 14);
  },

  // Cat tree (for Alice's position indicator)
  catTree: function(x, y) {
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
  bed: function(x, y, withBlanket) {
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
  toilet: function(x, y) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y + 6, 12, 14);
    ctx.fillStyle = '#eee';
    ctx.fillRect(x + 7, y + 3, 10, 5);
  },

  // Sink
  sink: function(x, y) {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(x + 4, y + 8, 16, 10);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 6, y + 10, 12, 6);
    // Faucet
    ctx.fillStyle = '#999';
    ctx.fillRect(x + 10, y + 4, 4, 6);
  },

  // Desk
  desk: function(x, y) {
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
  shower: function(x, y) {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 4, y + 4, 16, 16);
    // Showerhead
    ctx.fillStyle = '#999';
    ctx.fillRect(x + 10, y + 1, 4, 3);
  },

  // Generic item renderer (small box with color)
  genericItem: function(x, y, color1, color2) {
    ctx.fillStyle = color1;
    ctx.fillRect(x + 4, y + 4, 16, 16);
    ctx.fillStyle = color2;
    ctx.fillRect(x + 6, y + 6, 12, 12);
  }
};

function drawTile(floor, row, col) {
  const tile = floor.grid[row][col];
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const palette = floor.palette;

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
        SPRITES.cat(x, y - 4, '#f5a623', '#ff8'); // orange tabby
        break;
      case 'front_door':
        SPRITES.door(x, y, !gameState.flags.front_door_unlocked);
        break;
      case 'cat_olive':
        SPRITES.treadmill(x, y);
        SPRITES.cat(x, y - 2, '#808080', '#aaa'); // gray cat
        break;
      case 'cat_beatrice':
        SPRITES.bed(x, y, true);
        // Beatrice is always visible, sitting on top of the bed
        SPRITES.cat(x + 2, y + 6, '#2a2a2a', '#ffb6c1'); // black cat, positioned on bed
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

      // New items with simple generic rendering
      case 'microwave':
        SPRITES.genericItem(x, y, '#c0c0c0', '#444');
        break;
      case 'trash_can':
        SPRITES.genericItem(x, y, '#666', '#444');
        break;
      case 'spice_rack':
        SPRITES.genericItem(x, y, '#d2691e', '#8b4513');
        break;
      case 'china_cabinet':
        SPRITES.genericItem(x, y, '#8b7355', '#d4a574');
        break;
      case 'plant':
      case 'plant_hallway':
        SPRITES.genericItem(x, y, '#228b22', '#90ee90');
        break;
      case 'game_console':
        SPRITES.genericItem(x, y, '#000', '#4169e1');
        break;
      case 'riddle_board':
        SPRITES.genericItem(x, y, '#c79c4c', '#7a5c1b');
        break;
      case 'side_table':
        SPRITES.genericItem(x, y, '#8b6914', '#daa520');
        break;
      case 'reading_chair':
        SPRITES.armchair(x, y);
        break;
      case 'bathroom_mirror':
        SPRITES.genericItem(x, y, '#add8e6', '#87ceeb');
        break;
      case 'towel_rack':
        SPRITES.genericItem(x, y, '#c0c0c0', '#fff');
        break;
      case 'rug':
        SPRITES.genericItem(x, y, '#8b0000', '#dc143c');
        break;
      case 'wall_art':
        SPRITES.genericItem(x, y, '#ffd700', '#ffb347');
        break;
      case 'coat_rack':
        SPRITES.genericItem(x, y, '#654321', '#8b4513');
        break;

      // Basement items
      case 'weights':
        SPRITES.genericItem(x, y, '#708090', '#2f4f4f');
        break;
      case 'exercise_bike':
        SPRITES.genericItem(x, y, '#ff4500', '#000');
        break;
      case 'yoga_mat':
        SPRITES.genericItem(x, y, '#9370db', '#8a2be2');
        break;
      case 'storage_box':
        SPRITES.genericItem(x, y, '#d2691e', '#8b4513');
        break;
      case 'washer':
        SPRITES.genericItem(x, y, '#f0f0f0', '#4682b4');
        break;
      case 'dryer':
        SPRITES.genericItem(x, y, '#f0f0f0', '#ff6347');
        break;
      case 'laundry_basket_storage':
        SPRITES.genericItem(x, y, '#deb887', '#d2691e');
        break;
      case 'cleaning_supplies':
        SPRITES.genericItem(x, y, '#ffff00', '#32cd32');
        break;
      case 'pool_table':
        SPRITES.genericItem(x, y, '#228b22', '#8b4513');
        break;
      case 'mini_fridge':
        SPRITES.genericItem(x, y, '#c0c0c0', '#000');
        break;
      case 'gaming_setup':
        SPRITES.genericItem(x, y, '#000', '#ff00ff');
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
  basement: { r: 0, g: 0, b: 0, a: 0.2 },          // dim
  upstairs: { r: 255, g: 230, b: 200, a: 0.06 }    // soft warm
};

// Light source definitions per floor: {row, col, radius, color, flicker}
var FLOOR_LIGHTS = {
  outside: [],
  main: [
    { row: 6, col: 6, radius: 72, color: '255,240,200', flicker: true },  // floor lamp
    { row: 6, col: 15, radius: 60, color: '100,160,255', flicker: true }, // TV
    { row: 3, col: 5, radius: 40, color: '255,180,80', flicker: false },  // stove
  ],
  basement: [
    { row: 7, col: 10, radius: 64, color: '200,200,255', flicker: false }, // overhead light area
  ],
  upstairs: [
    { row: 3, col: 13, radius: 56, color: '255,240,200', flicker: true },  // bedside lamp area
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

  updateMovement();
  updateParticles();
  updateScreenShake();
  updateInteractPrompt();
  render();
  requestAnimationFrame(gameLoop);
}

// ======================== INPUT HANDLING ========================

document.addEventListener('keydown', function(e) {
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

document.addEventListener('keyup', function(e) {
  keysDown[e.code] = false;
});

window.addEventListener('blur', function() {
  Object.keys(keysDown).forEach(function(key) { keysDown[key] = false; });
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
      interval = setInterval(function() { tryMove(dir); }, 150);
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

function saveGame() {
  const data = {
    currentFloor: gameState.currentFloor,
    player: { row: gameState.player.row, col: gameState.player.col, facing: gameState.player.facing },
    inventory: gameState.inventory,
    flags: gameState.flags
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage might be unavailable
  }
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
  try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
}

// ======================== NUMPAD ========================

let numpadCallback = null;

function showNumpad(onSubmit) {
  numpadCallback = onSubmit;
  const input = document.getElementById('numpad-input');
  input.value = '';
  document.getElementById('numpad-error').textContent = '';
  document.getElementById('numpad-overlay').classList.add('active');
  setTimeout(function() { input.focus(); }, 50);
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

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) hideNumpad();
  });

  input.addEventListener('input', function() {
    input.value = input.value.replace(/[^0-9]/g, '');
    document.getElementById('numpad-error').textContent = '';
    if (input.value.length > 0) {
      playSfx('numpad_beep');
    }
    if (input.value.length === 4) {
      numpadSubmit();
    }
  });

  input.addEventListener('keydown', function(e) {
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
  clearSave();
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
    front_door_unlocked: false
  };
  renderInventory();
  updateFloorLabel();
  updateQuestCounter();
  updateQuestList();
  hideTitleScreen();
  startMusic('outside');
}

function continueGame() {
  initAudio();
  renderInventory();
  updateFloorLabel();
  updateQuestCounter();
  updateQuestList();
  hideTitleScreen();
  startMusic(gameState.currentFloor);
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

  // Title screen buttons
  document.getElementById('btn-new-game').addEventListener('click', function() {
    startNewGame();
  });

  const continueBtn = document.getElementById('btn-continue');
  if (loadGame()) {
    continueBtn.style.display = 'inline-block';
    continueBtn.addEventListener('click', function() {
      continueGame();
    });
  } else {
    continueBtn.style.display = 'none';
  }

  // Ending screen restart
  document.getElementById('btn-restart').addEventListener('click', function() {
    restartGame();
  });

  // Dialogue overlay click to advance
  dialogueOverlay.addEventListener('click', function() {
    advanceDialogue();
  });

  // Quest panel toggle
  const questPanel = document.getElementById('quest-panel');
  const btnToggleQuest = document.getElementById('btn-toggle-quest');
  const btnCloseQuest = document.getElementById('btn-close-quest');

  btnToggleQuest.addEventListener('click', function() {
    questPanel.classList.toggle('active');
    // Close settings if open
    document.getElementById('settings-panel').classList.remove('active');
  });

  btnCloseQuest.addEventListener('click', function() {
    questPanel.classList.remove('active');
  });

  // Settings panel toggle
  const settingsPanel = document.getElementById('settings-panel');
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  btnToggleSettings.addEventListener('click', function() {
    settingsPanel.classList.toggle('active');
    // Close quest if open
    questPanel.classList.remove('active');
  });

  btnCloseSettings.addEventListener('click', function() {
    settingsPanel.classList.remove('active');
  });

  // Settings volume sliders
  const sfxVolume = document.getElementById('sfx-volume');
  const sfxValue = document.getElementById('sfx-value');
  const musicVolume = document.getElementById('music-volume');
  const musicValue = document.getElementById('music-value');

  sfxVolume.addEventListener('input', function() {
    sfxValue.textContent = this.value + '%';
    updateAudioVolumes();
  });

  musicVolume.addEventListener('input', function() {
    musicValue.textContent = this.value + '%';
    updateAudioVolumes();
  });

  document.getElementById('btn-save-settings').addEventListener('click', function() {
    showToast('Settings saved!', 1500);
    settingsPanel.classList.remove('active');
  });

  // Start game loop
  requestAnimationFrame(gameLoop);
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', init);
