import { connect, initialize } from '../lib/database.mjs';
import { units, amount } from '../lib/amount.mjs';
import { splitVote, makeRanking, snapshotTotal } from '../lib/ge6-current-model.mjs';
import { TokenXTransport } from '../lib/tokenx-transport.mjs';
import preliminary from '../lib/ge6-prelim-2026-10-03.json' with { type: 'json' };
import { readFileSync } from 'node:fs';

const roster=readFileSync(new URL('../lib/ge6-candidates.ts',import.meta.url),'utf8').split('export const ge6CandidateNames=[')[1]?.split('] as const')[0];
if(!roster)throw new Error('GE6 candidate roster not found');
const candidateNames=new Map([...roster.matchAll(/'([^']+)'/g)].map(match=>[match[1].toLowerCase(),match[1]]));
const cutoffs={
  '2026-10-30':'2026-10-30T05:00:00.000Z',
  '2026-10-31':'2026-10-31T05:00:00.000Z',
};
const day=process.argv[2];
const cutoff=cutoffs[day];
if(!cutoff)throw new Error('Use 2026-10-30 or 2026-10-31');
if(Date.now()<Date.parse(cutoff))throw new Error('Snapshot cutoff has not passed');
const db=connect();
try{
  await initialize(db);
  await db.execute('CREATE TABLE IF NOT EXISTS ge6_snapshots(id TEXT PRIMARY KEY,cutoff TEXT NOT NULL,captured_at TEXT NOT NULL,forecast TEXT NOT NULL,transaction_count INTEGER NOT NULL,transaction_total TEXT NOT NULL)');
  await db.execute('CREATE TABLE IF NOT EXISTS ge6_snapshot_transactions(snapshot_id TEXT NOT NULL,part INTEGER NOT NULL,events TEXT NOT NULL,PRIMARY KEY(snapshot_id,part))');
  if((await db.execute({sql:'SELECT id FROM ge6_snapshots WHERE id=?',args:[day]})).rows.length){console.log(`Snapshot ${day} already exists; left unchanged`);process.exit(0);}
  const state=JSON.parse(String((await db.execute({sql:"SELECT value FROM metadata WHERE key='ge6Status'"})).rows[0]?.value??'null'));
  if(state?.phase!=='active'||!Number.isSafeInteger(state.confirmedBlock))throw new Error('GE6 sync is not current');
  const block=await new TokenXTransport().get(`/blocks/${state.confirmedBlock}`);
  if(Date.parse(block.timestamp)<Date.parse(cutoff))throw new Error('Confirmed chain head is before snapshot cutoff; retry later');
  const [eventResult,assignmentResult,manualResult,historyResult]=await db.batch([
    {sql:'SELECT tx_hash,log_index,block_number,block_hash,vote_index,address,amount,voted_at FROM ge6_events WHERE julianday(voted_at)<=julianday(?) ORDER BY block_number,log_index',args:[cutoff]},
    'SELECT tx_hash,log_index,member FROM ge6_vote_assignments',
    'SELECT address,rank1,rank2,rank3 FROM manual_predictions',
    {sql:"SELECT address,event,member,amount FROM votes WHERE event IN ('GE5','Thai-Japan 2026','Thai-Chinese 2025')"},
  ],'read');
  const events=eventResult.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,String(value)])));
  const assignments=new Map(assignmentResult.rows.map(row=>[`${row.tx_hash}:${row.log_index}`,candidateNames.get(String(row.member).toLowerCase())]));
  for(const event of events)event.assignedMember=assignments.get(`${event.tx_hash}:${event.log_index}`)??null;
  const manual=new Map(manualResult.rows.map(row=>[String(row.address).toLowerCase(),[row.rank1,row.rank2,row.rank3].map(value=>candidateNames.get(String(value??'').toLowerCase())).filter(Boolean)]));
  const historical=new Map();
  for(const row of historyResult.rows){
    const name=candidateNames.get(String(row.member).toLowerCase());if(!name)continue;
    const address=String(row.address).toLowerCase();
    const scores=historical.get(address)??new Map();
    scores.set(name,(scores.get(name)??0n)+units(String(row.amount))*(row.event==='Thai-Chinese 2025'?6n:68n));
    historical.set(address,scores);
  }
  const assignedPreferences=new Map();
  for(const event of events){
    const member=assignments.get(`${event.tx_hash}:${event.log_index}`);if(!member)continue;
    const scores=assignedPreferences.get(event.address)??new Map();
    scores.set(member,(scores.get(member)??0n)+units(event.amount));
    assignedPreferences.set(event.address,scores);
  }
  const topThree=scores=>[...(scores??new Map())].sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1).slice(0,3).map(([name])=>name);
  const choicesFor=address=>manual.get(address)?.length?manual.get(address):assignedPreferences.has(address)?topThree(assignedPreferences.get(address)):topThree(historical.get(address));
  const additions=new Map(),preliminaryAssignments=new Map(),predictedWallets=new Map();
  let allocated=0n,unassigned=0n,postTotal=0n;
  const preliminaryNames=new Set(preliminary.results.map(([name])=>name));
  for(const event of events){
    const value=units(event.amount),assigned=assignments.get(`${event.tx_hash}:${event.log_index}`);
    if(Date.parse(event.voted_at)<=Date.parse(preliminary.cutoff)){
      if(assigned&&!preliminaryNames.has(assigned))preliminaryAssignments.set(assigned,(preliminaryAssignments.get(assigned)??0n)+value);
      continue;
    }
    postTotal+=value;
    if(!assigned){predictedWallets.set(event.address,(predictedWallets.get(event.address)??0n)+value);continue;}
    allocated+=value;
    additions.set(assigned,(additions.get(assigned)??0n)+value);
  }
  for(const [address,value] of predictedWallets){
    const choices=splitVote(value,choicesFor(address));
    if(!choices.length){unassigned+=value;continue;}
    allocated+=value;
    for(const [name,share] of choices)additions.set(name,(additions.get(name)??0n)+share);
  }
  const rows=makeRanking([...candidateNames.values()],preliminary.results,additions,preliminaryAssignments);
  const capturedAt=new Date().toISOString();
  const forecast={cutoff,capturedAt,model:'GE6 current votes; manual predictions > assigned transaction preferences > GE5/Thai-Japan/Thai-Chinese history; weights 100 / 70-30 / 60-30-10',rows,postVoteTotal:amount(postTotal),allocated:amount(allocated),unassigned:amount(unassigned),votedTotal:amount(snapshotTotal+postTotal),confirmedBlock:state.confirmedBlock,sourceSyncedAt:state.lastSuccess};
  const statements=[];
  for(let part=0;part*100<events.length;part++)statements.push({sql:'INSERT INTO ge6_snapshot_transactions VALUES(?,?,?)',args:[day,part,JSON.stringify(events.slice(part*100,(part+1)*100))]});
  statements.push({sql:'INSERT INTO ge6_snapshots VALUES(?,?,?,?,?,?)',args:[day,cutoff,capturedAt,JSON.stringify(forecast),events.length,amount(events.reduce((sum,event)=>sum+units(event.amount),0n))]});
  await db.batch(statements,'write');
  console.log(JSON.stringify({snapshot:day,cutoff,capturedAt,transactions:events.length,forecastMembers:rows.length,postVoteTotal:forecast.postVoteTotal}));
}finally{db.close();}
