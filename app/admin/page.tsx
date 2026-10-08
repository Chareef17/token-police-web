import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { adminCookie, adminEnabled, isAdmin } from '@/lib/admin';
import { findWalletCodes, searchLog } from '@/lib/db';
import { login, logout } from './actions';
import AddressCopy from '../address-copy';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Admin — ประวัติการค้นหา',robots:{index:false,follow:false}};
const date=(value:string)=>new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'});
export default async function Admin({searchParams}:{searchParams:Promise<{error?:string;code?:string}>}){
  if(!adminEnabled())return <div className="shell admin"><section className="admin-login"><h1>ยังไม่ได้เปิดใช้หน้านี้</h1><p className="muted">ตั้งค่า <code>ADMIN_PASSWORD</code> (อย่างน้อย 12 ตัวอักษร) ใน Environment Variables ก่อน</p></section></div>;
  if(!isAdmin((await cookies()).get(adminCookie)?.value)){
    const {error}=await searchParams;
    return <div className="shell admin"><form className="admin-login" action={login}>
      <h1>เข้าสู่ระบบผู้ดูแล</h1>
      <label htmlFor="password">รหัสผ่าน</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus/>
      {error&&<p className="error" role="alert">รหัสผ่านไม่ถูกต้อง</p>}
      <button className="primary" type="submit">เข้าสู่ระบบ</button>
    </form></div>;
  }
  const code=((await searchParams).code??'').replace(/\D/g,'').slice(0,10);
  const [{entries,addresses,searches},codeMatches]=await Promise.all([searchLog(),findWalletCodes(code)]);
  return <div className="shell admin">
    <div className="admin-head"><div><h1>ประวัติการค้นหา</h1><p className="muted">มีการค้นหา {addresses.toLocaleString()} address รวม {searches.toLocaleString()} ครั้ง · ไม่นับการค้นหาของคุณเอง</p></div><form action={logout}><button className="secondary" type="submit">ออกจากระบบ</button></form></div>
    <section className="wallet-code-search">
      <h2>ค้นหาจาก Wallet code</h2>
      <form method="get" action="/admin">
        <input name="code" defaultValue={code} inputMode="numeric" pattern="\d{4,10}" placeholder="เช่น 2000021460" aria-label="Wallet code" required/>
        <button className="primary" type="submit">ค้นหา</button>
      </form>
      {code&&(codeMatches.length?<ul className="wallet-code-results">{codeMatches.map(m=><li key={m.code}>
        <code>{m.code}</code>{m.name&&<strong>{m.name}</strong>}<AddressCopy address={m.address} href={'/?address='+m.address} full/>
      </li>)}</ul>:<p className="muted small">{code.length<4?'พิมพ์อย่างน้อย 4 หลัก':'ไม่พบ wallet code นี้ในไฟล์โหวตเก่า'}</p>)}
    </section>
    {entries.length?<div className="table-wrap responsive-card-table admin-cards"><table>
      <thead><tr><th>ชื่อ</th><th>Address</th><th>จำนวนครั้ง</th><th>ค้นหาล่าสุด</th><th>ค้นหาครั้งแรก</th></tr></thead>
      <tbody>{entries.map(e=><tr key={e.address}>
        <td className="admin-card-name">{e.name??<span className="muted">—</span>}</td>
        <td data-label="Address"><AddressCopy address={e.address} href={'/?address='+e.address} full/></td>
        <td data-label="จำนวนครั้ง">{e.count.toLocaleString()}</td><td data-label="ค้นหาล่าสุด">{date(e.last_at)}</td><td data-label="ค้นหาครั้งแรก">{date(e.first_at)}</td>
      </tr>)}</tbody>
    </table></div>:<p className="muted">ยังไม่มีใครค้นหา</p>}
    {addresses>entries.length&&<p className="muted small">แสดง {entries.length} address ที่ค้นหาล่าสุด</p>}
  </div>;
}
