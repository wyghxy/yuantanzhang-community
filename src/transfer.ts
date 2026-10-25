import type { DeskState, Draft, Material, Note, RichNode } from './domain.ts';

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_RICH_NODES = 50_000;
const encoder = new TextEncoder();
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const nodeTypes = new Set(['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'hardBreak', 'horizontalRule', 'text']);
const markTypes = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'textStyle']);
const inlineTypes = new Set(['text', 'hardBreak']);
const blockTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule']);
const colorNames = new Set(['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'navy', 'teal', 'lime', 'maroon', 'olive', 'silver', 'aqua', 'fuchsia', 'transparent']);

function invalid(message: string): never {
  throw new Error(`备份格式不正确：${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} 必须是对象。`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) invalid(`${label} 含不安全的对象。`);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => forbiddenKeys.has(key))) invalid(`${label} 含不安全的字段。`);
  return result;
}

function fields(value: Record<string, unknown>, required: string[], optional: string[], label: string): void {
  for (const key of required) if (!Object.hasOwn(value, key)) invalid(`${label} 缺少 ${key}。`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) invalid(`${label} 含不支持的字段 ${key}。`);
}

function string(value: unknown, label: string, max: number, allowEmpty = true): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    invalid(`${label} 必须是${allowEmpty ? '' : '非空'}文本，且不超过 ${max} 个字符。`);
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  const id = string(value, label, 128, false);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) || forbiddenKeys.has(id)) invalid(`${label} 含不支持的标识符。`);
  return id;
}

function timestamp(value: unknown, label: string): string {
  const date = string(value, label, 30, false);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(date) || !Number.isFinite(Date.parse(date))) {
    invalid(`${label} 必须是有效的 ISO UTC 时间。`);
  }
  const normalized = new Date(date).toISOString();
  if (normalized.slice(0, 19) !== date.slice(0, 19)) invalid(`${label} 不是有效的日历日期。`);
  return date;
}

function array(value: unknown, label: string, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) invalid(`${label} 必须是数组，且最多 ${limit} 项。`);
  return value;
}

