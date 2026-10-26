import { database } from './db';
import { amount, units } from './amount.mjs';
import { balances } from './balances';
import { tokenxGet } from './tokenx-transport.mjs';
import { ge6Candidates } from './ge6-candidates';

const PAGE_SIZE=20;
const memberVoteEvents=new Set(['GE3','GE4','GE5','Songkran 2024','365-Nichi 2024','Thai-Japan 2026','Thai-Chinese 2025']);
const likelyVoteEvents=new Set(['GE5','Thai-Japan 2026','Thai-Chinese 2025']);
const chinesePrice=6n;
const otherPrice=68n;
type Ranked={address:string;voted:string;rank:number};
type Activity={date:string|null};
export type VoterDetails={name:string|null;bnk:string|null;ge6:string|null;lastTxAt:string|null;likely:string[];topVote:string|null};
async function ranking(){
  return (async()=>{
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
}

async function latestTransaction(address:string):Promise<Activity>{
  return (async()=>{
    const response=await tokenxGet(`/addresses/${address}/transactions?filter=from`) as {items?:{timestamp?:string;from?:{hash?:string}}[]};
    if(!Array.isArray(response.items))throw new Error('Invalid transactions response');
    const first=response.items.find(item=>item.from?.hash?.toLowerCase()===address);
    return {date:first?.timestamp??null};
  })();
}

export async function voterDetails(addresses:string[]):Promise<Map<string,VoterDetails>>{
  const unique=[...new Set(addresses.map(address=>address.toLowerCase()))];
  const names=new Map<string,string>();
  const manual=new Map<string,string[]>();
  const preferences=new Map<string,{likely:string[];topVote:string|null}>();
  if(unique.length){
    const db=await database();
    const overall=new Map<string,Map<string,bigint>>();
    const likelyTotals=new Map<string,Map<string,bigint>>();
    // Members this wallet's GE6 transactions were assigned to by hand.
    const assigned=new Map<string,Map<string,bigint>>();
    for(let start=0;start<unique.length;start+=100){
      const slice=unique.slice(start,start+100),placeholders=slice.map(()=>'?').join(',');
      const [nameRows,voteRows,manualRows,assignedRows]=await db.batch([
        {sql:`SELECT address,name FROM names WHERE address IN (${placeholders})`,args:slice},
        {sql:`SELECT address,event,member,amount FROM votes WHERE event IN (${[...memberVoteEvents].map(()=>'?').join(',')}) AND address IN (${placeholders})`,args:[...memberVoteEvents,...slice]},
        {sql:`SELECT address,rank1,rank2,rank3 FROM manual_predictions WHERE address IN (${placeholders})`,args:slice},
        {sql:`SELECT e.address,a.member,e.amount FROM ge6_vote_assignments a JOIN ge6_events e ON e.tx_hash=a.tx_hash AND e.log_index=a.log_index WHERE a.member<>'' AND e.address IN (${placeholders})`,args:slice},
      ],'read');
      for(const row of nameRows.rows)names.set(String(row.address).toLowerCase(),String(row.name));
      for(const row of manualRows.rows){
        const members=[row.rank1,row.rank2,row.rank3].filter(v=>v!=null).map(String);
        if(members.length>0)manual.set(String(row.address).toLowerCase(),members);
      }
      for(const row of assignedRows.rows){
        const address=String(row.address).toLowerCase();
        const members=assigned.get(address)??new Map<string,bigint>();assigned.set(address,members);
        members.set(String(row.member),(members.get(String(row.member))??0n)+units(String(row.amount)));
      }
      for(const row of voteRows.rows){
        const address=String(row.address).toLowerCase(),event=String(row.event),member=String(row.member).trim();
        if(!member||member==='Unknown')continue;
        // Compare historical support at an estimated baht value; keep integer precision.
        const value=units(String(row.amount))*(event==='Thai-Chinese 2025'?chinesePrice:otherPrice);
        const members=overall.get(address)??new Map<string,bigint>();overall.set(address,members);
        members.set(member,(members.get(member)??0n)+value);
        if(likelyVoteEvents.has(event)&&ge6Candidates.has(member.toLowerCase())){
          const candidates=likelyTotals.get(address)??new Map<string,bigint>();likelyTotals.set(address,candidates);
          candidates.set(member,(candidates.get(member)??0n)+value);
        }
      }
    }
    const sorted=(entries:[string,bigint][])=>entries.sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1);
    for(const address of unique){
      const sortedVotes=sorted([...(overall.get(address)??new Map())]);
      const likely=sorted([...(assigned.get(address)??likelyTotals.get(address)??new Map())]).slice(0,3).map(([member])=>member);
      const topVote=sortedVotes[0]?.[0]??null;
      preferences.set(address,{likely,topVote});
    }
  }
  const result=new Map<string,VoterDetails>();
  // Limit upstream requests while allowing the page to load promptly.
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(5,unique.length)},async()=>{
    while(cursor<unique.length){
      const index=cursor++;
      const address=unique[index];
      const [balance,activity]=await Promise.allSettled([balances(address),latestTransaction(address)]);
      result.set(address,{name:names.get(address)??null,likely:manual.get(address)??preferences.get(address)?.likely??[],topVote:preferences.get(address)?.topVote??null,
        bnk:balance.status==='fulfilled'?balance.value.balances.find(b=>b.symbol==='BNK')?.amount??null:null,
        ge6:balance.status==='fulfilled'?balance.value.balances.find(b=>b.symbol==='GE6')?.amount??null:null,
        lastTxAt:activity.status==='fulfilled'?activity.value.date:null});
    }
  }));
  return result;
}

export async function ge6Voters(page=1){
  const ranked=await ranking();
  const pages=Math.max(1,Math.ceil(ranked.length/PAGE_SIZE));
  const current=Math.min(Math.max(1,page),pages);
  const slice=ranked.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
  const details=await voterDetails(slice.map(row=>row.address));
  const result=slice.map(row=>({...row,...details.get(row.address)!}));
  return {rows:result,page:current,pages,total:ranked.length,fetchedAt:new Date().toISOString()};
}
