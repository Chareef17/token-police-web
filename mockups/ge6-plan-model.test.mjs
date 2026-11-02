import test from 'node:test';
import assert from 'node:assert/strict';
import { baseline, official, unknownPool, teamPreset, calculatePlan } from './ge6-plan-model.mjs';

test('prototype uses the full frozen roster and real preliminary ranking',()=>{
  assert.equal(baseline.length,58);
  assert.equal(official.length,36);
  const plan=calculatePlan();
  assert.equal(plan.byName.get('Nammonn').score,6469.62);
  assert.equal(plan.byName.get('Nammonn').simulated,22);
});

test('team estimates change only the scenario result',()=>{
  const plan=calculatePlan(teamPreset);
  assert.equal(plan.byName.get('Rose').score,37000);
  assert.equal(calculatePlan().byName.get('Rose').score,55010);
});

test('unknown allocation is capped and transaction reassignment conserves tokens',()=>{
  const tx='0x'+'a'.repeat(64);
  const plan=calculatePlan([
    {kind:'unknown',member:'Nammonn',amount:1000},
    {kind:'tx',from:'Rose',member:'Nammonn',amount:100,txHash:tx},
  ]);
  assert.equal(plan.byName.get('Nammonn').score,7569.62);
  assert.equal(plan.byName.get('Rose').score,54910);
  assert.equal(plan.unknownRemaining,unknownPool-1000);
  assert.deepEqual(plan.issues,[]);
  const invalid=calculatePlan([{kind:'unknown',member:'Nammonn',amount:unknownPool+1}]);
  assert.match(invalid.issues[0],/เกินยอด/);
  const duplicate=calculatePlan([{kind:'tx',from:'Rose',member:'Nammonn',amount:100,txHash:tx},{kind:'tx',from:'Rose',member:'Nammonn',amount:100,txHash:tx}]);
  assert.match(duplicate.issues[0],/ซ้ำ/);
});
