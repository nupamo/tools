export interface Tool {
  slug: string;
  name: string;
  description: string;
  category: string;
  processing: { server: boolean; models: { name: string; optional?: boolean }[]; note?: string };
}

// Only list tools that have a working page. No placeholders or upcoming cards.
export const tools: Tool[] = [
  {
    slug: 'photo',
    name: '사진 보정',
    description: '색감·빛·초점을 조절하고, 인물과 배경을 꾸밉니다.',
    category: '이미지',
    processing: { server: false, models: [{ name: 'SelfieMulticlass' }, { name: 'Depth Anything V2 Small', optional: true }], note: '사진 전송 없음 · 모델만 다운로드' },
  },
];
