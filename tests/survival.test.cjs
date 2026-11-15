const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../dist/core.js');
function crew(day=1){const s=C.freshState();C.finishIntro(s);s.survival.day=day;s.survival.food=100;s.survival.water=100;s.orbi.phase='complete';s.earthSignal.phase='lost';return s;}
function at(s,id){const st=C.stations.find(st=>st.id===id);s.location='surface';s.player={x:st.ax,y:st.ay};C.recordVisit(s,id);}
function prep(s,choice={modes:{greenhouse:'Normal',habitat:'Normal',emu:'Normal'},outdoor:true}){C.enterShip(s);C.eatMeal(s);C.acknowledgeSupplies(s);C.drinkWater(s);C.checkWeather(s);if(s.survival.day===1)for(const p of C.emuParts)C.placeEmuPart(s,p.id,p.id);C.Power.confirm(s,choice);}
test('energy death occurs at exactly zero, including fractional energy and save reloads',()=>{
 for(const activity of ['idle','walk','run']){
  const s=crew(5);s.energy=.001;
  assert.equal(C.tickSurvival(s,.001,activity),'');assert.ok(s.energy>0);assert.equal(s.death,null);
  assert.equal(C.tickSurvival(s,1,activity),'energy');assert.equal(s.energy,0);
  assert.equal(C.normalizeState(JSON.parse(JSON.stringify(s))).death.cause,'energy');
 }
 for(const cause of ['energy','hunger']){
  const s=crew(5);s.energy=.001;s.death={cause,day:5};
  assert.equal(C.normalizeState(s).death,null);
 }
});

test('daily tasks can complete in every order but sleep requires all of them',()=>{
 for(const order of [['rover','supplies','solar'],['supplies','solar','rover'],['solar','rover','supplies'],['solar','supplies','rover'],['supplies','rover','solar'],['rover','solar','supplies']]){
  let s=crew(6);prep(s);
  for(const id of order){
   assert.equal(C.restStatus(s).allowed,false);
   at(s,id==='supplies'?'storage':id);
   assert.equal(id==='supplies'?C.collectSupplies(s):C.performOperation(s,id),true);
   C.enterShip(s);s=C.normalizeState(JSON.parse(JSON.stringify(s)));
  }
  assert.ok(C.dayGoals(s).every(g=>g.done));assert.equal(C.startNextDay(s),true);
 }
});

