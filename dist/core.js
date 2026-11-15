/* The simulation is independent of the renderer so saves and navigation can be verified. */
(function (root) {
  'use strict';
  const Training=typeof module!=='undefined'&&module.exports?require('./training-model.js'):root.NOVATrainingModel;
  const freshTraining=()=>({emu:{placed:[],learned:[]},storm:{reviewed:false,answers:[],attempts:0,feedback:null}});
  // W/H describe the original outpost artwork, not the limits of the world.
  const W = 1600, H = 900, GRID = 20, CHUNK = 512;
  const HOME = { x: 780, y: 596 };
  const EARTH_ALERT_DELAY=4;
  const ASTRONAUT_NAME='Mira';
  const freshOrbi=()=>({phase:'locked',elapsed:0,step:0,nameKnown:false,response:''});
  const freshPreparation=()=>({ate:false,drank:false,weatherChecked:false});
  const isStormDay=day=>day>=2&&day<=4||day===9||day===12||day===13;
  const freshOperations=()=>({solarDay:0,roverDay:0,checks:{},work:{},canisters:0,oxygenReserve:120,oxygenCollectedDay:0,oxygenInstalledDay:0,harvestDay:0,plantDay:0,seeds:6});
  const freshSurvival=()=>({day:1,food:28,water:32,noticeDay:0,warningPending:false,storageClaimedDay:0,storageRecovered:false,visited:[],visitedToday:[]});
  const todayWeather={sol:1,summary:'Clear with light dust',temperature:-42,wind:14,visibility:'Good',advice:'Calm conditions for fieldwork. Keep your spacesuit sealed and return if visibility drops.'};
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
    {id:'orbi',name:'ORBI · CREW COMPANION',x:630,y:484,ax:630,ay:498,radius:78,labelX:630,labelY:456,bounds:{left:542,top:288,right:716,bottom:447}},
    {id:'galley',name:'GALLEY · FOOD & WATER',x:350,y:670,ax:350,ay:665,radius:75,labelX:350,labelY:758,bounds:{left:270,top:690,right:445,bottom:746}},
    {id:'weather',name:'SURFACE WEATHER',x:795,y:675,ax:775,ay:665,radius:80,labelX:880,labelY:738,bounds:{left:810,top:613,right:950,bottom:716}}
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
  stations.push({id:'storage',name:'FOOD & WATER STORAGE',x:3500,y:3300,ax:3500,ay:3440,radius:155,labelX:3500,labelY:3484,dx:0,dy:0,bounds:{left:3330,top:3080,right:3680,bottom:3395}});
  const roads = stations.filter(s => s.id !== 'habitat').map(s => [HOME, {x:s.ax + 400,y:HOME.y}, {x:s.ax + 400,y:s.ay + 120}, {x:s.ax,y:s.ay + 120}, {x:s.ax,y:s.ay}]);
  function segmentDistance(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
    return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
  }
  function freshState() {
    return { ending:{phase:'dormant',step:0,elapsed:0}, operations:freshOperations(), interiorPlayer:{x:550,y:660}, version: 1, introComplete: false, introStep: 0, location:'ship', shipPlayer:{...SHIP.spawn}, earthContacted:false, earthSignal:freshEarthSignal(), orbi:freshOrbi(), preparation:freshPreparation(), survival:freshSurvival(), training:freshTraining(), tasks: Object.fromEntries(tasks.map(t => [t.id, false])), oxygen: 98, energy: 72, samples: 0, rover: false, flag: false, seconds: 0, player: { ...HOME } };
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
    return ![[250,295,495,637],[90,310,260,479],[733,302,934,476],[785,480,909,528],[128,537,231,628],[542,288,716,447],[270,690,445,746],[810,613,950,716]].some(([l,t,r,b])=>x>l&&x<r&&y>t&&y<b);
  }
  function walkable(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    for (const s of stations) {
      if (x < s.bounds.left-20 || x > s.bounds.right+20 || y < s.bounds.top-20 || y > s.bounds.bottom+20) continue;
      const lx = x-s.dx, ly = y-s.dy;
      if(s.id==='storage'&&x>s.bounds.left&&x<s.bounds.right&&y>s.bounds.top&&y<s.bounds.bottom)return false;
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
    state.location=!state.introComplete||saved.location==='ship'?'ship':['habitat','greenhouse'].includes(saved.location)?saved.location:'surface';
    if(saved.operations){const o=saved.operations;for(const k of ['solarDay','roverDay','harvestDay','plantDay','seeds','canisters','oxygenReserve','oxygenCollectedDay','oxygenInstalledDay'])if(Number.isFinite(o[k]))state.operations[k]=Math.floor(clamp(o[k],0,k==='oxygenReserve'?300:99999));for(const k of ['oxygen','food','water','power'])if(Number.isFinite(o.checks?.[k]))state.operations.checks[k]=Math.floor(clamp(o.checks[k],0,99999));if(o.work&&typeof o.work==='object')for(const [key,value]of Object.entries(o.work))if(Number.isFinite(value))state.operations.work[key]=Math.floor(clamp(value,0,15));}
    if(['dormant','recalled','transmission','zoom','complete'].includes(saved.ending?.phase))state.ending={phase:saved.ending.phase,step:Math.floor(clamp(saved.ending.step||0,0,6)),elapsed:clamp(saved.ending.elapsed||0,0,999)};
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
    if(state.orbi.phase==='complete'){
      state.preparation.ate=saved.preparation?.ate===true;
      state.preparation.drank=saved.preparation?.drank===true;
      state.preparation.weatherChecked=state.preparation.ate&&state.preparation.drank&&saved.preparation?.weatherChecked===true;
    }
    if(saved.survival&&typeof saved.survival==='object'){
      const v=saved.survival;
      for(const key of ['day','food','water','noticeDay','storageClaimedDay'])if(Number.isFinite(v[key]))state.survival[key]=key==='food'||key==='water'?clamp(v[key],0,100):Math.floor(clamp(v[key],key==='day'?1:0,99999));
      state.survival.noticeDay=Math.min(state.survival.noticeDay,state.survival.day);
      state.survival.storageClaimedDay=Math.min(state.survival.storageClaimedDay,state.survival.day);
      state.survival.warningPending=v.warningPending===true;
      state.survival.storageRecovered=v.storageRecovered===true;
      for(const key of ['visited','visitedToday'])if(Array.isArray(v[key]))state.survival[key]=[...new Set(v[key].filter(id=>stations.some(s=>s.id===id)))];
    }else{
      if(state.preparation.ate)state.survival.food-=10;
      if(state.preparation.drank)state.survival.water-=15;
      state.survival.warningPending=state.preparation.ate;
    }
    if (walkable(saved.player?.x, saved.player?.y)) state.player = { x: saved.player.x, y: saved.player.y };
    const t=saved.training,partIds=Training.emuParts.map(part=>part.id);
    if(t&&typeof t==='object'){
      for(const key of ['placed','learned'])if(Array.isArray(t.emu?.[key]))state.training.emu[key]=[...new Set(t.emu[key].filter(id=>partIds.includes(id)))];
      state.training.emu.learned=[...new Set([...state.training.emu.learned,...state.training.emu.placed])];
      state.training.storm.reviewed=t.storm?.reviewed===true;
      if(state.training.storm.reviewed&&Array.isArray(t.storm?.answers))for(let i=0;i<Training.stormDecisions.length;i++){
        if(t.storm.answers[i]!==Training.stormDecisions[i].choices.find(choice=>choice.correct).id)break;
        state.training.storm.answers.push(t.storm.answers[i]);
      }
      state.training.storm.attempts=Number.isFinite(t.storm?.attempts)?Math.floor(clamp(t.storm.attempts,0,99999)):0;
      const question=Training.stormDecisions[state.training.storm.answers.length],feedback=t.storm?.feedback;
      if(state.training.storm.reviewed&&question&&feedback&&question.choices.some(choice=>choice.id===feedback.choice))state.training.storm.feedback={choice:feedback.choice};
    }
    if(isStormDay(state.survival.day)&&state.location!=='ship'){state.location='ship';state.shipPlayer={...SHIP.entrance};}
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
  function replayStory(state){
    state.introComplete=false;state.introStep=0;state.location='ship';state.shipPlayer={...SHIP.spawn};
    state.earthContacted=false;state.earthSignal=freshEarthSignal();state.orbi=freshOrbi();state.preparation=freshPreparation();state.survival=freshSurvival();state.training=freshTraining();state.operations=freshOperations();state.ending={phase:'dormant',step:0,elapsed:0};
    return state;
  }
  function enterShip(state) {state.location='ship';state.shipPlayer={...SHIP.entrance};return state;}
  function exitShip(state) {if(!canExitShip(state))return false;const rocket=stations.find(s=>s.id==='rocket');state.location='surface';state.player={x:rocket.ax,y:rocket.ay};return state;}
  function contactEarth(state) {
    if(!state.introComplete||state.location!=='ship'||['error','lost'].includes(state.earthSignal.phase))return false;
    state.earthContacted=true;state.earthSignal.phase='connected';return true;
  }
  function advanceEarthCall(state){
    const e=state.earthSignal;if(e.phase!=='connected'||e.line>=earthDialogue.length-1)return false;
    e.line++;if(e.line>=2)e.rescueDays=15;return true;
  }
  function tickEarthSignal(state,dt){
    if(!['dormant','recalled'].includes(state.ending.phase))return '';
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
  function orbiNeedsAttention(state){return ['pending','talking'].includes(state.orbi.phase)||state.orbi.phase==='complete'&&(state.survival.warningPending||state.preparation.weatherChecked&&(state.survival.day===1&&!emuComplete(state)||isStormDay(state.survival.day)&&!stormComplete(state)));}
  function playerName(state){return state.orbi.nameKnown?ASTRONAUT_NAME:'???';}
  function preparationSteps(state){return [
    {id:'eat',label:'Eat a meal',station:'galley',done:state.preparation.ate},
    {id:'drink',label:'Drink water',station:'galley',done:state.preparation.drank},
    {id:'weather',label:'Check today’s weather',station:'weather',done:state.preparation.weatherChecked}
  ].concat(state.survival.day===1?[{id:'emu',label:'Learn & fit the EMU',station:'orbi',done:emuComplete(state)}]:[]);}
  function nextPreparation(state){return state.orbi.phase==='complete'?preparationSteps(state).find(step=>!step.done):null;}
  function canExitShip(state){return !isStormDay(state.survival.day)&&(state.survival.day!==1||emuComplete(state))&&(state.orbi.phase!=='complete'||preparationSteps(state).every(step=>step.done));}
  function eatMeal(state){
    if(!state.introComplete||state.location!=='ship'||state.orbi.phase!=='complete'||state.preparation.ate||state.survival.food<10)return false;
    state.preparation.ate=true;state.survival.food-=10;flagLowSupplies(state);return true;
  }
  function drinkWater(state){
    if(!state.introComplete||state.location!=='ship'||state.orbi.phase!=='complete'||state.preparation.drank||state.survival.water<15)return false;
    state.preparation.drank=true;state.survival.water-=15;flagLowSupplies(state);return true;
  }
  function checkWeather(state){
    if(!state.introComplete||state.location!=='ship'||state.orbi.phase!=='complete'||!state.preparation.ate||!state.preparation.drank)return false;
    state.preparation.weatherChecked=true;return true;
  }
  function emuComplete(state){return Training.emuParts.every(part=>state.training.emu.placed.includes(part.id));}
  function canTrainEmu(state){return state.introComplete&&state.location==='ship'&&state.orbi.phase==='complete'&&state.survival.day===1&&state.preparation.weatherChecked;}
  function learnEmuPart(state,id){
    if(!canTrainEmu(state)||!Training.emuParts.some(part=>part.id===id))return false;
    if(!state.training.emu.learned.includes(id))state.training.emu.learned.push(id);return true;
  }
  function placeEmuPart(state,id,slot){
    if(!canTrainEmu(state)||id!==slot||!Training.emuParts.some(part=>part.id===id)||state.training.emu.placed.includes(id))return false;
    learnEmuPart(state,id);state.training.emu.placed.push(id);return true;
  }
  function stormComplete(state){return state.training.storm.answers.length===Training.stormDecisions.length;}
  function canTrainStorm(state){return state.introComplete&&state.location==='ship'&&state.orbi.phase==='complete'&&isStormDay(state.survival.day)&&state.preparation.weatherChecked;}
  function reviewStormRecords(state){if(!canTrainStorm(state))return false;state.training.storm.reviewed=true;return true;}
  function stormFeedback(state){
    const question=Training.stormDecisions[state.training.storm.answers.length];
    return question?.choices.find(choice=>choice.id===state.training.storm.feedback?.choice)||null;
  }
  function chooseStormDecision(state,id){
    if(!canTrainStorm(state)||!state.training.storm.reviewed||stormComplete(state))return null;
    const question=Training.stormDecisions[state.training.storm.answers.length],choice=question.choices.find(c=>c.id===id);
    if(!choice)return null;state.training.storm.attempts++;state.training.storm.feedback={choice:id};return choice;
  }
  function advanceStormDecision(state){
    if(!canTrainStorm(state)||!state.training.storm.reviewed||!stormFeedback(state)?.correct)return false;
    state.training.storm.answers.push(state.training.storm.feedback.choice);state.training.storm.feedback=null;return true;
  }
  function flagLowSupplies(state){
    const s=state.survival;if(s.noticeDay!==s.day&&(s.food<=25||s.water<=25))s.warningPending=true;
  }
  function acknowledgeSupplies(state){state.survival.warningPending=false;state.survival.noticeDay=state.survival.day;}
  function recordVisit(state,id){
    if(!state.introComplete||state.location!=='surface')return false;
    const station=stations.find(s=>s.id===id);
    if(!station||Math.hypot(state.player.x-station.x,state.player.y-station.y)>station.radius+10)return false;
    const s=state.survival;if(!s.visited.includes(id))s.visited.push(id);
    if(s.visitedToday.includes(id))return false;s.visitedToday.push(id);return true;
  }
  function collectSupplies(state){
    const depot=stations.find(s=>s.id==='storage'),s=state.survival;
    if(!state.introComplete||state.location!=='surface'||Math.hypot(state.player.x-depot.x,state.player.y-depot.y)>depot.radius+10||s.storageClaimedDay===s.day)return false;
    recordVisit(state,'storage');s.food=Math.min(100,s.food+70);s.water=Math.min(100,s.water+80);s.storageClaimedDay=s.day;s.storageRecovered=true;acknowledgeSupplies(state);return true;
  }
  function performOperation(state,id){
    const o=state.operations,d=state.survival.day;if(!state.introComplete)return false;
    if(id==='install-oxygen'&&state.location==='ship'&&o.canisters>0){o.canisters--;o.oxygenReserve=Math.min(300,o.oxygenReserve+80);o.oxygenInstalledDay=d;return true;}
    if(id==='refill-oxygen'&&state.location==='ship'&&o.oxygenReserve>0&&state.oxygen<100){const amount=Math.min(100-state.oxygen,o.oxygenReserve);state.oxygen+=amount;o.oxygenReserve-=amount;return true;}
    const job=dayGoals(state).find(g=>g.id===id&&g.kind==='work');
    if(job){const sites=state.location==='ship'?shipStations:stations,site=sites.find(st=>st.id===job.station),player=state.location==='ship'?state.shipPlayer:state.player;if(site&&Math.hypot(player.x-site.x,player.y-site.y)<=site.radius+10){o.work[id]=d;return true;}}
    if(isStormDay(d))return false;
    if(id==='collect-oxygen'&&state.location==='greenhouse'&&o.oxygenCollectedDay!==d&&o.canisters<3){o.canisters++;o.oxygenCollectedDay=d;return true;}
    if(state.location==='habitat'&&['oxygen','food','water','power'].includes(id)){o.checks[id]=d;return true;}
    if(state.location==='greenhouse'&&d>=7){
      if(id==='harvest'&&o.harvestDay!==d&&(!o.harvestDay||o.plantDay>=o.harvestDay&&d>=o.plantDay+2)){o.harvestDay=d;state.survival.food=Math.min(100,state.survival.food+25);o.seeds+=2;return true;}
      if(id==='plant'&&o.harvestDay===d&&o.plantDay!==d&&o.seeds>0){o.plantDay=d;o.seeds--;return true;}
    }
    if(state.location==='surface'&&['solar','rover'].includes(id)){const site=stations.find(st=>st.id===id);if(Math.hypot(state.player.x-site.x,state.player.y-site.y)>site.radius+10)return false;if(id==='solar'){if(o.solarDay===d)return false;o.solarDay=d;complete(state,'solar');return true;}if(o.roverDay===d)return false;o.roverDay=d;state.samples=Math.min(100,state.samples+2);return true;}return false;
  }
  function dayGoals(state){
    const s=state.survival;
    if(s.day===1)return [
      {id:'supplies',label:'Find storage and collect food & water',station:'storage',done:s.storageRecovered},
      {id:'explore',label:'Visit two other outpost locations',station:stations.find(st=>st.id!=='storage'&&!s.visited.includes(st.id))?.id||'habitat',done:s.visited.filter(id=>id!=='storage').length>=2}
    ];
    const o=state.operations;
    const schedule={
      3:[['shielding','Inspect radiation shielding','ship-support'],['archive','Back up the flight recorder','earth-uplink']],
      4:[['filters','Replace the cabin air filter','ship-support'],['inventory','Audit emergency rations','galley']],
      5:[['solar','Clear storm dust from solar panels','solar'],['collect-oxygen','Collect greenhouse oxygen','greenhouse'],['install-oxygen','Install oxygen at ship life support','ship-support']],
      6:[['solar','Clean solar panels','solar'],['supplies','Restock food and water','storage'],['rover','Download rover terrain data','rover']],
      7:[['harvest','Harvest red romaine lettuce','greenhouse'],['plant','Plant new seeds','greenhouse'],['check-water','Check habitat water','habitat']],
      8:[['ice-analysis','Analyze ice core samples','crystals'],['supplies','Prepare supplies for the next storm','storage'],['collect-oxygen','Collect greenhouse oxygen','greenhouse']],
      9:[['seal-test','Test airlock pressure seals','airlock'],['antenna','Retune communications antenna','earth-uplink']],
      10:[['harvest','Harvest the next lettuce crop','greenhouse'],['plant','Plant a fresh tray of seeds','greenhouse'],['irrigation-test','Service the irrigation pump','greenhouse']],
      11:[['rover','Retrieve rover radiation readings','rover'],['supplies','Restock storm shelter supplies','storage'],['check-power','Inspect habitat power','habitat']],
      12:[['scrubber','Service the CO2 scrubber','ship-support'],['weather-log','Record storm radiation readings','weather']],
      13:[['diagnostics','Run flight computer diagnostics','earth-uplink'],['shelter-audit','Audit shelter food and water','galley']],
      14:[['solar','Brush dust off the solar array','solar'],['harvest','Harvest red romaine for the final day','greenhouse'],['plant','Plant the next generation','greenhouse'],['supplies','Pack fresh supplies','storage']],
      15:[['rover','Collect the final rover survey','rover'],['beacon','Inspect the expedition beacon','flag']]
    };
    if(s.day===2)return [{id:'storm-weather',label:'Check the storm warning',station:'weather',done:state.preparation.weatherChecked},{id:'storm-data',label:'Review NASA storm records with ORBI',station:'orbi',done:state.training.storm.reviewed},{id:'storm-training',label:'Complete the shelter drill',station:'orbi',done:stormComplete(state)}];
    return (schedule[s.day]||schedule[15]).map(([id,label,station])=>{const known=['solar','rover','supplies','harvest','plant','collect-oxygen','install-oxygen'].includes(id)||id.startsWith('check-');const done=id==='supplies'?s.storageClaimedDay===s.day:id==='collect-oxygen'?o.oxygenCollectedDay===s.day:id==='install-oxygen'?o.oxygenInstalledDay===s.day:id.startsWith('check-')?o.checks[id.slice(6)]===s.day:known?o[id==='solar'?'solarDay':id==='rover'?'roverDay':id==='harvest'?'harvestDay':'plantDay']===s.day:o.work[id]===s.day;return {id,label,station,done,kind:known?'operation':'work'};});
  }
  function dayTitle(state){const d=state.survival.day;return d===1?'Explore your new surroundings.':isStormDay(d)?'Storm shelter. Keep the systems running.':d===15?'One more ordinary day on Mars.':d===7?'The first harvest.':d===6?'Clean panels and fresh supplies.':'A new day. A different mission.';}
  function activeObjective(state){
    if(state.ending.phase!=='dormant')return {id:'rocket',label:'ORBI: Return to spaceship communications'};
    if(isStormDay(state.survival.day)){const next=dayGoals(state).find(goal=>!goal.done);return next?{id:next.station,label:next.label}:{id:'rocket',label:'Rest in the ship - storm shelter'};}
    if(state.orbi.phase==='complete'&&(state.survival.food<10||state.survival.water<15))return {id:'storage',label:'Restock food and water before tomorrow'};
    const next=dayGoals(state).find(goal=>!goal.done);
    return next?{id:next.station,label:next.label}: {id:'rocket',label:'Return to the ship and rest'};
  }
  function restStatus(state){
    if(state.survival.day>=15)return {allowed:false,reason:'Finish the final fieldwork and listen for ORBI. This is the last day.'};
    if(state.orbi.phase!=='complete')return {allowed:false,reason:'Talk to ORBI and find your bearings first.'};
    if(state.location!=='ship')return {allowed:false,reason:'Return to the spaceship to rest.'};
    if(!preparationSteps(state).every(step=>step.done))return {allowed:false,reason:'Finish breakfast, water, and today’s weather check first.'};
    if(dayGoals(state).some(goal=>!goal.done))return {allowed:false,reason:'Finish today’s objectives before turning in.'};
    if(state.survival.food<10||state.survival.water<15)return {allowed:false,reason:'Collect more supplies before tomorrow. The supply depot has food and water.'};
    return {allowed:true,reason:'Today’s work is done. Get some sleep and begin the next day.'};
  }
  function startNextDay(state){
    if(!restStatus(state).allowed)return false;
    state.survival.day++;state.survival.visitedToday=[];state.survival.warningPending=false;state.preparation=freshPreparation();
    state.shipPlayer={...SHIP.spawn};return true;
  }
  function weatherFor(day){
    if(isStormDay(day))return {sol:day,summary:'Solar-storm training alert',temperature:-47,wind:26,visibility:'Simulated',advice:'Radiation storm active. Remain in the shelter today. No EVA today. NASA event records provide context; the Mars arrival and airlock restriction are simulated.',storm:true};
    const reports=[todayWeather,
      {summary:'Breezy with drifting dust',temperature:-47,wind:26,visibility:'Fair',advice:'Stay near marked routes. Drifting dust may make distant landmarks harder to see.'},
      {summary:'Cold and clear',temperature:-56,wind:9,visibility:'Good',advice:'A clear day for fieldwork. Keep an eye on your suit power in the colder air.'},
      {summary:'Cloudy with light dust',temperature:-40,wind:19,visibility:'Fair',advice:'Check your bearings at each station and keep the ship within reach.'}];
    return {...reports[(Math.max(1,day)-1)%reports.length],sol:day};
  }
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
    if(state.orbi.phase==='complete'&&state.preparation.weatherChecked&&isStormDay(state.survival.day))return {text:'Mira, Day 2 is a shelter day. The airlock stays locked. Let’s review NASA’s real solar-event records, then practise protecting ourselves in a simulated Mars radiation storm.',choices:['Open solar-storm training'],caption:'Real observations. A simulated mission. Decisions that matter.'};
    if(state.orbi.phase==='complete'&&state.preparation.weatherChecked&&state.survival.day===1&&!emuComplete(state))return {text:'Before your first EVA, learn the EMU. Match its parts to their jobs. It keeps you breathing and working, but it is not a shield against an intense solar-particle storm.',choices:['Learn & assemble the EMU'],caption:'A little practice before the first step outside.'};
    if(state.orbi.phase==='complete')return {text:state.survival.warningPending?`Mira, our supplies are low! Food: ${state.survival.food}%. Water: ${state.survival.water}%. We don’t have enough for the rescue wait. Explore the outpost and find the food and water storage building.`:`Morning, ${ASTRONAUT_NAME}! It’s Day ${state.survival.day}. ${nextPreparation(state)?'Breakfast, water, and today’s weather first. ':''}${activeObjective(state).label}. I’ve marked the route for you.`,choices:[state.survival.warningPending?'I’ll look for the supply depot.':'Back to the cabin'],caption:state.survival.warningPending?'A small breakfast. A much bigger problem.':'A familiar voice. A new day.'};
    return [
      {text:`Morning, ${ASTRONAUT_NAME}! Ready for today’s tasks?`,choices:[`${ASTRONAUT_NAME}… is that my name?`,'Today’s tasks? What happened?'],caption:'That name… it feels like it belongs to you.'},
      {text:state.orbi.response==='tasks'?`Your memory is a little scrambled, isn’t it? You’re ${ASTRONAUT_NAME}, the astronaut assigned to this outpost. I’m ORBI, your onboard companion. Let’s take this one step at a time.`:`Of course! You’re ${ASTRONAUT_NAME}, the astronaut assigned to this outpost. I’m ORBI, your onboard companion. I’ve been waiting for you to wake up.`,choices:['I don’t remember any of that.'],caption:`${ASTRONAUT_NAME}. The first piece of your story.`},
      {text:`That’s okay, ${ASTRONAUT_NAME}. We’ll figure it out together. I heard Earth’s last message: rescue should arrive in about 15 days. Until then, you’ve got me.`,choices:['What should I do first?'],caption:'You are a little less alone now.'},
      {text:'First, breakfast! Eat and drink in the galley, then check today’s weather. Day 1 is for exploring: get to know the outpost and find what we need to survive.',choices:['Let’s get started.'],caption:'Take care of yourself. Then take on the day.'}
    ][state.orbi.step];
  }
  function complete(state, id) {
    if (!canComplete(state, id)) return false;
    if (id === 'rover') { if (!state.rover) { state.samples += 2;  state.rover = true; } return true; }
    if (id === 'flag') { state.flag = true; return true; }
    if (state.tasks[id]) {  return true; }
    state.tasks[id] = true;


    if (id === 'crystals') state.samples = Math.min(100, state.samples + 3);

    return true;
  }
  const endingLines=[['ORBI','Incoming transmission detected...'],['Earth Control','Mars Base, do you copy?'],['Astronaut','EARTH?! Is that really you?'],['Earth Control',"We've been trying to reach you for fifteen days."],['Astronaut','I thought everyone had forgotten about me...'],['Earth Control','We never stopped looking.'],['ORBI','Survival mission accomplished.']];
  function tickEnding(state,dt,working){const e=state.ending;if(state.survival.day!==15||!Number.isFinite(dt)||dt<=0)return '';if(e.phase==='dormant'&&working){e.elapsed+=dt;if(e.elapsed>=8){e.phase='recalled';e.elapsed=0;return 'recall';}}if(e.phase==='zoom'){e.elapsed+=dt;if(e.elapsed>=7){e.phase='complete';return 'complete';}}return '';}
  function beginEnding(state){if(state.survival.day!==15||state.location!=='ship'||state.ending.phase!=='recalled')return false;state.ending.phase='transmission';state.ending.step=0;state.earthSignal.phase='connected';return true;}
  function advanceEnding(state){if(state.ending.phase!=='transmission')return false;if(state.ending.step<endingLines.length-1)state.ending.step++;else{state.ending.phase='zoom';state.ending.elapsed=0;}return true;}
  const api = { endingLines,tickEnding,beginEnding,advanceEnding,performOperation,isStormDay, W, H, GRID, CHUNK, HOME, SHIP, EARTH_ALERT_DELAY, ASTRONAUT_NAME, todayWeather, earthDialogue, shipStations, roads, clamp, randomFor, getChunk, regionAt, cameraFor, shipCameraFor, shipWalkable, tasks, stations, freshState, normalizeState, walkable, nearestOpen, findPath, finishIntro, replayStory, enterShip, exitShip, contactEarth, advanceEarthCall, tickEarthSignal, earthStatus, tickOrbi, orbiNeedsAttention, playerName, preparationSteps, nextPreparation, canExitShip, eatMeal, drinkWater, checkWeather, emuParts:Training.emuParts, stormDecisions:Training.stormDecisions, scienceSources:Training.sources, emuComplete, canTrainEmu, learnEmuPart, placeEmuPart, stormComplete, canTrainStorm, reviewStormRecords, stormFeedback, chooseStormDecision, advanceStormDecision, flagLowSupplies, acknowledgeSupplies, recordVisit, collectSupplies, dayGoals, dayTitle, activeObjective, restStatus, startNextDay, weatherFor, beginOrbi, advanceOrbi, orbiDialogue, canComplete, complete };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NOVACore = api;
})(typeof window !== 'undefined' ? window : globalThis);
