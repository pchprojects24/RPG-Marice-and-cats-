const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const SAVE_KEY = 'marice_cats_adventure_save';

function game() {
  const g = setup();
  g.run('init(); startNewGame(); saveGameImmediate()');
  return g;
}
function timersAt(g, ms) {
  return [...g.timers].filter(([,timer]) => timer.ms === ms);
}
function fire(g, ms) {
  const timers = timersAt(g, ms);
  assert.equal(timers.length, 1, `Expected one ${ms} ms transition timer`);
  const [id,timer] = timers[0];
  g.timers.delete(id);
  timer.fn();
}
function snapshot(g) {
  return g.run('JSON.stringify({floor:gameState.currentFloor,player:gameState.player,flags:gameState.flags})');
}
function finish(g) { fire(g,350);fire(g,400); }

test('repeated floor requests queue only one arrival and one reveal', () => {
  const g = game();
  g.run("for(let i=0;i<5;i++) changeFloor('main')");
  assert.equal(timersAt(g,350).length,1);
  fire(g,350);
  g.run("changeFloor('basement');changeFloor('garden')");
  assert.equal(timersAt(g,350).length,0);
  assert.equal(timersAt(g,400).length,1);
  fire(g,400);
  assert.equal(g.run('gameState.currentFloor'),'main');
  assert.equal(g.run('activeFloorTransition'),null);
  assert.equal(g.run("gameState.flags.chapters_seen.filter(x=>x==='main').length"),1);
});

for (const stage of ['before arrival','after arrival']) {
  for (const action of ['showTitleScreen()', 'startNewGame()', 'restartGame()', 'loadGame()', 'showEnding()']) {
    test(`${action} cancels a transition ${stage}, including an already queued callback`, () => {
      const g = game();
      g.run("changeFloor('main')");
      if (stage === 'after arrival') fire(g,350);
      const oldCallback = timersAt(g,stage==='before arrival'?350:400)[0][1].fn;
      g.run(action);
      const after = snapshot(g);
      const saved = g.storage.get(SAVE_KEY);
      // Calling a captured callback simulates work queued just before cancellation.
      oldCallback();
      assert.equal(snapshot(g),after);
      assert.equal(g.storage.get(SAVE_KEY),saved);
      assert.equal(timersAt(g,350).length,0);
      assert.equal(timersAt(g,400).length,0);
      assert.equal(g.document.getElementById('transition-overlay').classList.contains('active'),false);
      assert.equal(g.run('activeFloorTransition'),null);
    });
  }
}

test('an old arrival callback cannot replace a newer transition', () => {
  const g = game();
  g.run("changeFloor('main')");
  const stale = timersAt(g,350)[0][1].fn;
  g.run("startNewGame();changeFloor('garden')");
  stale();
  assert.equal(g.document.getElementById('transition-label').textContent,'Backyard Garden');
  assert.equal(g.run('gameState.currentFloor'),'outside');
  finish(g);
  assert.equal(g.run('gameState.currentFloor'),'garden');
});

test('an old reveal callback cannot clear a newer fade or add its chapter', () => {
  const g = game();
  g.run("changeFloor('main')");
  fire(g,350);
  const stale = timersAt(g,400)[0][1].fn;
  g.run("startNewGame();changeFloor('garden')");
  stale();
  assert.equal(g.document.getElementById('transition-overlay').classList.contains('active'),true);
  assert.equal(g.run("gameState.flags.chapters_seen.includes('main')"),false);
  finish(g);
  assert.equal(g.run('gameState.currentFloor'),'garden');
});

