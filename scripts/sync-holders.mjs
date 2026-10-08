// Snapshots every holder's balance of a token into token_holders, for the forecast's holdings views.
// Usage: node scripts/sync-holders.mjs ge6|bnk [--force]. Runs from the GE6 sync workflow; GE6 is
// refreshed when the last snapshot is over 4 minutes old, BNK over 30 minutes (--force skips the check).
// Only changed balances are written, keeping hosted-database writes small.
import { connect, initialize } from '../lib/database.mjs';
import { fetchAllHolders, tokens } from '../lib/token-holders.mjs';
const name=process.argv[2];
const token=tokens[name];
if(!token)throw new Error('Usage: sync-holders.mjs ge6|bnk [--force]');
const minAge={ge6:4,bnk:30}[name]*60000;
const db=connect();await initialize(db);
try{
  const last=(await db.execute({sql:'SELECT value FROM metadata WHERE key=?',args:[`${name}HoldersAt`]})).rows[0]?.value;
  if(!process.argv.includes('--force')&&last&&Date.now()-Date.parse(JSON.parse(String(last)))<minAge){console.log(`${name} snapshot is fresh, skipped`);}
  else{
    const holders=await fetchAllHolders(token,{partialOk:true});
    const stored=new Map((await db.execute({sql:'SELECT address,value FROM token_holders WHERE token=?',args:[token]})).rows.map(r=>[String(r.address),String(r.value)]));
    const statements=[];
    for(const [address,value] of holders)if(stored.get(address)!==value.toString())statements.push({sql:'INSERT OR REPLACE INTO token_holders VALUES(?,?,?)',args:[token,address,value.toString()]});
    // A partial walk misses only the smallest balances, so keep their last known values.
    if(holders.complete)for(const address of stored.keys())if(!holders.has(address))statements.push({sql:'DELETE FROM token_holders WHERE token=? AND address=?',args:[token,address]});
    for(let start=0;start<statements.length;start+=500)await db.batch(statements.slice(start,start+500),'write');
    await db.execute({sql:'INSERT OR REPLACE INTO metadata VALUES(?,?)',args:[`${name}HoldersAt`,JSON.stringify(new Date().toISOString())]});
    console.log(JSON.stringify({token:name,holders:holders.size,complete:holders.complete,changed:statements.length}));
  }
}finally{db.close();}
