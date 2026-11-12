import { createHmac, timingSafeEqual } from 'node:crypto';

export const accessCookie='site_access';
const pin=process.env.SITE_ACCESS_PIN??'2513';

function secret(){
  const value=process.env.SITE_ACCESS_SECRET??process.env.TURSO_AUTH_TOKEN;
  if(!value)throw new Error('Site access secret is not configured');
  return value;
}

export function accessToken(){return createHmac('sha256',secret()).update('site-access-v1').digest('hex');}
export function validPin(value:unknown){
  return typeof value==='string'&&/^[0-9]{4}$/.test(value)&&timingSafeEqual(Buffer.from(value),Buffer.from(pin));
}
export function validAccess(value:string|undefined){
  return Boolean(value&&/^[0-9a-f]{64}$/.test(value)&&timingSafeEqual(Buffer.from(value,'hex'),Buffer.from(accessToken(),'hex')));
}
