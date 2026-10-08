'use client';
import { FormEvent,KeyboardEvent,useState } from 'react';
import { ge6CandidateNames } from '@/lib/ge6-candidates';
import MemberAvatars from './member-avatars';
export type ManualPrediction={members:string[];version:number;updated_at:string};
type Choice=string|null;

export default function ManualPredictions({address,initial,onSaved}:{address:string;initial:ManualPrediction|null;onSaved:(value:ManualPrediction)=>void}){
  const [editing,setEditing]=useState(false);
  const [queries,setQueries]=useState(['','','']);
  const [selected,setSelected]=useState<Choice[]>([null,null,null]);
  const [openIndex,setOpenIndex]=useState<number|null>(null);
  const [active,setActive]=useState(0);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  function start(){
    const members=[initial?.members[0]??null,initial?.members[1]??null,initial?.members[2]??null];
    setSelected(members);setQueries(members.map(value=>value??''));setError('');setOpenIndex(null);setEditing(true);
  }
  function change(index:number,value:string){
    setQueries(current=>current.map((entry,i)=>i===index?value:i>index?'':entry));
    setSelected(current=>current.map((entry,i)=>i>=index?null:entry));
    setOpenIndex(index);setActive(0);setError('');
  }
  function choices(index:number){
    const query=queries[index].trim().toLowerCase();
    const previous=new Set(selected.slice(0,index).filter(Boolean));
    return ge6CandidateNames.filter(name=>!previous.has(name)&&name.toLowerCase().includes(query)).slice(0,8);
  }
  function choose(index:number,name:string){
    setSelected(current=>current.map((entry,i)=>i===index?name:entry));
    setQueries(current=>current.map((entry,i)=>i===index?name:entry));
    setOpenIndex(null);setActive(0);setError('');
  }
  function keyDown(event:KeyboardEvent<HTMLInputElement>,index:number,options:readonly string[]){
    if(openIndex!==index||!options.length)return;
    if(event.key==='ArrowDown'){event.preventDefault();setActive(value=>(value+1)%options.length);}
    else if(event.key==='ArrowUp'){event.preventDefault();setActive(value=>(value+options.length-1)%options.length);}
    else if(event.key==='Enter'){event.preventDefault();choose(index,options[active]??options[0]);}
    else if(event.key==='Escape'){event.preventDefault();setOpenIndex(null);}
  }
  async function save(members:string[]){
    setSaving(true);setError('');
    try{
      const response=await fetch('/api/manual-predictions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,members,version:initial?.version??0})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      onSaved(result as ManualPrediction);setEditing(false);
    }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}
    finally{setSaving(false);}
  }
  function submit(event:FormEvent){
    event.preventDefault();
    if(!selected[0]){setError('กรุณาเลือกเมมเบอร์ลำดับ 1 จากรายการแนะนำ');return;}
    if(queries.some((query,index)=>query.trim()&&query!==selected[index])){setError('กรุณากดเลือกชื่อจากรายการแนะนำ หรือเคลียร์ช่องที่ยังไม่เลือก');return;}
    void save(selected.filter((member):member is string=>member!==null));
  }
  const visibleCount=selected[1]?3:selected[0]?2:1;
  return <section className="manual-predictions" aria-label="ลำดับคนที่น่าจะโหวต">
    <div className="manual-heading"><div><h2 className="section-title">น่าจะโหวตใคร</h2></div>
      {!editing&&<button className="secondary" type="button" onClick={start}>{initial?.members.length?'แก้ไขลำดับ':'เพิ่มลำดับ'}</button>}
    </div>
    {!editing&&<>{initial?.members.length?<MemberAvatars names={initial.members} captions/>:<p className="muted small">ยังไม่ได้ตั้งลำดับเอง</p>}</>}
    {editing&&<form onSubmit={submit} className="manual-form">
      <div className="manual-fields">{Array.from({length:visibleCount},(_,index)=>{
        const options=choices(index),open=openIndex===index&&options.length>0;
        return <div className="manual-choice" key={index}><label htmlFor={'manual-member-'+index}>ลำดับ {index+1}</label>
          <input id={'manual-member-'+index} value={queries[index]} onChange={event=>change(index,event.target.value)} onFocus={()=>{setOpenIndex(index);setActive(0);}} onBlur={()=>setOpenIndex(null)} onKeyDown={event=>keyDown(event,index,options)} placeholder="พิมพ์แล้วเลือกชื่อเมมเบอร์" autoComplete="off" spellCheck={false} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={'manual-options-'+index} aria-activedescendant={open?'manual-option-'+index+'-'+active:undefined}/>
          {open&&<ul className="manual-suggestions" id={'manual-options-'+index} role="listbox">{options.map((name,i)=><li key={name} id={'manual-option-'+index+'-'+i} role="option" aria-selected={i===active} className={i===active?'active':undefined} onPointerDown={event=>{event.preventDefault();choose(index,name);}} onMouseEnter={()=>setActive(i)}>{name}</li>)}</ul>}
        </div>;
      })}</div>
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="manual-actions"><button className="primary" type="submit" disabled={saving}>{saving?'กำลังบันทึก…':'บันทึกลำดับ'}</button><button className="secondary" type="button" disabled={saving} onClick={()=>{setEditing(false);setError('');}}>ยกเลิก</button>{!!initial?.members.length&&<button className="text-button" type="button" disabled={saving} onClick={()=>void save([])}>ลบลำดับที่ตั้งเอง</button>}</div>
    </form>}
  </section>;
}
