import { describe, expect, it } from 'vitest';
import {
  COOLDOWN_MS,
  buildStats,
  priorityOf,
  selectBySubject,
  selectConfusion,
  selectMixed,
  selectReview,
  subjectQuotas,
} from './adaptive';
import { makeAttempt, makeBank, makeQuestion, seededRandom } from './testing';
import { scheduleAfterMiss } from './review';
import type { Attempt, ReviewItem } from './types';

const NOW = Date.parse('2026-08-30T09:00:00Z');
const HOUR = 3_600_000;

const emptyReviews = new Map<string, ReviewItem>();

function statsFor(attempts: Attempt[]) {
  return buildStats(attempts);
}

describe('buildStats', () => {
  it('rolls attempts up per question, keeping the most recent classification', () => {
    const stats = statsFor([
      makeAttempt({ questionId: 'q1', correct: false, errorType: 'knowledge', attemptedAt: new Date(NOW - 2 * HOUR).toISOString() }),
      makeAttempt({ questionId: 'q1', correct: false, errorType: 'confusion', confidence: 'guess', attemptedAt: new Date(NOW - HOUR).toISOString() }),
      makeAttempt({ questionId: 'q2', correct: true, attemptedAt: new Date(NOW).toISOString() }),
    ]);
    expect(stats.get('q1')!.exposures).toBe(2);
    expect(stats.get('q1')!.wrong).toBe(2);
    expect(stats.get('q1')!.lastErrorType).toBe('confusion');
    expect(stats.get('q1')!.lastConfidence).toBe('guess');
    expect(stats.get('q2')!.wrong).toBe(0);
  });
});

describe('priorityOf', () => {
  const question = makeQuestion({ id: 'q1', subject: 'law' });

  it('ranks a wrong question above a right one', () => {
    const wrong = priorityOf(
      question,
      { exposures: 1, wrong: 1, lastAttemptAt: NOW - 24 * HOUR, lastCorrect: false, lastErrorType: undefined, lastConfidence: undefined },
      undefined,
      NOW,
    );
    const right = priorityOf(
      question,
      { exposures: 1, wrong: 0, lastAttemptAt: NOW - 24 * HOUR, lastCorrect: true, lastErrorType: undefined, lastConfidence: undefined },
      undefined,
      NOW,
    );
    expect(wrong.priority).toBeGreaterThan(right.priority);
  });

  it('weights 관광국사 twice as heavily as the other subjects', () => {
    const stats = { exposures: 0, wrong: 0, lastAttemptAt: null, lastCorrect: null, lastErrorType: undefined, lastConfidence: undefined };
    const history = priorityOf(makeQuestion({ id: 'h', subject: 'history' }), stats, undefined, NOW);
    const law = priorityOf(makeQuestion({ id: 'l', subject: 'law' }), stats, undefined, NOW);
    expect(history.subject).toBe(2);
    expect(history.priority).toBeCloseTo(law.priority * 2, 6);
  });

  it('puts 헷갈림 above 몰랐음, and 실수 below both', () => {
    const base = { exposures: 1, wrong: 1, lastAttemptAt: NOW - 24 * HOUR, lastCorrect: false as const, lastConfidence: undefined };
    const confusion = priorityOf(question, { ...base, lastErrorType: 'confusion' }, undefined, NOW);
    const knowledge = priorityOf(question, { ...base, lastErrorType: 'knowledge' }, undefined, NOW);
    const mistake = priorityOf(question, { ...base, lastErrorType: 'mistake' }, undefined, NOW);
    expect(confusion.priority).toBeGreaterThan(knowledge.priority);
    expect(knowledge.priority).toBeGreaterThan(mistake.priority);
  });

  it('boosts a due review and damps a retired one', () => {
    const stats = { exposures: 1, wrong: 1, lastAttemptAt: NOW - 24 * HOUR, lastCorrect: false as const, lastErrorType: undefined, lastConfidence: undefined };
    const due = scheduleAfterMiss(undefined, { questionId: 'q1', subject: 'law', errorType: 'knowledge', now: NOW - HOUR });
    const retired = { ...due, retired: true };
    expect(priorityOf(question, stats, due, NOW).reviewDue).toBe(2.5);
    expect(priorityOf(question, stats, retired, NOW).reviewDue).toBe(0.6);
  });

  it('raises priority as time since the last exposure grows', () => {
    const recent = priorityOf(question, { exposures: 1, wrong: 0, lastAttemptAt: NOW - HOUR, lastCorrect: true, lastErrorType: undefined, lastConfidence: undefined }, undefined, NOW);
    const stale = priorityOf(question, { exposures: 1, wrong: 0, lastAttemptAt: NOW - 72 * HOUR, lastCorrect: true, lastErrorType: undefined, lastConfidence: undefined }, undefined, NOW);
    expect(stale.priority).toBeGreaterThan(recent.priority);
  });
});

