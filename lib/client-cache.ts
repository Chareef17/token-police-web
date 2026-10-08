// Browser-side cache for API reads: kept for 5 minutes in memory and in sessionStorage, so going
// back or switching pages (even with a full page load in the same tab) reuses the last answer.
// Pass fresh=true (the "โหลดข้อมูลใหม่" button) to skip it.
const TTL=5*60*1000;
const memory=new Map<string,{at:number;data:unknown}>();
const key=(url:string)=>'api-cache:'+url;
function read(url:string){
  const hit=memory.get(url);
  if(hit)return hit;
  try{const raw=sessionStorage.getItem(key(url));if(raw){const saved=JSON.parse(raw);memory.set(url,saved);return saved as {at:number;data:unknown};}}catch{}
  return undefined;
}
export async function cachedJson<T>(url:string,{fresh=false,signal}:{fresh?:boolean;signal?:AbortSignal}={}):Promise<T>{
  const hit=fresh?undefined:read(url);
  if(hit&&Date.now()-hit.at<TTL)return hit.data as T;
  const response=await fetch(url,{signal});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error||'โหลดข้อมูลไม่สำเร็จ');
  const entry={at:Date.now(),data};
  memory.set(url,entry);
  try{sessionStorage.setItem(key(url),JSON.stringify(entry));}catch{}
  return data as T;
}
export function forget(url:string){memory.delete(url);try{sessionStorage.removeItem(key(url));}catch{}}
