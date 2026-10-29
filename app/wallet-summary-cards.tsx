import AddressCopy from './address-copy';
import MemberAvatars from './member-avatars';
import { displayShort } from '@/lib/amount.mjs';

export type WalletSummaryRow={rank:number;address:string;name:string|null;voted:string;postVoted:string;ge6:string|null;bnk:string|null;likely:string[];topVote:string|null;lastTxAt:string|null};
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}):'—';

export default function WalletSummaryCards({rows}:{rows:WalletSummaryRow[]}){
  return <div className="wallet-summary-cards">{rows.map(row=>{const href='/?address='+row.address;return <article className="wallet-summary-card" key={row.address}>
    <div className="wallet-summary-card-head">
      <a href={href} className="wallet-summary-rank">{row.rank}</a>
      <div className="wallet-summary-identity">{row.name&&<a href={href}><strong>{row.name}</strong></a>}<AddressCopy address={row.address} href={href}/></div>
      {row.likely.length>0&&<div className="wallet-summary-likely" aria-label="น่าจะโหวตใคร"><MemberAvatars names={row.likely.slice(0,3)}/></div>}
    </div>
    <div className="wallet-summary-primary"><div><span>GE6 โหวตแล้ว</span><strong>{displayShort(row.voted)}</strong></div><div><span>หลังด่วนแรก</span><strong>{displayShort(row.postVoted)}</strong></div></div>
    <div className="wallet-summary-detail"><span>GE6 ถืออยู่</span><strong>{row.ge6===null?'—':displayShort(row.ge6)}</strong></div>
    <div className="wallet-summary-detail"><span>BNK ถืออยู่</span><strong>{row.bnk===null?'—':displayShort(row.bnk)}</strong></div>
    <div className="wallet-summary-detail"><span>เคยโหวตมากสุด</span><strong>{row.topVote??'—'}</strong></div>
    <div className="wallet-summary-detail"><span>ล่าสุด</span><strong>{date(row.lastTxAt)}</strong></div>
  </article>;})}</div>;
}
