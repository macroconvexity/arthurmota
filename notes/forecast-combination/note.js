// Reads data/results.json and fills the exhibits. Every number in a table or chart comes from that file.
const $=id=>document.getElementById(id),x=(v,d=1)=>{const q=100*(v-1);return Math.abs(q)<.05?(0).toFixed(d)+'%':(q>0?'+':'\u2212')+Math.abs(q).toFixed(d)+'%'},pc=v=>(v*100).toFixed(1)+'%';
fetch('data/results.json').then(r=>r.json()).then(d=>{
 const ks=Object.keys(d.cost),ts=d.cost[ks[ks.length-1]].rows.map(r=>r.T).filter(t=>t>=20),at=(k,t)=>d.cost[k].rows.find(r=>r.T===t);
 Plot.line($('c1'),{x:ts,xnum:true,ymin:0,h:260,yfmt:v=>v.toFixed(0)+'%',xfmt:v=>'T='+Math.round(v),title:'Cost of estimated weights',
  series:ks.map(k=>({name:k+' forecasts',y:ts.map(t=>100*(at(k,t).est[0]-1))}))});
 const pick=[20,40,80,120,200];
 $('t1').innerHTML='<tr><th>Forecasts</th><th>Weights</th>'+pick.map(t=>`<th class="n">T=${t}</th>`).join('')+'</tr>'+ks.map(k=>
  [['Estimated, simulation',r=>x(r.est[0])],['Estimated, formula',r=>x(r.formula)],['Inverse-MSE, simulation',r=>x(r.inv[0])]].map(([n,f],i)=>
   `<tr><td class="d">${i?'':'K='+k}</td><td>${n}</td>`+pick.map(t=>`<td class="n">${at(k,t)?f(at(k,t)):'n/a'}</td>`).join('')+'</tr>').join('')+
  `<tr class="total"><td class="d"></td><td>Simple average</td>`+pick.map(()=>`<td class="n">${x(d.cost[k].gain)}</td>`).join('')+'</tr>').join('');
 const b=d.breakeven;
 $('t2').innerHTML='<tr><th>Forecasts</th>'+b.g.map(g=>`<th class="n">g&minus;1 = ${Math.round(100*(g-1))}%</th>`).join('')+'</tr>'+
  b.K.map((k,i)=>`<tr><td>K=${k}</td>`+b.T[i].map(t=>`<td class="n">${Math.round(t)}</td>`).join('')+'</tr>').join('');
 $('t3').innerHTML='<tr><th>Forecasts</th><th class="n">Correlation</th><th class="n">Variance ratio</th><th class="n">Gain on offer</th><th class="n">T*</th><th class="n">Estimated at T*</th><th class="n">Std. error</th></tr>'+
  b.checks.map(c=>`<tr><td>K=${c.K}</td><td class="n">${c.rho}</td><td class="n">${c.vmax}</td><td class="n">${x(c.g)}</td><td class="n">${c.T}</td><td class="n">${x(c.est[0])}</td><td class="n">${pc(c.est[1])}</td></tr>`).join('');
 const rho=[...new Set(d.gain.map(r=>r.rho))],vm=[...new Set(d.gain.map(r=>r.vmax))];
 $('t4').innerHTML='<tr><th>Forecasts</th><th class="n">Variance ratio</th>'+rho.map(r=>`<th class="n">corr. ${r}</th>`).join('')+'</tr>'+
  [...new Set(d.gain.map(r=>r.K))].map(k=>vm.map((v,i)=>`<tr><td class="d">${i?'':'K='+k}</td><td class="n">${v}</td>`+
   rho.map(r=>{const q=d.gain.find(z=>z.K===k&&z.vmax===v&&z.rho===r);return `<td class="n">${x(q.g,0)} <span class="s">[${q.wmin.toFixed(2).replace('-','−')}]</span></td>`}).join('')+'</tr>').join('')).join('');
 const s=d.shrink;
 $('x2').textContent=`Extra squared error over the optimum by share of estimated weights. K=${s.K}, T=${s.T}, gain on offer ${x(s.g)}.`;
 Plot.line($('c2'),{x:s.lam,xnum:true,ymin:0,h:240,yfmt:v=>v.toFixed(0)+'%',xfmt:v=>'λ='+v.toFixed(2),title:'Shrinkage',
  series:[{name:'Simulation',y:s.sim.map(v=>100*(v[0]-1))},{name:'Formula',y:s.formula.map(v=>100*(v-1)),color:'#777'}],vline:[s.lam_star]});
 $('k2').innerHTML=[['Simple average, λ=0',x(s.g)],['Estimated, λ=1',x(1+s.c)],['Best mix λ*',s.lam_star.toFixed(2)],['Error at λ*',x(s.at_star)],
  ['Error at λ=0.5',x(s.sim[s.lam.indexOf(0.5)][0])]].map(([n,v])=>`<div><b>${v}</b>${n}</div>`).join('');
 $('t5').innerHTML='<tr><th>Sample</th><th>Case</th><th class="n">Simple average</th><th class="n">Inverse-MSE</th><th class="n">Estimated</th><th class="n">Half and half</th></tr>'+
  d.robust.map((r,i)=>`<tr><td class="d">${i&&d.robust[i-1].T===r.T?'':'T='+r.T}</td><td>${r.case}</td><td class="n">${x(r.equal)}</td><td class="n">${x(r.inv[0])}</td><td class="n">${x(r.est[0])}</td><td class="n">${x(r.half[0])}</td></tr>`).join('');
});
