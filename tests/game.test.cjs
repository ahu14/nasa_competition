const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/core.js');

test('the expedition enforces prerequisites and completes all five missions', () => {
  const s = C.freshState();
  assert.equal(C.complete(s, 'rocket'), false);
  assert.equal(C.complete(s, 'greenhouse'), false);
  assert.equal(C.complete(s, 'habitat'), false);
  assert.equal(C.complete(s, 'solar'), true);
  assert.equal(s.energy, 100);
  C.complete(s, 'greenhouse');
  assert.equal(s.oxygen, 100);
  assert.equal(C.complete(s, 'habitat'), false);
  C.complete(s, 'crystals');
  assert.equal(s.samples, 3);
  C.complete(s, 'habitat');
  C.complete(s, 'rocket');
  assert.equal(C.tasks.filter(t => s.tasks[t.id]).length, 5);
});
test('revisiting discoveries never duplicates rewards; life support can refill oxygen', () => {
  const s = C.freshState();
  C.complete(s, 'crystals'); C.complete(s, 'crystals');
  C.complete(s, 'rover'); C.complete(s, 'rover');
  assert.equal(s.samples, 5);
  C.complete(s, 'solar'); C.complete(s, 'greenhouse'); s.oxygen = 30;
  C.complete(s, 'greenhouse'); assert.equal(s.oxygen, 100);
});
test('every station has a reachable approach from spawn, with no blocked path nodes', () => {
  const start = C.freshState().player;
  for (const s of C.stations) {
    assert.ok(C.walkable(s.ax, s.ay), `${s.id} approach is walkable`);
    const route = C.findPath(start, { x: s.ax, y: s.ay });
    assert.ok(route.length, `${s.id} route exists`);
    for (const p of route) assert.ok(C.walkable(p.x, p.y), `${s.id} path stays on open ground`);
    assert.ok(Math.hypot(route.at(-1).x - s.x, route.at(-1).y - s.y) < s.radius, `${s.id} approach enables interaction`);
  }
});
test('navigation routes around the crater rather than crossing it', () => {
  let crater;
  for (let x=10;x<30 && !crater;x++) crater = C.getChunk(x,15).objects.find(o=>o.type==='crater');
  assert.ok(crater);
  const from=C.nearestOpen(crater.x-crater.rx-80,crater.y), to=C.nearestOpen(crater.x+crater.rx+80,crater.y);
  const route = C.findPath(from,to);
  assert.ok(route.length);
  assert.ok(route.some(p => Math.abs(p.y-crater.y) >= crater.ry));
  assert.ok(route.every(p => C.walkable(p.x, p.y)));
});
test('all consecutive mission destinations connect', () => {
  let from = C.freshState().player;
  for (const task of C.tasks) {
    const s = C.stations.find(s => s.id === task.id), dest = { x: s.ax, y: s.ay };
    assert.ok(C.findPath(from, dest).length, `${task.id} is reachable from previous mission`);
    from = dest;
  }
});
test('corrupt saves cannot place the player inside obstacles or bypass prerequisites', () => {
  const habitat=C.stations.find(s=>s.id==='habitat');
  const s = C.normalizeState({ version: 1, oxygen: -50, energy: Infinity, samples: 999, player: { x: habitat.x, y: habitat.y-100 }, tasks: { rocket: true, habitat: true, greenhouse: true } });
  assert.equal(s.oxygen, 0); assert.equal(s.energy, 72); assert.equal(s.samples, 100);
  assert.ok(C.walkable(s.player.x, s.player.y));
  assert.equal(s.tasks.greenhouse, false); assert.equal(s.tasks.habitat, false); assert.equal(s.tasks.rocket, false);
  assert.deepEqual(C.normalizeState(null), C.freshState());
});
test('completed progress survives a JSON save round trip', () => {
  const s = C.freshState(); for (const t of C.tasks) C.complete(s, t.id);
  C.complete(s, 'flag'); C.complete(s, 'rover');
  assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(s))), s);
});

test('the world continues beyond all four edges of the original artwork', () => {
  const start = C.freshState().player;
  for (const point of [{ x: -1000, y: 596 }, { x: 2800, y: 596 }, { x: 780, y: -1400 }, { x: 780, y: 2200 }]) {
    const dest = C.nearestOpen(point.x, point.y), route = C.findPath(start, dest);
    assert.ok(route.length, `route to ${point.x},${point.y} exists`);
    assert.ok(Math.hypot(route.at(-1).x - dest.x, route.at(-1).y - dest.y) < 1);
    assert.ok(route.every(p => C.walkable(p.x, p.y)));
  }
});

