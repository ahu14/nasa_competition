(() => {
  'use strict';
  const C = window.NOVACore, $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d'), stage = $('stage'), dialog = $('dialog'), orbiDialog=$('orbi-dialog');
  const character = new window.AstronautSprites();
  const indoorCharacter = new window.AstronautSprites('assets/indoor/frames');
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
  document.body.classList.toggle('story-opening',!state.introComplete);
  let paused = false, hidden = false, moving = false, ready = false, busy = false;
  let path = [], target = null, targetStation = null, facing = 'down', walkTime = 0, time = 0;
  let last = performance.now(), hudTimer = 0, saveTimer = 0, activeStation = null, hoverStation = null;
  let view = { w: 1600, h: 900, scale: 1, x: 0, y: 0, dpr: 1 };
  let world, intro, trainer, zoom = preferences.zoom;
  $('zoom-value').textContent = `${Math.round(zoom*100)}%`;
  const minimap = $('minimap'), mini = minimap.getContext('2d');
  let toastTimer, dismissTimer, sound = false, audioContext, ambientGain, audioStarted = false;
  const keys = new Set(), motes = [], footsteps = [], sparks = [];
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const number = n => String(Math.floor(n)).padStart(2, '0');
  const missionCount = () => C.tasks.filter(t => state.tasks[t.id]).length;
  const currentTask = () => C.activeObjective(state);
  const insideShip = () => state.introComplete && state.location === 'ship';
  const activePlayer = () => insideShip() ? state.shipPlayer : state.player;
  const activeStations = () => insideShip() ? C.shipStations : C.stations;
  const cameraForScene = () => insideShip() ? C.shipCameraFor(state.shipPlayer,view.w,view.h,zoom) : C.cameraFor(state.player,view.w,view.h,zoom);
  const isBlocked = () => paused || dialog.open || orbiDialog.open || trainer?.isOpen() || hidden || !ready || !state.introComplete;

  function syncIntro() {
    document.body.classList.toggle('story-opening',!state.introComplete);
    document.body.classList.toggle('ship-interior',insideShip());
    $('ship-panel').hidden=!insideShip();
    $('scanner-title').textContent=insideShip()?'SHIP SCANNER':'STATION SCANNER';
    $('story-scene').hidden = state.introComplete;
    if (state.introComplete) return;
    clearTimeout(dismissTimer); keys.clear(); path=[]; target=null; targetStation=null;
    $('welcome').hidden=true;
    const line=window.WakeupScene.lines[state.introStep];
    $('story-thought').textContent=line.thought;
    $('story-detail').textContent=line.detail;
    const lastLine=state.introStep===window.WakeupScene.lines.length-1;
    $('story-next-label').textContent=lastLine?'Look around':'Continue';
    $('story-next').setAttribute('aria-label',lastLine?'Explore the spaceship':'Continue story');
  }
  function advanceIntro() {
    if(!ready||paused||dialog.open||hidden||state.introComplete)return;
    if(state.introStep<window.WakeupScene.lines.length-1){state.introStep++;syncIntro();}
    else {
      C.finishIntro(state);syncIntro();facing='down';moving=false;
      $('welcome').hidden=true;
      resize();updateHud();updateInteraction();render();
      canvas.focus({preventScroll:true});
      toast('The cabin is quiet. Take a moment to look around.');
    }
    save();
  }
  $('story-next').addEventListener('click',advanceIntro);

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
    document.body.classList.toggle('day-one',state.survival.day===1);
    document.body.classList.toggle('day-two',state.survival.day===2);
    $('prep-emu-item').hidden=state.survival.day!==1;
    $('prep-heading').textContent=state.survival.day===2?'STORM DAY · STAY INSIDE':'BEFORE YOU HEAD OUT';
    $('prep-description').textContent=state.survival.day===2?'Breakfast, weather, then ORBI’s shelter drill.':'Breakfast, weather, and your first EVA lesson.';
    $('survival-hud').hidden=!state.introComplete;
    $('day-value').textContent=`DAY ${state.survival.day}`;
    for(const stock of ['food','water']){
      const value=state.survival[stock];$(`${stock}-stock-value`).textContent=`${Math.round(value)}%`;
      $(`${stock}-stock-bar`).style.width=`${value}%`;$(`${stock}-stock-bar`).classList.toggle('low',value<=25);
    }
    $('oxygen-value').innerHTML = `${Math.ceil(state.oxygen)}<span>%</span>`;
    $('energy-value').innerHTML = `${Math.ceil(state.energy)}<span>%</span>`;
    $('samples-value').textContent = number(state.samples);
    $('ship-link-status').textContent=`EARTH: ${C.earthStatus(state)}`;
    $('ship-link-status').dataset.phase=state.earthSignal.phase;
    $('ship-earth-nav').classList.toggle('incoming',state.earthSignal.phase==='incoming');
    $('earth-nav-indicator').textContent=state.earthSignal.phase==='incoming'?'!':'↗';
    $('ship-orbi-nav').classList.toggle('incoming',C.orbiNeedsAttention(state));
    $('orbi-nav-indicator').textContent=C.orbiNeedsAttention(state)?'!':'↗';
    $('crew-name-label').textContent=state.orbi.nameKnown?C.playerName(state).toUpperCase():'NOVA BASE';
    const preparing=insideShip()&&!!C.nextPreparation(state);
    $('ship-prep').hidden=!preparing;document.body.classList.toggle('daily-prep-active',preparing);
    for(const step of C.preparationSteps(state)){
      $(`prep-${step.id}`).classList.toggle('done',step.done);
      $(`prep-${step.id}-mark`).textContent=step.done?'✓':'○';
    }
    $('oxygen-bar').style.width = `${state.oxygen}%`; $('energy-bar').style.width = `${state.energy}%`;
    $('oxygen-bar').style.background = state.oxygen < 20 ? '#f4a27b' : '#b4d2cc';
    const goals=C.dayGoals(state),done=goals.filter(goal=>goal.done).length,task=currentTask();
    $('nav-count').textContent = `${done}/${goals.length}`;
    $('step-number').textContent = done===goals.length?'✓':number(done+1);
    $('step-label').textContent = task.label;
    $('mission-title').textContent = C.dayTitle(state);
    $('mission-description').textContent = `DAY ${state.survival.day} · ${state.survival.day===1?'Find supplies. Get to know the outpost.':'Breakfast. Weather. A little progress.'}`;
    [...$('progress-segments').children].forEach((el, i) => {el.hidden=i>=goals.length;el.className=goals[i]?.done?'done':i===done?'current':'';});
  }

  function resize() {
    const box = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
    view.w = box.width; view.h = box.height; view.dpr = dpr;
    view.scale = cameraForScene().scale;
    updateCamera();
  }
  function updateCamera(dt = 0) {
    const desired = cameraForScene();
    const blend = dt && !reducedMotion ? 1 - Math.exp(-dt * 10) : 1;
    view.x += (desired.x - view.x) * blend;
    view.y += (desired.y - view.y) * blend;
  }
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  const map = new Image();
  const orbiImage=new Image();
  const orbiReady=new Promise((resolve,reject)=>{
    orbiImage.onload=resolve;
    orbiImage.onerror=()=>reject(new Error('The ORBI mascot could not load. Check assets/orbi/orbi.svg, then reload.'));
  });
  orbiImage.src='assets/orbi/orbi.svg';
  const landscapeReady = new Promise((resolve, reject) => {
    map.onload = resolve;
    map.onerror = () => reject(new Error('Check that assets/mars-outpost.png is beside the game files, then reload.'));
  });
  map.src = 'assets/mars-outpost.png';
  Promise.all([landscapeReady, orbiReady, character.load(), indoorCharacter.load()]).then(() => {
    world = new window.MarsWorld(map);
    intro = new window.WakeupScene(map,indoorCharacter,orbiImage);
    syncIntro();
    ready = true; resize(); render(); updateInteraction(); $('loading').hidden = true;
    if(state.introComplete)dismissTimer = setTimeout(dismissWelcome, 18000);
  }).catch(error => {
    $('loading').querySelector('b').textContent = 'ASSET UNAVAILABLE';
    $('loading').querySelector(':scope > span').textContent = error.message;
  });

  for (let i = 0; i < 35; i++) motes.push({ x: Math.random() * C.W, y: 270 + Math.random() * 600, speed: 3 + Math.random() * 12, size: Math.random() > .8 ? 3 : 2, alpha: .1 + Math.random() * .22 });
  function drawLabel(s, active) {
    const current = insideShip() ? s.id==='earth-uplink'&&state.earthSignal.phase==='incoming'||s.id==='orbi'&&C.orbiNeedsAttention(state)||s.id===C.nextPreparation(state)?.station : currentTask()?.id === s.id;
    const completed = s.id==='earth-uplink'?state.earthSignal.phase==='connected':s.id==='orbi'?state.orbi.phase==='complete':!!state.tasks[s.id];
    ctx.font = '10px Consolas, monospace';
    const textWidth = ctx.measureText(s.name).width, x = s.labelX, y = s.labelY;
    ctx.fillStyle = active ? '#233128f0' : '#302b2cbb';
    ctx.fillRect(Math.round(x - textWidth / 2 - 13), y - 10, textWidth + 26, 20);
    ctx.fillStyle = current ? '#ffce8d' : completed ? '#c8e0b4' : '#f5e6d0';
    ctx.fillText(s.name, Math.round(x - textWidth / 2), y + 3);
    if (current && !insideShip() && !reducedMotion) {
      const dy = Math.round(Math.sin(time * 2.8) * 3), px = s.ax, py = s.ay - 30 + dy;
      ctx.fillStyle = '#322b2bbf'; ctx.fillRect(px - 7, py - 7, 14, 14);
      ctx.fillStyle = '#f8c185'; ctx.fillRect(px - 2, py - 5, 4, 10); ctx.fillRect(px - 5, py - 2, 10, 4);
      ctx.fillStyle = '#322b2b'; ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    if (completed) { ctx.fillStyle = '#bfd3a9'; ctx.fillRect(x + textWidth / 2 + 5, y - 2, 3, 3); }
  }
  function render() {
    if (!ready) return;
    const notification=$('earth-notification');
    notification.hidden=!insideShip()||state.earthSignal.phase!=='incoming';
    if(!notification.hidden){
      notification.style.left=`${(830-view.x)*view.scale}px`;
      notification.style.top=`${(296-view.y)*view.scale}px`;
    }
    const orbiNotification=$('orbi-notification');
    orbiNotification.hidden=!insideShip()||!C.orbiNeedsAttention(state);
    if(!orbiNotification.hidden){
      orbiNotification.style.left=`${(629-view.x)*view.scale}px`;
      orbiNotification.style.top=`${(276-view.y)*view.scale}px`;
    }
    if(!state.introComplete){
      const anchor=intro.draw(ctx,view.w,view.h,view.dpr,time,reducedMotion);
      $('story-bubble').style.left=`${anchor.x}px`;
      $('story-bubble').style.top=`${anchor.y}px`;
      return;
    }
    const scale = view.scale * view.dpr;
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#111b29';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale);
    ctx.imageSmoothingEnabled = false;
    if(insideShip())intro.drawCabin(ctx,time,reducedMotion,state.earthSignal.phase,state.orbi.phase,state.preparation,C.weatherFor(state.survival.day));
    else world.draw(ctx, { x: view.x, y: view.y, w: view.w / view.scale, h: view.h / view.scale });
    // Wind, footprints, and destination markers are real-time layers over the map.
    for (const foot of footsteps) {
      ctx.fillStyle = insideShip()?`rgba(7,24,40,${foot.life*.15})`:`rgba(106,49,35,${foot.life * .15})`; ctx.fillRect(foot.x - 2, foot.y, 4, 6);
    }
    if (target && path.length) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 5) * .12;
      ctx.strokeStyle = '#ffe6bda0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(target.x, target.y, 12 * pulse, 6 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffe6bda0'; ctx.fillRect(target.x - 1, target.y - 1, 3, 3);
    }
    for (const s of activeStations()) drawLabel(s, activeStation?.id === s.id || hoverStation?.id === s.id);
    // Each walking view has four original frames; idle keeps the last facing.
    const p = activePlayer(), frame = moving ? Math.floor(walkTime * 8) % 4 : -1;
    ctx.fillStyle = '#733d3c65'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 3, 33, 10, 0, 0, Math.PI * 2); ctx.fill();
    (insideShip()?indoorCharacter:character).draw(ctx, facing, frame, p.x, p.y);
    if (!reducedMotion && !insideShip()) {
      for (const m of motes) { ctx.fillStyle = `rgba(255,222,165,${m.alpha})`; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size); }
    }
    for (const s of sparks) { ctx.fillStyle = `rgba(255,223,142,${Math.max(0, s.life)})`; ctx.fillRect(s.x, s.y, 4, 4); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setDestination(point, station = null) {
    if (isBlocked()) return;
    dismissWelcome();
    if (!insideShip() && station && Math.hypot(state.player.x - station.ax, state.player.y - station.ay) > 6000) {
      toast('You’re far from home. Press B or tap the home button to return to base.'); return;
    }
    targetStation = station;
    const dest = station ? { x: station.ax, y: station.ay } : C.nearestOpen(point.x, point.y,insideShip()?C.shipWalkable:C.walkable,insideShip()?C.SHIP.spawn:C.HOME);
    path = C.findPath(activePlayer(), dest,insideShip()?'ship':'surface'); target = dest;
    if (!path.length) { toast('That spot is out of reach. Try the open ground.'); targetStation = null; }
    canvas.focus({ preventScroll: true });
  }
  function mouseWorld(event) {
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) / view.scale + view.x, y: (event.clientY - box.top) / view.scale + view.y };
  }
  function stationAt(p) {
    let found = null, distance = Infinity;
    for (const s of activeStations()) {
      if(insideShip()&&s.bounds&&p.x>=s.bounds.left&&p.x<=s.bounds.right&&p.y>=s.bounds.top&&p.y<=s.bounds.bottom)return s;
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
    const p=activePlayer();
    for (const s of activeStations()) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < s.radius && d < distance) { distance = d; nearest = s; }
    }
    return nearest;
  }
  function updateInteraction() {
    if(!state.introComplete){$('interact-prompt').hidden=true;$('destination-beacon').hidden=true;return;}
    activeStation = nearestStation();
    if(activeStation&&!insideShip()&&C.recordVisit(state,activeStation.id)){save();updateHud();}
    $('interact-prompt').hidden = !activeStation || isBlocked();
    if (activeStation) {
      $('interact-label').textContent = activeStation.name.toLowerCase().replace(/\b\w/g, x => x.toUpperCase());
      $('location-name').textContent = activeStation.name;
    } else $('location-name').textContent = insideShip()?'NOVA · FLIGHT DECK':C.regionAt(state.player.x, state.player.y);
    const x = Math.round((state.player.x - C.HOME.x) / 10), y = Math.round((state.player.y - C.HOME.y) / 10);
    $('world-coordinates').textContent = ` X ${x < 0 ? '−' : '+'}${Math.abs(x)} · Y ${y < 0 ? '−' : '+'}${Math.abs(y)}`;
    $('base-distance').textContent = insideShip()?'NOVA · CABIN':`BASE · ${Math.round(Math.hypot(state.player.x - C.HOME.x, state.player.y - C.HOME.y) / 10)} m`;
    const next = C.stations.find(s => s.id === currentTask()?.id);
    const offscreen = next && (next.ax < view.x+60 || next.ax > view.x+view.w/view.scale-60 || next.ay < view.y+100 || next.ay > view.y+view.h/view.scale-60);
    $('destination-beacon').hidden = insideShip() || !offscreen || isBlocked();
    if (next) {
      $('destination-name').textContent = next.name;
      $('destination-distance').textContent = `${Math.round(Math.hypot(next.ax-state.player.x,next.ay-state.player.y)/10)} m`;
      $('destination-arrow').style.transform = `rotate(${Math.atan2(next.ay-state.player.y,next.ax-state.player.x)}rad)`;
    }
    drawMinimap();
  }
  function drawMinimap() {
    if(insideShip()){
      const w=minimap.width,h=minimap.height,s=Math.min((w-12)/C.SHIP.width,(h-12)/C.SHIP.height),ox=(w-C.SHIP.width*s)/2,oy=(h-C.SHIP.height*s)/2;
      mini.fillStyle='#1c2d3b';mini.fillRect(0,0,w,h);mini.strokeStyle='#7d9d9c';mini.strokeRect(ox,oy,C.SHIP.width*s,C.SHIP.height*s);
      mini.fillStyle='#536c77';for(const [x,y,rw,rh] of [[250,295,245,342],[90,310,170,169],[733,302,201,226],[542,288,174,159],[270,690,175,56],[810,613,140,103]])mini.fillRect(ox+x*s,oy+y*s,rw*s,rh*s);
      for(const station of C.shipStations){mini.fillStyle=station.id==='orbi'&&C.orbiNeedsAttention(state)?'#ffcf87':station.id==='earth-uplink'?'#93d8c4':station.id==='airlock'?'#edb878':'#a7b7a4';mini.fillRect(ox+station.ax*s-2,oy+station.ay*s-2,4,4);}
      mini.fillStyle='#ffe3a9';mini.fillRect(ox+state.shipPlayer.x*s-2,oy+state.shipPlayer.y*s-2,4,4);return;
    }
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
    if(insideShip()){const airlock=C.shipStations.find(s=>s.id==='airlock');setDestination({x:airlock.ax,y:airlock.ay},airlock);return;}
    keys.clear(); path = []; target = null; targetStation = null;
    state.player = { ...C.HOME }; facing = 'down';
    dismissWelcome(); updateCamera(); updateInteraction(); save(); render();
    toast('Welcome home. Your expedition progress is saved.');
  }
  $('zoom-in').addEventListener('click', () => setZoom(zoom + .15));
  $('zoom-out').addEventListener('click', () => setZoom(zoom - .15));
  $('recall-button').addEventListener('click', returnToBase);
  $('ship-earth-nav').addEventListener('click',()=>{const s=C.shipStations.find(s=>s.id==='earth-uplink');setDestination({x:s.ax,y:s.ay},s);});
  $('earth-notification').addEventListener('click',()=>$('ship-earth-nav').click());
  $('ship-orbi-nav').addEventListener('click',()=>{const s=C.shipStations.find(s=>s.id==='orbi');setDestination({x:s.ax,y:s.ay},s);});
  $('orbi-notification').addEventListener('click',()=>{if(!isBlocked())openOrbi();});
  function walkToShipStation(id){const s=C.shipStations.find(s=>s.id===id);setDestination({x:s.ax,y:s.ay},s);}
  for(const id of ['eat','drink','weather','emu'])$(`prep-${id}`).addEventListener('click',()=>{if(id==='emu')openTraining('emu');else walkToShipStation(id==='weather'?'weather':'galley');});
  $('ship-exit-nav').addEventListener('click',()=>{const s=C.shipStations.find(s=>s.id==='airlock');setDestination({x:s.ax,y:s.ay},s);});
  $('destination-beacon').addEventListener('click', () => {
    const station = C.stations.find(s => s.id === currentTask()?.id);
    if (station) setDestination({x:station.ax,y:station.ay},station);
  });
  canvas.addEventListener('wheel', event => { event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? .08 : -.08)); }, { passive: false });
  function move(dx, dy) {
    const p = activePlayer(),isOpen=insideShip()?C.shipWalkable:C.walkable;
    // Small substeps prevent tunneling through obstacles during a slow frame.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    for (let i = 0; i < steps; i++) {
      if (isOpen(p.x + dx / steps, p.y)) p.x += dx / steps;
      if (isOpen(p.x, p.y + dy / steps)) p.y += dy / steps;
    }
    if (Math.abs(dx) > Math.abs(dy)) facing = dx > 0 ? 'right' : 'left';
    else if (Math.abs(dy) > .01) facing = dy > 0 ? 'down' : 'up';
  }
  function tick(dt) {
    time += dt;
    if(ready&&!paused&&!hidden){
      const signalEvent=C.tickEarthSignal(state,dt);
      if(signalEvent){
        save();updateHud();updateInteraction();
        if(dialog.open&&$('earth-signal'))earthDialog();
        if(signalEvent==='incoming'){
          chirp(740,.22);
          toast('Incoming transmission from Earth. Check the ! at the communications screen.');
        }else if(signalEvent==='error'){
          chirp(150,.25);
          toast('System error. The Earth signal is breaking up…');
        }else toast('Earth connection lost. The last transmission is saved at the console.');
      }
      if(C.tickOrbi(state,dt)==='orbi-ready'){
        if(dialog.open&&$('earth-signal'))closeDialog();
        save();updateHud();updateInteraction();chirp(523,.18);
        toast('The nearby TV lights up. ORBI has a message for you — look for the !');
      }
    }
    if (isBlocked()) { moving = false; return; }
    state.seconds += dt;
    const p=activePlayer(),previousX = p.x, previousY = p.y;
    let dx = 0, dy = 0;
    if (keys.has('w') || keys.has('arrowup')) dy--;
    if (keys.has('s') || keys.has('arrowdown')) dy++;
    if (keys.has('a') || keys.has('arrowleft')) dx--;
    if (keys.has('d') || keys.has('arrowright')) dx++;
    if (dx || dy) { path = []; target = null; targetStation = null; dismissWelcome(); }
    const speed = keys.has('shift') ? 285 : 172;
    if (!dx && !dy && path.length) {
      const node = path[0], dist = Math.hypot(node.x - p.x, node.y - p.y);
      if (dist < speed * dt + 1) { move(node.x - p.x, node.y - p.y); path.shift(); }
      else { dx = (node.x - p.x) / dist; dy = (node.y - p.y) / dist; }
      if (!path.length) {
        const station = targetStation; targetStation = null; target = null;
        if (station && Math.hypot(p.x - station.x, p.y - station.y) < station.radius + 10) interact(station);
      }
    }
    if (dx || dy) { const length = Math.hypot(dx, dy); move(dx / length * speed * dt, dy / length * speed * dt); }
    moving = Math.hypot(p.x-previousX,p.y-previousY) > .01;
    if (moving) {
      walkTime += dt * speed / 172;
      if (Math.floor(walkTime * 5) !== Math.floor((walkTime - dt) * 5)) footsteps.push({ x: p.x + (Math.floor(walkTime * 5) % 2 ? 7 : -7), y: p.y - 3, life: 1 });
      if(!insideShip())state.energy = Math.max(0, state.energy - dt * .024);
    }
    if(!insideShip())state.oxygen = Math.max(0, state.oxygen - dt * (moving ? .035 : .014));
    if (state.oxygen === 0 && !insideShip()) {
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
  function perform(id, message, buttonId='dialog-action') {
    if (busy) return;
    busy = true;
    const button = $(buttonId); button.disabled = true; button.querySelector('span').textContent = 'Working on it…';
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
    rocket: { icon: 'rocket', eyebrow: 'EXPEDITION CONTROL · LANDING PAD', title: 'One giant beginning.', body: 'Power restored. Plants growing. A new discovery sent home. Head back to the landing pad to sign off on this expedition.', stat: 'Expedition 004 · Ready to complete', action: 'Complete the expedition', message: 'Expedition complete. You’ve made a little home on Mars.' }
  };
  function changeLocation(entering) {
    if(busy)return;
    if(!entering&&!C.canExitShip(state)){airlockDialog();return;}
    if(dialog.open)closeDialog();
    entering?C.enterShip(state):C.exitShip(state);
    keys.clear();path=[];target=null;targetStation=null;activeStation=null;hoverStation=null;moving=false;facing=entering?'up':'down';
    footsteps.length=0;sparks.length=0;dismissWelcome();$('welcome').hidden=true;
    syncIntro();resize();updateHud();updateInteraction();render();save();
    toast(entering?'Back aboard NOVA. The Earth screen is on the right.':'You’re outside. Return to the landing pad whenever you want to enter the ship again.');
  }
  function earthDialog() {
    if(state.earthSignal.phase==='incoming'){C.contactEarth(state);save();updateHud();chirp(660,.18);}
    const e=state.earthSignal,linked=e.phase==='connected',faulty=e.phase==='error'||e.phase==='lost';
    const signal={waiting:'CHANNEL STANDBY',connected:'CONNECTION ESTABLISHED',error:'SYSTEM ERROR',lost:'SIGNAL LOST'}[e.phase];
    const title={waiting:'Someone might be listening.',connected:'A voice, from home.',error:'System error.',lost:'Connection lost.'}[e.phase];
    const transcript=e.phase==='waiting'?'':`<div class="comm-log" aria-label="Earth transmission log" tabindex="0">${C.earthDialogue.slice(0,e.line+1).map((line,i)=>`<p class="${line.speaker==='YOU'?'comm-you ':''}${i===e.line?'current-line':''}"><b>${line.speaker}</b>${line.text}</p>`).join('')}</div>`;
    const rescue=e.rescueDays===15?'<div class="rescue-info"><span>RESCUE ETA</span><strong>About 15 days</strong><small>“We’ll bring you back to Earth.”</small></div>':'';
    const detail=e.phase==='waiting'?'<p class="dialog-body">No transmission yet. The console is listening for Earth. Take a moment to look around the cabin.</p>':e.phase==='error'?'<p class="system-line" role="status">COMMUNICATIONS BUS ERROR<br>Carrier unstable. Trying to hold the channel…</p>':e.phase==='lost'?'<p class="system-line" role="status">EARTH LINK DISCONNECTED<br>Remote signal lost. Last transmission saved.</p><p class="dialog-body">Fifteen days. You have to keep the outpost running until they arrive.</p>':'';
    const continuing=linked&&e.line<C.earthDialogue.length-1;
    const action=continuing?actionButton('Continue transmission','earth-next'):linked||e.phase==='error'?'<button class="dialog-action" disabled><span>Listening…</span></button>':actionButton('Back to the cabin');
    showDialog('SPACESHIP · EARTH COMMUNICATIONS',`<div class="earth-terminal ${faulty?'faulty':''}" data-phase="${e.phase}"><div class="earth-terminal-top"><span class="terminal-dot ${linked?'online':''}"></span>NOVA / DEEP SPACE UPLINK</div><div class="earth-terminal-screen"><div class="pixel-earth" aria-hidden="true"><i></i><b></b></div><div><strong>EARTH</strong><span id="earth-signal" role="status">${signal}</span><small>${faulty?'Uplink offline · call log retained':state.tasks.solar?'Outpost power available':'Ship backup power · weak signal'}</small></div></div><div class="signal-track"><i id="earth-progress" style="width:${linked?100:0}%"></i></div></div><h1 id="dialog-title">${title}</h1>${rescue}${transcript}${detail}${action}`);
    if(continuing){
      $('earth-next').onclick=()=>{C.advanceEarthCall(state);save();updateHud();earthDialog();};
      $('earth-next').focus({preventScroll:true});
    }
    else if($('dialog-action'))$('dialog-action').onclick=closeDialog;
    const log=dialog.querySelector('.comm-log');if(log)log.scrollTop=log.scrollHeight;
  }
  function renderOrbi(){
    const line=C.orbiDialogue(state);
    $('orbi-speech').textContent=line.text;
    $('orbi-caption').textContent=line.caption;
    $('orbi-memory-name').textContent=C.playerName(state);
    $('orbi-memory-label').textContent=state.survival.warningPending?'SUPPLY ALERT':state.orbi.step===0?'A NAME TO REMEMBER':'IDENTITY RECOVERED';
    const replies=$('orbi-replies');replies.replaceChildren();
    line.choices.forEach((text,index)=>{
      const button=document.createElement('button');button.textContent=text;
      button.addEventListener('click',()=>{
        if(state.orbi.phase==='complete'){
          if(state.preparation.weatherChecked&&state.survival.day===2){closeOrbi();openTraining('storm');return;}
          if(state.preparation.weatherChecked&&state.survival.day===1&&!C.emuComplete(state)){closeOrbi();openTraining('emu');return;}
          if(state.survival.warningPending)C.acknowledgeSupplies(state);closeOrbi();return;
        }
        C.advanceOrbi(state,state.orbi.step===0&&index===1?'tasks':'');save();updateHud();
        if(state.orbi.phase==='complete'){
          closeOrbi();toast(`${C.playerName(state)}. That’s your name. First, eat and drink in the galley. Then check the weather.`);
        }else renderOrbi();
      });
      replies.append(button);
    });
    if(orbiDialog.open)replies.firstElementChild?.focus({preventScroll:true});
  }
  function openOrbi(){
    if(!C.beginOrbi(state)){
      showDialog('SPACESHIP · ORBI',`<h1 id="dialog-title">A sleeping companion.</h1><p class="dialog-body">A little robot rests on the TV screen. Its local assistant channel is on standby.</p>${actionButton('Back to the cabin')}`);
      $('dialog-action').onclick=closeDialog;return;
    }
    keys.clear();path=[];target=null;targetStation=null;moving=false;
    renderOrbi();orbiDialog.showModal();$('orbi-replies').firstElementChild?.focus({preventScroll:true});
    updateHud();updateInteraction();save();
  }
  function closeOrbi(){
    orbiDialog.close();keys.clear();canvas.focus({preventScroll:true});updateHud();updateInteraction();save();
  }
  $('orbi-close').addEventListener('click',closeOrbi);
  orbiDialog.addEventListener('cancel',event=>{event.preventDefault();closeOrbi();});
  function openTraining(mode){
    if(dialog.open)closeDialog();if(orbiDialog.open)closeOrbi();
    keys.clear();path=[];target=null;targetStation=null;moving=false;
    trainer.open(mode);updateInteraction();
  }
  function preparationList(){return `<ul class="preflight-list">${C.preparationSteps(state).map(step=>`<li class="${step.done?'done':''}"><span>${step.done?'✓':'○'}</span>${step.label}</li>`).join('')}</ul>`;}
  function lowSupplyDialog(){
    showDialog('ORBI · SUPPLIES RUNNING LOW',`<h1 id="dialog-title">That won’t last fifteen days.</h1><div class="supply-alert"><strong>FOOD ${state.survival.food}% <span>·</span> WATER ${state.survival.water}%</strong><p>“Mira, breakfast used some of our last supplies. We don’t have enough food and water for the rescue wait.”</p></div><p class="dialog-body">${state.survival.day===1?'“Day 1 is for exploring. Finish breakfast, check the weather, and find the food and water storage building. Visit a couple of other outpost locations while you’re out.”':'“Finish breakfast and check the weather. Visit the supply depot today so we have enough for tomorrow.”'}</p>${actionButton('Understood · Finish breakfast','supply-warning-ack')}`);
    $('supply-warning-ack').onclick=()=>{C.acknowledgeSupplies(state);save();updateHud();galleyDialog();};
  }
  function galleyDialog(){
    if(state.orbi.phase!=='complete'){
      showDialog('SPACESHIP · GALLEY',`<h1 id="dialog-title">A place for breakfast.</h1><p class="dialog-body">A warm meal and drinking water are waiting here. First, find out what ORBI wants to tell you.</p>${actionButton('Back to the cabin')}`);
      $('dialog-action').onclick=closeDialog;return;
    }
    const p=state.preparation,both=p.ate&&p.drank;
    showDialog('SPACESHIP · GALLEY',`<h1 id="dialog-title">A little fuel for you.</h1><p class="dialog-body">You’ve been asleep for a long time. Have a warm meal and some water before taking on the day.</p><div class="galley-tray"><svg viewBox="0 0 120 88" aria-hidden="true"><path fill="#bbbea3" d="M1 29h85v51H1z"/><path fill="#e7dfba" d="M7 35h73v37H7z"/><path fill="#8eaa62" d="M13 40h25v25H13z"/><path fill="#ca9b5e" d="M43 40h31v25H43z"/><path fill="#edd18b" d="M48 44h21v5H48z"/><path fill="#cce6d8" d="M93 18h22v58H93z"/><path fill="#72b6cc" d="M97 31h14v40H97z"/><path fill="#779398" d="M98 12h12v8H98z"/></svg><div><strong>Today’s breakfast</strong><small>${p.ate?'✓ Meal finished':'Warm vegetable ration · +15% energy'}</small><small>${p.drank?'✓ Water finished':'Fresh drinking water'}</small></div></div><div class="galley-actions"><button id="galley-eat" ${p.ate?'disabled':''}>${p.ate?'✓ Meal finished':'Eat breakfast'}</button><button id="galley-drink" ${p.drank?'disabled':''}>${p.drank?'✓ Hydrated':'Drink water'}</button></div><p class="dialog-body">${both?'Feeling better. Next, check today’s weather at the screen beside the airlock.':'Take a moment for both food and water.'}</p>${actionButton(both?'Go to the weather screen':'Back to the cabin')}`);
    $('galley-eat').disabled=p.ate||state.survival.food<10;
    $('galley-drink').disabled=p.drank||state.survival.water<15;
    $('galley-eat').onclick=()=>{C.eatMeal(state);save();updateHud();state.survival.warningPending?lowSupplyDialog():galleyDialog();};
    $('galley-drink').onclick=()=>{C.drinkWater(state);save();updateHud();state.survival.warningPending?lowSupplyDialog():galleyDialog();};
    $('dialog-action').onclick=()=>{closeDialog();if(both)walkToShipStation('weather');};
  }
  function weatherDialog(){
    const w=C.weatherFor(state.survival.day),p=state.preparation,canCheck=state.orbi.phase==='complete'&&p.ate&&p.drank;
    const dataset=trainer.donki.data;
    showDialog('SPACESHIP · WEATHER & SPACE WEATHER',`<div class="weather-report"><div><span>SIMULATED MARS CONDITIONS</span><span>SOL ${number(w.sol)}</span></div><div class="weather-overview">${icon('sun')}<div><strong>${w.summary}</strong><small>${w.storm?'DAY 2 TRAINING LOCKDOWN · NO EVA':'GENERATED GAME WEATHER'}</small></div></div><div class="weather-metrics"><div><span>TEMPERATURE</span><strong>${w.temperature}°</strong><small>C</small></div><div><span>WIND</span><strong>${w.wind}</strong><small> km/h</small></div><div><span>VISIBILITY</span><strong>${w.visibility}</strong></div></div><p>${w.advice}</p></div><h1 id="dialog-title">${w.storm?'A day to stay inside.':'A look at the sky.'}</h1><p class="weather-source-note">NASA DONKI tracks solar activity, not Mars air temperature or wind. ${w.storm?`ORBI’s ${dataset.displayMode==='historical'?'historical':'dated'} NASA case includes real FLR, CME, SEP and notification records from ${dataset.range.startDate} to ${dataset.range.endDate}. The Mars arrival and airlock lockout are simulated.`:'These atmospheric values are simulated. After checking the weather, learn the EMU with ORBI before your first EVA.'}</p><p class="dialog-body">${canCheck?w.storm?'Review the warning, then report to ORBI for the indoor solar-storm mission.':'Review today’s conditions before the EMU lesson.':state.orbi.phase==='complete'?'Have breakfast and drink water before finishing the weather check.':'ORBI will help you plan your day.'}</p>${actionButton(canCheck?'Confirm weather check':state.orbi.phase==='complete'?'Go to the galley':'Back to the cabin')}`);
    $('dialog-action').onclick=()=>{
      if(canCheck){
        C.checkWeather(state);save();closeDialog();updateHud();
        if(state.survival.day===2){toast('Day 2 solar-storm drill. No EVA today. ORBI has your briefing.');openOrbi();}
        else if(state.survival.day===1&&!C.emuComplete(state)){
          showDialog('ORBI · BEFORE YOUR FIRST EVA',`<h1 id="dialog-title">First, learn your spacesuit.</h1><p class="dialog-body">The weather check is done. Now match the EMU components to their roles before opening the airlock.</p>${actionButton('Learn & assemble the EMU','start-emu')}<button class="dialog-secondary" id="emu-later">Back to the cabin</button>`);
          $('start-emu').onclick=()=>openTraining('emu');$('emu-later').onclick=closeDialog;
        }else toast('Today’s weather is checked. Review your mission before heading out.');
      }
      else{closeDialog();if(state.orbi.phase==='complete')walkToShipStation('galley');}
    };
  }
  function airlockDialog(){
    if(state.survival.day===2){
      const checked=state.preparation.weatherChecked;
      showDialog('DAY 2 · AIRLOCK LOCKED',`<div class="dialog-icon">${icon('rocket')}</div><h1 id="dialog-title">No EVA during this storm.</h1><p class="dialog-body">${checked?'ORBI has set a shelter-only day. The simulated radiation alert keeps the airlock closed even after the training mission.':'Check today’s weather warning and report to ORBI. Day 2 is reserved for indoor storm training.'}</p><p class="weather-source-note">The Day 2 Mars arrival and lockout are simulated game effects. Real NASA observations are reviewed separately in ORBI’s briefing.</p><button class="dialog-action" disabled><span>Step outside · Storm lockdown</span></button><button class="dialog-secondary" id="storm-entry">${checked?'Open solar-storm training':'Go to the weather screen'}</button>`);
      $('storm-entry').onclick=()=>{closeDialog();checked?openTraining('storm'):walkToShipStation('weather');};return;
    }
    if(state.survival.day===1&&state.orbi.phase!=='complete'){
      showDialog('SPACESHIP · FIRST EVA PREPARATION',`<h1 id="dialog-title">Get your bearings first.</h1><p class="dialog-body">Follow the Earth call and speak with ORBI. Then have breakfast, check the weather and learn the EMU before going outside.</p>${actionButton('Back to the cabin')}`);$('dialog-action').onclick=closeDialog;return;
    }
    const next=C.nextPreparation(state);
    if(next){
      showDialog('SPACESHIP · PREPARE FOR THE DAY',`<div class="dialog-icon">${icon('rocket')}</div><h1 id="dialog-title">First, take care of yourself.</h1><p class="dialog-body">Before fieldwork, eat a meal, drink water, and check today’s weather. ORBI wants you to be ready.</p>${preparationList()}<button class="dialog-action" disabled><span>Step outside · Preparation needed</span></button><button class="dialog-secondary" id="prepare-next">${next.station==='galley'?'Go to the galley':'Go to the weather screen'}</button>`);
      if(next.id==='emu')$('prepare-next').textContent='Learn the EMU with ORBI';
      $('prepare-next').onclick=()=>{closeDialog();next.id==='emu'?openTraining('emu'):walkToShipStation(next.station);};return;
    }
    showDialog('SPACESHIP · AIRLOCK',`<div class="dialog-icon">${icon('rocket')}</div><h1 id="dialog-title">The red world is waiting.</h1><p class="dialog-body">${state.preparation.weatherChecked?'Breakfast finished. Water topped up. Today’s weather is checked. You’re ready for your outpost tasks.':'The hatch leads to the rocket’s landing pad. You can come back inside through this same airlock at any time.'}</p>${actionButton('Step outside')}`);
    $('dialog-action').onclick=()=>changeLocation(false);
  }
  function sleepDialog(){
    if(state.orbi.phase!=='complete'){
      showDialog('SPACESHIP · SLEEP POD',`<h1 id="dialog-title">This is where I woke up.</h1><p class="dialog-body">The pillow is still warm. Someone wanted you to survive this. First, find your bearings and talk to ORBI.</p>${actionButton('Keep looking')}`);
      $('dialog-action').onclick=closeDialog;return;
    }
    const status=C.restStatus(state),goals=C.dayGoals(state);
    showDialog(`END OF DAY ${state.survival.day} · SLEEP POD`,`<h1 id="dialog-title">A little rest, a new day.</h1><ul class="preflight-list">${goals.map(g=>`<li class="${g.done?'done':''}"><span>${g.done?'✓':'○'}</span>${g.label}</li>`).join('')}</ul><p class="dialog-body">${status.reason}</p><div class="dialog-stat">Food ${state.survival.food}% · Water ${state.survival.water}% · Your name and discoveries stay with you.</div><button class="dialog-action" id="sleep-next-day" ${status.allowed?'':'disabled'}><span>Sleep · Start Day ${state.survival.day+1}</span>${icon('arrow')}</button><button class="dialog-secondary" id="sleep-back">Back to the cabin</button>`);
    $('sleep-next-day').onclick=()=>{
      if(!C.startNextDay(state))return;
      closeDialog();keys.clear();path=[];target=null;targetStation=null;footsteps.length=0;facing='down';resize();updateHud();updateInteraction();save();render();
      showDialog(`DAY ${state.survival.day} · GOOD MORNING, ${C.playerName(state).toUpperCase()}`,`<h1 id="dialog-title">A new day on Mars.</h1><p class="dialog-body">${C.dayTitle(state)} Start with food, water, and today’s weather. Then: ${C.activeObjective(state).label.toLowerCase()}.</p>${actionButton('Start the day')}`);
      $('dialog-action').onclick=closeDialog;
    };
    $('sleep-back').onclick=closeDialog;
  }
  function interactShip(station) {
    if(station.id==='earth-uplink'){earthDialog();return;}
    if(station.id==='orbi'){openOrbi();return;}
    if(station.id==='galley'){galleyDialog();return;}
    if(station.id==='weather'){weatherDialog();return;}
    if(station.id==='airlock'){airlockDialog();return;}
    if(station.id==='ship-support'){
      showDialog('SPACESHIP · LIFE SUPPORT',`<div class="dialog-icon">${icon('leaf')}</div><h1 id="dialog-title">A moment to breathe.</h1><p class="dialog-body">The ship’s backup life support is still working. Refill your oxygen and recharge your suit before heading back out.</p><div class="dialog-stat">${icon('bolt')}Oxygen and suit energy restored to 100%</div>${actionButton('Refill my suit')}`);
      $('dialog-action').onclick=()=>{state.oxygen=100;state.energy=100;closeDialog();updateHud();toast('Suit replenished. You’re ready to head out.');};return;
    }
    sleepDialog();
  }
  function interact(station = activeStation) {
    if (!station || isBlocked()) return;
    dismissWelcome(); chirp(440, .05);
    const id = station.id;
    if(insideShip()){interactShip(station);return;}
    if(id==='storage'){
      const claimed=state.survival.storageClaimedDay===state.survival.day;
      showDialog('EXPLORATION · FOOD & WATER STORAGE',`<div class="dialog-icon">${icon('home')}</div><h1 id="dialog-title">Something to live on.</h1><p class="dialog-body">Sealed food crates. Fresh water tanks. The depot’s automated stores can prepare one supply load each day. You won’t have to face this planet on an empty stomach.</p><div class="supply-alert"><strong>FOOD ${state.survival.food}% · WATER ${state.survival.water}%</strong><p>${claimed?'Today’s supplies are loaded. Come back on the next day.':'Collect up to +70% food and +80% water. Reserves hold up to 100% each.'}</p></div>${actionButton(claimed?'Back to exploring':'Load food and water','storage-collect')}`);
      $('storage-collect').onclick=()=>{if(!claimed)C.collectSupplies(state);save();updateHud();closeDialog();toast('Food and water secured. Explore the outpost, then return to your sleep pod when the day is done.');};return;
    }
    if(id==='rocket'){
      const canFinish=C.canComplete(state,'rocket')&&!state.tasks.rocket;
      showDialog('LANDING PAD · NOVA SPACESHIP',`<div class="dialog-icon">${icon('rocket')}</div><h1 id="dialog-title">Back aboard?</h1><p class="dialog-body">Your spaceship’s airlock is open. Explore the cabin, top up your suit, or use the Earth communications screen.</p><div class="dialog-stat">${icon('home')}Earth: ${C.earthStatus(state).toLowerCase()} · Cabin accessible</div>${actionButton('Enter spaceship')}${canFinish?'<button class="dialog-secondary" id="finish-expedition"><span>Complete the expedition</span></button>':'<button class="dialog-secondary" id="stay-outside">Stay outside</button>'}`);
      $('dialog-action').onclick=()=>changeLocation(true);
      if(canFinish)$('finish-expedition').onclick=()=>perform('rocket',stationCopy.rocket.message,'finish-expedition');
      else $('stay-outside').onclick=closeDialog;
      return;
    }
    if (id === 'rover') {
      showDialog('EXPLORATION · ROVER', `<div class="dialog-icon">${icon('bolt')}</div><h1 id="dialog-title">A trusty little companion.</h1><p class="dialog-body">The rover has been out exploring while you settled in. ${state.rover ? 'Its survey is safely downloaded. The little explorer is enjoying a well-earned recharge.' : 'Its latest survey holds two mineral samples and a bit of spare battery power for your suit.'}</p><div class="dialog-stat">${icon('crystal')}${state.rover ? 'Survey downloaded · All clear' : '+2 mineral samples · +15% suit energy'}</div>${actionButton(state.rover ? 'Back to exploring' : 'Download the rover survey')}`);
      $('dialog-action').onclick = state.rover ? closeDialog : () => perform(id, 'Rover survey downloaded. Two bonus samples collected.'); return;
    }
    if (id === 'flag') {
      showDialog(`PERSONAL LOG · DAY ${state.survival.day}`, `<div class="dialog-icon">${icon('pin')}</div><h1 id="dialog-title">A very long way from home.</h1><p class="dialog-body">“The sky here is different. The silence, too. But the outpost is beginning to feel familiar, and for a moment, the distance doesn’t seem so big.”</p><div class="dialog-stat">${icon('book')}${state.flag ? 'Personal log recorded' : 'A moment worth remembering'}</div>${actionButton(state.flag ? 'Back to exploring' : 'Record a personal log')}`);
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
    const current=currentTask(),goals=C.dayGoals(state),done=goals.every(g=>g.done)&&current.id==='rocket';
    const rows=goals.map((g,i)=>`<li class="${g.done?'completed':'current'}"><span class="number">${g.done?'✓':number(i+1)}</span><span><strong>${g.label}</strong><small>${g.id==='explore'?`${state.survival.visited.filter(id=>id!=='storage').length} locations visited`:g.station==='storage'?'Follow the marker to the warehouse. Load food and water there.':'Follow the station marker, then return to the spaceship.'}</small></span></li>`).join('');
    const places=!insideShip()?`<div class="station-index">${C.stations.map(s=>`<button data-station="${s.id}"><span>${s.name}</span><small>${state.survival.visited.includes(s.id)?'VISITED':'EXPLORE'}</small></button>`).join('')}</div>`:'';
    showDialog(`DAY ${state.survival.day} · MISSION LOG`,`<h1 id="dialog-title">${C.dayTitle(state)}</h1><p class="dialog-body">${state.survival.day===1?'Today is about finding your way around. Food and water are scarce. Find storage, visit other outpost locations, and return to the ship to rest.':'Prepare for the day, complete your fieldwork, and return to the sleep pod when you’re ready for tomorrow.'}</p><ul class="journal-list">${rows}</ul><p class="journal-meta">FOOD ${state.survival.food}% · WATER ${state.survival.water}% · ${missionCount()} / 5 OUTPOST SYSTEMS RESTORED</p>${places}${actionButton(done&&insideShip()?'Go to the sleep pod':'Show my next destination')}`);
    $('dialog-action').onclick=()=>{
      closeDialog();
      const s=insideShip()?C.shipStations.find(s=>s.id===(C.nextPreparation(state)?.station||(done?'sleep-pod':state.survival.day===2?'orbi':'airlock'))):C.stations.find(s=>s.id===current.id);
      setDestination({x:s.ax,y:s.ay},s);
    };
    for(const button of dialog.querySelectorAll('[data-station]'))button.onclick=()=>{const s=C.stations.find(s=>s.id===button.dataset.station);closeDialog();setDestination({x:s.ax,y:s.ay},s);};
  }
  $('day-journal').addEventListener('click',showMissions);
  function showGuide() {
    if (busy) return;
    showDialog('FIELD GUIDE · GETTING YOUR BEARINGS', `<div class="dialog-icon">${icon('book')}</div><h1 id="dialog-title">A small guide to a big planet.</h1>
      <p class="dialog-body">${insideShip()?'Prepare with breakfast, water, and the weather screen. Day 1 also requires ORBI’s EMU matching lesson. Day 2 stays indoors for the solar-storm drill. Tap the checklist or ORBI’s TV for your next step.':'Explore the desert and follow the day’s objective marker. Return through the rocket’s airlock, then rest in the ship to begin the next day.'}</p>
      <div class="guide-row"><span>Move your astronaut</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows</span></div>
      <div class="guide-row"><span>Walk to a destination</span><span>CLICK / TAP</span></div>
      <div class="guide-row"><span>Interact with a nearby place</span><span><kbd>E</kbd> / tap prompt</span></div>
      <div class="guide-row"><span>Move a little faster</span><span><kbd>⇧</kbd> SHIFT</span></div>
      <div class="guide-row"><span>Zoom the camera</span><span>SCROLL / <kbd>−</kbd><kbd>+</kbd></span></div>
      <div class="guide-row"><span>Return to home base</span><span><kbd>B</kbd> / home button</span></div>
      <div class="guide-row"><span>Mission log / pause</span><span><kbd>M</kbd> / <kbd>Esc</kbd></span></div>
      <p class="guide-note">${insideShip()?'Use the Earth screen and Airlock shortcuts to walk to them automatically. Press E or tap the interaction prompt when you’re nearby. Your cabin position and Earth connection are saved.':'The stations are spread across the desert. Follow the roads, or tap the gold direction marker to walk to your next station. The scanner shows all stations and marks home in green. Your position and mission progress save on this device.'}</p>${actionButton('I’m ready to explore')}`);
    $('dialog-action').onclick = closeDialog;
  }
  function showPause() {
    if (busy) return;
    if (dialog.open) { closeDialog(); return; }
    paused = true;
    showDialog('EXPEDITION PAUSED', `<div class="dialog-icon">${icon('pause')}</div><h1 id="dialog-title">Take a breath.</h1><p class="dialog-body">${state.introComplete?'The red planet will still be here. Your progress is saved, and your suit systems are on standby.':'The spaceship is quiet. Your place in the story is saved.'}</p><div class="dialog-stat">${icon('check')}${state.introComplete?`${missionCount()} / 5 tasks completed · ${number(state.samples)} samples collected`:'PROLOGUE · THE AWAKENING'}</div>${actionButton(state.introComplete?'Back to the outpost':'Back to the story')}<button class="dialog-secondary" id="replay-story">↺ Replay story from the beginning</button><p class="replay-story-note">Replay waking up, the Earth call, and ORBI. Your missions and samples are kept.</p><a class="dialog-secondary" href="index.html">Return to main menu</a><button class="dialog-secondary" id="reset-button">Start a fresh expedition</button>`);
    $('dialog-action').onclick = closeDialog;
    $('replay-story').onclick=()=>{
      C.replayStory(state);footsteps.length=0;sparks.length=0;facing='down';walkTime=0;
      clearTimeout(toastTimer);$('toast').hidden=true;
      closeDialog();syncIntro();resize();updateHud();updateInteraction();save();render();
    };
    $('reset-button').onclick = confirmReset;
  }
  function confirmReset() {
    showDialog('A NEW CHAPTER', `<h1 id="dialog-title">Start again?</h1><p class="dialog-body">This replaces your saved expedition with a fresh start. Your current mission progress and samples will be cleared.</p>${actionButton('Start a fresh expedition')}<button class="dialog-secondary" id="cancel-reset">Keep my expedition</button>`);
    $('dialog-action').onclick = () => {
      state = C.freshState(); footsteps.length = 0; sparks.length = 0; facing = 'down';
      closeDialog();syncIntro(); updateHud(); updateCamera(); save();render();
    };
    $('cancel-reset').onclick = () => { closeDialog(); };
  }
  function showSuccess() {
    showDialog('EXPEDITION 004 · COMPLETE', `<div class="success-stars" aria-hidden="true">✦ ✧ ✦</div><h1 id="dialog-title">One small outpost.<br>One giant beginning.</h1><p class="dialog-body">You brought power, a little green, and a new discovery to a quiet corner of Mars. That’s a pretty good beginning.</p><div class="dialog-stat">${icon('check')}Day ${state.survival.day} · 5 / 5 missions · ${number(state.samples)} samples</div>${actionButton('Stay a little longer')}<button class="dialog-secondary" id="new-expedition">Begin a new expedition</button>`);
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
    if(trainer?.isOpen())return;
    if(orbiDialog.open){
      if(['e',' ','enter'].includes(key)){
        if(event.target.closest?.('button')&&event.target.id==='orbi-close'&&key!=='e')return;
        event.preventDefault();
        if(!event.repeat)(event.target.closest?.('#orbi-replies button')||$('orbi-replies').firstElementChild)?.click();
      }
      return;
    }
    if (key === 'escape') { if (!dialog.open) { event.preventDefault(); showPause(); } return; }
    if (dialog.open) {
      const next=$('earth-next');
      if(next&&['e',' ','enter'].includes(key)){
        if((key===' '||key==='enter')&&event.target.closest?.('button,a')&&event.target.id!=='earth-next')return;
        event.preventDefault();if(!event.repeat)next.click();
      }
      return;
    }
    if(!state.introComplete){
      if(['e',' ','enter'].includes(key)){
        if((key===' '||key==='enter')&&event.target.closest?.('button,a')&&event.target.id!=='story-next')return;
        event.preventDefault();if(!event.repeat)advanceIntro();
      }else if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))event.preventDefault();
      return;
    }
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
  trainer=new window.MissionTraining({core:C,getState:()=>state,save,onChange:()=>updateHud(),onClose:()=>{keys.clear();updateHud();updateInteraction();canvas.focus({preventScroll:true});save();}});
  updateHud(); resize(); requestAnimationFrame(frame);
})();
