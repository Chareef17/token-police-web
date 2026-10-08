'use client';

import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import Link from 'next/link';

type Mode='votes'|'ge6'|'all';
const views:{mode:Mode;href:string;label:string}[]=[
  {mode:'votes',href:'/ge6-current',label:'โหวตแล้ว'},
  {mode:'ge6',href:'/ge6-current?mode=ge6',label:'+ GE6 ในกระเป๋า'},
  {mode:'all',href:'/ge6-current?mode=all',label:'+ GE6 + BNK'},
];

export default function RankingPanel({mode,children}:{mode:Mode;children:ReactNode}){
  const [pending,setPending]=useState(false);
  useEffect(()=>setPending(false),[mode]);
  const navigate=(target:Mode)=>(event:MouseEvent<HTMLAnchorElement>)=>{
    if(pending||target===mode){event.preventDefault();return;}
    setPending(true);
  };
  return <div className="current-ranking-panel">
    <div className="current-view-toggle" role="group" aria-label="วิธีคำนวณอันดับ">
      {views.map(view=><Link key={view.mode} href={view.href} prefetch={false} onClick={navigate(view.mode)} className={mode===view.mode?'active':''} aria-current={mode===view.mode?'page':undefined}>{view.label}</Link>)}
    </div>
    <div className="current-ranking-content" aria-busy={pending}>
      {pending?<div className="loading-panel" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/>กำลังโหลดตารางอันดับใหม่…</div>:children}
    </div>
  </div>;
}
