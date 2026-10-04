import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
// The admin page is enabled only when ADMIN_PASSWORD is set (12+ characters).
export const adminCookie='tp_admin';
const password=()=>process.env.ADMIN_PASSWORD||'';
export const adminEnabled=()=>password().length>=12;
const digest=(value:string)=>createHash('sha256').update(value).digest();
export function checkPassword(input:string){return adminEnabled()&&timingSafeEqual(digest(input),digest(password()));}
// The session cookie is derived from the password, so changing the password signs everyone out.
export function sessionToken(){return createHmac('sha256',password()).update('tokenpolice-admin-v1').digest('hex');}
export function isAdmin(token:string|undefined){return adminEnabled()&&!!token&&timingSafeEqual(digest(token),digest(sessionToken()));}
