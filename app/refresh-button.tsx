'use client';
import { useState } from 'react';
import { forgetAll } from '@/lib/client-cache';
// Reload the current URL so both server-rendered and client-fetched pages read fresh data.
export default function RefreshButton(){
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  async function refresh(){
    if(refreshing)return;
    setRefreshing(true);
    setError('');
    try{
      const response=await fetch('/api/sync-ge6',{method:'POST',cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'ซิงก์ข้อมูลไม่สำเร็จ');
      forgetAll();
      window.location.reload();
    }catch(caught){
      setError(caught instanceof Error?caught.message:'ซิงก์ข้อมูลไม่สำเร็จ');
      setRefreshing(false);
    }
  }
  return <><button type="button" className={refreshing?'refresh-button spinning':'refresh-button'} onClick={refresh} aria-label="โหลดข้อมูลใหม่" title="โหลดข้อมูลใหม่" aria-busy={refreshing} disabled={refreshing}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5"/><path d="M20 20v-4.5h-4.5"/></svg>
  </button>{refreshing&&<div className="page-refresh-overlay" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/>กำลังตรวจธุรกรรม GE6…</div>}{error&&<div className="page-refresh-error" role="alert">{error}<button type="button" onClick={()=>setError('')}>ปิด</button></div>}</>;
}
