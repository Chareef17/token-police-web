import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import SiteHeader from '../site-header';
import RankingPanel from './ranking-panel';
import { ge6CurrentRanking, type RankingMode } from '@/lib/ge6-current';
import { displayShort, amount, units } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata:Metadata={title:'ประมาณอันดับ GE6 ปัจจุบัน — คุณนักสืบโตเฟ่อ'};
const tier=(rank:number)=>rank<=12?'senbatsu':rank<=24?'under':rank<=36?'next':'outside';
const tiers=[{key:'senbatsu',label:'Senbatsu · 1–12'},{key:'under',label:'Under Girls · 13–24'},{key:'next',label:'Next Girls · 25–36'},{key:'outside',label:'ไม่ติดอันดับ · 37+'}];
type Row={name:string;rank:number;amount:string;votedAmount:string;todayAmount:string;heldAmount:string;bnkAmount:string;bestRank:number;worstRank:number};
const displayVotes=(value:string)=>{const cents=(units(value)+5n*10n**15n)/(10n**16n);return `${(cents/100n).toLocaleString('en-US')}.${(cents%100n).toString().padStart(2,'0')}`;};

export default async function Page({searchParams}:{searchParams:Promise<{includeHoldings?:string;mode?:string}>}){
  const params=await searchParams;
  const mode:RankingMode=params.mode==='all'?'all':params.mode==='ge6'||params.includeHoldings==='1'?'ge6':'votes';
  return <div className="shell"><SiteHeader/><main className="board current-board">
    <div className="forecast-heading"><h1>世界はどこまで青空なのか？</h1></div>
    <RankingPanel mode={mode}>
      <Suspense fallback={<div className="loading-panel" role="status"><span className="spinner" aria-hidden="true"/>กำลังโหลดและคำนวณตารางอันดับ…</div>}>
        <RankingContent mode={mode}/>
      </Suspense>
    </RankingPanel>
  </main></div>;
}

async function RankingContent({mode}:{mode:RankingMode}){
  const includeHoldings=mode!=='votes';
  let data;
  try {data=await ge6CurrentRanking(mode);} catch(error) {console.error(error);}
  return !data?<p className="error" role="alert">ยังโหลดอันดับไม่ได้ กรุณาลองใหม่อีกครั้ง</p>:<>
      {(()=>{const nammonn=data.rows.find((row:{name:string;amount:string})=>row.name==='Nammonn');const estimated=Number(nammonn?.amount??0);const remaining=Math.max(0,20000-estimated);return <section className="forecast-goal" aria-label="เป้าหมายคะแนน Nammonn"><div className="forecast-goal-label"><span aria-hidden="true">◎</span> Token รวมของ Nammonn BNK48 โดยประมาณ</div><div className="forecast-estimate">≈ {Math.round(estimated).toLocaleString('en-US')} <span>Token</span></div><div className="forecast-targets"><div><strong>20,000</strong><span>เป้าหมาย</span></div><div><strong>{Math.ceil(remaining).toLocaleString('en-US')}</strong><span>ขาดอีก</span></div></div></section>;})()}
      <div className="rank-heading"><h2 className="rank-title">ประมาณอันดับ GE6 ปัจจุบัน</h2><div className="rank-summary" aria-label="ยอดโหวต GE6 รวมถึงผลด่วน"><div><span>โหวตรวมตอนนี้</span><strong>{displayVotes(data.votedTotal)}</strong></div><div title="คะแนนผลด่วนที่ประกาศรายเมมเบอร์ และโหวตหลังผลด่วนที่คาดผู้รับได้"><span>Track ได้</span><strong>{displayVotes(data.trackedTotal)}</strong></div><div title="คะแนนผลด่วนที่ยังไม่เปิดเผยผู้รับ และโหวตหลังผลด่วนที่ยังคาดผู้รับไม่ได้"><span>Track ไม่ได้</span><strong>{displayVotes(data.untrackedTotal)}</strong></div></div></div>
      <div className={includeHoldings?'rank-cards-head':'rank-cards-head rank-card-single'} aria-hidden="true"><span>#</span><span>ชื่อ</span><span>คาดจากโหวต</span>{includeHoldings&&<span>{mode==='all'?'รวมทั้งหมด':'รวมที่ถือ'}</span>}</div>
      {tiers.map(t=>{const rows=data.rows.filter((row:Row)=>tier(row.rank)===t.key);return rows.length>0&&<section key={t.key} className={`rank-tier tier-${t.key}`} aria-label={t.label}>
        <p className="rank-tier-label">{t.label}</p>
        <ol className="rank-cards">{rows.map((row:Row)=><li key={row.name}>
          <Link className={includeHoldings?"rank-card":"rank-card rank-card-single"} href={`/member/${encodeURIComponent(row.name)}`} prefetch={false}>
            <span className="rank-badge">{row.rank}</span>
            <span className="rank-name"><img className="rank-avatar" src={`/members/${row.name.toLowerCase()}.webp`} alt="" width={64} height={64} loading="lazy" decoding="async"/>{row.name}{row.name==='Nammonn'&&<span className="nammonn-star" aria-hidden="true">★</span>}</span>
            <span className="rank-stat"><span className="rank-stat-label">คาดจากโหวต</span><span className="rank-stat-value">{units(row.todayAmount)>0n&&<span className="rank-daily" title="คาดว่าได้เพิ่มจากโหวตวันนี้">+{displayShort(row.todayAmount)}</span>}<strong>{displayShort(row.votedAmount)}</strong>{includeHoldings&&<span className="rank-held" title={mode==='all'?`GE6 ${displayShort(row.heldAmount)} · BNK ${displayShort(row.bnkAmount)}`:undefined}>(+{displayShort(mode==='all'?amount(units(row.heldAmount)+units(row.bnkAmount)):row.heldAmount)})</span>}</span></span>
            {includeHoldings&&<span className="rank-stat"><span className="rank-stat-label">{mode==='all'?'รวมทั้งหมด':'รวมที่ถือ'}</span><strong className="rank-stat-value">{displayShort(row.amount)}</strong></span>}
          </Link>
        </li>)}</ol>
      </section>;})}
    </>;
}
