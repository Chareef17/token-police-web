import { database } from './db';
import { officialWallets } from './leaderboards';
import { tokens } from './token-holders.mjs';

// Holder balances come from the token_holders snapshot that `pnpm sync:holders` refreshes
// (GE6 every 5 minutes, BNK every 30 minutes), so pages never wait on TokenX.
let ge6Cache:{until:number;value:Promise<Map<string,bigint>>}|undefined;

// GE6 balances of every holder except official wallets.
export function ge6HeldBalances(){
  if(ge6Cache&&ge6Cache.until>Date.now())return ge6Cache.value;
  const value=(async()=>{
    const rows=(await (await database()).execute({sql:'SELECT address,value FROM token_holders WHERE token=?',args:[tokens.ge6]})).rows;
    const balances=new Map<string,bigint>();
    for(const row of rows){const address=String(row.address);if(!officialWallets.has(address))balances.set(address,BigInt(String(row.value)));}
    return balances;
  })();
  ge6Cache={until:Date.now()+60000,value};
  value.catch(()=>{if(ge6Cache?.value===value)ge6Cache=undefined;});
  return value;
}

// BNK balances for the given wallets.
export async function bnkHeldBalances(addresses:string[]){
  const db=await database();const balances=new Map<string,bigint>();
  for(let start=0;start<addresses.length;start+=100){
    const slice=addresses.slice(start,start+100);
    const rows=(await db.execute({sql:`SELECT address,value FROM token_holders WHERE token=? AND address IN (${slice.map(()=>'?').join(',')})`,args:[tokens.bnk,...slice]})).rows;
    for(const row of rows)balances.set(String(row.address),BigInt(String(row.value)));
  }
  return balances;
}
