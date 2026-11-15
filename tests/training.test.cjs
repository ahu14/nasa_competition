const test=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/core.js');
const D=require('../dist/donki.js'),fs=require('node:fs');
const archive=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/nasa/donki-snapshot.json'),'utf8')).historical;
function crew(day=1){let s=C.freshState();C.finishIntro(s);s.earthSignal.phase='lost';s.orbi={phase:'complete',step:3,nameKnown:true,elapsed:2,response:''};s.survival.day=day;s.survival.food=100;s.survival.water=100;return C.normalizeState(s);}
function prep(s){C.eatMeal(s);C.drinkWater(s);C.checkWeather(s);C.Power.confirm(s,{modes:{greenhouse:'Critical',habitat:'Critical',emu:'Critical'},outdoor:true});}

test('ORBI and storm training use the current Sol and next Sol on every storm day',()=>{
  const context={window:{}};require('node:vm').runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/training.js'),'utf8'),context);
  const html=s=>context.window.MissionTraining.prototype.stormHtml.call({C,recordsHtml:()=>''},s);
  for(const day of [2,3,4,9,12,13]){
    let s=crew(day);prep(s);s=C.normalizeState(JSON.parse(JSON.stringify(s)));
    assert.match(C.orbiDialogue(s).text,new RegExp('Day '+day+' is a shelter day'));
    assert.doesNotMatch(C.orbiDialogue(s).text,/airlock stays locked/);
    assert.match(html(s),new RegExp('SHELTER ADVISED ON DAY '+day+'<'));
    C.reviewStormRecords(s);for(const q of C.stormDecisions){C.chooseStormDecision(s,q.choices.find(c=>c.correct).id);C.advanceStormDecision(s);}
    assert.match(html(s),new RegExp('begin Day '+(day+1)+'[.]'));
  }
});

test('the EMU lesson can precede preparation and requires every component role',()=>{
  let s=crew();assert.equal(C.canExitShip(s),false);assert.equal(C.canTrainEmu(s),true);
  prep(s);assert.equal(C.nextPreparation(s).id,'emu');assert.equal(C.canExitShip(s),false);
  assert.equal(C.placeEmuPart(s,'helmet','plss'),false);assert.deepEqual(s.training.emu.placed,[]);
  for(const part of C.emuParts){assert.equal(C.learnEmuPart(s,part.id),true);assert.equal(C.placeEmuPart(s,part.id,part.id),true);assert.equal(C.placeEmuPart(s,part.id,part.id),false);}
  assert.equal(C.emuComplete(s),true);C.Power.confirm(s,{modes:s.powerPlan.modes,outdoor:true});assert.equal(C.canExitShip(s),true);assert.equal(C.nextPreparation(s),undefined);
  s=C.normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(C.emuComplete(s),true);C.exitShip(s);assert.equal(s.location,'surface');assert.equal(C.placeEmuPart(s,'fake','fake'),false);
});

test('matching progress saves midway and replay resets training without clearing mission rewards',()=>{
  let s=crew();prep(s);C.placeEmuPart(s,'cooling','cooling');s=C.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(s.training.emu.placed,['cooling']);assert.equal(C.emuComplete(s),false);
  C.complete(s,'solar');C.replayStory(s);assert.deepEqual(s.training.emu.placed,[]);assert.equal(s.training.storm.reviewed,false);assert.equal(s.tasks.solar,true);
});

test('Day 2 permits departure while the storm drill still guides safe indoor work',()=>{
  const s=crew(2);C.Power.confirm(s,{modes:s.powerPlan.modes,outdoor:true});assert.equal(C.canExitShip(s),true);assert.equal(C.reviewStormRecords(s),true);prep(s);
  assert.equal(C.weatherFor(2).storm,true);assert.equal(C.nextPreparation(s),undefined);C.Power.confirm(s,{modes:s.powerPlan.modes,outdoor:true});assert.equal(C.canExitShip(s),true);assert.ok(C.exitShip(s));C.enterShip(s);
  assert.equal(C.dayGoals(s).some(g=>g.station==='solar'),false);assert.equal(C.orbiNeedsAttention(s),true);
  C.reviewStormRecords(s);
  for(const question of C.stormDecisions){C.chooseStormDecision(s,question.choices.find(c=>c.correct).id);assert.equal(C.advanceStormDecision(s),true);}
  assert.equal(C.stormComplete(s),true);C.Power.confirm(s,{modes:s.powerPlan.modes,outdoor:true});assert.equal(C.canExitShip(s),true);assert.equal(C.restStatus(s).allowed,true);
  assert.equal(C.startNextDay(s),true);assert.equal(s.survival.day,3);assert.equal(C.dayGoals(s)[0].station,'ship-support');assert.equal(s.orbi.nameKnown,true);assert.equal(s.preparation.weatherChecked,false);
  for(const day of [3,4]){prep(s);C.Power.confirm(s,{modes:s.powerPlan.modes,outdoor:true});assert.equal(C.canExitShip(s),true);for(const job of C.dayGoals(s)){const st=C.shipStations.find(st=>st.id===job.station);s.shipPlayer={x:st.ax,y:st.ay};assert.equal(C.performOperation(s,job.id),true);}assert.equal(C.startNextDay(s),true);}prep(s);assert.equal(s.survival.day,5);C.Power.confirm(s,{modes:s.powerPlan.modes,outdoor:true});assert.equal(C.canExitShip(s),true);
});

