const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const SAVE = 'marice_cats_adventure_save';
function valid() {
  return { currentFloor: 'outside', player: { row: 12, col: 9, facing: 'down' },
    inventory: ['purrpops'], flags: { pet_count: 4 }, playTimeMs: 1234 };
}
function boot(raw) {
  const g = setup();
  if (raw !== undefined) g.storage.set(SAVE, raw);
  g.run('init()');
  return g;
}
function snapshot(g) {
  return g.run('JSON.stringify({gameState,playTimeOffsetMs,gameSessionActive,newGameSession})');
}
const invalid = [
  ['null root', () => null],
  ['array root', () => []],
  ['string root', () => 'case'],
  ['empty root', () => ({})],
  ['unknown floor', d => ({ ...d, currentFloor: 'attic' })],
  ['missing player', d => { delete d.player; return d; }],
  ['array player', d => ({ ...d, player: [] })],
  ['missing row', d => { delete d.player.row; return d; }],
  ['fractional row', d => { d.player.row = 12.5; return d; }],
  ['fractional column', d => { d.player.col = 9.5; return d; }],
  ['string coordinate', d => { d.player.row = '12'; return d; }],
  ['negative coordinate', d => { d.player.row = -1; return d; }],
  ['out of bounds', d => { d.player.col = 20; return d; }],
  ['wall tile', d => { d.player.row = 0; d.player.col = 4; return d; }],
  ['unknown facing', d => { d.player.facing = 'north'; return d; }],
  ['null facing', d => { d.player.facing = null; return d; }],
  ['non-array inventory', d => ({ ...d, inventory: 'purrpops' })],
  ['unknown item', d => ({ ...d, inventory: ['purrpops', 'magic_key'] })],
  ['null flags', d => ({ ...d, flags: null })],
  ['array flags', d => ({ ...d, flags: [] })],
  ['string boolean', d => { d.flags.alice_fed = 'false'; return d; }],
  ['numeric boolean', d => { d.flags.game_complete = 1; return d; }],
  ['negative pet count', d => { d.flags.pet_count = -1; return d; }],
  ['fractional pet count', d => { d.flags.pet_count = 0.5; return d; }],
  ['unsafe pet count', d => { d.flags.pet_count = 1e30; return d; }],
  ['unknown flag', d => { d.flags.future_feature = true; return d; }],
  ['prototype field', d => { d.flags = JSON.parse('{"__proto__":{"alice_fed":true}}'); return d; }],
  ['non-array evidence', d => { d.flags.evidence = 'testimony'; return d; }],
  ['unknown evidence', d => { d.flags.evidence = ['not_evidence']; return d; }],
  ['unknown toy', d => { d.flags.cat_toys_found = ['not_toy']; return d; }],
  ['unknown diary page', d => { d.flags.diary_pages_found = ['not_page']; return d; }],
  ['unknown chapter', d => { d.flags.chapters_seen = ['not_chapter']; return d; }],
  ['unknown verdict', d => { d.flags.verdict = 'not_verdict'; return d; }],
  ['negative time', d => ({ ...d, playTimeMs: -1 })],
  ['string time', d => ({ ...d, playTimeMs: '1234' })],
  ['fractional time', d => ({ ...d, playTimeMs: 1.5 })],
  ['unsafe time', d => ({ ...d, playTimeMs: 1e30 })]
];
for (const [name, change] of invalid) {
  test(`rejects ${name} without mutating live state or saved bytes`, () => {
    const raw = JSON.stringify(change(valid()));
    const g = boot(raw);
    const before = snapshot(g);
    g.run('continueGame()');
    assert.equal(snapshot(g), before);
    assert.equal(g.storage.get(SAVE), raw);
    assert.match(g.document.getElementById('save-load-error').textContent, /saved data has not been changed/);
    assert.equal(g.document.getElementById('title-screen').style.display, 'flex');
  });
}

