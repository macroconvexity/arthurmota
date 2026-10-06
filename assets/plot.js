/* Plot: small SVG charts in the site style. No dependencies.
   Plot.line(host, {x, series:[{name,y,dash,color,width}], xnum, log, pct, dec, zero, base, h, yfmt, xfmt, vline, title})
   Plot.stack(host, {x, series:[{name,y}], total:{name,y}, pct, dec, h})   stacked areas, positives up, negatives down
   Plot.bar(host, {x, series:[{name,y}], stacked, pct, dec, h})
   x is an array of labels (dates as YYYY-MM-DD strings get year ticks) or numbers when xnum is true.
   Each call builds a readout line above, the chart, and a legend below inside host. */
const Plot=(()=>{
const FILL=['#111','#777','#bbb','url(#p-diag)','#444','url(#p-dot)','#999','url(#p-cross)','#ddd'];
const DASH=['','5 3','2 3','8 3 2 3','1 2','10 4'];
const DEFS='<defs><pattern id="p-diag" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="#111" stroke-width="1.6"/></pattern><pattern id="p-dot" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#fff"/><circle cx="2" cy="2" r="1" fill="#111"/></pattern><pattern id="p-cross" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fff"/><path d="M0 3H6M3 0V6" stroke="#111" stroke-width=".8"/></pattern></defs>';
const W=720,L=50,R=8,T=8,B=22;
function fmt(o){const g=o.yfmt||(v=>o.pct?(v*100).toFixed(o.dec==null?0:o.dec)+'%':v.toFixed(o.dec==null?(Math.abs(v)>=100?0:2):o.dec));return v=>String(g(v)).replace(/^-/,'\u2212')}
function shell(host){host.innerHTML='<div class="readout"></div><div class="plot"></div><div class="legend"></div>';return host.children}
function xaxis(o,n,X,H){const x=o.x;let g='';const lab=(i,t,a)=>g+=`<text x="${X(i)}" y="${H-6}" text-anchor="${a||'middle'}" font-size="10" fill="#555">${t}</text>`;
 if(o.xnum){const lo=x[0],hi=x[n-1];for(let k=0;k<=5;k++){const v=lo+(hi-lo)*k/5;g+=`<text x="${L+(W-L-R)*k/5}" y="${H-6}" text-anchor="${k==0?'start':k==5?'end':'middle'}" font-size="10" fill="#555">${o.xfmt?o.xfmt(v):+v.toPrecision(4)}</text>`}return g}
 const isDate=typeof x[0]==='string'&&/^\d{4}-\d{2}/.test(x[0]);
 if(isDate&&n>300){const yrs=[];let last='';x.forEach((s,i)=>{const y=s.slice(0,4);if(y!==last){if(last)yrs.push([i,y]);last=y}});const k=Math.max(1,Math.ceil(yrs.length/8));yrs.filter((_,q)=>q%k===0).forEach(([i,y])=>{if(X(i)>L+12&&X(i)<W-R-12)lab(i,y)})}
 else{const k=Math.min(n,isDate?3:Math.min(n,8));for(let q=0;q<k;q++){const i=k==1?0:Math.round(q*(n-1)/(k-1));lab(i,o.xfmt?o.xfmt(x[i]):x[i],q==0?'start':q==k-1?'end':'middle')}}
 return g}
function frame(o,lo,hi,H){const f=fmt(o),T_=v=>o.log?Math.log(v):v;let g='';for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4,y=T+(H-T-B)*(1-k/4);g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#eee"/><text x="${L-5}" y="${y+3}" text-anchor="end" font-size="10" fill="#555">${f(o.log?Math.exp(v):v)}</text>`}return g}
function hover(svg,ro,o,n,X,text){const xl=svg.querySelector('.x');svg.addEventListener('pointermove',e=>{const bb=svg.getBoundingClientRect(),px=(e.clientX-bb.left)/bb.width*W;let i;
 if(o.xnum){const v=o.x[0]+(o.x[n-1]-o.x[0])*(px-L)/(W-L-R);i=0;let d=1e99;for(let j=0;j<n;j++){const q=Math.abs(o.x[j]-v);if(q<d){d=q;i=j}}}else i=Math.max(0,Math.min(n-1,Math.round((px-L)/(W-L-R)*(n-1))));
 xl.setAttribute('x1',X(i));xl.setAttribute('x2',X(i));xl.setAttribute('visibility','visible');ro.textContent=text(i)});
 svg.addEventListener('pointerleave',()=>{xl.setAttribute('visibility','hidden');ro.textContent=''})}
function line(host,o){const[ro,pl,lg]=shell(host),H=o.h||250,n=o.x.length,S=o.series.map((s,i)=>({color:'#111',dash:DASH[i%DASH.length],width:1.4,...s})),T_=v=>o.log?Math.log(v):v,f=fmt(o);
 let lo=1e99,hi=-1e99;S.forEach(s=>s.y.forEach(v=>{if(v===v&&v!=null&&(!o.log||v>0)){lo=Math.min(lo,T_(v));hi=Math.max(hi,T_(v))}}));
 if(o.zero){lo=Math.min(lo,0);hi=Math.max(hi,0)}if(o.base!=null){lo=Math.min(lo,T_(o.base));hi=Math.max(hi,T_(o.base))}if(o.ymin!=null)lo=o.ymin;if(o.ymax!=null)hi=o.ymax;const pad=(hi-lo)*.05||1;lo-=pad;hi+=pad;
 const X=o.xnum?i=>L+(W-L-R)*(o.x[i]-o.x[0])/(o.x[n-1]-o.x[0]):i=>L+(W-L-R)*(n>1?i/(n-1):.5),Y=v=>T+(H-T-B)*(1-(T_(v)-lo)/(hi-lo));
 let g=frame(o,lo,hi,H)+xaxis(o,n,X,H);
 if(o.zero&&lo<0&&hi>0)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#888"/>`;
 if(o.base!=null)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(o.base)}" y2="${Y(o.base)}" stroke="#888"/>`;
 (o.vline||[]).forEach(v=>{const i=o.xnum?null:o.x.indexOf(v),xx=o.xnum?L+(W-L-R)*(v-o.x[0])/(o.x[n-1]-o.x[0]):X(i);if(xx>=L&&xx<=W-R)g+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}" stroke="#888" stroke-dasharray="3 3"/>`});
 S.forEach(s=>{let d='',pen=false;s.y.forEach((v,i)=>{if(v!==v||v==null||(o.log&&v<=0)){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);pen=true});g+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" ${s.dash?`stroke-dasharray="${s.dash}"`:''}/>`});
 pl.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.title||'chart'}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="none" stroke="#111"/>${g}<line class="x" y1="${T}" y2="${H-B}" stroke="#111" stroke-dasharray="2 2" visibility="hidden"/></svg>`;
 hover(pl.firstChild,ro,o,n,X,i=>(o.xfmt?o.xfmt(o.x[i]):o.xnum?+o.x[i].toPrecision(5):o.x[i])+'  '+S.map(s=>s.name+' '+(s.y[i]===s.y[i]&&s.y[i]!=null?f(s.y[i]):'–')).join('  '));
 lg.innerHTML=S.length>1||o.legend?S.map(s=>`<span><svg viewBox="0 0 22 8"><line x1="0" x2="22" y1="4" y2="4" stroke="${s.color}" stroke-width="2" ${s.dash?`stroke-dasharray="${s.dash}"`:''}/></svg>${s.name}</span>`).join(''):''}
function stackGeom(o){const n=o.x.length,S=o.series.map((s,i)=>({fill:FILL[i%FILL.length],...s})),up=new Array(n).fill(0),dn=new Array(n).fill(0),bands=S.map(()=>[]);
 for(let i=0;i<n;i++)S.forEach((s,k)=>{const v=s.y[i]===s.y[i]&&s.y[i]!=null?s.y[i]:0;if(v>=0){bands[k].push([up[i],up[i]+v]);up[i]+=v}else{bands[k].push([dn[i]+v,dn[i]]);dn[i]+=v}});
 let lo=Math.min(0,...dn),hi=Math.max(0,...up);if(o.total)o.total.y.forEach(v=>{if(v===v&&v!=null){lo=Math.min(lo,v);hi=Math.max(hi,v)}});const pad=(hi-lo)*.05||1;return{n,S,bands,lo:lo-pad,hi:hi+pad}}
function legendFill(S,tot){return S.map(s=>`<span><svg viewBox="0 0 22 8">${DEFS}<rect width="22" height="8" fill="${s.fill}" stroke="#111" stroke-width=".5"/></svg>${s.name}</span>`).join('')+(tot?`<span><svg viewBox="0 0 22 8"><line x1="0" x2="22" y1="4" y2="4" stroke="#111" stroke-width="2"/></svg>${tot.name}</span>`:'')}
function stack(host,o){const[ro,pl,lg]=shell(host),H=o.h||280,{n,S,bands,lo,hi}=stackGeom(o),f=fmt(o),X=i=>L+(W-L-R)*(n>1?i/(n-1):.5),Y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
 let g=frame(o,lo,hi,H)+xaxis(o,n,X,H);
 // each series is drawn as two areas, one above zero and one below, so a sign change never drags an edge across the chart
 const st=Math.max(1,Math.ceil(n/1200)),ix=[];for(let i=0;i<n;i+=st)ix.push(i);if(ix[ix.length-1]!==n-1)ix.push(n-1);
 S.forEach((s,k)=>{[1,-1].forEach(sg=>{let a='',b='',any=false;const e=i=>{const[u,v]=bands[k][i],pos=v>0||(v===0&&u>=0)&&u>=0&&v>=u&&!(u<0);const isPos=u>=0&&v>=0;if((sg>0)===isPos)return[u,v];
   let base=0;for(let j=0;j<k;j++){const[p,q]=bands[j][i];if(sg>0&&p>=0&&q>=0)base=Math.max(base,q);if(sg<0&&p<=0&&q<=0)base=Math.min(base,p)}return[base,base]};
  ix.forEach((i,q)=>{const[u,v]=e(i);if(v-u>1e-9)any=true;a+=(q?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)});for(let q=ix.length-1;q>=0;q--){const i=ix[q];b+='L'+X(i).toFixed(1)+' '+Y(e(i)[0]).toFixed(1)}
  if(any)g+=`<path d="${a}${b}Z" fill="${s.fill}" stroke="none"/>`})});
 g+=`<line x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#111" stroke-width=".6"/>`;
 (o.vline||[]).forEach(v=>{const i=o.x.indexOf(v);if(i>0)g+=`<line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H-B}" stroke="#111" stroke-dasharray="3 3"/>`});
 if(o.total){let d='',pen=false;o.total.y.forEach((v,i)=>{if(v!==v||v==null){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);pen=true});g+=`<path d="${d}" fill="none" stroke="#fff" stroke-width="3.2"/><path d="${d}" fill="none" stroke="#111" stroke-width="1.6"/>`}
 pl.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.title||'chart'}">${DEFS}<rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="none" stroke="#111"/>${g}<line class="x" y1="${T}" y2="${H-B}" stroke="#111" stroke-dasharray="2 2" visibility="hidden"/></svg>`;
 hover(pl.firstChild,ro,o,n,X,i=>o.x[i]+'  '+(o.total?o.total.name+' '+f(o.total.y[i])+'  ':'')+S.map(s=>s.name+' '+(s.y[i]===s.y[i]&&s.y[i]!=null?f(s.y[i]):'–')).join('  '));
 lg.innerHTML=legendFill(S,o.total)}
function bar(host,o){const[ro,pl,lg]=shell(host),H=o.h||250,n=o.x.length,S=o.series.map((s,i)=>({fill:FILL[i%FILL.length],...s})),f=fmt(o);let lo=0,hi=0;
 if(o.stacked){for(let i=0;i<n;i++){let u=0,d=0;S.forEach(s=>{const v=s.y[i]||0;v>=0?u+=v:d+=v});lo=Math.min(lo,d);hi=Math.max(hi,u)}}else S.forEach(s=>s.y.forEach(v=>{if(v===v&&v!=null){lo=Math.min(lo,v);hi=Math.max(hi,v)}}));
 const pad=(hi-lo)*.06||1;if(lo<0)lo-=pad;hi+=pad;const bw=(W-L-R)/n,X=i=>L+bw*(i+.5),Y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));let g=frame(o,lo,hi,H);
 const k=Math.max(1,Math.ceil(n/12));o.x.forEach((t,i)=>{if(i%k===0)g+=`<text x="${X(i)}" y="${H-6}" text-anchor="middle" font-size="10" fill="#555">${o.xfmt?o.xfmt(t):t}</text>`});
 for(let i=0;i<n;i++){let u=0,d=0;S.forEach((s,j)=>{const v=s.y[i];if(v!==v||v==null)return;let y0,y1,x0,w;if(o.stacked){if(v>=0){y0=u;u+=v;y1=u}else{y1=d;d+=v;y0=d}x0=X(i)-bw*.35;w=bw*.7}else{y0=Math.min(0,v);y1=Math.max(0,v);w=bw*.7/S.length;x0=X(i)-bw*.35+w*j}
  g+=`<rect x="${x0.toFixed(1)}" y="${Y(Math.max(y0,y1)).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.abs(Y(y0)-Y(y1)).toFixed(1)}" fill="${s.fill}" stroke="#111" stroke-width=".4"/>`})}
 g+=`<line x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#111" stroke-width=".6"/>`;
 pl.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.title||'chart'}">${DEFS}<rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="none" stroke="#111"/>${g}<line class="x" y1="${T}" y2="${H-B}" stroke="#111" stroke-dasharray="2 2" visibility="hidden"/></svg>`;
 hover(pl.firstChild,ro,o,n,X,i=>(o.xfmt?o.xfmt(o.x[i]):o.x[i])+'  '+S.map(s=>s.name+' '+(s.y[i]===s.y[i]&&s.y[i]!=null?f(s.y[i]):'–')).join('  '));
 lg.innerHTML=S.length>1?legendFill(S):''}
return{line,stack,bar,FILL,DASH}})();
