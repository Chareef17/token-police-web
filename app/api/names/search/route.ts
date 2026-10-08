import { findNames, findWalletCodes } from '@/lib/db';
import { ge6CandidateNames } from '@/lib/ge6-candidates';
export const runtime='nodejs';
export async function GET(request:Request){
  const q=new URL(request.url).searchParams.get('q')||'';
  if(q.length>60)return Response.json({results:[]});
  try{
    const query=q.normalize('NFC').trim().toLowerCase();
    const members=query?ge6CandidateNames.filter(name=>name.toLowerCase().includes(query))
      .sort((a,b)=>(a.toLowerCase()===query?0:1)-(b.toLowerCase()===query?0:1)||a.localeCompare(b)).slice(0,4):[];
    // 4–10 digits is an iAM48 wallet code from the old vote files.
    if(/^\d{4,10}$/.test(query)){
      const codes=await findWalletCodes(query,8);
      return Response.json({results:codes.map(c=>({kind:'wallet',address:c.address,name:c.name??'Wallet code '+c.code,code:c.code}))},{headers:{'Cache-Control':'no-store'}});
    }
    const wallets=await findNames(q,8-members.length);
    return Response.json({results:[...members.map(name=>({kind:'member',name})),...wallets.map(wallet=>({kind:'wallet',...wallet}))]},{headers:{'Cache-Control':'no-store'}});
  }
  catch(error){console.error(error);return Response.json({error:'ค้นหาชื่อไม่สำเร็จ'},{status:503});}
}
