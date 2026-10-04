import { chromium } from 'playwright-core';
import { amount } from './amount.mjs';
const tokens=[{symbol:'BNK',address:'0xa992ad80fa6136702382123ae717890bc587491d'},{symbol:'GE6',address:'0x2f5c60bde7a5ebd2b116bb03cb5232fa1ea55f1c'}];
type Result={balances:{symbol:string;amount:string}[];fetchedAt:string};
const cache=new Map<string,{until:number;result:Result}>();
const pending=new Map<string,Promise<Result>>();
let busy=0;
export async function balances(address:string):Promise<Result> {
  const cached=cache.get(address); if(cached && cached.until>Date.now()) return cached.result;
  const existing=pending.get(address); if(existing)return existing;
  if(busy>=2)throw new Error('มีผู้ค้นหายอดเหรียญพร้อมกัน กรุณาลองอีกครั้ง');
  const job=fetchBalances(address); pending.set(address,job);
  try{return await job;}finally{pending.delete(address);}
}
async function fetchBalances(address:string):Promise<Result>{
  busy++;
  let browser;
  try {
    const url=`https://scan.tokenx.finance/api/v2/addresses/${address}/token-balances?_=${Date.now()}`;
    let rows:unknown;
    if(process.env.TOKENX_MODE==='api') {
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('TokenX unavailable'); rows=await response.json();
    }else{
      browser=await chromium.launch({headless:true,channel:process.env.TOKENX_BROWSER_PATH?undefined:(process.env.TOKENX_BROWSER_CHANNEL||'chrome'),executablePath:process.env.TOKENX_BROWSER_PATH||undefined});
      const page=await browser.newPage({locale:'th-TH',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
      const response=await page.goto('https://scan.tokenx.finance',{waitUntil:'domcontentloaded',timeout:25000});
      if(!response?.ok())throw new Error(`TokenX unavailable: HTTP ${response?.status()}`);
      rows=await page.evaluate(async (url)=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('TokenX unavailable');return r.json();},url);
    }
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
  }finally{busy--;await browser?.close();}
}
