'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RankingMode } from '@/lib/ge6-current';

type Props={mode:RankingMode;voteSyncedAt:string|null;chainVoteCount:number;assignmentRevision:number;ge6HoldersAt:string|null;bnkHoldersAt:string|null;syncError:boolean};
const formatTime=(value:string|null)=>value?new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}):'ไม่ทราบเวลา';

export default function LiveForecastSync({mode,voteSyncedAt,chainVoteCount,assignmentRevision,ge6HoldersAt,bnkHoldersAt,syncError}:Props){
  const router=useRouter();
  const [lastSync,setLastSync]=useState(voteSyncedAt);
  const [failed,setFailed]=useState(syncError);
  const count=useRef(chainVoteCount);
  const revision=useRef(assignmentRevision);
  useEffect(()=>{setLastSync(voteSyncedAt);setFailed(syncError);count.current=chainVoteCount;revision.current=assignmentRevision;},[voteSyncedAt,chainVoteCount,assignmentRevision,syncError]);
  useEffect(()=>{
    let stopped=false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    let running=false;
    const schedule=()=>{if(!stopped)timer=setTimeout(sync,15000);};
    async function sync(){
      if(stopped||running)return;
      if(document.hidden){schedule();return;}
      running=true;
      try{
        const response=await fetch('/api/sync-ge6',{method:'POST',cache:'no-store'});
        if(response.ok){
          const result=await response.json() as {lastSuccess:string;votes?:number;assignmentRevision?:number};
          if(stopped)return;
          setLastSync(result.lastSuccess);
          setFailed(false);
          const changed=(typeof result.votes==='number'&&result.votes!==count.current)||(typeof result.assignmentRevision==='number'&&result.assignmentRevision!==revision.current);
          if(changed){if(typeof result.votes==='number')count.current=result.votes;if(typeof result.assignmentRevision==='number')revision.current=result.assignmentRevision;router.refresh();}
        }else if(response.status!==409){setFailed(true);}
      }catch{if(!stopped)setFailed(true);}
      finally{running=false;schedule();}
    }
    const onVisibility=()=>{if(!document.hidden){if(timer)clearTimeout(timer);void sync();}};
    document.addEventListener('visibilitychange',onVisibility);
    void sync();
    return ()=>{stopped=true;if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility);};
  },[router]);

  const held=[...(mode==='votes'?[]:[ge6HoldersAt]),...(mode==='all'?[bnkHoldersAt]:[])];
  const heldAt=held.length&&held.every(Boolean)?new Date(Math.min(...held.map(value=>Date.parse(value!)))).toISOString():null;
  const voteStale=failed||!lastSync||Date.now()-Date.parse(lastSync)>20*60*1000;
  const stale=voteStale||(mode!=='votes'&&(!heldAt||Date.now()-Date.parse(heldAt)>40*60*1000));
  return <p className={stale?'forecast-freshness stale':'forecast-freshness'} aria-live="polite"><span className={voteStale?'forecast-live delayed':'forecast-live'} aria-label="ตรวจอัตโนมัติ">{voteStale?'รอซิงก์':'LIVE'}</span> โหวตล่าสุด {formatTime(lastSync)}{mode!=='votes'&&<> · เหรียญคงเหลือ {formatTime(heldAt)}</>}{stale?' · ข้อมูลอาจล่าช้า':''}</p>;
}
