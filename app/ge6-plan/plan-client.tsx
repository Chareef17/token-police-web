'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Row = { name:string; amount:string };
type Adjustment = { id:string; member:string; delta:number; note:string; createdAt:string };
const fmt=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);

export default function PlanClient(){
  const [rows,setRows]=useState<Row[]>([]);
  const [items,setItems]=useState<Adjustment[]>([]);
  const [updatedAt,setUpdatedAt]=useState('');
  const [totals,setTotals]=useState<{votedTotal:string;trackedTotal:string;untrackedTotal:string;totalSupply:string|null;unvoted:string|null}>({votedTotal:'0',trackedTotal:'0',untrackedTotal:'0',totalSupply:null,unvoted:null});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [member,setMember]=useState('Nammonn');
  const [delta,setDelta]=useState('');
  const [note,setNote]=useState('');
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [editingItem,setEditingItem]=useState<string|null>(null);
  const [planOrder,setPlanOrder]=useState<string[]|null>(null);
  const [orderVersion,setOrderVersion]=useState(0);
  const [dragging,setDragging]=useState<string|null>(null);
  const [dropTarget,setDropTarget]=useState<string|null>(null);
  const dragName=useRef<string|null>(null);
  const dragY=useRef(0);
  const orderBusy=useRef(false);
  const refresh=useCallback(async()=>{
    try{const [response,planResponse,orderResponse]=await Promise.all([fetch('/api/ge6-plan',{cache:'no-store'}),fetch('/api/ge6-plan/adjustments',{cache:'no-store'}),fetch('/api/ge6-plan/order',{cache:'no-store'})]);if(!response.ok||!planResponse.ok||!orderResponse.ok)throw Error();const [data,plan,order]=await Promise.all([response.json(),planResponse.json(),orderResponse.json()]);setRows(data.rows);setItems(plan.items);if(!orderBusy.current){setPlanOrder(order.names);setOrderVersion(order.version);}setTotals({votedTotal:data.votedTotal,trackedTotal:data.trackedTotal,untrackedTotal:data.untrackedTotal,totalSupply:data.totalSupply??null,unvoted:data.unvoted??null});setUpdatedAt(data.updatedAt||'');setError('');}
    catch{setError('ยังโหลดคะแนนคาดการณ์ล่าสุดไม่ได้');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>clearInterval(timer);},[refresh]);
  const write=async(method:'POST'|'PUT'|'DELETE',payload:Record<string,unknown>)=>{try{const response=await fetch('/api/ge6-plan/adjustments',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error||'บันทึกไม่สำเร็จ');await refresh();return true;}catch(cause){setError(cause instanceof Error?cause.message:'บันทึกไม่สำเร็จ');return false;}};
  const add=async(event:React.FormEvent)=>{event.preventDefault();const value=Number(delta.replaceAll(',',''));if(!Number.isFinite(value)||value===0||!rows.some(row=>row.name===member))return;const ok=await write(editingItem?'PUT':'POST',{id:editingItem,member,delta:Math.round(value*100)/100,note:note.trim()});if(ok){setDelta('');setNote('');setEditing(null);setEditingItem(null);}};
  const remove=async(id:string)=>{await write('DELETE',{id});};
  const scoreRanking=useMemo(()=>rows.map(row=>{const base=Number(row.amount);const adjustment=items.filter(item=>item.member===row.name).reduce((sum,item)=>sum+item.delta,0);return{name:row.name,base,adjustment,total:Math.max(0,Math.round((base+adjustment)*100)/100)};}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name)),[rows,items]);
  const ranking=useMemo(()=>{if(!planOrder)return scoreRanking;const positions=new Map(planOrder.map((name,index)=>[name,index]));return [...scoreRanking].sort((a,b)=>(positions.get(a.name)??999)-(positions.get(b.name)??999));},[scoreRanking,planOrder]);
  const conflicts=new Set(planOrder?ranking.filter((row,index)=>index<ranking.length-1&&row.total<ranking[index+1].total-0.005).map(row=>row.name):[]);
  const saveOrder=async(names:string[]|null)=>{
    if(orderBusy.current)return;
    orderBusy.current=true;
    const previous=planOrder;
    setPlanOrder(names);
    try{
      const response=await fetch('/api/ge6-plan/order',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({names,version:orderVersion})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'บันทึกลำดับไม่สำเร็จ');
      setOrderVersion(result.version);setError('');
    }catch(cause){setPlanOrder(previous);setError(cause instanceof Error?cause.message:'บันทึกลำดับไม่สำเร็จ');orderBusy.current=false;await refresh();return;}
    orderBusy.current=false;
  };
  const move=(source:string,target:string)=>{
    if(source===target)return;
    const names=ranking.map(row=>row.name),from=names.indexOf(source),to=names.indexOf(target);
    if(from<0||to<0)return;
    names.splice(from,1);names.splice(to,0,source);
    void saveOrder(names);
  };
  const dragX=useRef(0);
  useEffect(()=>{
    if(!dragging)return;
    let frame=0;
    const step=()=>{
      if(dragY.current<90)window.scrollBy(0,-12);
      else if(dragY.current>window.innerHeight-90)window.scrollBy(0,12);
      const hit=document.elementFromPoint(dragX.current,dragY.current)?.closest<HTMLElement>('[data-plan-member]');
      setDropTarget(hit?.dataset.planMember??null);
      frame=requestAnimationFrame(step);
    };
    frame=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(frame);
  },[dragging]);
  const nammonn=ranking.find(row=>row.name==='Nammonn');
  // The ranking API already returns token amounts as decimal strings.
  const token=(raw:string)=>Number(raw);
  const totalVotes=token(totals.votedTotal);
  const plannedTotal=ranking.reduce((sum,row)=>sum+row.total,0);
  const remaining=totalVotes-plannedTotal;
  const tier=(rank:number)=>rank===1?'Senbatsu · 1–12':rank===13?'Under Girls · 13–24':rank===25?'Next Girls · 25–36':rank===37?'นอกอันดับ · 37–58':'';
  return <section className="plan-page"><h1>Planner</h1><div className="plan-status"><span>ฐาน: คะแนนคาดการณ์ปัจจุบัน {updatedAt&&`· อัปเดต ${new Date(updatedAt).toLocaleString('th-TH')}`}</span><button onClick={()=>void refresh()} disabled={loading}>อัปเดต</button></div>
    {loading&&<p role="status">กำลังโหลดคะแนน…</p>}{error&&<p role="alert">{error}</p>}
    {nammonn&&<div className="plan-highlight"><strong>★ Nammonn</strong><span>อันดับ #{ranking.indexOf(nammonn)+1}</span><b>{fmt(nammonn.total)} GE6</b><small>ฐาน {fmt(nammonn.base)} · ปรับ {nammonn.adjustment>=0?'+':''}{fmt(nammonn.adjustment)}</small></div>}
    <div className="plan-totals"><div><small>โหวตทั้งหมดตอนนี้</small><strong>{fmt(totalVotes)}</strong></div><div><small>GE6 ทั้งหมด</small><strong>{totals.totalSupply?fmt(token(totals.totalSupply)):'—'}</strong></div><div><small>ยังไม่โหวต</small><strong>{totals.unvoted?fmt(token(totals.unvoted)):'—'}</strong></div><div><small>คำนวณในแผนแล้ว</small><strong>{fmt(plannedTotal)}</strong></div><div><small>{remaining<0?'เกินยอดโหวตจริง':'ยังไม่ได้นำมาคำนวณ'}</small><strong className={remaining< -0.01?'plan-over':''}>{fmt(Math.abs(remaining))}</strong></div></div>{remaining< -0.01&&<p className="plan-over-warning" role="alert">คะแนนในแผนเกินยอดโหวตทั้งหมด {fmt(-remaining)} GE6 กรุณาตรวจรายการที่ปรับ</p>}
    <div className="plan-ranking"><div className="plan-ranking-title"><h2>อันดับตามแผน</h2>{planOrder&&<button type="button" onClick={()=>void saveOrder(null)}>เรียงตามคะแนน</button>}</div><p className="plan-drag-help">ลากสัญลักษณ์ข้างอันดับเพื่อจัดลำดับ {conflicts.size>0&&<span className="plan-conflict-count">· คะแนนไม่สอดคล้อง {conflicts.size} คน</span>}</p><input aria-label="ค้นหาเมมเบอร์" placeholder="ค้นหาเมมเบอร์" value={search} onChange={e=>setSearch(e.target.value)}/><div className="plan-table"><div className="plan-table-head"><span>อันดับ</span><span>เมมเบอร์</span><span>ฐานคาดการณ์</span><span>ทีมปรับ</span><span>รวมในแผน</span><span>แก้ไข</span></div>{ranking.map((row,index)=>({row,index})).filter(({row})=>row.name.toLowerCase().includes(search.toLowerCase())).map(({row,index})=><div key={row.name} data-plan-member={row.name} className={`${row.name==='Nammonn'?'nammonn':''} ${tier(index+1)?'plan-tier-start':''} ${dropTarget===row.name&&dragging!==row.name?'plan-drop-target':''}`}>{tier(index+1)&&<div className="plan-tier-label">{tier(index+1)}</div>}<span className="plan-rank-cell"><button type="button" className="plan-drag-handle" aria-label={`ลาก ${row.name} ไปอันดับใหม่`} title="ลากเพื่อจัดอันดับ" onKeyDown={event=>{if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;event.preventDefault();const target=ranking[index+(event.key==='ArrowUp'?-1:1)];if(target)move(row.name,target.name);}} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);dragName.current=row.name;dragX.current=event.clientX;dragY.current=event.clientY;setDragging(row.name);}} onPointerMove={event=>{if(dragName.current){dragX.current=event.clientX;dragY.current=event.clientY;}}} onPointerUp={event=>{const source=dragName.current;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-plan-member]')?.dataset.planMember;dragName.current=null;setDragging(null);setDropTarget(null);if(source&&target)move(source,target);}} onPointerCancel={()=>{dragName.current=null;setDragging(null);setDropTarget(null);}}>⋮⋮</button>#{index+1}</span><span className="plan-member-name">{row.name==='Nammonn'?'★ ':''}{row.name}{items.some(item=>item.member===row.name&&item.note)&&<details className="plan-notes"><summary>หมายเหตุ {items.filter(item=>item.member===row.name&&item.note).length}</summary><div>{items.filter(item=>item.member===row.name&&item.note).map(item=><p key={item.id}>{item.note}</p>)}</div></details>}</span><span className="plan-base">{fmt(row.base)}</span><span className="plan-adjustment">{row.adjustment>=0?'+':''}{fmt(row.adjustment)}</span><strong className={conflicts.has(row.name)?'plan-score-conflict':undefined} title={conflicts.has(row.name)?'คะแนนต่ำกว่าคนในอันดับถัดไป':undefined}>{fmt(row.total)}</strong><button className="plan-edit-button" type="button" onClick={()=>{setMember(row.name);setEditing(editing===row.name?null:row.name);setEditingItem(null);setDelta('');setNote('');}} aria-expanded={editing===row.name}>แก้ไข</button>{editing===row.name&&<form className="plan-inline-edit" onSubmit={add}><label>จำนวน GE6<div className="plan-sign-toggle"><button type="button" className={!delta.startsWith('-')?'selected':''} onClick={()=>setDelta(value=>value.replace(/^[+-]/,''))}>+ เพิ่ม</button><button type="button" className={delta.startsWith('-')?'selected':''} onClick={()=>setDelta(value=>'-'+value.replace(/^[+-]/,''))}>− ลด</button></div><input autoFocus inputMode="decimal" value={delta} onChange={e=>setDelta(e.target.value)} placeholder="จำนวนเหรียญ" required/></label><label>หมายเหตุ<input value={note} onChange={e=>setNote(e.target.value)} placeholder="ที่มาของคะแนน" maxLength={200}/></label><button type="submit">{editingItem?'บันทึกการแก้ไข':'เพิ่มรายการ'}</button><button type="button" onClick={()=>{setEditing(null);setEditingItem(null);}}>ยกเลิก</button><div className="plan-edit-history">{items.filter(item=>item.member===row.name).map(item=><div key={item.id}><span>{item.delta>0?'+':''}{fmt(item.delta)} · {item.note||'ไม่มีหมายเหตุ'}</span><button type="button" onClick={()=>{setEditingItem(item.id);setDelta(String(item.delta));setNote(item.note);}}>แก้รายการ</button><button type="button" onClick={()=>remove(item.id)}>ลบ</button></div>)}</div></form>}</div>)}</div></div>
    <p className="plan-disclaimer">ทุกคนเห็นรายการปรับคะแนนชุดเดียวกัน คะแนนคาดการณ์จะอัปเดตเมื่อเว็บได้รับธุรกรรมใหม่</p>
  </section>;
}
