import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeGe6Flow } from '../lib/ge6-flow.mjs';
const a='0x'+'aa'.repeat(20),b='0x'+'bb'.repeat(20),c='0x'+'cc'.repeat(20);
test('groups GE6 transfers by counterparty, counts distinct transactions, and excludes votes',()=>{
  const row=(from,to,raw,txHash,logIndex,vote=false)=>({from,to,raw,txHash,logIndex,vote,official:from===b||to===b,mint:false});
  const rows=[row(b,a,'100000000000000000000','0x1',0),row(b,a,'500000000000000000000','0x2',0),row(b,a,'1000000000000000000','0x2',1),row(a,c,'2000000000000000000','0x3',0),row(a,c,'9000000000000000000','0x4',0,true),row(b,a,'100000000000000000000','0x1',0)];
  const result=summarizeGe6Flow(rows,a);
  assert.deepEqual(result.incoming.map(x=>[x.address,x.amount,x.count]),[[b,'601',2]]);
  assert.deepEqual(result.outgoing.map(x=>[x.address,x.amount,x.count]),[[c,'2',1]]);
});
test('keeps verified BNK redemption separate from ordinary transfers to the same contract',()=>{
  const rows=[
    {from:a,to:b,raw:'4000000000000000000000',txHash:'0x1',logIndex:0,redeem:true},
    {from:a,to:b,raw:'100000000000000000000',txHash:'0x2',logIndex:0,redeem:false},
  ];
  const result=summarizeGe6Flow(rows,a);
  assert.deepEqual(result.outgoing.map(x=>[x.amount,x.count,x.redeem]),[['4000',1,true],['100',1,false]]);
});
