import { SUBJECTS, SUBJECT_META, TOTAL_QUESTIONS, type Subject } from './exam';
import { shuffle } from './adaptive';
import { mockPool } from './pool';
import { emptyCounts, evaluateExam } from './scoring';
import type { MockExam, MockResult, Question } from './types';

export interface MockBuild {
  questionIds: string[];
  /** How many questions each subject is missing relative to the required 25. */
  shortfall: Record<Subject, number>;
  /** True only when a full, real 100-question exam could be assembled. */
  complete: boolean;
  availableBySubject: Record<Subject, number>;
}

/**
 * A mock exam is a simulation, not a drill: the questions are sampled at random
 * rather than by weakness, exactly 25 per subject, and by default only from
 * verified content.
 */
export function buildMock(
  questions: Question[],
  options: { allowUnverified: boolean; random?: () => number },
): MockBuild {
  const random = options.random ?? Math.random;
  const pool = mockPool(questions, options.allowUnverified);

  const questionIds: string[] = [];
  const shortfall = { history: 0, resources: 0, law: 0, tourism: 0 } as Record<Subject, number>;
  const availableBySubject = { history: 0, resources: 0, law: 0, tourism: 0 } as Record<Subject, number>;

  for (const subject of SUBJECTS) {
    const need = SUBJECT_META[subject].questionCount;
    const candidates = pool.filter((q) => q.subject === subject);
    availableBySubject[subject] = candidates.length;
    const picked = shuffle(candidates, random).slice(0, need);
    shortfall[subject] = need - picked.length;
    questionIds.push(...picked.map((q) => q.id));
  }

  return {
    questionIds,
    shortfall,
    complete: questionIds.length === TOTAL_QUESTIONS,
    availableBySubject,
  };
}

/** Grades a mock against the official weighted formula. Unanswered counts as wrong. */
export function gradeMock(
  mock: MockExam,
  questionsById: Map<string, Question>,
  finishedAt: number = Date.now(),
): MockResult {
  const correctBySubject = emptyCounts();
  const answeredBySubject = emptyCounts();
  const wrongQuestionIds: string[] = [];
  const unansweredQuestionIds: string[] = [];

  for (const id of mock.questionIds) {
    const question = questionsById.get(id);
    if (!question) continue;
    const selected = mock.answers[id];
    if (selected === undefined || selected < 0) {
      unansweredQuestionIds.push(id);
      wrongQuestionIds.push(id);
      continue;
    }
    answeredBySubject[question.subject] += 1;
    if (selected === question.correctAnswer) {
      correctBySubject[question.subject] += 1;
    } else {
      wrongQuestionIds.push(id);
    }
  }

  const evaluation = evaluateExam(correctBySubject);
  const started = Date.parse(mock.startedAt);

  return {
    correctBySubject,
    answeredBySubject,
    weightedTotal: evaluation.weightedTotal,
    passed: evaluation.passed,
    cutoffFailures: evaluation.cutoffFailures,
    wrongQuestionIds,
    unansweredQuestionIds,
    durationMs: Number.isNaN(started) ? 0 : Math.max(0, finishedAt - started),
    finishedAt: new Date(finishedAt).toISOString(),
  };
}

export function mockRemainingMs(mock: MockExam, now: number = Date.now()): number {
  const deadline = Date.parse(mock.deadlineAt);
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, deadline - now);
}

export function isMockExpired(mock: MockExam, now: number = Date.now()): boolean {
  return mockRemainingMs(mock, now) <= 0;
}
