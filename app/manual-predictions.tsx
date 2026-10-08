'use client';
import { FormEvent,useState } from 'react';
import { ge6CandidateByName,ge6CandidateNames } from '@/lib/ge6-candidates';
export type ManualPrediction={members:string[];version:number;updated_at:string};
export default function ManualPredictions({address,initial,onSaved}:{address:string;initial:ManualPrediction|null;onSaved:(value:ManualPrediction)=>void}){
  const [editing,setEditing]=useState(false);
  const [values,setValues]=useState(['','','']);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  function start(){setValues([initial?.members[0]??'',initial?.members[1]??'',initial?.members[2]??'']);setError('');setEditing(true);}
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
    const members=values.map(value=>ge6CandidateByName.get(value.trim().toLowerCase()));
    if(members.some(value=>!value)){setError('กรุณาเลือกชื่อจากรายชื่อผู้สมัคร GE6 ให้ครบทั้ง 3 ลำดับ');return;}
    if(new Set(members).size!==3){setError('กรุณาเลือกเมมเบอร์ไม่ซ้ำกัน');return;}
    void save(members as string[]);
  }
  return <section className="manual-predictions" aria-label="ลำดับคนที่น่าจะโหวต">
    <div className="manual-heading"><div><h2 className="section-title">น่าจะโหวตใคร</h2><p className="muted small">ลำดับที่ตั้งเองจะแสดงแทนผลคาดการณ์จากประวัติในตาราง</p></div>
      {!editing&&<button className="secondary" type="button" onClick={start}>{initial?.members.length===3?'แก้ไขลำดับ':'เพิ่มลำดับ'}</button>}
    </div>
    {!editing&&<>{initial?.members.length===3?<ol className="manual-list">{initial.members.map(member=><li key={member}>{member}</li>)}</ol>:<p className="muted small">ยังไม่ได้ตั้งลำดับเอง</p>}</>}
    {editing&&<form onSubmit={submit} className="manual-form">
      <datalist id="ge6-candidate-suggestions">{ge6CandidateNames.map(candidate=><option key={candidate} value={candidate}/>)}</datalist>
      <div className="manual-fields">{values.map((value,index)=><label key={index}>ลำดับ {index+1}<input list="ge6-candidate-suggestions" value={value} onChange={event=>setValues(current=>current.map((v,i)=>i===index?event.target.value:v))} placeholder="พิมพ์ชื่อเมมเบอร์" autoComplete="off" required/></label>)}</div>
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="manual-actions"><button className="primary" type="submit" disabled={saving}>{saving?'กำลังบันทึก…':'บันทึกลำดับ'}</button><button className="secondary" type="button" disabled={saving} onClick={()=>{setEditing(false);setError('');}}>ยกเลิก</button>{initial?.members.length===3&&<button className="text-button" type="button" disabled={saving} onClick={()=>void save([])}>ลบลำดับที่ตั้งเอง</button>}</div>
    </form>}
  </section>;
}
