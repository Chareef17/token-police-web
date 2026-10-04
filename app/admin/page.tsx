import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { adminCookie, adminEnabled, isAdmin } from '@/lib/admin';
import { searchLog } from '@/lib/db';
import { login, logout } from './actions';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Admin — ประวัติการค้นหา',robots:{index:false,follow:false}};
const date=(value:string)=>new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'});
export default async function Admin({searchParams}:{searchParams:Promise<{error?:string}>}){
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
  const {entries,addresses,searches}=await searchLog();
  return <div className="shell admin">
    <div className="admin-head"><div><h1>ประวัติการค้นหา</h1><p className="muted">มีการค้นหา {addresses.toLocaleString()} address รวม {searches.toLocaleString()} ครั้ง · ไม่นับการค้นหาของคุณเอง</p></div><form action={logout}><button className="secondary" type="submit">ออกจากระบบ</button></form></div>
    {entries.length?<div className="table-wrap"><table>
      <thead><tr><th>ชื่อ</th><th>Address</th><th>จำนวนครั้ง</th><th>ค้นหาล่าสุด</th><th>ค้นหาครั้งแรก</th></tr></thead>
      <tbody>{entries.map(e=><tr key={e.address}>
        <td>{e.name??<span className="muted">—</span>}</td>
        <td><a className="admin-address" href={'/?address='+e.address} target="_blank" rel="noreferrer">{e.address}</a></td>
        <td>{e.count.toLocaleString()}</td><td>{date(e.last_at)}</td><td>{date(e.first_at)}</td>
      </tr>)}</tbody>
    </table></div>:<p className="muted">ยังไม่มีใครค้นหา</p>}
    {addresses>entries.length&&<p className="muted small">แสดง {entries.length} address ที่ค้นหาล่าสุด</p>}
  </div>;
}
