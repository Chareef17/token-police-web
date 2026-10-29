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
const days=['2026-10-30','2026-10-31'];
const dayLabel=(date:string)=>date==='2026-10-30'?'ศุกร์ 30 ต.ค.':'เสาร์ 31 ต.ค.';

export default async function Page(){
  let snapshots:Snapshot[]=[];
  try{
    const result=await (await database()).execute({sql:'SELECT id,cutoff,forecast,transaction_count FROM ge6_snapshots WHERE id IN (?,?) ORDER BY id',args:days});
    snapshots=result.rows.map(row=>{const forecast=JSON.parse(String(row.forecast));return {date:String(row.id),cutoff:String(row.cutoff),capturedAt:forecast.capturedAt,rows:forecast.rows,transactionCount:Number(row.transaction_count)};});
  }catch(error){console.error('GE6 preliminary 2 report snapshot read failed',error);}
  const official=actual as {cutoffDate:string|null;announcedAt:string|null;source:string|null;ranking:string[]};
  const selected=official.cutoffDate?snapshots.find(snapshot=>snapshot.date===official.cutoffDate):null;
  let comparison:Comparison|null=null;
  try{if(selected&&official.ranking.length)comparison=compareRanks(selected.rows,official.ranking) as Comparison;}catch(error){console.error('GE6 preliminary 2 comparison failed',error);}
  const nammonn=comparison?.rows.find(row=>row.name==='Nammonn');
  return <div className="shell"><SiteHeader/><main className="board current-board prelim2-report">
    <header className="report-heading"><h1>รายงานความแม่นของคาดการณ์</h1></header>
    {official.cutoffDate&&<div className="report-snapshots report-snapshots-single">{[official.cutoffDate].map(date=>{const snapshot=snapshots.find(item=>item.date===date);return <Link key={date} href={`/ge6-snapshot/${date}`} className="report-snapshot"><span>{dayLabel(date)} · 12:00 น.</span><strong>{snapshot?'บันทึกแล้ว':'รอบันทึก'}</strong>{snapshot&&<small>{snapshot.transactionCount.toLocaleString('en-US')} ธุรกรรม</small>}</Link>;})}</div>}
    {!official.ranking.length?<div className="snapshot-empty">รอประกาศอันดับผลด่วนสอง<small>เมื่อมีอันดับจริง รายงานจะเทียบกับ snapshot ของวันที่ใช้ตัดยอด โดยไม่ใช้คะแนนจริงที่ยังไม่ประกาศ</small></div>
    :!selected?<div className="snapshot-empty">รอ snapshot ของวันตัดยอด<small>ยังไม่สามารถสรุปความแม่นก่อนข้อมูลครบ</small></div>
    :!comparison?<p className="error" role="alert">ข้อมูลอันดับจริงไม่ตรงกับรายชื่อผู้สมัคร GE6 กรุณาตรวจสอบ</p>
    :<>
      <div className="report-metrics"><div><span>ตรงอันดับ</span><strong>{comparison.exact}/{comparison.compared}</strong></div><div><span>อยู่ในช่วงคาดการณ์</span><strong>{comparison.withinRange}/{comparison.compared}</strong></div><div><span>คลาดเคลื่อนเฉลี่ย</span><strong>{comparison.meanAbsoluteError?.toFixed(1)} อันดับ</strong></div>{nammonn&&<div className="report-nammonn"><span>★ Nammonn</span><strong>จริง #{nammonn.actualRank} · คาด #{nammonn.predictedRank}</strong></div>}</div>
      <div className="report-table-wrap"><table className="report-table"><thead><tr><th>ชื่อ</th><th>อันดับจริง</th><th>คาดการณ์</th><th>ต่าง</th><th>ช่วงคาดการณ์</th></tr></thead><tbody>{comparison.rows.map(row=><tr key={row.name} className={row.name==='Nammonn'?'nammonn':''}><th>{row.name}{row.name==='Nammonn'&&' ★'}</th><td>#{row.actualRank}</td><td>#{row.predictedRank}</td><td>{row.rankDifference===0?'ตรง':row.rankDifference>0?`ดีกว่าคาด ${row.rankDifference}`:`ต่ำกว่าคาด ${Math.abs(row.rankDifference)}`}</td><td className={row.withinRange?'in-range':'out-range'}>{row.bestRank===row.worstRank?`#${row.bestRank}`:`#${row.bestRank}–${row.worstRank}`}{row.withinRange?' ✓':''}</td></tr>)}</tbody></table></div>
      <p className="report-note">ผลด่วนสองประกาศเฉพาะอันดับ ตารางนี้จึงวัดความต่างของอันดับเท่านั้น ไม่สรุปคะแนนจริงจากอันดับ</p>
    </>}
  </main></div>;
}
