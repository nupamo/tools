import { DAY, OTHER, type Sales } from './csv';

export type Unit = 'day' | 'week' | 'month';
export interface Bucket { start: number; end: number } // days, end exclusive
export const MAX_SERIES = 8; // the palette has eight hues; later products fold into "other"

const utc = (day: number) => new Date(day * DAY);
/** First day of the bucket holding `day`. Weeks start on Monday. */
export function bucketStart(day: number, unit: Unit) {
  if (unit === 'day') return day;
  if (unit === 'week') return day - ((day + 3) % 7 + 7) % 7; // 1970-01-01 was a Thursday
  const date = utc(day); return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / DAY;
}
function bucketEnd(start: number, unit: Unit) {
  if (unit === 'day') return start + 1;
  if (unit === 'week') return start + 7;
  const date = utc(start); return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY;
}
export function makeBuckets(from: number, to: number, unit: Unit) {
  const buckets: Bucket[] = [];
  for (let start = bucketStart(from, unit); start <= to; start = bucketEnd(start, unit)) buckets.push({ start, end: bucketEnd(start, unit) });
  return buckets;
}
/** Position of a day on the bucket axis: bucket i spans i-0.5 to i+0.5. `at` 0 is the start of the day, 1 its end. */
export function axisPosition(buckets: Bucket[], day: number, at = .5) {
  const i = buckets.findIndex(b => day < b.end);
  if (i < 0) return buckets.length - .5;
  const b = buckets[i]; return i - .5 + Math.max(0, day + at - b.start) / (b.end - b.start);
}

export interface Series { id: string; slot: number; revenue: number[]; count: number[]; totalRevenue: number; totalCount: number; buyers: number; repeat: number }
export interface Summary {
  buckets: Bucket[]; series: Series[];
  slots: Map<string, number>; // product ID → colour slot, for products sold in the period
  revenue: number; orders: number; buyers: number; repeatBuyers: number;
  payments: { name: string; revenue: number; orders: number }[];
  heat: number[][]; // [weekday, Monday first][hour] → orders
}

/** Totals for the orders paid from `from` to `to` (inclusive days). */
export function summarize(sales: Sales, from: number, to: number, unit: Unit): Summary {
  const buckets = makeBuckets(from, to, unit), index = new Map(buckets.map((b, i) => [b.start, i]));
  const inRange = sales.orders.filter(order => order.day >= from && order.day <= to), sold = new Set(inRange.flatMap(order => order.items.map(item => item.id)));
  // Colours go to the products sold in this period, in whole-file revenue order, so hiding a series never repaints the others.
  const present = sales.products.filter(p => sold.has(p.id)), fold = present.length > MAX_SERIES;
  const slotOf = new Map(present.map((p, i) => [p.id, fold && i >= MAX_SERIES - 1 ? MAX_SERIES - 1 : i]));
  const zeros = () => buckets.map(() => 0), series = new Map<number, Series>(), seriesBuyers = new Map<number, Map<string, number>>();
  const payments = new Map<string, { name: string; revenue: number; orders: number }>(), buyers = new Map<string, number>();
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let revenue = 0, orders = 0;
  for (const order of inRange) {
    const i = index.get(bucketStart(order.day, unit))!;
    revenue += order.total; orders++;
    buyers.set(order.buyer, (buyers.get(order.buyer) ?? 0) + 1);
    const pay = payments.get(order.payment) ?? { name: order.payment, revenue: 0, orders: 0 };
    pay.revenue += order.total; pay.orders++; payments.set(order.payment, pay);
    heat[((order.day + 3) % 7 + 7) % 7][order.hour]++;
    for (const item of order.items) {
      const slot = slotOf.get(item.id)!, folded = fold && slot === MAX_SERIES - 1;
      const s = series.get(slot) ?? { id: folded ? OTHER : item.id, slot, revenue: zeros(), count: zeros(), totalRevenue: 0, totalCount: 0, buyers: 0, repeat: 0 };
      s.revenue[i] += item.amount; s.count[i] += item.quantity; s.totalRevenue += item.amount; s.totalCount += item.quantity; series.set(slot, s);
      const who = seriesBuyers.get(slot) ?? new Map<string, number>(); who.set(order.buyer, (who.get(order.buyer) ?? 0) + 1); seriesBuyers.set(slot, who);
    }
  }
  // "Repeat" for a product means its buyer ordered more than once in the period, any product.
  for (const [slot, who] of seriesBuyers) { const s = series.get(slot)!; s.buyers = who.size; s.repeat = [...who.keys()].filter(b => buyers.get(b)! > 1).length; }
  return {
    buckets, slots: slotOf, series: [...series.values()].sort((a, b) => a.slot - b.slot), revenue, orders, buyers: buyers.size,
    repeatBuyers: [...buyers.values()].filter(n => n > 1).length,
    payments: [...payments.values()].sort((a, b) => b.revenue - a.revenue), heat,
  };
}
