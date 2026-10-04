import { Interface } from 'ethers';
import { amount } from './amount.mjs';
export const contract='0x86a1f49e1b1cbd69971e99b66123264c75ac2c8f';
export const creationBlock=49110941;
export const iface=new Interface(['event Voted(address indexed _voter, uint256 indexed _index, uint256 _amount, bytes32 _hash)']);
const topic=iface.getEvent('Voted').topicHash.toLowerCase();
const hashPattern=/^0x[0-9a-f]{64}$/i;
export function initialize(db) {
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;
    CREATE TABLE IF NOT EXISTS votes(id TEXT PRIMARY KEY,event TEXT,member TEXT,amount TEXT,wallet TEXT,address TEXT,tx_hash TEXT,voted_at TEXT);
    CREATE INDEX IF NOT EXISTS votes_address ON votes(address);
    CREATE INDEX IF NOT EXISTS votes_wallet ON votes(wallet);
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE IF NOT EXISTS ge6_events(tx_hash TEXT,log_index INTEGER,block_number INTEGER,block_hash TEXT,vote_index TEXT,address TEXT,amount TEXT,voted_at TEXT,PRIMARY KEY(tx_hash,log_index));
    CREATE TABLE IF NOT EXISTS indexer_lease(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,expires INTEGER);`);
}
function getMeta(db,key){return db.prepare('SELECT value FROM metadata WHERE key=?').get(key)?.value;}
function setMeta(db,key,value){db.prepare('INSERT OR REPLACE INTO metadata VALUES(?,?)').run(key,JSON.stringify(value));}
export function markError(db,error){
  const previous=JSON.parse(getMeta(db,'ge6Status')||'null');
  setMeta(db,'ge6Status',{...previous,source:'tokenx-direct',phase:'error',lastError:String(error),lastAttempt:new Date().toISOString()});
}
function validBlock(block,height){if(block?.height!==height||!hashPattern.test(block.hash))throw new Error('Invalid block response');return block;}
export function verifySequence(events){
  const indices=events.map(e=>BigInt(e.vote_index)).sort((a,b)=>a<b?-1:a>b?1:0);
  for(let i=0;i<indices.length;i++)if(indices[i]!==BigInt(i))throw new Error(`Incomplete GE6 vote sequence at ${i}; snapshot unchanged`);
}
export async function poll(db,transport,{onProgress=()=>{},assertLease=()=>{},now=Date.now()}={}){
  const page=await transport.get('/blocks?type=block');
  const head=page.items?.[0];
  if(!Number.isSafeInteger(head?.height)||head.height<creationBlock+12)throw new Error('Invalid chain head');
  const safeHeight=head.height-12;
  let checkpoint=JSON.parse(getMeta(db,'ge6Checkpoint')||'null');
  let reorg=false;
  if(checkpoint){
    if(safeHeight<checkpoint.height)throw new Error('Explorer is behind checkpoint');
    const block=validBlock(await transport.get(`/blocks/${checkpoint.height}`),checkpoint.height);
    reorg=block.hash.toLowerCase()!==checkpoint.hash.toLowerCase();
  }
  const full=!checkpoint||reorg||now-(checkpoint.auditedAt||0)>=3600000;
  const from=full?creationBlock:Math.max(creationBlock,checkpoint.height-300);
  const safeBlock=validBlock(await transport.get(`/blocks/${safeHeight}`),safeHeight);
  const retained=full?[]:db.prepare('SELECT * FROM ge6_events WHERE block_number<?').all(from);
  const collected=new Map();const cursors=new Set();let cursor;let done=false;
  const timeHints=new Map(db.prepare("SELECT tx_hash,voted_at FROM votes WHERE event='GE6'").all().map(r=>[r.tx_hash,r.voted_at]));
  const times=new Map();
  for(let number=0;number<10000;number++){
    assertLease();
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
  try{verifySequence(all);}catch(error){if(checkpoint)setMeta(db,'ge6Checkpoint',{...checkpoint,auditedAt:0});throw error;}
  const finalBlock=validBlock(await transport.get(`/blocks/${safeHeight}`),safeHeight);
  if(finalBlock.hash.toLowerCase()!==safeBlock.hash.toLowerCase())throw new Error('Chain changed during sync');
  assertLease();
  db.exec('BEGIN IMMEDIATE');
  try{
    assertLease();
    db.exec("DELETE FROM ge6_events; DELETE FROM votes WHERE event='GE6';");
    const eventInsert=db.prepare('INSERT INTO ge6_events VALUES(?,?,?,?,?,?,?,?)');
    const voteInsert=db.prepare("INSERT INTO votes VALUES(?,'GE6','Unknown',?,NULL,?,?,?)");
    for(const e of all){eventInsert.run(e.tx_hash,e.log_index,e.block_number,e.block_hash,e.vote_index,e.address,e.amount,e.voted_at);voteInsert.run('chain:'+e.tx_hash+':'+e.log_index,e.amount,e.address,e.tx_hash,e.voted_at);}
    const status={source:'tokenx-direct',phase:'active',head:head.height,confirmedBlock:safeHeight,lastSuccess:new Date().toISOString(),votes:all.length};
    setMeta(db,'ge6Checkpoint',{height:safeHeight,hash:safeBlock.hash.toLowerCase(),auditedAt:full?now:checkpoint.auditedAt});
    setMeta(db,'ge6Status',status);db.exec('COMMIT');return status;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
