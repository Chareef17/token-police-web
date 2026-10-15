'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { forgetAll, refreshEvent } from '@/lib/client-cache';

// Keep the other pages in step with the on-chain GE6 index while they are open.
// The live votes and forecast pages already have their own update loops.
export default function LiveSiteSync(){
  const pathname=usePathname(),router=useRouter();
  useEffect(()=>{
    if(pathname==='/ge6-live'||pathname==='/ge6-current')return;
    let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
    let votes:number|undefined,revision:number|undefined;
    const schedule=()=>{if(!stopped)timer=setTimeout(sync,10000);};
    async function sync(){
      if(stopped)return;
      if(document.hidden){schedule();return;}
      try{
        const response=await fetch('/api/sync-ge6',{method:'POST',cache:'no-store'});
        if(response.ok){
          const result=await response.json() as {votes?:number;assignmentRevision?:number};
          if(stopped)return;
          if(votes===undefined||result.votes!==votes||result.assignmentRevision!==revision){
            forgetAll();
            window.dispatchEvent(new Event(refreshEvent));
            router.refresh();
          }
          votes=result.votes;revision=result.assignmentRevision;
        }
      }catch{}
      schedule();
    }
    const visible=()=>{if(!document.hidden){if(timer)clearTimeout(timer);void sync();}};
    document.addEventListener('visibilitychange',visible);
    void sync();
    return()=>{stopped=true;if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
  },[pathname,router]);
  return null;
}
