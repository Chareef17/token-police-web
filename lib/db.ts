import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { sum } from './amount.mjs';
const dir = () => resolve(/* turbopackIgnore: true */ process.env.TOKENPOLICE_DATA || './data');
export type Vote = { id: string; event: string; member: string; amount: string; tx_hash: string | null; voted_at: string | null };
export function namesDb() {
  mkdirSync(dir(), { recursive: true });
  const db = new DatabaseSync(join(dir(), 'names.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS names(address TEXT PRIMARY KEY,name TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS name_history(id INTEGER PRIMARY KEY,address TEXT,name TEXT,updated_at TEXT);
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,started INTEGER,count INTEGER);`);
  return db;
}
export function getName(address: string) {
  const db=namesDb();
  try { return db.prepare('SELECT name,version,updated_at FROM names WHERE address=?').get(address) as {name:string;version:number;updated_at:string}|undefined; }
  finally { db.close(); }
}
export function wallet(address: string) {
  const file=join(dir(),'votes.sqlite');
  if (!existsSync(file)) throw new Error('ยังไม่ได้นำเข้าข้อมูลโหวต');
  const db=new DatabaseSync(file,{readOnly:true});
  try {
    db.exec('BEGIN');
    const rows=db.prepare('SELECT id,event,member,amount,tx_hash,voted_at FROM votes WHERE address=? OR wallet=? ORDER BY voted_at DESC,id DESC').all(address,address) as Vote[];
    const metadata=Object.fromEntries(db.prepare('SELECT key,value FROM metadata').all().map(r=>[String(r.key),String(r.value)]));
    const groups=new Map<string,Map<string,string[]>>();
    for(const row of rows.filter(r=>r.event!=='GE6')) {
      if(!groups.has(row.event)) groups.set(row.event,new Map());
      const members=groups.get(row.event)!;
      members.set(row.member,[...(members.get(row.member)||[]),row.amount]);
    }
    const events=[...groups].map(([event,members])=>({event,total:sum([...members.values()].flat()),members:[...members].map(([member,amounts])=>({member,amount:sum(amounts),transactions:amounts.length}))}));
    const ge6=rows.filter(r=>r.event==='GE6');
    const historical=rows.filter(r=>r.event!=='GE6');
    return {address,name:getName(address)||null,events,ge6:{amount:sum(ge6.map(r=>r.amount)),transactions:ge6.length,items:ge6.slice(0,100)},transactions:historical.slice(0,100),transactionCount:historical.length,importedAt:metadata.importedAt,ge6Status:JSON.parse(metadata.ge6Status||'null')};
  } finally { db.close(); }
}
