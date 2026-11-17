import type { Localized } from '../i18n';

export type HomeIconName = 'aperture' | 'bot' | 'music' | 'chart';

export interface Tool {
  slug: string;
  name: Localized;
  description: Localized;
  category: Localized;
  icon: HomeIconName;
  processing: { server: boolean; models: { name: string; optional?: boolean }[]; note?: Localized };
}

// Only list tools that have a working page. No placeholders or upcoming cards.
export const tools: Tool[] = [
  {
    slug: 'photo',
    name: { ko: '사진 보정', en: 'Photo editor', ja: '写真補正' },
    description: {
      ko: '색감·빛·초점을 조절하고, 테두리를 꾸밉니다.',
      en: 'Adjust color, light and focus, and add a frame.',
      ja: '色・光・ピントを調整し、フチを飾ります。',
    },
    category: { ko: '이미지', en: 'Image', ja: '画像' },
    icon: 'aperture',
    processing: {
      server: false, models: [{ name: 'Depth Anything V2 Small', optional: true }],
      note: { ko: '사진 전송 없음 · 모델만 다운로드', en: 'Photos stay on device · only the model downloads', ja: '写真の送信なし · モデルのみダウンロード' },
    },
  },
  {
    slug: 'midi2mml',
    name: { ko: 'MIDI2MML', en: 'MIDI2MML', ja: 'MIDI2MML' },
    description: {
      ko: 'MIDI를 범용·마비노기 MML로 바꾸고, 피아노롤로 보며 들어봅니다.',
      en: 'Convert MIDI to generic or Mabinogi MML, with a piano roll and playback.',
      ja: 'MIDI を汎用・マビノギ用 MML に変換し、ピアノロールで確認・再生します。',
    },
    category: { ko: '음악', en: 'Music', ja: '音楽' },
    icon: 'music',
    processing: { server: false, models: [], note: { ko: '파일 전송 없음', en: 'Files stay on device', ja: 'ファイルの送信なし' } },
  },
  {
    slug: 'booth-sales',
    name: { ko: 'BOOTH 매출 차트', en: 'BOOTH sales chart', ja: 'BOOTH 売上チャート' },
    description: {
      ko: 'BOOTH 주문 CSV를 제품별 매출 차트로 그리고, 업데이트·할인 같은 이벤트를 함께 표시합니다.',
      en: 'Chart a BOOTH order CSV by product, with events such as updates and sales marked on it.',
      ja: 'BOOTH の注文 CSV を商品別の売上チャートにし、アップデートやセールなどのイベントを重ねて表示します。',
    },
    category: { ko: '통계', en: 'Stats', ja: '統計' },
    icon: 'chart',
    processing: { server: false, models: [], note: { ko: 'CSV 전송 없음', en: 'CSV stays on device', ja: 'CSV の送信なし' } },
  },
];

export interface Project {
  href: string;
  name: string;
  description: Localized;
  icon: HomeIconName;
}

// Other projects linked below the tool list. They are not tools and open on their own sites.
export const projects: Project[] = [
  { href: 'https://bot.nupa.moe/', name: 'Pamo_bot', description: { ko: '디스코드 봇', en: 'Discord bot', ja: 'Discord ボット' }, icon: 'bot' },
];
