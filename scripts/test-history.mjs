import assert from 'node:assert/strict';
import {parseCloses,pairCloses,historyCases,HOUR} from '../src/lib/rift/history.ts';
import {calculateStress} from '../src/lib/rift/stress-engine.ts';
const base=1700002800000; // exact UTC hour
const aligned=Math.floor(base/HOUR)*HOUR;
let count=0;
function test(name,f){f();count++;console.log('PASS '+name);}
const row=(t,p)=>[String(t),String(p),String(p),String(p),String(p),'0','0'];
test('Unclosed bars are excluded',()=>assert.equal(parseCloses([row(aligned,100),row(aligned+HOUR,101)],aligned+HOUR).closes.length,1));
test('Conflicting duplicate closes fail',()=>assert.throws(()=>parseCloses([row(aligned,100),row(aligned,101)],aligned+HOUR)));
test('Malformed prices fail instead of becoming zero',()=>assert.throws(()=>parseCloses([[aligned,'','','','']],aligned+HOUR)));
test('Pairing uses identical timestamps',()=>assert.deepEqual(pairCloses([{timestamp:aligned,close:100}],[{timestamp:aligned+HOUR,close:101}]),{points:[],unmatched:2}));
const points=Array.from({length:30},(_,i)=>({timestamp:aligned+i*HOUR,market:104-i/3,index:100+i/3}));
test('Six-hour windows use close timestamps',()=>{const c=historyCases(points,6);assert.equal(c.length,24);assert.equal(c[0].start,aligned+HOUR);assert.equal(c[0].end,aligned+7*HOUR);});
test('Missing hours cannot become shorter holding periods',()=>assert.equal(historyCases(points.slice(0,8).filter((_,i)=>i!==3),6).length,0));
test('Replay reproduces actual price differences for both directions',()=>{for(const direction of ['long','short']){const c=historyCases(points,6)[0];const t={direction,quantity:10,multiplier:1,entryPrice:c.entryPrice,entryReference:c.entryReference,lossBudget:25,entryFeeBps:0,exitFeeBps:0,executionCost:0,fundingCost:0};const r=calculateStress(t,c);assert.ok(Math.abs(r.netPnl-(direction==='long'?1:-1)*10*(c.exitPrice-c.entryPrice))<1e-8);assert.ok(Math.abs(r.exitPrice-c.exitPrice)<1e-8);}});
test('Unsupported horizons fail',()=>assert.throws(()=>historyCases(points,5)));
console.log(`${count} historical-data tests passed. Synthetic fixtures; no network or keys.`);
