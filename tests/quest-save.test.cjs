const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const SAVE_KEY = 'marice_cats_adventure_save';

function game() {
  const g = setup();
  g.run(`
    gameSessionActive = true;
    document.getElementById('title-screen').style.display = 'none';
    gameState.currentFloor = 'main';
    gameState.player = { ...mainFloorStart, facing: 'up' };
    gameState.flags.front_door_unlocked = true;
    function finishScene() {
      let steps = 0;
      while (dialogueActive && !dialogueChoices && steps++ < 100) {
        finishTypewriter();
        advanceDialogue();
      }
      if (steps >= 100) throw Error('Dialogue did not finish');
    }
  `);
  return g;
}

function flushAutosave(g) {
  for (const [id, timer] of [...g.timers]) {
    if (timer.ms === 500) {
      g.timers.delete(id);
      timer.fn();
    }
  }
}

function reload(g) {
  const fresh = game();
  fresh.storage.set(SAVE_KEY, g.storage.get(SAVE_KEY));
  assert.equal(fresh.run('loadGame()'), true);
  return fresh;
}

const exchanges = [
  { name: 'Alice testimony', seed: "gameState.inventory = [ITEMS.PURRPOPS]", action: "handleInteraction({type:'cat_alice'})", flag: 'alice_fed', item: 'purrpops', reward: "gameState.flags.evidence.includes('testimony')" },
  { name: 'sofa key', seed: 'gameState.flags.alice_fed = true', action: "handleInteraction({type:'sofa_blanket'})", flag: 'sofa_searched', reward: "hasItem(ITEMS.BASEMENT_KEY) && gameState.flags.has_basement_key" },
  { name: 'basement unlock', seed: "gameState.inventory = [ITEMS.BASEMENT_KEY]", action: "handleInteraction({type:'basement_door'})", flag: 'basement_unlocked', item: 'basement_key', reward: "gameState.flags.evidence.includes('crumbs')" },
  { name: 'Olive basket', seed: "gameState.currentFloor='basement';gameState.player={...basementStart,facing:'up'};gameState.inventory=[ITEMS.PURRPOPS]", action: "handleInteraction({type:'cat_olive'})", flag: 'olive_fed', item: 'purrpops', reward: "hasItem(ITEMS.LAUNDRY_BASKET) && gameState.flags.evidence.includes('olive')" },
  { name: 'laundry by walking', seed: 'gameState.inventory=[ITEMS.LAUNDRY_BASKET]', action: 'handleStairTransition(FLOORS.main.stairs.toUpstairs.rows[0], FLOORS.main.stairs.toUpstairs.cols[0])', flag: 'laundry_cleared', item: 'laundry_basket', reward: "gameState.flags.evidence.includes('avalanche')" },
  { name: 'laundry by interaction', seed: "gameState.inventory=[ITEMS.LAUNDRY_BASKET];gameState.player={row:FLOORS.main.stairs.toUpstairs.rows[0]+1,col:FLOORS.main.stairs.toUpstairs.cols[0],facing:'up'}", action: 'checkLaundryInteraction()', flag: 'laundry_cleared', item: 'laundry_basket', reward: "gameState.flags.evidence.includes('avalanche')" }
];

for (const exchange of exchanges) {
  test(`${exchange.name}: interrupt, reload, retry, and complete`, () => {
    const g = game();
    g.run(exchange.seed);
    g.run('saveGameImmediate(); saveGame()'); // A movement save is already pending.
    g.run(exchange.action);
    assert.equal(g.run('dialogueActive'), true);
    flushAutosave(g);
    const resumed = reload(g);
    assert.equal(resumed.run(`gameState.flags.${exchange.flag}`), false);
    if (exchange.item) assert.equal(resumed.run(`hasItem('${exchange.item}')`), true);
    resumed.run(exchange.action);
    resumed.run('finishScene()');
    assert.equal(resumed.run(`gameState.flags.${exchange.flag}`), true);
    assert.equal(resumed.run(exchange.reward), true);
    if (exchange.item) assert.equal(resumed.run(`hasItem('${exchange.item}')`), false);
    // The completed reward is durable without waiting for another movement save.
    const completed = reload(resumed);
    assert.equal(completed.run(exchange.reward), true);
    assert.equal(completed.run(`gameState.flags.${exchange.flag}`), true);
  });
}

test('legacy missing rewards repair without duplicates or unrelated changes', () => {
  const g = game();
  g.run(`Object.assign(gameState.flags, {alice_fed:true,sofa_searched:true,has_basement_key:true,olive_fed:true,pet_count:17,diary_pages_found:['home'],cat_toys_found:['jingle_ball']});doSaveGame()`);
  const repaired = reload(g);
  for (let i = 0; i < 3; i++) {
    repaired.run('saveGameImmediate(); loadGame()');
  }
  assert.equal(repaired.run("gameState.inventory.filter(x=>x===ITEMS.BASEMENT_KEY).length"), 1);
  assert.equal(repaired.run("gameState.inventory.filter(x=>x===ITEMS.LAUNDRY_BASKET).length"), 1);
  assert.equal(repaired.run("gameState.flags.evidence.filter(x=>x==='testimony').length"), 1);
  assert.equal(repaired.run("gameState.flags.evidence.filter(x=>x==='olive').length"), 1);
  assert.equal(repaired.run('gameState.flags.pet_count'), 17);
  assert.equal(repaired.run("gameState.flags.diary_pages_found.join(',')"), 'home');
  assert.equal(repaired.run("gameState.flags.cat_toys_found.join(',')"), 'jingle_ball');
});

