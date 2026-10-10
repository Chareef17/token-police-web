'use client';
import { useState } from 'react';
import { displayShort } from '@/lib/amount.mjs';
import { ge6CandidateNames } from '@/lib/ge6-candidates';
import preliminary from '@/lib/ge6-prelim-2026-10-03.json';

const publishedMembers=new Set(preliminary.results.map(([name])=>name));

export type AssignableVote={txHash:string;logIndex:number;amount:string;address:string;name:string|null;assignedMember:string|null;assignmentVersion:number;inPreliminary:boolean};

export default function Ge6AssignmentDialog({vote,onClose,onSaved}:{vote:AssignableVote;onClose:()=>void;onSaved:(member:string|null,version:number)=>void}){
  const [selectedMember,setSelectedMember]=useState(vote.assignedMember??'');
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  async function save(member:string|null){
    setSaving(true);setSaveError('');
    try{
      const response=await fetch('/api/ge6-vote-assignment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txHash:vote.txHash,logIndex:vote.logIndex,member,version:vote.assignmentVersion})});
      const result=await response.json() as {error?:string;member?:string|null;version?:number};
      if(!response.ok)throw new Error(result.error??'บันทึกไม่สำเร็จ');
      onSaved(result.member??null,result.version??vote.assignmentVersion+1);
      onClose();
    }catch(error){setSaveError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}
    finally{setSaving(false);}
  }
  return <div className="live-assignment-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onClose();}}><div className="live-assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><h2 id="assignment-title">ระบุผู้รับโหวต</h2><div className="live-assignment-summary"><strong>{displayShort(vote.amount)} GE6</strong><span>{vote.name??'ไม่มีชื่อกระเป๋า'}</span><code>{vote.address}</code><small>Tx {vote.txHash.slice(0,10)}…{vote.txHash.slice(-8)}</small></div>{vote.inPreliminary&&selectedMember&&<p className="live-assignment-note">{publishedMembers.has(selectedMember)?'คะแนนผลด่วนของเมมเบอร์นี้ประกาศแล้ว จึงไม่บวกซ้ำ':'คะแนนผลด่วนยังไม่เปิดเผย จะย้ายยอดนี้จากส่วนที่ยังไม่รู้ผู้รับ'}</p>}<label htmlFor="assignment-member">เมมเบอร์</label><select id="assignment-member" value={selectedMember} onChange={event=>setSelectedMember(event.target.value)}><option value="" disabled>เลือกเมมเบอร์</option>{ge6CandidateNames.map(name=><option key={name} value={name}>{name}</option>)}</select>{saveError&&<p className="error" role="alert">{saveError}</p>}<div className="live-assignment-actions">{vote.assignedMember&&<button type="button" className="secondary" disabled={saving} onClick={()=>void save(null)}>Clear</button>}<button type="button" className="secondary" disabled={saving} onClick={onClose}>ยกเลิก</button><button type="button" disabled={saving||!selectedMember} onClick={()=>void save(selectedMember)}>{saving?'กำลังบันทึก…':'บันทึก'}</button></div></div></div>;
}
