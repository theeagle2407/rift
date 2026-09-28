/** Parse Responses API text only; never accept truncated or refused output. */
export function qwenText(value:unknown):string {
 if(!value||typeof value!=='object')throw new Error('Qwen returned an invalid response.');
 const body=value as {status?:string;output_text?:unknown;output?:{type?:string;content?:{type?:string;text?:unknown}[]}[]};
 if(body.status!=='completed'){
 const details = value as {
  status?: string;
  incomplete_details?: {reason?: string};
  error?: {code?: string};
 };
 const clean = (v: unknown) =>
  typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v)
   ? v : 'not_supplied';
 throw new Error(
  `Qwen status: ${clean(details.status)}; reason: ${clean(details.incomplete_details?.reason ?? details.error?.code)}. No partial review was applied.`
 );
}
 if(body.output?.some(item=>item.content?.some(part=>part.type==='refusal')))throw new Error('Qwen declined this review.');
 const text=typeof body.output_text==='string'?body.output_text:(body.output??[]).filter(item=>item.type==='message').flatMap(item=>item.content??[]).filter(part=>part.type==='output_text'&&typeof part.text==='string').map(part=>part.text).join('');
 if(!text.trim()||text.length>30000)throw new Error('Qwen returned no usable review text.');
 return text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
}
