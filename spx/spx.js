(async function(){
var $=function(id){return document.getElementById(id)},m=await fetch('data/meta.json').then(function(r){return r.json()});
var IDS=['price','eps','real','inf','erp','roe','gt','g1','n'],MINUS='−',E=m.earnings,R=m.ratios,Y=m.rates,P=m.premium,cur=null;
function num(v,d){if(v==null||v!==v||!isFinite(v))return 'n/a';return (v<0?MINUS:'')+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:d||0,maximumFractionDigits:d||0})}
function pct(v,d){return v==null||v!==v||!isFinite(v)?'n/a':num(v*100,d==null?1:d)+'%'}
function spct(v,d){return v==null||v!==v||!isFinite(v)?'n/a':(v>0?'+':'')+pct(v,d)}
// Two-stage dividend discount model, the same as spx/model.py. All rates in decimals, nominal. N=0 is the Gordon model.
function ddm(E0,roe,r,g1,gT,N){
 if(!(E0>0)||!(roe>0)||!(r>gT+1e-6))return null;
 var pT=1-gT/roe;if(!(pT>0))return null;
 var p1=1-g1/roe,e=E0,pv1=0,t;
 for(t=1;t<=N;t++){e*=1+g1;pv1+=p1*e/Math.pow(1+r,t)}
 var tv=pT*e*(1+gT)/(r-gT),pvT=tv/Math.pow(1+r,N),d1=N>0?p1*E0*(1+g1):pT*E0*(1+gT);
 return{fv:pv1+pvT,pvT:pvT,p1:p1,pT:pT,d1:d1,v12:(pv1+pvT)*(1+r)-d1}
}
function impliedR(Px,E0,roe,g1,gT,N){
 if(!(Px>0))return null;var lo=gT+1e-5,hi=1,mid,i,v;
 v=ddm(E0,roe,hi,g1,gT,N);if(!v||v.fv>Px)return null;
 v=ddm(E0,roe,lo,g1,gT,N);if(!v||v.fv<Px)return null;
 for(i=0;i<80;i++){mid=(lo+hi)/2;v=ddm(E0,roe,mid,g1,gT,N);if(v.fv>Px)lo=mid;else hi=mid}
 return (lo+hi)/2
}
function derive(o){var d={P:o.price,E0:o.eps,roe:o.roe/100,rf:(o.real+o.inf)/100,N:Math.max(0,Math.round(o.n))};d.r=d.rf+o.erp/100;d.gT=(o.gt+o.inf)/100;d.g1=(o.g1+o.inf)/100;return d}
function read(){var o={};IDS.forEach(function(k){o[k]=parseFloat($(k).value)});return o}

