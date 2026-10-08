'use client';
import { useEffect,useState } from 'react';
import { displayShort } from '@/lib/amount.mjs';
type Row={rank:number;address:string;name:string|null;voted:string;bnk:string|null;ge6:string|null;lastTxAt:string|null;likely:string[];topVote:string|null};
type Board={rows:Row[];page:number;pages:number;total:number;fetchedAt:string};
const short=(address:string)=>address.slice(0,8)+'…'+address.slice(-6);
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';
const pageFromUrl=()=>{
  if(typeof window==='undefined')return 1;
  const raw=new URLSearchParams(window.location.search).get('page');
  return raw&&/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
};
export default function Ge6VotersTable(){
  const [page,setPage]=useState(pageFromUrl);
  const [retry,setRetry]=useState(0);
  const [data,setData]=useState<Board|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    const restore=()=>setPage(pageFromUrl());
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  const changePage=(next:number)=>{
    const url=new URL(window.location.href);
    if(next<=1)url.searchParams.delete('page');else url.searchParams.set('page',String(next));
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    setPage(next);
  };
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch('/api/ge6-voters?page='+page,{signal:controller.signal}).then(async response=>{
      const result=await response.json();if(!response.ok)throw new Error(result.error);return result as Board;
    }).then(result=>setData(result)).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page,retry]);
  return <section className="board voters-board" aria-label="อันดับผู้โหวต GE6">
    <h2>อันดับผู้โหวต GE6</h2>
    <a className="voter-holder-link secondary" href="/ge6-holders">ดูผู้ถือ GE6 สูงสุด</a>
    {loading?<div className="loading-panel" role="status"><span className="spinner"/> กำลังโหลดอันดับ…</div>:error?<p className="error" role="alert">{error} <button className="text-button" onClick={()=>setRetry(r=>r+1)}>ลองใหม่</button></p>:data&&<>
      <div className="voter-cards">{data.rows.map(row=><article className="voter-card" key={row.address}><div className="voter-card-head"><span className="voter-card-rank">{String(row.rank).padStart(2,'0')}</span><a href={'/?address='+row.address} className="voter-card-identity"><strong>{row.name??short(row.address)}</strong><code>{row.name?short(row.address):'กระเป๋า GE6'}</code></a></div><div className="voter-card-stats"><div><span>GE6 โหวตแล้ว</span><strong>{displayShort(row.voted)}</strong></div><div><span>GE6 ถืออยู่</span><strong>{row.ge6===null?'—':displayShort(row.ge6)}</strong></div><div><span>BNK ถืออยู่</span><strong>{row.bnk===null?'—':displayShort(row.bnk)}</strong></div></div><div className="voter-card-extra"><span>น่าจะโหวตใคร: {row.likely.length?row.likely.map((name,i)=>`${i+1}. ${name}`).join(' · '):'—'}</span><span>เคลื่อนไหวล่าสุด: {date(row.lastTxAt)}</span></div></article>)}</div>
      <div className="table-wrap voter-desktop-table" tabIndex={0} aria-label="ตารางอันดับผู้โหวต GE6"><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">GE6 โหวตแล้ว</th><th className="num">GE6 ถืออยู่</th><th className="num">BNK ถืออยู่</th><th className="vote-hint vote-hint-first">น่าจะโหวตใคร</th><th className="vote-hint">คนที่เคยโหวตมากที่สุด</th><th className="last-activity">เคลื่อนไหวล่าสุด</th></tr></thead>
        <tbody>{data.rows.map(row=>{const href='/?address='+row.address;return <tr key={row.address}>
          <td className="rank"><a href={href}>{row.rank}</a></td>
          <td className="who"><a href={href}>{row.name&&<strong>{row.name}</strong>}<code>{short(row.address)}</code></a></td>
          <td className="num"><a href={href}><strong>{displayShort(row.voted)}</strong></a></td>
          <td className="num"><a href={href}>{row.ge6===null?'—':displayShort(row.ge6)}</a></td>
          <td className="num"><a href={href}>{row.bnk===null?'—':displayShort(row.bnk)}</a></td>
          <td className="vote-hint vote-hint-first"><a href={href}>{row.likely.length?row.likely.map((candidate,index)=><span className="candidate" key={candidate}>{index+1}. {candidate}</span>):'—'}</a></td>
          <td className="vote-hint"><a href={href}>{row.topVote??'—'}</a></td>
          <td className="last-activity"><a href={href}>{date(row.lastTxAt)}</a></td>
        </tr>;})}</tbody>
      </table></div>
      <div className="voters-pagination"><span>ทั้งหมด {data.total.toLocaleString()} กระเป๋า · หน้า {data.page}/{data.pages}</span><div><button className="secondary" disabled={page<=1} onClick={()=>changePage(page-1)}>ก่อนหน้า</button><button className="secondary" disabled={page>=data.pages} onClick={()=>changePage(page+1)}>ถัดไป</button></div></div>
    </>}
  </section>;
}
