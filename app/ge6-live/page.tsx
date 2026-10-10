import type { Metadata } from 'next';
import SiteHeader from '../site-header';
import Ge6LiveTable from '../ge6-live-table';
export const metadata:Metadata={title:'โหวต GE6 ล่าสุด — คุณนักสืบโตเฟ่อ'};
export default function Page(){return <div className="shell"><SiteHeader/><main><Ge6LiveTable/></main></div>;}
