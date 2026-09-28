"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { calculateBreakPoints, calculateStress, lossBoundaryPremium, type Trade } from "@/lib/rift/stress-engine";

import EquityEvidence from "@/components/rift/equity-evidence";
import type {EquityPacket} from "@/lib/rift/equity-data";
import ResearchPanel from "@/components/rift/research-panel";
import {contractCheck,type ContractSnapshot} from "@/lib/rift/contract-check";
import {renderBrief} from "@/lib/rift/export-brief";
import type {ResearchReport} from "@/lib/rift/research-contract";
import HistoryEvidence, { type Replay } from "@/components/rift/history-evidence";

import MarketSelector from "@/components/rift/market-selector";
type Quote = {
  instrument: string; company: string; lastPrice: number; bid: number | null;
  ask: number | null; indexPrice: number | null; markPrice: number | null;
  quotedAt: string; receivedAt: string; fundingRate: number | null;
};
type Fields = { entryPrice: string; entryReference: string; quantity: string;
  lossBudget: string; entryFeeBps: string; exitFeeBps: string;
  executionCost: string; fundingCost: string };
const INITIAL: Fields = { entryPrice: "104", entryReference: "100", quantity: "10",
  lossBudget: "25", entryFeeBps: "0", exitFeeBps: "0", executionCost: "0", fundingCost: "0" };
const money = (n: number) => new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(n);
const signed = (n: number) => `${n < -0.000001 ? "−" : n > 0.000001 ? "+" : ""}${money(Math.abs(n))}`;
const percent = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
const shown = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? money(n) : "Unavailable";
const time = (s: string) => new Date(s).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"});

function NumberField({ label, value, onChange, unit, min = 0 }: {
  label: string; value: string; onChange: (value: string) => void; unit: string; min?: number;
}) {
  const [editing,setEditing]=useState(false);
  const numeric=Number(value);
  const display=unit==='USDT'&&!editing&&value.trim()!==''&&Number.isFinite(numeric)
    ? String(Number(numeric.toPrecision(8))) : value;
  return <label className="number-field"><span>{label}</span><span className="input-wrap">
    <input type="number" step="any" min={min} value={display} onFocus={()=>setEditing(true)} onBlur={()=>setEditing(false)} title={unit==="USDT"?`Full value: ${value}`:undefined} onChange={e => onChange(e.target.value)} />
    <span className="input-unit">{unit}</span></span></label>;
}

