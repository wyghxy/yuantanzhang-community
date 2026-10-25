import type { CSSProperties } from 'react';

export type IconName = 'library' | 'write' | 'plus' | 'search' | 'arrow' | 'close' | 'sun' | 'moon' | 'download' | 'upload' | 'file' | 'link' | 'trash' | 'check' | 'menu' | 'quote' | 'chevron' | 'undo' | 'folder';
const paths: Record<IconName, React.ReactNode> = {
  library: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 15h7M14 19h7"/></>,
  write: <><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z"/><path d="M13 20h8"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  arrow: <path d="M19 12H5m6-6-6 6 6 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  moon: <path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z"/>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></>, upload: <><path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/></>,
  file: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8M8 17h6"/></>, link: <><path d="m10 13 4-4m-6 6-2 2a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0m2 2 2-2a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0" transform="translate(1 1)"/></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>, check: <path d="m5 12 4 4L19 6"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>, quote: <><path d="M4 5h7v7H7c0 4-3 6-3 6m10-13h7v7h-4c0 4-3 6-3 6"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>, undo: <><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v4"/></>,
  folder: <path d="M3 6h7l2 3h9v12H3zM3 6V3h7l2 3h7v3"/>,
};
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}

export function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value));
}
