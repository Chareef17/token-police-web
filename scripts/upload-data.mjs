// Copies the local data/votes.sqlite (votes, metadata, GE6 events, names) into the hosted Turso database.
// Usage: put TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local, then `pnpm upload-data`.
import { connect,initialize } from '../lib/database.mjs';
if(!process.env.TURSO_DATABASE_URL)throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local first');
const dir=(process.env.TOKENPOLICE_DATA||'./data').replace(/\\/g,'/');
const local=connect('file:'+dir+'/votes.sqlite');
const remote=connect();
await initialize(remote);
const tables=['votes','metadata','ge6_events','names','name_history'];
for(const table of tables){
  const exists=(await local.execute({sql:"SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",args:[table]})).rows.length;
  if(!exists){console.log(`${table}: not in local database, skipped`);continue;}
  const {rows,columns}=await local.execute(`SELECT * FROM ${table}`);
  const insert=`INSERT OR REPLACE INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`;
  for(let i=0;i<rows.length;i+=500){
    await remote.batch(rows.slice(i,i+500).map(row=>({sql:insert,args:columns.map(c=>row[c])})),'write');
    process.stdout.write(`\r${table}: ${Math.min(i+500,rows.length)}/${rows.length}`);
  }
  const count=(await remote.execute(`SELECT count(*) n FROM ${table}`)).rows[0].n;
  console.log(`\r${table}: ${rows.length} rows uploaded, ${count} in Turso`);
}
local.close();remote.close();
