// Downloads every GE6 candidate's profile photo from the official BNK48 / CGM48 member pages and
// saves a face-cropped 128px avatar to public/members/<name>.webp. Re-run when the official photos change.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const get=async(url,referer)=>{const r=await fetch(url,{headers:{'user-agent':UA,...(referer?{referer}:{})}});if(!r.ok)throw new Error(`${r.status} ${url}`);return r;};
const squash=html=>html.replace(/\s+/g,' ');
const found=new Map();
const bnk=squash(await (await get('https://www.bnk48.com/index.php?page=members')).text());
for(const m of bnk.matchAll(/url\((data\/Members\/\d+\/s\/[^)]+)\);"><\/div> <div class="boxnameMem"> <div class="nameMem"> ([^<]+?) <\/div>/g))
  found.set(m[2].trim().toLowerCase(),{url:'https://www.bnk48.com/'+m[1],referer:'https://www.bnk48.com/'});
const cgm=squash(await (await get('https://cgm48official.com/')).text());
for(const m of cgm.matchAll(/url\('(https:\/\/img\.bnk48cdn\.net\/theme\/3\/discover\/member-[^']+)'\);"> <a href="\/members\/([^"]+)">/g))
  found.set(decodeURIComponent(m[2]).toLowerCase(),{url:m[1],referer:'https://cgm48official.com/'});
const names=[...readFileSync(new URL('../lib/ge6-candidates.ts',import.meta.url),'utf8').matchAll(/'([A-Za-z]+)'/g)].map(m=>m[1]);
const candidates=names.slice(0,names.indexOf('Valentine')+1);
const out=new URL('../public/members/',import.meta.url);mkdirSync(out,{recursive:true});
const missing=[];
for(const name of candidates){
  const source=found.get(name.toLowerCase());
  if(!source){missing.push(name);continue;}
  const image=sharp(Buffer.from(await (await get(source.url,source.referer)).arrayBuffer()));
  const {width,height}=await image.metadata();
  // Official photos are square portraits with the face in the upper middle.
  const size=Math.round(Math.min(width,height)*0.56);
  const crop={left:Math.round((width-size)/2),top:Math.round(height*0.08),width:size,height:size};
  writeFileSync(new URL(`${name.toLowerCase()}.webp`,out),await image.extract(crop).resize(128,128).webp({quality:82}).toBuffer());
  await new Promise(resolve=>setTimeout(resolve,250));
}
console.log(`saved ${candidates.length-missing.length}/${candidates.length} photos`+(missing.length?`; missing: ${missing.join(', ')}`:''));
