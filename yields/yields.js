(async()=>{
const $=id=>document.getElementById(id),meta=await fetch('data/meta.json').then(r=>r.json()),cache={};
let mat='10y',win=252;
const NAME={einfl:'Expected inflation',irp:'Inflation risk premium',ereal:'Expected real rate',rtp:'Real term premium',resid:'Residual',liq:'Liquidity premium'};
async function load(m){if(cache[m])return cache[m];const L=(await fetch(`data/decomp_${m}.csv`).then(r=>r.text())).trim().split('\n'),c=L[0].split(','),d={date:[]};c.slice(1).forEach(k=>d[k]=[]);
 for(let i=1;i<L.length;i++){const p=L[i].split(',');d.date.push(p[0]);for(let j=1;j<p.length;j++)d[c[j]].push(p[j]===''?NaN:+p[j])}return cache[m]=d}
const f2=v=>v===v?v.toFixed(2):'–',bp=v=>v===v?(v>=0?'+':'')+(v*100).toFixed(0):'–';
async function draw(){
 const d=await load(mat),N=d.date.length,a=win?Math.max(0,N-win):0,sl=k=>d[k].slice(a),x=d.date.slice(a),mm=meta.mats[mat];
 $('stamp').textContent=`Market data through ${mm.last}.`+(mm.provisional_days?` The last ${mm.provisional_days} trading days are provisional.`:'');
 // snapshot
 const rows=[['y_mkt','Market yield'],['einfl',NAME.einfl],['irp',NAME.irp],['ereal',NAME.ereal],['rtp',NAME.rtp],['resid',NAME.resid]],lags=[['1d',1],['1w',5],['1m',21],['3m',63],['1y',252]];
 const ytd=d.date.findIndex(s=>s.slice(0,4)===d.date[N-1].slice(0,4))-1;
 let h='<tr><th>Percent</th><th class="n">Level</th>'+lags.map(l=>`<th class="n">${l[0]}</th>`).join('')+'<th class="n">YTD</th></tr>';
 rows.forEach(([k,n],i)=>{const v=d[k],L=v[N-1];h+=`<tr${i==0?' class="total"':''}><td>${i==0?'<b>'+n+'</b>':n}</td><td class="n">${f2(L)}</td>`+lags.map(l=>`<td class="n">${bp(L-v[N-1-l[1]])}</td>`).join('')+`<td class="n">${ytd>=0?bp(L-v[ytd]):'–'}</td></tr>`});
 h+=`<tr class="g"><td colspan="8">Memo</td></tr>`;
 [['tp','Nominal term premium'],['tp_a','Term premium, alternative A'],['tp_b','Term premium, alternative B'],['bei','Breakeven, market'],['tips','Real yield, market'],['liq','Liquidity premium']].forEach(([k,n])=>{const v=d[k],L=v[N-1];h+=`<tr><td>${n}</td><td class="n">${f2(L)}</td>`+lags.map(l=>`<td class="n">${bp(L-v[N-1-l[1]])}</td>`).join('')+`<td class="n">${ytd>=0?bp(L-v[ytd]):'–'}</td></tr>`});
 $('snap').innerHTML=h;$('snote').textContent=`${mat==='5y5y'?'Five-year rate, five years forward':mat.replace('y','-year')+' Treasury'}, ${mm.last}. Changes in basis points.`;
 const nc=d.date[d.provisional.indexOf(1)],vl=nc&&x.includes(nc)?[nc]:[];
 Plot.stack($('c1'),{x,series:['einfl','ereal','irp','rtp'].map(k=>({name:NAME[k],y:sl(k)})),total:{name:'Market yield',y:sl('y_mkt')},dec:2,vline:vl,h:300});
 const ks=['einfl','irp','ereal','rtp','resid'],ch=ks.map(k=>(d[k][N-1]-d[k][a])*100),tot=(d.y_mkt[N-1]-d.y_mkt[a])*100;
 $('t2').textContent=`From ${d.date[a]} to ${d.date[N-1]} the yield moved ${tot>=0?'+':''}${tot.toFixed(0)} basis points`;
 Plot.bar($('c2'),{x:ks.map(k=>NAME[k]),series:[{name:'Change, bp',y:ch}],dec:0,h:220});
 Plot.stack($('c3'),{x,series:[{name:NAME.einfl,y:sl('einfl')},{name:NAME.irp,y:sl('irp')},{name:'Liquidity premium (subtracts)',y:sl('liq').map(v=>-v)}],total:{name:'Market breakeven',y:sl('bei')},dec:2,vline:vl});
 Plot.stack($('c4'),{x,series:[{name:NAME.ereal,y:sl('ereal')},{name:NAME.rtp,y:sl('rtp')},{name:NAME.liq,y:sl('liq')}],total:{name:'Market real yield',y:sl('tips')},dec:2,vline:vl});
 Plot.line($('c5'),{x,series:[{name:'This page',y:sl('tp'),width:1.8,dash:''},{name:'Alternative A',y:sl('tp_a'),dash:'5 3',color:'#555'},{name:'Alternative B',y:sl('tp_b'),dash:'2 3',color:'#555'}],dec:2,zero:true,vline:vl});
 document.querySelectorAll('#mt button').forEach(b=>b.className=b.dataset.m===mat?'on':'');document.querySelectorAll('#wt button').forEach(b=>b.className=+b.dataset.w===win?'on':'');
}
$('mt').addEventListener('click',e=>{if(e.target.dataset.m){mat=e.target.dataset.m;draw()}});
$('wt').addEventListener('click',e=>{if(e.target.dataset.w!=null&&e.target.tagName==='BUTTON'){win=+e.target.dataset.w;draw()}});
draw();
})().catch(e=>{document.getElementById('stamp').textContent='Could not load data: '+e.message});
