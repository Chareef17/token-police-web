'use client';
import { useEffect, useRef, useState } from 'react';
import ThemeToggle from './theme-toggle';
const links=[{href:'/ge6-current',title:'ประมาณอันดับ GE6 ปัจจุบัน',detail:'ผลด่วน 3 ต.ค. รวมกับโหวตหลังจากนั้น'},{href:'/ge6-voters',title:'อันดับผู้โหวต GE6',detail:'ยอดโหวตสะสม ยอดเหรียญ และ BNK เคลื่อนไหวล่าสุด'},{href:'/nammonn',title:'สายเปย์น้ำมนต์',detail:'กระเป๋าที่โหวตน้ำมนต์มากที่สุดใน GE5 / Thai-Japan'},{href:'/ge6-holders',title:'ผู้ถือ GE6 สูงสุด',detail:'20 อันดับกระเป๋าที่ถือเหรียญ GE6 มากที่สุด'}];
export default function SiteHeader(){
  const [open,setOpen]=useState(false);const box=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const close=(e:MouseEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('mousedown',close);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',escape);};
  },[open]);
  return <header><div className="brand" ref={box}>
    <button type="button" className="sleeping-logo logo-button" onClick={()=>setOpen(v=>!v)} aria-haspopup="menu" aria-expanded={open} aria-label="เปิดเมนู"><img src="/tofer-logo.webp" alt="" width="889" height="890" /></button>
    <a className="brand-copy" href="/"><span className="brand-name">คุณนักสืบโตเฟ่อ</span></a>
    {open&&<nav className="site-menu" role="menu">{links.map(l=><a key={l.href} href={l.href} role="menuitem"><strong>{l.title}</strong><span>{l.detail}</span></a>)}</nav>}
  </div><div className="header-right"><span className="supporter-label">FAN SUPPORT PROJECT</span><ThemeToggle/></div></header>;
}
