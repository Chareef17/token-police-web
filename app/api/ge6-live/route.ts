import { NextRequest,NextResponse } from 'next/server';
import { ge6Live,type VoteTier } from '@/lib/ge6-live';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:NextRequest){
  const raw=request.nextUrl.searchParams.get('page')??'1';
  const page=/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
  const rawTier=request.nextUrl.searchParams.get('tier');
  const tier=rawTier&&/^tier[0-6]$/.test(rawTier)?rawTier as VoteTier:null;
  const min=request.nextUrl.searchParams.get('min');
  if(min!==null&&!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,18})?$/.test(min))return NextResponse.json({error:'ยอดโหวตไม่ถูกต้อง'},{status:400});
  try{return NextResponse.json(await ge6Live(page,min!==null?null:tier,min),{headers:{'Cache-Control':'no-store'}});}
  catch(error){console.error(error);return NextResponse.json({error:'โหลดธุรกรรม GE6 ไม่สำเร็จ'},{status:503});}
}
