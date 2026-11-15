/* The simulation is independent of the renderer so saves and navigation can be verified. */
(function (root) {
  'use strict';
  // W/H describe the original outpost artwork, not the limits of the world.
  const W = 1600, H = 900, GRID = 20, CHUNK = 512;
  const HOME = { x: 780, y: 596 };
  const EARTH_ALERT_DELAY=4;
  const ASTRONAUT_NAME='Mira';
  const freshOrbi=()=>({phase:'locked',elapsed:0,step:0,nameKnown:false,response:''});
  const earthDialogue=[
    {speaker:'EARTH CONTROL',text:'NOVA, can you hear us? We picked up your distress beacon.'},
    {speaker:'YOU',text:'I can hear you… I just woke up. I don’t remember anything. Not even my own name.'},
    {speaker:'EARTH CONTROL',text:'Stay calm. We’re sending a rescue ship. We should arrive in about 15 days, and we’ll bring you back to Earth.'},
    {speaker:'YOU',text:'Fifteen days… Okay. Please, don’t leave me alone.'},
    {speaker:'EARTH CONTROL',text:'We’re here. Keep the ship powered and stay near the outpost. We’ll stay with you until—'}
  ];
  const freshEarthSignal=()=>({phase:'waiting',elapsed:0,line:0,faultElapsed:0,rescueDays:0});
  const SHIP = { width:1100, height:840, spawn:{x:550,y:535}, entrance:{x:550,y:650} };
  const shipStations = [
    {id:'earth-uplink',name:'EARTH COMMUNICATIONS',x:830,y:540,ax:830,ay:560,radius:105,labelX:830,labelY:579,bounds:{left:735,top:307,right:930,bottom:527}},
    {id:'airlock',name:'AIRLOCK · MARS SURFACE',x:550,y:685,ax:550,ay:670,radius:80,labelX:550,labelY:783,bounds:{left:467,top:680,right:633,bottom:775}},
    {id:'ship-support',name:'LIFE SUPPORT',x:188,y:491,ax:190,ay:505,radius:70,labelX:175,labelY:495,bounds:{left:90,top:315,right:260,bottom:480}},
    {id:'sleep-pod',name:'SLEEP POD',x:525,y:535,ax:550,ay:555,radius:90,labelX:375,labelY:651,bounds:{left:252,top:297,right:495,bottom:635}},
    {id:'orbi',name:'ORBI · CREW COMPANION',x:630,y:484,ax:630,ay:498,radius:78,labelX:630,labelY:456,bounds:{left:542,top:288,right:716,bottom:447}}
  ];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const tasks = [
    { id: 'solar', label: 'Restore the solar array', detail: 'Clear away the dust. Let a little sunshine in.', icon: 'sun' },
    { id: 'greenhouse', label: 'Bring the greenhouse to life', detail: 'Start life support for your green companions.', icon: 'leaf' },
    { id: 'crystals', label: 'Collect Martian ice samples', detail: 'Find the blue crystals east of the outpost.', icon: 'crystal' },
    { id: 'habitat', label: 'Send your findings to Earth', detail: 'Use the habitat uplink to share your discovery.', icon: 'home' },
    { id: 'rocket', label: 'Complete the expedition', detail: 'Return to the landing pad. You did good today.', icon: 'rocket' }
  ];
  // Artwork coordinates remain local to each site. Translate visuals, labels,
  // interaction points, and colliders together when placing a station.
  const stationSources = [
    { id: 'solar', name: 'SOLAR ARRAY', x: 275, y: 593, ax: 350, ay: 630, radius: 115, labelX: 180, labelY: 659, bounds: [35,408,383,628] },
    { id: 'greenhouse', name: 'GREENHOUSE', x: 699, y: 355, ax: 700, ay: 385, radius: 100, labelX: 699, labelY: 366, bounds: [526,91,874,333] },
    { id: 'crystals', name: 'ICE DEPOSIT', x: 1387, y: 560, ax: 1300, ay: 580, radius: 112, labelX: 1390, labelY: 624, bounds: [1270,459,1500,583] },
    { id: 'habitat', name: 'NOVA HABITAT', x: 1139, y: 352, ax: 1140, ay: 385, radius: 100, labelX: 1140, labelY: 365, bounds: [955,12,1318,322] },
    { id: 'rocket', name: 'LANDING PAD', x: 274, y: 362, ax: 280, ay: 400, radius: 105, labelX: 273, labelY: 397, bounds: [115,80,430,360] },
    { id: 'rover', name: 'EXPLORER ROVER', x: 1414, y: 433, ax: 1350, ay: 470, radius: 95, labelX: 1425, labelY: 476, bounds: [1335,318,1510,447] },
    { id: 'flag', name: 'EXPEDITION FLAG', x: 1116, y: 588, ax: 1070, ay: 610, radius: 76, labelX: 1130, labelY: 637, bounds: [1097,455,1218,605] }
  ];
  const placements = { solar: [-1400,2100], greenhouse: [900,2600], crystals: [3100,1500], habitat: [780,560], rocket: [-1500,200], rover: [2800,-900], flag: [-800,-1500] };
  const stations = stationSources.map(source => {
    const [x,y] = placements[source.id], dx = x - source.x, dy = y - source.y;
    return { ...source, x, y, dx, dy, ax: source.ax + dx, ay: source.ay + dy, labelX: source.labelX + dx, labelY: source.labelY + dy,
      bounds: { left: source.bounds[0] + dx, top: source.bounds[1] + dy, right: source.bounds[2] + dx, bottom: source.bounds[3] + dy } };
  });
  const roads = stations.filter(s => s.id !== 'habitat').map(s => [HOME, {x:s.ax + 400,y:HOME.y}, {x:s.ax + 400,y:s.ay + 120}, {x:s.ax,y:s.ay + 120}, {x:s.ax,y:s.ay}]);
  function segmentDistance(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
    return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
  }
  function freshState() {
    return { version: 1, introComplete: false, introStep: 0, location:'ship', shipPlayer:{...SHIP.spawn}, earthContacted:false, earthSignal:freshEarthSignal(), orbi:freshOrbi(), tasks: Object.fromEntries(tasks.map(t => [t.id, false])), oxygen: 98, energy: 72, samples: 0, rover: false, flag: false, seconds: 0, player: { ...HOME } };
  }
  const ellipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  function randomFor(cx, cy, salt = 0) {
    let n = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263) ^ Math.imul(salt + 41, 1442695041);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  }
  const chunkCache = new Map();
  function getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkCache.has(key)) return chunkCache.get(key);
    const objects = [];
    for (let i = 0; i < 6; i++) {
      const x = cx * CHUNK + 65 + randomFor(cx, cy, i * 9) * (CHUNK - 130);
      const y = cy * CHUNK + 65 + randomFor(cx, cy, i * 9 + 1) * (CHUNK - 130);
      const n = randomFor(cx, cy, i * 9 + 2);
      const type = i === 0 && n > .35 ? 'crater' : n > .84 ? 'ice' : 'rock';
      const rx = type === 'crater' ? 70 + n * 50 : 18 + n * 28;
      const ry = rx * (type === 'crater' ? .48 : .52);
      if (Math.hypot(x-HOME.x,y-HOME.y) < rx + 170) continue;
      if (stations.some(s => x > s.bounds.left-rx-90 && x < s.bounds.right+rx+90 && y > s.bounds.top-rx-90 && y < s.bounds.bottom+rx+150)) continue;
      if (roads.some(points => points.some((point,j) => j && segmentDistance(x,y,points[j-1],point) < rx+60))) continue;
      if (objects.some(o => Math.hypot(o.x - x, o.y - y) < o.rx + rx + 45)) continue;
      objects.push({ type, x: Math.round(x), y: Math.round(y), rx, ry, variant: i % 3 });
    }
    const chunk = { cx, cy, objects, seed: randomFor(cx, cy, 90) };
    if (chunkCache.size >= 160) chunkCache.delete(chunkCache.keys().next().value);
    chunkCache.set(key, chunk);
    return chunk;
  }
  function regionAt(x, y) {
    const station = stations.find(s => Math.hypot(x-s.x,y-s.y) < 430);
    if (station) return station.name;
    if (Math.hypot(x-HOME.x,y-HOME.y) < 450) return 'NOVA OUTPOST';
    return ['COPPER DUNES', 'BASALT FIELDS', 'THE QUIET BASIN', 'ELYSIUM WILDS'][Math.floor(randomFor(Math.floor(x / 2048), Math.floor(y / 2048), 101) * 4)];
  }
  function cameraFor(player, width, height, zoom = 1) {
    const scale = Math.max(width / 1200, height / 700) * clamp(zoom, .65, 1.6);
    return { scale, x: player.x - width / scale / 2, y: player.y - height / scale * .58 };
  }
  function shipCameraFor(player,width,height,zoom=1) {
    const scale=Math.max(width/1100,height/800)*clamp(zoom,.65,1.6),w=width/scale,h=height/scale;
    return {scale,x:w>=SHIP.width?(SHIP.width-w)/2:clamp(player.x-w/2,0,SHIP.width-w),y:h>=SHIP.height?(SHIP.height-h)/2:clamp(player.y-h*.58,0,SHIP.height-h)};
  }
  function shipWalkable(x,y) {
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<105||x>1000||y<280||y>732)return false;
    return ![[250,295,495,637],[90,310,260,479],[733,302,934,476],[785,480,909,528],[128,537,231,628],[542,288,716,447]].some(([l,t,r,b])=>x>l&&x<r&&y>t&&y<b);
  }
  function walkable(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    for (const s of stations) {
      if (x < s.bounds.left-20 || x > s.bounds.right+20 || y < s.bounds.top-20 || y > s.bounds.bottom+20) continue;
      const lx = x-s.dx, ly = y-s.dy;
      if (s.id === 'rocket' && ellipse(lx,ly,277,272,155,83)) return false;
      if (s.id === 'greenhouse' && ellipse(lx,ly,699,243,171,81)) return false;
      if (s.id === 'habitat' && (lx > 965 && lx < 1306 && ly > 110 && ly < 317 || ellipse(lx,ly,1118,80,62,55))) return false;
      if (s.id === 'solar' && (lx > 35 && lx < 242 && ly > 420 && ly < 500 || lx > 92 && lx < 303 && ly > 492 && ly < 591)) return false;
      if (s.id === 'crystals' && ellipse(lx,ly,1397,550,79,35)) return false;
      if (s.id === 'rover' && ellipse(lx,ly,1425,398,68,35)) return false;
      if (s.id === 'flag' && ellipse(lx,ly,1115,586,20,12)) return false;
    }
    for (let cy = Math.floor((y - 130) / CHUNK); cy <= Math.floor((y + 130) / CHUNK); cy++) {
      for (let cx = Math.floor((x - 130) / CHUNK); cx <= Math.floor((x + 130) / CHUNK); cx++) {
        for (const o of getChunk(cx, cy).objects) if (ellipse(x, y, o.x, o.y, o.rx, o.ry)) return false;
      }
    }
    return true;
  }
  function nearestOpen(x, y, isOpen=walkable, fallback=HOME) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...fallback };
    if (isOpen(x, y)) return { x, y };
    for (let r = 20; r < 400; r += 20) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (isOpen(px, py)) return { x: px, y: py };
      }
    }
    return { ...fallback };
  }
  function findPath(start, goal, location='surface') {
    const isOpen=location==='ship'?shipWalkable:walkable;
    const dest = nearestOpen(goal.x, goal.y,isOpen,location==='ship'?SHIP.spawn:HOME);
    const segmentClear = (a, b) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let i = 0; i <= steps; i++) if (!isOpen(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
      return true;
    };
    const cell = p => {
      let c = { x: Math.round(p.x / GRID), y: Math.round(p.y / GRID) };
      if (segmentClear(p, { x: c.x * GRID, y: c.y * GRID })) return c;
      for (let r = 1; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const q = { x: c.x + dx, y: c.y + dy };
        if (segmentClear(p, { x: q.x * GRID, y: q.y * GRID })) return q;
      }
      return c;
    };
    if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) return [];
    const s = cell(start), g = cell(dest), key = p => `${p.x},${p.y}`;
    const costs = new Map([[key(s), 0]]), came = new Map(), closed = new Set(), heap = [];
    const estimate = p => { const dx = Math.abs(p.x - g.x), dy = Math.abs(p.y - g.y); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    function push(p) {
      heap.push(p); let i = heap.length - 1;
      while (i) { const parent = (i - 1) >> 1; if (heap[parent].f <= p.f) break; heap[i] = heap[parent]; i = parent; } heap[i] = p;
    }
    function pop() {
      const first = heap[0], tail = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) { let child = i * 2 + 1; if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++; if (heap[child].f >= tail.f) break; heap[i] = heap[child]; i = child; } heap[i] = tail;
      }
      return first;
    }
    const bounds = { left: Math.min(s.x, g.x) - 32, right: Math.max(s.x, g.x) + 32, top: Math.min(s.y, g.y) - 32, bottom: Math.max(s.y, g.y) + 32 };
    const valid = p => p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.top && p.y <= bounds.bottom && isOpen(p.x * GRID, p.y * GRID);
    push({ ...s, f: estimate(s) });
    let end = null, limit = 0;
    while (heap.length && limit++ < 40000) {
      const p = pop();
      if (closed.has(key(p))) continue;
      if (key(p) === key(g)) { end = p; break; }
      closed.add(key(p));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (closed.has(key(q)) || !valid(q)) continue;
        if (dx && dy && (!valid({ x: p.x + dx, y: p.y }) || !valid({ x: p.x, y: p.y + dy }))) continue;
        if (!segmentClear({ x: p.x * GRID, y: p.y * GRID }, { x: q.x * GRID, y: q.y * GRID })) continue;
        const cost = costs.get(key(p)) + Math.hypot(dx, dy);
        if (cost >= (costs.get(key(q)) ?? Infinity)) continue;
        came.set(key(q), p); costs.set(key(q), cost);
        push({ ...q, f: cost + estimate(q) });
      }
    }
    if (!end) return [];
    const route = [];
    while (key(end) !== key(s)) { route.push({ x: end.x * GRID, y: end.y * GRID }); end = came.get(key(end)); }
    route.reverse();
    if (Math.hypot(start.x - s.x * GRID, start.y - s.y * GRID) > 1) route.unshift({ x: s.x * GRID, y: s.y * GRID });
    route.push(dest);
    return route;
  }
  function normalizeState(saved) {
    const state = freshState();
    if (!saved || saved.version !== 1) return state;
    state.introComplete = saved.introComplete === true;
    state.location=!state.introComplete||saved.location==='ship'?'ship':'surface';
    state.earthContacted=saved.earthContacted===true;
    if(saved.earthSignal&&['waiting','incoming','connected','error','lost'].includes(saved.earthSignal.phase)){
      const e=saved.earthSignal;
      state.earthSignal={phase:e.phase,elapsed:Number.isFinite(e.elapsed)?clamp(e.elapsed,0,EARTH_ALERT_DELAY):0,line:Number.isFinite(e.line)?Math.floor(clamp(e.line,0,earthDialogue.length-1)):0,faultElapsed:Number.isFinite(e.faultElapsed)?clamp(e.faultElapsed,0,1.5):0,rescueDays:e.rescueDays===15?15:0};
      if(['connected','error','lost'].includes(e.phase))state.earthContacted=true;
      if(e.phase==='error'||e.phase==='lost'){state.earthSignal.line=earthDialogue.length-1;state.earthSignal.rescueDays=15;}
      if(state.earthSignal.line>=2)state.earthSignal.rescueDays=15;
    }
    if(state.earthSignal.phase==='lost'){
      const o=saved.orbi;
      if(o&&['booting','pending','talking','complete'].includes(o.phase)){
        state.orbi={phase:o.phase,elapsed:Number.isFinite(o.elapsed)?clamp(o.elapsed,0,2):0,step:Number.isFinite(o.step)?Math.floor(clamp(o.step,0,3)):0,nameKnown:['talking','complete'].includes(o.phase),response:o.response==='tasks'?'tasks':''};
        if(o.phase==='complete')state.orbi.step=3;
      }else state.orbi.phase='pending';
    }
    if(shipWalkable(saved.shipPlayer?.x,saved.shipPlayer?.y))state.shipPlayer={x:saved.shipPlayer.x,y:saved.shipPlayer.y};
    if (Number.isFinite(saved.introStep)) state.introStep = Math.floor(clamp(saved.introStep,0,3));
    for (const t of tasks) state.tasks[t.id] = saved.tasks?.[t.id] === true;
    if (!state.tasks.solar) state.tasks.greenhouse = false;
    if (!(state.tasks.solar && state.tasks.greenhouse && state.tasks.crystals)) state.tasks.habitat = false;
    if (!state.tasks.habitat) state.tasks.rocket = false;
    for (const k of ['oxygen', 'energy', 'samples', 'seconds']) if (Number.isFinite(saved[k])) state[k] = clamp(saved[k], 0, k === 'seconds' ? 9999999 : 100);
    state.rover = saved.rover === true; state.flag = saved.flag === true;
    if (walkable(saved.player?.x, saved.player?.y)) state.player = { x: saved.player.x, y: saved.player.y };
    return state;
  }
  function canComplete(state, id) {
    if (id === 'greenhouse') return state.tasks.solar;
    if (id === 'habitat') return state.tasks.solar && state.tasks.greenhouse && state.tasks.crystals;
    if (id === 'rocket') return state.tasks.habitat;
    return ['solar', 'crystals', 'rover', 'flag'].includes(id);
  }
  function finishIntro(state) {
    const rocket = stations.find(s=>s.id==='rocket');
    state.introComplete = true; state.introStep = 3;
    state.location='ship';state.shipPlayer={...SHIP.spawn};
    state.player = {x:rocket.ax,y:rocket.ay};
    return state;
  }
  function enterShip(state) {state.location='ship';state.shipPlayer={...SHIP.entrance};return state;}
  function exitShip(state) {const rocket=stations.find(s=>s.id==='rocket');state.location='surface';state.player={x:rocket.ax,y:rocket.ay};return state;}
  function contactEarth(state) {
    if(!state.introComplete||state.location!=='ship'||['error','lost'].includes(state.earthSignal.phase))return false;
    state.earthContacted=true;state.earthSignal.phase='connected';return true;
  }
  function advanceEarthCall(state){
    const e=state.earthSignal;if(e.phase!=='connected'||e.line>=earthDialogue.length-1)return false;
    e.line++;if(e.line>=2)e.rescueDays=15;return true;
  }
  function tickEarthSignal(state,dt){
    if(!state.introComplete||!Number.isFinite(dt)||dt<=0)return '';
    const e=state.earthSignal;
    if(e.phase==='waiting'&&state.location==='ship'){
      e.elapsed=Math.min(EARTH_ALERT_DELAY,e.elapsed+dt);
      if(e.elapsed>=EARTH_ALERT_DELAY){e.phase='incoming';return 'incoming';}
    }else if(e.phase==='connected'&&e.line===earthDialogue.length-1){
      e.faultElapsed+=dt;if(e.faultElapsed>=1.5){e.phase='error';e.faultElapsed=0;return 'error';}
    }else if(e.phase==='error'){
      e.faultElapsed+=dt;if(e.faultElapsed>=1.5){e.phase='lost';e.faultElapsed=0;state.orbi.phase='booting';return 'lost';}
    }
    return '';
  }
  function earthStatus(state){return {waiting:'STANDBY',incoming:'INCOMING!',connected:'CONNECTED',error:'SYSTEM ERROR',lost:'SIGNAL LOST'}[state.earthSignal.phase];}
  function tickOrbi(state,dt){
    if(!state.introComplete||state.location!=='ship'||state.earthSignal.phase!=='lost'||!Number.isFinite(dt)||dt<=0)return '';
    const o=state.orbi;
    if(o.phase==='booting'){
      o.elapsed=Math.min(2,o.elapsed+dt);
      if(o.elapsed>=2){o.phase='pending';return 'orbi-ready';}
    }
    return '';
  }
  function orbiNeedsAttention(state){return ['pending','talking'].includes(state.orbi.phase);}
  function playerName(state){return state.orbi.nameKnown?ASTRONAUT_NAME:'???';}
  function beginOrbi(state){
    if(!state.introComplete||state.location!=='ship'||state.earthSignal.phase!=='lost'||!['pending','talking','complete'].includes(state.orbi.phase))return false;
    if(state.orbi.phase==='pending'){state.orbi.phase='talking';state.orbi.nameKnown=true;}
    return true;
  }
  function advanceOrbi(state,response=''){
    const o=state.orbi;if(o.phase!=='talking')return false;
    if(o.step===0)o.response=response==='tasks'?'tasks':'';
    if(o.step<3)o.step++;else o.phase='complete';
    return true;
  }
  function orbiDialogue(state){
    const task=tasks.find(t=>!state.tasks[t.id]);
    const assignment=task?`Today’s first task: ${task.label.toLowerCase()}. I’ve marked it in your mission log.`:'You’ve finished today’s outpost tasks. All systems are looking brighter!';
    if(state.orbi.phase==='complete')return {text:`Welcome back, ${ASTRONAUT_NAME}! ${assignment}`,choices:['Back to the cabin'],caption:'A familiar voice. A name to hold on to.'};
    return [
      {text:`Morning, ${ASTRONAUT_NAME}! Ready for today’s tasks?`,choices:[`${ASTRONAUT_NAME}… is that my name?`,'Today’s tasks? What happened?'],caption:'That name… it feels like it belongs to you.'},
      {text:state.orbi.response==='tasks'?`Your memory is a little scrambled, isn’t it? You’re ${ASTRONAUT_NAME}, the astronaut assigned to this outpost. I’m ORBI, your onboard companion. Let’s take this one step at a time.`:`Of course! You’re ${ASTRONAUT_NAME}, the astronaut assigned to this outpost. I’m ORBI, your onboard companion. I’ve been waiting for you to wake up.`,choices:['I don’t remember any of that.'],caption:`${ASTRONAUT_NAME}. The first piece of your story.`},
      {text:`That’s okay, ${ASTRONAUT_NAME}. We’ll figure it out together. I heard Earth’s last message: rescue should arrive in about 15 days. Until then, you’ve got me.`,choices:['What should I do first?'],caption:'You are a little less alone now.'},
      {text:`${assignment} Keep the outpost powered while we work on the Earth link. Come back to this screen whenever you need me.`,choices:['Let’s get started.'],caption:'A name. A companion. A small plan for tomorrow.'}
    ][state.orbi.step];
  }
  function complete(state, id) {
    if (!canComplete(state, id)) return false;
    if (id === 'rover') { if (!state.rover) { state.samples += 2; state.energy = Math.min(100, state.energy + 15); state.rover = true; } return true; }
    if (id === 'flag') { state.flag = true; return true; }
    if (state.tasks[id]) { if (id === 'greenhouse' || id === 'habitat') state.oxygen = 100; return true; }
    state.tasks[id] = true;
    if (id === 'solar') state.energy = 100;
    if (id === 'greenhouse') state.oxygen = 100;
    if (id === 'crystals') state.samples = Math.min(100, state.samples + 3);
    if (id === 'habitat') { state.oxygen = 100; state.energy = 100; }
    return true;
  }
  const api = { W, H, GRID, CHUNK, HOME, SHIP, EARTH_ALERT_DELAY, ASTRONAUT_NAME, earthDialogue, shipStations, roads, clamp, randomFor, getChunk, regionAt, cameraFor, shipCameraFor, shipWalkable, tasks, stations, freshState, normalizeState, walkable, nearestOpen, findPath, finishIntro, enterShip, exitShip, contactEarth, advanceEarthCall, tickEarthSignal, earthStatus, tickOrbi, orbiNeedsAttention, playerName, beginOrbi, advanceOrbi, orbiDialogue, canComplete, complete };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NOVACore = api;
})(typeof window !== 'undefined' ? window : globalThis);