// ---- header and today
var stale=Object.keys(m.sources_reached).filter(function(k){return !m.sources_reached[k]});
$('stamp').textContent='Index '+m.level_date+', consensus pulled '+m.consensus_date+', Treasury yields '+m.rates_date+'. Refreshed '+m.updated+'.'+(stale.length?' Not reached on this run, last copy used: '+stale.join(', ')+'.':'');
$('kp').innerHTML=[[num(m.level,0),'S&P 500, '+m.level_date],[num(E.ntm,0)+' / '+num(E.ltm,0),'Earnings, next and last twelve months'],[num(R.pe_ntm,1)+'x / '+num(R.pe_ltm,1)+'x','Price to earnings, forward and trailing'],[pct(P.implied_erp/100,2),'Equity risk premium the index implies'],[pct(Y.real10/100,2)+' + '+pct(Y.breakeven10/100,2),'10-year real yield plus breakeven'],[pct(P.xey/100,2),'Earnings yield less real yield, percentile '+num(P.xey_pct,0)+' since '+P.since.slice(0,4)]].map(function(v){return '<div><b>'+v[0]+'</b>'+v[1]+'</div>'}).join('');
$('verdict').textContent='Analysts expect earnings to grow '+pct(E.growth_ntm/100)+' over the next twelve months and '+pct(E.growth_fy1/100)+' in the fiscal year after. With that path, Treasury yields as traded and potential growth of '+pct(Y.potential_growth/100,2)+' in the long run, the index level implies a premium of '+pct(P.implied_erp/100,2)+' over the 10-year Treasury. On reported earnings the earnings yield is '+pct(P.xey/100,2)+' above the real yield, lower than in '+num(100-P.xey_pct,0)+'% of months since '+P.since.slice(0,4)+'.';
var er=[['Next twelve months, analyst consensus',E.ntm],['Next fiscal year, analyst consensus',E.fy1],['Current fiscal year, analyst consensus',E.fy0],['Last twelve months, analyst basis',E.ltm],['Last twelve months, as reported (GAAP), bottom-up',E.gaap],['Last twelve months, as reported, Shiller data ('+E.shiller_date+')',E.shiller_ttm]];
$('et').innerHTML='<tr><th>Measure</th><th>Index points</th><th>Price to earnings</th><th>Earnings yield</th></tr>'+er.map(function(r){return '<tr><td>'+r[0]+'</td><td><b>'+num(r[1],1)+'</b></td><td>'+num(m.level/r[1],1)+'x</td><td>'+pct(r[1]/m.level,2)+'</td></tr>'}).join('');
$('etn').textContent='Built from '+m.coverage.companies+' of '+m.coverage.of+' companies, '+num(m.coverage.share_of_market_value,1)+'% of the index by market value. Cross-check: the three large index funds report a trailing multiple of '+num(R.pe_etf,1)+'x. Return on equity '+pct(R.roe/100)+', price to book '+num(R.pb,1)+'x, dividend yield '+pct(R.dividend_yield/100,2)+', CAPE '+num(R.cape,1)+' (percentile '+num(R.cape_pct,0)+' since 1990).';

// ---- scenarios
function sval(s){var p=s.params,d=derive({price:m.level,eps:p.eps,real:p.real,inf:p.inf,erp:p.erp,roe:p.roe,gt:p.gt,g1:p.g1,n:p.n}),v=ddm(d.E0,d.roe,d.r,d.g1,d.gT,d.N);return{d:d,v:v}}
function scen(){
 var b=m.inputs,h='<tr><th>Scenario</th><th>Earnings base</th><th>Real yield</th><th>Premium</th><th>Growth, stage 1</th><th>Discount rate</th><th>Fair value</th><th>Against index</th><th>In twelve months</th></tr>';
 m.scenarios.forEach(function(s){var x=sval(s),p=s.params,f=function(k,t){return p[k]!==b[k]?'<b>'+t+'</b>':t};
  h+='<tr data-k="'+s.key+'"'+(cur===s.key?' class="on"':'')+' style="cursor:pointer"><td><b>'+s.name+'</b><br><span class="s">'+s.rule+'</span></td><td>'+f('eps',num(p.eps,0))+'</td><td>'+f('real',pct(p.real/100,2))+'</td><td>'+f('erp',pct(p.erp/100,2))+'</td><td>'+f('g1',pct(x.d.g1))+'</td><td>'+pct(x.d.r,2)+'</td><td><b>'+(x.v?num(x.v.fv):'n/a')+'</b></td><td>'+(x.v?spct(x.v.fv/m.level-1,0):'n/a')+'</td><td>'+(x.v?num(x.v.v12):'n/a')+'</td></tr>'});
 $('sc').innerHTML=h}
$('scn').textContent='Index at '+num(m.level,0)+'. Bold cells are the inputs a scenario changes. Growth is nominal, the average over the five years of stage 1. In twelve months is the value grown at the discount rate less the first year\'s payout. The premium gauge behind the two premium scenarios stands at '+pct(P.xey/100,2)+'; its 25th percentile, median and 90th percentile since '+P.since.slice(0,4)+' are '+pct(P.xey_p25/100,2)+', '+pct(P.xey_median/100,2)+' and '+pct(P.xey_p90/100,2)+'.';
var G=m.grid;$('gr').innerHTML='<tr><th>Earnings</th><th>Index points</th>'+G.pe.map(function(x,i){return '<th>'+G.pe_pct[i]+'th pct, '+num(x,1)+'x</th>'}).join('')+'</tr>'+G.rows.map(function(r){return '<tr><td>'+r.name+'</td><td>'+num(r.eps,1)+'</td>'+G.pe.map(function(x){var v=r.eps*x;return '<td>'+num(v)+' <span class="s">('+spct(v/m.level-1,0)+')</span></td>'}).join('')+'</tr>'}).join('');
$('grn').textContent='The multiples come from reported earnings, so the last row is the like-for-like one; the rows on analyst earnings show what the same multiples would give on that basis. In brackets, the distance from the index at '+num(m.level,0)+'.';

