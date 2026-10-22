import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitFrame,radiusPixels,pathAngle,flowArc,focusTrack} from '../site/storm-visual.mjs';
import {featureCyclone} from '../site/portal-core.mjs';
test('active official cyclone promotes the command view, empty or sample history does not',()=>{
 const item={year:'2026',tyNo:'29'};
 assert.equal(featureCyclone({mode:'live',activeKeys:['2026:TY29'],items:[item]}),true);
 assert.equal(featureCyclone({mode:'live',activeKeys:[],items:[item]}),false);
 assert.equal(featureCyclone({mode:'sample',activeKeys:['2026:TY29'],items:[item]}),false);
 assert.equal(featureCyclone(null),false);
});
test('map fitting retains Taiwan and official track positions within viewport',()=>{
 const points=[{lon:125.2,lat:21},{lon:127,lat:33}];const f=fitFrame(points);
 for(const p of [...points,{lon:119,lat:21},{lon:123,lat:26}]){const [x,y]=f.project([p.lon,p.lat]);assert.ok(x>=0&&x<=1000);assert.ok(y>=0&&y<=540)}
 assert.deepEqual(points,[{lon:125.2,lat:21},{lon:127,lat:33}]);
});
test('direction arrows follow screen segment direction',()=>{
 assert.equal(pathAngle([0,0],[10,0]),0);assert.equal(pathAngle([0,0],[0,-10]),-90);assert.equal(pathAngle([0,0],[-10,0]),180);
});
test('official radius retains units and missing radius never becomes a circle',()=>{
 const f=fitFrame([{lon:125,lat:21}]);assert.equal(radiusPixels(null,21,f),null);assert.equal(radiusPixels(0,21,f),null);
 const a=radiusPixels(160,21,f),b=radiusPixels(320,21,f);assert.equal(b.rx,a.rx*2);assert.equal(b.ry,a.ry*2);
});
test('illustrative flow is counterclockwise and independent of official track data',()=>{
 const point={lon:125,lat:21,w:51},f=fitFrame([point]),arc=flowArc(point,320,0,f),center=f.project([point.lon,point.lat]);
 assert.equal(arc.length,15);assert.ok(arc[0][0]>center[0]);assert.ok(arc[1][1]<arc[0][1]);assert.deepEqual(point,{lon:125,lat:21,w:51});
});
test('default view focuses recent history and next 48 hours while retaining selected and complete history',()=>{
 const points=[{t:'2026-10-18T08:00',kind:'觀測'},{t:'2026-10-22T16:00',kind:'觀測'},{t:'2026-10-23T16:00',kind:'官方預報'},{t:'2026-10-26T16:00',kind:'官方預報'}];
 assert.equal(focusTrack(points,1).length,2);assert.ok(focusTrack(points,3).includes(points[3]));assert.equal(focusTrack(points,1,true).length,4);assert.equal(points.length,4);
});
