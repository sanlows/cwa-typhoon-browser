import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COUNTIES,validPeriods,freshness,newsFor,trackPoints,activeCyclones,twDate} from '../site/portal-core.mjs';
import {parseForecast,parseFeed,collectSources,requestText} from '../scripts/update-portal.mjs';
const fixture=()=>({success:'true',records:{location:COUNTIES.map(c=>({locationName:c.name,weatherElement:['Wx','MinT','MaxT','PoP','CI'].map(elementName=>({elementName,time:[{startTime:'2026-10-22 12:00:00',endTime:'2026-10-22 18:00:00',parameter:{parameterName:({Wx:'多雲短暫雨',MinT:'21',MaxT:'26',PoP:'80',CI:'舒適'})[elementName]}}]}))}))}});
test('county forecasts validate complete 22-county coverage and values',()=>{
 const data=parseForecast(fixture());assert.equal(data.counties.length,22);assert.equal(data.counties[0].periods[0].pop,80);
 const missing=fixture();missing.records.location.pop();assert.throws(()=>parseForecast(missing),/coverage/);
 const invalid=fixture();invalid.records.location[0].weatherElement[3].time[0].parameter.parameterName='110';assert.throws(()=>parseForecast(invalid),/values/);
 const missingPeriod=fixture();missingPeriod.records.location[0].weatherElement[0].time=[];assert.throws(()=>parseForecast(missingPeriod),/periods/);
});
test('forecast effective time is Taiwan time; expired periods never appear as current',()=>{
 const c=parseForecast(fixture()).counties[0];assert.equal(twDate(c.periods[0].start),Date.parse('2026-10-22T04:00:00Z'));
 assert.equal(validPeriods(c,Date.parse('2026-10-22T09:00:00Z')).length,1);assert.equal(validPeriods(c,Date.parse('2026-10-22T10:00:00Z')).length,0);
});
const feed=(url='https://www.cna.com.tw/news/aloc/1.aspx',title='花蓮縣雨勢增強')=>`<rss><channel><item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>Thu, 22 Oct 2026 12:00:00 +0800</pubDate></item></channel></rss>`;
test('RSS keeps attributed headline links, decodes XML and tags county relations',()=>{
 const d=parseFeed(feed(undefined,'花蓮縣 &amp; 臺東縣'),{kind:'local',now:Date.parse('2026-10-22T05:00:00Z')});assert.equal(d.items[0].source,'中央通訊社');assert.equal(d.items[0].title,'花蓮縣 & 臺東縣');assert.deepEqual(d.items[0].counties,['花蓮縣','臺東縣']);assert.ok(!('description' in d.items[0]));
});
test('RSS rejects unsafe links, malformed documents, external entities and future entries',()=>{
 for(const value of [feed('javascript:alert(1)'),feed('https://evil.example/a'),'<html>blocked</html>','<!DOCTYPE rss SYSTEM "file:///a">'+feed()])assert.throws(()=>parseFeed(value,{kind:'local',now:Date.parse('2026-10-22T05:00:00Z')}));
 assert.throws(()=>parseFeed(feed(),{kind:'local',now:Date.parse('2026-10-21T05:00:00Z')}));
 assert.deepEqual(parseFeed('<rss><channel></channel></rss>',{kind:'warnings'}).items,[]);
});
test('news filters never substitute national stories as local matches',()=>{
 const a={title:'花蓮新聞',counties:['花蓮縣'],publishedAt:'2026-10-22T05:00:00Z'};
 assert.equal(newsFor([a],'臺北市').length,0);assert.equal(newsFor([a],'臺北市','all').length,1);
});
test('source failures preserve previous data and success time independently',async()=>{
 const previous={forecast:{checkedAt:'2026-10-21T00:00:00Z',data:{counties:[{name:'test'}]}}};
 const data=await collectSources(previous,{forecast:async()=>{throw new Error('secret raw error must not be published')},local:async()=>({items:[]})},'2026-10-22T00:00:00Z');
 assert.equal(data.forecast.status,'error');assert.deepEqual(data.forecast.data,previous.forecast.data);assert.equal(data.forecast.checkedAt,previous.forecast.checkedAt);assert.equal(data.local.status,'ok');assert.ok(!JSON.stringify(data).includes('secret raw'));
});
test('freshness distinguishes source error, expired/future status, and unavailable data',()=>{
 const now=Date.parse('2026-10-22T05:00:00Z');assert.equal(freshness({status:'ok',checkedAt:'2026-10-22T04:00:00Z'},now),'fresh');assert.equal(freshness({status:'error',checkedAt:'2026-10-22T04:00:00Z'},now),'stale');assert.equal(freshness({status:'ok',checkedAt:'2026-10-22T06:00:00Z'},now),'stale');assert.equal(freshness(null,now),'unavailable');
});
test('no active cyclone preserves historical tracks without claiming an ongoing cyclone',()=>{
 const t={year:'2026',tyNo:'29',fields:{an:['t','lon','lat'],fc:['h','lon','lat']},an:[['2026-10-22T11:00',125,21]],fc:[{init:'2026-10-22T11:00',fixes:[[6,124,22]]}]};
 const archive={items:[t],activeKeys:[]};assert.equal(activeCyclones(archive).length,0);assert.equal(trackPoints(t).length,2);assert.equal(trackPoints(t)[1].kind,'官方預報');assert.equal(t.an.length,1);
});
test('newer observations do not get mixed into an older forecast playback',()=>{
 const t={an:[['2026-10-22T11:00',125,21],['2026-10-22T14:00',124,22]],fc:[{init:'2026-10-22T11:00',fixes:[[6,123,23]]},{init:'2026-10-22T14:00',fixes:[[6,123,23]]}]};assert.equal(trackPoints(t,0).filter(p=>p.kind==='觀測').length,1);assert.equal(trackPoints(t).filter(p=>p.kind==='觀測').length,2);
});
test('data requests send credential in header only',async()=>{
 const key='test-only-secret';const text=await requestText('https://opendata.cwa.gov.tw/test',{key,fetcher:async(url,options)=>{assert.ok(!url.includes(key));assert.equal(options.headers.Authorization,key);assert.equal(options.redirect,'error');return{ok:true,text:async()=>'{}'}}});assert.equal(text,'{}');
});
