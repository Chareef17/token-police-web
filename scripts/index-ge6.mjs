import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TokenXTransport } from '../lib/tokenx-transport.mjs';
import { initialize,poll,markError } from '../lib/ge6-indexer.mjs';
const dir=resolve(process.env.TOKENPOLICE_DATA||'./data');mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(join(dir,'votes.sqlite'));initialize(db);
const owner=randomUUID();const transport=new TokenXTransport();
const acquire=db.prepare('INSERT INTO indexer_lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE indexer_lease.expires<?').run(owner,Date.now()+90000,Date.now());
if(!acquire.changes){db.close();throw new Error('A web GE6 indexer is already running');}
let stopping=false,leaseLost=false;
const heartbeat=setInterval(()=>{
  try{const result=db.prepare('UPDATE indexer_lease SET expires=? WHERE id=1 AND owner=?').run(Date.now()+90000,owner);if(!result.changes)leaseLost=true;}catch{leaseLost=true;}
},20000);
function assertLease(){const lease=db.prepare('SELECT owner,expires FROM indexer_lease WHERE id=1').get();if(leaseLost||lease?.owner!==owner||Number(lease?.expires)<Date.now())throw new Error('Indexer lease lost');}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;void transport.close();});
try{
  do{
    try{const status=await poll(db,transport,{assertLease,onProgress:progress=>console.log(JSON.stringify({sync:progress}))});console.log(JSON.stringify(status));}
    catch(error){if(!stopping){console.error(String(error));if(!leaseLost)markError(db,error);if(!process.argv.includes('--watch'))process.exitCode=1;}await transport.close();}
    if(leaseLost)break;
    if(process.argv.includes('--watch')&&!stopping)for(let i=0;i<10&&!stopping;i++)await new Promise(resolve=>setTimeout(resolve,1000));
  }while(process.argv.includes('--watch')&&!stopping);
}finally{clearInterval(heartbeat);await transport.close();db.prepare('DELETE FROM indexer_lease WHERE owner=?').run(owner);db.close();}
