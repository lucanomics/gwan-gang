import { describe, expect, it } from 'vitest';
import { buildMock, gradeMock, isMockExpired, mockRemainingMs } from './mock';
import { makeBank, makeQuestion, seededRandom } from './testing';
import { MOCK_DURATION_MS, TOTAL_QUESTIONS } from './exam';
import type { MockExam, Question } from './types';

function mockFrom(questions: Question[], answers: Record<string, number>, overrides: Partial<MockExam> = {}): MockExam {
  const startedAt = Date.parse('2026-08-30T09:00:00Z');
  return {
    id: 'm1',
    questionIds: questions.map((q) => q.id),
    answers,
    startedAt: new Date(startedAt).toISOString(),
    deadlineAt: new Date(startedAt + MOCK_DURATION_MS).toISOString(),
    allowedUnverified: false,
    ...overrides,
  };
}

describe('buildMock', () => {
  it('assembles exactly 100 questions, 25 from each subject', () => {
    const build = buildMock(makeBank(30), { allowUnverified: false, random: seededRandom(1) });
    expect(build.complete).toBe(true);
    expect(build.questionIds).toHaveLength(TOTAL_QUESTIONS);
    expect(new Set(build.questionIds).size).toBe(TOTAL_QUESTIONS);
    expect(Object.values(build.shortfall)).toEqual([0, 0, 0, 0]);
  });

  it('excludes unverified questions by default', () => {
    const bank = [
      ...makeBank(30),
      makeQuestion({ id: 'ai-1', subject: 'law', sourceType: 'ai-generated', verificationStatus: 'unverified' }),
    ];
    const build = buildMock(bank, { allowUnverified: false, random: seededRandom(2) });
    expect(build.questionIds).not.toContain('ai-1');
  });

  it('reports a per-subject shortfall instead of padding with anything else', () => {
    const bank = makeBank(30).filter((q) => q.subject !== 'law' || Number(q.id.split('-')[1]) < 12);
    const build = buildMock(bank, { allowUnverified: false, random: seededRandom(3) });
    expect(build.complete).toBe(false);
    expect(build.shortfall.law).toBe(13);
    expect(build.shortfall.history).toBe(0);
    expect(build.questionIds.filter((id) => id.startsWith('law-'))).toHaveLength(12);
  });

  it('lets the learner opt unverified content in explicitly', () => {
    const bank = makeBank(30).map((q) => ({ ...q, verificationStatus: 'unverified' as const }));
    expect(buildMock(bank, { allowUnverified: false }).questionIds).toHaveLength(0);
    expect(buildMock(bank, { allowUnverified: true, random: seededRandom(4) }).questionIds).toHaveLength(TOTAL_QUESTIONS);
  });
});

describe('gradeMock', () => {
  const bank = makeBank(25);
  const byId = new Map(bank.map((q) => [q.id, q]));

  it('applies the official weighted formula and counts unanswered as wrong', () => {
    const answers: Record<string, number> = {};
    bank.forEach((q) => {
      // Correct answer is index 0; answer every history question correctly.
      if (q.subject === 'history') answers[q.id] = 0;
      else if (q.subject !== 'tourism') answers[q.id] = 1;
      // tourism is left unanswered entirely.
    });

    const result = gradeMock(mockFrom(bank, answers), byId, Date.parse('2026-08-30T10:00:00Z'));
    expect(result.correctBySubject).toEqual({ history: 25, resources: 0, law: 0, tourism: 0 });
    expect(result.answeredBySubject.tourism).toBe(0);
    expect(result.unansweredQuestionIds).toHaveLength(25);
    expect(result.weightedTotal).toBe(40);
    expect(result.passed).toBe(false);
    expect(result.durationMs).toBe(3_600_000);
  });

  it('fails a 60+ exam that has a single subject below the cutoff', () => {
    const answers: Record<string, number> = {};
    bank.forEach((q) => {
      const index = Number(q.id.split('-')[1]);
      if (q.subject === 'law') answers[q.id] = index < 9 ? 0 : 1;
      else answers[q.id] = 0;
    });

    const result = gradeMock(mockFrom(bank, answers), byId);
    expect(result.correctBySubject.law).toBe(9);
    expect(result.weightedTotal).toBe(87.2);
    expect(result.weightedTotal).toBeGreaterThan(60);
    expect(result.cutoffFailures).toEqual(['law']);
    expect(result.passed).toBe(false);
  });

  it('passes a full-marks exam', () => {
    const answers = Object.fromEntries(bank.map((q) => [q.id, 0]));
    const result = gradeMock(mockFrom(bank, answers), byId);
    expect(result.weightedTotal).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.wrongQuestionIds).toHaveLength(0);
  });

  it('ignores questions that were deleted from the bank after the exam started', () => {
    const answers = Object.fromEntries(bank.map((q) => [q.id, 0]));
    const partial = new Map([...byId].filter(([id]) => !id.startsWith('law-')));
    const result = gradeMock(mockFrom(bank, answers), partial);
    expect(result.correctBySubject.law).toBe(0);
    expect(result.correctBySubject.history).toBe(25);
  });
});

describe('the mock timer', () => {
  it('counts down from the persisted deadline so a refresh cannot buy time', () => {
    const startedAt = Date.parse('2026-08-30T09:00:00Z');
    const mock = mockFrom([], {});
    expect(mockRemainingMs(mock, startedAt)).toBe(MOCK_DURATION_MS);
    expect(mockRemainingMs(mock, startedAt + 40 * 60_000)).toBe(60 * 60_000);
    expect(mockRemainingMs(mock, startedAt + MOCK_DURATION_MS + 5_000)).toBe(0);
    expect(isMockExpired(mock, startedAt + MOCK_DURATION_MS)).toBe(true);
    expect(isMockExpired(mock, startedAt)).toBe(false);
  });
});
