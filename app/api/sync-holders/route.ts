import { randomUUID } from 'node:crypto';
import { database } from '@/lib/db';
import { fetchHolderChunk, holderCount, tokens } from '@/lib/token-holders.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  let sameOrigin=false;
  try{const parsed=new URL(origin||'');sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host');}catch{}
  if(!sameOrigin)return Response.json({error:'Origin ไม่ถูกต้อง'},{status:403});
  const name=new URL(request.url).searchParams.get('token');
  if(name!=='ge6'&&name!=='bnk')return Response.json({error:'Token ไม่ถูกต้อง'},{status:400});
  const token=tokens[name];
  const db=await database();
  const owner=randomUUID(),now=Date.now();
  const acquired=await db.execute({sql:'INSERT INTO holder_sync_lease VALUES(?,?,?) ON CONFLICT(token) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE holder_sync_lease.expires<?',args:[token,owner,now+90000,now]});
  if(!acquired.rowsAffected)return Response.json({busy:true},{status:409,headers:{'Cache-Control':'no-store'}});
  let leaseLost=false;
  const heartbeat=setInterval(()=>{
    db.execute({sql:'UPDATE holder_sync_lease SET expires=? WHERE token=? AND owner=?',args:[Date.now()+90000,token,owner]}).then(result=>{if(!result.rowsAffected)leaseLost=true;},()=>{leaseLost=true;});
  },20000);
  try{
    const saved=(await db.execute({sql:'SELECT * FROM holder_sync_state WHERE token=?',args:[token]})).rows[0];
    let state=saved?{cursor:saved.cursor==null?null:String(saved.cursor),previous_last:saved.previous_last==null?null:String(saved.previous_last),seen_count:Number(saved.seen_count),expected:Number(saved.expected),started_at:String(saved.started_at)}:null;
    if(!state||Date.now()-Date.parse(String(state.started_at))>20*60000){
      const expected=await holderCount(token);
      await db.batch([
        {sql:'DELETE FROM holder_sync_rows WHERE token=?',args:[token]},
        {sql:'INSERT OR REPLACE INTO holder_sync_state VALUES(?,?,?,?,?,?)',args:[token,null,null,0,expected,new Date().toISOString()]},
      ],'write');
      state={cursor:null,previous_last:null,seen_count:0,expected,started_at:new Date().toISOString()};
    }
    const seenRows=(await db.execute({sql:'SELECT address FROM holder_sync_rows WHERE token=?',args:[token]})).rows;
    const seen=new Set(seenRows.map(row=>String(row.address)));
    const chunk=await fetchHolderChunk(token,{cursor:state.cursor?JSON.parse(String(state.cursor)):null,previousLast:state.previous_last?String(state.previous_last):null,seen,expected:Number(state.expected)});
    if(leaseLost)throw new Error('Holder sync lease lost');
    const statements:{sql:string;args:(string|number|null)[]}[]=[...chunk.balances].map(([address,value])=>({sql:'INSERT OR REPLACE INTO holder_sync_rows VALUES(?,?,?)',args:[token,address,value]}));
    if(chunk.complete){
      statements.push(
        {sql:'DELETE FROM token_holders WHERE token=?',args:[token]},
        {sql:'INSERT INTO token_holders SELECT token,address,value FROM holder_sync_rows WHERE token=?',args:[token]},
        {sql:'INSERT OR REPLACE INTO metadata VALUES(?,?)',args:[`${name}HoldersAt`,JSON.stringify(new Date().toISOString())]},
        {sql:'DELETE FROM holder_sync_rows WHERE token=?',args:[token]},
        {sql:'DELETE FROM holder_sync_state WHERE token=?',args:[token]},
      );
    }else statements.push({sql:'INSERT OR REPLACE INTO holder_sync_state VALUES(?,?,?,?,?,?)',args:[token,JSON.stringify(chunk.cursor),chunk.previousLast,chunk.seenCount,Number(state.expected),String(state.started_at)]});
    await db.batch(statements,'write');
    return Response.json({done:chunk.complete,processed:chunk.seenCount,expected:Number(state.expected),fetchedAt:chunk.complete?new Date().toISOString():null},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    console.error('On-demand holder sync failed',name,error);
    return Response.json({error:'ซิงก์ยอดเหรียญไม่สำเร็จ กรุณาลองใหม่'},{status:503});
  }finally{
    clearInterval(heartbeat);
    await db.execute({sql:'DELETE FROM holder_sync_lease WHERE token=? AND owner=?',args:[token,owner]});
  }
}
