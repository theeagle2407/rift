export type ContractTerms = Partial<Record<'minOrderQty'|'quantityMultiplier'|'minOrderAmount'|'makerFeeRate'|'takerFeeRate'|'fundInterval',string>>;
export type Instrument = {symbol:string; baseCoin:string; name:string; terms?:ContractTerms};
function parseTerms(row:Record<string,unknown>):ContractTerms {
 const terms:ContractTerms={};
 for(const key of ['minOrderQty','quantityMultiplier','minOrderAmount','makerFeeRate','takerFeeRate','fundInterval'] as const){
  const value=row[key];
  if(typeof value==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)&&value.length<=40&&Number.isFinite(Number(value)))terms[key]=value;
 }
 return terms;
}
export type Catalogue = {instruments:Instrument[]; fetchedAt:string; source:string};
export const CATALOGUE_URL='https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES';
// Display aliases only. Membership always comes from Bitget, never this map.
const names:Record<string,string>={NVDA:'NVIDIA',TSLA:'Tesla',AAPL:'Apple',MSFT:'Microsoft',AMZN:'Amazon',GOOGL:'Alphabet',META:'Meta',COIN:'Coinbase',HOOD:'Robinhood',NFLX:'Netflix',AMD:'AMD',INTC:'Intel',ORCL:'Oracle',PLTR:'Palantir',BABA:'Alibaba'};
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export function parseInstruments(payload:unknown):Instrument[]{
 if(!object(payload)||payload.code!=='00000'||!Array.isArray(payload.data))throw new Error('Invalid instrument catalogue.');
 const found=new Map<string,Instrument>();
 for(const row of payload.data){
  if(!object(row))throw new Error('Malformed instrument record.');
  if(row.symbolType!=='stock'||row.category!=='USDT-FUTURES'||row.quoteCoin!=='USDT'||row.type!=='perpetual'||row.status!=='online')continue;
  if(typeof row.symbol!=='string'||!validSymbol(row.symbol)||typeof row.baseCoin!=='string'||!row.baseCoin||row.baseCoin.length>40)throw new Error('Malformed stock instrument.');
  if(found.has(row.symbol))throw new Error('Duplicate stock instrument.');
  found.set(row.symbol,{symbol:row.symbol,baseCoin:row.baseCoin,name:names[row.baseCoin]??row.baseCoin,terms:parseTerms(row)});
 }
 if(!found.size)throw new Error('Bitget returned no identifiable online stock perpetuals.');
 return [...found.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
}
export function validSymbol(value:unknown):value is string{return typeof value==='string'&&/^[A-Z0-9]{1,36}USDT$/.test(value);}
export function searchInstruments(items:Instrument[],query:string){const q=query.trim().toLowerCase();return items.filter(i=>`${i.symbol} ${i.baseCoin} ${i.name}`.toLowerCase().includes(q));}
export function createCatalogueLoader(provider:typeof fetch=fetch,clock:()=>number=Date.now){
 let cached:Catalogue|undefined;let expires=0;let pending:Promise<Catalogue>|undefined;
 return async function load():Promise<Catalogue>{
  if(cached&&clock()<expires)return cached;
  if(pending)return pending;
  pending=(async()=>{
   const response=await provider(CATALOGUE_URL,{cache:'no-store',signal:AbortSignal.timeout(10_000)});
   if(!response.ok)throw new Error('Bitget instrument catalogue unavailable. Retry shortly.');
   const instruments=parseInstruments(await response.json());
   cached={instruments,fetchedAt:new Date(clock()).toISOString(),source:CATALOGUE_URL};expires=clock()+60_000;return cached;
  })();
  try{return await pending;}finally{pending=undefined;}
 };
}
export const getCatalogue=createCatalogueLoader();
export async function findInstrument(symbol:string){return (await getCatalogue()).instruments.find(i=>i.symbol===symbol);}
