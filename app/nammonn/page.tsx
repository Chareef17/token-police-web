import type { Metadata } from 'next';
import SiteHeader from '../site-header';
import { nammonnFans, fanEvents } from '@/lib/leaderboards';
import { displayShort as display } from '@/lib/amount.mjs';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'สายเปย์น้ำมนต์ — คุณนักสืบโตเฟ่อ'};
const short=(a:string)=>a.slice(0,8)+'…'+a.slice(-6);
export default async function Nammonn(){
  let fans;try{fans=await nammonnFans();}catch(error){console.error(error);}
  return <div className="shell"><SiteHeader/><main className="board">
    <h1>สายเปย์น้ำมนต์</h1>
    <p className="muted board-intro">กระเป๋าที่โหวตให้น้ำมนต์มากกว่าเมมเบอร์คนอื่นใน GE5 หรือ Thai-Japan 2026 เรียงตามยอดที่โหวตน้ำมนต์รวม · กดที่แถวเพื่อดูประวัติ</p>
    {!fans?<p className="error" role="alert">ยังโหลดข้อมูลไม่ได้ ลองใหม่อีกครั้ง</p>:!fans.length?<p className="muted">ยังไม่มีข้อมูล</p>:<>
      <p className="muted small">ทั้งหมด {fans.length.toLocaleString()} กระเป๋า · <span className="tag">อันดับ 1</span> = โหวตน้ำมนต์มากที่สุดในงานนั้น</p>
      <div className="table-wrap"><table>
        <thead><tr><th>#</th><th>กระเป๋า</th>{fanEvents.map(e=><th key={e} className="num">{e}</th>)}<th className="num">รวม</th></tr></thead>
        <tbody>{fans.map((f,i)=>{const href='/?address='+f.address;return <tr key={f.address}>
          <td className="rank"><a href={href}>{i+1}</a></td>
          <td className="who"><a href={href}>{f.name&&<strong>{f.name}</strong>}<code>{short(f.address)}</code></a></td>
          {fanEvents.map(e=>{const v=f.events[e];return <td key={e} className="num"><a href={href}>{v?<>{display(v.nammonn)}<span className={v.top?'tag':'tag off'}>{v.top?'อันดับ 1':'ไม่ใช่อันดับ 1'}</span></>:<span className="muted">—</span>}</a></td>;})}
          <td className="num"><a href={href}><strong>{display(f.total)}</strong></a></td>
        </tr>;})}</tbody>
      </table></div>
    </>}
  </main></div>;
}
