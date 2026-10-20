// Adapted from the MIT-licensed original; see LICENSE.
const FORMAT='cwa-typhoon-track/1';

const TAIWAN=[121.0,23.7], HUALIEN=[121.60,23.98];
const R=6371, rad=Math.PI/180;
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');

/* ---------- small helpers ---------- */
function cat(w){return w<17.2?['熱帶性低氣壓','--td']:w<32.7?['輕度颱風','--ts']:w<51?['中度颱風','--ty']:['強烈颱風','--sty']}
function dest(lon,lat,brg,km){const d=km/R,p1=lat*rad,l1=lon*rad,t=brg*rad;
  const p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(t));
  const l2=l1+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));
  return [l2/rad,p2/rad]}
function dist(a,b){const p1=a[1]*rad,p2=b[1]*rad,dp=p2-p1,dl=(b[0]-a[0])*rad;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
// all times are kept as Taiwan local "YYYY-MM-DDTHH:MM"
function toTW(s){ if(!s) return null; s=String(s).trim();
  const d=new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s)?s:s+'+08:00'); if(isNaN(d)) return null;
  const t=new Date(d.getTime()+8*3600e3);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`}
function addH(tw,h){const d=new Date(tw+':00Z');d.setUTCHours(d.getUTCHours()+h);return d.toISOString().slice(0,16)}
function fmt(tw){if(!tw)return '—';const [D,T]=tw.split('T');const [,m,d]=D.split('-');return `${+m}/${+d} ${T}`}
const num=v=>{if(v==null||v==='')return null;const n=+v;return isFinite(n)?n:null};

/* ---------- reading CWA raw JSON (tolerant of key case and object/array) ---------- */
function gk(o,...names){ if(!o||typeof o!=='object') return undefined;
  for(const n of names){ if(n in o) return o[n]; const k=Object.keys(o).find(k=>k.toLowerCase()===n.toLowerCase()); if(k) return o[k]; } return undefined }
const arr=v=>v==null?[]:Array.isArray(v)?v:[v];
const txt=v=>v==null?null:typeof v==='object'?(v['#text']??v.value??null):v;
function findAll(o,name,out=[]){ if(!o||typeof o!=='object') return out;
  if(Array.isArray(o)){o.forEach(x=>findAll(x,name,out));return out}
  for(const [k,v] of Object.entries(o)){ if(k.toLowerCase()===name.toLowerCase()) out.push(v); else findAll(v,name,out)} return out}
function circle(c){ if(!c||typeof c!=='object') return null; const r=num(txt(gk(c,'Radius')));
  if(r==null) return null; const q=gk(c,'QuadrantRadii'); const rs=q?arr(gk(q,'Radius')):[];
  if(rs.length){const m={};rs.forEach(x=>m[(x['@dir']||x.dir||'').toUpperCase()]=num(txt(x)));
    if(['NE','SE','SW','NW'].every(k=>m[k]!=null)) return [r,m.NE,m.SE,m.SW,m.NW]}
  return [r]}
function rawFix(f){return {lon:num(gk(f,'CoordinateLongitude')),lat:num(gk(f,'CoordinateLatitude')),w:num(gk(f,'MaxWindSpeed')),g:num(gk(f,'MaxGustSpeed')),
  p:num(gk(f,'Pressure')),ms:num(gk(f,'MovingSpeed')),md:txt(gk(f,'MovingDirection'))||'',c7:circle(gk(f,'Circle15ms')),c10:circle(gk(f,'Circle25ms'))}}
function parseRaw(json){
  const sent=toTW(findAll(json,'Sent')[0]||findAll(json,'sent')[0])||null;
  const tcs=findAll(json,'TropicalCyclone').flatMap(arr);
  return tcs.map(tc=>{
    const meta={year:String(gk(tc,'Year')||''),en:gk(tc,'TyphoonName')||'',name:gk(tc,'CwaTyphoonName')||'',tyNo:String(gk(tc,'CwaTyNo')||''),tdNo:String(gk(tc,'CwaTdNo')||'')};
    const an=arr(gk(gk(tc,'AnalysisData')||{},'Fix')).map(f=>({t:toTW(gk(f,'DateTime')),...rawFix(f),s:sent})).filter(f=>f.t&&f.lon!=null);
    let move=null; const last=arr(gk(gk(tc,'AnalysisData')||{},'Fix')).at(-1);
    const mp=last?arr(gk(last,'MovingPrediction')):[];
    if(mp.length){const zh=mp.find(x=>/zh/i.test(x['@lang']||''))||mp[0];const en=mp.find(x=>/en/i.test(x['@lang']||''));move=[txt(zh)||'',en?txt(en)||'':'']}
    const fx=arr(gk(gk(tc,'ForecastData')||{},'Fix'));
    const fcs={};
    fx.forEach(f=>{const init=toTW(gk(f,'InitialTime'));const h=num(gk(f,'ForecastHour'));if(!init||h==null)return;
      (fcs[init]??={init,sent,move:null,fixes:[]}).fixes.push({h,...rawFix(f),c7:circle(gk(f,'Circle15ms')),c10:circle(gk(f,'Circle25ms')),r70:num(gk(f,'Radius70PercentProbability'))})});
    const fcList=Object.values(fcs);
    if(fcList.length){fcList.sort((a,b)=>a.init<b.init?-1:1);fcList.at(-1).move=move}
    fcList.forEach(f=>f.fixes.sort((a,b)=>a.h-b.h));
    return {...meta,updated:sent,an,fc:fcList};
  }).filter(t=>t.an.length||t.fc.length);
}

/* ---------- compact save format ----------
{ format, year, en, name, tyNo, tdNo, updated,
  fields:{an:[...], fc:[...]},              // column order of the arrays below
  an:[[t,lon,lat,w,g,p,ms,md,c7,c10,s],...], // c7/c10: [r] or [r,NE,SE,SW,NW] or null; s = bulletin time it came from
  fc:[{init,sent,move:[zh,en]|null,fixes:[[h,lon,lat,w,g,p,ms,md,c7,c10,r70],...]}] } */
const AN_F=['t','lon','lat','w','g','p','ms','md','c7','c10','s'];
const FC_F=['h','lon','lat','w','g','p','ms','md','c7','c10','r70'];
function toCompact(T){return {format:FORMAT,year:T.year,en:T.en,name:T.name,tyNo:T.tyNo,tdNo:T.tdNo,updated:T.updated,
  fields:{an:AN_F,fc:FC_F},an:T.an.map(p=>AN_F.map(k=>p[k]??null)),
  fc:T.fc.map(f=>({init:f.init,sent:f.sent,move:f.move,fixes:f.fixes.map(p=>FC_F.map(k=>p[k]??null))}))}}
function fromCompact(o){const af=o.fields?.an||AN_F, ff=o.fields?.fc||FC_F;
  const z=(row,fs)=>Object.fromEntries(fs.map((k,i)=>[k,row[i]]));
  return {year:String(o.year||''),en:o.en||'',name:o.name||'',tyNo:String(o.tyNo||''),tdNo:String(o.tdNo||''),updated:o.updated||null,
    an:(o.an||[]).map(r=>z(r,af)),fc:(o.fc||[]).map(f=>({init:f.init,sent:f.sent||null,move:f.move||null,fixes:(f.fixes||[]).map(r=>z(r,ff))}))}}

/* ---------- store + merge ---------- */
const store=[]; // list of typhoons
function sameTy(a,b){ if(a.year&&b.year&&a.year!==b.year) return false;
  if(a.tyNo&&b.tyNo) return a.tyNo===b.tyNo;
  if(a.tdNo&&b.tdNo) return a.tdNo===b.tdNo;
  return !!a.en&&a.en.toUpperCase()===b.en.toUpperCase()}
const later=(a,b)=>(a||'')>=(b||'');
function merge(src){
  let T=store.find(t=>sameTy(t,src));
  if(!T){T={...src,an:[],fc:[]};store.push(T)}
  // metadata: keep the newest non-empty values
  const newer=later(src.updated,T.updated);
  for(const k of ['year','en','name','tyNo','tdNo']) if(src[k]&&(newer||!T[k])) T[k]=src[k];
  if(later(src.updated,T.updated)) T.updated=src.updated;
  const am=new Map(T.an.map(p=>[p.t,p]));
  src.an.forEach(p=>{const o=am.get(p.t); if(!o||later(p.s,o.s)) am.set(p.t,p)});
  T.an=[...am.values()].sort((a,b)=>a.t<b.t?-1:1);
  const fm=new Map(T.fc.map(f=>[f.init,f]));
  src.fc.forEach(f=>{const o=fm.get(f.init); if(!o||later(f.sent,o.sent)) fm.set(f.init,{...f,move:f.move||o?.move||null})});
  T.fc=[...fm.values()].sort((a,b)=>a.init<b.init?-1:1);
  return T}

export {parseRaw, fromCompact, toCompact, merge, store, findAll};
