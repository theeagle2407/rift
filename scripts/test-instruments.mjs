import assert from 'node:assert/strict';
import {parseInstruments,searchInstruments,createCatalogueLoader,validSymbol} from '../src/lib/rift/instruments.ts';
const stock={symbol:'NVDAUSDT',baseCoin:'NVDA',category:'USDT-FUTURES',quoteCoin:'USDT',symbolType:'stock',type:'perpetual',status:'online'};
const packet=(...data)=>({code:'00000',data});
const tests=[];const test=(name,run)=>tests.push({name,run});
test('Only online stock-category USDT perpetuals are included',()=>{
 const rows=[stock,...[{symbolType:'crypto'},{symbolType:'metal'},{status:'offline'},{status:'listed'},{type:'delivery'},{category:'SPOT'},{quoteCoin:'USDC'},{symbolType:undefined}].map((x,i)=>({...stock,symbol:`X${i}USDT`,...x}))];
 assert.deepEqual(parseInstruments(packet(...rows)).map(i=>i.symbol),['NVDAUSDT']);
});
test('New stock symbols require no hardcoded membership',()=>assert.equal(parseInstruments(packet({...stock,symbol:'NEWUSDT',baseCoin:'NEW'}))[0].name,'NEW'));
test('Search supports company names and exact tickers',()=>{const a=parseInstruments(packet(stock));assert.equal(searchInstruments(a,'nvidia').length,1);assert.equal(searchInstruments(a,'nvdausdt').length,1);assert.equal(searchInstruments(a,'tesla').length,0);});
test('Bad envelopes, empty catalogues and duplicate symbols fail',()=>{for(const p of [{},packet(),packet(stock,stock),packet({...stock,symbol:'../NVDA'})])assert.throws(()=>parseInstruments(p));});
test('Symbol validation rejects paths and oversized strings',()=>{assert.equal(validSymbol('NVDAUSDT'),true);for(const v of ['../NVDAUSDT','',null,'X'.repeat(99)+'USDT'])assert.equal(validSymbol(v),false);});
test('Concurrent requests share a fetch and cache expires',async()=>{
 let calls=0,now=1000;const load=createCatalogueLoader(async()=>{calls++;return Response.json(packet(stock));},()=>now);
 await Promise.all([load(),load(),load()]);assert.equal(calls,1);await load();assert.equal(calls,1);now+=60001;await load();assert.equal(calls,2);
});
test('Expired data is never silently served when provider fails',async()=>{
 let now=1000,fail=false;const load=createCatalogueLoader(async()=>{if(fail)throw Error('offline');return Response.json(packet(stock));},()=>now);
 await load();now+=60001;fail=true;await assert.rejects(load());fail=false;assert.equal((await load()).instruments.length,1);
});
test('Contract terms retain exact decimals without inventing missing values',()=>{
 const i=parseInstruments(packet({...stock,minOrderQty:'0.01',quantityMultiplier:'0.01',minOrderAmount:'5',makerFeeRate:'0.0002',takerFeeRate:'0.0006',fundInterval:'8'}))[0];
 assert.equal(i.terms.quantityMultiplier,'0.01');assert.equal(i.terms.takerFeeRate,'0.0006');
 assert.deepEqual(parseInstruments(packet(stock))[0].terms,{});
 const bad=parseInstruments(packet({...stock,minOrderQty:'',quantityMultiplier:'-1',makerFeeRate:'NaN'}))[0];assert.deepEqual(bad.terms,{});
});
for(const {name,run} of tests){await run();console.log('PASS '+name);}console.log(`${tests.length} catalogue tests passed. Synthetic fixtures; no network or keys.`);
