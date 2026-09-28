import assert from 'node:assert/strict';
import {renderBrief} from '../src/lib/rift/export-brief.ts';
import {calculateBreakPoints,calculateStress} from '../src/lib/rift/stress-engine.ts';
const trade={direction:'long',quantity:10,multiplier:1,entryPrice:104,entryReference:100,lossBudget:25,entryFeeBps:0,exitFeeBps:0,executionCost:0,fundingCost:0};
const scenario={referenceMovePct:2,exitPremiumPct:0};
const base={exportedAt:'2026-09-16T00:00:00Z',symbol:'NVDAUSDT',scope:'Hypothetical',context:'Synthetic example',thesis:'<script>alert(1)</script>',trade,scenario,result:calculateStress(trade,scenario),breakPoints:calculateBreakPoints(trade,scenario),aiResearch:null,limitations:['Test scope'],comparison:null,quoteSnapshot:null,historicalEvidence:null};
const html=renderBrief(base);
assert(html.includes('-20.00 USDT'));assert(html.includes('Budget remaining: 5.00 USDT'));
console.log('PASS Brief preserves scenario result and budget');
assert(html.includes('Maximum quantity within loss budget'));assert(html.includes('12.5 units'));assert(html.includes('at least approximately +1.9608%'));assert(html.includes('at least approximately +1.5%'));
console.log('PASS Break-point limits are included and direction-aware');
assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes("default-src 'none'"));
console.log('PASS User text is escaped and active content blocked');
assert(html.includes('No costs entered'));assert(html.includes('No AI review matching these exact inputs'));
console.log('PASS Missing costs and absent current review are explicit');
const report={ok:true,model:'test-model',createdAt:base.exportedAt,durationMs:1,usage:null,evidence:[{id:'C1',label:'Calculation',content:base.result}],interpretation:{summary:'review-marker',mechanism:'Mechanism',assumptions:[],questions:[],evidenceIds:['C1'],proposal:{referenceMovePct:null,exitPremiumPct:0}}};
const reviewHtml=renderBrief({...base,aiResearch:report});
assert(reviewHtml.includes('review-marker'));assert(reviewHtml.includes('Not specified'));assert(reviewHtml.includes('C1 · Calculation'));assert(!reviewHtml.includes('&quot;grossPnl&quot;'));
console.log('PASS Current review and nullable proposals are exported');
const bigger={...trade,quantity:20};const loss=renderBrief({...base,trade:bigger,result:calculateStress(bigger,scenario)});
assert(loss.includes('Budget exceeded by 15.00 USDT'));
console.log('PASS Budget breach is reported correctly');
const stockEvidence={symbol:'NVDAUSDT',ticker:'NVDA',retrievedAt:base.exportedAt,source:'https://agent.bitget.com/mcp',quote:{price:200,observedAt:base.exportedAt,provider:'fixture-provider',currency:null},profile:{name:'<script>stock</script>',exchange:null,industry:null,provider:'fixture'},earnings:null,issues:[]};
const stockHtml=renderBrief({...base,stockEvidence});assert(stockHtml.includes('currency not supplied'));assert(stockHtml.includes('fixture-provider'));assert(!stockHtml.includes('<script>'));assert(stockHtml.includes('No date available'));
console.log('PASS Stock evidence exports provenance, unknown currency and escaped text');
assert(html.includes('No pinned comparison was included.'));assert(html.includes('No quote snapshot was included.'));assert(html.includes('No historical replay was included.'));
console.log('PASS Missing optional evidence is described accurately');
const quoteSnapshot={source:'Bitget',instrument:'NVDAUSDT',lastPrice:219.78,bid:219.77,ask:219.79,indexPrice:219.6,markPrice:219.78,fundingRate:0.0003,quotedAt:base.exportedAt,receivedAt:base.exportedAt,stale:false};
const historicalEvidence={observation:{start:1789038000000,end:1789059600000,hours:6,entryPrice:223.03,exitPrice:218.93,entryReference:223.1,exitReference:218.85,referenceMovePct:-1.9,exitPremiumPct:0.04},evidence:{fetchedAt:base.exportedAt,asOf:base.exportedAt,sources:['https://api.bitget.com/market','<script>source</script>'],points:Array.from({length:200},(_,i)=>({timestamp:i,market:i,index:i}))}};
const evidenceHtml=renderBrief({...base,quoteSnapshot,historicalEvidence,comparison:{label:'Smaller size',quantity:'5',netPnl:-10}});
assert(evidenceHtml.includes('Fresh when captured'));assert(evidenceHtml.includes('Matched hourly closes'));assert(evidenceHtml.includes('200'));assert(evidenceHtml.includes('Smaller size'));assert(evidenceHtml.includes('-10.00 USDT'));
assert(!evidenceHtml.includes('&quot;points&quot;'));assert(!evidenceHtml.includes('Complete calculation and evidence record'));assert(!evidenceHtml.includes('<pre>'));assert(!evidenceHtml.includes('<script>source</script>'));assert(evidenceHtml.length<25000);
console.log('PASS Judge-facing evidence is concise, conditional and escaped');

assert(!html.includes("-0.00 USDT"));
assert(evidenceHtml.includes("Not used in this historical calculation"));
assert(evidenceHtml.includes("User-entered thesis retained separately"));
assert(evidenceHtml.includes("resets fees, execution and funding to zero"));
assert(html.includes("Approximate scenario boundaries"));
console.log("PASS Historical context, rounding and zero formatting are explicit");

for (const [inputOrigin, expected] of [
 ['synthetic','Not used in this synthetic calculation.'],
 ['manual','Not used to populate the current manually entered prices.'],
 ['snapshot','This snapshot supplied the entry price and exchange-index reference.'],
 [undefined,'its use in the scenario inputs is not recorded.'],
]) {
 const exported=renderBrief({...base,quoteSnapshot,inputOrigin});
 assert(exported.includes(expected));
}
console.log('PASS Quote usage distinguishes synthetic, manual, applied and unrecorded provenance');

for(const referenceMovePct of [4,6]) {
 const scenario={referenceMovePct,exitPremiumPct:0};
 const exported=renderBrief({...base,scenario,result:calculateStress(trade,scenario)});
 assert(exported.includes('Loss budget used: 0.00 USDT of 25.00 USDT'));
 assert(!exported.includes('Budget remaining:'));
}
assert(renderBrief({...base,thesisNeedsReview:true}).includes('Prices changed since this thesis was entered.'));
assert(!html.includes('Prices changed since this thesis was entered.'));
console.log('PASS Profitable and flat scenarios use no loss budget; thesis review flag is explicit');

const withContract=renderBrief({...base,feeSource:'Published fee assumption',quantityCheck:{status:'mismatch',messages:['Quantity must be a multiple of 0.01.']}});
assert(withContract.includes('Published fee assumption'));
assert(withContract.includes('Quantity must be a multiple of 0.01.'));
assert(withContract.includes('Liquidation, margin and account limits are not modelled.'));
const flatCosts={...trade,entryPrice:100,executionCost:30};
assert.equal(calculateBreakPoints(flatCosts,{referenceMovePct:0,exitPremiumPct:0}).maxQuantityWithinBudget,0);
console.log('PASS Fee provenance, quantity findings and fixed-cost-only budget breach');
