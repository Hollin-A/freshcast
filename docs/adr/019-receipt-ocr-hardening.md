# ADR 019: Receipt OCR Hardening — LLM-Only Fallback Policy & AnalyzeExpense Migration

**Status:** Accepted
**Date:** 2026-05-06

## Context

Phase 29 shipped receipt upload and OCR using Amazon Textract's `DetectDocumentTextCommand` and routed the extracted text into the existing sales parse pipeline (LLM primary in `src/services/llm-sales-parser.ts`, rule-based fallback in `src/services/sales-parser.ts`). The fallback is the same one used by the Log/NL tab — it was designed in ADR-003 to handle short chat-style inputs like `"sold 20 eggs, 30kg beef"`.

In practice, the rule-based fallback produces unusable output when given Textract receipt text. The root cause is structural: receipts are not free-form chat sentences and the fallback was never designed for them.

Concrete failure modes observed:

- **Prices look like quantities.** A line like `"FREE RANGE EGGS  $9.50"` causes the parser's `\d+\.?\d*` regex (`src/services/sales-parser.ts:58`) to extract `9.5` as the quantity. The dollar sign and price are not stripped; the surviving product name becomes `"$ FREE RANGE EGGS"`.
- **Receipt noise survives normalization.** `FILLER_WORDS` (`src/services/sales-parser.ts:22`) strips chat connectives (`i, sold, today, about, around, of`) — none of which appear on receipts. Receipts contain `TOTAL, SUBTOTAL, GST, ABN, EFTPOS, REG, INV, BARCODE`, store names, dates, and phone numbers, all of which carry numbers and survive into `parseToken` as if they were sales items.
- **Abbreviations bypass fuzzy matching.** Retailers print `MNCD BEEF`, `CHKN BRST`, `FR EGG`, `MILK FUL CRM 2L`. The product matcher's Levenshtein ≤ 2 threshold (`src/services/product-matcher.ts:67`) cannot bridge these to canonical names like `"Minced Beef"` or `"Chicken Breast"`.
- **Layout joining amplifies the problem.** `extractReceiptTextFromS3` joins Textract `LINE` blocks with `", "` (`src/lib/textract.ts:37`). The rule-based parser then tokenizes on commas (`src/services/sales-parser.ts:122`), which guarantees every receipt line — including all the noise lines — is run through `parseToken` independently.
- **No single-quantity assumption holds on receipts.** Receipt lines often contain two numbers (`2 × Eggs $9.00` — quantity 2, price $9.00). `parseToken` greedily takes the first number it sees; the rest, including the price and currency symbol, becomes the product name.

The result: when the Anthropic API key is missing or Claude is temporarily unavailable, a receipt upload populates the confirmation screen with a dozen nonsense rows that the user must delete one by one. This is worse than having no fallback at all — it actively erodes trust in the OCR feature.

The Log/NL tab fallback continues to work correctly for its intended input shape; the problem is specific to the receipt path.

## Decision

This ADR records two coupled decisions. They are coupled because Decision 1 stops the bleeding now and Decision 2 makes the eventual fallback meaningful, in that order.

### Decision 1 — Short term: receipt OCR is LLM-only

The receipt parse route (`POST /api/receipts/parse`) no longer falls through to the rule-based parser when the LLM is unavailable. When `llmParseSalesInput` returns `null` (no API key, API error, malformed JSON, schema mismatch), the route returns `SERVICE_UNAVAILABLE` (503) with a clear message:

> "Receipt reading needs our AI service, which is temporarily unavailable. Please try again in a few minutes, or type your sale on the Log tab — that still works."

This is the same envelope shape the route already uses when Textract itself fails (`src/app/api/receipts/parse/route.ts:42-49`), which keeps the client-side handling consistent.

The rule-based parser is **not removed**. It continues to back the Log/NL tab where it was designed to work. This decision narrows its responsibility to the input shape it was built for.

### Decision 2 — Medium term: migrate Textract to `AnalyzeExpense`

Textract's `AnalyzeExpenseCommand` is purpose-built for receipts and invoices. It returns structured `LineItems` with separate `Description`, `Quantity`, `UnitPrice`, and `Total` fields, plus document-level metadata (vendor, date, totals). The "find the line items in the noise" problem is solved by AWS, not by our parser.

Migrating moves the receipt path off `DetectDocumentText` and onto `AnalyzeExpense`. The downstream effect:

