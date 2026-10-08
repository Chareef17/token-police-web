import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import SiteHeader from '@/app/site-header';
import { ge6CandidateByName } from '@/lib/ge6-candidates';
import { ge6MemberProjection } from '@/lib/ge6-current';
import { displayShort } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;
export async function generateMetadata({params}:{params:Promise<{name:string}>}):Promise<Metadata>{
  const name=ge6CandidateByName.get((await params).name.toLowerCase());
  return {title:`${name??'เมมเบอร์'} — คุณนักสืบโตเฟ่อ`};
}
const short=(address:string)=>address.slice(0,8)+'…'+address.slice(-6);
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';

export default async function MemberPage({params,searchParams}:{params:Promise<{name:string}>;searchParams:Promise<{page?:string}>}){
  const name=ge6CandidateByName.get((await params).name.toLowerCase());
  if(!name)notFound();
  const raw=(await searchParams).page;
  const page=raw&&/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
  return <div className="shell"><SiteHeader/><main className="board voters-board member-board">
    <h1>{name}</h1>
    <Suspense fallback={<div className="loading-panel" role="status"><span className="spinner" aria-hidden="true"/>กำลังโหลดคะแนนโหวตและกระเป๋าที่เกี่ยวข้อง…</div>}>
      <MemberContent name={name} page={page}/>
    </Suspense>
  </main></div>;
}

async function MemberContent({name,page}:{name:string;page:number}){
  let data;
  try{data=await ge6MemberProjection(name,page);}catch(error){console.error(error);}
  const base=`/member/${encodeURIComponent(name)}`;
  return !data?<p className="error" role="alert">ยังโหลดข้อมูลเมมเบอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง</p>:<>
      <div className="current-summary">
        <span>อันดับผลด่วน <strong>{data.preliminaryRank===null?'ไม่อยู่ใน 36 อันดับที่ประกาศ':`#${data.preliminaryRank}`}</strong></span>
        <span>คะแนนผลด่วน <strong>{data.published?displayShort(data.baseline):'ไม่เปิดเผย'}</strong></span>
        <span>คาดจากโหวตหลังผลด่วน <strong>{displayShort(data.postVotes)}</strong></span>
        <span>รวมตามตารางอันดับปัจจุบัน <strong>{displayShort(data.total)}</strong> GE6</span>
      </div>
      <p className="muted small">GE6 เป็นโหวตลับ จึงระบุผู้รับจริงของแต่ละกระเป๋าไม่ได้ ตารางนี้คาดจาก GE6 ที่โหวตแล้วทั้งหมด โดยใช้รายชื่อที่กรอกเองก่อนประวัติโหวต ยอดก่อนผลด่วนรวมอยู่ในคะแนนผลด่วนแล้ว จึงไม่บวกซ้ำในตารางอันดับปัจจุบัน</p>
      <h2>กระเป๋าที่คาดว่าโหวตให้ {name}</h2>
      <p className="muted small">ทั้งหมด {data.walletCount.toLocaleString()} กระเป๋า · หน้าละ 20 กระเป๋า · เรียงตามยอดโหวตที่คาดให้ {name} มากที่สุด</p>
      <div className="table-wrap" tabIndex={0} aria-label={`กระเป๋าที่คาดว่าโหวตให้ ${name}`}><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">คาดว่าโหวตให้ {name}</th><th className="num">GE6 โหวตแล้วทั้งกระเป๋า</th><th className="vote-hint vote-hint-first">น่าจะโหวตใคร</th><th className="vote-hint">คนที่เคยโหวตมากที่สุด</th><th className="last-activity">เคลื่อนไหวล่าสุด</th></tr></thead>
        <tbody>{data.wallets.map((wallet,index)=>{const href='/?address='+wallet.address;return <tr key={wallet.address}>
          <td className="rank"><a href={href}>{(data.page-1)*20+index+1}</a></td>
          <td className="who"><a href={href}>{wallet.name&&<strong>{wallet.name}</strong>}<code>{short(wallet.address)}</code></a></td>
          <td className="num"><a href={href}>{displayShort(wallet.contributionVotes)}</a></td>
          <td className="num"><a href={href}>{displayShort(wallet.voted)}</a></td>
          <td className="vote-hint vote-hint-first"><a href={href}>{wallet.likely.length?wallet.likely.map((candidate,i)=><span className="candidate" key={candidate}>{i+1}. {candidate}</span>):'—'}</a></td>
          <td className="vote-hint"><a href={href}>{wallet.topVote??'—'}</a></td>
          <td className="last-activity"><a href={href}>{date(wallet.lastTxAt)}</a></td>
        </tr>;})}</tbody>
      </table></div>
      {data.pages>1&&<nav className="voters-pagination" aria-label="หน้ากระเป๋า"><span>หน้า {data.page}/{data.pages}</span><div>{data.page>1&&<Link className="secondary" prefetch={false} href={data.page===2?base:`${base}?page=${data.page-1}`}>ก่อนหน้า</Link>}{data.page<data.pages&&<Link className="secondary" prefetch={false} href={`${base}?page=${data.page+1}`}>ถัดไป</Link>}</div></nav>}
      <p className="muted small">โหลดข้อมูลเมื่อ {new Date(data.fetchedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
    </>;
}
