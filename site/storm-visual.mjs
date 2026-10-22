// Official points and radii are kept separate from the labelled illustrative flow.
const stamp=s=>Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s)?s:s+'+08:00');
export function focusTrack(points,index,fullTrack=false){
 if(fullTrack||!points.length)return points;
 const observations=points.filter(p=>p.kind==='觀測'),anchor=stamp((observations.at(-1)||points[0]).t);
 const selected=points[index]||points[0];
 return [...new Set([...points.filter(p=>stamp(p.t)>=anchor-24*3600000&&stamp(p.t)<=anchor+48*3600000),selected])];
}
export function fitFrame(points,width=1000,height=540){
 const xs=[119,123,...points.map(p=>p.lon)],ys=[21,26,...points.map(p=>p.lat)];
 let w=Math.min(...xs)-1.4,e=Math.max(...xs)+1.4,s=Math.min(...ys)-1.4,n=Math.max(...ys)+1.4;
 const scale=Math.cos((n+s)/2*Math.PI/180),aspect=width/height;
 if((e-w)*scale/(n-s)<aspect){const extra=((n-s)*aspect/scale-(e-w))/2;w-=extra;e+=extra}else{const extra=((e-w)*scale/aspect-(n-s))/2;s-=extra;n+=extra}
 return {w,e,s,n,width,height,project:([lon,lat])=>[(lon-w)/(e-w)*width,(n-lat)/(n-s)*height]};
}
export function radiusPixels(km,lat,frame){
 if(!Number.isFinite(km)||km<=0)return null;
 return {rx:km/(111*Math.cos(lat*Math.PI/180))/(frame.e-frame.w)*frame.width,ry:km/111/(frame.n-frame.s)*frame.height};
}
export function pathAngle(a,b){return Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI}
export function flowArc(point,radius,start,frame){
 return Array.from({length:15},(_,i)=>{const angle=start+i*.07,r=radius*(1-i*.009);return frame.project([point.lon+Math.cos(angle)*r/(111*Math.cos(point.lat*Math.PI/180)),point.lat+Math.sin(angle)*r/111])});
}
const NS='http://www.w3.org/2000/svg';
const node=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n};
const line=points=>points.map((p,i)=>(i?'L':'M')+p.map(n=>n.toFixed(2)).join(',')).join('');
export class StormVisual{
 constructor(svg,onSelect){
  this.svg=svg;this.width=1000;this.height=540;this.onSelect=onSelect;this.layers={flow:true,wind:true,cone:true,forecast:true};this.view={k:1,x:0,y:0};
  svg.setAttribute('viewBox','0 0 1000 540');
  let drag=null;
  svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-track-index]'))return;drag={px:e.clientX,py:e.clientY,x:this.view.x,y:this.view.y};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging')});
  svg.addEventListener('pointermove',e=>{if(!drag)return;const rect=svg.getBoundingClientRect();this.view.x=drag.x+(e.clientX-drag.px)*this.width/rect.width;this.view.y=drag.y+(e.clientY-drag.py)*this.height/rect.height;this.applyView()});
  const release=()=>{drag=null;svg.classList.remove('dragging')};svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);
 }
 zoom(factor){const k=Math.max(1,Math.min(5,this.view.k*factor)),ratio=k/this.view.k;this.view={k,x:this.width/2-(this.width/2-this.view.x)*ratio,y:this.height/2-(this.height/2-this.view.y)*ratio};if(k===1)this.view={k:1,x:0,y:0};this.applyView()}
 reset(){this.view={k:1,x:0,y:0};this.applyView()}
 applyView(){this.scene?.setAttribute('transform',`translate(${this.view.x} ${this.view.y}) scale(${this.view.k})`);this.svg.setAttribute('data-zoom',this.view.k.toFixed(2))}
 setLayer(name,value){this.layers[name]=value;const g=this.scene?.querySelector(`[data-layer="${name}"]`);if(g)g.style.display=value?'':'none'}
 draw({points,index,land,counties,fullTrack=false}){
  this.svg.replaceChildren();if(!points.length)return;
  const rect=this.svg.getBoundingClientRect(),width=rect.width||1000,height=rect.height||width*.54;this.width=width;this.height=height;this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const frame=fitFrame(focusTrack(points,index,fullTrack),width,height),P=frame.project,point=points[index]||points[0],scene=node('g');this.scene=scene;this.svg.append(scene);this.applyView();
  const defs=node('defs'),glow=node('filter',{id:'storm-glow',x:'-100%',y:'-100%',width:'300%',height:'300%'});glow.append(node('feGaussianBlur',{stdDeviation:6}));defs.append(glow);this.svg.prepend(defs);
  for(let lon=Math.ceil(frame.w);lon<frame.e;lon+=2){const [x]=P([lon,0]);scene.append(node('path',{class:'map-grid',d:`M${x} 0V${height}`}),node('text',{x:x+4,y:height-13,class:'geo-label'},`${lon}°E`))}
  for(let lat=Math.ceil(frame.s);lat<frame.n;lat+=2){const [,y]=P([0,lat]);scene.append(node('path',{class:'map-grid',d:`M0 ${y}H${width}`}),node('text',{x:7,y:y-5,class:'geo-label'},`${lat}°N`))}
  for(const ring of land)if(ring.some(([x,y])=>x>frame.w&&x<frame.e&&y>frame.s&&y<frame.n))scene.append(node('path',{class:'land',d:line(ring.map(P))+'Z'}));
  const layer=name=>{const g=node('g',{'data-layer':name,'pointer-events':'none'});g.style.display=this.layers[name]?'':'none';scene.append(g);return g};
  const forecast=points.filter(p=>p.kind==='官方預報'),observed=points.filter(p=>p.kind==='觀測');
  const cone=layer('cone');for(const p of forecast){const r=radiusPixels(p.r70,p.lat,frame);if(!r)continue;const [cx,cy]=P([p.lon,p.lat]);cone.append(node('ellipse',{cx,cy,...r,fill:'#e9bb6330',stroke:'#e9bb6360','stroke-width':.8}))}
  const flow=layer('flow');for(let ring=0;ring<13;ring++)for(let arm=0;arm<9;arm++){
   const radius=70+ring*56,arc=flowArc(point,radius,arm*Math.PI*2/9+ring*.17,frame);
   flow.append(node('path',{class:'wind-stream',d:line(arc),fill:'none',stroke:ring<6?'#ade5e5':'#659aa7','stroke-width':ring<6?1.15:.8,opacity:.48-ring*.018,'stroke-dasharray':'12 74',style:`animation-duration:${2.8+ring*.23}s;animation-delay:-${arm*.29+ring*.19}s`}))
  }
  for(const c of counties.filter(c=>['臺北市','臺中市','高雄市','花蓮縣','宜蘭縣','臺東縣'].includes(c.name))){const [x,y]=P([c.lon,c.lat]);scene.append(node('circle',{cx:x,cy:y,r:2.5,fill:'#bed1d2'}),node('text',{x:x+(c.lon>121.3?8:-8),y:y+3,'text-anchor':c.lon>121.3?'start':'end',class:'city-label'},c.name.replace(/[市縣]$/,'')))}
  const taiwan=P([120.9,23.6]);scene.append(node('text',{x:taiwan[0],y:taiwan[1]-16,'text-anchor':'middle',class:'taiwan-label'},'臺 灣'));
  if(observed.length>1)scene.append(node('path',{d:line(observed.map(p=>P([p.lon,p.lat]))),fill:'none',stroke:'#b7e6db','stroke-width':2.1}));
  const forecastLayer=layer('forecast'),future=[...(observed.length?[observed.at(-1)]:[]),...forecast];
  if(future.length>1)forecastLayer.append(node('path',{d:line(future.map(p=>P([p.lon,p.lat]))),fill:'none',stroke:'#f4c277','stroke-width':2.3,'stroke-dasharray':'7 6'}));
  for(let i=0;i<future.length-1;i++){
   const a=P([future[i].lon,future[i].lat]),b=P([future[i+1].lon,future[i+1].lat]);if(Math.hypot(b[0]-a[0],b[1]-a[1])<12)continue;
   forecastLayer.append(node('path',{d:'M-6 -4L3 0L-6 4',fill:'none',stroke:'#f4c277','stroke-width':1.6,transform:`translate(${(a[0]+b[0])/2} ${(a[1]+b[1])/2}) rotate(${pathAngle(a,b)})`}))
  }
  for(const [i,p]of points.entries()){
   const [x,y]=P([p.lon,p.lat]);const g=node('g',{'data-track-index':i,role:'button',tabindex:0,'aria-label':`${p.kind} ${new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(p.t)?p.t:p.t+'+08:00').toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}`});
   const pick=()=>this.onSelect(i);g.onclick=e=>{e.stopPropagation();pick()};g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}};
   g.append(node('circle',{cx:x,cy:y,r:10,fill:'transparent'}),node('circle',{cx:x,cy:y,r:p.kind==='觀測'?3:4,fill:p.kind==='觀測'?'#b7e6db':'#101f29',stroke:p.kind==='觀測'?'#b7e6db':'#f4c277','stroke-width':1.4}));
   (p.kind==='觀測'?scene:forecastLayer).append(g);
   if(p.kind==='官方預報'&&i%2===0){const date=new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(p.t)?p.t:p.t+'+08:00');forecastLayer.append(node('text',{x:x+10,y:y-8,fill:'#f4c277','font-size':12},date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false})))}
  }
  // Allow forecast points to receive clicks despite their layer's default setting.
  forecastLayer.querySelectorAll('[data-track-index]').forEach(g=>g.setAttribute('pointer-events','all'));
  const wind=layer('wind'),[x,y]=P([point.lon,point.lat]);for(const [value,color]of [[point.c7?.[0],'#f4c277'],[point.c10?.[0],'#ff8e83']]){const r=radiusPixels(value,point.lat,frame);if(r)wind.append(node('ellipse',{cx:x,cy:y,...r,fill:color+'12',stroke:color,'stroke-width':1.6}))}
  scene.append(node('circle',{cx:x,cy:y,r:20,fill:'#8ce8c5',opacity:.55,filter:'url(#storm-glow)'}),node('circle',{cx:x,cy:y,r:8,fill:'#0b151c',stroke:'#f4eee5','stroke-width':2.5}),node('circle',{cx:x,cy:y,r:2,fill:'#f4eee5'}));
 }
}
