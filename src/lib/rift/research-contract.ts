export type Interpretation = {
 summary:string; mechanism:string; assumptions:string[]; questions:string[]; evidenceIds:string[];
 proposal:{referenceMovePct:number|null;exitPremiumPct:number|null};
};
export type ResearchReport = {cached?:boolean;cacheAgeMs?:number;timings?:{evidenceMs:number;modelMs:number};ok:true;model:string;createdAt:string;durationMs:number;interpretation:Interpretation;
 evidence:{id:string;label:string;content:unknown}[];usage:unknown};
export const interpretationSchema={type:'object',properties:{summary:{type:'string'},mechanism:{type:'string'},
 assumptions:{type:'array',items:{type:'string'},maxItems:3},questions:{type:'array',items:{type:'string'},maxItems:3},
 evidenceIds:{type:'array',items:{type:'string',enum:['T1','C1','H1']},minItems:1,maxItems:3},
 proposal:{type:'object',properties:{referenceMovePct:{type:['number','null']},exitPremiumPct:{type:['number','null']}},required:['referenceMovePct','exitPremiumPct'],additionalProperties:false}},
 required:['summary','mechanism','assumptions','questions','evidenceIds','proposal'],additionalProperties:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateInterpretation(v:unknown,allowedIds:string[]):Interpretation {
 if(!object(v))throw new Error('Invalid interpretation.');
 for(const k of ['summary','mechanism'])if(typeof v[k]!=='string'||!(v[k] as string).trim()||(v[k] as string).length>1500)throw new Error('Invalid explanation text.');
 for(const k of ['assumptions','questions'])if(!Array.isArray(v[k])||(v[k] as unknown[]).length>3||(v[k] as unknown[]).some(t=>typeof t!=='string'||t.length>600))throw new Error('Invalid explanation list.');
 if(!Array.isArray(v.evidenceIds)||!v.evidenceIds.length||v.evidenceIds.length>3||v.evidenceIds.some(id=>typeof id!=='string'||!allowedIds.includes(id)))throw new Error('Unsupported evidence reference.');
 if(!object(v.proposal))throw new Error('Invalid proposed assumptions.');
 for(const [k,limit]of [['referenceMovePct',15],['exitPremiumPct',8]] as const){const n=v.proposal[k];if(n!==null&&(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>limit))throw new Error('Proposed assumption exceeds the supported chart range.');}
 return v as unknown as Interpretation;
}
