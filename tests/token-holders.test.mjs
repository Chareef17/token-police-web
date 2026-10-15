import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHolderChunk, tokens } from '../lib/token-holders.mjs';

test('holder scan resumes by cursor and does not expose partial balances as complete',async()=>{
  const original=globalThis.fetch;
  const addresses=[1,2,3,4,5].map(n=>'0x'+n.toString(16).padStart(40,'0'));
  const pages=[
    {items:addresses.slice(0,2).map(hash=>({address:{hash},value:'100'})),next_page_params:{page:1}},
    {items:addresses.slice(2,4).map(hash=>({address:{hash},value:'50'})),next_page_params:{page:2}},
    {items:addresses.slice(4).map(hash=>({address:{hash},value:'10'})),next_page_params:null},
  ];
  globalThis.fetch=async url=>new Response(JSON.stringify(pages[Number(new URL(url).searchParams.get('page')??0)]),{status:200});
  try{
    const seen=new Set();
    const first=await fetchHolderChunk(tokens.ge6,{seen,expected:5,maxPages:2});
    assert.equal(first.complete,false);assert.equal(first.seenCount,4);assert.deepEqual(first.cursor,{page:2});
    const last=await fetchHolderChunk(tokens.ge6,{cursor:first.cursor,previousLast:first.previousLast,seen,expected:5,maxPages:2});
    assert.equal(last.complete,true);assert.equal(last.seenCount,5);assert.equal(last.balances.get(addresses[4]),'10');
  }finally{globalThis.fetch=original;}
});
