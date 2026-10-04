import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { connect } from '../lib/database.mjs';
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
const address='0x'+randomBytes(20).toString('hex');
const post=(body,origin=base)=>fetch(base+'/api/names',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const db=connect();
try{
  assert.equal((await fetch(base+'/api/wallet/invalid')).status,400);
  const empty=await (await fetch(base+'/api/wallet/'+address)).json();
  assert.equal(empty.name,null);assert.equal(empty.ge6.amount,'0');assert.equal(empty.events.length,0);
  assert.equal((await post({address,name:'test',version:0},'https://other.example')).status,403);
  const created=await post({address,name:'ทดสอบระบบ',version:0});assert.equal(created.status,200);
  assert.equal((await (await fetch(base+'/api/wallet/'+address)).json()).name.name,'ทดสอบระบบ');
  assert.equal((await post({address,name:'stale edit',version:0})).status,409);
  assert.equal((await post({address,name:'แก้ไขทดสอบ',version:1})).status,200);
  assert.equal((await post({address,name:'<script>',version:2})).status,400);
  assert.equal((await db.execute({sql:'SELECT count(*) n FROM name_history WHERE address=?',args:[address]})).rows[0].n,2);
  console.log('API checks passed: invalid/empty wallet, cross-origin rejection, persistent naming, revision conflict, validation, history.');
}finally{
  // Remove only the random synthetic wallet created by this check.
  await db.batch([{sql:'DELETE FROM names WHERE address=?',args:[address]},{sql:'DELETE FROM name_history WHERE address=?',args:[address]}],'write');db.close();
}
