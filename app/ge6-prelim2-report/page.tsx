import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/app/site-header';
import { database } from '@/lib/db';
import { compareRanks } from '@/lib/ge6-prelim2-analysis.mjs';
import actual from '@/lib/ge6-prelim2-results.json';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'รายงานผลด่วนสอง GE6 — คุณนักสืบโตเฟ่อ',robots:{index:false,follow:false}};
type ForecastRow={name:string;rank:number;amount:string;bestRank:number;worstRank:number};
type Snapshot={date:string;cutoff:string;capturedAt:string;rows:ForecastRow[];transactionCount:number};
type ComparisonRow={name:string;actualRank:number;predictedRank:number;rankDifference:number;bestRank:number;worstRank:number;withinRange:boolean};
type Comparison={rows:ComparisonRow[];compared:number;exact:number;withinRange:number;meanAbsoluteError:number|null};
const snapshotDate='2026-10-31';

export default async function Page(){
  let snapshots:Snapshot[]=[];
  try{
    const result=await (await database()).execute({sql:'SELECT id,cutoff,forecast,transaction_count FROM ge6_snapshots WHERE id=?',args:[snapshotDate]});
    snapshots=result.rows.map(row=>{const forecast=JSON.parse(String(row.forecast));return {date:String(row.id),cutoff:String(row.cutoff),capturedAt:forecast.capturedAt,rows:forecast.rows,transactionCount:Number(row.transaction_count)};});
  }catch(error){console.error('GE6 preliminary 2 report snapshot read failed',error);}
  const official=actual as {cutoffDate:string|null;announcedAt:string|null;source:string|null;ranking:string[]};
  const selected=official.cutoffDate===snapshotDate?snapshots[0]:null;
  let comparison:Comparison|null=null;
  try{if(selected&&official.ranking.length)comparison=compareRanks(selected.rows,official.ranking) as Comparison;}catch(error){console.error('GE6 preliminary 2 comparison failed',error);}
  const nammonn=comparison?.rows.find(row=>row.name==='Nammonn');
  return <div className="shell"><SiteHeader/><main className="board current-board prelim2-report">
    <header className="report-heading"><h1>ผลด่วนสอง GE6</h1></header>
    {official.cutoffDate===snapshotDate&&<div className="report-snapshots report-snapshots-single">{[snapshotDate].map(date=>{const snapshot=snapshots.find(item=>item.date===date);return <Link key={date} href={`/ge6-snapshot/${date}`} className="report-snapshot"><span>เสาร์ 31 ต.ค. · 12:00 น.</span><strong>{snapshot?'บันทึกแล้ว':'รอบันทึก'}</strong>{snapshot&&<small>{snapshot.transactionCount.toLocaleString('en-US')} ธุรกรรม</small>}</Link>;})}</div>}
    {!official.ranking.length?<div className="snapshot-empty">รอประกาศอันดับผลด่วนสอง<small>เมื่อมีอันดับจริง รายงานจะเทียบกับ snapshot ของวันที่ใช้ตัดยอด โดยไม่ใช้คะแนนจริงที่ยังไม่ประกาศ</small></div>
    :!selected?<div className="snapshot-empty">รอ snapshot ของวันตัดยอด<small>ยังไม่สามารถสรุปความแม่นก่อนข้อมูลครบ</small></div>
    :!comparison?<p className="error" role="alert">ข้อมูลอันดับจริงไม่ตรงกับรายชื่อผู้สมัคร GE6 กรุณาตรวจสอบ</p>
    :<>
      <div className="report-metrics"><div><span>ตรงอันดับ</span><strong>{comparison.exact}/{comparison.compared}</strong></div><div><span>อยู่ในช่วงคาดการณ์</span><strong>{comparison.withinRange}/{comparison.compared}</strong></div><div><span>คลาดเคลื่อนเฉลี่ย</span><strong>{comparison.meanAbsoluteError?.toFixed(1)} อันดับ</strong></div>{nammonn&&<div className="report-nammonn"><span>★ Nammonn</span><strong>จริง #{nammonn.actualRank} · คาด #{nammonn.predictedRank}</strong></div>}</div>
      <div className="report-table-wrap"><table className="report-table"><thead><tr><th>อันดับจริง</th><th>เมมเบอร์</th><th>คาดไว้ตอนเที่ยง</th><th>เทียบกับที่คาด</th></tr></thead><tbody>{comparison.rows.map(row=><tr key={row.name} className={row.name==='Nammonn'?'nammonn':''}><td className="report-actual">{row.actualRank}</td><th>{row.name}{row.name==='Nammonn'&&' ★'}</th><td>#{row.predictedRank}</td><td className={row.rankDifference>0?'report-up':row.rankDifference<0?'report-down':'report-same'}>{row.rankDifference===0?'เท่าเดิม':row.rankDifference>0?`↑ สูงกว่าคาด ${row.rankDifference}`:`↓ ต่ำกว่าคาด ${Math.abs(row.rankDifference)}`}</td></tr>)}</tbody></table></div>
    </>}
  </main></div>;
}
