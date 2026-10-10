import { database } from './db';
import { units } from './amount.mjs';
import { voterDetails } from './ge6-voters';

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

export async function ge6Live(page=1,tier:VoteTier|null=null){
  const db=await database();
  const condition=tier?tierConditions[tier]:'CAST(amount AS REAL)>=100';
  const [countResult,statusResult]=await db.batch([
    `SELECT count(*) AS total FROM ge6_events WHERE ${condition}`,
    {sql:'SELECT value FROM metadata WHERE key=?',args:['ge6Status']},
  ],'read');
  const total=Number(countResult.rows[0]?.total??0);
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const current=Math.min(Math.max(1,page),pages);
  const events=(await db.execute({sql:`SELECT tx_hash,log_index,address,amount,voted_at FROM ge6_events WHERE ${condition} ORDER BY block_number DESC,log_index DESC LIMIT ? OFFSET ?`,args:[PAGE_SIZE,(current-1)*PAGE_SIZE]})).rows;
  const addresses=[...new Set(events.map(row=>String(row.address).toLowerCase()))];
  const details=await voterDetails(addresses);
  let chainVoteCount:number|null=null;
  try{const status=JSON.parse(String(statusResult.rows[0]?.value??'null')) as {votes?:number}|null;if(typeof status?.votes==='number')chainVoteCount=status.votes;}catch{}
  return {rows:events.map(row=>{const address=String(row.address).toLowerCase();return {
    txHash:String(row.tx_hash),logIndex:Number(row.log_index),address,amount:String(row.amount),votedAt:row.voted_at==null?null:String(row.voted_at),tier:voteTier(String(row.amount)),...details.get(address)!,
  };}),page:current,pages,total,tier,chainVoteCount,fetchedAt:new Date().toISOString()};
}
