import { database } from './db';
import { units, amount } from './amount.mjs';
import { ge6CandidateByName, ge6CandidateNames } from './ge6-candidates';
import { makeRanking, snapshotTotal, splitVote } from './ge6-current-model.mjs';
import { ge6HeldBalances, bnkHeldBalances } from './ge6-held-balances';

// 'votes': votes cast since the preliminary result; 'ge6': plus GE6 still held by those wallets;
// 'all': plus their BNK as well (counted 1:1).
export type RankingMode='votes'|'ge6'|'all';
import { voterDetails } from './ge6-voters';
import preliminary from './ge6-prelim-2026-10-03.json';

const events = ['GE5','Thai-Japan 2026','Thai-Chinese 2025'];
const addressPattern = /^0x[0-9a-f]{40}$/;

async function calculateRanking(mode:RankingMode='votes') {
  const includeHoldings=mode!=='votes';
  const heldPromise=includeHoldings?ge6HeldBalances():Promise.resolve(new Map<string,bigint>());
  const db = await database();
  const freshnessRows = (await db.execute({sql:"SELECT key,value FROM metadata WHERE key IN ('ge6Status','ge6HoldersAt','bnkHoldersAt')"})).rows;
  const freshness = Object.fromEntries(freshnessRows.map(row=>[String(row.key),String(row.value)]));
  const ge6Status: {lastSuccess?:string;phase?:string}|null = JSON.parse(freshness.ge6Status??'null');
  const ge6HoldersAt: string|null = freshness.ge6HoldersAt?JSON.parse(freshness.ge6HoldersAt):null;
  const bnkHoldersAt: string|null = freshness.bnkHoldersAt?JSON.parse(freshness.bnkHoldersAt):null;
  const votes = (await db.execute({sql:'SELECT address,amount,voted_at FROM ge6_events WHERE julianday(voted_at)>julianday(?)',args:[preliminary.cutoff]})).rows;
  const wallets = new Map<string,bigint>();
  const todayWallets = new Map<string,bigint>();
  let lastVoteAt: string | null = null;
  // Bangkok is UTC+7 year-round. Compare against midnight today in Bangkok.
  const bangkokOffsetMs=7*60*60*1000;
  const todayStartUtc=Math.floor((Date.now()+bangkokOffsetMs)/86400000)*86400000-bangkokOffsetMs;
  for (const row of votes) {
    const address = String(row.address).toLowerCase();
    if (!addressPattern.test(address)) continue;
    const voteAmount=units(String(row.amount));
    wallets.set(address,(wallets.get(address)??0n)+voteAmount);
    const at = String(row.voted_at);
    if(Date.parse(at)>=todayStartUtc)todayWallets.set(address,(todayWallets.get(address)??0n)+voteAmount);
    if (!lastVoteAt || Date.parse(at)>Date.parse(lastVoteAt)) lastVoteAt=at;
  }
  const heldBalances=await heldPromise;
  const addresses = [...new Set([...wallets.keys(),...heldBalances.keys()])];
  const bnkBalances=mode==='all'?await bnkHeldBalances(addresses):new Map<string,bigint>();
  const historical = new Map<string,Map<string,bigint>>();
  const manual = new Map<string,string[]>();
  // Keep each query below SQLite's bind-variable limit and fetch only wallets that voted after the cutoff.
  const chunks=[];
  for (let start=0;start<addresses.length;start+=100) chunks.push(addresses.slice(start,start+100));
  // Chunks are fetched in parallel; each is one read batch.
  const chunkRows=await Promise.all(chunks.map(slice=>{
    const placeholders=slice.map(()=>'?').join(',');
    return db.batch([
      {sql:`SELECT address,event,member,amount FROM votes WHERE event IN (?,?,?) AND address IN (${placeholders})`,args:[...events,...slice]},
      {sql:`SELECT address,rank1,rank2,rank3 FROM manual_predictions WHERE address IN (${placeholders})`,args:slice},
    ],'read');
  }));
  for (const [voteRows,manualRows] of chunkRows) {
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
  const todayAdditions=new Map<string,bigint>();
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
  const bnkAdditions=new Map<string,bigint>();
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
    for (const [name,share] of splitVote(todayWallets.get(address)??0n,choices)) todayAdditions.set(name,(todayAdditions.get(name)??0n)+share);
  }
  for(const [address,total] of heldBalances){
    const choices=choicesFor(address);
    if(!choices.length){heldUnassigned+=total;continue;}
    heldAllocated+=total;
    for(const [name,share] of splitVote(total,choices)){heldAdditions.set(name,(heldAdditions.get(name)??0n)+share);record(name,address,share,'held');}
  }
  for(const [address,total] of bnkBalances){
    const choices=choicesFor(address);
    if(!choices.length)continue;
    for(const [name,share] of splitVote(total,choices))bnkAdditions.set(name,(bnkAdditions.get(name)??0n)+share);
  }
  const combined=new Map(additions);
  for(const extra of [heldAdditions,bnkAdditions])for(const [name,share] of extra)combined.set(name,(combined.get(name)??0n)+share);
  const votedRows=makeRanking([...ge6CandidateNames],preliminary.results as [string,string][],additions);
  const votedByName=new Map(votedRows.map((row:{name:string;amount:string})=>[row.name,row.amount]));
  const rows=makeRanking([...ge6CandidateNames],preliminary.results as [string,string][],combined)
    .map((row:{name:string;amount:string})=>({...row,votedAmount:votedByName.get(row.name)!,todayAmount:amount(todayAdditions.get(row.name)??0n),heldAmount:amount(heldAdditions.get(row.name)??0n),bnkAmount:amount(bnkAdditions.get(row.name)??0n)}));
  const publishedTotal=(preliminary.results as [string,string][]).reduce((total,[,score])=>total+units(score),0n);
  const trackedTotal=publishedTotal+allocated;
  const untrackedTotal=(snapshotTotal-publishedTotal)+unassigned;
  const votedTotal=snapshotTotal+allocated+unassigned;
  if(trackedTotal+untrackedTotal!==votedTotal)throw new Error('GE6 vote totals do not reconcile');
  return {rows,mode,includeHoldings,contributions,additions,heldAdditions,
    cutoff:preliminary.cutoff,lastVoteAt,postVoteCount:votes.length,walletCount:wallets.size,manualWallets,
    allocated:amount(allocated),unassigned:amount(unassigned),votedTotal:amount(votedTotal),trackedTotal:amount(trackedTotal),untrackedTotal:amount(untrackedTotal),heldAllocated:amount(heldAllocated),heldUnassigned:amount(heldUnassigned),voteSyncedAt:ge6Status?.lastSuccess??null,ge6HoldersAt,bnkHoldersAt,syncError:ge6Status?.phase==='error',fetchedAt:new Date().toISOString()};
}

