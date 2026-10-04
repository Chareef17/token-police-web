const origin='https://scan.tokenx.finance';
// TokenX rejects requests without a browser User-Agent.
export const tokenxHeaders={accept:'application/json','accept-language':'th-TH,th;q=0.9,en;q=0.8','user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',referer:origin+'/'};
export async function tokenxGet(path){
  const url=new URL(origin+'/api/v2'+path);
  url.searchParams.set('_',`${Date.now()}-${Math.random()}`);
  const response=await fetch(url,{cache:'no-store',headers:tokenxHeaders,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`TokenX HTTP ${response.status}`);
  return response.json();
}
export class TokenXTransport {
  lastRequest=0;
  async get(path) {
    const wait=1200-(Date.now()-this.lastRequest);
    if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    this.lastRequest=Date.now();
    return tokenxGet(path);
  }
  async close(){}
}
