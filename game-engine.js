/*
 * game-engine.js — Marice & Cats: The Great Treat Heist — Core engine
 * State, audio, dialogue, world, rendering, save/load.
 * Load after data/maps.js and data/dialogue.js.
 */

// ======================== CONSTANTS ========================
const FLOOR_IDS = {
  OUTSIDE: 'outside',
  MAIN: 'main',
  BASEMENT: 'basement',
  UPSTAIRS: 'upstairs',
  GARDEN: 'garden'
};

const ITEMS = {
  PURRPOPS: 'purrpops',
  FEAST_PLATE: 'feast_plate',
  BASEMENT_KEY: 'basement_key',
  LAUNDRY_BASKET: 'laundry_basket'
};

// ======================== GLOBALS ========================

// The front-door code is encoded in the riddle: 3 cats + 1 Marice = 4 → "3134"
const FRONT_DOOR_CODE = '3134';

const canvas = document.getElementById('game-canvas');
// Reassignable so static layers (tiles, minimap) can be pre-rendered into
// offscreen canvases by temporarily pointing the shared ctx at them.
let ctx = canvas.getContext('2d');

const CANVAS_W = MAP_COLS * TILE_SIZE; // 480
const CANVAS_H = MAP_ROWS * TILE_SIZE; // 360

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Scale canvas for display.
// Reserve space for HUD and on-screen controls, with a small margin.
function resizeCanvas() {
  var desktopLike = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var vv = window.visualViewport;
  var viewportW = vv ? vv.width : window.innerWidth;
  var viewportH = vv ? vv.height : window.innerHeight;

  var hudEl = document.getElementById('hud');
  var hudH = hudEl ? hudEl.getBoundingClientRect().height : 32;

  function bottomReserveFromElement(el) {
    if (!el || el.offsetParent === null) return 0;
    var r = el.getBoundingClientRect();
    return Math.max(0, viewportH - r.top + 10);
  }

  // On desktop, touch controls are hidden via CSS, so reserve less space.
  var bottomH = desktopLike ? 90 : 0;
  bottomH = Math.max(
    bottomH,
    bottomReserveFromElement(document.getElementById('mobile-controls')),
    bottomReserveFromElement(document.getElementById('inventory-bar')),
    bottomReserveFromElement(document.getElementById('bottom-buttons')),
    bottomReserveFromElement(document.getElementById('controls-hint'))
  );

  var margin = 10;
  var maxW = viewportW - margin * 2;
  var maxH = viewportH - hudH - bottomH;
  if (maxW <= 0 || maxH <= 0) return;
  var scaleW = maxW / CANVAS_W;
  var scaleH = maxH / CANVAS_H;
  var scale = Math.min(scaleW, scaleH, 3);
  if (!isFinite(scale) || scale <= 0) scale = 1;
  canvas.style.width = (CANVAS_W * scale) + 'px';
  canvas.style.height = (CANVAS_H * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeCanvas);
  window.visualViewport.addEventListener('scroll', resizeCanvas);
}
resizeCanvas();

// ======================== GAME STATE ========================

const DEFAULT_FLAGS = {
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
  garden_visited: false,
  cat_toys_found: [],
  diary_pages_found: [],
  pet_count: 0
};

// Free-roam mode: after the ending the player can keep exploring with the
// whole cat parade trailing behind them.
let freeRoam = false;

// Cat coat colours (body, accent) — shared by static sprites and followers.
const CAT_COLORS = {
  alice: ['#c8722e', '#f0c070'],
  olive: ['#6b92c8', '#c2d8f0'],
  beatrice: ['#21211f', '#5d5e53']
};

// Fixed join order — cats always join in the order the player feeds them.
const CAT_ORDER = ['alice', 'olive', 'beatrice'];

// Returns the list of cats currently following Marice, nearest-first.
function getFollowers() {
  return CAT_ORDER.filter(function (name) { return gameState.flags[name + '_fed']; });
}

let gameState = {
  currentFloor: FLOOR_IDS.OUTSIDE,
  player: { row: outsideStart.row, col: outsideStart.col, facing: 'down' },
  inventory: [],          // array of item ID strings
  flags: Object.assign({}, DEFAULT_FLAGS, { cat_toys_found: [], diary_pages_found: [] }),
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

// ---- Follower trail (cats trailing behind Marice) ----
// Ring buffer of recent player center positions {x, y, facing}, newest first.
let playerTrail = [];
// Spacing (in trail samples) between each follower in the conga line.
const FOLLOWER_GAP = 11;
const TRAIL_MAX = FOLLOWER_GAP * 4 + 4;

function trailReset() {
  const p = gameState.player;
  const cx = p.col * TILE_SIZE + TILE_SIZE / 2;
  const cy = p.row * TILE_SIZE + TILE_SIZE / 2;
  playerTrail = [];
  for (let i = 0; i < TRAIL_MAX; i++) {
    playerTrail.push({ x: cx, y: cy, facing: p.facing });
  }
}

function trailPush(x, y, facing) {
  // Only record a new sample once Marice has actually moved a little — otherwise
  // standing still would collapse the whole parade onto her.
  const head = playerTrail[0];
  if (head && Math.hypot(x - head.x, y - head.y) < 2) {
    head.facing = facing;
    return;
  }
  playerTrail.unshift({ x: x, y: y, facing: facing });
  if (playerTrail.length > TRAIL_MAX) playerTrail.length = TRAIL_MAX;
}

// Pause state
let gamePaused = false;

// Game session start time (for stats)
let gameStartTime = null;
// Play time carried over from previous sessions (persisted in the save),
// so the ending screen shows total time, not just the current session.
let playTimeOffsetMs = 0;

function getTotalPlayTimeMs() {
  return playTimeOffsetMs + (gameStartTime ? Date.now() - gameStartTime : 0);
}

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

function triggerHaptic(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms || 10); } catch (e) {}
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
let musicFading = false;

// Ambient sound (floor drone)
let ambientOsc = null;
let ambientGainNode = null;

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
  if (musicFading) return; // don't interrupt crossfade
  var sfxSlider = document.getElementById('sfx-volume');
  var musicSlider = document.getElementById('music-volume');
  var musicMute = document.getElementById('music-mute');
  var sfxVol = sfxSlider ? parseInt(sfxSlider.value) / 100 : 0.7;
  var musicVol = musicSlider ? parseInt(musicSlider.value) / 100 : 0.5;
  if (musicMute && musicMute.checked) musicVol = 0;
  sfxGainNode.gain.setValueAtTime(sfxVol, audioCtx.currentTime);
  musicGainNode.gain.setValueAtTime(musicVol * 0.3, audioCtx.currentTime); // music quieter
}

// --- SFX: procedural chiptune sounds ---

function playSfx(type, opt) {
  if (!audioCtx) return;
  updateAudioVolumes();
  switch (type) {
    case 'footstep': sfxFootstep(opt); break;
    case 'interact': sfxInteract(); break;
    case 'item_pickup': sfxItemPickup(); break;
    case 'door_unlock': sfxDoorUnlock(); break;
    case 'cat_meow': sfxCatMeow(opt); break;
    case 'cat_purr': sfxCatPurr(); break;
    case 'cat_fed': sfxCatFed(); break;
    case 'numpad_beep': sfxNumpadBeep(); break;
    case 'error': sfxError(); break;
    case 'typewriter': sfxTypewriter(); break;
  }
}

// Shared white-noise buffer for soft footstep textures (grass, carpet).
var noiseBuffer = null;
function getNoiseBuffer() {
  if (!noiseBuffer) {
    noiseBuffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.1), audioCtx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Play a filtered noise burst — the basis for soft organic footsteps.
function playNoiseStep(filterType, filterFreq, vol, dur) {
  var t = audioCtx.currentTime;
  var src = audioCtx.createBufferSource();
  src.buffer = getNoiseBuffer();
  var filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq + Math.random() * filterFreq * 0.3, t);
  var gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGainNode);
  src.start(t);
  src.stop(t + dur);
}

// Footsteps sound like the surface underfoot: wood creaks indoors, concrete
// clicks on the walkway, carpet muffles upstairs, grass swishes in the yard.
function sfxFootstep(surface) {
  var t = audioCtx.currentTime;
  switch (surface) {
    case 'grass':
      playNoiseStep('bandpass', 1400, 0.10, 0.07);
      return;
    case 'carpet':
      playNoiseStep('lowpass', 380, 0.14, 0.09);
      return;
    case 'concrete': {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(210 + Math.random() * 50, t);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(sfxGainNode);
      osc.start(t);
      osc.stop(t + 0.05);
      return;
    }
    default: { // wood
      var osc2 = audioCtx.createOscillator();
      var gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(120 + Math.random() * 40, t);
      gain2.gain.setValueAtTime(0.15, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc2.connect(gain2);
      gain2.connect(sfxGainNode);
      osc2.start(t);
      osc2.stop(t + 0.08);
    }
  }
}

// Which surface is Marice walking on right now?
function getFootstepSurface() {
  var fid = gameState.currentFloor;
  if (fid === FLOOR_IDS.BASEMENT) return 'concrete';
  if (fid === FLOOR_IDS.UPSTAIRS) return 'carpet';
  if (fid === FLOOR_IDS.MAIN) return 'wood';
  var p = gameState.player;
  if (fid === FLOOR_IDS.OUTSIDE) {
    // Porch deck is wood; walkway and street are hard surfaces.
    if (p.row < 6) return 'wood';
    return 'concrete';
  }
  if (fid === FLOOR_IDS.GARDEN) {
    // Wooden deck by the house; lawn everywhere else.
    if (p.row <= 4 && p.col >= 5 && p.col <= 14) return 'wood';
    return 'grass';
  }
  return 'wood';
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

// Each cat has her own voice: Alice a prim mid-high meow, Olive two quick
// excited chirps, Beatrice a low dramatic drawl. No name = generic meow.
// Accepts a cat name string, or { name, volume } — volume (0..1) lets a
// far-away cat sound fainter than one right next to Marice.
function sfxCatMeow(opt) {
  var catName = typeof opt === 'string' ? opt : (opt && opt.name);
  var volMul = (opt && typeof opt === 'object' && opt.volume != null) ? opt.volume : 1;
  var t = audioCtx.currentTime;

  if (catName === 'olive') {
    // Two quick rising chirps
    [0, 0.16].forEach(function (delay) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720 + Math.random() * 60, t + delay);
      osc.frequency.linearRampToValueAtTime(1020 + Math.random() * 80, t + delay + 0.08);
      gain.gain.setValueAtTime(0.13 * volMul, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);
      osc.connect(gain);
      gain.connect(sfxGainNode);
      osc.start(t + delay);
      osc.stop(t + delay + 0.12);
    });
    return;
  }

  var voices = {
    alice: { start: 620, peak: 880, end: 460, dur: 0.32, vol: 0.15 },
    beatrice: { start: 320, peak: 470, end: 220, dur: 0.5, vol: 0.16 }
  };
  var v = voices[catName] || { start: 500, peak: 720, end: 420, dur: 0.35, vol: 0.15 };

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(v.start + Math.random() * 60, t);
  osc.frequency.linearRampToValueAtTime(v.peak + Math.random() * 80, t + v.dur * 0.3);
  osc.frequency.linearRampToValueAtTime(v.end + Math.random() * 50, t + v.dur * 0.85);
  gain.gain.setValueAtTime(v.vol * volMul, t);
  gain.gain.setValueAtTime(v.vol * volMul, t + v.dur * 0.45);
  gain.gain.exponentialRampToValueAtTime(0.001, t + v.dur);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(t);
  osc.stop(t + v.dur);
}

