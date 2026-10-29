import test from 'node:test';
import assert from 'node:assert/strict';
import { splitVote, makeRanking, snapshotTotal, partitionVoteEvents, memberVoteShare } from '../lib/ge6-current-model.mjs';

test('member post-preliminary share excludes a transaction assigned to another member',()=>{
  assert.equal(memberVoteShare('Nammonn',100n,0n,['Nammonn','Kwan']),70n);
  assert.equal(memberVoteShare('Nammonn',0n,0n,['Nammonn','Kwan']),0n);
  assert.equal(memberVoteShare('Kwan',0n,100n,['Nammonn','Kwan']),100n);
});
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

test('preliminary assignments only redistribute unpublished scores without double counting',()=>{
  const candidates=[...preliminary.results.map(([name])=>name),...Array.from({length:22},(_,i)=>`Unpublished ${i}`)];
  const base=makeRanking(candidates,preliminary.results,new Map());
  const identified=makeRanking(candidates,preliminary.results,new Map(),new Map([['Unpublished 0',units('100')],['Rose',units('50')]]));
  const cleared=makeRanking(candidates,preliminary.results,new Map(),new Map());
  const score=(rows,name)=>units(rows.find(row=>row.name===name).amount);
  assert.equal(score(identified,'Rose'),score(base,'Rose'));
  assert.ok(score(identified,'Unpublished 0')>score(base,'Unpublished 0'));
  assert.ok(score(identified,'Unpublished 1')<score(base,'Unpublished 1'));
  assert.equal(identified.reduce((sum,row)=>sum+units(row.amount),0n),snapshotTotal);
  assert.equal(score(cleared,'Unpublished 0'),score(base,'Unpublished 0'));
});

test('adding projected held tokens changes the ranking and total without changing the vote-only amount',()=>{
  const candidates=[...preliminary.results.map(([name])=>name),'Unpublished'];
  const voted=makeRanking(candidates,preliminary.results,new Map());
  const withHoldings=makeRanking(candidates,preliminary.results,new Map([['Nammonn',units('25000')]]));
  assert.equal(voted.find(row=>row.name==='Nammonn').amount,'3951.53');
  assert.equal(withHoldings[0].name,'Nammonn');
  assert.equal(withHoldings[0].amount,'28951.53');
});
