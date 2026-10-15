export interface Tool {
  slug: string;
  name: string;
  description: string;
  category: string;
  processing: { server: boolean; model: string | null; note?: string };
}

// Only list tools that have a working page. No placeholders or upcoming cards.
export const tools: Tool[] = [
  {
    slug: 'photo',
    name: '사진 보정',
    description: '피부를 부드럽게 하고, 인물 사진의 톤과 색감을 조절합니다.',
    category: '이미지',
    processing: { server: false, model: null, note: '사진은 이 기기에서만 처리됩니다.' },
  },
];
