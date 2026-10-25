export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  marks?: { type: string; attrs?: Record<string, string | number | null> }[];
  content?: RichNode[];
};
export type Material = {
  id: string;
  title: string;
  body: string;
  sourceUrl: string;
  platform: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
export type Draft = {
  id: string;
  title: string;
  content: RichNode;
  materialId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Note = {
  id: string;
  materialId: string;
  quote: string;
  thought: string;
  createdAt: string;
};
export type DeskState = { version: 1; materials: Material[]; drafts: Draft[]; notes: Note[] };
export const emptyState = (): DeskState => ({ version: 1, materials: [], drafts: [], notes: [] });
export const emptyDocument = (): RichNode => ({ type: 'doc', content: [{ type: 'paragraph' }] });
