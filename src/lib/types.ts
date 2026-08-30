import type { Subject } from './exam';

export type { Subject };

/** Why the learner got a question wrong. Drives review scheduling and priority. */
export type ErrorType = 'knowledge' | 'confusion' | 'mistake';

/** How sure the learner was before seeing the answer. */
export type Confidence = 'know' | 'unsure' | 'guess';

export type SourceType =
  | 'official-past-exam'
  | 'public-official'
  | 'user-authored'
  | 'ai-generated'
  | 'licensed'
  | 'sample';

export type VerificationStatus = 'verified' | 'unverified';

export interface Question {
  id: string;
  subject: Subject;

  chapter?: string;
  topic?: string;
  subtopic?: string;

  question: string;
  choices: string[];
  /** 0-based index into `choices`. */
  correctAnswer: number;
  explanation: string;

  difficulty?: 1 | 2 | 3 | 4 | 5;

  sourceType: SourceType;
  sourceLabel?: string;
  sourceYear?: number;
  sourceUrl?: string;

  verificationStatus: VerificationStatus;

  tags?: string[];
  relatedTopics?: string[];
  /** Ids or concept labels this question is commonly confused with. */
  confusionPair?: string[];

  createdAt?: string;
}

export interface Attempt {
  id: string;
  questionId: string;
  /** -1 means the question was left unanswered (mock exam timeout). */
  selectedAnswer: number;
  correct: boolean;
  responseTimeMs?: number;
  confidence?: Confidence;
  errorType?: ErrorType;
  sessionId?: string;
  /** Attempts made inside a mock exam are excluded from adaptive recency noise. */
  mock?: boolean;
  attemptedAt: string;
}

/** Short-horizon cram scheduling state, one row per question the learner has missed. */
export interface ReviewItem {
  questionId: string;
  subject: Subject;
  /** Which rung of the interval ladder the item currently sits on. */
  stage: number;
  errorType: ErrorType;
  dueAt: string;
  lastReviewedAt: string;
  /** Consecutive correct recalls since the last miss. */
  streak: number;
  lapses: number;
  /** Cleared items stay in the table for stats but stop being scheduled. */
  retired?: boolean;
}

export type SessionMode =
  | 'quick5'
  | 'quick10'
  | 'subject25'
  | 'review'
  | 'vs'
  | 'final'
  | 'mock';

export interface StudySession {
  id: string;
  mode: SessionMode;
  subject?: Subject;
  questionIds: string[];
  /** Index of the next unanswered question — the resume point. */
  cursor: number;
  answers: Record<string, SessionAnswer>;
  startedAt: string;
  finishedAt?: string;
}

export interface SessionAnswer {
  questionId: string;
  selectedAnswer: number;
  correct: boolean;
  responseTimeMs?: number;
  confidence?: Confidence;
  errorType?: ErrorType;
  answeredAt: string;
}

export interface MockExam {
  id: string;
  questionIds: string[];
  /** questionId -> selected index. Missing key = unanswered. */
  answers: Record<string, number>;
  startedAt: string;
  /** Wall-clock deadline; survives reloads so the timer cannot be cheated by refreshing. */
  deadlineAt: string;
  submittedAt?: string;
  /** Frozen result, computed once at submission. */
  result?: MockResult;
  /** True when the learner explicitly allowed unverified questions into the mock. */
  allowedUnverified: boolean;
}

export interface MockResult {
  correctBySubject: Record<Subject, number>;
  answeredBySubject: Record<Subject, number>;
  weightedTotal: number;
  passed: boolean;
  cutoffFailures: Subject[];
  wrongQuestionIds: string[];
  unansweredQuestionIds: string[];
  durationMs: number;
  finishedAt: string;
}

export interface ConceptNote {
  id: string;
  subject?: Subject;
  topic?: string;
  tags?: string[];
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Preferences {
  /** Include unverified (AI-generated / user-authored) questions in normal practice. */
  includeUnverifiedInPractice: boolean;
  /** Include clearly-labelled development sample questions in practice and estimates. */
  includeSamples: boolean;
  /** Compact per-question timer in the study view. */
  showQuestionTimer: boolean;
  /** Number keys 1-4 select an answer. */
  keyboardShortcuts: boolean;
  /** Manual override of "today" for verifying D-day / final-review behaviour. */
  simulatedDate?: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  includeUnverifiedInPractice: true,
  includeSamples: true,
  showQuestionTimer: false,
  keyboardShortcuts: true,
};

export const ERROR_TYPE_LABEL: Record<ErrorType, string> = {
  knowledge: '몰랐음',
  confusion: '헷갈림',
  mistake: '실수',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  know: '확실',
  unsure: '애매',
  guess: '찍음',
};

export const SOURCE_LABEL: Record<SourceType, string> = {
  'official-past-exam': '기출',
  'public-official': '공식자료',
  'user-authored': '사용자 입력',
  'ai-generated': 'AI 변형',
  licensed: '교재 기반',
  sample: '샘플',
};
