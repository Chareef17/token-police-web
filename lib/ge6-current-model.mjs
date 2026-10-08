import { units, amount } from './amount.mjs';

export const snapshotTotal = units('184604.888463398692588118');

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

export function makeRanking(candidates, officialResults, additions) {
  const official = new Map(officialResults.map(([name, score]) => [name, units(score)]));
  const officialTotal = [...official.values()].reduce((sum, score) => sum + score, 0n);
  const unpublished = candidates.filter(name => !official.has(name));
  const residual = snapshotTotal - officialTotal;
  if (residual < 0n || !unpublished.length) throw new Error('Invalid preliminary snapshot');
  const neutral = residual / BigInt(unpublished.length);
  let remainder = residual % BigInt(unpublished.length);
  const lowestPublished = [...official.values()].reduce((lowest, score) => score < lowest ? score : lowest);
  const rows = candidates.map(name => {
    const published = official.get(name);
    const extra = additions.get(name) ?? 0n;
    const base = published ?? neutral + (remainder-- > 0n ? 1n : 0n);
    return {name, published: published != null, score: base + extra,
      low: (published ?? 0n) + extra, high: (published ?? lowestPublished) + extra};
  });
  rows.sort((a,b) => a.score === b.score ? a.name.localeCompare(b.name) : a.score > b.score ? -1 : 1);
  return rows.map((row,index) => ({name: row.name, rank: index+1, amount: amount(row.score), published: row.published,
    bestRank: 1 + rows.filter(other => other !== row && other.low > row.high).length,
    worstRank: 1 + rows.filter(other => other !== row && other.high >= row.low).length}));
}
