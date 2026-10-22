const $=id=>document.getElementById(id);
const f=(v,d=2)=>v==null||v!==v?'n/a':(+v.toFixed(d)===0?(0).toFixed(d):v.toFixed(d)).replace('-','\u2212'),sg=(v,d=2)=>{const a=Math.abs(v).toFixed(d);return(+a===0?'':v>0?'+':'\u2212')+a};
let M=null;
const DEF={bp:0,dm:0,rp:0,im:0,oi:0},st={policy:'rule',shock:'monetary',mode:'agg',smp:'2010Q2 to 2026Q3'};
function qlab(q0,k){let y=+q0.slice(0,4),q=+q0.slice(5)+k;while(q>4){q-=4;y++}return y+'Q'+q}
function table(el,head,rows,cls){el.innerHTML='<tr>'+head.map((c,k)=>`<th${k?' class="n"':''}>${c}</th>`).join('')+'</tr>'+rows.map(r=>'<tr>'+r.map((c,k)=>`<td class="${k?'n':'d'}">${c}</td>`).join('')+'</tr>').join('')}
function opts(){const g=k=>parseFloat($(k).value);return{policy:st.policy,bp:g('bp'),demand:g('dm'),rp:g('rp'),imp:g('im'),oil:g('oi'),rstar:g('rs')}}
function runScenario(){
 const o=opts(),N=12,S=Engine.scenario(M,o,N),B=Engine.scenario(M,{...o,bp:0,demand:0,rp:0,imp:0,oil:0},N),q0=M.start.q;
 $('v_bp').textContent=sg(o.bp,0)+' bp';$('v_dm').textContent=sg(o.demand,2)+' pt';$('v_rp').textContent=sg(o.rp,2)+' pt';$('v_im').textContent=sg(o.imp,0)+'%';$('v_oi').textContent=sg(o.oil,0)+'%';$('v_rs').textContent=f(o.rstar)+'%';
 const hq=M.hist.q,i0=hq.indexOf('2022Q1'),nh=hq.length-i0,x=Array.from({length:nh+N},(_,k)=>k),xf=v=>qlab('2022Q1',Math.round(v)),vl=[nh-1];
 const pad=a=>[...a.slice(i0).map(v=>v),...new Array(N).fill(null)],fut=a=>[...new Array(nh-1).fill(null),a[0],...a.slice(1)];
 const hist=(k)=>M.hist[k].slice(i0);
 const cmp=any=>any?[{name:'No shocks',y:fut(B.core4),dash:'5 3'}]:[];
 const any=o.bp||o.demand||o.rp||o.imp||o.oil||o.rstar!==M.start.rstar;
 Plot.line($('c1'),{x,xnum:true,xfmt:xf,dec:1,h:260,vline:vl,series:[{name:'Observed',y:[...hist('core4'),...new Array(N).fill(null)],dash:'',width:1.8},{name:'Scenario',y:fut(S.core4),dash:'',width:1.8,color:'#555'},...(any?[{name:'No shocks',y:fut(B.core4),dash:'5 3'}]:[]),{name:'Expected inflation',y:[...hist('exp'),...S.e.slice(1)],dash:'2 3'}]});
 const nn=M.hist.rstar[M.hist.rstar.length-1];
 Plot.line($('c2'),{x,xnum:true,xfmt:xf,dec:1,h:220,vline:vl,series:[{name:'Observed',y:[...hist('ff'),...new Array(N).fill(null)],dash:'',width:1.8},{name:'Scenario',y:fut(S.i),dash:'',width:1.8,color:'#555'},...(any||st.policy!=='rule'?[{name:'Model rule, no shocks',y:fut(B.i),dash:'5 3'}]:[]),{name:'Futures strip',y:fut([M.start.i,...M.market.ff,...new Array(N-M.market.ff.length).fill(M.market.ff[M.market.ff.length-1])]),dash:'2 3'},{name:'Neutral nominal',y:x.map(()=>o.rstar+2),color:'#999',width:1,dash:''}]});
 Plot.line($('c3'),{x,xnum:true,xfmt:xf,dec:1,h:200,zero:true,vline:vl,legend:true,series:[{name:'Output gap',y:[...hist('h'),...new Array(N).fill(null)],dash:'',width:1.8},{name:'Scenario',y:fut(S.h),dash:'',width:1.8,color:'#555'},...(any?[{name:'No shocks',y:fut(B.h),dash:'5 3'}]:[])]});
 Plot.line($('c4'),{x,xnum:true,xfmt:xf,dec:1,h:200,vline:vl,legend:true,series:[{name:'Expected inflation',y:[...hist('exp'),...new Array(N).fill(null)],dash:'',width:1.8},{name:'Scenario',y:fut(S.e),dash:'',width:1.8,color:'#555'},...(any?[{name:'No shocks',y:fut(B.e),dash:'5 3'}]:[])]});
 const at=(a,lab)=>a[1+['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4','2028Q1','2028Q2','2028Q3','2028Q4','2029Q1','2029Q2','2029Q3'].indexOf(lab)];
 // quarters are relative to the last observed one; map labels
 const idx=lab=>{for(let k=1;k<=N;k++)if(qlab(q0,k)===lab)return k;return null};
 const A=(a,lab)=>{const k=idx(lab);return k==null?null:a[k]};
 $('k1').textContent=f(A(S.core4,'2027Q4'))+'%';$('k2').textContent=f(A(S.core4,'2028Q4'))+'%';
 $('k3').textContent=f(Math.max(...S.i))+'%';$('k4').textContent=f(A(S.i,'2028Q4'))+'%';$('k5').textContent=sg(A(S.h,'2027Q4'));$('k6').textContent=f(Math.max(...S.e))+'%';
 const ks=[0,1,2,3,4,6,8,10,12];
 table($('tb1'),['Quarter','Core PCE','Expected','Output gap','Policy rate','Real rate','Real gap'],ks.map(k=>[qlab(q0,k)+(k?'':' (obs.)'),f(S.core4[k]),f(S.e[k]),sg(S.h[k]),f(S.i[k]),f(S.rr[k]),sg(S.rgap[k])]));
 if(any)table($('tb2'),['Quarter','Core PCE','Expected','Output gap','Policy rate','Real rate'],ks.filter(k=>k>0).map(k=>[qlab(q0,k),sg(S.core4[k]-B.core4[k]),sg(S.e[k]-B.e[k]),sg(S.h[k]-B.h[k]),sg(S.i[k]-B.i[k]),sg(S.rr[k]-B.rr[k])]));
 else $('tb2').innerHTML='<tr><td class="t">No shock is set. Move a slider to fill this table.</td></tr>';
 const w=[];if(Math.min(...S.i)<0)w.push('The rule calls for a negative rate in this run. The model has no lower bound, so read it as a shadow rate.');
 if(st.policy==='market')w.push('Policy follows the futures strip, so the model’s own rule does not respond to the shocks; only the gap, expectations and inflation do.');
 if(st.policy==='hold')w.push('Policy held flat, so the rule does not respond to the shocks.');
 $('warn').textContent=w.join(' ');
}
function runIrf(){
 const t=st.shock,size=parseFloat($('sz').value),hold=parseFloat($('hd').value),fixExp=$('fe').checked,fixImp=$('fi').checked;
 const lab={monetary:['Policy rate shock','pp, held then the rule'],gap:['Output gap shock','pp, one quarter'],import:['Import price shock','% level']}[t];
 $('sz_s').textContent=lab[1];$('hl').style.display=t==='monetary'?'':'none';
 $('sz').min=t==='import'?2:0.25;$('sz').max=t==='import'?20:2;$('sz').step=t==='import'?2:0.25;if(t==='import'&&size<2)$('sz').value=10;if(t!=='import'&&size>2)$('sz').value=1;
 const sz=parseFloat($('sz').value);$('v_sz').textContent=t==='import'?sz+'%':sg(sz,2);$('v_hd').textContent=hold+'q';
 const type=t==='monetary'&&(fixExp||fixImp)?'monetary_decay':t;
 const R=Engine.irf(M,type,st.mode,{size:sz,hold,fixExp,fixImp}),x=Array.from({length:17},(_,k)=>k),xf=v=>'Q'+Math.round(v);
 $('e4').textContent='Inflation over four quarters, points, '+lab[0].toLowerCase()+(type==='monetary_decay'?' (rate decays 20% a quarter after the hold, as in the channel decomposition)':'');
 Plot.line($('i1'),{x,xnum:true,xfmt:xf,dec:2,h:240,zero:true,legend:true,series:[{name:'Inflation, four quarters',y:R.pi,dash:'',width:1.8}]});
 Plot.line($('i2'),{x,xnum:true,xfmt:xf,dec:2,h:200,zero:true,legend:true,series:[{name:'Policy rate',y:R.i,dash:'',width:1.8},{name:'Output gap',y:R.h,dash:'5 3'}]});
 Plot.line($('i3'),{x,xnum:true,xfmt:xf,dec:2,h:200,zero:true,legend:true,series:[{name:'Expected inflation',y:R.exp,dash:'',width:1.8},{name:'Import price inflation, q/q',y:R.imp,dash:'2 3'}]});
 const D=Engine.irf(M,type,'dis',{size:sz,hold,fixExp,fixImp});
 Plot.line($('i4'),{x,xnum:true,xfmt:xf,dec:2,h:220,zero:true,legend:true,series:[{name:'Total',y:D.pi,dash:'',width:1.8},{name:'Services',y:D.pS,dash:'5 3'},{name:'Goods',y:D.pB,dash:'2 3'},{name:'Food',y:D.pA,dash:'8 3 2 3'}]});
 $('ma').className=st.mode==='agg'?'on':'';$('md').className=st.mode==='dis'?'on':'';
 ['sm','sg','si'].forEach(k=>$(k).className=({sm:'monetary',sg:'gap',si:'import'})[k]===t?'on':'');
}
function runStatic(){
 const e=r=>`<tr><td class="d w">${r.name}<br><span class="s">${r.key}</span></td><td class="n">${f(r.mode,3)}</td><td class="n">${f(r.lo,3)} to ${f(r.hi,3)}</td><td class="n">${r.bcb==null?'n/a':f(r.bcb,3)}</td><td class="n edge">${r.edge||''}</td></tr>`;
 const blocks=rows=>{let cur='',h='<tr><th>Parameter</th><th class="n">Mode</th><th class="n">90% interval</th><th class="n">Brazil</th><th class="n"></th></tr>';rows.forEach(r=>{if(r.block!==cur){cur=r.block;h+=`<tr class="g"><td colspan="5">${cur}</td></tr>`}h+=e(r)});return h};
 $('t1').innerHTML=blocks(M.table1);$('t2').innerHTML=blocks(M.table2);
 const all=[...new Map([...M.table1,...M.table2].map(r=>[r.key,r])).values()],ed=all.filter(r=>r.edge&&r.edge!=='fixed'),n=all.filter(r=>!r.key.startsWith('gamma')&&r.key!=='sigma_h'&&!r.key.startsWith('1-')&&r.edge!=='fixed').length;
 $('edgen').textContent=ed.length+' of '+n+' coefficients sit on the edge of their support: '+[...new Set(ed.map(r=>r.key+' ('+r.edge+')'))].join(', ')+'. The MA(1) food coefficient is set by hand, not estimated. The Brazil column is the central bank’s published estimate; the two economies differ in structure, so it is a reference, not a target.';
 table($('pk'),['Shock','Aggregate','Disaggregated','Services','Goods','Food','Brazil agg.','Brazil disagg.'],M.peaks.map(p=>[p.shock,sg(p.agg,3),sg(p.dis,3),sg(p.services,3),sg(p.goods,3),sg(p.food,3),sg(p.bcb_agg,2),sg(p.bcb_dis,2)]));
 $('pk').querySelectorAll('td:first-child').forEach(c=>{c.className='d w'});
 const samples=[...new Set(M.backtest.map(b=>b.sample))];
 $('smp').innerHTML=samples.map(s=>`<button data-s="${s}" class="${s===st.smp?'on':''}">${s}</button>`).join(' ');
 $('smp').querySelectorAll('button').forEach(b=>b.onclick=()=>{st.smp=b.dataset.s;runStatic()});
 const models=[...new Set(M.backtest.map(b=>b.model))];
 let h='<tr><th>Model</th><th class="n">Horizon</th><th class="n">RMSE</th><th class="n">MAE</th><th class="n">vs random walk</th><th class="n">vs AR(4)</th><th class="n">Direction hit, %</th></tr>';
 models.forEach(m=>{h+=`<tr class="g"><td colspan="7">${m}</td></tr>`;M.backtest.filter(b=>b.sample===st.smp&&b.model===m).forEach(b=>{h+=`<tr><td class="d">${m}</td><td class="n">${b.h}q (${b.h*3}m)</td><td class="n">${f(b.rmse,3)}</td><td class="n">${f(b.mae,3)}</td><td class="n">${f(b.relrw)}</td><td class="n">${f(b.relar4)}</td><td class="n">${f(b.hit,1)}</td></tr>`})});
 $('bt').innerHTML=h;
 const W=M.wf4;Plot.line($('w4'),{x:W.q.map((_,k)=>k),xnum:true,xfmt:v=>W.q[Math.round(v)]||'',dec:1,h:260,series:[{name:'Outcome',y:W.actual,dash:'',width:1.8},{name:'Aggregate model',y:W.agg,dash:'5 3'},{name:'Disaggregated model',y:W.dis,dash:'2 3'},{name:'AR(4)',y:W.ar4,dash:'8 3 2 3'}]});
 const H=M.hist,i0=H.q.indexOf('2010Q1'),hx=H.q.slice(i0).map((_,k)=>k),hf=v=>H.q[i0+Math.round(v)]||'';
 Plot.line($('g1'),{x:hx,xnum:true,xfmt:hf,dec:1,h:200,zero:true,series:[{name:'Output gap',y:H.h.slice(i0),dash:'',width:1.8}]});
 Plot.line($('g2'),{x:hx,xnum:true,xfmt:hf,dec:1,h:200,legend:true,series:[{name:'Fed funds, upper bound',y:H.ff.slice(i0),dash:'',width:1.8},{name:'Shadow rate',y:H.shadow.slice(i0),dash:'5 3'},{name:'Neutral real rate',y:H.rstar.slice(i0),dash:'2 3'}]});
 table($('sk'),['Slack measure','Corr. with GDP gap','Services slope','t','Core PCE slope','t'],M.slack.map(s=>[s.measure,f(s.corr,2),sg(s.beta_s,4),sg(s.t_s),sg(s.beta_c,4),sg(s.t_c)]));
 $('sk').querySelectorAll('td:first-child').forEach(c=>{c.className='d w'});
}
function setPolicy(p){st.policy=p;$('pr').className=p==='rule'?'on':'';$('pm').className=p==='market'?'on':'';$('ph').className=p==='hold'?'on':'';runScenario()}
fetch('data/model.json').then(r=>r.json()).then(m=>{
 M=m;const S=M.start,last=qlab(S.q,0);
 $('q0').textContent=S.q;$('q1').textContent=S.q;
 $('intro').textContent='Starting point, '+S.q+': core PCE '+f(S.core4)+'% over four quarters, headline '+f(S.head4)+'%, expected inflation '+f(S.exp4)+'%, output gap '+sg(S.h)+', fed funds upper bound '+f(S.i)+'%, neutral real rate '+f(S.rstar)+'%. Data through '+M.data_through+'; model and futures strip as of '+M.updated+'.';
 Object.entries({bp:0,dm:0,rp:0,im:0,oi:0}).forEach(([k,v])=>$(k).value=v);$('rs').value=S.rstar;
 ['bp','dm','rp','im','oi','rs'].forEach(k=>$(k).addEventListener('input',runScenario));
 $('pr').onclick=()=>setPolicy('rule');$('pm').onclick=()=>setPolicy('market');$('ph').onclick=()=>setPolicy('hold');
 $('reset').onclick=()=>{Object.entries(DEF).forEach(([k,v])=>$(k).value=v);$('rs').value=S.rstar;setPolicy('rule')};
 $('sm').onclick=()=>{st.shock='monetary';$('sz').value=1;runIrf()};$('sg').onclick=()=>{st.shock='gap';$('sz').value=1;runIrf()};$('si').onclick=()=>{st.shock='import';$('sz').value=10;runIrf()};
 $('ma').onclick=()=>{st.mode='agg';runIrf()};$('md').onclick=()=>{st.mode='dis';runIrf()};
 ['sz','hd','fe','fi'].forEach(k=>$(k).addEventListener('input',runIrf));
 $('sz').value=1;$('hd').value=4;
 runScenario();runIrf();runStatic();
}).catch(e=>{$('intro').textContent='Could not load the model data.'});
