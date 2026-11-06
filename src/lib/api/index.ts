/**
 * Warstwa API makiety – jedyne źródło danych dla widoków.
 * Dane: `$lib/mock/mock.ts`, logika: `$lib/mock/*`. Podpięcie backendu = podmiana implementacji w tym katalogu.
 */
export { ApiError, type ApiErrorCode } from './core';
export * from './session';
export * from './picking';
export * from './inbound';
export * from './allocation';
export * from './transfers';
export * from './inventory';
export * from './dispatch';
