import { randomUUID } from 'node:crypto';
import { connect } from '../lib/database.mjs';
import { TokenXTransport } from '../lib/tokenx-transport.mjs';
import { initialize,poll,markError } from '../lib/ge6-indexer.mjs';
const db=connect();await initialize(db);
const owner=randomUUID();const transport=new TokenXTransport();
const acquire=await db.execute({sql:'INSERT INTO indexer_lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE indexer_lease.expires<?',args:[owner,Date.now()+90000,Date.now()]});
if(!acquire.rowsAffected){db.close();throw new Error('A web GE6 indexer is already running');}
let stopping=false,leaseLost=false;
const heartbeat=setInterval(()=>{
  db.execute({sql:'UPDATE indexer_lease SET expires=? WHERE id=1 AND owner=?',args:[Date.now()+90000,owner]}).then(result=>{if(!result.rowsAffected)leaseLost=true;},()=>{leaseLost=true;});
},20000);
async function assertLease(){const lease=(await db.execute('SELECT owner,expires FROM indexer_lease WHERE id=1')).rows[0];if(leaseLost||lease?.owner!==owner||Number(lease?.expires)<Date.now())throw new Error('Indexer lease lost');}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
try{
  do{
    try{const status=await poll(db,transport,{assertLease,onProgress:progress=>console.log(JSON.stringify({sync:progress}))});console.log(JSON.stringify(status));}
    catch(error){if(!stopping){console.error(String(error));if(!leaseLost)await markError(db,error);if(!process.argv.includes('--watch'))process.exitCode=1;}}
    if(leaseLost)break;
    if(process.argv.includes('--watch')&&!stopping)for(let i=0;i<10&&!stopping;i++)await new Promise(resolve=>setTimeout(resolve,1000));
  }while(process.argv.includes('--watch')&&!stopping);
}finally{clearInterval(heartbeat);await db.execute({sql:'DELETE FROM indexer_lease WHERE owner=?',args:[owner]});db.close();}
