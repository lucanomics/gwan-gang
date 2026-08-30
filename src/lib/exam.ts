/**
 * Single source of truth for the 2026 관광통역안내사 1차 필기시험 structure.
 * Nothing in the UI may redefine these numbers.
 */

export const SUBJECTS = ['history', 'resources', 'law', 'tourism'] as const;
export type Subject = (typeof SUBJECTS)[number];

export interface SubjectMeta {
  id: Subject;
  /** Official Korean subject name. */
  name: string;
  /** Compact label for tight mobile layouts. */
  short: string;
  /** Share of the weighted total (sums to 1). */
  weight: number;
  /** Points earned per correct answer in the official weighted total. */
  pointsPerCorrect: number;
  /** Questions asked in the real exam. */
  questionCount: number;
  /** Adaptive-engine bias: 관광국사 is worth double, so it is drilled twice as hard. */
  drillMultiplier: number;
  /** Tailwind text colour token used for subject accents. */
  accent: string;
}

export const SUBJECT_META: Record<Subject, SubjectMeta> = {
  history: {
    id: 'history',
    name: '관광국사',
    short: '국사',
    weight: 0.4,
    pointsPerCorrect: 1.6,
    questionCount: 25,
    drillMultiplier: 2.0,
    accent: 'text-amber-600 dark:text-amber-400',
  },
  resources: {
    id: 'resources',
    name: '관광자원해설',
    short: '자원',
    weight: 0.2,
    pointsPerCorrect: 0.8,
    questionCount: 25,
    drillMultiplier: 1.0,
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  law: {
    id: 'law',
    name: '관광법규',
    short: '법규',
    weight: 0.2,
    pointsPerCorrect: 0.8,
    questionCount: 25,
    drillMultiplier: 1.0,
    accent: 'text-sky-600 dark:text-sky-400',
  },
  tourism: {
    id: 'tourism',
    name: '관광학개론',
    short: '관광학',
    weight: 0.2,
    pointsPerCorrect: 0.8,
    questionCount: 25,
    drillMultiplier: 1.0,
    accent: 'text-violet-600 dark:text-violet-400',
  },
};

export const TOTAL_QUESTIONS = 100;
export const MOCK_DURATION_MINUTES = 100;
export const MOCK_DURATION_MS = MOCK_DURATION_MINUTES * 60 * 1000;

/** Weighted total needed to pass. */
export const PASS_SCORE = 60;
/** Per-subject minimum ratio; below this the whole exam is failed (과락). */
export const SUBJECT_CUTOFF_RATIO = 0.4;
/** With 25 questions per subject, 10 correct is the 과락 line. */
export const SUBJECT_CUTOFF_CORRECT = Math.ceil(
  SUBJECT_META.history.questionCount * SUBJECT_CUTOFF_RATIO,
);

/** Exam date, in Asia/Seoul. */
export const EXAM_DATE_ISO = '2026-09-05';
/** From this date GWAN-GANG switches the home screen into FINAL REVIEW mode. */
export const FINAL_REVIEW_FROM_ISO = '2026-09-04';

export const SEOUL_TZ = 'Asia/Seoul';

export function subjectName(s: Subject): string {
  return SUBJECT_META[s].name;
}

export function isSubject(value: unknown): value is Subject {
  return typeof value === 'string' && (SUBJECTS as readonly string[]).includes(value);
}
