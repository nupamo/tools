import { boothError } from './messages';

export const DAY = 86_400_000;
export const OTHER = 'other';

export interface OrderItem { id: string; quantity: number; amount: number }
// `day` is days since 1970-01-01 of the paid date as written in the CSV (no time zone conversion).
export interface Order { id: string; buyer: string; payment: string; day: number; hour: number; total: number; items: OrderItem[] }
export interface Product { id: string; name: string; short: string; revenue: number; quantity: number }
export interface Sales { orders: Order[]; products: Product[]; firstDay: number; lastDay: number; unpaid: number; shared: number }

// BOOTH translates the header row with the account language, so columns are read by position.
const COLUMNS = 15, NUMBER = 0, BUYER = 1, PAYMENT = 2, PAID = 5, TOTAL = 7, ITEMS = 14;
// "Item ID : 8450925 / Quantity : 1 / name" — the two labels are translated too.
const ITEM = /^[^:：/]*[:：]\s*(\d+)\s*\/[^:：/]*[:：]\s*(\d+)\s*\/\s*(.*)$/;
const STAMP = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}))?/;

/** Days since 1970-01-01 for a `YYYY-MM-DD` style date, or NaN. */
export function toDay(text: string) {
  const m = STAMP.exec(text.trim()); if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])], time = Date.UTC(y, mo - 1, d), date = new Date(time);
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? time / DAY : NaN;
}
export const isoDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

/** RFC 4180 rows: quoted fields may hold commas, line breaks and doubled quotes. */
export function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  const end = () => { row.push(field); field = ''; };
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') end();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      end(); if (row.length > 1 || row[0]) rows.push(row); row = [];
    } else field += c;
  }
  if (field || row.length) { end(); rows.push(row); }
  return rows;
}

// "Split MMD Player（無料版あり） (Studio)" → "Split MMD Player". Used for legends; the full name stays available.
export function shortName(name: string) {
  const cut = name.split(/\s*[（(［\[【]|\s+[-–—/|]\s+/)[0].trim();
  return cut || name.trim();
}

/** Reads a BOOTH order CSV. Buyer names, addresses and phone numbers are never kept. */
export function parseOrders(text: string): Sales {
  const rows = parseCsv(text);
  if (rows.length < 2) throw boothError('notCsv');
  const orders: Order[] = [], products = new Map<string, Product>(); let unpaid = 0, shared = 0, recognised = 0;
  for (const row of rows.slice(1)) {
    if (row.length < COLUMNS || !/^\d+$/.test(row[NUMBER].trim())) continue;
    recognised++;
    const day = toDay(row[PAID]), total = Number(row[TOTAL].replace(/[^\d.-]/g, ''));
    if (Number.isNaN(day) || !Number.isFinite(total)) { unpaid++; continue; }
    const lines = row[ITEMS].split(/\r?\n/).map(line => ITEM.exec(line.trim())).filter(m => m !== null);
    const parsed = lines.length ? lines.map(m => ({ id: m[1], quantity: Math.max(1, Number(m[2])), name: m[3].trim() })) : [{ id: OTHER, quantity: 1, name: '' }];
    // Total Price is per order, so an order with several products is shared out by quantity.
    const pieces = parsed.reduce((sum, item) => sum + item.quantity, 0);
    if (parsed.length > 1) shared++;
    const items = parsed.map(item => ({ id: item.id, quantity: item.quantity, amount: total * item.quantity / pieces }));
    parsed.forEach((item, i) => {
      const product = products.get(item.id) ?? { id: item.id, name: item.name, short: shortName(item.name), revenue: 0, quantity: 0 };
      product.revenue += items[i].amount; product.quantity += item.quantity; products.set(item.id, product);
    });
    orders.push({ id: row[NUMBER].trim(), buyer: row[BUYER].trim(), payment: row[PAYMENT].trim(), day, hour: Math.min(23, Number(STAMP.exec(row[PAID].trim())?.[4] ?? 0)), total, items });
  }
  if (!recognised) throw boothError('notBooth');
  if (!orders.length) throw boothError('noOrders');
  orders.sort((a, b) => a.day - b.day);
  // Sorted by revenue over the whole file, so a product keeps its colour whatever period is shown.
  return { orders, products: [...products.values()].sort((a, b) => b.revenue - a.revenue), firstDay: orders[0].day, lastDay: orders[orders.length - 1].day, unpaid, shared };
}
