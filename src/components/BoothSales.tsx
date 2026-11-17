import { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { Button } from '@astryxdesign/core/Button';
import { DateInput } from '@astryxdesign/core/DateInput';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { DAY, OTHER, isoDay, parseOrders, toDay, type Sales } from '../lib/booth/csv';
import { MAX_SERIES, axisPosition, summarize, type Unit } from '../lib/booth/aggregate';
import { parseEvents } from '../lib/booth/events';
import { isBoothMessage, type BoothMessage } from '../lib/booth/messages';
import { getMessages, type Locale } from '../i18n';
import SalesChart, { type ChartEvent, type SalesChartHandle } from './SalesChart';
import ToolIcon from './ToolIcon';

type Preset = 'all' | 'm3' | 'm6' | 'y1' | 'custom';
type Metric = 'revenue' | 'orders';
type IsoDate = ISODateString;
const MAX_BYTES = 20 * 1024 * 1024, EVENTS_KEY = 'tools-booth-events', MONTHS: Record<Exclude<Preset, 'custom'>, number> = { all: 0, m3: 3, m6: 6, y1: 12 };

// First day of the period that ends on `last` and is `months` long.
function monthsBefore(last: number, months: number) {
  const date = new Date(last * DAY);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, date.getUTCDate()) / DAY + 1;
}

