import {EQUITY_MAP,parseRpc,unwrapMcp,normalizeQuote,normalizeProfile,normalizeEarnings,type EquityPacket} from './equity-data';
const ENDPOINT='https://agent.bitget.com/mcp';
const TTL=5*60*1000;
const cache=new Map<string,EquityPacket>();
const pending=new Map<string,Promise<EquityPacket>>();
export function cachedEquity(symbol:string,retrievedAt:unknown):EquityPacket|null{
 const p=cache.get(symbol);
 return p&&p.retrievedAt===retrievedAt&&Date.now()-Date.parse(p.retrievedAt)<TTL?p:null;
}
async function retrieve(symbol:string):Promise<EquityPacket>{
 const ticker=EQUITY_MAP[symbol];if(!ticker)throw new Error('Underlying mapping is not yet verified for this contract.');
 const signal=AbortSignal.timeout(25000);let session='';let serial=0;
 async function rpc(method:string,params:unknown,notification=false){
  const id=++serial;
  const response=await fetch(ENDPOINT,{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session,'MCP-Protocol-Version':'2024-11-05'}:{})},body:JSON.stringify({jsonrpc:'2.0',...(!notification?{id}:{}),method,params})});
  if(!response.ok)throw new Error(`Stock-data service unavailable (HTTP ${response.status}).`);
  if(method==='initialize')session=response.headers.get('mcp-session-id')||'';
  if(notification){await response.body?.cancel();return null;}
  const text=await response.text();if(text.length>1500000)throw new Error('Stock-data response too large.');
  return parseRpc(text,id);
 }
 await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'rift',version:'batch-10'}});
 await rpc('notifications/initialized',{},true);
 const start=new Date().toISOString().slice(0,10),end=new Date(Date.now()+90*86400000).toISOString().slice(0,10);
 const query=async(entry_id:string,params:Record<string,string>)=>unwrapMcp(await rpc('tools/call',{name:'do_query',arguments:{entry_id,params}}));
 const results=await Promise.allSettled([
  query('equity_price_quote',{symbol:ticker}).then(v=>normalizeQuote(v,ticker)),
  query('equity_profile',{symbol:ticker}).then(v=>normalizeProfile(v,ticker)),
  query('equity_calendar_earnings',{symbol:ticker,start_date:start,end_date:end}).then(v=>normalizeEarnings(v,ticker,start,end))
 ]);
 const [quote,profile,earnings]=results;
 const packet:EquityPacket={symbol,ticker,retrievedAt:new Date().toISOString(),source:ENDPOINT,
  quote:quote.status==='fulfilled'?quote.value:null,profile:profile.status==='fulfilled'?profile.value:null,earnings:earnings.status==='fulfilled'?earnings.value:null,
  issues:results.flatMap((r,i)=>r.status==='rejected'?[['Stock quote unavailable or failed validation.','Company profile unavailable or failed validation.','Earnings calendar unavailable or failed validation.'][i]]:[])};
 if(!packet.quote&&!packet.profile&&!packet.earnings)throw new Error('The stock-data service returned no usable evidence. Try again shortly.');
 return packet;
}
export async function getEquity(symbol:string):Promise<EquityPacket>{
 const saved=cache.get(symbol);if(saved&&Date.now()-Date.parse(saved.retrievedAt)<TTL)return saved;
 const active=pending.get(symbol);if(active)return active;
 const task=retrieve(symbol).then(p=>{if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(symbol,p);return p;}).finally(()=>pending.delete(symbol));
 pending.set(symbol,task);return task;
}
