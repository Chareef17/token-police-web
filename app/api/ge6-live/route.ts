import { NextRequest,NextResponse } from 'next/server';
import { ge6Live } from '@/lib/ge6-live';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:NextRequest){
  const raw=request.nextUrl.searchParams.get('page')??'1';
  const page=/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
  try{return NextResponse.json(await ge6Live(page),{headers:{'Cache-Control':'no-store'}});}
  catch(error){console.error(error);return NextResponse.json({error:'โหลดธุรกรรม GE6 ไม่สำเร็จ'},{status:503});}
}
