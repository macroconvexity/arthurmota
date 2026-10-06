(async()=>{
const $=id=>document.getElementById(id),meta=await fetch('data/meta.json').then(r=>r.json()),P=Object.keys(meta.pairs),cache={};
let pair='EURUSD',win=504;
const pc=(v,d=1)=>v==null?'–':(v>=0?'+':'')+v.toFixed(d),dp=p=>p==='USDJPY'?2:p==='DXY'?2:4;
async function load(p){if(cache[p])return cache[p];const L=(await fetch(`data/${p}.csv`).then(r=>r.text())).trim().split('\n'),c=L[0].split(','),d={date:[]};c.slice(1).forEach(k=>d[k]=[]);
 for(let i=1;i<L.length;i++){const q=L[i].split(',');d.date.push(q[0]);for(let j=1;j<q.length;j++)d[c[j]].push(q[j]===''?NaN:+q[j])}return cache[p]=d}
$('stamp').textContent=`Spot through ${meta.last_date}. US yields through ${meta.rates_through.US2}. Refreshed ${meta.updated}.`;
$('bt').innerHTML='<tr><th>Pair</th><th class="n">Spot</th><th class="n">1d</th><th class="n">1w</th><th class="n">1m</th><th class="n">3m</th><th class="n">YTD</th><th class="n">Rate gap</th><th class="n">Fair value</th><th class="n">Gap</th><th class="n">z</th><th class="n">Vol 3m</th><th class="n">Carry/vol</th><th class="n">REER</th></tr>'+
 P.map(p=>{const m=meta.pairs[p],c=m.chg;return `<tr><td><b>${p}</b> <span class="t">${m.label}</span></td><td class="n">${m.spot.toFixed(dp(p))}</td>`+['1d','1w','1m','3m','ytd'].map(k=>`<td class="n">${pc(c[k])}</td>`).join('')+`<td class="n">${pc(m.diff,2)}</td><td class="n">${m.fair.toFixed(dp(p))}</td><td class="n">${pc(m.gap_pct)}%</td><td class="n">${Math.abs(m.z)>=2?'<b>'+pc(m.z,1)+'</b>':pc(m.z,1)}</td><td class="n">${m.vol_3m.toFixed(1)}%</td><td class="n">${pc(m.carry_to_vol,2)}</td><td class="n">${pc(m.reer_dev)}%</td></tr>`}).join('');
$('bt2').innerHTML='<tr><th>Sensitivity, today</th><th class="n">Rate gap, per point</th><th class="n">VIX, per 10% rise</th><th class="n">Brent, per 10% rise</th><th class="n">R²</th></tr>'+P.map(p=>{const b=meta.pairs[p].beta;return `<tr><td>${p}</td><td class="n">${pc(b.diff*100)}%</td><td class="n">${pc(b.lvix*Math.log(1.1)*100,2)}%</td><td class="n">${pc(b.lbrent*Math.log(1.1)*100,2)}%</td><td class="n">${meta.pairs[p].r2.toFixed(2)}</td></tr>`}).join('');
$('pt').innerHTML='Pair '+P.map(p=>`<button data-p="${p}">[${p}]</button>`).join('');
async function draw(){
 const d=await load(pair),m=meta.pairs[pair],N=d.date.length,a=win?Math.max(0,N-win):0,x=d.date.slice(a),sl=k=>d[k].slice(a),D=dp(pair);
 $('kp').innerHTML=[[m.spot.toFixed(D),'Spot'],[m.fair.toFixed(D),'Fair value'],[pc(m.gap_pct)+'%','Gap'],[pc(m.z,1),'z-score'],[pc(m.diff,2),'Rate gap, points'],[m.vol_3m.toFixed(1)+'%','Volatility, 3m']].map(v=>`<div><b>${v[0]}</b>${v[1]}</div>`).join('');
 Plot.line($('c1'),{x,series:[{name:'Spot',y:sl('spot'),width:1.7,dash:''},{name:'Fair value',y:sl('fair'),dash:'5 3',color:'#555'}],dec:D});
 Plot.line($('c2'),{x,series:[{name:'z-score',y:sl('z')}],dec:1,zero:true,legend:false});
 $('t3').textContent='Rate differential, percentage points: '+m.diff_label;
 Plot.line($('c3'),{x,series:[{name:'Rate gap',y:sl('diff')}],dec:2,zero:true});
 const b=m.beta,dl=k=>d[k][N-1]-d[k][a],tot=Math.log(d.spot[N-1]/d.spot[a])*100,parts=[b.diff*dl('diff')*100,b.lvix*dl('lvix')*100,b.lbrent*dl('lbrent')*100];
 $('t4').textContent=`${pair} from ${d.date[a]} to ${d.date[N-1]}: ${pc(tot)}%`;
 Plot.bar($('c4'),{x:['Rate gap','Risk (VIX)','Oil (Brent)','Unexplained'],series:[{name:'Contribution, %',y:[...parts,tot-parts.reduce((s,v)=>s+v,0)]}],dec:1,h:220});
 $('t5').textContent=`Real effective exchange rate of the ${pair==='DXY'?'US dollar':m.label}, percent from its ten-year average. Data through ${m.reer_through}.`;
 Plot.line($('c5'),{x,series:[{name:'REER deviation',y:sl('reer_dev')}],dec:1,zero:true});
 document.querySelectorAll('#pt button').forEach(e=>e.className=e.dataset.p===pair?'on':'');document.querySelectorAll('#wt button').forEach(e=>e.className=+e.dataset.w===win?'on':'');
}
$('pt').addEventListener('click',e=>{if(e.target.dataset.p){pair=e.target.dataset.p;draw()}});
$('wt').addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){win=+e.target.dataset.w;draw()}});
draw();
})().catch(e=>{document.getElementById('stamp').textContent='Could not load data: '+e.message});
