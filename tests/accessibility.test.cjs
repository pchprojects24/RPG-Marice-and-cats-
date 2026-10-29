const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./game-harness.cjs');

// Minimal focus tree: visibility/layout and actual native Tab traversal are
// verified separately in the browser. These checks exercise screen ownership.
function game(start = true) {
  const g = setup();
  const layout = {
    'title-screen': ['btn-new-game', 'btn-continue'],
    'ending-overlay': ['btn-keep-playing', 'btn-restart', 'btn-ending-title'],
    'numpad-overlay': ['numpad-input', 'numpad-btn-enter', 'numpad-btn-cancel'],
    'pause-overlay': ['btn-resume', 'btn-quit-title'],
    'quest-panel': ['btn-close-quest'],
    'settings-panel': ['btn-close-settings', 'sfx-volume', 'music-volume', 'instant-dialogue', 'btn-save-settings'],
    'dialogue-overlay': ['dialogue-advance', 'dialogue-choices'],
    'bottom-buttons': ['btn-toggle-quest', 'btn-toggle-settings'],
    'game-canvas': []
  };
  for (const [id, controls] of Object.entries(layout)) {
    const panel = g.document.getElementById(id);
    panel.tabIndex = -1;
    g.document.getElementById('game-container').appendChild(panel);
    for (const control of controls) {
      const el = g.document.getElementById(control);
      el.tagName = control === 'dialogue-choices' ? 'DIV' : /input|volume|instant/.test(control) ? 'INPUT' : 'BUTTON';
      panel.appendChild(el);
    }
  }
  g.run('init()');
  g.document.getElementById('instant-dialogue').checked = false;
  if (start) g.run('startNewGame()');
  return g;
}
function el(g, id) { return g.document.getElementById(id); }
function focused(g, id) { assert.equal(g.document.activeElement, el(g, id)); }
function key(g, code, props = {}) { return g.document.dispatch('keydown', { code, target: g.document.activeElement, ...props }); }
function onlyPanel(g, id) {
  for (const panel of ['title-screen','ending-overlay','numpad-overlay','pause-overlay','quest-panel','settings-panel','dialogue-overlay']) {
    assert.equal(el(g, panel).inert, panel !== id, panel);
    assert.equal(el(g, panel).getAttribute('aria-hidden'), String(panel !== id), panel);
  }
  assert.equal(el(g, 'game-canvas').inert, id !== null);
}

test('title excludes hidden endings, menus, and gameplay; only its available button cycles', () => {
  const g = game(false);
  onlyPanel(g, 'title-screen');
  focused(g, 'btn-new-game');
  assert.equal(key(g, 'Tab').defaultPrevented, true);
  focused(g, 'btn-new-game');
  assert.equal(key(g, 'Tab', { shiftKey: true }).defaultPrevented, true);
  focused(g, 'btn-new-game');
  g.run('startNewGame()');
  onlyPanel(g, null);
  focused(g, 'game-canvas');
});

for (const [panel, first, last, open] of [
  ['quest-panel','btn-close-quest','btn-close-quest',"toggleGamePanel('quest-panel')"],
  ['settings-panel','btn-close-settings','btn-save-settings',"toggleGamePanel('settings-panel')"],
  ['numpad-overlay','numpad-input','numpad-btn-cancel','showNumpad(()=>{})'],
  ['pause-overlay','btn-resume','btn-quit-title','togglePause()'],
  ['ending-overlay','btn-keep-playing','btn-ending-title','showEnding()']
]) {
  test(`${panel}: focus enters, wraps in both directions, and excludes background`, () => {
    const g = game();
    g.run(open);
    onlyPanel(g, panel);
    focused(g, first);
    assert.equal(key(g, 'Tab', { shiftKey: true }).defaultPrevented, true);
    focused(g, last);
    assert.equal(key(g, 'Tab').defaultPrevented, true);
    focused(g, first);
    g.document.dispatch('focusin', { target: el(g, 'game-canvas') });
    focused(g, first);
  });
}

test('settings keeps native slider keys and middle Tab; Save and Escape restore its opener', () => {
  const g = game();
  g.run("toggleGamePanel('settings-panel')");
  el(g, 'sfx-volume').focus();
  assert.equal(key(g, 'ArrowRight').defaultPrevented, false);
  assert.equal(key(g, 'Tab').defaultPrevented, false);
  el(g, 'btn-save-settings').dispatch('click');
  onlyPanel(g, null);
  focused(g, 'btn-toggle-settings');
  assert.equal(el(g, 'btn-toggle-settings').getAttribute('aria-expanded'), 'false');
  g.run("toggleGamePanel('settings-panel')");
  key(g, 'Escape');
  onlyPanel(g, null);
  focused(g, 'btn-toggle-settings');
});

