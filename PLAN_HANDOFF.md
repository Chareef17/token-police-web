# GE6 Plan — review and handoff

## Latest user direction (supersedes frozen prototype)
Remove the official preliminary ranking from the Plan UI. Use the live `/ge6-current` forecast as the read-only base. Let the team enter positive or negative score adjustments per member and attach a note to each adjustment. New vote transactions must update the live forecast base automatically; the Plan result is **current forecast + saved adjustments**, recalculated when the base changes. Never set an absolute member total for a manual adjustment, because that would hide subsequent new votes. Show current base, net manual adjustment, resulting score, and resulting rank. Store adjustments separately from source transactions and rankings. The current static prototype does **not** implement this yet and should not be presented as meeting this request.

Recommended implementation: add a server-side Plan endpoint that reads `ge6CurrentRanking('votes')` from `lib/ge6-current.ts`, plus a separate table of scenario/member/delta/note/timestamp records. Reuse the existing live forecast refresh signal. On refresh, fetch a fresh ranking, then apply signed deltas and sort. Notes are plan metadata only. Preserve cents precision, validate member names and finite deltas, and ensure each adjustment is applied once. Test a new vote arriving after a manual +100: resulting score must rise by the vote amount while retaining +100. Test negative adjustments and notes, and confirm the live forecast remains unchanged.

## Implemented live Plan page
`/ge6-plan` now reads `/api/ge6-plan`, which uses `ge6CurrentRanking('votes')`. The browser polls every 30 seconds and applies signed adjustments after every refresh. It shows the resulting simulated rank and note list. Adjustments currently persist only in the local browser, so teammates on other devices do not share them. The endpoint does not write to the forecast database. TypeScript passes. Full build is blocked locally by Google Fonts network access, not by TypeScript errors. Next implementation should add shared scenario storage and auth if team collaboration is required, plus server-side tests of base refresh + delta preservation.

## User intent
Build an easy planning simulator for Nammonn targeting rank 13. Use real observations as a read-only baseline. Scenario changes MUST NOT update transactions, recipient assignments, snapshots, or public forecasts. User wants a clickable prototype before production integration.

## Current implementation
- Branch: `codex/ge6-plan-clickable-preview`.
- `mockups/ge6-plan-demo.html`: standalone interactive prototype.
- `public/ge6-plan-demo.html`: identical published copy. Keep these synchronized.
- `mockups/ge6-plan-model.mjs` and `public/ge6-plan-model.mjs`: frozen baseline, official ranks, scenario calculator.
- `mockups/ge6-plan-model.test.mjs`: three passing calculation tests.
- Public preview: https://raw.githack.com/Chareef17/token-police-web/codex/ge6-plan-clickable-preview/public/ge6-plan-demo.html
- Vercel branch preview requires login. Localhost server did not persist between turns; do not give localhost as the only deliverable.

## Review findings
The initial screen asks users to understand three calculation modes before editing a score. Forms, warnings, metrics and the table compete for attention. Repeated explanatory text obscures the primary action. A transaction hash field implies more verification than this prototype performs.

## Changes in this revision
- Direct editable score fields in desktop table and mobile member cards. Change a value and leave the field to recalculate the scenario.
- Advanced allocation, TX simulation and diagnostics are collapsed by default.
- Existing calculations remain isolated in browser localStorage.
- Script syntax and the three model tests passed. Visual browser verification of this revision is still outstanding.

## Recommended next iteration
1. Primary flow: choose scenario, edit member score, inspect Nammonn rank and gap. Put Nammonn and rank-13 competitor together in a compact summary.
2. Add search and a nearby-ranks view; keep all 58 candidates available. Preserve scroll and keyboard focus during edits instead of rebuilding the entire DOM.
3. Add undo, reset confirmation, export/import JSON and a visible saved indicator. Validate persisted data before use. Current localStorage is device-specific and not shared with the team.
4. Separate baseline correction at preliminary-two cutoff from future campaign additions. Comparing future simulated ranks to historical official ranks should not produce a contradiction warning.
5. Replace raw TX entry with selection from actual read-only transactions, showing timestamp, wallet, amount and existing split. When reassigned in a scenario, subtract the original allocations and add the new allocation exactly once. Preserve cutoff rules to avoid counting preliminary-one votes twice.
6. Treat team estimates as assumptions with source, date and confidence; never as revealed actual scores. Preliminary two publishes ranks only. Matching that order cannot establish actual scores or guaranteed final rank.
7. Do not stack unknowable-vote allocations and independent member estimates without explaining overlap. Current calculator applies adjustments sequentially; a later total estimate replaces that member's accumulated score. Make this ordering explicit or redesign into independent baseline + adjustments layers.
8. Audit team preset against image. Janry was excluded because of a suspected extra digit. Pancake preset currently says 11,327.72; image appears 11,372.72. Verify before importing. Do not silently call this verified team data.
9. Current direct edits append a total estimate; add compact edit history/undo and avoid unbounded duplicate entries.
10. Validate on narrow mobile, desktop and day/night themes. Test editing, scenario switching, reset, invalid numbers, duplicate TX, unknown pool cap, score conservation and reload persistence.

## Data boundary
Baseline is frozen 31 Oct 2026 noon, not live. Nammonn baseline 6,469.62; actual prelim2 rank 25. Unknown pool 41,594.36 is bundled prototype data. Goal defaults to 20,000 and does not guarantee rank 13. Official ranking contains 36 names; baseline contains 58. Before production, independently reconcile these inputs with stored snapshot and transaction sources.

## Deployment
Only publish the prototype branch for review. Do not merge into main or modify production data without user direction. No production route or database write was added. The public HTML exposes only bundled demo data, while edits stay in the viewer's browser.
