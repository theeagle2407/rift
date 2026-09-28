// Data contracts shared by the server adapter and the evidence display.
export const EQUITY_MAP: Record<string,string> = Object.fromEntries(
 ['NVDA','TSLA','AAPL','MSFT','AMZN','GOOGL','GOOG','META','AMD','NFLX','COIN','PLTR','MSTR','ORCL'].map(s=>[s+'USDT',s])
);
export type EquityPacket = {
 symbol:string; ticker:string; retrievedAt:string; source:string;
 quote:{price:number; observedAt:string; provider:string; currency:string|null}|null;
 profile:{name:string; exchange:string|null; industry:string|null; provider:string}|null;
 earnings:{dates:string[]; provider:string; start:string; end:string}|null;
 issues:string[];
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;
export function unwrapMcp(value:unknown):unknown {
 if(!object(value)||value.error||!object(value.result))throw new Error('Invalid MCP response.');
 const r=value.result;
 if(r.isError)throw new Error('Data tool reported an error.');
 if(r.structuredContent!==undefined)return r.structuredContent;
 if(Array.isArray(r.content))for(const c of r.content)if(object(c)&&c.type==='text'&&typeof c.text==='string')return JSON.parse(c.text);
 throw new Error('Missing tool result.');
}
export function parseRpc(text:string,id:number):unknown {
 const candidates:unknown[]=[];
 try{candidates.push(JSON.parse(text));}catch{
  for(const block of text.replace(/\r\n/g,'\n').split('\n\n')){
   const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
   if(data)try{candidates.push(JSON.parse(data));}catch{/* Ignore non-JSON events. */}
  }
 }
 const found=candidates.find(v=>object(v)&&v.id===id);
 if(!object(found)||found.error)throw new Error('The stock-data service returned an invalid response.');
 return found;
}
function rows(value:unknown){
 if(!object(value)||value.success!==true||value.status_code!==200||!object(value.data)||!Array.isArray(value.data.results))throw new Error('Stock data unavailable.');
 const provider=str(value.data.provider);if(!provider)throw new Error('Missing data provider.');
 return {values:value.data.results,provider};
}
export function normalizeQuote(value:unknown,ticker:string,now=Date.now()):NonNullable<EquityPacket['quote']>{
 const d=rows(value);const matches=d.values.filter(v=>object(v)&&v.symbol===ticker);
 if(matches.length!==1)throw new Error('Quote identity mismatch.');
 const q=matches[0] as Record<string,unknown>;
 if(typeof q.last_price!=='number'||!Number.isFinite(q.last_price)||q.last_price<=0)throw new Error('Invalid stock price.');
 const stamp=str(q.last_timestamp);const ms=stamp?Date.parse(stamp):NaN;
 if(!stamp||!/(Z|[+-]\d{2}:\d{2})$/.test(stamp)||!Number.isFinite(ms)||ms<=0||ms>now+60000)throw new Error('Missing or invalid quote observation time.');
 // The observed endpoint omits currency: do not silently label an unconfirmed value USD.
 return {price:q.last_price,observedAt:new Date(ms).toISOString(),provider:d.provider,currency:str(q.currency_code)||str(q.currency)};
}
export function normalizeProfile(value:unknown,ticker:string):NonNullable<EquityPacket['profile']>{
 const d=rows(value);const matches=d.values.filter(v=>object(v)&&v.symbol===ticker);
 if(matches.length!==1)throw new Error('Company identity mismatch.');
 const p=matches[0] as Record<string,unknown>;const name=str(p.legal_name)||str(p.name);if(!name)throw new Error('Missing company name.');
 return {name,exchange:str(p.listed_board_name)||str(p.stock_exchange),industry:str(p.industry_name),provider:d.provider};
}
export function normalizeEarnings(value:unknown,ticker:string,start:string,end:string):NonNullable<EquityPacket['earnings']>{
 const d=rows(value);const dates:string[]=[];
 for(const r of d.values){
  if(!object(r)||r.symbol!==ticker)throw new Error('Earnings identity mismatch.');
  const date=str(r.report_date);
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Invalid earnings date.');
  if(date>=start&&date<=end)dates.push(date);
 }
 return {dates:[...new Set(dates)].sort(),provider:d.provider,start,end};
}
