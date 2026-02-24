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
  currentFloor: 'main',
  player: { row: 8, col: 9, facing: 'down' },
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
    game_complete: false
  },
  // Smooth movement animation
  moving: false,
  moveProgress: 0,
  moveFrom: null,
  moveTo: null,
};

// Movement speed (pixels per frame at 60fps)
const MOVE_SPEED = 3; // tiles take ~8 frames = ~133ms

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

const dialogueOverlay = document.getElementById('dialogue-overlay');
const dialoguePortraits = document.getElementById('dialogue-portraits');
const dialoguePortraitCat = document.getElementById('dialogue-portrait-cat');
const dialoguePortraitMarice = document.getElementById('dialogue-portrait-marice');
const dialogueSpeaker = document.getElementById('dialogue-speaker');
const dialogueText = document.getElementById('dialogue-text');

function startDialogue(dialogueKey, catName, callback) {
  const messages = DIALOGUE[dialogueKey];
  if (!messages || messages.length === 0) return;

  dialogueQueue = messages;
  dialogueIndex = 0;
  dialogueCat = catName;
  dialogueCallback = callback || null;
  dialogueActive = true;

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

  dialogueText.textContent = msg.text;
}

function advanceDialogue() {
  if (!dialogueActive) return;

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

// ======================== INVENTORY ========================

function addItem(itemId) {
  gameState.inventory.push(itemId);
  renderInventory();
  saveGame();
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
  gameState.currentFloor = newFloor;
  const floor = FLOORS[newFloor];
  gameState.player.row = floor.start.row;
  gameState.player.col = floor.start.col;
  gameState.player.facing = 'down';
  updateFloorLabel();
  saveGame();
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
}

function handleStairTransition(row, col) {
  const floorId = gameState.currentFloor;

  if (floorId === 'main') {
    // Check if stepping on upstairs stairs
    const s = FLOORS.main.stairs.toUpstairs;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      if (!gameState.flags.laundry_cleared) {
        startDialogue('laundry_pile_blocked', null, null);
        return true;
      }
      changeFloor('upstairs');
      return true;
    }
  } else if (floorId === 'basement') {
    const s = FLOORS.basement.stairs.toMain;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      // Return to main floor, place near basement door
      gameState.currentFloor = 'main';
      gameState.player.row = 7;
      gameState.player.col = 17;
      gameState.player.facing = 'left';
      updateFloorLabel();
      saveGame();
      return true;
    }
  } else if (floorId === 'upstairs') {
    const s = FLOORS.upstairs.stairs.toMain;
    if (s.rows.includes(row) && s.cols.includes(col)) {
      // Return to main floor, place near central stairs
      gameState.currentFloor = 'main';
      gameState.player.row = 8;
      gameState.player.col = 10;
      gameState.player.facing = 'down';
      updateFloorLabel();
      saveGame();
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
    handleInteraction(obj);
  }
}

function handleInteraction(obj) {
  switch (obj.type) {

    // ---- CUPBOARDS ----
    case 'cupboard_empty':
      startDialogue('cupboard_empty', null, null);
      break;

    case 'cupboard_purrpops':
      startDialogue('cupboard_purrpops', null, function() {
        addItem('purrpops');
        showToast('Got Purrpops!');
      });
      break;

    case 'cupboard_feast':
      startDialogue('cupboard_feast', null, function() {
        addItem('feast_plate');
        showToast('Got Shrimp & Salmon Feast plate!');
      });
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
          saveGame();
        });
      } else {
        startDialogue('alice_before', 'alice', null);
      }
      break;

    // ---- SOFA ----
    case 'sofa_blanket':
      if (gameState.flags.sofa_searched || gameState.flags.has_basement_key) {
        startDialogue('sofa_blanket_empty', null, null);
      } else if (gameState.flags.alice_fed) {
        gameState.flags.sofa_searched = true;
        gameState.flags.has_basement_key = true;
        startDialogue('sofa_blanket', null, function() {
          addItem('basement_key');
          showToast('Got Basement Key!');
        });
      } else {
        startDialogue('sofa_blanket_empty', null, null);
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

    // ---- FUTON ----
    case 'futon':
      startDialogue('futon', null, null);
      break;
  }
}