test('unparseable JSON stays untouched and displays a persistent title error', () => {
  const g = boot('{broken');
  g.run('continueGame()');
  assert.match(g.document.getElementById('save-load-error').textContent, /could not be read/);
  assert.equal(g.storage.get(SAVE), '{broken');
  assert.equal(g.run('gameSessionActive'), false);
});

test('missing saves and unavailable storage have distinct messages', () => {
  const g = boot();
  g.run('continueGame()');
  assert.match(g.document.getElementById('save-load-error').textContent, /No saved case/);
  g.run("localStorage.getItem=()=>{throw new Error('denied')};continueGame()");
  assert.match(g.document.getElementById('save-load-error').textContent, /storage could not be read/);
  assert.equal(g.run('gameSessionActive'), false);
});

test('valid older saves can omit optional fields and still load', () => {
  const d = valid();
  delete d.inventory; delete d.flags; delete d.playTimeMs; delete d.player.facing;
  const g = boot(JSON.stringify(d));
  g.run('continueGame()');
  assert.equal(g.run('gameSessionActive'), true);
  assert.equal(g.run('gameState.player.facing'), 'down');
  assert.equal(g.run('gameState.flags.pet_count'), 0);
  assert.equal(g.run('gameState.inventory.length'), 0);
});

test('validation copies collections, preserves repeated consumables, and repairs valid legacy rewards', () => {
  const g = boot();
  g.run(`window.source = ${JSON.stringify(valid())};
    window.source.inventory=['purrpops','purrpops'];
    window.source.flags={alice_fed:true,sofa_searched:true,evidence:['jar','jar']};
    window.before=JSON.stringify(window.source);
    window.candidate=validateSavedGame(window.source)`);
  assert.equal(g.run('JSON.stringify(window.source)'), g.window.before);
  assert.equal(g.run("window.candidate.inventory.filter(x=>x==='purrpops').length"), 2);
  assert.equal(g.run("window.candidate.inventory.includes('basement_key')"), true);
  assert.equal(g.run("window.candidate.flags.evidence.join(',')"), 'jar,testimony');
});

test('late validation failure does not cancel an active transition or apply early fields', () => {
  const g = boot();
  g.run("startNewGame();changeFloor('main')");
  const before = snapshot(g);
  const timers = [...g.timers.keys()];
  const d = valid(); d.playTimeMs = -1;
  const raw = JSON.stringify(d);
  g.storage.set(SAVE, raw);
  assert.equal(g.run('loadGame()'), false);
  assert.equal(snapshot(g), before);
  assert.deepEqual([...g.timers.keys()], timers);
  assert.equal(g.run('activeFloorTransition !== null'), true);
  assert.equal(g.storage.get(SAVE), raw);
});

test('successful retry clears the error and loads only the validated candidate', () => {
  const g = boot('{broken');
  g.run('continueGame()');
  const d = valid();
  g.storage.set(SAVE, JSON.stringify(d));
  g.run('continueGame()');
  assert.equal(g.document.getElementById('save-load-error').textContent, '');
  assert.equal(g.run('lastLoadError'), '');
  assert.equal(g.run('gameSessionActive'), true);
  assert.equal(g.run('gameState.flags.pet_count'), 4);
  assert.equal(g.run('playTimeOffsetMs'), 1234);
});

test('every authored floor start and direction round-trips', () => {
  const g = boot();
  for (const floor of ['outside','main','basement','upstairs','garden']) {
    for (const facing of ['up','down','left','right']) {
      const d = valid();
      d.currentFloor = floor;
      d.player = JSON.parse(g.run(`JSON.stringify({...FLOORS.${floor}.start,facing:'${facing}'})`));
      g.storage.set(SAVE, JSON.stringify(d));
      assert.equal(g.run('loadGame()'), true, `${floor}: ${facing}`);
      assert.equal(g.run('gameState.currentFloor'), floor);
      assert.equal(g.run('gameState.player.facing'), facing);
    }
  }
});
