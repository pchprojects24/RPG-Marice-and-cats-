const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const SAVE = 'marice_cats_adventure_save';

function game(saved) {
  const g = setup();
  const tree = {
    'title-screen': ['btn-continue', 'btn-new-game'],
    'new-case-overlay': ['btn-cancel-new-case', 'btn-confirm-new-case'],
    'ending-overlay': ['btn-keep-playing', 'btn-restart', 'btn-ending-title']
  };
  for (const [panel, controls] of Object.entries(tree)) {
    const parent = g.document.getElementById(panel);
    g.document.getElementById('game-container').appendChild(parent);
    for (const id of controls) {
      const button = g.document.getElementById(id);
      button.tagName = 'BUTTON';
      parent.appendChild(button);
    }
  }
  if (saved !== undefined) g.storage.set(SAVE, saved);
  g.run('init()');
  return g;
}
function click(g, id) { g.document.getElementById(id).dispatch('click'); }
function focused(g, id) { assert.equal(g.document.activeElement, g.document.getElementById(id)); }
function open(g) { click(g, 'btn-new-game'); }
function pending(g) { return g.run("document.getElementById('new-case-overlay').classList.contains('active')"); }
function validSave() {
  const g = game();
  g.run('startNewGame(); gameState.flags.pet_count=7; saveGameImmediate()');
  return g.storage.get(SAVE);
}

test('a fresh player starts directly without a replacement dialog', () => {
  const g = game();
  focused(g, 'btn-new-game');
  assert.equal(g.document.getElementById('btn-continue').style.display, 'none');
  open(g);
  assert.equal(pending(g), false);
  assert.equal(g.run('gameSessionActive'), true);
});

test('an existing case makes Continue primary and initially focused', () => {
  const saved = validSave();
  const g = game(saved);
  focused(g, 'btn-continue');
  assert.equal(g.document.getElementById('btn-new-game').classList.contains('secondary'), true);
  assert.equal(g.document.getElementById('btn-new-game').textContent, 'Start New Case');
  click(g, 'btn-continue');
  assert.equal(g.run('gameSessionActive'), true);
  assert.equal(g.run('gameState.flags.pet_count'), 7);
});

for (const cancel of ['button', 'Escape']) {
  test(`${cancel} cancellation preserves exact saved bytes and restores the opener`, () => {
    const saved = validSave();
    const g = game(saved);
    open(g);
    assert.equal(pending(g), true);
    focused(g, 'btn-cancel-new-case');
    assert.equal(g.document.getElementById('title-screen').inert, true);
    assert.equal(g.storage.get(SAVE), saved);
    // Neither hidden Continue nor game input may alter the save behind the decision.
    click(g, 'btn-continue');
    g.document.dispatch('keydown', { code: 'ArrowUp' });
    g.run('updateStep(); saveGameImmediate()');
    if (cancel === 'button') click(g, 'btn-cancel-new-case');
    else g.document.dispatch('keydown', { code: 'Escape' });
    assert.equal(pending(g), false);
    assert.equal(g.storage.get(SAVE), saved);
    assert.equal(g.run('gameSessionActive'), false);
    focused(g, 'btn-new-game');
    assert.equal(g.document.getElementById('new-case-overlay').inert, true);
  });
}

test('only explicit confirmation clears saved progress and starts a fresh case once', () => {
  const g = game(validSave());
  click(g, 'btn-confirm-new-case');
  assert.equal(g.run('gameSessionActive'), false);
  assert.ok(g.storage.has(SAVE));
  open(g);
  click(g, 'btn-confirm-new-case');
  assert.equal(g.run('gameSessionActive'), true);
  assert.equal(g.run('gameState.flags.pet_count'), 0);
  assert.equal(g.storage.has(SAVE), false);
  assert.equal(pending(g), false);
  const session = g.run('newGameSession');
  click(g, 'btn-confirm-new-case');
  assert.equal(g.run('newGameSession'), session);
});

test('replacement dialog wraps Tab in both directions with cancel as default', () => {
  const g = game(validSave());
  open(g);
  let e = g.document.dispatch('keydown', { code: 'Tab', shiftKey: true });
  assert.equal(e.defaultPrevented, true);
  focused(g, 'btn-confirm-new-case');
  e = g.document.dispatch('keydown', { code: 'Tab' });
  assert.equal(e.defaultPrevented, true);
  focused(g, 'btn-cancel-new-case');
});

test('corrupt saved text is protected even when Continue cannot load it', () => {
  const raw = '{broken save';
  const g = game(raw);
  click(g, 'btn-continue');
  assert.equal(g.run('gameSessionActive'), false);
  assert.equal(g.storage.get(SAVE), raw);
  open(g);
  assert.equal(pending(g), true);
  click(g, 'btn-cancel-new-case');
  assert.equal(g.storage.get(SAVE), raw);
});

test('storage read failures require confirmation instead of assuming an empty slot', () => {
  const g = game();
  g.run("localStorage.getItem=()=>{throw new Error('unavailable')}");
  open(g);
  assert.equal(pending(g), true);
  click(g, 'btn-cancel-new-case');
  assert.equal(g.run('gameSessionActive'), false);
});

test('a save appearing after page load is protected at click time', () => {
  const g = game();
  const saved = validSave();
  g.storage.set(SAVE, saved);
  open(g);
  assert.equal(pending(g), true);
  assert.equal(g.storage.get(SAVE), saved);
});

test('Play Again preserves ending and save until confirmed; cancellation returns to Play Again', () => {
  const g = game();
  g.run('startNewGame(); gameState.flags.game_complete=true; saveGameImmediate(); showEnding()');
  const saved = g.storage.get(SAVE);
  click(g, 'btn-restart');
  focused(g, 'btn-cancel-new-case');
  click(g, 'btn-keep-playing');
  assert.equal(g.run("document.getElementById('ending-overlay').classList.contains('active')"), true);
  click(g, 'btn-cancel-new-case');
  focused(g, 'btn-restart');
  assert.equal(g.storage.get(SAVE), saved);
  click(g, 'btn-restart');
  click(g, 'btn-confirm-new-case');
  assert.equal(g.run('gameState.flags.game_complete'), false);
  assert.equal(g.run("document.getElementById('ending-overlay').classList.contains('active')"), false);
  assert.equal(g.storage.has(SAVE), false);
  focused(g, 'game-canvas');
});

test('quit to title promotes Continue and a hard title reset cancels a pending decision', () => {
  const g = game();
  open(g);
  g.run('togglePause()');
  click(g, 'btn-quit-title');
  focused(g, 'btn-continue');
  open(g);
  g.run('showTitleScreen()');
  assert.equal(pending(g), false);
  const saved = g.storage.get(SAVE);
  click(g, 'btn-confirm-new-case');
  assert.equal(g.storage.get(SAVE), saved);
  assert.equal(g.run('gameSessionActive'), false);
});
