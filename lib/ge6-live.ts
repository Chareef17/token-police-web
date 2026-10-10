import { database } from './db';
import { amount, units } from './amount.mjs';
import { voterDetails } from './ge6-voters';

const PAGE_SIZE=20;
export type VoteTier='fish'|'dolphin'|'whale';
export function voteTier(raw:string):VoteTier|null{
  const value=units(raw);
  if(value<units('100'))return null;
  if(value<units('1000'))return 'fish';
  if(value<units('3000'))return 'dolphin';
  return 'whale';
}

export async function ge6Live(page=1){
  const db=await database();
  const [countResult,statusResult]=await db.batch([
    'SELECT count(*) AS total FROM ge6_events WHERE CAST(amount AS REAL)>=100',
    {sql:'SELECT value FROM metadata WHERE key=?',args:['ge6Status']},
  ],'read');
  const total=Number(countResult.rows[0]?.total??0);
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const current=Math.min(Math.max(1,page),pages);
  const events=(await db.execute({sql:'SELECT tx_hash,log_index,address,amount,voted_at FROM ge6_events WHERE CAST(amount AS REAL)>=100 ORDER BY block_number DESC,log_index DESC LIMIT ? OFFSET ?',args:[PAGE_SIZE,(current-1)*PAGE_SIZE]})).rows;
  const addresses=[...new Set(events.map(row=>String(row.address).toLowerCase()))];
  const details=await voterDetails(addresses);
  const totals=new Map<string,bigint>();
  if(addresses.length){
    const placeholders=addresses.map(()=>'?').join(',');
    const rows=(await db.execute({sql:`SELECT address,amount FROM ge6_events WHERE address IN (${placeholders})`,args:addresses})).rows;
    for(const row of rows){const address=String(row.address).toLowerCase();totals.set(address,(totals.get(address)??0n)+units(String(row.amount)));}
  }
  let chainVoteCount:number|null=null;
  try{const status=JSON.parse(String(statusResult.rows[0]?.value??'null')) as {votes?:number}|null;if(typeof status?.votes==='number')chainVoteCount=status.votes;}catch{}
  return {rows:events.map(row=>{const address=String(row.address).toLowerCase();return {
    txHash:String(row.tx_hash),logIndex:Number(row.log_index),address,amount:String(row.amount),votedAt:row.voted_at==null?null:String(row.voted_at),tier:voteTier(String(row.amount)),voted:amount(totals.get(address)??0n),...details.get(address)!,
  };}),page:current,pages,total,chainVoteCount,fetchedAt:new Date().toISOString()};
}
