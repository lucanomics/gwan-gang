import { describe, expect, it } from 'vitest';
import {
  REVIEW_LADDER,
  dueReviews,
  intervalFor,
  isDue,
  isLadderComplete,
  openReviews,
  scheduleAfterHit,
  scheduleAfterMiss,
} from './review';
import type { ReviewItem } from './types';

const NOW = Date.parse('2026-08-30T09:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('the cram ladder', () => {
  it('brings 헷갈림 back fastest and 실수 back the next day', () => {
    expect(intervalFor('confusion', 0)).toBe(5 * MINUTE);
    expect(intervalFor('knowledge', 0)).toBe(10 * MINUTE);
    expect(intervalFor('mistake', 0)).toBe(DAY);
  });

  it('stays inside the six-day horizon', () => {
    for (const ladder of Object.values(REVIEW_LADDER)) {
      expect(Math.max(...ladder)).toBeLessThanOrEqual(2 * DAY);
    }
  });
});

describe('scheduleAfterMiss', () => {
  it('schedules a first miss at the start of its ladder', () => {
    const item = scheduleAfterMiss(undefined, {
      questionId: 'q1',
      subject: 'law',
      errorType: 'confusion',
      now: NOW,
    });
    expect(item.stage).toBe(0);
    expect(item.lapses).toBe(1);
    expect(Date.parse(item.dueAt)).toBe(NOW + 5 * MINUTE);
    expect(item.retired).toBe(false);
  });

  it('resets a previously advanced item and counts the lapse', () => {
    const advanced: ReviewItem = {
      questionId: 'q1',
      subject: 'law',
      stage: 2,
      errorType: 'knowledge',
      dueAt: new Date(NOW).toISOString(),
      lastReviewedAt: new Date(NOW).toISOString(),
      streak: 2,
      lapses: 1,
      retired: true,
    };
    const item = scheduleAfterMiss(advanced, {
      questionId: 'q1',
      subject: 'law',
      errorType: 'knowledge',
      now: NOW,
    });
    expect(item.stage).toBe(0);
    expect(item.streak).toBe(0);
    expect(item.lapses).toBe(2);
    expect(item.retired).toBe(false);
  });
});

describe('scheduleAfterHit', () => {
  it('lengthens the interval on each correct recall', () => {
    let item = scheduleAfterMiss(undefined, {
      questionId: 'q1',
      subject: 'history',
      errorType: 'knowledge',
      now: NOW,
    });
    item = scheduleAfterHit(item, NOW);
    expect(item.stage).toBe(1);
    expect(item.streak).toBe(1);
    expect(Date.parse(item.dueAt)).toBe(NOW + 6 * HOUR);

    item = scheduleAfterHit(item, NOW);
    expect(Date.parse(item.dueAt)).toBe(NOW + DAY);
  });

  it('retires an item once it walks off the end of its ladder', () => {
    let item = scheduleAfterMiss(undefined, {
      questionId: 'q1',
      subject: 'history',
      errorType: 'mistake',
      now: NOW,
    });
    item = scheduleAfterHit(item, NOW);
    expect(item.retired).toBe(false);
    item = scheduleAfterHit(item, NOW);
    expect(isLadderComplete('mistake', item.stage)).toBe(true);
    expect(item.retired).toBe(true);
    expect(isDue(item, NOW + 10 * DAY)).toBe(false);
  });
});

describe('the review queue', () => {
  const make = (id: string, dueOffset: number, retired = false): ReviewItem => ({
    questionId: id,
    subject: 'law',
    stage: 0,
    errorType: 'knowledge',
    dueAt: new Date(NOW + dueOffset).toISOString(),
    lastReviewedAt: new Date(NOW).toISOString(),
    streak: 0,
    lapses: 1,
    retired,
  });

  it('returns due items most overdue first and hides retired ones', () => {
    const items = [make('later', HOUR), make('overdue', -2 * HOUR), make('recent', -MINUTE), make('done', -DAY, true)];
    expect(dueReviews(items, NOW).map((i) => i.questionId)).toEqual(['overdue', 'recent']);
    expect(openReviews(items).map((i) => i.questionId)).toEqual(['later', 'overdue', 'recent']);
  });
});
