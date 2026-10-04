import { cookies } from 'next/headers';
import { wallet, logSearch } from '@/lib/db';
import { addressOf } from '@/lib/amount.mjs';
import { adminCookie, isAdmin } from '@/lib/admin';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{address:string}>}){
  let address;try{address=addressOf((await params).address);}catch{return Response.json({error:'Address ไม่ถูกต้อง'},{status:400});}
  let result;
  try{result=await wallet(address);}
  catch(error){console.error(error);return Response.json({error:'ยังอ่านข้อมูลโหวตไม่ได้ กรุณาตรวจการนำเข้าข้อมูล'},{status:503});}
  // The admin's own lookups are not recorded; a logging failure never blocks the search.
  if(!isAdmin((await cookies()).get(adminCookie)?.value))await logSearch(address).catch(error=>console.error('Search log failed',error));
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
