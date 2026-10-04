import { database } from './db';
import { amount, sum, units } from './amount.mjs';
import { tokenxGet } from './tokenx-transport.mjs';
const GE6_TOKEN='0x2f5c60bde7a5ebd2b116bb03cb5232fa1ea55f1c';
export const fanEvents=['GE5','Thai-Japan 2026'] as const;
type FanEvent=typeof fanEvents[number];
export type Fan={address:string;name:string|null;events:Partial<Record<FanEvent,{nammonn:string;top:boolean}>>;total:string};
export type Holder={rank:number;address:string;name:string|null;amount:string;contract:boolean};
// Short in-memory cache per server instance: historical votes never change, balances move slowly.
const cache=new Map<string,{until:number;value:Promise<unknown>}>();
function cached<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>{
  const hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.value as Promise<T>;
  const value=load();cache.set(key,{until:Date.now()+ttl,value});value.catch(()=>cache.delete(key));return value;
}
async function namesFor(addresses:string[]){
  if(!addresses.length)return new Map<string,string>();
  const rows=(await (await database()).execute({sql:`SELECT address,name FROM names WHERE address IN (${addresses.map(()=>'?').join(',')})`,args:addresses})).rows;
  return new Map(rows.map(r=>[String(r.address),String(r.name)]));
}
// Wallets whose largest vote total in GE5 or Thai-Japan 2026 went to Nammonn, ahead of every other member.
const fanList=()=>cached('fans',3600000,async()=>{
  const rows=(await (await database()).execute({sql:`SELECT address,event,member,amount FROM votes WHERE event IN (${fanEvents.map(()=>'?').join(',')}) AND address IS NOT NULL AND address IN (SELECT address FROM votes WHERE member='Nammonn' AND event IN (${fanEvents.map(()=>'?').join(',')}))`,args:[...fanEvents,...fanEvents]})).rows;
  const totals=new Map<string,Map<FanEvent,Map<string,bigint>>>();
  for(const r of rows){
    const address=String(r.address),event=String(r.event) as FanEvent,member=String(r.member);
    const events=totals.get(address)??new Map();totals.set(address,events);
    const members=events.get(event)??new Map<string,bigint>();events.set(event,members);
    members.set(member,(members.get(member)??0n)+units(String(r.amount)));
  }
  const fans:Fan[]=[];
  for(const [address,events] of totals){
    const fan:Fan={address,name:null,events:{},total:'0'};let top=false;
    for(const [event,members] of events){
      const nammonn=members.get('Nammonn');if(nammonn===undefined)continue;
      const isTop=[...members].every(([member,value])=>member==='Nammonn'||value<nammonn);
      fan.events[event]={nammonn:amount(nammonn),top:isTop};top||=isTop;
    }
    if(!top)continue;
    fan.total=sum(Object.values(fan.events).map(e=>e.nammonn));fans.push(fan);
  }
  fans.sort((a,b)=>{const d=units(b.total)-units(a.total);return d>0n?1:d<0n?-1:0;});
  return fans;
});
// Names are looked up on every request so newly set names show up immediately.
export async function nammonnFans(){
  const fans=await fanList();const names=await namesFor(fans.map(f=>f.address));
  return fans.map(f=>({...f,name:names.get(f.address)??null}));
}
// Top GE6 balances straight from TokenX (sorted by balance there).
const holderList=(limit:number)=>cached('holders:'+limit,300000,async()=>{
  const page=await tokenxGet(`/tokens/${GE6_TOKEN}/holders`) as {items?:{address?:{hash?:string;is_contract?:boolean};value?:string}[]};
  if(!Array.isArray(page.items))throw new Error('Invalid holders response');
  const holders=page.items.slice(0,limit).map((item,i)=>{
    const address=String(item.address?.hash).toLowerCase();
    if(!/^0x[0-9a-f]{40}$/.test(address)||!/^\d+$/.test(item.value||''))throw new Error('Invalid holder');
    return {rank:i+1,address,name:null as string|null,amount:amount(BigInt(item.value!)),contract:!!item.address?.is_contract};
  });
  return {holders,fetchedAt:new Date().toISOString()};
});
export async function ge6Holders(limit=20){
  const {holders,fetchedAt}=await holderList(limit);const names=await namesFor(holders.map(h=>h.address));
  return {holders:holders.map(h=>({...h,name:names.get(h.address)??null})),fetchedAt};
}