export default function BoothSales({ locale = 'ko', label }: { locale?: Locale; label: string }) {
  const t = getMessages(locale).booth, n = (value: number) => Math.round(value).toLocaleString(locale), yen = (value: number) => `¥${n(value)}`;
  const input = useRef<HTMLInputElement>(null), chart = useRef<SalesChartHandle>(null);
  const [sales, setSales] = useState<Sales | null>(null), [fileName, setFileName] = useState(''), [loading, setLoading] = useState(false), [dragging, setDragging] = useState(false);
  const [preset, setPreset] = useState<Preset>('m6'), [from, setFrom] = useState(0), [to, setTo] = useState(0);
  const [unit, setUnit] = useState<Unit>('week'), [metric, setMetric] = useState<Metric>('revenue'), [view, setView] = useState<'trend' | 'insights'>('trend');
  const [eventsText, setEventsText] = useState(''), [hidden, setHidden] = useState<string[]>([]);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const say = (code: BoothMessage) => t.status[code];

  // Events are kept on this device so the next CSV export can reuse them.
  useEffect(() => { try { setEventsText(localStorage.getItem(EVENTS_KEY) ?? ''); } catch { /* storage unavailable */ } }, []);
  function editEvents(text: string) { setEventsText(text); try { localStorage.setItem(EVENTS_KEY, text); } catch { /* storage unavailable */ } }

  const parsed = useMemo(() => parseEvents(eventsText, sales?.products ?? []), [eventsText, sales]);
  const summary = useMemo(() => sales && to >= from ? summarize(sales, from, to, unit) : null, [sales, from, to, unit]);
  const folded = (summary?.slots.size ?? 0) > MAX_SERIES, slotOf = (id: string) => { const slot = summary?.slots.get(id); return slot === undefined || (folded && slot === MAX_SERIES - 1) ? -1 : slot; };
  const nameOf = (id: string) => id === OTHER ? t.other : parsed.aliases.get(id) ?? sales?.products.find(p => p.id === id)?.short ?? id;
  const seriesOf = (id: string) => summary?.slots.has(id) && slotOf(id) === -1 ? OTHER : id;

  const spansYears = new Date(from * DAY).getUTCFullYear() !== new Date(to * DAY).getUTCFullYear();
  const short = (day: number) => { const iso = isoDay(day); return spansYears ? `${iso.slice(2, 4)}/${iso.slice(5, 7)}/${iso.slice(8)}` : `${iso.slice(5, 7)}/${iso.slice(8)}`; };
  const chartData = useMemo(() => {
    if (!summary) return null;
    const { buckets } = summary;
    const events: ChartEvent[] = parsed.events.filter(e => e.to >= from && e.from <= to && !(e.product && hidden.includes(seriesOf(e.product)))).map(e => {
      const start = Math.max(e.from, from), end = Math.min(e.to, to), period = e.to > e.from, slot = e.product ? slotOf(e.product) : -1;
      return {
        x: axisPosition(buckets, start, period ? 0 : .5), x2: period ? axisPosition(buckets, end, 1) : null, kind: e.kind, kindName: t.kinds[e.kind], label: e.label,
        date: period ? `${short(e.from)}~${short(e.to)}` : short(e.from), slot, owner: e.product ? nameOf(e.product) : '',
      };
    });
    return {
      events,
      labels: buckets.map(b => unit === 'month' ? isoDay(b.start).slice(0, 7) : short(b.start)),
      ranges: buckets.map(b => unit === 'month' ? isoDay(b.start).slice(0, 7) : unit === 'day' ? isoDay(b.start) : `${isoDay(b.start)} ~ ${isoDay(b.end - 1)}`),
      series: summary.series.map(s => ({ id: s.id, name: nameOf(s.id), slot: s.id === OTHER ? -1 : s.slot, values: metric === 'revenue' ? s.revenue : s.count })),
    };
  }, [summary, parsed, hidden, metric, unit, from, to, locale]);

  function applyPreset(next: Preset, data = sales) {
    setPreset(next);
    if (!data || next === 'custom') return;
    setFrom(next === 'all' ? data.firstDay : Math.max(data.firstDay, monthsBefore(data.lastDay, MONTHS[next]))); setTo(data.lastDay);
  }
  function choose() { if (input.current) { input.current.value = ''; input.current.click(); } }
  async function loadFile(file: File) {
    setError(''); setMessage('');
    if (!/\.csv$/i.test(file.name)) { setError(say('notCsv')); return; }
    if (file.size > MAX_BYTES) { setError(say('fileTooLarge')); return; }
    setLoading(true);
    try {
      const next = parseOrders(await file.text());
      setSales(next); setFileName(file.name); setHidden([]); applyPreset(preset === 'custom' ? 'm6' : preset, next);
    } catch (cause) { setError(cause instanceof Error && isBoothMessage(cause.message) ? say(cause.message) : say('openFailed')); }
    finally { setLoading(false); }
  }
  function savePng() {
    const url = chart.current?.toPng();
    if (!url) { setMessage(''); setError(say('saveFailed')); return; }
    const link = document.createElement('a'); link.href = url; link.download = `booth-sales_${isoDay(from)}_${isoDay(to)}.png`; link.click();
    setError(''); setMessage(say('saved'));
  }
  async function copyPrompt() {
    const products = (sales?.products ?? []).map(p => `${p.id} | ${p.name}`).join('\n');
    try { await navigator.clipboard.writeText(t.prompt(products, isoDay(from), isoDay(to))); setError(''); setMessage(say('copied')); }
    catch { setMessage(''); setError(say('copyFailed')); }
  }
  function setDate(which: 'from' | 'to', value: string | undefined) {
    const day = value ? toDay(value) : NaN; if (Number.isNaN(day)) return;
    setPreset('custom'); if (which === 'from') { setFrom(day); if (day > to) setTo(day); } else { setTo(day); if (day < from) setFrom(day); }
  }

  const disabled = !sales || loading, shownSeries = summary?.series.filter(s => !hidden.includes(s.id)) ?? [];
  const shownRevenue = shownSeries.reduce((sum, s) => sum + s.totalRevenue, 0), shownCount = shownSeries.reduce((sum, s) => sum + s.totalCount, 0);
  const subtitle = summary ? [t.unitNotes[unit], metric === 'revenue' ? t.totalRevenue(yen(shownRevenue)) : t.totalCount(n(shownCount)), ...(hidden.length ? [] : [t.orderCount(n(summary.orders))])].join(' · ') : '';
  const heatMax = summary ? Math.max(1, ...summary.heat.flat()) : 1, payMax = summary?.payments[0]?.revenue || 1;

  return <Theme theme={neutralTheme} mode="system"><section className="editor booth-editor" aria-label={label}>
    <input ref={input} type="file" accept=".csv,text/csv" className="visually-hidden" tabIndex={-1} aria-label={t.file} disabled={loading} onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
    <div className="editor-toolbar">
      <div className="file-info">{sales ? <><span className="file-name" title={fileName}>{fileName}</span><span className="dimensions">{t.summary(n(sales.orders.length), isoDay(sales.firstDay), isoDay(sales.lastDay))}</span></> : <span>{t.start}</span>}</div>
      <div className="toolbar-actions">
        {sales && <SegmentedControl label={t.view} value={view} onChange={value => setView(value as typeof view)} size="sm">
          <SegmentedControlItem value="trend" label={t.views.trend} />
          <SegmentedControlItem value="insights" label={t.views.insights} />
        </SegmentedControl>}
        <Button icon={<ToolIcon name="fileSheet" />} label={sales ? t.another : t.choose} size="sm" isDisabled={loading} onClick={choose} />
        <Button icon={<ToolIcon name="download" />} label={t.savePng} size="sm" variant="primary" isDisabled={!chartData?.series.length || view !== 'trend'} onClick={savePng} />
      </div>
    </div>
    <div className="editor-body booth-body">
      <div className={`booth-stage ${dragging ? 'is-dragging' : ''}`} aria-busy={loading}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void loadFile(file); }}>
        {!sales || !summary || !chartData ? <button type="button" className="empty-upload" disabled={loading} onClick={choose}><ToolIcon name="fileSheet" size="lg" /><strong>{loading ? t.opening : t.drop}</strong><small>{t.limits}</small></button>
          : !summary.orders ? <p className="booth-empty">{t.emptyRange}</p>
          : view === 'trend' ? <SalesChart ref={chart} label={t.chartLabel} title={t.titles[metric][unit]} period={`${isoDay(from)} ~ ${isoDay(to)}`} subtitle={subtitle} laneName={t.eventLane} totalName={t.total}
              labels={chartData.labels} ranges={chartData.ranges} series={chartData.series} events={chartData.events} hidden={hidden}
              format={metric === 'revenue' ? yen : n} onHiddenChange={setHidden} />
          : <div className="booth-insights">
            <dl className="booth-tiles">
              <div><dt>{t.tiles.revenue}</dt><dd>{yen(summary.revenue)}</dd></div>
              <div><dt>{t.tiles.orders}</dt><dd>{n(summary.orders)}</dd></div>
              <div><dt>{t.tiles.buyers}</dt><dd>{n(summary.buyers)}<small>{t.tiles.repeat(n(summary.repeatBuyers))}</small></dd></div>
              <div><dt>{t.tiles.average}</dt><dd>{yen(summary.revenue / summary.orders)}</dd></div>
            </dl>
            <section className="booth-card booth-table-card">
              <table className="booth-table"><caption>{t.table.caption}</caption>
                <thead><tr><th scope="col">{t.table.product}</th><th scope="col">{t.table.quantity}</th><th scope="col">{t.table.revenue}</th><th scope="col">{t.table.share}</th><th scope="col">{t.table.buyers}</th><th scope="col">{t.table.repeat}</th></tr></thead>
                <tbody>{summary.series.map(s => <tr key={s.id}>
                  <th scope="row"><i className="booth-swatch" style={{ background: s.id === OTHER ? 'var(--muted)' : `var(--chart-${s.slot + 1})` }} /><span title={sales.products.find(p => p.id === s.id)?.name}>{nameOf(s.id)}</span></th>
                  <td>{n(s.totalCount)}</td><td>{yen(s.totalRevenue)}</td><td>{summary.revenue ? `${Math.round(s.totalRevenue / summary.revenue * 100)}%` : '–'}</td><td>{n(s.buyers)}</td><td>{n(s.repeat)}</td>
                </tr>)}</tbody>
              </table>
            </section>
            <section className="booth-card">
              <h2>{t.payments}</h2>
              <ul className="booth-bars">{summary.payments.map(p => <li key={p.name}>
                <span className="booth-bar-name" title={p.name}>{p.name || '–'}</span>
                <span className="booth-bar-track"><i style={{ width: `${p.revenue / payMax * 100}%` }} /></span>
                <span className="booth-bar-value">{yen(p.revenue)} · {t.orderCount(n(p.orders))}</span>
              </li>)}</ul>
            </section>
            <section className="booth-card">
              <h2>{t.heat}<small>{t.heatNote}</small></h2>
              <div className="booth-heat" role="img" aria-label={t.heat}>
                {summary.heat.map((hours, day) => <div className="booth-heat-row" key={day}>
                  <span>{t.weekdays[day]}</span>
                  {hours.map((count, hour) => <i key={hour} title={t.heatCell(t.weekdays[day], hour, count)} style={count ? { background: `color-mix(in srgb, var(--chart-1) ${Math.round(18 + 82 * count / heatMax)}%, var(--surface))` } : undefined} />)}
                </div>)}
                <div className="booth-heat-row booth-heat-hours"><span />{Array.from({ length: 24 }, (_, hour) => <i key={hour}>{hour % 6 === 0 ? hour : ''}</i>)}</div>
              </div>
            </section>
          </div>}
      </div>
      <aside className="adjustments booth-panel" aria-label={t.settings}>
        <div className="booth-settings">
          <Selector label={t.period} size="sm" width="100%" isDisabled={disabled} value={preset} onChange={value => applyPreset(value as Preset)}
            options={(['all', 'm3', 'm6', 'y1', 'custom'] as const).map(value => ({ value, label: t.presets[value] }))} />
          <div className="booth-dates">
            <DateInput label={t.from} size="sm" width="100%" isDisabled={disabled} value={sales ? isoDay(from) as IsoDate : undefined} format={value => value} weekStartsOn="mon" onChange={value => setDate('from', value)} />
            <DateInput label={t.to} size="sm" width="100%" isDisabled={disabled} value={sales ? isoDay(to) as IsoDate : undefined} format={value => value} weekStartsOn="mon" onChange={value => setDate('to', value)} />
          </div>
          <SegmentedControl label={t.unit} value={unit} onChange={value => setUnit(value as Unit)} size="sm" layout="fill" isDisabled={disabled}>
            <SegmentedControlItem value="day" label={t.units.day} />
            <SegmentedControlItem value="week" label={t.units.week} />
            <SegmentedControlItem value="month" label={t.units.month} />
          </SegmentedControl>
          <SegmentedControl label={t.metric} value={metric} onChange={value => setMetric(value as Metric)} size="sm" layout="fill" isDisabled={disabled}>
            <SegmentedControlItem value="revenue" label={t.metrics.revenue} />
            <SegmentedControlItem value="orders" label={t.metrics.orders} />
          </SegmentedControl>
        </div>
        <section className="booth-events" aria-labelledby="booth-events-heading">
          <div className="adjustment-heading"><h2 id="booth-events-heading">{t.events}</h2>{chartData && parsed.events.length > 0 && <span className="panel-note">{t.eventCount(chartData.events.length)}</span>}</div>
          <p className="panel-note">{t.eventsHint}</p>
          <div className="booth-events-text"><TextArea label={t.events} isLabelHidden rows={9} value={eventsText} onChange={editEvents} placeholder={t.eventsPlaceholder} /></div>
          {sales && parsed.issues.length > 0 && <ul className="booth-issues" role="status">{parsed.issues.slice(0, 6).map(issue => <li key={issue.line}>{t.issue(issue.line, t.issues[issue.code])}</li>)}{parsed.issues.length > 6 && <li>…</li>}</ul>}
          <Button icon={<ToolIcon name="copy" />} label={t.copyPrompt} size="sm" isDisabled={disabled} onClick={() => void copyPrompt()} />
        </section>
        {sales && (sales.unpaid > 0 || sales.shared > 0) && <p className="panel-note">{[sales.unpaid ? t.unpaid(sales.unpaid) : '', sales.shared ? t.shared(sales.shared) : ''].filter(Boolean).join(' ')}</p>}
        {(error || message) && <div className={`panel-status ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</div>}
      </aside>
    </div>
  </section></Theme>;
}
