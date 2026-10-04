import { findNames } from '@/lib/db';
export const runtime='nodejs';
export async function GET(request:Request){
  const q=new URL(request.url).searchParams.get('q')||'';
  if(q.length>60)return Response.json({results:[]});
  try{return Response.json({results:await findNames(q)},{headers:{'Cache-Control':'no-store'}});}
  catch(error){console.error(error);return Response.json({error:'ค้นหาชื่อไม่สำเร็จ'},{status:503});}
}
