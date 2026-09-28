'use client';
import {useRef,useState,useEffect} from 'react';
import type {ResearchReport} from '@/lib/rift/research-contract';
import type {Trade,Scenario} from '@/lib/rift/stress-engine';
export default function ResearchPanel({symbol,thesis,trade,scenario,hours,equityRetrievedAt,onApply,onReport}:{equityRetrievedAt:string|null;symbol:string;thesis:string;trade:Trade|null;scenario:Scenario;hours:number;onApply:(move:number|null,premium:number|null)=>void;onReport:(report:ResearchReport|null)=>void}){
 const [report,setReport]=useState<ResearchReport|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[reportKey,setReportKey]=useState('');
 const [elapsed,setElapsed]=useState(0);
 const [retryAt,setRetryAt]=useState(0),[clock,setClock]=useState(0);
 const cooldown=Math.max(0,Math.ceil((retryAt-clock)/1000));
 useEffect(()=>{if(!retryAt)return;setClock(Date.now());const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[retryAt]);
 useEffect(()=>{if(!loading)return;const began=Date.now();const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-began)/1000)),1000);return()=>clearInterval(timer);},[loading]);
 const payload=JSON.stringify({symbol,thesis,trade,scenario,hours,equityRetrievedAt});
 const active=useRef(payload);active.current=payload;
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>abort.current?.abort(),[]);
 const stale=!!report&&reportKey!==payload;
 async function interpret(){
  if(!trade||!thesis.trim()||loading||cooldown>0)return;
  abort.current?.abort();const controller=new AbortController();abort.current=controller;
  setElapsed(0);setLoading(true);setError('');setReport(null);onReport(null);const key=payload;
  try{
   const response=await fetch('/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:key,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(115000)])});
   const value=await response.json();if(!response.ok||!value.ok){if(typeof value.retryAfterSeconds==='number'&&Number.isFinite(value.retryAfterSeconds)&&value.retryAfterSeconds>0){setClock(Date.now());setRetryAt(Date.now()+value.retryAfterSeconds*1000);}throw new Error(value.error||'Interpretation unavailable.');}
   if(!controller.signal.aborted){setReport(value);setReportKey(key);if(active.current===key)onReport(value);}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error&&e.name==='TimeoutError'?'The review took too long. Retry when you are ready. Your calculations are unchanged.':e instanceof Error?e.message:'Interpretation unavailable.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 }
 const proposal=report?.interpretation.proposal;
 return <section className="research-panel" aria-label="Thesis interpretation">
  <div className="section-row"><div><p className="eyebrow">THESIS REVIEW</p><h3>What could break your reasoning?</h3></div><button className="button primary" disabled={loading||cooldown>0||!trade||!thesis.trim()} onClick={interpret}>{loading?'Reviewing…':cooldown>0?`Retry in ${cooldown}s`:error?'Retry review':'Interpret thesis'}</button></div>
  <p className="helper">Review your assumptions against this scenario and available evidence. AI does not control the calculations.</p>
  {loading&&<p className="helper" role="status">{elapsed<15?"Checking evidence and reviewing your scenario.":"Still waiting for the AI service. Slow requests can take up to two minutes."} {elapsed}s elapsed. You can keep using the calculator.</p>}
  {loading&&<button className="text-button" onClick={()=>{abort.current?.abort();setLoading(false);setError("Review cancelled. Your calculations are unchanged.");}}>Cancel review</button>}
  {error&&<div className="error-box" role="alert"><p>{error}</p><p className="helper">You can continue reviewing the scenario without AI. Check the price source, costs, adverse moves and loss-budget boundary below.</p></div>}
  <details className="evidence-details"><summary>Manual review checklist</summary><ul><li>Confirm that the entry and reference prices use the intended source and time.</li><li>Enter fees, execution and net funding for the holding period.</li><li>Test an adverse reference move and a worse exit premium.</li><li>Check quantity constraints and account margin separately. This calculator does not model liquidation.</li></ul><p className="helper">This is a fixed checklist, not an AI-generated review.</p></details>
  {report&&<>
   <p className="research-meta">{report.model} · {(report.durationMs/1000).toFixed(1)}s · {new Date(report.createdAt).toLocaleTimeString()}</p>
   {report.timings&&<details className="review-timing"><summary>Review timing{report.cached?" · Reused result":""}</summary><p className="helper">Evidence {(report.timings.evidenceMs/1000).toFixed(1)}s · AI request {(report.timings.modelMs/1000).toFixed(1)}s{report.cached?` · Reused review from ${Math.round((report.cacheAgeMs??0)/1000)}s ago; timings describe its original run.`:''}</p></details>}
   {stale&&<p className="error-box">Inputs changed. This review describes the previous scenario. Interpret again to update it.</p>}
   <div className="research-copy"><h4>How your thesis reads</h4><p>{report.interpretation.summary}</p><h4>The mechanism</h4><p>{report.interpretation.mechanism}</p></div>
   <div className="research-columns"><div><h4>Assumptions to inspect</h4><ul>{report.interpretation.assumptions.map((s,i)=><li key={i}>{s}</li>)}</ul></div><div><h4>Questions worth answering</h4><ul>{report.interpretation.questions.map((s,i)=><li key={i}>{s}</li>)}</ul></div></div>
   {proposal&&(proposal.referenceMovePct!==null||proposal.exitPremiumPct!==null)&&<div className="proposal"><h4>Values read from your thesis</h4><p>Reference move: {proposal.referenceMovePct===null?'keep current':`${proposal.referenceMovePct}%`} · Exit premium: {proposal.exitPremiumPct===null?'keep current':`${proposal.exitPremiumPct}%`}</p><button className="button secondary" disabled={stale} onClick={()=>onApply(proposal.referenceMovePct,proposal.exitPremiumPct)}>Apply these assumptions</button><p className="helper">Check that these values match your meaning. Applying them recalculates the scenario.</p></div>}
   <details className="evidence-details source-summary"><summary>Sources &amp; calculations <span>+</span></summary>
    <p>The AI review referenced {report.interpretation.evidenceIds.join(', ')}. Its prose may be mistaken; Rift’s P&amp;L remains a separate deterministic calculation.</p>
    <ul>{report.evidence.filter(e=>report.interpretation.evidenceIds.includes(e.id)).map(e=><li key={e.id}><strong>{e.id}</strong><span>{e.label}</span></li>)}</ul>
    <p>Scenario formula: contract price = reference price × (1 + premium). Net P&amp;L separates reference movement, premium change, entered fees, execution and funding.</p>
   </details>
  </>}
 </section>;
}
