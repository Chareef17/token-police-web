import type { Metadata } from 'next';
import PinForm from './pin-form';

export const metadata:Metadata={title:'ใส่ PIN'};

export default function Page(){return <PinForm/>;}