// ---- the interactive model
function render(){
 var o=read(),d=derive(o);
 $('v-erp').textContent=o.erp.toFixed(2)+'%';$('v-roe').textContent=o.roe.toFixed(1)+'%';$('v-gt').textContent=o.gt.toFixed(2)+'%';$('v-g1').textContent=o.g1.toFixed(2)+'%';$('v-n').textContent=d.N;
 var two=ddm(d.E0,d.roe,d.r,d.g1,d.gT,d.N),ir=impliedR(d.P,d.E0,d.roe,d.g1,d.gT,d.N),w=[];
 if([o.price,o.eps,o.real,o.inf].some(function(v){return v!==v}))w.push('An input is empty or not a number.');
 else{
  if(!(d.r>d.gT+1e-6))w.push('Long-run nominal growth ('+pct(d.gT)+') is at or above the discount rate ('+pct(d.r)+'). The model has no finite value.');
  if(d.gT>=d.roe)w.push('Long-run nominal growth is at or above ROE, so the payout ratio is zero or negative.');
  if(d.N>0&&d.g1>d.roe)w.push('Stage 1 nominal growth ('+pct(d.g1)+') is above ROE ('+pct(d.roe)+'): reinvestment exceeds earnings and the shortfall is charged as a negative cash flow.');
  if(d.gT>d.rf+1e-9)w.push('Long-run nominal growth ('+pct(d.gT)+') is above the nominal risk-free rate ('+pct(d.rf)+'). That assumes earnings outgrow the economy for ever.');
  if(d.roe<d.r)w.push('ROE is below the discount rate. In this region faster growth lowers fair value.');
  if(!(o.eps>0))w.push('Earnings must be positive.');
 }
 $('warn').innerHTML=w.map(function(s){return '<b>Check.</b> '+s}).join('<br>');
 $('k-fv').textContent=two?num(two.fv):'n/a';$('k-gap').textContent=two&&d.P>0?spct(two.fv/d.P-1):'n/a';$('k-v12').textContent=two?num(two.v12):'n/a';
 $('k-ierp').textContent=ir==null?'n/a':pct(ir-d.rf,2);$('k-r').textContent=pct(d.r,2);$('k-fpe').textContent=two?num(two.fv/d.E0,1)+'x':'n/a';
 $('k-g').textContent=(d.N>0?pct(d.g1):'n/a')+' / '+pct(d.gT);$('k-pay').textContent=two?(d.N>0?pct(two.p1,0):'n/a')+' / '+pct(two.pT,0):'n/a';$('k-tv').textContent=two&&two.fv>0?pct(two.pvT/two.fv,0):'n/a';
 var dr=[-1.5,-1,-0.5,0,0.5,1,1.5],dg=[-1,-0.5,0,0.5,1],h='<tr><th>r \\ g long run</th>';
 dg.forEach(function(x){h+='<th>'+pct(d.gT+x/100)+'</th>'});h+='</tr>';
 dr.forEach(function(y){h+='<tr><td>'+pct(d.r+y/100)+'</td>';dg.forEach(function(x){var v=ddm(d.E0,d.roe,d.r+y/100,d.g1,d.gT+x/100,d.N);h+='<td'+(x===0&&y===0?' class="b"':'')+'>'+(v?num(v.fv)+(d.P>0?' <span class="s">('+spct(v.fv/d.P-1,0)+')</span>':''):'n/a')+'</td>'});h+='</tr>'});
 $('sens').innerHTML=h;
 var x=[],y2=[],lo=Math.max(d.gT*100+1,d.r*100-2.5),k,rr,a;
 if(lo===lo&&isFinite(lo)){for(k=0;k<=70;k++){rr=lo+k*0.1;x.push(rr);a=ddm(d.E0,d.roe,rr/100,d.g1,d.gT,d.N);y2.push(a?a.fv:NaN)}}
 if(x.length&&y2.some(function(v){return v===v}))Plot.line($('c1'),{x:x,xnum:true,series:[{name:'Fair value',y:y2}],dec:0,base:d.P>0?d.P:null,vline:[d.r*100],xfmt:function(v){return v.toFixed(1)+'%'},yfmt:function(v){return num(v)},title:'Fair value against discount rate'});
 else $('c1').innerHTML='<p class="note">No finite value at these inputs.</p>';
 var px=[],py=[],q,i3;
 if(d.P>0){for(k=0;k<=80;k++){q=d.P*(0.6+k*0.01);i3=impliedR(q,d.E0,d.roe,d.g1,d.gT,d.N);px.push(q);py.push(i3==null?NaN:(i3-d.rf)*100)}}
 if(px.length&&py.some(function(v){return v===v}))Plot.line($('c2'),{x:px,xnum:true,series:[{name:'Implied premium',y:py}],base:o.erp,vline:[d.P],xfmt:function(v){return num(v)},yfmt:function(v){return v.toFixed(1)+'%'},title:'Implied equity risk premium against index level'});
 else $('c2').innerHTML='<p class="note">No implied premium at these inputs.</p>';
}
function load(key){var s=m.scenarios.filter(function(z){return z.key===key})[0];if(!s)return;cur=key;$('price').value=Math.round(m.level*100)/100;
 ['eps','real','inf','erp','roe','gt','g1','n'].forEach(function(k){$(k).value=s.params[k]});
 [].forEach.call(document.querySelectorAll('#sb button'),function(b){b.className=b.getAttribute('data-k')===key?'on':''});scen();render()}