/** Only absolute HTTP(S) source links are accepted; credentials never persist. */
export function safeSourceUrl(value: string): string {
  const input = string(value, '来源链接', 2048).trim();
  if (!input) return '';
  if (/[\u0000-\u0020\u007f]/.test(input)) invalid('来源链接含空格或控制字符。');
  let url: URL;
  try { url = new URL(input); } catch { return invalid('来源链接需要完整的 http:// 或 https:// 地址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) invalid('来源链接仅允许 HTTP 或 HTTPS。');
  url.username = '';
  url.password = '';
  if (url.href.length > 2048) invalid('规范化后的来源链接不能超过 2048 个字符。');
  return url.href;
}

function material(value: unknown, index: number): Material {
  const label = `素材 ${index + 1}`;
  const item = record(value, label);
  fields(item, ['id', 'title', 'body', 'sourceUrl', 'platform', 'tags', 'createdAt', 'updatedAt'], [], label);
  const body = string(item.body, `${label} 正文`, MAX_BODY_BYTES);
  if (encoder.encode(body).byteLength > MAX_BODY_BYTES) invalid(`${label} 正文不能超过 2 MiB。`);
  const tags = array(item.tags, `${label} 标签`, 40).map((tag) => string(tag, '标签', 80, false));
  if (new Set(tags).size !== tags.length) invalid(`${label} 标签重复。`);
  return {
    id: identifier(item.id, `${label} ID`),
    title: string(item.title, `${label} 标题`, 300),
    body,
    sourceUrl: safeSourceUrl(string(item.sourceUrl, '来源链接', 2048)),
    platform: string(item.platform, `${label} 平台`, 100),
    tags,
    createdAt: timestamp(item.createdAt, `${label} 创建时间`),
    updatedAt: timestamp(item.updatedAt, `${label} 修改时间`),
  };
}

function color(value: unknown, label: string): string | null {
  if (value === null) return null;
  const result = string(value, label, 32, false);
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(result) && !colorNames.has(result.toLowerCase())) {
    invalid(`${label} 仅允许十六进制颜色或受支持的颜色名。`);
  }
  return result;
}

function nodeAttrs(type: string, value: unknown, label: string): Record<string, string | number | null> {
  const attrs = record(value, `${label} 属性`);
  if (type === 'heading') {
    fields(attrs, [], ['level'], label);
    if (attrs.level !== undefined && (!Number.isInteger(attrs.level) || Number(attrs.level) < 1 || Number(attrs.level) > 6)) invalid('标题级别必须是 1 到 6。');
  } else if (type === 'orderedList') {
    fields(attrs, [], ['start', 'type'], label);
    if (attrs.start !== undefined && (!Number.isInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 1_000_000)) invalid('列表起始序号不正确。');
    if (attrs.type !== undefined && attrs.type !== null && (typeof attrs.type !== 'string' || !['1', 'a', 'A', 'i', 'I'].includes(attrs.type))) invalid('列表编号类型不正确。');
  } else if (type === 'codeBlock') {
    fields(attrs, [], ['language'], label);
    if (attrs.language !== undefined && attrs.language !== null && (typeof attrs.language !== 'string' || !/^[A-Za-z0-9_+-]{1,40}$/.test(attrs.language))) invalid('代码语言标识不正确。');
  } else {
    fields(attrs, [], [], label);
  }
  return { ...attrs } as Record<string, string | number | null>;
}

function marks(value: unknown, label: string): NonNullable<RichNode['marks']> {
  const seen = new Set<string>();
  return array(value, `${label} 文本样式`, 7).map((entry) => {
    const mark = record(entry, '文本样式');
    fields(mark, ['type'], ['attrs'], '文本样式');
    const type = string(mark.type, '文本样式类型', 20, false);
    if (!markTypes.has(type) || seen.has(type)) invalid('文本样式不受支持或重复。');
    seen.add(type);
    const result: NonNullable<RichNode['marks']>[number] = { type };
    if (mark.attrs !== undefined) {
      const attrs = record(mark.attrs, '文本样式属性');
      const allowed = type === 'highlight' ? ['color'] : type === 'textStyle' ? ['color', 'backgroundColor'] : [];
      fields(attrs, [], allowed, '文本样式属性');
      result.attrs = {};
      for (const key of Object.keys(attrs)) result.attrs[key] = color(attrs[key], '文本颜色');
    }
    return result;
  });
}

function richDocument(value: unknown): RichNode {
  const budget = { nodes: 0, text: 0 };
  function visit(input: unknown, depth: number, parent: string | null): RichNode {
    if (depth > 32 || ++budget.nodes > MAX_RICH_NODES) invalid('富文本层级或节点数量超过限制。');
    const node = record(input, '富文本节点');
    fields(node, ['type'], ['text', 'attrs', 'marks', 'content'], '富文本节点');
    const type = string(node.type, '富文本节点类型', 30, false);
    if (!nodeTypes.has(type)) invalid(`不支持富文本节点 ${type}。`);
    if (parent === null && type !== 'doc') invalid('富文本根节点必须是 doc。');
    if (parent !== null && type === 'doc') invalid('doc 只能作为富文本根节点。');
    if (parent === 'doc' || parent === 'blockquote' || parent === 'listItem') {
      if (!blockTypes.has(type)) invalid('块级内容含不支持的子节点。');
    } else if (parent === 'bulletList' || parent === 'orderedList') {
      if (type !== 'listItem') invalid('列表中只能包含 listItem。');
    } else if (parent === 'paragraph' || parent === 'heading') {
      if (!inlineTypes.has(type)) invalid('段落和标题中只能包含文本或换行。');
    } else if (parent === 'codeBlock' && type !== 'text') invalid('代码块中只能包含文本。');
    const result: RichNode = { type };
    if (node.attrs !== undefined) result.attrs = nodeAttrs(type, node.attrs, type);
    if (type === 'text') {
      result.text = string(node.text, '富文本文字', MAX_BODY_BYTES);
      if (!result.text.length) invalid('text 节点不能为空文本。');
      budget.text += encoder.encode(result.text).byteLength;
      if (budget.text > MAX_BODY_BYTES) invalid('单篇稿件的富文本正文不能超过 2 MiB。');
      if (node.content !== undefined) invalid('文本节点不能含子节点。');
    } else if (node.text !== undefined) invalid('仅 text 节点可以包含 text 字段。');
    if (node.marks !== undefined) {
      if (type !== 'text' || parent === 'codeBlock') invalid('只有非代码块的文本可以使用文本样式。');
      result.marks = marks(node.marks, type);
    }
    if (node.content !== undefined) {
      if (['text', 'hardBreak', 'horizontalRule'].includes(type)) invalid(`${type} 不能包含子节点。`);
      result.content = array(node.content, '富文本子节点', MAX_RICH_NODES).map((child) => visit(child, depth + 1, type));
    }
    if (['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(type) && !result.content?.length) invalid(`${type} 不能为空。`);
    if (type === 'listItem' && result.content?.[0]?.type !== 'paragraph') invalid('列表项必须以段落开始。');
    return result;
  }
  return visit(value, 0, null);
}

function draft(value: unknown, index: number): Draft {
  const label = `稿件 ${index + 1}`;
  const item = record(value, label);
  fields(item, ['id', 'title', 'content', 'materialId', 'createdAt', 'updatedAt'], [], label);
  return {
    id: identifier(item.id, `${label} ID`),
    title: string(item.title, `${label} 标题`, 300),
    content: richDocument(item.content),
    materialId: item.materialId === null ? null : identifier(item.materialId, `${label} 关联素材`),
    createdAt: timestamp(item.createdAt, `${label} 创建时间`),
    updatedAt: timestamp(item.updatedAt, `${label} 修改时间`),
  };
}

function note(value: unknown, index: number): Note {
  const label = `笔记 ${index + 1}`;
  const item = record(value, label);
  fields(item, ['id', 'materialId', 'quote', 'thought', 'createdAt'], [], label);
  return {
    id: identifier(item.id, `${label} ID`),
    materialId: identifier(item.materialId, `${label} 关联素材`),
    quote: string(item.quote, `${label} 引用`, 100_000),
    thought: string(item.thought, `${label} 内容`, 100_000),
    createdAt: timestamp(item.createdAt, `${label} 创建时间`),
  };
}

function unique(items: { id: string }[], label: string): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) invalid(`${label} ID 重复。`);
}

/** A backup is the versioned state itself, with no HTML or executable extensions. */
export function parseBackup(text: string): DeskState {
  if (typeof text !== 'string' || encoder.encode(text).byteLength > MAX_BACKUP_BYTES) invalid('文件不能超过 10 MiB。');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return invalid('文件不是有效的 JSON。'); }
  const root = record(parsed, '备份');
  fields(root, ['version', 'materials', 'drafts', 'notes'], [], '备份');
  if (root.version !== 1) invalid('仅支持 version: 1 的社区版备份。');
  const materials = array(root.materials, '素材', 1000).map(material);
  const drafts = array(root.drafts, '稿件', 1000).map(draft);
  const notes = array(root.notes, '笔记', 10_000).map(note);
  unique(materials, '素材');
  unique(drafts, '稿件');
  unique(notes, '笔记');
  const ids = new Set(materials.map((item) => item.id));
  for (const item of drafts) if (item.materialId !== null && !ids.has(item.materialId)) invalid(`稿件 ${item.id} 的关联素材不存在。`);
  for (const item of notes) if (!ids.has(item.materialId)) invalid(`笔记 ${item.id} 的关联素材不存在。`);
  return { version: 1, materials, drafts, notes };
}

