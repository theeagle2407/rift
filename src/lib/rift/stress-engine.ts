/** Hypothetical linear, quote-currency scenarios. No forecasts or liquidation model.
 * Prices must use a common currency and a verified per-unit multiplier.
 * Entry and exit prices are before the explicitly entered execution costs.
 */
export interface Trade {
  direction: "long" | "short";
  quantity: number;
  multiplier: number;
  entryPrice: number;
  entryReference: number;
  lossBudget: number;
  entryFeeBps: number;
  exitFeeBps: number;
  executionCost: number;
  fundingCost: number; // Positive = payment, negative = receipt; scenario assumption.
}
export interface Scenario {
  referenceMovePct: number;
  exitPremiumPct: number;
}

function finite(name: string, value: number, minimum = -Infinity) {
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${name} must be finite and at least ${minimum}.`);
  }
}

export function validateTrade(trade: Trade) {
  if (trade.direction !== "long" && trade.direction !== "short") {
    throw new Error("Direction must be long or short.");
  }
  for (const key of ["quantity", "multiplier", "entryPrice", "entryReference"] as const) {
    finite(key, trade[key], Number.MIN_VALUE);
  }
  for (const key of ["lossBudget", "entryFeeBps", "exitFeeBps", "executionCost"] as const) {
    finite(key, trade[key], 0);
  }
  if (trade.entryFeeBps >= 10000 || trade.exitFeeBps >= 10000) {
    throw new Error("Fee assumptions must be less than 10,000 basis points.");
  }
  finite("fundingCost", trade.fundingCost);
}

export function calculateStress(trade: Trade, scenario: Scenario) {
  validateTrade(trade);
  finite("referenceMovePct", scenario.referenceMovePct, -100);
  finite("exitPremiumPct", scenario.exitPremiumPct, -100);
  const units = trade.quantity * trade.multiplier;
  const signedUnits = (trade.direction === "long" ? 1 : -1) * units;
  const exitReference = trade.entryReference * (1 + scenario.referenceMovePct / 100);
  const exitPrice = exitReference * (1 + scenario.exitPremiumPct / 100);
  const referenceContribution = signedUnits * (exitReference - trade.entryReference);
  const premiumContribution = signedUnits * (
    (exitPrice - exitReference) - (trade.entryPrice - trade.entryReference)
  );
  const grossPnl = signedUnits * (exitPrice - trade.entryPrice);
  const entryFee = units * trade.entryPrice * trade.entryFeeBps / 10000;
  const exitFee = units * exitPrice * trade.exitFeeBps / 10000;
  const totalCosts = entryFee + exitFee + trade.executionCost + trade.fundingCost;
  const netPnl = grossPnl - totalCosts;
  const entryNotional = units * trade.entryPrice;
  const result = {
    exitReference, exitPrice, referenceContribution, premiumContribution,
    grossPnl, entryFee, exitFee, totalCosts, netPnl, entryNotional,
    returnOnNotionalPct: netPnl / entryNotional * 100,
    budgetRemaining: trade.lossBudget + netPnl,
  };
  if (Object.values(result).some(value => !Number.isFinite(value))) {
    throw new Error("These inputs exceed the supported calculation range.");
  }
  return { ...result, budgetBreached: netPnl < -trade.lossBudget - 1e-8 };
}

/** Exit premium at net P&L = -lossBudget for a fixed reference move.
 * Returns null when no nonnegative exit-price boundary exists.
 * Funding and execution cost remain fixed scenario inputs.
 */
export function lossBoundaryPremium(trade: Trade, referenceMovePct: number): number | null {
  validateTrade(trade);
  finite("referenceMovePct", referenceMovePct, -100);
  const reference = trade.entryReference * (1 + referenceMovePct / 100);
  if (reference <= 0) return null;
  const units = trade.quantity * trade.multiplier;
  const signedUnits = (trade.direction === "long" ? 1 : -1) * units;
  const entryFee = units * trade.entryPrice * trade.entryFeeBps / 10000;
  const numerator = signedUnits * trade.entryPrice + entryFee +
    trade.executionCost + trade.fundingCost - trade.lossBudget;
  const denominator = signedUnits - units * trade.exitFeeBps / 10000;
  const exitPrice = numerator / denominator;
  const premium = (exitPrice / reference - 1) * 100;
  return Number.isFinite(premium) && exitPrice >= 0 ? premium : null;
}

export type BreakPoints = {
  maxQuantityWithinBudget: number | null;
  breakEvenPremiumPct: number | null;
  budgetBoundaryReferenceMovePct: number | null;
};

function targetPremium(trade: Trade, referenceMovePct: number, targetNetPnl: number): number | null {
  validateTrade(trade);
  finite("referenceMovePct", referenceMovePct, -100);
  finite("targetNetPnl", targetNetPnl);
  const reference = trade.entryReference * (1 + referenceMovePct / 100);
  if (reference <= 0) return null;
  const units = trade.quantity * trade.multiplier;
  const signedUnits = (trade.direction === "long" ? 1 : -1) * units;
  const entryFee = units * trade.entryPrice * trade.entryFeeBps / 10000;
  const coefficient = signedUnits - units * trade.exitFeeBps / 10000;
  if (Math.abs(coefficient) < 1e-12) return null;
  const exitPrice = (targetNetPnl + signedUnits * trade.entryPrice + entryFee +
    trade.executionCost + trade.fundingCost) / coefficient;
  const premium = (exitPrice / reference - 1) * 100;
  return Number.isFinite(premium) && exitPrice >= 0 ? premium : null;
}

/** Exact deterministic thresholds for the selected scenario. A null maximum
 * quantity means losses do not increase with quantity under these assumptions.
 * The premium and reference thresholds are boundaries: longs must finish at or
 * above them, while shorts must finish at or below them.
 */
export function calculateBreakPoints(trade: Trade, scenario: Scenario): BreakPoints {
  const result = calculateStress(trade, scenario);
  const variablePnlPerQuantity = (
    result.grossPnl - result.entryFee - result.exitFee
  ) / trade.quantity;
  const fixedCosts = trade.executionCost + trade.fundingCost;
  let maxQuantityWithinBudget: number | null = null;
  if (variablePnlPerQuantity < -1e-12) {
    maxQuantityWithinBudget = Math.max(0, (trade.lossBudget - fixedCosts) / -variablePnlPerQuantity);
  }

  if(Math.abs(variablePnlPerQuantity)<=1e-12&&fixedCosts>trade.lossBudget){
    maxQuantityWithinBudget=0;
  }

  const breakEvenPremiumPct = targetPremium(trade, scenario.referenceMovePct, 0);
  const exitPremiumFactor = 1 + scenario.exitPremiumPct / 100;
  let budgetBoundaryReferenceMovePct: number | null = null;
  if (exitPremiumFactor > 0) {
    const units = trade.quantity * trade.multiplier;
    const signedUnits = (trade.direction === "long" ? 1 : -1) * units;
    const entryFee = units * trade.entryPrice * trade.entryFeeBps / 10000;
    const coefficient = signedUnits - units * trade.exitFeeBps / 10000;
    if (Math.abs(coefficient) >= 1e-12) {
      const exitPrice = (-trade.lossBudget + signedUnits * trade.entryPrice + entryFee +
        trade.executionCost + trade.fundingCost) / coefficient;
      const move = (exitPrice / (trade.entryReference * exitPremiumFactor) - 1) * 100;
      if (Number.isFinite(move) && exitPrice >= 0 && move >= -100) budgetBoundaryReferenceMovePct = move;
    }
  }
  return {maxQuantityWithinBudget, breakEvenPremiumPct, budgetBoundaryReferenceMovePct};
}
