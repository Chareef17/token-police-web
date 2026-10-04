import { database } from './db';
import { amount, sum, units } from './amount.mjs';
import { tokenxGet } from './tokenx-transport.mjs';
const GE6_TOKEN='0x2f5c60bde7a5ebd2b116bb03cb5232fa1ea55f1c';
// Not fans: the GE6 voting contract, the treasury that received the whole mint, and every wallet the
// treasury sent GE6 to directly (official distribution wallets), as traced on TokenX Scan in Oct 2026.
export const officialWallets=new Set([
  '0x86a1f49e1b1cbd69971e99b66123264c75ac2c8f', // GE6 voting contract
  '0x88de4a0c186efe75fd359f4ebf36e5c4144e1255', // treasury (received the 5,000,027 GE6 mint)
  '0x4bfe835bfc51e3b0ffddc89951d0eab7ff175f0f','0x7a6446b20dcae3aed0e6a1d21ba5d6787a341148',
  '0x563a62883fd50d8463c1621528fca9d54ca7f8c9','0xf1c567e495ad13d48eb684a7bfbe33e3ae566abb',
  '0x90a1e95d305df30b0e00f63cc3b9ff9bfefa9109','0xa66e830bc83c98a78ac20d1b705e8abe1c768195',
  '0x8e6d24b7de8f178027e16d9c8f1c8d73edd2e5a4','0x59ca9c4d13d65c03bc3bdb227d3e745ccccc50cc',
  '0xd754a0bff84998306f306da12a3eeedbdd8abf41','0x4924829cbbfb3b7de7469098a7867d43a5cd248a',
]);
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
  const holders=page.items.map(item=>{
    const address=String(item.address?.hash).toLowerCase();
    if(!/^0x[0-9a-f]{40}$/.test(address)||!/^\d+$/.test(item.value||''))throw new Error('Invalid holder');
    return {rank:0,address,name:null as string|null,amount:amount(BigInt(item.value!)),contract:!!item.address?.is_contract};
  }).filter(h=>!officialWallets.has(h.address)).slice(0,limit).map((h,i)=>({...h,rank:i+1}));
  return {holders,fetchedAt:new Date().toISOString()};
});
export async function ge6Holders(limit=20){
  const {holders,fetchedAt}=await holderList(limit);const names=await namesFor(holders.map(h=>h.address));
  return {holders:holders.map(h=>({...h,name:names.get(h.address)??null})),fetchedAt};
}
