/* A code-drawn pixel-art spaceship cabin for the opening story scene. */
(() => {
  'use strict';
  class WakeupScene {
    static lines = [
      {thought:'Who am I?',detail:'I can’t even remember my own name.'},
      {thought:'Where… am I?',detail:'A spaceship? How did I get here?'},
      {thought:'Everything is gone.',detail:'My name. My past. Nothing but a blank.'},
      {thought:'I need answers.',detail:'Maybe there’s something in this ship that can help.'}
    ];
    constructor(landscape,character,orbiImage) {
      this.character=character;this.orbiImage=orbiImage;this.room=document.createElement('canvas');this.room.width=1100;this.room.height=840;
      const p=this.room.getContext('2d');p.imageSmoothingEnabled=false;
      const r=(x,y,w,h,color)=>{p.fillStyle=color;p.fillRect(x,y,w,h);};
      const poly=(points,color)=>{p.fillStyle=color;p.beginPath();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();p.fill();};
      r(0,0,1100,840,'#101b29');
      poly([[95,70],[1005,70],[1060,125],[1060,735],[1005,790],[95,790],[40,735],[40,125]],'#0b1420');
      poly([[104,84],[996,84],[1044,133],[1044,723],[996,774],[104,774],[56,723],[56,133]],'#506879');
      r(82,258,936,474,'#263a48');
      for(let y=266;y<738;y+=48)for(let x=90;x<1010;x+=64){r(x,y,61,45,(x/64+y/48)%3<1?'#304654':'#2d414f');r(x+2,y+2,57,2,'#3a515d');}
      r(80,237,940,18,'#172937');r(90,255,920,4,'#91a99d');
      for(let x=106;x<1010;x+=146){r(x,96,132,139,'#617c8b');r(x+5,102,121,6,'#8ea4ac');r(x+5,219,121,7,'#3c5567');}
      const windowAt=(x,y,w,h,view)=>{
        r(x-8,y-8,w+16,h+16,'#182735');r(x-4,y-4,w+8,h+8,'#9aafb3');r(x,y,w,h,'#203c4b');
        p.save();p.beginPath();p.rect(x+6,y+6,w-12,h-12);p.clip();
        p.drawImage(landscape,landscape.naturalWidth*view,0,landscape.naturalWidth*.25,landscape.naturalHeight*.085,x+6,y+6,w-12,h-12);
        r(x+6,y+6,w-12,5,'#9ed4db');p.globalAlpha=.15;poly([[x+15,y+6],[x+42,y+6],[x+w-28,y+h-6],[x+w-52,y+h-6]],'#bde4ec');p.restore();
        r(x+w/2-3,y,6,h,'#253d4b');r(x,y+h-5,w,5,'#2b424e');
      };
      windowAt(184,126,194,91,0);windowAt(440,105,220,108,.35);windowAt(722,126,194,91,.75);
      r(405,225,290,29,'#243c49');p.font='bold 13px Consolas,monospace';p.fillStyle='#adc2b8';p.textAlign='center';p.fillText('N O V A   /   FLIGHT DECK',550,245);
      // An open sleep pod, with a pillow, blankets, and a lowered glass canopy.
      r(267,330,225,291,'#182734');r(277,320,205,285,'#839aa2');r(287,329,185,263,'#b9c7c5');r(299,345,161,230,'#506c79');
      r(310,351,139,53,'#d5ded4');r(317,356,125,8,'#eff2dc');r(310,412,139,149,'#6f9ca5');r(317,417,125,6,'#97c2c2');
      for(let y=432;y<558;y+=26)r(315,y,129,3,'#5b8394');r(277,587,205,17,'#506777');r(284,604,191,10,'#1d3544');
      r(283,337,7,205,'#d6a366');r(462,337,7,205,'#88babe');
      poly([[252,307],[270,297],[459,297],[474,311],[474,325],[267,325],[252,316]],'#749aab');r(276,302,174,5,'#bad9d5');
      r(290,624,181,8,'#172b39');r(306,631,148,5,'#526671');
      // Consoles frame the room without revealing the protagonist's identity.
      const consoleAt=(x,y,w,label,screen)=>{
        r(x+7,y+11,w,153,'#172735');r(x,y,w,149,'#6b8391');r(x+7,y+7,w-14,98,'#1c2c3c');r(x+15,y+15,w-30,71,screen);r(x+17,y+18,w-34,3,'#84c8cc');
        p.textAlign='left';p.font='9px Consolas,monospace';p.fillStyle='#b7e4d0';p.fillText(label,x+24,y+37);
        r(x+24,y+50,w-61,3,'#5b9e9b');r(x+24,y+60,w-78,3,'#5b9e9b');r(x+24,y+70,w-54,3,'#5b9e9b');
        for(let i=0;i<5;i++){r(x+17+i*24,y+116,15,13,'#233a48');r(x+19+i*24,y+118,11,5,i===0?'#e9a15b':'#8cb3b4');}
        r(x+10,y+139,w-20,4,'#8fa1a3');
      };
      consoleAt(90,315,163,'LIFE SUPPORT','#2b555d');consoleAt(735,307,190,'EARTH UPLINK','#274951');
      r(790,482,112,17,'#1b2f3e');r(810,499,72,18,'#4b6472');r(787,516,118,9,'#172a37');
      // Loose supplies, wall vents, and an airlock leading to the Martian surface.
      r(130,546,97,79,'#172b39');r(136,539,84,78,'#8e9c9b');r(144,547,67,61,'#b4bcb1');r(144,570,67,13,'#dc9b56');r(169,553,16,48,'#6b8089');
      for(let x=102;x<225;x+=13)r(x,667,7,21,'#172d3d');for(let x=829;x<955;x+=13)r(x,667,7,21,'#172d3d');
      r(467,695,166,66,'#172936');r(475,701,150,45,'#4d6570');r(485,709,130,6,'#92b4b2');r(485,725,130,4,'#233c49');
      for(let x=480;x<620;x+=28){r(x,753,17,5,'#e4aa6f');r(x,765,17,4,'#9a764d');}
      p.textAlign='center';p.font='10px Consolas,monospace';p.fillStyle='#bac6b6';p.fillText('A I R L O C K',550,688);
      r(61,266,12,432,'#90a5a7');r(1027,266,12,432,'#90a5a7');r(65,278,4,72,'#a4d9d4');r(1030,278,4,72,'#a4d9d4');
      r(524,558,64,6,'#1c303d');r(518,565,76,3,'#324c57');
      // ORBI has a separate, local-only television beside the sleep pod.
      r(549,299,174,132,'#142735');r(542,288,174,132,'#6b8590');r(549,295,160,107,'#172b3a');r(555,301,148,94,'#214851');
      r(554,293,150,3,'#a7c3bd');r(554,405,110,6,'#a7bbb1');r(686,405,9,6,'#d79d65');r(622,420,14,14,'#4e6975');r(587,434,84,9,'#192e3c');
      // Breakfast counter: a meal tray, cutlery, and a water dispenser.
      r(276,702,175,49,'#172d39');r(270,690,175,50,'#8d9a95');r(270,690,175,31,'#c0c6aa');r(274,692,167,4,'#e2dfbc');r(281,725,153,6,'#526f76');
      r(392,652,44,59,'#263e4c');r(397,657,34,42,'#a2d1ca');r(401,662,26,17,'#80b9ce');r(401,685,9,8,'#4d7584');r(415,687,10,8,'#e2c17d');
      r(281,700,7,15,'#6f8581');r(294,700,3,15,'#6f8581');r(302,701,4,14,'#6f8581');
      // A weather screen next to the airlock, independent of the broken uplink.
      r(816,623,140,85,'#162b39');r(810,613,140,85,'#708893');r(817,620,126,58,'#153e4c');r(820,622,120,3,'#a2cfc7');
      r(821,684,70,6,'#b1bc9e');r(919,684,11,6,'#d4ad72');r(871,698,18,12,'#54717b');r(848,710,65,6,'#1b303d');
    }
    drawCabin(ctx,time,reducedMotion,signal='waiting',orbiPhase='locked',preparation={},weather={sol:1,temperature:-42}) {
      const connected=signal==='connected',faulty=signal==='error'||signal==='lost';
      ctx.drawImage(this.room,0,0);
      ctx.fillStyle='#153544';ctx.fillRect(750,322,160,71);
      ctx.fillStyle='#8bc8cf';ctx.fillRect(753,325,154,2);
      ctx.save();if(faulty)ctx.globalAlpha=.3;ctx.beginPath();ctx.arc(783,358,23,0,Math.PI*2);ctx.clip();
      ctx.fillStyle='#439bd0';ctx.fillRect(758,332,50,51);
      ctx.fillStyle='#7cbf95';
      for(const [x,y,w,h] of [[765,341,19,8],[777,348,16,8],[775,356,9,14],[786,371,10,7],[799,341,11,17],[760,367,7,8]])ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#b4e3db';ctx.fillRect(769,335,21,3);ctx.restore();
      ctx.textAlign='left';ctx.font='bold 10px Consolas,monospace';ctx.fillStyle='#cfebdb';ctx.fillText('EARTH',817,348);
      ctx.font='7px Consolas,monospace';ctx.fillStyle=faulty?'#ed9b8e':connected?'#9ed7ab':'#e0b57d';
      ctx.fillText({waiting:'STANDBY',incoming:'INCOMING CALL',connected:'CHANNEL OPEN',error:'SYSTEM ERROR',lost:'SIGNAL LOST'}[signal],817,363);
      ctx.fillText(faulty?'UPLINK OFFLINE':connected?'SIGNAL RECEIVED':signal==='incoming'?'ANSWER AT TERMINAL':'NO TRANSMISSION',817,377);
      if(signal==='error'){ctx.fillStyle='#c9776c';ctx.fillRect(758,347,145,2);ctx.fillRect(751,370,55,2);}
      ctx.fillStyle=faulty?'#ec8778':connected?'#96d7b0':'#e5a664';ctx.globalAlpha=reducedMotion?1:.65+Math.sin(time*2)*.2;ctx.fillRect(899,384,5,4);ctx.fillRect(244,383,4,4);ctx.globalAlpha=1;
      const awake=['pending','talking','complete'].includes(orbiPhase);
      ctx.fillStyle=awake?'#244f59':'#1c3340';ctx.fillRect(555,301,148,94);
      if(this.orbiImage){ctx.save();ctx.globalAlpha=awake?1:.13;ctx.drawImage(this.orbiImage,593,301,78,72);ctx.restore();}
      ctx.textAlign='center';ctx.font='bold 8px Consolas,monospace';ctx.fillStyle=awake?'#ffe2a1':'#688b94';ctx.fillText('O R B I',629,382);
      ctx.font='6px Consolas,monospace';ctx.fillStyle=awake?'#b8e7d1':'#65828c';ctx.fillText(awake?'CREW COMPANION ONLINE':orbiPhase==='booting'?'WAKING UP…':'ASSISTANT ON STANDBY',629,391);ctx.textAlign='left';
      ctx.fillStyle='#f1e4b9';ctx.fillRect(318,699,59,18);ctx.fillStyle='#8eaa98';ctx.fillRect(321,702,53,12);
      if(!preparation.ate){ctx.fillStyle='#b0bc6e';ctx.fillRect(325,704,19,8);ctx.fillStyle='#d79c5e';ctx.fillRect(347,704,22,8);ctx.fillStyle='#e3cc8c';ctx.fillRect(351,705,13,3);}
      ctx.fillStyle='#d7e4cf';ctx.fillRect(374,681,14,27);ctx.fillStyle=preparation.drank?'#91aca7':'#6fbeda';ctx.fillRect(377,688,8,16);ctx.fillStyle='#4d6b77';ctx.fillRect(378,678,6,4);
      ctx.textAlign='left';ctx.font='bold 8px Consolas,monospace';ctx.fillStyle='#f2d193';ctx.fillText(`DAY ${weather.sol} · WEATHER`,826,640);ctx.font='7px Consolas,monospace';ctx.fillStyle='#c2dccc';ctx.fillText(`${weather.temperature} C · LOCAL SENSOR`,826,655);ctx.fillStyle=preparation.weatherChecked?'#a4d6ad':'#d3b687';ctx.fillText(preparation.weatherChecked?'PREFLIGHT CHECKED':'CHECK BEFORE EXIT',826,669);
    }
    draw(ctx,width,height,dpr,time,reducedMotion) {
      const scale=Math.max(width/1100,height/800),x=550-width/scale/2,y=535-height/scale*.58;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#111b29';ctx.fillRect(0,0,width,height);
      ctx.setTransform(scale*dpr,0,0,scale*dpr,-x*scale*dpr,-y*scale*dpr);ctx.imageSmoothingEnabled=false;
      this.drawCabin(ctx,time,reducedMotion);
      ctx.fillStyle='#0d1b2a88';ctx.beginPath();ctx.ellipse(550,532,34,11,0,0,Math.PI*2);ctx.fill();
      this.character.draw(ctx,'down',-1,550,535);
      ctx.setTransform(1,0,0,1,0,0);
      return {x:(550-x)*scale,y:(535-132-y)*scale};
    }
  }
  window.WakeupScene=WakeupScene;
})();
