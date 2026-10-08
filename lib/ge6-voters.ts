import { database } from './db';
import { amount, units } from './amount.mjs';
import { balances } from './balances';
import { tokenxGet } from './tokenx-transport.mjs';

const PAGE_SIZE=20;
const topVoteEvents=new Set(['GE4','GE5','Thai-Japan 2026','Thai-Chinese 2025']);
type Ranked={address:string;voted:string;rank:number};
type Activity={date:string|null};
type Candidate={member:string;amount:string};
type EventWinner=Candidate&{event:string};
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

async function latestTransaction(address:string):Promise<Activity>{
  const hit=activityCache.get(address);if(hit&&hit.until>Date.now())return hit.value;
  const value=(async()=>{
    const response=await tokenxGet(`/addresses/${address}/transactions?filter=from`) as {items?:{timestamp?:string;from?:{hash?:string}}[]};
    if(!Array.isArray(response.items))throw new Error('Invalid transactions response');
    const first=response.items.find(item=>item.from?.hash?.toLowerCase()===address);
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
  const preferences=new Map<string,{likely:Candidate[];topVote:EventWinner|null}>();
  if(slice.length){
    const placeholders=slice.map(()=>'?').join(',');
    const db=await database();
    const [nameRows,voteRows]=await db.batch([
      {sql:`SELECT address,name FROM names WHERE address IN (${placeholders})`,args:slice.map(r=>r.address)},
      {sql:`SELECT address,event,member,amount FROM votes WHERE event!='GE6' AND address IN (${placeholders})`,args:slice.map(r=>r.address)},
    ],'read');
    for(const row of nameRows.rows)names.set(String(row.address).toLowerCase(),String(row.name));
    const overall=new Map<string,Map<string,bigint>>();
    const byEvent=new Map<string,Map<string,bigint>>();
    for(const row of voteRows.rows){
      const address=String(row.address).toLowerCase(),event=String(row.event),member=String(row.member).trim();
      if(!member||member==='Unknown')continue;
      const value=units(String(row.amount));
      const members=overall.get(address)??new Map<string,bigint>();overall.set(address,members);
      members.set(member,(members.get(member)??0n)+value);
      if(topVoteEvents.has(event)){
        const key=address+'|'+event;
        const eventMembers=byEvent.get(key)??new Map<string,bigint>();byEvent.set(key,eventMembers);
        eventMembers.set(member,(eventMembers.get(member)??0n)+value);
      }
    }
    const sorted=(entries:[string,bigint][])=>entries.sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1);
    for(const row of slice){
      const likely=sorted([...(overall.get(row.address)??new Map())]).slice(0,3).map(([member,value])=>({member,amount:amount(value)}));
      let topVote:EventWinner|null=null;let topAmount=-1n;
      for(const event of topVoteEvents){
        const winner=sorted([...(byEvent.get(row.address+'|'+event)??new Map())])[0];
        if(winner&&winner[1]>topAmount){topAmount=winner[1];topVote={event,member:winner[0],amount:amount(winner[1])};}
      }
      preferences.set(row.address,{likely,topVote});
    }
  }
  const result=Array<{
    rank:number;address:string;name:string|null;voted:string;bnk:string|null;ge6:string|null;lastTxAt:string|null;likely:Candidate[];topVote:EventWinner|null;
  }>(slice.length);
  // Limit upstream requests while allowing the page to load promptly.
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(5,slice.length)},async()=>{
    while(cursor<slice.length){
      const index=cursor++;
      const row=slice[index];
      const [balance,activity]=await Promise.allSettled([balances(row.address),latestTransaction(row.address)]);
      result[index]={...row,name:names.get(row.address)??null,likely:preferences.get(row.address)?.likely??[],topVote:preferences.get(row.address)?.topVote??null,
        bnk:balance.status==='fulfilled'?balance.value.balances.find(b=>b.symbol==='BNK')?.amount??null:null,
        ge6:balance.status==='fulfilled'?balance.value.balances.find(b=>b.symbol==='GE6')?.amount??null:null,
        lastTxAt:activity.status==='fulfilled'?activity.value.date:null};
    }
  }));
  return {rows:result,page:current,pages,total:ranked.length,fetchedAt:new Date().toISOString()};
}
