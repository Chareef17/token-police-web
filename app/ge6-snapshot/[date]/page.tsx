import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/app/site-header';
import { database } from '@/lib/db';
import { displayShort } from '@/lib/amount.mjs';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'บันทึกคาดการณ์ GE6 — คุณนักสืบโตเฟ่อ',robots:{index:false,follow:false}};

const day={label:'เสาร์ 31 ต.ค. 2026'};
type RankingRow={name:string;rank:number;amount:string;bestRank:number;worstRank:number;published:boolean};
type Forecast={rows:RankingRow[];votedTotal:string;postVoteTotal:string;allocated:string;unassigned:string;capturedAt:string};
const tier=(rank:number)=>rank<=12?'senbatsu':rank<=24?'under':rank<=36?'next':'outside';
const tiers=[{key:'senbatsu',label:'Senbatsu · 1–12'},{key:'under',label:'Under Girls · 13–24'},{key:'next',label:'Next Girls · 25–36'},{key:'outside',label:'ไม่ติดอันดับ · 37+'}];

export default async function Page({params}:{params:Promise<{date:string}>}){
  const {date}=await params;
  if(date!=='2026-10-31')notFound();
  let snapshot:{forecast:Forecast;transactions:number;cutoff:string}|null=null;
  try{
    const rows=(await (await database()).execute({sql:'SELECT cutoff,forecast,transaction_count FROM ge6_snapshots WHERE id=?',args:[date]})).rows;
    if(rows[0])snapshot={cutoff:String(rows[0].cutoff),forecast:JSON.parse(String(rows[0].forecast)),transactions:Number(rows[0].transaction_count)};
  }catch(error){console.error('GE6 snapshot read failed',error);}
  return <div className="shell"><SiteHeader/><main className="board current-board snapshot-board">
    <div className="forecast-heading"><h1>世界はどこまで青空なのか？</h1></div>
    <div className="snapshot-heading"><div><p className="snapshot-kicker">บันทึกคาดการณ์ GE6</p><h2>{day.label} · 12:00 น.</h2></div></div>
    {!snapshot?<div className="snapshot-empty">ยังไม่มี snapshot ของวันนี้<br/><small>ตารางจะปรากฏหลังระบบบันทึกข้อมูล ณ เวลาเที่ยง</small></div>:<>
      <div className="snapshot-summary"><div><span>โหวตรวม ณ เวลานั้น</span><strong>{displayShort(snapshot.forecast.votedTotal)}</strong></div><div><span>คาดผู้รับได้หลังผลด่วนแรก</span><strong>{displayShort(snapshot.forecast.allocated)}</strong></div><div><span>ยังไม่ทราบผู้รับ</span><strong>{displayShort(snapshot.forecast.unassigned)}</strong></div><div><span>ธุรกรรมที่บันทึก</span><strong>{snapshot.transactions.toLocaleString('en-US')}</strong></div></div>
      <div className="snapshot-table-head" aria-hidden="true"><span>#</span><span>ชื่อ</span><span>คะแนนคาดการณ์</span><span>ช่วงอันดับ</span></div>
      {tiers.map(group=>{const rows=snapshot!.forecast.rows.filter(row=>tier(row.rank)===group.key);return rows.length>0&&<section key={group.key} className={`rank-tier tier-${group.key}`} aria-label={group.label}><p className="rank-tier-label">{group.label}</p><ol className="rank-cards">{rows.map(row=><li key={row.name} className="snapshot-row"><span className="rank-badge">{row.rank}</span><span className="rank-name"><img className="rank-avatar" src={`/members/${row.name.toLowerCase()}.webp`} alt="" width={64} height={64} loading="lazy"/>{row.name}{row.name==='Nammonn'&&<span className="nammonn-star" aria-label="Nammonn">★</span>}</span><span className="snapshot-score"><small>คาดการณ์</small><strong>{displayShort(row.amount)}</strong></span><span className="snapshot-range"><small>ช่วงอันดับ</small>{row.bestRank===row.worstRank?row.bestRank:`${row.bestRank}–${row.worstRank}`}</span></li>)}</ol></section>})}
      <p className="snapshot-captured">บันทึกข้อมูล {new Date(snapshot.forecast.capturedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'})}</p>
    </>}
  </main></div>;
}
