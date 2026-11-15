// Public, read-only NASA proxy. It accepts two fixed date windows, never a URL.
export const NASA_BASE='https://ccmc.gsfc.nasa.gov/DONKI-API/get/';
export const HISTORY={startDate:'2024-05-08',endDate:'2024-05-13'};
const TYPES=['FLR','CME','SEP','notifications'];
const safeLink=value=>{
  try{const u=new URL(value);return u.protocol==='https:'&&/(^|\.)nasa\.gov$/.test(u.hostname)?u.href:null;}catch{return null;}
};
export function normalizeRecords(type,rows){
  if(rows===null)return [];
  if(!Array.isArray(rows))throw new Error(`${type} returned a non-array response`);
  return rows.map(row=>{
    if(!row||typeof row!=='object')return null;
    const time=row.beginTime||row.startTime||row.eventTime||row.messageIssueTime;
    if(!time||!Number.isFinite(Date.parse(time)))return null;
    const id=row.flrID||row.activityID||row.sepID||row.messageID;
    if(typeof id!=='string')return null;
    const analysis=row.cmeAnalyses?.find(a=>a.isMostAccurate)||row.cmeAnalyses?.[0];
    return {id,type,time,link:safeLink(row.link||row.messageURL),
      instruments:(Array.isArray(row.instruments)?row.instruments:[]).map(i=>String(i.displayName||'')).filter(Boolean),
      ...(type==='FLR'?{classType:String(row.classType||'Not reported'),peakTime:row.peakTime||null}:{}),
      ...(type==='CME'?{speed:Number.isFinite(analysis?.speed)?analysis.speed:null,note:'DONKI analysis speed; not a Mars arrival forecast.'}:{}),
      ...(type==='notifications'?{messageType:String(row.messageType||'NASA notification'),messageBody:String(row.messageBody||'').slice(0,1600)}:{})};
  }).filter(Boolean).sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)).slice(0,8);
}
export function recentRange(now=new Date()){
  const endDate=now.toISOString().slice(0,10),start=new Date(now);start.setUTCDate(start.getUTCDate()-14);
  return {startDate:start.toISOString().slice(0,10),endDate};
}
export async function fetchDonkiWindow(range,{fetchImpl=fetch,timeout=10000}={}){
  const counts={},events={},urls={},gateways={};
  const results=await Promise.allSettled(TYPES.map(async type=>{
    const url=new URL(type,NASA_BASE);url.searchParams.set('startDate',range.startDate);url.searchParams.set('endDate',range.endDate);if(type==='notifications')url.searchParams.set('type','all');urls[type]=url.href;
    let response;
    try{
      response=await fetchImpl(url,{signal:AbortSignal.timeout(Math.min(timeout,3500)),headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('CCMC unavailable');gateways[type]='NASA CCMC public API';
    }catch{
      const gateway=new URL('https://api.nasa.gov/DONKI/'+type);gateway.searchParams.set('startDate',range.startDate);gateway.searchParams.set('endDate',range.endDate);
      if(type==='notifications')gateway.searchParams.set('type','all');gateway.searchParams.set('api_key',process.env.NASA_API_KEY||'DEMO_KEY');
      response=await fetchImpl(gateway,{signal:AbortSignal.timeout(timeout),headers:{Accept:'application/json'}});gateways[type]='NASA Open APIs gateway';
    }
    if(!response.ok)throw new Error(`NASA ${type}: HTTP ${response.status}`);
    const data=await response.json();counts[type]=Array.isArray(data)?data.length:0;events[type]=normalizeRecords(type,data);return type;
  }));
  const errors=results.flatMap((r,i)=>r.status==='rejected'?[{type:TYPES[i],reason:r.reason.message}]:[]);
  return {schema:1,provider:'NASA CCMC DONKI',retrievedAt:new Date().toISOString(),range,urls,gateways,counts,events,errors};
}
let cache=null,inflight=null;
export async function handleDonkiRequest(req,res,url){
  if(url.pathname!=='/api/donki')return false;
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  if(req.method!=='GET'){send(405,{error:'Only GET is supported'});return true;}
  const mode=url.searchParams.get('mode')||'recent';
  if(!['recent','historical'].includes(mode)||[...url.searchParams.keys()].some(k=>k!=='mode')){send(400,{error:'Use mode=recent or mode=historical'});return true;}
  const key=mode+':'+new Date().toISOString().slice(0,10);
  try{
    if(cache?.key===key&&cache.failed&&Date.now()-cache.at<60000){send(503,{error:'NASA is temporarily unavailable. Use the verified historical case.',retryAfter:60});return true;}
    if(cache?.key===key&&!cache.failed&&Date.now()-cache.at<15*60*1000){send(200,{...cache.data,transport:'server-cache'});return true;}
    if(!inflight||inflight.key!==key)inflight={key,promise:fetchDonkiWindow(mode==='historical'?HISTORY:recentRange())};
    const pending=inflight,data=await pending.promise;if(inflight===pending)inflight=null;
    if(['FLR','CME','SEP'].some(type=>!Array.isArray(data.events[type])))throw new Error('NASA did not return all three event feeds');
    cache={key,data,at:Date.now()};send(200,{...data,transport:'network'});
  }catch{cache={key,at:Date.now(),failed:true};send(503,{error:'NASA is unavailable. The game can use its verified historical case.',retryAfter:60});}
  return true;
}
