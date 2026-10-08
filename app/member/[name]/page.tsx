import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/app/site-header';
import { ge6CandidateByName } from '@/lib/ge6-candidates';
import { ge6MemberProjection } from '@/lib/ge6-current';
import { displayShort } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;
export async function generateMetadata({params}:{params:Promise<{name:string}>}):Promise<Metadata>{
  const name=ge6CandidateByName.get((await params).name.toLowerCase());
  return {title:`${name??'เมมเบอร์'} · ประมาณคะแนน GE6 — คุณนักสืบโตเฟ่อ`};
}
const short=(address:string)=>address.slice(0,8)+'…'+address.slice(-6);
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';

export default async function MemberPage({params,searchParams}:{params:Promise<{name:string}>;searchParams:Promise<{page?:string}>}){
  const name=ge6CandidateByName.get((await params).name.toLowerCase());
  if(!name)notFound();
  const raw=(await searchParams).page;
  const page=raw&&/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
  let data;
  try{data=await ge6MemberProjection(name,page);}catch(error){console.error(error);}
  const base=`/member/${encodeURIComponent(name)}`;
  return <div className="shell"><SiteHeader/><main className="board voters-board member-board">
    <h1>{name} · ประมาณคะแนน GE6</h1>
    {!data?<p className="error" role="alert">ยังโหลดข้อมูลเมมเบอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง</p>:<>
      <div className="current-summary">
        <span>อันดับประมาณ <strong>#{data.rank}</strong></span>
        <span>{data.published?'ฐานผลด่วน':'ฐานผลด่วนประมาณ'} <strong>{displayShort(data.baseline)}</strong></span>
        <span>คาดจากโหวตหลังผลด่วน <strong>{displayShort(data.postVotes)}</strong></span>
        <span>คาดจาก GE6 ในกระเป๋า <strong>{displayShort(data.held)}</strong></span>
        <span>ทั้งหมดประมาณ <strong>{displayShort(data.total)}</strong> GE6</span>
      </div>
      <p className="muted small">โหวต GE6 เป็นโหวตลับ คะแนนฐานจากผลด่วนจึงแจกแจงตามกระเป๋าไม่ได้ ตารางนี้แสดงเฉพาะส่วนที่คาดจากโหวตหลังผลด่วนและ GE6 ที่ยังถืออยู่ โดยใช้รายชื่อที่กรอกเองก่อนประวัติโหวต</p>
      <h2>กระเป๋าที่คาดว่าจะโหวต {name}</h2>
      <p className="muted small">ทั้งหมด {data.walletCount.toLocaleString()} กระเป๋า · เรียงตามยอดที่คาดให้เมมเบอร์</p>
      <div className="table-wrap" tabIndex={0} aria-label={`กระเป๋าที่คาดว่าจะโหวต ${name}`}><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">คาดจากโหวต</th><th className="num">คาดจากที่ถือ</th><th className="num">รวมที่คาดให้ {name}</th><th className="num">GE6 โหวตแล้ว</th><th className="num">GE6 ถืออยู่</th><th className="num">BNK ถืออยู่</th><th className="vote-hint vote-hint-first">น่าจะโหวตใคร</th><th className="vote-hint">คนที่เคยโหวตมากที่สุด</th><th className="last-activity">เคลื่อนไหวล่าสุด</th></tr></thead>
        <tbody>{data.wallets.map((wallet,index)=>{const href='/?address='+wallet.address;return <tr key={wallet.address}>
          <td className="rank"><a href={href}>{(data.page-1)*20+index+1}</a></td>
          <td className="who"><a href={href}>{wallet.name&&<strong>{wallet.name}</strong>}<code>{short(wallet.address)}</code></a></td>
          <td className="num"><a href={href}>{displayShort(wallet.contributionVotes)}</a></td>
          <td className="num"><a href={href}>{displayShort(wallet.contributionHeld)}</a></td>
          <td className="num"><a href={href}><strong>{displayShort(wallet.contributionTotal)}</strong></a></td>
          <td className="num"><a href={href}>{displayShort(wallet.voted)}</a></td>
          <td className="num"><a href={href}>{wallet.ge6===null?'—':displayShort(wallet.ge6)}</a></td>
          <td className="num"><a href={href}>{wallet.bnk===null?'—':displayShort(wallet.bnk)}</a></td>
          <td className="vote-hint vote-hint-first"><a href={href}>{wallet.likely.length?wallet.likely.map((candidate,i)=><span className="candidate" key={candidate}>{i+1}. {candidate}</span>):'—'}</a></td>
          <td className="vote-hint"><a href={href}>{wallet.topVote??'—'}</a></td>
          <td className="last-activity"><a href={href}>{date(wallet.lastTxAt)}</a></td>
        </tr>;})}</tbody>
      </table></div>
      {data.pages>1&&<nav className="voters-pagination" aria-label="หน้ากระเป๋า"><span>หน้า {data.page}/{data.pages}</span><div>{data.page>1&&<a className="secondary" href={data.page===2?base:`${base}?page=${data.page-1}`}>ก่อนหน้า</a>}{data.page<data.pages&&<a className="secondary" href={`${base}?page=${data.page+1}`}>ถัดไป</a>}</div></nav>}
      <p className="muted small">GE6 ที่ยังถืออยู่เป็นเพียงสมมติฐานว่าจะนำไปโหวต · โหลดข้อมูลเมื่อ {new Date(data.fetchedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
    </>}
  </main></div>;
}
