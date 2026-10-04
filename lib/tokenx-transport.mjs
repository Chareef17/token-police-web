import { chromium } from 'playwright-core';
const origin='https://scan.tokenx.finance';
export class TokenXTransport {
  browser; page; lastRequest=0;
  async get(path) {
    const url=new URL(origin+'/api/v2'+path);
    url.searchParams.set('_',`${Date.now()}-${Math.random()}`);
    const wait=1200-(Date.now()-this.lastRequest);
    if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    this.lastRequest=Date.now();
    if(process.env.TOKENX_MODE==='api') {
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(`TokenX HTTP ${response.status}`);
      return response.json();
    }
    if(!this.browser?.isConnected()) {
      await this.close();
      this.browser=await chromium.launch({headless:true,channel:process.env.TOKENX_BROWSER_PATH?undefined:(process.env.TOKENX_BROWSER_CHANNEL||'chrome'),executablePath:process.env.TOKENX_BROWSER_PATH||undefined});
      this.page=await this.browser.newPage({locale:'th-TH',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
      const response=await this.page.goto(origin,{waitUntil:'domcontentloaded',timeout:25000});
      if(!response?.ok())throw new Error(`TokenX HTTP ${response?.status()}`);
    }
    return this.page.evaluate(async url=>{
      const r=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000),headers:{accept:'application/json'}});
      if(!r.ok)throw new Error(`TokenX HTTP ${r.status}`);
      return r.json();
    },url.href);
  }
  async close(){this.page=undefined;const browser=this.browser;this.browser=undefined;await browser?.close();}
}
