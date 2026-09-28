export const HOUR = 3_600_000;
export type Close = { timestamp: number; close: number };
export type Pair = { timestamp: number; market: number; index: number };
export type HistoryCase = { start: number; end: number; hours: number; entryPrice: number;
  exitPrice: number; entryReference: number; exitReference: number;
  referenceMovePct: number; exitPremiumPct: number; instrumentReturnPct: number };
export type HistoryData = { ok: true; symbol: string; fetchedAt: string; asOf: string;
  sources: string[]; points: Pair[]; unmatched: number; excludedRows: number };

export function parseCloses(rows: unknown, cutoff: number): { closes: Close[]; excluded: number } {
  if (!Array.isArray(rows)) throw new Error('Invalid candle response.');
  const map = new Map<number, number>(); let excluded = 0;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5) throw new Error('Malformed candle row.');
    const values = row.slice(0,5).map(v => (typeof v === 'string' && v.trim() !== '') || typeof v === 'number' ? Number(v) : NaN);
    const [timestamp,open,high,low,close] = values;
    if (!values.every(Number.isFinite) || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp % HOUR !== 0 ||
        Math.min(open,high,low,close) <= 0 || high < Math.max(open,close,low) || low > Math.min(open,close,high)) {
      throw new Error('Invalid candle values.');
    }
    if (timestamp + HOUR > cutoff) { excluded++; continue; }
    if (map.has(timestamp)) {
      if (map.get(timestamp) !== close) throw new Error('Conflicting candles at one timestamp.');
      excluded++; continue;
    }
    map.set(timestamp, close);
  }
  return {closes:[...map].sort((a,b)=>a[0]-b[0]).map(([timestamp,close])=>({timestamp,close})), excluded};
}
export function pairCloses(market: Close[], index: Close[]) {
  const byTime = new Map(index.map(p=>[p.timestamp,p.close]));
  const points: Pair[] = market.filter(p=>byTime.has(p.timestamp)).map(p=>({timestamp:p.timestamp,market:p.close,index:byTime.get(p.timestamp)!}));
  return {points,unmatched:market.length+index.length-2*points.length};
}
export function historyCases(points: Pair[], hours: number): HistoryCase[] {
  if (![6,24].includes(hours)) throw new Error('Unsupported holding period.');
  const cases: HistoryCase[] = [];
  for (let i=0;i+hours<points.length;i++) {
    const a=points[i], b=points[i+hours];
    if (b.timestamp-a.timestamp !== hours*HOUR) continue;
    // Exact, contiguous hourly observations only: never bridge missing hours.
    if (points.slice(i,i+hours+1).some((p,j)=>p.timestamp!==a.timestamp+j*HOUR)) continue;
    cases.push({start:a.timestamp+HOUR,end:b.timestamp+HOUR,hours,entryPrice:a.market,exitPrice:b.market,
      entryReference:a.index,exitReference:b.index,referenceMovePct:(b.index/a.index-1)*100,
      exitPremiumPct:(b.market/b.index-1)*100,instrumentReturnPct:(b.market/a.market-1)*100});
  }
  return cases;
}
