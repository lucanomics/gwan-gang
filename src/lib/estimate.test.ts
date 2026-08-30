import { describe, expect, it } from 'vitest';
import { MIN_ATTEMPTS_PER_SUBJECT, estimatePractice, expectedCounts } from './estimate';
import { makeAttempt, makeBank, makeQuestion } from './testing';
import { SUBJECTS } from './exam';
import type { Attempt, Question } from './types';

const NOW = Date.parse('2026-08-30T09:00:00Z');

function attemptsFor(questions: Question[], correctRatio: number, startOffsetMs = 0): Attempt[] {
  return questions.map((q, i) =>
    makeAttempt({
      questionId: q.id,
      correct: i < Math.round(questions.length * correctRatio),
      attemptedAt: new Date(NOW - startOffsetMs - i * 60_000).toISOString(),
    }),
  );
}

describe('estimatePractice', () => {
  const bank = makeBank(20);
  const byId = new Map(bank.map((q) => [q.id, q]));

  it('says 데이터 부족 rather than inventing a total', () => {
    const estimate = estimatePractice([], byId, NOW);
    expect(estimate.sufficient).toBe(false);
    expect(estimate.weightedTotal).toBeNull();
    expect(estimate.evaluation).toBeNull();
    for (const subject of SUBJECTS) {
      expect(estimate.bySubject[subject].expectedCorrect).toBeNull();
    }
  });

  it('withholds the total while any single subject is still thin', () => {
    const attempts = SUBJECTS.flatMap((subject) => {
      const pool = bank.filter((q) => q.subject === subject);
      const take = subject === 'tourism' ? MIN_ATTEMPTS_PER_SUBJECT - 1 : MIN_ATTEMPTS_PER_SUBJECT;
      return attemptsFor(pool.slice(0, take), 0.8);
    });
    const estimate = estimatePractice(attempts, byId, NOW);
    expect(estimate.bySubject.history.expectedCorrect).not.toBeNull();
    expect(estimate.bySubject.tourism.expectedCorrect).toBeNull();
    expect(estimate.weightedTotal).toBeNull();
  });

  it('projects accuracy onto 25 questions per subject once evidence is sufficient', () => {
    const attempts = SUBJECTS.flatMap((subject) =>
      attemptsFor(bank.filter((q) => q.subject === subject).slice(0, 10), 0.8),
    );
    const estimate = estimatePractice(attempts, byId, NOW);
    expect(estimate.sufficient).toBe(true);
    for (const subject of SUBJECTS) {
      expect(estimate.bySubject[subject].expectedCorrect).toBeGreaterThan(18);
      expect(estimate.bySubject[subject].expectedCorrect).toBeLessThanOrEqual(25);
    }
    expect(estimate.weightedTotal).toBeGreaterThan(60);
  });

  it('never counts development sample questions toward the score', () => {
    const samples = Array.from({ length: 20 }, (_, i) =>
      makeQuestion({ id: `sample-${i}`, subject: 'law', sourceType: 'sample' }),
    );
    const sampleById = new Map(samples.map((q) => [q.id, q]));
    const estimate = estimatePractice(attemptsFor(samples, 1), sampleById, NOW);
    expect(estimate.totalAttempts).toBe(0);
    expect(estimate.bySubject.law.expectedCorrect).toBeNull();
  });

  it('ignores attempts on questions that no longer exist', () => {
    const estimate = estimatePractice(
      [makeAttempt({ questionId: 'deleted', attemptedAt: new Date(NOW).toISOString() })],
      byId,
      NOW,
    );
    expect(estimate.totalAttempts).toBe(0);
  });

  it('weights recent evidence more heavily than old evidence', () => {
    const law = bank.filter((q) => q.subject === 'law');
    // 10 old wrong answers, then 10 recent correct ones.
    const older = law.slice(0, 10).map((q, i) =>
      makeAttempt({ questionId: q.id, correct: false, attemptedAt: new Date(NOW - 10 * 86_400_000 - i * 60_000).toISOString() }),
    );
    const recent = law.slice(10, 20).map((q, i) =>
      makeAttempt({ questionId: q.id, correct: true, attemptedAt: new Date(NOW - i * 60_000).toISOString() }),
    );
    const estimate = estimatePractice([...older, ...recent], byId, NOW);
    // A flat average would be 0.5; recency weighting must push it above.
    expect(estimate.bySubject.law.accuracy).toBeGreaterThan(0.5);
  });

  it('ignores attempts dated in the future', () => {
    const law = bank.filter((q) => q.subject === 'law').slice(0, 10);
    const future = law.map((q) =>
      makeAttempt({ questionId: q.id, correct: true, attemptedAt: new Date(NOW + 86_400_000).toISOString() }),
    );
    expect(estimatePractice(future, byId, NOW).totalAttempts).toBe(0);
  });
});

describe('expectedCounts', () => {
  it('treats unknown subjects as zero so the leverage calculator stays safe', () => {
    const counts = expectedCounts(estimatePractice([], new Map(), NOW));
    expect(counts).toEqual({ history: 0, resources: 0, law: 0, tourism: 0 });
  });
});
