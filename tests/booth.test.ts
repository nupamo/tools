import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isoDay, parseCsv, parseOrders, shortName, toDay } from '../src/lib/booth/csv';
import { axisPosition, bucketStart, makeBuckets, summarize } from '../src/lib/booth/aggregate';
import { parseEvents } from '../src/lib/booth/events';

// Same shape as a BOOTH export with a Korean account: translated header, address columns empty for downloads.
const HEADER = '"Order Number","Identification Code","신용카드","State","Created At","Paid At","Completed At","Total Price","우편번호","도도부현(광역 주소)","시구정촌·초메·번지(상세 주소)","아파트 건물명 호수","이름","전화번호","Item ID / Quantity / Name"';
const row = (id: number, buyer: string, pay: string, paid: string, total: number, items: string) =>
  `"${id}","${buyer}","${pay}","Completed","${paid}","${paid}","${paid}","${total}","","","","","","","${items}"`;
const PLAYER = 'Item ID : 100 / Quantity : 1 / Split Player（無料版あり） (Studio)', BOX = 'Item ID : 200 / Quantity : 1 / 糸車オルゴール / Spinning Wheel Music Box';
const CSV = '﻿' + [
  HEADER,
  row(5, 'aaaa', 'PayPal', '2026-06-22 01:36:28', 450, PLAYER), // Monday
  row(4, 'bbbb', '신용카드', '2026-06-21 23:51:04', 450, BOX), // Sunday
  row(3, 'aaaa', '신용카드', '2026-06-15 07:40:03', 1350, `${PLAYER}\nItem ID : 200 / Quantity : 2 / 糸車オルゴール / Spinning Wheel Music Box`),
  row(2, 'cccc', 'PayPal', '', 450, PLAYER), // never paid
  row(1, 'dddd', 'PayPal', '2026-05-31 12:00:00', 900, 'Item ID : 100 / Quantity : 1 / Split Player, "quoted"'.replace(/"/g, '""')),
].join('\r\n') + '\r\n';

test('parseCsv handles quotes, commas and line breaks inside fields', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e""\nf"\r\n1,2,3\n'), [['a', 'b,c', 'd "e"\nf'], ['1', '2', '3']]);
});

test('dates are read as written and invalid ones rejected', () => {
  assert.equal(isoDay(toDay('2026-06-22 01:36:28')), '2026-06-22');
  assert.equal(isoDay(toDay('2026/6/5')), '2026-06-05');
  assert.ok(Number.isNaN(toDay('2026-02-30')));
  assert.ok(Number.isNaN(toDay('soon')));
});

test('shortName drops bracketed and trailing parts', () => {
  assert.equal(shortName('Split MMD Player（無料版あり） (Studio)'), 'Split MMD Player');
  assert.equal(shortName('糸車オルゴール / Spinning Wheel Music Box'), '糸車オルゴール');
  assert.equal(shortName('AutoResize PhotoGallery - 自動リサイズフォトギャラリー'), 'AutoResize PhotoGallery');
  assert.equal(shortName('T-shirt'), 'T-shirt');
});

test('parseOrders reads orders by column position and shares multi-product totals by quantity', () => {
  const sales = parseOrders(CSV);
  assert.equal(sales.orders.length, 4);
  assert.equal(sales.unpaid, 1);
  assert.equal(sales.shared, 1);
  assert.equal(isoDay(sales.firstDay), '2026-05-31');
  assert.equal(isoDay(sales.lastDay), '2026-06-22');
  assert.deepEqual(sales.products.map(p => [p.id, p.short, p.revenue, p.quantity]), [['100', 'Split Player', 1800, 3], ['200', '糸車オルゴール', 1350, 3]]);
  const shared = sales.orders.find(o => o.id === '3')!;
  assert.deepEqual(shared.items, [{ id: '100', quantity: 1, amount: 450 }, { id: '200', quantity: 2, amount: 900 }]);
  assert.equal(shared.hour, 7);
});

test('parseOrders rejects files that are not BOOTH exports', () => {
  assert.throws(() => parseOrders('hello'), /notCsv/);
  assert.throws(() => parseOrders('a,b\n1,2\n'), /notBooth/);
  assert.throws(() => parseOrders([HEADER, row(2, 'cccc', 'PayPal', '', 450, PLAYER)].join('\n')), /noOrders/);
});

test('weeks start on Monday and months on the 1st', () => {
  assert.equal(isoDay(bucketStart(toDay('2026-06-21'), 'week')), '2026-06-15'); // Sunday
  assert.equal(isoDay(bucketStart(toDay('2026-06-22'), 'week')), '2026-06-22'); // Monday
  assert.equal(isoDay(bucketStart(toDay('2026-06-22'), 'month')), '2026-06-01');
  assert.deepEqual(makeBuckets(toDay('2026-01-31'), toDay('2026-03-01'), 'month').map(b => isoDay(b.start)), ['2026-01-01', '2026-02-01', '2026-03-01']);
});

test('summarize buckets revenue per product and counts buyers, payments and hours', () => {
  const sales = parseOrders(CSV), s = summarize(sales, toDay('2026-06-01'), sales.lastDay, 'week');
  assert.deepEqual(s.buckets.map(b => isoDay(b.start)), ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22']);
  assert.deepEqual(s.series.map(x => [x.id, x.revenue, x.count]), [['100', [0, 0, 450, 450], [0, 0, 1, 1]], ['200', [0, 0, 1350, 0], [0, 0, 3, 0]]]);
  assert.equal(s.revenue, 2250);
  assert.equal(s.orders, 3);
  assert.equal(s.buyers, 2);
  assert.equal(s.repeatBuyers, 1);
  assert.deepEqual(s.series.map(x => [x.buyers, x.repeat]), [[1, 1], [2, 1]]);
  assert.deepEqual(s.payments, [{ name: '신용카드', revenue: 1800, orders: 2 }, { name: 'PayPal', revenue: 450, orders: 1 }]);
  assert.equal(s.heat[0][1], 1); // Monday 01h
  assert.equal(s.heat[6][23], 1); // Sunday 23h
  assert.equal(s.series.reduce((sum, x) => sum + x.totalRevenue, 0), s.revenue);
});

test('products beyond the palette fold into one "other" series', () => {
  const lines = Array.from({ length: 10 }, (_, i) => row(i + 1, `b${i}`, 'PayPal', '2026-06-01 10:00:00', 100 * (10 - i), `Item ID : ${i + 1} / Quantity : 1 / P${i + 1}`));
  const sales = parseOrders([HEADER, ...lines].join('\n')), s = summarize(sales, sales.firstDay, sales.lastDay, 'day');
  assert.deepEqual(s.series.map(x => x.id), ['1', '2', '3', '4', '5', '6', '7', 'other']);
  assert.equal(s.series.at(-1)!.totalRevenue, 300 + 200 + 100);
});

test('axisPosition places a day inside its bucket band', () => {
  const buckets = makeBuckets(toDay('2026-06-01'), toDay('2026-06-21'), 'week');
  assert.equal(axisPosition(buckets, toDay('2026-06-01'), 0), -.5);
  assert.equal(axisPosition(buckets, toDay('2026-06-11'), .5), 1); // Thursday noon is the middle of week 2
  assert.equal(axisPosition(buckets, toDay('2026-06-21'), 1), 2.5);
});

test('parseEvents reads dates, periods, kinds, products and aliases', () => {
  const { products } = parseOrders(CSV);
  const { events, aliases, issues } = parseEvents([
    '# comment', '',
    '2026-06-17 | update | Split Player | v1.1.0',
    '2026-07-01~2026-07-15 | 할인 | 여름 할인',
    '2026/6/20 | バズ | 200 | 紹介された',
    '| 2026-06-02 | release | * | 스토어 오픈 |',
    'alias | 100 | Player',
  ].join('\n'), products);
  assert.deepEqual(issues, []);
  assert.deepEqual(events.map(e => [isoDay(e.from), isoDay(e.to), e.kind, e.product, e.label]), [
    ['2026-06-02', '2026-06-02', 'release', null, '스토어 오픈'],
    ['2026-06-17', '2026-06-17', 'update', '100', 'v1.1.0'],
    ['2026-06-20', '2026-06-20', 'viral', '200', '紹介された'],
    ['2026-07-01', '2026-07-15', 'sale', null, '여름 할인'],
  ]);
  assert.deepEqual([...aliases], [['100', 'Player']]);
});

test('parseEvents reports bad lines without dropping the rest', () => {
  const { products } = parseOrders(CSV);
  const { events, issues } = parseEvents(['just text', 'someday | update | x', '2026-06-17 | update | Nothing | v2', '2026-06-18 | mystery | ok'].join('\n'), products);
  assert.deepEqual(issues, [{ line: 1, code: 'eventFormat' }, { line: 2, code: 'eventDate' }, { line: 3, code: 'eventProduct' }]);
  assert.deepEqual(events.map(e => [e.kind, e.product, e.label]), [['update', null, 'v2'], ['note', null, 'ok']]);
});
