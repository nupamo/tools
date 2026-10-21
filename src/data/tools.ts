export type HomeIconName = 'aperture' | 'bot';

export interface Tool {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: HomeIconName;
  processing: { server: boolean; models: { name: string; optional?: boolean }[]; note?: string };
}

// Only list tools that have a working page. No placeholders or upcoming cards.
export const tools: Tool[] = [
  {
    slug: 'photo',
    name: '사진 보정',
    description: '색감·빛·초점을 조절하고, 테두리를 꾸밉니다.',
    category: '이미지',
    icon: 'aperture',
    processing: { server: false, models: [{ name: 'Depth Anything V2 Small', optional: true }], note: '사진 전송 없음 · 모델만 다운로드' },
  },
];

export interface Project {
  href: string;
  name: string;
  description: string;
  domain: string;
  icon: HomeIconName;
}

// Other projects linked below the tool list. They are not tools and open on their own sites.
export const projects: Project[] = [
  { href: 'https://bot.nupa.moe/', name: 'Pamo_bot', description: '디스코드 봇', domain: 'bot.nupa.moe', icon: 'bot' },
];
