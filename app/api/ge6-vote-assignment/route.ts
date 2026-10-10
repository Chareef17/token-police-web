import { createHash } from 'node:crypto';
import { database } from '@/lib/db';
import { ge6CandidateByName } from '@/lib/ge6-candidates';

export const runtime='nodejs';
const trustProxy=()=>process.env.TRUST_PROXY==='true'||(process.env.VERCEL==='1'&&process.env.TRUST_PROXY!=='false');

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  let sameOrigin=false;
  try{const parsed=new URL(origin||'');sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===request.headers.get('host');}catch{}
  if(!sameOrigin)return Response.json({error:'Origin ไม่ถูกต้อง'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'ต้องส่ง JSON'},{status:415});
  let txHash:string,logIndex:number,member:string|null,version:number;
  try{
    const raw=await request.text();if(raw.length>1024)throw new Error('ข้อมูลยาวเกินไป');
    const input=JSON.parse(raw);
    txHash=String(input.txHash??'').toLowerCase();
    if(!/^0x[0-9a-f]{64}$/.test(txHash))throw new Error('Tx ไม่ถูกต้อง');
    logIndex=input.logIndex;
    if(!Number.isSafeInteger(logIndex)||logIndex<0)throw new Error('Log index ไม่ถูกต้อง');
    version=input.version;
    if(!Number.isSafeInteger(version)||version<0)throw new Error('Version ไม่ถูกต้อง');
    if(input.member===null)member=null;
    else if(typeof input.member==='string')member=ge6CandidateByName.get(input.member.trim().toLowerCase())??null;
    else throw new Error('กรุณาเลือกเมมเบอร์');
    if(input.member!==null&&!member)throw new Error('เลือกได้เฉพาะผู้สมัคร GE6');
  }catch(error){return Response.json({error:error instanceof Error?error.message:'ข้อมูลไม่ถูกต้อง'},{status:400});}
  let tx;
  try{
    tx=await (await database()).transaction('write');
    const event=(await tx.execute({sql:'SELECT 1 FROM ge6_events WHERE tx_hash=? AND log_index=?',args:[txHash,logIndex]})).rows[0];
    if(!event){await tx.rollback();return Response.json({error:'ไม่พบธุรกรรมนี้'},{status:404});}
    const existing=(await tx.execute({sql:'SELECT version FROM ge6_vote_assignments WHERE tx_hash=? AND log_index=?',args:[txHash,logIndex]})).rows[0];
    if(Number(existing?.version??0)!==version){await tx.rollback();return Response.json({error:'รายการนี้ถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่'},{status:409});}
    const identity=trustProxy()?(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'shared'):'shared';
    const key=createHash('sha256').update('ge6-assignment:'+identity).digest('hex');const now=Date.now();
    const limit=(await tx.execute({sql:'SELECT started,count FROM limits WHERE key=?',args:[key]})).rows[0];
    const active=limit&&now-Number(limit.started)<60000;
    if(active&&Number(limit.count)>=10){await tx.rollback();return Response.json({error:'แก้ไขบ่อยเกินไป กรุณารอ 1 นาที'},{status:429});}
    const updatedAt=new Date().toISOString(),nextVersion=version+1;
    await tx.batch([
      {sql:'DELETE FROM limits WHERE started<?',args:[now-60000]},
      {sql:'INSERT OR REPLACE INTO limits VALUES(?,?,?)',args:[key,active?Number(limit!.started):now,active?Number(limit!.count)+1:1]},
      // Older hosted databases keep this column NOT NULL. An empty value means
      // "no manual assignment" while preserving the optimistic-lock version.
      {sql:'INSERT OR REPLACE INTO ge6_vote_assignments VALUES(?,?,?,?,?)',args:[txHash,logIndex,member??'',nextVersion,updatedAt]},
      {sql:"INSERT INTO metadata(key,value) VALUES('ge6AssignmentRevision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1",args:[]},
    ]);
    await tx.commit();
    return Response.json({member,version:nextVersion,updatedAt},{headers:{'Cache-Control':'no-store'}});
  }catch(error){console.error(error);return Response.json({error:'บันทึกผู้รับโหวตไม่สำเร็จ'},{status:500});}
  finally{tx?.close();}
}
