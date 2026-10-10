'use client';
import { useEffect,useRef,useState } from 'react';
import { displayShort } from '@/lib/amount.mjs';
import type { VoteTier } from '@/lib/ge6-live';
import { ge6CandidateNames } from '@/lib/ge6-candidates';
import AddressCopy from './address-copy';
import MemberAvatars from './member-avatars';
import { refreshEvent } from '@/lib/client-cache';

type Row={txHash:string;logIndex:number;address:string;name:string|null;amount:string;votedAt:string|null;inPreliminary:boolean;tier:VoteTier;bnk:string|null;ge6:string|null;likely:string[];assignedMember:string|null;assignmentVersion:number};
type Feed={rows:Row[];page:number;pages:number;total:number;tier:VoteTier|null;chainVoteCount:number|null;assignmentRevision:number;fetchedAt:string};
type Range={min:string|null;max:string|null};
const tierLabels:Record<VoteTier,string>={tier1:'100–500',tier2:'501–1,000',tier3:'1,001–2,999',tier4:'3,000–5,000',tier5:'5,001–9,999',tier6:'10,000+'};
const tiers=Object.keys(tierLabels) as VoteTier[];
const date=(value:string|null)=>value?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const pageFromUrl=()=>{if(typeof window==='undefined')return 1;const raw=new URLSearchParams(window.location.search).get('page');return raw&&/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;};
const tierFromUrl=():VoteTier|null=>{if(typeof window==='undefined')return null;const raw=new URLSearchParams(window.location.search).get('tier');return raw&&/^tier[1-6]$/.test(raw)?raw as VoteTier:null;};
const rangeFromUrl=():Range|null=>{if(typeof window==='undefined')return null;const params=new URLSearchParams(window.location.search);const min=params.get('min'),max=params.get('max');return min!==null||max!==null?{min,max}:null;};
const feedUrl=(page:number,tier:VoteTier|null,range:Range|null)=>{const params=new URLSearchParams({page:String(page)});if(range){if(range.min!==null)params.set('min',range.min);if(range.max!==null)params.set('max',range.max);}else if(tier)params.set('tier',tier);return '/api/ge6-live?'+params;};
const validAmount=(value:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,18})?$/.test(value);

