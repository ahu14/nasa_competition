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

test('new expeditions begin with the awakening scene',()=>{
  const s=C.freshState();assert.equal(s.introComplete,false);assert.equal(s.introStep,0);
});

test('story progress survives reload and invalid line numbers are normalized',()=>{
  const s=C.freshState();s.introStep=2;
  assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(s))),s);
  assert.equal(C.normalizeState({...s,introStep:999}).introStep,3);
  assert.equal(C.normalizeState({...s,introStep:-12}).introStep,0);
  assert.equal(C.normalizeState({...s,introStep:NaN}).introStep,0);
});

test('the introduction ends in the explorable cabin with the surface exit ready',()=>{
  const s=C.freshState();s.oxygen=83;C.complete(s,'solar');
  C.finishIntro(s);const rocket=C.stations.find(s=>s.id==='rocket');
  assert.equal(s.introComplete,true);assert.equal(s.introStep,3);
  assert.equal(s.location,'ship');assert.deepEqual(s.shipPlayer,C.SHIP.spawn);
  assert.deepEqual(s.player,{x:rocket.ax,y:rocket.ay});assert.ok(C.walkable(s.player.x,s.player.y));
  assert.equal(s.tasks.solar,true);assert.equal(s.oxygen,83);
  assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(s))),s);
});

test('all spaceship areas are reachable from the sleep pod and the airlock',()=>{
  for(const from of [C.SHIP.spawn,C.SHIP.entrance])for(const station of C.shipStations){
    assert.ok(C.shipWalkable(station.ax,station.ay),`${station.id} has an open approach`);
    const route=C.findPath(from,{x:station.ax,y:station.ay},'ship');
    assert.ok(route.length,`${station.id} can be reached inside the cabin`);
    assert.ok(route.every(p=>C.shipWalkable(p.x,p.y)));
    assert.ok(Math.hypot(route.at(-1).x-station.x,route.at(-1).y-station.y)<station.radius);
  }
});

test('spaceship walls and furniture block movement',()=>{
  for(const [x,y] of [[0,0],[1101,500],[550,240],[550,800],[375,450],[180,390],[830,400],[830,500],[180,580]])assert.equal(C.shipWalkable(x,y),false);
  assert.ok(C.shipWalkable(C.SHIP.spawn.x,C.SHIP.spawn.y));
  assert.ok(C.shipWalkable(C.SHIP.entrance.x,C.SHIP.entrance.y));
});

test('the astronaut can leave and re-enter the spaceship repeatedly without resetting progress',()=>{
  const s=C.freshState(),rocket=C.stations.find(s=>s.id==='rocket');
  C.finishIntro(s);C.complete(s,'solar');C.contactEarth(s);s.samples=4;
  for(let i=0;i<3;i++){
    C.exitShip(s);assert.equal(s.location,'surface');assert.deepEqual(s.player,{x:rocket.ax,y:rocket.ay});assert.ok(C.walkable(s.player.x,s.player.y));
    C.enterShip(s);assert.equal(s.location,'ship');assert.deepEqual(s.shipPlayer,C.SHIP.entrance);assert.ok(C.shipWalkable(s.shipPlayer.x,s.shipPlayer.y));
    assert.equal(s.tasks.solar,true);assert.equal(s.earthContacted,true);assert.equal(s.samples,4);assert.equal(s.introComplete,true);
  }
});

test('interior position and Earth contact survive saving and reloading',()=>{
  const s=C.freshState();C.finishIntro(s);s.shipPlayer={x:830,y:560};C.contactEarth(s);
  assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(s))),s);
  const repaired=C.normalizeState({...s,shipPlayer:{x:375,y:450}});assert.deepEqual(repaired.shipPlayer,C.SHIP.spawn);assert.equal(repaired.earthContacted,true);
});

test('Earth can be contacted only from the explorable ship and never duplicates mission rewards',()=>{
  const s=C.freshState();assert.equal(C.contactEarth(s),false);C.finishIntro(s);
  const tasks={...s.tasks},samples=s.samples;
  assert.equal(C.contactEarth(s),true);assert.equal(C.contactEarth(s),true);assert.equal(s.earthContacted,true);
  assert.deepEqual(s.tasks,tasks);assert.equal(s.samples,samples);
  C.exitShip(s);assert.equal(C.contactEarth(s),false);
});

