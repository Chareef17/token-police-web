'use client';
import { useEffect,useState } from 'react';
import { displayShort } from '@/lib/amount.mjs';
type Candidate={member:string;amount:string};
type Row={rank:number;address:string;name:string|null;voted:string;bnk:string|null;ge6:string|null;lastTxAt:string|null;likely:Candidate[];topVote:(Candidate&{event:string})|null};
type Board={rows:Row[];page:number;pages:number;total:number;fetchedAt:string};
const short=(address:string)=>address.slice(0,8)+'…'+address.slice(-6);
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';
export default function Ge6VotersTable(){
  const [page,setPage]=useState(1);
  const [retry,setRetry]=useState(0);
  const [data,setData]=useState<Board|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
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
    <p className="muted board-intro">ยอดโหวตสะสม เรียงจากมากไปน้อย</p>
    {loading?<div className="loading-panel" role="status"><span className="spinner"/> กำลังโหลดอันดับ…</div>:error?<p className="error" role="alert">{error} <button className="text-button" onClick={()=>setRetry(r=>r+1)}>ลองใหม่</button></p>:data&&<>
      <div className="table-wrap" tabIndex={0} aria-label="ตารางอันดับผู้โหวต GE6"><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">GE6 โหวตแล้ว</th><th className="num">GE6 ถืออยู่</th><th className="num">BNK ถืออยู่</th><th className="vote-hint">น่าจะโหวตใคร</th><th className="vote-hint">Member top vote</th><th className="last-activity">เคลื่อนไหวล่าสุด</th></tr></thead>
        <tbody>{data.rows.map(row=>{const href='/?address='+row.address;return <tr key={row.address}>
          <td className="rank"><a href={href}>{row.rank}</a></td>
          <td className="who"><a href={href}>{row.name&&<strong>{row.name}</strong>}<code>{short(row.address)}</code></a></td>
          <td className="num"><a href={href}><strong>{displayShort(row.voted)}</strong></a></td>
          <td className="num"><a href={href}>{row.ge6===null?'—':displayShort(row.ge6)}</a></td>
          <td className="num"><a href={href}>{row.bnk===null?'—':displayShort(row.bnk)}</a></td>
          <td className="vote-hint"><a href={href}>{row.likely.length?row.likely.map((candidate,i)=><span className="candidate" key={candidate.member}><span>{i+1}. {candidate.member}</span><small>{displayShort(candidate.amount)}</small></span>):'—'}</a></td>
          <td className="vote-hint"><a href={href}>{row.topVote?<span className="candidate"><span>{row.topVote.member}</span><small>{row.topVote.event} · {displayShort(row.topVote.amount)}</small></span>:'—'}</a></td>
          <td className="last-activity"><a href={href}>{date(row.lastTxAt)}</a></td>
        </tr>;})}</tbody>
      </table></div>
      <div className="voters-pagination"><span>ทั้งหมด {data.total.toLocaleString()} กระเป๋า · หน้า {data.page}/{data.pages}</span><div><button className="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><button className="secondary" disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></div></div>
      <p className="muted small">น่าจะโหวตใคร: รวมยอดจากงานเก่าและกรองเฉพาะผู้สมัคร GE6 · Member top vote: ยอดสูงสุดในงานเดียวจาก GE4, GE5, Thai-Japan, Thai-Chinese และ 365-Nichi · ยอดคงเหลือและธุรกรรมล่าสุดจาก TokenX Scan · อัปเดต {new Date(data.fetchedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
    </>}
  </section>;
}
