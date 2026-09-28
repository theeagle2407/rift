"use client";
import {useEffect,useId,useRef,useState} from 'react';
import type {ContractSnapshot} from '@/lib/rift/contract-check';
import {searchInstruments,type Instrument} from '@/lib/rift/instruments';
export default function MarketSelector({symbol,onChange,onSnapshot}:{symbol:string;onChange:(symbol:string)=>void;onSnapshot:(value:ContractSnapshot|null)=>void}){
 const [items,setItems]=useState<Instrument[]>([]),[query,setQuery]=useState(''),[error,setError]=useState('');
 const [fetchedAt,setFetchedAt]=useState('');
 const [loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[message,setMessage]=useState('');
 const input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null),id=useId();
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setItems([]);
  fetch('/api/instruments',{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json();if(!response.ok||!data.ok||!Array.isArray(data.instruments)||!data.instruments.length)throw new Error(data.error||'Market catalogue unavailable.');
   if(!controller.signal.aborted){setItems(data.instruments);setFetchedAt(typeof data.fetchedAt==='string'?data.fetchedAt:'');}
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Market catalogue unavailable.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[revision]);
 useEffect(()=>{list.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest'});},[active]);
 useEffect(()=>{const instrument=items.find(i=>i.symbol===symbol);onSnapshot(instrument&&fetchedAt?{instrument,fetchedAt,source:'https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES'}:null);},[items,symbol,fetchedAt,onSnapshot]);
 const matches=searchInstruments(items,query),selected=items.find(i=>i.symbol===symbol);
 const visible=matches.slice(0,50);
 function choose(item:Instrument){
  if(item.symbol!==symbol)onChange(item.symbol);
  setQuery('');setOpen(false);setActive(-1);setMessage(`${item.name} selected.`);
 }
 return <div className="market-picker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setActive(-1);}}}>
  <label className="number-field" htmlFor={id}><span>Market to inspect</span></label>
  <div style={{position:'relative'}}>
   <input ref={input} id={id} type="text" role="combobox" aria-autocomplete="list" aria-expanded={open&&!loading&&!error} aria-controls={`${id}-list`} aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined}
    autoComplete="off" spellCheck={false} placeholder="Type ticker, then press Enter" disabled={loading||!!error}
    style={{width:'100%',padding:'14px',border:'1px solid #34454d',borderRadius:8,background:'#0e181d',color:'#e6eeee',font:'inherit'}}
    value={open?query:(selected?`${selected.name} · ${symbol}`:symbol)}
    onFocus={()=>{setOpen(true);setQuery('');setActive(-1);setMessage('');}}
    onClick={()=>setOpen(true)}
    onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(-1);setMessage('');}}
    onKeyDown={e=>{
     if(e.nativeEvent.isComposing)return;
     if(e.key==='Escape'){e.preventDefault();setOpen(false);setQuery('');setActive(-1);return;}
     if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();setOpen(true);setActive(previous=>visible.length?Math.max(0,Math.min(visible.length-1,previous+(e.key==='ArrowDown'?1:-1))):-1);return;
     }
     if(e.key==='Enter'){
      e.preventDefault();if(loading||error)return;
      const q=query.trim().toLowerCase();
      const exact=items.find(i=>i.symbol.toLowerCase()===q||i.baseCoin.toLowerCase()===q)||items.find(i=>i.name.toLowerCase()===q);
      const target=active>=0?visible[active]:exact||(q&&matches.length===1?matches[0]:undefined);
      if(target)choose(target);else{setOpen(true);setMessage(matches.length?'Choose a result or enter a complete ticker.':'No available market matches this search.');}
     }
    }}/>
   {open&&!loading&&!error&&<div ref={list} id={`${id}-list`} role="listbox" aria-label="Matching markets" style={{position:'absolute',top:'calc(100% + 6px)',left:0,right:0,zIndex:30,maxHeight:280,overflowY:'auto',background:'#152127',border:'1px solid #3c5159',borderRadius:10,boxShadow:'0 12px 32px #0008'}}>
    {visible.map((item,index)=><div key={item.symbol} id={`${id}-option-${index}`} role="option" aria-selected={item.symbol===symbol} data-active={index===active}
      onMouseDown={e=>e.preventDefault()} onClick={()=>choose(item)} onMouseMove={()=>setActive(index)}
      style={{padding:'12px 14px',cursor:'pointer',background:index===active?'#24454b':'transparent',borderBottom:'1px solid #26363d'}}>
      <div style={{fontWeight:600,color:'#e6eeee'}}>{item.name}</div><div style={{fontSize:12,color:'#a3b6be',marginTop:3}}>{item.symbol}{item.symbol===symbol?' · Selected':''}</div>
     </div>)}
    {!matches.length&&<div style={{padding:14,color:'#a3b6be'}}>No matching markets.</div>}
    {matches.length>50&&<div style={{padding:12,fontSize:12,color:'#a3b6be'}}>Showing 50 of {matches.length}. Type to narrow the list.</div>}
   </div>}
  </div>
  <p className="helper" role="status">{loading?'Loading Bitget markets…':error?'Market list unavailable.':message||''}</p>
  {error&&<p className="helper" role="alert">{error}</p>}
  {!loading&&<button className="text-button" onClick={()=>{setOpen(false);setRevision(v=>v+1);}}>{error?'Retry market list':'Refresh market list'}</button>}
  {selected?.terms&&<details style={{marginTop:12}}><summary style={{cursor:'pointer'}}>Contract details</summary><p className="helper">Bitget stock-category perpetuals, including ETF and index products.</p>
   <dl className="helper" style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'6px 12px'}}>
    <dt>Minimum quantity</dt><dd style={{margin:0}}>{selected.terms.minOrderQty??'Unavailable'} {selected.baseCoin}</dd>
    <dt>Quantity increment</dt><dd style={{margin:0}}>{selected.terms.quantityMultiplier??'Unavailable'} {selected.baseCoin}</dd>
    <dt>Minimum order value</dt><dd style={{margin:0}}>{selected.terms.minOrderAmount??'Unavailable'} USDT</dd>
    <dt>Published maker fee</dt><dd style={{margin:0}}>{selected.terms.makerFeeRate===undefined?'Unavailable':`${Number((Number(selected.terms.makerFeeRate)*10000).toFixed(8))} bps`}</dd>
    <dt>Published taker fee</dt><dd style={{margin:0}}>{selected.terms.takerFeeRate===undefined?'Unavailable':`${Number((Number(selected.terms.takerFeeRate)*10000).toFixed(8))} bps`}</dd>
    <dt>Funding interval</dt><dd style={{margin:0}}>{selected.terms.fundInterval===undefined?'Unavailable':`${selected.terms.fundInterval} hours`}</dd>
   </dl>
   <p className="helper">Fee observations are not account-specific rates. Quantity increment is an order constraint, not a P&amp;L multiplier. The scenario checks minimum quantity, increment and entry value; other order rules still require verification.</p>
   <p className="helper">Captured {fetchedAt||'time unavailable'} · <a href="https://www.bitget.com/docs/catalog/market/market-data" target="_blank" rel="noreferrer">Bitget specifications</a></p>
  </details>}

 </div>;
}