test('arrival clears interpolation and held inputs, resets followers, and saves immediately', () => {
  const g = game();
  g.run("gameState.moving=true;gameState.moveFrom={row:12,col:9};gameState.moveTo={row:11,col:9};gameState.moveProgress=9;keysDown.ArrowUp=true;changeFloorTo('main',7,17,'left')");
  assert.equal(g.run('gameState.moving'),false);
  fire(g,350);
  assert.equal(g.run("JSON.stringify(gameState.player)"),'{"row":7,"col":17,"facing":"left"}');
  assert.equal(g.run('gameState.moveFrom === null && gameState.moveTo === null && gameState.moveProgress === 0'),true);
  assert.equal(g.run('Object.values(keysDown).some(Boolean)'),false);
  assert.equal(g.run("playerTrail.every(p=>p.x===17*TILE_SIZE+TILE_SIZE/2 && p.y===7*TILE_SIZE+TILE_SIZE/2 && p.facing==='left')"),true);
  const saved = JSON.parse(g.storage.get(SAVE_KEY));
  assert.equal(saved.currentFloor,'main');
  assert.deepEqual(saved.player,{row:7,col:17,facing:'left'});
  assert.equal(g.run('getGameScreen()'),'transition');
  const reloaded = setup();
  reloaded.storage.set(SAVE_KEY,g.storage.get(SAVE_KEY));
  reloaded.run('init();continueGame()');
  assert.equal(reloaded.run('gameState.currentFloor'),'main');
  assert.equal(reloaded.run('gameState.player.col'),17);
  fire(g,400);
  assert.equal(g.run('getGameScreen()'),'exploration');
});

const routes = [
  ['outside',12,9],['main',8,9],['basement',3,7],['upstairs',11,8],['garden',3,9],
  ['main',7,17],['main',8,10],['main',5,17]
];
test('every authored floor start and return doorway has a valid arrival tile', () => {
  for (const [floor,row,col] of routes) {
    const g = game();
    assert.equal(g.run(`changeFloorTo('${floor}',${row},${col},'left')`),true);
    finish(g);
    assert.equal(g.run(`gameState.currentFloor==='${floor}' && gameState.player.row===${row} && gameState.player.col===${col}`),true);
    assert.equal(g.run('isTileBlocked(getCurrentFloor(),gameState.player.row,gameState.player.col)'),false);
  }
});

test('invalid floors and unsafe coordinates are rejected without changing the game', () => {
  for (const request of [
    "changeFloor('missing')", "changeFloor('toString')",
    "changeFloorTo('main',-1,9)", "changeFloorTo('main',30,9)",
    "changeFloorTo('main',8.5,9)", "changeFloorTo('main',8,9.5)",
    "changeFloorTo('main',NaN,9)", "changeFloorTo('main',8,Infinity)",
    "changeFloorTo('main',0,0)", // Wall.
    "changeFloorTo('main',3,14)", // Alice occupies this tile.
    "changeFloorTo('main',6,10)" // Stairs could immediately send Marice elsewhere.
  ]) {
    const g = game();
    const before = snapshot(g);
    assert.equal(g.run(request),false,request);
    assert.equal(snapshot(g),before);
    assert.equal(timersAt(g,350).length,0);
    assert.equal(g.document.getElementById('transition-overlay').classList.contains('active'),false);
  }
});

test('a destination that becomes blocked during the fade cancels safely', () => {
  const g = game();
  g.run("changeFloor('main');FLOORS.main.grid[mainFloorStart.row][mainFloorStart.col]=T.WALL");
  const before = snapshot(g);
  fire(g,350);
  assert.equal(snapshot(g),before);
  assert.equal(g.run('activeFloorTransition'),null);
  assert.equal(g.run('getGameScreen()'),'exploration');
});

test('held stair movement produces one transition and does not move on arrival', () => {
  const g = game();
  g.run("gameState.currentFloor='main';gameState.flags.laundry_cleared=true;gameState.player={row:8,col:10,facing:'up'}");
  g.document.dispatch('keydown',{code:'ArrowUp'});
  g.run('for(let i=0;i<120;i++)updateStep()');
  assert.equal(timersAt(g,350).length,1);
  finish(g);
  g.document.dispatch('keydown',{code:'ArrowUp',repeat:true});
  g.run('for(let i=0;i<60;i++)updateStep()');
  assert.equal(g.run('gameState.player.row'),11);
  assert.equal(g.run('gameState.player.col'),8);
});

test('a transition cannot start on the title screen or while a menu owns input', () => {
  const g = setup();
  g.run('init()');
  assert.equal(g.run("changeFloor('main')"),false);
  g.run("startNewGame();toggleGamePanel('quest-panel')");
  assert.equal(g.run("changeFloor('main')"),false);
});
