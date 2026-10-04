import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Script from 'next/script';
import { Kanit, Zen_Maru_Gothic } from 'next/font/google';
import './globals.css';
const kanit=Kanit({subsets:['thai','latin'],weight:['300','400','500','600','700','800'],variable:'--font-th',display:'swap'});
const zenMaru=Zen_Maru_Gothic({weight:['500','700'],variable:'--font-jp',display:'swap',preload:false});
export const metadata:Metadata={title:'TokenPolice — Wallet explorer',description:'ค้นหาประวัติโหวต BNK48 / CGM48 และยอดเหรียญในกระเป๋า',icons:{icon:'/icon.svg'}};
// Applied before first paint when the server had no theme cookie: the saved choice, otherwise the device setting.
const themeScript=`(function(){var d=document.documentElement;if(d.dataset.theme)return;try{var t=localStorage.getItem('theme');}catch(e){}d.dataset.theme=t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');})();`;
export default async function RootLayout({children}:{children:React.ReactNode}){
  const saved=(await cookies()).get('theme')?.value;
  const theme=saved==='dark'||saved==='light'?saved:undefined;
  return <html lang="th" className={`${kanit.variable} ${zenMaru.variable}`} data-theme={theme} suppressHydrationWarning><head><Script id="theme" strategy="beforeInteractive">{themeScript}</Script></head><body>{children}</body></html>;
}