test('indoor maintenance is available before preparation and in reverse order',()=>{
 const s=crew(3);
 for(const goal of C.dayGoals(s).reverse()){
  const station=C.shipStations.find(st=>st.id===goal.station);s.shipPlayer={x:station.ax,y:station.ay};
  assert.equal(C.performOperation(s,goal.id),true);
 }
 assert.ok(C.dayGoals(s).every(g=>g.done));assert.equal(C.startNextDay(s),false);
});
test('all fifteen days are reachable with real supplies and varied indoor and outdoor jobs',()=>{
 let s=crew();
 for(let day=1;day<=15;day++){
  assert.equal(s.survival.day,day);
  const outdoor=!C.isStormDay(day),choice={modes:{greenhouse:'Critical',habitat:'Critical',emu:'Normal'},outdoor};
  prep(s,choice);assert.equal(s.death,null,'Power on Day '+day);
  C.Power.confirm(s,choice);assert.equal(C.canExitShip(s),outdoor);
  assert.equal(C.tickSurvival(s,1),'','Survival on Day '+day);
  if(day===1){for(const id of ['storage','habitat','flag'])at(s,id);at(s,'storage');C.collectSupplies(s);}
  else if(day===2){C.reviewStormRecords(s);for(const q of C.stormDecisions){C.chooseStormDecision(s,q.choices.find(c=>c.correct).id);C.advanceStormDecision(s);}}
  else for(const goal of C.dayGoals(s)){
   if(goal.kind==='work'){
    const ship=C.shipStations.find(st=>st.id===goal.station);
    if(ship){C.enterShip(s);s.shipPlayer={x:ship.ax,y:ship.ay};}else at(s,goal.station);
    assert.equal(C.performOperation(s,goal.id),true,day+': '+goal.id);
   }else if(goal.id==='supplies'){at(s,'storage');assert.equal(C.collectSupplies(s),true);}
   else if(goal.id==='install-oxygen'){C.enterShip(s);assert.equal(C.performOperation(s,goal.id),true);}
   else {at(s,goal.station);if(['habitat','greenhouse'].includes(goal.station))s.location=goal.station;assert.equal(C.performOperation(s,goal.id.startsWith('check-')?goal.id.slice(6):goal.id),true,day+': '+goal.id);}
  }
  assert.ok(C.dayGoals(s).every(g=>g.done),'Day '+day+' objectives');
  if(s.survival.water<C.waterNeededForRest(s)){at(s,'crystals');assert.equal(C.performOperation(s,'collect-ice'),true);at(s,'habitat');s.location='habitat';while(s.operations.ice>0&&s.survival.water<100)assert.equal(C.performOperation(s,'process-ice'),true);}
  C.enterShip(s);
  if(day<15){assert.equal(C.startNextDay(s),true,'Rest on Day '+day);s=C.normalizeState(JSON.parse(JSON.stringify(s)));}
  else assert.equal(C.startNextDay(s),false);
 }
});
test('oxygen requires greenhouse collection, installation, and a finite reservoir transfer',()=>{
 const s=crew(5);s.oxygen=20;s.operations.oxygenReserve=0;s.location='habitat';
 C.performOperation(s,'oxygen');assert.equal(s.oxygen,20);
 s.location='greenhouse';assert.equal(C.performOperation(s,'collect-oxygen'),true);assert.equal(s.oxygen,20);
 assert.equal(C.performOperation(s,'collect-oxygen'),false);assert.equal(C.performOperation(s,'install-oxygen'),false);
 C.enterShip(s);assert.equal(C.performOperation(s,'refill-oxygen'),false);
 assert.equal(C.performOperation(s,'install-oxygen'),true);assert.equal(s.operations.canisters,0);
 assert.equal(C.performOperation(s,'refill-oxygen'),true);assert.equal(s.oxygen,100);assert.equal(s.operations.oxygenReserve,0);
 assert.equal(C.performOperation(s,'refill-oxygen'),false);
});
test('meals restore astronaut energy while ship power changes only through generation',()=>{
 const s=crew(6);s.energy=19;s.power=36;prep(s);assert.equal(s.energy,59);assert.equal(s.power,0);
 for(const id of ['solar','rover','greenhouse','crystals','habitat'])C.complete(s,id);
 assert.equal(s.energy,59);assert.equal(s.power,0);at(s,'solar');C.performOperation(s,'solar');at(s,'rover');C.performOperation(s,'rover');at(s,'storage');C.collectSupplies(s);C.enterShip(s);
 assert.equal(C.startNextDay(s),true);assert.equal(s.energy,49);assert.equal(s.power,0);
});
test('final fieldwork recalls the astronaut only on Day 15 and the terminal plays every supplied line',()=>{
 let s=crew(14);assert.equal(C.tickEnding(s,20,true),'');s.survival.day=15;
 assert.equal(C.tickEnding(s,20,true),'');assert.equal(s.ending.phase,'dormant');
 at(s,'flag');assert.equal(C.performOperation(s,'beacon'),true);assert.equal(C.tickEnding(s,20,true),'');
 at(s,'rover');assert.equal(C.performOperation(s,'rover'),true);
 assert.equal(C.tickEnding(s,20,false),'');assert.equal(C.tickEnding(s,7,true),'');assert.equal(C.tickEnding(s,1,true),'recall');
 at(s,'rover');assert.equal(C.beginEnding(s),false);C.enterShip(s);assert.equal(C.beginEnding(s),true);
 for(let i=0;i<C.endingLines.length;i++){assert.equal(s.ending.step,i);s=C.normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(C.advanceEnding(s),true);}
 assert.equal(s.ending.phase,'zoom');assert.equal(C.tickEarthSignal(s,10),'');assert.equal(s.earthSignal.phase,'connected');
 assert.equal(C.tickEnding(s,6,false),'');assert.equal(C.tickEnding(s,1,false),'complete');
 assert.equal(C.normalizeState(s).ending.phase,'complete');assert.equal(C.tickEnding(s,10,true),'');assert.equal(C.startNextDay(s),false);
});
