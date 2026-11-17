import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EventKind } from '../lib/booth/events';

// Only these parts of ECharts are bundled. This file is loaded on demand, after a CSV is opened.
echarts.use([BarChart, ScatterChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

// `slot` picks the series colour (--chart-1…8); -1 is the neutral colour for "other" and shop-wide events.
export interface ChartSeries { id: string; name: string; slot: number; values: number[] }
export interface ChartEvent { x: number; x2: number | null; kind: EventKind; kindName: string; label: string; date: string; slot: number; owner: string }
export interface SalesChartHandle { toPng: () => string | null }
interface Props {
  ref: Ref<SalesChartHandle>; label: string; title: string; period: string; subtitle: string; laneName: string; totalName: string;
  labels: string[]; ranges: string[]; series: ChartSeries[]; events: ChartEvent[]; hidden: string[];
  format: (value: number) => string; onHiddenChange: (hidden: string[]) => void;
}

const TOKENS = ['--color-background-surface', '--color-text-primary', '--color-text-secondary', '--color-border', '--color-border-emphasized', ...Array.from({ length: 8 }, (_, i) => `--chart-${i + 1}`)];
const LABEL_CHARS = 18, LEFT = 76, RIGHT = 28, TOP = 104, AXIS = 34, ROW = 20, MAX_ROWS = 8, TOTAL = '__total';
const SYMBOLS: Record<EventKind, string> = { release: 'diamond', update: 'circle', sale: 'rect', viral: 'triangle', note: 'circle' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function resolve(element: HTMLElement) {
  const probe = document.createElement('span'); element.append(probe);
  const colors = TOKENS.map(token => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color; });
  probe.remove(); return colors;
}

// Puts each event label on the first lane row where it does not run into the label before it.
function layoutLane(events: ChartEvent[], count: number, plotWidth: number, font: string) {
  const ctx = document.createElement('canvas').getContext('2d'); if (ctx) ctx.font = font;
  const ends: number[] = [];
  const placed = events.map(event => {
    // The lane shows a short label only; the date and the full text are in the tooltip.
    const chars = [...event.label], text = chars.length > LABEL_CHARS ? `${chars.slice(0, LABEL_CHARS - 1).join('').trimEnd()}…` : event.label, width = (ctx?.measureText(text).width ?? text.length * 7) + 12, dot = (event.x + .5) / count * plotWidth;
    const tail = event.x2 === null ? dot : (event.x2 + .5) / count * plotWidth, left = tail + width > plotWidth + RIGHT - 4 && dot - width > 0;
    const from = (left ? dot - width : dot) - 6, to = left ? tail + 6 : tail + width;
    let row = ends.findIndex(end => from > end + 6), show = true;
    if (row < 0 && ends.length < MAX_ROWS) row = ends.length;
    if (row < 0) { row = ends.indexOf(Math.min(...ends)); show = false; } // no room: the dot stays, the tooltip has the text
    ends[row] = Math.max(ends[row] ?? -Infinity, show ? to : dot + 6);
    return { event, row, text, left, show, reach: left ? 0 : tail - dot };
  });
  return { placed, rows: ends.length };
}

export default function SalesChart(props: Props) {
  const box = useRef<HTMLDivElement>(null), chart = useRef<echarts.ECharts | null>(null), latest = useRef(props), surface = useRef('#fff');
  latest.current = props;

  function render() {
    const element = box.current, instance = chart.current; if (!element || !instance) return;
    const { title, period, subtitle, laneName, totalName, labels, ranges, series, events, hidden, format } = latest.current;
    const [bg, ink, muted, line, strong, ...hues] = resolve(element); surface.current = bg;
    const color = (slot: number) => slot < 0 ? muted : hues[slot % hues.length];
    // Narrow charts put the period on its own line, which pushes everything below down.
    const narrow = element.clientWidth < 620, top = TOP + (narrow ? 20 : 0), fontFamily = getComputedStyle(element).fontFamily, count = labels.length, plotWidth = Math.max(40, element.clientWidth - LEFT - RIGHT);
    const lane = layoutLane(events, count, plotWidth, `11px ${fontFamily}`), laneHeight = lane.rows ? lane.rows * ROW + 6 : 0;
    const shown = series.filter(s => !hidden.includes(s.id)), totals = labels.map((_, i) => shown.reduce((sum, s) => sum + s.values[i], 0));
    const names = new Map(series.map(s => [s.id, s.name])), band = plotWidth / count, step = Math.max(1, Math.ceil(52 / band));
    const ticks = labels.map((_, i) => i).filter(i => i % step === 0);
    const xAxis = (gridIndex: number, withLabels: boolean) => ({
      type: 'value' as const, gridIndex, min: -.5, max: count - .5, splitLine: { show: false },
      axisLine: { show: withLabels, onZero: false, lineStyle: { color: strong } }, axisTick: { show: withLabels, customValues: ticks, lineStyle: { color: strong } },
      axisLabel: { show: withLabels, customValues: ticks, color: muted, fontSize: 11, formatter: (value: number) => labels[value] ?? '' },
      axisPointer: { show: gridIndex === 0, type: 'shadow' as const, snap: true, label: { show: false }, shadowStyle: { color: ink, opacity: .05 } },
    });
    const tooltipRow = (marker: string, name: string, value: string, bold = false) =>
      `<div style="display:flex;gap:16px;justify-content:space-between;${bold ? 'font-weight:650;' : ''}"><span>${marker}${escapeHtml(name)}</span><span style="font-variant-numeric:tabular-nums">${value}</span></div>`;

    instance.setOption({
      animationDuration: 250, textStyle: { fontFamily },
      title: { text: narrow ? `${title}\n${period}` : `${title} (${period})`, subtext: subtitle, left: 20, top: 14, itemGap: 8, textStyle: { color: ink, fontSize: narrow ? 15 : 17, lineHeight: narrow ? 20 : 22, fontWeight: 650 }, subtextStyle: { color: muted, fontSize: 12 } },
      legend: {
        type: 'scroll', left: 20, right: 20, top: top - 36, itemWidth: 14, itemHeight: 10, itemGap: 18, icon: 'roundRect',
        data: series.map(s => s.id), selected: Object.fromEntries(series.map(s => [s.id, !hidden.includes(s.id)])),
        formatter: (id: string) => names.get(id) ?? id, textStyle: { color: ink, fontSize: 12 }, inactiveColor: line, pageTextStyle: { color: muted }, pageIconColor: muted,
      },
      grid: [
        { left: LEFT, right: RIGHT, top, bottom: AXIS + (laneHeight ? laneHeight + 12 : 0) },
        ...(laneHeight ? [{ left: LEFT, right: RIGHT, height: laneHeight, bottom: AXIS }] : []),
      ],
      xAxis: [xAxis(0, !laneHeight), ...(laneHeight ? [xAxis(1, true)] : [])],
      yAxis: [
        { type: 'value', gridIndex: 0, minInterval: 1, axisLabel: { color: muted, fontSize: 11, formatter: format }, splitLine: { lineStyle: { color: line } } },
        ...(laneHeight ? [{
          type: 'value', gridIndex: 1, min: -.5, max: lane.rows - .5, inverse: true, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { customValues: [(lane.rows - 1) / 2], color: muted, fontSize: 11, formatter: () => laneName },
        }] : []),
      ],
      tooltip: {
        trigger: 'axis', confine: true, backgroundColor: bg, borderColor: line, padding: [8, 10], textStyle: { color: ink, fontSize: 12 },
        formatter: (input: unknown) => {
          const items = (Array.isArray(input) ? input : [input]) as { seriesId?: string; seriesType?: string; marker?: string; data: unknown }[];
          const bars = items.filter(item => item.seriesType === 'bar' && item.seriesId !== TOTAL);
          if (!bars.length) return '';
          const index = (bars[0].data as number[])[0];
          const rows = bars.filter(item => (item.data as number[])[1] > 0).reverse().map(item => tooltipRow(item.marker ?? '', names.get(item.seriesId!) ?? '', format((item.data as number[])[1])));
          return `<div style="color:${muted};margin-bottom:4px">${escapeHtml(ranges[index] ?? '')}</div>${rows.join('')}${rows.length === 1 ? '' : tooltipRow('', totalName, format(totals[index]), true)}`;
        },
      },
      series: [
        ...series.map(s => ({
          id: s.id, name: s.id, type: 'bar', stack: 'sales', barWidth: Math.max(1, band * .7), data: s.values.map((value, i) => [i, value]),
          itemStyle: { color: color(s.slot), borderColor: bg, borderWidth: band > 6 ? 1 : 0 }, emphasis: { disabled: true },
        })),
        {
          // Invisible points on top of each stack: they carry the total labels and the event guides.
          id: TOTAL, name: TOTAL, type: 'scatter', symbolSize: 1, itemStyle: { color: 'transparent' }, data: totals.map((total, i) => [i, total]), silent: true, tooltip: { show: false },
          z: 1,
          label: { show: band >= 30, position: 'top', distance: 4, color: muted, fontSize: 10.5, formatter: (item: { dataIndex: number }) => totals[item.dataIndex] ? format(totals[item.dataIndex]) : '' },
          markLine: { z: 1, silent: true, symbol: 'none', animation: false, label: { show: false }, lineStyle: { color: strong, type: [3, 3], width: 1 }, data: events.filter(e => e.x2 === null).map(e => ({ xAxis: e.x })) },
          markArea: { z: 0, silent: true, animation: false, itemStyle: { color: ink, opacity: .06 }, data: events.filter(e => e.x2 !== null).map(e => [{ xAxis: e.x }, { xAxis: e.x2 }]) },
        },
        ...(laneHeight ? [
          {
            id: '__events', type: 'scatter', xAxisIndex: 1, yAxisIndex: 1, symbolSize: 9, cursor: 'default',
            // Periods are drawn as a band from their first to their last day.
            markLine: {
              z: 1, silent: true, symbol: 'none', animation: false, label: { show: false },
              data: lane.placed.filter(p => p.event.x2 !== null).map(p => [{ coord: [p.event.x, p.row], lineStyle: { color: color(p.event.slot), type: 'solid', width: 6, opacity: .4, cap: 'round' } }, { coord: [p.event.x2, p.row] }]),
            },
            tooltip: {
              trigger: 'item',
              formatter: (item: { dataIndex: number }) => {
                const e = lane.placed[item.dataIndex].event;
                return `<div style="color:${muted};margin-bottom:2px">${escapeHtml(`${e.date} · ${e.kindName}${e.owner ? ` · ${e.owner}` : ''}`)}</div><div style="max-width:260px;white-space:normal">${escapeHtml(e.label)}</div>`;
              },
            },
            data: lane.placed.map(p => ({
              value: [p.event.x, p.row], symbol: SYMBOLS[p.event.kind],
              itemStyle: p.event.kind === 'note' ? { color: bg, borderColor: color(p.event.slot), borderWidth: 2 } : { color: color(p.event.slot), borderColor: bg, borderWidth: 1 },
              label: { show: p.show, position: p.left ? 'left' : 'right', distance: 6 + p.reach, color: muted, fontSize: 11, formatter: () => p.text },
            })),
          },
        ] : []),
      ],
    }, { notMerge: true });
  }

  useImperativeHandle(props.ref, () => ({
    toPng: () => chart.current?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: surface.current }) ?? null,
  }), []);

  useEffect(() => {
    const element = box.current; if (!element) return;
    const instance = chart.current = echarts.init(element), theme = matchMedia('(prefers-color-scheme: dark)');
    instance.on('legendselectchanged', event => {
      const selected = (event as { selected: Record<string, boolean> }).selected;
      latest.current.onHiddenChange(Object.keys(selected).filter(id => !selected[id]));
    });
    const resize = new ResizeObserver(() => { instance.resize(); render(); }); resize.observe(element);
    // The header toggle sets html[data-color-mode]; without it the OS setting decides.
    const toggle = new MutationObserver(render); toggle.observe(document.documentElement, { attributeFilter: ['data-color-mode'] });
    theme.addEventListener('change', render);
    return () => { resize.disconnect(); toggle.disconnect(); theme.removeEventListener('change', render); instance.dispose(); chart.current = null; };
  }, []);
  useEffect(render);

  return <div ref={box} className="sales-chart" role="img" aria-label={props.label} />;
}
