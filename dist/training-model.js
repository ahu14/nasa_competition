/* Educational models: these are teaching rules, not flight or radiation forecasts. */
(function(root){
  'use strict';
  const sources={
    emu:'https://www.nasa.gov/centers-and-facilities/johnson/spacewalk-spacesuit-basics/',
    shelter:'https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/',
    radiation:'https://www.nasa.gov/technology/five-questions-about-space-weather-and-its-effects-on-earth-answered/',
    mars:'https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/',
    donki:'https://ccmc.gsfc.nasa.gov/DONKI/api/'
  };
  const emuParts=[
    {id:'cooling',name:'Cooling garment',short:'Cooling',role:'Carry body heat away',number:1,color:'#8fcbd1',science:'Water circulating through tubes in the liquid cooling and ventilation garment carries away body heat.',source:sources.emu},
    {id:'torso',name:'Hard upper torso',short:'Upper torso',role:'Join the suit’s main assemblies',number:2,color:'#dfc7a0',science:'The hard upper torso provides structure and connects the arms and other suit assemblies to the life-support system.',source:sources.emu},
    {id:'helmet',name:'Helmet & visor',short:'Helmet',role:'Protect the head and provide a view',number:3,color:'#f0bb73',science:'The helmet is part of the pressure enclosure; its visor assembly helps protect the eyes and face.',source:sources.emu},
    {id:'gloves',name:'Gloves',short:'Gloves',role:'Protect hands while using tools',number:4,color:'#bccda8',science:'Spacesuit gloves protect the hands while preserving the dexterity needed to handle tools.',source:sources.emu},
    {id:'legs',name:'Lower torso & boots',short:'Legs & boots',role:'Cover the legs and allow movement',number:5,color:'#bbbddd',science:'The lower torso includes the waist, legs and boots, with joints that allow the astronaut to move.',source:sources.emu},
    {id:'plss',name:'Primary life support (PLSS)',short:'Life support',role:'Supply oxygen and remove exhaled CO₂',number:6,color:'#93c4ab',science:'The backpack supplies oxygen, removes exhaled carbon dioxide, circulates cooling water and provides electrical power.',source:sources.emu}
  ];
  const stormDecisions=[
    {id:'eva',title:'An EVA was scheduled. Do you go?',context:'ORBI’s simulated local radiation monitor has triggered a storm alert. You planned to clean solar panels today.',choices:[
      {id:'shelter',label:'Postpone the EVA. Stay inside the shelter.',correct:true,science:'Reducing time outside and using a better-shielded area reduces potential exposure to solar energetic particles. Ordinary EMU protection is not a substitute for a storm shelter.',outcome:'Training outcome: EVA postponed; simulated exposure avoided.',source:sources.radiation},
      {id:'suit',label:'Put on the EMU and finish the solar repair.',correct:false,science:'An EMU maintains pressure, breathing and temperature control. It does not make an intense solar-particle event safe for an EVA.',outcome:'Training outcome: this plan would increase exposure. Try a sheltered plan.',source:sources.emu},
      {id:'night',label:'Go out after sunset; darkness will block it.',correct:false,science:'Energetic charged particles are not ordinary visible sunlight. Nightfall alone is not evidence that a radiation hazard has ended.',outcome:'Training outcome: waiting for darkness does not establish safety.',source:sources.mars}
    ]},
    {id:'signals',title:'What does the NASA record actually tell you?',context:'The console shows FLR, CME and SEP entries. Their timestamps and observing spacecraft belong to the real NASA records.',choices:[
      {id:'local',label:'Check where particles were measured; use local monitoring for Mars.',correct:true,science:'A DONKI SEP entry reports particles observed by its listed instrument. An Earth or other spacecraft observation is not a Mars surface dose measurement; location and propagation matter.',outcome:'Training outcome: evidence kept separate from the simulated Mars alert.',source:sources.donki},
      {id:'speed',label:'Use the CME speed as the wind speed outside the ship.',correct:false,science:'A CME analysis describes an eruption moving through interplanetary space. Its speed is not the speed of atmospheric wind at the Martian surface.',outcome:'Training outcome: space weather and atmospheric weather were confused.',source:sources.donki},
      {id:'arrival',label:'Any recorded flare means a storm reaches Mars tomorrow.',correct:false,science:'A flare record alone does not establish the direction, magnetic connection or arrival time of energetic particles at Mars.',outcome:'Training outcome: a fixed next-day arrival would be an unsupported forecast.',source:sources.mars}
    ]},
    {id:'shielding',title:'Where should Mira wait?',context:'The ship has an interior refuge and sealed food and water packs. Keep exits, ventilation and equipment access clear.',choices:[
      {id:'mass',label:'Use the inner refuge and approved food/water shielding layout.',correct:true,science:'NASA studies storm shelters using existing spacecraft mass, including food and water supplies. Added shielding can reduce some particle exposure; this game does not calculate a radiation dose.',outcome:'Training outcome: the simulated crew moves to the protected refuge.',source:sources.shelter},
      {id:'window',label:'Wait beside the window to watch the Sun.',correct:false,science:'A view of the Sun provides no radiation protection. A location with more shielding between the crew and incoming particles is preferable.',outcome:'Training outcome: the window is not the designated storm refuge.',source:sources.shelter},
      {id:'poweroff',label:'Switch off life support so radiation cannot enter.',correct:false,science:'Powering down life support does not stop penetrating particles and removes essential breathing and thermal support. Protect the crew while maintaining vital systems.',outcome:'Training outcome: this would create a separate life-support hazard.',source:sources.radiation}
    ]},
    {id:'clearance',title:'When is the next EVA allowed?',context:'The exercise is almost complete. A NASA event listing or the end of a flare is not an operational all-clear for this outpost.',choices:[
      {id:'monitor',label:'Keep sheltering today; require local checks and EVA clearance.',correct:true,science:'Particle conditions can outlast a flare and vary by location. Continued monitoring and mission procedures, rather than an arbitrary timer, guide operational decisions.',outcome:'Training outcome: stay sheltered today. Finish the drill and today’s missions, then rest for the next day.',source:sources.radiation},
      {id:'timer',label:'Wait five minutes and unlock the airlock.',correct:false,science:'A fixed five-minute delay is not a particle-radiation forecast. The training timer cannot establish a real-world safe exposure window.',outcome:'Training outcome: an arbitrary timer cannot issue an all-clear.',source:sources.donki},
      {id:'empty',label:'No fresh API entries means it is safe outside.',correct:false,science:'Missing or delayed records are an information gap. They are not evidence that local radiation levels are safe.',outcome:'Training outcome: offline data is not an all-clear.',source:sources.donki}
    ]}
  ];
  const api={sources,emuParts,stormDecisions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NOVATrainingModel=api;
})(typeof window!=='undefined'?window:globalThis);
