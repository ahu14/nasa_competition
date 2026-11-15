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
  let paused = false, hidden = false, moving = false, ready = false, busy = false, sleeping = false;
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
  let selectedGoal=null;
  const currentTask = () => {if(state.ending.phase!=='dormant')return C.activeObjective(state);const goal=selectedGoal?.day===state.survival.day?C.dayGoals(state).find(g=>g.id===selectedGoal.id&&!g.done):null;return goal?{id:goal.station,label:goal.label}:C.activeObjective(state);};
  const insideRoom=()=>['habitat','greenhouse'].includes(state.location);
  const indoors=()=>insideShip()||insideRoom();
  const insideShip = () => state.introComplete && state.location === 'ship';
  const activePlayer = () => insideRoom()?state.interiorPlayer:insideShip() ? state.shipPlayer : state.player;
  const activeStations = () => insideRoom()?roomStations():insideShip() ? C.shipStations : C.stations;
  const cameraForScene = () => indoors() ? C.shipCameraFor(activePlayer(),view.w,view.h,zoom) : C.cameraFor(state.player,view.w,view.h,zoom);
  const isBlocked = () => !!state.death || paused || dialog.open || orbiDialog.open || trainer?.isOpen() || ['zoom','complete'].includes(state.ending.phase) || hidden || !ready || !state.introComplete;

  function roomStations(){const items=state.location==='habitat'?[['oxygen','OXYGEN'],['food','FOOD RESERVES'],['water','WATER TANK'],['power','POWER & SYSTEMS'],['ice-processor','ICE TO WATER']]:[['lettuce','RED ROMAINE LETTUCE'],['seed','NEW SEEDS'],['irrigation','IRRIGATION'],['oxygen-canister','OXYGEN CANISTERS']];return items.map(([id,name],i)=>({id,name,x:160+i*(items.length===5?195:220),y:410,ax:160+i*(items.length===5?195:220),ay:445,radius:95,labelX:160+i*(items.length===5?195:220),labelY:365})).concat({id:'room-exit',name:'AIRLOCK - EXIT',x:550,y:690,ax:550,ay:665,radius:85,labelX:550,labelY:735});}
  function roomWalkable(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=100&&x<=1000&&y>=405&&y<=710;}
  function enterRoom(id){state.location=id;state.interiorPlayer={x:550,y:660};resetRoom();toast(id==='habitat'?'NOVA habitat. Walk to each console to check supplies and systems.':'Greenhouse. Inspect the lettuce trays, manage water and nutrients, and check grow-light power. ORBI can help remotely during storms.');}
  function leaveRoom(){const st=C.stations.find(s=>s.id===state.location);state.location='surface';state.player={x:st.ax,y:st.ay};resetRoom();}
  function resetRoom(){if(dialog.open)closeDialog();keys.clear();path=[];target=null;targetStation=null;footsteps.length=0;activeStation=null;hoverStation=null;syncIntro();resize();updateHud();updateInteraction();render();save();}
  function drawIceProcessor(st){const x=st.x;ctx.fillStyle='#709da6';ctx.fillRect(x-70,275,140,80);ctx.fillStyle='#182e40';ctx.fillRect(x-62,282,58,61);ctx.fillStyle='#a6e7ef';ctx.fillRect(x-53,291,17,19);ctx.fillRect(x-34,303,20,22);ctx.fillStyle='#305b72';ctx.fillRect(x+7,286,52,57);ctx.fillStyle='#70cee1';ctx.fillRect(x+12,339-state.survival.water*.45,42,state.survival.water*.45);ctx.fillStyle='#e3dbab';ctx.font='10px Consolas,monospace';ctx.fillText('ICE',x-48,340);ctx.fillStyle='#a9e6c1';ctx.fillRect(x-6,305,12,8);}
  function drawLettucePlants(st){
    state.greenhouse.trays.forEach((tray,i)=>{
      const x=st.x-58+i*45,size=tray.harvested?0:tray.age<3?2:tray.age<10?5:tray.age<24?9:tray.age<35?12:15;
      ctx.fillStyle='#705743';ctx.fillRect(x,330,34,7);
      ctx.fillStyle=C.Greenhouse.light(state)<40?'#556d62':'#b7db9b';ctx.fillRect(x,295,34,3);
      if(!size)return;
      ctx.fillStyle=state.greenhouse.health<40?'#a5975d':'#aa6479';ctx.fillRect(x+17-size,330-size*2,size*2,size*2);
      ctx.fillStyle='#7fac73';ctx.fillRect(x+13,328-size*2,8,size*2);
    });
  }
  function drawRoom(){const green=state.location==='greenhouse';ctx.fillStyle='#0c1721';ctx.fillRect(0,0,1100,840);ctx.fillStyle=green?'#324b42':'#354955';ctx.fillRect(75,175,950,555);ctx.fillStyle=green?'#182f29':'#172b3b';ctx.fillRect(95,195,910,205);ctx.fillStyle='#aec5b6';ctx.font='22px Consolas, monospace';ctx.fillText(green?'NOVA / BOTANICAL DOME':'NOVA / HABITAT',115,235);ctx.font='13px Consolas, monospace';ctx.fillText('DAY '+state.survival.day+' - PRESSURIZED / SAFE TO BREATHE',115,263);ctx.strokeStyle='#91b5ad22';ctx.lineWidth=1;for(let x=100;x<=1000;x+=45){ctx.beginPath();ctx.moveTo(x,400);ctx.lineTo(x,720);ctx.stroke();}for(let y=405;y<=720;y+=45){ctx.beginPath();ctx.moveTo(95,y);ctx.lineTo(1005,y);ctx.stroke();}for(const st of roomStations().filter(st=>st.id!=='room-exit')){ctx.fillStyle='#13282e';ctx.fillRect(st.x-80,290,160,62);if(green&&st.id==='lettuce'){drawLettucePlants(st);}else if(st.id==='ice-processor'){drawIceProcessor(st);}else{ctx.fillStyle=green?'#91bc78':'#71c8bd';ctx.fillRect(st.x-65,301,130,33);ctx.fillStyle='#162e32';ctx.font='12px Consolas, monospace';ctx.fillText(st.name,st.x-58,322);}}ctx.fillStyle='#172c3a';ctx.fillRect(460,680,180,43);ctx.fillStyle='#9cd3bb';ctx.fillRect(475,685,150,5);}
  function interactRoom(id){
    if(state.location==='greenhouse'&&['lettuce','seed','irrigation'].includes(id)){greenhouseDialog();return;}
    if(id==='room-exit'){leaveRoom();return;}const o=state.operations,d=state.survival.day;
    if(id==='ice-processor'){
      const full=state.survival.water>=100,empty=o.ice===0;
      showDialog('HABITAT · ICE-TO-WATER PROCESSOR',`<div class="water-machine-display"><span>❄ ICE HOPPER</span><strong>${o.ice} / 6 crystals</strong><b>↓ MELT · FILTER · STORE ↓</b><span>DRINKING WATER</span><strong>${Math.round(state.survival.water)} / 100%</strong></div><h1 id="dialog-title">A drink from the ice.</h1><p class="dialog-body">Collect ice at the blue crystal deposit, carry it here, then melt and filter it. One crystal adds up to 30 water points. Food stock stays unchanged. The machine uses the habitat’s reserved power and essential systems.</p>${actionButton(full?'Water tank is full':empty?'Bring ice crystals here':'Process 1 crystal → up to +30 water','process-ice')}<button class="dialog-secondary" id="processor-back">Back to the habitat</button>`);
      $('process-ice').disabled=full||empty;
      $('process-ice').onclick=()=>{C.performOperation(state,'process-ice');save();updateHud();interactRoom(id);};$('processor-back').onclick=closeDialog;return;
    }
    if(state.location==='habitat'){const value=id==='food'?state.survival.food:id==='water'?state.survival.water:id==='oxygen'?o.oxygenReserve:state.power;showDialog('NOVA HABITAT - SYSTEM CHECK','<h1 id="dialog-title">'+id.toUpperCase()+' STATUS</h1><div class="dialog-stat">'+Math.round(value)+(id==='oxygen'?' oxygen units':'%')+'</div><p class="dialog-body">Ship power comes from the solar array. Clean panels generate more power. Meals restore astronaut energy. Collect oxygen canisters in the greenhouse and install them at ship life support.</p>'+actionButton(o.checks[id]===d?'Reading recorded':'Check and record '+id));$('dialog-action').onclick=()=>{C.performOperation(state,id);save();updateHud();closeDialog();};return;}
    if(id==='oxygen-canister'){showDialog('GREENHOUSE - OXYGEN COLLECTION','<h1 id="dialog-title">Bottle a little breathing room.</h1><p class="dialog-body">One canister per Sol. Carry up to three. Each adds 80 oxygen units when installed at ship life support.</p><div class="dialog-stat">Carried: '+o.canisters+' / 3</div>'+actionButton(o.oxygenCollectedDay===d?'Collected today':'Collect oxygen canister'));$('dialog-action').onclick=()=>{C.performOperation(state,'collect-oxygen');save();updateHud();closeDialog();};return;}
  }
  function lettuceArt(tray){
    const size=tray.harvested?0:tray.age<3?1:tray.age<10?3:tray.age<24?6:tray.age<35?9:12;
    const leaf=state.greenhouse.health<40?'#b9a267':'#aa6479';
    return `<svg class="lettuce-art" viewBox="0 0 64 52" aria-hidden="true"><path fill="#6c5142" d="M4 38h56v12H4z"/><path fill="#273e36" d="M8 38h48v5H8z"/>${size?`<path fill="#73a66b" d="M29 ${38-size*2}h6v${size*2}h-6z"/><path fill="${leaf}" d="M${29-size} ${38-size*2}h${size}v${size*2}H${29-size}zM35 ${38-size*2}h${size}v${size*2}H35z"/><path fill="#c78b93" d="M29 ${38-size*3}h6v${size*2}h-6z"/>`:''}</svg>`;
  }
  function greenhouseDialog(topic=0){
    if(!['ship','greenhouse'].includes(state.location)){
      showDialog('ORBI / GARDEN LINK','<h1 id="dialog-title">Check the garden from shelter.</h1><p class="dialog-body">Enter the greenhouse to see the plants, or use ORBI’s remote care controls aboard the spaceship.</p>'+actionButton('Back to exploring'));
      $('dialog-action').onclick=closeDialog;return;
    }
    const G=C.Greenhouse,g=state.greenhouse,remote=state.location==='ship',light=G.light(state),planned=state.powerPlan.day===state.survival.day;
    const lesson=G.lessons[topic],job=C.dayGoals(state).find(v=>v.station==='greenhouse'&&v.kind==='work'&&!v.done);
    showDialog(`DAY ${state.survival.day} / ${remote?'ORBI REMOTE GARDEN':'NOVA GREENHOUSE'}`,`<div class="garden"><h1 id="dialog-title">A little garden. A long way home.</h1><p class="dialog-body">Three red romaine trays were already growing before you woke up. Keep water, nutrients and grow lights balanced. Each night advances growth by up to one growing day.</p>
      <div class="garden-meters">${[['Water',g.water],['Nutrients',g.nutrients],['Plant health',g.health],['Light',light]].map(([label,value])=>`<label>${label}<strong>${Math.round(value)}%</strong><meter min="0" max="100" low="30" optimum="80" value="${value}">${Math.round(value)}%</meter></label>`).join('')}</div>
      <p class="garden-status" role="status">${!planned?'Today’s lights are not powered yet. Confirm your Sol power plan.':light<40?'Light is low. Growth slows, and plant health will decline tonight.':light<60?'Lights are dim. Growth is slower today.':'The grow lights have good power today.'} ${g.water<30?'Top up the water loop. ':''}${g.nutrients<25?'Add a nutrient dose. ':''}${C.isStormDay(state.survival.day)?'Storm shelter: use these remote controls; leave solar cleaning for a safe day.':'Clean solar panels improve the next Sol’s recharge.'}</p>
      <div class="garden-trays">${g.trays.map((t,i)=>`<section>${lettuceArt(t)}<h2>Tray ${i+1}</h2><strong>${G.stage(t)}</strong><small>${t.harvested?'Ready for new seeds':`${t.age.toFixed(1)} / 35 effective growing days`}</small><button data-garden-tray="${i}" data-garden-action="${t.harvested?'plant':'harvest'}" ${remote||(!t.harvested&&!G.ready(g,t))||(t.harvested&&!state.operations.seeds)?'disabled':''}>${t.harvested?'Sow 1 stored seed':'Harvest lettuce'}</button></section>`).join('')}</div>
      <p class="garden-note">Our simplified romaine crop needs 35 effective growing days. Real timing varies by variety and conditions. Fresh seeds will not become a full crop during your 15-day stay. ${remote?'Harvesting and sowing require a greenhouse visit.':''}</p>
      <div class="garden-actions"><button id="garden-inspect">${g.inspectedDay===state.survival.day?'Health recorded today':'Inspect plant health'}</button><button id="garden-water" ${g.water>60||state.survival.water<5?'disabled':''}>Water loop (+40%, costs 5 water stock)</button><button id="garden-nutrients" ${g.nutrients>60||!g.packets?'disabled':''}>Nutrient dose (+40%, ${g.packets} left)</button><button id="garden-power">Open solar power plan</button>${job&&!remote?`<button id="garden-maintenance">${job.label}</button>`:''}</div>
      <p class="garden-note">Top-ups unlock at 60% or below. The loop uses 12 water points and 8 nutrient points per night. Health changes at night; good care helps it recover. Food stock: ${Math.round(state.survival.food)}% · Water stock: ${Math.round(state.survival.water)}% · Seeds: ${state.operations.seeds}</p>
      ${g.report?`<p class="garden-note">Last night: ${Math.round(g.report.light)}% light · +${g.report.growth.toFixed(2)} growing days · health ${g.report.healthChange>=0?'+':''}${g.report.healthChange}%.</p>`:''}
      <aside class="garden-lesson"><span>ORBI / ${lesson[0]}</span><p>${lesson[1]}</p><div>${G.lessons.map(([label],i)=>`<button data-garden-topic="${i}" aria-pressed="${i===topic}">${label}</button>`).join('')}</div></aside>
      <p class="garden-note">Inspired by the <a href="https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/" target="_blank" rel="noopener noreferrer">Canadian Space Agency’s food-production toolkit</a> and <a href="https://www.asc-csa.gc.ca/eng/youth-educators/activities/fitness-and-nutrition/interplanetary-farming.asp" target="_blank" rel="noopener noreferrer">Interplanetary Farming</a>. This Mars mission is a simplified game simulation.</p>${actionButton(remote?'Back to the cabin':'Back to the greenhouse')}</div>`);
    const refresh=()=>{save();updateHud();greenhouseDialog(topic);};
    $('garden-inspect').onclick=()=>{G.care(state,'inspect');refresh();};
    $('garden-water').onclick=()=>{G.care(state,'water');C.flagLowSupplies(state);refresh();};
    $('garden-nutrients').onclick=()=>{G.care(state,'nutrients');refresh();};
    $('garden-power').onclick=()=>{if(remote)openPowerPlan();else{closeDialog();toast('ORBI: Return to the ship to rebalance the shared solar power plan.');}};
    if($('garden-maintenance'))$('garden-maintenance').onclick=()=>{C.performOperation(state,job.id);refresh();};
    dialog.querySelectorAll('[data-garden-tray]').forEach(b=>b.onclick=()=>{G.care(state,b.dataset.gardenAction,Number(b.dataset.gardenTray));refresh();});
    dialog.querySelectorAll('[data-garden-topic]').forEach(b=>b.onclick=()=>greenhouseDialog(Number(b.dataset.gardenTopic)));
    $('dialog-action').onclick=closeDialog;
  }
  function workDialog(station){const job=C.dayGoals(state).find(g=>g.station===station&&g.kind==='work'&&!g.done);if(!job)return false;showDialog('DAY '+state.survival.day+' - MAINTENANCE','<h1 id="dialog-title">'+job.label+'</h1><p class="dialog-body">Check the station, record its readings, and complete the scheduled maintenance.</p>'+actionButton(job.label));$('dialog-action').onclick=()=>{C.performOperation(state,job.id);save();updateHud();closeDialog();toast('Completed: '+job.label);};return true;}
  const resultArt=success=>`<img class="result-art${success?' result-art-success':''}" src="assets/survival/${success?'celebrating':'fallen'}-astronaut.svg" alt="${success?'A celebrating astronaut with arms raised':'A fallen astronaut with a little ghost above her'}">`;
  function showDeath(){
    const reasons={hunger:['You died of hunger.','Your astronaut energy reached zero. Eat at the ship galley regularly; collecting food stock alone does not feed you.'],oxygen:['Your oxygen ran out.','Your suit oxygen reached zero on the surface. Standing uses less oxygen than walking; running uses the most. Refill at ship life support before your next EVA.'],energy:['You ran out of astronaut energy.','Your stamina reached zero. Walking uses energy and running uses it faster. Return to the ship galley for a meal before it runs out.'],storm:['The storm overwhelmed your suit.','You spent 12 continuous seconds on the surface during a radiation storm. Stay in the spaceship or enter a pressurized building for shelter.'],power:['There wasn’t enough power to survive.','Life support lost electricity. Reserve at least '+C.Power.modes.Critical.habitat+' EU for habitat air, heat and water each Sol, and return to shelter before your EMU’s shared outdoor power budget runs out. Clean solar panels and use Reduced or Critical modes to save power for storm days.']};
    const [title,body]=reasons[state.death.cause];
    clearTimeout(toastTimer);$('toast').hidden=true;
    showDialog(`DAY ${state.death.day} · EXPEDITION ENDED`,`${resultArt(false)}<h1 id="dialog-title">${title}</h1><p class="dialog-body">${body}</p>${actionButton('Start a fresh expedition','retry-expedition')}<a class="dialog-secondary" href="index.html">Return to main menu</a>`);
    $('retry-expedition').onclick=confirmReset;
  }
  function endingDialog(){keys.clear();path=[];target=null;targetStation=null;if(state.ending.phase==='complete'){showDialog('DAY 15 - 23:59',resultArt(true)+'<div class="ending-screen"><span class="ending-signal">EARTH / NOVA - CONNECTED</span><h1 id="dialog-title">15 DAYS SURVIVED — SIGNAL RESTORED</h1><p>We never stopped looking.</p><small>Survival mission accomplished.</small></div><a class="dialog-secondary" href="index.html">Return to main menu</a><button class="dialog-secondary" id="new-expedition">Begin a new expedition</button>');$('new-expedition').onclick=confirmReset;return;}const [speaker,line]=C.endingLines[state.ending.step];showDialog('DAY 15 - 23:59 | SIGNAL RESTORED','<div class="ending-transmission"><span class="ending-signal">'+speaker+'</span><h1 id="dialog-title">'+line+'</h1></div>'+actionButton(state.ending.step===6?'Look beyond the terminal':'Continue transmission'));$('dialog-action').onclick=()=>{C.advanceEnding(state);save();if(state.ending.phase==='zoom'){dialog.close();state.shipPlayer={x:830,y:560};facing='up';updateCamera();$('toast').hidden=true;document.body.classList.add('ending-cinematic');}else endingDialog();};}

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
    $('cargo-ice').textContent=state.operations.ice;
    $('cargo-oxygen').textContent=state.operations.canisters;
    document.body.dataset.habitatMode=insideShip()?state.powerPlan.modes.habitat:'Normal';
    document.body.classList.toggle('day-one',state.survival.day===1);
    document.body.classList.toggle('day-two',C.isStormDay(state.survival.day));
    $('prep-emu-item').hidden=state.survival.day!==1;
    $('prep-heading').textContent=state.survival.day===1?'BEFORE YOUR FIRST EVA':C.isStormDay(state.survival.day)?'STORM DAY · SHELTER ADVISED':'DAILY PREPARATION';
    $('prep-description').textContent=state.survival.day===1?'Finish breakfast, weather, and your first EVA lesson.':'You may leave now. Eat, check weather, and watch your resources.';
    $('survival-hud').hidden=!state.introComplete;
    $('day-value').textContent=`DAY ${state.survival.day}`;
    for(const stock of ['food','water']){
      const value=state.survival[stock];$(`${stock}-stock-value`).textContent=`${Math.round(value)}%`;
      $(`${stock}-stock-bar`).style.width=`${value}%`;$(`${stock}-stock-bar`).classList.toggle('low',value<=25);
    }
    $('oxygen-value').innerHTML = `${Math.ceil(state.oxygen)}<span>%</span>`;
    $('energy-value').innerHTML = `${Math.ceil(state.energy)}<span>%</span>`;
    $('power-value').innerHTML = `${Math.ceil(state.power)}<span>EU</span>`;
    $('power-bar').style.width=`${state.power}%`;
    $('energy-bar').classList.toggle('low',state.energy<=20);
    $('solar-output').textContent=C.Power.forecast(state).name+' · '+C.Power.forecast(state).eu+' EU/Sol';
    const storm=state.location==='surface'&&C.isStormDay(state.survival.day);
    $('storm-warning').hidden=!storm||!!state.death;
    $('storm-countdown').textContent=`${Math.ceil(C.SURVIVAL_RATES.stormLimit-state.stormExposure)}s TO FATAL EXPOSURE · ENTER SHELTER`;
    const emuRemaining=state.location==='surface'&&state.powerPlan.day===state.survival.day?Math.max(0,C.Power.outdoorLimit(state)-state.powerPlan.exposure):Infinity;
    $('resource-warning').hidden=!!state.death||!(state.energy<=20||state.location==='surface'&&state.oxygen<=20||emuRemaining<=20);
    $('resource-warning').textContent=state.energy<=20?'ASTRONAUT ENERGY LOW · RETURN FOR A MEAL':state.location==='surface'&&state.oxygen<=20?'OXYGEN LOW · RETURN TO SHIP LIFE SUPPORT':`EMU POWER LOW · ${Math.ceil(emuRemaining)}s LEFT · ENTER SHELTER`;
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
    $('step-number').textContent = done===goals.length?'✓':number(goals.findIndex(g=>!g.done)+1);
    $('step-label').textContent = task.label;
    $('mission-title').textContent = C.dayTitle(state);
    $('mission-description').textContent = `DAY ${state.survival.day} · ${state.survival.day===1?'Find supplies. Get to know the outpost.':'Breakfast. Weather. A little progress.'}`;
    while($('progress-segments').children.length<goals.length)$('progress-segments').appendChild(document.createElement('i'));
    [...$('progress-segments').children].forEach((el, i) => {el.hidden=i>=goals.length;el.className=goals[i]?.done?'done':i===goals.findIndex(g=>!g.done)?'current':'';});
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
  const dustySolar=new Image();
  const solarReady=new Promise((resolve,reject)=>{dustySolar.onload=resolve;dustySolar.onerror=()=>reject(new Error('Could not load the dusty solar artwork.'));});
  dustySolar.src='assets/survival/dusty-solar.svg';
  Promise.all([landscapeReady, orbiReady, solarReady, character.load(), indoorCharacter.load()]).then(() => {
    world = new window.MarsWorld(map,dustySolar);
    intro = new window.WakeupScene(map,indoorCharacter,orbiImage);
    syncIntro();
    ready = true; resize(); render(); updateInteraction();if(state.death)showDeath();else if(['transmission','complete'].includes(state.ending.phase))endingDialog();if(!state.death&&state.ending.phase==='zoom'){state.shipPlayer={x:830,y:560};document.body.classList.add('ending-cinematic');} $('loading').hidden = true;
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
    if(insideRoom())drawRoom();
    else if(insideShip())intro.drawCabin(ctx,time,reducedMotion,state.earthSignal.phase,state.orbi.phase,state.preparation,C.weatherFor(state.survival.day));
    else world.draw(ctx, { x: view.x, y: view.y, w: view.w / view.scale, h: view.h / view.scale },state);
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
    (indoors()?indoorCharacter:character).draw(ctx, facing, frame, p.x, p.y);
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
    const dest = station ? { x: station.ax, y: station.ay } : insideRoom()?{x:C.clamp(point.x,100,1000),y:C.clamp(point.y,405,710)}:C.nearestOpen(point.x, point.y,insideRoom()?roomWalkable:insideShip()?C.shipWalkable:C.walkable,insideShip()?C.SHIP.spawn:C.HOME);
    path = insideRoom()?[dest]:C.findPath(activePlayer(), dest,insideShip()?'ship':'surface'); target = dest;
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
    if(activeStation&&!indoors()&&C.recordVisit(state,activeStation.id)){save();updateHud();}
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
    $('destination-beacon').hidden = indoors() || !offscreen || isBlocked();
    if (next) {
      $('destination-name').textContent = next.name;
      $('destination-distance').textContent = `${Math.round(Math.hypot(next.ax-state.player.x,next.ay-state.player.y)/10)} m`;
      $('destination-arrow').style.transform = `rotate(${Math.atan2(next.ay-state.player.y,next.ax-state.player.x)}rad)`;
    }
    drawMinimap();
  }
  function drawMinimap() {
    if(insideRoom()){const w=minimap.width,h=minimap.height;mini.fillStyle='#182e30';mini.fillRect(0,0,w,h);for(const st of roomStations()){mini.fillStyle='#9fcca1';mini.fillRect(st.ax/1100*w-2,st.ay/840*h-2,4,4);}mini.fillStyle='#ffe3a9';mini.fillRect(state.interiorPlayer.x/1100*w-2,state.interiorPlayer.y/840*h-2,4,4);return;}
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
    if(insideRoom()){leaveRoom();return;}
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
    const p = activePlayer(),isOpen=insideRoom()?roomWalkable:insideShip()?C.shipWalkable:C.walkable;
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
    if(sleeping)return;
    time += dt;
    if(ready&&!state.death&&!paused&&!hidden){
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
      if(!(dialog.open&&$('earth-signal'))&&C.tickOrbi(state,dt)==='orbi-ready'){
        save();updateHud();updateInteraction();chirp(523,.18);
        toast('The nearby TV lights up. ORBI has a message for you — look for the !');
      }
    }
    if(ready&&!state.death&&!paused&&!hidden){const event=C.tickEnding(state,dt,state.introComplete&&state.location!=='ship'&&!C.nextPreparation(state)&&!dialog.open&&(moving||!!activeStation));
      if(event==='recall'){keys.clear();path=[];target=null;targetStation=null;save();updateHud();showDialog('DAY 15 - 23:59 | ORBI','<h1 id="dialog-title">Return to the spaceship.</h1><p class="dialog-body">A signal just appeared on the deep-space channel. Stop the survey and return to the communications terminal now.</p>'+actionButton('Return to the spaceship'));$('dialog-action').onclick=()=>{closeDialog();if(insideRoom())leaveRoom();toast('ORBI: Return to the spaceship and check Earth communications.');};}
      if(state.ending.phase==='zoom'){const t=C.clamp(state.ending.elapsed/7,0,1);zoom=1-.35*t*t*(3-2*t);view.scale=C.shipCameraFor(state.shipPlayer,view.w,view.h,zoom).scale;updateCamera(dt);}if(event==='complete'){save();endingDialog();}}
    if(ready&&state.introComplete&&state.orbi.phase==='complete'&&!dialog.open&&!orbiDialog.open&&!trainer?.isOpen()&&insideShip()&&!state.death&&state.powerPlan.day!==state.survival.day){openPowerPlan();return;}
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
    }
    if(!dialog.open&&C.tickSurvival(state,dt,moving?(keys.has('shift')?'run':'walk'):'idle')){save();updateHud();showDeath();return;}
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
    dialog.classList.toggle('garden-dialog',html.includes('class="garden"'));
    $('close-dialog').hidden=!!state.death||state.ending.phase==='complete';
    if (!dialog.open) dialog.showModal();
    updateInteraction();
  }
  function closeDialog() {
    if (state.death||busy||['transmission','zoom','complete'].includes(state.ending.phase)) return;
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
      const wasComplete=C.tasks.every(task=>state.tasks[task.id]);
      C.complete(state, id); busy = false;
      const s = C.stations.find(v => v.id === id);
      if (!reducedMotion) for (let i = 0; i < 22; i++) sparks.push({ x: s.ax, y: s.ay - 40, vx: (Math.random() - .5) * 140, vy: -30 - Math.random() * 110, life: 1.2 });
      chirp(660, .15); setTimeout(() => chirp(880, .2), 100);
      closeDialog(); updateHud(); save(); toast(message);
      if (!wasComplete&&C.tasks.every(task=>state.tasks[task.id])) setTimeout(showSuccess, 350);
    }, reducedMotion ? 150 : 1100);
  }
  const stationCopy = {
    solar: { icon: 'sun', eyebrow: 'POWER SYSTEMS · SOLAR ARRAY', title: 'A little more sunshine.', body: 'A fine layer of red dust is keeping these panels from doing their thing. A quick clean will bring power back to your new home.', stat: 'Clean panels · Higher ship power generation', action: 'Clean the solar panels', message: 'Solar array online. A brighter day on Mars.' },
    greenhouse: { icon: 'leaf', eyebrow: 'LIFE SUPPORT · GREENHOUSE', title: 'Something green. On Mars.', body: 'There’s a whole little world under this dome. Start the air and water systems, and give these plants a chance to grow.', stat: 'Oxygen canisters available · Life support online', action: 'Start greenhouse life support', message: 'Greenhouse thriving. Collect oxygen canisters inside.' },
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
    if(state.ending.phase==='recalled'){C.beginEnding(state);endingDialog();return;}
    if(['transmission','complete'].includes(state.ending.phase)){endingDialog();return;}
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
          if(C.isStormDay(state.survival.day)){closeOrbi();openTraining('storm');return;}
          if(state.survival.day===1&&!C.emuComplete(state)){closeOrbi();openTraining('emu');return;}
          if(state.survival.warningPending)C.acknowledgeSupplies(state);closeOrbi();return;
        }
        C.advanceOrbi(state,state.orbi.step===0&&index===1?'tasks':'');save();updateHud();
        if(state.orbi.phase==='complete'){
          closeOrbi();toast(`${C.playerName(state)}. That’s your name. Complete food, water, weather and EMU preparation in any order.`);
        }else renderOrbi();
      });
      replies.append(button);
    });
    if(state.orbi.phase==='complete'){
      const garden=document.createElement('button');garden.textContent='Greenhouse: care & learn';
      garden.onclick=()=>{closeOrbi();greenhouseDialog();};replies.append(garden);
    }
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
    showDialog('ORBI · SUPPLIES RUNNING LOW',`<h1 id="dialog-title">That won’t last fifteen days.</h1><div class="supply-alert"><strong>FOOD ${state.survival.food}% <span>·</span> WATER ${state.survival.water}%</strong><p>“Mira, breakfast used some of our last supplies. We don’t have enough food and water for the rescue wait.”</p></div><p class="dialog-body">${state.survival.day===1?'“Day 1 is for exploring. Finish breakfast, check the weather, and find the food storage building. Collect ice crystals and use the habitat processor for water. Visit a couple of other outpost locations while you’re out.”':'“Finish breakfast and check the weather. Visit the supply depot today so we have enough for tomorrow.”'}</p>${actionButton('Understood · Finish breakfast','supply-warning-ack')}`);
    $('supply-warning-ack').onclick=()=>{C.acknowledgeSupplies(state);save();updateHud();galleyDialog();};
  }
  function galleyDialog(){
    if(state.orbi.phase!=='complete'){
      showDialog('SPACESHIP · GALLEY',`<h1 id="dialog-title">A place for breakfast.</h1><p class="dialog-body">A warm meal and drinking water are waiting here. First, find out what ORBI wants to tell you.</p>${actionButton('Back to the cabin')}`);
      $('dialog-action').onclick=closeDialog;return;
    }
    const p=state.preparation,both=p.ate&&p.drank,full=state.energy>=100;
    showDialog('SPACESHIP · GALLEY',`<h1 id="dialog-title">A little fuel for you.</h1><p class="dialog-body">You’ve been asleep for a long time. Have a warm meal and some water before taking on the day.</p><div class="galley-tray"><svg viewBox="0 0 120 88" aria-hidden="true"><path fill="#bbbea3" d="M1 29h85v51H1z"/><path fill="#e7dfba" d="M7 35h73v37H7z"/><path fill="#8eaa62" d="M13 40h25v25H13z"/><path fill="#ca9b5e" d="M43 40h31v25H43z"/><path fill="#edd18b" d="M48 44h21v5H48z"/><path fill="#cce6d8" d="M93 18h22v58H93z"/><path fill="#72b6cc" d="M97 31h14v40H97z"/><path fill="#779398" d="M98 12h12v8H98z"/></svg><div><strong>Today’s breakfast</strong><small>${p.ate?'✓ Meal finished':'Warm vegetable ration - daily meal'}</small><small>${p.drank?'✓ Water finished':'Fresh drinking water'}</small></div></div><div class="galley-actions"><button id="galley-eat" ${p.ate?'disabled':''}>${p.ate?'✓ Meal finished':'Eat breakfast'}</button><button id="galley-drink" ${p.drank?'disabled':''}>${p.drank?'✓ Hydrated':'Drink water'}</button></div><p class="dialog-body">${both?'Feeling better. Next, check today’s weather at the screen beside the airlock.':'Take a moment for both food and water.'}</p>${actionButton(both?'Go to the weather screen':'Back to the cabin')}`);
    $('galley-eat').disabled=p.ate&&full||state.survival.food<10;
    $('galley-eat').textContent=state.survival.food<10?'Not enough food stock':p.ate&&full?'Fully fed & energized':p.ate?'Eat another meal':'Eat breakfast';
    document.querySelector('.galley-tray strong').textContent=`ENERGY ${Math.ceil(state.energy)}%`;
    document.querySelector('.galley-tray small').textContent='Meal: +40 energy · −10 food stock';
    $('galley-drink').disabled=p.drank||state.survival.water<15;
    $('galley-eat').onclick=()=>{C.eatMeal(state);save();updateHud();state.survival.warningPending?lowSupplyDialog():galleyDialog();};
    $('galley-drink').onclick=()=>{C.drinkWater(state);save();updateHud();state.survival.warningPending?lowSupplyDialog():galleyDialog();};
    $('dialog-action').onclick=()=>{closeDialog();if(both)walkToShipStation('weather');};
  }
  function weatherDialog(){
    const w=C.weatherFor(state.survival.day),p=state.preparation,canCheck=state.orbi.phase==='complete';
    const dataset=trainer.donki.data;
    showDialog('SPACESHIP · WEATHER & SPACE WEATHER',`<div class="weather-report"><div><span>SIMULATED MARS CONDITIONS</span><span>SOL ${number(w.sol)}</span></div><div class="weather-overview">${icon('sun')}<div><strong>${w.summary}</strong><small>${w.storm?'DANGER · FATAL SURFACE EXPOSURE':'GENERATED GAME WEATHER'}</small></div></div><div class="weather-metrics"><div><span>TEMPERATURE</span><strong>${w.temperature}°</strong><small>C</small></div><div><span>WIND</span><strong>${w.wind}</strong><small> km/h</small></div><div><span>VISIBILITY</span><strong>${w.visibility}</strong></div></div><p>${w.advice}</p></div><h1 id="dialog-title">${w.storm?'A day to stay inside.':'A look at the sky.'}</h1><p class="weather-source-note">NASA DONKI tracks solar activity, not Mars air temperature or wind. ${w.storm?`ORBI’s ${dataset.displayMode==='historical'?'historical':'dated'} NASA case includes real FLR, CME, SEP and notification records from ${dataset.range.startDate} to ${dataset.range.endDate}. The Mars storm timing and exposure hazard are simulated.`:'These atmospheric values are simulated. After checking the weather, learn the EMU with ORBI before your first EVA.'}</p><p class="dialog-body">${canCheck?w.storm?'Review the warning, then report to ORBI for the indoor solar-storm mission.':state.survival.day===1?'Review today’s conditions before the EMU lesson.':'Review today’s conditions before going outside.':state.orbi.phase==='complete'?'Have breakfast and drink water before finishing the weather check.':'ORBI will help you plan your day.'}</p>${actionButton(canCheck?'Confirm weather check':state.orbi.phase==='complete'?'Go to the galley':'Back to the cabin')}`);
    $('dialog-action').onclick=()=>{
      if(canCheck){
        C.checkWeather(state);save();closeDialog();updateHud();
        if(C.isStormDay(state.survival.day)){toast('Radiation storm active. Surface exposure can be fatal. ORBI has your shelter briefing.');openOrbi();}
        else if(state.survival.day===1&&!C.emuComplete(state)){
          showDialog('ORBI · BEFORE YOUR FIRST EVA',`<h1 id="dialog-title">First, learn your spacesuit.</h1><p class="dialog-body">Match the EMU components to their roles before opening the airlock. Complete the other preparation tasks in any order.</p>${actionButton('Learn & assemble the EMU','start-emu')}<button class="dialog-secondary" id="emu-later">Back to the cabin</button>`);
          $('start-emu').onclick=()=>openTraining('emu');$('emu-later').onclick=closeDialog;
        }else toast('Today’s weather is checked. Review your mission before heading out.');
      }
      else{closeDialog();if(state.orbi.phase==='complete')walkToShipStation('galley');}
    };
  }
  function openPowerPlan(){window.NOVAPowerUI(state,showDialog,()=>{save();updateHud();if(state.death)showDeath();else closeDialog();},()=>greenhouseDialog());}
  $('power-planner').onclick=()=>{if(!state.death)openPowerPlan();};
  function airlockDialog(){
    if(state.powerPlan.day!==state.survival.day){openPowerPlan();return;}
    if(!state.powerPlan.outdoor){showDialog('EMU NOT POWERED','<h1 id="dialog-title">Indoor Sol planned.</h1><p class="dialog-body">Your EMU has no electricity allocated today. Finish your indoor work and plan an EVA next Sol.</p>'+actionButton('Back to cabin'));$('dialog-action').onclick=closeDialog;return;}
    if(state.survival.day===1&&state.orbi.phase!=='complete'){
      showDialog('SPACESHIP · FIRST EVA PREPARATION',`<h1 id="dialog-title">Get your bearings first.</h1><p class="dialog-body">Follow the Earth call and speak with ORBI. Then have breakfast, check the weather and learn the EMU before going outside.</p>${actionButton('Back to the cabin')}`);$('dialog-action').onclick=closeDialog;return;
    }
    const next=C.nextPreparation(state);
    if(state.survival.day===1&&next){
      showDialog('SPACESHIP · PREPARE FOR THE DAY',`<div class="dialog-icon">${icon('rocket')}</div><h1 id="dialog-title">First, take care of yourself.</h1><p class="dialog-body">Before fieldwork, eat a meal, drink water, and check today’s weather. ORBI wants you to be ready.</p>${preparationList()}<button class="dialog-action" disabled><span>Step outside · Preparation needed</span></button><button class="dialog-secondary" id="prepare-next">${next.station==='galley'?'Go to the galley':'Go to the weather screen'}</button>`);
      if(next.id==='emu')$('prepare-next').textContent='Learn the EMU with ORBI';
      $('prepare-next').onclick=()=>{closeDialog();next.id==='emu'?openTraining('emu'):walkToShipStation(next.station);};return;
    }
    const storm=C.isStormDay(state.survival.day);
    showDialog('SPACESHIP · AIRLOCK',`<div class="dialog-icon">${icon('rocket')}</div><h1 id="dialog-title">${storm?'Radiation storm outside.':'The red world is waiting.'}</h1><p class="dialog-body">${storm?'The airlock is available. After 12 continuous seconds outside, storm exposure is fatal. Stay sheltered or return immediately.':state.survival.day>1?'You may leave before finishing preparation or today’s tasks. Watch your astronaut energy and suit oxygen.':'Your first EVA preparation is complete. Return through the landing pad whenever you need to.'}</p>${state.survival.day>1?preparationList():''}${actionButton('Step outside')}${storm?'<button class="dialog-secondary" id="stay-sheltered">Stay in the ship</button>':''}`);
    $('dialog-action').onclick=()=>changeLocation(false);
    if(storm)$('stay-sheltered').onclick=closeDialog;
  }
  function sleepDialog(){
    if(state.orbi.phase!=='complete'){
      showDialog('SPACESHIP · SLEEP POD',`<h1 id="dialog-title">This is where I woke up.</h1><p class="dialog-body">The pillow is still warm. Someone wanted you to survive this. First, find your bearings and talk to ORBI.</p>${actionButton('Keep looking')}`);
      $('dialog-action').onclick=closeDialog;return;
    }
    const status=C.restStatus(state),goals=C.dayGoals(state);
    showDialog(`END OF DAY ${state.survival.day} · SLEEP POD`,`<h1 id="dialog-title">A little rest, a new day.</h1><ul class="preflight-list">${goals.map(g=>`<li class="${g.done?'done':''}"><span>${g.done?'✓':'○'}</span>${g.label}</li>`).join('')}</ul><p class="dialog-body">${status.reason}</p><div class="dialog-stat">Food ${state.survival.food}% · Water ${state.survival.water}% · Your name and discoveries stay with you.</div><button class="dialog-action" id="sleep-next-day" ${status.allowed?'':'disabled'}><span>Sleep · Start Day ${state.survival.day+1}</span>${icon('arrow')}</button><button class="dialog-secondary" id="sleep-back">Back to the cabin</button>`);
    $('sleep-next-day').onclick=async()=>{
      if(sleeping||!C.restStatus(state).allowed)return;
      closeDialog();sleeping=true;stage.inert=true;
      clearTimeout(toastTimer);$('toast').hidden=true;
      const fade=document.createElement('div');
      fade.className='sleep-transition';fade.setAttribute('aria-hidden','true');
      document.body.append(fade);
      const duration=reducedMotion?150:1100;
      try{
        await fade.animate([{opacity:0},{opacity:1}],{duration,fill:'forwards',easing:'ease-in-out'}).finished;
        if(!C.startNextDay(state))return;
        keys.clear();path=[];target=null;targetStation=null;footsteps.length=0;facing='down';resize();updateHud();updateInteraction();save();render();
        await fade.animate([{opacity:1},{opacity:1}],{duration:reducedMotion?100:650,fill:'forwards'}).finished;
        await fade.animate([{opacity:1},{opacity:0}],{duration,fill:'forwards',easing:'ease-in-out'}).finished;
      }finally{
        fade.remove();sleeping=false;stage.inert=false;
      }
      showDialog(`DAY ${state.survival.day} · GOOD MORNING, ${C.playerName(state).toUpperCase()}`,`<h1 id="dialog-title">A new day on Mars.</h1><p class="dialog-body">${C.dayTitle(state)} Start with food, water, and today’s weather. Then: ${C.activeObjective(state).label.toLowerCase()}.</p>${actionButton('Start the day')}`);
      $('dialog-action').onclick=closeDialog;
    };
    $('sleep-back').onclick=closeDialog;
  }
  function interactShip(station) {
    if(state.ending.phase==='recalled'&&station.id==='earth-uplink'){earthDialog();return;}
    if(workDialog(station.id))return;
    if(station.id==='earth-uplink'){earthDialog();return;}
    if(station.id==='orbi'){openOrbi();return;}
    if(station.id==='galley'){galleyDialog();return;}
    if(station.id==='weather'){weatherDialog();return;}
    if(station.id==='airlock'){airlockDialog();return;}
    if(station.id==='ship-support'){
      const o=state.operations;
      showDialog('SPACESHIP - LIFE SUPPORT','<h1 id="dialog-title">Oxygen transfer station.</h1><p class="dialog-body">Install greenhouse canisters, then transfer oxygen from the reservoir to your suit. The solar array supplies spaceship power. Eat in the galley to restore astronaut energy.</p><div class="dialog-stat">Oxygen reserve: '+Math.round(o.oxygenReserve)+' / 300<br>Carried canisters: '+o.canisters+'<br>EMU oxygen: '+Math.ceil(state.oxygen)+'% | Astronaut energy: '+Math.ceil(state.energy)+'%</div><button class="dialog-action" id="install-canister" '+(o.canisters&&o.oxygenReserve<=220?'':'disabled')+'>Install oxygen canister (+80 reserve)</button><button class="dialog-secondary" id="refill-suit" '+(o.oxygenReserve>0&&state.oxygen<100?'':'disabled')+'>Charge EMU oxygen from life support</button>');
      $('install-canister').onclick=()=>{C.performOperation(state,'install-oxygen');save();updateHud();interactShip(station);};$('refill-suit').onclick=()=>{C.performOperation(state,'refill-oxygen');save();updateHud();interactShip(station);};return;
    }
    sleepDialog();
  }
  function interact(station = activeStation) {
    if (!station || isBlocked()) return;
    dismissWelcome(); chirp(440, .05);
    const id = station.id;
    if(insideRoom()){interactRoom(id);return;}
    if(insideShip()){interactShip(station);return;}
    if(id==='solar'&&C.isStormDay(state.survival.day)){
      showDialog('SOLAR ARRAY / STORM SHELTER','<h1 id="dialog-title">Leave the dust for a safer day.</h1><p class="dialog-body">Return to shelter. ORBI can care for the greenhouse remotely. Clean panels after the storm to improve the next Sol’s power for grow lights.</p>'+actionButton('Back to the outpost'));
      $('dialog-action').onclick=closeDialog;return;
    }
    if(id==='habitat'||id==='greenhouse'){enterRoom(id);return;}
    if(id==='crystals'){
      const o=state.operations,claimed=o.iceCollectedDay===state.survival.day,full=o.ice>=6;
      showDialog('ICE DEPOSIT - WATER SUPPLIES','<h1 id="dialog-title">Carry a little ice home.</h1><p class="dialog-body">Collect up to 3 ice crystals per Sol. Your cargo holds 6. Bring them to the habitat’s ICE TO WATER machine. Collecting ice does not fill the water tank.</p><div class="dialog-stat">Ice cargo: '+o.ice+' / 6 - Water: '+Math.round(state.survival.water)+'%</div>'+actionButton(claimed?'Collected this Sol':full?'Ice cargo is full':'Collect up to 3 ice crystals','collect-ice')+'<button class="dialog-secondary" id="ice-back">Back to exploring</button>');
      $('collect-ice').disabled=claimed||full;$('collect-ice').onclick=()=>{C.performOperation(state,'collect-ice');const job=C.dayGoals(state).find(g=>g.station==='crystals'&&g.kind==='work');if(job)C.performOperation(state,job.id);save();updateHud();closeDialog();toast('Ice loaded. Carry it to the habitat’s ICE TO WATER machine.');};$('ice-back').onclick=closeDialog;return;
    }
    if(workDialog(id))return;
    if(id==='solar'){showDialog('SOLAR ARRAY - MAINTENANCE','<h1 id="dialog-title">Brush away the storm dust.</h1><p class="dialog-body">Dusty panels generate less spaceship power. Clean them to increase generation from 70% to 100% of the daily solar forecast. Clear: 80 EU, normal: 60 EU, dusty: 35 EU, dust storm: 10 EU. Astronaut energy comes from meals.</p>'+actionButton(state.solarClean?'Panels are clean':'Clean solar panels'));$('dialog-action').onclick=()=>{C.performOperation(state,'solar');save();updateHud();closeDialog();};return;}
    if(id==='rover'&&state.survival.day>=5){showDialog('ROVER - DAILY SURVEY','<h1 id="dialog-title">A new set of discoveries.</h1><p class="dialog-body">Transfer the latest survey to the habitat archive.</p>'+actionButton(state.operations.roverDay===state.survival.day?'Data already archived':'Download rover data'));$('dialog-action').onclick=()=>{C.performOperation(state,'rover');save();updateHud();closeDialog();};return;}
    if(id==='storage'){
      const claimed=state.survival.storageClaimedDay===state.survival.day;
      showDialog('EXPLORATION · FOOD STORAGE',`<div class="dialog-icon">${icon('home')}</div><h1 id="dialog-title">Something to live on.</h1><p class="dialog-body">Sealed food crates. The depot’s automated stores can prepare one supply load each day. You won’t have to face this planet on an empty stomach.</p><div class="supply-alert"><strong>FOOD ${state.survival.food}% · WATER ${state.survival.water}%</strong><p>${claimed?'Today’s supplies are loaded. Come back on the next day.':'Collect up to +70% food. Water comes from ice processed at the habitat. Reserves hold up to 100% each.'}</p></div>${actionButton(claimed?'Back to exploring':'Load food rations','storage-collect')}`);
      $('storage-collect').onclick=()=>{if(!claimed)C.collectSupplies(state);save();updateHud();closeDialog();toast('Food secured. Collect ice and process it at the habitat for water. Explore the outpost, then return to your sleep pod when the day is done.');};return;
    }
    if(id==='rocket'){
      const canFinish=false;
      showDialog('LANDING PAD · NOVA SPACESHIP',`<div class="dialog-icon">${icon('rocket')}</div><h1 id="dialog-title">Back aboard?</h1><p class="dialog-body">Your spaceship’s airlock is open. Explore the cabin, top up your suit, or use the Earth communications screen.</p><div class="dialog-stat">${icon('home')}Earth: ${C.earthStatus(state).toLowerCase()} · Cabin accessible</div>${actionButton('Enter spaceship')}${canFinish?'<button class="dialog-secondary" id="finish-expedition"><span>Complete the expedition</span></button>':'<button class="dialog-secondary" id="stay-outside">Stay outside</button>'}`);
      $('dialog-action').onclick=()=>changeLocation(true);
      if(canFinish)$('finish-expedition').onclick=()=>perform('rocket',stationCopy.rocket.message,'finish-expedition');
      else $('stay-outside').onclick=closeDialog;
      return;
    }
    if (id === 'rover') {
      showDialog('EXPLORATION · ROVER', `<div class="dialog-icon">${icon('bolt')}</div><h1 id="dialog-title">A trusty little companion.</h1><p class="dialog-body">The rover has been out exploring while you settled in. ${state.rover ? 'Its survey is safely downloaded. The little explorer is enjoying a well-earned recharge.' : 'Its latest survey holds two mineral samples.'}</p><div class="dialog-stat">${icon('crystal')}${state.rover ? 'Survey downloaded · All clear' : '+2 mineral samples · Survey data'}</div>${actionButton(state.rover ? 'Back to exploring' : 'Download the rover survey')}`);
      $('dialog-action').onclick = state.rover ? closeDialog : () => perform(id, 'Rover survey downloaded. Two bonus samples collected.'); return;
    }
    if (id === 'flag') {
      showDialog(`PERSONAL LOG · DAY ${state.survival.day}`, `<div class="dialog-icon">${icon('pin')}</div><h1 id="dialog-title">A very long way from home.</h1><p class="dialog-body">“The sky here is different. The silence, too. But the outpost is beginning to feel familiar, and for a moment, the distance doesn’t seem so big.”</p><div class="dialog-stat">${icon('book')}${state.flag ? 'Personal log recorded' : 'A moment worth remembering'}</div>${actionButton(state.flag ? 'Back to exploring' : 'Record a personal log')}`);
      $('dialog-action').onclick = state.flag ? closeDialog : () => perform(id, 'Personal log recorded. A moment of Mars, kept forever.'); return;
    }
    const copy = stationCopy[id], complete = state.tasks[id], allowed = C.canComplete(state, id);
    let body = copy.body, stat = copy.stat, action = copy.action;
    if (complete) {
      body = { solar: 'The panels are clean and quietly turning sunlight into electricity. Your little outpost has all the power it needs.', greenhouse: 'The leaves are green, the air is fresh, and life is finding a way. Collect oxygen canisters here and install them at ship life support.', crystals: 'You’ve gathered the samples from this deposit. Its quiet blue glow is a reminder that there’s still so much to discover.', habitat: 'The uplink is clear. Earth has your research, and your habitat is humming along. Check the systems inside, and refill your suit at ship life support.', rocket: 'Your first expedition is complete. The outpost is thriving. Take your time exploring — this is your home now.' }[id];
      stat = 'System checked · All good here';
      action = id === 'greenhouse' || id === 'habitat' ? 'Replenish suit oxygen' : 'Back to exploring';
    }
    showDialog(copy.eyebrow, `<div class="dialog-icon">${icon(copy.icon)}</div><h1 id="dialog-title">${copy.title}</h1><p class="dialog-body">${body}</p><div class="dialog-stat">${icon(complete ? 'check' : copy.icon)}<span>${stat}</span></div>${actionButton(action)}`);
    $('dialog-action').onclick = !allowed || complete && !['greenhouse', 'habitat'].includes(id) ? closeDialog : () => perform(id, complete ? 'Suit oxygen replenished. Take a breath.' : copy.message);
  }
  $('interact-prompt').addEventListener('click', () => interact());

  function showMissions() {
    if(state.death||['transmission','zoom','complete'].includes(state.ending.phase))return;
    if (busy) return;
    dismissWelcome();
    const current=currentTask(),goals=C.dayGoals(state),done=goals.every(g=>g.done)&&current.id==='rocket';
    const rows=goals.map((g,i)=>`<li class="${g.done?'completed':'current'}" data-goal="${g.id}" tabindex="0" role="button"><span class="number">${g.done?'✓':number(i+1)}</span><span><strong>${g.label}</strong><small>${g.id==='explore'?`${state.survival.visited.filter(id=>id!=='storage').length} locations visited`:g.station==='storage'?'Follow the marker to the warehouse. Load food and water there.':'Follow the station marker, then return to the spaceship.'}</small></span></li>`).join('');
    const places=!insideShip()?`<div class="station-index">${C.stations.map(s=>`<button data-station="${s.id}"><span>${s.name}</span><small>${state.survival.visited.includes(s.id)?'VISITED':'EXPLORE'}</small></button>`).join('')}</div>`:'';
    showDialog(`DAY ${state.survival.day} · MISSION LOG`,`<h1 id="dialog-title">${C.dayTitle(state)}</h1><p class="dialog-body">${state.survival.day===1?'Today is about finding your way around. Food and water are scarce. Find storage, visit other outpost locations, and return to the ship to rest.':'Prepare for the day, complete your fieldwork, and return to the sleep pod when you’re ready for tomorrow.'} Complete tasks in any order. Select any task below to find its station; finish every task before sleeping.</p><ul class="journal-list">${rows}</ul><p class="journal-meta">FOOD ${state.survival.food}% · WATER ${state.survival.water}% · ${missionCount()} / 5 OUTPOST SYSTEMS RESTORED</p>${places}${actionButton(done&&insideShip()?'Go to the sleep pod':'Show my next destination')}`);
    $('dialog-action').onclick=()=>{
      closeDialog();
      if(insideRoom()){const goal=state.survival.water<C.waterNeededForRest(state)&&state.operations.ice>0?{station:'habitat',id:'process-ice'}:C.dayGoals(state).find(g=>!g.done);const id=goal?.station!==state.location?'room-exit':goal.id==='process-ice'?'ice-processor':goal.id==='collect-oxygen'?'oxygen-canister':goal.id==='harvest'?'lettuce':goal.id==='plant'?'seed':goal.id==='irrigation-test'?'irrigation':goal.id.replace('check-','');const next=roomStations().find(st=>st.id===id);if(next)setDestination({x:next.ax,y:next.ay},next);return;}
      const s=insideShip()?C.shipStations.find(s=>s.id===((state.ending.phase==='recalled'?'earth-uplink':C.nextPreparation(state)?.station)||(done?'sleep-pod':C.shipStations.some(st=>st.id===current.id)?current.id:'airlock'))):C.stations.find(s=>s.id===current.id);
      setDestination({x:s.ax,y:s.ay},s);
    };
    for(const button of dialog.querySelectorAll('[data-station]'))button.onclick=()=>{const s=C.stations.find(s=>s.id===button.dataset.station);closeDialog();setDestination({x:s.ax,y:s.ay},s);};
    for(const row of dialog.querySelectorAll('[data-goal]')){
      const select=()=>{
        const goal=goals.find(g=>g.id===row.dataset.goal);if(goal.done){toast('This task is already complete.');return;}
        selectedGoal={day:state.survival.day,id:goal.id};closeDialog();updateHud();
        let station;
        if(insideShip())station=C.shipStations.find(s=>s.id===goal.station)||C.shipStations.find(s=>s.id==='airlock');
        else if(insideRoom()){
          const consoleId=goal.id.startsWith('check-')?goal.id.slice(6):{'greenhouse-care':'lettuce','collect-oxygen':'oxygen-canister','irrigation-test':'irrigation',harvest:'lettuce',plant:'seed'}[goal.id];
          station=roomStations().find(s=>s.id===(goal.station===state.location?consoleId:'room-exit'))||roomStations().find(s=>s.id==='room-exit');
        }else station=C.stations.find(s=>s.id===goal.station)||C.stations.find(s=>s.id==='rocket');
        setDestination({x:station.ax,y:station.ay},station);
      };
      row.onclick=select;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};
    }
  }
  $('day-journal').addEventListener('click',showMissions);
  function showGuide() {
    if(state.death||['transmission','zoom','complete'].includes(state.ending.phase))return;
    if (busy) return;
    showDialog('FIELD GUIDE · GETTING YOUR BEARINGS', `<div class="dialog-icon">${icon('book')}</div><h1 id="dialog-title">A small guide to a big planet.</h1>
      <p class="dialog-body">${insideShip()?'Prepare with breakfast, water, and the weather screen. Day 1 also requires ORBI’s EMU matching lesson before leaving. From Day 2 onward you may leave with unfinished tasks. Storm exposure is fatal after 12 continuous seconds outside. Tap the checklist or ORBI’s TV for your next step.':'Explore the desert and follow the day’s objective marker. Return through the rocket’s airlock, then rest in the ship to begin the next day.'}</p>
      <p class="dialog-body">Oxygen use: standing &lt; walking &lt; running outside. Walking uses astronaut energy; running uses it faster. Eat meals for energy. Stored food does not feed you automatically. Clean panels supply more spaceship power. Zero astronaut energy, zero oxygen outside, less than ${C.Power.modes.Critical.habitat} EU for habitat life support, exhausted EMU power outside, or 12 seconds in a surface storm is fatal.</p><div class="guide-row"><span>Move your astronaut</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows</span></div>
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
    if(state.death||['transmission','zoom','complete'].includes(state.ending.phase))return;
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
      document.body.classList.remove('ending-cinematic');zoom=preferences.zoom;
      closeDialog();syncIntro();resize(); updateHud(); updateCamera(); save();render();
    };
    $('cancel-reset').onclick = () => { if(state.death)showDeath();else if(state.ending.phase==='complete')endingDialog();else closeDialog(); };
  }
  function showSuccess() {
    showDialog('EXPEDITION 004 · COMPLETE', `${resultArt(true)}<div class="success-stars" aria-hidden="true">✦ ✧ ✦</div><h1 id="dialog-title">One small outpost.<br>One giant beginning.</h1><p class="dialog-body">You brought power, a little green, and a new discovery to a quiet corner of Mars. That’s a pretty good beginning.</p><div class="dialog-stat">${icon('check')}Day ${state.survival.day} · 5 / 5 missions · ${number(state.samples)} samples</div>${actionButton('Stay a little longer')}<button class="dialog-secondary" id="new-expedition">Begin a new expedition</button>`);
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
    if(sleeping){event.preventDefault();return;}
    if(state.death||['zoom','complete'].includes(state.ending.phase))return;
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
