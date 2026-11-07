import { database } from '@/lib/db';
import { ge6CandidateNames } from '@/lib/ge6-candidates';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const validNames=new Set(ge6CandidateNames);

function allowed(request:Request){
  try{const origin=new URL(request.headers.get('origin')||'');return ['http:','https:'].includes(origin.protocol)&&origin.host===request.headers.get('host');}catch{return false;}
}
async function inputOf(request:Request){
  if(!allowed(request))throw Error('Origin ไม่ถูกต้อง');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('ต้องส่ง JSON');
  const raw=await request.text();
  if(raw.length>4096)throw Error('ข้อมูลยาวเกินไป');
  const input=JSON.parse(raw) as {names?:unknown;version?:unknown};
  if(!Number.isSafeInteger(input.version)||Number(input.version)<0)throw Error('Version ไม่ถูกต้อง');
  if(input.names!==null&&(!Array.isArray(input.names)||input.names.length!==validNames.size||new Set(input.names).size!==validNames.size||input.names.some(name=>!validNames.has(name))))throw Error('ลำดับเมมเบอร์ไม่ครบ');
  return {names:input.names as string[]|null,version:Number(input.version)};
}

export async function GET(){
  try{const result=await (await database()).execute('SELECT names,version FROM ge6_plan_order WHERE id=1');const row=result.rows[0];return Response.json({names:row?JSON.parse(String(row.names)):null,version:Number(row?.version??0)},{headers});}
  catch(error){console.error(error);return Response.json({error:'โหลดลำดับไม่สำเร็จ'},{status:503,headers});}
}

export async function PUT(request:Request){
  let tx;
  try{
    const {names,version}=await inputOf(request);
    tx=await (await database()).transaction('write');
    const current=(await tx.execute('SELECT version FROM ge6_plan_order WHERE id=1')).rows[0];
    if(Number(current?.version??0)!==version){await tx.rollback();return Response.json({error:'มีคนแก้ลำดับแล้ว กรุณาโหลดข้อมูลใหม่',version:Number(current?.version??0)},{status:409,headers});}
    const nextVersion=version+1;
    if(names===null)await tx.execute('DELETE FROM ge6_plan_order WHERE id=1');
    else await tx.execute({sql:'INSERT OR REPLACE INTO ge6_plan_order(id,names,version,updated_at) VALUES(1,?,?,?)',args:[JSON.stringify(names),nextVersion,new Date().toISOString()]});
    await tx.commit();
    return Response.json({names,version:names===null?0:nextVersion},{headers});
  }catch(error){console.error(error);return Response.json({error:error instanceof Error?error.message:'บันทึกลำดับไม่สำเร็จ'},{status:400,headers});}
  finally{tx?.close();}
}
