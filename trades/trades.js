/* Display only. Every number comes from data/meta.json, data/equity.csv and data/weights.csv. */
const TradesPage=(()=>{
const A=v=>Array.isArray(v)?v:[],M=s=>String(s).replace(/^-/,'−');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=v=>typeof v==='number'&&isFinite(v);
const pc=(v,d=1)=>num(v)?M((v*100).toFixed(d))+'%':'–';          // fraction to percent
const pp=(v,d=1)=>num(v)?M(v.toFixed(d))+'%':'–';                 // already percent
const sp=(v,d=1)=>num(v)?(v>0?'+':'')+M(v.toFixed(d))+'%':'–';
const f2=(v,d=2)=>num(v)?M(v.toFixed(d)):'–';
const SLOT={open:'Open',midday:'11:00',afternoon:'13:00',manual:'Manual'};
function parseCsv(txt){const L=String(txt||'').trim().split('\n').filter(Boolean);if(L.length<2)return{cols:[],rows:[]};const cols=L[0].split(',').map(s=>s.trim());return{cols,rows:L.slice(1).map(l=>l.split(',').map(s=>s.trim()))}}
function equity(txt){const c=parseCsv(txt),ix=k=>c.cols.indexOf(k),o={date:[],sys:[],spy:[],live:[]};
 c.rows.forEach(p=>{const s=parseFloat(p[ix('sys')]),b=parseFloat(p[ix('spy')]);if(!p[ix('date')]||!isFinite(s)||!isFinite(b))return;o.date.push(p[ix('date')]);o.sys.push(s);o.spy.push(b);o.live.push(p[ix('live')]==='1'?1:0)});return o}
function weights(txt){const c=parseCsv(txt),ix=k=>c.cols.indexOf(k);return c.rows.map(p=>({date:p[ix('date')],t:p[ix('t')],w:parseFloat(p[ix('w')])})).filter(r=>r.date&&r.t&&isFinite(r.w))}
function ordersTable(list,withName){const o=A(list);if(!o.length)return '';
 return '<div class="scroll"><table><tr><th>Side</th><th>Fund</th>'+(withName?'<th>Name</th>':'')+'<th class="n">From</th><th class="n">To</th></tr>'+
 o.map(x=>`<tr><td>${esc(String(x.side||'').toUpperCase())}</td><td><b>${esc(x.t)}</b></td>${withName?`<td>${esc(x.name)}</td>`:''}<td class="n">${pc(x.w_from)}</td><td class="n">${pc(x.w_to)}</td></tr>`).join('')+'</table></div>'}
function header(m){const a=[];a.push('Slot '+(SLOT[m.slot]||esc(m.slot||'–')));if(m.as_of_ny)a.push('prices as of '+esc(m.as_of_ny)+' New York time');if(m.last_close)a.push('last close '+esc(m.last_close));if(m.updated)a.push('updated '+esc(String(m.updated).replace('T',' ').replace(/:\d\dZ$/,' UTC').replace(/Z$/,' UTC')));return a.join('. ')+'.'}
function posTable(P){P=A(P);if(!P.length)return '<tr><td>No positions. The model portfolio is in cash.</td></tr>';
 return '<tr><th>Fund</th><th>Name</th><th class="n">Lev.</th><th class="n">Weight</th><th class="n">Target</th><th class="n">Price</th><th class="n">Today</th><th>Since</th><th class="n">P&amp;L</th><th class="n">Range</th><th>Flags</th></tr>'+
 P.map(p=>{const fl=[];if(p.locked)fl.push('<span class="lk">locked today</span>');if(p.breach)fl.push('<span class="br">breach</span>');
 return `<tr><td><b>${esc(p.t)}</b></td><td>${esc(p.name)}</td><td class="n">${esc(p.lev)}x</td><td class="n">${pc(p.w)}</td><td class="n">${pc(p.w_target)}</td><td class="n">${f2(p.px)}</td><td class="n">${sp(p.chg_pct)}</td><td class="t">${esc(p.since)}</td><td class="n">${sp(p.pnl_pct)}</td><td class="n">${num(p.band_pct)?'±'+f2(p.band_pct,1)+'%':'–'}</td><td>${fl.join(' ')}</td></tr>`}).join('')}
function liveKpi(m,E){const l=(m.stats&&m.stats.live)||{},d=l.days;
 if(!d)return '<p>No live sessions yet. The record starts after '+esc(m.live_since||'the first published signal')+'.</p>';
 const lead=num(l.sys_pct)&&num(l.spy_pct)?l.sys_pct-l.spy_pct:null;
 return [[sp(l.sys_pct,2),'System'],[sp(l.spy_pct,2),'SPY'],[sp(lead,2),'Difference, points'],[String(d),'Sessions']].map(v=>`<div><b>${v[0]}</b>${v[1]}</div>`).join('')}
function chartSpec(E){const n=E.date.length;if(!n)return null;const k=E.live.indexOf(1);
 const spy={name:'SPY',y:E.spy,dash:'2 3',color:'#888'};
 if(k<0)return{x:E.date,series:[{name:'System',y:E.sys,width:1.8,dash:''},spy],vline:[]};
 const a=Math.max(0,k-1);// live line starts at the last earlier row so the two parts join
 const pre=E.sys.map((v,i)=>i<=k?v:NaN),liv=E.sys.map((v,i)=>i>=a?v:NaN);
 return{x:E.date,series:[{name:'System, earlier record',y:pre,width:1.4,dash:'',color:'#777'},{name:'System, live',y:liv,width:3,dash:'',color:'#111'},spy],vline:k>0?[E.date[k]]:[]}}
function windows(W){W=A(W);if(!W.length)return '<tr><td class="t">No windows yet.</td></tr>';
 return '<tr><th>Window</th><th>Start</th><th>End</th><th class="n">System CAGR</th><th class="n">SPY CAGR</th><th class="n">System max DD</th><th class="n">SPY max DD</th><th class="n">System Sharpe</th><th class="n">SPY Sharpe</th></tr>'+
 W.map(w=>`<tr><td>${esc(w.label)}</td><td class="t">${esc(w.start)}</td><td class="t">${esc(w.end)}</td><td class="n">${pc(w.sys_cagr)}</td><td class="n">${pc(w.spy_cagr)}</td><td class="n">${pc(w.sys_maxdd)}</td><td class="n">${pc(w.spy_maxdd)}</td><td class="n">${f2(w.sys_sharpe)}</td><td class="n">${f2(w.spy_sharpe)}</td></tr>`).join('')}
function yearly(Y){Y=A(Y);if(!Y.length)return '<tr><td class="t">No calendar years yet.</td></tr>';
 return '<tr><th>Year</th><th class="n">System</th><th class="n">SPY</th></tr>'+Y.slice().sort((a,b)=>b.year-a.year).map(y=>`<tr><td>${esc(y.year)}</td><td class="n">${pcs(y.sys)}</td><td class="n">${pcs(y.spy)}</td></tr>`).join('')}
const pcs=v=>num(v)?(v>0?'+':'')+M((v*100).toFixed(1))+'%':'–';
function history(H){H=A(H);if(!H.length)return '<tr><td class="t">No signals published yet.</td></tr>';
 return '<tr><th>Date</th><th>Slot</th><th>Orders</th></tr>'+H.map(h=>{const o=A(h.orders).map(x=>`${esc(String(x.side||'').toUpperCase())} ${esc(x.t)} ${pc(x.w_from)} to ${pc(x.w_to)}`).join('<br>');
 return `<tr><td class="d">${esc(h.date)}</td><td class="d">${SLOT[h.slot]||esc(h.slot)}</td><td>${o||'<span class="t">no orders</span>'}</td></tr>`}).join('')}
function wtable(rows,P){if(!rows.length)return '<tr><td class="t">No published weights yet.</td></tr>';
 const ds=[...new Set(rows.map(r=>r.date))].sort().slice(-5).reverse(),ts=[...new Set(rows.map(r=>r.t))].sort(),g={};rows.forEach(r=>g[r.date+'|'+r.t]=r.w);
 return '<tr><th>Date</th>'+ts.map(t=>`<th class="n">${esc(t)}</th>`).join('')+'</tr>'+ds.map(d=>`<tr><td class="d">${esc(d)}</td>`+ts.map(t=>`<td class="n">${g[d+'|'+t]==null?'–':pc(g[d+'|'+t],0)}</td>`).join('')+'</tr>').join('')}
function costs(c){c=c||{};if(!num(c.slip_1x_bp)&&!num(c.slip_lev_bp))return '<tr><td class="t">Not published.</td></tr>';
 return `<tr><th>Unleveraged funds</th><th>Leveraged funds</th></tr><tr><td>${f2(c.slip_1x_bp,0)}</td><td>${f2(c.slip_lev_bp,0)}</td></tr>`}
function render(m,E,Wt,$,Plot){m=m||{};
 $('stamp').textContent=header(m);
 if(m.live_since)$('ls').textContent=m.live_since;
 const od=A(m.orders);
 $('od').innerHTML=od.length?ordersTable(od,true):'<p>No orders today.</p>';
 const al=A(m.alerts);
 $('al').innerHTML=al.length?'<ul class="idx">'+al.map(a=>`<li${a.level==='warn'?' class="warn"':''}>${a.level==='warn'?'Warning':'Note'}${a.t?' · '+esc(a.t):''}: ${esc(a.text)}</li>`).join('')+'</ul>':'<p>No alerts.</p>';
 const P=A(m.positions);
 $('ps').innerHTML=posTable(P);
 const pv=A(m.preview),pvOn=m.slot==='midday'||m.slot==='afternoon';
 $('pvh').textContent='Preview'+(pvOn?', '+(SLOT[m.slot]):'');
 $('pv').innerHTML=pvOn||pv.length?(pv.length?'<p class="sub">What the next open would do at current prices ('+esc(m.as_of_ny||'')+' New York time). Nothing is traded before the open.</p>'+ordersTable(pv,true):'<p>The next open would not change any position at current prices.</p>'):'<p class="sub">Shown at 11:00 and 13:00.</p>';
 $('kp').innerHTML=liveKpi(m,E);
 const sp_=chartSpec(E);
 if(sp_)Plot.line($('c1'),{...sp_,log:true,dec:2,base:1,title:'System against SPY'});else $('c1').innerHTML='<p>No equity data.</p>';
 const s=m.stats||{};
 $('wt').innerHTML=windows(s.windows);$('yt').innerHTML=yearly(s.yearly);$('ct').innerHTML=costs(s.cost);
 $('hs').innerHTML=history(m.history);$('wg').innerHTML=wtable(Wt,P)}
async function run(doc,fetchFn,Plot){const $=id=>doc.getElementById(id);
 try{const get=u=>fetchFn(u).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r});
  const[m,e,w]=await Promise.all([get('data/meta.json').then(r=>r.json()),get('data/equity.csv').then(r=>r.text()),get('data/weights.csv').then(r=>r.text()).catch(()=>'')]);
  render(m,equity(e),weights(w),$,Plot)}
 catch(err){$('stamp').textContent='The data files could not be loaded. Try again later.'}}
return{run,render,equity,weights,chartSpec}})();
if(typeof document!=='undefined')TradesPage.run(document,u=>fetch(u),Plot);
if(typeof module!=='undefined')module.exports=TradesPage;
