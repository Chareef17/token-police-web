# TokenPolice Web

Next.js / TypeScript / Tailwind / SQLite (libSQL) wallet explorer. Requires Node.js 24.17+ and pnpm. Without `TURSO_DATABASE_URL` it uses a local SQLite file in `data/`; with it, the hosted Turso database.

## Run locally

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Open http://localhost:3000. In a second terminal, run `pnpm sync:watch` to run the web app's independent GE6 indexer. `pnpm sync` performs one pass. No Discord bot, token, source directory, database connection, or running bot process is required.

On Windows after `pnpm build`, `powershell -File scripts/Start-Web.ps1` runs the web server and indexer together; Ctrl+C stops them. It also supports the Node runtime bundled with Codex when Node is not on PATH.

## Independent data

- GE6 is read directly from TokenX Scan, poll contract `0x86a1f49e1b1cbd69971e99b66123264c75ac2c8f`. Raw `Voted` events are ABI-decoded; transfers are not counted as votes.
- The first run backfills the contract from block 49,110,941. It replaces previously imported GE6 rows only after a complete verified pass. Historical votes remain untouched. On a fresh data directory the first pass creates the database; historical events require an existing archived web database.
- The worker waits for 12 block confirmations, persists a block/hash checkpoint and checks approximately every 10 seconds after each pass. Actual latency includes upstream indexing and block confirmations. Page requests are throttled to 1.2 seconds apart.
- A 300-block overlap catches delayed logs, and a daily full reconciliation checks the entire receipt sequence. Transaction hash + log index prevents duplicates. A checkpoint hash change triggers a complete replay. Partial, stale, out-of-order, failed or incomplete responses do not replace the last good vote snapshot. A renewable SQLite lease prevents two web indexers writing concurrently.
- All events and checkpoints are saved in the web's `data/votes.sqlite`. Vote totals use integer arithmetic with 18-decimal precision. GE6 has no verified recipient column in the UI.
- Historical events are the one-time dataset already imported into the web database. They have no ongoing relationship with the bot. To move the app to another server, migrate its own database with SQLite's backup API.
- Wallet balances read TokenX Scan directly and use a one-minute cache. TokenX rejects requests without a browser User-Agent, so all TokenX calls send browser headers.
- Each pass writes only rows that changed, keeping hosted-database writes small.

The header refresh button runs a short GE6 transaction sync before reloading the current page. While the forecast page is visible, it also requests a short sync about every 15 seconds and refreshes the ranking if the number of confirmed votes changes. A shared lease and brief global cooldown prevent overlapping scans. The short sync skips the daily full audit, which remains in the background worker. Holder-balance snapshots are refreshed by the scheduled worker. The last successful vote sync time is shown; failed/stale updates are flagged. Stopping the Discord bot has no effect on the web indexer.

## Names

Discord names and settings are never read. Community labels live in the `names` table of the same database, with revision history. Anyone can set or edit a label. Writes are validated, same-origin, rate-limited and protected against stale revisions. Names are community labels, not verified ownership.

## Verification

```powershell
pnpm test
pnpm build
pnpm start
node scripts/check-api.mjs
```

Indexer tests exercise exact amounts, confirmations, duplicate events, restart, missing receipts, upstream failures, pagination and reorgs. API checks remove only their random synthetic wallet label.

## Hosting (Vercel)

- **Database:** create a Turso database (Vercel → Storage → Turso), which sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` on the project. To copy the local data in, put both values in `.env.local` and run `pnpm upload-data`.
- **GE6 sync:** `.github/workflows/sync-ge6.yml` runs `pnpm sync` every 5 minutes on GitHub Actions (GitHub may delay scheduled runs). Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as repository secrets. It can also be started by hand from the Actions tab.
- **Name limits:** on Vercel, X-Forwarded-For is trusted automatically for the 10 writes/minute limit; set `TRUST_PROXY=false` to share one limit.

The UI shows up to 100 latest GE6 transactions and 100 latest historical transactions separately. Counts and totals include all matching rows. Databases, local reference source and credentials are ignored by git.

## Admin search history

`/admin` lists which addresses people searched (with the community name, count, first and last time). Searchers' IPs are not stored, and the admin's own searches are not counted. Set `ADMIN_PASSWORD` (12+ characters) in the environment to enable it; changing it signs out existing sessions.
