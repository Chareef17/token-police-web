import { NextRequest, NextResponse } from 'next/server';
import { accessCookie, validAccess } from './lib/site-access';

export function proxy(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path==='/pin'||path==='/api/site-unlock')return NextResponse.next();
  if(validAccess(request.cookies.get(accessCookie)?.value))return NextResponse.next();
  if(path.startsWith('/api/'))return NextResponse.json({error:'กรุณาใส่ PIN ก่อนใช้งาน'},{status:401,headers:{'Cache-Control':'no-store'}});
  const url=request.nextUrl.clone();url.pathname='/pin';url.search='';url.searchParams.set('next',request.nextUrl.pathname+request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config={matcher:['/((?!_next/|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff|woff2)$).*)']};
