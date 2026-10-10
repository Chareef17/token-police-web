import { database } from './db';
import { units } from './amount.mjs';
import { voterDetails } from './ge6-voters';
import preliminary from './ge6-prelim-2026-10-03.json';

const PAGE_SIZE=20;
export type VoteTier='tier1'|'tier2'|'tier3'|'tier4'|'tier5'|'tier6';
export function voteTier(raw:string):VoteTier|null{
  const value=units(raw);
  if(value<units('100'))return null;
  if(value<=units('500'))return 'tier1';
  if(value<=units('1000'))return 'tier2';
  if(value<units('3000'))return 'tier3';
  if(value<=units('5000'))return 'tier4';
  if(value<units('10000'))return 'tier5';
  return 'tier6';
}

const tierConditions:Record<VoteTier,string>={
  tier1:'CAST(amount AS REAL)>=100 AND CAST(amount AS REAL)<=500',
  tier2:'CAST(amount AS REAL)>500 AND CAST(amount AS REAL)<=1000',
  tier3:'CAST(amount AS REAL)>1000 AND CAST(amount AS REAL)<3000',
  tier4:'CAST(amount AS REAL)>=3000 AND CAST(amount AS REAL)<=5000',
  tier5:'CAST(amount AS REAL)>5000 AND CAST(amount AS REAL)<10000',
  tier6:'CAST(amount AS REAL)>=10000',
};

export type VoteRange={min:string|null;max:string|null};
export async function ge6Live(page=1,tier:VoteTier|null=null,range:VoteRange|null=null){
  const db=await database();
  const condition=range?[range.min?'CAST(amount AS REAL)>=?':null,range.max?'CAST(amount AS REAL)<=?':null].filter(Boolean).join(' AND '):tier?tierConditions[tier]:'CAST(amount AS REAL)>=100';
  const args=range?[...(range.min?[Number(range.min)]:[]),...(range.max?[Number(range.max)]:[])]:[];
  const [countResult,statusResult,revisionResult]=await db.batch([
    {sql:`SELECT count(*) AS total FROM ge6_events WHERE ${condition}`,args},
    {sql:'SELECT value FROM metadata WHERE key=?',args:['ge6Status']},
    {sql:'SELECT value FROM metadata WHERE key=?',args:['ge6AssignmentRevision']},
  ],'read');
  const total=Number(countResult.rows[0]?.total??0);
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const current=Math.min(Math.max(1,page),pages);
  const events=(await db.execute({sql:`SELECT tx_hash,log_index,address,amount,voted_at FROM ge6_events WHERE ${condition} ORDER BY block_number DESC,log_index DESC LIMIT ? OFFSET ?`,args:[...args,PAGE_SIZE,(current-1)*PAGE_SIZE]})).rows;
  const assignments=events.length?(await db.execute({sql:`SELECT tx_hash,log_index,member,version FROM ge6_vote_assignments WHERE tx_hash IN (${events.map(()=>'?').join(',')})`,args:events.map(row=>String(row.tx_hash))})).rows:[];
  const assignedByEvent=new Map(assignments.map(row=>[String(row.tx_hash)+':'+String(row.log_index),{member:row.member==null?null:String(row.member),version:Number(row.version)}]));
  const addresses=[...new Set(events.map(row=>String(row.address).toLowerCase()))];
  const details=await voterDetails(addresses);
  let chainVoteCount:number|null=null;
  try{const status=JSON.parse(String(statusResult.rows[0]?.value??'null')) as {votes?:number}|null;if(typeof status?.votes==='number')chainVoteCount=status.votes;}catch{}
  return {rows:events.map(row=>{const address=String(row.address).toLowerCase();return {
    txHash:String(row.tx_hash),logIndex:Number(row.log_index),address,amount:String(row.amount),votedAt:row.voted_at==null?null:String(row.voted_at),inPreliminary:row.voted_at!=null&&Date.parse(String(row.voted_at))<=Date.parse(preliminary.cutoff),tier:voteTier(String(row.amount)),assignedMember:assignedByEvent.get(String(row.tx_hash)+':'+String(row.log_index))?.member??null,assignmentVersion:assignedByEvent.get(String(row.tx_hash)+':'+String(row.log_index))?.version??0,...details.get(address)!,
  };}),page:current,pages,total,tier,range,chainVoteCount,assignmentRevision:Number(revisionResult.rows[0]?.value??0),fetchedAt:new Date().toISOString()};
}
