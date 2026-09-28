import {findInstrument,validSymbol} from '@/lib/rift/instruments';
import {parseCloses,pairCloses,HOUR} from '@/lib/rift/history';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request: Request) {
  const symbol=(new URL(request.url).searchParams.get('symbol')??'NVDAUSDT').toUpperCase();
  if (!validSymbol(symbol)) return Response.json({ok:false,error:'Unsupported instrument.'},{status:400});
  try { if (!await findInstrument(symbol)) return Response.json({ok:false,error:'This market is not an online stock-category USDT perpetual.'},{status:400}); }
  catch { return Response.json({ok:false,error:'Could not verify the market catalogue. Retry shortly.'},{status:502}); }
  const asOf=Math.floor(Date.now()/HOUR)*HOUR;
  const sources=['market','index'].map(type=>{
    const url=new URL('https://api.bitget.com/api/v3/market/candles');
    url.search=new URLSearchParams({category:'USDT-FUTURES',symbol,interval:'1H',limit:'200',type,
      startTime:String(asOf-200*HOUR),endTime:String(asOf-1)}).toString();
    return url.toString();
  });
  try {
    const results=await Promise.all(sources.map(async url=>{
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15_000)});
      if (!response.ok) throw new Error(`History provider returned HTTP ${response.status}.`);
      const data=await response.json();
      if (data.code!=='00000') throw new Error('History provider did not return valid data.');
      const parsed=parseCloses(data.data,asOf);
      return {...parsed,closes:parsed.closes.filter(p=>p.timestamp>=asOf-200*HOUR)};
    }));
    const paired=pairCloses(results[0].closes,results[1].closes);
    if (paired.points.length<7) throw new Error('Not enough matched historical prices for a six-hour case.');
    return Response.json({ok:true,symbol,fetchedAt:new Date().toISOString(),asOf:new Date(asOf).toISOString(),sources,
      ...paired,excludedRows:results[0].excluded+results[1].excluded},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({ok:false,error:error instanceof Error && error.name==='TimeoutError'
      ? 'Historical data timed out. Retry when the connection is available.'
      : error instanceof Error ? error.message : 'Historical data unavailable.'},{status:502,headers:{'Cache-Control':'no-store'}});
  }
}
