import { Interface } from 'ethers';
import { amount } from './amount.mjs';
export { initialize } from './database.mjs';
export const contract='0x86a1f49e1b1cbd69971e99b66123264c75ac2c8f';
export const creationBlock=49110941;
export const iface=new Interface(['event Voted(address indexed _voter, uint256 indexed _index, uint256 _amount, bytes32 _hash)']);
const topic=iface.getEvent('Voted').topicHash.toLowerCase();
const hashPattern=/^0x[0-9a-f]{64}$/i;
const columns=['tx_hash','log_index','block_number','block_hash','vote_index','address','amount','voted_at'];
async function getMeta(db,key){return (await db.execute({sql:'SELECT value FROM metadata WHERE key=?',args:[key]})).rows[0]?.value;}
const setMeta=(key,value)=>({sql:'INSERT OR REPLACE INTO metadata VALUES(?,?)',args:[key,JSON.stringify(value)]});
export async function markError(db,error){
  const previous=JSON.parse(await getMeta(db,'ge6Status')||'null');
  await db.execute(setMeta('ge6Status',{...previous,source:'tokenx-direct',phase:'error',lastError:String(error),lastAttempt:new Date().toISOString()}));
}
function validBlock(block,height){if(block?.height!==height||!hashPattern.test(block.hash))throw new Error('Invalid block response');return block;}
export function verifySequence(events){
  const indices=events.map(e=>BigInt(e.vote_index)).sort((a,b)=>a<b?-1:a>b?1:0);
  for(let i=0;i<indices.length;i++)if(indices[i]!==BigInt(i))throw new Error(`Incomplete GE6 vote sequence at ${i}; snapshot unchanged`);
}
const plain=row=>Object.fromEntries(columns.map(c=>[c,c==='log_index'||c==='block_number'?Number(row[c]):row[c]]));
export async function poll(db,transport,{onProgress=()=>{},assertLease=async()=>{},now=Date.now()}={}){
  const page=await transport.get('/blocks?type=block');
  const head=page.items?.[0];
  if(!Number.isSafeInteger(head?.height)||head.height<creationBlock+12)throw new Error('Invalid chain head');
  const safeHeight=head.height-12;
  const checkpoint=JSON.parse(await getMeta(db,'ge6Checkpoint')||'null');
  let reorg=false;
  if(checkpoint){
    if(safeHeight<checkpoint.height)throw new Error('Explorer is behind checkpoint');
    const block=validBlock(await transport.get(`/blocks/${checkpoint.height}`),checkpoint.height);
    reorg=block.hash.toLowerCase()!==checkpoint.hash.toLowerCase();
  }
  const full=!checkpoint||reorg||now-(checkpoint.auditedAt||0)>=3600000;
  const from=full?creationBlock:Math.max(creationBlock,checkpoint.height-300);
  const safeBlock=validBlock(await transport.get(`/blocks/${safeHeight}`),safeHeight);
  const stored=(await db.execute('SELECT * FROM ge6_events')).rows.map(plain);
  const retained=full?[]:stored.filter(e=>e.block_number<from);
  const collected=new Map();const cursors=new Set();let cursor;let done=false;
  const timeHints=new Map(stored.map(e=>[e.tx_hash,e.voted_at]));
  const times=new Map();
  for(let number=0;number<10000;number++){
    await assertLease();
    const params=new URLSearchParams();for(const [k,v] of Object.entries(cursor||{}))if(v!==null&&k!=='_')params.set(k,String(v));
    let response;
    for(let attempt=0;attempt<5;attempt++){
      response=await transport.get(`/addresses/${contract}/logs?${params}`);
      if(!Array.isArray(response.items))throw new Error('Invalid log page');
      if(!cursor||response.items.every(log=>log.block_number<cursor.block_number||(log.block_number===cursor.block_number&&log.index<cursor.index)))break;
      if(attempt===4)throw new Error('Stale log pagination');
    }
    for(const log of response.items){
      if(!Number.isSafeInteger(log.block_number)||!Number.isSafeInteger(log.index)||log.index<0)throw new Error('Invalid log position');
      if(log.block_number<from||log.block_number>safeHeight)continue;
      if(log.topics?.[0]?.toLowerCase()!==topic)continue;
      const decoded=iface.parseLog({topics:log.topics.filter(t=>t!==null),data:log.data});
      const tx=(log.tx_hash||log.transaction_hash)?.toLowerCase();
      if(!decoded||!hashPattern.test(tx||'')||!hashPattern.test(log.block_hash||''))throw new Error('Invalid vote log');
      let timestamp=log.timestamp||times.get(log.block_number)||(!reorg?timeHints.get(tx):undefined);
      if(!timestamp){timestamp=(await transport.get(`/blocks/${log.block_number}`)).timestamp;times.set(log.block_number,timestamp);}
      if(!Number.isFinite(Date.parse(timestamp)))throw new Error('Invalid vote timestamp');
      const event={tx_hash:tx,log_index:log.index,block_number:log.block_number,block_hash:log.block_hash.toLowerCase(),vote_index:String(decoded.args._index),address:String(decoded.args._voter).toLowerCase(),amount:amount(decoded.args._amount),voted_at:new Date(timestamp).toISOString()};
      const key=tx+':'+log.index;
      if(collected.has(key)&&JSON.stringify(collected.get(key))!==JSON.stringify(event))throw new Error('Conflicting duplicate log');
      collected.set(key,event);
    }
    if(number%10===0)onProgress({page:number+1,collected:collected.size,full});
    if(!response.next_page_params||response.items.some(log=>log.block_number<from)){done=true;break;}
    const next=response.next_page_params;
    if(!Number.isSafeInteger(next.block_number)||!Number.isSafeInteger(next.index))throw new Error('Invalid pagination cursor');
    const key=JSON.stringify(Object.entries(next).filter(([k])=>k!=='_').sort());
    if(cursors.has(key))throw new Error('Repeated pagination cursor');
    cursors.add(key);cursor=next;
  }
  if(!done)throw new Error('Pagination limit reached');
  const all=[...retained,...collected.values()];
  try{verifySequence(all);}catch(error){if(checkpoint)await db.execute(setMeta('ge6Checkpoint',{...checkpoint,auditedAt:0}));throw error;}
  const finalBlock=validBlock(await transport.get(`/blocks/${safeHeight}`),safeHeight);
  if(finalBlock.hash.toLowerCase()!==safeBlock.hash.toLowerCase())throw new Error('Chain changed during sync');
  await assertLease();
  // Write only the difference against the stored snapshot, in one atomic batch.
  const keyOf=e=>e.tx_hash+':'+e.log_index;
  const next=new Map(all.map(e=>[keyOf(e),e]));
  const previous=new Map(stored.map(e=>[keyOf(e),e]));
  const statements=[];
  for(const [key,e] of previous)if(!next.has(key)){
    statements.push({sql:'DELETE FROM ge6_events WHERE tx_hash=? AND log_index=?',args:[e.tx_hash,e.log_index]});
    statements.push({sql:'DELETE FROM votes WHERE id=?',args:['chain:'+key]});
  }
  for(const [key,e] of next)if(JSON.stringify(previous.get(key))!==JSON.stringify(e)){
    statements.push({sql:'INSERT OR REPLACE INTO ge6_events VALUES(?,?,?,?,?,?,?,?)',args:columns.map(c=>e[c])});
    statements.push({sql:"INSERT OR REPLACE INTO votes VALUES(?,'GE6','Unknown',?,NULL,?,?,?)",args:['chain:'+key,e.amount,e.address,e.tx_hash,e.voted_at]});
  }
  // Rows from before this change used other ids; they are only cleaned when no chain ids exist yet.
  if(!stored.length)statements.unshift({sql:"DELETE FROM votes WHERE event='GE6'",args:[]});
  const status={source:'tokenx-direct',phase:'active',head:head.height,confirmedBlock:safeHeight,lastSuccess:new Date().toISOString(),votes:all.length};
  statements.push(setMeta('ge6Checkpoint',{height:safeHeight,hash:safeBlock.hash.toLowerCase(),auditedAt:full?now:checkpoint.auditedAt}));
  statements.push(setMeta('ge6Status',status));
  await db.batch(statements,'write');
  return status;
}
