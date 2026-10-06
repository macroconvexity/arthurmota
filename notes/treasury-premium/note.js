// Reads data/results.json and fills the page. Every number shown comes from that file.
const $=id=>document.getElementById(id),sg=(v,d=2)=>v.toFixed(d).replace('-','\u2212'),bp=(v,d=0)=>v==null?'n/a':+Math.abs(v).toFixed(d)===0?(0).toFixed(d):(v<0?'\u2212':'+')+Math.abs(v).toFixed(d),
 LAB={'3MO':'3 months','6MO':'6 months','1YR':'1 year','2YR':'2 years','3YR':'3 years','5YR':'5 years','7YR':'7 years','10YR':'10 years','20YR':'20 years','30YR':'30 years'},
 day=s=>new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
fetch('data/results.json').then(r=>r.json()).then(d=>{
 const T=Object.fromEntries(d.table.map(r=>[r.tenor,r])),t10=T['10YR'],t30=T['30YR'],t2=T['2YR'],t1=T['1YR'];
 $('stamp').textContent=`SOFR swap rate minus Treasury yield, 3 months to 30 years. Data through ${day(d.through)}.`;
 $('kp').innerHTML=[['2 years',t2],['10 years',t10],['30 years',t30]].map(([n,r])=>`<div><b>${bp(r.now)} bp</b>${n}, latest</div>`).join('')+
  `<div><b>${bp(t10.min)} bp</b>10 years, low on ${day(t10.min_date)}</div><div><b>${bp(d.slope.per_doubling_now)} bp</b>per doubling of maturity</div>`;
 $('lead').textContent=`On ${day(d.through)} the premium is ${bp(t1.now,1)} basis points at 1 year, ${bp(t2.now)} at 2 years, ${bp(t10.now)} at 10 years and ${bp(t30.now)} at 30 years. `+
  `Of a 10-year Treasury yield of ${t10.treasury.toFixed(2)}%, ${Math.abs(t10.now).toFixed(0)} basis points are yield the Treasury pays above the swap rate of ${t10.swap.toFixed(2)}%. `+
  `The 10-year premium is ${Math.abs(t10.now-t10.min).toFixed(0)} basis points above its low and ${Math.abs(t10.now-t10.y1).toFixed(0)} above its level a year earlier.`;
 const c=d.curve;
 $('x1').textContent=`Premium along the curve, basis points: latest, one year earlier (${day(c.y1_date)}) and the day of the 10-year low (${day(c.low_date)})`;
 Plot.line($('c1'),{x:d.years,xnum:true,base:0,dec:0,h:250,xfmt:v=>(+v.toFixed(2))+'y',title:'Premium by maturity',
  series:[{name:'Latest',y:c.now,width:2},{name:'One year earlier',y:c.y1},{name:'10-year low',y:c.low}]});
 $('t1').innerHTML='<tr><th>Maturity</th><th class="n">Treasury</th><th class="n">Swap</th><th class="n">Premium</th><th class="n">1-month avg.</th><th class="n">1 year earlier</th><th class="n">Average</th><th class="n">Low</th><th class="n">Percentile</th></tr>'+
  d.table.map(r=>`<tr><td>${LAB[r.tenor]}</td><td class="n">${r.treasury.toFixed(2)}</td><td class="n">${r.swap.toFixed(2)}</td><td class="n"><b>${bp(r.now,1)}</b></td><td class="n">${bp(r.m1,1)}</td><td class="n">${bp(r.y1,1)}</td><td class="n">${bp(r.mean,1)}</td><td class="n">${bp(r.min,1)}</td><td class="n">${r.pct}</td></tr>`).join('');
 const sy=d.slope.by_year,Y=d.by_year.years;
 $('slope').textContent=`From 2 to 30 years the premium falls by about ${Math.abs(d.slope.per_doubling_now).toFixed(0)} basis points each time maturity doubles. That slope was ${Math.abs(sy[1]).toFixed(0)} in ${Y[1]} and peaked at ${Math.abs(Math.min(...sy)).toFixed(0)} in ${Y[sy.indexOf(Math.min(...sy))]}. The discount is a feature of duration: it is near zero at 1 year and grows with the amount of interest rate risk a holder has to carry.`;
 const s=d.series;
 Plot.line($('c2'),{x:s.date,base:0,dec:0,h:260,title:'Premium history',series:[{name:'2 years',y:s['2YR'],dash:'2 3'},{name:'10 years',y:s['10YR'],dash:'',width:1.8},{name:'30 years',y:s['30YR'],dash:'5 3'}]});
 $('t2').innerHTML='<tr><th>Maturity</th>'+Y.map(y=>`<th class="n">${y}</th>`).join('')+'</tr>'+d.tenors.map(k=>`<tr><td>${LAB[k]}</td>`+d.by_year.rows[k].map(v=>`<td class="n">${bp(v)}</td>`).join('')+'</tr>').join('');
 $('t3').innerHTML='<tr><th>Maturity</th><th class="n">Correlation, levels</th><th class="n">Correlation, changes</th><th class="n">Beta, changes</th></tr>'+
  d.comove.map(r=>`<tr><td>${LAB[r.tenor]}</td><td class="n">${sg(r.corr_level)}</td><td class="n">${sg(r.corr_change)}</td><td class="n">${sg(r.beta_change,3)}</td></tr>`).join('');
 const r10=d.by_year.rows['10YR'],cm=Object.fromEntries(d.comove.map(r=>[r.tenor,r]));
 $('hist').textContent=`The 10-year premium averaged ${bp(r10[1])} basis points in ${Y[1]} and ${bp(r10[Y.indexOf(2025)])} in 2025, with the low of ${bp(t10.min)} on ${day(t10.min_date)}. Across the whole period it is lower when yields are higher (correlation of levels ${sg(cm['10YR'].corr_level)} at 10 years), but month to month the two are close to unrelated at 5 and 10 years (${sg(cm['5YR'].corr_change)} and ${sg(cm['10YR'].corr_change)}). The widening built up over the years in which yields rose. It is not a by-product of each sell-off.`;
 if(!d.hedged){$('hedged').hidden=true;return}
 const h=d.hedged,m=h.monthly10,H=Object.fromEntries(h.rows.map(r=>[r.tenor,r]));
 $('x3').textContent=`10 years, monthly, basis points: Treasury premium over swaps against the hedged measures, through ${day(h.through)}`;
 Plot.line($('c3'),{x:m.date,base:0,dec:0,h:250,title:'Swap-based and hedged measures',series:[{name:'Treasury over SOFR swaps',y:m.us,width:1.8,dash:''},{name:'Treasury over hedged G10 average',y:m.g10,dash:'5 3'},{name:'Treasury over hedged Bund',y:m.eur,dash:'2 3'}]});
 $('x4').textContent=`Average since October 2020 and average of the last month of the hedged series (June 2025), basis points`;
 $('t4').innerHTML='<tr><th>Maturity</th><th class="n">Over swaps</th><th class="n">Over hedged G10</th><th class="n">Over hedged Bund</th><th class="n">Over swaps, Jun 2025</th><th class="n">Over hedged G10, Jun 2025</th><th class="n">Over hedged Bund, Jun 2025</th><th class="n">Corr. of changes</th></tr>'+
  h.rows.map(r=>`<tr><td>${LAB[r.tenor]}</td><td class="n">${bp(r.us,1)}</td><td class="n">${bp(r.g10,1)}</td><td class="n">${bp(r.eur,1)}</td><td class="n">${bp(r.us_end,1)}</td><td class="n">${bp(r.g10_end,1)}</td><td class="n">${bp(r.eur_end,1)}</td><td class="n">${r.corr_change.toFixed(2)}</td></tr>`).join('');
 const a=H['10YR'],b=H['30YR'];
 $('hedge').textContent=`In June 2025 the 10-year Treasury yielded ${Math.abs(a.us_end).toFixed(0)} basis points more than the swap and ${Math.abs(a.g10_end).toFixed(0)} more than the average hedged G10 bond. The remaining ${Math.abs(a.us_end-a.g10_end).toFixed(0)} basis points are what the other G10 sovereigns also give up against their own swaps, net of the basis. About half of the discount to swaps at 10 years is common to government bonds as an asset class and half is specific to the Treasury. At 30 years the figures are ${Math.abs(b.us_end).toFixed(0)} over swaps and ${Math.abs(b.g10_end).toFixed(0)} over hedged G10 bonds.`;
});
