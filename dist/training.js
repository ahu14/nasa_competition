(() => {
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nasaLink=(url,label)=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;
  class MissionTraining{
    constructor({core,getState,save,onClose,onChange}){
      this.C=core;this.state=getState;this.save=save;this.onClose=onClose;this.onChange=onChange;
      this.dialog=document.getElementById('training-dialog');this.content=document.getElementById('training-content');this.selected=null;this.mode='emu';this.message='';this.drag=null;
      this.donki=new window.NOVADonki.DonkiClient();this.donki.load().then(()=>{if(this.isOpen()&&this.mode==='storm'&&!this.state().training.storm.reviewed)this.render();});
      document.getElementById('training-close').onclick=()=>this.close();
      this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
      this.content.addEventListener('click',e=>this.click(e));
      this.content.addEventListener('dragstart',e=>{const card=e.target.closest('[data-part]');if(!card)return;this.select(card.dataset.part);e.dataTransfer.setData('text/plain',card.dataset.part);e.dataTransfer.effectAllowed='move';});
      this.content.addEventListener('dragover',e=>{if(e.target.closest('[data-slot]')){e.preventDefault();e.dataTransfer.dropEffect='move';}});
      this.content.addEventListener('drop',e=>{const slot=e.target.closest('[data-slot]');if(!slot)return;e.preventDefault();this.place(e.dataTransfer.getData('text/plain'),slot.dataset.slot);});
      this.content.addEventListener('pointerdown',e=>{
        const card=e.target.closest('[data-part]');if(!card||e.pointerType==='mouse')return;
        this.drag={id:card.dataset.part,x:e.clientX,y:e.clientY,moved:false};
      });
      this.content.addEventListener('pointermove',e=>{if(this.drag&&Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>8){this.drag.moved=true;e.preventDefault();}},{passive:false});
      window.addEventListener('pointerup',e=>{if(!this.drag)return;const drag=this.drag;this.drag=null;if(drag.moved){const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');if(slot)this.place(drag.id,slot.dataset.slot);else this.select(drag.id);}});
      window.addEventListener('pointercancel',()=>{this.drag=null;});
    }
    isOpen(){return this.dialog.open;}
    open(mode){this.mode=mode;this.selected=null;this.message='';this.render();if(!this.dialog.open)this.dialog.showModal();this.dialog.querySelector('[data-part], [data-action], button')?.focus({preventScroll:true});}
    close(){this.dialog.close();this.selected=null;this.save();this.onClose();}
    changed(){this.save();this.onChange();}
    select(id){
      const part=this.C.emuParts.find(p=>p.id===id);if(!part)return;
      this.selected=id;this.C.learnEmuPart(this.state(),id);this.message=part.science;this.changed();
      // Keep the dragged DOM node mounted until drop.
      this.content.querySelectorAll('[data-part]').forEach(el=>el.classList.toggle('selected',el.dataset.part===id));
      const info=document.getElementById('emu-feedback');if(info)info.textContent=part.science;
    }
    place(id,slot){
      const part=this.C.emuParts.find(p=>p.id===id);if(!part)return;
      if(this.C.placeEmuPart(this.state(),id,slot)){this.message=`✓ ${part.name}: ${part.science}`;this.selected=null;this.changed();this.render();}
      else{this.message=`Try another role. ${part.name}: ${part.science}`;const info=document.getElementById('emu-feedback');if(info)info.textContent=this.message;}
    }
    click(event){
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.part){this.select(button.dataset.part);return;}
      if(button.dataset.slot){if(this.selected)this.place(this.selected,button.dataset.slot);else{this.message='Choose a component first, then match it to this role.';document.getElementById('emu-feedback').textContent=this.message;}return;}
      if(button.dataset.choice){this.C.chooseStormDecision(this.state(),button.dataset.choice);this.changed();this.render();return;}
      const action=button.dataset.action;
      if(action==='close'){this.close();return;}
      if(action==='review'){this.C.reviewStormRecords(this.state());this.changed();this.render();return;}
      if(action==='continue'){this.C.advanceStormDecision(this.state());this.changed();this.render();return;}
      if(action==='retry'){this.state().training.storm.feedback=null;this.changed();this.render();return;}
      if(action==='historical'){this.donki.historical();this.render();return;}
      if(action==='refresh'){
        button.disabled=true;button.textContent='Checking NASA…';
        this.donki.load(true).then(()=>{if(this.isOpen())this.render();});
      }
    }
    render(){
      const s=this.state(),emu=this.mode==='emu';document.getElementById('training-kicker').textContent=`ORBI / DAY ${s.survival.day} / ${emu?'EVA SCHOOL':'STORM SCHOOL'}`;
      document.getElementById('training-title').textContent=emu?'Know your EMU.':'Shelter through the solar storm.';
      this.content.innerHTML=emu?this.emuHtml(s):this.stormHtml(s);
    }
    emuHtml(s){
      const C=this.C,ready=C.canTrainEmu(s),complete=C.emuComplete(s),placed=s.training.emu.placed;
      if(!ready)return `<p class="training-lede">Talk to ORBI in the spaceship to prepare for your first EVA.</p><button class="training-primary" data-action="close">Back to the cabin</button>`;
      return `<p class="training-lede">An Extravehicular Mobility Unit is a pressure suit and life-support system. Match each part to its job before your first trip outside.</p><div class="training-badges"><span>DAY 1 · REQUIRED BEFORE EVA</span><span>${placed.length} / ${C.emuParts.length} MATCHED</span></div><div class="emu-workbench"><div class="emu-inventory" aria-label="Spacesuit components">${C.emuParts.map(p=>`<button class="emu-part ${this.selected===p.id?'selected':''}" draggable="true" data-part="${p.id}" ${placed.includes(p.id)?'disabled':''} aria-label="${escape(p.name)}${placed.includes(p.id)?', matched':''}"><span style="--part-color:${p.color}">${placed.includes(p.id)?'✓':p.number}</span><b>${escape(p.name)}</b><small>${placed.includes(p.id)?'FITTED':'DRAG / SELECT'}</small></button>`).join('')}</div><div class="emu-board"><img src="assets/emu-study-suit.svg" alt="Pixel-art EMU with helmet, torso, gloves, legs and life-support backpack"><div class="emu-slots" aria-label="Match parts to their functions">${C.emuParts.map(p=>`<button class="emu-slot ${placed.includes(p.id)?'fitted':''}" data-slot="${p.id}" aria-label="Match: ${escape(p.role)}" ${placed.includes(p.id)?'disabled':''}><span>${placed.includes(p.id)?'✓':'+'}</span><b>${placed.includes(p.id)?escape(p.short):escape(p.role)}</b></button>`).join('')}</div></div></div><p class="training-feedback" id="emu-feedback" role="status" aria-live="polite">${escape(this.message||'Drag a component to its role. On touch or keyboard: select a component, then select a matching slot.')}</p>${complete?'<div class="training-success"><strong>EMU CHECK COMPLETE</strong><p>You know the main components. Keep checking oxygen, cooling and seals. A spacesuit is not a solar-storm shelter.</p></div>':''}<button class="training-primary" data-action="close">${complete?'Ready · Back to the cabin':'Save practice · Back to the cabin'}</button><p class="training-footnote">Teaching model of the Shuttle/ISS EMU, inspired by your reference. A Mars suit would need different design provisions. This matching exercise is not a real donning or prebreathe procedure. ${nasaLink(C.scienceSources.emu,'NASA: EMU components')}</p>`;
    }
    recordsHtml(){
      const d=this.donki.data,mode=d.displayMode==='recent'?'RECENT NASA RECORDS':d.displayMode==='snapshot'?'DATED NASA SNAPSHOT':'HISTORICAL NASA CASE';
      const cards=['FLR','CME','SEP'].map(type=>{
        const record=d.events[type][0],label={FLR:'Solar flare',CME:'Coronal mass ejection',SEP:'Solar energetic particles'}[type];
        const value=type==='FLR'?`Class ${record.classType}`:type==='CME'?record.speed===null?'Speed not reported':`Analysis speed ${record.speed} km/s`:'Particle event observed';
        return `<article class="donki-card"><span>${type} · ${label}</span><strong>${escape(value)}</strong><time>${escape(record.time)} UTC</time><small>${escape(record.instruments.join(' · ')||'Instrument not reported')}</small><code>${escape(record.id)}</code>${record.link?nasaLink(record.link,'NASA record'):nasaLink(d.urls[type],'NASA source')}</article>`;
      }).join('');
      const notices=d.events.notifications||[];
      return `<section class="donki-panel" aria-label="Real NASA event observations"><div class="donki-heading"><strong>${mode}</strong><span>${escape(d.range.startDate)} → ${escape(d.range.endDate)}</span></div><p>${escape(d.reason)}</p><div class="donki-grid">${cards}</div><details class="donki-notifications"><summary>DONKI notifications (${d.counts.notifications??notices.length} returned; selected records below)</summary>${notices.slice(0,3).map(n=>`<article><strong>${escape(n.messageType)}</strong><time>${escape(n.time)} UTC</time><p>${escape(n.messageBody.slice(0,500))}${n.messageBody.length>500?'…':''}</p>${n.link?nasaLink(n.link,'Full NASA notification'):''}</article>`).join('')||'<p>No notifications returned in this window.</p>'}</details><p class="donki-provenance">Retrieved: ${escape(d.retrievedAt)}. Instrument locations are the NASA record’s observing locations, not measurements at this outpost. Selected records may be unrelated; listing them together does not prove a causal chain.</p><div class="donki-actions"><button data-action="refresh">Refresh NASA</button><button data-action="historical">Use historical case</button>${nasaLink(this.C.scienceSources.donki,'NASA API reference')}</div></section>`;
    }
    stormHtml(s){
      const C=this.C,t=s.training.storm;
      if(!C.canTrainStorm(s))return `<p class="training-lede">Day ${s.survival.day}: check the weather screen to start ORBI’s storm briefing when a storm is active.</p><button class="training-primary" data-action="close">Back to the cabin</button>`;
      const label=`<div class="simulation-banner"><strong>SIMULATED MARS SCENARIO · SHELTER ADVISED ON DAY ${s.survival.day}</strong><p>NASA observations below are real. Arrival at Mars, the local radiation alert, fatal surface exposure and decision outcomes are game simulations. The airlock is available, but staying sheltered avoids exposure. DONKI is not a Mars atmospheric forecast or a radiation-dose calculator.</p></div>`;
      if(!t.reviewed)return `<p class="training-lede">“Mira, the forecast can wait. Shelter first. Let’s see what the Sun has been doing, then practise our response.” — ORBI</p>${label}${this.recordsHtml()}<button class="training-primary" data-action="review">I’ve reviewed the records · Start the drill</button>`;
      if(C.stormComplete(s))return `${label}<div class="storm-complete"><img src="assets/orbi/orbi.svg" alt="ORBI"><div><span>STORM DRILL COMPLETE</span><h2>You made a plan to stay safe.</h2><p>EVA postponed. Observation locations checked. Interior shelter selected. Vital systems and local monitoring maintained.</p><p>Sheltering is the safe choice today. Use the sleep pod when today’s preparation and missions are complete to begin Day ${s.survival.day+1}.</p></div></div><button class="training-primary" data-action="close">Back to the cabin</button><details><summary>Review the real NASA case</summary>${this.recordsHtml()}</details>`;
      const question=C.stormDecisions[t.answers.length],feedback=C.stormFeedback(s);
      return `${label}<div class="training-badges"><span>DECISION ${t.answers.length+1} / ${C.stormDecisions.length}</span><span>ORBI SURVIVAL PRACTICE</span></div><section class="storm-question"><img src="assets/orbi/orbi.svg" alt="ORBI"><div><h2>${escape(question.title)}</h2><p>${escape(question.context)}</p></div></section>${feedback?`<div class="decision-feedback ${feedback.correct?'correct':'retry'}" role="status"><strong>${feedback.correct?'A SOUND PLAN':'RETHINK THIS PLAN'}</strong><p>${escape(feedback.outcome)}</p><h3>Why, scientifically?</h3><p>${escape(feedback.science)}</p>${nasaLink(feedback.source,'Read the NASA explanation')}</div><button class="training-primary" data-action="${feedback.correct?'continue':'retry'}">${feedback.correct?'Continue the drill':'Try another decision'}</button>`:`<div class="storm-options">${question.choices.map(choice=>`<button data-choice="${choice.id}">${escape(choice.label)}<span>→</span></button>`).join('')}</div>`}<p class="training-footnote">Practice has no real dose measurement. You can revise unsafe plans; the airlock is available, but 12 continuous seconds of surface exposure during a storm is fatal.</p>`;
    }
  }
  window.MissionTraining=MissionTraining;
})();
