'use client';
import { useEffect, useState } from 'react';
type Theme='light'|'dark';
export default function ThemeToggle(){
  const [theme,setTheme]=useState<Theme|null>(null);
  useEffect(()=>{setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');},[]);
  function toggle(){
    const next:Theme=theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;setTheme(next);
    try{localStorage.setItem('theme',next);}catch{}
  }
  const dark=theme==='dark';
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด'} title={dark?'โหมดสว่าง':'โหมดมืด'}>
    {dark?<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>
      :<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.6A8.5 8.5 0 0 1 9.4 4a8.5 8.5 0 1 0 10.6 10.6z"/></svg>}
  </button>;
}
