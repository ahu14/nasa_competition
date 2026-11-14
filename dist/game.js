(() => {
  'use strict';
  const C = window.NOVACore, $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d'), stage = $('stage'), dialog = $('dialog');
  const character = new window.AstronautSprites();
  const SAVE_KEY = 'nova-mars-outpost-v1';
  const SETTINGS_KEY = 'nova-mars-settings-v1';
  let preferences = { sound: false, zoom: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) preferences = { sound: saved.sound === true, zoom: Number.isFinite(saved.zoom) ? C.clamp(saved.zoom,.65,1.6) : 1 };
  } catch { /* Defaults also work without browser storage. */ }
  function savePreferences(change) {
    preferences = { ...preferences, ...change };
    try { localStorage.setItem(SETTINGS_KEY,JSON.stringify(preferences)); } catch { /* Preferences still apply for this visit. */ }
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state;
  try { state = C.normalizeState(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { state = C.freshState(); }
  let paused = false, hidden = false, moving = false, ready = false, busy = false;
  let path = [], target = null, targetStation = null, facing = 'down', walkTime = 0, time = 0;
  let last = performance.now(), hudTimer = 0, saveTimer = 0, activeStation = null, hoverStation = null;
  let view = { w: 1600, h: 900, scale: 1, x: 0, y: 0, dpr: 1 };
  let world, zoom = preferences.zoom;
  $('zoom-value').textContent = `${Math.round(zoom*100)}%`;
  const minimap = $('minimap'), mini = minimap.getContext('2d');
  let toastTimer, dismissTimer, sound = false, audioContext, ambientGain, audioStarted = false;
  const keys = new Set(), motes = [], footsteps = [], sparks = [];
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const number = n => String(Math.floor(n)).padStart(2, '0');
  const missionCount = () => C.tasks.filter(t => state.tasks[t.id]).length;
  const currentTask = () => C.tasks.find(t => !state.tasks[t.id]);
  const isBlocked = () => paused || dialog.open || hidden || !ready;

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Private browsing can disable storage. */ }
  }
  function dismissWelcome() {
    $('welcome').classList.add('dismissed');
    clearTimeout(dismissTimer);
  }
  if (state.seconds > 3 || missionCount() > 0) $('welcome').hidden = true;
  $('begin-button').addEventListener('click', () => { dismissWelcome(); canvas.focus({ preventScroll: true }); });
  function toast(message) {
    $('toast-text').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4600);
  }
  function updateHud() {
    $('oxygen-value').innerHTML = `${Math.ceil(state.oxygen)}<span>%</span>`;
    $('energy-value').innerHTML = `${Math.ceil(state.energy)}<span>%</span>`;
    $('samples-value').textContent = number(state.samples);
    $('oxygen-bar').style.width = `${state.oxygen}%`; $('energy-bar').style.width = `${state.energy}%`;
    $('oxygen-bar').style.background = state.oxygen < 20 ? '#f4a27b' : '#b4d2cc';
    const count = missionCount(), task = currentTask();
    $('nav-count').textContent = `${count}/5`;
    $('step-number').textContent = task ? number(C.tasks.indexOf(task) + 1) : '✓';
    $('step-label').textContent = task ? task.label : 'Expedition complete';
    $('mission-title').textContent = count === 5 ? 'You made it home.' : 'A place to call home.';
    $('mission-description').textContent = count === 5 ? 'One small outpost. One giant beginning.' : 'A little life on a red planet.';
    [...$('progress-segments').children].forEach((el, i) => { el.className = state.tasks[C.tasks[i].id] ? 'done' : C.tasks[i] === task ? 'current' : ''; });
  }

  function resize() {
    const box = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
    view.w = box.width; view.h = box.height; view.dpr = dpr;
    view.scale = C.cameraFor(state.player, box.width, box.height, zoom).scale;
    updateCamera();
  }
  function updateCamera(dt = 0) {
    const desired = C.cameraFor(state.player, view.w, view.h, zoom);
    const blend = dt && !reducedMotion ? 1 - Math.exp(-dt * 10) : 1;
    view.x += (desired.x - view.x) * blend;
    view.y += (desired.y - view.y) * blend;
  }
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  const map = new Image();
  const landscapeReady = new Promise((resolve, reject) => {
    map.onload = resolve;
    map.onerror = () => reject(new Error('Check that assets/mars-outpost.png is beside the game files, then reload.'));
  });
  map.src = 'assets/mars-outpost.png';
  Promise.all([landscapeReady, character.load()]).then(() => {
    world = new window.MarsWorld(map);
    ready = true; resize(); render(); updateInteraction(); $('loading').hidden = true;
    dismissTimer = setTimeout(dismissWelcome, 18000);
  }).catch(error => {
    $('loading').querySelector('b').textContent = 'ASSET UNAVAILABLE';
    $('loading').querySelector(':scope > span').textContent = error.message;
  });

  for (let i = 0; i < 35; i++) motes.push({ x: Math.random() * C.W, y: 270 + Math.random() * 600, speed: 3 + Math.random() * 12, size: Math.random() > .8 ? 3 : 2, alpha: .1 + Math.random() * .22 });
  function drawLabel(s, active) {
    const current = currentTask()?.id === s.id, completed = !!state.tasks[s.id];
    ctx.font = '10px Consolas, monospace';
    const textWidth = ctx.measureText(s.name).width, x = s.labelX, y = s.labelY;
    ctx.fillStyle = active ? '#233128f0' : '#302b2cbb';
    ctx.fillRect(Math.round(x - textWidth / 2 - 13), y - 10, textWidth + 26, 20);
    ctx.fillStyle = current ? '#ffce8d' : completed ? '#c8e0b4' : '#f5e6d0';
    ctx.fillText(s.name, Math.round(x - textWidth / 2), y + 3);
    if (current && !reducedMotion) {
      const dy = Math.round(Math.sin(time * 2.8) * 3), px = s.ax, py = s.ay - 30 + dy;
      ctx.fillStyle = '#322b2bbf'; ctx.fillRect(px - 7, py - 7, 14, 14);
      ctx.fillStyle = '#f8c185'; ctx.fillRect(px - 2, py - 5, 4, 10); ctx.fillRect(px - 5, py - 2, 10, 4);
      ctx.fillStyle = '#322b2b'; ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    if (completed) { ctx.fillStyle = '#bfd3a9'; ctx.fillRect(x + textWidth / 2 + 5, y - 2, 3, 3); }
  }
  function render() {
    if (!ready) return;
    const scale = view.scale * view.dpr;
    ctx.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale);
    ctx.imageSmoothingEnabled = false;
    world.draw(ctx, { x: view.x, y: view.y, w: view.w / view.scale, h: view.h / view.scale });
    // Wind, footprints, and destination markers are real-time layers over the map.
    for (const foot of footsteps) {
      ctx.fillStyle = `rgba(106,49,35,${foot.life * .15})`; ctx.fillRect(foot.x - 2, foot.y, 4, 6);
    }
    if (target && path.length) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 5) * .12;
      ctx.strokeStyle = '#ffe6bda0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(target.x, target.y, 12 * pulse, 6 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffe6bda0'; ctx.fillRect(target.x - 1, target.y - 1, 3, 3);
    }
    for (const s of C.stations) drawLabel(s, activeStation?.id === s.id || hoverStation?.id === s.id);
    // Each walking view has four original frames; idle keeps the last facing.
    const p = state.player, frame = moving ? Math.floor(walkTime * 8) % 4 : -1;
    ctx.fillStyle = '#733d3c65'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 3, 33, 10, 0, 0, Math.PI * 2); ctx.fill();
    character.draw(ctx, facing, frame, p.x, p.y);
    if (!reducedMotion) {
      for (const m of motes) { ctx.fillStyle = `rgba(255,222,165,${m.alpha})`; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size); }
    }
    for (const s of sparks) { ctx.fillStyle = `rgba(255,223,142,${Math.max(0, s.life)})`; ctx.fillRect(s.x, s.y, 4, 4); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setDestination(point, station = null) {
    if (isBlocked()) return;
    dismissWelcome();
    if (station && Math.hypot(state.player.x - station.ax, state.player.y - station.ay) > 6000) {
      toast('You’re far from home. Press B or tap the home button to return to base.'); return;
    }
    targetStation = station;
    const dest = station ? { x: station.ax, y: station.ay } : C.nearestOpen(point.x, point.y);
    path = C.findPath(state.player, dest); target = dest;
    if (!path.length) { toast('That spot is out of reach. Try the open ground.'); targetStation = null; }
    canvas.focus({ preventScroll: true });
  }
  function mouseWorld(event) {
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) / view.scale + view.x, y: (event.clientY - box.top) / view.scale + view.y };
  }
  function stationAt(p) {
    let found = null, distance = Infinity;
    for (const s of C.stations) {
      const labelDistance = Math.hypot(p.x - s.labelX, (p.y - s.labelY) * 3);
      const dist = Math.hypot(p.x - s.x, p.y - (s.y - 35));
      if ((dist < 85 || labelDistance < 75) && dist < distance) { found = s; distance = dist; }
    }
    return found;
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = mouseWorld(event); setDestination(p, stationAt(p));
  });
  canvas.addEventListener('pointermove', event => { hoverStation = stationAt(mouseWorld(event)); canvas.style.cursor = hoverStation ? 'pointer' : 'crosshair'; });
  canvas.addEventListener('pointerleave', () => { hoverStation = null; });

  function nearestStation() {
    let nearest = null, distance = Infinity;
    for (const s of C.stations) {
      const d = Math.hypot(state.player.x - s.x, state.player.y - s.y);
      if (d < s.radius && d < distance) { distance = d; nearest = s; }
    }
    return nearest;
  }
  function updateInteraction() {
    activeStation = nearestStation();
    $('interact-prompt').hidden = !activeStation || isBlocked();
    if (activeStation) {
      $('interact-label').textContent = activeStation.name.toLowerCase().replace(/\b\w/g, x => x.toUpperCase());
      $('location-name').textContent = activeStation.name;
    } else $('location-name').textContent = C.regionAt(state.player.x, state.player.y);
    const x = Math.round((state.player.x - C.HOME.x) / 10), y = Math.round((state.player.y - C.HOME.y) / 10);
    $('world-coordinates').textContent = ` X ${x < 0 ? '−' : '+'}${Math.abs(x)} · Y ${y < 0 ? '−' : '+'}${Math.abs(y)}`;
    $('base-distance').textContent = `BASE · ${Math.round(Math.hypot(state.player.x - C.HOME.x, state.player.y - C.HOME.y) / 10)} m`;
    const next = C.stations.find(s => s.id === currentTask()?.id);
    const offscreen = next && (next.ax < view.x+60 || next.ax > view.x+view.w/view.scale-60 || next.ay < view.y+100 || next.ay > view.y+view.h/view.scale-60);
    $('destination-beacon').hidden = !offscreen || isBlocked();
    if (next) {
      $('destination-name').textContent = next.name;
      $('destination-distance').textContent = `${Math.round(Math.hypot(next.ax-state.player.x,next.ay-state.player.y)/10)} m`;
      $('destination-arrow').style.transform = `rotate(${Math.atan2(next.ay-state.player.y,next.ax-state.player.x)}rad)`;
    }
    drawMinimap();
  }
  function drawMinimap() {
    const w = minimap.width, h = minimap.height, p = state.player;
    const spanX = Math.max(900,...C.stations.map(s=>Math.abs(s.x-p.x))), spanY = Math.max(600,...C.stations.map(s=>Math.abs(s.y-p.y)));
    const scale = Math.min(.04,(w-22)/(spanX*2.2),(h-22)/(spanY*2.2));
    mini.fillStyle = '#24332c'; mini.fillRect(0, 0, w, h);
    mini.strokeStyle = '#5f70522b'; mini.lineWidth = 1;
    const grid = C.CHUNK * 4 * scale;
    const ox = ((-p.x * scale + w / 2) % grid + grid) % grid, oy = ((-p.y * scale + h / 2) % grid + grid) % grid;
    for (let x = ox; x < w; x += grid) { mini.beginPath(); mini.moveTo(x, 0); mini.lineTo(x, h); mini.stroke(); }
    for (let y = oy; y < h; y += grid) { mini.beginPath(); mini.moveTo(0, y); mini.lineTo(w, y); mini.stroke(); }
    mini.strokeStyle = '#a8916655';
    for (const road of C.roads) {
      mini.beginPath(); road.forEach((point,i) => {
        const x=(point.x-p.x)*scale+w/2,y=(point.y-p.y)*scale+h/2;
        if(i)mini.lineTo(x,y);else mini.moveTo(x,y);
      }); mini.stroke();
    }
    const cx = Math.floor(p.x / C.CHUNK), cy = Math.floor(p.y / C.CHUNK);
    mini.fillStyle = '#77836580';
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (const o of C.getChunk(cx + dx, cy + dy).objects) {
      mini.beginPath(); mini.ellipse((o.x - p.x) * scale + w / 2, (o.y - p.y) * scale + h / 2, o.rx * scale, o.ry * scale, 0, 0, Math.PI * 2); mini.fill();
    }
    const dot = (x, y, color, size) => {
      const mx = C.clamp((x - p.x) * scale + w / 2, 5, w - 5), my = C.clamp((y - p.y) * scale + h / 2, 5, h - 5);
      mini.fillStyle = color; mini.fillRect(Math.round(mx - size / 2), Math.round(my - size / 2), size, size);
    };
    for (const s of C.stations) dot(s.x, s.y, s.id === currentTask()?.id ? '#f7bf7c' : '#b1c8a6', s.id === currentTask()?.id ? 4 : 3);
    dot(C.HOME.x, C.HOME.y, '#b8d9be', 5);
    const angle = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[facing];
    mini.save(); mini.translate(w / 2, h / 2); mini.rotate(angle); mini.fillStyle = '#ffd49a'; mini.beginPath(); mini.moveTo(0, -5); mini.lineTo(4, 4); mini.lineTo(0, 2); mini.lineTo(-4, 4); mini.closePath(); mini.fill(); mini.restore();
  }
  function setZoom(value) {
    if (isBlocked()) return;
    zoom = C.clamp(value, .65, 1.6); $('zoom-value').textContent = `${Math.round(zoom * 100)}%`;
    savePreferences({zoom});
    resize(); render();
  }
  function returnToBase() {
    if (isBlocked()) return;
    keys.clear(); path = []; target = null; targetStation = null;
    state.player = { ...C.HOME }; facing = 'down';
    dismissWelcome(); updateCamera(); updateInteraction(); save(); render();
    toast('Welcome home. Your expedition progress is saved.');
  }
  $('zoom-in').addEventListener('click', () => setZoom(zoom + .15));
  $('zoom-out').addEventListener('click', () => setZoom(zoom - .15));
  $('recall-button').addEventListener('click', returnToBase);
  $('destination-beacon').addEventListener('click', () => {
    const station = C.stations.find(s => s.id === currentTask()?.id);
    if (station) setDestination({x:station.ax,y:station.ay},station);
  });
  canvas.addEventListener('wheel', event => { event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? .08 : -.08)); }, { passive: false });
  function move(dx, dy) {
    const p = state.player;
    // Small substeps prevent tunneling through obstacles during a slow frame.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    for (let i = 0; i < steps; i++) {
      if (C.walkable(p.x + dx / steps, p.y)) p.x += dx / steps;
      if (C.walkable(p.x, p.y + dy / steps)) p.y += dy / steps;
    }
    if (Math.abs(dx) > Math.abs(dy)) facing = dx > 0 ? 'right' : 'left';
    else if (Math.abs(dy) > .01) facing = dy > 0 ? 'down' : 'up';
  }
  function tick(dt) {
    time += dt;
    if (isBlocked()) { moving = false; return; }
    state.seconds += dt;
    const previousX = state.player.x, previousY = state.player.y;
    let dx = 0, dy = 0;
    if (keys.has('w') || keys.has('arrowup')) dy--;
    if (keys.has('s') || keys.has('arrowdown')) dy++;
    if (keys.has('a') || keys.has('arrowleft')) dx--;
    if (keys.has('d') || keys.has('arrowright')) dx++;
    if (dx || dy) { path = []; target = null; targetStation = null; dismissWelcome(); }
    const speed = keys.has('shift') ? 285 : 172;
    if (!dx && !dy && path.length) {
      const node = path[0], dist = Math.hypot(node.x - state.player.x, node.y - state.player.y);
      if (dist < speed * dt + 1) { move(node.x - state.player.x, node.y - state.player.y); path.shift(); }
      else { dx = (node.x - state.player.x) / dist; dy = (node.y - state.player.y) / dist; }
      if (!path.length) {
        const station = targetStation; targetStation = null; target = null;
        if (station && Math.hypot(state.player.x - station.x, state.player.y - station.y) < station.radius + 10) interact(station);
      }
    }
    if (dx || dy) { const length = Math.hypot(dx, dy); move(dx / length * speed * dt, dy / length * speed * dt); }
    moving = Math.hypot(state.player.x-previousX,state.player.y-previousY) > .01;
    if (moving) {
      walkTime += dt * speed / 172;
      if (Math.floor(walkTime * 5) !== Math.floor((walkTime - dt) * 5)) footsteps.push({ x: state.player.x + (Math.floor(walkTime * 5) % 2 ? 7 : -7), y: state.player.y - 3, life: 1 });
      state.energy = Math.max(0, state.energy - dt * .024);
    }
    state.oxygen = Math.max(0, state.oxygen - dt * (moving ? .035 : .014));
    if (state.oxygen === 0) {
      const habitat = C.stations.find(s=>s.id==='habitat');
      state.player = { x: habitat.ax, y: habitat.ay }; state.oxygen = 65; path = []; target = null; targetStation = null;
      updateCamera();
      toast('Suit reserve activated. You’re safe at the habitat.'); save();
    }
    for (let i = footsteps.length - 1; i >= 0; i--) { footsteps[i].life -= dt / 12; if (footsteps[i].life <= 0) footsteps.splice(i, 1); }
    for (const m of motes) {
      m.x += m.speed * dt; m.y += Math.sin(time + m.x) * dt;
      if (m.x < view.x - 50 || m.x > view.x + view.w / view.scale + 50) m.x = view.x + Math.random() * view.w / view.scale;
      if (m.y < view.y - 50 || m.y > view.y + view.h / view.scale + 50) m.y = view.y + Math.random() * view.h / view.scale;
    }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * .7; if (s.life <= 0) sparks.splice(i, 1); }
    updateCamera(dt);
    hudTimer += dt; saveTimer += dt;
    if (hudTimer > .15) { updateHud(); updateInteraction(); hudTimer = 0; }
    if (saveTimer > 3) { save(); saveTimer = 0; }
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    tick(dt); render(); requestAnimationFrame(frame);
  }

  function showDialog(eyebrow, html) {
    keys.clear(); path = []; target = null; targetStation = null; moving = false;
    $('dialog-eyebrow').textContent = eyebrow; $('dialog-content').innerHTML = html;
    if (!dialog.open) dialog.showModal();
    updateInteraction();
  }
  function closeDialog() {
    if (busy) return;
    dialog.close(); paused = false; keys.clear(); updateInteraction();
    canvas.focus({ preventScroll: true }); save();
  }
  $('close-dialog').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  });
  const actionButton = (label, id = 'dialog-action') => `<button class="dialog-action" id="${id}"><span>${label}</span>${icon('arrow')}</button>`;
  function perform(id, message) {
    if (busy) return;
    busy = true;
    const button = $('dialog-action'); button.disabled = true; button.querySelector('span').textContent = 'Working on it…';
    chirp(330, .1);
    setTimeout(() => {
      C.complete(state, id); busy = false;
      const s = C.stations.find(v => v.id === id);
      if (!reducedMotion) for (let i = 0; i < 22; i++) sparks.push({ x: s.ax, y: s.ay - 40, vx: (Math.random() - .5) * 140, vy: -30 - Math.random() * 110, life: 1.2 });
      chirp(660, .15); setTimeout(() => chirp(880, .2), 100);
      closeDialog(); updateHud(); save(); toast(message);
      if (id === 'rocket') setTimeout(showSuccess, 350);
    }, reducedMotion ? 150 : 1100);
  }
  const stationCopy = {
    solar: { icon: 'sun', eyebrow: 'POWER SYSTEMS · SOLAR ARRAY', title: 'A little more sunshine.', body: 'A fine layer of red dust is keeping these panels from doing their thing. A quick clean will bring power back to your new home.', stat: '+28% outpost energy · System restored', action: 'Clean the solar panels', message: 'Solar array online. A brighter day on Mars.' },
    greenhouse: { icon: 'leaf', eyebrow: 'LIFE SUPPORT · GREENHOUSE', title: 'Something green. On Mars.', body: 'There’s a whole little world under this dome. Start the air and water systems, and give these plants a chance to grow.', stat: 'Oxygen replenished · Life support online', action: 'Start greenhouse life support', message: 'Greenhouse thriving. Your suit oxygen is full.' },
    crystals: { icon: 'crystal', eyebrow: 'FIELD RESEARCH · ICE DEPOSIT', title: 'Beneath the red dust.', body: 'These blue crystals hold traces of water ice. Gather a few samples for the uplink — a small discovery with a big story to tell.', stat: '+3 water-ice samples · Research collected', action: 'Collect the ice samples', message: 'Three ice samples collected. Earth will want to see this.' },
    habitat: { icon: 'home', eyebrow: 'COMMUNICATIONS · NOVA HABITAT', title: 'A little hello to Earth.', body: 'Your new home is coming to life. Send the outpost report and your ice research through the satellite uplink. Someone, somewhere, is waiting to hear from you.', stat: 'Research uplink · Suit fully replenished', action: 'Transmit the outpost report', message: 'Transmission received on Earth. They’re proud of you.' },
    rocket: { icon: 'rocket', eyebrow: 'EXPEDITION CONTROL · LANDING PAD', title: 'One giant beginning.', body: 'Power restored. Plants growing. A new discovery sent home. Head back to the landing pad to sign off on your first day at the outpost.', stat: 'Expedition 004 · Ready to complete', action: 'Complete the expedition', message: 'Expedition complete. You’ve made a little home on Mars.' }
  };
  function interact(station = activeStation) {
    if (!station || isBlocked()) return;
    dismissWelcome(); chirp(440, .05);
    const id = station.id;
    if (id === 'rover') {
      showDialog('EXPLORATION · ROVER', `<div class="dialog-icon">${icon('bolt')}</div><h1 id="dialog-title">A trusty little companion.</h1><p class="dialog-body">The rover has been out exploring while you settled in. ${state.rover ? 'Its survey is safely downloaded. The little explorer is enjoying a well-earned recharge.' : 'Its latest survey holds two mineral samples and a bit of spare battery power for your suit.'}</p><div class="dialog-stat">${icon('crystal')}${state.rover ? 'Survey downloaded · All clear' : '+2 mineral samples · +15% suit energy'}</div>${actionButton(state.rover ? 'Back to exploring' : 'Download the rover survey')}`);
      $('dialog-action').onclick = state.rover ? closeDialog : () => perform(id, 'Rover survey downloaded. Two bonus samples collected.'); return;
    }
    if (id === 'flag') {
      showDialog('PERSONAL LOG · SOL 011', `<div class="dialog-icon">${icon('pin')}</div><h1 id="dialog-title">A very long way from home.</h1><p class="dialog-body">“The sky here is different. The silence, too. But today I saw the first green leaves in the dome, and for a moment, the distance didn’t seem so big.”</p><div class="dialog-stat">${icon('book')}${state.flag ? 'Personal log recorded · Sol 011' : 'A moment worth remembering'}</div>${actionButton(state.flag ? 'Back to exploring' : 'Record a personal log')}`);
      $('dialog-action').onclick = state.flag ? closeDialog : () => perform(id, 'Personal log recorded. A moment of Mars, kept forever.'); return;
    }
    const copy = stationCopy[id], complete = state.tasks[id], allowed = C.canComplete(state, id);
    let body = copy.body, stat = copy.stat, action = copy.action;
    if (complete) {
      body = { solar: 'The panels are clean and quietly turning sunlight into electricity. Your little outpost has all the power it needs.', greenhouse: 'The leaves are green, the air is fresh, and life is finding a way. You can top up your suit here whenever you need.', crystals: 'You’ve gathered the samples from this deposit. Its quiet blue glow is a reminder that there’s still so much to discover.', habitat: 'The uplink is clear. Earth has your research, and your habitat is humming along. Come in for a suit refill whenever you need.', rocket: 'Your first expedition is complete. The outpost is thriving. Take your time exploring — this is your home now.' }[id];
      stat = 'System checked · All good here';
      action = id === 'greenhouse' || id === 'habitat' ? 'Replenish suit oxygen' : 'Back to exploring';
    } else if (!allowed) {
      const needed = id === 'greenhouse' ? ['solar'] : id === 'habitat' ? ['solar', 'greenhouse', 'crystals'] : ['habitat'];
      body = id === 'greenhouse' ? 'The plants are ready, but the dome needs electricity first. Clear the dust off the remote solar array, then come back. The station scanner will help you find it.' : id === 'habitat' ? 'There’s a report to send, but a few things need your attention first. Get the outpost systems running and collect the blue ice samples.' : 'There’s still a little more to do before you sign off. Send the completed outpost report from the NOVA habitat first.';
      stat = `First: ${needed.filter(k => !state.tasks[k]).map(k => C.tasks.find(t => t.id === k).label.toLowerCase()).join(' · ')}`;
      action = 'Keep exploring';
    }
    showDialog(copy.eyebrow, `<div class="dialog-icon">${icon(copy.icon)}</div><h1 id="dialog-title">${copy.title}</h1><p class="dialog-body">${body}</p><div class="dialog-stat">${icon(complete ? 'check' : copy.icon)}<span>${stat}</span></div>${actionButton(action)}`);
    $('dialog-action').onclick = !allowed || complete && !['greenhouse', 'habitat'].includes(id) ? closeDialog : () => perform(id, complete ? 'Suit oxygen replenished. Take a breath.' : copy.message);
  }
  $('interact-prompt').addEventListener('click', () => interact());

  function showMissions() {
    if (busy) return;
    dismissWelcome();
    const current = currentTask();
    const rows = C.tasks.map((t, i) => `<li class="${state.tasks[t.id] ? 'completed' : t === current ? 'current' : ''}"><span class="number">${state.tasks[t.id] ? '✓' : number(i + 1)}</span><span><strong>${t.label}</strong><small>${t.detail}</small></span>${state.tasks[t.id] ? icon('check') : ''}</li>`).join('');
    showDialog('MISSION LOG · EXPEDITION 004', `<h1 id="dialog-title">A place to call home.</h1><p class="dialog-body">Every little step makes this red planet feel a bit more like home.</p><ul class="journal-list">${rows}</ul><p class="journal-meta">${missionCount()} OF 5 COMPLETE${state.flag ? ' · PERSONAL LOG RECORDED' : ''}</p>${actionButton(current ? 'Show my next destination' : 'Back to the outpost')}`);
    $('dialog-action').onclick = () => { closeDialog(); if (current) { const s = C.stations.find(s => s.id === current.id); setDestination({ x: s.ax, y: s.ay }, s); } };
  }
  function showGuide() {
    if (busy) return;
    showDialog('FIELD GUIDE · GETTING YOUR BEARINGS', `<div class="dialog-icon">${icon('book')}</div><h1 id="dialog-title">A small guide to a big planet.</h1>
      <p class="dialog-body">The desert continues in every direction. Walk beyond the outpost, explore the dunes and ice fields, and see what’s over the next ridge.</p>
      <div class="guide-row"><span>Move your astronaut</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows</span></div>
      <div class="guide-row"><span>Walk to a destination</span><span>CLICK / TAP</span></div>
      <div class="guide-row"><span>Interact with a nearby place</span><span><kbd>E</kbd> / tap prompt</span></div>
      <div class="guide-row"><span>Move a little faster</span><span><kbd>⇧</kbd> SHIFT</span></div>
      <div class="guide-row"><span>Zoom the camera</span><span>SCROLL / <kbd>−</kbd><kbd>+</kbd></span></div>
      <div class="guide-row"><span>Return to home base</span><span><kbd>B</kbd> / home button</span></div>
      <div class="guide-row"><span>Mission log / pause</span><span><kbd>M</kbd> / <kbd>Esc</kbd></span></div>
      <p class="guide-note">The stations are spread across the desert. Follow the roads, or tap the gold direction marker to walk to your next station. The scanner shows all stations and marks home in green. Your position and mission progress save on this device.</p>${actionButton('I’m ready to explore')}`);
    $('dialog-action').onclick = closeDialog;
  }
  function showPause() {
    if (busy) return;
    if (dialog.open) { closeDialog(); return; }
    paused = true;
    showDialog('EXPEDITION PAUSED', `<div class="dialog-icon">${icon('pause')}</div><h1 id="dialog-title">Take a breath.</h1><p class="dialog-body">The red planet will still be here. Your progress is saved, and your suit systems are on standby.</p><div class="dialog-stat">${icon('check')}${missionCount()} / 5 tasks completed · ${number(state.samples)} samples collected</div>${actionButton('Back to the outpost')}<a class="dialog-secondary" href="index.html">Return to main menu</a><button class="dialog-secondary" id="reset-button">Start a fresh expedition</button>`);
    $('dialog-action').onclick = closeDialog;
    $('reset-button').onclick = confirmReset;
  }
  function confirmReset() {
    showDialog('A NEW CHAPTER', `<h1 id="dialog-title">Start again?</h1><p class="dialog-body">This replaces your saved expedition with a fresh start. Your current mission progress and samples will be cleared.</p>${actionButton('Start a fresh expedition')}<button class="dialog-secondary" id="cancel-reset">Keep my expedition</button>`);
    $('dialog-action').onclick = () => {
      state = C.freshState(); footsteps.length = 0; sparks.length = 0; facing = 'down';
      closeDialog(); updateHud(); updateCamera(); save(); toast('A fresh start. Welcome back to Mars.');
    };
    $('cancel-reset').onclick = () => { closeDialog(); };
  }
  function showSuccess() {
    showDialog('EXPEDITION 004 · COMPLETE', `<div class="success-stars" aria-hidden="true">✦ ✧ ✦</div><h1 id="dialog-title">One small outpost.<br>One giant beginning.</h1><p class="dialog-body">You brought power, a little green, and a new discovery to a quiet corner of Mars. That’s a pretty good first day.</p><div class="dialog-stat">${icon('check')}5 / 5 missions · ${number(state.samples)} samples · ${Math.max(1, Math.round(state.seconds / 60))} min exploring</div>${actionButton('Stay a little longer')}<button class="dialog-secondary" id="new-expedition">Begin a new expedition</button>`);
    $('dialog-action').onclick = closeDialog; $('new-expedition').onclick = confirmReset;
  }
  $('mission-card').addEventListener('click', showMissions);
  $('guide-button').addEventListener('click', showGuide);
  $('pause-button').addEventListener('click', showPause);
  $('fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('Use your browser’s fullscreen option for a wider view.');
    } catch { toast('Fullscreen isn’t available in this browser.'); }
  });
  document.addEventListener('fullscreenchange', resize);
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') { if (!dialog.open) { event.preventDefault(); showPause(); } return; }
    if (dialog.open) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key)) event.preventDefault();
    if (key === 'e' || key === ' ') { if (!event.repeat) interact(); return; }
    if (key === 'm' && !event.repeat) { showMissions(); return; }
    if (key === 'h' && !event.repeat) { showGuide(); return; }
    if (key === 'b' && !event.repeat) { returnToBase(); return; }
    if (['+', '=', '-', '_'].includes(key)) { event.preventDefault(); setZoom(zoom + (key === '+' || key === '=' ? .15 : -.15)); return; }
    keys.add(key);
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; keys.clear(); save(); if (ambientGain && audioContext) ambientGain.gain.setTargetAtTime(sound && !hidden ? .025 : 0, audioContext.currentTime, .3); });
  window.addEventListener('pagehide', save);
  for (const button of document.querySelectorAll('[data-dir]')) {
    const key = { up: 'w', left: 'a', down: 's', right: 'd' }[button.dataset.dir];
    button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); if (!isBlocked()) keys.add(key); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => keys.delete(key));
  }

  function chirp(frequency, duration) {
    if (!sound || !audioContext) return;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(.04, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + duration);
  }
  async function setSound(enabled) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { toast('Audio isn’t available in this browser.'); return; }
    if (!audioContext) audioContext = new Audio();
    try { await audioContext.resume(); } catch { toast('Your browser couldn’t start audio.'); return; }
    sound = enabled;
    savePreferences({sound});
    if (!audioStarted) {
      ambientGain = audioContext.createGain(); ambientGain.gain.value = 0; ambientGain.connect(audioContext.destination);
      for (const frequency of [130.81, 196, 261.63]) { const o = audioContext.createOscillator(); const g = audioContext.createGain(); o.type = 'sine'; o.frequency.value = frequency; g.gain.value = .15; o.connect(g); g.connect(ambientGain); o.start(); }
      audioStarted = true;
    }
    ambientGain.gain.setTargetAtTime(sound ? .025 : 0, audioContext.currentTime, .5);
    $('sound-button').innerHTML = icon(sound ? 'sound' : 'muted');
    $('sound-button').setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
    $('sound-button').title = sound ? 'Turn sound off' : 'Turn sound on';
    if (sound) chirp(523.25, .18);
  }
  $('sound-button').addEventListener('click', () => setSound(!sound));
  function startPreferredSound(event) {
    window.removeEventListener('pointerdown',startPreferredSound);
    window.removeEventListener('keydown',startPreferredSound);
    if (event.target.closest?.('#sound-button')) return;
    if (preferences.sound && !sound) void setSound(true);
  }
  if (preferences.sound) {
    window.addEventListener('pointerdown',startPreferredSound);
    window.addEventListener('keydown',startPreferredSound);
  }
  updateHud(); resize(); requestAnimationFrame(frame);
})();
