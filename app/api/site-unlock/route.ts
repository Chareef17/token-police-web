import { NextResponse } from 'next/server';
import { accessCookie, accessToken, validPin } from '@/lib/site-access';

export const runtime='nodejs';
const attempts=new Map<string,{count:number;until:number}>();

export async function POST(request:Request){
  let sameOrigin=false;
  try{const origin=new URL(request.headers.get('origin')??'');sameOrigin=['http:','https:'].includes(origin.protocol)&&origin.host===request.headers.get('host');}catch{}
  if(!sameOrigin)return new Response(null,{status:403});
  const client=request.headers.get('x-forwarded-for')?.split(',')[0]??'local';
  const state=attempts.get(client);
  if(state&&state.count>=5&&state.until>Date.now())return NextResponse.json({error:'ลองใหม่อีกครั้งใน 1 นาที'},{status:429});
  let input:unknown;
  try{input=await request.json();}catch{return NextResponse.json({error:'PIN ไม่ถูกต้อง'},{status:400});}
  if(!validPin((input as {pin?:unknown})?.pin)){
    attempts.set(client,{count:(state?.until??0)>Date.now()?(state?.count??0)+1:1,until:Date.now()+60000});
    return NextResponse.json({error:'PIN ไม่ถูกต้อง'},{status:401});
  }
  attempts.delete(client);
  const response=NextResponse.json({ok:true});
  response.cookies.set(accessCookie,accessToken(),{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:60*60*12});
  return response;
}