test('legacy spent rewards are not restored', () => {
  const g = game();
  g.run('Object.assign(gameState.flags,{sofa_searched:true,has_basement_key:true,basement_unlocked:true,olive_fed:true,laundry_cleared:true});doSaveGame()');
  const repaired = reload(g);
  assert.equal(repaired.run('hasItem(ITEMS.BASEMENT_KEY) || hasItem(ITEMS.LAUNDRY_BASKET)'), false);
  assert.equal(repaired.run("gameState.flags.evidence.includes('crumbs') && gameState.flags.evidence.includes('avalanche')"), true);
});

function solveDeduction(g) {
  g.run(`
    let n=0;
    while (!gameState.flags.ending_pending && n++<100) {
      finishTypewriter();
      if (dialogueChoices) {
        const q=DEDUCTION.find(q=>q.question===dialogueText.textContent);
        if (!q) throw Error('Unexpected choice before deduction completed');
        pickDialogueChoice(SUSPECT_OPTIONS.findIndex(o=>o.value===q.answer));
      } else advanceDialogue();
    }
    if (!gameState.flags.ending_pending) throw Error('Deduction did not finish');
  `);
}

for (const index of [0, 1, 2]) {
  test(`ending preserves verdict ${index + 1} across confession and reply reloads`, () => {
    const g = game();
    g.run("gameState.inventory=[ITEMS.FEAST_PLATE];handleInteraction({type:'cat_beatrice'})");
    solveDeduction(g);
    const confession = reload(g);
    assert.equal(confession.run('gameState.flags.game_complete'), false);
    assert.equal(confession.run('hasItem(ITEMS.FEAST_PLATE)'), false);
    confession.run('continueGame(); finishScene(); finishTypewriter()');
    assert.equal(confession.run('!!dialogueChoices'), true);
    confession.run(`pickDialogueChoice(${index})`);
    const reply = reload(confession);
    assert.equal(reply.run('gameState.flags.game_complete'), false);
    assert.equal(reply.run('gameState.flags.verdict'), reply.run(`VERDICTS[${index}].id`));
    reply.run('continueGame()');
    assert.equal(reply.run('dialogueQueue[0].text'), reply.run(`VERDICTS[${index}].reply.text`));
    reply.run('finishScene()');
    assert.equal(reply.run('gameState.flags.game_complete'), true);
    assert.equal(reply.run('gameState.flags.ending_pending'), false);
    assert.equal(reply.run("document.getElementById('ending-overlay').classList.contains('active')"), true);
    const completed = reload(reply);
    completed.run('continueGame()');
    assert.equal(completed.run('freeRoam'), true);
    assert.equal(completed.run('dialogueActive'), false);
  });
}

test('interrupted deduction keeps the feast and can be restarted', () => {
  const g = game();
  g.run("gameState.inventory=[ITEMS.FEAST_PLATE];saveGameImmediate();handleInteraction({type:'cat_beatrice'});finishScene();finishTypewriter();pickDialogueChoice(0);saveGameImmediate()");
  const resumed = reload(g);
  assert.equal(resumed.run('hasItem(ITEMS.FEAST_PLATE)'), true);
  assert.equal(resumed.run('gameState.flags.beatrice_fed || gameState.flags.game_complete'), false);
  resumed.run("handleInteraction({type:'cat_beatrice'})");
  solveDeduction(resumed);
});

test('legacy premature completion resumes the missing verdict', () => {
  const g = game();
  g.run('Object.assign(gameState.flags,{beatrice_fed:true,game_complete:true,verdict:null});doSaveGame()');
  const repaired = reload(g);
  repaired.run('continueGame(); finishScene(); finishTypewriter()');
  assert.equal(repaired.run('freeRoam'), false);
  assert.equal(repaired.run('gameState.flags.game_complete'), false);
  assert.equal(repaired.run('!!dialogueChoices'), true);
});

test('uninterrupted complete case retains all seven evidence entries', () => {
  const g = game();
  g.run(`
    for(const type of ['treat_jar','pet_cam','cupboard_purrpops','cat_alice','sofa_blanket','basement_door','cupboard_purrpops','cat_olive']) {
      handleInteraction({type});finishScene();
    }
    handleStairTransition(FLOORS.main.stairs.toUpstairs.rows[0], FLOORS.main.stairs.toUpstairs.cols[0]);finishScene();
    handleInteraction({type:'cupboard_feast'});finishScene();handleInteraction({type:'cat_beatrice'});
  `);
  solveDeduction(g);
  g.run('finishScene();finishTypewriter();pickDialogueChoice(0);finishScene()');
  assert.equal(g.run('gameState.flags.game_complete'), true);
  assert.equal(g.run('new Set(gameState.flags.evidence).size'), 7);
  assert.equal(reload(g).run('gameState.flags.game_complete'), true);
});
