import SiteHeader from '../site-header';

export default function Loading(){
  return <div className="shell"><SiteHeader/><main className="board current-board">
    <h1>ประมาณอันดับ GE6 ปัจจุบัน</h1>
    <div className="loading-panel" role="status"><span className="spinner" aria-hidden="true"/>กำลังคำนวณอันดับและยอด GE6 ในกระเป๋า…</div>
  </main></div>;
}