function sfxCatPurr() {
  // Low, warm amplitude-modulated rumble — a contented purr.
  var t = audioCtx.currentTime;
  var osc = audioCtx.createOscillator();
  var lfo = audioCtx.createOscillator();
  var lfoGain = audioCtx.createGain();
  var gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(55, t);
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(26, t); // purr flutter rate
  lfoGain.gain.setValueAtTime(0.06, t);
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.setValueAtTime(0.08, t + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(t); lfo.start(t);
  osc.stop(t + 0.75); lfo.stop(t + 0.75);
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
  var twToggle = document.getElementById('typewriter-sound');
  if (twToggle && !twToggle.checked) return;
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
var musicStartTimer = null;
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
  },
  garden: {
    notes: [392, 440, 523, 587, 523, 494, 440, 330],
    tempo: 340, type: 'sine'
  }
};

function startMusic(floorId) {
  if (!audioCtx) return;
  var data = MUSIC_DATA[floorId];
  if (!data) return;

  if (musicPlaying) {
    // Crossfade: fade out current music then start new
    stopMusic();
    musicFading = true;
    musicGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    musicGainNode.gain.setValueAtTime(musicGainNode.gain.value, audioCtx.currentTime);
    musicGainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
    musicStartTimer = setTimeout(function () {
      musicStartTimer = null;
      musicFading = false;
      musicNoteIndex = 0;
      currentMusic = floorId;
      musicPlaying = true;
      updateAudioVolumes();
      playMusicNote(data);
    }, 450);
  } else {
    stopMusic();
    musicNoteIndex = 0;
    currentMusic = floorId;
    musicPlaying = true;
    playMusicNote(data);
  }
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
  musicFading = false;
  if (musicLoopTimer) {
    clearTimeout(musicLoopTimer);
    musicLoopTimer = null;
  }
  // Cancel any crossfade that was about to start the next floor's track,
  // so quitting to title mid-transition doesn't restart music later.
  if (musicStartTimer) {
    clearTimeout(musicStartTimer);
    musicStartTimer = null;
  }
  currentMusic = null;
}

// ---- Real time of day ----
// The world outside follows the player's actual clock: bright at noon,
// golden in the evening, dark with porch lights and crickets at night.
function getDaypart() {
  var h = new Date().getHours();
  if (h >= 21 || h < 5) return 'night';
  if (h < 10) return 'morning';
  if (h < 17) return 'day';
  return 'evening';
}

// --- Ambient sound (low drone per floor) ---
function startAmbient(floorId) {
  stopAmbient();
  if (!audioCtx) return;
  if (floorId === FLOOR_IDS.GARDEN || floorId === FLOOR_IDS.OUTSIDE) {
    scheduleBirdsong();
  }
  var cfgs = {
    basement: { freq: 58, type: 'sine', vol: 0.018 },
    main: { freq: 120, type: 'sine', vol: 0.006 } // faint fridge hum
  };
  var cfg = cfgs[floorId];
  if (!cfg) return;
  ambientOsc = audioCtx.createOscillator();
  ambientGainNode = audioCtx.createGain();
  ambientOsc.type = cfg.type;
  ambientOsc.frequency.setValueAtTime(cfg.freq, audioCtx.currentTime);
  ambientGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  ambientGainNode.gain.linearRampToValueAtTime(cfg.vol, audioCtx.currentTime + 2.0);
  ambientOsc.connect(ambientGainNode);
  ambientGainNode.connect(audioCtx.destination);
  ambientOsc.start(audioCtx.currentTime);
}

// Occasional outdoor wildlife — birdsong by day, crickets after dark —
// rescheduled at a random interval so it never sounds looped.
var birdsongTimer = null;

function scheduleBirdsong() {
  if (birdsongTimer) clearTimeout(birdsongTimer);
  birdsongTimer = setTimeout(function () {
    if (getDaypart() === 'night') {
      playCricketChirp();
    } else {
      playBirdChirp();
    }
    scheduleBirdsong();
  }, 2500 + Math.random() * 5000);
}

// Cricket chirp — a rapid pulse train of soft high blips, the sound of a
// real backyard after dark.
function playCricketChirp() {
  if (!audioCtx) return;
  var t = audioCtx.currentTime;
  var pulses = 4 + Math.floor(Math.random() * 4);
  var freq = 4200 + Math.random() * 600;
  for (var i = 0; i < pulses; i++) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    var start = t + i * 0.045;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.02, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.035);
    osc.connect(gain);
    gain.connect(sfxGainNode);
    osc.start(start);
    osc.stop(start + 0.04);
  }
}

function playBirdChirp() {
  if (!audioCtx) return;
  var t = audioCtx.currentTime;
  var chirps = 2 + Math.floor(Math.random() * 2);
  var baseFreq = 2200 + Math.random() * 900;
  for (var i = 0; i < chirps; i++) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    var start = t + i * 0.13;
    osc.frequency.setValueAtTime(baseFreq, start);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, start + 0.05);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.03, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
    osc.connect(gain);
    gain.connect(sfxGainNode);
    osc.start(start);
    osc.stop(start + 0.12);
  }
}

function stopAmbient() {
  if (birdsongTimer) {
    clearTimeout(birdsongTimer);
    birdsongTimer = null;
  }
  if (ambientOsc) {
    var oscRef = ambientOsc;
    var gainRef = ambientGainNode;
    ambientOsc = null;
    ambientGainNode = null;
    try {
      if (gainRef) {
        gainRef.gain.setValueAtTime(gainRef.gain.value, audioCtx.currentTime);
        gainRef.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      }
      setTimeout(function () { try { oscRef.stop(); } catch (e) {} }, 600);
    } catch (e) {}
  }
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
    img.onerror = function () {
      img._loadFailed = true;
    };
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

  // Cat meow when talking to a cat — each cat has her own voice
  if (catName) {
    playSfx('cat_meow', catName);
  }

  showDialogueMessage();
  dialogueOverlay.classList.add('active');
  dialogueOverlay.setAttribute('aria-hidden', 'false');
}

