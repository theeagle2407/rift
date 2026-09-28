'use client';
import {useEffect,useMemo,useState} from 'react';
import {historyCases,type HistoryCase,type HistoryData} from '@/lib/rift/history';
export type Replay = {observation:HistoryCase; evidence:HistoryData};
const pct=(n:number)=>`${n>0?'+':''}${n.toFixed(3)}%`;
const stamp=(n:number)=>new Date(n).toISOString().slice(5,16).replace('T',' ');
export default function HistoryEvidence({symbol,direction,onReplay}:{symbol:string;direction:'long'|'short';onReplay:(replay:Replay)=>void}) {
 const [data,setData]=useState<HistoryData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [hours,setHours]=useState(6),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
   setData(null);setError('');
   if (!attempt) return;
   const controller=new AbortController();setLoading(true);
   fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`,{signal:controller.signal,cache:'no-store'})
    .then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'History unavailable.');
      if(d.symbol!==symbol||!Array.isArray(d.points))throw new Error('Unexpected history response.');
      if(!controller.signal.aborted)setData(d);})
    .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'History unavailable.');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
   return ()=>controller.abort();
 },[symbol,attempt]);
 const cases=useMemo(()=>data?historyCases(data.points,hours):[],[data,hours]);
 const sign=direction==='long'?1:-1;
 const disagreements=cases.filter(c=>sign*c.referenceMovePct>0&&sign*c.instrumentReturnPct<0);
 const selected=[...cases].sort((a,b)=>sign*(a.instrumentReturnPct-b.instrumentReturnPct)||a.start-b.start).slice(0,3);
 return <section className="history-evidence">
  <div className="section-row"><h3>Historical context</h3><button className="text-button" disabled={loading} onClick={()=>setAttempt(a=>a+1)}>{loading?'Loading…':data?'Refresh':'Load history'}</button></div>
  <p className="helper">Compare the contract with its exchange index at matching hourly closes.</p>
  {error&&<p className="error-box" role="alert">{error}</p>}
  {data&&<>
   <label className="history-horizon">Holding period<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={6}>6 hours</option><option value={24}>24 hours</option></select></label>
   <p className="history-coverage">{data.points.length} paired closes · {cases.length} complete windows<br/>{stamp(data.points[0].timestamp+3600000)} to {stamp(data.points[data.points.length-1].timestamp+3600000)} UTC</p>
   <p className="helper">{disagreements.length} windows had a favourable index move but an adverse contract move for a {direction}. Before costs. Overlapping windows are not independent trials.</p>
   <h4>Three most adverse contract moves</h4>
   {selected.length===0&&<p className="helper">No complete {hours}-hour windows in this sample.</p>}
   <div className="history-cases">{selected.map(c=>{
     const inside=c.referenceMovePct>=-15&&c.referenceMovePct<=15&&c.exitPremiumPct>=-8&&c.exitPremiumPct<=8;
     return <article className="history-case" key={c.start}>
      <p className="history-date">{stamp(c.start)} → {stamp(c.end)} UTC</p>
      <dl><div><dt>Index move</dt><dd>{pct(c.referenceMovePct)}</dd></div><div><dt>Contract move</dt><dd>{pct(c.instrumentReturnPct)}</dd></div><div><dt>Exit premium</dt><dd>{pct(c.exitPremiumPct)}</dd></div></dl>
      <button className="button secondary" disabled={!inside} onClick={()=>onReplay({observation:c,evidence:data})}>Load historical case</button>
      {!inside&&<p className="helper">Outside the current chart range. Values are not clipped.</p>}
     </article>;
   })}</div>
   <details className="evidence-details"><summary>Coverage & sources <span>↗</span></summary>
     <p>Retrieved {new Date(data.fetchedAt).toISOString()}. Requested the latest 200 completed hourly intervals. {data.unmatched} unmatched observations and {data.excludedRows} duplicate or unclosed rows excluded. Gaps are not interpolated.</p>
     <p>Cases are sorted by the most adverse contract return for the selected direction. They are not thesis-matched analogues, trade fills, or probabilities. A candle close need not be an executable price.</p>
     <p>The exchange index can be stale or differ from the underlying stock. This comparison does not prove stock-market basis convergence. Funding, fees, corporate actions and liquidation are not reconstructed.</p>
     <a href={data.sources[0]} target="_blank" rel="noreferrer">Contract candle source ↗</a><br/><a href={data.sources[1]} target="_blank" rel="noreferrer">Exchange-index candle source ↗</a>
   </details>
  </>}
  {!data&&!loading&&!error&&<p className="helper">Load a dated sample to inspect real price changes. Your current scenario stays unchanged until you select a case.</p>}
 </section>;
}