function StressMap({ trade, move, premium, onChange }: {
  trade: Trade; move: number; premium: number; onChange: (move: number, premium: number) => void;
}) {
  const W = 640, H = 340, L = 65, T = 30, PW = 548, PH = 248;
  const x = (v: number) => L + (v + 15) / 30 * PW;
  const y = (v: number) => T + (8 - v) / 16 * PH;
  const cells = useMemo(() => {
    const list = [];
    for (let col = 0; col < 30; col++) for (let row = 0; row < 24; row++) {
      const m = -15 + (col + 0.5), p = 8 - (row + 0.5) * 16 / 24;
      const result = calculateStress(trade, {referenceMovePct: m, exitPremiumPct: p});
      const scale = Math.max(trade.lossBudget, result.entryNotional * 0.02, 1);
      const strength = Math.min(1, Math.abs(result.budgetRemaining) / scale);
      const fill = result.budgetBreached
        ? `rgb(${Math.round(86 + 74 * strength)},${Math.round(48 + 7 * strength)},${Math.round(49 + 11 * strength)})`
        : `rgb(24,${Math.round(65 + 53 * strength)},${Math.round(70 + 51 * strength)})`;
      list.push(<rect key={`${col}-${row}`} x={L + col * PW / 30} y={T + row * PH / 24}
        width={PW / 30 + 0.4} height={PH / 24 + 0.4} fill={fill} />);
    }
    return list;
  }, [trade]);
  const boundary = useMemo(() => {
    let d = "", pen = false;
    for (let i = 0; i <= 120; i++) {
      const m = -15 + i / 4, p = lossBoundaryPremium(trade, m);
      if (p === null || Math.abs(p) > 100000) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(m)},${y(p)} `; pen = true;
    }
    return d;
  }, [trade]);
  function select(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width * W;
    const py = (event.clientY - box.top) / box.height * H;
    if (px < L || px > L + PW || py < T || py > T + PH) return;
    onChange(Math.round((-15 + (px - L) / PW * 30) * 10) / 10,
      Math.round((8 - (py - T) / PH * 16) * 10) / 10);
  }
  return <div className="map-wrap"><svg viewBox={`0 0 ${W} ${H}`} className="stress-map"
    role="img" aria-label="Scenario map: reference move on the horizontal axis, exit premium on the vertical axis. Use the sliders below to select a scenario with a keyboard."
    onPointerDown={select}>
    <defs><clipPath id="stress-plot"><rect x={L} y={T} width={PW} height={PH} rx={8}/></clipPath></defs>
    <text x={L} y={15} className="axis-caption">EXIT PREMIUM TO REFERENCE</text>
    <g clipPath="url(#stress-plot)">{cells}
      {[-10, -5, 0, 5, 10].map(v => <line key={`x${v}`} x1={x(v)} x2={x(v)} y1={T} y2={T+PH} className="grid-line" />)}
      {[-4, 0, 4].map(v => <line key={`y${v}`} x1={L} x2={L+PW} y1={y(v)} y2={y(v)} className="grid-line" />)}
      <path d={boundary} stroke="#eee9dc" strokeWidth={1.7} strokeDasharray="6 5" fill="none" />
      <line x1={x(move)} x2={x(move)} y1={T} y2={T+PH} className="crosshair" />
      <line x1={L} x2={L+PW} y1={y(premium)} y2={y(premium)} className="crosshair" />
    </g>
    <circle cx={x(move)} cy={y(premium)} r={6} fill="#10191d" stroke="#fff" strokeWidth={2}/>
    <circle cx={x(move)} cy={y(premium)} r={2} fill="#65e4e8"/>
    {[-15, -10, -5, 0, 5, 10, 15].map(v => <text key={v} x={x(v)} y={T+PH+23} textAnchor="middle" className="axis-text">{v > 0 ? "+" : ""}{v}%</text>)}
    {[-8, -4, 0, 4, 8].map(v => <text key={v} x={L-12} y={y(v)+4} textAnchor="end" className="axis-text">{v > 0 ? "+" : ""}{v}%</text>)}
    <text x={L+PW/2} y={H-8} textAnchor="middle" className="axis-caption">REFERENCE PRICE MOVE</text>
  </svg><div className="map-legend"><span><i className="swatch safe"/>Within loss budget</span><span><i className="swatch danger"/>Beyond budget</span><span><i className="dashed"/>Budget boundary</span></div></div>;
}

export default function Workbench() {
  const [equity,setEquity]=useState<EquityPacket|null>(null);
  const [research, setResearch] = useState<{key:string;report:ResearchReport}|null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [symbol, setSymbol] = useState<string>("NVDAUSDT");
  const [fields, setFields] = useState<Fields>(INITIAL);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [move, setMove] = useState(2);
  const [premium, setPremium] = useState(0);
  const [thesisNeedsReview, setThesisNeedsReview] = useState(false);
  const [thesis, setThesis] = useState("I expect the reference price to rise 2%. What if the entry premium disappears?");
  const [contract, setContract] = useState<ContractSnapshot|null>(null);
  const [feeSource,setFeeSource] = useState("No fee assumptions entered.");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<"trade" | "stress" | "evidence">("trade");
  const [inputOrigin, setInputOrigin] = useState<"synthetic"|"manual"|"snapshot"|"historical">("synthetic");
  const [appliedQuote, setAppliedQuote] = useState<Quote|null>(null);
  const [context, setContext] = useState("Illustrative example · synthetic prices");
  const [notice, setNotice] = useState("");
  const [baseline, setBaseline] = useState<{netPnl: number; quantity: string; label: string} | null>(null);
  const [hasTested, setHasTested] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  useEffect(()=>{if(showEvidence && tab==="evidence") document.querySelector(".evidence-panel")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});},[showEvidence,tab]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setQuote(null);
    fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`, {signal: controller.signal, cache: "no-store"})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Market quote unavailable.");
        if (data.instrument !== symbol || !Number.isFinite(data.lastPrice) ||
          data.lastPrice <= 0 || !Number.isFinite(Date.parse(data.quotedAt))) {
          throw new Error("The quote could not be verified.");
        }
        if (!controller.signal.aborted) { setQuote(data); setNow(Date.now()); }
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Market connection unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [symbol, refresh]);

  const parsed = useMemo(() => {
    try {
      if (Object.values(fields).some(v => v.trim() === "")) throw new Error("Complete the numerical inputs to calculate a scenario.");
      const trade: Trade = {direction, multiplier: 1, ...Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,Number(v)]))} as Trade;
      const result = calculateStress(trade, {referenceMovePct: move, exitPremiumPct: premium});
      return {trade,result,error:""};
    } catch (err) { return {trade:null,result:null,error:err instanceof Error ? err.message : "Check your inputs."}; }
  }, [fields, direction, move, premium]);
  const researchKey=JSON.stringify({symbol,thesis,trade:parsed.trade,scenario:{referenceMovePct:move,exitPremiumPct:premium},hours:replay?.observation.hours??6,equityRetrievedAt:equity?.symbol===symbol?equity.retrievedAt:null});
  const quoteAge = quote ? Math.max(0, now - Date.parse(quote.quotedAt)) : 0;
  const stale = quoteAge > 60000;
  const result = parsed.result;
  const quantityCheck=contractCheck(contract,symbol,fields.quantity,fields.entryPrice,now);
  const publishedFee=contract?.instrument.symbol===symbol&&now>=Date.parse(contract.fetchedAt)&&now-Date.parse(contract.fetchedAt)<=300000?contract.instrument.terms?.takerFeeRate:undefined;
  const breakPoints = useMemo(() => parsed.trade ? calculateBreakPoints(parsed.trade,
    {referenceMovePct:move,exitPremiumPct:premium}) : null, [parsed.trade,move,premium]);
  const entryPremium = Number(fields.entryReference) > 0 ? (Number(fields.entryPrice)/Number(fields.entryReference)-1)*100 : null;
  function loadHistoricalCase(value: Replay) {
    setFeeSource("Costs reset when historical prices were loaded.");
    const c = value.observation;
    setThesisNeedsReview(true); setReplay(value); setBaseline(null); setInputOrigin("historical"); setAppliedQuote(null);
    setFields(previous => ({...previous, entryPrice:String(c.entryPrice),entryReference:String(c.entryReference),
      entryFeeBps:"0",exitFeeBps:"0",executionCost:"0",fundingCost:"0"}));
    setMove(c.referenceMovePct);setPremium(c.exitPremiumPct);setHasTested(true);setTab("stress");
    setContext(`Historical case · ${new Date(c.start).toISOString()} · ${c.hours}h · exchange index`);
    setNotice("Historical closes loaded. Quantity and loss budget retained; costs reset to zero. Add your assumptions to explore a counterfactual.");
  }
  function field(key: keyof Fields, value: string) {
    if(key==="entryFeeBps"||key==="exitFeeBps")setFeeSource("Manually entered fee assumptions.");
    setFields(previous => ({...previous,[key]:value}));
    if (key === "entryPrice" || key === "entryReference") {setThesisNeedsReview(true);setReplay(null);setAppliedQuote(null);setInputOrigin("manual");setContext("Manual price assumptions");}
  }
  function reset() {
    setFeeSource("No fee assumptions entered.");
    setThesisNeedsReview(true);
    setInputOrigin("synthetic"); setAppliedQuote(null);
    setReplay(null);
    setFields({...INITIAL}); setDirection("long"); setMove(2); setPremium(0); setBaseline(null);
    setHasTested(false); setShowEvidence(false); setTab("trade");
    setContext("Illustrative example · synthetic prices"); setNotice("Illustrative example restored.");
  }
  function stressTest() {
    if (!parsed.trade || !parsed.result) {
      setNotice(parsed.error || "Complete the trade inputs before running the stress test.");
      return;
    }
    setHasTested(true); setTab("stress");
    setNotice("Stress test complete. Adjust the scenario to see where the position breaks.");
  }
  function useQuote() {
    if (!quote || stale || !quote.indexPrice || quote.indexPrice <= 0) return;
    const entry = direction === "long" ? quote.ask : quote.bid;
    if (!entry || entry <= 0) return;
    setThesisNeedsReview(true); setReplay(null); setInputOrigin("snapshot"); setAppliedQuote({...quote});
    setFields(previous => ({...previous,entryPrice:String(entry),entryReference:String(quote.indexPrice)}));
    setBaseline(null); setHasTested(true); setTab("stress");
    setContext(`${symbol} snapshot · ${time(quote.quotedAt)} · exchange index reference`);
    setNotice("Quote snapshot loaded. Future moves, fees and funding remain your scenario assumptions.");
  }
  function applySaferSize() {
    const limit=breakPoints?.maxQuantityWithinBudget;
    if (limit===null||limit===undefined||limit<=0) return;
    const safe=Math.floor(limit*0.95*1e6)/1e6;
    setBaseline(result?{netPnl:result.netPnl,quantity:fields.quantity,label:context}:null);
    setFields(previous=>({...previous,quantity:String(safe)}));
    setNotice(`Position reduced to ${safe} units, 5% below this scenario’s calculated boundary. Re-test other scenarios before deciding.`);
  }
  function exportBrief() {
    if (!result || !parsed.trade) return;
    const brief = {product:"Rift", version:"batch-12", exportedAt:new Date().toISOString(), symbol,
      scope:"Hypothetical linear unit-price scenario; not an executable order or a forecast.", context,
      thesis, thesisNeedsReview, trade:parsed.trade, scenario:{referenceMovePct:move,exitPremiumPct:premium}, result,
      breakPoints, stockEvidence:equity?.symbol===symbol?equity:null, comparison:baseline, contractSnapshot:contract, quantityCheck, feeSource, inputOrigin, quoteSnapshot:appliedQuote??quote, historicalEvidence:replay, aiResearch:research?.key===researchKey?research.report:null,
      limitations:["Scenario reference remains the exchange index or entered assumption. Separately loaded stock evidence does not replace it; currencies and observation times may differ.","Historical cases are retrospective observations, not forecasts. AI interpretation may be mistaken; calculations remain deterministic.",
        "Contract multiplier fixed at 1 for unit-price scenarios; actual order sizing requires instrument verification.",
        "Funding is a manually entered net cost, not a forecast from the current rate.","No liquidation model."]};
    const url=URL.createObjectURL(new Blob([renderBrief(brief)],{type:"text/html;charset=utf-8"}));
    const link=document.createElement("a"); link.href=url; link.download=`rift-${symbol.toLowerCase()}-brief.html`;
    link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); setNotice("Decision brief downloaded. Open the HTML file in your browser to read it or print to PDF.");
  }
  const headline = !result ? "Set your assumptions." : result.referenceContribution > 0 && result.premiumContribution < 0 && result.netPnl < 0
    ? "Right on direction. Still down on the trade."
    : result.budgetBreached ? "This scenario exceeds your loss budget."
    : result.netPnl < 0 ? "A loss, within your chosen budget."
    : "This scenario stays within your budget.";
  const explanation = !result ? "Your calculation will appear when the inputs are valid."
    : result.referenceContribution > 0 && result.premiumContribution < 0 && result.netPnl < 0
    ? "The premium change and any entered costs outweigh the directional gain."
    : "Change the reference move or exit premium to explore the limits of your position.";
  const components = result ? [
    {label:"Reference movement",value:result.referenceContribution},
    {label:"Premium change",value:result.premiumContribution},
    {label:"Fees + execution",value:-(result.entryFee+result.exitFee+Number(fields.executionCost))},
    {label:"Net funding",value:-Number(fields.fundingCost)},
  ] : [];
  const maxContribution=Math.max(1,...components.map(c=>Math.abs(c.value)));

  return <main className="rift-app">
    <header className="topbar"><a className="brand" href="/" aria-label="Rift home">RIFT<span className="brand-cut"/></a>
      <span className="tagline">Pre-trade decision workspace</span>

      <button className="button secondary export" disabled={!result||!hasTested} onClick={exportBrief}>Export brief <span aria-hidden="true">↗</span></button>
    </header>
    <section className="workspace-intro"><div><h1>Scenario workbench</h1><p>See how price, premium and costs affect your position.</p></div>
      <button className="button secondary" onClick={()=>{setShowEvidence(v=>!v);setTab("evidence");}}> {showEvidence ? "Hide market evidence" : "Explore Bitget evidence"} <span aria-hidden="true">↗</span></button></section>
    <nav className="mobile-tabs" aria-label="Research sections">{(["trade","stress","evidence"] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>{if(t==="evidence")setShowEvidence(true);setTab(t);}}>{t === "trade" ? "Setup" : t === "stress" ? "Results" : "Evidence"}</button>)}</nav>
    <div className={`workbench-grid focused-flow ${showEvidence?"evidence-open":""}`}>
      <aside className={`panel trade-panel ${tab==="trade"?"mobile-active":""}`} aria-label="Your trade">
        <div className="panel-title"><h2>Position setup</h2></div><p className="setup-source">{context}</p>
        <MarketSelector onSnapshot={setContract} symbol={symbol} onChange={value=>{setEquity(null);setQuote(null);setResearch(null);setSymbol(value);reset();setNotice("Market changed. Load a quote snapshot or enter your assumptions.");}}/>
        <button className="button secondary mobile-quote-link" onClick={()=>{setShowEvidence(true);setTab("evidence");}}>View market quote</button>
        <div className="segmented" aria-label="Position direction"><button aria-pressed={direction==="long"} onClick={()=>setDirection("long")}>Long</button><button aria-pressed={direction==="short"} onClick={()=>setDirection("short")}>Short</button></div>
        <div className="field-stack">
          <NumberField label="Entry price" value={fields.entryPrice} onChange={v=>field("entryPrice",v)} unit="USDT"/>
          <NumberField label="Reference at entry" value={fields.entryReference} onChange={v=>field("entryReference",v)} unit="USDT"/>
          <NumberField label="Position quantity" value={fields.quantity} onChange={v=>field("quantity",v)} unit="units"/>
          <NumberField label="Loss budget" value={fields.lossBudget} onChange={v=>field("lossBudget",v)} unit="USDT"/>
        </div>
        <details className="quantity-status"><summary>{quantityCheck.status==="checked"?"Quantity checks passed":quantityCheck.status==="mismatch"?"Check position quantity":"Quantity checks unavailable"}</summary><p className="helper">{quantityCheck.messages.join(" ")}</p></details>
        <div className="derived"><span>Entry premium</span><strong>{entryPremium!==null&&Number.isFinite(entryPremium)?percent(entryPremium):"—"}</strong></div>
        <label className="thesis-label">Your thesis <span>optional</span><textarea value={thesis} onChange={e=>{setThesis(e.target.value);setThesisNeedsReview(false);}} maxLength={600} rows={3}/></label>
        <p className="helper">{thesisNeedsReview?"Prices changed since this thesis was entered. Review it against the current inputs.":replay?"Your thesis is retained separately and may differ from this historical case. Review it before requesting AI interpretation.":"Describe your expectations. Use Interpret thesis to review them against the scenario."}</p>
        <details className="cost-details"><summary>Fees & carrying costs <span>{Number(fields.entryFeeBps)||Number(fields.exitFeeBps)||Number(fields.executionCost)||Number(fields.fundingCost)?"Entered":"Not included"}</span></summary><button className="text-button" onClick={()=>{setFeeSource("Illustrative fees: 10 bps per side, not exchange rates.");setFields(previous=>({...previous,entryFeeBps:"10",exitFeeBps:"10",executionCost:"2",fundingCost:"3"}));setNotice("Illustrative costs applied: 10 bps per side, 2 USDT execution and 3 USDT net funding. These are assumptions, not Bitget rates.");}}>Use illustrative costs</button><p className="helper">Example: 10 bps per side, 2 USDT execution, 3 USDT funding. Not exchange rates.</p><p className="helper">{feeSource}</p>{publishedFee!==undefined&&Number(publishedFee)>=0&&Number(publishedFee)<1&&<button className="button secondary" onClick={()=>{const bps=Number((Number(publishedFee)*10000).toFixed(8));setFields(previous=>({...previous,entryFeeBps:String(bps),exitFeeBps:String(bps)}));setFeeSource(`Published Bitget taker rate used as an assumption on both sides: ${bps} bps. Captured ${contract?.fetchedAt}. Your actual account rate may differ.`);setNotice("Published taker fee assumption applied to entry and exit. Execution and funding assumptions retained.");}}>Use published taker fee · {Number((Number(publishedFee)*10000).toFixed(8))} bps per side</button>}<div className="field-stack">
          <NumberField label="Entry fee" value={fields.entryFeeBps} onChange={v=>field("entryFeeBps",v)} unit="bps"/>
          <NumberField label="Exit fee" value={fields.exitFeeBps} onChange={v=>field("exitFeeBps",v)} unit="bps"/>
          <NumberField label="Additional execution" value={fields.executionCost} onChange={v=>field("executionCost",v)} unit="USDT"/>
          <NumberField label="Net funding cost" value={fields.fundingCost} onChange={v=>field("fundingCost",v)} unit="USDT" min={-1000000}/>
          <p className="helper">Costs cover your assumed holding period. Negative funding means a receipt. Avoid counting spread twice.</p>
        </div></details>
        <button className="button primary stress-cta" onClick={stressTest} disabled={!parsed.trade}>Stress-test my trade <span aria-hidden="true">→</span></button>
        <div className="trade-footer"><span className="small-dot"/>Scenario calculation<button className="text-button" onClick={reset}>Reset example</button></div>
      </aside>
      <section className={`panel analysis-panel ${tab==="stress"?"mobile-active":""}`} aria-label="Stress analysis">
        {!hasTested ? <div className="result-prompt"><p className="eyebrow">SCENARIO PREVIEW</p><h2>What happens if your assumptions play out?</h2><p>Test the prices and costs in Position setup, then explore how the result changes.</p><div className="welcome-equation"><div><span>Reference move</span><strong>{percent(move)}</strong></div><span aria-hidden="true">→</span><div><span>Entry → exit premium</span><strong>{entryPremium===null?"—":percent(entryPremium)} → {percent(premium)}</strong></div></div><button className="button primary" onClick={stressTest} disabled={!parsed.trade}>Run scenario <span aria-hidden="true">→</span></button><span className="welcome-note">{context} · No order placed</span></div> : <>
        <div className="context-line"><span className="eyebrow">{replay ? "HISTORICAL INPUTS · EDITABLE SCENARIO" : "HYPOTHETICAL SCENARIOS"}</span><span className="context-label">{context}</span></div>
        <h2 className="result-heading">{headline}</h2>{replay&&<p className="helper">Historical prices loaded. Fees, execution and funding were reset to zero on load; add cost assumptions below Position setup. These costs are not reconstructed from history.</p>}<p className="result-description">{explanation}</p>
        {parsed.error ? <div role="alert" className="error-box">{parsed.error}</div> : result && parsed.trade && <>
          <div className="metrics"><div><span>Reference move</span><strong>{percent(move)}</strong></div><div><span>Scenario P&L</span><strong className={result.netPnl<0?"negative":"positive"}>{signed(result.netPnl)}<small> USDT</small></strong></div><div><span>Loss budget</span><strong>{money(Number(fields.lossBudget))}<small> USDT</small></strong></div></div>
          {result.netPnl>=0&&<p className="helper">Loss budget used: 0.00 of {money(parsed.trade.lossBudget)} USDT in this scenario.</p>}
          <p className="helper">Scenario budget only. Liquidation, margin requirements and losses along the price path are not modelled.</p>
          <StressMap trade={parsed.trade} move={move} premium={premium} onChange={(m,p)=>{setMove(m);setPremium(p);}}/>
          <div className="scenario-sliders"><label><span>Reference move <output>{percent(move)}</output></span><input aria-label="Reference move" type="range" min={-15} max={15} step={0.1} value={move} onChange={e=>setMove(Number(e.target.value))}/></label><label><span>Exit premium <output>{percent(premium)}</output></span><input aria-label="Exit premium" type="range" min={-8} max={8} step={0.1} value={premium} onChange={e=>setPremium(Number(e.target.value))}/></label></div>
          <div className="breakdown"><div className="section-row"><h3>What drives the result</h3><span>USDT</span></div>
            {components.map(c=><div className="contribution" key={c.label}><span>{c.label}</span><div className="bar-track"><i className={c.value<0?"bar negative-bg":"bar positive-bg"} style={{width:`${Math.abs(c.value)/maxContribution*100}%`}}/></div><strong className={c.value<0?"negative":c.value>0?"positive":""}>{signed(c.value)}</strong></div>)}
            <div className="net-row"><strong>Net scenario P&L</strong><strong className={result.netPnl<0?"negative":"positive"}>{signed(result.netPnl)} USDT</strong></div>
            <p className="helper">{Number(fields.entryFeeBps)===0&&Number(fields.exitFeeBps)===0&&Number(fields.executionCost)===0&&Number(fields.fundingCost)===0 ? "No costs entered. This result excludes fees, execution costs and funding." : "Includes only the costs you entered. Future costs may differ."}</p>
          </div>
          {breakPoints&&<div className="break-points"><div className="section-row"><div><p className="eyebrow">BREAK POINTS</p><h3>Scenario boundaries</h3></div><span>Deterministic</span></div>
            <div className="break-point-grid">
              <div><span>Maximum size within budget</span><strong>{breakPoints.maxQuantityWithinBudget===null?"Not bounded":breakPoints.maxQuantityWithinBudget<=0?"No positive size":`${money(breakPoints.maxQuantityWithinBudget)} units`}</strong><small>{breakPoints.maxQuantityWithinBudget===null?"Loss does not increase with size under only these selected assumptions.":"At the entered move, premium and costs."}</small></div>
              <div><span>Break-even exit premium</span><strong>{breakPoints.breakEvenPremiumPct===null?"Unavailable":`≈ ${percent(breakPoints.breakEvenPremiumPct)}`}</strong><small>{direction==="long"?"Long requires this premium or higher.":"Short requires this premium or lower."}</small></div>
              <div><span>Reference move at budget edge</span><strong>{breakPoints.budgetBoundaryReferenceMovePct===null?"Unavailable":`≈ ${percent(breakPoints.budgetBoundaryReferenceMovePct)}`}</strong><small>Rounded boundary; hold exit premium and costs constant.</small></div>
            </div>
            {breakPoints.maxQuantityWithinBudget!==null&&breakPoints.maxQuantityWithinBudget>0&&breakPoints.maxQuantityWithinBudget<parsed.trade.quantity-1e-8&&<button className="button primary safer-size" onClick={applySaferSize}>Apply 95% of size limit <span aria-hidden="true">→</span></button>}
            <p className="helper">Rounded limits for these assumptions, not recommended position sizes.</p>
          </div>}
          <div className="analysis-actions"><div className="action-pair"><button className="button secondary" onClick={()=>{setTab("trade");document.querySelector(".trade-panel")?.scrollIntoView({behavior:"smooth",block:"start"});}}>Change assumptions</button><button className="button secondary" onClick={()=>{setShowEvidence(true);setTab("evidence");}}>View evidence</button></div><span className={result.budgetBreached?"budget-state negative":"budget-state"}>{result.budgetBreached ? "Beyond your loss budget" : "Within your loss budget"}</span></div>
          <button className="text-button compare-link" onClick={()=>{setBaseline({netPnl:result.netPnl,quantity:fields.quantity,label:context});setNotice("Baseline pinned. Edit quantity or assumptions to compare.");}}>Pin this result for comparison</button>
          {baseline&&<div className="comparison"><div><span>Pinned scenario · {baseline.quantity} units</span><strong>{signed(baseline.netPnl)} USDT</strong></div><div><span>Change from baseline</span><strong className={result.netPnl-baseline.netPnl<0?"negative":"positive"}>{signed(result.netPnl-baseline.netPnl)} USDT</strong></div><button className="text-button" onClick={()=>setBaseline(null)}>Clear</button></div>}
        </>}
        <ResearchPanel equityRetrievedAt={equity?.symbol===symbol?equity.retrievedAt:null} key={symbol} symbol={symbol} thesis={thesis} trade={parsed.trade} scenario={{referenceMovePct:move,exitPremiumPct:premium}} hours={replay?.observation.hours??6}
          onReport={report=>setResearch(report?{key:researchKey,report}:null)}
          onApply={(m,p)=>{if(m!==null)setMove(m);if(p!==null)setPremium(p);setNotice("Reviewed thesis assumptions applied. Interpret again to review the updated result.");}}/>
        </>}
      </section>
      {showEvidence&&<aside className={`panel evidence-panel ${tab==="evidence"?"mobile-active":""}`} aria-label="Evidence and market data">
        <div className="panel-title"><h2>Market & evidence</h2><button className="text-button" onClick={()=>{setShowEvidence(false);setTab(hasTested?"stress":"trade");}}>Close</button></div>
        <div className="section-row"><span className={`quote-status ${stale||error?"warning":""}`}><i/>{loading?"Fetching quote":error?"Quote unavailable":stale?"Quote is stale":"Quote retrieved"}</span><button className="text-button" onClick={()=>setRefresh(v=>v+1)} disabled={loading}>Refresh</button></div>
        {error&&<div role="alert" className="error-box">{error}<p>Scenario calculations remain available with your entered assumptions.</p></div>}
        {quote&&<div className="quote-card"><div className="quote-name"><span>{quote.company}</span><span>{symbol}</span></div><div className="quote-price">{money(quote.lastPrice)}<small> USDT</small></div>
          <dl className="quote-details"><div><dt>Bid</dt><dd>{shown(quote.bid)}</dd></div><div><dt>Ask</dt><dd>{shown(quote.ask)}</dd></div><div><dt>Exchange index</dt><dd>{shown(quote.indexPrice)}</dd></div><div><dt>Mark</dt><dd>{shown(quote.markPrice)}</dd></div></dl>
          <p className="quote-time">Quoted {time(quote.quotedAt)} · {Math.floor(quoteAge/1000)}s old</p>
          <button className="button primary" onClick={useQuote} disabled={stale||!quote.indexPrice||!(direction==="long"?quote.ask:quote.bid)}>Use quote snapshot <span aria-hidden="true">↙</span></button>
          <p className="helper">Loads the {direction==="long"?"ask":"bid"} as entry and the exchange index as reference. The exchange index is not an independent stock quote.</p></div>}
        <div className="evidence-group"><h3>Selected scenario</h3><dl className="quote-details"><div><dt>Reference at exit</dt><dd>{result?money(result.exitReference):"—"}</dd></div><div><dt>Instrument at exit</dt><dd>{result?money(result.exitPrice):"—"}</dd></div><div><dt>Return on notional</dt><dd>{result?percent(result.returnOnNotionalPct):"—"}</dd></div></dl><p className="helper">Hypothetical outcomes in USDT. Return is on notional, not margin.</p></div>
        <details className="evidence-details"><summary>Sources & methodology <span>↗</span></summary><p>Market snapshot: Bitget public ticker API. Scenario results: Rift’s deterministic calculation engine.</p><a href="https://www.bitget.com/api-doc/uta/public/Tickers" target="_blank" rel="noreferrer">Bitget ticker documentation ↗</a><p>The map varies the reference price and exit premium. Its dashed line marks P&L equal to the negative loss budget. It is not a probability map.</p><p>Linear unit-price model, multiplier 1. Actual contract sizing needs verified instrument terms. No liquidation model is included.</p></details>
        <details className="evidence-module"><summary>Company context <span>Optional</span></summary><div className="evidence-module-body"><EquityEvidence key={symbol} symbol={symbol} onData={setEquity}/></div></details>
        <details className="evidence-module"><summary>Historical replay <span>Explore →</span></summary><div className="evidence-module-body"><HistoryEvidence key={symbol} symbol={symbol} direction={direction} onReplay={loadHistoricalCase}/></div></details>
      </aside>}
    </div>
    <footer className="workspace-footer"><span>RIFT / DECISION RESEARCH</span><span>Transparent assumptions. Human decisions.</span></footer>
    <div className="notice" role="status" aria-live="polite">{notice}</div>
  </main>;
}
