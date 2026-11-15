(() => {
  'use strict';
  const $ = id => document.getElementById(id), SETTINGS_KEY = 'nova-mars-settings-v1';
  const dialog = $('home-dialog');
  let settings = { sound: false, zoom: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) settings = { sound: saved.sound === true, zoom: Number.isFinite(saved.zoom) ? Math.max(.65, Math.min(1.6, saved.zoom)) : 1 };
  } catch { /* The menu also works with storage disabled. */ }
  try {
    const expedition = JSON.parse(localStorage.getItem('nova-mars-outpost-v1'));
    if (expedition?.version === 1 && (expedition.seconds > 0 || expedition.introStep > 0 || expedition.introComplete || Object.values(expedition.tasks || {}).some(Boolean))) {
      const completed = window.NOVACore.tasks.filter(task => expedition.tasks?.[task.id] === true).length;
      $('saved-expedition-label').textContent = expedition.introComplete===false&&expedition.introStep>0?'SAVED STORY · THE AWAKENING · START TO CONTINUE':`DAY ${expedition.survival?.day||1} · ${completed} / 5 OUTPOST SYSTEMS · START TO CONTINUE`;
      $('saved-expedition').hidden = false;
    }
  } catch { /* Missing progress means a fresh expedition. */ }
  $('replay-story-home').addEventListener('click',()=>{
    let expedition;
    try{expedition=JSON.parse(localStorage.getItem('nova-mars-outpost-v1'));}catch{ /* Default story if storage is unavailable. */ }
    const replay=window.NOVACore.replayStory(window.NOVACore.normalizeState(expedition));
    try{localStorage.setItem('nova-mars-outpost-v1',JSON.stringify(replay));}catch{ /* The game can run without storage. */ }
    location.href='game.html';
  });
  function openDialog(kicker, title, html) {
    $('home-dialog-kicker').textContent = kicker;
    $('home-dialog-title').textContent = title;
    $('home-dialog-content').innerHTML = html;
    dialog.showModal();
  }
  $('home-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  $('how-to-play').addEventListener('click', () => {
    const missions = window.NOVACore.tasks.map((task, i) => `<li><span>${i + 1}</span>${task.label}</li>`).join('');
    openDialog('FLIGHT MANUAL · EXPEDITION 004', 'How to play', `
      <p class="menu-intro">She wakes alone inside a spaceship, with no memory of her past — not even her own name. Follow her first steps into an unfamiliar world.</p>
      <div class="menu-control-list">
        <div><span>Continue the story</span><span><kbd>E</kbd><em>or Enter / tap</em></span></div>
        <div><span>Move</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><em>or arrow keys</em></span></div>
        <div><span>Walk to a place</span><span>Click or tap</span></div>
        <div><span>Interact</span><span><kbd>E</kbd><em>or Space</em></span></div>
        <div><span>Sprint</span><span><kbd>Shift</kbd></span></div>
        <div><span>Zoom</span><span>Scroll<em>or</em><kbd>−</kbd><kbd>+</kbd></span></div>
        <div><span>Return to base</span><span><kbd>B</kbd><em>or the home button</em></span></div>
        <div><span>Mission log / pause</span><span><kbd>M</kbd><em>/</em><kbd>Esc</kbd></span></div>
      </div>
      <h3 class="menu-section-label">YOUR MISSION</h3><ol class="menu-mission-list">${missions}</ol>
      <p class="menu-tip">Day 1: eat, drink, check the weather, and match the EMU components with ORBI before exploring for supplies. Day 2: stay inside, review real NASA observations, and practise solar-storm decisions. The Mars storm effects are simulated. Sleep in the ship to advance the day. Your lessons, supplies, and story save on this device. Replay story starts Day 1 again.</p>
      <button class="menu-dialog-action" id="guide-done">Ready for launch <span>→</span></button>`);
    $('guide-done').addEventListener('click', () => dialog.close());
  });
  $('menu-settings').addEventListener('click', () => {
    openDialog('MISSION PREFERENCES', 'Settings', `
      <p class="menu-intro">A few little adjustments before you head out.</p>
      <label class="menu-setting"><span><strong>Sound</strong><small>Ambient music and outpost effects</small></span><input id="setting-sound" type="checkbox" role="switch" ${settings.sound ? 'checked' : ''}></label>
      <div class="menu-setting camera-setting"><label for="setting-zoom"><strong>Camera zoom</strong><small>Find your favorite view of Mars</small></label><output id="setting-zoom-value" for="setting-zoom">${Math.round(settings.zoom * 100)}%</output><input id="setting-zoom" type="range" min="65" max="160" step="5" value="${Math.round(settings.zoom * 100)}"><span class="range-caption"><span>Wider view</span><span>Closer look</span></span></div>
      <p class="menu-tip">You can also change sound and zoom while you play.</p>
      <button class="menu-dialog-action" id="save-settings">Save settings <span>✓</span></button><button class="menu-text-action" id="reset-settings">Restore defaults</button>`);
    $('setting-zoom').addEventListener('input', event => { $('setting-zoom-value').textContent = `${event.target.value}%`; });
    $('reset-settings').addEventListener('click', () => {
      $('setting-sound').checked = false; $('setting-zoom').value = '100'; $('setting-zoom-value').textContent = '100%';
    });
    $('save-settings').addEventListener('click', () => {
      settings = { sound: $('setting-sound').checked, zoom: Number($('setting-zoom').value) / 100 };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Preferences remain usable for this visit. */ }
      dialog.close();
    });
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !dialog.open && event.target === document.body) {
      event.preventDefault(); $('start-game').click();
    }
  });
})();
