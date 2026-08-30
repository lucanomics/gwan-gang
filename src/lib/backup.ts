import { z } from 'zod';
import { SUBJECTS } from './exam';
import { questionSchema } from './schema';
import { DEFAULT_PREFERENCES, type Preferences } from './types';
import type {
  Attempt,
  ConceptNote,
  MockExam,
  Question,
  ReviewItem,
  StudySession,
} from './types';

export const BACKUP_FORMAT = 'gwan-gang-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  questions: Question[];
  attempts: Attempt[];
  reviews: ReviewItem[];
  sessions: StudySession[];
  mocks: MockExam[];
  notes: ConceptNote[];
  preferences: Preferences;
}

const subjectSchema = z.enum(SUBJECTS);
const errorTypeSchema = z.enum(['knowledge', 'confusion', 'mistake']);
const confidenceSchema = z.enum(['know', 'unsure', 'guess']);

const attemptSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  selectedAnswer: z.number().int(),
  correct: z.boolean(),
  responseTimeMs: z.number().nonnegative().optional(),
  confidence: confidenceSchema.optional(),
  errorType: errorTypeSchema.optional(),
  sessionId: z.string().optional(),
  mock: z.boolean().optional(),
  attemptedAt: z.string().min(1),
});

const reviewSchema = z.object({
  questionId: z.string().min(1),
  subject: subjectSchema,
  stage: z.number().int().min(0),
  errorType: errorTypeSchema,
  dueAt: z.string().min(1),
  lastReviewedAt: z.string().min(1),
  streak: z.number().int().min(0),
  lapses: z.number().int().min(0),
  retired: z.boolean().optional(),
});

const sessionAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedAnswer: z.number().int(),
  correct: z.boolean(),
  responseTimeMs: z.number().nonnegative().optional(),
  confidence: confidenceSchema.optional(),
  errorType: errorTypeSchema.optional(),
  answeredAt: z.string().min(1),
});

const sessionSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['quick5', 'quick10', 'subject25', 'review', 'vs', 'final', 'mock']),
  subject: subjectSchema.optional(),
  questionIds: z.array(z.string()),
  cursor: z.number().int().min(0),
  answers: z.record(sessionAnswerSchema),
  startedAt: z.string().min(1),
  finishedAt: z.string().optional(),
});

/** All four subjects are always present; a missing key restores as 0. */
const subjectCountsSchema = z.object({
  history: z.number().default(0),
  resources: z.number().default(0),
  law: z.number().default(0),
  tourism: z.number().default(0),
});

const mockResultSchema = z.object({
  correctBySubject: subjectCountsSchema,
  answeredBySubject: subjectCountsSchema,
  weightedTotal: z.number(),
  passed: z.boolean(),
  cutoffFailures: z.array(subjectSchema),
  wrongQuestionIds: z.array(z.string()),
  unansweredQuestionIds: z.array(z.string()),
  durationMs: z.number(),
  finishedAt: z.string(),
});

const mockSchema = z.object({
  id: z.string().min(1),
  questionIds: z.array(z.string()),
  answers: z.record(z.number().int()),
  startedAt: z.string().min(1),
  deadlineAt: z.string().min(1),
  submittedAt: z.string().optional(),
  result: mockResultSchema.optional(),
  allowedUnverified: z.boolean().default(false),
});

const noteSchema = z.object({
  id: z.string().min(1),
  subject: subjectSchema.optional(),
  topic: z.string().optional(),
  tags: z.array(z.string()).optional(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const preferencesSchema = z.object({
  includeUnverifiedInPractice: z.boolean().default(true),
  includeSamples: z.boolean().default(true),
  showQuestionTimer: z.boolean().default(false),
  keyboardShortcuts: z.boolean().default(true),
  simulatedDate: z.string().optional(),
});

export interface RestoreReport {
  data: Omit<BackupFile, 'format' | 'version' | 'exportedAt'> | null;
  errors: string[];
  /** Rows dropped because they failed validation, by store. */
  skipped: Record<string, number>;
}

function collect<S extends z.ZodTypeAny>(
  rows: unknown,
  schema: S,
  label: string,
  skipped: Record<string, number>,
): z.output<S>[] {
  if (!Array.isArray(rows)) return [];
  const out: z.output<S>[] = [];
  let dropped = 0;
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else dropped += 1;
  }
  if (dropped) skipped[label] = dropped;
  return out;
}

export function buildBackup(
  data: Omit<BackupFile, 'format' | 'version' | 'exportedAt'>,
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...data,
  };
}

/**
 * Restores a backup. Individual malformed rows are dropped and reported rather
 * than aborting the whole restore — a partly readable backup still beats none.
 */
export function parseBackup(text: string): RestoreReport {
  const skipped: Record<string, number> = {};
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      data: null,
      errors: [`JSON 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
      skipped,
    };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: null, errors: ['백업 파일 형식이 올바르지 않습니다'], skipped };
  }

  const file = raw as Record<string, unknown>;
  if (file.format !== BACKUP_FORMAT) {
    return {
      data: null,
      errors: ['GWAN-GANG 백업 파일이 아닙니다 (format 필드 불일치)'],
      skipped,
    };
  }

  const prefsParsed = preferencesSchema.safeParse(file.preferences ?? {});

  return {
    data: {
      questions: collect(file.questions, questionSchema, 'questions', skipped),
      attempts: collect(file.attempts, attemptSchema, 'attempts', skipped),
      reviews: collect(file.reviews, reviewSchema, 'reviews', skipped),
      sessions: collect(file.sessions, sessionSchema, 'sessions', skipped),
      mocks: collect(file.mocks, mockSchema, 'mocks', skipped),
      notes: collect(file.notes, noteSchema, 'notes', skipped),
      preferences: prefsParsed.success ? prefsParsed.data : { ...DEFAULT_PREFERENCES },
    },
    errors: [],
    skipped,
  };
}