function encodeState(state: DeskState): string {
  try { return JSON.stringify(state); } catch { return invalid('数据无法序列化为 JSON。'); }
}

export function stringifyBackup(state: DeskState): string {
  const text = JSON.stringify(parseBackup(encodeState(state)), null, 2);
  if (encoder.encode(text).byteLength > MAX_BACKUP_BYTES) invalid('导出的备份不能超过 10 MiB，请减少内容后重试。');
  return text;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Same-ID identical records deduplicate. Conflicts reject the entire merge. */
export function mergeBackup(current: DeskState, incoming: DeskState): DeskState {
  const before = parseBackup(encodeState(current));
  const added = parseBackup(encodeState(incoming));
  function merge<T extends { id: string }>(left: T[], right: T[], label: string): T[] {
    const result = [...left];
    const byId = new Map(left.map((item) => [item.id, item]));
    for (const item of right) {
      const previous = byId.get(item.id);
      if (!previous) { result.push(item); byId.set(item.id, item); }
      else if (canonical(previous) !== canonical(item)) throw new Error(`合并已取消：${label} ${item.id} 与本地同 ID 内容不同。请保留两份备份并先处理冲突；本地数据未覆盖。`);
    }
    return result;
  }
  return parseBackup(encodeState({ version: 1, materials: merge(before.materials, added.materials, '素材'), drafts: merge(before.drafts, added.drafts, '稿件'), notes: merge(before.notes, added.notes, '笔记') }));
}

export function createMaterialFromText(fileName: string, text: string): Material {
  const body = string(text, '文本文件正文', MAX_BODY_BYTES);
  if (encoder.encode(body).byteLength > MAX_BODY_BYTES) invalid('文本文件正文不能超过 2 MiB。');
  const name = string(fileName, '文件名', 1000).split(/[\\/]/).pop() || '未命名素材';
  const title = name.replace(/\.(?:txt|md|markdown)$/i, '').slice(0, 300) || '未命名素材';
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title, body, sourceUrl: '', platform: '手动导入', tags: [], createdAt: now, updatedAt: now };
}

