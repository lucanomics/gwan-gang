import { EXAM_DATE_ISO, FINAL_REVIEW_FROM_ISO, SEOUL_TZ } from './exam';

const SEOUL_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date in Asia/Seoul as YYYY-MM-DD, regardless of the device's timezone. */
export function seoulToday(now: Date = new Date()): string {
  return SEOUL_FORMATTER.format(now);
}

/**
 * The Seoul calendar date an instant falls on.
 *
 * Never slice a UTC ISO string for this: between 00:00 and 09:00 KST the UTC
 * date is still the previous day, so "today's questions" would silently reset
 * every Korean morning.
 */
export function seoulDateOf(iso: string, fallback = ''): string {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? fallback : seoulToday(new Date(parsed));
}

/** Whole days from one calendar date to another. Negative once the target has passed. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / DAY_MS);
}

export interface DDay {
  /** Days remaining. 0 on exam day, negative afterwards. */
  days: number;
  /** "D-6", "D-DAY" or "시험일 이후". */
  label: string;
  past: boolean;
  today: string;
}

export function dday(todayISO: string = seoulToday()): DDay {
  const days = daysBetween(todayISO, EXAM_DATE_ISO);
  if (days > 0) {
    return { days, label: `D-${days}`, past: false, today: todayISO };
  }
  if (days === 0) {
    return { days, label: 'D-DAY', past: false, today: todayISO };
  }
  return { days, label: '시험일 이후', past: true, today: todayISO };
}

/** From 2026-09-04 up to and including exam day, the home screen leads with FINAL REVIEW. */
export function isFinalReviewActive(todayISO: string = seoulToday()): boolean {
  return (
    daysBetween(FINAL_REVIEW_FROM_ISO, todayISO) >= 0 &&
    daysBetween(todayISO, EXAM_DATE_ISO) >= 0
  );
}

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === value;
}

/** Human-friendly elapsed/remaining text used in the wrong-answer queue. */
export function relativeFromNow(iso: string, now: number = Date.now()): string {
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return '';
  const diff = target - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return diff >= 0 ? '곧' : '지금';
  if (minutes < 60) return diff >= 0 ? `${minutes}분 후` : `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return diff >= 0 ? `${hours}시간 후` : `${hours}시간 전`;
  const days = Math.round(hours / 24);
  return diff >= 0 ? `${days}일 후` : `${days}일 전`;
}

export function formatClock(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
