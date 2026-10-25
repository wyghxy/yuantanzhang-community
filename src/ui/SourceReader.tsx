'use client';
import { useRef, useState } from 'react';
import type { Material, Note } from '../domain';
import { Icon, dateLabel } from './Icons';

export type ReaderProps = {
  material?: Material;
  notes: Note[];
  onAddNote: (quote: string, thought: string) => void;
  onDeleteNote: (id: string) => void;
  onInsertNote?: (note: Note) => void;
};
export function SourceReader({ material, notes, onAddNote, onDeleteNote, onInsertNote }: ReaderProps) {
  const [tab, setTab] = useState<'source' | 'notes'>('source');
  const [quote, setQuote] = useState('');
  const [thought, setThought] = useState('');
  const [showNote, setShowNote] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !bodyRef.current) return;
    if (bodyRef.current.contains(selection.anchorNode) && bodyRef.current.contains(selection.focusNode)) {
      const text = selection.toString().trim();
      if (text && text.length <= 100_000) { setQuote(text); setShowNote(true); }
    }
  }
  function addNote() {
    if (!quote.trim() && !thought.trim()) return;
    onAddNote(quote.trim(), thought.trim());
    setQuote(''); setThought(''); setShowNote(false); setTab('notes');
  }
  if (!material) return <div className="reader-empty"><Icon name="file" size={30}/><h3>在这里对照原文</h3><p>从素材库开始写作，或在上方选择参考素材。</p><span>左边写自己的观点，右边留下阅读线索。</span></div>;
  return <div className="source-reader">
    <div className="reader-tabs" role="tablist" aria-label="阅读参考"><button role="tab" aria-selected={tab === 'source'} className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}>原文</button><button role="tab" aria-selected={tab === 'notes'} className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>笔记 <span>{notes.length}</span></button><div className="reader-tab-spacer"/>{tab === 'source' && <button className="reader-add" onClick={() => { setQuote(''); setShowNote(true); }}><Icon name="plus" size={15}/>记笔记</button>}</div>
    {tab === 'source' ? <div className="reader-scroll" role="tabpanel" aria-label="素材原文">
      <div className="source-meta"><span>{material.platform || '手动导入'}</span><span>{dateLabel(material.createdAt)} 导入</span>{material.sourceUrl && <a href={material.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><Icon name="link" size={14}/>打开原文</a>}</div>
      <h2 className="source-title">{material.title}</h2>
      {!!material.tags.length && <div className="tags">{material.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      <div ref={bodyRef} className="source-body" onMouseUp={captureSelection} onKeyUp={captureSelection} tabIndex={0} aria-label="素材正文，选中文字可摘录笔记">{material.body}</div>
      <p className="source-end">— 原文结束 —</p>
    </div> : <div className="reader-scroll notes-scroll" role="tabpanel" aria-label="素材笔记">
      {notes.length ? notes.map((note) => <article className="note-card" key={note.id}>
        <div className="note-meta"><span><Icon name="quote" size={15}/>{note.quote ? '原文摘录' : '阅读笔记'}</span><span>{dateLabel(note.createdAt)}</span></div>
        {note.quote && <blockquote>{note.quote}</blockquote>}{note.thought && <p>{note.thought}</p>}
        <div className="note-actions">{onInsertNote && <button className="text-button" onClick={() => onInsertNote(note)}><Icon name="plus" size={15}/>粘贴到稿件</button>}<button className="text-button subdued" onClick={() => onDeleteNote(note.id)}><Icon name="trash" size={14}/>删除</button></div>
      </article>) : <div className="small-empty"><Icon name="quote" size={28}/><h3>留住阅读时的想法</h3><p>在原文中选中文字即可摘录，也可以直接记一条笔记。</p><button className="button" onClick={() => { setQuote(''); setShowNote(true); }}>写第一条笔记</button></div>}
    </div>}
    {showNote && <div className="note-composer"><div className="note-composer-title"><strong>{quote ? '保存摘录' : '写一条笔记'}</strong><button className="icon-button" aria-label="取消笔记" onClick={() => setShowNote(false)}><Icon name="close" size={16}/></button></div>{quote && <blockquote>{quote}</blockquote>}<textarea value={thought} maxLength={100_000} onChange={(event) => setThought(event.target.value)} placeholder="写下你的想法（可选）" aria-label="笔记内容"/><div className="note-composer-actions"><span>原文摘录请保留来源</span><button className="button primary small" disabled={!quote.trim() && !thought.trim()} onClick={addNote}>保存笔记</button></div></div>}
    <div className="reader-foot"><span><Icon name="quote" size={14}/>选中文字，摘录到笔记</span><span>{material.body.replace(/\s/g, '').length.toLocaleString()} 字</span></div>
  </div>;
}
