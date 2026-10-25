import type { Metadata } from 'next';
import './globals.css';
const themeBootstrap = `(() => { try { const saved = localStorage.getItem('community-desk-theme'); const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; } catch {} })();`;
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yuantanzhang.cn'),
  icons: { icon: '/icon.svg' },
  title: '元探长 · 个人社区版 | 本地优先的创作工作台',
  description: '源码公开、本地优先的个人创作工作台：整理素材、摘录笔记、手动写作与备份。无需账号；当前版本不内置自动采集或模型密钥，个人自用与本人账号内容变现免费。',
  applicationName: '元探长个人社区版',
  keywords: ['元探长', '本地优先', '创作工作台', '写作', '笔记', '个人知识管理', 'source available'],
  openGraph: {
    type: 'website',
    title: '元探长 · 个人社区版',
    description: '本地优先、源码公开的个人创作工作台。资料在旁，写作在前，数据留在自己的浏览器里。',
    images: [{ url: '/showcase/workbench.png', width: 1440, height: 900, alt: '元探长个人工作台' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '元探长 · 个人社区版',
    description: '本地优先、源码公开的个人创作工作台。',
    images: ['/showcase/workbench.png'],
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }}/></head><body>{children}</body></html>;
}
