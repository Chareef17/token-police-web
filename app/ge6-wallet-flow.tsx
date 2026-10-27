'use client';

import { useEffect,useMemo,useState } from 'react';
import AddressCopy from './address-copy';
import { refreshEvent } from '@/lib/client-cache';
import { summarizeGe6Flow } from '@/lib/ge6-flow.mjs';
import { display,sum } from '@/lib/amount.mjs';

type Transfer={from:string;to:string;raw:string;txHash:string;logIndex:number;timestamp:string;other:string;official:boolean;mint:boolean;vote:boolean;redeem:boolean};
type Page={rows:Transfer[];names:Record<string,string>;nextCursor:Record<string,string>|null;fetchedAt:string};
type Edge={address:string;amount:string;count:number;sampleTx:string;official:boolean;mint:boolean;redeem:boolean};
const short=(address:string)=>address.slice(0,8)+'…'+address.slice(-6);

function EdgeCard({edge,name,direction,token}:{edge:Edge;name?:string;direction:'in'|'out';token:'ge6'|'bnk'}){
  const label=edge.redeem?'Redeem GE6':name||(!edge.mint&&edge.official?'กระเป๋า Official':edge.mint?'สร้างเหรียญ':short(edge.address));
  return <article className={'flow-edge flow-edge-'+direction+(edge.redeem?' flow-edge-redeem':'')}>
    <div className="flow-edge-head"><span className="flow-edge-dot" aria-hidden="true"/><a className="flow-edge-name" href={'/?address='+edge.address}>{label}</a>{edge.official&&name&&!edge.redeem&&<span className="flow-official">Official</span>}{edge.mint&&<span className="flow-official">Mint</span>}</div>
    <div className="flow-edge-value" title={edge.amount}>{display(edge.amount)} <small>{token.toUpperCase()}</small></div>
    <div className="flow-edge-foot"><AddressCopy address={edge.address} href={'/?address='+edge.address}/><a href={'https://scan.tokenx.finance/tx/'+edge.sampleTx} target="_blank" rel="noopener noreferrer">{edge.count.toLocaleString()} Tx ↗</a></div>
  </article>;
}

function EdgeGroup({edges,names,direction,token}:{edges:Edge[];names:Record<string,string>;direction:'in'|'out';token:'ge6'|'bnk'}){
  const [expanded,setExpanded]=useState(false);
  const visible=expanded?edges:edges.slice(0,5);
  const wallets=new Set(edges.map(edge=>edge.address)).size;
  return <div className={'flow-lane flow-lane-'+direction}>
    <div className="flow-lane-heading"><h3>{direction==='in'?'รับจาก':'โอนให้'}</h3><span>{wallets.toLocaleString()} กระเป๋า</span></div>
    {visible.length?<div className="flow-edge-list">{visible.map(edge=><EdgeCard key={edge.address+(edge.redeem?':redeem':'')} edge={edge} name={names[edge.address]} direction={direction} token={token}/>)}</div>:<p className="flow-empty">ยังไม่มีรายการ</p>}
    {edges.length>5&&<button className="flow-expand" type="button" onClick={()=>setExpanded(value=>!value)}>{expanded?'ย่อรายการ':`ดูอีก ${(edges.length-5).toLocaleString()} กระเป๋า`}</button>}
  </div>;
}

