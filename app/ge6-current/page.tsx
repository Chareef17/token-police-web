import type { Metadata } from 'next';
import SiteHeader from '../site-header';
import { ge6CurrentRanking } from '@/lib/ge6-current';
import { displayShort } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'ประมาณอันดับ GE6 ปัจจุบัน — คุณนักสืบโตเฟ่อ'};
const date=(value:string)=>new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'});

export default async function Page(){
  let data;
  try {data=await ge6CurrentRanking();} catch(error) {console.error(error);}
  return <div className="shell"><SiteHeader/><main className="board current-board">
    <h1>ประมาณอันดับ GE6 ปัจจุบัน</h1>
    <p className="board-intro">ผลด่วน ณ 3 ต.ค. 2026 เวลา 12:00 น. รวมกับ GE6 ที่โหวตหลังจากนั้น</p>
    {!data?<p className="error" role="alert">ยังโหลดอันดับไม่ได้ กรุณาลองใหม่อีกครั้ง</p>:<>
      <div className="current-summary">
        <span>โหวตหลังผลด่วน <strong>{data.postVoteCount.toLocaleString('th-TH')}</strong> รายการ</span>
        <span>คาดการณ์ผู้รับได้ <strong>{displayShort(data.allocated)}</strong> GE6</span>
        <span>ยังระบุผู้รับไม่ได้ <strong>{displayShort(data.unassigned)}</strong> GE6</span>
      </div>
      <p className="muted small current-method">คะแนนหลังผลด่วนใช้เมมเบอร์ที่กระเป๋าน่าจะโหวตจาก GE5, Thai-Japan และ Thai-Chinese (ปรับมูลค่าเหรียญ 6 ต่อ 68) หากมีรายชื่อที่กรอกเองจะใช้แทน แบ่ง 1 คน 100%, 2 คน 60/40, 3 คน 50/30/20</p>
      <div className="table-wrap"><table>
        <thead><tr><th>ลำดับ</th><th>ชื่อ</th><th className="num">จำนวน (ประมาณ)</th><th className="num">ช่วงอันดับที่เป็นไปได้</th></tr></thead>
        <tbody>{data.rows.map((row:{name:string;rank:number;amount:string;published:boolean;bestRank:number;worstRank:number})=><tr key={row.name}>
          <td className="current-cell rank">{row.rank}</td>
          <td className="current-cell who"><strong>{row.name}</strong>{!row.published&&<span className="tag off">ผลด่วนไม่เปิดเผยคะแนน</span>}</td>
          <td className="current-cell num"><strong>{displayShort(row.amount)}</strong></td>
          <td className="current-cell num">{row.bestRank===row.worstRank?row.bestRank:`${row.bestRank}–${row.worstRank}`}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="muted small current-footnote">ผลด่วนประกาศคะแนนรายคนเพียง 36 อันดับแรก อีก 22 คนใช้ยอดคงเหลือรวมเฉลี่ยเป็นฐานประมาณการ ช่วงอันดับคำนวณจากฐานที่ยังไม่เปิดเผย (0–1,724.28 GE6 ต่อคน) โดยยึดการแบ่งคะแนนตามสมมติฐานข้างต้น จึงไม่ใช่ผลคะแนนหรือขอบเขตอันดับจริง</p>
      <p className="muted small">ข้อมูลโหวตล่าสุด {data.lastVoteAt?date(data.lastVoteAt):'ยังไม่มีหลังผลด่วน'} · โหลดข้อมูลเมื่อ {date(data.fetchedAt)}</p>
    </>}
  </main></div>;
}
