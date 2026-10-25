'use client';
import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import type { Draft, Material, Note, RichNode } from '../domain';
import { richTextToMarkdown } from '../transfer';
import { Icon, downloadText } from './Icons';
import { SourceReader } from './SourceReader';
import { normalizeEditorDocument } from './editor-normalize';

type Props = {
  drafts: Draft[]; draft?: Draft; materials: Material[]; notes: Note[];
  saveStatus: 'saved' | 'dirty' | 'saving' | 'error';
  onSelect: (id: string) => void; onNew: () => void; onDelete: (draft: Draft) => void;
  onChange: (id: string, update: Partial<Pick<Draft, 'title' | 'content' | 'materialId'>>) => void;
  onSave: () => void; onAddNote: (materialId: string, quote: string, thought: string) => void;
  onDeleteNote: (id: string) => void; onError: (message: string) => void;
};
const saveLabels = { saved: '已保存到本机', dirty: '有未保存修改', saving: '正在保存…', error: '保存失败，请重试' };
function characterCount(node: RichNode): number { return (node.text || '').replace(/\s/g, '').length + (node.content || []).reduce((sum, child) => sum + characterCount(child), 0); }
export function Writer(props: Props) {
  const [mobilePane, setMobilePane] = useState<'write' | 'reference'>('write');
  const [insertRequest, setInsertRequest] = useState<{ token: string; text: string } | null>(null);
  const active = props.draft;
  const source = props.materials.find((item) => item.id === active?.materialId);
  function exportDraft() {
    if (!active) return;
    try {
      const title = active.title.trim() || '未命名稿件';
      const escapedTitle = title.replace(/[\\`*_{}\[\]()#+.!|~<>=-]/g, '\\$&');
      downloadText(`${title}.md`, `# ${escapedTitle}\n\n${richTextToMarkdown(active.content)}\n`, 'text/markdown;charset=utf-8');
    } catch (cause) { props.onError(cause instanceof Error ? cause.message : '稿件导出失败。'); }
  }
  return <div className={`writer-area mobile-${mobilePane}`}>
    <div className="writer-switchbar"><label className="draft-picker"><Icon name="file" size={17}/><select aria-label="切换稿件" value={active?.id || ''} onChange={(event) => props.onSelect(event.target.value)}>{!active && <option value="">选择一篇稿件</option>}{[...props.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((draft) => <option key={draft.id} value={draft.id}>{draft.title || '未命名稿件'}</option>)}</select><span>{props.drafts.length} 篇</span></label><div className="actions"><button className="text-button" onClick={props.onNew}><Icon name="plus" size={16}/>新建空稿</button>{active && <><button className="icon-button" title="导出 Markdown" aria-label="导出稿件 Markdown" onClick={exportDraft}><Icon name="download" size={18}/></button><button className="icon-button" title="删除稿件" aria-label="删除当前稿件" onClick={() => props.onDelete(active)}><Icon name="trash" size={18}/></button></>}</div></div>
    <div className="mobile-writer-tabs" role="tablist" aria-label="写作视图"><button className={mobilePane === 'write' ? 'active' : ''} role="tab" aria-selected={mobilePane === 'write'} onClick={() => setMobilePane('write')}>编辑器</button><button className={mobilePane === 'reference' ? 'active' : ''} role="tab" aria-selected={mobilePane === 'reference'} onClick={() => setMobilePane('reference')}>原文与笔记</button></div>
    {active ? <div className="writer-columns"><section className="editor-pane" aria-label="手动写作编辑器"><div className="pane-heading"><span><Icon name="write" size={17}/>编辑器</span><span className="muted">写下自己的表达</span></div><DraftEditor key={active.id} draft={active} onChange={(update) => props.onChange(active.id, update)} insertRequest={insertRequest} onInserted={() => setInsertRequest(null)} onSave={props.onSave}/><div className="editor-foot"><span className={`save-indicator ${props.saveStatus}`}><i/>{saveLabels[props.saveStatus]}</span><span className="word-count">{characterCount(active.content).toLocaleString()} 字</span><button className="button primary small" disabled={props.saveStatus === 'saving'} onClick={props.onSave}><Icon name="check" size={15}/>{props.saveStatus === 'saving' ? '保存中…' : '保存稿件'}</button></div></section><section className="reference-pane" aria-label="原文与笔记参考"><div className="pane-heading"><span><Icon name="file" size={17}/>参考素材</span><select aria-label="选择参考素材" value={active.materialId || ''} onChange={(event) => props.onChange(active.id, { materialId: event.target.value || null })}><option value="">选择素材</option>{props.materials.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div><SourceReader key={source?.id || 'empty'} material={source} notes={props.notes.filter((note) => note.materialId === source?.id)} onAddNote={(quote, thought) => { if (source) props.onAddNote(source.id, quote, thought); }} onDeleteNote={props.onDeleteNote} onInsertNote={(note) => { setInsertRequest({ token: crypto.randomUUID(), text: [note.quote ? `摘录：${note.quote}` : '', note.thought].filter(Boolean).join('\n\n') }); setMobilePane('write'); }}/></section></div> : <div className="writer-empty"><div className="empty-illustration"><Icon name="write" size={38}/></div><span className="eyebrow">给自己的想法留一页纸</span><h2>从第一句话开始</h2><p>新建一篇空稿，或在素材库中找到写作的起点。<br/>原文放在右边，观点由你来写。</p><button className="button primary" onClick={props.onNew}><Icon name="plus" size={18}/>新建空稿</button></div>}
  </div>;
}

function DraftEditor({ draft, onChange, insertRequest, onInserted, onSave }: { draft: Draft; onChange: (update: Partial<Pick<Draft, 'title' | 'content'>>) => void; insertRequest: { token: string; text: string } | null; onInserted: () => void; onSave: () => void }) {
  const handlers = useRef({ onChange, onSave, onInserted });
  handlers.current = { onChange, onSave, onInserted };
  const lastInserted = useRef<string | null>(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Highlight.configure({ multicolor: true }), TextStyle, Color],
    content: draft.content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'writing-document', 'aria-label': '稿件正文', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'false' },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); handlers.current.onSave(); return true; }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => handlers.current.onChange({ content: normalizeEditorDocument(current.getJSON() as RichNode) }),
    onCreate: ({ editor: current }) => {
      if (insertRequest && lastInserted.current !== insertRequest.token) insert(current, insertRequest);
    },
  }, [draft.id]);
  function insert(current: Editor, request: { token: string; text: string }) {
    lastInserted.current = request.token;
    const blocks = request.text.split(/\n\n+/).map((text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }));
    current.chain().focus().insertContent(blocks).run();
    handlers.current.onInserted();
  }
  // The editor instance is stable while typing and composing. A note is an explicit insertion,
  // and changing drafts remounts this component instead of rebuilding it per keystroke.
  const requestToken = insertRequest?.token;
  useNoteInsertion(editor, insertRequest, requestToken, lastInserted, insert);
  return <><FormatToolbar editor={editor}/><div className="editor-scroll"><input className="draft-title-input" value={draft.title} maxLength={300} onChange={(event) => onChange({ title: event.target.value })} placeholder="写一个标题…" aria-label="稿件标题"/><EditorContent editor={editor}/><p className="writing-hint">手动写作 · Ctrl / ⌘ + S 保存</p></div></>;
}

