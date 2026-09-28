'use client';
import {useEffect,useRef,useState} from 'react';
import {EQUITY_MAP,type EquityPacket} from '@/lib/rift/equity-data';
export default function EquityEvidence({symbol,onData}:{symbol:string;onData:(p:EquityPacket|null)=>void}){
 const [packet,setPacket]=useState<EquityPacket|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[now,setNow]=useState(0);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{setNow(Date.now());const t=setInterval(()=>setNow(Date.now()),30000);return()=>{clearInterval(t);controller.current?.abort();};},[]);
 async function load(){
  controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setError('');setPacket(null);onData(null);
  try{const r=await fetch(`/api/equity?symbol=${encodeURIComponent(symbol)}`,{signal:AbortSignal.any([c.signal,AbortSignal.timeout(45000)])});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Stock evidence unavailable.');if(!c.signal.aborted){setPacket(d.packet);onData(d.packet);setNow(Date.now());}}
  catch(e){if(!c.signal.aborted)setError(e instanceof Error&&e.name==='TimeoutError'?'Stock evidence took too long. Please retry.':e instanceof Error?e.message:'Stock evidence unavailable.');}
  finally{if(!c.signal.aborted)setLoading(false);}
 }
 const q=packet?.quote;const age=q?Math.max(0,Math.floor((now-Date.parse(q.observedAt))/60000)):0;
 return <section className="panel stock-evidence" aria-label="Underlying stock evidence">
  <div className="section-row"><div><p className="eyebrow">UNDERLYING STOCK</p><h2>Check the company behind the contract.</h2></div>{EQUITY_MAP[symbol]&&<button className="button secondary" disabled={loading} onClick={load}>{loading?'Loading evidence…':packet?'Refresh stock evidence':'Load stock evidence'}</button>}</div>
  <p className="helper">Separate stock observations from Bitget’s research service. Loading evidence does not change your scenario prices.</p>
  {!EQUITY_MAP[symbol]&&<p className="helper">Underlying mapping is not yet verified for this contract. Your contract quotes and stress tests remain available.</p>}
  {error&&<p className="error-box" role="alert">{error}</p>}
  {packet&&<><div className="stock-evidence-grid">
   <div><h3>{packet.ticker} stock observation</h3>{q?<><p className="stock-value">{q.price.toLocaleString(undefined,{maximumFractionDigits:4})} <small>{q.currency||'currency not supplied'}</small></p><p className="helper">{age<1?'Less than one minute':`${age} minutes`} old · {age>=15?'Older observation':'Recorded observation'}</p><p className="helper">Observed {new Date(q.observedAt).toLocaleString()}<br/>Provider: {q.provider}</p></>:<p className="helper">Quote unavailable.</p>}</div>
   <div><h3>Company context</h3>{packet.profile?<><p>{packet.profile.name}</p><p className="helper">{packet.profile.exchange||'Exchange not supplied'}<br/>{packet.profile.industry||'Industry not supplied'}</p><p className="helper">Provider: {packet.profile.provider}. Profile effective date not supplied.</p></>:<p className="helper">Company profile unavailable.</p>}</div>
   <div><h3>Earnings calendar</h3>{packet.earnings?<><p>{packet.earnings.dates[0]||'No event returned in this window'}</p><p className="helper">{packet.earnings.start} to {packet.earnings.end}<br/>Provider: {packet.earnings.provider}</p><p className="helper">Provider-reported date; timing may change. An empty calendar does not establish that no event is scheduled.</p></>:<p className="helper">Earnings calendar unavailable.</p>}</div>
  </div><p className="helper">Retrieved {new Date(packet.retrievedAt).toLocaleString()}. Responses may be reused for up to five minutes. Stock observations and USDT contract quotes are not synchronized; no executable spread is inferred.</p>
  {packet.issues.map(i=><p className="helper" key={i}>{i}</p>)}
  <p className="helper">Run Interpret thesis to include available stock evidence in a new review. The review may retrieve a newer observation.</p>
  <details className="evidence-details"><summary>Stock evidence record <span>↗</span></summary><a href="https://bitget-ai.gitbook.io/bitgetai_hackathons2#v.-developer-toolkit" target="_blank" rel="noreferrer">Organizer’s data-service documentation ↗</a><pre className="evidence-json">{JSON.stringify(packet,null,2)}</pre></details></>}
 </section>;
}
