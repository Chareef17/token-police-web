import { mkdirSync, writeFileSync } from 'node:fs';
import { connect, initialize } from '../lib/database.mjs';
import { poll } from '../lib/ge6-indexer.mjs';
import { TokenXTransport } from '../lib/tokenx-transport.mjs';

const cutoffs={'2026-10-30':'2026-10-30T05:00:00.000Z','2026-10-31':'2026-10-31T05:00:00.000Z'};
const day=process.argv[2],cutoff=cutoffs[day];
if(!cutoff)throw new Error('Specify 2026-10-30 or 2026-10-31');
if(Date.now()<Date.parse(cutoff))throw new Error('Cutoff has not passed');
// This emergency backup deliberately uses a fresh local SQLite file. Turso can be
// unavailable or over quota, but the chain's vote logs are still public.
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const db=connect();
try{
  await initialize(db);
  const status=await poll(db,new TokenXTransport(),{onProgress:progress=>console.log(JSON.stringify(progress))});
  const head=await new TokenXTransport().get(`/blocks/${status.confirmedBlock}`);
  if(Date.parse(head.timestamp)<Date.parse(cutoff))throw new Error('Confirmed chain head is before cutoff');
  const rows=(await db.execute({sql:'SELECT tx_hash,log_index,block_number,block_hash,vote_index,address,amount,voted_at FROM ge6_events WHERE julianday(voted_at)<=julianday(?) ORDER BY block_number,log_index',args:[cutoff]})).rows;
  const events=rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value])));
  mkdirSync('snapshot-backup',{recursive:true});
  const file=`snapshot-backup/ge6-transactions-${day}.json`;
  writeFileSync(file,JSON.stringify({cutoff,capturedAt:new Date().toISOString(),confirmedBlock:status.confirmedBlock,transactionCount:events.length,events}));
  console.log(JSON.stringify({file,transactions:events.length}));
}finally{db.close();}
