import { tokenxHeaders } from './tokenx-transport.mjs';
// Every holder of an ERC-20 token on TokenX Scan, as Map<address, raw balance>.
export const tokens={ge6:'0x2f5c60bde7a5ebd2b116bb03cb5232fa1ea55f1c',bnk:'0xa992ad80fa6136702382123ae717890bc587491d'};
const addressPattern=/^0x[0-9a-f]{40}$/;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function readPage(token,cursor){
  const url=new URL(`https://scan.tokenx.finance/api/v2/tokens/${token}/holders`);
  for(const [key,value] of Object.entries(cursor??{}))if(key!=='_')url.searchParams.set(key,String(value));
  url.searchParams.set('_',Date.now()+'-'+Math.random());
  const response=await fetch(url.href,{headers:tokenxHeaders,cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`TokenX holders HTTP ${response.status}`);
  // Cursor values exceed Number precision; keep them as the exact digits the explorer sent.
  return JSON.parse(await response.text(),(key,value,context)=>typeof value==='number'&&!Number.isSafeInteger(value)?context.source:value);
}
// With partialOk, a page the explorer keeps serving stale ends the walk early: holders are sorted by
// balance, so only the smallest balances are missing; the returned Map then has complete=false.
export async function fetchAllHolders(token,{maxPages=400,exclude=new Set(),partialOk=false}={}){
  const balances=new Map();const seen=new Set();
  // The explorer's own holder count guards against a walk that ends early but looks finished.
  const info=await fetch(`https://scan.tokenx.finance/api/v2/tokens/${token}`,{headers:tokenxHeaders,cache:'no-store',signal:AbortSignal.timeout(20000)}).then(r=>r.ok?r.json():null).catch(()=>null);
  const expected=Number(info?.holders)||0;
  let cursor=null,previousLast=null;
  for(let page=0;page<maxPages;page++){
    let result;
    // This explorer occasionally serves the preceding page for a fresh cursor, sometimes several times in a row.
    for(let attempt=0;attempt<10;attempt++){
      if(page||attempt)await pause(attempt?600*attempt:300);
      const candidate=await readPage(token,cursor);
      const first=candidate.items?.[0]?.address?.hash?.toLowerCase();
      if(!candidate.items?.length||first===previousLast||!first||seen.has(first))continue;
      // It also sometimes returns a short page with no next cursor long before the real end.
      const endsTooEarly=!candidate.next_page_params&&seen.size+candidate.items.length<expected*0.98;
      result=candidate;
      if(!endsTooEarly)break;
    }
    if(!result?.items?.length){if(partialOk&&balances.size){balances.complete=false;return balances;}throw new Error('TokenX holders pagination repeated or empty');}
    for(const item of result.items){
      const address=String(item.address?.hash).toLowerCase();
      if(!addressPattern.test(address)||!/^\d+$/.test(item.value??''))throw new Error('Invalid holder balance');
      // Holders with equal balances can reappear across page boundaries; keep the first sighting.
      if(seen.has(address))continue;
      seen.add(address);
      if(!exclude.has(address))balances.set(address,BigInt(item.value));
    }
    previousLast=result.items.at(-1).address.hash.toLowerCase();
    if(!result.next_page_params){
      balances.complete=seen.size>=expected*0.98;
      if(!balances.complete&&!partialOk)throw new Error(`TokenX holders ended early: ${seen.size} of ${expected}`);
      return balances;
    }
    cursor=result.next_page_params;
  }
  throw new Error(`TokenX holders pagination exceeded ${maxPages} pages`);
}
