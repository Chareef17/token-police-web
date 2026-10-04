import { createHash } from 'node:crypto';
import { database } from '@/lib/db';
import { addressOf,nameOf } from '@/lib/amount.mjs';
export const runtime='nodejs';
// Vercel sets X-Forwarded-For itself, so it can be trusted there for per-visitor limits.
const trustProxy=()=>process.env.TRUST_PROXY==='true'||(process.env.VERCEL==='1'&&process.env.TRUST_PROXY!=='false');
export async function POST(request:Request){
  const origin=request.headers.get('origin');
  let sameOrigin=false;
  try { const parsed=new URL(origin||''); sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host'); } catch {}
  if(!sameOrigin)return Response.json({error:'Origin ไม่ถูกต้อง'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'ต้องส่ง JSON'},{status:415});
  let input,address,name;
  try{const raw=await request.text();if(raw.length>2048)throw new Error('ข้อมูลยาวเกินไป');input=JSON.parse(raw);address=addressOf(input.address);name=nameOf(input.name);if(!Number.isSafeInteger(input.version)||input.version<0)throw new Error('Version ไม่ถูกต้อง');}
  catch(e){return Response.json({error:e instanceof Error?e.message:'ข้อมูลไม่ถูกต้อง'},{status:400});}
  let tx;
  try{
    tx=await (await database()).transaction('write');
    const current=(await tx.execute({sql:'SELECT version FROM names WHERE address=?',args:[address]})).rows[0];
    if(Number(current?.version||0)!==input.version){await tx.rollback();return Response.json({error:'มีคนเปลี่ยนชื่อนี้แล้ว กรุณาค้นหาใหม่ก่อนแก้ไข'},{status:409});}
    const identity=trustProxy()?(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'shared'):'shared';
    const key=createHash('sha256').update(identity).digest('hex');const now=Date.now();
    const limit=(await tx.execute({sql:'SELECT started,count FROM limits WHERE key=?',args:[key]})).rows[0];
    const active=limit && now-Number(limit.started)<60000;
    if(active && Number(limit.count)>=10){await tx.rollback();return Response.json({error:'แก้ไขชื่อบ่อยเกินไป กรุณารอ 1 นาที'},{status:429});}
    const updated_at=new Date().toISOString();const version=input.version+1;
    await tx.batch([
      {sql:'DELETE FROM limits WHERE started<?',args:[now-60000]},
      {sql:'INSERT OR REPLACE INTO limits VALUES(?,?,?)',args:[key,active?Number(limit!.started):now,active?Number(limit!.count)+1:1]},
      {sql:'INSERT OR REPLACE INTO names VALUES(?,?,?,?)',args:[address,name,version,updated_at]},
      {sql:'INSERT INTO name_history(address,name,updated_at) VALUES(?,?,?)',args:[address,name,updated_at]},
    ]);
    await tx.commit();return Response.json({name,version,updated_at});
  }catch(e){console.error(e);return Response.json({error:'บันทึกชื่อไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:500});}
  finally{tx?.close();}
}
