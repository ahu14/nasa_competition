/* The simulation is independent of the renderer so saves and navigation can be verified. */
(function (root) {
  'use strict';
  // W/H describe the original outpost artwork, not the limits of the world.
  const W = 1600, H = 900, GRID = 20, CHUNK = 512;
  const HOME = { x: 780, y: 596 };
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
    return { version: 1, tasks: Object.fromEntries(tasks.map(t => [t.id, false])), oxygen: 98, energy: 72, samples: 0, rover: false, flag: false, seconds: 0, player: { ...HOME } };
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
  function nearestOpen(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...HOME };
    if (walkable(x, y)) return { x, y };
    for (let r = 20; r < 400; r += 20) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (walkable(px, py)) return { x: px, y: py };
      }
    }
    return { ...HOME };
  }
  function findPath(start, goal) {
    const dest = nearestOpen(goal.x, goal.y);
    const segmentClear = (a, b) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let i = 0; i <= steps; i++) if (!walkable(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
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
    const valid = p => p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.top && p.y <= bounds.bottom && walkable(p.x * GRID, p.y * GRID);
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
  const api = { W, H, GRID, CHUNK, HOME, roads, clamp, randomFor, getChunk, regionAt, cameraFor, tasks, stations, freshState, normalizeState, walkable, nearestOpen, findPath, canComplete, complete };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NOVACore = api;
})(typeof window !== 'undefined' ? window : globalThis);
