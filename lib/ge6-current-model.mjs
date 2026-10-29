import { units, amount } from './amount.mjs';

export const snapshotTotal = units('184604.888463398692588118');

// A manually assigned transaction is removed from that wallet's predicted pool.
// Clearing the assignment puts the whole transaction back into that pool.
export function partitionVoteEvents(votes, assignments, todayStartUtc) {
  const wallets=new Map(),predictedWallets=new Map(),todayWallets=new Map(),assignedVotes=[];
  let lastVoteAt=null;
  for(const row of votes){
    const address=String(row.address).toLowerCase();
    if(!/^0x[0-9a-f]{40}$/.test(address))continue;
    const voteAmount=units(String(row.amount));
    wallets.set(address,(wallets.get(address)??0n)+voteAmount);
    const at=String(row.voted_at),today=Date.parse(at)>=todayStartUtc;
    const assigned=assignments.get(String(row.tx_hash)+':'+String(row.log_index));
    if(assigned)assignedVotes.push({address,member:assigned,value:voteAmount,today});
    else{
      predictedWallets.set(address,(predictedWallets.get(address)??0n)+voteAmount);
      if(today)todayWallets.set(address,(todayWallets.get(address)??0n)+voteAmount);
    }
    if(!lastVoteAt||Date.parse(at)>Date.parse(lastVoteAt))lastVoteAt=at;
  }
  return {wallets,predictedWallets,todayWallets,assignedVotes,lastVoteAt};
}

// Split exact token units. The last fractional units go to the largest remainders.
export function splitVote(total, members) {
  if (!members.length) return [];
  const weights = members.length === 1 ? [100n] : members.length === 2 ? [70n, 30n] : [60n, 30n, 10n];
  if (members.length > 3) throw new Error('At most three predicted members');
  const parts = weights.map((weight, index) => ({member: members[index], value: total * weight / 100n, remainder: total * weight % 100n, index}));
  let left = total - parts.reduce((sum, part) => sum + part.value, 0n);
  for (const part of [...parts].sort((a,b) => a.remainder === b.remainder ? a.index-b.index : a.remainder > b.remainder ? -1 : 1)) {
    if (!left) break;
    part.value++;
    left--;
  }
  return parts.map(({member,value}) => [member,value]);
}

export function makeRanking(candidates, officialResults, additions, preliminaryAssignments=new Map()) {
  const official = new Map(officialResults.map(([name, score]) => [name, units(score)]));
  const officialTotal = [...official.values()].reduce((sum, score) => sum + score, 0n);
  const unpublished = candidates.filter(name => !official.has(name));
  const knownUnpublished = unpublished.reduce((sum,name)=>sum+(preliminaryAssignments.get(name)??0n),0n);
  const residual = snapshotTotal - officialTotal - knownUnpublished;
  if (residual < 0n || !unpublished.length) throw new Error('Invalid preliminary snapshot');
  const neutral = residual / BigInt(unpublished.length);
  let remainder = residual % BigInt(unpublished.length);
  const lowestPublished = [...official.values()].reduce((lowest, score) => score < lowest ? score : lowest);
  const rows = candidates.map(name => {
    const published = official.get(name);
    const known = published==null ? preliminaryAssignments.get(name)??0n : 0n;
    const extra = additions.get(name) ?? 0n;
    const base = published ?? known + neutral + (remainder-- > 0n ? 1n : 0n);
    return {name, published: published != null, score: base + extra,
      low: (published ?? known) + extra, high: (published ?? lowestPublished) + extra};
  });
  rows.sort((a,b) => a.score === b.score ? a.name.localeCompare(b.name) : a.score > b.score ? -1 : 1);
  return rows.map((row,index) => ({name: row.name, rank: index+1, amount: amount(row.score), published: row.published,
    bestRank: 1 + rows.filter(other => other !== row && other.low > row.high).length,
    worstRank: 1 + rows.filter(other => other !== row && other.high >= row.low).length}));
}
