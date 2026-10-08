'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './theme-toggle';
import RefreshButton from './refresh-button';
const iconPaths={
  home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/></>,
  forecast:<><path d="M4 20h16M5 16l5-5 4 3 5-7"/><path d="M16 7h3v3"/></>,
  trophy:<><path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4M12 14v5m-4 2h8m-8-2h8"/></>,
  heart:<><path d="M20.5 8.6c0 4.4-8.5 10.2-8.5 10.2S3.5 13 3.5 8.6a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2Z"/><path d="m12 9 .5 1.5L14 11l-1.5.5L12 13l-.5-1.5L10 11l1.5-.5L12 9Z"/></>,
  wallet:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-6 6h3"/></>,
};
type IconName=keyof typeof iconPaths;
const links:{href:string;label:string;icon:IconName}[]=[{href:'/',label:'Main Page',icon:'home'},{href:'/ge6-current',label:'คาดการณ์คะแนน',icon:'forecast'},{href:'/ge6-voters',label:'Top Voter',icon:'trophy'},{href:'/nammonn',label:'สายเปย์น้ำมนต์',icon:'heart'},{href:'/ge6-holders',label:'ผู้ถือ GE6',icon:'wallet'}];
function NavIcon({name}:{name:IconName}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">{iconPaths[name]}</svg>}
export default function SiteHeader(){
  const pathname=usePathname();
  return <header className="site-header">
    <Link className="brand" href="/" aria-label="หน้าหลัก"><span className="sleeping-logo"><img src="/tofer-logo.webp" alt="" width="889" height="890" /></span><span className="brand-copy brand-name">คุณนักสืบโตเฟ่อ</span></Link>
    <nav className="header-nav" aria-label="เมนูหลัก">{links.map(l=><Link key={l.href} href={l.href} prefetch={false} className={pathname===l.href?'active':undefined} aria-current={pathname===l.href?'page':undefined}><span className="nav-icon" aria-hidden="true"><NavIcon name={l.icon}/></span><span>{l.label}</span></Link>)}</nav>
    <div className="header-right"><RefreshButton/><ThemeToggle/></div>
  </header>;
}
