import {COUNTIES,twDate,freshness,validPeriods,newsFor,distance,trackPoints,activeCyclones,featureCyclone} from './portal-core.mjs';
import {StormVisual} from './storm-visual.mjs';
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const sv=(tag,attrs={},text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n};
const fmt=(s,full=false)=>{const d=twDate(s);return Number.isFinite(d)?new Date(d).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(full?{year:'numeric',second:'2-digit'}:{}),hour12:false}):'尚無成功紀錄'};
const shortTime=s=>Number.isFinite(twDate(s))?new Date(twDate(s)).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
const icon=p=>/雷/.test(p?.condition||'')?'ϟ':/雨/.test(p?.condition||'')?'☂':/晴/.test(p?.condition||'')?'☀':'☁';
const safeLink=(url,hosts)=>{try{const u=new URL(url);return u.protocol==='https:'&&hosts.includes(u.hostname)?u.href:null}catch{return null}};
let county='臺北市';try{const saved=localStorage.getItem('taiwan-daily-county');if(COUNTIES.some(c=>c.name===saved))county=saved}catch{}
let region='全部',scope='related',category='all',newsLimit=7,portal=null,archive=null,land=[],portalFailed=false,archiveFailed=false,loading=false,stormIndex=0,versionIndex=0,points=[],timer=null;
function setHealth(id,source){const state=freshness(source);$(id).className='badge '+state;$(id).textContent={fresh:'已成功抓取',stale:'過期／待確認',unavailable:'尚無資料'}[state];return state}
function source(id){const s=portal?.sources?.[id];return portalFailed&&s?{...s,status:'error'}:s}
function cycloneSource(){const attempt=portal?.cycloneAttempt;const failed=attempt?.status==='error'&&Date.parse(attempt.attemptedAt)>=Date.parse(archive?.checkedAt||'');return archive?{status:archiveFailed||archive.mode!=='live'||failed?'error':'ok',checkedAt:archive.checkedAt,attemptedAt:attempt?.attemptedAt}:null}
for(const c of COUNTIES){for(const id of ['county','storm-county']){const o=el('option',null,c.name);o.value=c.name;$(id).append(o)}}$('county').value=$('storm-county').value=county;
for(const label of ['全部','北部','中部','南部','東部','離島']){const b=el('button',null,label);b.type='button';b.setAttribute('aria-pressed',label===region);b.onclick=()=>{region=label;for(const n of $('regions').children)n.setAttribute('aria-pressed',n===b);renderCounties()};$('regions').append(b)}
function selectCounty(name){county=name;$('county').value=$('storm-county').value=name;try{localStorage.setItem('taiwan-daily-county',name)}catch{}newsLimit=7;renderWeather();renderCounties();renderIsland();renderNews();renderTrackPoint()}
$('county').onchange=e=>selectCounty(e.target.value);
$('storm-county').onchange=e=>selectCounty(e.target.value);
function forecastFor(name){return source('forecast')?.data?.counties?.find(c=>c.name===name)}
function renderWeather(){
 const s=source('forecast'),state=setHealth('forecast-health',s),periods=validPeriods(forecastFor(county)),p=periods[0];
 $('weather-heading').textContent='我的縣市';$('map-city').textContent=county;
 $('condition').textContent=p?p.condition:'目前沒有可用的預報';$('temp').textContent=p?`${p.minT}—${p.maxT}`:'—';$('rain').textContent=p?`${p.pop}%`:'—';$('comfort').textContent=p?.comfort||'—';$('weather-icon').textContent=p?icon(p):'☁';
 $('forecast-valid').textContent=p?`預報有效：${fmt(p.start)} → ${fmt(p.end)}`:'來源尚未載入、抓取失敗或預報期間已結束。';
 $('forecast-message').className='source-note'+(state==='fresh'?'':' error');
 $('forecast-message').textContent=(state==='fresh'?'':s?.data?'⚠ 抓取失敗或逾 90 分鐘未確認更新，以下為上次資料。 ':'⚠ 尚未取得完整縣市預報。 ')+`氣溫為預報範圍，並非即時測站觀測。${s?.checkedAt?'成功抓取 '+fmt(s.checkedAt):''}`;
 $('periods').replaceChildren();
 for(const [i,p] of periods.entries()){
  const card=el('article','period-card'),top=el('div','period-top');top.append(el('span',null,i===0?'目前／下一期':'接續預報'),el('span',null,`${fmt(p.start)} → ${fmt(p.end)}`));
  const bottom=el('div','period-bottom');bottom.append(el('strong',null,`${p.minT}—${p.maxT}°`),el('span',null,`降雨 ${p.pop}%`));card.append(top,el('div','period-condition',`${icon(p)}  ${p.condition}`),bottom);$('periods').append(card);
 }
 if(!periods.length)$('periods').append(el('p','empty','尚無有效預報時段。可前往中央氣象署查詢；網站不以舊預報充當目前天氣。'));
}
function renderCounties(){
 $('county-grid').replaceChildren();const counties=COUNTIES.filter(c=>region==='全部'||c.region===region);$('county-count').textContent=`${counties.length} 縣市`;
 for(const c of counties){const p=validPeriods(forecastFor(c.name))[0],b=el('button','county-card'+(county===c.name?' selected':''));b.type='button';b.setAttribute('aria-label',`查看${c.name}天氣`);b.setAttribute('aria-pressed',county===c.name);b.onclick=()=>selectCounty(c.name);const top=el('div','county-top');top.append(el('strong',null,c.name),el('span',null,icon(p)));b.append(top,el('div','range',p?`${p.minT}—${p.maxT}°`:'—'),el('div','card-condition',p?.condition||'暫無有效預報'),el('div','rain',p?`降雨 ${p.pop}%`:'等待來源更新'),el('div','card-period',p?fmt(p.start):'—'));$('county-grid').append(b)}
}
function path(ring,project){return ring.map((p,i)=>(i?'L':'M')+project(p).map(n=>n.toFixed(1)).join(',')).join('')+'Z'}
function renderIsland(){
 const svg=$('island-map');svg.replaceChildren();const P=([lon,lat])=>[105+(lon-118.1)*70,455-(lat-21.5)*85];
 for(let x=100;x<500;x+=55)svg.append(sv('path',{class:'map-grid',d:`M${x} 20V480`}));for(let y=30;y<490;y+=55)svg.append(sv('path',{class:'map-grid',d:`M20 ${y}H500`}));
 const g=sv('g');for(const ring of land){const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);if(Math.max(...xs)-Math.min(...xs)<4&&Math.max(...ys)-Math.min(...ys)<6&&ring.some(([x,y])=>x>118&&x<123&&y>21.3&&y<26.7))g.append(sv('path',{class:'land',d:path(ring,P)}))}svg.append(g);
 const west=COUNTIES.filter(c=>!['臺北市','基隆市','宜蘭縣','花蓮縣','臺東縣','連江縣'].includes(c.name)).sort((a,b)=>b.lat-a.lat);
 const east=COUNTIES.filter(c=>!west.includes(c)).sort((a,b)=>b.lat-a.lat);
 for(const c of COUNTIES){const active=c.name===county,[x,y]=P([c.lon,c.lat]),isWest=west.includes(c),rank=(isWest?west:east).indexOf(c),lx=isWest?58:430,ly=isWest?78+rank*23:70+rank*54;
  const group=sv('g',{role:'button',tabindex:0,'aria-label':`選擇${c.name}`});group.onclick=()=>selectCounty(c.name);group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCounty(c.name)}};
  group.append(sv('rect',{x:isWest?lx-65:lx-4,y:ly-17,width:70,height:24,fill:'transparent'}),sv('circle',{cx:x,cy:y,r:11,fill:'transparent'}),sv('path',{d:`M${x} ${y}L${isWest?lx+48:lx-10} ${ly-3}`,fill:'none',stroke:active?'#8ce8c5':'#3b5860','stroke-width':active?1.3:.6,'pointer-events':'none'}),sv('circle',{cx:x,cy:y,r:active?6:3.5,class:'city-dot'+(active?' selected':'')}),sv('text',{x:lx,y:ly,class:'city-label'+(active?' selected':''),'text-anchor':isWest?'end':'start'},c.name));svg.append(group);
 }
}
function article(item){
 const a=el('article','article'),meta=el('div','article-meta');meta.append(el('span','tag',`${item.source} · ${item.category}`),el('time',null,fmt(item.publishedAt)));const url=safeLink(item.url,['www.cna.com.tw','www.cwa.gov.tw']);if(!url)return null;const link=el('a',null,item.title+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';a.append(meta,link);return a;
}
function renderWarnings(){
 const s=source('warnings');setHealth('warnings-health',s);$('warnings').replaceChildren();for(const item of (s?.data?.items||[]).slice(0,5)){const a=article(item);if(a)$('warnings').append(a)}
 if(!$('warnings').children.length)$('warnings').append(el('p','empty',s?.status==='ok'?'本次 RSS 未列近期發布紀錄，不能據此判定無有效警報。':'官方發布來源暫無可用資料，請直接查看氣象署警特報。'));
 if(s?.data&&freshness(s)!=='fresh')$('warnings').prepend(el('p','source-note error','⚠ 以下為上次抓取紀錄，請核對來源時間。'));
}
function renderNews(){
 const sources=[source('local'),source('life')],states=sources.map(s=>freshness(s));
 const state=states.every(s=>s==='fresh')?'fresh':states.every(s=>s==='unavailable')?'unavailable':'stale';$('news-health').className='badge '+state;$('news-health').textContent=state==='fresh'?'已成功抓取':state==='stale'?'部分來源待確認':'尚無資料';
 const items=[...new Map(sources.flatMap(s=>s?.data?.items||[]).map(i=>[i.url,i])).values()];const filtered=newsFor(items,county,scope).filter(i=>category==='all'||i.category===category);
 $('news-list').replaceChildren();$('news-context').textContent=(scope==='all'?'全台新聞':`${county}相關標題`)+` · ${filtered.length} 則`+(state==='fresh'?'':' · ⚠ 含未確認更新的來源');
 for(const item of filtered.slice(0,newsLimit)){const a=article(item);if(a)$('news-list').append(a)}
 if(!filtered.length){const box=el('p','empty',items.length?'這批標題沒有符合目前篩選的新聞，不代表此地沒有新聞。':'尚無可用新聞，請稍後重讀或前往中央社。');if(scope!=='all'){const b=el('button','quiet','查看全台新聞');b.onclick=()=>setScope('all');box.append(el('br'),b)}$('news-list').append(box)}
 $('more-news').hidden=filtered.length<=newsLimit;
}
function setScope(s){scope=s;newsLimit=7;for(const b of $('news-scopes').children)b.setAttribute('aria-pressed',b.dataset.scope===s);renderNews()}
for(const b of $('news-scopes').children)b.onclick=()=>setScope(b.dataset.scope);
$('news-category').onchange=e=>{category=e.target.value;newsLimit=7;renderNews()};$('more-news').onclick=()=>{newsLimit+=7;renderNews()};
function stop(){if(timer)clearInterval(timer);timer=null;$('play').textContent='▶ 播放';$('play').setAttribute('aria-label','播放颱風路徑')}
function renderStorm(reset=true){
 if(reset)stop();const state=setHealth('storm-health',cycloneSource()),active=activeCyclones(archive),items=archive?.items||[];
 const featured=featureCyclone(archive);$('storm').hidden=false;$('storm').classList.toggle('featured',featured);(featured?$('storm-primary-slot'):$('storm-secondary-slot')).append($('storm'));
 $('event-banner').hidden=true;
 if(!archive||archive.mode!=='live'){$('storm-state').textContent='尚未取得已驗證的熱帶氣旋資料，無法判定目前活動情形。';$('storm-active').hidden=true;return}
 $('storm-state').textContent=(state==='fresh'?'':'⚠ 本次更新未確認，以下為上次成功紀錄。 ')+(active.length?`氣象署最近回傳 ${active.length} 個熱帶氣旋。`:'氣象署最近一次成功檢查未回傳活動熱帶氣旋。')+` 保留 ${items.length} 個歷史紀錄；成功檢查 ${fmt(archive.checkedAt)}。`;
 $('storm-active').hidden=!items.length;if(!items.length)return;
 if(reset){const prior=$('storm-select').value;let index=items.findIndex(t=>`${t.year}:${t.tyNo}:${t.tdNo}`===prior);if(index<0||(featured&&!active.includes(items[index])))index=Math.max(0,items.indexOf(active[0]));stormIndex=index;$('storm-select').replaceChildren();for(const [i,t]of items.entries()){const o=el('option',null,`${t.year} ${t.name||t.en} ${active.includes(t)?'· API 目前回傳':'· 歷史'}`);o.value=`${t.year}:${t.tyNo}:${t.tdNo}`;o.dataset.index=i;$('storm-select').append(o)}$('storm-select').selectedIndex=stormIndex;versionIndex=Math.max(0,(items[stormIndex]?.fc?.length||1)-1);renderVersions()}
}
function renderVersions(){stop();const t=archive?.items?.[stormIndex];$('storm-name').textContent=t?.name||t?.en||'熱帶氣旋';$('storm-en').textContent=t?.en||'';$('storm-identity').textContent=t?`${t.year} · ${t.tyNo?'第 '+t.tyNo+' 號颱風':'熱帶性低氣壓'} · TROPICAL CYCLONE MONITOR`:'TROPICAL CYCLONE MONITOR';$('storm-official-time').textContent=`官方資料 ${fmt(archive?.sourceSent)}`;$('storm-check-time').textContent=`成功抓取 ${fmt(archive?.checkedAt)}`;stormVisual.reset();$('version-select').replaceChildren();for(const [i,f]of (t?.fc||[]).entries()){const o=el('option',null,`${fmt(f.init)} 起報`);o.value=i;$('version-select').append(o)}$('version-select').value=String(versionIndex);points=trackPoints(t,versionIndex);$('timeline').max=Math.max(0,points.length-1);$('timeline').value=Math.max(0,points.findLastIndex(p=>p.kind==='觀測'));$('play').disabled=points.length<2;renderTrackPoint()}
$('storm-select').onchange=e=>{stormIndex=e.target.selectedIndex;versionIndex=Math.max(0,(archive.items[stormIndex].fc?.length||1)-1);renderVersions()};$('version-select').onchange=e=>{versionIndex=Number(e.target.value);renderVersions()};$('timeline').oninput=()=>{stop();renderTrackPoint()};
$('play').onclick=()=>{if(timer){stop();return}if(Number($('timeline').value)>=points.length-1)$('timeline').value=0;$('play').textContent='Ⅱ 暫停';$('play').setAttribute('aria-label','暫停颱風路徑');timer=setInterval(()=>{const i=Number($('timeline').value)+1;if(i>=points.length){stop();return}$('timeline').value=i;renderTrackPoint()},1100)};
const stormVisual=new StormVisual($('storm-map'),index=>pickPoint(index));
function pickPoint(index){stop();$('timeline').value=Math.max(0,Math.min(points.length-1,index));renderTrackPoint()}
$('step-back').onclick=()=>pickPoint(Number($('timeline').value)-1);
$('step-next').onclick=()=>pickPoint(Number($('timeline').value)+1);
$('track-now').onclick=()=>pickPoint(Math.max(0,points.findLastIndex(p=>p.kind==='觀測')));
$('storm-zoom-in').onclick=()=>stormVisual.zoom(1.35);
$('storm-zoom-out').onclick=()=>stormVisual.zoom(1/1.35);
$('storm-zoom-reset').onclick=()=>stormVisual.reset();
for(const name of ['flow','wind','cone','forecast'])$('layer-'+name).onchange=e=>{stormVisual.setLayer(name,e.target.checked);if(name==='flow')$('flow-disclaimer').hidden=!e.target.checked};
$('layer-fulltrack').onchange=()=>{stormVisual.reset();renderTrackPoint()};
window.addEventListener('resize',()=>{stormVisual.reset();renderTrackPoint()});
function renderTrackPoint(){
 if(!points.length)return;const index=Number($('timeline').value),point=points[index]||points[0];
 stormVisual.draw({points,index,land,counties:COUNTIES,fullTrack:$('layer-fulltrack').checked});
 $('track-time').textContent=`${fmt(point.t)} · ${point.kind}`;$('timeline').setAttribute('aria-valuetext',$('track-time').textContent);
 $('step-back').disabled=index<=0;$('step-next').disabled=index>=points.length-1;
 $('storm-point-kind').textContent=point.kind==='觀測'?'OBSERVATION / 觀測':'FORECAST / 官方預報';$('storm-point-time').textContent=fmt(point.t);
 $('storm-position').textContent=`${point.lat.toFixed(1)}°N / ${point.lon.toFixed(1)}°E`;
 const dirs={N:'北',NNE:'北北東',NE:'東北',ENE:'東北東',E:'東',ESE:'東南東',SE:'東南',SSE:'南南東',S:'南',SSW:'南南西',SW:'西南',WSW:'西南西',W:'西',WNW:'西北西',NW:'西北',NNW:'北北西'};
 const direction=point.md?(dirs[point.md]||point.md):'方向見預報箭頭';
 $('storm-metrics').replaceChildren();
 const metrics=[['近中心風速',point.w,'m/s'],['中心氣壓',point.p,'hPa'],['瞬間陣風',point.g,'m/s'],['七級風半徑',point.c7?.[0],'km'],['十級風半徑',point.c10?.[0],'km'],['移動方向／速度',point.ms==null?direction:direction+' '+point.ms,'km/h']];
 for(const [i,[label,value,unit]] of metrics.entries()){const d=el('div',i<2?'primary-metric':'');d.append(el('span',null,label));const v=el('strong',null,value==null?'未提供':String(value));if(value!=null&&!(i===5&&point.ms==null))v.append(el('small',null,unit));d.append(v);$('storm-metrics').append(d)}
 const c=COUNTIES.find(c=>c.name===county);$('storm-distance').replaceChildren(el('span',null,`距${county}代表位置`),el('strong',null,`${Math.round(distance(point,c))} km`));
 $('storm-note').textContent=`資料依據：中央氣象署；官方資料時間 ${fmt(archive?.sourceSent)}（${archive?.sourceTimeBasis==='publication'?'發布時間':'起報／觀測時間，非發布時間'}）。路徑箭頭表示官方預報點間的移動走勢。旋流線僅為逆時針環流示意動畫，並非即時風向、雷達或實測風場；暴風圈與機率半徑為示意。縣市距離不代表全縣風雨影響。`;
}
function renderSources(){
 $('source-grid').replaceChildren();const entries=[...['forecast','warnings','local','life'].map(id=>[id,source(id)]),['cyclone',{...cycloneSource(),label:'中央氣象署 · 熱帶氣旋',url:'https://opendata.cwa.gov.tw/dataset/warning/W-C0034-005'}]];
 const labels={forecast:'縣市預報',warnings:'官方警報動態',local:'地方新聞',life:'生活新聞',cyclone:'熱帶氣旋'};
 for(const [id,s]of entries){const card=el('div','source-card'),state=freshness(s);card.append(el('span','badge '+state,{fresh:'已成功抓取',stale:'過期／待確認',unavailable:'尚無資料'}[state]),el('h3',null,labels[id]),el('p',null,`成功抓取：${fmt(s?.checkedAt,true)}`));if(s?.attemptedAt&&s.status!=='ok')card.append(el('p',null,`本次失敗：${fmt(s.attemptedAt)}`));if(id==='cyclone')card.append(el('p',null,`官方資料：${fmt(archive?.sourceSent)}`));const url=safeLink(s?.url,['opendata.cwa.gov.tw','www.cwa.gov.tw','feeds.feedburner.com']);if(url){const a=el('a',null,'查看來源 ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';card.append(a)}$('source-grid').append(card)}
 $('published-at').textContent=portal?.generatedAt?`資料檔產出 ${fmt(portal.generatedAt)}`:'資料檔尚未載入';
}
function renderAll(){renderWeather();renderCounties();renderIsland();renderWarnings();renderNews();renderStorm();renderSources()}
async function load(){
 if(loading)return;loading=true;$('refresh').disabled=true;$('refresh').textContent='確認中…';
 const read=async name=>{const r=await fetch(`data/${name}?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('unavailable');return r.json()};
 const results=await Promise.allSettled([read('portal.json'),read('archive.json'),land.length?Promise.resolve(land):read('land.json')]);
 if(results[0].status==='fulfilled'&&results[0].value.schema===1&&results[0].value.sources){portal=results[0].value;portalFailed=false}else portalFailed=true;
 if(results[1].status==='fulfilled'&&results[1].value.schema===1&&Array.isArray(results[1].value.items)){archive=results[1].value;archiveFailed=false}else archiveFailed=true;
 if(results[2].status==='fulfilled'&&Array.isArray(results[2].value))land=results[2].value;
 renderAll();$('load-status').textContent=portalFailed||archiveFailed?'部分網站資料讀取失敗，已標示待確認狀態。':'已重新讀取網站資料，請查看各來源的成功抓取時間。';loading=false;$('refresh').disabled=false;$('refresh').textContent='↻ 重新讀取';
}
function clock(){const now=new Date();$('clock').textContent=now.toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});$('today').textContent=now.toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',weekday:'short'})+' · 臺灣時間'}
$('refresh').onclick=load;clock();setInterval(clock,1000);load();setInterval(()=>{renderWeather();renderCounties();renderWarnings();renderNews();renderSources();setHealth('storm-health',cycloneSource())},60000);setInterval(()=>{if(!document.hidden)load()},600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();else stop()});
