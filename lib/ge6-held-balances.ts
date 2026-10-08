import { database } from './db';
import { officialWallets } from './leaderboards';
import { fetchAllHolders, tokens } from './token-holders.mjs';

let cache:{until:number;value:Promise<Map<string,bigint>>}|undefined;

// Live GE6 balances of every holder except official wallets, cached for 5 minutes.
export function ge6HeldBalances(){
  if(cache&&cache.until>Date.now())return cache.value;
  const value=fetchAllHolders(tokens.ge6,{maxPages:100,exclude:officialWallets,partialOk:true}) as Promise<Map<string,bigint>>;
  cache={until:Date.now()+300000,value};
  value.catch(()=>{if(cache?.value===value)cache=undefined;});
  return value;
}

// BNK balances for the given wallets, from the snapshot `pnpm sync:bnk` keeps in the database.
export async function bnkHeldBalances(addresses:string[]){
  const db=await database();const balances=new Map<string,bigint>();
  for(let start=0;start<addresses.length;start+=100){
    const slice=addresses.slice(start,start+100);
    const rows=(await db.execute({sql:`SELECT address,value FROM token_holders WHERE token=? AND address IN (${slice.map(()=>'?').join(',')})`,args:[tokens.bnk,...slice]})).rows;
    for(const row of rows)balances.set(String(row.address),BigInt(String(row.value)));
  }
  return balances;
}
