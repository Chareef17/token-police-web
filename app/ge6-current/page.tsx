import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import SiteHeader from '../site-header';
import RankingPanel from './ranking-panel';
import { ge6CurrentRanking } from '@/lib/ge6-current';
import { displayShort } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata:Metadata={title:'ประมาณอันดับ GE6 ปัจจุบัน — คุณนักสืบโตเฟ่อ'};
const tier=(rank:number)=>rank<=12?'senbatsu':rank<=24?'under':rank<=36?'next':'outside';
const tiers=[{key:'senbatsu',label:'Senbatsu · 1–12'},{key:'under',label:'Under Girls · 13–24'},{key:'next',label:'Next Girls · 25–36'},{key:'outside',label:'ไม่ติดอันดับ · 37+'}];
type Row={name:string;rank:number;amount:string;votedAmount:string;heldAmount:string;bestRank:number;worstRank:number};

export default async function Page({searchParams}:{searchParams:Promise<{includeHoldings?:string}>}){
  const includeHoldings=(await searchParams).includeHoldings==='1';
  return <div className="shell"><SiteHeader/><main className="board current-board">
    <div className="forecast-heading"><h1>世界はどこまで青空なのか？</h1></div>
    <RankingPanel includeHoldings={includeHoldings}>
      <Suspense fallback={<div className="loading-panel" role="status"><span className="spinner" aria-hidden="true"/>กำลังโหลดและคำนวณตารางอันดับ…</div>}>
        <RankingContent includeHoldings={includeHoldings}/>
      </Suspense>
    </RankingPanel>
  </main></div>;
}

async function RankingContent({includeHoldings}:{includeHoldings:boolean}){
  let data;
  try {data=await ge6CurrentRanking(includeHoldings);} catch(error) {console.error(error);}
  return !data?<p className="error" role="alert">ยังโหลดอันดับไม่ได้ กรุณาลองใหม่อีกครั้ง</p>:<>
      {(()=>{const nammonn=data.rows.find((row:{name:string;amount:string})=>row.name==='Nammonn');const estimated=Number(nammonn?.amount??0);const remaining=Math.max(0,20000-estimated);return <section className="forecast-goal" aria-label="เป้าหมายคะแนน Nammonn"><div className="forecast-goal-label"><span aria-hidden="true">◎</span> Token รวมของ Nammonn BNK48 โดยประมาณ</div><div className="forecast-estimate">≈ {Math.round(estimated).toLocaleString('en-US')} <span>Token</span></div><div className="forecast-targets"><div><strong>20,000</strong><span>เป้าหมาย</span></div><div><strong>{Math.ceil(remaining).toLocaleString('en-US')}</strong><span>ขาดอีก</span></div></div></section>;})()}
      <h2 className="rank-title">ประมาณอันดับ GE6 ปัจจุบัน</h2>
      {tiers.map(t=>{const rows=data.rows.filter((row:Row)=>tier(row.rank)===t.key);return rows.length>0&&<section key={t.key} className={`rank-tier tier-${t.key}`} aria-label={t.label}>
        <p className="rank-tier-label">{t.label}</p>
        <ol className="rank-cards">{rows.map((row:Row)=><li key={row.name}>
          <Link className="rank-card" href={`/member/${encodeURIComponent(row.name)}`} prefetch={false}>
            <span className="rank-badge">{row.rank}</span>
            <span className="rank-name">{row.name}{row.name==='Nammonn'&&<span className="nammonn-star" aria-hidden="true">★</span>}</span>
            <span className="rank-stat"><span className="rank-stat-label">คาดจากโหวต</span><span className="rank-stat-value"><strong>{displayShort(row.votedAmount)}</strong>{includeHoldings&&<span className="rank-held">(+{displayShort(row.heldAmount)})</span>}</span></span>
            {includeHoldings
              ?<span className="rank-stat"><span className="rank-stat-label">รวมที่ถือ</span><strong className="rank-stat-value">{displayShort(row.amount)}</strong></span>
              :<span className="rank-stat"><span className="rank-stat-label">ช่วงอันดับ</span><strong className="rank-stat-value">{row.bestRank===row.worstRank?row.bestRank:`${row.bestRank}–${row.worstRank}`}</strong></span>}
          </Link>
        </li>)}</ol>
      </section>;})}
    </>;
}