export default function Ge6LiveTable(){
  const [page,setPage]=useState(pageFromUrl);
  const [tier,setTier]=useState<VoteTier|null>(tierFromUrl);
  const [range,setRange]=useState<Range|null>(rangeFromUrl);
  const [customMin,setCustomMin]=useState(()=>rangeFromUrl()?.min??'');
  const [customMax,setCustomMax]=useState(()=>rangeFromUrl()?.max??'');
  const [filterError,setFilterError]=useState('');
  const [editing,setEditing]=useState<Row|null>(null);
  const [selectedMember,setSelectedMember]=useState('');
  const [saveError,setSaveError]=useState('');
  const [saving,setSaving]=useState(false);
  const [retry,setRetry]=useState(0);
  const [data,setData]=useState<Feed|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [syncError,setSyncError]=useState(false);
  const count=useRef<number|null>(null);
  const revision=useRef<number|null>(null);
  const currentPage=useRef(page);
  const currentTier=useRef(tier);
  const currentRange=useRef(range);
  currentPage.current=page;
  currentTier.current=tier;
  currentRange.current=range;
  useEffect(()=>{const restore=()=>{const nextRange=rangeFromUrl();setPage(pageFromUrl());setTier(tierFromUrl());setRange(nextRange);setCustomMin(nextRange?.min??'');setCustomMax(nextRange?.max??'');};const reload=()=>setRetry(v=>v+1);restore();window.addEventListener('popstate',restore);window.addEventListener(refreshEvent,reload);return()=>{window.removeEventListener('popstate',restore);window.removeEventListener(refreshEvent,reload);};},[]);
  const changePage=(next:number)=>{const url=new URL(window.location.href);if(next<=1)url.searchParams.delete('page');else url.searchParams.set('page',String(next));window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setPage(next);};
  const changeTier=(next:VoteTier|null)=>{const url=new URL(window.location.href);url.searchParams.delete('page');url.searchParams.delete('min');url.searchParams.delete('max');if(next)url.searchParams.set('tier',next);else url.searchParams.delete('tier');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setPage(1);setTier(next);setRange(null);setCustomMin('');setCustomMax('');setFilterError('');};
  const applyCustom=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const min=customMin.trim(),max=customMax.trim();if((!min&&!max)||(min&&!validAmount(min))||(max&&!validAmount(max))||(min&&max&&Number(min)>Number(max))){setFilterError('กรุณากรอกช่วงตัวเลขที่ถูกต้อง');return;}const next={min:min||null,max:max||null};const url=new URL(window.location.href);url.searchParams.delete('tier');url.searchParams.delete('page');if(next.min)url.searchParams.set('min',next.min);else url.searchParams.delete('min');if(next.max)url.searchParams.set('max',next.max);else url.searchParams.delete('max');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setPage(1);setTier(null);setRange(next);setFilterError('');};
  const openAssignment=(row:Row)=>{setEditing(row);setSelectedMember(row.assignedMember??'');setSaveError('');};
  const saveAssignment=async()=>{if(!editing)return;setSaving(true);setSaveError('');try{const response=await fetch('/api/ge6-vote-assignment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txHash:editing.txHash,logIndex:editing.logIndex,member:selectedMember||null,version:editing.assignmentVersion})});const result=await response.json() as {error?:string;member?:string|null;version?:number};if(!response.ok)throw new Error(result.error??'บันทึกไม่สำเร็จ');setData(current=>current?{...current,rows:current.rows.map(row=>row.txHash===editing.txHash&&row.logIndex===editing.logIndex?{...row,assignedMember:result.member??null,assignmentVersion:result.version??0}:row)}:current);setEditing(null);}catch(error){setSaveError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setSaving(false);}};
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch(feedUrl(page,tier,range),{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('โหลดข้อมูลไม่สำเร็จ');return response.json() as Promise<Feed>;}).then(result=>{count.current=result.chainVoteCount;revision.current=result.assignmentRevision;setData(result);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[page,tier,range,retry]);
  useEffect(()=>{
    let stopped=false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    let running=false;
    const schedule=()=>{if(!stopped)timer=setTimeout(sync,15000);};
    async function sync(){
      if(stopped||running)return;
      if(document.hidden){schedule();return;}
      running=true;
      try{
        const response=await fetch('/api/sync-ge6',{method:'POST',cache:'no-store'});
        if(response.ok){
          const result=await response.json() as {votes?:number;assignmentRevision?:number};
          if(stopped)return;
          setSyncError(false);
          if((typeof result.votes==='number'&&result.votes!==count.current)||(typeof result.assignmentRevision==='number'&&result.assignmentRevision!==revision.current)){
            if(typeof result.votes==='number')count.current=result.votes;
            if(typeof result.assignmentRevision==='number')revision.current=result.assignmentRevision;
            const feed=await fetch(feedUrl(currentPage.current,currentTier.current,currentRange.current),{cache:'no-store'});
            if(feed.ok&&!stopped){const fresh=await feed.json() as Feed;count.current=fresh.chainVoteCount;revision.current=fresh.assignmentRevision;setData(fresh);}
          }
        }else if(response.status!==409)setSyncError(true);
      }catch{if(!stopped)setSyncError(true);}
      finally{running=false;schedule();}
    }
    const onVisibility=()=>{if(!document.hidden){if(timer)clearTimeout(timer);void sync();}};
    document.addEventListener('visibilitychange',onVisibility);
    void sync();
    return()=>{stopped=true;if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility);};
  },[]);
  return <section className="board live-votes-board" aria-label="ธุรกรรมโหวต GE6 ล่าสุด">
    <div className="live-votes-heading"><h1>โหวต GE6 ล่าสุด</h1><span className={syncError?'live-status delayed':'live-status'}>{syncError?'รอซิงก์':'LIVE'}</span></div>
    <div className="live-tier-filters" role="group" aria-label="กรองตามยอดโหวต"><button type="button" className={!tier&&!range?'active':''} aria-pressed={!tier&&!range} onClick={()=>changeTier(null)}>ทั้งหมด</button>{tiers.map(value=><button type="button" key={value} className={'live-tier '+value+(tier===value?' active':'')} aria-pressed={tier===value} onClick={()=>changeTier(value)}>{tierLabels[value]}</button>)}</div>
    <form className="live-custom-filter" onSubmit={applyCustom}><label>จาก <input type="number" min="0" step="any" inputMode="decimal" value={customMin} onChange={event=>setCustomMin(event.target.value)} placeholder="ขั้นต่ำ"/></label><label>ถึง <input type="number" min="0" step="any" inputMode="decimal" value={customMax} onChange={event=>setCustomMax(event.target.value)} placeholder="สูงสุด"/></label><button type="submit" className={range?'active':''}>กรองยอด</button>{filterError&&<span role="alert" className="error">{filterError}</span>}</form>
    {loading?<div className="loading-panel" role="status"><span className="spinner"/> กำลังโหลดโหวตล่าสุด…</div>:error?<p className="error" role="alert">{error} <button className="text-button" onClick={()=>setRetry(v=>v+1)}>ลองใหม่</button></p>:data&&<>
      {data.rows.length===0&&<p className="live-empty">ยังไม่มีรายการในช่วงนี้</p>}
      {data.rows.length>0&&<div className="table-wrap responsive-card-table live-votes-table" tabIndex={0} aria-label="ตารางธุรกรรมโหวต GE6"><table><thead><tr><th>ระดับ</th><th>กระเป๋า</th><th className="num">โหวตครั้งนี้</th><th className="num">GE6 ถืออยู่</th><th className="num">BNK ถืออยู่</th><th className="vote-hint">น่าจะโหวตใคร</th><th>ผู้รับโหวต</th><th>เวลา / Tx</th></tr></thead>
        <tbody>{data.rows.map(row=>{const href='/?address='+row.address;return <tr key={row.txHash+':'+row.logIndex} className={'live-row '+row.tier}>
          <td className="rank"><span className={'live-tier '+row.tier}>{tierLabels[row.tier]}</span></td>
          <td className="who"><div className="wallet-identity">{row.name&&<a href={href}><strong>{row.name}</strong></a>}<AddressCopy address={row.address} href={href}/></div></td>
          <td className="num live-amount" data-label="โหวตครั้งนี้"><strong>{displayShort(row.amount)}</strong></td>
          <td className="num" data-label="GE6 ถืออยู่"><a href={href}>{row.ge6===null?'—':displayShort(row.ge6)}</a></td>
          <td className="num" data-label="BNK ถืออยู่"><a href={href}>{row.bnk===null?'—':displayShort(row.bnk)}</a></td>
          <td className="vote-hint" data-label="น่าจะโหวตใคร">{row.likely.length?<MemberAvatars names={row.likely}/>:<a href={href}>—</a>}</td>
          <td className="live-assignment" data-label="ผู้รับโหวต"><button type="button" onClick={()=>openAssignment(row)}>{row.assignedMember?`${row.assignedMember} · แก้ไข`:'เลือกเมมเบอร์'}</button></td>
          <td className="live-transaction" data-label="เวลา / Tx"><time dateTime={row.votedAt??undefined}>{date(row.votedAt)}</time><a href={'https://scan.tokenx.finance/tx/'+row.txHash} target="_blank" rel="noopener noreferrer" aria-label={'ดูธุรกรรม '+row.txHash}>ดู Tx ↗</a></td>
        </tr>;})}</tbody></table></div>}
      <div className="voters-pagination"><span>ทั้งหมด {data.total.toLocaleString()} รายการ · หน้า {data.page}/{data.pages}</span><div><button className="secondary" disabled={page<=1} onClick={()=>changePage(page-1)}>ก่อนหน้า</button><button className="secondary" disabled={page>=data.pages} onClick={()=>changePage(page+1)}>ถัดไป</button></div></div>
    </>}
    {editing&&<div className="live-assignment-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setEditing(null);}}><div className="live-assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><h2 id="assignment-title">ระบุผู้รับโหวต</h2><div className="live-assignment-summary"><strong>{displayShort(editing.amount)} GE6</strong><span>{editing.name??'ไม่มีชื่อกระเป๋า'}</span><code>{editing.address}</code><small>Tx {editing.txHash.slice(0,10)}…{editing.txHash.slice(-8)}</small></div>{editing.inPreliminary&&<p className="live-assignment-note">Tx ก่อนผลด่วนอยู่ในคะแนนผลด่วนแล้ว จึงไม่บวกซ้ำ</p>}<label htmlFor="assignment-member">เมมเบอร์</label><select id="assignment-member" value={selectedMember} onChange={event=>setSelectedMember(event.target.value)}><option value="">{editing.assignedMember?'ไม่ระบุผู้รับ':'เลือกเมมเบอร์'}</option>{ge6CandidateNames.map(name=><option key={name} value={name}>{name}</option>)}</select>{saveError&&<p className="error" role="alert">{saveError}</p>}<div className="live-assignment-actions"><button type="button" className="secondary" disabled={saving} onClick={()=>setEditing(null)}>ยกเลิก</button><button type="button" disabled={saving||(!selectedMember&&!editing.assignedMember)} onClick={saveAssignment}>{saving?'กำลังบันทึก…':'บันทึก'}</button></div></div></div>}
  </section>;
}
