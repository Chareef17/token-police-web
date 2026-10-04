export const runtime='nodejs';
// Saved by the server (not by page script) so Safari keeps it for the full year.
export async function POST(request:Request){
  const theme=(await request.json().catch(()=>null))?.theme;
  if(theme!=='light'&&theme!=='dark')return Response.json({error:'invalid theme'},{status:400});
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  return new Response(null,{status:204,headers:{'Set-Cookie':`theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`}});
}