test('older completed-introduction saves resume on the surface',()=>{
  const s=C.freshState();s.introComplete=true;delete s.location;delete s.shipPlayer;delete s.earthContacted;
  const restored=C.normalizeState(s);assert.equal(restored.location,'surface');assert.deepEqual(restored.player,s.player);assert.equal(restored.earthContacted,false);
});

test('the spaceship camera follows the character within a finite cabin on all screen sizes',()=>{
  for(const [w,h] of [[1440,1000],[390,844],[844,390]])for(const p of [C.SHIP.spawn,{x:950,y:700}]){
    const camera=C.shipCameraFor(p,w,h);assert.ok(Number.isFinite(camera.x)&&Number.isFinite(camera.y)&&camera.scale>0);
    const x=(p.x-camera.x)*camera.scale,y=(p.y-camera.y)*camera.scale;
    assert.ok(x>=0&&x<=w&&y>=0&&y<=h);
  }
});

test('older saves receive the opening scene without losing their expedition',()=>{
  const s=C.freshState();C.complete(s,'solar');C.complete(s,'greenhouse');s.seconds=240;s.samples=3;
  delete s.introComplete;delete s.introStep;
  const restored=C.normalizeState(s);
  assert.equal(restored.introComplete,false);assert.equal(restored.introStep,0);
  assert.equal(restored.tasks.solar,true);assert.equal(restored.tasks.greenhouse,true);assert.equal(restored.samples,3);assert.equal(restored.seconds,240);
});

test('an incoming Earth call waits until after waking and four seconds spent inside',()=>{
  let s=C.freshState();
  assert.equal(C.tickEarthSignal(s,20),'');assert.equal(s.earthSignal.elapsed,0);
  C.finishIntro(s);assert.equal(C.tickEarthSignal(s,2),'');
  s=C.normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(s.earthSignal.elapsed,2);
  C.exitShip(s);assert.equal(C.tickEarthSignal(s,100),'');assert.equal(s.earthSignal.elapsed,2);
  C.enterShip(s);assert.equal(C.tickEarthSignal(s,1.9),'');assert.equal(s.earthSignal.phase,'waiting');
  assert.equal(C.tickEarthSignal(s,.2),'incoming');assert.equal(C.earthStatus(s),'INCOMING!');
  assert.equal(C.tickEarthSignal(s,100),'');assert.equal(s.earthContacted,false);
  assert.equal(Object.values(s.tasks).some(Boolean),false);assert.equal(s.samples,0);
});

test('the rescue promise waits for the player, then the final reply fails and disconnects',()=>{
  let s=C.freshState();C.finishIntro(s);C.tickEarthSignal(s,4);C.contactEarth(s);
  assert.equal(C.earthStatus(s),'CONNECTED');assert.equal(s.earthSignal.line,0);
  C.advanceEarthCall(s);C.advanceEarthCall(s);
  assert.equal(s.earthSignal.rescueDays,15);assert.match(C.earthDialogue[s.earthSignal.line].text,/about 15 days/);
  assert.equal(C.tickEarthSignal(s,999),'');assert.equal(s.earthSignal.phase,'connected');
  s=C.normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(s.earthSignal.line,2);
  C.advanceEarthCall(s);C.advanceEarthCall(s);assert.equal(C.advanceEarthCall(s),false);
  assert.equal(C.tickEarthSignal(s,1),'');
  s=C.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(C.tickEarthSignal(s,.5),'error');assert.equal(C.earthStatus(s),'SYSTEM ERROR');
  assert.equal(C.tickEarthSignal(s,1.5),'lost');assert.equal(C.earthStatus(s),'SIGNAL LOST');
  assert.equal(s.location,'ship');assert.equal(s.earthContacted,true);assert.equal(s.earthSignal.rescueDays,15);
  assert.equal(C.contactEarth(s),false);assert.equal(C.advanceEarthCall(s),false);
  C.exitShip(s);C.enterShip(s);assert.equal(C.tickEarthSignal(s,999),'');
  assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(s))),s);
});