export function richTextToPlain(content: RichNode): string {
  const document = richDocument(content);
  function render(node: RichNode): string {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'horizontalRule') return '────────';
    const separator = ['paragraph', 'heading', 'codeBlock'].includes(node.type) ? '' : '\n';
    return (node.content || []).map(render).join(separator);
  }
  return render(document);
}

function markdownText(text: string): string {
  // Escape syntax and angle brackets so user text stays inert in Markdown viewers.
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+.!|~=-])/g, '\\$1');
}

export function richTextToMarkdown(content: RichNode): string {
  const document = richDocument(content);
  function inline(node: RichNode): string {
    if (node.type === 'hardBreak') return '  \n';
    let text = markdownText(node.text || '');
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') text = `**${text}**`;
      else if (mark.type === 'italic') text = `*${text}*`;
      else if (mark.type === 'strike') text = `~~${text}~~`;
      else if (mark.type === 'code') {
        const raw = node.text || '';
        const fence = '`'.repeat(Math.max(1, ...Array.from(raw.matchAll(/`+/g), (match) => match[0].length + 1)));
        const padding = raw.startsWith('`') || raw.endsWith('`') || (raw.startsWith(' ') && raw.endsWith(' ')) ? ' ' : '';
        text = `${fence}${padding}${raw}${padding}${fence}`;
      }
      // Underline and color are retained as plain text because Markdown has no portable equivalent.
    }
    return text;
  }
  function render(node: RichNode): string {
    const children = node.content || [];
    if (node.type === 'text' || node.type === 'hardBreak') return inline(node);
    if (node.type === 'paragraph') return children.map(inline).join('');
    if (node.type === 'heading') return `${'#'.repeat(Number(node.attrs?.level || 1))} ${children.map(inline).join('')}`;
    if (node.type === 'horizontalRule') return '---';
    if (node.type === 'codeBlock') {
      const code = children.map((child) => child.text || '').join('');
      const fence = '`'.repeat(Math.max(3, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length + 1)));
      return `${fence}${node.attrs?.language || ''}\n${code}\n${fence}`;
    }
    if (node.type === 'blockquote') return children.map(render).join('\n\n').split('\n').map((line) => `> ${line}`).join('\n');
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return children.map((child, index) => {
        const prefix = node.type === 'bulletList' ? '- ' : `${Number(node.attrs?.start || 1) + index}. `;
        return render(child).split('\n').map((line, lineIndex) => `${lineIndex === 0 ? prefix : ' '.repeat(prefix.length)}${line}`).join('\n');
      }).join('\n');
    }
    return children.map(render).join('\n\n');
  }
  return render(document);
}
