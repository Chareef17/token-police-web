import SiteHeader from '@/app/site-header';

export default function Loading(){return <div className="shell"><SiteHeader/><main className="board"><div className="loading-panel" role="status"><span className="spinner" aria-hidden="true"/>กำลังคำนวณข้อมูลเมมเบอร์…</div></main></div>;}
