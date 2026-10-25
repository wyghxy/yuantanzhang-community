'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyDocument, emptyState, type DeskState, type Draft, type Material, type Note } from '../domain';
import { loadState, saveState } from '../storage';
import { mergeBackup, parseBackup, stringifyBackup } from '../transfer';
import { Icon, downloadText } from './Icons';
import { DeleteDialog, ImportDialog } from './ImportDialog';
import { MaterialLibrary } from './MaterialLibrary';
import { Writer } from './Writer';

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';
type Undo = { label: string; restore: (state: DeskState) => DeskState };
type DeleteTarget = { type: 'material'; item: Material } | { type: 'draft'; item: Draft };
export default function Desk() {
  const [state, setState] = useState<DeskState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<'library' | 'writer'>('library');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<Undo | null>(null);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const stateRef = useRef(state);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const loadedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readLocal = useCallback(async () => {
    setLoadError('');
    try {
      const result = await loadState();
      if (loadedRef.current) return;
      stateRef.current = result; setState(result); setLoaded(true); loadedRef.current = true;
      setSelectedMaterial(result.materials[0]?.id || null); setSelectedDraft(result.drafts[0]?.id || null);
    } catch (cause) { if (!loadedRef.current) setLoadError(cause instanceof Error ? cause.message : '本地数据读取失败。'); }
  }, []);
  useEffect(() => { void readLocal(); }, [readLocal]);
  useEffect(() => {
    let prefersDark = false;
    try { const saved = localStorage.getItem('community-desk-theme'); prefersDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { /* Theme preference is optional. */ }
    setDark(prefersDark);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; }, [dark]);
  function toggleTheme() { const next = !dark; setDark(next); try { localStorage.setItem('community-desk-theme', next ? 'dark' : 'light'); } catch { /* Theme preference is optional. */ } }

  const persist = useCallback((snapshot = stateRef.current, revision = revisionRef.current): Promise<boolean> => {
    if (!loadedRef.current) return Promise.resolve(false);
    setSaveStatus('saving');
    let success = true;
    const task = queueRef.current.catch(() => {}).then(async () => {
      try {
        await saveState(snapshot);
        savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
        setSaveStatus(revisionRef.current === savedRevisionRef.current ? 'saved' : 'dirty');
      } catch (cause) {
        success = false; setSaveStatus('error');
        setNotice(`${cause instanceof Error ? cause.message : '保存失败。'} 输入仍保留在当前页面，请重试保存或导出备份。`);
      }
    });
    queueRef.current = task;
    return task.then(() => success);
  }, []);
  const commit = useCallback((change: (current: DeskState) => DeskState, save = true) => {
    const next = change(stateRef.current);
    stateRef.current = next; setState(next); revisionRef.current += 1; setSaveStatus('dirty');
    if (save) void persist(next, revisionRef.current);
  }, [persist]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (revisionRef.current > savedRevisionRef.current) { event.preventDefault(); event.returnValue = ''; } };
    const pageHide = () => { if (loadedRef.current && revisionRef.current > savedRevisionRef.current) void persist(); };
    const visibility = () => { if (document.visibilityState === 'hidden') pageHide(); };
    const shortcut = (event: KeyboardEvent) => { if (!event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && loadedRef.current) { event.preventDefault(); void persist(); } };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide); window.addEventListener('keydown', shortcut); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide); window.removeEventListener('keydown', shortcut); document.removeEventListener('visibilitychange', visibility); };
  }, [persist]);
  async function navigate(next: 'library' | 'writer') {
    if (revisionRef.current > savedRevisionRef.current && !await persist()) return;
    setView(next); setMobileNavOpen(false);
  }
  function newDraft(material?: Material) {
    const now = new Date().toISOString();
    const draft: Draft = { id: crypto.randomUUID(), title: '', content: emptyDocument(), materialId: material?.id || null, createdAt: now, updatedAt: now };
    commit((current) => ({ ...current, drafts: [draft, ...current.drafts] })); setSelectedDraft(draft.id); setView('writer');
    if (material) setNotice('已新建空稿，原文保留在右侧供你参考。');
  }
  function changeDraft(id: string, update: Partial<Pick<Draft, 'title' | 'content' | 'materialId'>>) {
    commit((current) => ({ ...current, drafts: current.drafts.map((draft) => draft.id === id ? { ...draft, ...update, updatedAt: new Date().toISOString() } : draft) }), false);
  }
  async function selectDraft(id: string) { if (revisionRef.current > savedRevisionRef.current && !await persist()) return; setSelectedDraft(id); }
  function addMaterial(material: Material) { commit((current) => ({ ...current, materials: [material, ...current.materials] })); setSelectedMaterial(material.id); }
  function addNote(materialId: string, quote: string, thought: string) {
    const note: Note = { id: crypto.randomUUID(), materialId, quote, thought, createdAt: new Date().toISOString() };
    commit((current) => ({ ...current, notes: [note, ...current.notes] }));
  }
  function deleteNote(id: string) {
    const note = stateRef.current.notes.find((item) => item.id === id);
    if (!note) return;
    commit((current) => ({ ...current, notes: current.notes.filter((item) => item.id !== id) }));
    setUndo({ label: '笔记已删除', restore: (current) => current.materials.some((item) => item.id === note.materialId) ? { ...current, notes: current.notes.some((item) => item.id === id) ? current.notes : [...current.notes, note] } : current });
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'material') {
      const material = deleteTarget.item;
      const notes = stateRef.current.notes.filter((note) => note.materialId === material.id);
      const links = new Set(stateRef.current.drafts.filter((draft) => draft.materialId === material.id).map((draft) => draft.id));
      commit((current) => ({ ...current, materials: current.materials.filter((item) => item.id !== material.id), notes: current.notes.filter((note) => note.materialId !== material.id), drafts: current.drafts.map((draft) => draft.materialId === material.id ? { ...draft, materialId: null } : draft) }));
      setSelectedMaterial(null);
      setUndo({ label: '素材及关联笔记已删除，稿件已保留', restore: (current) => ({ ...current, materials: current.materials.some((item) => item.id === material.id) ? current.materials : [material, ...current.materials], notes: [...current.notes, ...notes.filter((note) => !current.notes.some((item) => item.id === note.id))], drafts: current.drafts.map((draft) => links.has(draft.id) && draft.materialId === null ? { ...draft, materialId: material.id } : draft) }) });
    } else {
      const draft = stateRef.current.drafts.find((item) => item.id === deleteTarget.item.id);
      if (!draft) return;
      commit((current) => ({ ...current, drafts: current.drafts.filter((item) => item.id !== draft.id) }));
      setSelectedDraft(stateRef.current.drafts[0]?.id || null);
      setUndo({ label: '稿件已删除', restore: (current) => ({ ...current, drafts: current.drafts.some((item) => item.id === draft.id) ? current.drafts : [{ ...draft, materialId: current.materials.some((item) => item.id === draft.materialId) ? draft.materialId : null }, ...current.drafts] }) });
    }
  }
  function exportBackup() {
    try { downloadText(`元探长备份-${new Date().toISOString().slice(0, 10)}.json`, stringifyBackup(stateRef.current), 'application/json;charset=utf-8'); setNotice('备份已交给浏览器下载，请确认下载文件已保存。'); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : '备份导出失败。'); }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('备份文件不能超过 10 MiB。');
      const incoming = parseBackup(await file.text());
      const merged = mergeBackup(stateRef.current, incoming);
      const count = merged.materials.length - stateRef.current.materials.length;
      commit(() => merged); setNotice(`已合并备份，新增 ${count} 份素材。相同记录已去重。`);
      if (!selectedMaterial) setSelectedMaterial(merged.materials[0]?.id || null);
      if (!selectedDraft) setSelectedDraft(merged.drafts[0]?.id || null);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : '备份导入失败，本地数据未覆盖。'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }
  function importExample() {
    const now = new Date().toISOString();
    addMaterial({ id: crypto.randomUUID(), title: '示例 · 把散落的想法写成自己的文章', body: '这是一份专为个人社区版编写的原创示例，不代表真实采集结果。\n\n阅读的时候，我们往往会遇到一句打动自己的话。与其急着把整篇文章搬进稿件，不如先问：它为什么吸引我？它和我的经验有什么联系？\n\n你可以在这里选中一段文字，记下此刻的想法。摘录是线索，笔记是加工，写作则是重新组织自己的判断。\n\n试着用一个亲身经历开头，写下你赞同的部分，也写下仍然存疑的地方。让资料成为参考，让文章保留你的声音。', sourceUrl: '', platform: '原创示例', tags: ['使用演示'], createdAt: now, updatedAt: now });
  }
  const activeDraft = state.drafts.find((draft) => draft.id === selectedDraft);
  if (!loaded) return <main className="boot-screen"><div className="brand-mark"><Icon name="write" size={20}/></div><h1>元探长</h1>{loadError ? <><p role="alert">{loadError}</p><p className="muted">请保留当前浏览器数据，再重试读取。</p><button className="button primary" onClick={() => { void readLocal(); }}>重试读取</button></> : <p>正在读取本地资料…</p>}</main>;
  return <div className="desk-shell">
    {mobileNavOpen && <button className="nav-backdrop" aria-label="关闭导航" onClick={() => setMobileNavOpen(false)}/>}
    <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}><div className="brand"><div className="brand-mark"><Icon name="write" size={20}/></div><div><strong>元探长</strong><span>个人社区版</span></div></div><div className="nav-label">我的工作台</div><nav aria-label="主导航"><button className={view === 'library' ? 'active' : ''} aria-current={view === 'library' ? 'page' : undefined} onClick={() => { void navigate('library'); }}><Icon name="library"/><span>素材库</span><b>{state.materials.length}</b></button><button className={view === 'writer' ? 'active' : ''} aria-current={view === 'writer' ? 'page' : undefined} onClick={() => { void navigate('writer'); }}><Icon name="write"/><span>写作台</span><b>{state.drafts.length}</b></button></nav><div className="sidebar-note"><span className="sidebar-note-line"/><p>把资料读透，<br/>把想法写清楚。</p></div><div className="sidebar-bottom"><button className="local-data-button" onClick={() => { setDataOpen(true); setMobileNavOpen(false); }}><Icon name="folder" size={18}/><span>本地数据</span><Icon name="chevron" size={14}/></button><div className="theme-row"><span><i/>仅存当前浏览器</span><button className="icon-button" onClick={toggleTheme} aria-label={dark ? '切换浅色主题' : '切换深色主题'} title={dark ? '浅色主题' : '深色主题'}><Icon name={dark ? 'sun' : 'moon'} size={18}/></button></div><p className="license-note">个人自用与内容变现免费<br/>转售／收费软件服务需授权</p></div></aside>
    <main className="main-workspace"><header className="workspace-header"><button className="icon-button mobile-menu" aria-label="打开导航" onClick={() => setMobileNavOpen(true)}><Icon name="menu"/></button><div className="header-title"><h1>{view === 'library' ? '素材库' : '写作台'}</h1><span>{view === 'library' ? '收集有价值的资料，留下自己的思考' : '左边写作，右边参考'}</span></div><div className="header-actions"><span className="local-badge"><i/>本地工作台</span>{view === 'library' ? <button className="button primary" onClick={() => setImportOpen(true)}><Icon name="plus" size={17}/>导入素材</button> : <button className="button primary" onClick={() => newDraft()}><Icon name="plus" size={17}/>新建空稿</button>}</div></header>
      <div className="workspace-content">{view === 'library' ? <MaterialLibrary materials={state.materials} notes={state.notes} selectedId={selectedMaterial} onSelect={setSelectedMaterial} onImport={() => setImportOpen(true)} onExample={importExample} onWrite={newDraft} onDelete={(item) => setDeleteTarget({ type: 'material', item })} onAddNote={addNote} onDeleteNote={deleteNote}/> : <Writer drafts={state.drafts} draft={activeDraft} materials={state.materials} notes={state.notes} saveStatus={saveStatus} onSelect={(id) => { void selectDraft(id); }} onNew={() => newDraft()} onDelete={(item) => setDeleteTarget({ type: 'draft', item })} onChange={changeDraft} onSave={() => { void persist(); }} onAddNote={addNote} onDeleteNote={deleteNote} onError={setNotice}/>}</div>
      {saveStatus === 'error' && <div className="save-error-bar" role="alert"><span>本地保存失败，当前输入仍在页面中。</span><button className="text-button" onClick={() => { void persist(); }}>重试保存</button><button className="text-button" onClick={exportBackup}>导出备份</button></div>}
    </main>
    <div className="notifications" aria-live="polite">{undo && <div className="undo-notice"><Icon name="trash" size={17}/><span>{undo.label}</span><button className="text-button" onClick={() => { commit(undo.restore); setUndo(null); setNotice('已撤销删除。'); }}><Icon name="undo" size={15}/>撤销</button><button className="icon-button" aria-label="关闭撤销提示" onClick={() => setUndo(null)}><Icon name="close" size={15}/></button></div>}{notice && <div className="notice"><span>{notice}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setNotice('')}><Icon name="close" size={15}/></button></div>}</div>
    <input hidden ref={fileRef} type="file" accept=".json,application/json" aria-label="导入 JSON 备份" onChange={(event) => { void importBackup(event.target.files?.[0]); }}/>
    {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImport={addMaterial}/>}
    {deleteTarget && <DeleteDialog label={deleteTarget.type === 'material' ? '这份素材' : '这篇稿件'} detail={deleteTarget.type === 'material' ? `“${deleteTarget.item.title}”及其笔记将被删除，关联稿件会保留并取消素材关联。` : `“${deleteTarget.item.title || '未命名稿件'}”将从本机稿件列表中删除。`} onClose={() => setDeleteTarget(null)} onDelete={confirmDelete}/>}
    {dataOpen && <DataDialog state={state} saveStatus={saveStatus} onClose={() => setDataOpen(false)} onExport={exportBackup} onImport={() => fileRef.current?.click()}/>}
  </div>;
}

