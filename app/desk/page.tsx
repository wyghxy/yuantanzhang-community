import type { Metadata } from 'next';
import Desk from '../../src/ui/Desk';

export const metadata: Metadata = { title: '个人工作台 · 元探长' };
export default function DeskPage() { return <Desk/>; }
