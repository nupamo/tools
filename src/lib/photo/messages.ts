// Photo code reports status and errors as these codes, never as UI text.
// Workers send them as Error messages; the UI translates them with src/i18n.
export const PHOTO_MESSAGES = [
  'photoSize', 'depthFirst', 'effectTooLarge', 'webgl2Failed', 'gpuLost', 'photoNotSelected', 'photoProcessFailed',
  'depthNeedsWebGPU', 'depthNoGpu', 'depthDownload', 'depthPreparing', 'depthAnalyzing', 'depthIndistinct', 'depthFailed',
  'modelFailed', 'modelTimeout', 'modelCancelled', 'presetsUnreadable', 'presetNameRequired', 'presetNameTaken',
  'canvasUnavailable', 'depthIdle', 'depthReady', 'depthMissing', 'previewFailed', 'photoProcessFailedRetry', 'presetsStorageUnreadable',
  'fileType', 'fileTooLarge', 'photoTooLarge', 'photoUnprocessable', 'photoOpenFailed', 'outOfMemory', 'saveTimeout',
  'saveBuildFailed', 'encodeFailed', 'saved', 'saveFailed', 'presetWriteFailed', 'presetSaved', 'presetSaveFailed',
  'presetOverwritten', 'presetDeleted', 'presetAppliedDepthLoading', 'presetAppliedDepthUnsupported', 'legacyPresetName',
] as const;
export type PhotoMessage = typeof PHOTO_MESSAGES[number];
export const photoError = (code: PhotoMessage) => new Error(code);
export const isPhotoMessage = (value: unknown): value is PhotoMessage => (PHOTO_MESSAGES as readonly unknown[]).includes(value);
