'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { display } from '@/lib/amount.mjs';
type Transaction={id:string;event:string;member:string;amount:string;tx_hash:string|null;voted_at:string|null};
type Wallet={address:string;name:{name:string;version:number}|null;events:{event:string;total:string;members:{member:string;amount:string;transactions:number}[]}[];ge6:{amount:string;transactions:number;items:Transaction[]};transactions:{id:string;event:string;member:string;amount:string;tx_hash:string|null;voted_at:string|null}[];transactionCount:number;importedAt:string;ge6Status:{lastSuccess?:string;confirmedBlock?:number;phase?:string}|null};
type Suggestion={address:string;name:string};
type Balance={balances:{symbol:string;amount:string}[];fetchedAt:string};
const date=(value?:string|null)=>value?new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'ยังไม่มีข้อมูล';
function Icon({kind}:{kind:'search'|'shield'|'copy'|'external'|'wallet'}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='search'?<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>:kind==='shield'?<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>:kind==='copy'?<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>:kind==='external'?<><path d="M14 3h7v7m0-7L10 14"/><path d="M10 3H3v18h18v-7"/></>:<><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 8V5l14-3v4m4 6h-6v5h6"/></>}</svg>}
export default function Home(){
  const [input,setInput]=useState('');const [data,setData]=useState<Wallet|null>(null);const [balance,setBalance]=useState<Balance|null>(null);
  const [loading,setLoading]=useState(false);const [balanceLoading,setBalanceLoading]=useState(false);const [error,setError]=useState('');const [balanceError,setBalanceError]=useState('');
  const [editing,setEditing]=useState(false);const [name,setName]=useState('');const [saving,setSaving]=useState(false);const [notice,setNotice]=useState('');const [nameError,setNameError]=useState('');const [tab,setTab]=useState<'history'|'transactions'>('history');
  const serial=useRef(0);
  const [suggestions,setSuggestions]=useState<Suggestion[]>([]);const [open,setOpen]=useState(false);const [active,setActive]=useState(-1);const lookup=useRef(0);const inputRef=useRef<HTMLInputElement>(null);
  const isAddressInput=/^\s*0x/i.test(input);
  async function findNames(q:string){const r=await fetch('/api/names/search?q='+encodeURIComponent(q));const result=await r.json();if(!r.ok)throw new Error(result.error);return result.results as Suggestion[];}
  // Suggest community names while typing anything that is not an address.
  useEffect(()=>{
    const q=input.trim();const id=++lookup.current;
    if(!q||isAddressInput){setSuggestions([]);setActive(-1);return;}
    const timer=setTimeout(()=>{findNames(q).then(results=>{if(id===lookup.current){setSuggestions(results);setActive(-1);}}).catch(()=>{});},200);
    return ()=>clearTimeout(timer);
  },[input,isAddressInput]);
  function pick(s:Suggestion){lookup.current++;setOpen(false);setSuggestions([]);void search(s.address);}
  async function submit(){
    if(isAddressInput||!input.trim()){void search(input);return;}
    const q=input.trim();const id=++lookup.current;setOpen(false);
    try{
      const results=await findNames(q);
      if(id!==lookup.current)return;
      const exact=results.filter(s=>s.name.toLowerCase()===q.toLowerCase());
      if(exact.length===1||results.length===1){pick(exact[0]||results[0]);return;}
      if(!results.length){setError('ไม่พบชื่อนี้ ลองพิมพ์ชื่ออื่น หรือวาง address 0x...');return;}
      setSuggestions(results);setActive(-1);setError('มีหลายชื่อที่ตรงกัน กรุณาเลือกจากรายการ');inputRef.current?.focus();setOpen(true);
    }catch(e){setError(e instanceof Error?e.message:'ค้นหาชื่อไม่สำเร็จ');}
  }
  function onKeyDown(e:React.KeyboardEvent<HTMLInputElement>){
    if(!open||!suggestions.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>(i+1)%suggestions.length);}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i<=0?suggestions.length:i)-1);}
    else if(e.key==='Enter'&&active>=0){e.preventDefault();pick(suggestions[active]);}
    else if(e.key==='Escape'){setOpen(false);}
  }
  async function loadBalance(address:string,id:number){setBalanceLoading(true);setBalanceError('');try{const r=await fetch('/api/balances/'+address);const result=await r.json();if(!r.ok)throw new Error(result.error);if(serial.current===id)setBalance(result);}catch(e){if(serial.current===id)setBalanceError(e instanceof Error?e.message:'อ่านยอดเหรียญไม่ได้');}finally{if(serial.current===id)setBalanceLoading(false);}}
  async function search(value:string){
    const address=value.trim().toLowerCase();if(!/^0x[0-9a-f]{40}$/.test(address)){setError('กรุณากรอก address ที่ขึ้นต้นด้วย 0x ให้ครบ 42 ตัวอักษร');return;}
    const id=++serial.current;setInput(address);setLoading(true);setError('');setData(null);setBalance(null);setBalanceError('');setEditing(false);setNotice('');setTab('history');
    window.history.replaceState({},'',`/?address=${address}`);
    void loadBalance(address,id);
    try{const r=await fetch('/api/wallet/'+address);const result=await r.json();if(!r.ok)throw new Error(result.error);if(serial.current===id)setData(result);}catch(e){if(serial.current===id)setError(e instanceof Error?e.message:'ค้นหาไม่สำเร็จ');}finally{if(serial.current===id)setLoading(false);}
  }
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get('address');if(value)void search(value);},[]);
  async function saveName(event:FormEvent){event.preventDefault();if(!data)return;const id=serial.current;setSaving(true);setNameError('');try{const r=await fetch('/api/names',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:data.address,name,version:data.name?.version||0})});const result=await r.json();if(!r.ok)throw new Error(result.error);if(serial.current===id){setData({...data,name:result});setEditing(false);setNotice('บันทึกชื่อแล้ว ทุกคนจะเห็นชื่อนี้');}}catch(e){if(serial.current===id)setNameError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}finally{setSaving(false);}}
  const stale=!!data && (data.ge6Status?.phase==='error'||!data.ge6Status?.lastSuccess||Date.now()-Date.parse(data.ge6Status.lastSuccess)>20*60000);
  return <div className="shell">
    <header><a className="brand" href="/"><span className="sleeping-logo"><img src="/tofer-logo.webp" alt="ตุ๊กตาสลอธห่มผ้าห่มสีฟ้า" width="889" height="890" /></span><span className="brand-copy"><span className="brand-name">คุณนักสืบโตเฟ่อ</span></span></a><span className="supporter-label">FAN SUPPORT PROJECT</span></header>
    <main>
      <section className="support-banner" aria-label="ร่วมเชียร์ Nammonn BNK48 สู่เป้าหมายอันดับ 13 ใน GE2026"><div className="support-copy"><span className="support-kicker">NAMMONN BNK48 · GE2026</span><h1 className="jp-title">世界はどこまで青空なのか？</h1></div><div className="thirteen-mark" aria-hidden="true"><span>ROAD TO</span><strong>13</strong></div></section><section className="search-section">
        <div className="search-box"><form className="search-form" onSubmit={e=>{e.preventDefault();void submit();}}><span className="search-icon"><Icon kind="search"/></span><label className="sr-only" htmlFor="address">Wallet address หรือชื่อ</label><input ref={inputRef} id="address" className={input&&!isAddressInput?'is-name':undefined} value={input} onChange={e=>{setInput(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onKeyDown={onKeyDown} placeholder="วาง wallet address 0x... หรือพิมพ์ชื่อ" autoComplete="off" spellCheck={false} role="combobox" aria-expanded={open&&suggestions.length>0} aria-controls="name-suggestions" aria-autocomplete="list" aria-activedescendant={active>=0?'suggestion-'+active:undefined}/><button className="primary" disabled={loading} type="submit">{loading?'กำลังค้นหา…':'ค้นหา'}</button></form>
        {open&&suggestions.length>0&&<ul className="suggestions" id="name-suggestions" role="listbox">{suggestions.map((s,i)=><li key={s.address} id={'suggestion-'+i} role="option" aria-selected={i===active} className={i===active?'active':undefined} onMouseDown={e=>{e.preventDefault();pick(s);}} onMouseEnter={()=>setActive(i)}><span className="suggestion-name">{s.name}</span><span className="suggestion-address">{s.address.slice(0,8)}…{s.address.slice(-6)}</span></li>)}</ul>}</div>
        <div className="search-caption"><span>ข้อมูลจาก TokenX Scan</span></div>
        {error&&<p className="error" role="alert">{error}</p>}
      </section>
      {loading?<section className="loading-panel" role="status"><span className="spinner"/> กำลังค้นหาประวัติโหวต…</section>:data?<>
        <section className="wallet-heading"><div><div className="eyebrow">WALLET PROFILE</div><div className="name-row"><h2>{data.name?.name||'กระเป๋าที่ยังไม่มีชื่อ'}</h2><button className="text-button" onClick={()=>{setName(data.name?.name||'');setNameError('');setEditing(!editing);}}>{editing?'ยกเลิก':data.name?'แก้ไขชื่อ':'＋ ตั้งชื่อ'}</button></div><div className="address-row"><code>{data.address}</code><button aria-label="คัดลอก address" className="icon-button" onClick={async()=>{try{await navigator.clipboard.writeText(data.address);setNotice('คัดลอก address แล้ว');}catch{setNotice('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความ address');}}}><Icon kind="copy"/></button><a aria-label="ดู address บน TokenX Scan" className="icon-button" href={`https://scan.tokenx.finance/address/${data.address}`} target="_blank" rel="noreferrer"><Icon kind="external"/></a></div><p className="muted small">{data.name?'ชื่อที่ชุมชนตั้ง · ไม่ใช่การยืนยันเจ้าของกระเป๋า':null}</p></div><button className="secondary refresh" onClick={()=>void search(data.address)}>โหลดข้อมูลใหม่</button></section>
        {editing&&<form className="name-form" onSubmit={saveName}><label htmlFor="name">ชื่อ</label><div><input id="name" value={name} onChange={e=>setName(e.target.value)} maxLength={60} autoFocus placeholder="ตั้งชื่อให้กระเป๋านี้" required/><button className="primary" disabled={saving}>{saving?'กำลังบันทึก…':'บันทึกชื่อ'}</button></div><p className="muted small">ไม่เกิน 60 ตัวอักษร</p>{nameError&&<p className="error" role="alert">{nameError}</p>}</form>}
        <p className="notice" aria-live="polite">{notice}</p>
        <section className="ge6-section" aria-label="รายการโหวต GE6"><article className="stat featured"><div className="stat-top"><span>GE6 โหวตแล้ว</span></div><strong title={data.ge6.amount}>{display(data.ge6.amount)}</strong><div className="stat-bottom"><span>GE6 tokens</span><span>{data.ge6.transactions.toLocaleString()} รายการ</span></div></article>
          <div className="freshness"><p>ยอดโหวตอัปเดต {date(data.ge6Status?.lastSuccess)}{stale&&<span className="stale">ข้อมูลอาจล่าช้า</span>}</p></div>
          <h2 className="section-title">รายการโหวต GE6</h2><TransactionTable rows={data.ge6.items} ge6 />
          <p className="muted small table-caption">{data.ge6.items.length===data.ge6.transactions?`ทั้งหมด ${data.ge6.transactions.toLocaleString()} รายการ`:`${data.ge6.items.length.toLocaleString()} รายการล่าสุด · ทั้งหมด ${data.ge6.transactions.toLocaleString()} รายการ`}</p>
        
</section>
        <section className="balance-section" aria-label="ยอดเหรียญคงเหลือ"><h2 className="section-title">คงเหลือในกระเป๋า</h2><div className="stats balance-stats">{['BNK','GE6'].map(symbol=><article className="stat" key={symbol}><div className="stat-top"><span>{symbol} คงเหลือในกระเป๋า</span><Icon kind="wallet"/></div><strong className="balance-value">{balanceLoading?<span className="skeleton"/>:balance?display(balance.balances.find(r=>r.symbol===symbol)!.amount):'—'}</strong><div className="stat-bottom"><span>{symbol} tokens</span><span>{balanceLoading?'กำลังอ่านยอด…':balance?'ยอดคงเหลือ':'ยังอ่านยอดไม่ได้'}</span></div></article>)}</div>
          <div className="freshness"><p>ยอดเหรียญ {balance?date(balance.fetchedAt):'รอข้อมูลจาก TokenX Scan'}</p></div>
          {balanceError&&<div className="balance-error" role="status">{balanceError}<button className="text-button" onClick={()=>void loadBalance(data.address,serial.current)}>ลองอีกครั้ง</button></div>}
        </section>
        <section className="records"><h2 className="section-title">ประวัติการโหวตงานเก่า</h2><div className="tabs" role="tablist" aria-label="ข้อมูลโหวต"><button id="history-tab" role="tab" aria-selected={tab==='history'} aria-controls="records-panel" onClick={()=>setTab('history')}>ประวัติแต่ละงาน <span>{data.events.length}</span></button><button id="transactions-tab" role="tab" aria-selected={tab==='transactions'} aria-controls="records-panel" onClick={()=>setTab('transactions')}>รายการโหวต <span>{data.transactionCount.toLocaleString()}</span></button></div>
        <div id="records-panel" role="tabpanel" aria-labelledby={tab==='history'?'history-tab':'transactions-tab'}>{tab==='history'?<>{data.events.length===0?<div className="empty-records">ไม่พบประวัติโหวตงานก่อน ๆ ของ address นี้ในฐานข้อมูล</div>:data.events.map((event,i)=><article className="event" key={event.event}><div className="event-heading"><span className="event-number">{String(i+1).padStart(2,'0')}</span><div><h3>{event.event}</h3><p>{event.members.length} เมมเบอร์ / รายการที่ได้รับโหวต</p></div><div className="event-total"><strong>{display(event.total)}</strong><span>tokens รวม</span></div></div><div className="member-list">{event.members.map(m=><div className="member" key={m.member}><div className="member-avatar">{m.member.slice(0,1)}</div><span className="member-name">{m.member}</span><span className="tx-count">{m.transactions.toLocaleString()} รายการ</span><strong>{display(m.amount)} <small>tokens</small></strong></div>)}</div></article>)}</>:<><TransactionTable rows={data.transactions} /><p className="muted small table-caption">แสดง {data.transactions.length.toLocaleString()} รายการล่าสุด จากทั้งหมด {data.transactionCount.toLocaleString()} รายการ</p></>}</div></section>
      </>:<section className="welcome"><div className="welcome-mark"><Icon kind="wallet"/></div><h2>มาช่วยคุณนักสืบโตเฟ่อหาเหรียญ</h2><p>ดูว่าเคยโหวตให้ใครในงานก่อน ๆ<br/>ใช้ GE6 ไปเท่าไหร่ และเหลือเหรียญอีกเท่าไหร่</p><div className="welcome-labels"><span>ประวัติโหวต</span><span>ยอดคงเหลือ</span></div></section>}
    </main><footer><div className="powered-by"><span>Powered by</span><img src="/powered-by.png" alt="โลโก้ผู้สนับสนุน" width="112" height="112" /></div></footer>
  </div>;
}

function TransactionTable({rows,ge6=false}:{rows:Transaction[];ge6?:boolean}) {
  if(!rows.length)return <div className="empty-records">{ge6?'ยังไม่พบรายการโหวต GE6 ของ address นี้':'ไม่พบรายการโหวตงานเก่าของ address นี้'}</div>;
  return <div className={ge6?'table-wrap ge6-table':'table-wrap'} tabIndex={0} aria-label={ge6?'ตารางรายการโหวต GE6':'ตารางรายการโหวตงานเก่า'}><table><thead><tr><th>วัน / เวลา</th>{!ge6&&<th>งาน</th>}{!ge6&&<th>ผู้รับโหวต</th>}<th className="numeric">Tokens</th><th>ธุรกรรม</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td>{date(t.voted_at)}</td>{!ge6&&<td>{t.event}</td>}<>{!ge6&&<td>{t.member}</td>}</><td className="numeric">{display(t.amount)}</td><td>{t.tx_hash&&/^0x[0-9a-f]{64}$/i.test(t.tx_hash)?<a href={`https://scan.tokenx.finance/tx/${t.tx_hash}`} target="_blank" rel="noreferrer">{t.tx_hash.slice(0,8)}…</a>:'—'}</td></tr>)}</tbody></table></div>;
}
