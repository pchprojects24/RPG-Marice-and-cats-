const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');

function game(start = true) {
  const g = setup();
  g.run(`init();
    window.draws = 0; window.updates = 0; window.requests = 0;
    render = function () { window.draws++; };
    const realUpdateStep = updateStep;
    updateStep = function () { window.updates++; realUpdateStep(); };
    requestAnimationFrame = function () { window.requests++; };
  `);
  if (start) g.run('startNewGame()');
  return g;
}
function frames(g, count, start = 1000, hz = 60) {
  g.run(`for (let n = 0; n < ${count}; n++) gameLoop(${start} + n * 1000 / ${hz})`);
}
function counts(g) { return [g.window.draws, g.window.updates]; }

test('30 seconds on title performs no world draws or updates', () => {
  const g = game(false);
  frames(g, 1800);
  assert.deepEqual(counts(g), [0, 0]);
  assert.equal(g.window.requests, 1800);
  g.run('startNewGame(); gameLoop(40000)');
  assert.deepEqual(counts(g), [1, 0]);
});

test('paused game draws one still frame and performs no world updates', () => {
  const g = game();
  g.run('togglePause()');
  frames(g, 1800);
  assert.deepEqual(counts(g), [1, 0]);
  assert.equal(g.run('animTimer'), 0);
  g.run('togglePause(); gameLoop(40000)');
  assert.deepEqual(counts(g), [2, 0]);
  g.run('gameLoop(40017)');
  assert.equal(g.window.updates, 1);
});

test('pause/resume without a frame in between discards elapsed paused time', () => {
  const g = game();
  g.run('gameLoop(1000); gameLoop(1017); togglePause(); togglePause(); gameLoop(61017)');
  assert.equal(g.window.updates, 1);
  g.run('gameLoop(61034)');
  assert.equal(g.window.updates, 2);
});

test('hidden page draws nothing; returning resumes behind pause without catch-up', () => {
  const g = game();
  g.run('gameLoop(1000)');
  g.document.hidden = true;
  g.document.dispatch('visibilitychange');
  frames(g, 30, 2000, 1);
  assert.deepEqual(counts(g), [1, 0]);
  g.document.hidden = false;
  g.document.dispatch('visibilitychange');
  g.run('gameLoop(40000)');
  assert.deepEqual(counts(g), [2, 0]);
  g.run('togglePause(); gameLoop(50000)');
  assert.deepEqual(counts(g), [3, 0]);
});

test('hidden dialogue resumes without catch-up even with no hidden callbacks', () => {
  const g = game();
  g.run("startDialogueLines([{speaker:'Marice',text:'Hello'}]); gameLoop(1000); gameLoop(1017)");
  const before = g.window.updates;
  g.document.hidden = true;
  g.document.dispatch('visibilitychange');
  g.document.hidden = false;
  g.document.dispatch('visibilitychange');
  g.run('gameLoop(60000)');
  assert.equal(g.window.updates, before);
  assert.equal(g.run('dialogueActive'), true);
  assert.equal(g.run('gamePaused'), false);
});

test('ending skips world work and Keep Playing resumes rendering', () => {
  const g = game();
  g.run('showEnding()');
  frames(g, 600);
  assert.deepEqual(counts(g), [0, 0]);
  g.elements.get('btn-keep-playing').dispatch('click');
  g.run('gameLoop(20000)');
  assert.deepEqual(counts(g), [1, 0]);
});

test('resize and late character art each refresh the paused scene only once', () => {
  const g = game();
  g.run('togglePause(); gameLoop(1000)');
  g.window.dispatch('resize');
  frames(g, 60, 2000);
  assert.deepEqual(counts(g), [2, 0]);
  g.run('characterAtlas.onload()');
  frames(g, 60, 3000);
  assert.deepEqual(counts(g), [3, 0]);
  g.run('characterAtlas.onerror()');
  frames(g, 60, 4000);
  assert.deepEqual(counts(g), [4, 0]);
});

test('a floor arriving while auto-paused refreshes the destination once', () => {
  const g = game();
  g.run("changeFloor('main')");
  g.document.hidden = true;
  g.document.dispatch('visibilitychange');
  g.document.hidden = false;
  g.document.dispatch('visibilitychange');
  g.run('gameLoop(1000)');
  assert.equal(g.window.draws, 1);
  for (const [id, timer] of [...g.timers]) if (timer.ms === 350) {
    g.timers.delete(id); timer.fn();
  }
  frames(g, 60, 2000);
  assert.equal(g.run('gameState.currentFloor'), 'main');
  assert.deepEqual(counts(g), [2, 0]);
});

for (const [name, open] of [
  ['exploration', ''],
  ['dialogue', "startDialogueLines([{speaker:'Marice',text:'Hello'}])"],
  ['settings', "toggleGamePanel('settings-panel')"],
  ['code entry', 'showNumpad(()=>{})'],
  ['floor transition', "changeFloor('main')"]
]) {
  test(`${name} retains rendering on every visible frame`, () => {
    const g = game();
    g.run(open);
    frames(g, 60);
    assert.equal(g.window.draws, 60);
    assert.ok(g.window.updates >= 58 && g.window.updates <= 59);
    assert.equal(g.window.requests, 60);
  });
}

test('60 and 120 Hz displays retain the same fixed-step game speed', () => {
  const updates = [];
  for (const hz of [60, 120]) {
    const g = game();
    frames(g, hz + 1, 1000, hz);
    updates.push(g.window.updates);
    assert.equal(g.window.draws, hz + 1);
  }
  assert.ok(Math.abs(updates[0] - updates[1]) <= 1);
  assert.ok(updates.every(n => n >= 59 && n <= 60));
});