function showDialogueMessage() {
  const msg = dialogueQueue[dialogueIndex];
  if (!msg) return;

  // Show cat + Marice portraits together during cat dialogues (hide if any failed to load)
  const catImg = dialogueCat && portraits[dialogueCat];
  const mariceImg = portraits.marice;
  const showPortraits = catImg && mariceImg && !catImg._loadFailed && !mariceImg._loadFailed;
  if (showPortraits) {
    dialoguePortraitCat.src = catImg.src;
    dialoguePortraitMarice.src = mariceImg.src;
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
  dialogueAdvance.textContent = 'Tap / Space to show full text';
  dialogueAdvance.style.visibility = 'hidden';

  var instantCb = document.getElementById('instant-dialogue');
  if (instantCb && instantCb.checked) {
    typewriterIndex = typewriterText.length;
    dialogueText.textContent = typewriterText;
    typewriterDone = true;
    dialogueAdvance.textContent = 'Tap / Space / Enter to continue';
    dialogueAdvance.style.visibility = 'visible';
    return;
  }

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
  dialogueAdvance.textContent = 'Tap / Space / Enter to continue';
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
  dialogueOverlay.setAttribute('aria-hidden', 'true');

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
  dialogueOverlay.setAttribute('aria-hidden', 'true');

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
  if (gameState.flags.game_complete) {
    // Free roam: point at the backyard first, then any unfound toys or diary pages
    if (!gameState.flags.garden_visited) {
      return 'The sliding door in the dining room is open now — take the girls out to the backyard!';
    }
    var toysFound = Array.isArray(gameState.flags.cat_toys_found) ? gameState.flags.cat_toys_found.length : 0;
    if (toysFound < 3) {
      return 'Stashed toy loot: ' + toysFound + '/3 recovered. Check behind furniture!';
    }
    var pagesFound = Array.isArray(gameState.flags.diary_pages_found) ? gameState.flags.diary_pages_found.length : 0;
    if (pagesFound < 4) {
      return 'Diary pages: ' + pagesFound + '/4 found. They glow softly — one on each floor!';
    }
    return null;
  }

  if (!gameState.flags.front_door_unlocked) {
    return 'The front door code is hidden in the house plaque riddle outside.';
  }
  if (!gameState.flags.alice_fed) {
    return hasItem(ITEMS.PURRPOPS)
      ? 'Pay the witness: bring Alice her Purrpops consulting fee.'
      : 'Witness Alice won’t talk for free — grab Purrpops from the kitchen cupboards.';
  }
  if (!gameState.flags.has_basement_key && !gameState.flags.basement_unlocked) {
    return 'Alice’s tip: the Basement Key is under the sofa blanket.';
  }
  if (!gameState.flags.basement_unlocked) {
    return hasItem(ITEMS.BASEMENT_KEY)
      ? 'The trail leads down — unlock the basement door.'
      : 'Look for the Basement Key near the sofa.';
  }
  if (!gameState.flags.olive_fed) {
    return hasItem(ITEMS.PURRPOPS)
      ? 'Interrogate Olive in the basement — she talks for Purrpops.'
      : 'Suspect Olive demands interrogation snacks — more Purrpops from the kitchen.';
  }
  if (!gameState.flags.laundry_cleared) {
    return hasItem(ITEMS.LAUNDRY_BASKET)
      ? 'Clear the staged laundry avalanche on the main-floor stairs.'
      : 'Talk to Olive in the basement — you need her help to clear the stairs.';
  }
  if (!gameState.flags.beatrice_fed) {
    return hasItem(ITEMS.FEAST_PLATE)
      ? 'Confront the mastermind: Beatrice trades her confession for the feast.'
      : 'Beatrice’s price for a confession: a Shrimp & Salmon Feast from the kitchen cupboards.';
  }
  // Side-quest: stashed toy loot
  if (!gameState.flags.cat_toys_found || gameState.flags.cat_toys_found.length < 3) {
    var found = gameState.flags.cat_toys_found ? gameState.flags.cat_toys_found.length : 0;
    return 'Stashed toy loot: ' + found + '/3 recovered. Check behind furniture!';
  }
  // Side-quest: diary pages
  if (!gameState.flags.diary_pages_found || gameState.flags.diary_pages_found.length < 4) {
    var pages = gameState.flags.diary_pages_found ? gameState.flags.diary_pages_found.length : 0;
    return 'Diary pages: ' + pages + '/4 found. They glow softly — one on each floor!';
  }
  return null;
}

// ======================== OBJECTIVE PING (HINT TARGET) ========================

let objectivePing = null; // { floorId, row, col, label }
let objectivePingUntil = 0;

function findInteractableByType(floorId, type) {
  const floor = FLOORS[floorId];
  if (!floor) return null;
  for (const obj of floor.interactables) {
    if (obj.type === type) return obj;
  }
  return null;
}

function getNextTaskTarget() {
  if (gameState.flags.game_complete) {
    if (!gameState.flags.garden_visited) {
      const slider = findInteractableByType(FLOOR_IDS.MAIN, 'sliding_door');
      if (slider) return { floorId: FLOOR_IDS.MAIN, row: slider.row, col: slider.col, label: slider.label || 'Sliding Door' };
    }
    return findNextToyTarget() || findNextDiaryTarget();
  }

  if (!gameState.flags.front_door_unlocked) {
    const plaque = findInteractableByType(FLOOR_IDS.OUTSIDE, 'riddle_board');
    if (plaque) return { floorId: FLOOR_IDS.OUTSIDE, row: plaque.row, col: plaque.col, label: plaque.label || 'House Rules Plaque' };
    const door = findInteractableByType(FLOOR_IDS.OUTSIDE, 'front_door');
    if (door) return { floorId: FLOOR_IDS.OUTSIDE, row: door.row, col: door.col, label: door.label || 'Front Door' };
    return { floorId: FLOOR_IDS.OUTSIDE, row: outsideStart.row, col: outsideStart.col, label: 'Front Entry' };
  }

  if (!gameState.flags.alice_fed) {
    if (hasItem(ITEMS.PURRPOPS)) {
      const alice = findInteractableByType(FLOOR_IDS.MAIN, 'cat_alice');
      if (alice) return { floorId: FLOOR_IDS.MAIN, row: alice.row, col: alice.col, label: alice.label || 'Alice' };
    }
    const cupboard = findInteractableByType(FLOOR_IDS.MAIN, 'cupboard_purrpops');
    if (cupboard) return { floorId: FLOOR_IDS.MAIN, row: cupboard.row, col: cupboard.col, label: cupboard.label || 'Cupboard' };
  }

  if (!gameState.flags.has_basement_key && !gameState.flags.basement_unlocked) {
    const sofa = findInteractableByType(FLOOR_IDS.MAIN, 'sofa_blanket');
    if (sofa) return { floorId: FLOOR_IDS.MAIN, row: sofa.row, col: sofa.col, label: sofa.label || 'Sofa' };
  }

  if (!gameState.flags.basement_unlocked) {
    const basementDoor = findInteractableByType(FLOOR_IDS.MAIN, 'basement_door');
    if (basementDoor) return { floorId: FLOOR_IDS.MAIN, row: basementDoor.row, col: basementDoor.col, label: basementDoor.label || 'Basement Door' };
  }

  if (!gameState.flags.olive_fed) {
    if (hasItem(ITEMS.PURRPOPS)) {
      const olive = findInteractableByType(FLOOR_IDS.BASEMENT, 'cat_olive');
      if (olive) return { floorId: FLOOR_IDS.BASEMENT, row: olive.row, col: olive.col, label: olive.label || 'Olive' };
    }
    const cupboard = findInteractableByType(FLOOR_IDS.MAIN, 'cupboard_purrpops');
    if (cupboard) return { floorId: FLOOR_IDS.MAIN, row: cupboard.row, col: cupboard.col, label: cupboard.label || 'Cupboard' };
  }

  if (!gameState.flags.laundry_cleared) {
    // No interactable tile; target the stair pile area.
    return { floorId: FLOOR_IDS.MAIN, row: 6, col: 10, label: 'Blocked Stairs' };
  }

  if (!gameState.flags.beatrice_fed) {
    if (hasItem(ITEMS.FEAST_PLATE)) {
      const beatrice = findInteractableByType(FLOOR_IDS.UPSTAIRS, 'cat_beatrice');
      if (beatrice) return { floorId: FLOOR_IDS.UPSTAIRS, row: beatrice.row, col: beatrice.col, label: beatrice.label || 'Beatrice' };
    }
    const cupboard = findInteractableByType(FLOOR_IDS.MAIN, 'cupboard_feast');
    if (cupboard) return { floorId: FLOOR_IDS.MAIN, row: cupboard.row, col: cupboard.col, label: cupboard.label || 'Cupboard' };
  }

  // Side quests: guide to the next unfound toy, then any missing diary page.
  return findNextToyTarget() || findNextDiaryTarget();
}

// First unfound hidden toy across all floors, or null when all are found.
function findNextToyTarget() {
  const found = Array.isArray(gameState.flags.cat_toys_found) ? gameState.flags.cat_toys_found : [];
  if (found.length >= 3) return null;
  for (const [floorId, floor] of Object.entries(FLOORS)) {
    for (const obj of floor.interactables) {
      if (!obj.type || !obj.type.startsWith('cat_toy_')) continue;
      const toyId = obj.type.replace('cat_toy_', '');
      if (found.includes(toyId)) continue;
      return { floorId, row: obj.row, col: obj.col, label: obj.label || 'Hidden Toy' };
    }
  }
  return null;
}

// First unfound diary page across all floors, or null when all are found.
function findNextDiaryTarget() {
  const found = Array.isArray(gameState.flags.diary_pages_found) ? gameState.flags.diary_pages_found : [];
  if (found.length >= DIARY_PAGE_IDS.length) return null;
  for (const [floorId, floor] of Object.entries(FLOORS)) {
    for (const obj of floor.interactables) {
      if (!obj.type || !obj.type.startsWith('diary_page_')) continue;
      const pageId = obj.type.replace('diary_page_', '');
      if (found.includes(pageId)) continue;
      return { floorId, row: obj.row, col: obj.col, label: obj.label || 'Diary Page' };
    }
  }
  return null;
}

function setObjectivePing(target, durationMs) {
  durationMs = durationMs || 8000;
  if (!target) return;
  objectivePing = {
    floorId: target.floorId,
    row: target.row,
    col: target.col,
    label: target.label || 'Objective'
  };
  objectivePingUntil = Date.now() + durationMs;
}

function showHintAndPing() {
  const hint = getNextTaskHint();
  const target = getNextTaskTarget();
  if (target) {
    setObjectivePing(target, 9000);
  }

  if (!hint) {
    showToast('No hint right now.', 2000);
    return;
  }

  if (target && target.floorId && target.floorId !== gameState.currentFloor) {
    const floorName = (typeof FLOOR_NAMES !== 'undefined' && FLOOR_NAMES[target.floorId]) ? FLOOR_NAMES[target.floorId] : target.floorId;
    showToast(`Hint: ${hint} (Go to ${floorName})`, 5000);
  } else {
    showToast(`Hint: ${hint}`, 4500);
  }
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
  counter.textContent = `Case: ${fed}/3 cats cracked`;
}

function updateQuestList() {
  const quests = document.querySelectorAll('.quest-item');

  // Cat feeding quests (rows 0-2, in CAT_ORDER)
  CAT_ORDER.forEach(function (catName, i) {
    if (!quests[i]) return;
    const status = quests[i].querySelector('.quest-status');
    const fed = gameState.flags[catName + '_fed'];
    status.textContent = fed ? '✅' : '⏳';
    status.classList.toggle('complete', fed);
    status.classList.toggle('pending', !fed);
  });

  // Hidden cat toys side quest
  const toysItem = document.getElementById('quest-item-toys');
  if (toysItem) {
    const status = toysItem.querySelector('.quest-status');
    const found = Array.isArray(gameState.flags.cat_toys_found) ? gameState.flags.cat_toys_found.length : 0;
    status.textContent = found >= 3 ? '✅' : found + '/3';
    status.classList.toggle('complete', found >= 3);
    status.classList.toggle('pending', found < 3);
  }

  // Diary pages side quest
  const diaryItem = document.getElementById('quest-item-diary');
  if (diaryItem) {
    const status = diaryItem.querySelector('.quest-status');
    const pages = Array.isArray(gameState.flags.diary_pages_found) ? gameState.flags.diary_pages_found.length : 0;
    status.textContent = pages >= 4 ? '✅' : pages + '/4';
    status.classList.toggle('complete', pages >= 4);
    status.classList.toggle('pending', pages < 4);
  }
}

// ======================== INVENTORY ========================

function addItem(itemId) {
  gameState.inventory.push(itemId);
  renderInventory();
  saveGame();

  // Spawn particles at player location — float the item's icon up as feedback
  const px = gameState.player.col * TILE_SIZE + TILE_SIZE / 2;
  const py = gameState.player.row * TILE_SIZE + TILE_SIZE / 2;
  spawnParticles(px, py, 8, '#ffd700');
  const display = ITEM_DISPLAY[itemId];
  spawnTextParticle(px, py - 20, display ? display.icon : '+', '#ffd700');

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
  triggerHaptic(40);
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

// Unified floor-change helper.
// When row/col are omitted the floor's default start position is used.
const FLOOR_NAMES = {
  [FLOOR_IDS.OUTSIDE]: 'Front Entry',
  [FLOOR_IDS.MAIN]: 'Main Floor',
  [FLOOR_IDS.BASEMENT]: 'Basement',
  [FLOOR_IDS.UPSTAIRS]: 'Upstairs',
  [FLOOR_IDS.GARDEN]: 'Backyard Garden'
};

function changeFloorTo(newFloor, row, col, facing) {
  var overlay = document.getElementById('transition-overlay');
  var label = document.getElementById('transition-label');

  label.textContent = FLOOR_NAMES[newFloor] || newFloor;
  overlay.classList.add('active');

  setTimeout(function () {
    gameState.currentFloor = newFloor;
    var floor = FLOORS[newFloor];
    gameState.player.row = (row !== undefined) ? row : floor.start.row;
    gameState.player.col = (col !== undefined) ? col : floor.start.col;
    gameState.player.facing = facing || 'down';
    trailReset();
    updateFloorLabel();
    saveGame();
    startMusic(newFloor);
    startAmbient(newFloor);

    setTimeout(function () {
      overlay.classList.remove('active');
    }, 400);
  }, 350);
}

// Convenience wrapper — use floor's default start position.
function changeFloor(newFloor) {
  changeFloorTo(newFloor, undefined, undefined, 'down');
}

function updateFloorLabel() {
  document.getElementById('floor-label').textContent = getCurrentFloor().name;
}

// ======================== COLLISION & MOVEMENT ========================

// Returns true when a tile can be stood on (not a wall, furniture, or counter).
// Used by loadGame to validate saved player positions.
function isWalkable(row, col, floor) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return false;
  const tile = floor.grid[row][col];
  return tile !== T.WALL && tile !== T.FURNITURE && tile !== T.COUNTER;
}

function isTileBlocked(floor, row, col) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
  const tile = floor.grid[row][col];
  if (tile === T.WALL || tile === T.FURNITURE || tile === T.COUNTER) return true;

  // Check if an interactable blocks this tile (cats, etc.)
  for (const obj of floor.interactables) {
    if (obj.row === row && obj.col === col) {
      // A fed cat has left its spot to follow Marice — walk right through it.
      if (isFollowerCatObj(obj)) continue;
      return true;
    }
  }

  return false;
}

// True when this interactable is a cat that has been fed (and is now a follower).
function isFollowerCatObj(obj) {
  if (!obj || !obj.type || obj.type.indexOf('cat_') !== 0) return false;
  const name = obj.type.replace('cat_', '');
  return CAT_ORDER.includes(name) && gameState.flags[name + '_fed'];
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
    if (obj.row === row && obj.col === col) {
      // Fed cats are followers now; their old tile is empty floor.
      if (isFollowerCatObj(obj)) continue;
      return obj;
    }
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
  triggerHaptic(8);
  playSfx('footstep', getFootstepSurface());
  checkHideControlsHint();
}

function handleStairTransition(row, col) {
  const floorId = gameState.currentFloor;

  if (floorId === FLOOR_IDS.MAIN) {
    // Check if stepping on upstairs stairs
    const s = FLOORS.main.stairs.toUpstairs;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      if (!gameState.flags.laundry_cleared) {
        if (hasItem(ITEMS.LAUNDRY_BASKET)) {
          // Player walked into the laundry pile while carrying the basket — clear it
          removeItem(ITEMS.LAUNDRY_BASKET);
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
      changeFloorTo(FLOOR_IDS.MAIN, 7, 17, 'left');
      return true;
    }
  } else if (floorId === 'upstairs') {
    const s = FLOORS.upstairs.stairs.toMain;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      // Return to main floor, place near central stairs
      changeFloorTo(FLOOR_IDS.MAIN, 8, 10, 'down');
      return true;
    }
  }

  return false;
}

