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
