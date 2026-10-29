import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRanks } from '../lib/ge6-prelim2-analysis.mjs';

test('compares announced ranks without inventing actual scores',()=>{
  const forecast=[
    {name:'Rose',rank:1,amount:'100',bestRank:1,worstRank:2},
    {name:'Nammonn',rank:2,amount:'90',bestRank:1,worstRank:3},
  ];
  const result=compareRanks(forecast,['Nammonn','Rose']);
  assert.equal(result.exact,0);
  assert.equal(result.withinRange,2);
  assert.equal(result.meanAbsoluteError,1);
  assert.deepEqual(result.rows.map(row=>row.rankDifference),[1,-1]);
  assert.equal('actualScore' in result.rows[0],false);
});
