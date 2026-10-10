import test from 'node:test';
import assert from 'node:assert/strict';
import { splitVote, makeRanking, snapshotTotal, partitionVoteEvents } from '../lib/ge6-current-model.mjs';
import { units } from '../lib/amount.mjs';
import preliminary from '../lib/ge6-prelim-2026-10-03.json' with {type:'json'};

test('splits exact token units without losing remainder',()=>{
  assert.deepEqual(splitVote(101n,['A','B']),[['A',71n],['B',30n]]);
  assert.deepEqual(splitVote(103n,['A','B','C']),[['A',62n],['B',31n],['C',10n]]);
  assert.deepEqual(splitVote(17n,['A']),[['A',17n]]);
});

test('manual transaction assignment moves its full amount away from predicted members and Clear restores the split',()=>{
  const address='0x'+'a'.repeat(40);
  const votes=[
    {tx_hash:'tx1',log_index:0,address,amount:'100',voted_at:'2026-10-10T10:00:00.000Z'},
    {tx_hash:'tx2',log_index:0,address,amount:'100',voted_at:'2026-10-10T10:01:00.000Z'},
  ];
  const scores=assignments=>{
    const {predictedWallets,assignedVotes}=partitionVoteEvents(votes,assignments,0);
    const totals=new Map(splitVote(predictedWallets.get(address)??0n,['A','B']));
    for(const vote of assignedVotes)totals.set(vote.member,(totals.get(vote.member)??0n)+vote.value);
    return [...totals].map(([member,value])=>[member,value/10n**18n]);
  };
  assert.deepEqual(scores(new Map()),[['A',140n],['B',60n]]);
  assert.deepEqual(scores(new Map([['tx1:0','C']])),[['A',70n],['B',30n],['C',100n]]);
  assert.deepEqual(scores(new Map([['tx1:0',undefined]])),[['A',140n],['B',60n]]);
});

test('preliminary snapshot and neutral unpublished scores conserve the on-chain total',()=>{
  const official=new Map(preliminary.results);
  const candidates=[...official.keys(),...Array.from({length:22},(_,i)=>`Unpublished ${i}`)];
  const ranked=makeRanking(candidates,preliminary.results,new Map());
  assert.equal(ranked.length,58);
  assert.equal(ranked.reduce((sum,row)=>sum+units(row.amount),0n),snapshotTotal);
  assert.equal(ranked[0].name,'Rose');
  assert.equal(ranked.find(row=>row.name==='Nammonn').amount,'3951.53');
  assert.equal(ranked.filter(row=>!row.published).length,22);
  assert.equal(official.size,36);
});

test('adding projected held tokens changes the ranking and total without changing the vote-only amount',()=>{
  const candidates=[...preliminary.results.map(([name])=>name),'Unpublished'];
  const voted=makeRanking(candidates,preliminary.results,new Map());
  const withHoldings=makeRanking(candidates,preliminary.results,new Map([['Nammonn',units('25000')]]));
  assert.equal(voted.find(row=>row.name==='Nammonn').amount,'3951.53');
  assert.equal(withHoldings[0].name,'Nammonn');
  assert.equal(withHoldings[0].amount,'28951.53');
});
