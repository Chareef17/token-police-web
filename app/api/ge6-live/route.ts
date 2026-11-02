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
  const exact=request.nextUrl.searchParams.get('exact');
  const date=request.nextUrl.searchParams.get('date');
  const time=request.nextUrl.searchParams.get('time');
  const valid=(value:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,18})?$/.test(value);
  if((min!==null&&!valid(min))||(exact!==null&&!valid(exact)))return NextResponse.json({error:'ยอดโหวตไม่ถูกต้อง'},{status:400});
  if((date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(date))||(time!==null&&(!date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))))return NextResponse.json({error:'วันหรือเวลาไม่ถูกต้อง'},{status:400});
  if(date){const [year,month,day]=date.split('-').map(Number);const parsed=new Date(Date.UTC(year,month-1,day));if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)return NextResponse.json({error:'วันที่ไม่ถูกต้อง'},{status:400});}
  try{return NextResponse.json(await ge6Live(page,min!==null||exact!==null?null:tier,min,exact,date,time),{headers:{'Cache-Control':'no-store'}});}
  catch(error){console.error(error);return NextResponse.json({error:'โหลดธุรกรรม GE6 ไม่สำเร็จ'},{status:503});}
}
