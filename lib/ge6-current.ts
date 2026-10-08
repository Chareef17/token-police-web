import { database } from './db';
import { units, amount } from './amount.mjs';
import { ge6CandidateByName, ge6CandidateNames } from './ge6-candidates';
import { makeRanking, splitVote } from './ge6-current-model.mjs';
import { ge6HeldBalances } from './ge6-held-balances';
import preliminary from './ge6-prelim-2026-10-03.json';

const events = ['GE5','Thai-Japan 2026','Thai-Chinese 2025'];
const addressPattern = /^0x[0-9a-f]{40}$/;

export async function ge6CurrentRanking(includeHoldings=false) {
  const heldPromise=includeHoldings?ge6HeldBalances():Promise.resolve(new Map<string,bigint>());
  const db = await database();
  const votes = (await db.execute({sql:'SELECT address,amount,voted_at FROM ge6_events WHERE julianday(voted_at)>julianday(?)',args:[preliminary.cutoff]})).rows;
  const wallets = new Map<string,bigint>();
  let lastVoteAt: string | null = null;
  for (const row of votes) {
    const address = String(row.address).toLowerCase();
    if (!addressPattern.test(address)) continue;
    wallets.set(address,(wallets.get(address)??0n)+units(String(row.amount)));
    const at = String(row.voted_at);
    if (!lastVoteAt || Date.parse(at)>Date.parse(lastVoteAt)) lastVoteAt=at;
  }
  const heldBalances=await heldPromise;
  const addresses = [...new Set([...wallets.keys(),...heldBalances.keys()])];
  const historical = new Map<string,Map<string,bigint>>();
  const manual = new Map<string,string[]>();
  // Keep each query below SQLite's bind-variable limit and fetch only wallets that voted after the cutoff.
  for (let start=0;start<addresses.length;start+=100) {
    const slice=addresses.slice(start,start+100);
    const placeholders=slice.map(()=>'?').join(',');
    const [voteRows,manualRows]=await db.batch([
      {sql:`SELECT address,event,member,amount FROM votes WHERE event IN (?,?,?) AND address IN (${placeholders})`,args:[...events,...slice]},
      {sql:`SELECT address,rank1,rank2,rank3 FROM manual_predictions WHERE address IN (${placeholders})`,args:slice},
    ],'read');
    for (const row of voteRows.rows) {
      const address=String(row.address).toLowerCase();
      const member=ge6CandidateByName.get(String(row.member).trim().toLowerCase());
      if (!member) continue;
      const value=units(String(row.amount))*(row.event==='Thai-Chinese 2025'?6n:68n);
      const totals=historical.get(address)??new Map<string,bigint>();
      totals.set(member,(totals.get(member)??0n)+value);
      historical.set(address,totals);
    }
    for (const row of manualRows.rows) {
      const names=[row.rank1,row.rank2,row.rank3].filter(value=>value!=null)
        .map(value=>ge6CandidateByName.get(String(value).toLowerCase())).filter((value):value is NonNullable<typeof value>=>Boolean(value));
      if (names.length) manual.set(String(row.address).toLowerCase(),names);
    }
  }
  const additions=new Map<string,bigint>();
  const heldAdditions=new Map<string,bigint>();
  let allocated=0n,unassigned=0n,manualWallets=0;
  let heldAllocated=0n,heldUnassigned=0n;
  const choicesFor=(address:string)=>{
    const preferred=manual.get(address);
    return preferred??[...(historical.get(address)??new Map())]
      .sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1)
      .slice(0,3).map(([name])=>name);
  };
  for (const [address,total] of wallets) {
    if(manual.has(address))manualWallets++;
    const choices=choicesFor(address);
    if (!choices.length) {unassigned+=total;continue;}
    allocated+=total;
    for (const [name,share] of splitVote(total,choices)) additions.set(name,(additions.get(name)??0n)+share);
  }
  for(const [address,total] of heldBalances){
    const choices=choicesFor(address);
    if(!choices.length){heldUnassigned+=total;continue;}
    heldAllocated+=total;
    for(const [name,share] of splitVote(total,choices))heldAdditions.set(name,(heldAdditions.get(name)??0n)+share);
  }
  const combined=new Map(additions);
  for(const [name,share] of heldAdditions)combined.set(name,(combined.get(name)??0n)+share);
  const votedRows=makeRanking([...ge6CandidateNames],preliminary.results as [string,string][],additions);
  const votedByName=new Map(votedRows.map((row:{name:string;amount:string})=>[row.name,row.amount]));
  const rows=makeRanking([...ge6CandidateNames],preliminary.results as [string,string][],combined)
    .map((row:{name:string;amount:string})=>({...row,votedAmount:votedByName.get(row.name)!,heldAmount:amount(heldAdditions.get(row.name)??0n)}));
  return {rows,includeHoldings,
    cutoff:preliminary.cutoff,lastVoteAt,postVoteCount:votes.length,walletCount:wallets.size,manualWallets,
    allocated:amount(allocated),unassigned:amount(unassigned),heldAllocated:amount(heldAllocated),heldUnassigned:amount(heldUnassigned),fetchedAt:new Date().toISOString()};
}
