import test from 'node:test';
import assert from 'node:assert/strict';
import {units,amount,sum,addressOf,nameOf} from '../lib/amount.mjs';
test('preserves 18 decimal places beyond JS safe integers',()=>{
  const value='999999999999999999.999999999999999999';assert.equal(amount(units(value)),value);
  assert.equal(sum(['0.000000000000000001','0.000000000000000009']),'0.00000000000000001');
  assert.equal(sum(['999999999999999999.9','0.1']),'1000000000000000000');
});
test('rejects malformed values, accepts normalized addresses and Thai names',()=>{
  for(const value of ['-1','NaN','1e5','1.0000000000000000001'])assert.throws(()=>units(value));
  assert.equal(addressOf(' 0x'+'AB'.repeat(20)+' '),'0x'+'ab'.repeat(20));
  assert.throws(()=>addressOf('0x123'));assert.equal(nameOf(' กระเป๋าทดสอบ '),'กระเป๋าทดสอบ');
  for(const value of ['', '<script>', 'a\u202eb', 'a'.repeat(61)])assert.throws(()=>nameOf(value));
});