describe('subjectQuotas', () => {
  const plenty = { history: 40, resources: 40, law: 40, tourism: 40 };

  it('gives 관광국사 3-4 of a 10 question mixed session', () => {
    const quotas = subjectQuotas(10, plenty, { history: 0.6, resources: 0.6, law: 0.6, tourism: 0.6 });
    expect(quotas.history).toBeGreaterThanOrEqual(3);
    expect(quotas.history).toBeLessThanOrEqual(4);
    expect(Object.values(quotas).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('never lets one subject monopolise a mixed session', () => {
    const quotas = subjectQuotas(10, plenty, { history: 0.2, resources: 0.9, law: 0.9, tourism: 0.9 });
    expect(quotas.history).toBeLessThanOrEqual(4);
    expect(quotas.resources + quotas.law + quotas.tourism).toBeGreaterThanOrEqual(6);
  });

  it('gives the weakest non-history subject the largest remaining share', () => {
    const quotas = subjectQuotas(10, plenty, { history: 0.7, resources: 0.9, law: 0.2, tourism: 0.9 });
    expect(quotas.law).toBeGreaterThanOrEqual(quotas.resources);
    expect(quotas.law).toBeGreaterThanOrEqual(quotas.tourism);
    expect(quotas.law).toBeGreaterThanOrEqual(2);
  });

  it('reallocates when a subject has too few questions', () => {
    const quotas = subjectQuotas(10, { history: 1, resources: 40, law: 40, tourism: 40 });
    expect(quotas.history).toBe(1);
    expect(Object.values(quotas).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('asks for no more than the bank holds', () => {
    const quotas = subjectQuotas(10, { history: 1, resources: 1, law: 1, tourism: 0 });
    expect(Object.values(quotas).reduce((a, b) => a + b, 0)).toBe(3);
    expect(quotas.tourism).toBe(0);
  });
});

describe('selectMixed', () => {
  const bank = makeBank(15);

  it('returns the requested number of distinct questions', () => {
    const picked = selectMixed({
      questions: bank,
      stats: new Map(),
      reviews: emptyReviews,
      count: 10,
      now: NOW,
      random: seededRandom(1),
    });
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((q) => q.id)).size).toBe(10);
  });

  it('covers multiple subjects rather than drilling one', () => {
    const picked = selectMixed({
      questions: bank,
      stats: new Map(),
      reviews: emptyReviews,
      count: 10,
      now: NOW,
      random: seededRandom(7),
    });
    const subjects = new Set(picked.map((q) => q.subject));
    expect(subjects.size).toBeGreaterThanOrEqual(3);
    expect(picked.filter((q) => q.subject === 'history').length).toBeGreaterThanOrEqual(3);
  });

  it('holds back questions answered in the last few minutes', () => {
    const justAnswered = bank.slice(0, 8).map((q) =>
      makeAttempt({ questionId: q.id, attemptedAt: new Date(NOW - COOLDOWN_MS / 2).toISOString() }),
    );
    const picked = selectMixed({
      questions: bank,
      stats: statsFor(justAnswered),
      reviews: emptyReviews,
      count: 5,
      now: NOW,
      random: seededRandom(3),
    });
    const cooled = new Set(justAnswered.map((a) => a.questionId));
    expect(picked.every((q) => !cooled.has(q.id))).toBe(true);
  });

  it('does not produce the same session twice in a row', () => {
    const first = selectMixed({ questions: bank, stats: new Map(), reviews: emptyReviews, count: 10, now: NOW, random: seededRandom(11) });
    const second = selectMixed({ questions: bank, stats: new Map(), reviews: emptyReviews, count: 10, now: NOW, random: seededRandom(99) });
    expect(first.map((q) => q.id).join()).not.toBe(second.map((q) => q.id).join());
  });

  it('honours the exclusion set so a session never repeats a question', () => {
    const exclude = new Set(bank.slice(0, 50).map((q) => q.id));
    const picked = selectMixed({
      questions: bank,
      stats: new Map(),
      reviews: emptyReviews,
      count: 5,
      now: NOW,
      exclude,
      random: seededRandom(5),
    });
    expect(picked.every((q) => !exclude.has(q.id))).toBe(true);
  });

  it('prefers questions the learner got wrong', () => {
    const attempts = bank
      .filter((q) => q.subject === 'law')
      .slice(0, 5)
      .map((q) => makeAttempt({ questionId: q.id, correct: false, errorType: 'confusion', attemptedAt: new Date(NOW - 48 * HOUR).toISOString() }));
    const wrongIds = new Set(attempts.map((a) => a.questionId));

    let hits = 0;
    for (let seed = 0; seed < 20; seed += 1) {
      const picked = selectBySubject({
        questions: bank,
        stats: statsFor(attempts),
        reviews: emptyReviews,
        subject: 'law',
        count: 5,
        now: NOW,
        random: seededRandom(seed + 1),
      });
      hits += picked.filter((q) => wrongIds.has(q.id)).length;
    }
    // 5 wrong of 15 law questions: random picking would average ~1.7 per draw.
    expect(hits / 20).toBeGreaterThan(2.5);
  });

  it('returns an empty session rather than throwing when the bank is empty', () => {
    expect(
      selectMixed({ questions: [], stats: new Map(), reviews: emptyReviews, count: 10, now: NOW }),
    ).toEqual([]);
  });
});

describe('selectBySubject', () => {
  it('only returns questions from the chosen subject', () => {
    const picked = selectBySubject({
      questions: makeBank(30),
      stats: new Map(),
      reviews: emptyReviews,
      subject: 'history',
      count: 25,
      now: NOW,
      random: seededRandom(2),
    });
    expect(picked).toHaveLength(25);
    expect(picked.every((q) => q.subject === 'history')).toBe(true);
  });
});

describe('selectReview', () => {
  const bank = makeBank(5);

  it('returns due items before items that are not due yet', () => {
    const reviews = new Map<string, ReviewItem>();
    reviews.set('law-0', scheduleAfterMiss(undefined, { questionId: 'law-0', subject: 'law', errorType: 'knowledge', now: NOW - 5 * HOUR }));
    reviews.set('law-1', scheduleAfterMiss(undefined, { questionId: 'law-1', subject: 'law', errorType: 'mistake', now: NOW }));

    const picked = selectReview({ questions: bank, stats: new Map(), reviews, count: 5, now: NOW });
    expect(picked[0].id).toBe('law-0');
  });

  it('filters by error type and by subject', () => {
    const reviews = new Map<string, ReviewItem>();
    reviews.set('law-0', scheduleAfterMiss(undefined, { questionId: 'law-0', subject: 'law', errorType: 'confusion', now: NOW - HOUR }));
    reviews.set('history-0', scheduleAfterMiss(undefined, { questionId: 'history-0', subject: 'history', errorType: 'knowledge', now: NOW - HOUR }));

    expect(selectReview({ questions: bank, stats: new Map(), reviews, count: 5, now: NOW, errorType: 'confusion' }).map((q) => q.id)).toEqual(['law-0']);
    expect(selectReview({ questions: bank, stats: new Map(), reviews, count: 5, now: NOW, subject: 'history' }).map((q) => q.id)).toEqual(['history-0']);
  });

  it('skips retired items and questions missing from the bank', () => {
    const reviews = new Map<string, ReviewItem>();
    const retired = scheduleAfterMiss(undefined, { questionId: 'law-0', subject: 'law', errorType: 'knowledge', now: NOW - HOUR });
    reviews.set('law-0', { ...retired, retired: true });
    reviews.set('deleted', scheduleAfterMiss(undefined, { questionId: 'deleted', subject: 'law', errorType: 'knowledge', now: NOW - HOUR }));
    expect(selectReview({ questions: bank, stats: new Map(), reviews, count: 5, now: NOW })).toEqual([]);
  });
});

describe('selectConfusion', () => {
  it('only returns questions carrying a confusion pair', () => {
    const bank = [
      makeQuestion({ id: 'a', confusionPair: ['등록 vs 신고'] }),
      makeQuestion({ id: 'b' }),
      makeQuestion({ id: 'c', confusionPair: ['허가 vs 지정'] }),
    ];
    const picked = selectConfusion({
      questions: bank,
      stats: new Map(),
      reviews: emptyReviews,
      count: 5,
      now: NOW,
      random: seededRandom(4),
    });
    expect(picked.map((q) => q.id).sort()).toEqual(['a', 'c']);
  });
});
