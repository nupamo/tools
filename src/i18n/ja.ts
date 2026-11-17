import type { Messages } from './ko';

const ja: Messages = {
  site: {
    darkMode: 'ダークモード', skip: '本文へ移動', home: 'tools ホーム', tagline: '自分で使うために作った小さなツール。',
    tools: 'ツール', otherProjects: 'ほかのプロジェクト', newTab: '（新しいタブで開きます）', language: '言語',
  },
  processing: {
    label: '処理方法', server: (used: boolean) => `サーバー利用 ${used ? 'あり' : 'なし'}`,
    onDevice: (model: string, optional?: boolean) => `オンデバイス · ${model}${optional ? '（任意）' : ''}`, noModel: 'オンデバイスモデルなし',
  },
  midi: {
    noscript: 'MIDI2MML を使うには JavaScript を有効にしてください。ファイルはサーバーに送信されません。',
    file: 'MIDI ファイル', start: 'MIDI ファイルを選んで始めましょう。', choose: 'MIDI を選択', another: '別の MIDI',
    drop: 'MIDI ファイルをドロップするか選択してください', limits: '.mid · .midi · 最大 5MB', opening: 'MIDI を開いています…',
    summary: (notes: string, time: string) => `音符 ${notes} 個 · ${time}`,
    play: '再生', pause: '一時停止', stop: '停止', zoomIn: '拡大', zoomOut: '縮小',
    roll: 'ピアノロール。押した位置から再生します。', rollHint: 'ピアノロールを押すと、その位置から再生します。',
    settings: '変換設定', format: 'MML 形式', formats: { generic: '汎用', mabinogi: 'マビノギ' },
    grid: '音符の単位', grids: { '8': '8分音符', '16': '16分音符', '32': '32分音符', '64': '64分音符', '12': '8分3連符', '24': '16分3連符' },
    voices: 'トラック数', voiceCount: (n: number) => `${n} トラック`, scores: '楽譜の数', scoreCount: (n: number) => `${n} 枚 · ${n * 3} トラック`,
    volume: 'ベロシティを音量 (v) で書く', drums: 'ドラムチャンネルを含める', tracks: 'MIDI トラック',
    trackName: (i: number, name: string) => name || `トラック ${i + 1}`, trackNotes: (n: string) => `音符 ${n} 個`, drumTag: 'ドラム',
    result: (kept: string, dropped: string) => `音符 ${kept} 個を変換${dropped === '0' ? '' : ` · ${dropped} 個を除外`}`,
    droppedHint: '同時に鳴る音がトラック数より多いと除外されます。トラック数を増やしてみてください。',
    output: '結果', copy: 'コピー', voice: (i: number) => `トラック ${i + 1}`, score: (i: number) => `楽譜 ${i + 1}`,
    parts: ['メロディー', '和音 1', '和音 2'], chars: (n: string) => `${n} 文字`, empty: '選んだトラックに音符がありません。',
    status: {
      notMidi: 'MIDI ファイルではありません。', smpte: 'SMPTE 形式のタイミングの MIDI には対応していません。', truncated: 'MIDI ファイルが壊れています。',
      noNotes: '音符のない MIDI ファイルです。', tooManyNotes: '音符が多すぎます。10 万個まで対応しています。',
      fileTooLarge: '5MB 以下の MIDI ファイルを選んでください。', openFailed: 'MIDI ファイルを開けませんでした。',
      audioFailed: '音を再生できませんでした。', copied: 'コピーしました。', copyFailed: 'コピーできませんでした。テキストを選択してコピーしてください。',
    },
  },
  booth: {
    noscript: 'BOOTH 売上チャートを使うには JavaScript を有効にしてください。CSV はサーバーに送信されません。',
    file: 'BOOTH 注文 CSV', start: 'BOOTH からダウンロードした注文 CSV を選んでください。', choose: 'CSV を選択', another: '別の CSV',
    drop: '注文 CSV をドロップまたは選択', limits: 'BOOTH 注文管理 → CSV ダウンロード · 最大 20MB', opening: 'CSV を開いています…',
    summary: (orders, from, to) => `注文 ${orders}件 · ${from} ~ ${to}`,
    savePng: 'PNG 保存', view: '表示', views: { trend: '推移', insights: '分析' },
    settings: 'チャート設定', period: '期間', presets: { all: 'すべて', m3: '直近3か月', m6: '直近6か月', y1: '直近1年', custom: '指定' },
    from: '開始日', to: '終了日', unit: '単位', units: { day: '日', week: '週', month: '月' }, metric: '指標', metrics: { revenue: '売上', orders: '販売数' },
    titles: {
      revenue: { day: '商品別 日次売上', week: '商品別 週次売上', month: '商品別 月次売上' },
      orders: { day: '商品別 日次販売数', week: '商品別 週次販売数', month: '商品別 月次販売数' },
    },
    unitNotes: { day: '日単位', week: '週単位(月曜始まり)', month: '月単位' },
    total: '合計', totalRevenue: amount => `合計 ${amount}`, totalCount: count => `${count}個販売`, orderCount: count => `注文 ${count}件`,
    count: n => `${n}個`, other: 'その他', chartLabel: '商品別売上の積み上げ棒グラフとイベントのタイムライン', emptyRange: 'この期間に注文はありません。',
    events: 'イベント', eventLane: 'イベント',
    eventsHint: '1行に1件: 日付 | 種類 | 商品 | 内容。商品を省くとショップ全体のイベント、日付を 2026-07-01~2026-07-15 と書くと期間になります。種類: update · sale · viral · release · note',
    eventsPlaceholder: '2026-06-17 | update | Split MMD Player | v1.1.0\n2026-07-01~2026-07-15 | sale | サマーセール\n2026-11-11 | viral | 有名アカウントが紹介',
    copyPrompt: 'AI 用の書き方をコピー', eventCount: n => `${n}件表示`,
    kinds: { release: '発売', update: 'アップデート', sale: 'セール', viral: 'バズ', note: 'メモ' },
    issue: (line, text) => `${line}行目: ${text}`,
    issues: { eventFormat: '形式を読み取れません。', eventDate: '日付を読み取れません。', eventProduct: '商品が見つからないため、全体のイベントとして表示します。' },
    tiles: { revenue: '売上', orders: '注文', buyers: '購入者', average: '注文あたり平均', repeat: n => `リピート ${n}人` },
    payments: '支払い方法', heat: '曜日・時間帯別の注文', heatNote: 'CSV に書かれた時刻のまま', heatCell: (day, hour, n) => `${day} ${hour}時 · ${n}件`,
    weekdays: ['月', '火', '水', '木', '金', '土', '日'],
    table: { caption: '商品別の合計', product: '商品', quantity: '販売数', revenue: '売上', share: '割合', buyers: '購入者', repeat: 'リピーター' },
    unpaid: n => `未払いの注文 ${n}件は除外しました。`, shared: n => `複数の商品を含む注文 ${n}件は、金額を数量の割合で分けました。`,
    prompt: (products, from, to) => `BOOTH の売上チャートに表示するイベント一覧を作ってください。

形式: 1行に1件、項目は | で区切る。説明なしで一覧だけ出力。
日付 | 種類 | 商品 | 内容
- 日付: YYYY-MM-DD。期間は YYYY-MM-DD~YYYY-MM-DD
- 種類: update(アップデート・パッチ)、sale(セール・価格変更)、viral(紹介・バズ)、release(発売)、note(その他)
- 商品: 下の一覧の商品 ID または名前。特定の商品でなければこの項目を省いて「日付 | 種類 | 内容」
- 内容: そのままチャートに表示されるので短く (例: v1.2.0、サマーセール終了)
- # で始まる行はコメント

商品 (商品 ID | 名前):
${products}

チャートの期間: ${from} ~ ${to}

例:
2026-06-17 | update | 8450925 | v1.1.0
2026-07-01~2026-07-15 | sale | サマーセール
2026-11-11 | viral | 有名アカウントが紹介

以下の資料からイベントを探して整理してください:
`,
    status: {
      notCsv: 'CSV ファイルではありません。', notBooth: 'BOOTH の注文 CSV ではありません。', noOrders: '支払い済みの注文がありません。',
      fileTooLarge: '20MB 以下の CSV を選んでください。', openFailed: 'CSV を開けませんでした。',
      saved: 'チャート画像を作成しました。', saveFailed: 'チャート画像を保存できませんでした。', copied: 'コピーしました。', copyFailed: 'コピーできませんでした。',
    },
  },
  photo: {
    noscript: '写真補正を使うには JavaScript を有効にしてください。写真はサーバーに送信されません。',
    file: '写真ファイル', start: '写真を 1 枚選んで始めましょう。', choose: '写真を選択', another: '別の写真',
    undo: '元に戻す', redo: 'やり直す', resetAll: 'すべてリセット', oneAtATime: '写真は 1 枚ずつ選んでください。',
    pickArea: '写真上の位置を選択。矢印キーで移動できます。', preview: '写真のプレビュー',
    edited: '補正した写真', originalPhoto: '元の写真', previousEdit: '直前の編集結果',
    opening: '写真を開いています…', drop: '写真をドロップするか選択してください', limits: '最大 40MB · 2,400 万画素 · 長辺 8,192px',
    labels: { original: '元画像', previous: '前の編集', depth: '深度マップ', current: '補正' },
    exporting: '元のサイズで保存中…', rendering: 'プレビューを更新中…',
    adjustments: '写真の調整', mode: '編集モード', presetsTab: 'プリセット', advancedTab: '詳細', kind: '補正の種類', resetGroup: 'この項目をリセット',
    tabs: { light: '明るさ', color: '色', focus: 'フォーカス', glow: 'ソフト', flare: 'フレア', frame: 'フチ' },
    sliders: {
      exposure: '露出', contrast: 'コントラスト', highlights: 'ハイライト', shadows: 'シャドウ',
      warmth: '色温度', tint: '色かぶり', saturation: '彩度', vibrance: '自然な彩度',
      blur: 'ぼかしの強さ', focusRadius: 'くっきりした範囲', depthFocus: 'ピントの深さ', focusRange: 'くっきりした深さの範囲',
      glow: 'ソフトの強さ', glowRadius: '光のにじみ', flare: '光の強さ', flareSize: '光の大きさ',
      frameWidth: '余白の幅', frameRadius: '角の丸み',
    },
    focusMode: 'フォーカス方式', focusModes: { off: 'なし', manual: '手動指定', depth: '深度フォーカス' }, depthLoading: '深度を解析中',
    focusNote: '写真をタップまたはドラッグしてピントを合わせます。', depthUnsupported: '深度フォーカス：WebGPU とハードウェアアクセラレーションが必要', showDepth: '深度マップを表示',
    glowNote: '写真全体にやわらかな光を加えます。',
    flareShape: 'フレアの形', flares: { none: 'なし', soft: 'やわらかな光', star: '光芒', ghost: 'レンズゴースト' },
    flareNote: '写真をタップまたはドラッグして光の位置を決めます。',
    frameLabel: '写真のフチ', frames: { none: 'なし', solid: '単色の余白', double: '二重線', polaroid: 'ポラロイド', round: '角丸' },
    frameColor: '余白の色', roundNote: '写真のサイズはそのままで、角だけを丸くします。', frameNote: '元の写真を切らずに外側へ余白を加えます。',
    reanalyze: '再解析', format: '保存形式', png: 'PNG · 透明を保持', jpeg: 'JPG · 品質 95%',
    compare: '押している間だけ比較', viewOriginal: '元画像', viewPrevious: '前の編集', saveDepth: '深度マップを保存', savePhoto: '写真を保存',
    notes: { depth: '現在の深度マップを元のサイズの PNG で保存', jpeg: 'JPG：透明な部分は白で保存', frame: '元のサイズで補正 · フチの分だけ余白を追加', plain: '元のサイズで保存' },
    hold: { title: '押している間だけ比較', hint: '長押し', sr: ' · 押している間だけ比較' },
    presets: {
      defaults: '基本プリセット', names: { natural: 'ナチュラル', warm: 'あたたかく', calm: '落ち着いた', mono: 'モノクロ' },
      mine: 'マイプリセット', newName: '新しいプリセット名', save: '保存', select: '保存したプリセットを選択',
      apply: '適用', overwrite: '上書き', delete: '削除', empty: '保存したプリセットはありません。',
    },
    status: {
      photoSize: '写真のサイズが正しくありません。', depthFirst: '先に深度解析を完了してください。',
      effectTooLarge: 'このデバイスの GPU で処理するには効果の範囲が大きすぎます。効果の強さか写真のサイズを下げてください。',
      webgl2Failed: 'WebGL2 の初期化に失敗しました。', gpuLost: 'GPU との接続が切れました。写真をもう一度選んでください。',
      photoNotSelected: '先に写真を選んでください。', photoProcessFailed: '写真の処理に失敗しました。',
      depthNeedsWebGPU: '深度フォーカスには WebGPU 対応ブラウザとハードウェアアクセラレーションが必要です。', depthNoGpu: '深度フォーカスに使える GPU が見つかりません。',
      depthDownload: '深度モデルをダウンロード中', depthPreparing: '深度モデルを準備中', depthAnalyzing: '写真の深度を解析中',
      depthIndistinct: 'この写真の深度を判別できませんでした。', depthFailed: '深度解析に失敗しました。',
      modelFailed: 'モデルの実行に失敗しました。もう一度お試しください。', modelTimeout: 'モデルの準備がタイムアウトしました。接続を確認してもう一度お試しください。',
      modelCancelled: 'モデルの処理がキャンセルされました。', presetsUnreadable: '保存したプリセットを読み込めませんでした。',
      presetNameRequired: 'プリセット名を入力してください。', presetNameTaken: '同じ名前があります。別の名前にするか、既存のプリセットを上書きしてください。',
      canvasUnavailable: '写真を表示できません。', depthIdle: '深度モデルは使うときだけ読み込みます', depthReady: '深度解析が完了しました',
      depthMissing: '深度マップがありません。', previewFailed: 'プレビューを表示できませんでした', photoProcessFailedRetry: '写真の処理に失敗しました。写真をもう一度選んでください。',
      presetsStorageUnreadable: '保存したプリセットを読み込めませんでした。ブラウザのストレージを確認してください。',
      fileType: 'JPG、PNG、WebP、AVIF の写真を選んでください。', fileTooLarge: '40MB 以下の写真を選んでください。',
      photoTooLarge: '最大 2,400 万画素、長辺 8,192px まで対応しています。', photoUnprocessable: '写真を処理できません。',
      photoOpenFailed: '写真を開けませんでした。対応形式とファイルの状態を確認してください。', outOfMemory: '保存に必要なメモリが足りません。',
      saveTimeout: '保存がタイムアウトしました。小さい写真でもう一度お試しください。', saveBuildFailed: '保存する写真を作成できませんでした。',
      encodeFailed: '写真のエンコードに失敗しました', saved: '保存する写真を作成しました。', saveFailed: '写真を保存できませんでした',
      presetWriteFailed: 'プリセットを保存できませんでした。ブラウザの空き容量と権限を確認してください。', presetSaved: 'プリセットを保存しました。',
      presetSaveFailed: 'プリセットを保存できませんでした', presetOverwritten: '現在の設定でプリセットを上書きしました。', presetDeleted: 'プリセットを削除しました。',
      presetAppliedDepthLoading: 'プリセットを適用 · 深度モデルを準備中', presetAppliedDepthUnsupported: 'プリセットを適用 · 深度フォーカスには WebGPU が必要です。',
      legacyPresetName: '以前に保存した設定',
    },
  },
};

export default ja;
