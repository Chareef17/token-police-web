'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminCookie, checkPassword, sessionToken } from '@/lib/admin';
export async function login(form:FormData){
  const password=String(form.get('password')||'');
  if(!checkPassword(password)){
    // Slow down repeated guesses.
    await new Promise(resolve=>setTimeout(resolve,1500));
    redirect('/admin?error=1');
  }
  (await cookies()).set(adminCookie,sessionToken(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:60*60*24*30});
  redirect('/admin');
}
export async function logout(){
  (await cookies()).delete(adminCookie);
  redirect('/admin');
}
