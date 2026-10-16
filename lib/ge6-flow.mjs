import { amount } from './amount.mjs';

// Group exact token units by direct counterparty and direction. A transaction
// can contain more than one transfer log, but still counts as one Tx here.
export function summarizeGe6Flow(rows,address){
  address=address.toLowerCase();
  const incoming=new Map(),outgoing=new Map(),seen=new Set();
  for(const row of rows){
    const key=row.txHash.toLowerCase()+':'+row.logIndex;
    if(seen.has(key))continue;
    seen.add(key);
    if(row.from===row.to||row.vote)continue;
    const direction=row.to===address?'in':row.from===address?'out':null;
    if(!direction)throw new Error('Unrelated GE6 transfer');
    const other=direction==='in'?row.from:row.to;
    const target=direction==='in'?incoming:outgoing;
    const entry=target.get(other)??{address:other,raw:0n,txs:new Set(),sampleTx:row.txHash,official:Boolean(row.official),mint:Boolean(row.mint)};
    entry.raw+=BigInt(row.raw);
    entry.txs.add(row.txHash.toLowerCase());
    target.set(other,entry);
  }
  const sorted=map=>[...map.values()].sort((a,b)=>a.raw===b.raw?a.address.localeCompare(b.address):a.raw>b.raw?-1:1)
    .map(entry=>({address:entry.address,amount:amount(entry.raw),count:entry.txs.size,sampleTx:entry.sampleTx,official:entry.official,mint:entry.mint}));
  return {incoming:sorted(incoming),outgoing:sorted(outgoing)};
}