export default function WalletTokenFlow({address,token='ge6',votedAmount='0',voteCount=0}:{address:string;token?:'ge6'|'bnk';votedAmount?:string;voteCount?:number}){
  const [rows,setRows]=useState<Transfer[]>([]);
  const [names,setNames]=useState<Record<string,string>>({});
  const [pages,setPages]=useState(0);
  const [complete,setComplete]=useState(false);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const refresh=()=>setRetry(value=>value+1);
    window.addEventListener(refreshEvent,refresh);
    return()=>window.removeEventListener(refreshEvent,refresh);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    setRows([]);setNames({});setPages(0);setComplete(false);setError('');
    async function scan(){
      const all:Transfer[]=[],seenCursors=new Set<string>();
      let cursor:Record<string,string>|null=null;
      try{
        for(let page=0;page<1000;page++){
          let result:(Page&{error?:string})|null=null;
          for(let attempt=0;attempt<4;attempt++){
          const query=new URLSearchParams({token});
          if(cursor)query.set('cursor',JSON.stringify(cursor));
          const response=await fetch('/api/wallet-flow/'+address+'?'+query,{cache:'no-store',signal:controller.signal});
            const candidate=await response.json() as Page&{error?:string};
            if(!response.ok){
              if(attempt===3)throw new Error(candidate.error||'โหลดเส้นทางเหรียญไม่สำเร็จ');
            }else{
              const key=candidate.nextCursor&&JSON.stringify(candidate.nextCursor);
              if(!key||!seenCursors.has(key)){result=candidate;break;}
              if(attempt===3)throw new Error('TokenX ส่งหน้าประวัติซ้ำ กรุณาลองใหม่');
            }
            await new Promise((resolve,reject)=>{
              const timer=setTimeout(resolve,500*(attempt+1));
              controller.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});
            });
          }
          if(!result)throw new Error('โหลดเส้นทางเหรียญไม่สำเร็จ');
          if(controller.signal.aborted)return;
          all.push(...result.rows);
          setRows([...all]);setNames(previous=>({...previous,...result.names}));setPages(page+1);
          if(!result.nextCursor){setComplete(true);return;}
          const key=JSON.stringify(result.nextCursor);
          seenCursors.add(key);cursor=result.nextCursor;
        }
        throw new Error('ประวัติมีมากเกินช่วงที่สแกนได้ กรุณาลองอีกครั้ง');
      }catch(caught){if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'โหลดเส้นทางเหรียญไม่สำเร็จ');}
    }
    void scan();
    return()=>controller.abort();
  },[address,token,retry]);
  const flow=useMemo(()=>summarizeGe6Flow(rows,address),[rows,address]);
  const received=sum(flow.incoming.map(edge=>edge.amount));
  const transferred=sum(flow.outgoing.map(edge=>edge.amount));
  return <section className="wallet-flow" aria-label={token==='bnk'?'BNK Token Flow':'GE6 Token Flow'}>
    <div className="wallet-flow-header"><div><span className="flow-kicker">{token==='bnk'?'1 ม.ค. 2024 – ปัจจุบัน':'GE6'}</span><h2>{token==='bnk'?'BNK Token Flow':'GE6 Token Flow'}</h2></div><span className={complete?'flow-scan-state complete':'flow-scan-state'}>{complete?`ครบ ${pages.toLocaleString()} หน้า`:error?'ข้อมูลบางส่วน':`กำลังสแกน · ${pages.toLocaleString()} หน้า`}</span></div>
    <div className={token==='bnk'?'flow-totals flow-totals-two':'flow-totals'}><div><span>รับเข้า</span><strong title={received}>{display(received)}</strong></div><div><span>โอนออก</span><strong title={transferred}>{display(transferred)}</strong></div>{token==='ge6'&&<div><span>ใช้โหวต</span><strong title={votedAmount}>{display(votedAmount)}</strong></div>}</div>
    {!complete&&!error&&<div className="flow-progress" role="status"><span className="spinner" aria-hidden="true"/>{token==='bnk'?'กำลังไล่ประวัติการโอนถึง 1 ม.ค. 2024…':'กำลังไล่ประวัติการโอนตั้งแต่ล่าสุดถึงรายการแรก…'}</div>}
    {error&&<div className="flow-error" role="alert">{error} · ยอดรับและโอนที่เห็นยังไม่ครบ <button type="button" onClick={()=>setRetry(value=>value+1)}>ลองใหม่</button></div>}
    <div className="flow-diagram">
      <EdgeGroup edges={flow.incoming} names={names} direction="in" token={token}/>
      <div className="flow-outbound"><EdgeGroup edges={flow.outgoing} names={names} direction="out" token={token}/>{token==='ge6'&&voteCount>0&&<div className="flow-vote"><span className="flow-vote-icon" aria-hidden="true">✦</span><div><span>ใช้โหวต GE6</span><strong title={votedAmount}>{display(votedAmount)} <small>GE6</small></strong><span>{voteCount.toLocaleString()} Tx</span></div></div>}</div>
    </div>
  </section>;
}