export async function ge6CurrentRanking(mode:RankingMode='votes'){
  const {contributions,additions,heldAdditions,...ranking}=await calculateRanking(mode);
  return ranking;
}

// The member wallet list covers every GE6 voter. Votes before the preliminary
// snapshot are shown here for discovery, but never added to the current ranking.
async function allMemberVoters(name:string){
  const db=await database();
  const [ge6Rows,historyRows,manualRows]=await db.batch([
    'SELECT address,amount FROM ge6_events WHERE address IS NOT NULL',
    {sql:`SELECT address,event,member,amount FROM votes WHERE event IN (?,?,?) AND address IN (SELECT address FROM ge6_events)`,args:events},
    'SELECT address,rank1,rank2,rank3 FROM manual_predictions WHERE address IN (SELECT address FROM ge6_events)',
  ],'read');
  const totals=new Map<string,bigint>();
  for(const row of ge6Rows.rows){const address=String(row.address).toLowerCase();if(addressPattern.test(address))totals.set(address,(totals.get(address)??0n)+units(String(row.amount)));}
  const history=new Map<string,Map<string,bigint>>();
  for(const row of historyRows.rows){
    const address=String(row.address).toLowerCase();
    const member=ge6CandidateByName.get(String(row.member).trim().toLowerCase());
    if(!member||!totals.has(address))continue;
    const scores=history.get(address)??new Map<string,bigint>();
    scores.set(member,(scores.get(member)??0n)+units(String(row.amount))*(row.event==='Thai-Chinese 2025'?6n:68n));
    history.set(address,scores);
  }
  const manual=new Map<string,string[]>();
  for(const row of manualRows.rows){
    const members=[row.rank1,row.rank2,row.rank3].filter(value=>value!=null)
      .map(value=>ge6CandidateByName.get(String(value).toLowerCase())).filter((value):value is NonNullable<typeof value>=>Boolean(value));
    if(members.length)manual.set(String(row.address).toLowerCase(),members);
  }
  const matches:{address:string;votes:bigint;voted:bigint}[]=[];
  for(const [address,total] of totals){
    const choices=manual.get(address)??[...(history.get(address)??new Map<string,bigint>())]
      .sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1)
      .slice(0,3).map(([candidate])=>candidate);
    if(!choices.includes(name))continue;
    const share=splitVote(total,choices).find(entry=>entry[0]===name)?.[1]??0n;
    if(share>0n)matches.push({address,votes:share,voted:total});
  }
  return matches.sort((a,b)=>a.votes===b.votes?a.address.localeCompare(b.address):a.votes>b.votes?-1:1);
}

export async function ge6MemberProjection(name:string,page=1){
  const [result,contributions]=await Promise.all([calculateRanking('votes'),allMemberVoters(name)]);
  const ranked=result.rows.find((row:{name:string})=>row.name===name);
  if(!ranked)return null;
  const pageSize=20,pages=Math.max(1,Math.ceil(contributions.length/pageSize));
  const current=Math.min(Math.max(1,page),pages);
  const slice=contributions.slice((current-1)*pageSize,current*pageSize);
  const addresses=slice.map(item=>item.address);
  const details=await voterDetails(addresses);
  const preliminaryEntry=(preliminary.results as [string,string][]).findIndex(([candidate])=>candidate===name);
  return {name,preliminaryRank:preliminaryEntry>=0?preliminaryEntry+1:null,published:ranked.published,
    baseline:amount(units(ranked.votedAmount)-(result.additions.get(name)??0n)),
    postVotes:amount(result.additions.get(name)??0n),total:ranked.votedAmount,
    wallets:slice.map(item=>({address:item.address,name:details.get(item.address)?.name??null,
      contributionVotes:amount(item.votes),
      voted:amount(item.voted),ge6:details.get(item.address)?.ge6??null,bnk:details.get(item.address)?.bnk??null,
      likely:details.get(item.address)?.likely??[],topVote:details.get(item.address)?.topVote??null,lastTxAt:details.get(item.address)?.lastTxAt??null})),
    page:current,pages,walletCount:contributions.length,fetchedAt:result.fetchedAt};
}
