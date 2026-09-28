import {EQUITY_MAP} from '@/lib/rift/equity-data';
import {getEquity} from '@/lib/rift/equity-service';
import {findInstrument,validSymbol} from '@/lib/rift/instruments';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=45;
export async function GET(request:Request){
 const symbol=new URL(request.url).searchParams.get('symbol');
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!validSymbol(symbol)||!EQUITY_MAP[symbol])return reply({ok:false,error:'Underlying mapping is not yet verified for this contract. Contract quotes and stress tests remain available.'},400);
 try{
  if(!await findInstrument(symbol))return reply({ok:false,error:'This contract is not currently available.'},400);
  return reply({ok:true,packet:await getEquity(symbol)});
 }catch(e){return reply({ok:false,error:e instanceof Error&&e.name==='TimeoutError'?'Stock-data request timed out. Please retry.':e instanceof TypeError?'Company data unavailable: the research service could not be reached. Quotes, historical replay and calculations remain available.':e instanceof Error?e.message:'Stock evidence unavailable.'},502);}
}