- The **LLM path** receives pre-structured line items instead of a raw line dump. The prompt shrinks (no need to teach Claude to discriminate sales lines from totals/GST/ABN noise) and accuracy improves.
- The **rule-based path** becomes meaningful for the first time on receipts. With each line item already containing a clean `Description` string and a numeric `Quantity`, the fallback collapses to: for each line item, run `matchProduct(description, products)` and use the AWS-provided quantity directly. `parseSalesInput`'s tokenization, quantity-extraction, and unit-extraction steps are bypassed entirely — they were the steps that broke on receipts.

After 36.2 ships, re-enabling rule-based fallback on the receipt path is optional. The current preference is to keep the LLM-only policy from Decision 1 unless data shows the fallback meaningfully improves the outage experience; the structured-input fallback would be available as a later toggle.

### Collateral fixes shipped with Decision 1

These are small and should ship with 36.1 to harden the receipt path regardless of Decision 2's timing:

- **Stop joining Textract lines with `", "`.** Use `"\n"` in `extractReceiptTextFromS3` so commas in product descriptions and natural line breaks are preserved as semantically distinct. The LLM handles either; this is cleaner signal.
- **Structured logging on receipt `parseMethod`.** Emit `receipts.parseMethod = llm | error` so the rate at which the fallback path is exercised is observable. This data informs whether the LLM-only policy needs revisiting.
- **Audit confirmation-screen mass deletion.** Defense in depth — the worst case of any future fallback path remains user-recoverable in one or two taps. Verified during 36.1.

## Rationale

- **Receipts are semi-structured documents, not chat sentences.** The rule-based parser is the right tool for chat input and the wrong tool for OCR text. Continuing to route receipt OCR output through it papers over a category mismatch with regex patches.
- **"Improve the rule-based parser to handle receipts" was rejected.** That path requires a noise-line filter (`TOTAL|GST|ABN|EFTPOS|...`), money detection (`$N.NN` stripped before quantity extraction), an abbreviation dictionary (`MNCD → Minced`, `CHKN → Chicken`, `FR → Free Range`), multi-number disambiguation (which number is qty vs price), and per-retailer format heuristics. It would never reach LLM accuracy on the same input, would carry permanent maintenance cost, and would be reinventing what AWS sells as a service. ROI is low because the fallback path is exercised rarely (Claude Haiku has very high uptime) and a clear error in that rare case is better UX than imperfect output.
- **Honest errors build trust; nonsense rows erode it.** When the LLM is unavailable, a transient-sounding error pointing the user to the working Log tab is the right experience. Garbage in the confirmation screen looks like the OCR feature is broken even when it is not.
- **`AnalyzeExpense` is architecturally correct, not just incrementally better.** It removes the structural-mismatch root cause. Both the LLM path and any future rule-based path benefit because the input shape is finally appropriate to the task.
- **Cost is acceptable.** `AnalyzeExpense` is roughly 10× `DetectDocumentText` per page (~$0.01 vs ~$0.0015 at current AWS pricing). Receipt uploads are a low-frequency action. At realistic per-business volumes, the delta is pennies per business per month and is dwarfed by the LLM call cost on the same request.
- **Phased rollout matches operational caution.** Decision 1 ships first, independently, and corrects the observable user-facing issue with ~20 lines of code. Decision 2 ships when the AnalyzeExpense work is ready; if Decision 2 is delayed for any reason, the receipt path remains in a known-good state.

## Consequences

- **Receipt photo upload is unavailable during rare LLM outages**, by policy. The Log/NL tab and the manual entry tab remain available; the error message points the user to them. This is an explicit trade — narrower feature surface during outage, in exchange for no nonsense data being written to the confirmation screen.
- **The rule-based parser's contract narrows.** Phase 36.1 makes its responsibility "back the Log/NL tab" rather than "back any natural-language sales input." ADR-003's framing remains valid for that scope; this ADR clarifies the boundary.
- **`AnalyzeExpense` increases per-receipt Textract spend** (~10×). Tracked via the structured logging added in 36.1. Worth flagging in cost monitoring (Phase 30.2) once that lands.
- **No data migration is required.** Existing `SalesEntry.receiptKey` and `rawInput` fields continue to mean what they mean. The change is in how new receipt parses are computed, not in the data model.
- **`docs/API.md` updates are deferred to ship-time.** When 36.1 ships, the `POST /api/receipts/parse` documentation drops `parseMethod: "rule-based"` from the response shape and adds the new error contract. When 36.2 ships, the response may grow a `lineItems` field carrying AWS-structured items alongside `extractedText`. Both updates ship with the corresponding sub-phase, not with this ADR.
- **`docs/TDD.md` will reflect the new pipeline shape** when 36.2 ships — receipts go via `AnalyzeExpense`, the Log/NL tab continues to use the existing pipeline. Documented at ship-time, not at decision-time, to match the convention used for ADR-018.
- **Tests follow the same pattern.** Rule-based parser tests are unchanged (its scope narrows but its contract for chat input is identical). New tests cover the receipt route's LLM-null error path (36.1) and, later, the `AnalyzeExpense` line-item mapping (36.2).