test('unsafe decisions have scientific feedback and cannot advance until revised',()=>{
  let s=crew(2);prep(s);assert.equal(C.chooseStormDecision(s,'shelter'),null);assert.equal(C.advanceStormDecision(s),false);C.reviewStormRecords(s);
  const wrong=C.chooseStormDecision(s,'suit');assert.equal(wrong.correct,false);assert.match(wrong.science,/EMU/);assert.match(wrong.source,/nasa.gov/);assert.equal(C.advanceStormDecision(s),false);
  s=C.normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(C.stormFeedback(s).correct,false);assert.equal(s.training.storm.answers.length,0);
  C.chooseStormDecision(s,'shelter');assert.equal(C.advanceStormDecision(s),true);assert.equal(s.training.storm.answers.length,1);assert.equal(s.training.storm.attempts,2);
  assert.equal(C.chooseStormDecision(s,'not-a-choice'),null);
});

test('storm EVA saves stay outside and corrupted training does not complete the drill',()=>{
  const s=crew(2);s.location='surface';C.complete(s,'solar');s.samples=4;delete s.training;
  const migrated=C.normalizeState(s);assert.equal(migrated.location,'surface');assert.equal(migrated.tasks.solar,true);assert.equal(migrated.samples,4);assert.equal(C.stormComplete(migrated),false);
  const bad=C.normalizeState({...migrated,training:{emu:{placed:['helmet','fake','helmet'],learned:[]},storm:{reviewed:false,answers:['shelter','local','mass','monitor'],feedback:{choice:'shelter'}}}});
  assert.deepEqual(bad.training.emu.placed,['helmet']);assert.equal(bad.training.storm.answers.length,0);assert.equal(bad.training.storm.feedback,null);C.enterShip(bad);C.Power.confirm(bad,{modes:bad.powerPlan.modes,outdoor:true});assert.equal(C.canExitShip(bad),true);
});

