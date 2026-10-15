import { database } from './db';
import { officialWallets } from './leaderboards';
import { tokens } from './token-holders.mjs';

// Read the latest completed holder scan from the database. The header's Sync
// button updates both token snapshots before reloading the page.
// GE6 balances of every holder except official wallets.
export function ge6HeldBalances(){
  return (async()=>{
    const rows=(await (await database()).execute({sql:'SELECT address,value FROM token_holders WHERE token=?',args:[tokens.ge6]})).rows;
    const balances=new Map<string,bigint>();
    for(const row of rows){const address=String(row.address);if(!officialWallets.has(address))balances.set(address,BigInt(String(row.value)));}
    return balances;
  })();
}

// BNK balances for the given wallets.
export async function bnkHeldBalances(addresses:string[]){
  const balances=new Map<string,bigint>();
  const statements=[];
  for(let start=0;start<addresses.length;start+=100){
    const slice=addresses.slice(start,start+100);
    statements.push({sql:`SELECT address,value FROM token_holders WHERE token=? AND address IN (${slice.map(()=>'?').join(',')})`,args:[tokens.bnk,...slice]});
  }
  // One round trip for every chunk instead of one per chunk.
  if(statements.length)for(const result of await (await database()).batch(statements,'read'))
    for(const row of result.rows)balances.set(String(row.address),BigInt(String(row.value)));
  return balances;
}