function updateMovement() {
  if (!gameState.moving) {
    walkFrameTimer = 0;
    return;
  }

  // Advance the walk animation at logic rate (not render rate)
  walkFrameTimer++;
  if (walkFrameTimer >= WALK_FRAME_INTERVAL) {
    walkFrameTimer = 0;
    walkFrame++;
  }

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
    return;
  }

  // Nothing to interact with in front of us — try petting a nearby cat.
  petNearbyFollower();
}

const PET_LINES = [
  'purrs happily',
  'leans into your hand',
  'flops over for belly rubs',
  'headbutts your hand',
  'kneads the floor',
  'gives a slow, loving blink'
];

// Find the follower cat closest to Marice that's within petting reach
// (~2 tiles). Returns { name, x, y } or null.
function findPettableFollower() {
  const followers = getFollowers();
  if (followers.length === 0 || playerTrail.length === 0) return null;

  const p = gameState.player;
  const px = p.col * TILE_SIZE + TILE_SIZE / 2;
  const py = p.row * TILE_SIZE + TILE_SIZE / 2;

  let bestName = null, bestX = 0, bestY = 0, bestDist = Infinity;
  for (let i = 0; i < followers.length; i++) {
    const idx = Math.min((i + 1) * FOLLOWER_GAP, playerTrail.length - 1);
    const s = playerTrail[idx];
    if (!s) continue;
    const d = Math.hypot(s.x - px, s.y - py);
    if (d < bestDist) { bestDist = d; bestName = followers[i]; bestX = s.x; bestY = s.y; }
  }

  if (!bestName || bestDist > TILE_SIZE * 2.2) return null;
  return { name: bestName, x: bestX, y: bestY };
}

// Like a real cat, each girl can only take so much petting in one go.
// Rapid-fire pets build a streak; push it too far and she gets
// overstimulated and needs a little space before purring again.
const PET_STREAK_LIMIT = 6;
const PET_STREAK_WINDOW_MS = 4000;
const PET_COOLDOWN_MS = 8000;
let petStreak = { name: null, count: 0, lastTime: 0 };
let petCooldowns = {}; // catName -> timestamp when she's ready for pets again

// Pet the follower cat closest to Marice (if one is within reach).
function petNearbyFollower() {
  const cat = findPettableFollower();
  if (!cat) return false;

  const now = Date.now();
  const catName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);

  // She's still overstimulated — a tail flick instead of a purr.
  if (petCooldowns[cat.name] && now < petCooldowns[cat.name]) {
    playSfx('cat_meow', { name: cat.name, volume: 0.6 });
    spawnTextParticle(cat.x, cat.y - 16, '💢', '#ff8c69');
    showToast(catName + ' flicks her tail — she needs a moment.', 1800);
    return true;
  }

  // Track the petting streak on this cat.
  if (petStreak.name === cat.name && now - petStreak.lastTime < PET_STREAK_WINDOW_MS) {
    petStreak.count++;
  } else {
    petStreak = { name: cat.name, count: 1, lastTime: now };
  }
  petStreak.lastTime = now;

  gameState.flags.pet_count = (gameState.flags.pet_count || 0) + 1;

  if (petStreak.count >= PET_STREAK_LIMIT) {
    // Overstimulated! A playful nip and she wants some space.
    petCooldowns[cat.name] = now + PET_COOLDOWN_MS;
    petStreak = { name: null, count: 0, lastTime: 0 };
    playSfx('cat_meow', cat.name);
    triggerHaptic(25);
    spawnTextParticle(cat.x, cat.y - 16, '💢', '#ff6347');
    showToast(catName + ' gives you a playful nip — too many pets at once! (Pets: ' + gameState.flags.pet_count + ')', 2500);
    saveGame();
    return true;
  }

  playSfx('cat_purr');
  triggerHaptic(15);
  spawnParticles(cat.x, cat.y - 6, 6, '#ff69b4');
  spawnTextParticle(cat.x, cat.y - 16, '❤', '#ff1493');

  const line = PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
  showToast(catName + ' ' + line + '. (Pets: ' + gameState.flags.pet_count + ')', 1800);
  saveGame();
  return true;
}

// ---- Hungry cat calls ----
// Unfed cats on the current floor call out now and then, just like real cats
// asking for dinner — a soft locator meow (louder when Marice is close) plus
// a music note so muted players can spot them too.
let catCallCooldown = 300; // frames until the next possible call

function updateCatCalls() {
  if (dialogueActive || !isGamePlayActive()) return;
  if (catCallCooldown > 0) { catCallCooldown--; return; }
  catCallCooldown = 480 + Math.floor(Math.random() * 420); // ~8-15s

  const floor = getCurrentFloor();
  const hungry = [];
  for (const obj of floor.interactables) {
    if (obj.type && obj.type.indexOf('cat_') === 0) {
      const name = obj.type.replace('cat_', '');
      if (CAT_ORDER.includes(name) && !gameState.flags[name + '_fed']) {
        hungry.push({ name: name, row: obj.row, col: obj.col });
      }
    }
  }
  if (hungry.length === 0) return;

  const c = hungry[Math.floor(Math.random() * hungry.length)];
  const p = gameState.player;
  const dist = Math.hypot(c.row - p.row, c.col - p.col);
  const vol = Math.max(0.25, 1 - dist / 20);
  playSfx('cat_meow', { name: c.name, volume: vol });
  spawnTextParticle(c.col * TILE_SIZE + TILE_SIZE / 2, c.row * TILE_SIZE - 4, '♪', '#ffd700');
}

// True while actual gameplay is on screen (not the title or ending overlay).
function isGamePlayActive() {
  const title = document.getElementById('title-screen');
  if (title && title.style.display !== 'none') return false;
  const ending = document.getElementById('ending-overlay');
  if (ending && ending.classList.contains('active')) return false;
  return true;
}

// Pick up a hidden cat toy: dialogue, toast with running count,
// particles/celebration, quest log refresh, and an immediate save.
function collectCatToy(toyId) {
  if (!Array.isArray(gameState.flags.cat_toys_found)) gameState.flags.cat_toys_found = [];
  if (gameState.flags.cat_toys_found.includes(toyId)) {
    startDialogue('cat_toy_found', null, null);
    return;
  }
  gameState.flags.cat_toys_found.push(toyId);
  var toyNames = { jingle_ball: 'Jingle Ball', feather_wand: 'Feather Wand', laser_pointer: 'Laser Pointer' };
  var toyName = toyNames[toyId] || 'Cat Toy';
  var total = gameState.flags.cat_toys_found.length;
  updateQuestList();
  startDialogue('cat_toy_' + toyId, null, function () {
    var px = gameState.player.col * TILE_SIZE + TILE_SIZE / 2;
    var py = gameState.player.row * TILE_SIZE + TILE_SIZE / 2;
    if (total === 3) {
      // All toys found — big celebration!
      showToast('All 3 cat toys found! ✨', 4000);
      triggerScreenShake(6, 20);
      triggerHaptic(60);
      spawnParticles(px, py, 20, '#ffd700');
      spawnParticles(px, py, 10, '#ff69b4');
      spawnTextParticle(px, py - 25, '✨', '#ffd700');
      spawnTextParticle(px, py - 35, '🐾', '#ff69b4');
      playSfx('cat_fed');
    } else {
      showToast('Found ' + toyName + '! (' + total + '/3 cat toys)');
      triggerScreenShake(3, 10);
      spawnParticles(px, py, 10, '#ff69b4');
      spawnTextParticle(px, py - 20, '🐾', '#ff69b4');
      playSfx('item_pickup');
    }
    saveGameImmediate();
  });
}

// Hidden diary pages — lore collectibles, one per floor.
const DIARY_PAGE_IDS = ['home', 'alice', 'olive', 'beatrice'];

// Pick up a diary page: lore dialogue, toast with running count,
// quest log refresh, and an immediate save. Mirrors collectCatToy.
function collectDiaryPage(pageId) {
  if (!Array.isArray(gameState.flags.diary_pages_found)) gameState.flags.diary_pages_found = [];
  if (gameState.flags.diary_pages_found.includes(pageId)) {
    startDialogue('diary_page_found', null, null);
    return;
  }
  gameState.flags.diary_pages_found.push(pageId);
  var total = gameState.flags.diary_pages_found.length;
  updateQuestList();
  startDialogue('diary_page_' + pageId, null, function () {
    var px = gameState.player.col * TILE_SIZE + TILE_SIZE / 2;
    var py = gameState.player.row * TILE_SIZE + TILE_SIZE / 2;
    if (total === DIARY_PAGE_IDS.length) {
      showToast('Diary complete! All ' + total + ' pages recovered. 📖✨', 4000);
      triggerScreenShake(5, 15);
      triggerHaptic(50);
      spawnParticles(px, py, 16, '#ffd700');
      spawnTextParticle(px, py - 25, '📖', '#ffd700');
      playSfx('cat_fed');
    } else {
      showToast('Diary page recovered! (' + total + '/' + DIARY_PAGE_IDS.length + ')', 2500);
      triggerScreenShake(3, 10);
      spawnParticles(px, py, 8, '#ffd700');
      spawnTextParticle(px, py - 20, '📖', '#ffd700');
      playSfx('item_pickup');
    }
    saveGameImmediate();
  });
}

