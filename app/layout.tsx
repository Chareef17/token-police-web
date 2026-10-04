import type { Metadata } from 'next';
import { Kanit, Zen_Maru_Gothic } from 'next/font/google';
import './globals.css';
const kanit=Kanit({subsets:['thai','latin'],weight:['300','400','500','600','700','800'],variable:'--font-th',display:'swap'});
const zenMaru=Zen_Maru_Gothic({weight:['500','700'],variable:'--font-jp',display:'swap',preload:false});
export const metadata:Metadata={title:'TokenPolice — Wallet explorer',description:'ค้นหาประวัติโหวต BNK48 / CGM48 และยอดเหรียญในกระเป๋า',icons:{icon:'/icon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th" className={`${kanit.variable} ${zenMaru.variable}`}><body>{children}</body></html>;}
