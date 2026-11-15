(function(root){
  'use strict';
  // A teaching model, not a crop forecast. Each Sol advances at most one
  // effective growing day. These romaine trays were planted before arrival.
  const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
  const fresh=()=>({water:80,nutrients:80,health:100,packets:6,inspectedDay:0,settledDay:0,lowLightDays:0,report:null,trays:[30,26,22].map(age=>({age,plantedDay:1,harvested:false}))});
  function normalize(raw){
    const g=fresh();if(!raw||typeof raw!=='object')return g;
    for(const k of ['water','nutrients','health'])if(Number.isFinite(raw[k]))g[k]=clamp(raw[k]);
    for(const k of ['packets','inspectedDay','settledDay','lowLightDays'])if(Number.isFinite(raw[k]))g[k]=Math.floor(clamp(raw[k],0,k==='packets'?6:99999));
    if(Array.isArray(raw.trays)&&raw.trays.length===3)g.trays=raw.trays.map((t,i)=>({age:Number.isFinite(t?.age)?clamp(t.age,0,60):g.trays[i].age,plantedDay:Number.isFinite(t?.plantedDay)?Math.floor(clamp(t.plantedDay,1,99999)):1,harvested:t?.harvested===true}));
    if(raw.report&&['light','growth','healthChange'].every(k=>Number.isFinite(raw.report[k])))g.report={light:clamp(raw.report.light),growth:clamp(raw.report.growth,0,1),healthChange:clamp(raw.report.healthChange,-100,100)};
    return g;
  }
  function light(s){
    if(s.powerPlan.day!==s.survival.day)return 0;
    // LED light comes from electricity reserved by the shared solar planner.
    return clamp(s.powerPlan.allocation.greenhouse/30*100);
  }
  const stage=t=>t.harvested?'Empty tray':t.age<3?'Germinating':t.age<10?'Seedling':t.age<24?'Young leaves':t.age<35?'Leafy rosette':'Harvest ready';
  const ready=(g,t)=>!t.harvested&&t.age>=35&&g.health>=40;
  function settle(s){
    const g=s.greenhouse;if(!g||g.settledDay>=s.survival.day)return;
    const brightness=light(s),active=g.trays.some(t=>!t.harvested);
    const growth=active&&g.health>=20?Math.min(clamp(g.water/30,0,1),clamp(g.nutrients/25,0,1),brightness/100)*g.health/100:0;
    const before=g.health;
    if(active){
      g.lowLightDays=brightness<40?g.lowLightDays+1:0;
      g.health=clamp(g.health+(g.water<20?-12:0)+(g.nutrients<15?-10:0)+(brightness<40?-6:brightness>=60&&g.water>=30&&g.nutrients>=25?6:0));
      for(const t of g.trays)if(!t.harvested)t.age=Math.min(60,t.age+growth);
      g.water=clamp(g.water-12);g.nutrients=clamp(g.nutrients-8);
    }
    g.report={light:brightness,growth,healthChange:g.health-before};g.settledDay=s.survival.day;
  }
  function care(s,action,index){
    const g=s.greenhouse;
    if(s.death||!s.introComplete||!['ship','greenhouse'].includes(s.location)||s.orbi.phase!=='complete')return false;
    if(action==='inspect'){g.inspectedDay=s.survival.day;return true;}
    if(action==='water'&&g.water<=60&&s.survival.water>=5){s.survival.water-=5;g.water=clamp(g.water+40);return true;}
    if(action==='nutrients'&&g.nutrients<=60&&g.packets>0){g.nutrients=clamp(g.nutrients+40);g.packets--;return true;}
    const t=g.trays[index];if(!t)return false;
    if(action==='harvest'&&s.location==='greenhouse'&&ready(g,t)){
      s.survival.food=clamp(s.survival.food+Math.round(20*g.health/100));t.harvested=true;s.operations.harvestDay=s.survival.day;return true;
    }
    if(action==='plant'&&s.location==='greenhouse'&&t.harvested&&s.operations.seeds>0){
      s.operations.seeds--;t.age=0;t.plantedDay=s.survival.day;t.harvested=false;s.operations.plantDay=s.survival.day;return true;
    }
    return false;
  }
  const lessons=[
    ['Water','Roots take up water. Water helps carry dissolved nutrients and keeps leaves firm. Our loop reuses water, but we still need to top it up.'],
    ['Nutrients','Plants need minerals to build healthy roots and leaves. In this greenhouse, measured nutrient solution feeds the roots. More is not always better!'],
    ['Light','Leaves use light to make sugars from water and carbon dioxide. This is photosynthesis. Dim lamps mean slower growth; many dim days can weaken plants.'],
    ['Food far from Earth','Fresh crops can add variety and nutrients to stored meals. Long missions cannot depend on frequent deliveries from Earth. Lettuce helps, but it is only part of a balanced menu.'],
    ['A garden on Mars','Mars is cold, has very thin air, and exposes plants to radiation. Our sealed, shielded greenhouse controls air, warmth and water instead of planting lettuce in the open ground.'],
    ['Sun to salad','Solar panels charge the shared battery. The battery powers our grow lights. Dust storms reduce generation in this game. Save power, care for plants remotely, then clean panels when the storm ends.']
  ];
  const api={fresh,normalize,light,stage,ready,settle,care,lessons};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NOVAGreenhouse=api;
})(typeof window!=='undefined'?window:globalThis);
