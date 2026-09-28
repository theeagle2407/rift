import assert from "node:assert/strict";
import { calculateBreakPoints, calculateStress, lossBoundaryPremium } from "../src/lib/rift/stress-engine.ts";

const trade = {
  direction: "long", quantity: 10, multiplier: 1,
  entryPrice: 104, entryReference: 100, lossBudget: 25,
  entryFeeBps: 0, exitFeeBps: 0, executionCost: 0, fundingCost: 0,
};
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`); }
let count = 0;
function test(name, run) { run(); count++; console.log(`PASS ${name}`); }

test("Rising stock, losing position", () => {
  const r = calculateStress(trade, {referenceMovePct: 2, exitPremiumPct: 0});
  close(r.referenceContribution, 20); close(r.premiumContribution, -40);
  close(r.netPnl, -20); close(r.budgetRemaining, 5);
  assert.equal(r.budgetBreached, false);
});
test("Fees and funding can breach the budget", () => {
  const r = calculateStress({...trade, entryFeeBps: 10, exitFeeBps: 10, executionCost: 2, fundingCost: 3}, {referenceMovePct: 2, exitPremiumPct: 0});
  close(r.entryFee, 1.04); close(r.exitFee, 1.02); close(r.netPnl, -27.06);
  assert.equal(r.budgetBreached, true);
});
test("Short reverses price exposure", () => {
  close(calculateStress({...trade, direction: "short"}, {referenceMovePct: 2, exitPremiumPct: 0}).netPnl, 20);
});
test("Funding receipts improve P&L", () => {
  close(calculateStress({...trade, fundingCost: -3}, {referenceMovePct: 2, exitPremiumPct: 0}).netPnl, -17);
});
test("Contract multiplier changes unit exposure", () => {
  close(calculateStress({...trade, multiplier: 2}, {referenceMovePct: 2, exitPremiumPct: 0}).netPnl, -40);
});
test("No movement with unchanged premium produces zero gross P&L", () => {
  close(calculateStress(trade, {referenceMovePct: 0, exitPremiumPct: 4}).grossPnl, 0);
});
test("Decomposition reconciles across scenarios", () => {
  for (const direction of ["long", "short"]) for (const move of [-20, 0, 5, 30]) {
    const r=calculateStress({...trade,direction}, {referenceMovePct:move,exitPremiumPct:3});
    close(r.referenceContribution+r.premiumContribution,r.grossPnl);
  }
});
test("Loss boundaries reconcile for long and short including fees", () => {
  for (const direction of ["long", "short"]) {
    const t={...trade,direction,entryFeeBps:6,exitFeeBps:6,fundingCost:2,executionCost:1};
    const boundary=lossBoundaryPremium(t,2); assert.notEqual(boundary,null);
    close(calculateStress(t,{referenceMovePct:2,exitPremiumPct:boundary}).netPnl,-25);
  }
});
test("Zero reference has no premium boundary", () => {
  assert.equal(lossBoundaryPremium(trade,-100),null);
});
test("Invalid inputs are rejected", () => {
  for (const patch of [{quantity:-1},{entryPrice:NaN},{entryReference:0},{exitFeeBps:10000},{direction:"other"}]) {
    assert.throws(()=>calculateStress({...trade,...patch},{referenceMovePct:0,exitPremiumPct:0}));
  }
  assert.throws(()=>calculateStress(trade,{referenceMovePct:-101,exitPremiumPct:0}));
});
test("Break points reconcile with the selected long scenario", () => {
  const points=calculateBreakPoints(trade,{referenceMovePct:2,exitPremiumPct:0});
  close(points.maxQuantityWithinBudget,12.5);
  close(points.breakEvenPremiumPct,1.9607843137254832);
  close(points.budgetBoundaryReferenceMovePct,1.5);
  close(calculateStress({...trade,quantity:points.maxQuantityWithinBudget},{referenceMovePct:2,exitPremiumPct:0}).netPnl,-25);
  close(calculateStress(trade,{referenceMovePct:2,exitPremiumPct:points.breakEvenPremiumPct}).netPnl,0);
  close(calculateStress(trade,{referenceMovePct:points.budgetBoundaryReferenceMovePct,exitPremiumPct:0}).netPnl,-25);
});
test("Short thresholds reverse the required direction", () => {
  const short={...trade,direction:"short"};
  const points=calculateBreakPoints(short,{referenceMovePct:2,exitPremiumPct:0});
  assert.equal(points.maxQuantityWithinBudget,null);
  close(calculateStress(short,{referenceMovePct:2,exitPremiumPct:points.breakEvenPremiumPct}).netPnl,0);
  close(calculateStress(short,{referenceMovePct:points.budgetBoundaryReferenceMovePct,exitPremiumPct:0}).netPnl,-25);
});
test("Fees and fixed costs are included in thresholds", () => {
  const costly={...trade,entryFeeBps:6,exitFeeBps:6,executionCost:1,fundingCost:2};
  const points=calculateBreakPoints(costly,{referenceMovePct:2,exitPremiumPct:0});
  const boundary=calculateStress({...costly,quantity:points.maxQuantityWithinBudget},{referenceMovePct:2,exitPremiumPct:0});
  close(boundary.netPnl,-25);
  close(calculateStress(costly,{referenceMovePct:2,exitPremiumPct:points.breakEvenPremiumPct}).netPnl,0);
  close(calculateStress(costly,{referenceMovePct:points.budgetBoundaryReferenceMovePct,exitPremiumPct:0}).netPnl,-25);
});
test("Profitable unit economics have no maximum size", () => {
  const points=calculateBreakPoints(trade,{referenceMovePct:10,exitPremiumPct:4});
  assert.equal(points.maxQuantityWithinBudget,null);
});
console.log(`\n${count} tests passed. No network requests or account keys used.`);