test('the bundled fallback contains dated real FLR, CME, SEP and notification records',()=>{
  assert.equal(D.valid(archive),true);assert.equal(archive.range.startDate,'2024-05-08');
  for(const type of ['FLR','CME','SEP'])for(const record of archive.events[type]){
    assert.equal(record.type,type);assert.ok(Date.parse(record.time)<Date.parse('2024-06-01'));assert.match(record.link,/^https:\/\/ccmc\.gsfc\.nasa\.gov\//);assert.ok(Array.isArray(record.instruments));
  }
  assert.equal(archive.events.FLR[0].id,'2024-05-10T00:10:00-FLR-001');assert.equal(archive.events.FLR[0].classType,'M1.3');assert.ok(archive.events.notifications.length>0);
});

test('stale, partial and unavailable live feeds select a clearly historical case',()=>{
  const now=Date.parse('2026-11-15T12:00:00Z');assert.equal(D.chooseDataset(null,archive,{now}).displayMode,'historical');
  // Even a newly downloaded old event window must never be described as recent.
  assert.equal(D.chooseDataset({...archive,retrievedAt:new Date(now).toISOString()},archive,{now}).displayMode,'historical');
  const current={...archive,retrievedAt:new Date(now).toISOString(),range:{startDate:'2026-11-01',endDate:'2026-11-15'},events:Object.fromEntries(Object.entries(archive.events).map(([type,rows])=>[type,rows.map(record=>({...record,time:'2026-11-14T00:00Z'}))]))};
  assert.equal(D.chooseDataset(current,archive,{now}).displayMode,'recent');assert.equal(D.chooseDataset(current,archive,{now,transport:'snapshot'}).displayMode,'snapshot');
  assert.equal(D.chooseDataset({...current,events:{...current.events,SEP:[]}},archive,{now}).displayMode,'historical');
  assert.equal(D.chooseDataset({...current,events:archive.events},archive,{now}).displayMode,'historical');
  assert.equal(D.chooseDataset({...current,retrievedAt:'2026-11-01T00:00:00Z'},archive,{now}).displayMode,'historical');
});

test('NASA response normalization retains observations and rejects invalid links and records',async()=>{
  const {normalizeRecords}=await import('../scripts/donki-service.mjs');
  const flr=normalizeRecords('FLR',[{flrID:'observed-flare',beginTime:'2024-05-10T00:10Z',classType:'M1.3',link:'javascript:alert(1)',instruments:[{displayName:'GOES'}]},{flrID:'invalid',beginTime:'not a date'}]);
  assert.equal(flr.length,1);assert.equal(flr[0].link,null);assert.deepEqual(flr[0].instruments,['GOES']);
  const cme=normalizeRecords('CME',[{activityID:'observed-cme',startTime:'2024-05-10T00:00Z',cmeAnalyses:[{speed:900},{speed:1200,isMostAccurate:true}]}]);assert.equal(cme[0].speed,1200);
  assert.deepEqual(normalizeRecords('SEP',null),[]);assert.throws(()=>normalizeRecords('SEP',{}));
});

test('the public NASA gateway fallback fetches all four feeds without exposing API keys',async()=>{
  const {fetchDonkiWindow}=await import('../scripts/donki-service.mjs');const requests=[];
  const fetchImpl=async url=>{url=new URL(url);requests.push(url);if(url.hostname==='ccmc.gsfc.nasa.gov')throw new Error('upstream unavailable');
    const type=url.pathname.split('/').at(-1),row={FLR:{flrID:'unit-flare',beginTime:'2024-05-10T00:00Z'},CME:{activityID:'unit-cme',startTime:'2024-05-10T00:00Z'},SEP:{sepID:'unit-sep',eventTime:'2024-05-10T00:00Z'},notifications:{messageID:'unit-notice',messageIssueTime:'2024-05-10T00:00Z',messageURL:'https://ccmc.gsfc.nasa.gov/DONKI/notifications'}}[type];
    return {ok:true,json:async()=>[row]};};
  const data=await fetchDonkiWindow({startDate:'2024-05-10',endDate:'2024-05-10'},{fetchImpl});
  assert.equal(requests.length,8);assert.equal(data.errors.length,0);assert.equal(data.events.SEP.length,1);assert.equal(data.events.notifications.length,1);assert.equal(JSON.stringify(data).includes('api_key'),false);
});

test('the proxy only accepts read-only requests for its two supported windows',async()=>{
  const {handleDonkiRequest}=await import('../scripts/donki-service.mjs');
  const run=async(method,path)=>{const res={writeHead(status){this.status=status;},end(body){this.body=body;}};const handled=await handleDonkiRequest({method},res,new URL(path,'http://localhost'));return {res,handled};};
  assert.equal((await run('POST','/api/donki')).res.status,405);assert.equal((await run('GET','/api/donki?url=https://example.com')).res.status,400);assert.equal((await run('GET','/api/donki?mode=invalid')).res.status,400);assert.equal((await run('GET','/not-an-api')).handled,false);
});

test('failed NASA refreshes have a cooldown rather than a false empty all-clear',async()=>{
  const {handleDonkiRequest}=await import('../scripts/donki-service.mjs'),original=global.fetch;let requests=0;
  global.fetch=async()=>{requests++;throw new Error('offline');};
  const run=async()=>{const res={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};await handleDonkiRequest({method:'GET'},res,new URL('http://localhost/api/donki?mode=historical'));return res;};
  try{const first=await run(),count=requests,second=await run();assert.equal(first.status,503);assert.equal(second.status,503);assert.equal(second.body.retryAfter,60);assert.equal(requests,count);assert.equal(second.body.events,undefined);}finally{global.fetch=original;}
});

test('a successful NASA proxy result is cached with its original retrieval time',async()=>{
  const {handleDonkiRequest}=await import('../scripts/donki-service.mjs'),original=global.fetch;let requests=0;
  global.fetch=async url=>{requests++;const type=new URL(url).pathname.split('/').at(-1),row={FLR:{flrID:'test-flare',beginTime:'2026-11-14T00:00Z'},CME:{activityID:'test-cme',startTime:'2026-11-14T00:00Z'},SEP:{sepID:'test-sep',eventTime:'2026-11-14T00:00Z'},notifications:{messageID:'test-notice',messageIssueTime:'2026-11-14T00:00Z'}}[type];return {ok:true,json:async()=>[row]};};
  const run=async()=>{const res={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};await handleDonkiRequest({method:'GET'},res,new URL('http://localhost/api/donki?mode=recent'));return res;};
  try{const first=await run(),count=requests,second=await run();assert.equal(first.status,200);assert.equal(second.body.transport,'server-cache');assert.equal(second.body.retrievedAt,first.body.retrievedAt);assert.equal(requests,count);}finally{global.fetch=original;}
});