m.scenarios.forEach(function(s){var b=document.createElement('button');b.setAttribute('data-k',s.key);b.textContent='['+s.name.toLowerCase()+']';$('sb').appendChild(b)});
$('sb').addEventListener('click',function(e){if(e.target.tagName==='BUTTON')load(e.target.getAttribute('data-k'))});
$('sc').addEventListener('click',function(e){var tr=e.target.closest('tr[data-k]');if(tr){load(tr.getAttribute('data-k'));location.hash='model'}});
IDS.forEach(function(k){$(k).addEventListener('input',function(){cur=null;[].forEach.call(document.querySelectorAll('#sb button'),function(b){b.className=''});scen();render()})});

// ---- history
var H=m.history,nz=function(a){return a.map(function(v){return v==null?NaN:v})},hd=H.date.map(function(s){return s+'-28'});
Plot.line($('c3'),{x:hd,series:[{name:'Earnings yield, reported earnings',y:nz(H.ey),dash:'5 3',color:'#666'},{name:'10-year real yield',y:nz(H.real),dash:'2 3',color:'#666'},{name:'Gap',y:nz(H.xey),width:1.9,dash:''}],dec:1,zero:true,base:P.xey_median});
$('c3n').textContent='The grey horizontal line is the median gap since '+P.since.slice(0,4)+', '+pct(P.xey_median/100,2)+'. With the index at '+num(m.level,0)+' and the real yield at '+pct(Y.real10/100,2)+' the gap is '+pct(P.xey/100,2)+'. Monthly averages; the last reported earnings are held until the next release.';
Plot.line($('c4'),{x:hd,series:[{name:'Price to trailing reported earnings',y:nz(H.pe).map(function(v){return v>50?NaN:v}),width:1.9,dash:''},{name:'CAPE',y:nz(H.cape),dash:'5 3',color:'#555'}],dec:0});
load('priced');
})().catch(function(e){document.getElementById('stamp').textContent='Could not load data: '+e.message});
