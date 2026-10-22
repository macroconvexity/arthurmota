/* Engine of the US small model: scenario run from the last observed quarter, and the impulse responses. Pure functions. */
const Engine=(()=>{
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
// Scenario: quarters 1..N after the last observed quarter. o = {policy:'rule'|'market'|'hold', bp, demand, rp, imp, oil, rstar}
function scenario(M,o,N){
 const a=M.params.agg,S=M.start,rs=o.rstar!=null?o.rstar:S.rstar;
 let h=S.h,i1=S.i,i2=S.i_prev,e=S.exp4;
 const core=S.core_qoq.slice(),head=S.head_qoq.slice();let gap=S.head_qoq[3]-S.core_qoq[3];
 const out={h:[h],i:[i1],e:[e],core:[core[3]],core4:[S.core4],head4:[S.head4],rr:[i1-e],rgap:[i1-e-rs]};
 const iner=a.theta_1+a.theta_2,ph=1-a.phi_1-a.phi_2-a.phi_3,ma=a.alpha_1L+a.alpha_1I;
 for(let t=1;t<=N;t++){
  const rg=i1-e-rs;
  h=a.beta_1*h-a.beta_2*rg/4-a.beta_3*o.rp+(t===1?o.demand:0);
  const p4=(core.slice(-4).length?head.slice(-4).reduce((s,v)=>s*(1+v/100),1)-1:0)*100;
  e=a.phi_1*e+(a.phi_2+a.phi_3)*p4+ph*2;
  const imp=o.imp/4*Math.pow(.35,t-1),oil=t===1?o.oil/10:0;
  const c=a.alpha_1L*core[core.length-1]+a.alpha_1I*mean(head.slice(-4))+(1-ma)*e/4+a.alpha_2*imp+a.alpha_3*oil+a.alpha_4*h;
  gap*=.5;core.push(c);head.push(c+gap);
  let it;
  if(o.policy==='market'){const k=Math.min(t-1,M.market.ff.length-1);it=M.market.ff[k]+o.bp/100}
  else if(o.policy==='hold')it=S.i+o.bp/100;
  else it=a.theta_1*i1+a.theta_2*i2+(1-iner)*(rs+2+a.theta_3*(e-2)+a.theta_4*h)+(t===1?o.bp/100:0);
  i2=i1;i1=it;
  const c4=(core.slice(-4).reduce((s,v)=>s*(1+v/100),1)-1)*100,h4=(head.slice(-4).reduce((s,v)=>s*(1+v/100),1)-1)*100;
  out.h.push(h);out.i.push(it);out.e.push(e);out.core.push(c);out.core4.push(c4);out.head4.push(h4);out.rr.push(it-e);out.rgap.push(it-e-rs);
 }
 return out;
}
// Impulse responses, as in the estimation package: deviations from steady state, 17 quarters.
function irf(M,type,mode,o){
 o=o||{};const a=M.params.agg,d=M.params.disagg,H=17,size=o.size==null?1:o.size,hold=o.hold==null?4:o.hold,fixExp=!!o.fixExp,fixImp=!!o.fixImp;
 const z=()=>new Array(H+4).fill(0);
 const i=z(),h=z(),ex=z(),imp=z(),pq=z(),pB=z(),pA=z(),pS=z(),eA=z();
 const rule=t=>{const iner=a.theta_1+a.theta_2;return a.theta_1*i[t-1]+a.theta_2*(t>=2?i[t-2]:0)+(1-iner)*(a.theta_3*ex[t-1]+a.theta_4*h[t-1])};
 for(let t=1;t<H;t++){
  if(type==='monetary')i[t]=t<=hold?size:rule(t);
  else if(type==='monetary_decay')i[t]=t<=hold?size:i[t-1]*.8;
  else i[t]=rule(t);
  if(type==='import'){imp[t]=t===1?2.5*size/10:t===2?1.0*size/10:.35*imp[t-1]}
  else imp[t]=fixImp?0:-.35*(i[t]-i[t-1])+.30*imp[t-1];
  const rl=i[t-1]-ex[t-1];
  h[t]=(type==='gap'&&t===1)?size:a.beta_1*h[t-1]-a.beta_2*(rl/4);
  if(fixExp)ex[t]=0;else{const p4=pq.slice(Math.max(0,t-4),t).reduce((s,v)=>s+v,0);const lead=.55*p4-.12*i[t]+.25*h[t];ex[t]=a.phi_1*ex[t-1]+a.phi_2*lead+a.phi_3*p4}
  const eq=ex[t]/4,m4=t>1?mean(pq.slice(Math.max(0,t-4),t)):0;
  if(mode==='agg'){pq[t]=a.alpha_1L*pq[t-1]+a.alpha_1I*m4+(1-a.alpha_1L-a.alpha_1I)*eq+a.alpha_2*imp[t]+a.alpha_4*h[t]}
  else{
   pB[t]=d.alpha_B1*pB[t-1]+(1-d.alpha_B1)*eq+d.alpha_B4*imp[t]+.5*d.alpha_B4*imp[t-1]+d.alpha_B6*h[t];
   if(type==='import'&&t===1)eA[t]=.15*size/10;
   pA[t]=d.alpha_A1*pA[t-1]+(1-d.alpha_A1)*eq+d.alpha_A3*imp[t]+d.alpha_A4*h[t]+d.alpha_A7*eA[t-1];
   const sm=t>1?mean(pS.slice(Math.max(0,t-4),t)):0;
   pS[t]=d.alpha_S1*m4+d.alpha_S2*sm+(1-d.alpha_S1-d.alpha_S2)*eq+d.alpha_S3*h[t];
   pq[t]=d.w_S*pS[t]+d.w_B*pB[t]+d.w_A*pA[t];
  }
 }
 const acc=v=>Array.from({length:H},(_,t)=>v.slice(Math.max(0,t-3),t+1).reduce((s,x)=>s+x,0));
 return{i:i.slice(0,H),h:h.slice(0,H),exp:ex.slice(0,H),imp:imp.slice(0,H),pi:acc(pq),pB:acc(pB),pA:acc(pA),pS:acc(pS)};
}
return{scenario,irf};
})();
if(typeof module!=='undefined')module.exports=Engine;
