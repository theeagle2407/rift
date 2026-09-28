import {getCatalogue} from '@/lib/rift/instruments';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{return Response.json({ok:true,...await getCatalogue()},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({ok:false,error:'Could not load Bitget’s market catalogue. Retry when your connection is available.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
