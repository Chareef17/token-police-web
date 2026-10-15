'use client';
import { useState } from 'react';
import { forgetAll } from '@/lib/client-cache';
// Reload the current URL so both server-rendered and client-fetched pages read fresh data.
export default function RefreshButton(){
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [progress,setProgress]=useState('กำลังตรวจธุรกรรม GE6…');
  async function refresh(){
    if(refreshing)return;
    setRefreshing(true);
    setError('');
    setProgress('กำลังตรวจธุรกรรม GE6…');
    try{
      // A live page may already be syncing. Wait for its lease to finish, then
      // perform a fresh pass instead of treating that overlap as a failed click.
      const started=Date.now();
      for(;;){
        const response=await fetch('/api/sync-ge6?force=1',{method:'POST',cache:'no-store'});
        if(response.status===409&&Date.now()-started<75000){
          await new Promise(resolve=>setTimeout(resolve,1500));
          continue;
        }
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'ซิงก์ข้อมูลไม่สำเร็จ');
        break;
      }
      for(const [token,label] of [['ge6','GE6'],['bnk','BNK']] as const){
        const started=Date.now();
        for(;;){
          const response=await fetch(`/api/sync-holders?token=${token}`,{method:'POST',cache:'no-store'});
          if(response.status===409&&Date.now()-started<20*60000){
            setProgress(`กำลังรออัปเดตยอด ${label}…`);
            await new Promise(resolve=>setTimeout(resolve,2000));
            continue;
          }
          const result=await response.json() as {done?:boolean;processed?:number;expected?:number;error?:string};
          if(!response.ok)throw new Error(result.error||`ซิงก์ยอด ${label} ไม่สำเร็จ`);
          setProgress(`กำลังอัปเดตยอด ${label} ${result.processed?.toLocaleString()??0}/${result.expected?.toLocaleString()??0} กระเป๋า…`);
          if(result.done)break;
          if(Date.now()-started>20*60000)throw new Error(`ซิงก์ยอด ${label} นานเกินไป กรุณาลองใหม่`);
        }
      }
      forgetAll();
      const url=new URL(window.location.href);
      url.searchParams.set('fresh','1');
      window.location.replace(url.href);
    }catch(caught){
      setError(caught instanceof Error?caught.message:'ซิงก์ข้อมูลไม่สำเร็จ');
      setRefreshing(false);
    }
  }
  return <><button type="button" className={refreshing?'refresh-button spinning':'refresh-button'} onClick={refresh} aria-label="โหลดข้อมูลใหม่" title="โหลดข้อมูลใหม่" aria-busy={refreshing} disabled={refreshing}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5"/><path d="M20 20v-4.5h-4.5"/></svg>
  </button>{refreshing&&<div className="page-refresh-overlay" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/>{progress}</div>}{error&&<div className="page-refresh-error" role="alert">{error}<button type="button" onClick={()=>setError('')}>ปิด</button></div>}</>;
}
