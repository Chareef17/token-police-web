# GE6 Plan — review and handoff

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
