(async()=>{
const $=id=>document.getElementById(id),m=await fetch('data/meta.json').then(r=>r.json());
const M=s=>String(s).replace(/^-/,'−'),f=(v,d=2)=>v==null||v!==v?'–':M(v.toFixed(d)),sg=(v,d=0)=>v==null||v!==v?'–':(v>0?'+':'')+M(v.toFixed(d));
const V=m.vertices,P=m.policy,N=m.months.length,E=N-1,mon=s=>new Date(s+'T00:00:00Z').toLocaleString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}),end=mon(m.horizon),last=m.meetings[m.meetings.length-1];
let path='priced',vx='10y',hz='12';
$('stamp').textContent=`Treasury curve ${m.as_of}, futures ${m.futures_as_of}. Refreshed ${m.updated}.`;
const bp=(a,b)=>sg(100*(a-b));
const C=m.calls_now;
$('kp').innerHTML=[[f(P.effr)+'%','Effective federal funds rate, target '+f(P.target_lo)+' to '+f(P.target_hi)],[f(last.priced)+'%','Priced for '+end+', '+bp(last.priced,P.effr)+' bp'],[f(C.median)+'%','Median rule calls for now, middle half '+f(C.q25)+' to '+f(C.q75)],
 [f(last.rules)+'%','Median rule path for '+end+', '+bp(last.rules,P.effr)+' bp'],[f(m.spot['2y'])+' → '+f(m.priced['2y'][E]),'2-year: now, priced for '+end],[f(m.spot['10y'])+' → '+f(m.priced['10y'][E]),'10-year: now, priced for '+end]].map(v=>`<div><b>${v[0]}</b>${v[1]}</div>`).join('');
const dir=x=>Math.abs(x)<5?'roughly no change':(x>0?sg(x)+' basis points of increases':M(Math.abs(x).toFixed(0))+' basis points of cuts');
$('verdict').textContent=`Futures price ${dir(last.priced_cum)} by ${end}, to ${f(last.priced)}%. The median policy rule calls for ${f(C.median)}% already today, ${bp(C.median,P.effr)} basis points from the current rate. At the pace of past behaviour the rule path reaches ${f(last.rules)}% by ${end}. The 10-year yield goes from ${f(m.spot['10y'])}% to ${f(m.priced['10y'][E])}% on the priced path and to ${f(m.rules_curve['10y'][E])}% on the rule path.`;
// federal funds path
const H=m.history,hx=H.date.slice(0,-1),x=[...hx,m.as_of,...m.months],nh=hx.length+1,pad=(a,b)=>[...Array(a).fill(NaN),...b],nz=a=>a.map(v=>v==null?NaN:v);
Plot.line($('c1'),{x,series:[{name:'Effective rate',y:[...nz(H.policy),...Array(N).fill(NaN)],width:1.9,dash:''},{name:'Priced',y:pad(nh-1,[P.effr,...m.policy_priced]),dash:'5 3'},{name:'Median rule calls for',y:pad(nh,m.policy_calls),dash:'1 3',color:'#666',width:1.7},{name:'Median rule path',y:pad(nh-1,[P.effr,...m.policy_rules]),dash:'2 3',width:1.7}],dec:2,vline:[m.as_of]});
$('mt').innerHTML='<tr><th>Meeting</th><th class="n">Priced</th><th class="n">Step, bp</th><th class="n">Total, bp</th><th class="n">Rules call for</th><th class="n">Middle half</th><th class="n">Rule path</th><th class="n">Step, bp</th><th class="n">Total, bp</th><th class="n">Quarter-point moves</th><th class="n">Middle half</th><th class="n">Path minus priced, bp</th></tr>'+
 m.meetings.map(k=>`<tr><td class="d">${k.date}</td><td class="n"><b>${f(k.priced)}</b></td><td class="n">${sg(k.priced_step)}</td><td class="n">${sg(k.priced_cum)}</td><td class="n"><b>${f(k.calls)}</b></td><td class="n">${f(k.calls_q25)} to ${f(k.calls_q75)}</td><td class="n"><b>${f(k.rules)}</b></td><td class="n">${sg(k.rules_step)}</td><td class="n">${sg(k.rules_cum)}</td><td class="n">${k.quarter_points?sg(k.quarter_points):'0'}</td><td class="n">${f(k.rules_q25)} to ${f(k.rules_q75)}</td><td class="n">${bp(k.rules,k.priced)}</td></tr>`).join('');
