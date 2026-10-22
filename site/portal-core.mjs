export const COUNTIES=[
 ['臺北市','北部',121.565,25.033],['新北市','北部',121.46,25.012],['基隆市','北部',121.739,25.127],['桃園市','北部',121.301,24.994],['新竹市','北部',120.969,24.803],['新竹縣','北部',121.014,24.839],
 ['苗栗縣','中部',120.821,24.56],['臺中市','中部',120.674,24.148],['彰化縣','中部',120.544,24.075],['南投縣','中部',120.685,23.91],['雲林縣','中部',120.527,23.71],['嘉義市','南部',120.449,23.48],['嘉義縣','南部',120.292,23.459],['臺南市','南部',120.227,22.999],['高雄市','南部',120.301,22.627],['屏東縣','南部',120.487,22.672],['宜蘭縣','東部',121.753,24.758],['花蓮縣','東部',121.606,23.991],['臺東縣','東部',121.15,22.755],['澎湖縣','離島',119.566,23.566],['金門縣','離島',118.319,24.437],['連江縣','離島',119.95,26.16]
].map(([name,region,lon,lat])=>({name,region,lon,lat}));
export const canonical=s=>String(s||'').replaceAll('台','臺');
export const twDate=s=>{if(!s)return NaN;return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s)?s:s.replace(' ','T')+'+08:00')};
export function freshness(source,now=Date.now(),maxAge=90*60000){
 if(!source?.checkedAt)return 'unavailable';
 const age=now-Date.parse(source.checkedAt);
 if(source.status!=='ok'||!Number.isFinite(age)||age<0||age>maxAge)return 'stale';
 return 'fresh';
}
export function validPeriods(county,now=Date.now()){
 return (county?.periods||[]).filter(p=>twDate(p.end)>now&&Number.isFinite(twDate(p.start))).sort((a,b)=>twDate(a.start)-twDate(b.start));
}
export function matchCounties(title){
 const text=canonical(title),found=COUNTIES.filter(c=>text.includes(c.name)||text.includes(c.name.slice(0,-1))).map(c=>c.name);
 const aliases={'北市':'臺北市','竹市':'新竹市','竹縣':'新竹縣','中市':'臺中市','南市':'臺南市','高市':'高雄市','苗縣':'苗栗縣','彰縣':'彰化縣','投縣':'南投縣','雲縣':'雲林縣','嘉市':'嘉義市','嘉縣':'嘉義縣','屏縣':'屏東縣','宜縣':'宜蘭縣','花縣':'花蓮縣','東縣':'臺東縣','馬祖':'連江縣'};
 for(const [word,county] of Object.entries(aliases))if(text.includes(word))found.push(county);
 // A bare 新竹/嘉義 may refer to city or county: both are related, never an official jurisdiction assertion.
 return [...new Set(found)];
}
export function newsFor(items,county,scope='related'){
 const sorted=[...items].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 return scope==='all'?sorted:sorted.filter(i=>i.counties?.includes(county));
}
export function distance(a,b){const r=Math.PI/180,dp=(b.lat-a.lat)*r,dl=(b.lon-a.lon)*r;const h=Math.sin(dp/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dl/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)))}
export function trackPoints(item,forecastIndex=(item?.fc?.length||1)-1){
 if(!item)return [];
 const af=item.fields?.an||['t','lon','lat','w','g','p','ms','md','c7','c10','s'];
 const ff=item.fields?.fc||['h','lon','lat','w','g','p','ms','md','c7','c10','r70'];
 const decode=(row,fields)=>Object.fromEntries(fields.map((k,i)=>[k,row[i]]));
 const an=(item.an||[]).map(row=>({...decode(row,af),kind:'觀測'})).filter(p=>Number.isFinite(twDate(p.t))).sort((a,b)=>twDate(a.t)-twDate(b.t));
 const f=item.fc?.[forecastIndex];
 const latest=forecastIndex===(item.fc?.length||0)-1;
 const cutoff=f&&!latest?twDate(f.init):Infinity;
 const observations=an.filter(p=>twDate(p.t)<=cutoff).slice(-25);
 const fc=(f?.fixes||[]).map(row=>{const p=decode(row,ff);return {...p,t:new Date(twDate(f.init)+p.h*3600000).toISOString(),kind:'官方預報'}}).filter(p=>!latest||!observations.length||twDate(p.t)>twDate(observations.at(-1).t));
 return [...observations,...fc].filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat)).sort((a,b)=>twDate(a.t)-twDate(b.t));
}
export function cycloneKey(t){return `${t.year}:${t.tyNo?'TY'+t.tyNo:t.tdNo?'TD'+t.tdNo:t.en}`}
export function activeCyclones(archive){return (archive?.items||[]).filter(t=>(archive.activeKeys||[]).includes(cycloneKey(t)))}
