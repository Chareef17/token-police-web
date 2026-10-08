import type { Metadata } from 'next';
import { Suspense } from 'react';
import SiteHeader from '../site-header';
import { nammonnFans } from '@/lib/leaderboards';
import { displayShort as display } from '@/lib/amount.mjs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata:Metadata={title:'สายเปย์น้ำมนต์ — คุณนักสืบโตเฟ่อ'};
const short=(a:string)=>a.slice(0,8)+'…'+a.slice(-6);
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';
export default async function Nammonn(){
  return <div className="shell"><SiteHeader/><main className="board voters-board fan-board">
    <h1>สายเปย์น้ำมนต์</h1>
    <p className="muted board-intro">กระเป๋าที่โหวตให้น้ำมนต์มากกว่าเมมเบอร์คนอื่นใน GE5 หรือ Thai-Japan 2026 เรียงตามยอดที่โหวตน้ำมนต์รวม</p>
    <Suspense fallback={<div className="loading-panel" role="status"><span className="spinner" aria-hidden="true"/>กำลังโหลดข้อมูลสายเปย์น้ำมนต์…</div>}><NammonnContent/></Suspense>
  </main></div>;
}
async function NammonnContent(){
  let fans;try{fans=await nammonnFans();}catch(error){console.error(error);}
  return <>
    {!fans?<p className="error" role="alert">ยังโหลดข้อมูลไม่ได้ ลองใหม่อีกครั้ง</p>:!fans.length?<p className="muted">ยังไม่มีข้อมูล</p>:<>
      <p className="muted small">ทั้งหมด {fans.length.toLocaleString()} กระเป๋า</p>
      <div className="table-wrap" tabIndex={0} aria-label="ตารางสายเปย์น้ำมนต์"><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">GE6 โหวตแล้ว</th><th className="num">GE6 ถืออยู่</th><th className="num">BNK ถืออยู่</th><th className="vote-hint vote-hint-first">น่าจะโหวตใคร</th><th className="vote-hint">คนที่เคยโหวตมากที่สุด</th><th className="last-activity">เคลื่อนไหวล่าสุด</th></tr></thead>
        <tbody>{fans.map((f,i)=>{const href='/?address='+f.address;return <tr key={f.address}>
          <td className="rank"><a href={href}>{i+1}</a></td>
          <td className="who"><a href={href}>{f.name&&<strong>{f.name}</strong>}<code>{short(f.address)}</code></a></td>
          <td className="num"><a href={href}><strong>{display(f.voted)}</strong></a></td>
          <td className="num"><a href={href}>{f.ge6===null?'—':display(f.ge6)}</a></td>
          <td className="num"><a href={href}>{f.bnk===null?'—':display(f.bnk)}</a></td>
          <td className="vote-hint vote-hint-first"><a href={href}>{f.likely.length?f.likely.map((candidate,index)=><span className="candidate" key={candidate}>{index+1}. {candidate}</span>):'—'}</a></td>
          <td className="vote-hint"><a href={href}>{f.topVote??'—'}</a></td>
          <td className="last-activity"><a href={href}>{date(f.lastTxAt)}</a></td>
        </tr>;})}</tbody>
      </table></div>
    </>}
  </>;
}
