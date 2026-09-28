# Rift readiness and demonstration

Rift is a pre-trade scenario and risk workspace. It does not place trades.

## One verification command

Run `node scripts/verify-rift.mjs` and `npm run build` from the repository root.
The tests use fixtures and do not prove external-provider availability.

## Demonstration sequence

1. Run the labelled synthetic example: a rising reference can coexist with a losing position.
2. Open Fees & carrying costs. Apply illustrative costs to demonstrate their effect. These are not exchange rates.
3. Load a fresh Bitget quote, or select a historical case. Explain which one is in use.
4. For current-price scenarios, optionally apply the published taker fee to both sides as an assumption. Verify the account rate separately. Add execution and net funding assumptions for the holding period.
5. Inspect quantity checks. They check minimum quantity, increment and minimum entry value only. They do not authorize an order.
6. Test a worse reference move and exit premium. Pin a result before changing quantity.
7. Export a brief. Confirm the price source, cost assumptions, findings and retained thesis warning. Loading historical prices resets costs to zero; re-enter assumptions afterwards.
8. Use AI interpretation when available. On failure, use the visibly labelled manual checklist. Never present that checklist as AI output.

## Honest limits

- The model remains a linear unit-price scenario with multiplier 1. Quantity increment is not a financial multiplier. Account permissions, precision rules, maximum orders, margin tiers, execution and venue acceptance are not fully validated.
- No liquidation model. A loss budget is not posted margin. Neither terminal profitability nor staying within budget proves survival along a price path. Use the exchange's account-specific margin/liquidation information separately.
- Funding is an entered net payment or receipt. Published funding interval and current rate do not establish future accumulated funding.
- Company-data connection currently times out on the user's network. The public initialization check alone does not validate downstream queries. Test the deployed server before claiming availability.
- Gemini can remain unavailable despite bounded retry handling. No successful live review is claimed by fixture tests.
- No demand validation or measured trader time savings have been established.

## Five-user validation task

Invite five actual users of perpetuals. Give each the same task without explaining the UI: compare the synthetic example with costs, load evidence, identify the source, choose an adverse scenario and export a brief.
Record completion time, mistakes, whether they confuse loss budget with liquidation protection, whether they understand cost assumptions, and whether they would use the tool before their next trade. Ask what they currently use and what decision Rift changed. Record responses verbatim with permission. Do not claim adoption from this proposed study.

## Local validation scope

Eight suites cover calculation boundaries, historical alignment, catalogue parsing, exact decimal quantity checks, provider retries, company-data parsing, AI response validation and export clarity. Production build is checked separately. Browser/mobile visual QA and successful live Gemini/company calls are not established by these tests.