test('Escape cancels code entry from its buttons, with no stale focus timer', () => {
  const g = game();
  g.run('showNumpad(()=>{})');
  focused(g, 'numpad-input');
  el(g, 'numpad-btn-enter').focus();
  key(g, 'Escape');
  focused(g, 'game-canvas');
  onlyPanel(g, null);
  for (const timer of g.timers.values()) if (timer.ms === 50) timer.fn();
  focused(g, 'game-canvas');
});

test('auto-pause above settings resumes into settings before Escape closes it', () => {
  const g = game();
  g.run("toggleGamePanel('settings-panel')");
  g.document.hidden = true;
  g.document.dispatch('visibilitychange');
  onlyPanel(g, 'pause-overlay');
  focused(g, 'btn-resume');
  g.document.hidden = false;
  g.document.dispatch('visibilitychange');
  key(g, 'Escape');
  onlyPanel(g, 'settings-panel');
  focused(g, 'btn-close-settings');
  key(g, 'Escape');
  onlyPanel(g, null);
  focused(g, 'btn-toggle-settings');
});

test('dialogue has a focused advance control and a complete announcement during typing', () => {
  const g = game();
  g.run("startDialogueLines([{speaker:'Marice',text:'The jar is empty.'},{speaker:'Alice',text:'It was not me.'}])");
  onlyPanel(g, 'dialogue-overlay');
  focused(g, 'dialogue-advance');
  assert.equal(el(g, 'dialogue-announcement').textContent, 'Marice: The jar is empty.');
  assert.equal(el(g, 'dialogue-text').textContent, '');
  assert.equal(key(g, 'Tab').defaultPrevented, true);
  assert.equal(g.run('typewriterDone'), false);
  g.run('advanceDialogue(); advanceDialogue()');
  assert.equal(el(g, 'dialogue-announcement').textContent, 'Alice: It was not me.');
  g.run('advanceDialogue(); advanceDialogue()');
  onlyPanel(g, null);
  focused(g, 'game-canvas');
});

test('choices receive focus when ready, follow arrow and Tab focus, then return to game', () => {
  const g = game();
  g.run("startChoiceDialogue('Marice','Who did it?',null,[{label:'Alice'},{label:'Olive'}],i=>{window.picked=i})");
  key(g, 'Tab');
  assert.equal(g.run('typewriterDone'), false);
  g.run('finishTypewriter()');
  const choices = el(g, 'dialogue-choices').children;
  assert.equal(g.document.activeElement, choices[0]);
  key(g, 'ArrowDown');
  assert.equal(g.document.activeElement, choices[1]);
  key(g, 'Tab');
  assert.equal(g.document.activeElement, choices[0]);
  choices[0].dispatch('focus');
  assert.equal(g.run('dialogueChoices.selected'), 0);
  choices[0].dispatch('click');
  assert.equal(g.window.picked, 0);
  onlyPanel(g, null);
  focused(g, 'game-canvas');
});

test('instant choices focus first answer and chained dialogue keeps focus inside', () => {
  const g = game();
  el(g, 'instant-dialogue').checked = true;
  g.run("startChoiceDialogue('Marice','Who?',null,[{label:'Alice'},{label:'Olive'}],()=>startDialogueLines([{speaker:'Alice',text:'Hello'}]))");
  const choices = el(g, 'dialogue-choices').children;
  assert.equal(g.document.activeElement, choices[0]);
  choices[0].dispatch('click');
  onlyPanel(g, 'dialogue-overlay');
  focused(g, 'dialogue-advance');
});

test('ending actions release hidden controls for free roam, restart, and title', () => {
  for (const action of ['btn-keep-playing','btn-restart','btn-ending-title']) {
    const g = game();
    g.run('showEnding()');
    el(g, action).dispatch('click');
    if (action === 'btn-restart') el(g, 'btn-confirm-new-case').dispatch('click');
    onlyPanel(g, action === 'btn-ending-title' ? 'title-screen' : null);
    focused(g, action === 'btn-ending-title' ? 'btn-new-game' : 'game-canvas');
  }
});
