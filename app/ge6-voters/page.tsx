import type { Metadata } from 'next';
import SiteHeader from '../site-header';
import Ge6VotersTable from '../ge6-voters-table';
export const metadata:Metadata={title:'อันดับผู้โหวต GE6 — คุณนักสืบโตเฟ่อ'};
export default function Page(){return <div className="shell"><SiteHeader/><main><Ge6VotersTable/></main></div>;}
