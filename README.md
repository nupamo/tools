# tools

직접 쓰려고 만든 작은 도구들.

## 개발

Node.js 24 이상을 사용합니다.

```sh
npm ci
npm run dev
```

```sh
npm run check
npm test
npm run build
```

Astro 정적 빌드 결과는 `dist/`입니다. 서버 런타임, 로그인, API 키는 필요하지 않습니다. Astro 페이지와 도구 목록은 정적으로 렌더링하며, 사진 보정 화면만 React island로 실행합니다. Astryx 0.7.0의 실제 Button·Slider 컴포넌트와 Neutral 테마를 사용합니다. 현재 Astryx는 React 19 이상을 요구합니다. 앞으로 다른 도구가 Vue 등을 사용해도 Astro integration과 해당 도구의 island를 추가하면 됩니다.

## 사진 보정

- 피부색 영역의 부드러움·밝기, 전체 밝기·따뜻함·대비·채도.
- 자연스럽게 프리셋, 초기화, 원본 비교, 피부 영역 확인.
- 브라우저 Web Worker에서 처리. 서버 전송과 AI 모델 다운로드 없음.
- JPG/PNG/WebP/AVIF 입력. 실제 디코딩 가능 여부는 브라우저에 따름.
- 최대 40MB, 2,400만 화소, 긴 변 8,192px. 초과 파일은 알리고 거절하며 자동 축소하지 않음.
- 미리보기는 긴 변 최대 1,400px. 저장은 동일 설정으로 원본 해상도를 다시 처리.
- PNG는 투명도 유지. JPG는 품질 95%, 투명 영역은 흰색.
- 브라우저 디코딩 시 EXIF 방향을 반영하고, 저장 파일에는 GPS 등 원본 촬영 메타데이터를 복사하지 않음.
- 원본 파일은 변경하지 않으며, 보정본은 `원본이름-edited`로 저장.

피부 보정은 YCbCr 피부색 마스크와 경계를 보존하는 평활화입니다. 얼굴 인식·인물 분할·얼굴형 변경·생성형 복원이 아닙니다. 피부와 비슷한 벽·목재도 선택될 수 있고, 조명·피부색에 따라 적용 범위가 달라집니다. UI의 ‘피부 영역 확인’으로 범위를 볼 수 있습니다. 해당 표시와 원본 비교 상태는 저장 결과에 영향을 주지 않습니다.

Canvas 디코딩·인코딩을 거치므로 RAW/HDR/광색역 보존 편집은 지원하지 않습니다. 모바일 및 큰 사진은 기기 메모리 성능의 영향을 받습니다. 처리 실패 시 파일을 다시 선택할 수 있습니다. HEIC은 먼저 지원 형식으로 변환해야 합니다.

## 도구 추가

1. `src/data/tools.ts`에 이름·한 줄 설명·카테고리·처리 정보를 등록합니다.
2. `src/pages/<slug>.astro`에 페이지를 추가합니다.
3. 제목 바로 아래에 서버 사용 여부와 온디바이스 모델명을 표시합니다.
4. 데스크톱은 화면 높이 내 작업 영역, 모바일은 자연스러운 스크롤을 사용합니다.

동작하지 않는 도구, ‘곧 공개’ 항목, 홍보 섹션은 목록에 넣지 않습니다.

## 정적 호스팅

일반 정적 호스팅에는 `dist/`를 배포합니다. GitHub Pages의 `/tools/` 경로를 사용할 경우:

```sh
BASE_PATH=/tools/ npm run build
```

CI는 검사·테스트·빌드를 수행하고 `tools-static` 및 GitHub Pages 아티팩트를 만듭니다. `main`에 push하면 검증 성공 후 GitHub Pages로 자동 배포합니다. Pull request는 검증·빌드만 수행합니다.

최초 한 번 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택해야 합니다. 이 설정은 저장소 관리자 권한이 필요하며, 기본 `GITHUB_TOKEN`으로는 최초 활성화할 수 없습니다. 활성화 전에 실행되어 실패한 배포는 Actions에서 **Re-run failed jobs**로 재실행합니다.

배포 주소는 `https://nupamo.github.io/tools/`입니다. Pages 빌드 시 `BASE_PATH=/tools/`, `SITE_URL=https://nupamo.github.io`를 지정합니다. 커스텀 도메인을 사용할 때에는 Pages 도메인 설정과 빌드의 `SITE_URL`·`BASE_PATH`를 함께 변경해야 합니다.

## 검증 범위

보정 처리의 원본 불변성·중립값·알파 보존·노출·피부색 선택·평활화·경계 입력과 Astro 타입 검사·정적 빌드를 검사합니다. 이 실행 환경에서는 브라우저 제어가 제공되지 않아 실제 브라우저의 사진 선택/다운로드 및 화면 크기별 레이아웃은 육안 검증하지 못했습니다.

디자인 시스템: [facebook/astryx](https://github.com/facebook/astryx) (MIT). 개별 의존성의 라이선스는 각 패키지에 따릅니다.