function handleInteraction(obj) {
  // Data-driven: if interactable has dialogueKey and no special logic, show dialogue and return
  if (obj.dialogueKey) {
    startDialogue(obj.dialogueKey, null, null);
    return;
  }

  switch (obj.type) {

    // ---- CUPBOARDS ----
    case 'riddle_board':
      startDialogue('outside_riddle_board', null, null);
      break;
    case 'front_door':
      if (gameState.flags.front_door_unlocked) {
        changeFloor(FLOOR_IDS.MAIN);
        break;
      }
      startDialogue('front_door_locked', null, function () {
        showNumpad(function (code) {
          const validCodes = [FRONT_DOOR_CODE];
          if (validCodes.includes(code)) {
            gameState.flags.front_door_unlocked = true;
            triggerScreenShake(4, 12);
            playSfx('door_unlock');
            showToast('Front door unlocked!');
            changeFloor(FLOOR_IDS.MAIN);
          } else {
            playSfx('error');
            showToast('Incorrect code. Hint: the code is in the house plaque.');
          }
        });
      });
      break;
    case 'cupboard_empty':
      startDialogue('cupboard_empty', null, null);
      break;

    case 'cupboard_purrpops':
      // Cupboard is empty once both cats that need purrpops have been fed,
      // or if the player is already carrying purrpops
      if (gameState.flags.alice_fed && gameState.flags.olive_fed) {
        startDialogue('cupboard_empty', null, null);
      } else if (hasItem(ITEMS.PURRPOPS)) {
        startDialogue('cupboard_empty', null, null);
      } else {
        startDialogue('cupboard_purrpops', null, function () {
          addItem(ITEMS.PURRPOPS);
          showToast('Got Purrpops — witness-bribing material secured!');
        });
      }
      break;

    case 'cupboard_feast':
      // Cupboard is empty once Beatrice has been fed, or if already carrying the plate
      if (gameState.flags.beatrice_fed || hasItem(ITEMS.FEAST_PLATE)) {
        startDialogue('cupboard_empty', null, null);
      } else {
        startDialogue('cupboard_feast', null, function () {
          addItem(ITEMS.FEAST_PLATE);
          showToast('Got the Shrimp & Salmon Feast — mastermind bait!');
        });
      }
      break;

    // ---- ALICE ----
    case 'cat_alice':
      if (gameState.flags.alice_fed) {
        startDialogue('alice_done', 'alice', null);
      } else if (hasItem(ITEMS.FEAST_PLATE) && !hasItem(ITEMS.PURRPOPS)) {
        // Only has feast, offer wrong item
        startDialogue('alice_wrong_item', 'alice', null);
      } else if (hasItem(ITEMS.PURRPOPS)) {
        // Give purrpops to Alice
        removeItem(ITEMS.PURRPOPS);
        gameState.flags.alice_fed = true;
        startDialogue('alice_after', 'alice', function () {
          showToast('New clue: check under the sofa blanket!');
          markCatFed('alice');
          saveGameImmediate();
        });
      } else if (gameState.inventory.length > 0) {
        startDialogue('cat_wrong_item_generic', 'alice', null);
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
          addItem(ITEMS.BASEMENT_KEY);
          showToast('Got the Basement Key — the trail leads down!');
        });
      }
      break;

    // ---- BASEMENT DOOR ----
    case 'basement_door':
      if (gameState.flags.basement_unlocked) {
        changeFloor('basement');
      } else if (hasItem(ITEMS.BASEMENT_KEY)) {
        removeItem(ITEMS.BASEMENT_KEY);
        gameState.flags.basement_unlocked = true;
        startDialogue('basement_door_unlock', null, function () {
          triggerScreenShake(5, 15);
          playSfx('door_unlock');
          showToast('Basement unlocked — after them, detective!');
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
      } else if (hasItem(ITEMS.FEAST_PLATE) && !hasItem(ITEMS.PURRPOPS)) {
        startDialogue('olive_wrong_item', 'olive', null);
      } else if (hasItem(ITEMS.PURRPOPS)) {
        removeItem(ITEMS.PURRPOPS);
        gameState.flags.olive_fed = true;
        startDialogue('olive_after', 'olive', function () {
          addItem(ITEMS.LAUNDRY_BASKET);
          gameState.flags.has_laundry_basket = true;
          showToast('Olive flipped! Got the Laundry Basket — clear those stairs!');
          markCatFed('olive');
          saveGameImmediate();
        });
      } else if (gameState.inventory.length > 0) {
        startDialogue('cat_wrong_item_generic', 'olive', null);
      } else {
        startDialogue('olive_before', 'olive', null);
      }
      break;

    // ---- BEATRICE ----
    case 'cat_beatrice':
      if (gameState.flags.beatrice_fed) {
        // Game already complete — show a short post-game dialogue then re-show the ending
        startDialogue('beatrice_done', 'beatrice', function () {
          if (!document.getElementById('ending-overlay').classList.contains('active')) {
            showEnding();
          }
        });
      } else if (hasItem(ITEMS.PURRPOPS) && !hasItem(ITEMS.FEAST_PLATE)) {
        startDialogue('beatrice_wrong_item', 'beatrice', null);
      } else if (hasItem(ITEMS.FEAST_PLATE)) {
        removeItem(ITEMS.FEAST_PLATE);
        gameState.flags.beatrice_fed = true;
        gameState.flags.game_complete = true;
        startDialogue('beatrice_after', 'beatrice', function () {
          markCatFed('beatrice');
          saveGameImmediate();
          showEnding();
        });
      } else if (gameState.inventory.length > 0) {
        startDialogue('cat_wrong_item_generic', 'beatrice', null);
      } else {
        startDialogue('beatrice_before', 'beatrice', null);
      }
      break;

    // ---- SLIDING DOOR / BACKYARD GARDEN ----
    case 'sliding_door':
      if (gameState.flags.game_complete) {
        if (!gameState.flags.garden_visited) {
          startDialogue('sliding_door_open', null, function () {
            playSfx('door_unlock');
            showToast('The backyard garden is open! 🌻');
            enterGarden();
          });
        } else {
          enterGarden();
        }
      } else {
        startDialogue('sliding_door', null, null);
      }
      break;

    case 'garden_house_door':
      // Step back inside, next to the dining room sliding door
      changeFloorTo(FLOOR_IDS.MAIN, 5, 17, 'left');
      break;

    // ---- LIVING ROOM (dialogueKey used for tv, floor_lamp, coffee_table, bookshelf) ----
    case 'futon':
      startDialogue('futon', null, null);
      break;

    // ---- NEW MAIN FLOOR (dialogueKey used for microwave, trash_can, china_cabinet, plant, etc.) ----
    case 'spice_rack':
      startDialogue('spice_rack', null, null);
      break;
    case 'game_console':
      startDialogue('game_console', null, null);
      break;
    case 'side_table':
      startDialogue('side_table', null, null);
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

    // ---- CAT TOY COLLECTIBLES ----
    case 'cat_toy_jingle_ball':
    case 'cat_toy_feather_wand':
    case 'cat_toy_laser_pointer':
      collectCatToy(obj.type.replace('cat_toy_', ''));
      break;

    // ---- DIARY PAGE COLLECTIBLES ----
    case 'diary_page_home':
    case 'diary_page_alice':
    case 'diary_page_olive':
    case 'diary_page_beatrice':
      collectDiaryPage(obj.type.replace('diary_page_', ''));
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

// Head out through the sliding door into the backyard garden.
function enterGarden() {
  if (!gameState.flags.garden_visited) {
    gameState.flags.garden_visited = true;
    updateQuestList();
  }
  changeFloorTo(FLOOR_IDS.GARDEN, undefined, undefined, 'down');
}

// Check stair-step for laundry clearing (when player tries to go upstairs)
function checkLaundryInteraction() {
  if (gameState.currentFloor !== FLOOR_IDS.MAIN) return false;
  if (gameState.flags.laundry_cleared) return false;

  const p = gameState.player;
  const s = FLOORS.main.stairs.toUpstairs;

  // Check if adjacent to stairs and facing them
  const facing = getFacingTile();
  if (s.rows.includes(facing.row) && s.cols.includes(facing.col)) {
    if (hasItem(ITEMS.LAUNDRY_BASKET)) {
      removeItem(ITEMS.LAUNDRY_BASKET);
      gameState.flags.laundry_cleared = true;
      startDialogue('laundry_pile_clear', null, function () {
        showToast('Avalanche cleared — the trail leads up!');
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
  if (gameState.currentFloor === FLOOR_IDS.MAIN && !gameState.flags.laundry_cleared) {
    const s = FLOORS.main.stairs.toUpstairs;
    if (s.rows.includes(facing.row) && s.cols.includes(facing.col)) {
      isStairInteract = true;
    }
  }

  // Nothing in front of us — a follower cat within reach can still be petted
  const pettable = (!obj && !isStairInteract) ? findPettableFollower() : null;

  if (obj || isStairInteract || pettable) {
    const label = obj ? obj.label :
      isStairInteract ? 'Stairs' :
        ('Pet ' + pettable.name.charAt(0).toUpperCase() + pettable.name.slice(1));
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    prompt.textContent = isTouch ? ('Interact: ' + label) : ('E: ' + label);
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
    } else if (row >= 6) {
      // Walkway interactables (e.g. the diary page) sit on concrete
      drawConcreteTile(x, y, row, col);
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

// ============ GARDEN TILE RENDERING ============

// Dispatch backyard garden tile rendering. Reuses the outside renderers
// (lawn, facade, porch deck) plus garden-specific fence/soil/shed tiles.
function drawGardenTile(tile, x, y, row, col) {
  if (tile === T.WALL) {
    if (row <= 2) {
      drawFacadeTile(x, y, Math.min(row, 2), col);
    } else {
      drawFenceTile(x, y, row, col);
    }
  } else if (tile === T.DOOR) {
    // Siding behind the sliding patio door (door sprite drawn on top)
    drawFacadeTile(x, y, 2, col);
  } else if (tile === T.COUNTER) {
    drawSoilTile(x, y, row, col);
  } else if (tile === T.FURNITURE) {
    if (col >= 16) {
      drawCatioTile(x, y, row, col);
    } else {
      drawShedTile(x, y, row, col);
    }
  } else if (tile === T.FLOOR || tile === T.INTERACT) {
    // Wooden deck in front of the house, lawn everywhere else
    if (row <= 4 && col >= 5 && col <= 14) {
      drawPorchTile(x, y, row, col);
    } else {
      drawLawnTile(x, y, row, col);
    }
  } else {
    ctx.fillStyle = '#888';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.03)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

// Wooden privacy fence tile (lawn peeks through at the bottom)
function drawFenceTile(x, y, row, col) {
  drawLawnTile(x, y, row, col);
  // Planks
  ctx.fillStyle = '#9a7448';
  ctx.fillRect(x, y, TILE_SIZE, 19);
  for (var p = 0; p < TILE_SIZE; p += 6) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + p, y, 1, 19);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + p + 1, y, 1, 19);
  }
  // Top rail
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(x, y, TILE_SIZE, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(x, y, TILE_SIZE, 1);
  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x, y + 19, TILE_SIZE, 2);
}

// Raised garden bed: dark soil in a wooden frame, with seeded sprouts
function drawSoilTile(x, y, row, col) {
  ctx.fillStyle = '#6b4a2e';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Furrow lines
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (var f = 5; f < TILE_SIZE; f += 6) {
    ctx.fillRect(x + 2, y + f, TILE_SIZE - 4, 1);
  }
  // Wooden frame
  ctx.fillStyle = '#8b6f47';
  ctx.fillRect(x, y, TILE_SIZE, 2);
  ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
  ctx.fillRect(x, y, 2, TILE_SIZE);
  ctx.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);
  // A few green sprouts at seeded positions
  ctx.fillStyle = '#4a9c3f';
  for (var s = 0; s < 3; s++) {
    var sx = 4 + Math.floor(tileSeed(row, col, s + 10) * 15);
    var sy = 5 + Math.floor(tileSeed(row, col, s + 20) * 13);
    ctx.fillRect(x + sx, y + sy, 2, 3);
    ctx.fillRect(x + sx - 1, y + sy, 1, 2);
    ctx.fillRect(x + sx + 2, y + sy, 1, 2);
  }
}

// Garden shed body tile — wooden walls with a simple roof strip on top
function drawShedTile(x, y, row, col) {
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Vertical plank lines
  for (var p = 4; p < TILE_SIZE; p += 6) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + p, y, 1, TILE_SIZE);
  }
  // Roof strip on the shed's top row
  if (row === 11) {
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(x, y, TILE_SIZE, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, TILE_SIZE, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x, y + 6, TILE_SIZE, 1);
  }
}

// Catio frame tile — dark posts with see-through mesh over the lawn
function drawCatioTile(x, y, row, col) {
  drawLawnTile(x, y, row, col);
  ctx.fillStyle = 'rgba(60,50,40,0.35)';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Frame posts
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x, y, TILE_SIZE, 2);
  ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
  ctx.fillRect(x, y, 2, TILE_SIZE);
  ctx.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);
  // Mesh
  ctx.strokeStyle = 'rgba(220,220,220,0.3)';
  ctx.lineWidth = 0.5;
  for (var m = 4; m < TILE_SIZE; m += 4) {
    ctx.beginPath();
    ctx.moveTo(x + m, y + 2);
    ctx.lineTo(x + m, y + TILE_SIZE - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 2, y + m);
    ctx.lineTo(x + TILE_SIZE - 2, y + m);
    ctx.stroke();
  }
}

// Outside overlay — roof gable, chimney, porch beam, curb
function drawOutsideOverlay() {
  if (gameState.currentFloor !== FLOOR_IDS.OUTSIDE) return;
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

  // Outside and garden floors use custom detailed rendering
  if (gameState.currentFloor === FLOOR_IDS.OUTSIDE) {
    drawOutsideTile(tile, x, y, row, col);
    return;
  }
  if (gameState.currentFloor === FLOOR_IDS.GARDEN) {
    drawGardenTile(tile, x, y, row, col);
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
    const hasLaundry = (gameState.currentFloor === FLOOR_IDS.MAIN && !gameState.flags.laundry_cleared &&
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
  if (floorId === FLOOR_IDS.MAIN) {
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
        if (!gameState.flags.alice_fed) {
          SPRITES.cat(x, y - 4, CAT_COLORS.alice[0], CAT_COLORS.alice[1]);
        }
        break;
      case 'front_door':
        SPRITES.door(x, y, !gameState.flags.front_door_unlocked);
        break;
      case 'cat_olive':
        SPRITES.treadmill(x, y);
        if (!gameState.flags.olive_fed) {
          SPRITES.cat(x, y - 2, CAT_COLORS.olive[0], CAT_COLORS.olive[1]);
        }
        break;
      case 'cat_beatrice':
        SPRITES.bed(x, y, true);
        if (!gameState.flags.beatrice_fed) {
          SPRITES.cat(x + 2, y + 6, CAT_COLORS.beatrice[0], CAT_COLORS.beatrice[1]);
        }
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
        // Soft pulsing glow once the backyard has been unlocked
        if (gameState.flags.game_complete) {
          var doorGlow = 0.18 + Math.sin(animTimer * 0.1) * 0.12;
          ctx.fillStyle = 'rgba(255,235,140,' + doorGlow + ')';
          ctx.fillRect(x + 2, y + 2, 20, 20);
        }
        break;
      case 'garden_house_door':
        SPRITES.slidingDoor(x, y);
        break;
      case 'tv':
        SPRITES.tv(x, y);
        // Animated screen flicker
        var tvAlpha = 0.78 + Math.sin(animTimer * 0.35) * 0.1 + (Math.random() > 0.97 ? 0.25 : 0);
        ctx.fillStyle = 'rgba(45,140,255,' + tvAlpha + ')';
        ctx.fillRect(x + 4, y + 4, 16, 10);
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

      // Cat toy collectibles — glowing paw print until found, faint print after
      case 'cat_toy_jingle_ball':
      case 'cat_toy_feather_wand':
      case 'cat_toy_laser_pointer': {
        var toyFound = Array.isArray(gameState.flags.cat_toys_found) &&
          gameState.flags.cat_toys_found.includes(obj.type.replace('cat_toy_', ''));
        if (!toyFound) {
          var glowAlpha = 0.4 + Math.sin(animTimer * 0.1) * 0.2;
          ctx.fillStyle = 'rgba(255,105,180,' + glowAlpha + ')';
          ctx.fillRect(x + 6, y + 6, 12, 12);
          ctx.fillStyle = '#ff69b4';
          ctx.fillRect(x + 8, y + 8, 3, 3);
          ctx.fillRect(x + 13, y + 8, 3, 3);
          ctx.fillRect(x + 9, y + 12, 6, 4);
        } else {
          // Faint paw print marks an already-searched hiding spot
          ctx.fillStyle = 'rgba(255,105,180,0.18)';
          ctx.fillRect(x + 8, y + 8, 3, 3);
          ctx.fillRect(x + 13, y + 8, 3, 3);
          ctx.fillRect(x + 9, y + 12, 6, 4);
        }
        break;
      }

      // Diary page collectibles — softly glowing page until found, faint after
      case 'diary_page_home':
      case 'diary_page_alice':
      case 'diary_page_olive':
      case 'diary_page_beatrice': {
        var pageFound = Array.isArray(gameState.flags.diary_pages_found) &&
          gameState.flags.diary_pages_found.includes(obj.type.replace('diary_page_', ''));
        if (!pageFound) {
          var pageGlow = 0.35 + Math.sin(animTimer * 0.08) * 0.2;
          ctx.fillStyle = 'rgba(255,225,120,' + pageGlow + ')';
          ctx.fillRect(x + 4, y + 4, 16, 16);
          // The page itself, with faint lines of handwriting
          ctx.fillStyle = '#fdf6e3';
          ctx.fillRect(x + 7, y + 5, 10, 13);
          ctx.fillStyle = '#b89b6a';
          ctx.fillRect(x + 9, y + 8, 6, 1);
          ctx.fillRect(x + 9, y + 11, 6, 1);
          ctx.fillRect(x + 9, y + 14, 4, 1);
        } else {
          // Faint outline marks where the page used to be
          ctx.fillStyle = 'rgba(253,246,227,0.22)';
          ctx.fillRect(x + 7, y + 5, 10, 13);
        }
        break;
      }

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
      case 'ceiling_fan': {
        SPRITES.genericItem(x, y, '#c0c0c0', '#696969');
        // Spinning blades
        var fanAngle = animTimer * 0.09;
        ctx.save();
        ctx.translate(x + 12, y + 12);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        for (var fi = 0; fi < 4; fi++) {
          var fAngle = fanAngle + fi * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(fAngle) * 8, Math.sin(fAngle) * 8);
          ctx.stroke();
        }
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'linen_closet':
        SPRITES.genericItem(x, y, '#fff', '#e6e6fa');
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

      // Backyard garden items
      case 'patio_table': {
        // Table top
        ctx.fillStyle = '#8b6f50';
        ctx.fillRect(x + 4, y + 12, 16, 8);
        ctx.fillStyle = '#9d8160';
        ctx.fillRect(x + 5, y + 13, 14, 6);
        // Umbrella pole and canopy
        ctx.fillStyle = '#777';
        ctx.fillRect(x + 11, y + 4, 2, 10);
        ctx.fillStyle = '#e05c5c';
        ctx.fillRect(x + 4, y + 2, 16, 4);
        ctx.fillStyle = '#f0eeea';
        ctx.fillRect(x + 8, y + 2, 4, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 4, y + 5, 16, 1);
        break;
      }
      case 'compost_bin':
        // Bin body
        ctx.fillStyle = '#3a5a30';
        ctx.fillRect(x + 5, y + 8, 14, 14);
        ctx.fillStyle = '#46693a';
        ctx.fillRect(x + 6, y + 9, 12, 12);
        // Lid
        ctx.fillStyle = '#2e4a26';
        ctx.fillRect(x + 4, y + 6, 16, 4);
        // Vent slits
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 8, y + 13, 8, 1);
        ctx.fillRect(x + 8, y + 17, 8, 1);
        break;
      case 'bird_feeder': {
        // Post
        ctx.fillStyle = '#654321';
        ctx.fillRect(x + 11, y + 8, 2, 14);
        // Feeder house
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(x + 6, y + 4, 12, 6);
        ctx.fillStyle = '#5a4010';
        ctx.fillRect(x + 5, y + 2, 14, 3);
        // Seed tray
        ctx.fillStyle = '#d4b896';
        ctx.fillRect(x + 7, y + 8, 10, 2);
        // A little visiting bird that hops away now and then
        if (Math.sin(animTimer * 0.02) > -0.3) {
          ctx.fillStyle = '#cc4444';
          ctx.fillRect(x + 8, y + 5, 3, 3);
          ctx.fillStyle = '#333';
          ctx.fillRect(x + 10, y + 5, 1, 1);
        }
        break;
      }
      case 'vegetable_patch':
        // Soil bed matching the neighbouring raised-bed tiles
        ctx.fillStyle = '#6b4a2e';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#8b6f47';
        ctx.fillRect(x, y, TILE_SIZE, 2);
        ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
        // Tomato plant
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(x + 4, y + 6, 2, 12);
        ctx.fillRect(x + 2, y + 8, 6, 2);
        ctx.fillStyle = '#e53935';
        ctx.fillRect(x + 6, y + 10, 4, 4);
        // Lettuce
        ctx.fillStyle = '#7cb342';
        ctx.fillRect(x + 12, y + 14, 6, 5);
        ctx.fillStyle = '#9ccc65';
        ctx.fillRect(x + 13, y + 15, 4, 3);
        // Catnip sprigs
        ctx.fillStyle = '#4a9c3f';
        ctx.fillRect(x + 16, y + 5, 2, 5);
        ctx.fillRect(x + 19, y + 7, 2, 4);
        break;
      case 'catio': {
        // Door panel in the catio mesh, with a cozy cat bed visible inside
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x + 2, y + 2, 20, 20);
        ctx.fillStyle = 'rgba(120,160,110,0.5)';
        ctx.fillRect(x + 4, y + 4, 16, 16);
        // Cat bed
        ctx.fillStyle = '#b06030';
        ctx.fillRect(x + 7, y + 12, 10, 6);
        ctx.fillStyle = '#d4956a';
        ctx.fillRect(x + 8, y + 13, 8, 4);
        // Dangling toy
        ctx.fillStyle = '#ddd';
        ctx.fillRect(x + 11, y + 4, 1, 5);
        ctx.fillStyle = '#ff69b4';
        ctx.fillRect(x + 10, y + 9, 3, 3);
        break;
      }
      case 'garden_shed':
        // Shed front wall with a plank door (sits between shed body tiles)
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#5a4028';
        ctx.fillRect(x + 5, y + 4, 14, 20);
        ctx.fillStyle = '#6b4e32';
        ctx.fillRect(x + 6, y + 5, 12, 18);
        // Door planks
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x + 9, y + 5, 1, 18);
        ctx.fillRect(x + 14, y + 5, 1, 18);
        // Handle
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(x + 16, y + 13, 2, 2);
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
  } else {
    px = p.col * TILE_SIZE;
    py = p.row * TILE_SIZE;
  }

  // Record the trail (center of the player) so followers can chase it.
  trailPush(px + TILE_SIZE / 2, py + TILE_SIZE / 2, p.facing);

  SPRITES.player(px, py, p.facing, gameState.moving);
}