// Check stair-step for laundry clearing (when player tries to go upstairs)
function checkLaundryInteraction() {
  if (gameState.currentFloor !== 'main') return;
  if (gameState.flags.laundry_cleared) return;

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
  // Player (Marice) - simple character
  player: function(x, y, facing) {
    // Body
    ctx.fillStyle = '#ff9ecf'; // pink
    ctx.fillRect(x + 6, y + 4, 12, 14);
    // Head
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(x + 7, y + 1, 10, 8);
    // Hair
    ctx.fillStyle = '#5c3317';
    ctx.fillRect(x + 6, y, 12, 4);
    // Eyes (based on facing)
    ctx.fillStyle = '#333';
    if (facing === 'down') {
      ctx.fillRect(x + 9, y + 4, 2, 2);
      ctx.fillRect(x + 13, y + 4, 2, 2);
    } else if (facing === 'up') {
      // Back of head, show hair
      ctx.fillStyle = '#5c3317';
      ctx.fillRect(x + 7, y + 1, 10, 7);
    } else if (facing === 'left') {
      ctx.fillRect(x + 8, y + 4, 2, 2);
    } else {
      ctx.fillRect(x + 14, y + 4, 2, 2);
    }
    // Feet
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x + 7, y + 18, 4, 3);
    ctx.fillRect(x + 13, y + 18, 4, 3);
  },

  // Cat sprite (generic, colored per cat)
  cat: function(x, y, color, accentColor) {
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(x + 5, y + 8, 14, 10);
    // Head
    ctx.fillRect(x + 6, y + 3, 12, 8);
    // Ears
    ctx.fillRect(x + 6, y + 1, 4, 4);
    ctx.fillRect(x + 14, y + 1, 4, 4);
    // Inner ears
    ctx.fillStyle = accentColor || '#ffb6c1';
    ctx.fillRect(x + 7, y + 2, 2, 2);
    ctx.fillRect(x + 15, y + 2, 2, 2);
    // Eyes
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 8, y + 6, 2, 2);
    ctx.fillRect(x + 14, y + 6, 2, 2);
    // Nose
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect(x + 11, y + 8, 2, 2);
    // Tail
    ctx.fillStyle = color;
    ctx.fillRect(x + 18, y + 8, 3, 2);
    ctx.fillRect(x + 20, y + 6, 2, 3);
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
    // Base frame
    ctx.fillStyle = '#3e2b22';
    ctx.fillRect(x + 1, y + 10, 22, 10);
    // Seat + back cushions
    ctx.fillStyle = '#b07b5b';
    ctx.fillRect(x + 2, y + 8, 20, 12);
    ctx.fillStyle = '#c68f6b';
    ctx.fillRect(x + 3, y + 10, 18, 8);
    ctx.fillStyle = '#8a5f46';
    ctx.fillRect(x + 2, y + 4, 20, 6);
    // Armrests
    ctx.fillStyle = '#6d4835';
    ctx.fillRect(x + 1, y + 6, 4, 14);
    ctx.fillRect(x + 19, y + 6, 4, 14);
    // Stitch lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 12);
    ctx.lineTo(x + 20, y + 12);
    ctx.moveTo(x + 4, y + 15);
    ctx.lineTo(x + 20, y + 15);
    ctx.stroke();
    // Legs
    ctx.fillStyle = '#2a1812';
    ctx.fillRect(x + 4, y + 20, 4, 3);
    ctx.fillRect(x + 16, y + 20, 4, 3);
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
    if (row === 2 && col === 18) SPRITES.slidingDoor(x, y); // decorative
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
      case 'cat_alice':
        SPRITES.catTree(x, y);
        SPRITES.cat(x, y - 4, '#f5a623', '#ff8'); // orange tabby
        break;
      case 'cat_olive':
        SPRITES.treadmill(x, y);
        SPRITES.cat(x, y - 2, '#808080', '#aaa'); // gray cat
        break;
      case 'cat_beatrice':
        SPRITES.bed(x, y, true);
        if (!gameState.flags.beatrice_fed) {
          // Blanket lump
          ctx.fillStyle = '#6b5b95';
          ctx.fillRect(x + 6, y + 10, 12, 8);
          // Ears poking out
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(x + 8, y + 8, 3, 3);
          ctx.fillRect(x + 13, y + 8, 3, 3);
        } else {
          SPRITES.cat(x, y + 2, '#2a2a2a', '#ffb6c1'); // black cat
        }
        break;
      case 'sofa_blanket':
        SPRITES.sofa(x, y);
        if (!gameState.flags.sofa_searched) {
          // Blanket on sofa
          ctx.fillStyle = '#f4d05e';
          ctx.fillRect(x + 5, y + 8, 14, 9);
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 5.5, y + 8.5, 13, 8);
          ctx.fillStyle = 'rgba(255, 215, 64, 0.65)';
          ctx.fillRect(x + 10, y + 7, 3, 3);
        }
        break;
      case 'basement_door':
        SPRITES.door(x, y, !gameState.flags.basement_unlocked);
        break;
      case 'sliding_door':
        SPRITES.slidingDoor(x, y);
        break;
      case 'futon':
        SPRITES.futon(x, y);
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

  SPRITES.player(px, py, p.facing);
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

function render() {
  const floor = getCurrentFloor();

  // Clear
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

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
  updateInteractPrompt();
  render();
  requestAnimationFrame(gameLoop);
}

// ======================== INPUT HANDLING ========================

document.addEventListener('keydown', function(e) {
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

    gameState.currentFloor = data.currentFloor || 'main';
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

// ======================== TITLE SCREEN ========================

function showTitleScreen() {
  document.getElementById('title-screen').style.display = 'flex';
}

function hideTitleScreen() {
  document.getElementById('title-screen').style.display = 'none';
}

function startNewGame() {
  clearSave();
  gameState.currentFloor = 'main';
  gameState.player = { row: 8, col: 9, facing: 'down' };
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
    game_complete: false
  };
  renderInventory();
  updateFloorLabel();
  hideTitleScreen();
}

function continueGame() {
  renderInventory();
  updateFloorLabel();
  hideTitleScreen();
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

  // Start game loop
  requestAnimationFrame(gameLoop);
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', init);
