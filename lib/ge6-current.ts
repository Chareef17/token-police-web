import { database } from './db';
import { units, amount } from './amount.mjs';
import { ge6CandidateByName, ge6CandidateNames } from './ge6-candidates';
import { makeRanking, splitVote } from './ge6-current-model.mjs';
import { ge6HeldBalances } from './ge6-held-balances';
import { voterDetails } from './ge6-voters';
import preliminary from './ge6-prelim-2026-10-03.json';

const events = ['GE5','Thai-Japan 2026','Thai-Chinese 2025'];
const addressPattern = /^0x[0-9a-f]{40}$/;

async function calculateRanking(includeHoldings=false) {
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
  const contributions=new Map<string,Map<string,{votes:bigint;held:bigint}>>();
  const record=(name:string,address:string,share:bigint,kind:'votes'|'held')=>{
    if(!share)return;
    const wallets=contributions.get(name)??new Map<string,{votes:bigint;held:bigint}>();
    const current=wallets.get(address)??{votes:0n,held:0n};
    current[kind]+=share;
    wallets.set(address,current);contributions.set(name,wallets);
  };
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
    for (const [name,share] of splitVote(total,choices)) {additions.set(name,(additions.get(name)??0n)+share);record(name,address,share,'votes');}
  }
  for(const [address,total] of heldBalances){
    const choices=choicesFor(address);
    if(!choices.length){heldUnassigned+=total;continue;}
    heldAllocated+=total;
    for(const [name,share] of splitVote(total,choices)){heldAdditions.set(name,(heldAdditions.get(name)??0n)+share);record(name,address,share,'held');}
  }
  const combined=new Map(additions);
  for(const [name,share] of heldAdditions)combined.set(name,(combined.get(name)??0n)+share);
  const votedRows=makeRanking([...ge6CandidateNames],preliminary.results as [string,string][],additions);
  const votedByName=new Map(votedRows.map((row:{name:string;amount:string})=>[row.name,row.amount]));
  const rows=makeRanking([...ge6CandidateNames],preliminary.results as [string,string][],combined)
    .map((row:{name:string;amount:string})=>({...row,votedAmount:votedByName.get(row.name)!,heldAmount:amount(heldAdditions.get(row.name)??0n)}));
  return {rows,includeHoldings,contributions,additions,heldAdditions,
    cutoff:preliminary.cutoff,lastVoteAt,postVoteCount:votes.length,walletCount:wallets.size,manualWallets,
    allocated:amount(allocated),unassigned:amount(unassigned),heldAllocated:amount(heldAllocated),heldUnassigned:amount(heldUnassigned),fetchedAt:new Date().toISOString()};
}

export async function ge6CurrentRanking(includeHoldings=false){
  const {contributions,additions,heldAdditions,...ranking}=await calculateRanking(includeHoldings);
  return ranking;
}

export async function ge6MemberProjection(name:string,page=1){
  const result=await calculateRanking(true);
  const ranked=result.rows.find((row:{name:string})=>row.name===name);
  if(!ranked)return null;
  const contributions=[...(result.contributions.get(name)??new Map())]
    .map(([address,values])=>({address,...values,total:values.votes+values.held}))
    .sort((a,b)=>a.total===b.total?a.address.localeCompare(b.address):a.total>b.total?-1:1);
  const pageSize=20,pages=Math.max(1,Math.ceil(contributions.length/pageSize));
  const current=Math.min(Math.max(1,page),pages);
  const slice=contributions.slice((current-1)*pageSize,current*pageSize);
  const addresses=slice.map(item=>item.address);
  const [details,ge6Rows]=await Promise.all([
    voterDetails(addresses),
    addresses.length?(await database()).execute({sql:`SELECT address,amount FROM ge6_events WHERE address IN (${addresses.map(()=>'?').join(',')})`,args:addresses}):Promise.resolve({rows:[]}),
  ]);
  const walletVotes=new Map<string,bigint>();
  for(const row of ge6Rows.rows){
    const address=String(row.address).toLowerCase();
    walletVotes.set(address,(walletVotes.get(address)??0n)+units(String(row.amount)));
  }
  return {name,rank:ranked.rank,published:ranked.published,
    baseline:amount(units(ranked.votedAmount)-(result.additions.get(name)??0n)),
    postVotes:amount(result.additions.get(name)??0n),held:amount(result.heldAdditions.get(name)??0n),total:ranked.amount,
    wallets:slice.map(item=>({address:item.address,name:details.get(item.address)?.name??null,
      contributionVotes:amount(item.votes),contributionHeld:amount(item.held),contributionTotal:amount(item.total),
      voted:amount(walletVotes.get(item.address)??0n),ge6:details.get(item.address)?.ge6??null,bnk:details.get(item.address)?.bnk??null,
      likely:details.get(item.address)?.likely??[],topVote:details.get(item.address)?.topVote??null,lastTxAt:details.get(item.address)?.lastTxAt??null})),
    page:current,pages,walletCount:contributions.length,fetchedAt:result.fetchedAt};
}