// Draw the cats that follow Marice, spaced out along her recent path.
function drawFollowers() {
  const followers = getFollowers();
  if (followers.length === 0 || playerTrail.length === 0) return;

  // Draw farthest cat first so nearer cats overlap on top (depth feel).
  for (let i = followers.length - 1; i >= 0; i--) {
    const name = followers[i];
    const colors = CAT_COLORS[name] || ['#bbb', '#eee'];
    const idx = Math.min((i + 1) * FOLLOWER_GAP, playerTrail.length - 1);
    const sample = playerTrail[idx];
    if (!sample) continue;
    // Gentle hop while the parade is on the move.
    const hop = gameState.moving ? Math.abs(Math.sin((animTimer + i * 7) * 0.3)) * 2 : 0;
    const cx = sample.x - TILE_SIZE / 2;
    const cy = sample.y - TILE_SIZE / 2 - hop;
    SPRITES.cat(cx, cy, colors[0], colors[1]);
  }
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
  basement: { r: 220, g: 230, b: 255, a: 0.12 },     // cool fluorescent
  upstairs: { r: 255, g: 230, b: 200, a: 0.06 },   // soft warm
  garden: { r: 255, g: 200, b: 120, a: 0.07 }    // golden-hour backyard
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
  ],
  garden: [
    { row: 2, col: 9, radius: 56, color: '255,240,180', flicker: false },  // patio door light
    { row: 3, col: 12, radius: 48, color: '255,240,180', flicker: true },  // patio table lantern
  ]
};

// Outdoor ambient tint by real time of day — the yard matches the player's
// actual clock. Night also darkens the scene and turns the porch lights up.
var OUTDOOR_AMBIENT = {
  morning: { r: 205, g: 225, b: 255, a: 0.10 }, // cool early light
  day: { r: 255, g: 250, b: 220, a: 0.04 },     // bright neutral noon
  evening: { r: 255, g: 180, b: 100, a: 0.13 }, // golden hour
  night: { r: 25, g: 35, b: 90, a: 0.32 }       // deep blue night
};

