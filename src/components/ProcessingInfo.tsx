import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import type { Tool } from '../data/tools';
import { getMessages, type Locale } from '../i18n';
import ToolIcon from './ToolIcon';

export default function ProcessingInfo({ processing: p, locale }: { processing: Tool['processing']; locale: Locale }) {
  const t = getMessages(locale).processing;
  return <Theme theme={neutralTheme} mode="system">
    <ul className="processing-meta" aria-label={t.label}>
      <li className="processing-chip"><ToolIcon name="cloudOff" size="xsm" /><span>{t.server(p.server)}</span></li>
      {p.models.length ? p.models.map(model => <li className="processing-chip" key={model.name}>
        <ToolIcon name="cpu" size="xsm" /><span>{t.onDevice(model.name, model.optional)}</span>
      </li>) : <li className="processing-chip"><ToolIcon name="cpu" size="xsm" /><span>{t.noModel}</span></li>}
      {p.note && <li className="processing-chip"><ToolIcon name="shield" size="xsm" /><span>{p.note[locale]}</span></li>}
    </ul>
  </Theme>;
}
