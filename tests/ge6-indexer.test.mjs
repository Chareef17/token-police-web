import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from '../lib/database.mjs';
import { initialize,poll,iface,creationBlock } from '../lib/ge6-indexer.mjs';
const hash=n=>'0x'+n.toString(16).padStart(64,'0');
const address='0x'+'12'.repeat(20);
const height=creationBlock+1000;
function vote(index,block=height-20){
  const encoded=iface.encodeEventLog(iface.getEvent('Voted'),[address,index,1000000000000000001n,hash(0)]);
  return {block_number:block,index:Number(index),block_hash:hash(10),tx_hash:hash(Number(index)+1),timestamp:'2026-10-04T00:00:00Z',...encoded};
}
const all=async(db,sql)=>(await db.execute(sql)).rows;
const one=async(db,sql)=>(await all(db,sql))[0];
async function setup(logs){
  const db=connect(':memory:');await initialize(db);
  await db.execute({sql:'INSERT INTO votes VALUES(?,?,?,?,?,?,?,?)',args:['h1','GE5','Member','9',null,address,hash(9),'2025-01-01T00:00:00Z']});
  const state={logs,blockHash:hash(10),fail:false};
  const transport={async get(path){
    if(state.fail)throw new Error('upstream unavailable');
    if(path==='/blocks?type=block')return {items:[{height}]};
    if(path.startsWith('/blocks/'))return {height:Number(path.split('/').at(-1)),hash:state.blockHash,timestamp:'2026-10-04T00:00:00Z'};
    return {items:state.logs,next_page_params:null};
  }};
  return {db,state,transport};
}
test('direct backfill deduplicates logs, preserves precision/history, excludes unconfirmed votes and survives restart',async()=>{
  const {db,transport}=await setup([vote(0),vote(0),vote(1),vote(2,height)]);
  try{
    assert.equal((await poll(db,transport)).votes,2);
    assert.equal((await poll(db,transport)).votes,2);
    assert.equal((await one(db,"SELECT count(*) n FROM votes WHERE event='GE5'")).n,1);
    const rows=await all(db,"SELECT * FROM votes WHERE event='GE6'");
    assert.equal(rows.length,2);assert.equal(rows[0].amount,'1.000000000000000001');
    assert.equal(JSON.parse((await one(db,"SELECT value FROM metadata WHERE key='ge6Status'")).value).source,'tokenx-direct');
  }finally{db.close();}
});
test('incremental passes only add new votes and keep earlier ones',async()=>{
  const {db,state,transport}=await setup([vote(0),vote(1)]);
  try{
    await poll(db,transport);
    state.logs=[vote(0),vote(1),vote(2)];
    const batch=db.batch.bind(db);let written;db.batch=(statements,mode)=>{written=statements.filter(s=>!s.sql.includes('metadata')).length;return batch(statements,mode);};
    assert.equal((await poll(db,transport,{now:Date.now()+1000})).votes,3);
    assert.equal(written,2);
    assert.equal((await one(db,'SELECT count(*) n FROM ge6_events')).n,3);
    assert.equal((await one(db,"SELECT count(*) n FROM votes WHERE event='GE6'")).n,3);
  }finally{db.close();}
});
test('incremental pass verifies new votes without loading old rows into the overlap',async()=>{
  const old=vote(0,height-500),overlap=vote(1,height-20);
  const {db,state,transport}=await setup([old,overlap]);
  try{
    await poll(db,transport);
    state.logs=[overlap,vote(2,height-15)];
    assert.equal((await poll(db,transport,{now:Date.now()+1000})).votes,3);
    assert.equal((await one(db,'SELECT count(*) n FROM ge6_events')).n,3);
    assert.equal((await db.execute({sql:'SELECT vote_index FROM ge6_events WHERE block_number=?',args:[height-500]})).rows[0].vote_index,'0');
  }finally{db.close();}
});
test('routine sync stays incremental until the daily full audit',async()=>{
  const {db,transport}=await setup([vote(0)]);
  try{
    const start=Date.now();
    await poll(db,transport,{now:start});
    let full;
    await poll(db,transport,{now:start+2*3600000,onProgress:state=>{full=state.full;}});
    assert.equal(full,false);
    await poll(db,transport,{now:start+24*3600000,onProgress:state=>{full=state.full;}});
    assert.equal(full,true);
    await poll(db,transport,{now:start+48*3600000,skipScheduledAudit:true,onProgress:state=>{full=state.full;}});
    assert.equal(full,false);
  }finally{db.close();}
});
test('missing vote receipts and upstream failures do not replace the last good snapshot',async()=>{
  const {db,state,transport}=await setup([vote(0)]);
  try{
    await poll(db,transport);
    state.logs=[vote(2)];await assert.rejects(poll(db,transport,{now:Date.now()+3600000}),/Incomplete/);
    assert.equal((await one(db,'SELECT count(*) n FROM ge6_events')).n,1);
    state.fail=true;await assert.rejects(poll(db,transport),/unavailable/);
    assert.equal((await one(db,"SELECT amount FROM votes WHERE event='GE6'")).amount,'1.000000000000000001');
  }finally{db.close();}
});
test('reorg replaces GE6 facts atomically while preserving historical votes',async()=>{
  const {db,state,transport}=await setup([vote(0),vote(1)]);
  try{
    await poll(db,transport);state.blockHash=hash(11);state.logs=[{...vote(0),tx_hash:hash(100),block_hash:hash(11)}];
    await poll(db,transport);
    assert.equal((await one(db,'SELECT count(*) n FROM ge6_events')).n,1);
    assert.equal((await one(db,"SELECT tx_hash FROM votes WHERE event='GE6'")).tx_hash,hash(100));
    assert.equal((await one(db,"SELECT count(*) n FROM votes WHERE event='GE5'")).n,1);
  }finally{db.close();}
});
test('out-of-order pagination fails without advancing checkpoint',async()=>{
  const {db,transport}=await setup([]);const get=transport.get;
  transport.get=async path=>path.includes('/logs?')?{items:[vote(0)],next_page_params:{block_number:height-20,index:0}}:get(path);
  try{await assert.rejects(poll(db,transport),/pagination/);assert.equal(await one(db,"SELECT value FROM metadata WHERE key='ge6Checkpoint'"),undefined);}finally{db.close();}
});
test('chain change during backfill leaves all stored votes untouched',async()=>{
  const {db,transport}=await setup([vote(0)]);const get=transport.get;let calls=0;
  transport.get=async path=>{const result=await get(path);if(path===`/blocks/${height-12}`&&++calls>1)result.hash=hash(99);return result;};
  try{await assert.rejects(poll(db,transport),/Chain changed/);assert.equal((await one(db,'SELECT count(*) n FROM votes')).n,1);}finally{db.close();}
});
test('retries a cached pagination page before advancing',async()=>{
  const {db,transport}=await setup([]);const get=transport.get;let requests=0;
  transport.get=async path=>{
    if(!path.includes('/logs?'))return get(path);
    requests++;
    if(requests<=2)return {items:[vote(1)],next_page_params:{block_number:height-20,index:1}};
    return {items:[vote(0)],next_page_params:null};
  };
  try{assert.equal((await poll(db,transport)).votes,2);assert.equal(requests,3);}finally{db.close();}
});
