'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { forgetAll, refreshEvent } from '@/lib/client-cache';
// Small header button: forgets cached data, then reloads the current page's data in place.
export default function RefreshButton(){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const [spinning,setSpinning]=useState(false);
  function refresh(){
    if(spinning)return;
    setSpinning(true);setTimeout(()=>setSpinning(false),900);
    forgetAll();
    window.dispatchEvent(new Event(refreshEvent));
    startTransition(()=>router.refresh());
  }
  const busy=spinning||pending;
  return <button type="button" className={busy?'refresh-button spinning':'refresh-button'} onClick={refresh} aria-label="โหลดข้อมูลใหม่" title="โหลดข้อมูลใหม่" aria-busy={busy}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5"/><path d="M20 20v-4.5h-4.5"/></svg>
  </button>;
}
