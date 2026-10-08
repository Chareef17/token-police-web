'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './theme-toggle';
import RefreshButton from './refresh-button';
const links=[{href:'/',label:'Main Page',icon:'⌂'},{href:'/ge6-current',label:'คาดการณ์คะแนน',icon:'◉'},{href:'/ge6-voters',label:'Top Voter',icon:'♜'},{href:'/nammonn',label:'สายเปย์น้ำมนต์',icon:'▤'},{href:'/ge6-holders',label:'ผู้ถือ GE6',icon:'◇'}];
export default function SiteHeader(){
  const pathname=usePathname();
  return <header className="site-header">
    <Link className="brand" href="/" aria-label="หน้าหลัก"><span className="sleeping-logo"><img src="/tofer-logo.webp" alt="" width="889" height="890" /></span><span className="brand-copy brand-name">คุณนักสืบโตเฟ่อ</span></Link>
    <nav className="header-nav" aria-label="เมนูหลัก">{links.map(l=><Link key={l.href} href={l.href} prefetch={false} className={pathname===l.href?'active':undefined} aria-current={pathname===l.href?'page':undefined}><span className="nav-icon" aria-hidden="true">{l.icon}</span><span>{l.label}</span></Link>)}</nav>
    <div className="header-right"><RefreshButton/><ThemeToggle/></div>
  </header>;
}