## Alternatives considered

- **Improve the rule-based parser to handle receipt OCR text directly.** Rejected — see Rationale. Wrong tool for the job; ROI is low; permanent maintenance burden; never reaches LLM-equivalent quality on the same input.
- **Keep the current behaviour and accept the bad fallback experience.** Rejected — the failure mode is bad enough (nonsense rows in the confirmation screen) that it actively damages trust in the receipt feature. Doing nothing is a worse default than failing clearly.
- **Move receipts entirely to AnalyzeExpense without changing the fallback policy.** Considered — the structural fix alone would make the rule-based fallback actually viable on receipts, and the LLM-only policy could be skipped. Rejected as the immediate fix because the AnalyzeExpense migration carries more code and operational change than the fallback policy, and Decision 1 is shippable independently in ~20 lines while the structural work is scoped and prepared.
- **Split this into two ADRs (one per decision).** Considered. Rejected because the two decisions share the same root cause analysis, Decision 1 is intentionally a bridge to Decision 2, and a single ADR keeps the migration plan auditable in one place. Future supersession (e.g. if Decision 2 is later abandoned) is straightforward via a follow-up ADR.

## Closing notes (post-implementation)

Both decisions shipped. Decision 1 landed via Phase 36.1 (PR #6); Decision 2 via Phase 36.2.

A small policy point arose during 36.2.5 that this ADR should record explicitly: **the structured rule-based fallback is shipped but disabled by default.** The route checks `process.env.RECEIPT_FALLBACK === "structured"` before invoking it; with the flag unset (production default), the LLM-only behaviour from Decision 1 is unchanged.

Reasoning for the off-by-default policy:

- **The LLM path is the supported and correct path.** Even with structured input, the rule-based fallback can produce unmatched rows for descriptions the matcher's Levenshtein-2 threshold cannot bridge (`MNCD BEEF` → `Minced Beef` is on the boundary). The LLM handles abbreviations comfortably; falling through to the matcher would degrade UX silently in cases where users would prefer the clear "AI service unavailable, please retry" message established in 36.1.
- **Off-by-default preserves rollout safety.** The 36.2 change is purely additive at the user-facing layer; behaviour is identical to 36.1 unless an operator explicitly opts in. If a future incident makes the LLM unavailable for a sustained period, an operator can flip `RECEIPT_FALLBACK=structured` in the deployment environment for a graceful-degradation window without code changes.
- **The single-env-knob feature flag is a placeholder.** Phase 32.1.3 is scoped to introduce a proper feature-flag scaffold (`src/lib/feature-flags.ts`); when that lands, this knob will move into it without changing the policy or the runtime contract.

The flag's existence does not require any further ADR. If the policy is ever flipped (default-on, or removed entirely), a follow-up ADR should record that change and the data behind it (e.g. observed match-rate parity between LLM and structured rule-based on real receipts).

## References

- ADR-003 — Rule-Based Natural Language Parser for MVP. Defines the parser's intended input shape (chat sentences). This ADR narrows that scope.
- ADR-011 — LLM Integration with Claude Haiku. Establishes the LLM-primary, rule-based-fallback pattern that this ADR refines for receipts.
- Implementation Plan — Phase 29 (Receipt Upload & OCR, complete) and Phase 36 (Receipt OCR Hardening, both sub-phases shipped).
- AWS Textract docs: [`AnalyzeExpense` API reference](https://docs.aws.amazon.com/textract/latest/dg/API_AnalyzeExpense.html).
- AWS Textract pricing: [pricing page](https://aws.amazon.com/textract/pricing/) — `AnalyzeExpense` vs `DetectDocumentText` per-page cost comparison.
