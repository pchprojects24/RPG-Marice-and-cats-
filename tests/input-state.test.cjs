const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const SAVE_KEY = 'marice_cats_adventure_save';

function boot(options) {
  const g = setup(options);
  g.run('init()');
  return g;
}
function active(options) {
  const g = boot(options);
  g.elements.get('btn-new-game').dispatch('click');
  return g;
}
function frames(g, count = 16) {
  g.run(`for (let i=0;i<${count};i++) updateStep()`);
}
function flushSave(g) {
  for (const [id, timer] of [...g.timers]) {
    if (timer.ms === 500) { g.timers.delete(id); timer.fn(); }
  }
}
function position(g) { return g.run('JSON.stringify(gameState.player)'); }

test('title keyboard, touch, and save attempts preserve the existing save', () => {
  const g = boot();
  const original = JSON.stringify({ flags: { alice_fed: true }, marker: 'existing progress' });
  g.storage.set(SAVE_KEY, original);
  const before = position(g);
  g.document.dispatch('keydown', { code: 'ArrowUp' });
  frames(g);
  g.document.dispatch('keydown', { code: 'KeyE' });
  g.document.dispatch('keydown', { code: 'KeyQ' });
  g.document.dispatch('keydown', { code: 'KeyH' });
  g.elements.get('btn-up').dispatch('pointerdown');
  g.elements.get('btn-interact').dispatch('pointerdown');
  g.elements.get('btn-toggle-quest').dispatch('click');
  g.run('saveGame(); saveGameImmediate(); doSaveGame()');
  flushSave(g);
  assert.equal(position(g), before);
  assert.equal(g.run('dialogueActive'), false);
  assert.equal(g.elements.get('quest-panel').classList.contains('active'), false);
  assert.equal(g.storage.get(SAVE_KEY), original);
});

test('movement and interaction still work during exploration', () => {
  const g = active();
  g.document.dispatch('keydown', { code: 'ArrowUp' });
  frames(g, 8);
  g.document.dispatch('keyup', { code: 'ArrowUp' });
  assert.equal(g.run('gameState.player.row'), 11);
  g.run("gameState.player={row:5,col:9,facing:'up'}");
  g.document.dispatch('keydown', { code: 'KeyE' });
  assert.equal(g.run('dialogueActive'), true);
});

for (const panel of ['quest-panel', 'settings-panel', 'numpad-overlay', 'pause-overlay', 'transition-overlay', 'ending-overlay']) {
  test(`${panel} blocks all world input and clears held movement`, () => {
    const g = active();
    g.run("gameState.player={row:5,col:9,facing:'up'}");
    g.document.getElementById(panel).classList.add('active');
    if (panel === 'pause-overlay') g.run('gamePaused=true');
    const before = position(g);
    g.document.dispatch('keydown', { code: 'ArrowRight' });
    g.document.dispatch('keydown', { code: 'KeyE' });
    g.elements.get('btn-up').dispatch('pointerdown');
    g.elements.get('btn-interact').dispatch('pointerdown');
    g.elements.get('game-canvas').dispatch('pointerdown', {clientX:100,clientY:100});
    g.elements.get('game-canvas').dispatch('pointermove', {clientX:150,clientY:100});
    g.elements.get('game-canvas').dispatch('pointerup');
    // Even keys already held before the next frame cannot bypass the screen.
    g.run('keysDown.ArrowRight=true');
    frames(g);
    assert.equal(position(g), before);
    assert.equal(g.run('dialogueActive'), false);
    assert.equal(g.run('Object.values(keysDown).some(Boolean)'), false);
  });
}

