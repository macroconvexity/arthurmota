(async()=>{
const J=u=>fetch('data/'+u).then(r=>r.json());
const [raw,M,R,SP,Y,meta]=await Promise.all([fetch('data/returns_daily.csv').then(r=>r.text()),J('metrics.json'),J('regressions.json'),J('spanning.json'),J('yearly.json'),J('meta.json')]);
const L=raw.trim().split('\n'),cols=L[0].split(','),D=[],C={};cols.slice(1).forEach(c=>C[c]=[]);
for(let i=1;i<L.length;i++){const p=L[i].split(',');D.push(p[0]);for(let j=1;j<p.length;j++)C[cols[j]].push(p[j]===''?NaN:+p[j]);}
const $=id=>document.getElementById(id),lab=meta.labels,N=D.length,FK=Object.keys(meta.factor_defs),GRAY='#888';
$('stamp').textContent=`Data through ${meta.last_date}. ${meta.n_stocks} stocks, $${meta.mktcap_usd_tn} trillion. Portfolios formed ${meta.formation}. T-bill ${meta.rf_last_annual_pct}%.`;
const M_=s=>s.replace(/^-/,'\u2212'),P=(x,d=1)=>x==null?'–':M_((x*100).toFixed(d)+'%'),F=(x,d=2)=>x==null?'–':M_(x.toFixed(d));
let win='Full';const NW={'1Y':252,'5Y':1260,Full:N};
const slice=()=>{const n=Math.min(NW[win],N);return[N-n,N]};
function navOf(v,a,b){const o=[];let x=null;for(let i=a;i<b;i++){const r=v[i];if(r!==r){o.push(x==null?NaN:x);continue}x=(x==null?100:x)*(1+r);o.push(x)}return o}
function ddOf(nav){let m=-1,o=[];for(const x of nav){if(x!==x){o.push(NaN);continue}m=Math.max(m,x);o.push(x/m-1)}return o}
function rollBeta(y,m,a,b,w=252){const o=[];for(let i=a;i<b;i++){if(i-w+1<0){o.push(NaN);continue}let sy=0,sm=0,smm=0,sym=0,n=0;for(let j=i-w+1;j<=i;j++){const u=y[j],v=m[j];if(u===u&&v===v){sy+=u;sm+=v;smm+=v*v;sym+=u*v;n++}}o.push(n<w*.8?NaN:(sym-sy*sm/n)/(smm-sm*sm/n))}return o}
function chart(host,ro,leg,a,b,S,{log,pct,dec,base}){
 const W=720,H=250,l=46,r=8,t=8,bt=22,n=b-a,ds=D.slice(a,b);let lo=1e9,hi=-1e9;const T=x=>log?Math.log(x):x;
 S.forEach(s=>s.v.forEach(x=>{if(x===x){lo=Math.min(lo,T(x));hi=Math.max(hi,T(x))}}));
 if(pct)hi=Math.max(hi,0);if(base){lo=Math.min(lo,T(base));hi=Math.max(hi,T(base))}const pad=(hi-lo)*.05||1;lo-=pad;hi+=pad;
 const X=i=>l+(W-l-r)*i/(n-1),Yy=x=>t+(H-t-bt)*(1-(T(x)-lo)/(hi-lo));let g='';
 for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4,y=t+(H-t-bt)*(1-k/4),val=log?Math.exp(v):v;
  g+=`<line x1="${l}" x2="${W-r}" y1="${y}" y2="${y}" stroke="#eee"/><text x="${l-5}" y="${y+3}" text-anchor="end" font-size="10" fill="#555">${pct?(val*100).toFixed(0)+'%':val.toFixed(dec||0)}</text>`}
 if(n<=300)[0,Math.floor(n/2),n-1].forEach(i=>g+=`<text x="${X(i)}" y="${H-6}" text-anchor="${i?i==n-1?'end':'middle':'start'}" font-size="10" fill="#555">${ds[i]}</text>`);
 else{const step=Math.max(1,Math.round(n/252/6));let last='';ds.forEach((d,i)=>{const y=d.slice(0,4);if(y!==last){if(last&&(+y)%step===0&&i<n-40)g+=`<text x="${X(i)}" y="${H-6}" text-anchor="middle" font-size="10" fill="#555">${y}</text>`;last=y}})}
 if(base)g+=`<line x1="${l}" x2="${W-r}" y1="${Yy(base)}" y2="${Yy(base)}" stroke="#888"/>`;
 S.forEach(s=>{let d='',pen=false;s.v.forEach((x,i)=>{if(x!==x){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Yy(x).toFixed(1);pen=true});g+=`<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w||1.4}" ${s.d?`stroke-dasharray="${s.d}"`:''}/>`});
 host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img"><rect x="${l}" y="${t}" width="${W-l-r}" height="${H-t-bt}" fill="none" stroke="#111"/>${g}<line class="x" y1="${t}" y2="${H-bt}" stroke="#111" stroke-dasharray="2 2" visibility="hidden"/></svg>`;
 const svg=host.firstChild,xl=svg.querySelector('.x');
 svg.addEventListener('pointermove',e=>{const bb=svg.getBoundingClientRect(),px=(e.clientX-bb.left)/bb.width*W;let i=Math.max(0,Math.min(n-1,Math.round((px-l)/(W-l-r)*(n-1))));
  xl.setAttribute('x1',X(i));xl.setAttribute('x2',X(i));xl.setAttribute('visibility','visible');
  ro.textContent=ds[i]+'  '+S.map(s=>s.k+' '+(s.v[i]===s.v[i]?(pct?(s.v[i]*100).toFixed(1)+'%':s.v[i].toFixed(dec==null?1:dec)):'–')).join('  ')});
 svg.addEventListener('pointerleave',()=>{xl.setAttribute('visibility','hidden');ro.textContent=''});
 leg.innerHTML=S.map(s=>`<span><svg viewBox="0 0 22 8"><line x1="0" x2="22" y1="4" y2="4" stroke="${s.c}" stroke-width="2" ${s.d?`stroke-dasharray="${s.d}"`:''}/></svg>${s.name}</span>`).join('');
}
function spark(v,ds){const W=160,H=54,A=12,x=v.filter(z=>z===z);let lo=Math.min(...x,100),hi=Math.max(...x,100);const T=Math.log;lo=T(lo);hi=T(hi);const pad=(hi-lo)*.08||.01;lo-=pad;hi+=pad;
 const n=v.length,st=Math.max(1,Math.floor(n/160)),X=i=>W*i/(n-1);let d='',pen=false;for(let i=0;i<n;i+=st){const z=v[i];if(z!==z)continue;d+=(pen?'L':'M')+X(i).toFixed(1)+' '+(H*(1-(T(z)-lo)/(hi-lo))).toFixed(1);pen=true}
 const y0=H*(1-(T(100)-lo)/(hi-lo));let ax=`<line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#111" stroke-width=".6"/>`;
 const tick=(i,t,anc)=>{ax+=`<line x1="${X(i)}" x2="${X(i)}" y1="${H}" y2="${H+3}" stroke="#111" stroke-width=".6"/><text x="${X(i)}" y="${H+A-1}" font-size="8.5" fill="#555" text-anchor="${anc}">${t}</text>`};
 if(n<=300){tick(0,ds[0].slice(0,7),'start');tick(n-1,ds[n-1].slice(0,7),'end')}
 else{const yrs=[];let last='';ds.forEach((s,i)=>{const y=s.slice(0,4);if(y!==last){if(last)yrs.push([i,y]);last=y}});const k=Math.max(1,Math.ceil(yrs.length/4));
  yrs.filter((_,q)=>q%k===0).forEach(([i,y])=>{if(X(i)>8&&X(i)<W-8)tick(i,y,'middle')})}
 return `<svg viewBox="0 0 ${W} ${H+A}"><line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="#ccc"/><path d="${d}" fill="none" stroke="#111" stroke-width="1.2"/>${ax}</svg>`}
function grid(){const[a,b]=slice(),m=M[win];
 $('grid').innerHTML=FK.map(k=>`<div class="cell" data-k="${k}"><b>${k}</b><span class="t">${lab[k].label}</span><span class="s">${P(m[k].cagr)} a year</span>${spark(navOf(C[k],a,b),D.slice(a,b))}</div>`).join('')}
let LG=null;
async function legs(){if(LG)return LG;const t=(await fetch('data/legs_daily.csv').then(r=>r.text())).trim().split('\n'),c=t[0].split(',');LG={};c.slice(1).forEach(x=>LG[x]=[]);
 for(let i=1;i<t.length;i++){const p=t[i].split(',');for(let j=1;j<p.length;j++)LG[c[j]].push(p[j]===''?NaN:+p[j])}return LG}
async function draw(){
 const[a,b]=slice(),k=$('sel').value,sp=navOf(C.SPX,a,b),sk=navOf(C[k],a,b),isF=lab[k].group==='Factor';
 const two=(x,y)=>[{k:'SPX',name:'S&P 500',v:x,c:GRAY},{k,name:lab[k].label,v:y,c:'#111',w:1.6}];
 $('fx').style.display=isF?'':'none';$('plain').textContent=isF?k+': '+meta.factor_defs[k].plain.toLowerCase()+'.':'';
 if(isF){const g=await legs();if($('sel').value!==k)return;const pl=meta.factor_defs[k].plain.toLowerCase().split(' minus ').map(s=>s.replace(/,$/,''));
  $('t2').textContent='The two sides of the factor and the S&P 500, each rebased to 100, log scale';
  $('n2').textContent=k==='MKT'?'The long side is every stock in the model, weighted by size. The short side is cash.':'Both sides hold stocks, so both follow the market. The factor is only the gap between the solid and the dashed line.';
  chart($('c2'),$('r2'),$('l2'),a,b,[{k:'SPX',name:'S&P 500',v:sp,c:GRAY},{k:'long',name:'Long side: '+pl[0],v:navOf(g[k+'_L'],a,b),c:'#111',w:1.6},{k:'short',name:'Short side: '+(pl[1]||''),v:navOf(g[k+'_S'],a,b),c:'#111',w:1.3,d:'5 3'}],{log:true});
  chart($('c5'),$('r5'),$('l5'),a,b,[{k,name:k+', long minus short',v:sk,c:'#111',w:1.6}],{log:true,base:100});
 }else{$('t2').textContent='Cumulative return against the S&P 500, rebased to 100, log scale';$('n2').textContent='';chart($('c2'),$('r2'),$('l2'),a,b,two(sp,sk),{log:true});}
 chart($('c3'),$('r3'),$('l3'),a,b,two(ddOf(sp),ddOf(sk)),{pct:true});
 chart($('c4'),$('r4'),$('l4'),a,b,[{k,name:lab[k].label+', beta to S&P 500',v:rollBeta(C[k],C.SPX,a,b),c:'#111',w:1.6}],{dec:2});
}
function metrics(){
 const m=M[win],ks=Object.keys(m),groups=['Benchmark','Factor','Sorted portfolio','Sector portfolio','Style ETF','Factor ETF'];
 let h='<tr><th>Series</th>'+['CAGR','Vol','Sharpe','Sortino','t','Max DD','Calmar','VaR 95','CVaR 95','Beta','IR'].map(x=>`<th class="n">${x}</th>`).join('')+'</tr>';
 groups.forEach(g=>{const r=ks.filter(k=>lab[k].group===g);if(!r.length)return;h+=`<tr class="g"><td colspan="12">${g}</td></tr>`;
  if(g==='Factor')h+='<tr><td colspan="12" class="t">Long minus short. Read against zero, not against the benchmark row.</td></tr>';
  r.forEach(k=>{const x=m[k];h+=`<tr><td>${g==='Factor'?k+' <span class="t">'+lab[k].label+'</span>':lab[k].label+(g.includes('ETF')?' <span class="t">'+k+'</span>':'')}</td><td class="n">${P(x.cagr)}</td><td class="n">${P(x.vol)}</td><td class="n">${F(x.sharpe)}</td><td class="n">${F(x.sortino)}</td><td class="n">${F(x.tstat,1)}</td><td class="n">${P(x.maxdd)}</td><td class="n">${F(x.calmar)}</td><td class="n">${P(x.var95,2)}</td><td class="n">${P(x.cvar95,2)}</td><td class="n">${F(x.beta)}</td><td class="n">${F(x.ir)}</td></tr>`})});
 $('mt').innerHTML=h;
}
function corr(){const[a,b]=slice(),n=FK.length,mu=[],sd=[],Z=[];
 FK.forEach(k=>{const v=C[k].slice(a,b);let s=0,c=0;v.forEach(x=>{if(x===x){s+=x;c++}});const m=s/c;let q=0;v.forEach(x=>{if(x===x)q+=(x-m)*(x-m)});Z.push(v.map(x=>x===x?(x-m)/Math.sqrt(q/c):NaN))});
 let h='<tr><th></th>'+FK.map(k=>`<th>${k}</th>`).join('')+'</tr>';
 for(let i=0;i<n;i++){h+=`<tr><td>${FK[i]}</td>`;for(let j=0;j<n;j++){if(j>i){h+='<td></td>';continue}let s=0,c=0;for(let t=0;t<b-a;t++){const u=Z[i][t],v=Z[j][t];if(u===u&&v===v){s+=u*v;c++}}const r=Math.round(100*s/c);h+=`<td>${Math.abs(r)>=50&&i!==j?'<b>'+r+'</b>':r}</td>`}h+='</tr>'}
 $('ct').innerHTML=h}
function span(){const cs=['MKT','SMB','HML','RMW','CMA','MOM'];
 $('st').innerHTML='<tr><th>Factor</th><th class="n">Alpha p.a.</th>'+cs.map(c=>`<th class="n">${c}</th>`).join('')+'<th class="n">R²</th></tr>'+Object.keys(SP).map(k=>{const x=SP[k];return `<tr><td>${k} <span class="t">${lab[k].label}</span></td><td class="n">${Math.abs(x.t_alpha)>=2?'<b>'+P(x.alpha)+'</b>':P(x.alpha)} <span class="t">(${F(x.t_alpha,1)})</span></td>`+cs.map(c=>x[c]==null?'<td class="n t">–</td>':`<td class="n">${Math.abs(x['t_'+c])>=2?'<b>'+F(x[c])+'</b>':F(x[c])}</td>`).join('')+`<td class="n">${F(x.r2)}</td></tr>`}).join('')}
function regs(){
 const mo=$('msel').value,cs=meta.models[mo],R_=R[mo];
 let h='<tr><th>Portfolio</th><th class="n">Alpha p.a.</th>'+cs.map(c=>`<th class="n">${c}</th>`).join('')+'<th class="n">R²</th></tr>';
 ['Benchmark','Sorted portfolio','Sector portfolio','Style ETF','Factor ETF'].forEach(g=>{const ks=Object.keys(R_).filter(k=>lab[k].group===g);if(!ks.length)return;h+=`<tr class="g"><td colspan="${cs.length+3}">${g}</td></tr>`;
  ks.forEach(k=>{const x=R_[k];h+=`<tr><td>${lab[k].label}${g.includes('ETF')?' <span class="t">'+k+'</span>':''}</td><td class="n">${Math.abs(x.t_alpha)>=2?'<b>'+P(x.alpha)+'</b>':P(x.alpha)} <span class="t">(${F(x.t_alpha,1)})</span></td>`+cs.map(c=>`<td class="n">${Math.abs(x['t_'+c])>=2?'<b>'+F(x[c])+'</b>':F(x[c])}</td>`).join('')+`<td class="n">${F(x.r2)}</td></tr>`})});
 $('rt').innerHTML=h;$('rnote').textContent=`Daily excess returns over the T-bill, ${meta.start} to ${meta.last_date}. Alpha t-statistic in parentheses. Bold: absolute t of two or more. Adjusted R².`;
}
function years(){
 const yrs=[...new Set(Object.values(Y).flatMap(o=>Object.keys(o)))].sort(),ks=['SPX',...FK];
 $('yt').innerHTML='<tr><th>Series</th>'+yrs.map(y=>`<th class="n">${y===yrs[yrs.length-1]?y+' YTD':y}</th>`).join('')+'</tr>'+ks.map(k=>`<tr><td>${k==='SPX'?'S&amp;P 500':k}</td>`+yrs.map(y=>`<td class="n">${Y[k][y]==null?'–':P(Y[k][y])}</td>`).join('')+'</tr>').join('');
}
function french(){const f=meta.french;
 $('ft').innerHTML=f.error?'<tr><td>Ken French library unavailable on the last run.</td></tr>':'<tr><th>Factor</th><th class="n">Daily corr.</th><th class="n">Monthly corr.</th><th class="n">This model p.a.</th><th class="n">French p.a.</th></tr>'+Object.keys(f).filter(k=>f[k].corr!=null).map(k=>`<tr><td>${k}</td><td class="n">${F(f[k].corr)}</td><td class="n">${F(f[k].corr_m)}</td><td class="n">${P(f[k].ann)}</td><td class="n">${P(f[k].ann_ff)}</td></tr>`).join('')+`<tr><td class="t" colspan="5">Common sample from ${meta.start} to ${f.through}, arithmetic mean annualised.</td></tr>`;}
$('fdef').innerHTML='<tr><th>Factor</th><th>In plain words</th><th>Sorted on</th></tr>'+FK.map(k=>`<tr><td>${k} <span class="t">${meta.factor_defs[k].label}</span></td><td>${meta.factor_defs[k].plain}</td><td>${meta.factor_defs[k].signal}</td></tr>`).join('');
const sel=$('sel');['Factor','Sorted portfolio','Sector portfolio','Style ETF','Factor ETF'].forEach(g=>{const o=document.createElement('optgroup');o.label=g;Object.keys(lab).filter(k=>lab[k].group===g).forEach(k=>{const e=document.createElement('option');e.value=k;e.textContent=g==='Factor'?k+' · '+lab[k].label:lab[k].label+(g.includes('ETF')?' ('+k+')':'');o.appendChild(e)});sel.appendChild(o)});
sel.value='HML';
const ms=$('msel'),MN={CAPM:'CAPM',FF3:'Three factor',C4:'Four factor, with momentum',FF6:'Six factor',ALL:'All seventeen factors'};
Object.keys(meta.models).forEach(k=>{const e=document.createElement('option');e.value=k;e.textContent=(MN[k]||k)+': '+(meta.models[k].length>6?meta.models[k].length+' regressors':meta.models[k].join(', '));ms.appendChild(e)});ms.value='FF6';
const tog=document.querySelector('[data-win]');tog.innerHTML='Window '+['1Y','5Y','Full'].map(w=>`<button data-w="${w}">[${w}]</button>`).join('');
const mark=()=>tog.querySelectorAll('button').forEach(b=>b.className=b.dataset.w===win?'on':'');
const all=()=>{grid();draw();metrics();corr()};
tog.addEventListener('click',e=>{if(e.target.dataset.w){win=e.target.dataset.w;mark();all()}});
$('grid').addEventListener('click',e=>{const c=e.target.closest('.cell');if(c){sel.value=c.dataset.k;draw();$('perf').scrollIntoView({behavior:'smooth'})}});
sel.onchange=draw;ms.onchange=regs;mark();all();regs();span();years();french();
})().catch(e=>{document.getElementById('stamp').textContent='Could not load data: '+e.message});