function DataDialog({ state, saveStatus, onClose, onExport, onImport }: { state: DeskState; saveStatus: SaveStatus; onClose: () => void; onExport: () => void; onImport: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="data-dialog" aria-labelledby="data-title" onCancel={onClose}><div className="dialog-head"><div><span className="eyebrow">你的资料，由你保管</span><h2 id="data-title">本地数据</h2></div><button className="icon-button" aria-label="关闭本地数据窗口" onClick={onClose}><Icon name="close"/></button></div><div className="dialog-body"><p>素材、稿件和笔记保存在当前浏览器的 IndexedDB，无需登录。</p><div className="data-counts"><div><strong>{state.materials.length}</strong><span>素材</span></div><div><strong>{state.drafts.length}</strong><span>稿件</span></div><div><strong>{state.notes.length}</strong><span>笔记</span></div></div><p className={`save-indicator ${saveStatus}`}><i/>{saveStatus === 'saved' ? '当前修改已保存' : saveStatus === 'saving' ? '正在保存本地数据…' : saveStatus === 'error' ? '保存失败，请保留页面并导出备份' : '当前有未保存修改'}</p><p className="data-explainer">清除网站数据、使用隐私浏览或更换设备，可能使本地资料不可用。请定期导出完整 JSON 备份，并妥善保存下载文件。</p><div className="data-action"><Icon name="download"/><div><strong>导出完整备份</strong><span>包含全部素材、稿件与笔记</span></div><button className="button" onClick={onExport}>导出 JSON</button></div><div className="data-action"><Icon name="upload"/><div><strong>合并导入备份</strong><span>相同记录去重；同 ID 冲突时停止合并</span></div><button className="button" onClick={onImport}>选择文件</button></div><p className="data-license">元探长个人社区版：个人自用（含本人账号内容变现）免费；转卖软件、制成收费工具或对外托管服务须获得授权。完整使用范围以许可原文及补充许可为准。</p></div><div className="dialog-foot"><span>个人社区版 0.1.0</span><button className="button" onClick={onClose}>完成</button></div></dialog>;
}
