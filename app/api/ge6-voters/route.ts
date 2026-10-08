import { NextRequest,NextResponse } from 'next/server';
import { ge6Voters } from '@/lib/ge6-voters';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const raw=request.nextUrl.searchParams.get('page')??'1';
  const page=/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
  try{return NextResponse.json(await ge6Voters(page));}
  catch(error){console.error(error);return NextResponse.json({error:'โหลดอันดับผู้โหวต GE6 ไม่สำเร็จ'},{status:503});}
}
