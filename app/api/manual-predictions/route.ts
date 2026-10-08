import { createHash } from 'node:crypto';
import { database } from '@/lib/db';
import { addressOf } from '@/lib/amount.mjs';
import { ge6CandidateByName } from '@/lib/ge6-candidates';
export const runtime='nodejs';
const trustProxy=()=>process.env.TRUST_PROXY==='true'||(process.env.VERCEL==='1'&&process.env.TRUST_PROXY!=='false');

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  let sameOrigin=false;
  try{const parsed=new URL(origin||'');sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host');}catch{}
  if(!sameOrigin)return Response.json({error:'Origin ไม่ถูกต้อง'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'ต้องส่ง JSON'},{status:415});
  let address:string,members:string[],version:number;
  try{
    const raw=await request.text();if(raw.length>2048)throw new Error('ข้อมูลยาวเกินไป');
    const input=JSON.parse(raw);
    address=addressOf(input.address);
    version=input.version;
    if(!Number.isSafeInteger(version)||version<0)throw new Error('Version ไม่ถูกต้อง');
    if(!Array.isArray(input.members)||![0,3].includes(input.members.length))throw new Error('กรุณาเลือกผู้สมัคร 3 คน หรือเคลียร์รายการ');
    members=input.members.map((value:unknown)=>{
      if(typeof value!=='string')throw new Error('ชื่อเมมเบอร์ไม่ถูกต้อง');
      const canonical=ge6CandidateByName.get(value.trim().toLowerCase());
      if(!canonical)throw new Error('เลือกได้เฉพาะผู้สมัคร GE6');
      return canonical;
    });
    if(new Set(members).size!==members.length)throw new Error('กรุณาเลือกเมมเบอร์ไม่ซ้ำกัน');
  }catch(e){return Response.json({error:e instanceof Error?e.message:'ข้อมูลไม่ถูกต้อง'},{status:400});}
  let tx;
  try{
    tx=await (await database()).transaction('write');
    const current=(await tx.execute({sql:'SELECT version FROM manual_predictions WHERE address=?',args:[address]})).rows[0];
    if(Number(current?.version||0)!==version){await tx.rollback();return Response.json({error:'มีคนแก้ลำดับนี้แล้ว กรุณาโหลดข้อมูลใหม่ก่อนบันทึก'},{status:409});}
    const identity=trustProxy()?(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'shared'):'shared';
    const key=createHash('sha256').update(identity).digest('hex');const now=Date.now();
    const limit=(await tx.execute({sql:'SELECT started,count FROM limits WHERE key=?',args:[key]})).rows[0];
    const active=limit&&now-Number(limit.started)<60000;
    if(active&&Number(limit.count)>=10){await tx.rollback();return Response.json({error:'แก้ไขบ่อยเกินไป กรุณารอ 1 นาที'},{status:429});}
    const updated_at=new Date().toISOString();const nextVersion=version+1;
    await tx.batch([
      {sql:'DELETE FROM limits WHERE started<?',args:[now-60000]},
      {sql:'INSERT OR REPLACE INTO limits VALUES(?,?,?)',args:[key,active?Number(limit!.started):now,active?Number(limit!.count)+1:1]},
      {sql:'INSERT OR REPLACE INTO manual_predictions VALUES(?,?,?,?,?,?)',args:[address,members[0]??null,members[1]??null,members[2]??null,nextVersion,updated_at]},
    ]);
    await tx.commit();
    return Response.json({members,version:nextVersion,updated_at},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error(e);return Response.json({error:'บันทึกลำดับไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:500});}
  finally{tx?.close();}
}
