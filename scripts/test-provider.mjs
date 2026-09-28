import assert from 'node:assert/strict';
import {providerRequest} from '../src/lib/rift/provider-request.ts';
const tests=[];const test=(name,run)=>tests.push({name,run});
async function run(statuses,extra={}){let calls=0;const delays=[];const result=await providerRequest('https://example.invalid',{method:'POST'},{signal:new AbortController().signal,deadline:55000,now:()=>0,wait:async ms=>{delays.push(ms);},fetcher:async()=>{const status=statuses[Math.min(calls++,statuses.length-1)];return new Response(JSON.stringify({ok:true}),{status,...extra});}});return {result,calls,delays};}
test('503 retries once and recovers',async()=>{const x=await run([503,200]);assert.equal(x.calls,2);assert.deepEqual(x.result.body,{ok:true});});
test('Persistent service failure stops after two attempts',async()=>{const x=await run([503]);assert.equal(x.calls,2);assert.equal(x.result.status,503);});
test('Access, quota and model errors are never retried',async()=>{for(const status of [400,401,403,404,429])assert.equal((await run([status])).calls,1);});
test('Provider retry delay is respected',async()=>assert.deepEqual((await run([503,200],{headers:{'retry-after':'3'}})).delays,[3000]));
test('Long backoff returns error without bypassing delay',async()=>assert.equal((await run([503],{headers:{'retry-after':'120'}})).calls,1));
test('Ambiguous network failures are not repeated',async()=>{let calls=0;await assert.rejects(providerRequest('https://example.invalid',{}, {signal:new AbortController().signal,deadline:55000,now:()=>0,fetcher:async()=>{calls++;throw new TypeError('fetch failed');}}));assert.equal(calls,1);});
test('Cancellation prevents the next attempt',async()=>{const c=new AbortController();let calls=0;await assert.rejects(providerRequest('https://example.invalid',{}, {signal:c.signal,deadline:55000,now:()=>0,fetcher:async()=>{calls++;return new Response('',{status:503});},wait:async()=>c.abort()}));assert.equal(calls,1);});
test('Expired deadline makes no request',async()=>{let calls=0;await assert.rejects(providerRequest('https://example.invalid',{}, {signal:new AbortController().signal,deadline:0,now:()=>1,fetcher:async()=>{calls++;return Response.json({});}}));assert.equal(calls,0);});
test('Malformed successful response is not retried',async()=>{let calls=0;await assert.rejects(providerRequest('https://example.invalid',{}, {signal:new AbortController().signal,deadline:55000,now:()=>0,fetcher:async()=>{calls++;return new Response('{');}}));assert.equal(calls,1);});
test('Quota response preserves cooldown without retry',async()=>{const x=await run([429],{headers:{'retry-after':'45'}});assert.equal(x.calls,1);assert.equal(x.result.retryAfterSeconds,45);});
test('Google retry details preserve fractional delay',async()=>{const x=await providerRequest('https://example.invalid',{}, {signal:new AbortController().signal,deadline:55000,now:()=>0,fetcher:async()=>Response.json({error:{details:[{retryDelay:'29.731s'}]}},{status:429})});assert.equal(x.retryAfterSeconds,30);});
for(const {name,run} of tests){await run();console.log('PASS '+name);}console.log(`${tests.length} reliability tests passed. No network or keys.`);