function useNoteInsertion(editor: Editor | null, request: { token: string; text: string } | null, token: string | undefined, last: React.RefObject<string | null>, insert: (editor: Editor, request: { token: string; text: string }) => void) {
  const callback = useRef(insert); callback.current = insert;
  useEffect(() => { if (editor && request && last.current !== request.token) callback.current(editor, request); }, [editor, request, token, last]);
}
function FormatToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? {
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'),
    bullet: current.isActive('bulletList'), ordered: current.isActive('orderedList'), highlight: current.isActive('highlight'),
    heading: current.isActive('heading', { level: 1 }) ? '1' : current.isActive('heading', { level: 2 }) ? '2' : current.isActive('heading', { level: 3 }) ? '3' : '0',
  } : null });
  function button(label: string, text: React.ReactNode, active: boolean | undefined, run: () => void) { return <button type="button" className={`format-button ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active || false} disabled={!editor} onMouseDown={(event) => event.preventDefault()} onClick={run}>{text}</button>; }
  return <div className="format-toolbar" role="toolbar" aria-label="文字格式"><select aria-label="段落与标题格式" value={state?.heading || '0'} disabled={!editor} onChange={(event) => { const level = Number(event.target.value); if (level === 0) editor?.chain().focus().setParagraph().run(); else editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run(); }}><option value="0">正文</option><option value="1">标题 1</option><option value="2">标题 2</option><option value="3">标题 3</option></select><i/>{button('加粗', <b>B</b>, state?.bold, () => { editor?.chain().focus().toggleBold().run(); })}{button('斜体', <em>I</em>, state?.italic, () => { editor?.chain().focus().toggleItalic().run(); })}{button('下划线', <u>U</u>, state?.underline, () => { editor?.chain().focus().toggleUnderline().run(); })}<i/>{button('无序列表', '≡', state?.bullet, () => { editor?.chain().focus().toggleBulletList().run(); })}{button('有序列表', '1.', state?.ordered, () => { editor?.chain().focus().toggleOrderedList().run(); })}<i/>{button('高亮', <span className="highlight-glyph">H</span>, state?.highlight, () => { editor?.chain().focus().toggleHighlight({ color: '#fff2a8' }).run(); })}<label className="color-picker" title="文字颜色"><span>A</span><input type="color" aria-label="文字颜色" defaultValue="#262626" disabled={!editor} onChange={(event) => { editor?.chain().focus().setColor(event.target.value).run(); }}/></label><button className="format-button clear-format" title="清除文字格式" aria-label="清除文字格式" disabled={!editor} onMouseDown={(event) => event.preventDefault()} onClick={() => { editor?.chain().focus().unsetAllMarks().run(); }}>T<span>×</span></button></div>;
}
