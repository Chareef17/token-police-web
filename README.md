# TokenPolice Web

Next.js / TypeScript / Tailwind / SQLite wallet explorer. Requires Node.js 24.17+, pnpm and Chrome (or direct TokenX API access).

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
- A 300-block overlap catches delayed logs, and an hourly full reconciliation checks the entire receipt sequence. Transaction hash + log index prevents duplicates. A checkpoint hash change triggers a complete replay. Partial, stale, out-of-order, failed or incomplete responses do not replace the last good vote snapshot. A renewable SQLite lease prevents two web indexers writing concurrently.
- All events and checkpoints are saved in the web's `data/votes.sqlite`. Vote totals use integer arithmetic with 18-decimal precision. GE6 has no verified recipient column in the UI.
- Historical events are the one-time dataset already imported into the web database. They have no ongoing relationship with the bot. To move the app to another server, migrate its own database with SQLite's backup API.
- Wallet balances already read TokenX Scan directly and use a one-minute cache. Browser transport defaults to Chrome; configure `TOKENX_BROWSER_CHANNEL` or `TOKENX_BROWSER_PATH`, or use `TOKENX_MODE=api` where direct API access works.

The page reads the latest committed snapshot when searching or refreshing. It does not wait for a full blockchain scan on each click. The last successful sync time is shown; failed/stale updates are flagged. Keep the web indexer running for new transactions. Stopping the Discord bot has no effect on the web indexer.

## Names

Discord names and settings are never read. Community labels live separately in `data/names.sqlite`, with revision history. Anyone can set or edit a label. Writes are validated, same-origin, rate-limited and protected against stale revisions. Names are community labels, not verified ownership.

## Verification

```powershell
pnpm test
pnpm build
pnpm start
node scripts/check-api.mjs
```

Indexer tests exercise exact amounts, confirmations, duplicate events, restart, missing receipts, upstream failures, pagination and reorgs. API checks remove only their random synthetic wallet label.

## Hosting

Use a Node server with persistent storage and run `pnpm sync:watch` as a separate supervised process. Do not use ephemeral/serverless SQLite storage. No access to the bot machine is needed. Preserve the web's `data` directory and back up SQLite using its backup API, including committed WAL state. Supply Chrome for the browser transport or select direct API mode if available.

Terminate HTTPS at a reverse proxy, preserve the external Host header and proxy to localhost:3000. Only set `TRUST_PROXY=true` when the trusted proxy overwrites X-Forwarded-For; otherwise naming shares a limit of 10 writes/minute. Limit body size at the proxy. Production hosting is not yet configured.

The UI shows up to 100 latest GE6 transactions and 100 latest historical transactions separately. Counts and totals include all matching rows. Databases, local reference source and credentials are ignored by git.
