import {findInstrument,validSymbol} from '@/lib/rift/instruments';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function number(value: unknown, positive = true): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && (!positive || parsed > 0) ? parsed : null;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "NVDAUSDT")
    .trim().toUpperCase();
  if (!validSymbol(symbol)) return json({ok:false,error:"Invalid market symbol."},400);
  let instrument;
  try { instrument=await findInstrument(symbol); }
  catch { return json({ok:false,error:"Could not verify the Bitget market catalogue. Retry shortly."},502); }
  if (!instrument) return json({ok:false,error:"This market is not an online stock-category USDT perpetual."},400);

  const endpoint = new URL("https://api.bitget.com/api/v3/market/tickers");
  endpoint.searchParams.set("category", "USDT-FUTURES");
  endpoint.searchParams.set("symbol", symbol);

  try {
    const upstream = await fetch(endpoint, {
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      return json({ ok: false, error: "Market provider unavailable.",
        upstreamStatus: upstream.status }, 502);
    }
    const payload: unknown = await upstream.json();
    if (!record(payload) || payload.code !== "00000" || !Array.isArray(payload.data)) {
      return json({ ok: false, error: "Unexpected market provider response." }, 502);
    }
    const quote = payload.data.find((item: unknown) => record(item) && item.symbol === symbol);
    if (!record(quote)) return json({ ok: false, error: "Quote unavailable." }, 502);

    const lastPrice = number(quote.lastPrice);
    const timestamp = number(quote.ts);
    const receivedAt = Date.now();
    if (lastPrice === null || timestamp === null || timestamp > receivedAt + 60_000 ||
        !Number.isFinite(new Date(timestamp).getTime())) {
      return json({ ok: false, error: "Quote has an invalid price or timestamp." }, 502);
    }
    const ageMs = Math.max(0, receivedAt - timestamp);
    return json({
      ok: true,
      source: "Bitget",
      instrument: symbol,
      company: instrument.name,
      instrumentType: "Stock perpetual",
      category: "USDT-FUTURES",
      quoteCurrency: "USDT",
      lastPrice,
      bid: number(quote.bid1Price),
      ask: number(quote.ask1Price),
      markPrice: number(quote.markPrice),
      indexPrice: number(quote.indexPrice),
      fundingRate: number(quote.fundingRate, false),
      quotedAt: new Date(timestamp).toISOString(),
      receivedAt: new Date(receivedAt).toISOString(),
      ageMs,
      stale: ageMs > 60_000,
      freshnessThresholdMs: 60_000,
      referenceNote: "The exchange index is not a separately sourced underlying equity quote.",
    });
  } catch (error) {
    const timeout = error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return json({ ok: false, error: timeout
      ? "Market request timed out. Try again."
      : "Could not retrieve valid market data." }, timeout ? 504 : 502);
  }
}
