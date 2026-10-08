// Snapshots every BNK holder's balance into token_holders for the forecast's "+ GE6 + BNK" view.
// Runs from the GE6 sync workflow; skips when the last snapshot is under 30 minutes old (use --force).
// Only changed balances are written, keeping hosted-database writes small.
import { connect, initialize } from '../lib/database.mjs';
import { fetchAllHolders, tokens } from '../lib/token-holders.mjs';
const db=connect();await initialize(db);
try{
  const last=(await db.execute("SELECT value FROM metadata WHERE key='bnkHoldersAt'")).rows[0]?.value;
  if(!process.argv.includes('--force')&&last&&Date.now()-Date.parse(JSON.parse(String(last)))<30*60000){console.log('BNK snapshot is fresh, skipped');}
  else{
    const holders=await fetchAllHolders(tokens.bnk,{partialOk:true});
    const stored=new Map((await db.execute({sql:'SELECT address,value FROM token_holders WHERE token=?',args:[tokens.bnk]})).rows.map(r=>[String(r.address),String(r.value)]));
    const statements=[];
    for(const [address,value] of holders)if(stored.get(address)!==value.toString())statements.push({sql:'INSERT OR REPLACE INTO token_holders VALUES(?,?,?)',args:[tokens.bnk,address,value.toString()]});
    // A partial walk misses only the smallest balances, so keep their last known values.
    if(holders.complete)for(const address of stored.keys())if(!holders.has(address))statements.push({sql:'DELETE FROM token_holders WHERE token=? AND address=?',args:[tokens.bnk,address]});
    for(let start=0;start<statements.length;start+=500)await db.batch(statements.slice(start,start+500),'write');
    await db.execute({sql:"INSERT OR REPLACE INTO metadata VALUES('bnkHoldersAt',?)",args:[JSON.stringify(new Date().toISOString())]});
    console.log(JSON.stringify({bnkHolders:holders.size,complete:holders.complete,changed:statements.length}));
  }
}finally{db.close();}
