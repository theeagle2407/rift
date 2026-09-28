/** Small process-local cache. Expiration is fixed at creation, never extended by reads. */
export function timedCache<T>(ttlMs:number,limit:number,now:()=>number=Date.now){
 const entries=new Map<string,{value:T;expires:number}>();
 return {
  get(key:string):T|undefined{const entry=entries.get(key);if(!entry)return;if(now()>=entry.expires){entries.delete(key);return;}return entry.value;},
  set(key:string,value:T){for(const [k,v] of entries)if(now()>=v.expires)entries.delete(k);entries.delete(key);if(entries.size>=limit)entries.delete(entries.keys().next().value!);entries.set(key,{value,expires:now()+ttlMs});}
 };
}
export function plainReviewText(text:string):string{
 return text.replace(/\bC1\b/g,'the scenario calculation').replace(/\bT1\b/g,'your inputs').replace(/\bH1\b/g,'the historical sample').replace(/\bS1\b/g,'the company evidence').replace(/\bexitPremiumPct\b/g,'exit premium').replace(/\breferenceMovePct\b/g,'reference move');
}
