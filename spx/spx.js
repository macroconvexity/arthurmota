(async function(){
var $=function(id){return document.getElementById(id)},m=await fetch('data/meta.json').then(function(r){return r.json()});
var MINUS='−',E=m.earnings,R=m.ratios,Y=m.rates,P=m.premium;
function num(v,d){if(v==null||v!==v||!isFinite(v))return 'n/a';return (v<0?MINUS:'')+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:d||0,maximumFractionDigits:d||0})}
function pct(v,d){return v==null||v!==v||!isFinite(v)?'n/a':num(v*100,d==null?1:d)+'%'}
function spct(v,d){return v==null||v!==v||!isFinite(v)?'n/a':(v>0?'+':'')+pct(v,d)}
// ---- header and today
$('stamp').textContent='Index '+m.level_date+', Treasury yields '+m.rates_date+'. Refreshed '+m.updated+'.';
$('kp').innerHTML=[[num(m.level,0),'S&P 500, '+m.level_date],[num(E.ntm,0)+' / '+num(E.ltm,0),'Earnings, next and last twelve months'],[num(R.pe_ntm,1)+'x / '+num(R.pe_ltm,1)+'x','Price to earnings, forward and trailing'],[pct(P.implied_erp/100,2),'Equity risk premium the index implies'],[pct(Y.real10/100,2)+' + '+pct(Y.breakeven10/100,2),'10-year real yield plus breakeven'],[pct(P.xey/100,2),'Earnings yield less real yield, percentile '+num(P.xey_pct,0)+' since '+P.since.slice(0,4)]].map(function(v){return '<div><b>'+v[0]+'</b>'+v[1]+'</div>'}).join('');
$('verdict').textContent='Analysts expect earnings to grow '+pct(E.growth_ntm/100)+' over the next twelve months and '+pct(E.growth_fy1/100)+' in the fiscal year after. At today\'s Treasury yields the index level implies a premium of '+pct(P.implied_erp/100,2)+' over the 10-year Treasury. On reported earnings the earnings yield is '+pct(P.xey/100,2)+' above the real yield, lower than in '+num(100-P.xey_pct,0)+'% of months since '+P.since.slice(0,4)+'.';
var er=[['Next twelve months, analyst consensus',E.ntm],['Next fiscal year, analyst consensus',E.fy1],['Current fiscal year, analyst consensus',E.fy0],['Last twelve months, analyst basis',E.ltm],['Last twelve months, as reported (GAAP)',E.gaap]];
$('et').innerHTML='<tr><th>Measure</th><th>Index points</th><th>Price to earnings</th><th>Earnings yield</th></tr>'+er.map(function(r){return '<tr><td>'+r[0]+'</td><td><b>'+num(r[1],1)+'</b></td><td>'+num(m.level/r[1],1)+'x</td><td>'+pct(r[1]/m.level,2)+'</td></tr>'}).join('');
$('etn').textContent='Return on equity '+pct(R.roe/100)+', price to book '+num(R.pb,1)+'x, dividend yield '+pct(R.dividend_yield/100,2)+', CAPE '+num(R.cape,1)+' (percentile '+num(R.cape_pct,0)+' since 1990).';
// ---- scenarios
var h='<tr><th>Scenario</th><th>Earnings base</th><th>Real yield</th><th>Premium</th><th>Growth, next five years</th><th>Discount rate</th><th>Fair value</th><th>Against index</th><th>In twelve months</th></tr>';
m.scenarios.forEach(function(s){var f=function(k,t){return s.changed.indexOf(k)>=0?'<b>'+t+'</b>':t};
 h+='<tr><td><b>'+s.name+'</b><br><span class="s">'+s.rule+'</span></td><td>'+f('eps',num(s.eps,0))+'</td><td>'+f('real',pct(s.real/100,2))+'</td><td>'+f('erp',pct(s.erp/100,2))+'</td><td>'+f('g1',pct(s.g1/100))+'</td><td>'+pct(s.r/100,2)+'</td><td><b>'+num(s.fv)+'</b></td><td>'+spct(s.gap,0)+'</td><td>'+num(s.v12)+'</td></tr>'});
$('sc').innerHTML=h;
$('scn').textContent='Index at '+num(m.level,0)+'. Bold cells are what a scenario changes. Growth is nominal. The gap between the earnings yield and the real yield stands at '+pct(P.xey/100,2)+'; its 25th percentile, median and 90th percentile since '+P.since.slice(0,4)+' are '+pct(P.xey_p25/100,2)+', '+pct(P.xey_median/100,2)+' and '+pct(P.xey_p90/100,2)+'.';
var G=m.grid;$('gr').innerHTML='<tr><th>Earnings</th><th>Index points</th>'+G.pe.map(function(x,i){return '<th>'+G.pe_pct[i]+'th pct, '+num(x,1)+'x</th>'}).join('')+'</tr>'+G.rows.map(function(r){return '<tr><td>'+r.name+'</td><td>'+num(r.eps,1)+'</td>'+G.pe.map(function(x){var v=r.eps*x;return '<td>'+num(v)+' <span class="s">('+spct(v/m.level-1,0)+')</span></td>'}).join('')+'</tr>'}).join('');
$('grn').textContent='The multiples come from reported earnings, so the last row is the like-for-like one; the rows on analyst earnings show what the same multiples would give on that basis. In brackets, the distance from the index at '+num(m.level,0)+'.';
// ---- history
var H=m.history,nz=function(a){return a.map(function(v){return v==null?NaN:v})},hd=H.date.map(function(s){return s+'-28'});
Plot.line($('c3'),{x:hd,series:[{name:'Earnings yield, reported earnings',y:nz(H.ey),dash:'5 3',color:'#666'},{name:'10-year real yield',y:nz(H.real),dash:'2 3',color:'#666'},{name:'Gap',y:nz(H.xey),width:1.9,dash:''}],dec:1,zero:true,base:P.xey_median});
$('c3n').textContent='The grey horizontal line is the median gap since '+P.since.slice(0,4)+', '+pct(P.xey_median/100,2)+'. With the index at '+num(m.level,0)+' and the real yield at '+pct(Y.real10/100,2)+' the gap is '+pct(P.xey/100,2)+'. Monthly averages; the last reported earnings are held until the next release.';
Plot.line($('c4'),{x:hd,series:[{name:'Price to trailing reported earnings',y:nz(H.pe).map(function(v){return v>50?NaN:v}),width:1.9,dash:''},{name:'CAPE',y:nz(H.cape),dash:'5 3',color:'#555'}],dec:0});
})().catch(function(e){document.getElementById('stamp').textContent='Could not load data: '+e.message});
