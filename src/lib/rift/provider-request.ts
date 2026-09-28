// Retry only explicit transient server errors, never ambiguous network failures.
export async function providerRequest(url:string,init:RequestInit,options:{signal:AbortSignal;deadline:number;fetcher?:typeof fetch;wait?:(ms:number,signal:AbortSignal)=>Promise<void>;now?:()=>number}){
 const fetcher=options.fetcher??fetch,now=options.now??Date.now;
 const wait=options.wait??((ms,signal)=>new Promise<void>((resolve,reject)=>{
  signal.throwIfAborted();const stop=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);
  signal.addEventListener('abort',stop,{once:true});
 }));
 for(let attempt=0;attempt<2;attempt++){
  options.signal.throwIfAborted();
  const remaining=options.deadline-now();if(remaining<=0)throw new DOMException('Review timed out.','TimeoutError');
  const signal=AbortSignal.any([options.signal,AbortSignal.timeout(Math.ceil(remaining))]);
  const response=await fetcher(url,{...init,signal});
  if(attempt===0&&[500,502,503,504].includes(response.status)){
   const retryAfter=response.headers.get('retry-after');
   const seconds=retryAfter===null?NaN:Number(retryAfter);
   const delay=retryAfter===null?1000:Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(retryAfter)-now());
   // A long provider backoff is returned to the user, never bypassed.
   if(Number.isFinite(delay)&&delay<=5000&&options.deadline-now()>delay+5000){
    await response.body?.cancel();await wait(delay,signal);continue;
   }
  }
  if(!response.ok){
   const header=response.headers.get('retry-after');
   let retryAfterSeconds=header===null?0:Number.isFinite(Number(header))?Math.max(0,Number(header)):Math.max(0,(Date.parse(header)-now())/1000);
   const errorBody:unknown=await response.json().catch(()=>null);
   const details=(errorBody as {error?:{details?:{retryDelay?:unknown}[]}}|null)?.error?.details;
   if(Array.isArray(details))for(const detail of details){
    if(detail&&typeof detail.retryDelay==='string'&&/^\d+(\.\d+)?s$/.test(detail.retryDelay))retryAfterSeconds=Math.max(retryAfterSeconds||0,parseFloat(detail.retryDelay));
   }
   return {status:response.status,body:null,attempts:attempt+1,retryAfterSeconds:Number.isFinite(retryAfterSeconds)?Math.ceil(retryAfterSeconds):0};
  }
  const body:unknown=await response.json(); // Read under the same deadline as headers.
  return {status:response.status,body,attempts:attempt+1};
 }
 throw new Error('Provider request did not complete.');
}
