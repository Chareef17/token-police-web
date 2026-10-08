'use client';

import { useState } from 'react';

export default function AddressCopy({address,href,full=false}:{address:string;href?:string;full?:boolean}){
  const [copied,setCopied]=useState(false);
  const label=full?address:`${address.slice(0,8)}…${address.slice(-6)}`;
  async function copy(event:React.MouseEvent<HTMLButtonElement>){
    event.preventDefault();event.stopPropagation();
    try{await navigator.clipboard.writeText(address);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}
  }
  return <span className="address-copy">
    {href?<a href={href} className="address-copy-link" title={address}><code>{label}</code></a>:<code title={address}>{label}</code>}
    <button type="button" className="address-copy-button" onClick={copy} onPointerDown={event=>{event.stopPropagation();event.preventDefault();}} aria-label={copied?'คัดลอก address แล้ว':'คัดลอก address'} title={copied?'คัดลอกแล้ว':'คัดลอก address'}>
      {copied?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg>}
    </button>
  </span>;
}
