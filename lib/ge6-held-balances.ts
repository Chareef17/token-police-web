import { tokenxHeaders } from './tokenx-transport.mjs';
import { officialWallets } from './leaderboards';

const token='0x2f5c60bde7a5ebd2b116bb03cb5232fa1ea55f1c';
const endpoint=`https://scan.tokenx.finance/api/v2/tokens/${token}/holders`;
const addressPattern=/^0x[0-9a-f]{40}$/;
type HolderPage={items?:{address?:{hash?:string};value?:string}[];next_page_params?:Record<string,string|number>|null};
let cache:{until:number;value:Promise<Map<string,bigint>>}|undefined;

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function readPage(cursor:Record<string,string|number>|null):Promise<HolderPage>{
  const url=new URL(endpoint);
  for(const [key,value] of Object.entries(cursor??{}))if(key!=='_')url.searchParams.set(key,String(value));
  const response=await fetch(url.href,{headers:tokenxHeaders,cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`TokenX holders HTTP ${response.status}`);
  return response.json();
}

async function loadHolders(){
  const balances=new Map<string,bigint>();
  const seen=new Set<string>();
  let cursor:Record<string,string|number>|null=null;
  let previousLast:string|null=null;
  for(let page=0;page<100;page++){
    let result:HolderPage|undefined;
    // This explorer occasionally serves the preceding page for a fresh cursor.
    for(let attempt=0;attempt<5;attempt++){
      if(page||attempt)await pause(800);
      const candidate=await readPage(cursor);
      const first=candidate.items?.[0]?.address?.hash?.toLowerCase();
      if(candidate.items?.length&&first!==previousLast&&first&&!seen.has(first)){result=candidate;break;}
    }
    if(!result?.items?.length)throw new Error('TokenX holders pagination repeated or empty');
    for(const item of result.items){
      const address=String(item.address?.hash).toLowerCase();
      if(!addressPattern.test(address)||!/^\d+$/.test(item.value??''))throw new Error('Invalid GE6 holder balance');
      if(seen.has(address))throw new Error('Duplicate GE6 holder across pages');
      seen.add(address);
      if(!officialWallets.has(address))balances.set(address,BigInt(item.value!));
    }
    previousLast=result.items.at(-1)!.address!.hash!.toLowerCase();
    if(!result.next_page_params)return balances;
    cursor=result.next_page_params;
  }
  throw new Error('TokenX holders pagination exceeded 100 pages');
}

export function ge6HeldBalances(){
  if(cache&&cache.until>Date.now())return cache.value;
  const value=loadHolders();
  cache={until:Date.now()+300000,value};
  value.catch(()=>{if(cache?.value===value)cache=undefined;});
  return value;
}
