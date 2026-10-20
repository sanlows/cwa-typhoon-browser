import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fromCompact,toCompact,merge,store} from '../scripts/track-core.mjs';
import {parseResponse,fetchCWA,keyOf} from '../scripts/update-data.mjs';

// Synthetic protocol fixtures used only by tests, never published as weather data.
const fixture=()=>({cwaopendata:{Sent:'2026-10-20T00:00:00+08:00',Dataset:{TropicalCyclones:{TropicalCyclone:{
  Year:'2026',TyphoonName:'TEST',CwaTyNo:'1',CwaTdNo:'2',CwaTyphoonName:'測試',
  AnalysisData:{Fix:{DateTime:'2026-10-19T12:00:00Z',CoordinateLongitude:'130',CoordinateLatitude:'20',MaxWindSpeed:'30'}},
  ForecastData:{Fix:{InitialTime:'2026-10-19T20:00:00+08:00',ForecastHour:'6',CoordinateLongitude:'129',CoordinateLatitude:'21'}}
}}}}});
test('supplied six-bulletin sample round-trips and merging is idempotent',async()=>{
  const data=JSON.parse(await readFile(new URL('../site/data/archive.json',import.meta.url),'utf8'));
  if(data.mode!=='sample')return;
  const t=fromCompact(data.items[0]);assert.equal(t.fc.length,6);assert.equal(t.an.length,23);
  assert.deepEqual(toCompact(t),data.items[0]);store.length=0;merge(t);merge(t);
  assert.equal(store.length,1);assert.equal(store[0].fc.length,6);
});
test('CWA parser converts UTC to Taiwan time and preserves forecast hours',()=>{
  const t=parseResponse(fixture())[0];assert.equal(t.an[0].t,'2026-10-19T20:00');
  assert.equal(t.fc[0].fixes[0].h,6);assert.equal(t.an[0].w,30);
});
test('valid no-cyclone response is distinct from error and malformed responses',()=>{
  assert.deepEqual(parseResponse({records:{TropicalCyclones:{}}}),[]);
  for(const data of [{success:'false'},{message:'error'},{records:{TropicalCyclones:{TropicalCyclone:{Year:2026}}}}])
    assert.throws(()=>parseResponse(data));
});
test('new forecast versions accumulate; newer correction replaces the same version',()=>{
  store.length=0;const a=parseResponse(fixture())[0];merge(a);
  const b=structuredClone(a);b.updated='2026-10-20T03:00';b.fc[0].init='2026-10-20T02:00';b.fc[0].sent=b.updated;merge(b);
  assert.equal(store[0].fc.length,2);b.fc[0].fixes[0].lon=128;merge(b);
  assert.equal(store[0].fc.length,2);assert.equal(store[0].fc[1].fixes[0].lon,128);
  const other={...a,year:'2027'};merge(other);assert.equal(store.length,2);
});
test('credentials are only in request headers; authorization failure is sanitized',async()=>{
  const secret='test-secret-not-a-real-key';
  await assert.rejects(fetchCWA(secret,async(url,options)=>{
    assert.ok(!url.includes(secret));assert.equal(options.headers.Authorization,secret);assert.equal(options.redirect,'error');
    return {status:401,ok:false};
  }), /CWA rejected/);
});
test('server response echoing a credential is blocked before publication',async()=>{
  await assert.rejects(fetchCWA('test-secret-not-a-real-key',async()=>({status:200,ok:true,text:async()=>'{"echo":"test-secret-not-a-real-key"}'})),/credential\/size guard/);
});
test('identity keys include year and distinguish numbered typhoons from depressions',()=>{
  assert.equal(keyOf({year:'2026',tyNo:'1'}),'2026:TY1');
  assert.equal(keyOf({year:'2026',tdNo:'1'}),'2026:TD1');
});
