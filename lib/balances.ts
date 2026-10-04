import { amount } from './amount.mjs';
import { tokenxGet } from './tokenx-transport.mjs';
const tokens=[{symbol:'BNK',address:'0xa992ad80fa6136702382123ae717890bc587491d'},{symbol:'GE6',address:'0x2f5c60bde7a5ebd2b116bb03cb5232fa1ea55f1c'}];
type Result={balances:{symbol:string;amount:string}[];fetchedAt:string};
const cache=new Map<string,{until:number;result:Result}>();
const pending=new Map<string,Promise<Result>>();
export async function balances(address:string):Promise<Result> {
  const cached=cache.get(address); if(cached && cached.until>Date.now()) return cached.result;
  const existing=pending.get(address); if(existing)return existing;
  const job=fetchBalances(address); pending.set(address,job);
  try{return await job;}finally{pending.delete(address);}
}
async function fetchBalances(address:string):Promise<Result>{
  const rows:unknown=await tokenxGet(`/addresses/${address}/token-balances`);
  if(!Array.isArray(rows))throw new Error('Invalid balance response');
  const list=rows as {token?:{address?:string;decimals?:string;type?:string};value?:string}[];
  const result={balances:tokens.map(token=>{
    const matches=list.filter(r=>r.token?.address?.toLowerCase()===token.address);
    if(matches.length>1)throw new Error('Duplicate balance');
    if(!matches.length)return {symbol:token.symbol,amount:'0'};
    const row=matches[0];
    if(row.token?.type!=='ERC-20'||String(row.token.decimals)!=='18'||!/^\d+$/.test(row.value||''))throw new Error('Invalid balance');
    return {symbol:token.symbol,amount:amount(BigInt(row.value!))};
  }),fetchedAt:new Date().toISOString()};
  if(cache.size>=300)cache.delete(cache.keys().next().value!);
  cache.set(address,{until:Date.now()+60000,result});return result;
}
