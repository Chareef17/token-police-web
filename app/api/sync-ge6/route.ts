import { randomUUID } from 'node:crypto';
import { database } from '@/lib/db';
import { poll, markError } from '@/lib/ge6-indexer.mjs';
import { TokenXTransport } from '@/lib/tokenx-transport.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  let sameOrigin=false;
  try{const parsed=new URL(origin||'');sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host');}catch{}
  if(!sameOrigin)return Response.json({error:'Origin ไม่ถูกต้อง'},{status:403});

  const db=await database();
  const checkpoint=(await db.execute({sql:'SELECT value FROM metadata WHERE key=?',args:['ge6Checkpoint']})).rows[0];
  if(!checkpoint)return Response.json({error:'ฐานข้อมูลยังไม่ได้สแกนครั้งแรก กรุณารอการซิงก์ตามรอบ'},{status:503});
  const stateRows=(await db.execute("SELECT key,value FROM metadata WHERE key IN ('ge6Status','ge6AssignmentRevision')")).rows;
  const state=Object.fromEntries(stateRows.map(row=>[String(row.key),String(row.value)]));
  const currentStatus=JSON.parse(state.ge6Status??'null') as {lastSuccess?:string;votes?:number;phase?:string}|null;
  const assignmentRevision=Number(state.ge6AssignmentRevision??0);
  const lastSuccess=currentStatus?.lastSuccess;
  if(currentStatus?.phase!=='error'&&lastSuccess&&Date.now()-Date.parse(lastSuccess)<15000)return Response.json({lastSuccess,votes:currentStatus?.votes,assignmentRevision,recent:true},{headers:{'Cache-Control':'no-store'}});
  const owner=randomUUID();
  const now=Date.now();
  // One short on-demand pass at a time. A failed or timed-out request can retry after the lease expires.
  const lease=await db.execute({sql:'INSERT INTO indexer_lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE indexer_lease.expires<?',args:[owner,now+90000,now]});
  if(!lease.rowsAffected)return Response.json({error:'กำลังซิงก์ธุรกรรม GE6 อยู่ กรุณาลองอีกครั้งในอีกสักครู่'},{status:409});
  let leaseLost=false;
  const heartbeat=setInterval(()=>{
    db.execute({sql:'UPDATE indexer_lease SET expires=? WHERE id=1 AND owner=?',args:[Date.now()+90000,owner]}).then(result=>{if(!result.rowsAffected)leaseLost=true;},()=>{leaseLost=true;});
  },20000);
  const assertLease=async()=>{
    const row=(await db.execute('SELECT owner,expires FROM indexer_lease WHERE id=1')).rows[0];
    if(leaseLost||row?.owner!==owner||Number(row.expires)<Date.now())throw new Error('Indexer lease lost');
  };
  try{
    const status=await poll(db,new TokenXTransport(),{skipScheduledAudit:true,assertLease,deadline:Date.now()+50000});
    const latestRevision=(await db.execute({sql:'SELECT value FROM metadata WHERE key=?',args:['ge6AssignmentRevision']})).rows[0];
    return Response.json({lastSuccess:status.lastSuccess,votes:status.votes,assignmentRevision:Number(latestRevision?.value??0)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error('On-demand GE6 sync failed',error);
    if(!leaseLost)await markError(db,error);
    return Response.json({error:'ซิงก์ GE6 ไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:503});
  }finally{
    clearInterval(heartbeat);
    await db.execute({sql:'DELETE FROM indexer_lease WHERE owner=?',args:[owner]});
  }
}
