import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fetchDonkiWindow,HISTORY,recentRange} from './donki-service.mjs';
const [historical,recent]=await Promise.all([fetchDonkiWindow(HISTORY,{timeout:20000}),fetchDonkiWindow(recentRange(),{timeout:20000})]);
let previous;
try{previous=JSON.parse(await readFile(new URL('../dist/assets/nasa/donki-snapshot.json',import.meta.url),'utf8')).historical;}catch{ /* First successful sync establishes the archive. */ }
for(const type of ['FLR','CME','SEP','notifications'])if(!historical.events[type]?.length&&previous?.events[type]?.length){
  historical.events[type]=previous.events[type];historical.counts[type]=previous.counts[type];historical.urls[type]=previous.urls[type];
  (historical.reusedSelections??={})[type]={retrievedAt:previous.retrievedAt,reason:'Upstream feed unavailable; retained verified historical selection.'};
}
if(['FLR','CME','SEP'].some(type=>!historical.events[type]?.length))throw new Error('A verified FLR/CME/SEP historical case is required; no placeholder records will be written.');
const bundle={historical,recent};
await mkdir(new URL('../dist/assets/nasa/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/assets/nasa/donki-snapshot.json',import.meta.url),JSON.stringify(bundle,null,2)+'\n');
await writeFile(new URL('../dist/donki-records.js',import.meta.url),'/* Verified NASA DONKI records. Generated with npm run nasa:sync; dates are observation dates. */\nwindow.NOVADonkiRecords='+JSON.stringify(bundle)+';\n');
for(const [mode,data]of Object.entries(bundle))console.log(JSON.stringify({mode,range:data.range,counts:data.counts,errors:data.errors,exampleIds:Object.fromEntries(Object.entries(data.events).map(([type,events])=>[type,events[0]?.id]))}));
