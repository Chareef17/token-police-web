import { createHash } from 'node:crypto';
import { namesDb } from '@/lib/db';
import { addressOf,nameOf } from '@/lib/amount.mjs';
export const runtime='nodejs';
export async function POST(request:Request){
  const origin=request.headers.get('origin');
  let sameOrigin=false;
  try { const parsed=new URL(origin||''); sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host'); } catch {}
  if(!sameOrigin)return Response.json({error:'Origin ไม่ถูกต้อง'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'ต้องส่ง JSON'},{status:415});
  let input,address,name;
  try{const raw=await request.text();if(raw.length>2048)throw new Error('ข้อมูลยาวเกินไป');input=JSON.parse(raw);address=addressOf(input.address);name=nameOf(input.name);if(!Number.isSafeInteger(input.version)||input.version<0)throw new Error('Version ไม่ถูกต้อง');}
  catch(e){return Response.json({error:e instanceof Error?e.message:'ข้อมูลไม่ถูกต้อง'},{status:400});}
  const db=namesDb();
  try{
    db.exec('BEGIN IMMEDIATE');
    const current=db.prepare('SELECT version FROM names WHERE address=?').get(address);
    if(Number(current?.version||0)!==input.version){db.exec('ROLLBACK');return Response.json({error:'มีคนเปลี่ยนชื่อนี้แล้ว กรุณาค้นหาใหม่ก่อนแก้ไข'},{status:409});}
    const identity=process.env.TRUST_PROXY==='true'?(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'shared'):'shared';
    const key=createHash('sha256').update(identity).digest('hex');const now=Date.now();
    const limit=db.prepare('SELECT started,count FROM limits WHERE key=?').get(key);
    const active=limit && now-Number(limit.started)<60000;
    if(active && Number(limit.count)>=10){db.exec('ROLLBACK');return Response.json({error:'แก้ไขชื่อบ่อยเกินไป กรุณารอ 1 นาที'},{status:429});}
    db.prepare('DELETE FROM limits WHERE started<?').run(now-60000);
    db.prepare('INSERT OR REPLACE INTO limits VALUES(?,?,?)').run(key,active?Number(limit!.started):now,active?Number(limit!.count)+1:1);
    const updated_at=new Date().toISOString();const version=input.version+1;
    db.prepare('INSERT OR REPLACE INTO names VALUES(?,?,?,?)').run(address,name,version,updated_at);
    db.prepare('INSERT INTO name_history(address,name,updated_at) VALUES(?,?,?)').run(address,name,updated_at);
    db.exec('COMMIT');return Response.json({name,version,updated_at});
  }catch(e){console.error(e);return Response.json({error:'บันทึกชื่อไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:500});}
  finally{db.close();}
}
