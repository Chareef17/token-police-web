import type { Metadata } from 'next';
import SiteHeader from '../site-header';
import { ge6Holders } from '@/lib/leaderboards';
import { displayShort as display } from '@/lib/amount.mjs';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'ผู้ถือ GE6 สูงสุด — คุณนักสืบโตเฟ่อ'};
const short=(a:string)=>a.slice(0,8)+'…'+a.slice(-6);
const date=(value:string)=>new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'});
export default async function Holders(){
  let data;try{data=await ge6Holders(20);}catch(error){console.error(error);}
  return <div className="shell"><SiteHeader/><main className="board">
    <h1>ผู้ถือ GE6 สูงสุด 20 อันดับ</h1>
    <p className="muted board-intro">ยอดเหรียญ GE6 ที่ยังอยู่ในกระเป๋าตอนนี้ จาก TokenX Scan · ไม่นับสัญญาโหวต GE6 และกระเป๋าทางการที่ใช้แจกเหรียญ · กดที่แถวเพื่อดูประวัติ</p>
    {!data?<p className="error" role="alert">TokenX Scan ยังไม่ตอบกลับ ลองใหม่อีกครั้ง</p>:<>
      <div className="table-wrap"><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">GE6 ที่ถืออยู่</th></tr></thead>
        <tbody>{data.holders.map(h=>{const href='/?address='+h.address;return <tr key={h.address}>
          <td className="rank"><a href={href}>{h.rank}</a></td>
          <td className="who"><a href={href}>{h.name&&<strong>{h.name}</strong>}<code>{short(h.address)}</code>{h.contract&&<span className="tag off">contract</span>}</a></td>
          <td className="num"><a href={href}><strong>{display(h.amount)}</strong></a></td>
        </tr>;})}</tbody>
      </table></div>
      <p className="muted small">อัปเดตเมื่อ {date(data.fetchedAt)} · ข้อมูลเก็บไว้ไม่เกิน 5 นาที</p>
    </>}
  </main></div>;
}
