import { database } from '@/lib/db';
import { addressOf } from '@/lib/amount.mjs';
import { officialWallets } from '@/lib/leaderboards';
import { tokens } from '@/lib/token-holders.mjs';
import { contract as votingContract } from '@/lib/ge6-indexer.mjs';
import { tokenxGet } from '@/lib/tokenx-transport.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const hash=/^0x[0-9a-f]{64}$/;
const rawAmount=/^\d+$/;
const zero='0x'+'0'.repeat(40);
type Cursor=Record<string,string>;

function parseCursor(value:string|null):Cursor|null{
  if(!value)return null;
  if(value.length>500)throw new Error('Invalid cursor');
  const parsed=JSON.parse(value) as Record<string,unknown>;
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid cursor');
  const cursor:Cursor={};
  for(const [key,raw] of Object.entries(parsed)){
    if(!['block_number','index','items_count'].includes(key)||!/^\d{1,20}$/.test(String(raw)))throw new Error('Invalid cursor');
    cursor[key]=String(raw);
  }
  if(!('block_number'in cursor)||!('index'in cursor))throw new Error('Invalid cursor');
  return cursor;
}

export async function GET(request:Request,{params}:{params:Promise<{address:string}>}){
  let address:string,cursor:Cursor|null;
  try{address=addressOf((await params).address);cursor=parseCursor(new URL(request.url).searchParams.get('cursor'));}
  catch{return Response.json({error:'Address หรือหน้าประวัติไม่ถูกต้อง'},{status:400});}
  try{
    const query=new URLSearchParams(cursor??{});
    const page=await tokenxGet(`/addresses/${address}/token-transfers?${query}`) as {items?:unknown[];next_page_params?:Record<string,unknown>|null};
    if(!Array.isArray(page.items))throw new Error('Invalid TokenX transfer page');
    const transfers:{from:string;to:string;raw:string;txHash:string;logIndex:number;timestamp:string;other:string;official:boolean;mint:boolean;vote:boolean}[]=[];
    for(const value of page.items){
      const item=value as {token?:{address?:string;decimals?:string};total?:{value?:string};from?:{hash?:string};to?:{hash?:string};tx_hash?:string;log_index?:string|number;timestamp?:string};
      if(item.token?.address?.toLowerCase()!==tokens.ge6)continue;
      const from=item.from?.hash?.toLowerCase()??'',to=item.to?.hash?.toLowerCase()??'';
      const txHash=item.tx_hash?.toLowerCase()??'',logIndex=Number(item.log_index);
      if(!/^0x[0-9a-f]{40}$/.test(from)||!/^0x[0-9a-f]{40}$/.test(to)||
        (from!==address&&to!==address)||String(item.token?.decimals)!=='18'||
        !rawAmount.test(item.total?.value??'')||!hash.test(txHash)||
        !Number.isSafeInteger(logIndex)||logIndex<0||!Number.isFinite(Date.parse(item.timestamp??'')))throw new Error('Invalid GE6 transfer');
      const other=to===address?from:to;
      transfers.push({from,to,raw:item.total!.value!,txHash,logIndex,timestamp:item.timestamp!,other,official:officialWallets.has(other),mint:other===zero,vote:false});
    }
    const db=await database();
    const counterparties=[...new Set(transfers.map(row=>row.other))];
    const candidates=[...new Set(transfers.filter(row=>row.from===address&&row.to===votingContract).map(row=>row.txHash))];
    const [nameRows,voteRows]=await db.batch([
      counterparties.length?{sql:`SELECT address,name FROM names WHERE address IN (${counterparties.map(()=>'?').join(',')})`,args:counterparties}:'SELECT address,name FROM names WHERE 0',
      candidates.length?{sql:`SELECT DISTINCT tx_hash FROM ge6_events WHERE address=? AND tx_hash IN (${candidates.map(()=>'?').join(',')})`,args:[address,...candidates]}:'SELECT tx_hash FROM ge6_events WHERE 0',
    ],'read');
    const names=Object.fromEntries(nameRows.rows.map(row=>[String(row.address).toLowerCase(),String(row.name)]));
    const votes=new Set(voteRows.rows.map(row=>String(row.tx_hash).toLowerCase()));
    for(const row of transfers)row.vote=row.from===address&&row.to===votingContract&&votes.has(row.txHash);
    const next=page.next_page_params;
    const nextCursor:Cursor|null=next?Object.fromEntries(Object.entries(next).filter(([key,value])=>['block_number','index','items_count'].includes(key)&&value!=null).map(([key,value])=>[key,String(value)])):null;
    return Response.json({rows:transfers,names,nextCursor,fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch(error){console.error('Wallet flow failed',address,error);return Response.json({error:'อ่านเส้นทางเหรียญจาก TokenX ไม่สำเร็จ กรุณาลองใหม่'},{status:503});}
}
