const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');
const SAVE = 'marice_cats_adventure_save';
const BACKUP = SAVE + '_backup';
const REJECTED = SAVE + '_rejected';
function raw(pets = 7) {
  return JSON.stringify({currentFloor:'outside',player:{row:12,col:9,facing:'down'},
    inventory:['purrpops'],flags:{pet_count:pets},playTimeMs:1200});
}
function boot(primary, backup) {
  const g = setup();
  if (primary !== undefined) g.storage.set(SAVE, primary);
  if (backup !== undefined) g.storage.set(BACKUP, backup);
  for (const [id, children] of Object.entries({
    'title-screen':['btn-continue','btn-recover-save','btn-new-game'],
    'save-recovery-overlay':['btn-cancel-recovery','btn-confirm-recovery']
  })) {
    const panel = g.document.getElementById(id);
    g.document.getElementById('game-container').appendChild(panel);
    for (const name of children) {
      const button = g.document.getElementById(name); button.tagName='BUTTON'; panel.appendChild(button);
    }
  }
  g.run('init()');
  return g;
}
function click(g, id) { g.document.getElementById(id).dispatch('click'); }
function focused(g, id) { assert.equal(g.document.activeElement,g.document.getElementById(id)); }
function contents(g) { return JSON.stringify([...g.storage]); }
function live(g) { return g.run('JSON.stringify({gameState,gameSessionActive,playTimeOffsetMs})'); }

test('first save creates a validated backup; later saves retain the previous primary', () => {
  const g = boot();
  g.run('startNewGame();gameState.flags.pet_count=2;saveGameImmediate()');
  const first = g.storage.get(SAVE);
  assert.equal(g.storage.get(BACKUP),first);
  g.run('gameState.flags.pet_count=3;saveGameImmediate()');
  assert.equal(g.storage.get(BACKUP),first);
  assert.equal(JSON.parse(g.storage.get(SAVE)).flags.pet_count,3);
});

test('invalid live state cannot overwrite either save slot', () => {
  const g = boot();
  g.run('startNewGame();saveGameImmediate()');
  const before=contents(g);
  g.run('gameState.player.col=9.5;saveGameImmediate()');
  assert.equal(contents(g),before);
});

test('invalid primary is archived and never displaces an existing valid backup', () => {
  const g = boot(); g.run('startNewGame()');
  g.storage.set(SAVE,'{unreadable'); g.storage.set(BACKUP,raw());
  g.run('saveGameImmediate()');
  assert.equal(g.storage.get(REJECTED),'{unreadable');
  assert.equal(g.storage.get(BACKUP),raw());
  assert.equal(g.run('!!readSaveCandidate(localStorage.getItem(SAVE_KEY))'),true);
});

test('invalid primary and backup are replaced only after preserving the primary', () => {
  const g=boot();g.run('startNewGame()');
  g.storage.set(SAVE,'{original');g.storage.set(BACKUP,'{bad backup');
  g.run('saveGameImmediate()');
  assert.equal(g.storage.get(REJECTED),'{original');
  assert.equal(g.storage.get(BACKUP),g.storage.get(SAVE));
});

for (const cancel of ['button','Escape']) {
  test(`${cancel} cancellation preserves all stored data and live state`, () => {
    const g=boot('{broken',raw());const before=contents(g);const state=live(g);
    click(g,'btn-continue');click(g,'btn-recover-save');
    focused(g,'btn-cancel-recovery');
    assert.equal(g.document.getElementById('title-screen').inert,true);
    // Other title actions cannot act through the modal.
    click(g,'btn-new-game');click(g,'btn-continue');
    if(cancel==='button')click(g,'btn-cancel-recovery');
    else g.document.dispatch('keydown',{code:'Escape'});
    assert.equal(contents(g),before);assert.equal(live(g),state);
    focused(g,'btn-recover-save');
  });
}

test('confirmation preserves exact rejected bytes and resumes validated backup', () => {
  const bad='  {"player":false}  ';const g=boot(bad,raw(11));
  click(g,'btn-recover-save');click(g,'btn-confirm-recovery');
  assert.equal(g.storage.get(REJECTED),bad);
  assert.equal(g.run('gameState.flags.pet_count'),11);
  assert.equal(g.run("gameState.inventory.includes('purrpops')"),true);
  assert.equal(g.run('gameSessionActive'),true);
  focused(g,'game-canvas');
  assert.equal(g.document.getElementById('save-load-error').textContent,'');
  const after=contents(g);click(g,'btn-confirm-recovery');assert.equal(contents(g),after);
});

