import type { Action } from '../engine/ev';

export const ACTION_DE: Record<Action, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};
export const ACTION_TITLE: Record<Action, string> = {
  hit: 'HIT',
  stand: 'STAND',
  double: 'DOUBLE',
  split: 'SPLIT',
  surrender: 'SURRENDER',
};
export const ACTION_SUB: Record<Action, string> = {
  hit: 'Karte ziehen',
  stand: 'Stehen bleiben',
  double: 'Einsatz verdoppeln',
  split: 'Karten trennen',
  surrender: 'Hand aufgeben',
};

/** Percent with sign, e.g. +1.23 % */
export function pct(x: number, digits = 2, sign = true): string {
  if (!Number.isFinite(x)) return '–';
  const v = (x * 100).toFixed(digits);
  return `${sign && x > 0 ? '+' : ''}${v.replace('.', ',')} %`;
}
/** Plain percent of a probability */
export function prob(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return '–';
  return `${(x * 100).toFixed(digits).replace('.', ',')} %`;
}
export function num(x: number, digits = 3, sign = false): string {
  if (!Number.isFinite(x)) return '–';
  const s = x.toFixed(digits).replace('.', ',');
  return sign && x > 0 ? '+' + s : s;
}
export function int(x: number): string {
  return Math.round(x).toLocaleString('de-DE');
}
export function money(x: number): string {
  return x.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
export function duration(ms: number): string {
  if (ms < 10000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}
export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
