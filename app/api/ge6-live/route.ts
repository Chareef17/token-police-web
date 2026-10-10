import { NextRequest,NextResponse } from 'next/server';
import { ge6Live,type VoteTier,type VoteRange } from '@/lib/ge6-live';
import { units } from '@/lib/amount.mjs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:NextRequest){
  const raw=request.nextUrl.searchParams.get('page')??'1';
  const page=/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
  const rawTier=request.nextUrl.searchParams.get('tier');
  const tier=rawTier&&/^tier[1-6]$/.test(rawTier)?rawTier as VoteTier:null;
  const min=request.nextUrl.searchParams.get('min'),max=request.nextUrl.searchParams.get('max');
  const valid=(value:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,18})?$/.test(value);
  if((min!==null&&!valid(min))||(max!==null&&!valid(max))||(min!==null&&max!==null&&units(min)>units(max)))return NextResponse.json({error:'ช่วงยอดโหวตไม่ถูกต้อง'},{status:400});
  const range:VoteRange|null=min!==null||max!==null?{min,max}:null;
  try{return NextResponse.json(await ge6Live(page,range?null:tier,range),{headers:{'Cache-Control':'no-store'}});}
  catch(error){console.error(error);return NextResponse.json({error:'โหลดธุรกรรม GE6 ไม่สำเร็จ'},{status:503});}
}
