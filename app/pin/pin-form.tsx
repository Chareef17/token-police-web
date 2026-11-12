'use client';

import { useState } from 'react';
import styles from './pin.module.css';

export default function PinForm(){
  const [pin,setPin]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch('/api/site-unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});
      if(!response.ok){setPin('');setError('PIN ไม่ถูกต้อง');return;}
      const next=new URLSearchParams(window.location.search).get('next');
      window.location.assign(next?.startsWith('/')&&!next.startsWith('//')?next:'/');
    }catch{setError('ตรวจ PIN ไม่สำเร็จ กรุณาลองอีกครั้ง');}
    finally{setBusy(false);}
  }
  return <main className={styles.page}><form className={styles.card} onSubmit={submit}><h1>ใส่ PIN</h1><label htmlFor="site-pin">PIN 4 หลัก</label><input id="site-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,4))} autoFocus required/>{error&&<p role="alert">{error}</p>}<button type="submit" disabled={busy||pin.length!==4}>{busy?'กำลังตรวจ…':'เข้าสู่เว็บ'}</button></form></main>;
}
