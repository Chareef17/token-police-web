import { wallet } from '@/lib/db';
import { addressOf } from '@/lib/amount.mjs';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{address:string}>}){
  let address;try{address=addressOf((await params).address);}catch{return Response.json({error:'Address ไม่ถูกต้อง'},{status:400});}
  try{return Response.json(await wallet(address),{headers:{'Cache-Control':'no-store'}});}
  catch(error){console.error(error);return Response.json({error:'ยังอ่านข้อมูลโหวตไม่ได้ กรุณาตรวจการนำเข้าข้อมูล'},{status:503});}
}