test('recovery dialog wraps Tab in both directions', () => {
  const g=boot('{broken',raw());click(g,'btn-recover-save');
  assert.equal(g.document.dispatch('keydown',{code:'Tab',shiftKey:true}).defaultPrevented,true);
  focused(g,'btn-confirm-recovery');
  assert.equal(g.document.dispatch('keydown',{code:'Tab'}).defaultPrevented,true);
  focused(g,'btn-cancel-recovery');
});

test('missing primary can recover a valid backup and requires confirmation before starting over', () => {
  const g=boot(undefined,raw());focused(g,'btn-recover-save');
  click(g,'btn-new-game');
  assert.equal(g.run('newCaseRequest'), 'title');
  click(g,'btn-cancel-new-case');
  click(g,'btn-recover-save');click(g,'btn-confirm-recovery');
  assert.equal(g.run('gameSessionActive'),true);
  assert.equal(g.run('gameState.flags.pet_count'),7);
});

for (const [name, primary, backup] of [
  ['valid primary',raw(10),raw(5)],['invalid backup','{bad','{bad backup'],['absent backup','{bad',undefined]
]) {
  test(`${name} does not offer recovery or replace the primary`, () => {
    const g=boot(primary,backup);const before=contents(g);
    assert.equal(g.document.getElementById('btn-recover-save').style.display,'none');
    click(g,'btn-recover-save');click(g,'btn-confirm-recovery');
    assert.equal(contents(g),before);assert.equal(g.run('gameSessionActive'),false);
  });
}

for(const change of ['primary','backup']) {
  test(`a changed ${change} invalidates an already opened recovery decision`, () => {
    const g=boot('{broken',raw());click(g,'btn-recover-save');
    g.storage.set(change==='primary'?SAVE:BACKUP,raw(22));
    const before=contents(g);click(g,'btn-confirm-recovery');
    assert.equal(contents(g),before);assert.equal(g.run('gameSessionActive'),false);
    assert.match(g.document.getElementById('save-load-error').textContent,/changed/);
    focused(g,'btn-continue');
  });
}

for(const key of [REJECTED,SAVE]) {
  test(`recovery write failure for ${key} retains original primary and stays on title`, () => {
    const g=boot('{broken',raw());click(g,'btn-recover-save');const before=live(g);
    g.run(`const realSetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key===${JSON.stringify(key)})throw Error('full');realSetItem(key,value)}`);
    click(g,'btn-confirm-recovery');
    assert.equal(g.storage.get(SAVE),'{broken');assert.equal(g.storage.get(BACKUP),raw());
    assert.equal(live(g),before);
    assert.match(g.document.getElementById('save-load-error').textContent,/Recovery could not be saved/);
  });
}

test('backup write failure prevents an ordinary save from replacing the primary', () => {
  const g=boot();g.run('startNewGame();saveGameImmediate()');const original=g.storage.get(SAVE);
  g.run("const realSetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key===SAVE_BACKUP_KEY)throw Error('full');realSetItem(key,value)};gameState.flags.pet_count=20;saveGameImmediate()");
  assert.equal(g.storage.get(SAVE),original);
});

test('new case clears old save, backup, and recovery archive without changing settings', () => {
  const g=boot('{old',raw());g.storage.set(REJECTED,'{older');g.storage.set('marice_cats_settings','kept');
  click(g,'btn-new-game');click(g,'btn-confirm-new-case');
  assert.equal(g.storage.has(SAVE),false);assert.equal(g.storage.has(BACKUP),false);assert.equal(g.storage.has(REJECTED),false);
  assert.equal(g.storage.get('marice_cats_settings'),'kept');assert.equal(g.run('gameSessionActive'),true);
});

test('new case removal failure retains primary and does not reset live progress', () => {
  const g=boot(raw());const before=live(g);
  g.run("localStorage.removeItem=()=>{throw Error('denied')}");
  click(g,'btn-new-game');click(g,'btn-confirm-new-case');
  assert.equal(g.storage.get(SAVE),raw());assert.equal(live(g),before);
  assert.equal(g.run('activeAccessiblePanel'),'title-screen');focused(g,'btn-continue');
});
