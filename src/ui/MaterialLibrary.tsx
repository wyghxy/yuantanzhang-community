'use client';
import { useMemo, useState } from 'react';
import type { Material, Note } from '../domain';
import { Icon, dateLabel } from './Icons';
import { SourceReader } from './SourceReader';

type Props = {
  materials: Material[]; notes: Note[]; selectedId: string | null;
  onSelect: (id: string | null) => void; onImport: () => void; onExample: () => void;
  onWrite: (material: Material) => void; onDelete: (material: Material) => void;
  onAddNote: (materialId: string, quote: string, thought: string) => void; onDeleteNote: (id: string) => void;
};
export function MaterialLibrary(props: Props) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const platforms = useMemo(() => [...new Set(props.materials.map((item) => item.platform).filter(Boolean))].sort(), [props.materials]);
  const items = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return props.materials.filter((item) => (!platform || item.platform === platform) && (!text || [item.title, item.body, item.platform, ...item.tags].join('\n').toLocaleLowerCase().includes(text))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [props.materials, platform, query]);
  const selected = props.materials.find((item) => item.id === props.selectedId);
  return <div className={`library-layout ${selected ? 'has-selection' : ''}`}>
    <section className="material-list-pane" aria-label="素材列表">
      <div className="list-filter"><label className="search-box"><Icon name="search" size={17}/><input aria-label="搜索素材" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、正文、标签"/>{query && <button className="clear-search" aria-label="清空搜索" onClick={() => setQuery('')}><Icon name="close" size={13}/></button>}</label><div className="list-filter-row"><select aria-label="按平台筛选" value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="">全部平台</option>{platforms.map((name) => <option key={name}>{name}</option>)}</select><span>{items.length} 份素材</span></div></div>
      <div className="material-items">
        {items.map((item) => <button className={`material-row ${item.id === props.selectedId ? 'selected' : ''}`} key={item.id} onClick={() => props.onSelect(item.id)} aria-current={item.id === props.selectedId ? 'true' : undefined}><div className="material-row-top"><span>{item.platform || '手动导入'}</span><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></div><h3>{item.title}</h3><p>{item.body.replace(/\s+/g, ' ')}</p><div className="material-row-bottom"><span>{item.tags.slice(0, 2).map((tag) => `#${tag}`).join('  ') || `${item.body.replace(/\s/g, '').length.toLocaleString()} 字`}</span><Icon name="chevron" size={14}/></div></button>)}
        {!items.length && <div className="list-empty"><Icon name={props.materials.length ? 'search' : 'folder'} size={30}/><h3>{props.materials.length ? '没有找到匹配的素材' : '从一份资料开始'}</h3><p>{props.materials.length ? '换个关键词，或试试其他平台。' : '把网页文章、文本或自己的笔记放在这里。'}</p>{!props.materials.length && <><button className="button primary" onClick={props.onImport}><Icon name="plus" size={17}/>导入素材</button><button className="text-button example-button" onClick={props.onExample}>导入一份原创示例</button></>}{!!props.materials.length && <button className="text-button" onClick={() => { setQuery(''); setPlatform(''); }}>清除筛选</button>}</div>}
      </div>
      <div className="list-bottom"><Icon name="file" size={15}/><span>手动收集，随时整理</span></div>
    </section>
    <section className="material-detail-pane" aria-label="素材详情">
      {selected ? <><div className="detail-toolbar"><button className="icon-button mobile-back" aria-label="返回素材列表" onClick={() => props.onSelect(null)}><Icon name="arrow"/></button><span className="pane-title">素材详情</span><div className="actions"><button className="icon-button" aria-label={`删除素材：${selected.title}`} title="删除素材" onClick={() => props.onDelete(selected)}><Icon name="trash" size={18}/></button><button className="button primary small" onClick={() => props.onWrite(selected)}><Icon name="write" size={16}/>从这份素材写作</button></div></div><SourceReader key={selected.id} material={selected} notes={props.notes.filter((note) => note.materialId === selected.id)} onAddNote={(quote, thought) => props.onAddNote(selected.id, quote, thought)} onDeleteNote={props.onDeleteNote}/></> : <div className="detail-empty"><div className="empty-illustration"><Icon name="file" size={38}/><span><Icon name="quote" size={19}/></span></div><span className="eyebrow">收集 · 阅读 · 再思考</span><h2>好想法，先有一个落脚处</h2><p>选择左侧素材开始阅读。<br/>把值得留下的句子变成笔记，再写下自己的表达。</p><div className="empty-steps"><span><b>01</b>导入资料</span><i/><span><b>02</b>阅读摘录</span><i/><span><b>03</b>手动写作</span></div></div>}
    </section>
  </div>;
}
