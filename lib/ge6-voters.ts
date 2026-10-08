import { database } from './db';
import { amount, units } from './amount.mjs';
import { balances } from './balances';
import { tokenxGet } from './tokenx-transport.mjs';

const BNK='0xa992ad80fa6136702382123ae717890bc587491d';
const PAGE_SIZE=20;
type Ranked={address:string;voted:string;rank:number};
type Activity={date:string|null};
const activityCache=new Map<string,{until:number;value:Promise<Activity>}>();
let rankingCache:{until:number;value:Promise<Ranked[]>}|undefined;

async function ranking(){
  if(rankingCache&&rankingCache.until>Date.now())return rankingCache.value;
  const value=(async()=>{
    const rows=(await (await database()).execute("SELECT address,amount FROM ge6_events WHERE address IS NOT NULL")).rows;
    const totals=new Map<string,bigint>();
    for(const row of rows){
      const address=String(row.address).toLowerCase();
      if(!/^0x[0-9a-f]{40}$/.test(address))continue;
      totals.set(address,(totals.get(address)??0n)+units(String(row.amount)));
    }
    return [...totals].sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1)
      .map(([address,total],i)=>({address,voted:amount(total),rank:i+1}));
  })();
  rankingCache={until:Date.now()+60000,value};
  value.catch(()=>{if(rankingCache?.value===value)rankingCache=undefined;});
  return value;
}

async function latestBnk(address:string):Promise<Activity>{
  const hit=activityCache.get(address);if(hit&&hit.until>Date.now())return hit.value;
  const value=(async()=>{
    const response=await tokenxGet(`/addresses/${address}/token-transfers?type=ERC-20&token=${BNK}`) as {items?:{timestamp?:string;token?:{address?:string}}[]};
    if(!Array.isArray(response.items))throw new Error('Invalid token transfers response');
    const first=response.items.find(item=>item.token?.address?.toLowerCase()===BNK);
    return {date:first?.timestamp??null};
  })();
  activityCache.set(address,{until:Date.now()+300000,value});
  value.catch(()=>activityCache.delete(address));
  return value;
}

export async function ge6Voters(page=1){
  const ranked=await ranking();
  const pages=Math.max(1,Math.ceil(ranked.length/PAGE_SIZE));
  const current=Math.min(Math.max(1,page),pages);
  const slice=ranked.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
  const names=new Map<string,string>();
  if(slice.length){
    const result=await (await database()).execute({sql:`SELECT address,name FROM names WHERE address IN (${slice.map(()=>'?').join(',')})`,args:slice.map(r=>r.address)});
    for(const row of result.rows)names.set(String(row.address).toLowerCase(),String(row.name));
  }
  const result=Array<{
    rank:number;address:string;name:string|null;voted:string;bnk:string|null;ge6:string|null;bnkMovedAt:string|null;
  }>(slice.length);
  // Limit upstream requests while allowing the page to load promptly.
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(5,slice.length)},async()=>{
    while(cursor<slice.length){
      const index=cursor++;
      const row=slice[index];
      const [balance,activity]=await Promise.allSettled([balances(row.address),latestBnk(row.address)]);
      result[index]={...row,name:names.get(row.address)??null,
        bnk:balance.status==='fulfilled'?balance.value.balances.find(b=>b.symbol==='BNK')?.amount??null:null,
        ge6:balance.status==='fulfilled'?balance.value.balances.find(b=>b.symbol==='GE6')?.amount??null:null,
        bnkMovedAt:activity.status==='fulfilled'?activity.value.date:null};
    }
  }));
  return {rows:result,page:current,pages,total:ranked.length,fetchedAt:new Date().toISOString()};
}
