import type { Localized } from '../i18n';

export type HomeIconName = 'aperture' | 'bot';

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
];

export interface Project {
  href: string;
  name: string;
  description: Localized;
  domain: string;
  icon: HomeIconName;
}

// Other projects linked below the tool list. They are not tools and open on their own sites.
export const projects: Project[] = [
  { href: 'https://bot.nupa.moe/', name: 'Pamo_bot', description: { ko: '디스코드 봇', en: 'Discord bot', ja: 'Discord ボット' }, domain: 'bot.nupa.moe', icon: 'bot' },
];
