const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/core.js'),G=C.Greenhouse,P=C.Power;
function crew(day=1){const s=C.freshState();C.finishIntro(s);s.orbi.phase='complete';s.earthSignal.phase='lost';s.survival.day=day;s.survival.water=100;s.solarClean=true;return s;}
function power(s,mode='Normal'){s.power=100;P.confirm(s,{modes:{greenhouse:mode,habitat:'Reduced',emu:'Reduced'},outdoor:false});}

test('arrival has three established romaine trays and growth takes weeks',()=>{
  const s=crew();assert.deepEqual(s.greenhouse.trays.map(t=>t.age),[30,26,22]);
  assert.deepEqual(s.greenhouse.trays.map(G.stage),['Leafy rosette','Leafy rosette','Young leaves']);
  const t=s.greenhouse.trays[0];t.age=0;
  for(let day=1;day<=15;day++){s.survival.day=day;power(s);s.greenhouse.water=s.greenhouse.nutrients=100;P.settle(s);}
  assert.equal(t.age,15);assert.equal(G.ready(s.greenhouse,t),false);
});
test('each Sol consumes resources once; reload and repeated settlement cannot speed growth',()=>{
  let s=crew();power(s);P.settle(s);assert.equal(s.greenhouse.water,68);assert.equal(s.greenhouse.nutrients,72);
  const saved=JSON.stringify(s.greenhouse);P.settle(s);assert.equal(JSON.stringify(s.greenhouse),saved);
  s=C.normalizeState(JSON.parse(JSON.stringify(s)));P.settle(s);assert.equal(JSON.stringify(s.greenhouse),saved);
});
test('water and mineral shortages halt growth and lower plant health',()=>{
  for(const resource of ['water','nutrients']){
    const s=crew();power(s);s.greenhouse[resource]=0;const age=s.greenhouse.trays[0].age;
    P.settle(s);assert.equal(s.greenhouse.trays[0].age,age);assert.ok(s.greenhouse.health<100);
  }
});
test('storm solar shortage damages plants; safe cleaning and power restore light and growth',()=>{
  const s=crew(2);s.power=0;s.solarClean=false;
  P.confirm(s,{modes:{greenhouse:'Normal',habitat:'Normal',emu:'Normal'},outdoor:false});
  assert.equal(G.light(s),0);P.settle(s);const health=s.greenhouse.health;
  s.location='surface';const st=C.stations.find(v=>v.id==='solar');s.player={x:st.ax,y:st.ay};
  assert.equal(C.performOperation(s,'solar'),false);
  s.survival.day=5;const dusty=P.project(s).generation;
  assert.equal(C.performOperation(s,'solar'),true);assert.ok(P.project(s).generation>dusty);
  C.enterShip(s);power(s);assert.equal(G.light(s),100);P.settle(s);
  assert.ok(s.greenhouse.health>health);assert.ok(s.greenhouse.report.growth>0);
});
test('remote care spends finite supplies, prevents overfeeding, and works during shelter',()=>{
  const s=crew(3);s.greenhouse.water=20;s.greenhouse.nutrients=20;
  assert.equal(G.care(s,'water'),true);assert.equal(s.survival.water,95);assert.equal(s.greenhouse.water,60);
  assert.equal(G.care(s,'water'),true);assert.equal(s.greenhouse.water,100);assert.equal(G.care(s,'water'),false);
  assert.equal(G.care(s,'nutrients'),true);assert.equal(s.greenhouse.packets,5);
  s.greenhouse.packets=0;assert.equal(G.care(s,'nutrients'),false);
  s.greenhouse.water=20;s.survival.water=4;assert.equal(G.care(s,'water'),false);
  s.location='surface';assert.equal(G.care(s,'inspect'),false);
});
test('only mature healthy trays yield food once, sowing uses stored seeds and resets age',()=>{
  const s=crew(7),t=s.greenhouse.trays[0];s.survival.food=20;
  assert.equal(G.care(s,'harvest',0),false);s.location='greenhouse';
  assert.equal(G.care(s,'harvest',0),false);t.age=35;s.greenhouse.health=30;
  assert.equal(G.care(s,'harvest',0),false);s.greenhouse.health=80;
  assert.equal(G.care(s,'harvest',0),true);assert.equal(s.survival.food,36);
  assert.equal(G.care(s,'harvest',0),false);assert.equal(G.stage(t),'Empty tray');
  const seeds=s.operations.seeds;assert.equal(G.care(s,'plant',0),true);
  assert.equal(s.operations.seeds,seeds-1);assert.equal(t.age,0);assert.equal(G.stage(t),'Germinating');
  assert.equal(G.care(s,'plant',0),false);
});
test('inspection objectives never require an unready or neglected crop to be harvested',()=>{
  for(const day of [7,10,14]){
    const s=crew(day);s.greenhouse.health=0;
    assert.equal(C.dayGoals(s).some(v=>['harvest','plant'].includes(v.id)),false);
    assert.equal(C.performOperation(s,'greenhouse-care'),true);
    assert.equal(C.dayGoals(s).find(v=>v.id==='greenhouse-care').done,true);
  }
});
test('legacy and malformed saves receive safe greenhouse state; care survives reload',()=>{
  const s=crew();delete s.greenhouse;assert.deepEqual(C.normalizeState(s).greenhouse,G.fresh());
  assert.deepEqual(G.normalize(null),G.fresh());
  const g=G.normalize({water:-40,nutrients:Infinity,health:500,packets:999,trays:[null,{age:-100},{}]});
  assert.equal(g.water,0);assert.equal(g.nutrients,80);assert.equal(g.health,100);assert.equal(g.packets,6);assert.equal(g.trays[1].age,0);
  const p=crew();p.greenhouse.water=25;G.care(p,'water');
  assert.deepEqual(C.normalizeState(JSON.parse(JSON.stringify(p))).greenhouse,p.greenhouse);
});
test('a pre-existing tray matures through care while its replacement remains a young plant',()=>{
  const s=crew(),t=s.greenhouse.trays[0];
  for(let day=1;day<=5;day++){
    s.survival.day=day;power(s);G.care(s,'water');G.care(s,'nutrients');
    assert.equal(G.ready(s.greenhouse,t),false);P.settle(s);
  }
  assert.equal(G.ready(s.greenhouse,t),true);s.location='greenhouse';
  assert.equal(G.care(s,'harvest',0),true);assert.equal(G.care(s,'plant',0),true);
  for(let day=6;day<=15;day++){
    s.survival.day=day;s.survival.water=100;power(s);G.care(s,'water');G.care(s,'nutrients');P.settle(s);
  }
  assert.ok(t.age<=10);assert.equal(G.ready(s.greenhouse,t),false);
});
test('both browser entry pages load the greenhouse dependency before power and core',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  for(const file of ['index.html','game.html']){
    const context=vm.createContext({window:{}}),base=path.join(__dirname,'../dist');
    const html=fs.readFileSync(path.join(base,file),'utf8');
    for(const [,src]of html.matchAll(/<script src="([^"]+)"/g))if(['training-model.js','greenhouse-model.js','power-model.js','core.js'].includes(src))vm.runInContext(fs.readFileSync(path.join(base,src),'utf8'),context);
    const core=context.window.NOVACore,s=core.freshState();core.finishIntro(s);s.orbi.phase='complete';
    assert.equal(s.greenhouse.trays.length,3);s.power=100;
    context.window.NOVAPower.confirm(s,{modes:{greenhouse:'Normal',habitat:'Reduced',emu:'Reduced'},outdoor:false});
    context.window.NOVAPower.settle(s);assert.equal(s.greenhouse.trays[0].age,31);
  }
});
