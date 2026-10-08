import type { Metadata } from 'next';
import { Suspense } from 'react';
import SiteHeader from '../site-header';
import AddressCopy from '../address-copy';
import { ge6Holders } from '@/lib/leaderboards';
import { displayShort as display } from '@/lib/amount.mjs';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'ผู้ถือ GE6 สูงสุด — คุณนักสืบโตเฟ่อ'};
export default async function Holders(){
  return <div className="shell"><SiteHeader/><main className="board">
    <h1>ผู้ถือ GE6 สูงสุด 20 อันดับ</h1>
    <Suspense fallback={<div className="loading-panel" role="status"><span className="spinner" aria-hidden="true"/>กำลังโหลดข้อมูลผู้ถือ GE6…</div>}><HoldersContent/></Suspense>
  </main></div>;
}
async function HoldersContent(){
  let data;try{data=await ge6Holders(20);}catch(error){console.error(error);}
  return <>
    {!data?<p className="error" role="alert">TokenX Scan ยังไม่ตอบกลับ ลองใหม่อีกครั้ง</p>:<>
      <div className="table-wrap responsive-card-table"><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">GE6 ที่ถืออยู่</th></tr></thead>
        <tbody>{data.holders.map(h=>{const href='/?address='+h.address;return <tr key={h.address}>
          <td className="rank"><a href={href}>{h.rank}</a></td>
          <td className="who"><div className="wallet-identity">{h.name&&<a href={href}><strong>{h.name}</strong></a>}<AddressCopy address={h.address} href={href}/>{h.contract&&<span className="tag off">contract</span>}</div></td>
          <td className="num" data-label="GE6 ถืออยู่"><a href={href}><strong>{display(h.amount)}</strong></a></td>
        </tr>;})}</tbody>
      </table></div>
    </>}
  </>;
}
