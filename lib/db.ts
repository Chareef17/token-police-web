import type { Client } from '@libsql/client';
import { connect, initialize } from './database.mjs';
import { sum } from './amount.mjs';
export type Vote = { id: string; event: string; member: string; amount: string; tx_hash: string | null; voted_at: string | null };
let client: Promise<Client> | undefined;
// One client per server instance; the schema is ensured once when it is first used.
export function database() {
  client ??= (async () => { const db = connect(); await initialize(db); return db; })().catch(error => { client = undefined; throw error; });
  return client;
}
export async function wallet(address: string) {
  const db = await database();
  const [votes, meta, name] = await db.batch([
    { sql: 'SELECT id,event,member,amount,tx_hash,voted_at FROM votes WHERE address=? OR wallet=? ORDER BY voted_at DESC,id DESC', args: [address, address] },
    'SELECT key,value FROM metadata',
    { sql: 'SELECT name,version,updated_at FROM names WHERE address=?', args: [address] },
  ], 'read');
  const rows = votes.rows.map(r => ({ id: String(r.id), event: String(r.event), member: String(r.member), amount: String(r.amount), tx_hash: r.tx_hash == null ? null : String(r.tx_hash), voted_at: r.voted_at == null ? null : String(r.voted_at) })) as Vote[];
  const metadata = Object.fromEntries(meta.rows.map(r => [String(r.key), String(r.value)]));
  const groups = new Map<string, Map<string, string[]>>();
  for (const row of rows.filter(r => r.event !== 'GE6')) {
    if (!groups.has(row.event)) groups.set(row.event, new Map());
    const members = groups.get(row.event)!;
    members.set(row.member, [...(members.get(row.member) || []), row.amount]);
  }
  const events = [...groups].map(([event, members]) => ({ event, total: sum([...members.values()].flat()), members: [...members].map(([member, amounts]) => ({ member, amount: sum(amounts), transactions: amounts.length })) }));
  const ge6 = rows.filter(r => r.event === 'GE6');
  const historical = rows.filter(r => r.event !== 'GE6');
  const named = name.rows[0];
  return { address, name: named ? { name: String(named.name), version: Number(named.version), updated_at: String(named.updated_at) } : null, events, ge6: { amount: sum(ge6.map(r => r.amount)), transactions: ge6.length, items: ge6.slice(0, 100) }, transactions: historical.slice(0, 100), transactionCount: historical.length, importedAt: metadata.importedAt, ge6Status: JSON.parse(metadata.ge6Status || 'null') };
}
export async function logSearch(address: string) {
  const now = new Date().toISOString();
  await (await database()).execute({ sql: 'INSERT INTO search_log VALUES(?,1,?,?) ON CONFLICT(address) DO UPDATE SET count=count+1,last_at=excluded.last_at', args: [address, now, now] });
}
export type SearchEntry = { address: string; name: string | null; count: number; first_at: string; last_at: string };
export async function searchLog(limit = 500) {
  const db = await database();
  const [list, totals] = await db.batch([
    { sql: 'SELECT s.address,n.name,s.count,s.first_at,s.last_at FROM search_log s LEFT JOIN names n ON n.address=s.address ORDER BY s.last_at DESC LIMIT ?', args: [limit] },
    'SELECT count(*) addresses,coalesce(sum(count),0) searches FROM search_log',
  ], 'read');
  const entries = list.rows.map(r => ({ address: String(r.address), name: r.name == null ? null : String(r.name), count: Number(r.count), first_at: String(r.first_at), last_at: String(r.last_at) })) as SearchEntry[];
  return { entries, addresses: Number(totals.rows[0].addresses), searches: Number(totals.rows[0].searches) };
}
export async function findNames(query: string, limit = 8) {
  const q = query.normalize('NFC').trim().toLowerCase();
  if (!q) return [];
  const like = '%' + q.replace(/[!%_]/g, c => '!' + c) + '%';
  // Exact matches first, then names starting with the text, then the rest.
  const rows = (await (await database()).execute({ sql: "SELECT address,name FROM names WHERE lower(name) LIKE ? ESCAPE '!' ORDER BY lower(name)=? DESC,lower(name) LIKE ? ESCAPE '!' DESC,name LIMIT ?", args: [like, q, like.slice(1), limit] })).rows;
  return rows.map(r => ({ address: String(r.address), name: String(r.name) }));
}
