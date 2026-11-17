// BOOTH code reports errors and status as these codes, never as UI text. The UI translates them with src/i18n.
export const BOOTH_MESSAGES = ['notCsv', 'notBooth', 'noOrders', 'fileTooLarge', 'openFailed', 'saved', 'saveFailed', 'copied', 'copyFailed'] as const;
export type BoothMessage = typeof BOOTH_MESSAGES[number];
export const boothError = (code: BoothMessage) => new Error(code);
export const isBoothMessage = (value: unknown): value is BoothMessage => (BOOTH_MESSAGES as readonly unknown[]).includes(value);

// Problems found on one line of the event text.
export const EVENT_ISSUES = ['eventFormat', 'eventDate', 'eventProduct'] as const;
export type EventIssueCode = typeof EVENT_ISSUES[number];
