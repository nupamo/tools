import { toDay, type Product } from './csv';
import type { EventIssueCode } from './messages';

export const EVENT_KINDS = ['release', 'update', 'sale', 'viral', 'note'] as const;
export type EventKind = typeof EVENT_KINDS[number];
// `product` is a BOOTH item ID, or null when the event concerns the whole shop. `from`/`to` are inclusive days.
export interface SalesEvent { line: number; from: number; to: number; kind: EventKind; product: string | null; label: string }
export interface EventIssue { line: number; code: EventIssueCode }
export interface ParsedEvents { events: SalesEvent[]; aliases: Map<string, string>; issues: EventIssue[] }

// The text is usually written by the user's own AI, so common words in three languages are accepted.
const KIND_WORDS: Record<EventKind, string[]> = {
  release: ['release', 'launch', 'new', '출시', '발매', '発売', 'リリース', '公開'],
  update: ['update', 'patch', 'version', '업데이트', '패치', 'アップデート', '更新', 'パッチ'],
  sale: ['sale', 'discount', 'price', '할인', '세일', '가격', 'セール', '割引', '値下げ', '価格'],
  viral: ['viral', 'buzz', 'mention', 'promo', '바이럴', '홍보', '소개', 'バズ', '紹介', '宣伝'],
  note: ['note', 'memo', 'other', 'etc', '기타', '메모', 'メモ', 'その他'],
};
const ALIAS_WORDS = ['alias', 'name', '별칭', '이름', '名前', '別名'], ALL_WORDS = ['', '*', '-', 'all', '전체', '全体', 'すべて'];
const kindOf = (word: string) => EVENT_KINDS.find(kind => KIND_WORDS[kind].includes(word));

function findProduct(text: string, products: Product[]) {
  const key = text.toLowerCase();
  return products.find(p => p.id === key) ?? products.find(p => p.short.toLowerCase() === key) ?? products.find(p => p.name.toLowerCase().includes(key));
}

/**
 * One event per line, fields separated by `|`:
 *   date | kind | product | label      2026-06-17 | update | Split MMD Player | v1.1.0
 *   date | kind | label                2026-07-01~2026-07-15 | sale | Summer sale
 *   alias | product | display name     alias | 8450925 | Split MMD
 * Blank lines and lines starting with `#` or `//` are ignored. Lines with problems are reported, not thrown.
 */
export function parseEvents(text: string, products: Product[]): ParsedEvents {
  const events: SalesEvent[] = [], aliases = new Map<string, string>(), issues: EventIssue[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1, trimmed = raw.trim().replace(/^[-*•]\s+(?=\d{4})/, '');
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('```')) return;
    const fields = trimmed.split(/[|｜\t]/).map(f => f.trim());
    if (fields[0] === '' && fields.length > 3) fields.shift(); // markdown table row: "| a | b |"
    if (fields.at(-1) === '' && fields.length > 3) fields.pop();
    if (ALIAS_WORDS.includes(fields[0].toLowerCase())) {
      const product = fields.length === 3 && fields[2] ? findProduct(fields[1], products) : undefined;
      if (product) aliases.set(product.id, fields[2]); else issues.push({ line, code: fields.length === 3 && fields[2] ? 'eventProduct' : 'eventFormat' });
      return;
    }
    if (fields.length < 3 || fields.length > 4 || !fields.at(-1)) { issues.push({ line, code: 'eventFormat' }); return; }
    const [start, end = start] = fields[0].split(/\s*(?:~|〜|～|\.\.+|→)\s*/), from = toDay(start), to = toDay(end);
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) { issues.push({ line, code: 'eventDate' }); return; }
    const named = fields.length === 4 && !ALL_WORDS.includes(fields[2].toLowerCase()) ? fields[2] : '', product = named ? findProduct(named, products) : undefined;
    if (named && !product) issues.push({ line, code: 'eventProduct' }); // still shown, as a shop-wide event
    events.push({ line, from, to, kind: kindOf(fields[1].toLowerCase()) ?? 'note', product: product?.id ?? null, label: fields.at(-1)! });
  });
  events.sort((a, b) => a.from - b.from || a.line - b.line);
  return { events, aliases, issues };
}
