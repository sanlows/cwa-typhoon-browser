import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COUNTIES,canonical,twDate,matchCounties} from '../site/portal-core.mjs';

export function parseForecast(raw){
 if(!raw||raw.success===false||raw.success==='false'||!Array.isArray(raw.records?.location))throw new Error('Forecast schema rejected');
 const counties=raw.records.location.map(loc=>{
  const name=canonical(loc.locationName);if(!COUNTIES.some(c=>c.name===name))throw new Error('Unknown county');
  const elements=Object.fromEntries((loc.weatherElement||[]).map(e=>[e.elementName,e.time]));
  const periods=(elements.Wx||[]).map(t=>{
   const find=k=>(elements[k]||[]).find(p=>p.startTime===t.startTime&&p.endTime===t.endTime)?.parameter;
   const number=k=>{const v=find(k)?.parameterName;return v==null||v===''?null:Number(v)};
   const p={start:t.startTime,end:t.endTime,condition:String(t.parameter?.parameterName||''),code:String(t.parameter?.parameterValue||''),minT:number('MinT'),maxT:number('MaxT'),pop:number('PoP'),comfort:String(find('CI')?.parameterName||'')};
   if(!p.condition||!Number.isFinite(twDate(p.start))||twDate(p.end)<=twDate(p.start)||![p.minT,p.maxT,p.pop].every(Number.isFinite)||p.minT>p.maxT||p.minT< -40||p.maxT>60||p.pop<0||p.pop>100)throw new Error('Forecast values rejected');
   return p;
  });
  if(!periods.length)throw new Error('Forecast periods missing');
  return {name,periods};
 });
 if(counties.length!==22||new Set(counties.map(c=>c.name)).size!==22)throw new Error('Incomplete county coverage');
 return {counties};
}
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function xmlText(value){return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,k)=>{if(k[0]!=='#')return entities[k]??m;const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):''}).trim()}
export function parseFeed(xml,{kind,now=Date.now()}={}){
 if(!/<rss\b/i.test(xml)||!/<channel[\s>]/i.test(xml)||!/<\/channel\s*>/i.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('RSS schema rejected');
 const field=(block,tag)=>xmlText(block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]);
 const items=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(([,block])=>{
  const title=field(block,'title'),link=field(block,'feedburner:origLink')||field(block,'link'),stamp=Date.parse(field(block,'pubDate'));
  let url;try{url=new URL(link)}catch{return null}
  const allowed=kind==='warnings'?url.hostname==='www.cwa.gov.tw':url.hostname==='www.cna.com.tw'&&/^\/news\/(ahel|aloc)\//.test(url.pathname);
  if(!title||title.length>500||url.protocol!=='https:'||!allowed||!Number.isFinite(stamp)||stamp>now+5*60000)return null;
  return {title,url:url.href,publishedAt:new Date(stamp).toISOString(),source:kind==='warnings'?'中央氣象署':'中央通訊社',category:kind==='local'?'地方':kind==='life'?'生活':'官方發布／解除',counties:kind==='warnings'?[]:matchCounties(title)};
 }).filter(Boolean);
 if(/<item[\s>]/i.test(xml)&&!items.length)throw new Error('RSS items rejected');
 return {items:[...new Map(items.map(i=>[i.url,i])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,30)};
}
export async function requestText(url,{key,fetcher=fetch}={}){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const headers={Accept:key?'application/json':'application/rss+xml, application/xml, text/xml'};
   if(key)headers.Authorization=key;
   const r=await fetcher(url,{headers,redirect:key?'error':'follow',signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw new Error('Source unavailable');
   const text=await r.text();
   if(text.length>5_000_000||(key&&text.includes(key))||/CWA-[A-Za-z0-9]{8}-[A-Za-z0-9-]{20,}/.test(text))throw new Error('Unsafe response');
   return text;
  }catch{if(attempt===2)throw new Error('Source fetch failed');await new Promise(r=>setTimeout(r,1000*(attempt+1)))}
 }
}
export const SOURCE_CONFIG={
 forecast:{label:'中央氣象署 · 36 小時縣市預報',url:'https://opendata.cwa.gov.tw/dataset/forecast/F-C0032-001'},
 warnings:{label:'中央氣象署 · 警報發布與解除',url:'https://www.cwa.gov.tw/V8/C/P/Warning/W21.html'},
 local:{label:'中央通訊社 · 地方新聞',url:'https://feeds.feedburner.com/rsscna/local'},
 life:{label:'中央通訊社 · 生活新聞',url:'https://feeds.feedburner.com/rsscna/lifehealth'}
};
export async function collectSources(previous,loaders,now){
 const entries=await Promise.all(Object.entries(loaders).map(async([id,load])=>{
  const attemptedAt=now||new Date().toISOString();
  try{const data=await load();return [id,{...SOURCE_CONFIG[id],status:'ok',checkedAt:now||new Date().toISOString(),attemptedAt,data}]}
  catch(e){const safe=['Forecast schema rejected','Unknown county','Forecast values rejected','Forecast periods missing','Incomplete county coverage','RSS schema rejected','RSS items rejected','Credential unavailable','Source fetch failed'];console.warn(`Portal ${id}: ${safe.includes(e.message)?e.message:'Source validation failed'}`);return [id,{...SOURCE_CONFIG[id],status:'error',checkedAt:previous?.[id]?.checkedAt||null,attemptedAt,data:previous?.[id]?.data||null,message:'本次來源讀取失敗；保留上次成功資料，請核對時間。'}]}
 }));
 return Object.fromEntries(entries);
}
export async function main({path=resolve('site/data/portal.json'),key=process.env.CWA_API_KEY?.trim(),fetcher=fetch}={}){
 let previous={};try{previous=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw new Error('Existing portal data is invalid; preserved')}
 const loaders={
  forecast:async()=>{if(!key)throw new Error('Credential unavailable');return parseForecast(JSON.parse(await requestText('https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?format=JSON',{key,fetcher})))},
  warnings:async()=>parseFeed(await requestText('https://www.cwa.gov.tw/rss/Data/cwa_warning.xml',{fetcher}),{kind:'warnings'}),
  local:async()=>parseFeed(await requestText(SOURCE_CONFIG.local.url,{fetcher}),{kind:'local'}),
  life:async()=>parseFeed(await requestText(SOURCE_CONFIG.life.url,{fetcher}),{kind:'life'})
 };
 const sources=await collectSources(previous.sources,loaders);
 const output={schema:1,generatedAt:new Date().toISOString(),sources};
 const serialized=JSON.stringify(output,null,2)+'\n';
 if((key&&serialized.includes(key))||/CWA-[A-Za-z0-9]{8}-[A-Za-z0-9-]{20,}/.test(serialized))throw new Error('Credential guard blocked publication');
 await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',serialized);await rename(path+'.tmp',path);
 for(const [id,s] of Object.entries(sources))console.log(`Portal ${id}: ${s.status}; records=${s.data?.counties?.length??s.data?.items?.length??0}`);
 if(Object.values(sources).some(s=>s.status!=='ok'))console.warn('::warning::Some portal sources failed; source-specific status is published.');
 return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Portal update failed safely; no raw response or credential was logged.');process.exitCode=1});