$('mtn').textContent=`Percent, effective rate, starting from ${f(P.effr)}% on ${P.effr_date}. A priced step of 25 is a full quarter-point move at that meeting, 12 is about an even chance of one. Rules call for is the median rate the rules ask for. Rule path is the median path from today's rate, and quarter-point moves is its total rounded to the nearest 25 basis points. FOMC calendar published through ${m.calendar_through}.`;
// curve projections
V.forEach(v=>{const b=document.createElement('button');b.dataset.v=v;b.textContent='['+v+']';$('vt').appendChild(b)});
function draw(){const src=path==='rules'?m.rules_curve:m.priced,diff=path==='diff';
 let h='<tr><th>Month end</th><th class="n">Fed funds</th>'+V.map(v=>`<th class="n">${v}</th>`).join('')+'<th class="n">2s10s, bp</th></tr>';
 if(!diff)h+=`<tr class="g"><td class="d">Now, ${m.as_of}</td><td class="n">${f(P.effr)}</td>`+V.map(v=>`<td class="n">${f(m.spot[v])}</td>`).join('')+`<td class="n">${sg(100*(m.spot['10y']-m.spot['2y']))}</td></tr>`;
 m.months.forEach((d,i)=>{const dec=d.slice(5,7)==='12',w=s=>dec?'<b>'+s+'</b>':s;
  h+=diff?`<tr><td class="d">${mon(d)}</td><td class="n">${w(bp(m.policy_rules[i],m.policy_priced[i]))}</td>`+V.map(v=>`<td class="n">${w(bp(m.rules_curve[v][i],m.priced[v][i]))}</td>`).join('')+`<td class="n">${w(sg(100*((m.rules_curve['10y'][i]-m.rules_curve['2y'][i])-(m.priced['10y'][i]-m.priced['2y'][i]))))}</td></tr>`
   :`<tr><td class="d">${mon(d)}</td><td class="n">${w(f((path==='rules'?m.policy_rules:m.policy_priced)[i]))}</td>`+V.map(v=>`<td class="n">${w(f(src[v][i]))}</td>`).join('')+`<td class="n">${w(sg(100*(src['10y'][i]-src['2y'][i])))}</td></tr>`});
 if(!diff)h+=`<tr class="total"><td>Change to ${end}, bp</td><td class="n">${bp((path==='rules'?m.policy_rules:m.policy_priced)[E],P.effr)}</td>`+V.map(v=>`<td class="n">${bp(src[v][E],m.spot[v])}</td>`).join('')+`<td class="n">${sg(100*((src['10y'][E]-src['2y'][E])-(m.spot['10y']-m.spot['2y'])))}</td></tr>`;
 $('ct').innerHTML=h;
 $('ctn').textContent=(diff?'Basis points, rules minus priced. ':'Percent, par yields. ')+(path==='priced'?'Each number is the forward yield in today\'s Treasury curve for that date.':'On the rule path each vertex moves with the gap between the rule path and the priced path that month.');
 document.querySelectorAll('#pt button').forEach(e=>e.className=e.dataset.p===path?'on':'');document.querySelectorAll('#vt button').forEach(e=>e.className=e.dataset.v===vx?'on':'');
 const hi=m.priced[vx].map((p,i)=>p+m.band[vx][i]),lo=m.priced[vx].map((p,i)=>p-m.band[vx][i]),s0=m.spot[vx];
 $('t2').textContent=`${vx} Treasury yield: history, the priced path, the path if policy follows the rule path, and the priced path plus and minus the typical miss of forwards, percent`;
 Plot.line($('c2'),{x,series:[{name:vx+' yield',y:[...nz(H[vx]),...Array(N).fill(NaN)],width:1.9,dash:''},{name:'Priced',y:pad(nh-1,[s0,...m.priced[vx]]),dash:'5 3'},{name:'On the rule path',y:pad(nh-1,[s0,...m.rules_curve[vx]]),dash:'2 3',width:1.7},{name:'Priced plus typical miss',y:pad(nh-1,[s0,...hi]),dash:'1 3',color:'#888'},{name:'Priced minus typical miss',y:pad(nh-1,[s0,...lo]),dash:'1 3',color:'#888'}],dec:2,vline:[m.as_of]})}
Plot.line($('c3'),{x:V,series:[{name:'Now',y:V.map(v=>m.spot[v]),width:1.9,dash:''},{name:'Priced, '+end,y:V.map(v=>m.priced[v][E]),dash:'5 3'},{name:'On the rule path, '+end,y:V.map(v=>m.rules_curve[v][E]),dash:'2 3',width:1.7}],dec:2});
$('pt').addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){path=e.target.dataset.p;draw()}});$('vt').addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){vx=e.target.dataset.v;draw()}});
// rules
const CE=m.calls_end;$('rp').textContent=`The median rule calls for ${f(C.median)}% now, against ${f(P.effr)}% today. The middle half of the rules runs from ${f(C.q25)}% to ${f(C.q75)}% and the full set from ${f(C.low)}% to ${f(C.high)}%. By the last quarter of the horizon the median call is ${f(CE.median)}%. The rate closes only part of the distance each quarter, so the rule path gets there slowly.`;
const R=m.rule_history,qd=R.date.map(q=>q.slice(0,4)+'-'+String(q.slice(5)*3).padStart(2,'0')+'-28');
Plot.line($('c4'),{x:qd,xfmt:d=>d.slice(0,4)+'Q'+(+d.slice(5,7)/3),series:[{name:'Policy rate',y:nz(R.actual),width:1.9,dash:''},{name:'Median rule calls for',y:nz(R.median),dash:'5 3',color:'#555'}],dec:1,zero:true});
// track record
$('ts').textContent=m.track_since;
function tr(){$('tt').innerHTML='<tr><th>Vertex</th><th class="n">Average error</th><th class="n">Typical miss of forwards</th><th class="n">Typical miss of no change</th><th class="n">Months</th></tr>'+V.map(v=>{const t=m.track[v][hz];return `<tr><td>${v}</td><td class="n">${sg(t.bias,2)}</td><td class="n"><b>${f(t.mae)}</b></td><td class="n">${f(t.mae_nochange)}</td><td class="n">${t.n}</td></tr>`}).join('');
 document.querySelectorAll('#ht button').forEach(e=>e.className=e.dataset.h===hz?'on':'')}
$('ht').addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){hz=e.target.dataset.h;tr()}});
draw();tr();
})().catch(e=>{document.getElementById('stamp').textContent='Could not load data: '+e.message});
