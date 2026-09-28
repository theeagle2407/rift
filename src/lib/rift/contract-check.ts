import type {Instrument} from './instruments';
export type ContractSnapshot={instrument:Instrument;fetchedAt:string;source:string};
export type ContractCheck={status:'unavailable'|'stale'|'mismatch'|'checked';messages:string[]};
// Exact decimal arithmetic for order increments: no floating-point modulo.
function decimal(value:string):{n:bigint;scale:number}|null{
 if(!/^\d+(?:\.\d+)?$/.test(value)||value.length>60)return null;
 const [whole,fraction='']=value.split('.');return {n:BigInt(whole+fraction),scale:fraction.length};
}
export function matchesIncrement(quantity:string,increment:string):boolean|null{
 const q=decimal(quantity),s=decimal(increment);if(!q||!s||s.n<=BigInt(0))return null;
 return (q.n*BigInt(10)**BigInt(s.scale))%(s.n*BigInt(10)**BigInt(q.scale))===BigInt(0);
}
export function contractCheck(snapshot:ContractSnapshot|null,symbol:string,quantity:string,entryPrice:string,now:number):ContractCheck{
 if(!snapshot||snapshot.instrument.symbol!==symbol)return {status:'unavailable',messages:['Contract quantity rules are unavailable.']};
 const age=now-Date.parse(snapshot.fetchedAt);
 if(!Number.isFinite(age)||age<0||age>300000)return {status:'stale',messages:['Refresh market list to check current quantity rules.']};
 const t=snapshot.instrument.terms,q=decimal(quantity),p=decimal(entryPrice);
 if(!t||!q||q.n<=BigInt(0)||!p||p.n<=BigInt(0))return {status:'unavailable',messages:['Enter positive decimal prices and quantity to check order constraints.']};
 const messages:string[]=[];let missing=false;
 const minimum=t.minOrderQty?decimal(t.minOrderQty):null;
 if(!minimum)missing=true;
 else if(q.n*BigInt(10)**BigInt(minimum.scale)<minimum.n*BigInt(10)**BigInt(q.scale))messages.push(`Quantity is below the published minimum of ${t.minOrderQty} ${snapshot.instrument.baseCoin}.`);
 const aligned=t.quantityMultiplier?matchesIncrement(quantity,t.quantityMultiplier):null;
 if(aligned===null)missing=true;else if(!aligned)messages.push(`Quantity must be a multiple of ${t.quantityMultiplier} ${snapshot.instrument.baseCoin}.`);
 const amount=t.minOrderAmount?decimal(t.minOrderAmount):null;
 if(!amount)missing=true;
 else if(q.n*p.n*BigInt(10)**BigInt(amount.scale)<amount.n*BigInt(10)**BigInt(q.scale+p.scale))messages.push(`Entry quantity × price is below the published minimum value of ${t.minOrderAmount} USDT.`);
 if(messages.length)return {status:'mismatch',messages};
 if(missing)return {status:'unavailable',messages:['Some published quantity rules are missing; a complete check is unavailable.']};
 return {status:'checked',messages:['Minimum quantity, quantity increment and minimum entry value checked. Other order and account limits are not checked.']};
}