function drawLighting(floor) {
  var floorId = gameState.currentFloor;
  var outdoors = floorId === FLOOR_IDS.OUTSIDE || floorId === FLOOR_IDS.GARDEN;
  var daypart = outdoors ? getDaypart() : null;
  var lightCoreAlpha = floorId === FLOOR_IDS.BASEMENT ? 0.22 : 0.12;
  var lightMidAlpha = floorId === FLOOR_IDS.BASEMENT ? 0.12 : 0.06;
  if (daypart === 'night') {
    // Porch and patio lights glow much brighter after dark.
    lightCoreAlpha = 0.3;
    lightMidAlpha = 0.16;
  }

  // 1. Apply ambient tint (outdoors follows the real clock)
  var ambient = outdoors ? OUTDOOR_AMBIENT[daypart] : FLOOR_AMBIENT[floorId];
  if (ambient) {
    ctx.fillStyle = 'rgba(' + ambient.r + ',' + ambient.g + ',' + ambient.b + ',' + ambient.a + ')';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  if (daypart === 'night') {
    // Extra darkness layer so night genuinely reads as night.
    ctx.fillStyle = 'rgba(5, 8, 30, 0.22)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // 2. Draw light sources using additive-style radial gradients.
  // In full daylight the outdoor fixtures are off — sunlight does the work.
  var lights = (outdoors && daypart === 'day') ? null : FLOOR_LIGHTS[floorId];
  if (lights && lights.length > 0) {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < lights.length; i++) {
      var light = lights[i];
      var cx = light.col * TILE_SIZE + TILE_SIZE / 2;
      var cy = light.row * TILE_SIZE + TILE_SIZE / 2;
      var radius = light.radius;

      // Subtle flicker
      if (light.flicker) {
        radius += Math.sin(animTimer * 0.15 + i * 2) * 4;
      }

      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(' + light.color + ',' + lightCoreAlpha + ')');
      grad.addColorStop(0.5, 'rgba(' + light.color + ',' + lightMidAlpha + ')');
      grad.addColorStop(1, 'rgba(' + light.color + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

}

// ======================== MINIMAP ========================

// Minimap static part (frame + tile dots) pre-rendered per floor.
var minimapCacheCanvas = null;
var minimapCacheKey = null;

function ensureMinimapCache(floor, offsetX, offsetY, mapW, mapH, dotSize) {
  if (minimapCacheKey === gameState.currentFloor && minimapCacheCanvas) return;
  if (!minimapCacheCanvas) {
    minimapCacheCanvas = document.createElement('canvas');
    minimapCacheCanvas.width = mapW + 4;
    minimapCacheCanvas.height = mapH + 16;
  }
  var mctx = minimapCacheCanvas.getContext('2d');
  mctx.clearRect(0, 0, minimapCacheCanvas.width, minimapCacheCanvas.height);
  // Local coordinates: cache origin corresponds to (offsetX - 2, offsetY - 12)
  mctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  mctx.fillRect(0, 0, mapW + 4, mapH + 16);
  mctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
  mctx.lineWidth = 1;
  mctx.strokeRect(0.5, 0.5, mapW + 3, mapH + 15);
  // "MAP" label
  mctx.fillStyle = 'rgba(255,215,0,0.7)';
  mctx.font = '6px monospace';
  mctx.textAlign = 'center';
  mctx.fillText('MAP', 2 + mapW / 2, 9);
  mctx.textAlign = 'left';

  var grid = floor.grid;
  for (var r = 0; r < MAP_ROWS; r++) {
    for (var c = 0; c < MAP_COLS; c++) {
      var tile = grid[r][c];
      if (tile === T.WALL) {
        mctx.fillStyle = 'rgba(100, 80, 60, 0.9)';
      } else if (tile === T.FURNITURE || tile === T.COUNTER) {
        mctx.fillStyle = 'rgba(139, 105, 20, 0.6)';
      } else if (tile === T.DOOR) {
        mctx.fillStyle = 'rgba(74, 124, 89, 0.8)';
      } else if (tile === T.STAIRS) {
        mctx.fillStyle = 'rgba(160, 82, 45, 0.8)';
      } else {
        mctx.fillStyle = 'rgba(180, 160, 130, 0.3)';
      }
      mctx.fillRect(2 + c * dotSize, 12 + r * dotSize, dotSize, dotSize);
    }
  }
  minimapCacheKey = gameState.currentFloor;
}

function drawMinimap() {
  var floor = getCurrentFloor();
  var dotSize = 2;
  var catDotSize = 4; // cats rendered larger for visibility
  var padding = 4;
  var mapW = MAP_COLS * dotSize;
  var mapH = MAP_ROWS * dotSize;
  var offsetX = CANVAS_W - mapW - padding - 2;
  var offsetY = padding + 2;

  // Static frame + tiles from the per-floor cache
  ensureMinimapCache(floor, offsetX, offsetY, mapW, mapH, dotSize);
  ctx.drawImage(minimapCacheCanvas, offsetX - 2, offsetY - 12);

  // Draw interactable markers (cats shown as larger, distinct dots)
  // Fed cats get a gold ring; unfed cats get a white ring.
  for (var i = 0; i < floor.interactables.length; i++) {
    var obj = floor.interactables[i];
    if (obj.type === 'cat_alice' || obj.type === 'cat_olive' || obj.type === 'cat_beatrice') {
      var catName = obj.type.replace('cat_', '');
      var isFed = gameState.flags[catName + '_fed'];
      var catColor = obj.type === 'cat_alice' ? '#c8722e' :
        obj.type === 'cat_olive' ? '#6b92c8' : '#aaaaaa';
      var cx2 = offsetX + obj.col * dotSize;
      var cy2 = offsetY + obj.row * dotSize;
      // Ring: gold if fed, white if not
      ctx.fillStyle = isFed ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(cx2 - 1, cy2 - 1, catDotSize + 2, catDotSize + 2);
      // Cat dot
      ctx.fillStyle = catColor;
      ctx.fillRect(cx2, cy2, catDotSize, catDotSize);
    }
  }

  // Draw objective ping marker (pulsing ring)
  if (objectivePing && Date.now() < objectivePingUntil && objectivePing.floorId === gameState.currentFloor) {
    var pulse = (Math.sin(animTimer * 0.22) + 1) / 2; // 0..1
    var ox = offsetX + objectivePing.col * dotSize;
    var oy = offsetY + objectivePing.row * dotSize;
    ctx.strokeStyle = 'rgba(255,215,0,' + (0.35 + pulse * 0.35) + ')';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 1, oy - 1, dotSize + 2, dotSize + 2);
  }

  // Draw player (blinking dot)
  var blink = Math.sin(animTimer * 0.15) > 0;
  if (blink) {
    var p = gameState.player;
    ctx.fillStyle = '#ff9ecf';
    ctx.fillRect(offsetX + p.col * dotSize, offsetY + p.row * dotSize, dotSize, dotSize);
  }
}

function drawObjectivePingWorld() {
  if (!objectivePing) return;
  if (Date.now() >= objectivePingUntil) {
    objectivePing = null;
    objectivePingUntil = 0;
    return;
  }
  if (objectivePing.floorId !== gameState.currentFloor) return;

  var tx = objectivePing.col * TILE_SIZE;
  var ty = objectivePing.row * TILE_SIZE;
  var cx = tx + TILE_SIZE / 2;
  var cy = ty + TILE_SIZE / 2;
  var pulse = (Math.sin(animTimer * 0.22) + 1) / 2; // 0..1
  var radius = TILE_SIZE * (0.34 + pulse * 0.14);

  ctx.save();
  ctx.fillStyle = 'rgba(255,215,0,' + (0.08 + pulse * 0.06) + ')';
  ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = 'rgba(255,215,0,' + (0.35 + pulse * 0.35) + ')';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---- Static layer caches ----
// The tile grid, room labels, and outside overlay are fully deterministic,
// so they're pre-rendered once per floor into an offscreen canvas instead of
// procedurally redrawing ~300 tiles every frame — a large CPU/battery win on
// phones. The cache rebuilds when the floor (or the laundry pile) changes.
var floorCacheCanvas = document.createElement('canvas');
floorCacheCanvas.width = CANVAS_W;
floorCacheCanvas.height = CANVAS_H;
var floorCacheKey = null;

function ensureFloorCache() {
  var key = gameState.currentFloor + '|' + (gameState.flags.laundry_cleared ? 1 : 0);
  if (key === floorCacheKey) return;
  var mainCtx = ctx;
  ctx = floorCacheCanvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  var floor = getCurrentFloor();
  for (var r = 0; r < MAP_ROWS; r++) {
    for (var c = 0; c < MAP_COLS; c++) {
      drawTile(floor, r, c);
    }
  }
  drawRoomLabels(gameState.currentFloor);
  drawOutsideOverlay();
  ctx = mainCtx;
  floorCacheKey = key;
}

// Vignette overlays are static per darkness level — pre-render each variant.
var vignetteCache = {};

function getVignetteCanvas(outerAlpha) {
  var key = String(outerAlpha);
  if (vignetteCache[key]) return vignetteCache[key];
  var cv = document.createElement('canvas');
  cv.width = CANVAS_W;
  cv.height = CANVAS_H;
  var vctx = cv.getContext('2d');
  var gradient = vctx.createRadialGradient(
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.3,
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, ' + outerAlpha + ')');
  vctx.fillStyle = gradient;
  vctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  vignetteCache[key] = cv;
  return cv;
}

function render() {
  const floor = getCurrentFloor();

  // Clear
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Apply screen shake offset
  var shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Draw the pre-rendered static layer (tiles, room labels, outside overlay)
  ensureFloorCache();
  ctx.drawImage(floorCacheCanvas, 0, 0);

  // Draw interactables
  drawInteractables(floor);

  // Draw objective ping (if any)
  drawObjectivePingWorld();

  // Draw the trailing cat parade behind Marice
  drawFollowers();

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
    if (gameState.currentFloor === FLOOR_IDS.MAIN && !gameState.flags.laundry_cleared) {
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

  // Draw subtle vignette effect (not affected by shake) from the cache
  const vignetteOuterAlpha = gameState.currentFloor === FLOOR_IDS.BASEMENT ? 0.18 : 0.3;
  ctx.drawImage(getVignetteCanvas(vignetteOuterAlpha), 0, 0);
}

// ======================== GAME LOOP ========================

let keysDown = {};

function togglePause() {
  var titleScreen = document.getElementById('title-screen');
  if (titleScreen && titleScreen.style.display !== 'none') return;
  if (document.getElementById('ending-overlay').classList.contains('active')) return;
  if (document.getElementById('numpad-overlay').classList.contains('active')) return;
  if (dialogueActive) return;
  gamePaused = !gamePaused;
  document.getElementById('pause-overlay').classList.toggle('active', gamePaused);
}

// Fixed-timestep loop: game logic always advances at 60 updates/second no
// matter the display's refresh rate, so the game runs at the same speed on a
// 60Hz laptop, a 120Hz phone, or a slow device. Rendering happens once per
// animation frame.
var UPDATE_STEP_MS = 1000 / 60;
var MAX_UPDATE_STEPS = 5; // cap catch-up work after a long stall
var lastFrameTime = 0;
var updateAccumulator = 0;

function updateStep() {
  if (!gamePaused) {
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
    updateCatCalls();
  }
  animTimer++;
}

function gameLoop(now) {
  if (!lastFrameTime) lastFrameTime = now;
  var elapsed = now - lastFrameTime;
  lastFrameTime = now;
  // Clamp huge gaps (tab was backgrounded) so we don't fast-forward the world.
  if (elapsed > 250) elapsed = 250;
  updateAccumulator += elapsed;

  var steps = 0;
  while (updateAccumulator >= UPDATE_STEP_MS && steps < MAX_UPDATE_STEPS) {
    updateStep();
    updateAccumulator -= UPDATE_STEP_MS;
    steps++;
  }
  if (steps === MAX_UPDATE_STEPS) updateAccumulator = 0;

  render();
  requestAnimationFrame(gameLoop);
}

// ======================== INPUT HANDLING ========================

document.addEventListener('keydown', function (e) {
  // Resume AudioContext if suspended (e.g. after tab background)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Block game input while code entry overlay is open
  if (document.getElementById('numpad-overlay').classList.contains('active')) {
    return;
  }

  // P key always toggles pause (when game is active)
  if (e.code === 'KeyP') {
    togglePause();
    e.preventDefault();
    return;
  }

  // Q / I key toggles quest log
  if (e.code === 'KeyQ' || e.code === 'KeyI') {
    var qp = document.getElementById('quest-panel');
    var sp = document.getElementById('settings-panel');
    if (qp) {
      qp.classList.toggle('active');
      if (sp) sp.classList.remove('active');
    }
    e.preventDefault();
    return;
  }

  // H key shows hint and pings the next objective
  if (e.code === 'KeyH') {
    if (!dialogueActive) {
      showHintAndPing();
    }
    e.preventDefault();
    return;
  }

  // Block all other game input when paused
  if (gamePaused) return;

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

// Auto-pause when the app/tab goes to the background (switching apps on a
// phone, locking the screen) and suspend audio to save battery. The game
// stays paused on return so nothing happens while the player wasn't looking.
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    if (!gamePaused && !dialogueActive && isGamePlayActive()) {
      togglePause();
    }
    if (audioCtx && audioCtx.state === 'running') {
      try { audioCtx.suspend(); } catch (e) {}
    }
  } else {
    if (audioCtx && audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) {}
    }
  }
});

window.addEventListener('blur', function () {
  // Clear all held keys so movement doesn't continue after alt-tab / focus loss
  Object.keys(keysDown).forEach(function (key) { keysDown[key] = false; });
  // Also stop any in-progress movement to prevent the player sliding into walls
  if (gameState.moving) {
    gameState.player.row = gameState.moveTo ? gameState.moveTo.row : gameState.player.row;
    gameState.player.col = gameState.moveTo ? gameState.moveTo.col : gameState.player.col;
    gameState.moving = false;
    gameState.moveProgress = 0;
    gameState.moveFrom = null;
    gameState.moveTo = null;
  }
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

    var codeByDir = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight'
    };

    function clearDpadKeys() {
      keysDown.ArrowUp = false;
      keysDown.ArrowDown = false;
      keysDown.ArrowLeft = false;
      keysDown.ArrowRight = false;
    }

    function onDown(e) {
      e.preventDefault();
      markPlayerActivity();
      clearDpadKeys();
      keysDown[codeByDir[dir]] = true;
      // Ensure immediate response on tap (not just "held" movement).
      if (!dialogueActive && !gameState.moving && !gamePaused) {
        tryMove(dir);
      }
      if (btn.setPointerCapture && e.pointerId !== undefined) {
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }

    function onUp(e) {
      e.preventDefault();
      keysDown[codeByDir[dir]] = false;
    }

    if (window.PointerEvent) {
      btn.addEventListener('pointerdown', onDown);
      btn.addEventListener('pointerup', onUp);
      btn.addEventListener('pointercancel', onUp);
      btn.addEventListener('pointerleave', onUp);
    } else {
      btn.addEventListener('touchstart', onDown, { passive: false });
      btn.addEventListener('mousedown', onDown);
      btn.addEventListener('touchend', onUp, { passive: false });
      btn.addEventListener('touchcancel', onUp, { passive: false });
      btn.addEventListener('mouseup', onUp);
      btn.addEventListener('mouseleave', onUp);
    }
  }

  // Interact button
  const interactBtn = document.getElementById('btn-interact');
  if (interactBtn) {
    function doInteract(e) {
      e.preventDefault();
      markPlayerActivity();
      if (dialogueActive) {
        advanceDialogue();
      } else {
        if (!checkLaundryInteraction()) {
          tryInteract();
        }
      }
    }
    if (window.PointerEvent) {
      interactBtn.addEventListener('pointerdown', doInteract);
    } else {
      interactBtn.addEventListener('touchstart', doInteract, { passive: false });
    }
    interactBtn.addEventListener('click', doInteract);
  }

  setupSwipeControls();
}

// Drag/swipe-to-move directly on the canvas — a touch joystick anchored at the
// point you press. A quick tap (no drag) acts as INTERACT, so you can pet a cat
// or open a door without reaching for the buttons.
function setupSwipeControls() {
  if (!canvas) return;

  const DEAD_ZONE = 16;   // px of drag before movement kicks in
  const TAP_SLOP = 12;    // movement under this on release counts as a tap
  const TAP_TIME = 350;   // ms

  let active = false;
  let startX = 0, startY = 0, startT = 0;
  let dragged = false;
  let curDir = null;

  const codeByDir = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

  function clearDir() {
    keysDown.ArrowUp = false;
    keysDown.ArrowDown = false;
    keysDown.ArrowLeft = false;
    keysDown.ArrowRight = false;
    curDir = null;
  }

  function onDown(e) {
    if (dialogueActive || gamePaused) return;
    active = true;
    dragged = false;
    var pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX;
    startY = pt.clientY;
    startT = Date.now();
    markPlayerActivity();
  }

  function onMove(e) {
    if (!active) return;
    var pt = e.touches ? e.touches[0] : e;
    var dx = pt.clientX - startX;
    var dy = pt.clientY - startY;
    if (Math.hypot(dx, dy) < DEAD_ZONE) return;
    e.preventDefault();
    dragged = true;
    var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (dir !== curDir) {
      clearDir();
      curDir = dir;
      keysDown[codeByDir[dir]] = true;
      if (!gameState.moving) tryMove(dir);
    }
  }

  function onUp(e) {
    if (!active) return;
    active = false;
    var wasTap = !dragged && (Date.now() - startT) < TAP_TIME;
    clearDir();
    if (wasTap && !dialogueActive && !gamePaused) {
      if (!checkLaundryInteraction()) tryInteract();
    }
  }

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);
  } else {
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);
    canvas.addEventListener('touchcancel', onUp);
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
    flags: gameState.flags,
    playTimeMs: getTotalPlayTimeMs()
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    showSaveIndicator();
  } catch (e) {
    showToast('Save failed; check storage.');
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

    const validFloorIds = Object.values(FLOOR_IDS);
    const floorId = validFloorIds.includes(data.currentFloor) ? data.currentFloor : FLOOR_IDS.OUTSIDE;
    const floor = FLOORS[floorId] || FLOORS[FLOOR_IDS.OUTSIDE];

    const startsByFloor = {
      outside: outsideStart,
      main: mainFloorStart,
      basement: basementStart,
      upstairs: upstairsStart,
      garden: gardenStart
    };
    const floorStart = startsByFloor[floorId] || outsideStart;

    const savedRow = data.player && Number.isFinite(data.player.row) ? data.player.row : floorStart.row;
    const savedCol = data.player && Number.isFinite(data.player.col) ? data.player.col : floorStart.col;
    const inBounds =
      savedRow >= 0 && savedRow < MAP_ROWS &&
      savedCol >= 0 && savedCol < MAP_COLS;

    // Recover gracefully from malformed/old save data that points to walls or invalid tiles.
    const canStandHere = inBounds && isWalkable(savedRow, savedCol, floor);
    const validFacing = ['up', 'down', 'left', 'right'];

    const validItems = Object.values(ITEMS);
    const inventory = Array.isArray(data.inventory)
      ? data.inventory.filter(function (item) { return validItems.includes(item); })
      : [];

    const mergedFlags = Object.assign({}, DEFAULT_FLAGS, { cat_toys_found: [], diary_pages_found: [] }, data.flags || {});
    const validToyIds = ['jingle_ball', 'feather_wand', 'laser_pointer'];
    mergedFlags.cat_toys_found = Array.isArray(mergedFlags.cat_toys_found)
      ? Array.from(new Set(mergedFlags.cat_toys_found.filter(function (toyId) { return validToyIds.includes(toyId); })))
      : [];
    mergedFlags.diary_pages_found = Array.isArray(mergedFlags.diary_pages_found)
      ? Array.from(new Set(mergedFlags.diary_pages_found.filter(function (pageId) { return DIARY_PAGE_IDS.includes(pageId); })))
      : [];
    mergedFlags.pet_count = Number.isFinite(mergedFlags.pet_count) ? mergedFlags.pet_count : 0;

    gameState.currentFloor = floorId;
    gameState.player.row = canStandHere ? savedRow : floorStart.row;
    gameState.player.col = canStandHere ? savedCol : floorStart.col;
    gameState.player.facing = validFacing.includes(data.player && data.player.facing) ? data.player.facing : 'down';
    gameState.inventory = inventory;
    gameState.flags = mergedFlags;
    playTimeOffsetMs = Number.isFinite(data.playTimeMs) && data.playTimeMs >= 0 ? data.playTimeMs : 0;

    return true;
  } catch (e) {
    showToast('Could not load save.');
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
    particleEffects: document.getElementById('particle-effects').checked,
    crtOverlay: document.getElementById('crt-overlay-enabled') ? document.getElementById('crt-overlay-enabled').checked : true,
    typewriterSound: document.getElementById('typewriter-sound') ? document.getElementById('typewriter-sound').checked : true,
    instantDialogue: document.getElementById('instant-dialogue') ? document.getElementById('instant-dialogue').checked : false,
    musicMute: document.getElementById('music-mute') ? document.getElementById('music-mute').checked : false
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { }
}

function applyCrtSetting() {
  var cb = document.getElementById('crt-overlay-enabled');
  var el = document.getElementById('crt-overlay');
  if (el) el.style.display = (cb && !cb.checked) ? 'none' : '';
}

function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      // First run: honor reduced-motion preference with gentler defaults.
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        var screenShake = document.getElementById('screen-shake');
        var particleEffects = document.getElementById('particle-effects');
        var crtCb = document.getElementById('crt-overlay-enabled');
        var instantCb = document.getElementById('instant-dialogue');
        if (screenShake) screenShake.checked = false;
        if (particleEffects) particleEffects.checked = false;
        if (crtCb) crtCb.checked = false;
        if (instantCb) instantCb.checked = true;
        applyCrtSetting();
      }
      return;
    }
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
    var crtCb = document.getElementById('crt-overlay-enabled');
    if (crtCb && settings.crtOverlay !== undefined) {
      crtCb.checked = settings.crtOverlay;
      applyCrtSetting();
    }
    var twCb = document.getElementById('typewriter-sound');
    if (twCb && settings.typewriterSound !== undefined) {
      twCb.checked = settings.typewriterSound;
    }
    var instantCb = document.getElementById('instant-dialogue');
    if (instantCb && settings.instantDialogue !== undefined) {
      instantCb.checked = settings.instantDialogue;
    }
    var muteCb = document.getElementById('music-mute');
    if (muteCb && settings.musicMute !== undefined) {
      muteCb.checked = settings.musicMute;
    }
  } catch (e) { }
}
