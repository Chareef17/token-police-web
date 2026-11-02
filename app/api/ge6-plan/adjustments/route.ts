import { randomUUID } from 'node:crypto';
import { database } from '@/lib/db';
import { ge6CandidateByName } from '@/lib/ge6-candidates';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};

function sameOrigin(request:Request){
  try{const origin=new URL(request.headers.get('origin')||'');return origin.host===request.headers.get('host')&&['http:','https:'].includes(origin.protocol);}catch{return false;}
}
function parseInput(input:unknown){
  if(!input||typeof input!=='object')throw Error('ข้อมูลไม่ถูกต้อง');
  const value=input as Record<string,unknown>;
  const member=typeof value.member==='string'?ge6CandidateByName.get(value.member.trim().toLowerCase()):undefined;
  if(!member)throw Error('ไม่พบเมมเบอร์ GE6');
  const delta=Number(value.delta);
  const cents=Math.round(delta*100);
  if(!Number.isSafeInteger(cents)||cents===0||Math.abs(cents)>1000000000)throw Error('ยอดคะแนนไม่ถูกต้อง');
  const note=typeof value.note==='string'?value.note.trim():'';
  if(note.length>200)throw Error('หมายเหตุยาวเกินไป');
  return {member,cents,note};
}
async function body(request:Request){
  if(!sameOrigin(request))throw Error('Origin ไม่ถูกต้อง');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('ต้องส่ง JSON');
  const raw=await request.text();
  if(raw.length>1024)throw Error('ข้อมูลยาวเกินไป');
  return JSON.parse(raw) as Record<string,unknown>;
}
export async function GET(){
  try{const result=await (await database()).execute('SELECT id,member,delta_cents,note,created_at,updated_at FROM ge6_plan_adjustments ORDER BY created_at,id');return Response.json({items:result.rows.map(row=>({id:String(row.id),member:String(row.member),delta:Number(row.delta_cents)/100,note:String(row.note),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))},{headers:noStore});}
  catch(error){console.error(error);return Response.json({error:'โหลดแผนไม่สำเร็จ'},{status:503,headers:noStore});}
}
export async function POST(request:Request){
  try{const {member,cents,note}=parseInput(await body(request));const id=randomUUID(),now=new Date().toISOString();await (await database()).execute({sql:'INSERT INTO ge6_plan_adjustments VALUES(?,?,?,?,?,?)',args:[id,member,cents,note,now,now]});return Response.json({id},{status:201,headers:noStore});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'บันทึกไม่สำเร็จ'},{status:400,headers:noStore});}
}
export async function PUT(request:Request){
  try{const input=await body(request);const id=String(input.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('รายการไม่ถูกต้อง');const {member,cents,note}=parseInput(input);const result=await (await database()).execute({sql:'UPDATE ge6_plan_adjustments SET member=?,delta_cents=?,note=?,updated_at=? WHERE id=?',args:[member,cents,note,new Date().toISOString(),id]});if(!result.rowsAffected)return Response.json({error:'ไม่พบรายการ'},{status:404});return Response.json({ok:true},{headers:noStore});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'บันทึกไม่สำเร็จ'},{status:400,headers:noStore});}
}
export async function DELETE(request:Request){
  try{const input=await body(request);const id=String(input.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('รายการไม่ถูกต้อง');await (await database()).execute({sql:'DELETE FROM ge6_plan_adjustments WHERE id=?',args:[id]});return Response.json({ok:true},{headers:noStore});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'ลบไม่สำเร็จ'},{status:400,headers:noStore});}
}