test('opening and closing a menu cancels a held key until a fresh press', () => {
  const g = active();
  g.run("gameState.player.facing='up'");
  const before = position(g);
  g.document.dispatch('keydown', { code: 'ArrowUp' });
  frames(g, 2); // An unfinished movement must not complete behind the panel.
  g.document.dispatch('keydown', { code: 'KeyQ' });
  frames(g);
  g.document.dispatch('keydown', { code: 'Escape' });
  g.document.dispatch('keydown', { code: 'ArrowUp', repeat: true });
  frames(g);
  assert.equal(position(g), before);
  g.document.dispatch('keyup', { code: 'ArrowUp' });
  g.document.dispatch('keydown', { code: 'ArrowUp' });
  frames(g, 8);
  assert.equal(g.run('gameState.player.row'), 11);
});

test('native buttons and sliders keep their keyboard input', () => {
  const g = active();
  g.run("gameState.player={row:5,col:9,facing:'up'}");
  const button = {closest: selector => selector === 'button, a' ? {} : null};
  for (const code of ['Enter', 'Space']) {
    const e = g.document.dispatch('keydown', {code, target:button});
    assert.equal(e.defaultPrevented, false);
    assert.equal(g.run('dialogueActive'), false);
  }
  const input = {closest: selector => selector.includes('input') ? {} : null};
  for (const code of ['ArrowRight', 'KeyQ', 'Space']) {
    assert.equal(g.document.dispatch('keydown', {code,target:input}).defaultPrevented, false);
  }
  assert.equal(g.run('Object.values(keysDown).some(Boolean)'), false);
  // Keyboard shortcuts still work when a HUD button has focus.
  g.document.dispatch('keydown', {code:'KeyQ',target:button});
  assert.equal(g.elements.get('quest-panel').classList.contains('active'), true);
  assert.equal(g.elements.get('btn-close-quest').focusOptions.preventScroll, true);
  g.document.dispatch('keydown', {code:'KeyQ',target:button});
  assert.equal(g.elements.get('quest-panel').classList.contains('active'), false);
});

test('dialogue keys and choices work without leaving movement held', () => {
  const g = active();
  g.run("startChoiceDialogue('Marice','Choose',null,[{label:'First'},{label:'Second'}],i=>{gameState.flags.testChoice=i});finishTypewriter()");
  const before = position(g);
  g.document.dispatch('keydown', {code:'ArrowDown'});
  assert.equal(g.run('dialogueChoices.selected'), 1);
  g.document.dispatch('keydown', {code:'Enter'});
  frames(g);
  assert.equal(g.run('gameState.flags.testChoice'), 1);
  assert.equal(position(g), before);
  g.run("startDialogue('outside_riddle_board');finishTypewriter()");
  frames(g, 1);
  assert.equal(g.elements.get('btn-interact').disabled, false);
  g.elements.get('btn-interact').dispatch('pointerdown');
  assert.equal(g.run('dialogueIndex'), 1);
});

for (const pointerEvents of [true, false]) {
  test(`${pointerEvents ? 'pointer' : 'legacy touch'} gestures cannot survive a menu or cancellation`, () => {
    const g = active({pointerEvents});
    const canvas = g.elements.get('game-canvas');
    const down = pointerEvents ? 'pointerdown' : 'touchstart';
    const move = pointerEvents ? 'pointermove' : 'touchmove';
    const up = pointerEvents ? 'pointerup' : 'touchend';
    const point = x => ({clientX:x,clientY:100,touches:[{clientX:x,clientY:100}]});
    canvas.dispatch(down, point(100));
    g.elements.get('btn-toggle-quest').dispatch('click');
    g.elements.get('btn-close-quest').dispatch('click');
    const before = position(g);
    canvas.dispatch(move, point(160));
    canvas.dispatch(up);
    frames(g);
    assert.equal(position(g), before);
    // A fresh drag still moves the character.
    canvas.dispatch(down, point(100));
    canvas.dispatch(move, point(160));
    frames(g, 8);
    canvas.dispatch(up);
    assert.equal(g.run('gameState.player.col'), 10);
    g.run("gameState.player={row:5,col:9,facing:'up'}");
    canvas.dispatch(down, point(100));
    canvas.dispatch(pointerEvents ? 'pointercancel' : 'touchcancel');
    assert.equal(g.run('dialogueActive'), false);
  });
}

