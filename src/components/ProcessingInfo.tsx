import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import type { Tool } from '../data/tools';
import ToolIcon from './ToolIcon';

export default function ProcessingInfo({ processing: p }: { processing: Tool['processing'] }) {
  return <Theme theme={neutralTheme} mode="light">
    <ul className="processing-meta" aria-label="처리 방식">
      <li className="processing-chip"><ToolIcon name="cloudOff" size="xsm" /><span>서버 사용 {p.server ? '있음' : '없음'}</span></li>
      {p.models.length ? p.models.map(model => <li className="processing-chip" key={model.name}>
        <ToolIcon name="cpu" size="xsm" /><span>온디바이스 · {model.name}{model.optional && ' (선택)'}</span>
      </li>) : <li className="processing-chip"><ToolIcon name="cpu" size="xsm" /><span>온디바이스 모델 없음</span></li>}
      {p.note && <li className="processing-chip"><ToolIcon name="shield" size="xsm" /><span>{p.note}</span></li>}
    </ul>
  </Theme>;
}
