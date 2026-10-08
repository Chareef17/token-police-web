'use client';

import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import Link from 'next/link';

export default function RankingPanel({includeHoldings,children}:{includeHoldings:boolean;children:ReactNode}){
  const [pending,setPending]=useState(false);
  useEffect(()=>setPending(false),[includeHoldings]);
  const navigate=(target:boolean)=>(event:MouseEvent<HTMLAnchorElement>)=>{
    if(pending||target===includeHoldings){event.preventDefault();return;}
    setPending(true);
  };
  return <div className="current-ranking-panel">
    <div className="current-view-toggle" role="group" aria-label="วิธีคำนวณอันดับ">
      <Link href="/ge6-current" prefetch={false} onClick={navigate(false)} className={!includeHoldings?'active':''} aria-current={!includeHoldings?'page':undefined}>โหวตแล้ว</Link>
      <Link href="/ge6-current?includeHoldings=1" prefetch={false} onClick={navigate(true)} className={includeHoldings?'active':''} aria-current={includeHoldings?'page':undefined}>รวม GE6 ในกระเป๋า</Link>
    </div>
    <div className="current-ranking-content" aria-busy={pending}>
      {pending?<div className="loading-panel" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/>กำลังโหลดตารางอันดับใหม่…</div>:children}
    </div>
  </div>;
}
