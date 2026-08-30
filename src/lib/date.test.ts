import { describe, expect, it } from 'vitest';
import { daysBetween, dday, formatClock, isFinalReviewActive, isValidISODate, relativeFromNow, seoulToday } from './date';

describe('seoulToday', () => {
  it('reports the Seoul calendar date, not the host timezone date', () => {
    // 2026-09-04 16:00 UTC is already 2026-09-05 01:00 in Seoul (UTC+9).
    expect(seoulToday(new Date('2026-09-04T16:00:00Z'))).toBe('2026-09-05');
    // 2026-09-04 14:59 UTC is still 2026-09-04 23:59 in Seoul.
    expect(seoulToday(new Date('2026-09-04T14:59:00Z'))).toBe('2026-09-04');
  });
});

describe('dday', () => {
  it('counts down to the exam', () => {
    expect(dday('2026-08-30').label).toBe('D-6');
    expect(dday('2026-08-30').days).toBe(6);
    expect(dday('2026-09-04').label).toBe('D-1');
    expect(dday('2026-09-05').label).toBe('D-DAY');
    expect(dday('2026-09-05').days).toBe(0);
  });

  it('degrades to a neutral label after the exam instead of a negative D-day', () => {
    const after = dday('2026-09-06');
    expect(after.label).toBe('시험일 이후');
    expect(after.past).toBe(true);
    expect(dday('2027-01-01').label).toBe('시험일 이후');
  });

  it('handles month boundaries', () => {
    expect(daysBetween('2026-08-31', '2026-09-05')).toBe(5);
    expect(dday('2026-08-31').label).toBe('D-5');
  });
});

describe('isFinalReviewActive', () => {
  it('turns on from 2026-09-04 through exam day only', () => {
    expect(isFinalReviewActive('2026-09-03')).toBe(false);
    expect(isFinalReviewActive('2026-09-04')).toBe(true);
    expect(isFinalReviewActive('2026-09-05')).toBe(true);
    expect(isFinalReviewActive('2026-09-06')).toBe(false);
  });
});

describe('isValidISODate', () => {
  it('rejects malformed and impossible dates', () => {
    expect(isValidISODate('2026-09-05')).toBe(true);
    expect(isValidISODate('2026-9-5')).toBe(false);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('not a date')).toBe(false);
  });
});

describe('formatClock', () => {
  it('formats remaining milliseconds and never goes negative', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5000)).toBe('00:00');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(100 * 60_000)).toBe('100:00');
  });
});

describe('relativeFromNow', () => {
  it('describes past and future due times', () => {
    const now = Date.parse('2026-08-30T00:00:00Z');
    expect(relativeFromNow('2026-08-30T00:30:00Z', now)).toBe('30분 후');
    expect(relativeFromNow('2026-08-29T22:00:00Z', now)).toBe('2시간 전');
    expect(relativeFromNow('2026-08-31T00:00:00Z', now)).toBe('1일 후');
  });
});
