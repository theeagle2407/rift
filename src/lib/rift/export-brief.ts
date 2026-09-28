import type {ContractSnapshot,ContractCheck} from './contract-check';
import type {EquityPacket} from './equity-data';
import type {BreakPoints, Trade, Scenario, calculateStress} from './stress-engine';
import type {ResearchReport} from './research-contract';

export type Brief = {
  contractSnapshot?:ContractSnapshot|null; quantityCheck?:ContractCheck; feeSource?:string;
  thesisNeedsReview?:boolean;
  inputOrigin?:"synthetic"|"manual"|"snapshot"|"historical";
  stockEvidence?:EquityPacket|null;
  exportedAt:string; symbol:string; scope:string; context:string; thesis:string;
  trade:Trade; scenario:Scenario; result:ReturnType<typeof calculateStress>;
  breakPoints?:BreakPoints|null;
  aiResearch:ResearchReport|null; limitations:string[];
  comparison:unknown; quoteSnapshot:unknown; historicalEvidence:unknown;
};

type RecordValue=Record<string,unknown>;
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const number=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:4,signDisplay:'auto'}).format(n);
const money=(n:number)=>`${new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:4}).format(Math.abs(n)<0.00005?0:n)} USDT`;
const record=(value:unknown):RecordValue|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:null;
const finite=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value:null;
const date=(value:unknown):string|null=>{
  if(typeof value!=='string'&&typeof value!=='number')return null;
  const parsed=new Date(value); return Number.isFinite(parsed.getTime())?parsed.toISOString():null;
};
const rows=(items:[string,unknown][])=>items.map(([label,value])=>`<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
const list=(items:string[])=>`<ul>${items.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>`;
const optionalMoney=(value:unknown)=>{const n=finite(value);return n===null?'Unavailable':money(n);};
const signedPercent=(n:number)=>`${n>0?'+':''}${number(n)}%`;

function breakPointSection(points:BreakPoints|null|undefined,direction:Trade['direction']):string{
  if(!points)return '<h2>Break points</h2><p>Break-point calculations were not included.</p>';
  const relation=direction==='long'?'at least':'at most';
  const maximum=points.maxQuantityWithinBudget===null?'Not bounded by this selected scenario':points.maxQuantityWithinBudget<=0?'No positive size fits the entered budget':`${number(points.maxQuantityWithinBudget)} units`;
  return `<h2>Break points</h2><p class="muted">Approximate scenario boundaries. Displayed values are rounded; not trade recommendations.</p><table>${rows([
    ['Maximum quantity within loss budget',maximum],
    ['Break-even exit premium',points.breakEvenPremiumPct===null?'Unavailable':`${relation} approximately ${signedPercent(points.breakEvenPremiumPct)}`],
    ['Reference move at loss-budget edge',points.budgetBoundaryReferenceMovePct===null?'Unavailable':`${relation} approximately ${signedPercent(points.budgetBoundaryReferenceMovePct)}`],
  ])}</table><p class="muted">The maximum size uses the selected move, premium and entered costs. The reference boundary holds the selected exit premium constant. Liquidation and untested paths are not modelled.</p>`;
}

function comparisonSection(value:unknown):string{
  const item=record(value);
  if(!item)return '<h3>Pinned comparison</h3><p>No pinned comparison was included.</p>';
  const pnl=finite(item.netPnl);
  return `<h3>Pinned comparison</h3><table>${rows([
    ['Label',text(item.label)||'Pinned scenario'],
    ['Quantity',text(item.quantity)||finite(item.quantity)?.toString()||'Unavailable'],
    ['Net P&L',pnl===null?'Unavailable':money(pnl)],
  ])}</table>`;
}

function quoteSection(value:unknown,historical:boolean,origin:Brief["inputOrigin"]):string{
  const usage=historical?"Not used in this historical calculation.":origin==="synthetic"?"Not used in this synthetic calculation.":origin==="manual"?"Not used to populate the current manually entered prices.":origin==="snapshot"?"This snapshot supplied the entry price and exchange-index reference. Future moves and costs remain scenario assumptions.":"Retained market observation; its use in the scenario inputs is not recorded.";
  const quote=record(value);
  if(!quote)return '<h3>Bitget quote snapshot</h3><p>No quote snapshot was included.</p>';
  const stale=typeof quote.stale==='boolean'?(quote.stale?'Stale when captured':'Fresh when captured'):'Freshness not supplied';
  return `<h3>Bitget quote snapshot</h3><table>${rows([
    ['Source',text(quote.source)||'Bitget'],
    ['Instrument',text(quote.instrument)||'Unavailable'],
    ['Quoted at',date(quote.quotedAt)||'Unavailable'],
    ['Received at',date(quote.receivedAt)||'Unavailable'],
    ['Last price',optionalMoney(quote.lastPrice)],
    ['Bid / ask',`${optionalMoney(quote.bid)} / ${optionalMoney(quote.ask)}`],
    ['Exchange index',optionalMoney(quote.indexPrice)],
    ['Mark price',optionalMoney(quote.markPrice)],
    ['Funding rate',finite(quote.fundingRate)===null?'Unavailable':number(finite(quote.fundingRate)!*100)+'%'],
    ['Freshness',stale],
  ])}</table><p class="muted">${escapeHtml(usage)} Retained observation only. The exchange index is not an independently sourced underlying-stock quote.</p>`;
}

function historySection(value:unknown):string{
  const replay=record(value);
  if(!replay)return '<h3>Historical replay</h3><p>No historical replay was included.</p>';
  const observation=record(replay.observation);
  const evidence=record(replay.evidence);
  if(!observation&&!evidence)return '<h3>Historical replay</h3><p>No verifiable historical replay metadata was included.</p>';
  const sources=Array.isArray(evidence?.sources)?evidence.sources.filter((item):item is string=>typeof item==='string'&&item.trim().length>0):[];
  const points=Array.isArray(evidence?.points)?evidence.points.length:null;
  const observationRows:[string,unknown][]=observation?[
    ['Window start',date(observation.start)||'Unavailable'],
    ['Window end',date(observation.end)||'Unavailable'],
    ['Holding period',finite(observation.hours)===null?'Unavailable':`${number(finite(observation.hours)!)} hours`],
    ['Instrument entry / exit',`${optionalMoney(observation.entryPrice)} / ${optionalMoney(observation.exitPrice)}`],
    ['Index entry / exit',`${optionalMoney(observation.entryReference)} / ${optionalMoney(observation.exitReference)}`],
    ['Observed index move',finite(observation.referenceMovePct)===null?'Unavailable':`${number(finite(observation.referenceMovePct)!)}%`],
    ['Observed exit premium',finite(observation.exitPremiumPct)===null?'Unavailable':`${number(finite(observation.exitPremiumPct)!)}%`],
  ]:[];
  const provenanceRows:[string,unknown][]=evidence?[
    ['Fetched at',date(evidence.fetchedAt)||'Unavailable'],
    ['Data through',date(evidence.asOf)||'Unavailable'],
    ['Matched hourly closes',points===null?'Not supplied':number(points)],
    ['Source requests',sources.length||'Not supplied'],
  ]:[];
  return `<h3>Historical replay</h3>${observationRows.length?`<table>${rows(observationRows)}</table>`:'<p>Selected observation was not supplied.</p>'}${provenanceRows.length?`<h3>Historical provenance</h3><table>${rows(provenanceRows)}</table>`:''}${sources.length?`<p class="muted">Bitget source requests</p>${list(sources)}`:''}<p class="muted">Only the selected case and provenance are shown. The full candle series is intentionally omitted from this judge-facing brief.</p>`;
}

export function renderBrief(b:Brief):string {
 const t=b.trade,r=b.result,a=b.aiResearch;
 const zeroCosts=t.entryFeeBps===0&&t.exitFeeBps===0&&t.executionCost===0&&t.fundingCost===0;
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Rift decision brief · ${escapeHtml(b.symbol)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef2f2;color:#17262b;font:16px/1.65 system-ui,sans-serif}.paper{max-width:960px;margin:40px auto;padding:54px;background:white;border:1px solid #d6e0e1;border-radius:16px}header{border-bottom:2px solid #168b91;padding-bottom:24px}h1{font-size:34px;line-height:1.2;margin:12px 0}h2{font-size:21px;margin:32px 0 12px}h3{font-size:16px;margin:22px 0 8px}p{margin:10px 0;white-space:pre-wrap}.muted{color:#53666d;font-size:14px}.eyebrow{font-size:12px;letter-spacing:.16em;font-weight:700;color:#14767b}.result{background:#edf7f7;border-left:4px solid #168b91;padding:18px 24px;margin:24px 0}.result strong{font-size:30px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 0;border-bottom:1px solid #e4eaea;vertical-align:top}th{font-weight:500;width:60%;padding-right:24px}td{text-align:right;font-variant-numeric:tabular-nums}li{margin:8px 0;overflow-wrap:anywhere}.hint{font-size:13px;color:#53666d}@media(max-width:640px){.paper{margin:0;padding:24px;border:0;border-radius:0}h1{font-size:28px}}@media print{body{background:white}.paper{border:0;margin:0;max-width:none;padding:0}.hint{display:none}h2,h3{break-after:avoid}tr,.result{break-inside:avoid}}
</style></head><body><main class="paper"><header><div class="eyebrow">RIFT / DECISION BRIEF</div><h1>${escapeHtml(b.symbol)}</h1><p>${escapeHtml(b.scope)}</p><p class="muted">Exported ${escapeHtml(b.exportedAt)}<br>${escapeHtml(b.context)}</p><p class="hint">To save a PDF, use your browser’s Print command and choose Save as PDF.</p></header>
<section class="result"><div>Net scenario P&amp;L</div><strong>${escapeHtml(money(r.netPnl))}</strong><p>${r.budgetBreached?'Exceeds':'Within'} the entered loss budget of ${escapeHtml(money(t.lossBudget))}.</p><p class="muted">${r.netPnl>=0?'Loss budget used: '+escapeHtml(money(0))+' of '+escapeHtml(money(t.lossBudget)):r.budgetBreached?'Budget exceeded by '+escapeHtml(money(-r.budgetRemaining)):'Budget remaining: '+escapeHtml(money(r.budgetRemaining))}. Scenario result, not a forecast.</p></section>
<h2>Your thesis</h2>${b.thesisNeedsReview?'<p class="muted">Prices changed since this thesis was entered. Review the thesis against the current inputs.</p>':''}${b.historicalEvidence?'<p class="muted">User-entered thesis retained separately from the historical case. It may describe different assumptions; the inputs below determine this calculation.</p>':''}<p>${escapeHtml(b.thesis||'No thesis entered.')}</p>
${b.historicalEvidence?'<p class="muted">Loading a historical case resets fees, execution and funding to zero. Any costs shown below were entered separately after loading; they are not reconstructed historical costs.</p>':''}<h2>Inputs and assumptions</h2><table>${rows([['Direction',t.direction],['Quantity',`${number(t.quantity)} units`],['Multiplier',t.multiplier],['Entry price',money(t.entryPrice)],['Reference at entry',money(t.entryReference)],['Reference move',`${number(b.scenario.referenceMovePct)}%`],['Exit premium to reference',`${number(b.scenario.exitPremiumPct)}%`],['Entry fee assumption',`${number(t.entryFeeBps)} bps`],['Exit fee assumption',`${number(t.exitFeeBps)} bps`],['Execution cost assumption',money(t.executionCost)],['Net funding cost assumption',money(t.fundingCost)]])}</table><p class="muted">${zeroCosts?'No costs entered. This calculation excludes fees, execution costs and funding.':'Costs are entered assumptions. Positive net funding is a payment; negative net funding is a receipt.'}</p>
<p class="muted">${escapeHtml(b.feeSource||"Fee source not recorded.")}</p>
<h2>What drives the result</h2><table>${rows([['Reference movement',money(r.referenceContribution)],['Premium change',money(r.premiumContribution)],['Entry and exit fees',money(-r.entryFee-r.exitFee)],['Execution contribution',money(-t.executionCost)],['Funding contribution',money(-t.fundingCost)],['Net scenario P&L',money(r.netPnl)],['Return on entry notional',`${number(r.returnOnNotionalPct)}%`],['Reference at exit',money(r.exitReference)],['Instrument at exit',money(r.exitPrice)]])}</table><p class="muted">Return is on notional, not margin. Budget compliance applies only to this selected scenario.</p>
${breakPointSection(b.breakPoints,t.direction)}
<h2>Contract quantity checks</h2>${b.contractSnapshot?`<p class="muted">${escapeHtml(b.contractSnapshot.instrument.symbol)} · Catalogue captured ${escapeHtml(b.contractSnapshot.fetchedAt)}</p>`:''}<p>${escapeHtml(b.quantityCheck?.messages.join(' ')||'Contract quantity rules were not checked.')}</p><p class="muted">These checks do not validate an executable order. Quantity increment is not the P&amp;L multiplier. Liquidation, margin and account limits are not modelled.</p>
<h2>Underlying stock evidence</h2>${b.stockEvidence?`<p>${escapeHtml(b.stockEvidence.ticker)} · Retrieved ${escapeHtml(b.stockEvidence.retrievedAt)}</p><p>Separate observations; not synchronized with the contract and not used as scenario inputs.</p><table>${rows([['Stock observation',b.stockEvidence.quote?`${number(b.stockEvidence.quote.price)} ${b.stockEvidence.quote.currency||'(currency not supplied)'}`:'Unavailable'],['Quote observed at',b.stockEvidence.quote?.observedAt||'Unavailable'],['Quote provider',b.stockEvidence.quote?.provider||'Unavailable'],['Company',b.stockEvidence.profile?.name||'Unavailable'],['Next provider-reported earnings date',b.stockEvidence.earnings?.dates[0]||'No date available']])}</table><p class="muted">Earnings dates may change. Profile effective date is not supplied.</p>`:'<p>No separately loaded stock evidence is included.</p>'}
<h2>AI thesis review</h2>${a?`<p class="muted">${escapeHtml(a.model)} · ${escapeHtml(a.createdAt)} · AI interpretation; review against the evidence.</p><p>${escapeHtml(a.interpretation.summary)}</p><h3>Mechanism</h3><p>${escapeHtml(a.interpretation.mechanism)}</p><h3>Assumptions to inspect</h3>${list(a.interpretation.assumptions)}<h3>Questions worth answering</h3>${list(a.interpretation.questions)}<p class="muted">Proposed values require human review; they are not automatically applied.</p><table>${rows([['Proposed reference move',a.interpretation.proposal.referenceMovePct===null?'Not specified':a.interpretation.proposal.referenceMovePct+'%'],['Proposed exit premium',a.interpretation.proposal.exitPremiumPct===null?'Not specified':a.interpretation.proposal.exitPremiumPct+'%']])}</table><h3>Evidence supplied to the review</h3>${a.evidence.length?list(a.evidence.map(e=>`${e.id} · ${e.label}`)):'<p>No evidence records were supplied.</p>'}<p class="muted">The brief identifies the records used without repeating their raw payloads. Recomputed values appear above; market provenance appears below.</p>`:'<p>No AI review matching these exact inputs is included. Any outdated review has been omitted.</p>'}
<h2>Evidence and provenance</h2>${quoteSection(b.quoteSnapshot,!!b.historicalEvidence,b.inputOrigin)}${historySection(b.historicalEvidence)}${comparisonSection(b.comparison)}
<h2>Scope and limitations</h2>${list(b.limitations)}<p class="muted">Quote snapshots are retained observations and may be stale when this file is opened. The exchange index is not an independently sourced underlying-stock quote. Historical windows overlap and are not independent trials.</p>
</main></body></html>`;
}
