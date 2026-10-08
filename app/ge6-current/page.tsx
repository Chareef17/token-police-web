import type { Metadata } from 'next';
import SiteHeader from '../site-header';
import RankingPanel from './ranking-panel';
import { ge6CurrentRanking } from '@/lib/ge6-current';
import { displayShort } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata:Metadata={title:'ประมาณอันดับ GE6 ปัจจุบัน — คุณนักสืบโตเฟ่อ'};
const date=(value:string)=>new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'});
const tier=(rank:number)=>rank<=12?'senbatsu':rank<=24?'under':rank<=36?'next':'outside';

export default async function Page({searchParams}:{searchParams:Promise<{includeHoldings?:string}>}){
  const includeHoldings=(await searchParams).includeHoldings==='1';
  let data;
  try {data=await ge6CurrentRanking(includeHoldings);} catch(error) {console.error(error);}
  return <div className="shell"><SiteHeader/><main className="board current-board">
    <h1>ประมาณอันดับ GE6 ปัจจุบัน</h1>
    <RankingPanel includeHoldings={includeHoldings}>
    {!data?<p className="error" role="alert">ยังโหลดอันดับไม่ได้ กรุณาลองใหม่อีกครั้ง</p>:<>
      <div className="current-summary">
        <span>โหวตหลังผลด่วน <strong>{data.postVoteCount.toLocaleString('th-TH')}</strong> รายการ</span>
        <span>คาดการณ์ผู้รับได้ <strong>{displayShort(data.allocated)}</strong> GE6</span>
        <span>ยังระบุผู้รับไม่ได้ <strong>{displayShort(data.unassigned)}</strong> GE6</span>
        {includeHoldings&&<><span>GE6 ในกระเป๋าที่คาดผู้รับได้ <strong>{displayShort(data.heldAllocated)}</strong></span><span>GE6 ในกระเป๋าที่ยังระบุผู้รับไม่ได้ <strong>{displayShort(data.heldUnassigned)}</strong></span></>}
      </div>
      <div className="current-legend" aria-label="สีแสดงกลุ่มอันดับ">
        <span className="senbatsu">Senbatsu · 1–12</span><span className="under">Under Girls · 13–24</span><span className="next">Next Girls · 25–36</span><span className="outside">ไม่ติดอันดับ · 37+</span>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>ลำดับ</th><th>ชื่อ</th><th className="num">{includeHoldings?'จำนวน (+ในกระเป๋า)':'จำนวน (ประมาณ)'}</th>{includeHoldings&&<th className="num">ทั้งหมด</th>}<th className="num">ช่วงอันดับที่เป็นไปได้</th></tr></thead>
        <tbody>{data.rows.map((row:{name:string;rank:number;amount:string;votedAmount:string;heldAmount:string;bestRank:number;worstRank:number})=><tr key={row.name} className={`tier-${tier(row.rank)}`}>
          <td className="current-cell rank">{row.rank}</td>
          <td className="current-cell who"><a className="current-member-link" href={`/member/${encodeURIComponent(row.name)}`}><strong>{row.name}</strong></a></td>
          <td className="current-cell num"><strong>{displayShort(row.votedAmount)}</strong>{includeHoldings&&<span className="current-held"> (+{displayShort(row.heldAmount)})</span>}</td>
          {includeHoldings&&<td className="current-cell num"><strong>{displayShort(row.amount)}</strong></td>}
          <td className="current-cell num">{row.bestRank===row.worstRank?row.bestRank:`${row.bestRank}–${row.worstRank}`}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="muted small current-footnote">ผลด่วนประกาศคะแนนรายคนเพียง 36 อันดับแรก อีก 22 คนใช้ยอดคงเหลือรวมเฉลี่ยเป็นฐานประมาณการ ช่วงอันดับคำนวณจากฐานที่ยังไม่เปิดเผย (0–1,724.28 GE6 ต่อคน) โดยยึดการแบ่งคะแนนตามสมมติฐานข้างต้น จึงไม่ใช่ผลคะแนนหรือขอบเขตอันดับจริง</p>
      {includeHoldings&&<p className="muted small">ยอดในวงเล็บคือ GE6 ที่ยังอยู่ในกระเป๋าผู้ถือ ณ เวลาที่โหลดข้อมูล กระจายตามรายชื่อที่คาดว่าจะโหวตด้วยสัดส่วนเดิม จึงเป็นเพียงสมมติฐานว่าเหรียญเหล่านั้นจะถูกนำไปโหวต</p>}
      <p className="muted small">ข้อมูลโหวตล่าสุด {data.lastVoteAt?date(data.lastVoteAt):'ยังไม่มีหลังผลด่วน'} · โหลดข้อมูลเมื่อ {date(data.fetchedAt)}</p>
    </>}
    </RankingPanel>
  </main></div>;
}
