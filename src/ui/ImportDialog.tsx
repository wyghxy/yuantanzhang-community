'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Material } from '../domain';
import { createMaterialFromText, safeSourceUrl } from '../transfer';
import { Icon } from './Icons';

export function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (material: Material) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [platform, setPlatform] = useState('手动导入');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  async function readText(file?: File) {
    if (!file) return;
    setError('');
    setReading(true);
    try {
      if (!/\.(txt|md|markdown)$/i.test(file.name)) throw new Error('请选择 TXT 或 Markdown 文本文件。');
      if (file.size > 2 * 1024 * 1024) throw new Error('文本文件不能超过 2 MiB。');
      const material = createMaterialFromText(file.name, await file.text());
      setTitle(material.title); setBody(material.body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '文件读取失败。'); }
    finally { setReading(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (!title.trim()) throw new Error('请填写素材标题。');
      if (!body.trim()) throw new Error('请粘贴素材正文，或选择文本文件。');
      if (new TextEncoder().encode(body).byteLength > 2 * 1024 * 1024) throw new Error('素材正文不能超过 2 MiB。');
      const parsedTags = [...new Set(tags.split(/[,，、\n]/).map((tag) => tag.trim()).filter(Boolean))];
      if (parsedTags.length > 40 || parsedTags.some((tag) => tag.length > 80)) throw new Error('标签最多 40 个，每个不超过 80 字。');
      const now = new Date().toISOString();
      onImport({ id: crypto.randomUUID(), title: title.trim(), body, sourceUrl: safeSourceUrl(sourceUrl), platform: platform.trim() || '手动导入', tags: parsedTags, createdAt: now, updatedAt: now });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '素材导入失败。'); }
  }
  return <dialog ref={dialogRef} className="import-dialog" aria-labelledby="import-title" onCancel={onClose}>
    <form onSubmit={submit}>
      <div className="dialog-head"><div><span className="eyebrow">收集自己的资料</span><h2 id="import-title">导入素材</h2></div><button type="button" className="icon-button" aria-label="关闭导入窗口" onClick={onClose}><Icon name="close"/></button></div>
      <div className="dialog-body">
        <label className="file-drop"><Icon name="upload"/><span>{reading ? '正在读取…' : '选择 TXT / Markdown 文件'}</span><small>或直接在下方粘贴正文 · 最多 2 MiB</small><input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" disabled={reading} onChange={(event) => { void readText(event.target.files?.[0]); }}/></label>
        <label className="field">标题 <span>*</span><input autoFocus value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} placeholder="给这份资料一个清晰的名字" required/></label>
        <label className="field">正文 <span>*</span><textarea className="import-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="粘贴你有权保存和使用的正文…" required/></label>
        <div className="form-row"><label className="field">来源平台<input value={platform} maxLength={100} onChange={(event) => setPlatform(event.target.value)} placeholder="如：公众号、网页、个人笔记"/></label><label className="field">标签<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用逗号分隔"/></label></div>
        <label className="field">原文链接 <small>选填，仅用于打开原文</small><input value={sourceUrl} maxLength={2048} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…"/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-foot"><span>资料仅保存在当前浏览器</span><div className="actions"><button type="button" className="button" onClick={onClose}>取消</button><button className="button primary" type="submit" disabled={reading}><Icon name="plus" size={17}/>导入素材</button></div></div>
    </form>
  </dialog>;
}

export function DeleteDialog({ label, detail, onClose, onDelete }: { label: string; detail: string; onClose: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="delete-dialog" aria-labelledby="delete-title" onCancel={onClose}>
    <div className="dialog-head"><h2 id="delete-title">删除{label}？</h2><button className="icon-button" aria-label="关闭删除窗口" onClick={onClose}><Icon name="close"/></button></div>
    <div className="dialog-body"><p>{detail}</p><p className="muted">删除后可以通过底部提示撤销。</p></div>
    <div className="dialog-foot"><button className="button" onClick={onClose}>取消</button><button className="button danger" onClick={() => { onDelete(); onClose(); }}>确认删除</button></div>
  </dialog>;
}
