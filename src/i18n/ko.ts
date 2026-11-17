import type { PhotoMessage } from '../lib/photo/messages';
import type { MidiMessage } from '../lib/midi/messages';
import type { BoothMessage } from '../lib/booth/messages';

const ko = {
  site: {
    darkMode: '다크 모드', skip: '본문으로 이동', home: 'tools 홈', tagline: '직접 쓰려고 만든 작은 도구들.',
    tools: '도구', otherProjects: '다른 프로젝트', newTab: '(새 창에서 열림)', language: '언어',
  },
  processing: {
    label: '처리 방식', server: (used: boolean) => `서버 사용 ${used ? '있음' : '없음'}`,
    onDevice: (model: string, optional?: boolean) => `온디바이스 · ${model}${optional ? ' (선택)' : ''}`, noModel: '온디바이스 모델 없음',
  },
  midi: {
    noscript: 'MIDI2MML을 사용하려면 JavaScript를 켜주세요. 파일은 서버로 전송되지 않습니다.',
    file: 'MIDI 파일', start: 'MIDI 파일을 골라 시작하세요.', choose: 'MIDI 선택', another: '다른 MIDI',
    drop: 'MIDI 파일을 놓거나 선택하세요', limits: '.mid · .midi · 최대 5MB', opening: 'MIDI 여는 중…',
    summary: (notes: string, time: string) => `음표 ${notes}개 · ${time}`,
    play: '재생', pause: '일시정지', stop: '정지', zoomIn: '확대', zoomOut: '축소',
    roll: '피아노롤. 누르면 그 위치부터 재생합니다.', rollHint: '피아노롤을 누르면 그 위치부터 재생합니다.',
    settings: '변환 설정', format: 'MML 형식', formats: { generic: '범용', mabinogi: '마비노기' },
    grid: '음표 단위', grids: { '8': '8분음표', '16': '16분음표', '32': '32분음표', '64': '64분음표', '12': '8분 셋잇단', '24': '16분 셋잇단' },
    voices: '트랙 수', voiceCount: (n: number) => `${n}트랙`, scores: '악보 수', scoreCount: (n: number) => `${n}개 · 트랙 ${n * 3}개`,
    volume: '세기를 볼륨(v)으로 쓰기', drums: '드럼 채널 포함', tracks: 'MIDI 트랙',
    trackName: (i: number, name: string) => name || `트랙 ${i + 1}`, trackNotes: (n: string) => `음표 ${n}개`, drumTag: '드럼',
    result: (kept: string, dropped: string) => `음표 ${kept}개 변환${dropped === '0' ? '' : ` · ${dropped}개 제외`}`,
    droppedHint: '동시에 울리는 음이 트랙 수보다 많으면 제외됩니다. 트랙 수를 늘려보세요.',
    output: '결과', copy: '복사', voice: (i: number) => `트랙 ${i + 1}`, score: (i: number) => `악보 ${i + 1}`,
    parts: ['멜로디', '화음 1', '화음 2'], chars: (n: string) => `${n}자`, empty: '선택한 트랙에 음표가 없습니다.',
    status: {
      notMidi: 'MIDI 파일이 아닙니다.', smpte: 'SMPTE 시간 형식의 MIDI는 지원하지 않습니다.', truncated: 'MIDI 파일이 손상되었습니다.',
      noNotes: '음표가 없는 MIDI 파일입니다.', tooManyNotes: '음표가 너무 많습니다. 10만 개까지 지원합니다.',
      fileTooLarge: '5MB 이하의 MIDI 파일을 선택해주세요.', openFailed: 'MIDI 파일을 열지 못했습니다.',
      audioFailed: '소리를 재생하지 못했습니다.', copied: '복사했습니다.', copyFailed: '복사하지 못했습니다. 직접 선택해 복사해주세요.',
    } satisfies Record<MidiMessage, string>,
  },
  booth: {
    noscript: 'BOOTH 매출 차트를 사용하려면 JavaScript를 켜주세요. CSV는 서버로 전송되지 않습니다.',
    file: 'BOOTH 주문 CSV', start: 'BOOTH에서 받은 주문 CSV를 골라 시작하세요.', choose: 'CSV 선택', another: '다른 CSV',
    drop: '주문 CSV를 놓거나 선택하세요', limits: 'BOOTH Orders(주문) → 宛名印刷用CSV(주소 인쇄용 CSV) · 최대 20MB', opening: 'CSV 여는 중…',
    summary: (orders: string, from: string, to: string) => `주문 ${orders}건 · ${from} ~ ${to}`,
    savePng: 'PNG 저장', view: '보기', views: { trend: '추이', insights: '분석' },
    settings: '차트 설정', period: '기간', presets: { all: '전체', m3: '최근 3개월', m6: '최근 6개월', y1: '최근 1년', custom: '직접 지정' },
    from: '시작일', to: '종료일', unit: '단위', units: { day: '일', week: '주', month: '월' }, metric: '지표', metrics: { revenue: '매출', orders: '판매 수' },
    titles: {
      revenue: { day: '제품별 일간 매출', week: '제품별 주간 매출', month: '제품별 월간 매출' },
      orders: { day: '제품별 일간 판매 수', week: '제품별 주간 판매 수', month: '제품별 월간 판매 수' },
    },
    unitNotes: { day: '일 단위', week: '주 단위(월요일 시작)', month: '월 단위' },
    total: '합계', totalRevenue: (amount: string) => `합계 ${amount}`, totalCount: (count: string) => `${count}개 판매`, orderCount: (count: string) => `주문 ${count}건`,
    count: (n: string) => `${n}개`, other: '기타', chartLabel: '제품별 매출 누적 막대 차트와 이벤트 타임라인', emptyRange: '이 기간에는 주문이 없습니다.',
    events: '이벤트', eventLane: '이벤트',
    eventsHint: '한 줄에 하나씩: 날짜 | 종류 | 제품 | 내용. 제품을 빼면 전체 이벤트, 날짜를 2026-07-01~2026-07-15처럼 쓰면 기간이 됩니다. 종류: update · sale · viral · release · note',
    eventsPlaceholder: '2026-06-17 | update | Split MMD Player | v1.1.0\n2026-07-01~2026-07-15 | sale | 여름 할인\n2026-11-11 | viral | 유명 계정이 소개',
    copyPrompt: 'AI용 작성 안내 복사', eventCount: (n: number) => `${n}개 표시`,
    kinds: { release: '출시', update: '업데이트', sale: '할인', viral: '바이럴', note: '메모' },
    issue: (line: number, text: string) => `${line}행: ${text}`,
    issues: { eventFormat: '형식을 읽지 못했습니다.', eventDate: '날짜를 읽지 못했습니다.', eventProduct: '제품을 찾지 못해 전체 이벤트로 표시합니다.' },
    tiles: { revenue: '매출', orders: '주문', buyers: '구매자', average: '주문당 평균', repeat: (n: string) => `재구매 ${n}명` },
    payments: '결제 수단', heat: '요일·시간대별 주문', heatNote: 'CSV에 적힌 시각 기준', heatCell: (day: string, hour: number, n: number) => `${day} ${hour}시 · ${n}건`,
    weekdays: ['월', '화', '수', '목', '금', '토', '일'],
    table: { caption: '제품별 합계', product: '제품', quantity: '판매 수', revenue: '매출', share: '비중', buyers: '구매자', repeat: '재구매자' },
    unpaid: (n: number) => `결제되지 않은 주문 ${n}건은 제외했습니다.`, shared: (n: number) => `여러 제품을 함께 산 주문 ${n}건은 금액을 수량 비율로 나눴습니다.`,
    prompt: (products: string, from: string, to: string) => `BOOTH 매출 차트에 표시할 이벤트 목록을 만들어줘.

형식: 한 줄에 이벤트 하나, 필드는 | 로 구분. 설명 없이 목록만 출력.
날짜 | 종류 | 제품 | 내용
- 날짜: YYYY-MM-DD. 기간은 YYYY-MM-DD~YYYY-MM-DD
- 종류: update(업데이트·패치), sale(할인·가격 변경), viral(소개·바이럴), release(출시), note(기타)
- 제품: 아래 목록의 상품 ID 또는 이름. 특정 제품이 아니면 이 필드를 빼고 "날짜 | 종류 | 내용"
- 내용: 차트에 그대로 표시되므로 짧게 (예: v1.2.0, 여름 할인 종료)
- # 으로 시작하는 줄은 주석

제품 (상품 ID | 이름):
${products}

차트 기간: ${from} ~ ${to}

예:
2026-06-17 | update | 8450925 | v1.1.0
2026-07-01~2026-07-15 | sale | 여름 할인
2026-11-11 | viral | 유명 계정이 소개

아래 자료에서 이벤트를 찾아 정리해줘:
`,
    status: {
      notCsv: 'CSV 파일이 아닙니다.', notBooth: 'BOOTH 주문 CSV 형식이 아닙니다.', noOrders: '결제된 주문이 없습니다.',
      fileTooLarge: '20MB 이하의 CSV를 선택해주세요.', openFailed: 'CSV를 열지 못했습니다.',
      saved: '차트 이미지를 만들었습니다.', saveFailed: '차트 이미지를 저장하지 못했습니다.', copied: '복사했습니다.', copyFailed: '복사하지 못했습니다.',
    } satisfies Record<BoothMessage, string>,
  },
  photo: {
    noscript: '사진 보정을 사용하려면 JavaScript를 켜주세요. 사진은 서버로 전송되지 않습니다.',
    file: '사진 파일', start: '사진 한 장을 골라 시작하세요.', choose: '사진 선택', another: '다른 사진',
    undo: '실행 취소', redo: '다시 실행', resetAll: '전체 초기화', oneAtATime: '사진은 한 장씩 선택해주세요.',
    pickArea: '사진 위치 선택. 방향키로 이동할 수 있습니다.', preview: '사진 미리보기',
    edited: '보정된 사진', originalPhoto: '원본 사진', previousEdit: '직전 편집 결과',
    opening: '사진 여는 중…', drop: '사진을 놓거나 선택하세요', limits: '최대 40MB · 2,400만 화소 · 긴 변 8,192px',
    labels: { original: '원본', previous: '이전 편집', depth: '깊이 지도', current: '보정' },
    exporting: '원본 크기로 저장 중…', rendering: '미리보기 반영 중…',
    adjustments: '사진 조절', mode: '편집 모드', presetsTab: '프리셋', advancedTab: '고급', kind: '보정 종류', resetGroup: '이 항목 초기화',
    tabs: { light: '밝기', color: '색감', focus: '초점', glow: '뽀샤시', flare: '플레어', frame: '테두리' },
    sliders: {
      exposure: '노출', contrast: '대비', highlights: '밝은 영역', shadows: '어두운 영역',
      warmth: '색온도', tint: '색조', saturation: '채도', vibrance: '생동감',
      blur: '흐림 강도', focusRadius: '선명한 범위', depthFocus: '초점 깊이', focusRange: '선명한 깊이 범위',
      glow: '뽀샤시 강도', glowRadius: '빛 번짐 크기', flare: '빛 강도', flareSize: '빛 크기',
      frameWidth: '여백 두께', frameRadius: '모서리 둥글기',
    },
    focusMode: '초점 방식', focusModes: { off: '없음', manual: '직접 지정', depth: '깊이 초점' }, depthLoading: '깊이 분석 중',
    focusNote: '사진을 누르거나 드래그해 초점을 맞춥니다.', depthUnsupported: '깊이 초점: WebGPU·하드웨어 가속 필요', showDepth: '깊이 지도 확인',
    glowNote: '사진 전체에 부드러운 빛을 더합니다.',
    flareShape: '플레어 모양', flares: { none: '없음', soft: '부드러운 빛', star: '빛줄기', ghost: '렌즈 고스트' },
    flareNote: '사진을 누르거나 드래그해 빛의 위치를 잡습니다.',
    frameLabel: '사진 테두리', frames: { none: '없음', solid: '단색 여백', double: '이중선', polaroid: '폴라로이드', round: '둥근 모서리' },
    frameColor: '여백 색', roundNote: '사진 크기를 유지하고 모서리만 둥글게 처리합니다.', frameNote: '원본을 자르지 않고 바깥에 여백을 더합니다.',
    reanalyze: '다시 분석', format: '저장 형식', png: 'PNG · 투명도 유지', jpeg: 'JPG · 품질 95%',
    compare: '누르는 동안 비교', viewOriginal: '원본 보기', viewPrevious: '이전 보기', saveDepth: '깊이 지도 저장', savePhoto: '사진 저장',
    notes: { depth: '현재 깊이 지도를 원본 크기 PNG로 저장', jpeg: 'JPG: 투명한 부분은 흰색으로 저장', frame: '원본 크기 보정 · 테두리만큼 여백 추가', plain: '원본 크기로 저장' },
    hold: { title: '누르고 있는 동안만 비교', hint: '꾹', sr: ' · 누르는 동안만 비교' },
    presets: {
      defaults: '기본 프리셋', names: { natural: '자연스럽게', warm: '따뜻하게', calm: '차분하게', mono: '흑백' },
      mine: '내 프리셋', newName: '새 프리셋 이름', save: '저장', select: '저장한 프리셋 선택',
      apply: '적용', overwrite: '덮어쓰기', delete: '삭제', empty: '저장된 프리셋이 없습니다.',
    },
    status: {
      photoSize: '사진 크기가 올바르지 않습니다.', depthFirst: '깊이 분석을 먼저 완료해주세요.',
      effectTooLarge: '이 기기의 GPU로 처리하기에는 효과 범위가 너무 큽니다. 효과 강도나 사진 크기를 줄여주세요.',
      webgl2Failed: 'WebGL2 초기화에 실패했습니다.', gpuLost: 'GPU 연결이 끊겼습니다. 사진을 다시 선택해주세요.',
      photoNotSelected: '사진을 먼저 선택해주세요.', photoProcessFailed: '사진 처리에 실패했습니다.',
      depthNeedsWebGPU: '깊이 초점은 WebGPU를 지원하는 브라우저와 하드웨어 가속이 필요합니다.', depthNoGpu: '깊이 초점에 사용할 GPU를 찾지 못했습니다.',
      depthDownload: '깊이 모델 다운로드', depthPreparing: '깊이 모델 준비 중', depthAnalyzing: '사진의 깊이 분석 중',
      depthIndistinct: '이 사진의 깊이를 구분하지 못했습니다.', depthFailed: '깊이 분석에 실패했습니다.',
      modelFailed: '모델 실행에 실패했습니다. 다시 시도해주세요.', modelTimeout: '모델 준비 시간이 초과되었습니다. 연결을 확인하고 다시 시도해주세요.',
      modelCancelled: '모델 작업이 취소되었습니다.', presetsUnreadable: '저장한 프리셋을 읽지 못했습니다.',
      presetNameRequired: '프리셋 이름을 입력해주세요.', presetNameTaken: '같은 이름이 있습니다. 다른 이름을 쓰거나 기존 프리셋을 덮어쓰세요.',
      canvasUnavailable: '사진을 표시할 수 없습니다.', depthIdle: '깊이 모델은 사용할 때만 로드', depthReady: '깊이 분석 완료',
      depthMissing: '깊이 지도가 없습니다.', previewFailed: '미리보기 표시 실패', photoProcessFailedRetry: '사진 처리에 실패했습니다. 사진을 다시 선택해주세요.',
      presetsStorageUnreadable: '저장한 프리셋을 읽지 못했습니다. 브라우저 저장소를 확인해주세요.',
      fileType: 'JPG, PNG, WebP, AVIF 사진을 선택해주세요.', fileTooLarge: '40MB 이하의 사진을 선택해주세요.',
      photoTooLarge: '최대 2,400만 화소, 긴 변 8,192px까지 지원합니다.', photoUnprocessable: '사진을 처리할 수 없습니다.',
      photoOpenFailed: '사진을 열지 못했습니다. 지원 형식과 파일 상태를 확인해주세요.', outOfMemory: '저장할 메모리가 부족합니다.',
      saveTimeout: '저장 시간이 초과되었습니다. 더 작은 사진으로 다시 시도해주세요.', saveBuildFailed: '저장할 사진을 만들지 못했습니다.',
      encodeFailed: '사진 인코딩 실패', saved: '저장할 사진을 만들었습니다.', saveFailed: '사진 저장 실패',
      presetWriteFailed: '프리셋을 저장하지 못했습니다. 브라우저 저장 공간과 권한을 확인해주세요.', presetSaved: '프리셋을 저장했습니다.',
      presetSaveFailed: '프리셋 저장 실패', presetOverwritten: '현재 설정으로 프리셋을 덮어썼습니다.', presetDeleted: '프리셋을 삭제했습니다.',
      presetAppliedDepthLoading: '프리셋 적용 · 깊이 모델 준비 중', presetAppliedDepthUnsupported: '프리셋 적용 · 깊이 초점은 WebGPU가 필요합니다.',
      legacyPresetName: '이전에 저장한 설정',
    } satisfies Record<PhotoMessage, string>,
  },
};

export type Messages = typeof ko;
export default ko;