test('older expedition saves gain the incoming story and corrupted signal fields are repaired',()=>{
  const s=C.freshState();C.finishIntro(s);C.complete(s,'solar');C.complete(s,'crystals');s.earthContacted=true;
  delete s.earthSignal;
  const restored=C.normalizeState(s);assert.equal(restored.earthSignal.phase,'waiting');
  assert.equal(restored.tasks.solar,true);assert.equal(restored.tasks.crystals,true);assert.equal(restored.samples,3);assert.equal(restored.location,'ship');
  assert.equal(C.normalizeState({...s,earthSignal:{phase:'unknown'}}).earthSignal.phase,'waiting');
  const repaired=C.normalizeState({...s,earthSignal:{phase:'lost',elapsed:Infinity,line:-9,faultElapsed:NaN,rescueDays:-15}});
  assert.equal(repaired.earthSignal.line,C.earthDialogue.length-1);assert.equal(repaired.earthSignal.rescueDays,15);
  assert.equal(repaired.earthSignal.faultElapsed,0);assert.equal(repaired.earthSignal.elapsed,0);
  for(const dt of [NaN,Infinity,-1,0])assert.equal(C.tickEarthSignal(restored,dt),'');
  assert.equal(restored.earthSignal.elapsed,0);
});

test('ORBI stays asleep until Earth disconnects and wakes without revealing the name early',()=>{
  const s=C.freshState();assert.equal(C.playerName(s),'???');assert.equal(C.beginOrbi(s),false);
  C.finishIntro(s);assert.equal(C.beginOrbi(s),false);assert.equal(C.tickOrbi(s,20),'');
  C.contactEarth(s);for(let i=0;i<4;i++)C.advanceEarthCall(s);
  C.tickEarthSignal(s,1.5);C.tickEarthSignal(s,1.5);
  assert.equal(s.orbi.phase,'booting');assert.equal(C.orbiNeedsAttention(s),false);
  C.exitShip(s);assert.equal(C.tickOrbi(s,20),'');assert.equal(s.orbi.elapsed,0);
  C.enterShip(s);assert.equal(C.tickOrbi(s,1),'');
  const restored=C.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(C.tickOrbi(restored,1),'orbi-ready');assert.equal(C.orbiNeedsAttention(restored),true);
  assert.equal(C.playerName(restored),'???');assert.equal(C.tickOrbi(restored,20),'');
});

test('ORBI reveals the astronaut name, remembers either reply, and gives the actual next task',()=>{
  for(const reply of ['', 'tasks']){
    let s=C.freshState();C.finishIntro(s);s.earthSignal.phase='lost';s=C.normalizeState(s);
    C.complete(s,'solar');const originalTasks={...s.tasks};
    assert.equal(C.beginOrbi(s),true);assert.equal(C.playerName(s),C.ASTRONAUT_NAME);
    assert.match(C.orbiDialogue(s).text,new RegExp(`Morning, ${C.ASTRONAUT_NAME}`));
    C.advanceOrbi(s,reply);assert.equal(s.orbi.response,reply);
    s=C.normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(s.orbi.step,1);assert.equal(s.orbi.nameKnown,true);
    assert.match(C.orbiDialogue(s).text,new RegExp(`You’re ${C.ASTRONAUT_NAME}`));
    C.advanceOrbi(s);assert.match(C.orbiDialogue(s).text,/15 days/);
    C.advanceOrbi(s);assert.match(C.orbiDialogue(s).text,/bring the greenhouse to life/);
    C.advanceOrbi(s);assert.equal(s.orbi.phase,'complete');assert.equal(C.orbiNeedsAttention(s),false);
    assert.deepEqual(s.tasks,originalTasks);assert.equal(C.advanceOrbi(s),false);
    C.exitShip(s);assert.equal(C.beginOrbi(s),false);C.enterShip(s);assert.equal(C.beginOrbi(s),true);
    assert.match(C.orbiDialogue(s).text,/Welcome back/);assert.equal(s.orbi.phase,'complete');
    assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(s))),s);
  }
});

test('existing disconnected saves receive ORBI, and invalid companion saves cannot reveal a name early',()=>{
  const s=C.freshState();C.finishIntro(s);s.earthSignal.phase='lost';delete s.orbi;C.complete(s,'solar');
  const migrated=C.normalizeState(s);assert.equal(migrated.orbi.phase,'pending');assert.equal(migrated.tasks.solar,true);
  assert.equal(C.playerName(migrated),'???');
  const bad=C.normalizeState({...s,orbi:{phase:'talking',step:Infinity,elapsed:-20,nameKnown:false,response:'invalid'}});
  assert.equal(bad.orbi.step,0);assert.equal(bad.orbi.elapsed,0);assert.equal(bad.orbi.nameKnown,true);assert.equal(bad.orbi.response,'');
  const tooEarly=C.normalizeState({...s,earthSignal:{phase:'waiting'},orbi:{phase:'complete',step:3,nameKnown:true}});
  assert.equal(tooEarly.orbi.phase,'locked');assert.equal(C.playerName(tooEarly),'???');
});
