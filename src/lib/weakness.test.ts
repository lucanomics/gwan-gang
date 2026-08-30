import { describe, expect, it } from 'vitest';
import { analyseWeakness, weakestSubjects } from './weakness';
import { makeAttempt, makeQuestion } from './testing';
import { scheduleAfterMiss } from './review';
import type { Question } from './types';

const NOW = Date.parse('2026-08-30T09:00:00Z');

const bank: Question[] = [
  makeQuestion({ id: 'h1', subject: 'history', topic: '조선' }),
  makeQuestion({ id: 'l1', subject: 'law', topic: '등록', confusionPair: ['등록 vs 신고'] }),
  makeQuestion({ id: 'l2', subject: 'law', topic: '등록' }),
];
const byId = new Map(bank.map((q) => [q.id, q]));

describe("today's counts", () => {
  it('attributes attempts to the Seoul calendar day, not the UTC one', () => {
    // 2026-08-29 21:20 UTC is already 2026-08-30 06:20 in Seoul.
    const attempts = [
      makeAttempt({ questionId: 'h1', correct: true, attemptedAt: '2026-08-29T21:20:00Z' }),
      makeAttempt({ questionId: 'l1', correct: false, attemptedAt: '2026-08-29T21:25:00Z' }),
      // 2026-08-29 10:00 UTC is 19:00 on the 29th in Seoul — yesterday.
      makeAttempt({ questionId: 'l2', correct: true, attemptedAt: '2026-08-29T10:00:00Z' }),
    ];
    const report = analyseWeakness(attempts, byId, [], { now: NOW, todayISO: '2026-08-30' });
    expect(report.todayCount).toBe(2);
    expect(report.todayCorrect).toBe(1);
  });
});

describe('analyseWeakness', () => {
  it('ranks topics by the weighted points they are costing', () => {
    const attempts = [
      makeAttempt({ questionId: 'h1', correct: false, errorType: 'knowledge', attemptedAt: '2026-08-30T01:00:00Z' }),
      makeAttempt({ questionId: 'h1', correct: false, errorType: 'knowledge', attemptedAt: '2026-08-30T02:00:00Z' }),
      makeAttempt({ questionId: 'l1', correct: false, errorType: 'confusion', attemptedAt: '2026-08-30T03:00:00Z' }),
      makeAttempt({ questionId: 'l2', correct: true, attemptedAt: '2026-08-30T04:00:00Z' }),
      makeAttempt({ questionId: 'l2', correct: false, errorType: 'mistake', attemptedAt: '2026-08-30T05:00:00Z' }),
    ];
    const report = analyseWeakness(attempts, byId, [], { now: NOW, todayISO: '2026-08-30' });

    // 관광국사 wrong answers cost 1.6 each, so 조선 outranks 등록.
    expect(report.topics[0].topic).toBe('조선');
    expect(report.errorDistribution).toEqual({ knowledge: 2, confusion: 1, mistake: 1 });
    expect(report.confusionPairs).toEqual(['등록 vs 신고']);
    expect(report.recentWrong.map((r) => r.question.id)).toContain('l1');
  });

  it('does not surface a topic from a single attempt', () => {
    const attempts = [makeAttempt({ questionId: 'h1', correct: false, attemptedAt: '2026-08-30T01:00:00Z' })];
    expect(analyseWeakness(attempts, byId, [], { now: NOW }).topics).toEqual([]);
  });

  it('counts only reviews that are actually due', () => {
    const reviews = [
      scheduleAfterMiss(undefined, { questionId: 'h1', subject: 'history', errorType: 'knowledge', now: NOW - 3_600_000 }),
      scheduleAfterMiss(undefined, { questionId: 'l1', subject: 'law', errorType: 'mistake', now: NOW }),
    ];
    const report = analyseWeakness([], byId, reviews, { now: NOW });
    expect(report.dueCount).toBe(1);
    expect(report.openReviewCount).toBe(2);
  });

  it('ignores attempts on questions that were deleted', () => {
    const report = analyseWeakness(
      [makeAttempt({ questionId: 'gone', correct: false, attemptedAt: '2026-08-30T01:00:00Z' })],
      byId,
      [],
      { now: NOW, todayISO: '2026-08-30' },
    );
    expect(report.todayCount).toBe(0);
    expect(report.topics).toEqual([]);
  });
});

describe('weakestSubjects', () => {
  it('orders from weakest to strongest, treating unknown as weakest', () => {
    expect(weakestSubjects({ history: 20, resources: 12, law: null, tourism: 18 })[0]).toBe('law');
    expect(weakestSubjects({ history: 20, resources: 12, law: 15, tourism: 18 })[0]).toBe('resources');
  });
});
