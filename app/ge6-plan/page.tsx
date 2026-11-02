import type { Metadata } from 'next';
import SiteHeader from '../site-header';
import PlanClient from './plan-client';

export const metadata: Metadata = { title: 'Planner — คุณนักสืบโตเฟ่อ' };

export default function Page() {
  return <div className="shell"><SiteHeader/><main className="board"><PlanClient/></main></div>;
}
