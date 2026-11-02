'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Row = { name:string; amount:string };
type Adjustment = { id:string; member:string; delta:number; note:string; createdAt:string };
const key='ge6-plan-adjustments-v2';
const fmt=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);

export default function PlanClient(){
  const [rows,setRows]=useState<Row[]>([]);
  const [items,setItems]=useState<Adjustment[]>([]);
  const [updatedAt,setUpdatedAt]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [member,setMember]=useState('Nammonn');
  const [delta,setDelta]=useState('');
  const [note,setNote]=useState('');
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))setItems(saved.filter(x=>x&&typeof x.id==='string'&&typeof x.member==='string'&&Number.isFinite(x.delta)&&typeof x.note==='string'));}catch{}},[]);
  const refresh=useCallback(async()=>{
    try{const response=await fetch('/api/ge6-plan',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();setRows(data.rows);setUpdatedAt(data.updatedAt||'');setError('');}
    catch{setError('ยังโหลดคะแนนคาดการณ์ล่าสุดไม่ได้');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>clearInterval(timer);},[refresh]);
  const add=(event:React.FormEvent)=>{event.preventDefault();const value=Number(delta.replaceAll(',',''));if(!Number.isFinite(value)||value===0||!rows.some(row=>row.name===member))return;const next=[...items,{id:crypto.randomUUID(),member,delta:Math.round(value*100)/100,note:note.trim(),createdAt:new Date().toISOString()}];setItems(next);localStorage.setItem(key,JSON.stringify(next));setDelta('');setNote('');setEditing(null);};
  const remove=(id:string)=>{const next=items.filter(item=>item.id!==id);setItems(next);localStorage.setItem(key,JSON.stringify(next));};
  const ranking=useMemo(()=>rows.map(row=>{const base=Number(row.amount);const adjustment=items.filter(item=>item.member===row.name).reduce((sum,item)=>sum+item.delta,0);return{name:row.name,base,adjustment,total:Math.max(0,Math.round((base+adjustment)*100)/100)};}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name)),[rows,items]);
  const nammonn=ranking.find(row=>row.name==='Nammonn');
  return <section className="plan-page"><h1>แผนคะแนน GE6</h1><div className="plan-status"><span>ฐาน: คะแนนคาดการณ์ปัจจุบัน {updatedAt&&`· อัปเดต ${new Date(updatedAt).toLocaleString('th-TH')}`}</span><button onClick={()=>void refresh()} disabled={loading}>อัปเดต</button></div>
    {loading&&<p role="status">กำลังโหลดคะแนน…</p>}{error&&<p role="alert">{error}</p>}
    {nammonn&&<div className="plan-highlight"><strong>★ Nammonn</strong><span>อันดับ #{ranking.indexOf(nammonn)+1}</span><b>{fmt(nammonn.total)} GE6</b><small>ฐาน {fmt(nammonn.base)} · ปรับ {nammonn.adjustment>=0?'+':''}{fmt(nammonn.adjustment)}</small></div>}
    <div className="plan-ranking"><h2>อันดับตามแผน</h2><input aria-label="ค้นหาเมมเบอร์" placeholder="ค้นหาเมมเบอร์" value={search} onChange={e=>setSearch(e.target.value)}/><div className="plan-table"><div className="plan-table-head"><span>อันดับ</span><span>เมมเบอร์</span><span>ฐานคาดการณ์</span><span>ทีมปรับ</span><span>รวมในแผน</span><span>แก้ไข</span></div>{ranking.map((row,index)=>({row,index})).filter(({row})=>row.name.toLowerCase().includes(search.toLowerCase())).map(({row,index})=><div key={row.name} className={row.name==='Nammonn'?'nammonn':''}><span>#{index+1}</span><span className="plan-member-name">{row.name==='Nammonn'?'★ ':''}{row.name}{items.filter(item=>item.member===row.name&&item.note).map(item=><small key={item.id} className="plan-member-note">{item.note}</small>)}</span><span>{fmt(row.base)}</span><span>{row.adjustment>=0?'+':''}{fmt(row.adjustment)}</span><strong>{fmt(row.total)}</strong><button className="plan-edit-button" type="button" onClick={()=>{setMember(row.name);setEditing(editing===row.name?null:row.name);setDelta('');setNote('');}} aria-expanded={editing===row.name}>แก้ไข</button>{editing===row.name&&<form className="plan-inline-edit" onSubmit={add}><label>บวกหรือลบ GE6<input autoFocus inputMode="decimal" value={delta} onChange={e=>setDelta(e.target.value)} placeholder="+500 หรือ -200" required/></label><label>หมายเหตุ<input value={note} onChange={e=>setNote(e.target.value)} placeholder="ที่มาของคะแนน" maxLength={200}/></label><button type="submit">บันทึก</button><button type="button" onClick={()=>setEditing(null)}>ยกเลิก</button><div className="plan-edit-history">{items.filter(item=>item.member===row.name).map(item=><div key={item.id}><span>{item.delta>0?'+':''}{fmt(item.delta)} · {item.note||'ไม่มีหมายเหตุ'}</span><button type="button" onClick={()=>remove(item.id)}>ลบ</button></div>)}</div></form>}</div>)}</div></div>
    <p className="plan-disclaimer">รายการที่ปรับบันทึกในเบราว์เซอร์นี้ คะแนนคาดการณ์จะอัปเดตเมื่อเว็บได้รับธุรกรรมใหม่</p>
  </section>;
}
