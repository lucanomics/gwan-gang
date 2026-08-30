import { SUBJECTS, SUBJECT_META, type Subject } from './exam';
import { evaluateExam, emptyCounts, type ExamEvaluation, type SubjectCounts } from './scoring';
import type { Attempt, Question } from './types';

/** Attempts considered per subject. Older evidence is simply out of date this close to the exam. */
export const ESTIMATE_WINDOW = 50;
/** Below this, GWAN-GANG says "데이터 부족" rather than inventing a number. */
export const MIN_ATTEMPTS_PER_SUBJECT = 8;
/** Each step back in time counts slightly less. 0.97^49 ≈ 0.22. */
const RECENCY_DECAY = 0.97;

export interface SubjectEstimate {
  subject: Subject;
  /** Recency-weighted accuracy in [0,1], or null when evidence is too thin. */
  accuracy: number | null;
  /** Projected correct answers out of 25, or null. */
  expectedCorrect: number | null;
  attempts: number;
  sufficient: boolean;
}

export interface PracticeEstimate {
  bySubject: Record<Subject, SubjectEstimate>;
  /** Null until every subject has enough evidence — no half-invented totals. */
  weightedTotal: number | null;
  evaluation: ExamEvaluation | null;
  sufficient: boolean;
  totalAttempts: number;
}

/**
 * Development sample content never influences the training score, and neither
 * does an attempt on a question that has since been deleted from the bank.
 */
function isScorable(question: Question | undefined): question is Question {
  return Boolean(question) && question!.sourceType !== 'sample';
}

export function estimatePractice(
  attempts: Attempt[],
  questionsById: Map<string, Question>,
  now: number = Date.now(),
): PracticeEstimate {
  const buckets: Record<Subject, Attempt[]> = {
    history: [],
    resources: [],
    law: [],
    tourism: [],
  };

  // Newest first, so index 0 carries the highest recency weight.
  const ordered = [...attempts].sort(
    (a, b) => Date.parse(b.attemptedAt) - Date.parse(a.attemptedAt),
  );

  let totalAttempts = 0;
  for (const attempt of ordered) {
    if (Date.parse(attempt.attemptedAt) > now) continue;
    const question = questionsById.get(attempt.questionId);
    if (!isScorable(question)) continue;
    const bucket = buckets[question.subject];
    if (bucket.length >= ESTIMATE_WINDOW) continue;
    bucket.push(attempt);
    totalAttempts += 1;
  }

  const bySubject = {} as Record<Subject, SubjectEstimate>;
  const expectedCounts: SubjectCounts = emptyCounts();
  let allSufficient = true;

  for (const subject of SUBJECTS) {
    const bucket = buckets[subject];
    const sufficient = bucket.length >= MIN_ATTEMPTS_PER_SUBJECT;
    if (!sufficient) allSufficient = false;

    let weighted = 0;
    let weightSum = 0;
    bucket.forEach((attempt, index) => {
      const weight = RECENCY_DECAY ** index;
      weightSum += weight;
      if (attempt.correct) weighted += weight;
    });

    const accuracy = weightSum > 0 ? weighted / weightSum : null;
    const expectedCorrect =
      sufficient && accuracy !== null
        ? Math.round(accuracy * SUBJECT_META[subject].questionCount * 10) / 10
        : null;

    bySubject[subject] = {
      subject,
      accuracy: sufficient ? accuracy : null,
      expectedCorrect,
      attempts: bucket.length,
      sufficient,
    };
    expectedCounts[subject] = expectedCorrect ?? 0;
  }

  if (!allSufficient) {
    return {
      bySubject,
      weightedTotal: null,
      evaluation: null,
      sufficient: false,
      totalAttempts,
    };
  }

  const evaluation = evaluateExam(expectedCounts);
  return {
    bySubject,
    weightedTotal: evaluation.weightedTotal,
    evaluation,
    sufficient: true,
    totalAttempts,
  };
}

/** Expected-correct counts with unknown subjects treated as 0, for the leverage calculator. */
export function expectedCounts(estimate: PracticeEstimate): SubjectCounts {
  const counts = emptyCounts();
  for (const subject of SUBJECTS) {
    counts[subject] = estimate.bySubject[subject].expectedCorrect ?? 0;
  }
  return counts;
}
