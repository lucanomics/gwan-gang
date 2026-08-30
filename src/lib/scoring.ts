import {
  PASS_SCORE,
  SUBJECTS,
  SUBJECT_CUTOFF_CORRECT,
  SUBJECT_META,
  type Subject,
} from './exam';

export type SubjectCounts = Record<Subject, number>;

export interface ExamEvaluation {
  /** Official weighted total out of 100. */
  weightedTotal: number;
  passed: boolean;
  /** Subjects below the 40% (10/25) 과락 line. */
  cutoffFailures: Subject[];
  /** Weighted points contributed by each subject. */
  contribution: SubjectCounts;
  /** True when the weighted total clears 60 — even if a 과락 still fails the exam. */
  metScoreThreshold: boolean;
}

export const ZERO_COUNTS: SubjectCounts = {
  history: 0,
  resources: 0,
  law: 0,
  tourism: 0,
};

export function emptyCounts(): SubjectCounts {
  return { ...ZERO_COUNTS };
}

/**
 * Official weighted total.
 *
 * 관광국사 is worth 40% over 25 questions -> 1.6 points per correct answer.
 * The other three subjects are worth 20% each -> 0.8 points per correct answer.
 *
 * Computed in integer tenths so that boundary comparisons (exactly 60.0) are
 * exact rather than subject to binary floating point drift.
 */
export function weightedScore(correct: SubjectCounts): number {
  return weightedTenths(correct) / 10;
}

function weightedTenths(correct: SubjectCounts): number {
  let tenths = 0;
  for (const subject of SUBJECTS) {
    const n = clampCount(correct[subject], subject);
    tenths += n * Math.round(SUBJECT_META[subject].pointsPerCorrect * 10);
  }
  return tenths;
}

function clampCount(value: number, subject: Subject): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, SUBJECT_META[subject].questionCount);
}

/** Subjects that fall below the 과락 line (fewer than 10 of 25 correct). */
export function cutoffFailures(correct: SubjectCounts): Subject[] {
  return SUBJECTS.filter(
    (s) => clampCount(correct[s], s) < SUBJECT_CUTOFF_CORRECT,
  );
}

/**
 * The one place in the codebase that decides pass or fail.
 * Pass requires BOTH a weighted total of 60+ AND every subject at 10/25 or better.
 */
export function evaluateExam(correct: SubjectCounts): ExamEvaluation {
  const tenths = weightedTenths(correct);
  const metScoreThreshold = tenths >= PASS_SCORE * 10;
  const failures = cutoffFailures(correct);

  const contribution = emptyCounts();
  for (const subject of SUBJECTS) {
    contribution[subject] =
      (clampCount(correct[subject], subject) *
        Math.round(SUBJECT_META[subject].pointsPerCorrect * 10)) /
      10;
  }

  return {
    weightedTotal: tenths / 10,
    passed: metScoreThreshold && failures.length === 0,
    cutoffFailures: failures,
    contribution,
    metScoreThreshold,
  };
}

export type ScoreBand = 'critical' | 'danger' | 'edge' | 'target' | 'buffer';

export interface ScoreBandInfo {
  band: ScoreBand;
  label: string;
  /** Tailwind classes for the band chip. */
  tone: string;
}

const BANDS: { min: number; band: ScoreBand; label: string; tone: string }[] = [
  { min: 70, band: 'buffer', label: '완충 구간', tone: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30' },
  { min: 65, band: 'target', label: '목표 구간', tone: 'bg-brand-500/12 text-brand-700 dark:text-brand-300 ring-brand-500/30' },
  { min: 60, band: 'edge', label: '턱걸이 구간', tone: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/30' },
  { min: 55, band: 'danger', label: '위험', tone: 'bg-orange-500/12 text-orange-700 dark:text-orange-300 ring-orange-500/30' },
  { min: -Infinity, band: 'critical', label: '매우 위험', tone: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-rose-500/30' },
];

export function scoreBand(score: number): ScoreBandInfo {
  const hit = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
  return { band: hit.band, label: hit.label, tone: hit.tone };
}

export type CutoffStatus = 'fail' | 'warn' | 'safe';

export interface CutoffInfo {
  status: CutoffStatus;
  label: string;
  tone: string;
}

/**
 * Cutoff guard. Accepts fractional expected-correct values from the practice
 * estimate as well as whole counts from a finished mock exam.
 */
export function cutoffStatus(expectedCorrect: number): CutoffInfo {
  if (expectedCorrect < SUBJECT_CUTOFF_CORRECT) {
    return {
      status: 'fail',
      label: '과락 위험',
      tone: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-rose-500/30',
    };
  }
  if (expectedCorrect < SUBJECT_CUTOFF_CORRECT + 2) {
    return {
      status: 'warn',
      label: '과락 주의',
      tone: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/30',
    };
  }
  return {
    status: 'safe',
    label: '안전권',
    tone: 'bg-ink-500/10 text-ink-600 dark:text-ink-300 ring-ink-500/20',
  };
}

/** Points still needed to reach a target score. Never negative. */
export function pointsToTarget(current: number, target: number): number {
  return Math.max(0, Math.round((target - current) * 10) / 10);
}
