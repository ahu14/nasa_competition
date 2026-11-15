(function(root){
  'use strict';
  const types=['FLR','CME','SEP'];
  function valid(data){return !!data&&data.schema===1&&typeof data.retrievedAt==='string'&&data.range&&types.every(t=>Array.isArray(data.events?.[t]));}
  function chooseDataset(candidate,historical,{transport='network',now=Date.now()}={}){
    const age=valid(candidate)?now-Date.parse(candidate.retrievedAt):Infinity;
    const windowAge=valid(candidate)?now-Date.parse(candidate.range.endDate+'T23:59:59Z'):Infinity;
    const recentEnough=age>=-5*60*1000&&age<=24*60*60*1000&&windowAge>=-2*24*60*60*1000&&windowAge<=3*24*60*60*1000;
    const complete=valid(candidate)&&types.every(t=>candidate.events[t].length>0&&candidate.events[t].every(record=>{
      const time=Date.parse(record.time);return time>=Date.parse(candidate.range.startDate+'T00:00:00Z')&&time<=Date.parse(candidate.range.endDate+'T23:59:59Z');
    }));
    if(complete&&recentEnough)return {...candidate,displayMode:transport==='network'?'recent':'snapshot',reason:transport==='network'?'Recent NASA observations fetched for the requested UTC window.':'Dated NASA snapshot; a live refresh is unavailable.'};
    if(!valid(historical)||!types.every(t=>historical.events[t].length))throw new Error('No verified historical NASA case is available.');
    return {...historical,displayMode:'historical',reason:valid(candidate)&&!complete?'The recent window does not contain every event type. Training uses this dated historical case.':'Live records are unavailable or the snapshot is stale. Training uses this dated historical case.'};
  }
  class DonkiClient{
    constructor(records=root.NOVADonkiRecords,fetchImpl=root.fetch?.bind(root)){
      this.records=records;this.fetch=fetchImpl;this.data=chooseDataset(records?.recent,records?.historical,{transport:'snapshot'});this.promise=null;
    }
    async load(force=false){
      if(this.promise&&!force)return this.promise;
      this.promise=(async()=>{
        if(typeof location==='undefined'||!/^https?:$/.test(location.protocol)||!this.fetch)return this.data;
        try{
          const response=await this.fetch('api/donki?mode=recent',{signal:AbortSignal.timeout(20000),cache:'no-store'});
          if(!response.ok)throw new Error('NASA proxy unavailable');
          const candidate=await response.json();this.data=chooseDataset(candidate,this.records.historical);
        }catch{this.data=chooseDataset(this.records?.recent,this.records?.historical,{transport:'snapshot'});}
        return this.data;
      })();return this.promise;
    }
    historical(){this.data={...chooseDataset(null,this.records.historical),reason:'You selected the verified historical case for this exercise.'};return this.data;}
  }
  const api={DonkiClient,chooseDataset,valid};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NOVADonki=api;
})(typeof window!=='undefined'?window:globalThis);
