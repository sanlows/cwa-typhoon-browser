import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRaw, fromCompact, toCompact, merge, store, findAll } from './track-core.mjs';

export const keyOf = t => `${t.year}:${t.tyNo ? 'TY'+t.tyNo : t.tdNo ? 'TD'+t.tdNo : t.en}`;
export function parseResponse(raw) {
  if (!raw || typeof raw !== 'object' || raw.success === 'false' || raw.success === false)
    throw new Error('Invalid CWA response');
  // A known container is required. An error object must never clear active cyclones.
  if (!findAll(raw, 'TropicalCyclones').length) throw new Error('Unrecognized CWA schema');
  const nodes = findAll(raw, 'TropicalCyclone').flatMap(v => v == null ? [] : Array.isArray(v) ? v : [v]);
  const tracks = parseRaw(raw);
  if (tracks.length !== nodes.length) throw new Error('Incomplete cyclone records');
  for (const t of tracks) {
    if (!/^\d{4}$/.test(t.year) || !(t.tyNo || t.tdNo || t.en))
      throw new Error('Missing cyclone identity');
    if(!t.updated){
      // Datastore omits Sent. A model cycle is not a publication time.
      t.updated=[...t.an.map(p=>p.t),...t.fc.map(f=>f.init)].filter(Boolean).sort().at(-1);
      t.timeBasis='cycle';
    }else t.timeBasis='publication';
    if(!t.updated)throw new Error('Missing bulletin time');
    for (const p of [...t.an,...t.fc.flatMap(f=>f.fixes)])
      if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat) || Math.abs(p.lat)>90 || Math.abs(p.lon)>180)
        throw new Error('Invalid cyclone coordinates');
  }
  return tracks;
}

export async function fetchCWA(key, fetcher=fetch) {
  // Header authentication avoids credentials in URLs. Redirects are rejected.
  const urls = [
    'https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0034-005?format=JSON'
  ];
  for (const [endpoint,url] of urls.entries()) {
    for (let attempt=0; attempt<3; attempt++) {
      try {
        const res=await fetcher(url, {headers:{Authorization:key,Accept:'application/json'},
          signal:AbortSignal.timeout(30000),redirect:'error'});
        if (res.status===401 || res.status===403) throw new Error('AUTH');
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const text=await res.text();
        if(text.length>10000000 || text.includes(key) || /CWA-[A-Za-z0-9]{8}-[A-Za-z0-9-]{20,}/.test(text))
          throw new Error('UNSAFE');
        const raw=JSON.parse(text);
        return {raw, tracks:parseResponse(raw)};
      } catch(e) {
        if(e.message==='AUTH')throw new Error('CWA rejected the API credential. Check CWA_API_KEY.');
        if(e.message==='UNSAFE')throw new Error('Response rejected by credential/size guard.');
        const safeMessages=['Invalid CWA response','Unrecognized CWA schema','Incomplete cyclone records',
          'Missing cyclone identity','Missing bulletin time','Invalid cyclone coordinates'];
        const reason=/^HTTP_\d{3}$/.test(e.message)||safeMessages.includes(e.message)?e.message:
          e.name==='SyntaxError'?'Response is not valid JSON':e.name==='TimeoutError'?'Request timed out':'Network request failed';
        console.warn(`CWA endpoint ${endpoint+1}, attempt ${attempt+1}: ${reason}`);
        if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));
      }
    }
  }
  throw new Error('CWA fetch or schema validation failed. Existing data was preserved.');
}

async function main() {
  const key=process.env.CWA_API_KEY?.trim();
  if(!key)throw new Error('Set repository Actions secret CWA_API_KEY before updating.');
  const path=resolve('site/data/archive.json');
  const previous=JSON.parse(await readFile(path,'utf8'));
  const {raw,tracks}=await fetchCWA(key);
  store.length=0;
  // The supplied sample is only a demo, never silently mixed into verified API history.
  if(previous.mode==='live')previous.items.forEach(t=>merge(fromCompact(t)));
  tracks.forEach(merge);
  const output={schema:1,mode:'live',checkedAt:new Date().toISOString(),
    sourceSent:tracks.map(t=>t.updated).sort().at(-1) || null,
    sourceTimeBasis:tracks.some(t=>t.timeBasis==='cycle')?'cycle':'publication',
    activeKeys:tracks.map(keyOf),items:store.map(toCompact)};
  if(previous.sourceSent && output.sourceSent && previous.mode==='live' && output.sourceSent<previous.sourceSent)
    throw new Error('CWA bulletin is older than the previous successful fetch. Existing data preserved.');
  const sameForecastData=previous.mode==='live' &&
    previous.sourceSent===output.sourceSent &&
    previous.sourceTimeBasis===output.sourceTimeBasis &&
    JSON.stringify(previous.activeKeys)===JSON.stringify(output.activeKeys) &&
    JSON.stringify(previous.items)===JSON.stringify(output.items);
  const ageOfPublishedCheck=Date.now()-Date.parse(previous.checkedAt||'');
  // Keep polling frequently, but avoid a repository commit for each unchanged check.
  // Real forecast changes always publish immediately; unchanged checks publish hourly.
  if(sameForecastData && Number.isFinite(ageOfPublishedCheck) &&
      ageOfPublishedCheck>=0 && ageOfPublishedCheck<55*60*1000){
    console.log('CWA check successful; no forecast changes and published status still fresh.');
    return;
  }
  const serialized=JSON.stringify(output,null,2)+'\n';
  if(serialized.includes(key))throw new Error('Credential guard blocked publication.');
  await mkdir(resolve('site/data'),{recursive:true});
  await writeFile(path+'.tmp',serialized);
  await rename(path+'.tmp',path);
  console.log(`CWA data updated: ${tracks.length} active, ${store.length} archived cyclones.`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error(e.message);process.exitCode=1});
