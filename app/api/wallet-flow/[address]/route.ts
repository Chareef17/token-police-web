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
const bnkSince=Date.parse('2023-12-31T17:00:00.000Z');
const redeemContract='0x2d77c89098e4a1eb71f64d9d65bde219df6996b9';
const ge6RedeemProduct='8e57bd4d-58a1-4eca-8e90-dcf0b427696f';
type Cursor=Record<string,string>;
type RedeemTx={from?:{hash?:string};to?:{hash?:string};method?:string;decoded_input?:{parameters?:{name?:string;value?:unknown}[]}};

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
  let address:string,cursor:Cursor|null,token:'ge6'|'bnk';
  try{
    address=addressOf((await params).address);
    const search=new URL(request.url).searchParams;
    cursor=parseCursor(search.get('cursor'));
    const selected=search.get('token')??'ge6';
    if(selected!=='ge6'&&selected!=='bnk')throw new Error('Invalid token');
    token=selected;
  }
  catch{return Response.json({error:'Address หรือหน้าประวัติไม่ถูกต้อง'},{status:400});}
  try{
    const query=new URLSearchParams(cursor??{});
    const page=await tokenxGet(`/addresses/${address}/token-transfers?${query}`) as {items?:unknown[];next_page_params?:Record<string,unknown>|null};
    if(!Array.isArray(page.items))throw new Error('Invalid TokenX transfer page');
    const transfers:{from:string;to:string;raw:string;txHash:string;logIndex:number;timestamp:string;other:string;official:boolean;mint:boolean;vote:boolean;redeem:boolean}[]=[];
    let reachedSince=false;
    for(const value of page.items){
      const item=value as {token?:{address?:string;decimals?:string};total?:{value?:string};from?:{hash?:string};to?:{hash?:string};tx_hash?:string;log_index?:string|number;timestamp?:string};
      const time=Date.parse(item.timestamp??'');
      if(token==='bnk'&&Number.isFinite(time)&&time<bnkSince){reachedSince=true;continue;}
      if(item.token?.address?.toLowerCase()!==tokens[token])continue;
      const from=item.from?.hash?.toLowerCase()??'',to=item.to?.hash?.toLowerCase()??'';
      const txHash=item.tx_hash?.toLowerCase()??'',logIndex=Number(item.log_index);
      if(!/^0x[0-9a-f]{40}$/.test(from)||!/^0x[0-9a-f]{40}$/.test(to)||
        (from!==address&&to!==address)||String(item.token?.decimals)!=='18'||
        !rawAmount.test(item.total?.value??'')||!hash.test(txHash)||
        !Number.isSafeInteger(logIndex)||logIndex<0||!Number.isFinite(time))throw new Error('Invalid token transfer');
      const other=to===address?from:to;
      transfers.push({from,to,raw:item.total!.value!,txHash,logIndex,timestamp:item.timestamp!,other,official:officialWallets.has(other),mint:other===zero,vote:false,redeem:false});
    }
    const db=await database();
    const counterparties=[...new Set(transfers.map(row=>row.other))];
    const candidates=token==='ge6'?[...new Set(transfers.filter(row=>row.from===address&&row.to===votingContract).map(row=>row.txHash))]:[];
    const [nameRows,voteRows]=await db.batch([
      counterparties.length?{sql:`SELECT address,name FROM names WHERE address IN (${counterparties.map(()=>'?').join(',')})`,args:counterparties}:'SELECT address,name FROM names WHERE 0',
      candidates.length?{sql:`SELECT DISTINCT tx_hash FROM ge6_events WHERE address=? AND tx_hash IN (${candidates.map(()=>'?').join(',')})`,args:[address,...candidates]}:'SELECT tx_hash FROM ge6_events WHERE 0',
    ],'read');
    const names=Object.fromEntries(nameRows.rows.map(row=>[String(row.address).toLowerCase(),String(row.name)]));
    const votes=new Set(voteRows.rows.map(row=>String(row.tx_hash).toLowerCase()));
    for(const row of transfers)row.vote=row.from===address&&row.to===votingContract&&votes.has(row.txHash);
    if(token==='bnk'){
      const redeemCandidates=[...new Set(transfers.filter(row=>row.from===address&&row.to===redeemContract).map(row=>row.txHash))];
      const redeemed=new Set<string>();
      for(let start=0;start<redeemCandidates.length;start+=8){
        const batch=redeemCandidates.slice(start,start+8);
        const results=await Promise.all(batch.map(tx=>tokenxGet('/transactions/'+tx) as Promise<RedeemTx>));
        results.forEach((tx,index)=>{
          const ids=tx.decoded_input?.parameters?.find(parameter=>parameter.name==='_id')?.value;
          if(tx.from?.hash?.toLowerCase()===address&&tx.to?.hash?.toLowerCase()===redeemContract&&tx.method==='purchaseItems'&&Array.isArray(ids)&&ids.includes(ge6RedeemProduct))redeemed.add(batch[index]);
        });
      }
      for(const row of transfers)row.redeem=redeemed.has(row.txHash);
    }
    const next=page.next_page_params;
    const nextCursor:Cursor|null=next&&!reachedSince?Object.fromEntries(Object.entries(next).filter(([key,value])=>['block_number','index','items_count'].includes(key)&&value!=null).map(([key,value])=>[key,String(value)])):null;
    return Response.json({rows:transfers,names,nextCursor,fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch(error){console.error('Wallet flow failed',address,error);return Response.json({error:'อ่านเส้นทางเหรียญจาก TokenX ไม่สำเร็จ กรุณาลองใหม่'},{status:503});}
}
