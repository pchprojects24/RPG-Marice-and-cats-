/*
 * game-main.js — Marice & Cats House Adventure — UI and entry
 * Numpad, title screen, ending, init. Depends on game-engine.js.
 */

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

  gameState.currentFloor = FLOOR_IDS.OUTSIDE;
  gameState.player = { row: outsideStart.row, col: outsideStart.col, facing: 'down' };
  gameState.inventory = [];
  gameState.flags = Object.assign({}, DEFAULT_FLAGS, { cat_toys_found: [] });
  updateFloorLabel();
  updateQuestCounter();
  updateQuestList();
  hideTitleScreen();
  startMusic(FLOOR_IDS.OUTSIDE);

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

  // Resume AudioContext on any click (e.g. after tab background)
  document.addEventListener('click', function () {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });

  // Quest panel toggle
  const questPanel = document.getElementById('quest-panel');
  const btnToggleQuest = document.getElementById('btn-toggle-quest');
  const btnCloseQuest = document.getElementById('btn-close-quest');

  const btnHint = document.getElementById('btn-hint');
  if (btnHint) {
    btnHint.addEventListener('click', function () {
      const hint = getNextTaskHint();
      showToast(hint || 'No hint right now.', hint ? 5000 : 2000);
    });
  }

  btnToggleQuest.addEventListener('click', function () {
    questPanel.classList.toggle('active');
    // Close settings if open
    document.getElementById('settings-panel').classList.remove('active');
    if (questPanel.classList.contains('active')) {
      btnCloseQuest.focus();
    } else {
      btnToggleQuest.focus();
    }
  });

  btnCloseQuest.addEventListener('click', function () {
    questPanel.classList.remove('active');
    btnToggleQuest.focus();
  });

  // Settings panel toggle
  const settingsPanel = document.getElementById('settings-panel');
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  btnToggleSettings.addEventListener('click', function () {
    settingsPanel.classList.toggle('active');
    // Close quest if open
    questPanel.classList.remove('active');
    if (settingsPanel.classList.contains('active')) {
      btnCloseSettings.focus();
    } else {
      btnToggleSettings.focus();
    }
  });

  btnCloseSettings.addEventListener('click', function () {
    settingsPanel.classList.remove('active');
    btnToggleSettings.focus();
  });

  // Escape closes Quest or Settings panel when open (and no other overlay is open)
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Escape') return;
    if (document.getElementById('numpad-overlay').classList.contains('active')) return;
    if (dialogueOverlay.classList.contains('active')) return;
    if (questPanel.classList.contains('active')) {
      questPanel.classList.remove('active');
      btnToggleQuest.focus();
      e.preventDefault();
    } else if (settingsPanel.classList.contains('active')) {
      settingsPanel.classList.remove('active');
      btnToggleSettings.focus();
      e.preventDefault();
    }
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