test('generated scenery is stable after chunks are evicted and revisited', () => {
  const original = JSON.stringify(C.getChunk(-10, 23));
  for (let i = 0; i < 200; i++) C.getChunk(i * 3, -i * 5);
  assert.equal(JSON.stringify(C.getChunk(-10, 23)), original);
  assert.notEqual(JSON.stringify(C.getChunk(-11, 23)), original);
  assert.ok(C.getChunk(-10, 23).objects.length > 0);
});

test('camera follows the player without clamping to the outpost or fitting the whole map', () => {
  const a = C.cameraFor({ x: 780, y: 596 }, 1440, 810);
  const b = C.cameraFor({ x: -10000, y: 20000 }, 1440, 810);
  assert.ok(1440 / a.scale < C.W); assert.ok(810 / a.scale < C.H);
  assert.equal(b.x - a.x, -10780); assert.equal(b.y - a.y, 19404);
  assert.ok(b.x < 0); assert.ok(b.y > C.H);
  assert.ok(C.cameraFor({ x: 0, y: 0 }, 1440, 810, 1.5).scale > a.scale);
});

test('distant and negative saved positions survive reload', () => {
  for (const point of [{ x: -9000, y: -6000 }, { x: 90000, y: 80000 }]) {
    const s = C.freshState(); s.player = C.nearestOpen(point.x, point.y);
    assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(s))).player, s.player);
  }
});

test('pathfinding avoids generated obstacles outside the base', () => {
  const chunk = C.getChunk(-10, 23), obstacle = chunk.objects[0];
  assert.equal(C.walkable(obstacle.x, obstacle.y), false);
  const from = C.nearestOpen(obstacle.x - 180, obstacle.y), to = C.nearestOpen(obstacle.x + 180, obstacle.y);
  const route = C.findPath(from, to);
  assert.ok(route.length);
  assert.ok(route.every(p => C.walkable(p.x, p.y)));
  let previous = from;
  for (const next of route) {
    const steps = Math.ceil(Math.hypot(next.x - previous.x, next.y - previous.y) / 3);
    for (let i = 0; i <= steps; i++) assert.ok(C.walkable(previous.x + (next.x - previous.x) * i / Math.max(1, steps), previous.y + (next.y - previous.y) * i / Math.max(1, steps)), 'route segments avoid obstacles between grid cells');
    previous = next;
  }
});

test('every station is separated from every other station by a substantial travel gap', () => {
  for(let i=0;i<C.stations.length;i++) for(let j=i+1;j<C.stations.length;j++) {
    const a=C.stations[i],b=C.stations[j];
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=1800,`${a.id} and ${b.id} have at least 1800 units between them`);
    assert.ok(a.bounds.right+600 < b.bounds.left || b.bounds.right+600 < a.bounds.left || a.bounds.bottom+600 < b.bounds.top || b.bounds.bottom+600 < a.bounds.top,`${a.id} and ${b.id} have open space between their structures`);
  }
});

test('station collision areas move with their buildings and their approaches remain open', () => {
  const points={solar:[-100,-80],greenhouse:[0,-100],crystals:[10,-10],habitat:[0,-100],rocket:[3,-90],rover:[11,-35],flag:[0,0]};
  for(const s of C.stations) {
    const [dx,dy]=points[s.id];
    assert.equal(C.walkable(s.x+dx,s.y+dy),false,`${s.id} structure blocks movement at its new position`);
    assert.equal(C.walkable(s.ax,s.ay),true,`${s.id} entrance stays accessible`);
  }
});

test('roads connect home to all remote station entrances without scenery blocking them', () => {
  for(const road of C.roads) for(let i=1;i<road.length;i++) {
    const a=road[i-1],b=road[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/15);
    for(let j=0;j<=steps;j++)assert.ok(C.walkable(a.x+(b.x-a.x)*j/Math.max(1,steps),a.y+(b.y-a.y)*j/Math.max(1,steps)),'road stays open through the generated terrain');
  }
});

test('relocating stations preserves saved mission progress and rescues blocked old positions', () => {
  const s=C.freshState(),habitat=C.stations.find(s=>s.id==='habitat');
  C.complete(s,'solar'); C.complete(s,'greenhouse');
  s.player={x:habitat.x,y:habitat.y-100};
  const restored=C.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.tasks.solar,true);assert.equal(restored.tasks.greenhouse,true);
  assert.deepEqual(restored.player,C.HOME);
});
