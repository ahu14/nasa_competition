window.NOVAPowerUI=function(s,show,done,garden){
 const P=window.NOVAPower,C=window.NOVACore,locked=s.powerPlan.day===s.survival.day&&s.powerPlan.exposure>0;
 const needsEVA=C.dayGoals(s).some(g=>!g.done&&!C.shipStations.some(st=>st.id===g.station));
 let choice={modes:{...s.powerPlan.modes},outdoor:locked?s.powerPlan.outdoor:needsEVA};
 function render(){
  const r=P.project(s,choice),minimum=P.modes.Critical.habitat,fatal=r.available<minimum;
  show('ORBI’S ENERGY LAB · SOL '+s.survival.day,`<div class="power-lab">
   <h1 id="dialog-title">A little power. A clever plan!</h1><p>One shared battery powers our home. Choose how to use it today.</p>
   <div class="power-battery"><strong>▰ ${Math.round(s.power)} / 100 EU</strong><progress max="100" value="${s.power}"></progress></div>
   <div class="power-weather">☀ ${r.weather.name} · ${r.weather.eu} EU sunlight<br><small>${s.solarClean?'Clean panels collect it all.':'Dusty panels collect 70%. Clean them for future Sols.'} Actual recharge: ${r.generation.toFixed(0)} EU</small></div>
   ${['greenhouse','habitat','emu'].map((k,i)=>`<section class="power-system">
    <h2>${['🌱 Greenhouse','🏠 Habitat','🚀 EMU suit'][i]} <b>${r.costs[k]} EU</b></h2>
    <label>Operating mode <select data-system="${k}" ${locked?'disabled':''}>${Object.keys(P.modes).map(m=>`<option ${choice.modes[k]===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <progress max="${[30,40,20][i]}" value="${r.costs[k]}"></progress>
    <p>${k==='greenhouse'?`Plant health ${Math.round(s.greenhouse.health)}% · Tray maturity ${Math.round(s.greenhouse.trays.filter(t=>!t.harvested).reduce((sum,t)=>sum+Math.min(100,t.age/35*100),0)/3)}%. Normal provides full grow light; Reduced provides 60%; Critical provides 27%. Water and nutrients also affect growth and health. Changes happen overnight.`:k==='habitat'?`Normal: full comfort. Reduced: dim lights. Critical: only essential air, heat and water. Life support needs at least ${minimum} EU each Sol. Less is fatal. Save battery power for consecutive storm days.`:`Powered only for an EVA. Normal: 240s outdoors; Reduced: 150s; Critical: 75s. Time is shared across all trips today. Shortfalls shorten it further. Running out of EMU power outside is fatal; return to shelter before time runs out.`}</p>
   </section>`).join('')}
   <label class="power-eva"><input id="plan-eva" type="checkbox" ${choice.outdoor?'checked':''} ${locked||needsEVA?'disabled':''}> Plan an outdoor expedition ${needsEVA?'(needed for today’s mission)':''}</label>
   <div class="power-equation">${Math.round(s.power)} battery + ${r.generation.toFixed(0)} sun → ${r.available.toFixed(0)} usable (including reserved electricity)<br>− ${r.total} systems = <strong>${r.remaining.toFixed(0)} EU left</strong><small>Capacity: 100 EU. ${r.spill.toFixed(0)} EU overflow cannot be stored. Reserved electricity still powers your systems when the battery shows 0 EU left.</small></div>
   ${fatal?`<p class="power-alert" role="alert">⚠ FATAL POWER SHORTAGE: only ${r.available.toFixed(1)} EU is available. Habitat life support needs ${minimum} EU. Confirming this plan will end the expedition.</p>`:r.shortfall?`<p class="power-alert">⚠ ${r.shortfall.toFixed(0)} EU short! Habitat gets power first, then EMU, then plants. Try Reduced modes or an indoor Sol. Plants can recover with better power tomorrow.</p>`:'<p class="power-good">★ Your plan has enough electricity!</p>'}
   <button id="power-garden" class="dialog-secondary">Inspect greenhouse / remote care</button>
   <button id="confirm-power" class="dialog-action">${locked?'Back to exploring':fatal?'Confirm fatal power plan':'Confirm my Sol plan'}</button>
   <p><small>${locked?'Today’s electricity is already reserved. Plan again tomorrow.':'Sunlight is collected once per Sol. You may rebalance reserved power before your first EVA.'}</small></p>
  </div>`);
  document.getElementById('power-garden').onclick=garden;
  document.querySelectorAll('[data-system]').forEach(el=>el.onchange=()=>{choice.modes[el.dataset.system]=el.value;render();});
  document.getElementById('plan-eva').onchange=e=>{choice.outdoor=e.target.checked;render();};
  document.getElementById('confirm-power').onclick=()=>{if(locked||P.confirm(s,choice))done();};
 }
 render();
};
