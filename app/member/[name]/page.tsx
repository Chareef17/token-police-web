import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import SiteHeader from '@/app/site-header';
import AddressCopy from '@/app/address-copy';
import MemberAvatars from '@/app/member-avatars';
import { ge6CandidateByName, ge6CandidateGroup } from '@/lib/ge6-candidates';
import { ge6MemberProjection } from '@/lib/ge6-current';
import { displayShort } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;
export async function generateMetadata({params}:{params:Promise<{name:string}>}):Promise<Metadata>{
  const name=ge6CandidateByName.get((await params).name.toLowerCase());
  return {title:`${name??'เมมเบอร์'} — คุณนักสืบโตเฟ่อ`};
}
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';

export default async function MemberPage({params,searchParams}:{params:Promise<{name:string}>;searchParams:Promise<{page?:string}>}){
  const name=ge6CandidateByName.get((await params).name.toLowerCase());
  if(!name)notFound();
  const raw=(await searchParams).page;
  const page=raw&&/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;
  return <div className="shell"><SiteHeader/><main className="board voters-board member-board">
    <section className="member-hero">
      <div className="member-hero-photo"><img src={`/members/full/${name.toLowerCase()}.webp`} alt={name} width={480} height={480}/></div>
      <div className="member-hero-copy"><span className="member-hero-group">{ge6CandidateGroup(name)} · GE2026</span><h1>{name}</h1>{name==='Nammonn'&&<span className="member-hero-cheer">★ ROAD TO 13</span>}</div>
    </section>
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
      <h2>กระเป๋าที่คาดว่าโหวตให้ {name}</h2>
      <p className="muted small">{data.walletCount.toLocaleString()} กระเป๋า</p>
      <div className="table-wrap responsive-card-table voter-vote-table" tabIndex={0} aria-label={`กระเป๋าที่คาดว่าโหวตให้ ${name}`}><table>
        <thead><tr><th>#</th><th>กระเป๋า</th><th className="num">คาดว่าโหวตให้ {name}</th><th className="num vote-total">GE6 โหวตแล้ว</th><th className="num vote-after" title={`คาดว่าโหวตให้ ${name} หลังผลด่วนแรก วันที่ 3 ต.ค. 2026 เวลา 12:00 น.`}>คาดว่าโหวตให้ {name}<br/>หลังด่วนแรก</th><th className="vote-hint vote-hint-first">น่าจะโหวตใคร</th><th className="vote-hint">คนที่เคยโหวตมากที่สุด</th><th className="last-activity">เคลื่อนไหวล่าสุด</th></tr></thead>
        <tbody>{data.wallets.map((wallet,index)=>{const href='/?address='+wallet.address;return <tr key={wallet.address}>
          <td className="rank"><a href={href}>{(data.page-1)*20+index+1}</a></td>
          <td className="who"><div className="wallet-identity">{wallet.name&&<a href={href}><strong>{wallet.name}</strong></a>}<AddressCopy address={wallet.address} href={href}/></div></td>
          <td className="num" data-label={`คาดให้ ${name}`}><a href={href} title={wallet.heldOnly?'คาดจากเหรียญที่ถืออยู่':undefined}>{displayShort(wallet.heldOnly??wallet.contributionVotes)}</a>{wallet.heldOnly&&<span className="held-only-note">จากเหรียญที่ถือ</span>}</td>
          <td className="num vote-total" data-label="GE6 โหวตแล้ว"><a href={href}>{wallet.heldOnly?<>ยังไม่โหวต<span className="held-only-note">{[wallet.ge6&&Number(wallet.ge6)>0&&`GE6 ${displayShort(wallet.ge6)}`,wallet.bnk&&Number(wallet.bnk)>0&&`BNK ${displayShort(wallet.bnk)}`].filter(Boolean).join(' · ')}</span></>:displayShort(wallet.voted)}</a></td>
          <td className="num vote-after" data-label={`คาดให้ ${name} หลังด่วนแรก`}><a href={href}>{displayShort(wallet.postVoted)}</a></td>
          <td className="vote-hint vote-hint-first" data-label="น่าจะโหวตใคร">{wallet.likely.length?<MemberAvatars names={wallet.likely}/>:<a href={href}>—</a>}</td>
          <td className="vote-hint" data-label="เคยโหวตมากสุด"><a href={href}>{wallet.topVote??'—'}</a></td>
          <td className="last-activity" data-label="ล่าสุด"><a href={href}>{date(wallet.lastTxAt)}</a></td>
        </tr>;})}</tbody>
      </table></div>
      {data.pages>1&&<nav className="voters-pagination" aria-label="หน้ากระเป๋า"><span>หน้า {data.page}/{data.pages}</span><div>{data.page>1&&<Link className="secondary" prefetch={false} href={data.page===2?base:`${base}?page=${data.page-1}`}>ก่อนหน้า</Link>}{data.page<data.pages&&<Link className="secondary" prefetch={false} href={`${base}?page=${data.page+1}`}>ถัดไป</Link>}</div></nav>}
    </>;
}
