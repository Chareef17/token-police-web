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
const tierLabels:Record<VoteTier,string>={tier0:'0–99',tier1:'100–500',tier2:'501–1,000',tier3:'1,001–2,999',tier4:'3,000–5,000',tier5:'5,001–9,999',tier6:'10,000+'};
const date=(value:string|null)=>value?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const pageFromUrl=()=>{if(typeof window==='undefined')return 1;const raw=new URLSearchParams(window.location.search).get('page');return raw&&/^[1-9]\d{0,5}$/.test(raw)?Number(raw):1;};
const thresholdFromUrl=():string|null=>{if(typeof window==='undefined')return null;return new URLSearchParams(window.location.search).get('min');};
const exactFromUrl=():string|null=>{if(typeof window==='undefined')return null;return new URLSearchParams(window.location.search).get('exact');};
const feedUrl=(page:number,threshold:string|null,exact:string|null)=>{const params=new URLSearchParams({page:String(page)});if(exact!==null)params.set('exact',exact);else if(threshold!==null)params.set('min',threshold);return '/api/ge6-live?'+params;};
const validThreshold=(value:string)=>/^(?:0|[1-9]\d{0,4})$/.test(value)&&Number(value)<=10000;
const validAmount=(value:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,18})?$/.test(value);

export default function Ge6LiveTable(){
  const [page,setPage]=useState(pageFromUrl);
  const [threshold,setThreshold]=useState<string|null>(thresholdFromUrl);
  const [sliderDraft,setSliderDraft]=useState(()=>thresholdFromUrl()??'0');
  const [exact,setExact]=useState<string|null>(exactFromUrl);
  const [draftExact,setDraftExact]=useState(()=>exactFromUrl()??'');
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
  const currentThreshold=useRef(threshold);
  const currentExact=useRef(exact);
  currentPage.current=page;
  currentThreshold.current=threshold;
  currentExact.current=exact;
  useEffect(()=>{const restore=()=>{const nextThreshold=thresholdFromUrl(),nextExact=exactFromUrl();setPage(pageFromUrl());setThreshold(nextThreshold);setSliderDraft(nextThreshold??'0');setExact(nextExact);setDraftExact(nextExact??'');};const reload=()=>setRetry(v=>v+1);restore();window.addEventListener('popstate',restore);window.addEventListener(refreshEvent,reload);return()=>{window.removeEventListener('popstate',restore);window.removeEventListener(refreshEvent,reload);};},[]);
  const changePage=(next:number)=>{const url=new URL(window.location.href);if(next<=1)url.searchParams.delete('page');else url.searchParams.set('page',String(next));window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setPage(next);};
  const clearFilters=()=>{const url=new URL(window.location.href);for(const key of ['page','min','max','exact','tier'])url.searchParams.delete(key);window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setPage(1);setThreshold(null);setSliderDraft('0');setExact(null);setDraftExact('');setFilterError('');};
  const applyThreshold=(raw:string)=>{const value=raw.trim();if(!validThreshold(value)){setFilterError('เลือกยอดขั้นต่ำ 0–10,000');return;}const url=new URL(window.location.href);url.searchParams.delete('tier');url.searchParams.delete('page');url.searchParams.delete('max');url.searchParams.delete('exact');if(Number(value)>0)url.searchParams.set('min',value);else url.searchParams.delete('min');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setPage(1);setThreshold(Number(value)>0?value:null);setSliderDraft(value);setExact(null);setDraftExact('');setFilterError('');};
  const applyCustom=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const value=draftExact.trim();if(!validAmount(value)){setFilterError('กรอกยอดโหวตที่ต้องการค้นหา');return;}const url=new URL(window.location.href);url.searchParams.delete('tier');url.searchParams.delete('page');url.searchParams.delete('min');url.searchParams.delete('max');url.searchParams.set('exact',value);window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);setPage(1);setThreshold(null);setSliderDraft('0');setExact(value);setFilterError('');};
  const openAssignment=(row:Row)=>{setEditing(row);setSelectedMember(row.assignedMember??'');setSaveError('');};
  const saveAssignment=async(member:string|null)=>{if(!editing)return;setSaving(true);setSaveError('');try{const response=await fetch('/api/ge6-vote-assignment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txHash:editing.txHash,logIndex:editing.logIndex,member,version:editing.assignmentVersion})});const result=await response.json() as {error?:string;member?:string|null;version?:number};if(!response.ok)throw new Error(result.error??'บันทึกไม่สำเร็จ');setData(current=>current?{...current,rows:current.rows.map(row=>row.txHash===editing.txHash&&row.logIndex===editing.logIndex?{...row,assignedMember:result.member??null,assignmentVersion:result.version??0}:row)}:current);setEditing(null);}catch(error){setSaveError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setSaving(false);}};
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch(feedUrl(page,threshold,exact),{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('โหลดข้อมูลไม่สำเร็จ');return response.json() as Promise<Feed>;}).then(result=>{count.current=result.chainVoteCount;revision.current=result.assignmentRevision;setData(result);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[page,threshold,exact,retry]);
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
            const feed=await fetch(feedUrl(currentPage.current,currentThreshold.current,currentExact.current),{cache:'no-store'});
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
    <div className="live-filter-panel"><form className="live-custom-filter" onSubmit={applyCustom}><label htmlFor="live-exact-number">ค้นหายอดโหวต</label><div className="live-threshold-input"><input id="live-exact-number" type="number" min="0" step="any" inputMode="decimal" value={draftExact} onChange={event=>setDraftExact(event.target.value)} placeholder="ยอดโหวต"/><span>GE6</span></div><button type="submit">ค้นหา</button></form><div className="live-slider-filter"><div className="live-slider-heading"><span>แสดง Tx ตั้งแต่ <strong>{Number(sliderDraft).toLocaleString()} GE6</strong> ขึ้นไป</span>{exact!==null&&<button type="button" className="text-button" onClick={clearFilters}>ล้างการค้นหา</button>}</div><input className="live-threshold-slider" aria-label="ยอดโหวตขั้นต่ำ" type="range" min="0" max="10000" step="100" value={Number(sliderDraft)} onChange={event=>setSliderDraft(event.target.value)} onPointerUp={event=>applyThreshold(event.currentTarget.value)} onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))applyThreshold(event.currentTarget.value);}}/><div className="live-threshold-ticks"><span>0</span><span>1,000</span><span>3,000</span><span>5,000</span><span>10,000+</span></div></div>{filterError&&<span role="alert" className="error">{filterError}</span>}</div>
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
    {editing&&<div className="live-assignment-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setEditing(null);}}><div className="live-assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><h2 id="assignment-title">ระบุผู้รับโหวต</h2><div className="live-assignment-summary"><strong>{displayShort(editing.amount)} GE6</strong><span>{editing.name??'ไม่มีชื่อกระเป๋า'}</span><code>{editing.address}</code><small>Tx {editing.txHash.slice(0,10)}…{editing.txHash.slice(-8)}</small></div>{editing.inPreliminary&&<p className="live-assignment-note">Tx ก่อนผลด่วนอยู่ในคะแนนผลด่วนแล้ว จึงไม่บวกซ้ำ</p>}<label htmlFor="assignment-member">เมมเบอร์</label><select id="assignment-member" value={selectedMember} onChange={event=>setSelectedMember(event.target.value)}><option value="" disabled>เลือกเมมเบอร์</option>{ge6CandidateNames.map(name=><option key={name} value={name}>{name}</option>)}</select>{saveError&&<p className="error" role="alert">{saveError}</p>}<div className="live-assignment-actions">{editing.assignedMember&&<button type="button" className="secondary" disabled={saving} onClick={()=>{setSelectedMember('');void saveAssignment(null);}}>Clear</button>}<button type="button" className="secondary" disabled={saving} onClick={()=>setEditing(null)}>ยกเลิก</button><button type="button" disabled={saving||!selectedMember} onClick={()=>saveAssignment(selectedMember)}>{saving?'กำลังบันทึก…':'บันทึก'}</button></div></div></div>}
  </section>;
}
