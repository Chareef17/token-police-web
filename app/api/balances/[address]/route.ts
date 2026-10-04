import { balances } from '@/lib/balances';
import { addressOf } from '@/lib/amount.mjs';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{address:string}>}){
  let address;try{address=addressOf((await params).address);}catch{return Response.json({error:'Address ไม่ถูกต้อง'},{status:400});}
  try{return Response.json(await balances(address),{headers:{'Cache-Control':'no-store'}});}
  catch(error){console.error('Balance lookup failed',error);return Response.json({error:'TokenX Scan ยังไม่ตอบกลับ ลองโหลดอีกครั้งได้'},{status:503});}
}