test('quit to title cancels delayed saves; Continue reactivates the saved game', () => {
  const g = active();
  g.run('gameState.flags.pet_count=23; saveGame()');
  g.document.dispatch('keydown', {code:'KeyP'});
  g.elements.get('btn-quit-title').dispatch('click');
  const saved = g.storage.get(SAVE_KEY);
  assert.equal(JSON.parse(saved).flags.pet_count, 23);
  g.run('gameState.flags.pet_count=0;doSaveGame()');
  flushSave(g);
  assert.equal(g.storage.get(SAVE_KEY), saved);
  g.elements.get('btn-continue').dispatch('click');
  assert.equal(g.run('gameState.flags.pet_count'), 23);
  assert.equal(g.run('getGameScreen()'), 'exploration');
  g.document.dispatch('keydown', {code:'ArrowUp'});
  frames(g,8);
  assert.equal(g.run('gameState.player.row'), 11);
});

test('failed Continue and invisible restart controls cannot start or erase a game', () => {
  const g = boot();
  g.storage.set(SAVE_KEY, '{invalid');
  g.elements.get('btn-continue').dispatch('click');
  g.elements.get('btn-restart').dispatch('click');
  g.elements.get('btn-quit-title').dispatch('click');
  g.run('saveGameImmediate()');
  assert.equal(g.storage.get(SAVE_KEY), '{invalid');
  assert.equal(g.run('gameSessionActive'), false);
});

test('prologue waits until a blocking menu has closed', () => {
  const g = active();
  g.elements.get('btn-toggle-quest').dispatch('click');
  for (const [id,timer] of [...g.timers]) {
    if (timer.ms===2600) {g.timers.delete(id);timer.fn();}
  }
  frames(g);
  assert.equal(g.run('dialogueActive'), false);
  g.elements.get('btn-close-quest').dispatch('click');
  frames(g,1);
  assert.equal(g.run('dialogueActive'), true);
});

test('focus loss and hidden-page input cannot leave movement active', () => {
  const g = active();
  g.run("gameState.player.facing='up'");
  const before = position(g);
  g.document.dispatch('keydown',{code:'ArrowUp'});
  frames(g,2);
  g.window.dispatch('blur');
  frames(g,8);
  assert.equal(position(g), before);
  g.document.hidden=true;
  g.document.dispatch('visibilitychange');
  g.document.dispatch('keydown',{code:'ArrowUp'});
  frames(g);
  assert.equal(position(g), before);
  g.document.hidden=false;
  assert.equal(g.run('getGameScreen()'), 'paused');
  g.elements.get('btn-resume').dispatch('click');
  assert.equal(g.run('getGameScreen()'), 'exploration');
});

test('keyboard focus returns to the game after title, code entry, pause, and dialogue', () => {
  const g = active();
  const canvas = g.elements.get('game-canvas');
  assert.equal(g.document.activeElement, canvas);
  g.run('showNumpad(()=>{})');
  g.elements.get('numpad-input').focus();
  g.run('hideNumpad()');
  assert.equal(g.document.activeElement, canvas);
  g.document.dispatch('keydown',{code:'KeyP'});
  assert.equal(g.document.activeElement, g.elements.get('btn-resume'));
  g.elements.get('btn-resume').dispatch('click');
  assert.equal(g.document.activeElement, canvas);
  g.run("startDialogue('outside_riddle_board');closeDialogue()");
  assert.equal(g.document.activeElement, canvas);
});

test('quitting before the prologue timer fires does not replay it after Continue', () => {
  const g = active();
  g.document.dispatch('keydown',{code:'KeyP'});
  g.elements.get('btn-quit-title').dispatch('click');
  g.elements.get('btn-continue').dispatch('click');
  for (const [id,timer] of [...g.timers]) {
    if (timer.ms===2600) {g.timers.delete(id);timer.fn();}
  }
  frames(g);
  assert.equal(g.run('dialogueActive'), false);
});
